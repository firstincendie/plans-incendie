# Grand Reset — Rôles, Commandes & Gestion Utilisateurs

**Date :** 2026-03-23
**Statut :** Approuvé
**Scope :** Réécriture complète de la logique des rôles, de l'authentification et des commandes dans l'app plans-incendie.

---

## Contexte

L'application actuelle souffre d'une logique de rôles emmêlée (couche sur couche) :
- Le rôle `admin` ne fonctionne pas correctement comme vue autonome
- Le `SwitcherBarre` de simulation (admin → dessinateur / client) ne fonctionne que pour des comptes `@test.com`
- Un vrai compte `dessinateur` ou `client` connecté ne voit pas les bonnes commandes
- Les commandes créées par un utilisateur n'apparaissent pas dans sa propre liste
- La logique de filtrage est basée sur des noms texte au lieu des UUID

**Décision : réécriture propre dans les mêmes fichiers, même stack React + Supabase.**

---

## 1. Modèle de données Supabase

### Table `profiles`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | = auth.uid() |
| `prenom` | text | |
| `nom` | text | |
| `email` | text | |
| `role` | text | `'utilisateur'` ou `'dessinateur'` |
| `statut` | text | `'en_attente'` / `'actif'` / `'refuse'` / `'bloque'` |
| `is_owner` | boolean | `true` uniquement pour contact@firstincendie.com |
| `dessinateur_id` | uuid \| null | FK vers `profiles.id` — rempli pour les utilisateurs uniquement |
| `avatar_url` | text \| null | |

**Colonnes de préférences email (boolean, `true` par défaut) :**

| Colonne | Rôle concerné | Description |
|---|---|---|
| `notif_nouvelle_commande` | dessinateur | Email quand une nouvelle commande lui est assignée |
| `notif_nouveau_message` | utilisateur + dessinateur | Email quand un nouveau message est posté dans une commande |
| `notif_nouvelle_version` | utilisateur | Email quand le dessinateur dépose une ébauche |

**Suppression :** colonne `master_id`, table `client_dessinateurs`.

---

### Table `commandes`

**Partie technique (invisible utilisateur) :**

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | auto |
| `ref` | text | CMD-001, auto-généré |
| `utilisateur_id` | uuid | FK vers `profiles.id` — lié au compte qui a créé la commande |
| `statut` | text | voir flux ci-dessous |
| `created_at` | timestamptz | auto |

