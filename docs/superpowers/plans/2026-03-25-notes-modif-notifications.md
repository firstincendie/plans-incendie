# Notes, Modification commande, Badges non lus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des notes privées par utilisateur sur les commandes, permettre à l'utilisateur de modifier sa commande (avec message chat auto), et afficher des badges de messages non lus sur les lignes et le menu.

**Architecture:** Nouvelle table Supabase `commande_notes` (PK composite + RLS strict) pour les notes. Mode édition inline dans `DetailCommandeModal` avec diff builder + message système. Badges calculés depuis le state `messages` déjà chargé — aucune requête supplémentaire.

**Tech Stack:** React, Supabase (PostgREST, RLS), Supabase MCP pour les migrations

---

## File Map

| Fichier | Rôle dans ce plan |
|---|---|
| `src/components/DetailCommandeModal.js` | + composant `NotesSection`, + mode édition inline (`EditContent`), + nouvelles props |
| `src/components/VueUtilisateur.js` | + state note, + chargement/sauvegarde note, + `modifierCommande()`, + badges lignes + nav |
| `src/components/VueDessinateur.js` | + state note, + chargement/sauvegarde note, + badges lignes + nav |
| Supabase DB | + table `commande_notes` + RLS (via MCP) |

---

## Task 1 : Migration DB — table commande_notes

**Files:**
- Modify: Supabase DB (via MCP `apply_migration`)

- [ ] **Step 1 : Appliquer la migration**

Via le MCP Supabase, appliquer la migration suivante (nom suggéré : `create_commande_notes`) :

