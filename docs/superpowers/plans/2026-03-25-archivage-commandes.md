# Archivage commandes (is_archived) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le statut "Archivé" par un flag booléen `is_archived`, permettre de désarchiver et de supprimer des commandes.

**Architecture:** Ajout d'une colonne `is_archived BOOLEAN` sur la table Supabase `commandes`. Le filtrage actives/archivées se fait sur ce flag (pas sur le statut). Les fonctions archiver/désarchiver/supprimer sont dans VueUtilisateur. Le DropdownMenu de DetailCommandeModal reçoit de nouveaux props conditionnels. La modal de confirmation suppression est dans VueUtilisateur et déclenchée via `onSupprimer`.

**Tech Stack:** React (Create React App), Supabase JS client, CSS-in-JS inline styles

**Spec:** `docs/superpowers/specs/2026-03-25-archivage-commandes-design.md`

---

## Fichiers à modifier

| Fichier | Changement |
|---|---|
| Supabase (SQL Editor) | Ajouter `is_archived`, migrer les anciens "Archivé" |
| `src/constants.js` | Retirer "Archivé" de STATUT_STYLE |
| `src/components/VueUtilisateur.js` | Filtres, fonctions, dropdown inline, modal suppression, props modal |
| `src/components/VueDessinateur.js` | Filtres, totalNonLus |
| `src/components/DetailCommandeModal.js` | DropdownMenu : nouveaux props onDesarchiver + onSupprimer |

---

## Task 1 : Migration Supabase

**Fichiers :**
- Supabase SQL Editor (aucun fichier local)

- [ ] **Step 1 : Exécuter la migration dans Supabase SQL Editor**

```sql
BEGIN;

ALTER TABLE commandes ADD COLUMN is_archived BOOLEAN DEFAULT false NOT NULL;

-- Migrer les anciens "Archivé" : is_archived = true ET statut = 'Validé'
UPDATE commandes
SET is_archived = true, statut = 'Validé'
WHERE statut = 'Archivé';

COMMIT;
```

- [ ] **Step 2 : Vérifier le résultat**

```sql
-- Aucune ligne ne doit avoir statut = 'Archivé'
SELECT COUNT(*) FROM commandes WHERE statut = 'Archivé';
-- Doit retourner 0

-- Les anciennes lignes ont bien is_archived = true et statut = 'Validé'
SELECT id, statut, is_archived FROM commandes WHERE is_archived = true LIMIT 10;
```

---

## Task 2 : Nettoyer constants.js

**Fichiers :**
- Modifier : `src/constants.js`

- [ ] **Step 1 : Retirer "Archivé" de STATUT_STYLE**

`STATUTS_ADMIN` n'a jamais contenu "Archivé" — rien à changer là.

```js
// Supprimer cette ligne de STATUT_STYLE :
"Archivé": { bg: "#F3F4F6", color: "#6B7280", border: "1px solid #D1D5DB" },
```

- [ ] **Step 2 : Commit**

```bash
git add src/constants.js
git commit -m "fix: retirer statut Archivé de STATUT_STYLE"
```

---

## Task 3 : Mettre à jour les filtres dans VueUtilisateur.js

**Fichiers :**
- Modifier : `src/components/VueUtilisateur.js` (lignes ~322–329, ~496)

**Dépendance :** Task 1 doit être complétée (colonne `is_archived` présente en BDD).

- [ ] **Step 1 : Modifier totalNonLus, canModifier, actives, archivees**

Trouver le bloc ~ligne 322 et remplacer :

```js
// AVANT
const totalNonLus = commandes.filter(c => !["Validé", "Archivé"].includes(c.statut)).reduce((acc, c) => acc + nonLusDe(c), 0);
const canModifier = selected && !["Validé", "Archivé"].includes(selected.statut);

const cmdFiltrees = appliquerFiltresTri(commandesVisibles, filtres, tri);
const actives   = cmdFiltrees.filter(c => c.statut !== "Validé" && c.statut !== "Archivé");
const terminees = cmdFiltrees.filter(c => c.statut === "Validé");
const archivees = cmdFiltrees.filter(c => c.statut === "Archivé");
```

```js
// APRÈS
const totalNonLus = commandes.filter(c => !c.is_archived).reduce((acc, c) => acc + nonLusDe(c), 0);
// canModifier : pas archivée ET pas validée (messagerie fermée sur les validées)
const canModifier = selected && !selected.is_archived && selected.statut !== "Validé";

const cmdFiltrees = appliquerFiltresTri(commandesVisibles, filtres, tri);
const actives   = cmdFiltrees.filter(c => !c.is_archived);
const archivees = cmdFiltrees.filter(c => c.is_archived);
```

- [ ] **Step 2 : Supprimer la section "Validées" dans le JSX (~ligne 541)**