**Partie "Client" (le client final de l'utilisateur) :**

| Colonne | Type | Notes |
|---|---|---|
| `nom_plan` | text | Nom du plan — identifiant principal, vu par utilisateur ET dessinateur |
| `client_nom` | text | Nom du client final |
| `client_prenom` | text | |
| `client_email` | text | |
| `client_telephone` | text | |
| `adresse1` | text | |
| `adresse2` | text | |
| `code_postal` | text | |
| `ville` | text | |

**Partie "Plan" :**

| Colonne | Type | Notes |
|---|---|---|
| `delai` | date | Date souhaitée |
| `plans` | jsonb | Tableau des plans à réaliser |
| `fichiers_plan` | jsonb | Fichiers joints par l'utilisateur |
| `logo_client` | jsonb | Logo |
| `instructions` | text | Instructions pour le dessinateur |
| `plans_finalises` | jsonb | Fichiers déposés par le dessinateur |

**Suppression :** colonne `client` (texte libre), colonne `batiment`, colonne `dessinateur` (texte libre).

---

### Tables `versions` et `messages`

Inchangées.

---

### RLS Supabase

- **Utilisateur** : voit uniquement ses commandes (`utilisateur_id = auth.uid()`)
- **Dessinateur** : voit les commandes des utilisateurs dont `dessinateur_id = auth.uid()` (via join sur profiles)
- **is_owner** : voit tout (policy bypass)

---

## 2. Flux de statuts des commandes

```
En attente
  → [Dessinateur clique "Commencer"] → Commencé
  → [Dessinateur dépose une version] → Ébauche déposée
  → [Utilisateur demande modif] → Modification dessinateur
  → [Ébauche déposée à nouveau] → Ébauche déposée
  → [Utilisateur valide] → Validé
```

Le statut évolue **uniquement via des actions contextuelles**, jamais via un dropdown manuel.

---

## 3. Architecture de l'app (App.js)

### Routing par rôle

```
session === undefined     → Chargement...
!session                  → PageConnexion / PageInscription / PageMotDePasseOublie
profil.statut = en_attente → Page "Compte en attente de validation"
profil.statut = refuse     → Page "Accès refusé"
profil.statut = bloque     → Page "Compte bloqué"
profil.role = dessinateur  → VueDessinateur
profil.role = utilisateur  → VueUtilisateur
```

**Suppression :** `modeVue`, `SwitcherBarre`, `profilesDessinateurs`, `profilesClients`, `chargerProfilesPreview`, `dessinateurSelectionne`, `clientSelectionne`.

---

### Chargement des commandes

- **Utilisateur** : `supabase.from('commandes').select('*, messages(*)').eq('utilisateur_id', session.user.id)`
- **Dessinateur** : `supabase.from('commandes').select('*, messages(*), profiles!utilisateur_id(dessinateur_id)').eq('profiles.dessinateur_id', session.user.id)` (via RLS ou filtre explicite)
- **is_owner** : toutes les commandes

Chaque rôle charge **uniquement ce qui le concerne** — plus de chargement global filtré côté client.

---

## 4. VueUtilisateur

**Sidebar :** Commandes / Réglages / Mon compte / [Utilisateurs si is_owner]

**Onglet Commandes :**
- Liste des commandes filtrées par `utilisateur_id`
- Stats : en cours / validées / total
- Bouton "+ Nouvelle commande"

**Formulaire Nouvelle commande — Partie Client :**
- Dropdown `utilisateur_id` : utilisateur connecté par défaut, sous-comptes si existants
- Nom du plan * (champ texte, identifiant principal)
- Nom / Prénom / Email / Téléphone du client final
- Adresse 1 / Adresse 2 / Code postal / Ville

**Formulaire Nouvelle commande — Partie Plan :**
- Délai souhaité * (date)
- Plans à réaliser (tableau)
- Fichiers du plan (upload)
- Logo client (upload)
- Instructions pour le dessinateur (textarea)

---

## 5. VueDessinateur

**Sidebar :** Mes missions / Réglages / Mon compte

**Onglet Missions :**
- Liste des commandes des utilisateurs assignés (`dessinateur_id = moi`)
- Filtres par statut
- Panneau détail avec actions contextuelles :
  - Si `En attente` → bouton "Commencer"
  - Si `Commencé` ou `Modification dessinateur` → formulaire dépôt de version → déclenche `Ébauche déposée`
  - Messagerie toujours disponible (sauf si `Validé`)

---

## 6. Section Utilisateurs (is_owner uniquement)

Accessible depuis la sidebar VueUtilisateur si `profil.is_owner === true`.

**Liste de tous les comptes avec :**
- Nom, prénom, email, rôle, statut, dessinateur assigné
- Actions inline selon statut :
  - `en_attente` → boutons **Activer** / **Refuser**
  - `actif` → bouton **Bloquer**
  - `refuse` / `bloque` → bouton **Réactiver**

**Actions complètes sur un compte (panneau détail) :**
- Modifier : nom, prénom, email, rôle, statut, is_owner, dessinateur assigné
- Supprimer le compte (Supabase Auth + profil)
- Renvoyer un email de réinitialisation de mot de passe
- Créer un nouveau compte (invite par email via Supabase)

---

## 7. Emails

### Configuration SMTP (Supabase Dashboard → Authentication → SMTP)

- **Host :** `incendieplan.fr`
- **Port :** `465` (SSL/TLS)
- **Username :** `noreply@incendieplan.fr`
- **Password :** mot de passe du compte email
- **From :** `noreply@incendieplan.fr`

### Emails automatiques Supabase (aucun code nécessaire)

| Déclencheur | Destinataire |
|---|---|
| Reset mot de passe | Utilisateur demandeur |
| Confirmation email à l'inscription | Nouvel inscrit |

### Emails métier (Supabase Edge Functions)

Emails **toujours envoyés**, sans préférence utilisateur :

| Déclencheur | Destinataire |
|---|---|
| Nouvelle inscription (compte en_attente) | `contact@firstincendie.com` |
| Compte activé | L'utilisateur concerné |
| Compte refusé | L'utilisateur concerné |
| Compte bloqué | L'utilisateur concerné |

Emails **optionnels**, contrôlés par les préférences dans Réglages :

| Déclencheur | Destinataire | Préférence |
|---|---|---|
| Nouvelle commande créée | Dessinateur assigné | `notif_nouvelle_commande` |
| Nouveau message dans une commande | Autre partie | `notif_nouveau_message` |
| Ébauche déposée par le dessinateur | Utilisateur | `notif_nouvelle_version` |

### Page Réglages

Section **Notifications email** avec toggles (on/off) pour chaque préférence applicable au rôle connecté. Les préférences sont sauvegardées dans `profiles`.

---

## 8. Composants existants réutilisés sans modification

- `Badge` — badges de statut
- `Messagerie` — chat commande
- `HistoriqueVersions` — historique des versions
- `ZoneUpload` — upload fichiers
- `BarreFiltres` — filtres + tri
- `TableauPlans` — tableau des plans
- `BlocAdresse` — affichage adresse
- `ChampCopiable` — copie presse-papier
- `PageReglages` — réglages compte
- `PageMonCompte` — mon compte
- `PageConnexion`, `PageInscription`, `PageMotDePasseOublie` — auth

---

## 9. Fichiers à réécrire

| Fichier | Action |
|---|---|
| `App.js` | Réécriture complète |
| `VueDessinateur.js` | Réécriture (logique rôle + statuts par actions) |
| `VueClient.js` | Renommer en `VueUtilisateur.js` + réécriture |
| `GestionUtilisateurs.js` | Réécriture complète (section is_owner) |
| `GestionCompteDessinateur.js` | Supprimer ou intégrer dans VueDessinateur |

---

## 10. Migrations Supabase nécessaires

1. Ajouter `is_owner` (boolean, default false) sur `profiles`
2. Ajouter `dessinateur_id` (uuid, nullable, FK profiles) sur `profiles`
3. Ajouter colonnes `nom_plan`, `client_nom`, `client_prenom`, `client_email`, `client_telephone`, `instructions` sur `commandes`
4. Renommer `commandes.client` → conserver temporairement pour migration, puis supprimer
5. Supprimer `commandes.batiment`, `commandes.dessinateur` (texte)
6. Supprimer table `client_dessinateurs`
7. Supprimer colonne `profiles.master_id`
8. Configurer RLS sur `commandes` et `profiles`
9. Ajouter colonnes `notif_nouvelle_commande`, `notif_nouveau_message`, `notif_nouvelle_version` (boolean, default true) sur `profiles`
10. Passer `contact@firstincendie.com` en `is_owner = true` manuellement
11. Configurer SMTP dans Supabase Dashboard (host: incendieplan.fr, port: 465, user: noreply@incendieplan.fr)
12. Créer les Edge Functions pour les emails métier