```sql
CREATE TABLE commande_notes (
  commande_id UUID NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note        TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (commande_id, user_id)
);

ALTER TABLE commande_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utilisateur gere ses propres notes"
  ON commande_notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2 : Vérifier la table**

Via MCP `execute_sql` :
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'commande_notes'
ORDER BY ordinal_position;
```
Résultat attendu : 4 lignes (commande_id uuid, user_id uuid, note text, updated_at timestamptz). Si 0 lignes, attendre 5 secondes et réessayer.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "feat: table commande_notes avec RLS"
```

---

## Task 2 : Notes privées — DetailCommandeModal + VueUtilisateur + VueDessinateur

**Files:**
- Modify: `src/components/DetailCommandeModal.js`
- Modify: `src/components/VueUtilisateur.js`
- Modify: `src/components/VueDessinateur.js`

### Contexte codebase

- `DetailCommandeModal.js` exporte un composant default. Il reçoit des props dont `auteurNom`, `onMarquerLu`, `selected`, etc.
- `InfosContent` est un sous-composant interne (ligne ~50). Il reçoit `selected`, `versionsSelected`, `showContacts`.
- La section "Mes notes" sera rendue **en dehors** de `InfosContent`, directement dans les zones `detail-desktop-left` et `detail-tab-pane` (desktop et mobile).
- Dans VueUtilisateur, le `DetailCommandeModal` est à la ligne ~502. Dans VueDessinateur, ligne ~416.

### Étapes

- [ ] **Step 1 : Ajouter `NotesSection` dans DetailCommandeModal.js**

Dans `DetailCommandeModal.js`, après la fonction `InfosContent` (ligne ~184) et avant `DropdownMenu` (ligne ~186), insérer :

```jsx
function NotesSection({ note, setNote, onSaveNote, noteSaveError }) {
  return (
    <div style={{ marginTop: 24 }}>
      <SectionTitle>Mes notes</SectionTitle>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={onSaveNote}
        placeholder="Ajouter une note personnelle..."
        style={{
          width: "100%", minHeight: 80, padding: "8px 12px",
          borderRadius: 8, border: "1px solid #E5E7EB",
          fontSize: 16, fontFamily: "inherit", resize: "vertical",
          boxSizing: "border-box", outline: "none", lineHeight: 1.5,
        }}
      />
      {noteSaveError && (
        <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>
          Erreur lors de la sauvegarde
        </div>
      )}
    </div>
  );
}
```

Note : `fontSize: 16` est obligatoire pour éviter le zoom automatique sur iOS.

- [ ] **Step 2 : Ajouter les nouvelles props dans la signature du composant principal**

Ligne ~226, la signature actuelle est :
```jsx
export default function DetailCommandeModal({
  selected, versionsSelected, onClose,
  onArchiver, onDupliquer, showContacts,
  actionButtons,
  msgInput, setMsgInput, onEnvoyer, auteurNom,
  onMarquerLu,
})
```

Remplacer par :
```jsx
export default function DetailCommandeModal({
  selected, versionsSelected, onClose,
  onArchiver, onDupliquer, showContacts,
  actionButtons,
  msgInput, setMsgInput, onEnvoyer, auteurNom,
  onMarquerLu,
  note, setNote, onSaveNote, noteSaveError,
  onModifierCommande, canModifier,
})
```

- [ ] **Step 3 : Insérer `NotesSection` dans le layout desktop et mobile**

Dans le layout desktop (ligne ~292), la zone `detail-desktop-left` est actuellement :
```jsx
<div className="detail-desktop-left">
  <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
  {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
</div>
```

Remplacer par :
```jsx
<div className="detail-desktop-left">
  <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
  <NotesSection note={note ?? ""} setNote={setNote} onSaveNote={onSaveNote} noteSaveError={noteSaveError} />
  {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
</div>
```

Dans le layout mobile (ligne ~303), le pane "infos" est :
```jsx
<div className={`detail-tab-pane${mobTab === "infos" ? " active" : ""}`}>
  <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
  {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
</div>
```

Remplacer par :
```jsx
<div className={`detail-tab-pane${mobTab === "infos" ? " active" : ""}`}>
  <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
  <NotesSection note={note ?? ""} setNote={setNote} onSaveNote={onSaveNote} noteSaveError={noteSaveError} />
  {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
</div>
```

- [ ] **Step 4 : Ajouter state + chargement + sauvegarde dans VueUtilisateur.js**

Dans la zone des déclarations de state (ligne ~14–39), ajouter :
```js
const [note, setNote] = useState("");
const [noteSaveError, setNoteSaveError] = useState(false);
```

Après la fonction `marquerMessagesLus` (ligne ~278), ajouter :
```js
useEffect(() => {
  if (!selected) { setNote(""); setNoteSaveError(false); return; }
  supabase.from("commande_notes")
    .select("note")
    .eq("commande_id", selected.id)
    .eq("user_id", session.user.id)
    .maybeSingle()
    .then(({ data }) => setNote(data?.note ?? ""));
}, [selected?.id]); // eslint-disable-line

async function sauvegarderNote() {
  if (!selected) return;
  const { error } = await supabase.from("commande_notes").upsert({
    commande_id: selected.id,
    user_id: session.user.id,
    note,
    updated_at: new Date().toISOString(),
  });
  setNoteSaveError(!!error);
}
```

- [ ] **Step 5 : Passer les nouvelles props au DetailCommandeModal dans VueUtilisateur.js**

Dans l'appel `<DetailCommandeModal` (ligne ~503), après `onMarquerLu={...}`, ajouter :
```jsx
note={note}
setNote={setNote}
onSaveNote={sauvegarderNote}
noteSaveError={noteSaveError}
```

- [ ] **Step 6 : Même chose dans VueDessinateur.js (state + useEffect + save + props)**

Note préalable : `supabase` est déjà importé dans les deux fichiers (ligne 2 dans VueUtilisateur et VueDessinateur).

Dans `src/components/VueDessinateur.js` :

**1. States** — ajouter dans la zone de déclarations de state (lignes ~13–31, repérer `const [loading, setLoading] = useState(true)` pour se situer), après le dernier `useState` du bloc :
```js
const [note, setNote] = useState("");
const [noteSaveError, setNoteSaveError] = useState(false);
```

**2. Chargement + sauvegarde** — ajouter après la fonction `marquerMessagesLus` (chercher `async function marquerMessagesLus` dans le fichier, insérer juste après la fermeture `}` de cette fonction) :
```js
useEffect(() => {
  if (!selected) { setNote(""); setNoteSaveError(false); return; }
  supabase.from("commande_notes")
    .select("note")
    .eq("commande_id", selected.id)
    .eq("user_id", session.user.id)
    .maybeSingle()
    .then(({ data }) => setNote(data?.note ?? ""));
}, [selected?.id]); // eslint-disable-line

async function sauvegarderNote() {
  if (!selected) return;
  const { error } = await supabase.from("commande_notes").upsert({
    commande_id: selected.id,
    user_id: session.user.id,
    note,
    updated_at: new Date().toISOString(),
  });
  setNoteSaveError(!!error);
}
```

**3. Props au modal** — dans l'appel `<DetailCommandeModal` (chercher `onMarquerLu={() => marquerMessagesLus(selected?.id)}` dans VueDessinateur), ajouter après cette prop :
```jsx
note={note}
setNote={setNote}
onSaveNote={sauvegarderNote}
noteSaveError={noteSaveError}
```

**Important :** Ne PAS ajouter `onModifierCommande` ni `canModifier` dans VueDessinateur — ces props doivent rester absentes pour que le bouton "Modifier" n'apparaisse pas côté dessinateur.

- [ ] **Step 7 : Vérifier visuellement**

1. Ouvrir l'app, se connecter en tant qu'utilisateur
2. Cliquer sur une commande → vérifier que la section "Mes notes" apparaît sous les infos
3. Taper une note, cliquer ailleurs (blur) → vérifier pas d'erreur rouge
4. Fermer et rouvrir la commande → vérifier que la note est rechargée
5. Mobile : vérifier que la textarea n'est pas zoomée à la mise au focus

- [ ] **Step 8 : Commit**

```bash
git add src/components/DetailCommandeModal.js src/components/VueUtilisateur.js src/components/VueDessinateur.js
git commit -m "feat: notes privées par utilisateur sur les commandes"
```

---

## Task 3 : Badges messages non lus — VueUtilisateur + VueDessinateur

**Files:**
- Modify: `src/components/VueUtilisateur.js`
- Modify: `src/components/VueDessinateur.js`

Cette tâche est indépendante de Task 2 et 4.

### Contexte codebase

- Chaque commande a `c.messages` (array chargé en mémoire).
- Un message non lu = `m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)`.
- Le style existant des bulles (dans DetailCommandeModal) : `{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: 4 }`.
- Dans VueUtilisateur, les nav items sont rendus via `nav.map(item => ...)` (ligne ~301). Dans VueDessinateur, même pattern (~ligne 230).
- Dans VueUtilisateur, `auteurNom` est `const auteurNom = ...` (ligne ~51). Idem VueDessinateur (~ligne 33).

### Helper de calcul non lus

Dans les deux fichiers, le helper sera inline (pas besoin d'extractor, utilisé 2 fois max par fichier) :
```js
const nonLusDe = c => c.messages.filter(
  m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
).length;
```

### Étapes — VueUtilisateur.js

- [ ] **Step 1 : Ajouter le calcul `totalNonLus` avant le return**

Dans la zone des variables calculées (ligne ~280–288), après `const versionsSelected = ...`, ajouter :
```js
const totalNonLus = commandes.reduce((acc, c) =>
  acc + c.messages.filter(m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)).length, 0
);
```

- [ ] **Step 2 : Ajouter le badge sur l'item nav "Commandes"**

Le rendu des nav items (ligne ~301) est actuellement :
```jsx
{nav.map(item => (
  <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); }}
    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#E8EDF2" : "transparent", color: vue === item.id ? "#122131" : "#6B7280", textAlign: "left", width: "100%" }}>
    <span>{item.icon}</span><span>{item.label}</span>
  </button>
))}
```

Remplacer par :
```jsx
{nav.map(item => (
  <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); }}
    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#E8EDF2" : "transparent", color: vue === item.id ? "#122131" : "#6B7280", textAlign: "left", width: "100%" }}>
    <span>{item.icon}</span><span style={{ flex: 1 }}>{item.label}</span>
    {item.id === "commandes" && totalNonLus > 0 && (
      <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
        {totalNonLus}
      </span>
    )}
  </button>
))}
```

- [ ] **Step 3 : Extraire `nonLusDe` comme helper et ajouter les badges sur les lignes**

Dans VueUtilisateur.js, dans la zone des variables calculées (là où `totalNonLus` a été ajouté au step 1), ajouter juste avant `totalNonLus` :
```js
const nonLusDe = c => c.messages.filter(
  m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
).length;
const totalNonLus = commandes.reduce((acc, c) => acc + nonLusDe(c), 0);
```

Remplacer `totalNonLus` du step 1 par cette version consolidée.

Dans la liste des commandes actives (chercher `{c.nom_plan || "—"}` dans la section actives), la cellule "Plan" est :
```jsx
<div>
  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</div>
  <div style={{ fontSize: 11, color: "#9CA3AF" }}>
    {(() => {
      const nomClient = `${c.client_prenom ?? ""} ${c.client_nom ?? ""}`.trim();
      return nomClient ? `${nomClient} — ${c.ref}` : c.ref;
    })()}
  </div>
