# Design : Vue Client dans le Switcher Admin

**Date :** 2026-03-23
**Statut :** Approuvé

---

## Objectif

Ajouter un mode de prévisualisation "Client" dans la barre de switcher admin, en complément des modes Admin et Dessinateur existants. L'admin peut ainsi vérifier le rendu des 3 interfaces sans changer de compte.

Le switcher est un **outil de preview uniquement** — l'admin garde toujours ses droits réels en dessous.

---

## Section 1 : State & données

### Nouveau state dans App()

```js
const [modeVue, setModeVue] = useState("admin"); // "admin" | "dessinateur" | "client"
const [profilesDessinateurs, setProfilesDessinateurs] = useState([]);
const [profilesClients, setProfilesClients] = useState([]);
const [dessinateurSelectionne, setDessinateurSelectionne] = useState(null);
const [clientSelectionne, setClientSelectionne] = useState(null);
const [showDropdownDessinateur, setShowDropdownDessinateur] = useState(false);
const [showDropdownClient, setShowDropdownClient] = useState(false);
```

### Chargement depuis Supabase

Déclenché dans `chargerProfil` quand `role === "admin"` :

```js
const { data } = await supabase
  .from("profiles")
  .select("id, prenom, nom, role")
  .in("role", ["dessinateur", "client"])
  .eq("statut", "actif"); // "actif" confirmé dans GestionUtilisateurs.js

const dessinateurs = (data || []).filter(p => p.role === "dessinateur")
  .map(p => ({ ...p, nom_complet: `${p.prenom} ${p.nom}` }));
const clients = (data || []).filter(p => p.role === "client")
  .map(p => ({ ...p, nom_complet: `${p.prenom} ${p.nom}` }));

setProfilesDessinateurs(dessinateurs);
setProfilesClients(clients);
setDessinateurSelectionne(dessinateurs[0] ?? null);
setClientSelectionne(clients[0] ?? null);
```

### Filtrage des commandes

- Mode dessinateur : `c.dessinateur === dessinateurSelectionne?.nom_complet`
- Mode client : `c.client === clientSelectionne?.nom_complet`

Quand la valeur est `null` (aucun profil dispo), le filtre ne retourne aucune commande.

### Impact sur le rendu dessinateur existant

Le bloc `if (modeVue === "dessinateur")` dans App.js passe actuellement `nomDessinateur={settings.nomEntreprise}` à `VueDessinateur`. Ce doit être remplacé par `nomDessinateur={dessinateurSelectionne?.nom_complet ?? ""}` pour que le dropdown ait un effet réel.

---

## Section 2 : SwitcherBarre

### Extraction en composant stable

`SwitcherBarre` est actuellement une fonction interne redéfinie à chaque render de `App`, ce qui causerait l'unmount/remount des dropdowns à chaque re-render du parent. Elle doit être **extraite hors de `App()`** et recevoir ses dépendances via props.

```js
function SwitcherBarre({
  modeVue, setModeVue,
  profilesDessinateurs, dessinateurSelectionne, setDessinateurSelectionne,
  showDropdownDessinateur, setShowDropdownDessinateur,
  profilesClients, clientSelectionne, setClientSelectionne,
  showDropdownClient, setShowDropdownClient,
}) { ... }
```

### Layout

```
[👤 Admin]  [✏️ Dessinateur  dessinateur1 ▾]  [👥 Client  user1 ▾]
```

- 3 boutons toujours visibles (uniquement pour `profil.role === "admin"`)
- Bouton actif mis en surbrillance
- Quand Dessinateur ou Client est actif : dropdown inline pour changer de profil
- Si aucun profil disponible : bouton grisé, label "Aucun compte"

### Couleurs

| Mode | Couleur active |
|---|---|
| Admin | `#386CA3` (bleu) |
| Dessinateur | `#FC6C1B` (orange) |
| Client | `#059669` (vert) |

### Comportement des dropdowns

