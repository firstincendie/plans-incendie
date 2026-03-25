# Spec : Notes privées, modification de commande, notifications non lus

**Date :** 2026-03-25
**Statut :** Approuvé

---

## Feature 1 : Notes privées par utilisateur

### Contexte

Chaque utilisateur (rôle `utilisateur` ou `dessinateur`) peut annoter une commande avec des notes personnelles. Ces notes sont privées : seul l'auteur les voit.

### Base de données

#### Nouvelle table `commande_notes`

```sql
CREATE TABLE commande_notes (
  commande_id UUID NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note        TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (commande_id, user_id)
);
```

#### RLS

```sql
ALTER TABLE commande_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utilisateur gere ses propres notes"
  ON commande_notes
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### UI

- Section "Mes notes" dans le panneau gauche du `DetailCommandeModal`, sous les infos existantes.
- `<textarea>` pleine largeur (mobile-compatible : `width: 100%`, `min-height: 80px`, `box-sizing: border-box`, taille de police min 16px pour éviter le zoom iOS).
- Auto-save au `onBlur` : UPSERT dans `commande_notes`. En cas d'erreur, afficher un message discret sous la textarea ("Erreur lors de la sauvegarde") sans bloquer l'UI. En cas de succès, pas de feedback visuel (silencieux).
- Chargement au moment où la commande est sélectionnée (`onOpen`).
- Placeholder : *"Ajouter une note personnelle..."*
- Aucune synchronisation temps réel (les notes sont privées, pas besoin).

### Chargement

Au moment où `selected` change (ouverture du modal) :

```js
const { data } = await supabase
  .from("commande_notes")
  .select("note")
  .eq("commande_id", selected.id)
  .eq("user_id", session.user.id)
  .maybeSingle();