</div>
```

Remplacer par :
```jsx
<div>
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</span>
    {nonLusDe(c) > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{nonLusDe(c)}</span>}
  </div>
  <div style={{ fontSize: 11, color: "#9CA3AF" }}>
    {(() => {
      const nomClient = `${c.client_prenom ?? ""} ${c.client_nom ?? ""}`.trim();
      return nomClient ? `${nomClient} — ${c.ref}` : c.ref;
    })()}
  </div>
</div>
```

Appliquer le **même remplacement** dans les listes `terminees` et `archivees` (chercher les deux autres occurrences de `{c.nom_plan || "—"}` dans le fichier).

### Étapes — VueDessinateur.js

- [ ] **Step 4 : Même badges dans VueDessinateur.js**

Dans `src/components/VueDessinateur.js`, repérer la zone de variables calculées avant le `return` (chercher `const cmdFiltrees` ou `const actives`). Ajouter juste avant ces lignes :
```js
const nonLusDe = c => c.messages.filter(
  m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
).length;
const totalNonLus = commandes.reduce((acc, c) => acc + nonLusDe(c), 0);
```

**Badge nav** : Chercher `nav.map(item =>` dans VueDessinateur. L'item "Mes missions" a `id: "commandes"`. Appliquer le même remplacement que step 2 (badge `totalNonLus` quand `item.id === "commandes"`, avec `<span style={{ flex: 1 }}>{item.label}</span>` et badge après).

**Badge lignes** : Chercher les occurrences de `{c.nom_plan || "—"}` dans VueDessinateur (dans les listes actives/terminees/archivees). Appliquer le même remplacement que step 3 (using `nonLusDe(c)`).

- [ ] **Step 5 : Vérifier visuellement**

1. Ouvrir l'app en tant qu'utilisateur
2. Demander au dessinateur d'envoyer un message sur une commande
3. Vérifier que le badge orange apparaît sur la ligne de la commande et sur "Commandes" dans le menu
4. Ouvrir la commande → vérifier que le badge disparaît après marquerMessagesLus
5. Même test en tant que dessinateur (messages envoyés par l'utilisateur)

- [ ] **Step 6 : Commit**

```bash
git add src/components/VueUtilisateur.js src/components/VueDessinateur.js
git commit -m "feat: badges messages non lus sur lignes et menu"
```

---

## Task 4 : Mode édition commande — DetailCommandeModal + VueUtilisateur

**Files:**
- Modify: `src/components/DetailCommandeModal.js`
- Modify: `src/components/VueUtilisateur.js`

### Contexte codebase

- `TableauPlans` (déjà importé dans VueUtilisateur) a l'interface `{ plans, onChange }`. Il faut l'importer dans DetailCommandeModal.
- Le `selected.delai` est une date ISO (ex: `"2025-03-15T00:00:00"`). Pour `<input type="date">`, utiliser `selected.delai?.substring(0, 10)`.
- `formatDateCourt` est déjà importé dans DetailCommandeModal depuis `../helpers`.
- Dans VueUtilisateur, `profil.role === "utilisateur"` identifie l'utilisateur (pas le dessinateur, ni l'owner admin).
- L'owner (admin) a `is_owner = true` et `role = "utilisateur"`. Il peut aussi modifier les commandes.

### Sous-composant `buildChangesText`

Cette fonction utilitaire sera définie **dans DetailCommandeModal.js** (avant le composant principal) :

```js
function buildChangesText(original, editForm) {
  const lines = [];

  if ((editForm.nom_plan || "") !== (original.nom_plan || ""))
    lines.push(`- Nom du plan : "${original.nom_plan || ""}" → "${editForm.nom_plan || ""}"`);

  const delaiBefore = original.delai ? original.delai.substring(0, 10) : "";
  if (editForm.delai !== delaiBefore) {
    const fmtOld = original.delai ? formatDateCourt(original.delai) : "—";
    const fmtNew = editForm.delai ? formatDateCourt(editForm.delai + "T12:00:00") : "—";
    lines.push(`- Délai : ${fmtOld} → ${fmtNew}`);
  }

  const contactFields = ["client_nom", "client_prenom", "client_email", "client_telephone"];
  if (contactFields.some(f => (editForm[f] || "") !== (original[f] || "")))
    lines.push("- Contacts mis à jour");

  const adresseFields = ["adresse1", "adresse2", "code_postal", "ville"];
  if (adresseFields.some(f => (editForm[f] || "") !== (original[f] || "")))
    lines.push("- Adresse mise à jour");

  if ((editForm.instructions || "") !== (original.instructions || ""))
    lines.push("- Instructions mises à jour");

  if (JSON.stringify(editForm.plans) !== JSON.stringify(original.plans || []))
    lines.push("- Plans à réaliser mis à jour");

  return lines.length > 0 ? `✏️ Commande modifiée :\n${lines.join("\n")}` : null;
}
```

Note : `editForm.delai + "T12:00:00"` pour éviter le décalage de timezone lors de `formatDateCourt`.

### Sous-composant `EditContent`

À ajouter dans `DetailCommandeModal.js` après `buildChangesText` :

```jsx
function EditContent({ editForm, setEditForm }) {
  const inputStyle = {
    width: "100%", padding: "7px 10px", borderRadius: 7,
    border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box",
    fontFamily: "inherit",
  };
  const labelStyle = {
    fontSize: 11, color: "#6B7280", fontWeight: 600,
    textTransform: "uppercase", display: "block", marginBottom: 3,
  };
  function set(key, val) { setEditForm(f => ({ ...f, [key]: val })); }

  return (
    <div>
      {/* Nom du plan */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Nom du plan</SectionTitle>
        <input style={inputStyle} value={editForm.nom_plan || ""} onChange={e => set("nom_plan", e.target.value)} />
      </div>

      {/* Délai */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Délai</SectionTitle>
        <input type="date" style={inputStyle} value={editForm.delai || ""} onChange={e => set("delai", e.target.value)} />
      </div>

      {/* Contacts */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Contacts</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={labelStyle}>Prénom</label><input style={inputStyle} value={editForm.client_prenom || ""} onChange={e => set("client_prenom", e.target.value)} /></div>
          <div><label style={labelStyle}>Nom</label><input style={inputStyle} value={editForm.client_nom || ""} onChange={e => set("client_nom", e.target.value)} /></div>
          <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={editForm.client_email || ""} onChange={e => set("client_email", e.target.value)} /></div>
          <div><label style={labelStyle}>Téléphone</label><input style={inputStyle} value={editForm.client_telephone || ""} onChange={e => set("client_telephone", e.target.value)} /></div>
        </div>
      </div>

      {/* Adresse */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Adresse</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input style={inputStyle} placeholder="Adresse ligne 1" value={editForm.adresse1 || ""} onChange={e => set("adresse1", e.target.value)} />
          <input style={inputStyle} placeholder="Adresse ligne 2" value={editForm.adresse2 || ""} onChange={e => set("adresse2", e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 6 }}>
            <input style={inputStyle} placeholder="Code postal" value={editForm.code_postal || ""} onChange={e => set("code_postal", e.target.value)} />
            <input style={inputStyle} placeholder="Ville" value={editForm.ville || ""} onChange={e => set("ville", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Plans à réaliser */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Plans à réaliser</SectionTitle>
        <TableauPlans plans={editForm.plans || []} onChange={plans => set("plans", plans)} />
      </div>

      {/* Instructions */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Instructions</SectionTitle>
        <textarea
          style={{ ...inputStyle, minHeight: 72, resize: "vertical", fontSize: 13 }}
          value={editForm.instructions || ""}
          onChange={e => set("instructions", e.target.value)}
        />
      </div>
    </div>
  );
}
```

### Étapes

- [ ] **Step 1 : Importer TableauPlans dans DetailCommandeModal.js**

En haut du fichier, après les imports existants (ligne ~5) :
```js
import TableauPlans from "./TableauPlans";
```

- [ ] **Step 2 : Ajouter `buildChangesText` et `EditContent` dans DetailCommandeModal.js**

Insérer les deux fonctions (voir ci-dessus) juste avant la fonction `DropdownMenu` (ligne ~186).

- [ ] **Step 3 : Ajouter le state edit mode dans le composant principal**

Le composant `DetailCommandeModal` commence à la ligne ~226. Après `const [mobTab, setMobTab] = useState("infos");`, ajouter :
```js
const [editMode, setEditMode] = useState(false);
const [editForm, setEditForm] = useState({});
const [savingEdit, setSavingEdit] = useState(false);
```

- [ ] **Step 4 : Réinitialiser editMode quand la commande change**

Dans le `useEffect` existant (ligne ~235), qui est :
```js
useEffect(() => {
  onMarquerLu?.();
}, [selected?.id]); // eslint-disable-line
```

Remplacer par :
```js
useEffect(() => {
  setEditMode(false);
  onMarquerLu?.();
}, [selected?.id]); // eslint-disable-line
```

- [ ] **Step 5 : Ajouter la fonction `enterEditMode` et `saveEdit`**

Après le `useEffect`, ajouter :

```js
function enterEditMode() {
  if (!selected) return;
  setEditForm({
    nom_plan: selected.nom_plan || "",
    client_nom: selected.client_nom || "",
    client_prenom: selected.client_prenom || "",
    client_email: selected.client_email || "",
    client_telephone: selected.client_telephone || "",
    adresse1: selected.adresse1 || "",
    adresse2: selected.adresse2 || "",
    code_postal: selected.code_postal || "",
    ville: selected.ville || "",
    delai: selected.delai ? selected.delai.substring(0, 10) : "",
    plans: JSON.parse(JSON.stringify(selected.plans || [])),
    instructions: selected.instructions || "",
  });
  setEditMode(true);
}

async function saveEdit() {
  setSavingEdit(true);
  const updates = {
    nom_plan: editForm.nom_plan,
    client_nom: editForm.client_nom,
    client_prenom: editForm.client_prenom,
    client_email: editForm.client_email,
    client_telephone: editForm.client_telephone,
    adresse1: editForm.adresse1,
    adresse2: editForm.adresse2,
    code_postal: editForm.code_postal,
    ville: editForm.ville,
    delai: editForm.delai || null,
    plans: editForm.plans,
    instructions: editForm.instructions,
  };
  const changesText = buildChangesText(selected, editForm);
  await onModifierCommande(selected.id, updates, changesText);
  setEditMode(false);
  setSavingEdit(false);
}
```

- [ ] **Step 6 : Ajouter le bouton "Modifier" dans le header**

Dans le header (ligne ~268), le côté droit est actuellement :
```jsx
<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
  <Badge statut={selected.statut} />
  {(onArchiver || onDupliquer) && (
    <DropdownMenu onArchiver={onArchiver} onDupliquer={onDupliquer} />
  )}
  <button style={HEADER_BTN} onClick={onClose}>✕</button>
</div>
```

Remplacer par :
```jsx
<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
  {canModifier && !editMode && (
    <button style={HEADER_BTN} onClick={enterEditMode}>✏️ Modifier</button>
  )}
  <Badge statut={selected.statut} />
  {(onArchiver || onDupliquer) && !editMode && (
    <DropdownMenu onArchiver={onArchiver} onDupliquer={onDupliquer} />
  )}
  <button style={HEADER_BTN} onClick={onClose}>✕</button>
</div>
```

- [ ] **Step 7 : Afficher EditContent à la place de InfosContent en mode édition (desktop)**

Dans la zone `detail-desktop-left` (modifiée à Task 2), actuellement :
```jsx
<div className="detail-desktop-left">
  <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
  <NotesSection note={note ?? ""} setNote={setNote} onSaveNote={onSaveNote} noteSaveError={noteSaveError} />
  {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
</div>
```

Remplacer par :
```jsx
<div className="detail-desktop-left">
  {editMode ? (
    <>
      <EditContent editForm={editForm} setEditForm={setEditForm} />
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={saveEdit} disabled={savingEdit}
          style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 700, cursor: savingEdit ? "not-allowed" : "pointer" }}>
          {savingEdit ? "Sauvegarde..." : "Sauvegarder"}
        </button>
        <button onClick={() => setEditMode(false)}
          style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </>
  ) : (
    <>
      <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
      <NotesSection note={note ?? ""} setNote={setNote} onSaveNote={onSaveNote} noteSaveError={noteSaveError} />
      {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
    </>
  )}
</div>
```

- [ ] **Step 8 : Même chose dans le layout mobile (detail-tab-pane infos)**

Dans le layout mobile, trouver le div avec `className={`detail-tab-pane${mobTab === "infos" ? " active" : ""}`}`. Son contenu actuel (après Task 2) est :
```jsx
<InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
<NotesSection note={note ?? ""} setNote={setNote} onSaveNote={onSaveNote} noteSaveError={noteSaveError} />
{actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
```

Remplacer par exactement le même contenu conditionnel que step 7 (même code du bloc `{editMode ? ... : ...}`).

La seule différence visuelle entre desktop et mobile est le conteneur parent — le contenu conditionnel est identique.

- [ ] **Step 9 : Ajouter `modifierCommande` dans VueUtilisateur.js**

Après la fonction `marquerMessagesLus` (ligne ~278 de VueUtilisateur), ajouter :

```js
async function modifierCommande(id, updates, changesText) {
  const { error } = await supabase.from("commandes").update(updates).eq("id", id);
  if (error) return;
  setCommandes(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  setSelected(prev => ({ ...prev, ...updates }));
  if (changesText) await envoyerMessage(id, auteurNom, changesText);
}
```

- [ ] **Step 10 : Calculer `canModifier` et passer les props dans VueUtilisateur.js**

Juste avant le `return` (ligne ~290), dans la zone des variables calculées, ajouter :
```js
const canModifier = selected && !["Validé", "Archivé"].includes(selected.statut);
```

Note : `VueUtilisateur` est utilisé uniquement par les utilisateurs (pas les dessinateurs), donc pas besoin de vérifier le rôle ici. `canModifier` sera `false` côté dessinateur car on ne passera pas `onModifierCommande`.

Dans l'appel `<DetailCommandeModal` (ligne ~503), après les props de notes ajoutées à Task 2, ajouter :
```jsx
onModifierCommande={modifierCommande}
canModifier={canModifier}
```

Note : Dans VueDessinateur, on ne passe **pas** `onModifierCommande` ni `canModifier` (donc ils seront `undefined` → le bouton "Modifier" n'apparaîtra pas).

- [ ] **Step 11 : Vérifier visuellement**

1. Ouvrir une commande en tant qu'utilisateur → vérifier que "✏️ Modifier" apparaît dans le header
2. Cliquer → le formulaire d'édition apparaît avec les valeurs pré-remplies
3. Modifier le nom du plan → Sauvegarder → vérifier que le nom change dans le header et la liste
4. Vérifier qu'un message "✏️ Commande modifiée : - Nom du plan : ..." apparaît dans le chat
5. Modifier uniquement la date → message "Délai : X → Y"
6. Modifier contacts → message "Contacts mis à jour" (sans les valeurs)
7. Annuler → aucune modification
8. Ouvrir en tant que dessinateur → vérifier que le bouton "Modifier" n'apparaît pas (quelle que soit le statut de la commande)
9. En tant qu'utilisateur, sur une commande "Validée" ou "Archivée" → bouton "Modifier" absent

- [ ] **Step 12 : Commit**

```bash
git add src/components/DetailCommandeModal.js src/components/VueUtilisateur.js
git commit -m "feat: modification de commande par l'utilisateur avec message chat"
```

---

## Task 5 : Push

- [ ] **Step 1 : Push**

```bash
git push
```

Netlify déploie automatiquement sur push vers `main`.
