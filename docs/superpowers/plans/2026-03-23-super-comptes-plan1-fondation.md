# Super Comptes — Plan 1 : Fondation DB + UI fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer la migration DB (master_id, invite_code, notes_clients) et corriger les problèmes UI existants (nomDessinateur, affichage invite code, dessinateur assigné dans Mon compte, colonne Maître dans GestionUtilisateurs).

**Architecture:** Migration SQL via Supabase MCP, puis corrections ciblées dans App.js, PageMonCompte.js et GestionUtilisateurs.js. Pas de nouveau composant dans ce plan — uniquement des modifications des fichiers existants.

**Tech Stack:** React CRA, Supabase (SQL via MCP `apply_migration`), inline styles

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| Supabase DB | Migration : `master_id`, `invite_code`, triggers, `notes_clients` |
| `src/App.js` | Fix `nomDessinateur` pour vrais comptes dessinateur ; merge Dashboard+Commandes pour client/dessinateur |
| `src/components/PageMonCompte.js` | Afficher `invite_code` (read-only) + section "Dessinateur assigné" pour clients |
| `src/components/GestionUtilisateurs.js` | Colonne "Maître" dans la liste + bouton "Détacher" dans la fiche |

---

## Task 1 : Migration Supabase

**Files:**
- Supabase project `custkyapdbvzkuxgurla` (via MCP)

- [ ] **Step 1 : Appliquer la migration**

Utiliser `mcp__claude_ai_Supabase__apply_migration` avec le SQL suivant (nom : `super_comptes_fondation`) :

```sql
-- 1. Colonnes sur profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS master_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- 2. Fonction génération invite_code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger génération invite_code à la création
DROP TRIGGER IF EXISTS trg_invite_code ON profiles;
CREATE TRIGGER trg_invite_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.invite_code IS NULL)
  EXECUTE FUNCTION generate_invite_code();

-- 4. Backfill profils existants sans invite_code
UPDATE profiles
SET invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code IS NULL;

-- 5. Contrainte 1 niveau (trigger)
CREATE OR REPLACE FUNCTION check_no_nested_master()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.master_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.master_id AND master_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Le maître désigné est déjà sous-compte.';
    END IF;
    IF EXISTS (SELECT 1 FROM profiles WHERE master_id = NEW.id) THEN
      RAISE EXCEPTION 'Ce compte a déjà des sous-comptes.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_nested_master ON profiles;
CREATE TRIGGER trg_no_nested_master
  BEFORE INSERT OR UPDATE OF master_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION check_no_nested_master();

-- 6. Table notes_clients
CREATE TABLE IF NOT EXISTS notes_clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dessinateur_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_nom      text NOT NULL,
  note            text NOT NULL DEFAULT '',
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (dessinateur_id, client_nom)
);
```

- [ ] **Step 2 : Vérifier la migration**

Exécuter via `mcp__claude_ai_Supabase__execute_sql` :
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('master_id', 'invite_code');
```
Attendu : 2 lignes (`master_id`, `invite_code`).

```sql
SELECT COUNT(*) FROM profiles WHERE invite_code IS NULL;
```
Attendu : 0 (tous les profils ont un code).

```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'notes_clients';
```
Attendu : 1 ligne.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "feat: apply DB migration — master_id, invite_code, notes_clients"
```

---

## Task 2 : Fix nomDessinateur + merge Dashboard/Commandes dans App.js

**Context:**
- `profil.role === "dessinateur"` OU `"client"` → layout lignes 403-508 dans `src/App.js`
- Bug : ligne 406 `const nomDessinateur = settings.nomEntreprise;` → devrait être `${profil.prenom} ${profil.nom}`
- La sidebar a déjà le bouton déconnexion (lignes 432-444) — ne pas toucher
- `roleNav` a un onglet "dashboard" séparé des "commandes" — fusionner comme pour admin

**Files:**
- Modify: `src/App.js` (lignes ~403-510)

- [ ] **Step 1 : Lire App.js autour des lignes 403-510 pour confirmer le contexte**

- [ ] **Step 2 : Corriger nomDessinateur**

Changer ligne 406 :
```js
// AVANT
const nomDessinateur = settings.nomEntreprise;
// APRÈS
const nomDessinateur = `${profil.prenom} ${profil.nom}`;
```

