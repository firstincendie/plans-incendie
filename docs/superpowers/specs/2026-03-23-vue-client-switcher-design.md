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
```

### Chargement depuis Supabase

Déclenché dans `chargerProfil` quand `role === "admin"` :

```js
const { data } = await supabase
  .from("profiles")
  .select("id, prenom, nom, role")
  .in("role", ["dessinateur", "client"])
  .eq("statut", "actif");

const dessinateurs = data.filter(p => p.role === "dessinateur")
  .map(p => ({ ...p, nom_complet: `${p.prenom} ${p.nom}` }));
const clients = data.filter(p => p.role === "client")
  .map(p => ({ ...p, nom_complet: `${p.prenom} ${p.nom}` }));

setProfilesDessinateurs(dessinateurs);
setProfilesClients(clients);
setDessinateurSelectionne(dessinateurs[0] ?? null);
setClientSelectionne(clients[0] ?? null);
```

### Filtrage des commandes

- Mode dessinateur : `c.dessinateur === dessinateurSelectionne.nom_complet`
- Mode client : `c.client === clientSelectionne.nom_complet`

---

## Section 2 : SwitcherBarre

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

### Comportement du dropdown

- S'affiche sous le bouton correspondant (position absolute)
- Se ferme au clic en dehors (via le `onClick` sur le wrapper principal déjà présent dans App)
- Sélection d'un profil → met à jour `dessinateurSelectionne` ou `clientSelectionne`

---

## Section 3 : VueClient

### Nouveau composant

`src/components/VueClient.js` — modélisé sur `VueDessinateur.js`.

**Props :**
```js
VueClient({ commandes, versions, clientSelectionne, noLayout = false })
```

### Sidebar — 3 onglets (Dashboard + Commandes fusionnés)

| Onglet | Icône | Contenu |
|---|---|---|
| Commandes | 📋 | Stats + liste des commandes du client |
| Réglages | ⚙️ | `<PageReglages />` |
| Mon compte | 👤 | `<PageMonCompte profil={clientSelectionne} role="client" />` |

### Onglet Commandes (vue fusionnée)

```
┌──────────────────────────────────────────┐
│  [En cours: N]  [Validées: N]  [Total: N] │
├──────────────────────────────────────────┤
│  Tableau des commandes filtrées           │
│  (c.client === clientSelectionne.nom_complet) │
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
    <div>
      <SwitcherBarre />
      <div style={{ paddingTop: 44 }}>
        <VueClient
          commandes={commandes}
          versions={versions}
          clientSelectionne={clientSelectionne}
          onEnvoyerMessage={envoyerMessage}
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
| `src/App.js` | Ajout state, chargement profils, rendu conditionnel mode client, SwitcherBarre étendue |
| `src/components/VueClient.js` | Nouveau composant |
