# Validation Plans Finaux — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter l'étape "Validation en cours" au workflow : l'utilisateur demande la validation, le dessinateur dépose 1 fichier final par plan, le statut passe automatiquement à "Validé" quand tous les plans sont couverts.

**Architecture:** 4 fichiers modifiés uniquement. Pas de migration DB (colonne `plans_finalises` existante). Pas de nouveaux composants — tout s'intègre dans les composants existants.

**Tech Stack:** React, Supabase JS client, Supabase Storage (bucket `fichiers`), inline styles

---

## Fichiers modifiés

| Fichier | Rôle des changements |
|---|---|
| `src/constants.js` | Ajout statut + badge "Validation en cours" |
| `src/components/VueUtilisateur.js` | Suppr. code obsolète, renommer bouton, `demanderValidation()`, bannière |
| `src/components/VueDessinateur.js` | `changerStatut()`, bouton + modal plans finaux, `deposerPlanFinal()` |
| `src/components/DetailCommandeModal.js` | Colonne "Fichier final" dans tableau Plans |

---

## Task 1 : constants.js — Nouveau statut "Validation en cours"

**Files:**
- Modify: `src/constants.js:1-9`

**Contexte :** `constants.js` définit `STATUTS_ADMIN` (liste des statuts pour l'admin) et `STATUT_STYLE` (couleurs des badges). Le nouveau statut doit apparaître entre `"Modification dessinateur"` et `"Validé"` dans les deux objets.

- [ ] **Step 1 : Modifier STATUTS_ADMIN**

Dans `src/constants.js` ligne 1, remplacer :
```js
export const STATUTS_ADMIN = ["En attente", "Commencé", "Ébauche déposée", "Modification dessinateur", "Validé"];
```
par :
```js
export const STATUTS_ADMIN = ["En attente", "Commencé", "Ébauche déposée", "Modification dessinateur", "Validation en cours", "Validé"];
```

- [ ] **Step 2 : Ajouter le badge dans STATUT_STYLE**

Dans `src/constants.js`, dans l'objet `STATUT_STYLE`, ajouter la ligne après `"Modification dessinateur"` :
```js
"Validation en cours": { bg: "#ECFDF5", color: "#047857" },
```

Résultat attendu dans `STATUT_STYLE` :
```js
export const STATUT_STYLE = {
  "En attente":               { bg: "#FEF3C7", color: "#92400E" },
  "Commencé":                 { bg: "#DBEAFE", color: "#1E40AF" },
  "Ébauche déposée":          { bg: "#EDE9FE", color: "#5B21B6" },
  "Modification dessinateur": { bg: "#FFE4E6", color: "#9F1239" },
  "Validation en cours":      { bg: "#ECFDF5", color: "#047857" },
  "Validé":                   { bg: "#D1FAE5", color: "#065F46" },
  "Archivé":                  { bg: "#F3F4F6", color: "#6B7280", border: "1px solid #D1D5DB" },
};
```

- [ ] **Step 3 : Vérifier visuellement**

Lancer `npm start` (si pas déjà lancé). Ouvrir une commande en statut "Ébauche déposée" et vérifier que le badge existe encore. Pas encore de statut "Validation en cours" dans les données — c'est normal.

- [ ] **Step 4 : Commit**

```bash
git add src/constants.js
git commit -m "feat: add 'Validation en cours' status and badge"
```

---

## Task 2 : VueUtilisateur.js — Remplacer "Valider la commande" par "Demander la validation"

**Files:**
- Modify: `src/components/VueUtilisateur.js`

**Contexte :** Ce fichier gère la vue côté utilisateur/client. Il faut :
1. Supprimer les états et fonction liés à l'ancien modal de validation directe
2. Ajouter `demanderValidation()` qui passe au statut "Validation en cours"
3. Mettre à jour les `actionButtons` passés à `DetailCommandeModal`

- [ ] **Step 1 : Supprimer les états obsolètes**

Ligne 33-34, supprimer ces deux lignes :
```js
  const [showValidModal, setShowValidModal] = useState(false);
  const [validant, setValidant] = useState(false);
```

- [ ] **Step 2 : Supprimer la fonction validerCommande()**

Lignes 191-197, supprimer entièrement :
```js
  async function validerCommande() {
    if (!selected) return;
    setValidant(true);
    await changerStatut(selected.id, "Validé");
    await envoyerMessage(selected.id, auteurNom, "✅ Commande validée. Merci pour votre travail !");
    setShowValidModal(false); setValidant(false);
  }
```

- [ ] **Step 3 : Ajouter la fonction demanderValidation()**

Ajouter après la fonction `envoyerDemandeModification()` (ligne ~189) :
```js
  async function demanderValidation() {
    if (!selected) return;
    await changerStatut(selected.id, "Validation en cours");
    await envoyerMessage(selected.id, auteurNom, "📋 Validation demandée.");
  }
```

- [ ] **Step 4 : Mettre à jour actionButtons**

Trouver le bloc `actionButtons` dans le JSX (rechercher `✅ Valider la commande`). Remplacer :
```jsx
<button onClick={() => setShowValidModal(true)}
  style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
  ✅ Valider la commande
</button>
```
par :
```jsx
<button onClick={() => demanderValidation()}
  style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
  📋 Demander la validation
</button>
```

- [ ] **Step 5 : Ajouter la bannière "Validation en cours"**

Dans le même bloc `actionButtons`, après le bloc `statut === "Ébauche déposée"`, ajouter :
```jsx
) : selected.statut === "Validation en cours" ? (
  <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#047857", marginBottom: 20 }}>
    📋 Validation en cours — le dessinateur dépose les plans finaux
  </div>
```

Le bloc complet `actionButtons` doit ressembler à :
```jsx
actionButtons={
  selected.statut === "Ébauche déposée" ? (
    <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
      <button onClick={() => setShowModifModal(true)}
        style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#92400E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        ✏️ Demander une modification
      </button>
      <button onClick={() => demanderValidation()}
        style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        📋 Demander la validation
      </button>
    </div>
  ) : selected.statut === "Validation en cours" ? (
    <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#047857", marginBottom: 20 }}>
      📋 Validation en cours — le dessinateur dépose les plans finaux
    </div>
  ) : selected.statut === "Validé" ? (
    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46" }}>
      ✅ Commande validée — messagerie fermée
    </div>
  ) : null
}
```

- [ ] **Step 6 : Supprimer le modal de validation obsolète**

Rechercher `{/* Modal validation */}` (ligne ~611). Supprimer tout le bloc `{showValidModal && (...)}` (lignes 612-628) ainsi que le commentaire `{/* Modal validation */}`.

- [ ] **Step 7 : Vérifier**

Dans le navigateur (statut "Ébauche déposée"), vérifier que le bouton affiche "📋 Demander la validation". Cliquer dessus → le statut passe à "Validation en cours" et la bannière verte apparaît. La messagerie reste ouverte.

- [ ] **Step 8 : Commit**

```bash
git add src/components/VueUtilisateur.js
git commit -m "feat: replace 'Valider commande' with 'Demander validation' flow"
```

---

## Task 3 : VueDessinateur.js — Modal upload plans finaux

**Files:**
- Modify: `src/components/VueDessinateur.js`

**Contexte :** Ce fichier gère la vue côté dessinateur. Il faut :
1. Ajouter `changerStatut()` (absente de ce fichier)
2. Ajouter 2 nouveaux états pour le modal
3. Ajouter le bouton "Déposer les plans finaux"
4. Ajouter le modal avec upload plan par plan
5. Ajouter la fonction `deposerPlanFinal()`

- [ ] **Step 1 : Ajouter les nouveaux états**

Après la ligne `const [deposant, setDeposant] = useState(false);` (ligne ~26), ajouter :
```js
  const [showPlansFinalModal, setShowPlansFinalModal] = useState(false);
  const [uploadingPlanIndex, setUploadingPlanIndex] = useState(null);
```

- [ ] **Step 2 : Ajouter changerStatut()**

Après la fonction `commencer()` (ligne ~99), ajouter :
```js
  async function changerStatut(id, statut) {
    const { error } = await supabase.from("commandes").update({ statut }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
    }
  }
```

- [ ] **Step 3 : Ajouter deposerPlanFinal()**

Après `changerStatut()`, ajouter :
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

    const anciens = (selected.plansFinalises || []).filter(p => p.plan_index !== planIndex);
    const nouveaux = [...anciens, nouvelleEntree];

    await supabase.from("commandes").update({ plans_finalises: nouveaux }).eq("id", selected.id);

    setCommandes(prev => prev.map(c => c.id === selected.id ? { ...c, plansFinalises: nouveaux } : c));
    setSelected(prev => ({ ...prev, plansFinalises: nouveaux }));
    setUploadingPlanIndex(null);

    // Auto-validation si tous les plans sont couverts
    if (nouveaux.length === selected.plans.length) {
      await changerStatut(selected.id, "Validé");
      await envoyerMessage(selected.id, auteurNom, "✅ Plans finaux déposés. Commande validée.");
      setShowPlansFinalModal(false);
    }
  }
