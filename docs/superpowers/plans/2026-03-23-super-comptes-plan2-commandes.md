# Super Comptes — Plan 2 : Commandes client full + super agrégation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le placeholder client par la vraie vue commandes (BarreFiltres + panneau détail + nouvelle commande), et ajouter la colonne User/Dessinateur pour les super comptes.

**Architecture:** Charger les sous-comptes dans App.js, passer `sousComptes` à VueClient et VueDessinateur. VueClient reçoit BarreFiltres + `onNouvelleCommande` prop (le form reste dans App.js). Super mode = colonne supplémentaire + filtre dropdown quand `sousComptes.length > 0`.

**Tech Stack:** React CRA, Supabase, BarreFiltres existant, inline styles

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `src/App.js` | `sousComptes` state, chargement dans `chargerProfil`, callback `onNouvelleCommande`, intégration VueClient dans vue réelle client, `sousComptes` passé à VueDessinateur |
| `src/components/VueClient.js` | Import BarreFiltres, props `sousComptes` + `onNouvelleCommande`, filtre agrégé, colonne User super mode, active/terminées séparées |
| `src/components/VueDessinateur.js` | Prop `sousComptes`, filtre agrégé, colonne Dessinateur en super mode |

---

## Task 1 : App.js — sous-comptes + onNouvelleCommande + intégration VueClient

**Files:**
- Modify: `src/App.js` (lignes ~124, ~152-156, ~291, ~493-504)

- [ ] **Step 1 : Ajouter le state `sousComptes`**

Après la ligne `const [showTermineesAdmin, setShowTermineesAdmin] = useState(false);` (~ligne 124), ajouter :

```js
const [sousComptes, setSousComptes] = useState([]);
```

- [ ] **Step 2 : Charger les sous-comptes dans `chargerProfil`**

`chargerProfil` est aux lignes ~152-156. La modifier pour ajouter le chargement des sous-comptes après `setProfil(data)` :

```js
const chargerProfil = async (uid) => {
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
  setProfil(data);
  if (data?.role === "admin") { chargerNbAttente(); chargerProfilesPreview(); }
  // Sous-comptes pour client/dessinateur
  if (data?.role === "client" || data?.role === "dessinateur") {
    const { data: sub } = await supabase
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("master_id", uid);
    setSousComptes(sub || []);
  }
  // Dessinateur assigné pour les clients (ajouté par Plan 1 — laisser si présent)
};
```

- [ ] **Step 3 : Remplacer le placeholder client par VueClient (lignes ~497-504)**

Le bloc actuel :
```jsx
{vue === "commandes" && !isDessinateur && (
  <div>
    <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 24px 0" }}>Commandes</h1>
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
      <div style={{ fontSize: 14, color: "#94A3B8" }}>Aucune commande disponible pour le moment.</div>
    </div>
  </div>
)}
```

Remplacer par :
```jsx
{vue === "commandes" && !isDessinateur && (
  <VueClient
    noLayout
    commandes={commandes}
    versions={versions}
    clientSelectionne={{ ...profil, nom_complet: `${profil.prenom} ${profil.nom}` }}
    sousComptes={sousComptes}
    session={session}
    profil={profil}
    onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))}
    onChangerStatut={changerStatut}
    onEnvoyerMessage={envoyerMessage}
    onNouvelleCommande={() => {
      setForm({ ...formVide(), client: `${profil.prenom} ${profil.nom}` });
      setShowForm(true);
    }}
  />
)}
```

- [ ] **Step 4 : Passer `sousComptes` à VueDessinateur vue réelle (~ligne 493)**

```jsx
{vue === "commandes" && isDessinateur && (
  <VueDessinateur
    noLayout
    commandes={commandes}
    versions={versions}
    nomDessinateur={`${profil.prenom} ${profil.nom}`}
    sousComptes={sousComptes}
    onChangerStatut={changerStatut}
    onEnvoyerMessage={envoyerMessage}
    onDeposerVersion={deposerVersion}
  />
)}
```

Note : `nomDessinateur` était `settings.nomEntreprise` (bug corrigé par Plan 1 Task 2). Si Plan 1 n'est pas encore appliqué, appliquer le fix ici aussi.

- [ ] **Step 5 : Commit**

```bash
git add src/App.js
git commit -m "feat: load sousComptes, integrate VueClient in real client view"
```

---

## Task 2 : VueClient — BarreFiltres + sousComptes + super mode + Nouvelle commande

**Files:**
- Modify: `src/components/VueClient.js`

- [ ] **Step 1 : Ajouter les imports manquants**

En haut du fichier, après les imports existants, ajouter :

```js
import BarreFiltres, { appliquerFiltresTri } from "./BarreFiltres";
import { formatDateCourt, tempsRestant } from "../helpers";
```

