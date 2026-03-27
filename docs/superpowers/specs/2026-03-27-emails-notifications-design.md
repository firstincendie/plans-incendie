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

> **Note :** Le statut "Validé" est déclenché par l'utilisateur lui-même (validation des plans finaux). Aucun email de confirmation à l'utilisateur n'est nécessaire à cette étape — l'action est volontaire. L'email "Commande terminée" va uniquement au dessinateur.

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

> **Note :** La sélection `profiles` dans App.js utilise `select("*")` — les nouvelles colonnes seront automatiquement disponibles dans `profil` sans modifier le fetch.

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
1. Récupérer la commande (`utilisateur_id`, `dessinateur_id`, `nom_plan`, `ref`) depuis `commandes`
2. Selon l'event, récupérer le(s) profil(s) destinataire(s) avec leur email, prénom, et colonne de préférence
3. Si préférence !== false → appeler `send-email`
4. Si `dessinateur_id` est null pour un event ciblant le dessinateur → skip silencieux pour la partie dessinateur uniquement. Pour l'event `validation_en_cours` (double destinataire), la notification utilisateur s'envoie quand même si `dessinateur_id` est null.
5. **Toujours transmettre le header `Authorization` reçu lors de l'appel interne à `send-email`**, comme dans toutes les autres fonctions existantes.

### `notify-commande` (modification mineure)

Après l'envoi existant au dessinateur, ajouter l'envoi d'une confirmation à l'utilisateur créateur si `notif_commande_creee !== false`.

**Important :** `utilisateur_id` est déjà présent dans le payload reçu par la fonction (il est passé depuis le frontend). Utiliser directement cet `utilisateur_id` pour lookup dans `profiles` — aucune jointure sur `commandes` n'est nécessaire.

---

## Déclencheurs dans le code frontend

### `VueUtilisateur.js`

Les appels à `notify-statut` doivent être placés dans les **fonctions d'action nommées**, pas dans la fonction utilitaire générique `changerStatut`. Ce pattern est cohérent avec l'existant (ex: `notify-message` est appelé dans `envoyerMessage`, pas dans un setter générique).

| Fonction d'action | Appel à ajouter |
|---|---|
| `creerCommande` (après insert réussi) | `notify-commande` — déjà invoqué, mais la function doit être étendue pour notifier aussi l'utilisateur |
| `envoyerDemandeModification` (statut → "Modification dessinateur") | `notify-statut` event=`modification`, `commande_id: selected.id` |
| `demanderValidation` (statut → "Validation en cours") | `notify-statut` event=`validation_en_cours`, `commande_id: selected.id` |
| `validerCommande` (statut → "Validé") | `notify-statut` event=`termine`, `commande_id: selected.id` |

### `VueDessinateur.js`

| Fonction d'action | Appel à ajouter |
|---|---|
| `commencer(id)` (statut → "Commencé") | `notify-statut` event=`commencé`, `commande_id: id` — utiliser le paramètre `id` de la fonction, pas `selected.id` |
| Dépôt dernier plan final | `notify-statut` event=`plans_finaux`, `commande_id: selected.id` — appel à placer **dans le bloc `if (nouveaux.length === selected.plans.length)` existant** dans `deposerPlanFinal` |

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

1. Migration DB (colonnes `profiles`) via Supabase MCP
2. Edge Function `notify-statut` (nouvelle)
3. Modification `notify-commande` (ajout confirmation utilisateur)
4. Déclencheurs dans `VueUtilisateur.js`
5. Déclencheurs dans `VueDessinateur.js`
6. Mise à jour `PageReglages.js`
7. Fix Supabase Dashboard (Redirect URLs) — manuel