```

- [ ] **Step 4 : Ajouter le bouton dans actionButtons**

Note préalable : `envoyerMessage` (ligne ~122) et `plansFinalises` (ligne 84 dans le mapping) existent déjà dans `VueDessinateur.js`. Aucun changement requis pour ces éléments.

Dans le JSX `actionButtons` passé à `DetailCommandeModal` (lignes ~373-393), le contenu est enveloppé dans un fragment `<>...</>`. Ajouter **à l'intérieur de ce fragment**, après le bloc `{peutDeposer && ...}` :
```jsx
{selected.statut === "Validation en cours" && (
  <button onClick={() => setShowPlansFinalModal(true)}
    style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#047857", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
    📐 Déposer les plans finaux
  </button>
)}
```

- [ ] **Step 5 : Ajouter le modal ShowPlansFinalModal**

Insérer le bloc **avant** `{/* Modal dépôt ébauche */}` (ligne ~410 dans le fichier), c'est-à-dire juste avant `{showDepotModal && (`. Ne pas insérer à l'intérieur du bloc showDepotModal. Le code s'insère au même niveau que `{showDepotModal && (...)}`, dans le JSX retourné par le composant :
```jsx
{/* Modal dépôt plans finaux */}
{showPlansFinalModal && selected && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
    <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 560, maxHeight: "80vh", overflowY: "auto" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📐 Déposer les plans finaux</div>
      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>1 fichier requis par plan. Le statut passera à "Validé" automatiquement.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {selected.plans.map((p, i) => {
          const fichierExistant = (selected.plansFinalises || []).find(f => f.plan_index === i);
          const enUpload = uploadingPlanIndex === i;
          const disabled = uploadingPlanIndex !== null;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: fichierExistant ? "#F0FDF4" : "#F9FAFB" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>N°{i + 1} — {p.type} · {p.orientation} · {p.format}</div>
                <div style={{ fontSize: 11, color: fichierExistant ? "#047857" : "#9CA3AF", marginTop: 2 }}>
                  {fichierExistant ? `✅ ${fichierExistant.nom} (${fichierExistant.taille})` : "Pas encore déposé"}
                </div>
              </div>
              <label style={{ flexShrink: 0 }}>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf" style={{ display: "none" }}
                  disabled={disabled}
                  onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) deposerPlanFinal(i, f); }} />
                <span style={{ display: "inline-block", padding: "7px 14px", borderRadius: 7, border: "1px solid #D1D5DB", background: disabled ? "#F3F4F6" : "#fff", color: disabled ? "#9CA3AF" : "#374151", fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" }}>
                  {enUpload ? "⏳ Envoi..." : fichierExistant ? "🔄 Remplacer" : "📎 Choisir"}
                </span>
              </label>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={() => setShowPlansFinalModal(false)} disabled={uploadingPlanIndex !== null}
          style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: uploadingPlanIndex !== null ? "not-allowed" : "pointer" }}>
          ✕ Fermer
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6 : Vérifier**

Dans le navigateur côté dessinateur, passer une commande en statut "Validation en cours" (depuis le compte utilisateur ou via Supabase). Vérifier :
- Le bouton "📐 Déposer les plans finaux" apparaît
- Le modal s'ouvre et liste les plans
- Uploader 1 fichier → il apparaît avec ✅ dans le modal et dans le tableau Plans à réaliser (Task 4 doit être faite aussi)
- Quand tous les plans ont un fichier → statut passe à "Validé" automatiquement, modal se ferme

- [ ] **Step 7 : Commit**

```bash
git add src/components/VueDessinateur.js
git commit -m "feat: add plans finaux upload modal and auto-validation in VueDessinateur"
```

---

## Task 4 : DetailCommandeModal.js — Colonne "Fichier final"

**Files:**
- Modify: `src/components/DetailCommandeModal.js:118-141`

**Contexte :** Le tableau "Plans à réaliser" se trouve entre les lignes 118-142. Il a 4 colonnes. On ajoute une 5e colonne "Fichier final" qui affiche le fichier uploadé (lien cliquable) ou "—".

- [ ] **Step 1 : Mettre à jour l'en-tête du tableau**

Ligne 125, remplacer :
```jsx
{["N°", "Type de plan", "Orientation", "Format"].map((h, i) => (
  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", borderBottom: "2px solid #D1D5DB", borderRight: i < 3 ? "1px solid #D1D5DB" : "none" }}>{h}</th>
))}
```
par :
```jsx
{["N°", "Type de plan", "Orientation", "Format", "Fichier final"].map((h, i) => (
  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", borderBottom: "2px solid #D1D5DB", borderRight: i < 4 ? "1px solid #D1D5DB" : "none" }}>{h}</th>
))}
```

- [ ] **Step 2 : Mettre à jour les lignes du tableau**

Lignes 131-138, remplacer :
```jsx
{selected.plans.map((p, i) => (
  <tr key={i} style={{ background: i % 2 === 1 ? "#F9FAFB" : "#fff", borderBottom: i < selected.plans.length - 1 ? "1px solid #E5E7EB" : "none" }}>
    <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", textAlign: "center", color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</td>
    <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.type || "—"}</td>
    <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.orientation || "—"}</td>
    <td style={{ padding: "9px 12px", color: "#111827" }}>{p.format || "—"}</td>
  </tr>
))}
```
par :
```jsx
{selected.plans.map((p, i) => {
  const fichierFinal = (selected.plansFinalises || []).find(f => f.plan_index === i);
  return (
    <tr key={i} style={{ background: i % 2 === 1 ? "#F9FAFB" : "#fff", borderBottom: i < selected.plans.length - 1 ? "1px solid #E5E7EB" : "none" }}>
      <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", textAlign: "center", color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</td>
      <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.type || "—"}</td>
      <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.orientation || "—"}</td>
      <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.format || "—"}</td>
      <td style={{ padding: "9px 12px", color: "#111827" }}>
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

- [ ] **Step 3 : Vérifier**

Ouvrir une commande ayant des plans. Vérifier que la colonne "Fichier final" apparaît avec "—" pour les plans sans fichier. Après upload côté dessinateur (Task 3), rafraîchir et vérifier le lien "📐 REZE-003-1.pdf" cliquable. Vérifier aussi sur mobile (tab "infos").

- [ ] **Step 4 : Build check**

```bash
npm run build 2>&1 | grep -E "error|warning" | grep -v node_modules
```
Expected: aucune erreur ESLint ni compilation.

- [ ] **Step 5 : Commit + push**

```bash
git add src/components/DetailCommandeModal.js
git commit -m "feat: add 'Fichier final' column to plans table in DetailCommandeModal"
git push origin main
```

---

## Checklist de recette finale

Tester le flux complet dans le navigateur avec deux sessions (utilisateur + dessinateur) :

- [ ] Côté utilisateur : statut "Ébauche déposée" → bouton "📋 Demander la validation" visible
- [ ] Cliquer → statut devient "Validation en cours", bannière verte apparaît, message "📋 Validation demandée." dans le chat
- [ ] Côté dessinateur : statut "Validation en cours" → bouton "📐 Déposer les plans finaux" visible
- [ ] Ouvrir le modal → liste des plans affichée avec "Pas encore déposé" et bouton "📎 Choisir"
- [ ] Uploader 1 fichier → bouton désactivé pendant l'upload, fichier apparaît avec ✅ dans le modal
- [ ] Tableau "Plans à réaliser" dans le détail → colonne "Fichier final" affiche le lien
- [ ] Quand tous les plans ont leur fichier → statut passe à "Validé", modal se ferme, message auto dans le chat
- [ ] Côté utilisateur : bannière "✅ Commande validée — messagerie fermée" apparaît
- [ ] Badge "Validation en cours" visible dans la liste des commandes (couleur vert clair, distincte de "Validé")
- [ ] Mobile : les boutons et bannières apparaissent dans le tab "infos"