- Chaque dropdown a son propre state : `showDropdownDessinateur` / `showDropdownClient`
- Ouverture : clic sur le bouton Dessinateur/Client (quand déjà dans ce mode)
- Fermeture : via le handler `onClick` existant sur le wrapper principal de App (`onClick={() => { setShowMenuProfil(false); setShowDropdownDessinateur(false); setShowDropdownClient(false); }}`), et via `e.stopPropagation()` à l'intérieur du dropdown
- Sélection d'un profil → met à jour `dessinateurSelectionne` ou `clientSelectionne`, ferme le dropdown
- Le label affiché dans le bouton Dessinateur (actuellement `settings.nomEntreprise` à la ligne 272 de App.js) doit être remplacé par `dessinateurSelectionne?.nom_complet ?? "Aucun compte"`. Idem pour le label Client : `clientSelectionne?.nom_complet ?? "Aucun compte"`

---

## Section 3 : VueClient

### Nouveau composant

`src/components/VueClient.js` — modélisé sur `VueDessinateur.js`.

**Props :**
```js
VueClient({ commandes, versions, clientSelectionne, noLayout = false })
```

Vue **read-only** : aucune action possible (pas de messagerie en écriture, pas de changement de statut).

### Sidebar — 3 onglets (Dashboard + Commandes fusionnés)

| Onglet | Icône | Contenu |
|---|---|---|
| Commandes | 📋 | Stats + liste des commandes du client |
| Réglages | ⚙️ | `<PageReglages />` |
| Mon compte | 👤 | Placeholder preview (voir ci-dessous) |

**Note sur Mon compte :** `PageMonCompte` accède à `session.user.id` sans null guard (lignes 31, 42, 71) — passer `session={null}` provoquerait un crash runtime. Pour éviter toute modification de `PageMonCompte`, l'onglet Mon compte dans `VueClient` affiche un simple placeholder :

```jsx
<div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 32, textAlign: "center", color: "#9CA3AF" }}>
  <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
  <div style={{ fontWeight: 600, color: "#122131", marginBottom: 4 }}>{clientSelectionne?.prenom} {clientSelectionne?.nom}</div>
  <div style={{ fontSize: 12 }}>Aperçu — compte client</div>
</div>
```

### Onglet Commandes (vue fusionnée)

```
┌──────────────────────────────────────────┐
│  [En cours: N]  [Validées: N]  [Total: N] │
├──────────────────────────────────────────┤
│  Tableau des commandes filtrées           │
│  (c.client === clientSelectionne?.nom_complet) │
│  - Read-only (pas de boutons d'action)    │
│  - Clic sur une ligne → panneau détail   │
│    (messagerie et fichiers visibles,     │
│     aucune action possible)              │
└──────────────────────────────────────────┘
```

### Intégration dans App.js

```jsx
if (modeVue === "client" && profil?.role === "admin") {
  return (
    <div onClick={() => { setShowMenuProfil(false); setShowDropdownDessinateur(false); setShowDropdownClient(false); }}>
      <SwitcherBarre
        modeVue={modeVue} setModeVue={setModeVue}
        profilesDessinateurs={profilesDessinateurs}
        dessinateurSelectionne={dessinateurSelectionne}
        setDessinateurSelectionne={setDessinateurSelectionne}
        showDropdownDessinateur={showDropdownDessinateur}
        setShowDropdownDessinateur={setShowDropdownDessinateur}
        profilesClients={profilesClients}
        clientSelectionne={clientSelectionne}
        setClientSelectionne={setClientSelectionne}
        showDropdownClient={showDropdownClient}
        setShowDropdownClient={setShowDropdownClient}
      />
      <div style={{ paddingTop: 44 }}>
        <VueClient
          commandes={commandes}
          versions={versions}
          clientSelectionne={clientSelectionne}
        />
      </div>
    </div>
  );
}
```

---

## Faux comptes à créer/renommer dans Supabase

Les profils suivants doivent exister dans la table `profiles` avec `statut = "actif"` :

| prenom | nom | role |
|---|---|---|
| Dessinateur | 1 | dessinateur |
| Dessinateur | 2 | dessinateur |
| User | 1 | client |
| User | 2 | client |

Les commandes associées doivent avoir :
- `dessinateur = "Dessinateur 1"` ou `"Dessinateur 2"`
- `client = "User 1"` ou `"User 2"`

---

## Fichiers modifiés

| Fichier | Action |
|---|---|
| `src/App.js` | Ajout state dropdowns, chargement profils, `SwitcherBarre` extraite et étendue, rendu conditionnel mode client, `nomDessinateur` basculé sur `dessinateurSelectionne?.nom_complet` |
| `src/components/VueClient.js` | Nouveau composant (read-only) |