Trouver et supprimer l'intégralité de ce bloc :

```jsx
{/* SUPPRIMER CE BLOC */}
{terminees.length > 0 && (
  <div style={{ marginBottom: 8 }}>
    <button onClick={() => setShowTerminees(v => !v)} ...>
      {showTerminees ? "▲ Masquer les validées" : `▼ ${terminees.length}...`}
    </button>
    {showTerminees && (
      <>
        <div className="cmd-table" ...>{terminees.map(c => renderLigneCmd(c, true))}</div>
        <div className="cmd-cards" ...>{terminees.map(c => renderCarteCmd(c, true))}</div>
      </>
    )}
  </div>
)}
```

- [ ] **Step 3 : Supprimer les states liés à terminees**

Chercher et supprimer :
```js
const [showTerminees, setShowTerminees] = useState(false);
```

- [ ] **Step 4 : Mettre à jour les compteurs de stats (~ligne 496)**

```jsx
// AVANT
{ label: "en cours", val: commandes.filter(c => c.statut !== "Validé" && c.statut !== "Archivé").length, color: "#122131" },
{ label: "validées", val: commandes.filter(c => c.statut === "Validé").length, color: "#059669" },
```

```jsx
// APRÈS — un seul compteur basé sur is_archived
{ label: "en cours", val: commandes.filter(c => !c.is_archived).length, color: "#122131" },
```

- [ ] **Step 5 : Commit**

```bash
git add src/components/VueUtilisateur.js
git commit -m "feat: filtres VueUtilisateur basés sur is_archived, suppression section validées"
```

---

## Task 4 : Fonctions archiver / désarchiver / supprimer dans VueUtilisateur.js

**Fichiers :**
- Modifier : `src/components/VueUtilisateur.js` (~ligne 262)

**Dépendance :** Task 1 (colonne `is_archived` en BDD).

Note sur `dupliquer` : la fonction existante insère avec `statut: "En attente"` sans passer `is_archived`. Grâce au `DEFAULT false` sur la colonne, la copie sera toujours non-archivée. Aucune modification nécessaire sur `dupliquer`.

- [ ] **Step 1 : Remplacer archiver() et ajouter desarchiver() et supprimerCommande()**

```js
// AVANT (~ligne 262)
async function archiver(id) {
  const { error } = await supabase.from("commandes").update({ statut: "Archivé" }).eq("id", id);
  if (!error) {
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: "Archivé" } : c));
    setSelected(null);
  }
}
```

```js
// APRÈS — remplacer archiver() et ajouter les deux nouvelles fonctions juste après
async function archiver(id) {
  const { error } = await supabase.from("commandes").update({ is_archived: true }).eq("id", id);
  if (!error) {
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, is_archived: true } : c));
    setSelected(null);
  }
}

async function desarchiver(id) {
  const { error } = await supabase.from("commandes").update({ is_archived: false }).eq("id", id);
  if (!error) {
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, is_archived: false } : c));
    setSelected(null);
  }
}

async function supprimerCommande(id) {
  const { error } = await supabase.from("commandes").delete().eq("id", id);
  if (!error) {
    setCommandes(prev => prev.filter(c => c.id !== id));
    setSelected(null);
  }
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/components/VueUtilisateur.js
git commit -m "feat: fonctions archiver/désarchiver/supprimerCommande"
```

---

## Task 5 : Dropdown inline + modal confirmation dans VueUtilisateur.js

**Fichiers :**
- Modifier : `src/components/VueUtilisateur.js` (~ligne 644)

**Dépendance :** Task 4 (fonctions désarchiver/supprimerCommande).

La modal de confirmation suppression est centralisée dans VueUtilisateur. Elle est déclenchée via `setShowConfirmSupprimer(id)`, que ce soit depuis le dropdown inline ou depuis le prop `onSupprimer` passé à DetailCommandeModal (Task 7).

- [ ] **Step 1 : Ajouter le state showConfirmSupprimer**

En haut du composant avec les autres states :
```js
const [showConfirmSupprimer, setShowConfirmSupprimer] = useState(null); // id de la commande à supprimer
```

- [ ] **Step 2 : Adapter le dropdown inline selon is_archived (~ligne 651)**

Remplacer les 3 boutons fixes par une condition :

```jsx
{!c.is_archived ? (
  <>
    <button onClick={() => { setMenuCmdId(null); setSelected(c); setOpenDetailInEditMode(true); }}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}
      onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      ✏️ Modifier la commande
    </button>
    <button onClick={() => { setMenuCmdId(null); dupliquer(c); }}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}
      onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      📋 Dupliquer la commande
    </button>
    <button onClick={() => { setMenuCmdId(null); archiver(c.id); }}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#DC2626", textAlign: "left" }}
      onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      🗃️ Archiver la commande
    </button>
  </>
) : (
  <>
    <button onClick={() => { setMenuCmdId(null); desarchiver(c.id); }}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}
      onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      📤 Désarchiver la commande
    </button>
    <button onClick={() => { setMenuCmdId(null); setShowConfirmSupprimer(c.id); }}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#DC2626", textAlign: "left" }}
      onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      🗑️ Supprimer la commande
    </button>
  </>
)}
```

