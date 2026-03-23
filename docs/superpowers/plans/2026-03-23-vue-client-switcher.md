# Vue Client dans le Switcher Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un mode preview "Client" dans la barre de switcher admin, avec sélecteur de profil dynamique depuis Supabase, en plus du mode Dessinateur existant.

**Architecture:** `SwitcherBarre` est extraite hors de `App()` en composant stable recevant ses dépendances via props. Un nouveau composant `VueClient` (modélisé sur `VueDessinateur`) affiche une vue read-only filtrée sur le client sélectionné. `App.js` charge les profils dessinateurs/clients depuis Supabase au login admin.

**Tech Stack:** React (Create React App), Supabase JS client, inline styles (pas de CSS externe)

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `src/App.js` | Modifier | Nouveau state, chargement profils, SwitcherBarre extraite, rendu conditionnel client |
| `src/components/VueClient.js` | Créer | Vue read-only client : stats + liste commandes + détail |

---

## Task 1 : Ajouter le state et le chargement des profils dans App.js

**Files:**
- Modify: `src/App.js:22-83`

- [ ] **Step 1 : Ajouter les 6 nouvelles variables de state**

Localise le bloc de state dans `App()` (autour de la ligne 37, après `const [modeVue, setModeVue]`). Ajoute ces 6 lignes juste après :

```js
const [profilesDessinateurs, setProfilesDessinateurs] = useState([]);
const [profilesClients, setProfilesClients]           = useState([]);
const [dessinateurSelectionne, setDessinateurSelectionne] = useState(null);
const [clientSelectionne, setClientSelectionne]       = useState(null);
const [showDropdownDessinateur, setShowDropdownDessinateur] = useState(false);
const [showDropdownClient, setShowDropdownClient]     = useState(false);
```

- [ ] **Step 2 : Ajouter la fonction `chargerProfilesPreview`**

Ajoute cette fonction après `chargerNbAttente` (ligne ~83) :

```js
const chargerProfilesPreview = async () => {
  const { data } = await supabase
    .from("profiles")
    .select("id, prenom, nom, role")
    .in("role", ["dessinateur", "client"])
    .eq("statut", "actif");
  const dessinateurs = (data || []).filter(p => p.role === "dessinateur")
    .map(p => ({ ...p, nom_complet: `${p.prenom} ${p.nom}` }));
  const clients = (data || []).filter(p => p.role === "client")
    .map(p => ({ ...p, nom_complet: `${p.prenom} ${p.nom}` }));
  setProfilesDessinateurs(dessinateurs);
  setProfilesClients(clients);
  setDessinateurSelectionne(dessinateurs[0] ?? null);
  setClientSelectionne(clients[0] ?? null);
};
```

- [ ] **Step 3 : Appeler `chargerProfilesPreview` dans `chargerProfil`**

Dans `chargerProfil`, la ligne existante est :
```js
if (data?.role === "admin") chargerNbAttente();
```
Remplace-la par :
```js
if (data?.role === "admin") { chargerNbAttente(); chargerProfilesPreview(); }
```

- [ ] **Step 4 : Vérifier**

Lance `npm start`. Connecte-toi avec le compte admin. Dans la console du navigateur (F12), ajoute temporairement `console.log(profilesDessinateurs, profilesClients)` pour confirmer que les données sont chargées. Retire le log après vérification.

- [ ] **Step 5 : Commit**