setNote(data?.note ?? "");
```

### Sauvegarde

```js
await supabase.from("commande_notes").upsert({
  commande_id: selected.id,
  user_id: session.user.id,
  note: noteValue,
  updated_at: new Date().toISOString(),
});
```

### Props ajoutées à `DetailCommandeModal`

```js
note, setNote, onSaveNote
// note : string (valeur courante)
// setNote : setter React
// onSaveNote : () => Promise<void> — appelée au blur
```

---

## Feature 2 : Modification de commande par l'utilisateur

### Contexte

L'utilisateur peut modifier sa commande depuis le `DetailCommandeModal`. Chaque modification génère un message système dans le chat, visible des deux parties. Les champs contact ne sont pas détaillés dans le message (le dessinateur voit le chat mais pas les contacts).

### Champs modifiables

| Champ DB | Libellé affiché | Type |
|---|---|---|
| `nom_plan` | Nom du plan | texte |
| `client_nom`, `client_prenom`, `client_email`, `client_telephone` | Contacts | groupe (affiché comme "Contacts") |
| `adresse1`, `adresse2`, `code_postal`, `ville` | Adresse | groupe (affiché comme "Adresse") |
| `delai` | Délai | date |
| `plans` | Plans à réaliser | tableau JSON |
| `instructions` | Instructions | texte long |

### Champs NON modifiables

`dessinateur_id`, `dessinateur`, `fichiers_plan`, `logo_client`, `utilisateur_id`, `ref`, `statut`, `created_at`

### Conditions d'affichage

Le bouton "Modifier" n'est visible que si :
- L'utilisateur actif est de rôle `utilisateur` (non dessinateur)
- Le statut de la commande n'est ni `"Validé"` ni `"Archivé"`

### UI

- Bouton "✏️ Modifier" dans le header du modal (à gauche du badge statut), visible selon conditions ci-dessus.
- Au clic : passe en mode édition. Les champs de `InfosContent` deviennent éditables (inputs inline, à la place des blocs affichage).
- Boutons en bas : "Sauvegarder" et "Annuler".
- "Annuler" : restaure les valeurs initiales sans appel réseau.
- "Sauvegarder" : calcule le diff, UPDATE en base, envoie le message système, quitte le mode édition.

### Mode édition — champs

- `nom_plan` → `<input type="text">`
- `delai` → `<input type="date">`
- `instructions` → `<textarea>`
- Contacts (client_nom, client_prenom, client_email, client_telephone) → 4 inputs groupés sous "Contacts"
- Adresse (adresse1, adresse2, code_postal, ville) → 4 inputs groupés sous "Adresse"
- `plans` → réutiliser `TableauPlans` en mode éditable si possible, sinon textarea JSON — **simplification : afficher le tableau mais sans édition inline de chaque ligne** ; à la place, un bouton "Modifier les plans" ouvre un sous-modal ou utilise le composant `TableauPlans` existant.

  **Choix retenu (YAGNI)** : En mode édition, la table statique "Plans à réaliser" est remplacée inline par le composant `TableauPlans` (déjà utilisé dans le formulaire de création dans `VueUtilisateur`). Pas de modal dans la modal. Le composant `TableauPlans` reçoit `plans` et `setPlans` pour l'édition locale ; la sauvegarde se fait avec le reste du formulaire au clic "Sauvegarder".

### Message système généré

Le message est envoyé au nom de `auteurNom` (prénom + nom de l'utilisateur connecté), pour cohérence avec les autres messages système existants (ex: "🚀 Mission commencée.", "✅ Commande validée.").

Format :

```
✏️ Commande modifiée :
- Nom du plan : "Ancien nom" → "Nouveau nom"
- Délai : 15 mars 2025 → 22 mars 2025
- Contacts mis à jour
- Adresse mise à jour
- Instructions mises à jour
- Plans à réaliser mis à jour
```

Règles :
- Seuls les champs effectivement modifiés apparaissent dans le message.
- Pour contacts : une seule ligne "Contacts mis à jour" si au moins un des 4 champs a changé (pas les valeurs).
- Pour adresse : une seule ligne "Adresse mise à jour" si au moins un des 4 champs a changé.
- Pour plans : une seule ligne "Plans à réaliser mis à jour" si le tableau a changé.
- Pour instructions : une seule ligne "Instructions mises à jour" (pas le contenu).
- Pour nom_plan et delai : ancienne valeur → nouvelle valeur.

### Props ajoutées à `DetailCommandeModal`

```js
onModifierCommande  // async (id, updates, diff) => void — appelée à la sauvegarde
canModifier         // boolean — affiche ou non le bouton Modifier
```

### Implémentation dans VueUtilisateur

```js
async function modifierCommande(id, updates, changementsTexte) {
  const { error } = await supabase.from("commandes").update(updates).eq("id", id);
  if (error) return;
  // Mettre à jour l'état local
  setCommandes(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  setSelected(prev => ({ ...prev, ...updates }));
  // Message système
  await envoyerMessage(id, auteurNom, changementsTexte);
}
```

---

## Feature 3 : Notifications (bulle messages non lus)

### Contexte

Signaler visuellement à l'utilisateur qu'une commande a des messages non lus, sans qu'il ait à ouvrir chaque commande.

### Calcul des non-lus

Basé sur `lu_par[]` déjà présent dans chaque message. Un message est non lu si :
- `m.auteur !== auteurNom` (pas envoyé par l'utilisateur actif)
- `!(m.lu_par || []).includes(auteurNom)`

### Badge sur chaque ligne de commande

Dans les 3 listes (actives, terminees, archivees) de `VueUtilisateur` et `VueDessinateur` :

```js
const nonLusCount = c.messages.filter(
  m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
).length;
```

Si `nonLusCount > 0` : afficher une bulle orange `#FC6C1B` avec le nombre, sur la cellule "Plan" (à droite du nom).

Style bulle :
```js
{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, marginLeft: 6 }
```

### Badge sur l'item nav "Commandes" / "Mes missions"

```js
const totalNonLus = commandes.reduce((acc, c) =>
  acc + c.messages.filter(m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)).length, 0
);
```

Dans le rendu des items de navigation :

```jsx
<button key={item.id} ...>
  <span>{item.icon}</span>
  <span>{item.label}</span>
  {item.id === "commandes" && totalNonLus > 0 && (
    <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, marginLeft: "auto" }}>
      {totalNonLus}
    </span>
  )}
</button>
```

Même logique dans `VueDessinateur` sur l'item `"commandes"` (libellé "Mes missions").

### Temps réel et badges

Les abonnements Realtime existants (`postgres_changes` sur `messages`) mettent à jour le state local `commandes` à chaque nouveau message reçu. Les badges se recalculent automatiquement depuis ce state, sans abonnement supplémentaire. Le badge d'une commande disparaît quand l'utilisateur ouvre la commande (via `marquerMessagesLus` + state local).

### Marquer comme lu

Le comportement existant (`marquerMessagesLus`) est déjà appelé à l'ouverture d'une commande via `onMarquerLu`. Les badges disparaîtront automatiquement grâce à la mise à jour du state local.

---

## Composants impactés

| Composant | Changements |
|---|---|
| `DetailCommandeModal.js` | + section notes, + mode édition, + props `note/setNote/onSaveNote/onModifierCommande/canModifier` |
| `VueUtilisateur.js` | + state note + chargement note + `modifierCommande()`, + badge nav, + badge lignes |
| `VueDessinateur.js` | + state note + chargement note + `onSaveNote`, + badge nav, + badge lignes |
| Supabase DB | + table `commande_notes` + RLS |

## Contraintes

- Notes : sauvegarde au blur uniquement (pas de temps réel, pas de bouton dédié)
- Modification : uniquement pour rôle `utilisateur`, statut non `Validé`/`Archivé`
- Message de modification : envoyé au nom de l'utilisateur (pas "Système")
- Plans : le composant `TableauPlans` est réutilisé tel quel en mode édition
- Mobile notes : textarea `width: 100%`, `font-size: 16px` (évite zoom iOS), `box-sizing: border-box`
