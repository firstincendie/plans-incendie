# Validation Plans Finaux — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter une étape "Validation en cours" entre "Ébauche déposée" et "Validé", où le dessinateur dépose 1 fichier final par plan, avec auto-validation quand tous les plans sont couverts.

**Architecture:** Nouveau statut dans constants.js, nouveau modal côté dessinateur pour l'upload plan par plan, colonne "Fichier final" dans le tableau Plans à réaliser, utilisation de la colonne `plans_finalises` jsonb existante.

**Tech Stack:** React, Supabase (DB + Storage bucket `fichiers`), JS inline styles (pattern existant)

---

## Flux de statuts

```
En attente → Commencé → Ébauche déposée ⇄ Modification dessinateur
                               ↓
                       Validation en cours  ← NOUVEAU (déclenché depuis "Ébauche déposée" par l'utilisateur)
                               ↓ (auto quand plans.length === plans_finalises.length)
                            Validé
```

Note : L'utilisateur peut demander la validation depuis le statut "Ébauche déposée". Dans STATUTS_ADMIN, "Validation en cours" est positionné après "Modification dessinateur" car c'est un stade logiquement plus avancé (les deux états "Ébauche déposée" et "Modification dessinateur" peuvent mener à "Validation en cours").

---

## Section 1 — constants.js

### Changements
- Ajouter `"Validation en cours"` dans `STATUTS_ADMIN` entre `"Modification dessinateur"` et `"Validé"` :
  ```js
  export const STATUTS_ADMIN = ["En attente", "Commencé", "Ébauche déposée", "Modification dessinateur", "Validation en cours", "Validé"];
  ```
- Ajouter le style badge dans `STATUT_STYLE` :
  ```js
  "Validation en cours": { bg: "#ECFDF5", color: "#047857" }
  ```
  (vert clair, distinct de "Validé" qui est `#D1FAE5 / #065F46`)

---

## Section 2 — Structure de plans_finalises

La colonne `plans_finalises jsonb` existe déjà sur la table `commandes`. Elle est initialisée à `[]` à la création.

Chaque entrée correspond à un plan :
```json
[
  {
    "plan_index": 0,
    "nom": "REZE-003-1.pdf",
    "url": "https://...supabase.co/storage/v1/object/public/fichiers/finals/...",
    "taille": "245 Ko",
    "ajouteLe": "24/03/2026"
  },
  {
    "plan_index": 1,
    "nom": "REZE-003-2.pdf",
    "url": "https://...",
    "taille": "312 Ko",
    "ajouteLe": "24/03/2026"
  }
]
```

