# Sélection du dessinateur lors d'une commande — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin d'assigner plusieurs dessinateurs à un utilisateur, à l'utilisateur de choisir son dessinateur par défaut dans "Mon compte", et pré-sélectionner ce dessinateur à la création d'une commande.

**Architecture:** Nouvelle table junction `utilisateur_dessinateurs` (utilisateur_id, dessinateur_id, is_default). Sauvegarde admin via RPC PostgreSQL atomique sécurisée (SECURITY DEFINER + check rôle). Modifications dans 3 composants React existants : GestionUtilisateurs, PageMonCompte, VueUtilisateur.

**Tech Stack:** React (CRA), Supabase (SQL migrations via dashboard SQL Editor, rpc() client JS), JavaScript

---

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| Supabase SQL Editor | Créer table, RPC, policies, migrer données |
| `src/components/GestionUtilisateurs.js` | Modifier : multi-select dessinateurs, RPC save |
| `src/components/PageMonCompte.js` | Modifier : section "Mes dessinateurs" (ligne 355-367) |
| `src/components/VueUtilisateur.js` | Modifier : state + form + chargerTout + creerCommande |

---

## Task 1 : Migration Supabase

**Fichiers :** Supabase SQL Editor (Dashboard → SQL Editor)

Cette tâche crée toute l'infrastructure BDD. Elle doit être faite en premier — les autres tâches dépendent de la table.

- [ ] **Step 1 : Créer la table `utilisateur_dessinateurs`**

Dans le Supabase Dashboard → SQL Editor, exécuter :

```sql
CREATE TABLE utilisateur_dessinateurs (
  utilisateur_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dessinateur_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (utilisateur_id, dessinateur_id)
);
```

- [ ] **Step 2 : Activer RLS et créer les politiques**

```sql
ALTER TABLE utilisateur_dessinateurs ENABLE ROW LEVEL SECURITY;

-- L'utilisateur voit ses propres assignations
CREATE POLICY "utilisateur lit ses dessinateurs"
  ON utilisateur_dessinateurs FOR SELECT
  USING (auth.uid() = utilisateur_id);

-- Le dessinateur voit ses assignations
CREATE POLICY "dessinateur lit ses assignations"
  ON utilisateur_dessinateurs FOR SELECT
  USING (auth.uid() = dessinateur_id);

-- L'utilisateur peut changer son propre défaut
CREATE POLICY "utilisateur met a jour son defaut"
  ON utilisateur_dessinateurs FOR UPDATE
  USING (auth.uid() = utilisateur_id)
  WITH CHECK (auth.uid() = utilisateur_id);

-- L'admin peut lire toutes les assignations (nécessaire pour chargerComptes dans GestionUtilisateurs)
CREATE POLICY "admin lit toutes les assignations"
  ON utilisateur_dessinateurs FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
```

- [ ] **Step 3 : Créer la RPC de sauvegarde atomique**

```sql
CREATE OR REPLACE FUNCTION set_dessinateurs_utilisateur(
  p_utilisateur_id UUID,
  p_dessinateurs JSONB
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  DELETE FROM utilisateur_dessinateurs WHERE utilisateur_id = p_utilisateur_id;
  INSERT INTO utilisateur_dessinateurs (utilisateur_id, dessinateur_id, is_default)
  SELECT p_utilisateur_id, (elem->>'dessinateur_id')::UUID, (elem->>'is_default')::boolean
  FROM jsonb_array_elements(p_dessinateurs) AS elem;
END;
$$;
```

- [ ] **Step 4 : Migrer les données existantes**

