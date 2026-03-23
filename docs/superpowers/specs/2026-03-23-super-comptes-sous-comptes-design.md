# Design : Super Comptes & Sous-Comptes

**Date :** 2026-03-23
**Statut :** Approuvé

---

## Objectif

Introduire une hiérarchie à un niveau entre comptes : tout utilisateur peut générer un code d'invitation et devenir "super" dès qu'il a au moins un sous-compte rattaché. Les supers ont une vue agrégée des commandes de leurs sous-comptes. La vue commandes des users devient identique à celle de l'admin (filtrée sur leurs propres commandes). Les dessinateurs reçoivent un onglet "Gestion de compte" pour les notes clients et la gestion de sous-comptes.

---

## Section 1 : Modèle de données

### Modifications table `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN master_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN invite_code text UNIQUE;
```

- `invite_code` : généré automatiquement à la création du compte (8 caractères alphanumériques majuscules, ex. `A3F7K2M9`). Stocké via trigger Supabase sur `INSERT INTO profiles`.
- `master_id` : nullable. Pointe vers le profil du maître. Contrainte : un compte avec `master_id IS NOT NULL` ne peut pas lui-même être le maître d'un autre (1 niveau max, enforced à l'application).
- Le statut "super" est **dérivé**, pas stocké : un compte est super si `EXISTS (SELECT 1 FROM profiles WHERE master_id = mon_id)`.

### Nouvelle table `notes_clients`

```sql
CREATE TABLE notes_clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dessinateur_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_nom      text NOT NULL,
  note            text NOT NULL DEFAULT '',
  updated_at      timestamptz DEFAULT now()
);
```

Contrainte unique sur `(dessinateur_id, client_nom)` — une seule note par couple dessinateur/client.

---

## Section 2 : Système d'invitation

### Génération du code

- Chaque profil reçoit un `invite_code` unique à sa création (trigger SQL).
- Affiché dans **Mon compte** de tous les utilisateurs : champ "Code d'invitation" avec bouton copier.

### Rattachement (sous-compte → maître)

Dans **Mon compte** du sous-compte :

```
Rejoindre un compte maître
[________________] [Rejoindre]
```

Logique :
1. Cherche un profil avec `invite_code = code_saisi` et `role = profil.role` (même rôle uniquement — client vers client, dessinateur vers dessinateur).
2. Vérifie que le maître trouvé n'est pas lui-même sous-compte (`master_id IS NULL`).
3. Vérifie que le sous-compte n'est pas déjà maître de quelqu'un.
4. Si OK : `UPDATE profiles SET master_id = maître.id WHERE id = mon_id`.
5. Affiche confirmation. Bouton "Quitter le groupe" pour se détacher (`SET master_id = null`).

### Côté admin (GestionUtilisateurs)

- Colonne "Maître" dans le tableau des utilisateurs (affiche `prenom nom` du maître ou "—").
- Possibilité de détacher manuellement un sous-compte.

---

## Section 3 : Vues commandes

### Utilisateur régulier

Interface **identique à l'admin** : stats, `BarreFiltres`, `+ Nouvelle commande`, panneau détail complet (messagerie, fichiers, historique versions, boutons modifier/valider).

Filtre appliqué : `commandes.user_id = session.user.id` (ou `client = profil.nom_complet` en attendant une migration vers user_id).

### Super utilisateur / Super dessinateur

Même interface que l'utilisateur régulier, mais le filtre inclut les sous-comptes :

```js
const idsVisibles = [profil.id, ...sousComptes.map(s => s.id)];
// commandes dont le client est dans idsVisibles
```

Colonne supplémentaire **"User"** (ou "Dessinateur") dans le tableau, avec filtre déroulant pour isoler un sous-compte.

Stats recalculées sur le périmètre visible.

---

## Section 4 : Gestion de compte (dessinateur)

Nouvel onglet dans la sidebar dessinateur, entre "Commandes" et "Réglages".

### Sous-onglet : Sous-comptes

Visible uniquement si le dessinateur a des sous-comptes (`master_id` de quelqu'un pointe vers lui).

- Liste des sous-dessinateurs avec statut
- Pour chaque sous-dessinateur : liste des users assignés
- Bouton "Assigner un user" → dropdown des users disponibles (users dont le dessinateur assigné est vide ou ce dessinateur)
- Lecture seule — pas de création, pas de suppression de compte

### Sous-onglet : Notes clients

- Liste des clients avec qui le dessinateur a des commandes (déduplication)
- Clic sur un client → zone texte éditable, sauvegarde automatique dans `notes_clients`
- Dans le panneau détail commande : icône 📝 à côté du nom client si une note existe — clic → affiche la note

---

## Section 5 : Modifications UI

### Bouton déconnexion (user + dessinateur)

Même pattern que l'admin : menu profil en bas à gauche de la sidebar.

```jsx
// Bas de la sidebar VueDessinateur et vue user réelle
<button onClick={() => supabase.auth.signOut()}>
  ↪ Se déconnecter
</button>
```

### "Dessinateur assigné" dans Mon compte (user)

Champ read-only ajouté dans `PageMonCompte` quand `role === "client"` :

```jsx
{role === "client" && (
  <div>
    <div>Dessinateur assigné</div>
    <div>{profil?.dessinateur_assigne || "—"}</div>
  </div>
)}
```

La valeur `dessinateur_assigne` est déduite de la dernière commande active du user, ou d'un champ direct sur `profiles` si besoin.

### Code d'invitation (tous les comptes)

Affiché dans Mon compte, section dédiée :

```
Mon code d'invitation : [A3F7K2M9]  [Copier]
```

---

## Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `supabase/migrations/` | Migration : `master_id`, `invite_code`, trigger génération code, table `notes_clients` |
| `src/App.js` | Chargement sous-comptes, adaptation filtre commandes selon rôle/super |
| `src/components/VueDessinateur.js` | Onglet "Gestion de compte", logout |
| `src/components/VueClient.js` | Interface commandes complète, logout, code invitation |
| `src/components/PageMonCompte.js` | Code invitation, champ "Rejoindre un maître", "Dessinateur assigné" (client) |
| `src/components/GestionUtilisateurs.js` | Colonne "Maître", détachement manuel |
| `src/components/GestionCompteDessinateur.js` | Nouveau composant |
| `src/components/NotesClients.js` | Nouveau composant |