- [ ] **Step 3 : Fusionner Dashboard + Commandes dans roleNav**

Remplacer `roleNav` pour supprimer "dashboard" et mettre "commandes" en premier :

```js
const roleNav = [
  { id: "commandes",   label: isDessinateur ? "Mes missions" : "Commandes",  icon: "📋" },
  { id: "reglages",    label: "Réglages",   icon: "⚙️" },
  { id: "mon-compte",  label: "Mon compte", icon: "👤" },
];
```

- [ ] **Step 4 : Remplacer l'état initial de vue pour dessinateur/client**

Chercher `useState("commandes")` dans App.js. L'état `vue` est déjà sur "commandes" (corrigé précédemment pour admin). Vérifier que l'initialisation est cohérente — si une valeur "dashboard" est encore là, la corriger en "commandes".

- [ ] **Step 5 : Supprimer le bloc `vue === "dashboard"` dans le layout dessinateur/client**

Le bloc est aux lignes ~474-490. Le supprimer entièrement (les stats seront intégrées dans la Task 3 du Plan 2).

- [ ] **Step 6 : Vérifier**

```bash
npm start
```
- Connecter avec `dessinateur1@test.com` (après reset mdp Supabase dashboard)
- Vérifier que la sidebar affiche "Mes missions" (pas Dashboard ni Commandes séparés)
- Vérifier que le nom affiché en haut de la sidebar VueDessinateur correspond au compte connecté (pas "First Incendie")

- [ ] **Step 7 : Commit**

```bash
git add src/App.js
git commit -m "fix: nomDessinateur from profil, merge Dashboard+Commandes for dessinateur/client"
```

---

## Task 3 : PageMonCompte — invite_code + dessinateur assigné

**Context:**
`src/components/PageMonCompte.js` reçoit `{ profil, session, role, commandes, onProfilUpdate }`.
- `profil.invite_code` est maintenant disponible (après migration Task 1)
- Pour les clients, leur dessinateur assigné vient de `client_dessinateurs` (join table)
- Le chargement du dessinateur assigné se fait dans `App.js` et est passé en prop

**Files:**
- Modify: `src/App.js` (zone chargement profil, ~lignes 152-180)
- Modify: `src/components/PageMonCompte.js`

- [ ] **Step 1 : Charger le dessinateur assigné dans App.js**

Dans la fonction `chargerProfil` (App.js ~ligne 152), après le chargement du profil, ajouter :

```js
const chargerProfil = async (uid) => {
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
  setProfil(data);
  if (data?.role === "admin") { chargerNbAttente(); chargerProfilesPreview(); }
  // Charger dessinateur assigné pour les clients
  if (data?.role === "client") {
    const { data: lien } = await supabase
      .from("client_dessinateurs")
      .select("dessinateur_id, profiles!dessinateur_id(prenom, nom)")
      .eq("client_id", uid)
      .limit(1)
      .maybeSingle();
    setDessinateurAssigne(lien ? `${lien.profiles.prenom} ${lien.profiles.nom}` : null);
  }
};
```

Ajouter le state dans App() :
```js
const [dessinateurAssigne, setDessinateurAssigne] = useState(null);
```

Passer la prop dans les deux endroits où PageMonCompte est rendu :
1. Ligne ~584 (admin) : `<PageMonCompte ... dessinateurAssigne={dessinateurAssigne} />`
2. Ligne ~470 (dessinateur/client) : `<PageMonCompte ... dessinateurAssigne={dessinateurAssigne} />`

- [ ] **Step 2 : Mettre à jour la signature de PageMonCompte**

```js
export default function PageMonCompte({ profil, session, onProfilUpdate, role, commandes = [], dessinateurAssigne }) {
```

- [ ] **Step 3 : Ajouter la section "Mon code d'invitation" dans PageMonCompte**

Ajouter après la section "Photo de profil", avant "Informations personnelles" :