```sql
INSERT INTO utilisateur_dessinateurs (utilisateur_id, dessinateur_id, is_default)
SELECT id, dessinateur_id, true
FROM profiles
WHERE dessinateur_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

- [ ] **Step 5 : Vérifier la migration**

```sql
SELECT COUNT(*) FROM utilisateur_dessinateurs;
-- Doit retourner le même nombre que :
SELECT COUNT(*) FROM profiles WHERE dessinateur_id IS NOT NULL;
```

- [ ] **Step 6 : Commit**

```bash
git commit --allow-empty -m "feat: migration Supabase utilisateur_dessinateurs + RPC + RLS"
```

---

## Task 2 : GestionUtilisateurs — multi-select dessinateurs

**Fichiers :**
- Modifier : `src/components/GestionUtilisateurs.js`

### Contexte du code existant

- Ligne 6 : `const [dessinateurs, setDessinateurs] = useState([]);` — liste des dessinateurs actifs
- Ligne 49-66 : `sauvegarderEdit()` — écrit `dessinateur_id` dans `profiles` (à modifier)
- Ligne 149 : `const dessinateurAssigne = dessinateurs.find(d => d.id === c.dessinateur_id);` — affichage colonne (à modifier)
- Ligne 152 : `setEditForm({ ..., dessinateur_id: c.dessinateur_id || "" })` — init editForm (à modifier)
- Lignes 216-226 : bloc `{editForm.role === "utilisateur" && ...}` avec le `<select>` unique (à remplacer)
- Ligne 163 : affichage nom dessinateur dans la liste (à modifier)

- [ ] **Step 1 : Ajouter le state `assignationsEdit`**

Dans `GestionUtilisateurs()`, après la déclaration des états existants (ligne ~16), ajouter :

```js
const [assignationsEdit, setAssignationsEdit] = useState([]); // [{ dessinateur_id, is_default }]
const [loadingAssignations, setLoadingAssignations] = useState(false);
const [assignationsMap, setAssignationsMap] = useState({}); // { utilisateur_id: [{ dessinateur_id, is_default }] }
```

- [ ] **Step 2 : Charger toutes les assignations au chargement des comptes**

Dans `chargerComptes()`, après `setDessinateurs(...)`, ajouter :

```js
// Charger toutes les assignations en parallèle
const { data: assignations } = await supabase
  .from("utilisateur_dessinateurs")
  .select("utilisateur_id, dessinateur_id, is_default");
if (assignations) {
  const map = {};
  assignations.forEach(a => {
    if (!map[a.utilisateur_id]) map[a.utilisateur_id] = [];
    map[a.utilisateur_id].push({ dessinateur_id: a.dessinateur_id, is_default: a.is_default });
  });
  setAssignationsMap(map);
}
```

- [ ] **Step 3 : Charger les assignations lors du clic sur un utilisateur**

Modifier le `onClick` de la ligne 152. Remplacer :
```js
onClick={() => { setSelected(c); setEditForm({ prenom: c.prenom, nom: c.nom, role: c.role, statut: c.statut, is_owner: c.is_owner || false, dessinateur_id: c.dessinateur_id || "" }); }}
```
Par :
```js
onClick={async () => {
  setSelected(c);
  setEditForm({ prenom: c.prenom, nom: c.nom, role: c.role, statut: c.statut, is_owner: c.is_owner || false });
  setLoadingAssignations(true);
  const { data } = await supabase
    .from("utilisateur_dessinateurs")
    .select("dessinateur_id, is_default")
    .eq("utilisateur_id", c.id);
  setAssignationsEdit(data || []);
  setLoadingAssignations(false);
}}
```

- [ ] **Step 4 : Mettre à jour l'affichage de la colonne "Dessinateur" dans le tableau**

Remplacer la ligne 149 et 163 :

```js
// Ligne 149 — remplacer :
const dessinateurAssigne = dessinateurs.find(d => d.id === c.dessinateur_id);
// Par :
const assignationsDuCompte = assignationsMap[c.id] || [];
const defaultAssignation = assignationsDuCompte.find(a => a.is_default) || assignationsDuCompte[0];
const dessinateurDefaut = defaultAssignation ? dessinateurs.find(d => d.id === defaultAssignation.dessinateur_id) : null;
const nbAutres = assignationsDuCompte.length - 1;
```

```js
// Ligne 163 — remplacer :
<div style={{ fontSize: 12, color: "#6B7280" }}>{dessinateurAssigne ? `${dessinateurAssigne.prenom} ${dessinateurAssigne.nom}` : "—"}</div>
// Par :
<div style={{ fontSize: 12, color: "#6B7280" }}>
  {dessinateurDefaut
    ? `${dessinateurDefaut.prenom} ${dessinateurDefaut.nom}${nbAutres > 0 ? ` + ${nbAutres} autre${nbAutres > 1 ? "s" : ""}` : ""}`
    : "—"}