Note : `formatDateCourt` est déjà importé — vérifier et ne pas dupliquer. `tempsRestant` est à ajouter si absent.

- [ ] **Step 2 : Mettre à jour la signature du composant**

```js
export default function VueClient({
  commandes = [], versions = [], clientSelectionne, noLayout = false,
  sousComptes = [],
  session, profil, onProfilUpdate,
  onChangerStatut, onEnvoyerMessage,
  onNouvelleCommande,
}) {
```

- [ ] **Step 3 : Ajouter les states filtres/tri + userFilter + showTerminees**

Après `const [validant, setValidant] = useState(false);`, ajouter :

```js
const [filtres, setFiltres]           = useState({ statut: "", type: "", periode: "", client: "", dessinateur: "" });
const [tri, setTri]                   = useState({ col: "created_at", dir: "desc" });
const [userFilter, setUserFilter]     = useState(null); // null = tous, string = nom d'un sous-compte
const [showTerminees, setShowTerminees] = useState(false);
```

- [ ] **Step 4 : Mettre à jour le calcul des commandes filtrées**

Remplacer la ligne :
```js
const mesCommandes     = commandes.filter(c => c.client === clientSelectionne?.nom_complet);
```

Par :
```js
const nomsVisibles = [
  clientSelectionne?.nom_complet,
  ...sousComptes.map(p => `${p.prenom} ${p.nom}`),
].filter(Boolean);

const mesCommandes = commandes.filter(c => nomsVisibles.includes(c.client));
const commandesFiltrees = appliquerFiltresTri(
  userFilter ? mesCommandes.filter(c => c.client === userFilter) : mesCommandes,
  filtres,
  tri
);
const actives   = commandesFiltrees.filter(c => c.statut !== "Validé");
const terminees = commandesFiltrees.filter(c => c.statut === "Validé");
```

Supprimer les lignes existantes `const actives = ...` et `const terminees = ...` (maintenant recalculées).

- [ ] **Step 5 : Modifier le rendu `vue === "commandes"`**

Dans le JSX du bloc `{vue === "commandes" && (`, remplacer le contenu par :

```jsx
{vue === "commandes" && (
  <>
    {/* En-tête avec bouton Nouvelle commande */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Commandes</h1>
      {onNouvelleCommande && (
        <button onClick={onNouvelleCommande}
          style={{ background: "#059669", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouvelle commande
        </button>
      )}
    </div>

    {/* Stats */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
      {[
        { label: "En cours",  val: mesCommandes.filter(c => c.statut !== "Validé").length, color: "#122131", bg: "#fff" },
        { label: "Validées",  val: mesCommandes.filter(c => c.statut === "Validé").length, color: "#059669", bg: "#F0FDF4" },
        { label: "Total",     val: mesCommandes.length, color: "#374151", bg: "#F8FAFC" },
      ].map(s => (
        <div key={s.label} style={{ background: s.bg, border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 5 }}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* Filtre sous-compte (super mode) */}
    {sousComptes.length > 0 && (
      <div style={{ marginBottom: 12 }}>
        <select value={userFilter ?? ""} onChange={e => setUserFilter(e.target.value || null)}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer" }}>
          <option value="">Tous les utilisateurs</option>
          <option value={clientSelectionne?.nom_complet}>{clientSelectionne?.nom_complet} (moi)</option>
          {sousComptes.map(p => (
            <option key={p.id} value={`${p.prenom} ${p.nom}`}>{p.prenom} {p.nom}</option>
          ))}
        </select>
      </div>
    )}

    {/* BarreFiltres */}
    <BarreFiltres
      commandes={mesCommandes}
      filtres={filtres} setFiltres={setFiltres}
      tri={tri} setTri={setTri}
      dessinateurs={[]} showDessinateur={false}
      couleurAccent="#059669"
    />

    {/* Tableau actives */}
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      {/* En-tête — colonne User ajoutée si super */}
      <div style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {sousComptes.length > 0 && <span>User</span>}
        <span>Bâtiment</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
      </div>
      {actives.length === 0 && (
        <div style={{ padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande active.</div>
      )}
      {actives.map(c => (
        <div key={c.id} onClick={() => setSelected(c)}
          style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EEF3F8" : "transparent", transition: "background 0.1s" }}>
          {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{c.client}</div>}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.batiment || "—"}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
          <Badge statut={c.statut} />
        </div>
      ))}
    </div>

    {/* Terminées repliables */}
    {terminees.length > 0 && (
      <div style={{ marginBottom: selected ? 24 : 0 }}>
        <button onClick={() => setShowTerminees(v => !v)}
          style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
          {showTerminees ? "▲ Masquer les commandes validées" : `▼ Voir les ${terminees.length} commande${terminees.length > 1 ? "s" : ""} validée${terminees.length > 1 ? "s" : ""}`}
        </button>
        {showTerminees && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", opacity: 0.8 }}>
            <div style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {sousComptes.length > 0 && <span>User</span>}
              <span>Bâtiment</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
            </div>
            {terminees.map(c => (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EEF3F8" : "transparent" }}>
                {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{c.client}</div>}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.batiment || "—"}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                <Badge statut={c.statut} />
              </div>
            ))}
          </div>
        )}
      </div>
    )}

  </>
)}
```