Le matching se fait par `plan_index` (0-based, correspond à l'index dans `selected.plans`).

### Nommage des fichiers
Format : `{nom_plan}-{ref_number}-{plan_index+1}.{ext}`
- `nom_plan` : champ `nom_plan` de la commande (ex: "REZE")
- `ref_number` : extrait du champ `ref` avec `selected.ref.split("-")[1]` (ex: "003" depuis "CMD-003")
- `plan_index+1` : numéro du plan (1-based)
- `ext` : extension du fichier uploadé

Exemple : commande `ref="CMD-003"`, `nom_plan="REZE"`, plan n°2 → `REZE-003-2.pdf`

Chemin Storage : `finals/{commande_id}/{nom_fichier_renomme}`

---

## Section 3 — VueUtilisateur.js

### Suppression du code obsolète
Supprimer les éléments suivants qui ne servent plus :
- State : `showValidModal`, `validant`
- Fonction : `validerCommande()`
- Le modal de validation existant (JSX `{showValidModal && ...}`)

### actionButtons dans DetailCommandeModal

**Statut "Ébauche déposée"** (inchangé sauf label du bouton) :
```jsx
<div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
  <button onClick={() => setShowModifModal(true)}>
    ✏️ Demander une modification
  </button>
  <button onClick={() => demanderValidation()}>
    📋 Demander la validation
  </button>
</div>
```

**Nouvelle fonction `demanderValidation()`** :
```js
async function demanderValidation() {
  if (!selected) return;
  await changerStatut(selected.id, "Validation en cours");
  await envoyerMessage(selected.id, auteurNom, "📋 Validation demandée.");
}
```

**Statut "Validation en cours"** — nouvelle bannière :
```jsx
<div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#047857", marginBottom: 20 }}>
  📋 Validation en cours — le dessinateur dépose les plans finaux
</div>
```

**Statut "Validé"** : inchangé (`"✅ Commande validée — messagerie fermée"`).

### Mobile
Les `actionButtons` sont passés en prop à `DetailCommandeModal` et affichés dans le tab "infos" — aucune modification supplémentaire nécessaire, le système existant couvre le mobile automatiquement.

### readOnly
La messagerie est `readOnly` quand `statut === "Validé"` (ligne existante). Aucun changement : "Validation en cours" laisse la messagerie ouverte.

---

## Section 4 — VueDessinateur.js

### Ajout de changerStatut
`VueDessinateur.js` n'a pas de fonction `changerStatut`. L'ajouter :
```js
async function changerStatut(id, statut) {
  const { error } = await supabase.from("commandes").update({ statut }).eq("id", id);
  if (!error) {
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
    if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
  }
}
```

### Nouveau bouton "Déposer les plans finaux"

Condition d'affichage : `selected && selected.statut === "Validation en cours"`

Placement : même zone que le bouton "Déposer une ébauche" (panneau latéral droit desktop + section mobile).

```jsx
{selected && selected.statut === "Validation en cours" && (
  <button onClick={() => setShowPlansFinalModal(true)}
    style={{ /* même style que bouton ébauche, couleur verte */ }}>
    📐 Déposer les plans finaux
  </button>
)}
```

### Nouveau modal ShowPlansFinalModal

États nécessaires :
```js
const [showPlansFinalModal, setShowPlansFinalModal] = useState(false);
const [uploadingPlanIndex, setUploadingPlanIndex] = useState(null); // null = aucun upload en cours
```

Structure du modal (overlay zIndex: 600) :
```
Titre : "Déposer les plans finaux"
Sous-titre : "1 fichier requis par plan. Le statut passera à Validé automatiquement."

Pour chaque plan (selected.plans.map) :
  ┌─────────────────────────────────────────────────────┐
  │ N°1  Évacuation — Paysage — A3                      │
  │      [Pas encore déposé]           [📎 Choisir]     │
  └─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────┐
  │ N°2  Intervention — Portrait — A4                   │
  │      REZE-003-2.pdf (245 Ko)       [🔄 Remplacer]   │
  └─────────────────────────────────────────────────────┘

Bouton fermer : [✕ Fermer]
```

Chaque bouton "Choisir"/"Remplacer" :
- Déclenche un `<input type="file" style={{ display:"none" }}>` (1 par plan, via ref ou index)
- Est **désactivé** (`disabled`) quand `uploadingPlanIndex !== null` (upload global en cours)
- Affiche `"⏳ Envoi..."` quand `uploadingPlanIndex === planIndex`

### Fonction deposerPlanFinal(planIndex, file)

```js
async function deposerPlanFinal(planIndex, file) {
  setUploadingPlanIndex(planIndex);
  const ext = file.name.split(".").pop();
  const refNumber = selected.ref.split("-")[1]; // "CMD-003" → "003"
  const nomFichier = `${selected.nom_plan}-${refNumber}-${planIndex + 1}.${ext}`;
  const chemin = `finals/${selected.id}/${nomFichier}`;

  const { error: uploadError } = await supabase.storage.from("fichiers").upload(chemin, file, { upsert: true });
  if (uploadError) { console.error(uploadError); setUploadingPlanIndex(null); return; }

  const { data: urlData } = supabase.storage.from("fichiers").getPublicUrl(chemin);
  const nouvelleEntree = {
    plan_index: planIndex,
    nom: nomFichier,
    url: urlData.publicUrl,
    taille: (file.size / 1024).toFixed(0) + " Ko",
    ajouteLe: new Date().toLocaleDateString("fr-FR"),
  };

  // Remplacer ou ajouter dans plans_finalises
  // Note: on lit selected.plansFinalises au moment de l'appel ; les boutons sont désactivés
  // pendant l'upload (uploadingPlanIndex !== null), évitant les soumissions concurrentes.
  const anciens = (selected.plansFinalises || []).filter(p => p.plan_index !== planIndex);
  const nouveaux = [...anciens, nouvelleEntree];

  await supabase.from("commandes").update({ plans_finalises: nouveaux }).eq("id", selected.id);

  // Mise à jour locale
  setCommandes(prev => prev.map(c => c.id === selected.id ? { ...c, plansFinalises: nouveaux } : c));
  setSelected(prev => ({ ...prev, plansFinalises: nouveaux }));
  setUploadingPlanIndex(null);

  // Auto-validation si tous les plans sont couverts
  // On utilise `nouveaux` (construit localement) pour le check, pas selected.plansFinalises
  // (qui pourrait être stale). Les boutons désactivés pendant l'upload éliminent la race condition.
  if (nouveaux.length === selected.plans.length) {
    await changerStatut(selected.id, "Validé");
    await envoyerMessage(selected.id, auteurNom, "✅ Plans finaux déposés. Commande validée.");
    setShowPlansFinalModal(false);
  }
}
```

---

## Section 5 — DetailCommandeModal.js

### Tableau "Plans à réaliser" — colonne "Fichier final"

Le tableau passe de 4 à 5 colonnes : `N° / Type de plan / Orientation / Format / Fichier final`

Le composant reçoit déjà `selected.plansFinalises` via `selected`.

```jsx
// En-tête — reprendre exactement les styles existants du <th>, seul changement :
// borderRight passe de `i < 3` à `i < 4` (5 colonnes au lieu de 4)
{["N°", "Type de plan", "Orientation", "Format", "Fichier final"].map((h, i) => (
  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", borderBottom: "2px solid #D1D5DB", borderRight: i < 4 ? "1px solid #D1D5DB" : "none" }}>{h}</th>
))}

// Lignes
{selected.plans.map((p, i) => {
  const fichierFinal = (selected.plansFinalises || []).find(f => f.plan_index === i);
  return (
    <tr key={i}>
      <td>{i + 1}</td>
      <td>{p.type || "—"}</td>
      <td>{p.orientation || "—"}</td>
      <td>{p.format || "—"}</td>
      <td>
        {fichierFinal
          ? <a href={fichierFinal.url} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: "#2563EB", fontWeight: 500, textDecoration: "none" }}>
              📐 {fichierFinal.nom}
            </a>
          : <span style={{ color: "#9CA3AF", fontSize: 11 }}>—</span>
        }
      </td>
    </tr>
  );
})}
```

Cette colonne est visible par tous (utilisateur, dessinateur, admin) en desktop et mobile.

---

## Section 6 — Chargement initial (VueUtilisateur + VueDessinateur)

Les deux vues mappent `c.plans_finalises || []` vers `plansFinalises` dans l'objet commande local. Cette ligne existe déjà. Aucun changement nécessaire.

`select("*, messages(*)")` au chargement inclut bien `plans_finalises`. Confirmé.

---

## Fichiers modifiés

| Fichier | Nature |
|---|---|
| `src/constants.js` | Nouveau statut + badge |
| `src/components/VueUtilisateur.js` | Supprimer `validerCommande`/`showValidModal`/`validant`, renommer bouton, nouvelle fonction `demanderValidation`, bannière "Validation en cours" |
| `src/components/VueDessinateur.js` | Ajouter `changerStatut`, nouveau bouton + modal `ShowPlansFinalModal`, fonction `deposerPlanFinal`, état `uploadingPlanIndex` |
| `src/components/DetailCommandeModal.js` | Colonne "Fichier final" dans le tableau Plans |

## Aucune migration DB requise

La colonne `plans_finalises jsonb` existe déjà. Le bucket Storage `fichiers` existe déjà.
