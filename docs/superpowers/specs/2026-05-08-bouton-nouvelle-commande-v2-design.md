# Bouton « Nouvelle commande » — port V1 → V2 routing

**Date :** 2026-05-08
**Statut :** approuvé en chat par Simon

## Contexte

Le bouton « Nouvelle commande » et son formulaire ont été supprimés au commit `c084612 chore(v2): remove obsolete VueUtilisateur and VueDessinateur` lors de la refonte V2 de routage par URL. Il faut les restaurer.

## Objectif

Port 1:1 du formulaire V1 (`creerCommande` + JSX du modal `showForm` de `VueUtilisateur.js`), recâblé sur l'architecture V2 par routes.

## Architecture

- **Composant :** `src/components/NouvelleCommandeModal.js` (nouveau)
- **Route :** `/commandes/nouvelle` ajoutée comme route enfant de `/commandes` dans `AppRouter.js`, sibling de `/commandes/:ref`. React Router 7 priorise les paths statiques sur les dynamiques → pas de conflit avec `:ref`.
- **Bouton :** ajouté dans le header de `ListeCommandes.js`, à droite du `<h1>Commandes</h1>`. Visible si `profil.role !== "dessinateur"`.

## Flow

1. Clic bouton → `navigate("/commandes/nouvelle")` → modale rendue par-dessus la liste via `<Outlet>`.
2. `useEffect` initial : fetch `utilisateur_dessinateurs` pour peupler le dropdown dessinateur, présélection du `is_default`.
3. Validation submit : `nom_plan && delai && fichiersPlan.length > 0 && dessinateur_id` (identique V1).
4. Submit → `INSERT INTO commandes (...)` **sans `ref`** (le trigger DB `fill_commande_ref` génère atomiquement).
5. Si `instructions` non vides → `INSERT INTO messages (...)` pour le premier message (identique V1).
6. `supabase.functions.invoke("notify-commande", ...)` (identique V1).
7. `setCommandes(prev => [nouvelleCommande, ...prev])` via `useOutletContext`.
8. `navigate("/commandes", { replace: true })` pour fermer.

## Champs

| Section | Champ | Required |
|---|---|---|
| Client | utilisateur_id (sous-compte) | défaut = profil.id |
| Client | nom_plan | ✓ |
| Client | client_prenom, client_nom, client_email, client_telephone | – |
| Client | adresse1, adresse2, code_postal, ville | – |
| Plan | dessinateur_id | ✓ |
| Plan | delai | ✓ |
| Plan | plans (TableauPlans) | – (default `[planVide()]`) |
| Plan | fichiersPlan (ZoneUpload) | ✓ |
| Plan | logoClient (ZoneUpload, unique) | – |
| Plan | instructions (textarea) | – |

Styles `inputStyle` / `labelStyle` repris tels quels de V1.

## Permissions

- Bouton : visible si `role !== "dessinateur"`.
- Route : pas de garde supplémentaire — les dessinateurs n'ont pas le bouton ; s'ils tapent l'URL directement, on s'en fiche (la modale s'affichera mais l'INSERT serait bloqué par RLS Supabase si configurée — hors scope de ce spec).

## Différences vs V1 (uniquement nécessaires)

1. **State source :** `useOutletContext()` pour `commandes/setCommandes/profil/session/sousComptes` au lieu d'un state local sibling.
2. **Pas de génération `ref` côté client :** retiré ; le trigger Postgres `fill_commande_ref` (posé dans la migration `commandes_ref_unique_and_auto_generation`) le remplit.
3. **Ouverture/fermeture par URL :** `useNavigate()` au lieu d'un boolean `showForm`.
4. **Composant isolé :** plus de logique inline dans `VueUtilisateur` (qui n'existe plus) ; tout dans `NouvelleCommandeModal.js`.

## Hors scope

- Pas de refonte UX du formulaire.
- Pas de changement du schéma DB.
- Pas de modifs à `notify-commande` ni aux RLS.
- Pas d'amélioration de la validation (e.g. masques téléphone) — strictement V1.

## Test plan

1. Logué en utilisateur ou admin (`role !== "dessinateur"`) :
   - Le bouton « + Nouvelle commande » apparaît dans le header de `/commandes`.
   - Clic → URL devient `/commandes/nouvelle`, modale s'ouvre.
   - Submit avec champs requis remplis → commande créée, `ref` auto-généré (CMD-NNN), notification envoyée, retour sur `/commandes`.
   - Annuler → retour sur `/commandes`, pas de commande créée.
2. Logué en dessinateur : bouton invisible.
3. F5 sur `/commandes/nouvelle` : modale ré-affichée (grâce au `_redirects` SPA fallback déjà en place).