**Scope exact du remplacement :** Remplacer uniquement le contenu entre `{vue === "commandes" && (` et la fin du bloc terminées (juste avant `{selected && (`). Le bloc `{selected && (...)}` existant (panneau détail avec BlocAdresse, plans, messagerie, boutons modification/validation) **reste intact après le snippet ci-dessus** — ne pas le toucher. La `</>` de fermeture ci-dessus n'est là que pour montrer la fin du nouveau contenu ; le `)}` final ferme le conditionnel `vue === "commandes"`.

- [ ] **Step 6 : Vérifier (npm start)**

```bash
npm start
```
- Connecter `user1@test.com` → vue Commandes : vérifier stats, BarreFiltres visible, bouton "+ Nouvelle commande" visible
- Vérifier que le panneau détail s'ouvre en cliquant une commande
- Un user sans sous-comptes ne voit pas la colonne User

- [ ] **Step 7 : Commit**

```bash
git add src/components/VueClient.js
git commit -m "feat: VueClient — BarreFiltres, sousComptes super mode, Nouvelle commande button"
```

---

## Task 3 : VueDessinateur — sousComptes + super mode

**Files:**
- Modify: `src/components/VueDessinateur.js`

- [ ] **Step 1 : Lire VueDessinateur.js lignes 1-120 pour confirmer la structure du tableau des missions**

- [ ] **Step 2 : Ajouter la prop `sousComptes` et mettre à jour le filtre commandes**

Dans la signature du composant (ligne 12) :
```js
export default function VueDessinateur({ commandes, versions, nomDessinateur, onChangerStatut, onEnvoyerMessage, onDeposerVersion, noLayout = false, sousComptes = [] }) {
```

Remplacer les lignes :
```js
const toutes       = commandes.filter(c => c.dessinateur === nomDessinateur);
const mesMissions  = toutes.filter(c => c.statut !== "Validé");
const mesTerminees = toutes.filter(c => c.statut === "Validé");
const missionsFiltrees = appliquerFiltresTri(mesMissions, { ...filtres, dessinateur: "" }, tri);
```

Par :
```js
const nomsVisibles = [
  nomDessinateur,
  ...sousComptes.map(p => `${p.prenom} ${p.nom}`),
].filter(Boolean);

const toutes        = commandes.filter(c => nomsVisibles.includes(c.dessinateur));
const mesMissions   = toutes.filter(c => c.statut !== "Validé");
const mesTerminees  = toutes.filter(c => c.statut === "Validé");
const missionsFiltrees = appliquerFiltresTri(mesMissions, { ...filtres, dessinateur: "" }, tri);
```

- [ ] **Step 3 : Ajouter la colonne Dessinateur dans le tableau (super mode)**

Dans le rendu du tableau des missions (lignes ~92-94), l'en-tête actuelle est :
```jsx
<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr", ... }}>
  <span>Bâtiment</span><span>Client</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Temps restant</span><span>Statut</span>
</div>
```

Remplacer par :
```jsx
<div style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr" : "2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
  {sousComptes.length > 0 && <span>Dessinateur</span>}
  <span>Bâtiment</span><span>Client</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Temps restant</span><span>Statut</span>
</div>
```

Et dans chaque ligne (lignes ~100+), mettre à jour la `gridTemplateColumns` de la même façon et ajouter la cellule :
```jsx
<div key={c.id} onClick={...}
  style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr" : "2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr", ... }}>
  {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{c.dessinateur}</div>}
  {/* reste des cellules inchangé — Bâtiment, Client, Créé le, Plans, Délai, Temps restant, Statut */}
</div>
```

- [ ] **Step 4 : Vérifier (npm start)**

```bash
npm start
```
- Admin → mode Dessinateur 1 : vérifier que les missions s'affichent correctement
- Pas de colonne Dessinateur si pas de sous-comptes

- [ ] **Step 5 : Commit**

```bash
git add src/components/VueDessinateur.js
git commit -m "feat: VueDessinateur — sousComptes prop, super dessinateur aggregated view"
```

---

## Task 4 : Push

- [ ] **Push vers main**

```bash
git push
```