</div>
```

- [ ] **Step 5 : Remplacer le `<select>` unique par le multi-select avec défaut**

Remplacer le bloc lignes 216-226 :
```jsx
{editForm.role === "utilisateur" && (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>Dessinateur assigné</label>
    <select value={editForm.dessinateur_id} onChange={e => setEditForm({ ...editForm, dessinateur_id: e.target.value })} style={inputStyle}>
      <option value="">— Non assigné —</option>
      {dessinateurs.map(d => (
        <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>
      ))}
    </select>
  </div>
)}
```

Par :
```jsx
{editForm.role === "utilisateur" && (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>Dessinateurs assignés</label>
    {loadingAssignations ? (
      <div style={{ fontSize: 12, color: "#94A3B8" }}>Chargement...</div>
    ) : dessinateurs.length === 0 ? (
      <div style={{ fontSize: 12, color: "#94A3B8" }}>Aucun dessinateur actif disponible.</div>
    ) : (
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
        {dessinateurs.map(d => {
          const assignation = assignationsEdit.find(a => a.dessinateur_id === d.id);
          const estCoche = !!assignation;
          const estDefaut = assignation?.is_default || false;
          return (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #F3F4F6", background: estCoche ? "#F8FAFC" : "transparent" }}>
              <input
                type="checkbox"
                checked={estCoche}
                onChange={e => {
                  if (e.target.checked) {
                    const nouvellesAssignations = [...assignationsEdit, { dessinateur_id: d.id, is_default: assignationsEdit.length === 0 }];
                    setAssignationsEdit(nouvellesAssignations);
                  } else {
                    const restantes = assignationsEdit.filter(a => a.dessinateur_id !== d.id);
                    // Si on décoche le défaut et qu'il reste des assignations, mettre le premier comme défaut
                    if (estDefaut && restantes.length > 0) {
                      restantes[0] = { ...restantes[0], is_default: true };
                    }
                    setAssignationsEdit(restantes);
                  }
                }}
              />
              <span style={{ fontSize: 13, flex: 1 }}>{d.prenom} {d.nom}</span>
              {estCoche && (
                <button
                  onClick={() => setAssignationsEdit(assignationsEdit.map(a => ({ ...a, is_default: a.dessinateur_id === d.id })))}
                  style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: estDefaut ? "#FFF3EE" : "#fff", color: estDefaut ? "#FC6C1B" : "#9CA3AF", cursor: "pointer", fontWeight: estDefaut ? 700 : 400 }}>
                  {estDefaut ? "★ Défaut" : "☆ Défaut"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6 : Mettre à jour `sauvegarderEdit` pour utiliser la RPC**

Remplacer le contenu de `sauvegarderEdit` (lignes 49-66) :

```js
async function sauvegarderEdit() {
  if (!editForm || !selected) return;
  setSaving(true);
  setSaveError("");
  // Mise à jour du profil (sans dessinateur_id — géré via utilisateur_dessinateurs)
  const { error } = await supabase.from("profiles").update({
    prenom: editForm.prenom,
    nom: editForm.nom,
    role: editForm.role,
    statut: editForm.statut,
    is_owner: editForm.is_owner,
  }).eq("id", selected.id);
  if (error) { setSaveError(error.message); setSaving(false); return; }

  // Sauvegarde atomique des assignations dessinateurs via RPC
  if (editForm.role === "utilisateur") {
    const { error: rpcError } = await supabase.rpc("set_dessinateurs_utilisateur", {
      p_utilisateur_id: selected.id,
      p_dessinateurs: assignationsEdit,
    });
    if (rpcError) { setSaveError(rpcError.message); setSaving(false); return; }
    // Mettre à jour le map local
    setAssignationsMap(prev => ({ ...prev, [selected.id]: assignationsEdit }));
  }

  setComptes(prev => prev.map(c => c.id === selected.id ? { ...c, ...editForm } : c));
  setSelected(prev => ({ ...prev, ...editForm }));
  setEditForm(null);
  setSaving(false);
}
```

- [ ] **Step 7 : Vérifier dans le navigateur**

- Ouvrir GestionUtilisateurs en tant qu'admin
- Cliquer sur un utilisateur → la liste des dessinateurs s'affiche avec cases à cocher
- Cocher 1 ou 2 dessinateurs → l'étoile "Défaut" apparaît
- Sauvegarder → la colonne récapitulatif affiche le bon dessinateur
- Vérifier dans Supabase : `SELECT * FROM utilisateur_dessinateurs WHERE utilisateur_id = '<uuid>';`

- [ ] **Step 8 : Commit**

```bash
git add src/components/GestionUtilisateurs.js
git commit -m "feat: multi-select dessinateurs dans GestionUtilisateurs via RPC atomique"
```

---

## Task 3 : PageMonCompte — section "Mes dessinateurs"

**Fichiers :**
- Modifier : `src/components/PageMonCompte.js`

### Contexte du code existant

- Ligne 4 : signature du composant — `{ profil, session, onProfilUpdate, role, commandes, dessinateurAssigne }`
- Lignes 355-367 : bloc `{role === "client" && ...}` à remplacer (lettre morte car le rôle est `"utilisateur"`)
- Ligne 29 : `useEffect` existant pour `nomMaitre` — ajouter un second useEffect pour charger les dessinateurs

- [ ] **Step 1 : Ajouter le state pour les dessinateurs**

Dans le composant `PageMonCompte`, après la déclaration de `[nomMaitre, setNomMaitre]` (ligne ~27), ajouter :

```js
const [mesDessinateurs, setMesDessinateurs] = useState([]);
const [updatingDefaut, setUpdatingDefaut] = useState(false);
```

- [ ] **Step 2 : Charger les dessinateurs au montage**

Après le `useEffect` pour `nomMaitre` (ligne ~39), ajouter :

```js
useEffect(() => {
  if (role !== "utilisateur") return;
  supabase
    .from("utilisateur_dessinateurs")
    .select("dessinateur_id, is_default, profiles:dessinateur_id(prenom, nom)")
    .eq("utilisateur_id", profil.id)
    .then(({ data }) => {
      if (data) setMesDessinateurs(data.map(d => ({
        id: d.dessinateur_id,
        prenom: d.profiles?.prenom || "",
        nom: d.profiles?.nom || "",
        is_default: d.is_default,
      })));
    });
}, [profil.id, role]); // eslint-disable-line
```

- [ ] **Step 3 : Remplacer le bloc `role === "client"` par la section "Mes dessinateurs"**

Remplacer les lignes 355-367 :
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

Par :
```jsx
{/* Mes dessinateurs — utilisateurs uniquement */}
{role === "utilisateur" && (
  <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
    <div style={sectionTitle}>Mes dessinateurs</div>
    {mesDessinateurs.length === 0 ? (
      <div style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "20px 0" }}>
        Aucun dessinateur assigné, contactez votre administrateur.
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mesDessinateurs.map(d => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: d.is_default ? "#FFF3EE" : "#F8FAFC", borderRadius: 8, border: `1px solid ${d.is_default ? "#FED7AA" : "#E5E7EB"}` }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FFF3ED", border: "1.5px solid #FED7AA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>✏️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#122131" }}>{d.prenom} {d.nom}</div>
              {d.is_default && <div style={{ fontSize: 11, color: "#FC6C1B", fontWeight: 700 }}>Défaut</div>}
            </div>
            {!d.is_default && mesDessinateurs.length > 1 && (
              <button
                disabled={updatingDefaut}
                onClick={async () => {
                  setUpdatingDefaut(true);
                  await supabase.from("utilisateur_dessinateurs")
                    .update({ is_default: false })
                    .eq("utilisateur_id", profil.id);
                  await supabase.from("utilisateur_dessinateurs")
                    .update({ is_default: true })
                    .eq("utilisateur_id", profil.id)
                    .eq("dessinateur_id", d.id);
                  setMesDessinateurs(prev => prev.map(x => ({ ...x, is_default: x.id === d.id })));
                  setUpdatingDefaut(false);
                }}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280", cursor: updatingDefaut ? "not-allowed" : "pointer" }}>
                Définir par défaut
              </button>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4 : Vérifier dans le navigateur**

- Se connecter en tant qu'utilisateur ayant des dessinateurs assignés
- Ouvrir "Mon compte" → la section "Mes dessinateurs" doit lister les dessinateurs
- Si plusieurs dessinateurs : le bouton "Définir par défaut" doit apparaître sur les non-défauts
- Cliquer "Définir par défaut" → le fond orange passe sur le nouveau défaut
- Vérifier en DB : `SELECT * FROM utilisateur_dessinateurs WHERE utilisateur_id = '<uuid>';`

- [ ] **Step 5 : Commit**

```bash
git add src/components/PageMonCompte.js
git commit -m "feat: section Mes dessinateurs dans PageMonCompte avec changement défaut"
```

---

## Task 4 : VueUtilisateur — formulaire nouvelle commande

**Fichiers :**
- Modifier : `src/components/VueUtilisateur.js`

### Contexte du code existant

- Ligne 40-46 : `formVide()` — fonction qui initialise le formulaire
- Ligne 47 : `const [form, setForm] = useState(formVide());`
- Ligne 94-112 : `chargerTout()` — charge commandes, versions, sous-comptes
- Ligne 114-158 : `creerCommande()` — insert en base
- Ligne 119-130 : objet inséré dans `commandes` — ajouter `dessinateur_id` et `dessinateur`
- Ligne 151-154 : appel `notify-commande` — ajouter `dessinateur_id`
- Ligne 157 : `setForm(formVide())` — reset après création (à mettre à jour)
- Ligne 608 : `setForm(formVide())` — reset à l'annulation (à mettre à jour)
- Ligne 609 : condition de désactivation du bouton — ajouter `|| !form.dessinateur_id`
- Lignes 579-602 : zone "Détail du plan" dans le formulaire — ajouter le select dessinateur

- [ ] **Step 1 : Ajouter le state `dessinateursDispos`**

Après la ligne 37 (`const [sousComptes, setSousComptes] = useState([]);`), ajouter :

```js
const [dessinateursDispos, setDessinateursDispos] = useState([]); // [{ id, prenom, nom, is_default }]
```

- [ ] **Step 2 : Mettre à jour `formVide` pour accepter un défaut**

Modifier la signature de `formVide` (ligne 40) : ajouter le paramètre `defaultDessinateurId = ""`.
Ajouter le champ `dessinateur_id` à l'objet retourné. **Ne pas toucher aux autres champs existants.**

```js
// Changer seulement :
// "const formVide = () => ({" → "const formVide = (defaultDessinateurId = "") => ({"
// Ajouter à la fin de l'objet, avant la parenthèse fermante :
// "dessinateur_id: defaultDessinateurId,"
```

Résultat attendu :
```js
const formVide = (defaultDessinateurId = "") => ({
  utilisateur_id: profil.id,
  nom_plan: "",
  client_nom: "", client_prenom: "", client_email: "", client_telephone: "",
  adresse1: "", adresse2: "", code_postal: "", ville: "",
  delai: "", plans: [planVide()], fichiersPlan: [], logoClient: [], instructions: "",
  dessinateur_id: defaultDessinateurId,  // ← seul ajout
});
```

- [ ] **Step 3 : Charger les dessinateurs dans `chargerTout`**

Dans `chargerTout()`, modifier la ligne 96-99 pour ajouter la requête :

```js
const [{ data: cmd }, { data: ver }, { data: sub }, { data: dessinateurs }] = await Promise.all([
  supabase.from("commandes").select("*, messages(*)").order("created_at", { ascending: false }),
  supabase.from("versions").select("*").order("numero", { ascending: true }),
  supabase.from("profiles").select("id, prenom, nom").eq("master_id", profil.id),
  supabase
    .from("utilisateur_dessinateurs")
    .select("dessinateur_id, is_default, profiles:dessinateur_id(prenom, nom)")
    .eq("utilisateur_id", profil.id),
]);
```

Puis, après `if (sub) setSousComptes(sub);`, ajouter :

```js
if (dessinateurs) {
  const liste = dessinateurs.map(d => ({
    id: d.dessinateur_id,
    prenom: d.profiles?.prenom || "",
    nom: d.profiles?.nom || "",
    is_default: d.is_default,
  }));
  setDessinateursDispos(liste);
  const defaultId = liste.find(d => d.is_default)?.id ?? liste[0]?.id ?? "";
  setForm(f => ({ ...f, dessinateur_id: defaultId }));
}
```

- [ ] **Step 4 : Mettre à jour `creerCommande` — insert + notification**

Dans `creerCommande()`, modifier l'objet inséré (lignes 119-130) pour ajouter les champs dessinateur :

```js
const dessinateurChoisi = dessinateursDispos.find(d => d.id === form.dessinateur_id);
const { data, error } = await supabase.from("commandes").insert([{
  ref,
  utilisateur_id: form.utilisateur_id,
  nom_plan: form.nom_plan,
  client_nom: form.client_nom, client_prenom: form.client_prenom,
  client_email: form.client_email, client_telephone: form.client_telephone,
  adresse1: form.adresse1, adresse2: form.adresse2,
  code_postal: form.code_postal, ville: form.ville,
  delai: form.delai, plans: form.plans,
  fichiers_plan: form.fichiersPlan, logo_client: form.logoClient,
  instructions: form.instructions,
  plans_finalises: [], statut: "En attente",
  dessinateur_id: form.dessinateur_id || null,
  dessinateur: dessinateurChoisi ? `${dessinateurChoisi.prenom} ${dessinateurChoisi.nom}` : null,
}]).select("*, messages(*)").single();
```

Modifier l'appel `notify-commande` (ligne ~152) :

```js
supabase.functions.invoke("notify-commande", {
  body: { utilisateur_id: form.utilisateur_id, nom_plan: form.nom_plan, ref, dessinateur_id: form.dessinateur_id },
});
```

- [ ] **Step 5 : Mettre à jour les resets du formulaire**

La ligne 157 (`setForm(formVide())` après création) :
```js
setForm(formVide(dessinateursDispos.find(d => d.is_default)?.id ?? ""));
```

La ligne 608 (`setForm(formVide())` à l'annulation) — même modification :
```js
onClick={() => { setShowForm(false); setForm(formVide(dessinateursDispos.find(d => d.is_default)?.id ?? "")); setSaveError(""); }}
```

- [ ] **Step 6 : Ajouter le champ dessinateur dans le formulaire**

Dans la zone "Détail du plan" du formulaire (après le champ "Délai souhaité", ligne ~583), ajouter **avant** le champ `délai` :

```jsx
<div style={{ marginBottom: 12 }}>
  <label style={labelStyle}>Dessinateur *</label>
  {dessinateursDispos.length === 0 ? (
    <div style={{ fontSize: 12, color: "#94A3B8", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#F9FAFB" }}>
      Aucun dessinateur disponible, contactez votre administrateur.
    </div>
  ) : (
    <select
      value={form.dessinateur_id}
      onChange={e => setForm({ ...form, dessinateur_id: e.target.value })}
      style={inputStyle}
    >
      <option value="">— Sélectionner un dessinateur —</option>
      {dessinateursDispos.map(d => (
        <option key={d.id} value={d.id}>{d.prenom} {d.nom}{d.is_default ? " (défaut)" : ""}</option>
      ))}
    </select>
  )}
</div>
```

- [ ] **Step 7 : Bloquer la soumission si aucun dessinateur sélectionné**

Modifier la ligne 609 (condition de désactivation du bouton "Créer la commande") pour ajouter `|| !form.dessinateur_id` :

```jsx
<button onClick={creerCommande}
  disabled={saving || !form.nom_plan || !form.delai || form.fichiersPlan.length === 0 || !form.dessinateur_id}
  style={{ padding: "9px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600,
    cursor: (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0 || !form.dessinateur_id) ? "not-allowed" : "pointer",
    background: (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0 || !form.dessinateur_id) ? "#F3F4F6" : "#122131",
    color: (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0 || !form.dessinateur_id) ? "#9CA3AF" : "#fff" }}>
  {saving ? "Enregistrement..." : "Créer la commande"}
</button>
```

- [ ] **Step 8 : Vérifier dans le navigateur**

- Ouvrir le formulaire "Nouvelle commande" en tant qu'utilisateur avec dessinateurs assignés
- Le champ dessinateur doit être pré-sélectionné avec le défaut
- Changer le dessinateur → le select se met à jour
- Soumettre → vérifier en DB que `dessinateur_id` et `dessinateur` sont bien renseignés dans `commandes`
- Tester avec un utilisateur sans dessinateur : le champ est désactivé, le bouton aussi

- [ ] **Step 9 : Commit**

```bash
git add src/components/VueUtilisateur.js
git commit -m "feat: sélection dessinateur obligatoire dans le formulaire de commande"
```

---

## Vérification finale

- [ ] Flux complet admin → utilisateur → commande fonctionne de bout en bout
- [ ] Un utilisateur sans dessinateur ne peut pas créer de commande
- [ ] Le changement de défaut dans "Mon compte" se reflète à l'ouverture du formulaire de commande
- [ ] La colonne "Dessinateur" dans GestionUtilisateurs affiche correctement "Nom + N autre(s)"