```jsx
{/* Code d'invitation */}
<div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
  <div style={sectionTitle}>Code d'invitation</div>
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <code style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.15em", color: "#122131", background: "#F1F5F9", padding: "8px 16px", borderRadius: 8 }}>
      {profil?.invite_code ?? "—"}
    </code>
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(profil?.invite_code ?? "")}
      style={{ padding: "8px 14px", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
    >
      Copier
    </button>
  </div>
  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>
    Partagez ce code pour inviter quelqu'un à rejoindre votre espace.
  </div>
</div>
```

- [ ] **Step 4 : Ajouter la section "Dessinateur assigné" pour les clients**

Dans PageMonCompte, après la section "Adresse" (ou en bas avant le bouton Enregistrer), ajouter :

```jsx
{/* Dessinateur assigné — clients uniquement */}
{role === "client" && (
  <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
    <div style={sectionTitle}>Dessinateur assigné</div>
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FFF3ED", border: "1.5px solid #FED7AA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✏️</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#122131" }}>{dessinateurAssigne ?? "—"}</div>
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>Dessinateur en charge de vos plans</div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5 : Vérifier**

```bash
npm start
```
- Se connecter en admin → Mon compte → vérifier que le code d'invitation est affiché
- Se connecter en tant que user1@test.com (après reset mdp) → Mon compte → vérifier code + dessinateur assigné (si assigné via GestionUtilisateurs)

- [ ] **Step 6 : Commit**

```bash
git add src/App.js src/components/PageMonCompte.js
git commit -m "feat: invite_code display and dessinateur assigné in PageMonCompte"
```

---

## Task 4 : GestionUtilisateurs — colonne Maître + bouton Détacher

**Context:**
`src/components/GestionUtilisateurs.js` — liste les profils, modal fiche par profil.
- Ajouter une colonne "Maître" dans la liste des profils (affiche `prenom nom` du maître)
- Dans la modal fiche, si le profil a un `master_id`, afficher "Maître : Prénom Nom" + bouton "Détacher"
- Le chargement des profils inclut déjà `*` donc `master_id` et `invite_code` seront disponibles

**Files:**
- Modify: `src/components/GestionUtilisateurs.js`

- [ ] **Step 1 : Lire GestionUtilisateurs.js pour confirmer la structure de la liste (lignes ~175-205)**

- [ ] **Step 2 : Ajouter l'affichage du maître dans la liste**

Dans la div de chaque profil (après le badge statut), ajouter :

```jsx
{profil.master_id && (
  <span style={{ fontSize: 11, color: "#6B7280", background: "#F1F5F9", borderRadius: 4, padding: "2px 7px" }}>
    Sous-compte de {profils.find(p => p.id === profil.master_id)
      ? `${profils.find(p => p.id === profil.master_id).prenom} ${profils.find(p => p.id === profil.master_id).nom}`
      : "—"}
  </span>
)}
```

- [ ] **Step 3 : Ajouter le bouton Détacher dans la modal fiche**

Dans la modal fiche (après la section "Notes internes"), ajouter :

```jsx
{/* Maître — si sous-compte */}
{selectionne.master_id && (
  <div style={{ marginBottom: 20, padding: "12px 16px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Compte maître</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#122131" }}>
        {profils.find(p => p.id === selectionne.master_id)
          ? `${profils.find(p => p.id === selectionne.master_id).prenom} ${profils.find(p => p.id === selectionne.master_id).nom}`
          : "—"}
      </div>
    </div>
    <button
      onClick={async () => {
        setActionEnCours(true);
        await supabase.from("profiles").update({ master_id: null }).eq("id", selectionne.id);
        await charger();
        setSelectionne(null);
        setActionEnCours(false);
      }}
      disabled={actionEnCours}
      style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
    >
      Détacher
    </button>
  </div>
)}
```

- [ ] **Step 4 : Vérifier**

```bash
npm start
```
- Admin → GestionUtilisateurs → si des profils ont un `master_id`, vérifier que la colonne "Sous-compte de X" apparaît
- Ouvrir la fiche d'un sous-compte → vérifier la section "Compte maître" + bouton "Détacher"

- [ ] **Step 5 : Commit**

```bash
git add src/components/GestionUtilisateurs.js
git commit -m "feat: show master account and detach button in GestionUtilisateurs"
```

---

## Task 5 : Push

- [ ] **Push vers main**

```bash
git push
```

Déploiement manuel sur Netlify si nécessaire.
