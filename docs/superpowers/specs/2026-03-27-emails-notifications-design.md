# Design : Système d'emails et notifications

**Date :** 2026-03-27
**Statut :** Approuvé

---

## Contexte

L'application First Incendie (incendieplan.fr) est une app React + Supabase de gestion de commandes de plans d'incendie. Les acteurs sont : admin, dessinateur, utilisateur (client).

Il existe déjà un système d'emails partiel via des Edge Functions Supabase qui appellent l'API Resend. Certains emails fonctionnent, d'autres manquent ou ne sont pas encore déclenchés.

---

## Flux des statuts de commande

```
En attente → Commencé → Ébauche déposée ⇄ Modification dessinateur
                                ↓
                        Validation en cours  (utilisateur valide l'ébauche)
                                ↓
                          (dépôt plans finaux par dessinateur)
                                ↓
                             Validé          (utilisateur valide les plans finaux)
```

---

## Emails à implémenter

### Existants — à conserver sans modification

| Email | Déclencheur | Fonction |
|---|---|---|
| Confirm your signup | Supabase Auth natif | — |
| Votre accès First Incendie | Admin active le compte | `notify-activation` |
| Compte banni / refusé | Admin change le statut | `notify-activation` |
| Nouveau message | Envoi message dans Messagerie | `notify-message` |
| Ébauche déposée | Dessinateur dépose une version | `notify-version` |
| Nouvelle commande assignée (dessinateur) | Création commande | `notify-commande` |

### Nouveaux emails — à implémenter

| Email | Destinataire | Déclencheur | Préférence |
|---|---|---|---|
| Commande créée (confirmation) | Utilisateur | Création commande | `notif_commande_creee` |
| Commande acceptée par le dessinateur | Utilisateur | Statut → Commencé | `notif_commande_acceptee` |
| Commande validée | Utilisateur | Statut → Validation en cours | `notif_commande_validee` |
| Plans finaux déposés | Utilisateur | Tous les plans finaux déposés | `notif_plans_finaux` |
| Demande de modification | Dessinateur | Statut → Modification dessinateur | `notif_demande_modification` |
| Ébauche validée — en attente de dépôt final | Dessinateur | Statut → Validation en cours | `notif_validation_en_cours` |
| Commande terminée | Dessinateur | Statut → Validé | `notif_commande_terminee` |

---

## Fix — Lien "Confirm your signup"

Le lien dans l'email de confirmation pointe vers `custkyapdbvzkuxgurla.supabase.co` au lieu de `incendieplan.fr`. Fix : Supabase Dashboard > Auth > URL Configuration > ajouter `https://incendieplan.fr/**` dans les Redirect URLs. Pas de changement de code.

---

## Base de données

### Nouvelles colonnes dans `profiles`

```sql
-- Pour les utilisateurs
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_commande_creee       boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_commande_acceptee    boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_commande_validee     boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_plans_finaux         boolean DEFAULT true;

-- Pour les dessinateurs
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_demande_modification  boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_validation_en_cours   boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_commande_terminee     boolean DEFAULT true;
```

Colonnes existantes conservées : `notif_nouvelle_commande`, `notif_nouveau_message`, `notif_nouvelle_version`.

---

## Edge Functions

### `notify-statut` (nouvelle)

**Entrée :** `{ commande_id: string, event: string }`

**Events supportés :**

| event | Destinataire | Préférence vérifiée |
|---|---|---|
| `commencé` | Utilisateur | `notif_commande_acceptee` |
| `modification` | Dessinateur | `notif_demande_modification` |
| `validation_en_cours` | Utilisateur + Dessinateur | `notif_commande_validee` / `notif_validation_en_cours` |
| `plans_finaux` | Utilisateur | `notif_plans_finaux` |
| `termine` | Dessinateur | `notif_commande_terminee` |

**Logique :**
1. Récupérer la commande (`utilisateur_id`, `dessinateur_id`, `nom_plan`, `ref`)
2. Selon l'event, récupérer le(s) profil(s) destinataire(s) avec leur email, prénom, et colonne de préférence
3. Si préférence !== false → appeler `send-email`
4. Si `dessinateur_id` est null pour un event dessinateur → skip silencieux

### `notify-commande` (modification mineure)

Après l'envoi existant au dessinateur, ajouter l'envoi d'une confirmation à l'utilisateur créateur si `notif_commande_creee !== false`.

La commande contient `utilisateur_id` — récupérer l'email et le prénom depuis `profiles`.

---

## Déclencheurs dans le code frontend

### `VueUtilisateur.js`

| Action utilisateur | Appel à ajouter |
|---|---|
| Création commande (après insert) | `notify-commande` reçoit déjà `utilisateur_id` — modifier la function |
| Demande de modification (changerStatut → "Modification dessinateur") | `notify-statut` event=`modification` |
| Valider l'ébauche (changerStatut → "Validation en cours") | `notify-statut` event=`validation_en_cours` |
| Valider les plans finaux (changerStatut → "Validé") | `notify-statut` event=`termine` |

### `VueDessinateur.js`

| Action dessinateur | Appel à ajouter |
|---|---|
| Accepter la commande (statut → "Commencé") | `notify-statut` event=`commencé` |
| Dépôt dernier plan final (tous déposés) | `notify-statut` event=`plans_finaux` |

---

## PageReglages.js

Section "Notifications email" mise à jour par rôle.

### Dessinateur
- Nouvelle commande assignée (`notif_nouvelle_commande`) — existant
- Demande de modification (`notif_demande_modification`) — nouveau
- Ébauche validée — en attente de dépôt final (`notif_validation_en_cours`) — nouveau
- Commande terminée (`notif_commande_terminee`) — nouveau
- Nouveau message (`notif_nouveau_message`) — existant

### Utilisateur
- Commande créée (confirmation) (`notif_commande_creee`) — nouveau
- Commande acceptée par le dessinateur (`notif_commande_acceptee`) — nouveau
- Ébauche déposée (`notif_nouvelle_version`) — existant
- Commande validée (`notif_commande_validee`) — nouveau
- Plans finaux déposés (`notif_plans_finaux`) — nouveau
- Nouveau message (`notif_nouveau_message`) — existant

### Admin
Pas de section notifications.

---

## Ordre d'implémentation

1. Migration DB (colonnes `profiles`)
2. Edge Function `notify-statut`
3. Modification `notify-commande` (ajout confirmation utilisateur)
4. Déclencheurs dans `VueUtilisateur.js`
5. Déclencheurs dans `VueDessinateur.js`
6. Mise à jour `PageReglages.js`
7. Fix Supabase Dashboard (Redirect URLs)
