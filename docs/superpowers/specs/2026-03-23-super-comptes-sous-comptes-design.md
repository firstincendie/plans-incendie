# Design : Super Comptes & Sous-Comptes

**Date :** 2026-03-23
**Statut :** Approuvé

---

## Objectif

Introduire une hiérarchie à un niveau entre comptes : tout utilisateur peut générer un code d'invitation et devenir "super" dès qu'il a au moins un sous-compte rattaché. Les supers ont une vue agrégée des commandes de leurs sous-comptes. La vue commandes des users devient identique à celle de l'admin (filtrée sur leurs propres commandes). Les dessinateurs reçoivent un onglet "Gestion de compte" pour les notes clients et la gestion de sous-comptes.

---

## Section 1 : Modèle de données

### Contexte existant

Table `client_dessinateurs` (déjà en place) : relation M:N entre clients et dessinateurs.
```
client_dessinateurs: id, client_id (FK profiles), dessinateur_id (FK profiles)
```
Utilisée dans `GestionUtilisateurs.js` pour assigner des dessinateurs aux clients.

### Modifications table `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN master_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN invite_code text UNIQUE;
```

La règle "1 niveau max" (un sous-compte ne peut pas être maître) est enforced par un trigger — PostgreSQL n'autorise pas les sous-requêtes dans les CHECK constraints :

```sql
CREATE OR REPLACE FUNCTION check_no_nested_master()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.master_id IS NOT NULL THEN
    -- Le maître désigné ne doit pas lui-même avoir un maître
    IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.master_id AND master_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Le maître désigné est déjà sous-compte d''un autre maître.';
    END IF;
    -- Le sous-compte ne doit pas déjà être maître de quelqu'un
    IF EXISTS (SELECT 1 FROM profiles WHERE master_id = NEW.id) THEN
      RAISE EXCEPTION 'Ce compte a déjà des sous-comptes et ne peut pas rejoindre un maître.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_nested_master
  BEFORE INSERT OR UPDATE OF master_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION check_no_nested_master();
```

- `invite_code` : généré automatiquement à la création du compte via trigger (voir ci-dessous).
- `master_id` : nullable. Pointe vers le profil du maître.
- Le statut "super" est **dérivé**, pas stocké : un compte est super si `EXISTS (SELECT 1 FROM profiles WHERE master_id = mon_id)`.

### Trigger génération invite_code

```sql
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invite_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.invite_code IS NULL)
  EXECUTE FUNCTION generate_invite_code();
```

Les profils existants reçoivent leur code via :
```sql
UPDATE profiles
SET invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code IS NULL;
```

### Nouvelle table `notes_clients`

```sql
CREATE TABLE notes_clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dessinateur_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_nom      text NOT NULL,
  note            text NOT NULL DEFAULT '',
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (dessinateur_id, client_nom)
);
```

Upsert applicatif : `INSERT ... ON CONFLICT (dessinateur_id, client_nom) DO UPDATE SET note = ..., updated_at = now()`.

---

## Section 2 : Système d'invitation

### Génération du code

- Chaque profil reçoit un `invite_code` unique à sa création (trigger SQL, Section 1).
- Affiché dans **Mon compte** de tous les utilisateurs : champ "Code d'invitation" avec bouton copier.

### Rattachement (sous-compte → maître)

Dans **Mon compte** du sous-compte :

```
Rejoindre un compte maître
[________________] [Rejoindre]
```

Logique front :
1. Cherche `profiles WHERE invite_code = code_saisi AND role = profil.role`. Le filtrage par rôle garantit qu'un client ne peut rejoindre qu'un super utilisateur, et un dessinateur qu'un super dessinateur — pour maintenir la cohérence des vues et des filtres commandes.
2. Vérifie que le maître trouvé n'est pas lui-même sous-compte (`master_id IS NULL`).
3. Vérifie que le sous-compte n'est pas déjà maître de quelqu'un (`NOT EXISTS sous-compte de moi`).
4. Si OK : `UPDATE profiles SET master_id = maître.id WHERE id = mon_id`.
5. Affiche confirmation. Bouton "Quitter le groupe" → `SET master_id = null`.

### Côté admin (GestionUtilisateurs)

- Colonne "Maître" dans le tableau : affiche `prenom nom` du maître ou "—".
- Bouton "Détacher" pour retirer le `master_id`.

---

## Section 3 : Vues commandes

### Stratégie de filtre (important)

`commandes.client` est un champ `text` contenant le nom complet (`prenom nom`). Il n'y a pas de `user_id` sur `commandes`. Le filtre se fait donc par correspondance de noms :

```js
// Nom complet du profil
const nomComplet = (p) => `${p.prenom} ${p.nom}`;