- [ ] **Step 3 : Ajouter la modal de confirmation suppression dans le JSX**

Juste après le bloc du dropdown inline (`})()}`), ajouter :

```jsx
{/* Modal confirmation suppression */}
{showConfirmSupprimer && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
    <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#122131", marginBottom: 12 }}>Supprimer la commande ?</div>
      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24, lineHeight: 1.6 }}>
        Cette action est irréversible. La commande et toutes ses données associées (messages, versions, fichiers) seront définitivement supprimées.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setShowConfirmSupprimer(null)}
          style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Annuler
        </button>
        <button onClick={() => { supprimerCommande(showConfirmSupprimer); setShowConfirmSupprimer(null); }}
          style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Supprimer définitivement
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4 : Commit**

```bash
git add src/components/VueUtilisateur.js
git commit -m "feat: dropdown inline conditionnel is_archived + modal confirmation suppression"
```

---

## Task 6 : Adapter DropdownMenu dans DetailCommandeModal.js

**Fichiers :**
- Modifier : `src/components/DetailCommandeModal.js` (~ligne 339)

La modal de confirmation suppression est dans VueUtilisateur (Task 5). Le prop `onSupprimer` passé depuis VueUtilisateur appellera `setShowConfirmSupprimer` — pas un `DELETE` directement.

- [ ] **Step 1 : Mettre à jour la signature de DropdownMenu**

```js
// AVANT
function DropdownMenu({ onArchiver, onDupliquer, onModifier }) {
```

```js
// APRÈS
function DropdownMenu({ onArchiver, onDesarchiver, onSupprimer, onDupliquer, onModifier }) {
```

- [ ] **Step 2 : Remplacer le contenu du menu par une logique conditionnelle**

Le menu affiche soit "non-archivé" (onArchiver truthy), soit "archivé" (onDesarchiver truthy) — jamais les deux en même temps, car le parent passe l'un ou l'autre exclusivement (Task 7).

```jsx
// Remplacer tout le contenu du <div> intérieur (les boutons) par :
{onArchiver && (
  <>
    {onModifier && (
      <button onClick={() => { onModifier(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#374151", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
        ✏️ Modifier la commande
      </button>
    )}
    {onDupliquer && (
      <>
        {onModifier && <div style={{ height: 1, background: "#E5E7EB", margin: "2px 0" }} />}
        <button onClick={() => { onDupliquer(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#374151", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
          📋 Dupliquer la commande
        </button>
      </>
    )}
    <div style={{ height: 1, background: "#E5E7EB", margin: "2px 0" }} />
    <button onClick={() => { onArchiver(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#DC2626", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
      🗃️ Archiver la commande
    </button>
  </>
)}
{onDesarchiver && (
  <>
    <button onClick={() => { onDesarchiver(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#374151", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
      📤 Désarchiver la commande
    </button>
    {onSupprimer && (
      <>
        <div style={{ height: 1, background: "#E5E7EB", margin: "2px 0" }} />
        <button onClick={() => { onSupprimer(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#DC2626", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
          🗑️ Supprimer la commande
        </button>
      </>
    )}
  </>
)}
```

- [ ] **Step 3 : Mettre à jour la signature de DetailCommandeModal**

```js
// AVANT
export default function DetailCommandeModal({
  selected, versionsSelected, onClose,
  onArchiver, onDupliquer, showContacts,
  ...
```

```js
// APRÈS
export default function DetailCommandeModal({
  selected, versionsSelected, onClose,
  onArchiver, onDesarchiver, onSupprimer, onDupliquer, showContacts,
  ...
```

- [ ] **Step 4 : Mettre à jour l'appel de DropdownMenu dans le corps de DetailCommandeModal (~ligne 491)**

```jsx
// AVANT
{(onArchiver || onDupliquer || canModifier) && !editMode && (
  <DropdownMenu onArchiver={onArchiver} onDupliquer={onDupliquer} onModifier={canModifier ? enterEditMode : undefined} />
)}
```

```jsx
// APRÈS
{(onArchiver || onDesarchiver || onDupliquer || canModifier) && !editMode && (
  <DropdownMenu
    onArchiver={onArchiver}
    onDesarchiver={onDesarchiver}
    onSupprimer={onSupprimer}
    onDupliquer={onDupliquer}
    onModifier={canModifier ? enterEditMode : undefined}
  />
)}
```

- [ ] **Step 5 : Commit**

```bash
git add src/components/DetailCommandeModal.js
git commit -m "feat: DropdownMenu modal — désarchiver et supprimer"
```

---

## Task 7 : Passer les nouveaux props à DetailCommandeModal depuis VueUtilisateur

**Fichiers :**
- Modifier : `src/components/VueUtilisateur.js` (~ligne 581)

**Dépendance :** Tasks 4 et 5 (fonctions + state showConfirmSupprimer).

`onArchiver` et `onDesarchiver` sont mutuellement exclusifs : le parent passe l'un ou l'autre selon `selected.is_archived`. Cela empêche que les deux soient affichés en même temps dans le dropdown.

- [ ] **Step 1 : Mettre à jour les props passés à DetailCommandeModal**

```jsx
// AVANT (~ligne 587)
onArchiver={() => archiver(selected.id)}
onDupliquer={() => dupliquer(selected)}
```

```jsx
// APRÈS
onArchiver={!selected?.is_archived ? () => archiver(selected.id) : undefined}
onDesarchiver={selected?.is_archived ? () => desarchiver(selected.id) : undefined}
onSupprimer={selected?.is_archived ? () => setShowConfirmSupprimer(selected.id) : undefined}
onDupliquer={() => dupliquer(selected)}
```

- [ ] **Step 2 : Commit**

```bash
git add src/components/VueUtilisateur.js
git commit -m "feat: props archiver/désarchiver/supprimer conditionnels vers DetailCommandeModal"
```

---

## Task 8 : Mettre à jour VueDessinateur.js

**Fichiers :**
- Modifier : `src/components/VueDessinateur.js` (~lignes 240–245, 324)

**Note :** Dans VueDessinateur, les commandes "Validé" étaient jusqu'ici invisibles (filtrées des actives ET des archivées). Après ce changement, elles apparaîtront dans `actives`. C'est le comportement voulu.

- [ ] **Step 1 : Mettre à jour totalNonLus, actives, archivees**

```js
// AVANT (~ligne 240)
const totalNonLus = commandes.filter(c => !["Validé", "Archivé"].includes(c.statut)).reduce((acc, c) => acc + nonLusDe(c), 0);

const cmdFiltrees = appliquerFiltresTri(commandesVisibles, filtres, tri);
const actives   = cmdFiltrees.filter(c => c.statut !== "Validé" && c.statut !== "Archivé");
const terminees = cmdFiltrees.filter(c => c.statut === "Validé");
const archivees = cmdFiltrees.filter(c => c.statut === "Archivé");
```

```js
// APRÈS
const totalNonLus = commandes.filter(c => !c.is_archived).reduce((acc, c) => acc + nonLusDe(c), 0);

const cmdFiltrees = appliquerFiltresTri(commandesVisibles, filtres, tri);
const actives   = cmdFiltrees.filter(c => !c.is_archived);
const archivees = cmdFiltrees.filter(c => c.is_archived);
```

- [ ] **Step 2 : Mettre à jour le compteur de stats (~ligne 324)**

```jsx
// AVANT
{ label: "En cours", val: commandes.filter(c => c.statut !== "Validé" && c.statut !== "Archivé").length, color: "#FC6C1B", bg: "#FFF3EE" },
```

```jsx
// APRÈS
{ label: "En cours", val: commandes.filter(c => !c.is_archived).length, color: "#FC6C1B", bg: "#FFF3EE" },
```

- [ ] **Step 3 : Vérifier si une variable `terminees` est utilisée dans VueDessinateur**

Chercher `terminees` dans VueDessinateur.js. Si elle existe, la supprimer ainsi que le state `showTerminees` associé.

- [ ] **Step 4 : Commit**

```bash
git add src/components/VueDessinateur.js
git commit -m "feat: VueDessinateur filtres basés sur is_archived"
```

---

## Vérification finale

- [ ] Lancer en local : `npm start`
- [ ] Commande non-archivée → visible dans liste principale, dropdown `···` = Modifier/Dupliquer/Archiver
- [ ] Cliquer Archiver → commande passe dans "▼ X commandes archivées"
- [ ] Dans la section archivées, dropdown `···` = Désarchiver/Supprimer
- [ ] Cliquer Désarchiver → commande remonte dans la liste principale
- [ ] Cliquer Supprimer → modal de confirmation → "Supprimer définitivement" → commande disparaît
- [ ] Ouvrir une commande archivée via le modal → dropdown `···` = Désarchiver/Supprimer
- [ ] Commande avec statut "Validé" → visible dans la liste principale (plus de section séparée)
- [ ] VueDessinateur : commandes "Validé" visibles dans la liste active
- [ ] Push vers main

```bash
git push origin main
```
