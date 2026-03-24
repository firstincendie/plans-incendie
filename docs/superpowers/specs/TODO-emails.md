# TODO — Emails transactionnels

## Statut actuel (2026-03-24)

Les emails déclenchés par les Edge Functions (notify-commande, notify-message, notify-version, notify-inscription, notify-activation) **fonctionnent** via Resend HTTP API (`noreply@incendieplan.fr`, domaine vérifié).

Les **emails natifs Supabase Auth** (mot de passe oublié, confirmation email) **ne fonctionnent pas** — timeout 504 sur l'endpoint `/auth/v1/recover`.

## Problème

Supabase Auth utilise son propre SMTP (configuré dans Project Settings → Auth → SMTP) pour envoyer les emails système. Ce SMTP n'est pas configuré correctement → timeout 504.

## Solution (à appliquer)

Configurer Resend comme SMTP dans **Supabase Dashboard → Project Settings → Auth → SMTP Settings** :

| Champ | Valeur |
|---|---|
| Enable custom SMTP | activé |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | clé API Resend (même que `RESEND_API_KEY` dans les secrets Edge Functions) |
| Sender email | `noreply@incendieplan.fr` |
| Sender name | `First Incendie` |

Une fois configuré, tester :
1. "Mot de passe oublié" depuis la page de connexion
2. Vérifier que l'email de reset arrive bien
3. Vérifier que le lien de reset ouvre bien le formulaire `PageResetMotDePasse`

## Workaround actuel

Création de comptes manuellement via GestionUtilisateurs (Admin → Utilisateurs → Nouveau compte).
Reset de mot de passe manuellement via le bouton "Renvoyer reset mot de passe" dans la fiche utilisateur (Supabase Dashboard → Authentication → Users).