// Pour un user régulier
const mesCommandes = commandes.filter(c => c.client === nomComplet(profil));

// Pour un super : soi + sous-comptes
const nomsVisibles = [profil, ...sousComptes].map(nomComplet);
const mesCommandes = commandes.filter(c => nomsVisibles.includes(c.client));
```

Les `sousComptes` sont chargés depuis Supabase : `profiles WHERE master_id = profil.id`.

### Utilisateur régulier

Interface **identique à l'admin** : stats (3 cartes), `BarreFiltres`, `+ Nouvelle commande`, panneau détail complet (messagerie, fichiers, historique versions, boutons modifier/valider).

### Super utilisateur / Super dessinateur

Même interface, filtre étendu aux sous-comptes. Colonne supplémentaire **"User"** (ou "Dessinateur") dans le tableau, avec filtre déroulant pour isoler un sous-compte. Stats recalculées sur le périmètre filtré.

---

## Section 4 : Gestion de compte (dessinateur)

Nouvel onglet **"Gestion de compte"** dans la sidebar de `VueDessinateur.js`, rendu via un composant dédié `GestionCompteDessinateur.js` (pattern identique à `PageReglages` rendu via `{vue === "gestion-compte" && <GestionCompteDessinateur ... />}`).

### Sous-onglet : Sous-comptes

Visible uniquement si le dessinateur a des sous-comptes. La liste de sous-comptes est rechargée depuis Supabase à l'ouverture de l'onglet pour refléter les rattachements récents sans nécessiter un rechargement de page.

- Liste des sous-dessinateurs avec statut
- Pour chaque sous-dessinateur : users assignés via `client_dessinateurs`
- Bouton "Assigner un user" → dropdown → `INSERT INTO client_dessinateurs`
- Lecture seule pour les comptes — pas de création, pas de suppression

### Sous-onglet : Notes clients

- Liste des clients tirée des commandes du dessinateur (déduplication par `c.dessinateur === nomDessinateur`)
- Clic sur un client → zone texte éditable, sauvegarde auto (upsert `notes_clients`)
- Dans le panneau détail commande : icône 📝 à côté du nom client si note existe → clic affiche la note
- La note n'est **jamais visible** côté client (VueClient) pour éviter toute fuite de données

---

## Section 5 : Modifications UI

### Bouton déconnexion (user + dessinateur)

Même pattern que l'admin : menu profil en bas à gauche de la sidebar avec nom + rôle, clic → menu → "Se déconnecter".

À ajouter dans : `VueDessinateur.js` (sidebar existante) et dans la vraie vue client dans `App.js` (sidebar du role client).

### "Dessinateur assigné" dans Mon compte (user)

La liaison dessinateur↔client est stockée dans `client_dessinateurs`. Pour afficher le dessinateur assigné dans Mon compte d'un user :

```js
// Chargé dans App.js et passé en prop à PageMonCompte
// .limit(1) car un client peut théoriquement avoir plusieurs dessinateurs (M:N),
// on affiche le premier assigné.
const { data } = await supabase
  .from("client_dessinateurs")
  .select("dessinateur_id, profiles!dessinateur_id(prenom, nom)")
  .eq("client_id", profil.id)
  .limit(1)
  .maybeSingle();
const dessinateurAssigne = data ? `${data.profiles.prenom} ${data.profiles.nom}` : "—";
```

Affiché en read-only dans `PageMonCompte` quand `role === "client"` (section identique visuellement à celle d'admin).

### Code d'invitation (tous les comptes)

Section ajoutée dans `PageMonCompte` :

```
Mon code d'invitation : [A3F7K2M9]  [Copier]

Rejoindre un compte maître
[________________] [Rejoindre]   (si pas déjà rattaché)

Compte maître : Prénom Nom  [Quitter]   (si rattaché)
```

---

## Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `supabase/migrations/YYYYMMDD_super_comptes.sql` | `master_id`, `invite_code`, trigger génération code, table `notes_clients`, mise à jour profils existants |
| `src/App.js` | Chargement sous-comptes du profil connecté, adaptation filtre commandes selon rôle/super, sidebar client (logout) |
| `src/components/VueDessinateur.js` | Onglet "Gestion de compte", logout sidebar |
| `src/components/VueClient.js` | Interface commandes complète (stats + filtres + nouvelle commande + panneau détail), logout |
| `src/components/PageMonCompte.js` | Code invitation (affichage + copie), champ "Rejoindre un maître" / "Quitter", "Dessinateur assigné" (client) |
| `src/components/GestionUtilisateurs.js` | Colonne "Maître", bouton "Détacher" |
| `src/components/GestionCompteDessinateur.js` | Nouveau composant — sous-comptes + notes clients |