```bash
git add src/App.js
git commit -m "feat: add profiles state and chargerProfilesPreview for switcher

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2 : Extraire et étendre SwitcherBarre

**Files:**
- Modify: `src/App.js:258-287`

- [ ] **Step 1 : Remplacer la SwitcherBarre interne par un composant module-level**

Dans `App.js`, **avant** la fonction `export default function App()`, ajoute la nouvelle `SwitcherBarre` :

```jsx
function SwitcherBarre({
  modeVue, setModeVue,
  profilesDessinateurs, dessinateurSelectionne, setDessinateurSelectionne,
  showDropdownDessinateur, setShowDropdownDessinateur,
  profilesClients, clientSelectionne, setClientSelectionne,
  showDropdownClient, setShowDropdownClient,
}) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "#1E293B", padding: "8px 20px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, letterSpacing: "0.05em", marginRight: 4 }}>VUE ADMIN</span>
      <div style={{ display: "flex", gap: 4, background: "#0F172A", borderRadius: 8, padding: 3 }}>

        {/* Admin */}
        <button onClick={() => setModeVue("admin")}
          style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: modeVue === "admin" ? "#386CA3" : "transparent", color: modeVue === "admin" ? "#fff" : "#94A3B8" }}>
          👤 Admin
        </button>

        {/* Dessinateur */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => {
              if (modeVue !== "dessinateur") { setModeVue("dessinateur"); setShowDropdownDessinateur(false); }
              else setShowDropdownDessinateur(v => !v);
            }}
            disabled={profilesDessinateurs.length === 0}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: profilesDessinateurs.length === 0 ? "not-allowed" : "pointer", background: modeVue === "dessinateur" ? "#FC6C1B" : "transparent", color: modeVue === "dessinateur" ? "#fff" : profilesDessinateurs.length === 0 ? "#4B5563" : "#94A3B8", display: "flex", alignItems: "center", gap: 6 }}>
            ✏️ {dessinateurSelectionne?.nom_complet ?? "Aucun compte"}{profilesDessinateurs.length > 1 ? " ▾" : ""}
          </button>
          {showDropdownDessinateur && profilesDessinateurs.length > 0 && (
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#1E293B", border: "1px solid #334155", borderRadius: 8, overflow: "hidden", minWidth: 160, zIndex: 200 }}>
              {profilesDessinateurs.map(p => (
                <button key={p.id} onClick={() => { setDessinateurSelectionne(p); setShowDropdownDessinateur(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: dessinateurSelectionne?.id === p.id ? "#0F172A" : "transparent", border: "none", fontSize: 12, color: dessinateurSelectionne?.id === p.id ? "#FC6C1B" : "#CBD5E1", cursor: "pointer", fontWeight: dessinateurSelectionne?.id === p.id ? 700 : 400 }}>
                  {p.nom_complet}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Client */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => {
              if (modeVue !== "client") { setModeVue("client"); setShowDropdownClient(false); }
              else setShowDropdownClient(v => !v);
            }}
            disabled={profilesClients.length === 0}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: profilesClients.length === 0 ? "not-allowed" : "pointer", background: modeVue === "client" ? "#059669" : "transparent", color: modeVue === "client" ? "#fff" : profilesClients.length === 0 ? "#4B5563" : "#94A3B8", display: "flex", alignItems: "center", gap: 6 }}>
            👥 {clientSelectionne?.nom_complet ?? "Aucun compte"}{profilesClients.length > 1 ? " ▾" : ""}
          </button>
          {showDropdownClient && profilesClients.length > 0 && (
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#1E293B", border: "1px solid #334155", borderRadius: 8, overflow: "hidden", minWidth: 160, zIndex: 200 }}>
              {profilesClients.map(p => (
                <button key={p.id} onClick={() => { setClientSelectionne(p); setShowDropdownClient(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: clientSelectionne?.id === p.id ? "#0F172A" : "transparent", border: "none", fontSize: 12, color: clientSelectionne?.id === p.id ? "#059669" : "#CBD5E1", cursor: "pointer", fontWeight: clientSelectionne?.id === p.id ? 700 : 400 }}>
                  {p.nom_complet}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Supprimer l'ancienne SwitcherBarre interne**

Dans `App()`, supprime le bloc `const SwitcherBarre = () => ...` (lignes 258-275). **Ne supprime pas** les blocs `if (modeVue === "dessinateur")` et suivants, juste la définition de la fonction.

- [ ] **Step 3 : Mettre à jour le bloc `modeVue === "dessinateur"`**

Remplace le bloc existant (lignes ~277-287) par :

```jsx
if (modeVue === "dessinateur" && profil?.role === "admin") {
  return (
    <div onClick={() => { setShowMenuProfil(false); setShowDropdownDessinateur(false); setShowDropdownClient(false); }}>
      <SwitcherBarre
        modeVue={modeVue} setModeVue={setModeVue}
        profilesDessinateurs={profilesDessinateurs}
        dessinateurSelectionne={dessinateurSelectionne} setDessinateurSelectionne={setDessinateurSelectionne}
        showDropdownDessinateur={showDropdownDessinateur} setShowDropdownDessinateur={setShowDropdownDessinateur}
        profilesClients={profilesClients}
        clientSelectionne={clientSelectionne} setClientSelectionne={setClientSelectionne}
        showDropdownClient={showDropdownClient} setShowDropdownClient={setShowDropdownClient}
      />
      <div style={{ paddingTop: 44 }}>
        <VueDessinateur commandes={commandes} versions={versions}
          nomDessinateur={dessinateurSelectionne?.nom_complet ?? ""}
          onChangerStatut={changerStatut} onEnvoyerMessage={envoyerMessage} onDeposerVersion={deposerVersion} />
      </div>
    </div>
  );
}
```

Note : `nomDessinateur` passe maintenant de `settings.nomEntreprise` à `dessinateurSelectionne?.nom_complet ?? ""`.

- [ ] **Step 4 : Mettre à jour le `<SwitcherBarre />` dans le rendu admin (fin de App)**

Dans le return principal (admin layout, ligne ~403), remplace `<SwitcherBarre />` par :

```jsx
<SwitcherBarre
  modeVue={modeVue} setModeVue={setModeVue}
  profilesDessinateurs={profilesDessinateurs}
  dessinateurSelectionne={dessinateurSelectionne} setDessinateurSelectionne={setDessinateurSelectionne}
  showDropdownDessinateur={showDropdownDessinateur} setShowDropdownDessinateur={setShowDropdownDessinateur}
  profilesClients={profilesClients}
  clientSelectionne={clientSelectionne} setClientSelectionne={setClientSelectionne}
  showDropdownClient={showDropdownClient} setShowDropdownClient={setShowDropdownClient}
/>
```

Aussi, dans le `onClick` du wrapper div du rendu admin (ligne ~404), étend le handler :
```jsx
onClick={() => { setShowMenuProfil(false); setShowDropdownDessinateur(false); setShowDropdownClient(false); }}
```

- [ ] **Step 5 : Vérifier**

Lance `npm start`. En tant qu'admin :
- La barre affiche 3 boutons : Admin, Dessinateur (avec nom), Client (avec nom ou "Aucun compte")
- Cliquer Admin → layout admin normal
- Cliquer Dessinateur → VueDessinateur avec le bon nom filtré
- Si plusieurs dessinateurs : le ▾ apparaît, clic → dropdown, sélection → filtre change
- Clic en dehors → dropdown se ferme

- [ ] **Step 6 : Commit**

```bash
git add src/App.js
git commit -m "feat: extract SwitcherBarre and add dessinateur/client dropdowns

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3 : Créer le composant VueClient

**Files:**
- Create: `src/components/VueClient.js`

- [ ] **Step 1 : Créer le fichier**

Crée `src/components/VueClient.js` avec le contenu suivant :

```jsx
import { useState } from "react";
import Badge from "./Badge";
import HistoriqueVersions from "./HistoriqueVersions";
import { ListeFichiers, LogoCliquable } from "./VisuFichier";
import PageReglages from "./PageReglages";
import { formatDateCourt } from "../helpers";

export default function VueClient({ commandes, versions, clientSelectionne, noLayout = false }) {
  const [vue, setVue]       = useState("commandes");
  const [selected, setSelected] = useState(null);

  const mesCommandes    = commandes.filter(c => c.client === clientSelectionne?.nom_complet);
  const actives         = mesCommandes.filter(c => c.statut !== "Validé");
  const terminees       = mesCommandes.filter(c => c.statut === "Validé");
  const versionsSelected = selected ? versions.filter(v => v.commande_id === selected.id) : [];

  const nav = [
    { id: "commandes",  label: "Commandes",  icon: "📋" },
    { id: "reglages",   label: "Réglages",   icon: "⚙️" },
    { id: "mon-compte", label: "Mon compte", icon: "👤" },
  ];

  return (
    <div style={noLayout ? {} : { display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}>

      {!noLayout && (
        <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px", gap: 4, position: "fixed", top: 44, height: "calc(100vh - 44px)", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
            <div style={{ width: 32, height: 32, background: "#059669", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 16 }}>👥</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Espace client</span>
          </div>
          <div style={{ padding: "8px 12px", background: "#F0FDF4", borderRadius: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#86EFAC", marginBottom: 2 }}>Connecté en tant que</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}>{clientSelectionne?.nom_complet ?? "—"}</div>
          </div>
          {nav.map(item => (
            <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#E8EDF2" : "transparent", color: vue === item.id ? "#122131" : "#6B7280", textAlign: "left", width: "100%" }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div style={{ marginTop: "auto", borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
            <div style={{ padding: "8px 12px", fontSize: 11, color: "#9CA3AF" }}>Mode test — vue client</div>
          </div>
        </div>
      )}

      <div style={noLayout ? {} : { marginLeft: 220, flex: 1, padding: "32px 32px" }}>

        {vue === "reglages" && <PageReglages />}

        {vue === "mon-compte" && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center", color: "#9CA3AF" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>👤</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#122131", marginBottom: 6 }}>
              {clientSelectionne?.prenom} {clientSelectionne?.nom}
            </div>
            <div style={{ fontSize: 13 }}>Aperçu — compte client</div>
          </div>
        )}

        {vue === "commandes" && (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "En cours",  val: actives.length,    color: "#122131", bg: "#fff" },
                { label: "Validées",  val: terminees.length,  color: "#059669", bg: "#F0FDF4" },
                { label: "Total",     val: mesCommandes.length, color: "#374151", bg: "#F8FAFC" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 22px" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tableau */}
            {mesCommandes.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 14, color: "#94A3B8" }}>Aucune commande pour ce client.</div>
              </div>
            ) : (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <span>Bâtiment</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
                </div>
                {[...actives, ...terminees].map(c => (
                  <div key={c.id} onClick={() => setSelected(c)}
                    style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EEF3F8" : "transparent", transition: "background 0.1s" }}>
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

            {/* Panneau détail */}
            {selected && (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.batiment || selected.client}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.ref}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge statut={selected.statut} />
                    <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {[
                    { label: "Créé le",   val: formatDateCourt(selected.created_at) },
                    { label: "Délai",     val: selected.delai ? formatDateCourt(selected.delai) : "—" },
                    { label: "Nb. plans", val: selected.plans.length },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div>
                    </div>
                  ))}
                </div>

                {selected.plansFinalises?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Plans finalisés</div>
                    <ListeFichiers fichiers={selected.plansFinalises} couleurAccent="#059669" />
                  </div>
                )}

                {selected.logoClient?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Logo client</div>
                    <LogoCliquable fichier={selected.logoClient[0]} />
                  </div>
                )}

                <HistoriqueVersions versions={versionsSelected} />

                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46", fontWeight: 500 }}>
                  Vue en lecture seule — mode preview client
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/components/VueClient.js
git commit -m "feat: add VueClient read-only preview component

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4 : Brancher VueClient dans App.js

**Files:**
- Modify: `src/App.js:16-20, ~287`

- [ ] **Step 1 : Ajouter l'import de VueClient**

En haut de `App.js`, après l'import de `VueDessinateur` (ligne 15), ajoute :

```js
import VueClient from "./components/VueClient";
```

- [ ] **Step 2 : Ajouter le bloc de rendu `modeVue === "client"`**

Juste après le bloc `if (modeVue === "dessinateur" && profil?.role === "admin") { ... }` (qui se termine vers la ligne ~287), ajoute :

```jsx
if (modeVue === "client" && profil?.role === "admin") {
  return (
    <div onClick={() => { setShowMenuProfil(false); setShowDropdownDessinateur(false); setShowDropdownClient(false); }}>
      <SwitcherBarre
        modeVue={modeVue} setModeVue={setModeVue}
        profilesDessinateurs={profilesDessinateurs}
        dessinateurSelectionne={dessinateurSelectionne} setDessinateurSelectionne={setDessinateurSelectionne}
        showDropdownDessinateur={showDropdownDessinateur} setShowDropdownDessinateur={setShowDropdownDessinateur}
        profilesClients={profilesClients}
        clientSelectionne={clientSelectionne} setClientSelectionne={setClientSelectionne}
        showDropdownClient={showDropdownClient} setShowDropdownClient={setShowDropdownClient}
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

- [ ] **Step 3 : Vérifier le comportement complet**

Lance `npm start`. En tant qu'admin :

1. **Mode Admin** → layout admin normal, barre avec 3 boutons
2. **Clic Dessinateur** → VueDessinateur, nom du dessinateur sélectionné affiché, missions filtrées
3. **Dropdown Dessinateur** (si > 1 profil) → changer de dessinateur → missions changent
4. **Clic Client** → VueClient, sidebar verte, stats + liste commandes du client
5. **Dropdown Client** (si > 1 profil) → changer de client → commandes changent
6. **Onglet Réglages** → PageReglages (placeholder "aucun réglage")
7. **Onglet Mon compte** → placeholder avec nom du client
8. **Clic sur une commande** → panneau détail (read-only, badge statut, versions)
9. **Clic en dehors** → dropdowns se ferment
10. **Retour Admin** → layout admin, SwitcherBarre toujours présente

- [ ] **Step 4 : Commit final**

```bash
git add src/App.js
git commit -m "feat: wire VueClient into admin switcher (3-mode preview: admin/dessinateur/client)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 5 : Push vers main (Netlify déploie automatiquement)**

```bash
git push origin main
```

---

## Notes de déploiement

Avant de tester en production, s'assurer que les faux comptes existent dans Supabase (table `profiles`, `statut = "actif"`) :

| prenom | nom | role |
|---|---|---|
| Dessinateur | 1 | dessinateur |
| Dessinateur | 2 | dessinateur |
| User | 1 | client |
| User | 2 | client |

Et que les commandes de test ont :
- `dessinateur = "Dessinateur 1"` / `"Dessinateur 2"`
- `client = "User 1"` / `"User 2"`
