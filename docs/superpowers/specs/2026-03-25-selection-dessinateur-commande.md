# Spec : Sélection du dessinateur lors d'une commande

**Date :** 2026-03-25
**Statut :** Approuvé

## Contexte

Actuellement, quand un utilisateur crée une commande, aucun dessinateur n'est sélectionné — l'admin doit l'assigner manuellement après coup. L'admin peut déjà associer un dessinateur à un utilisateur via `profiles.dessinateur_id` (champ unique).

L'objectif est de permettre à l'admin d'assigner plusieurs dessinateurs à un utilisateur, à l'utilisateur de définir son dessinateur par défaut dans "Mon compte", et de pré-sélectionner ce dessinateur lors de la création d'une commande.

## Base de données

### Nouvelle table : `utilisateur_dessinateurs`

```sql
CREATE TABLE utilisateur_dessinateurs (
  utilisateur_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dessinateur_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (utilisateur_id, dessinateur_id)
);
```

### Migration des données existantes

Pour chaque profil ayant un `dessinateur_id` non nul, insérer une ligne dans `utilisateur_dessinateurs` avec `is_default = true`.

```sql
INSERT INTO utilisateur_dessinateurs (utilisateur_id, dessinateur_id, is_default)
SELECT id, dessinateur_id, true
FROM profiles
WHERE dessinateur_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

### Champ `profiles.dessinateur_id`

Conservé tel quel en base (migration non destructive). Non supprimé dans cette version. Il n'est plus mis à jour depuis l'UI (GestionUtilisateurs ne l'écrit plus).

### Table `commandes`

Aucun changement de schéma. Les champs `dessinateur` (texte) et `dessinateur_id` (UUID) déjà présents sont utilisés pour stocker le dessinateur choisi à la création.

### RPC Supabase pour sauvegarde atomique

Pour éviter un état incohérent lors de la sauvegarde (delete + insert sans transaction native en JS), une fonction PostgreSQL est créée. Elle vérifie que l'appelant est admin avant d'agir.

```sql
CREATE OR REPLACE FUNCTION set_dessinateurs_utilisateur(
  p_utilisateur_id UUID,
  p_dessinateurs JSONB  -- [{ dessinateur_id: UUID, is_default: boolean }]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Vérification que l'appelant est admin
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

Appelée côté client via `supabase.rpc('set_dessinateurs_utilisateur', { p_utilisateur_id, p_dessinateurs })`.

### Politiques RLS

RLS activé sur `utilisateur_dessinateurs` :

```sql
-- Lecture : l'utilisateur voit ses propres assignations
CREATE POLICY "utilisateur lit ses dessinateurs"
  ON utilisateur_dessinateurs FOR SELECT
  USING (auth.uid() = utilisateur_id);

-- Lecture : le dessinateur voit ses assignations (pour info)
CREATE POLICY "dessinateur lit ses assignations"
  ON utilisateur_dessinateurs FOR SELECT
  USING (auth.uid() = dessinateur_id);

-- Écriture : uniquement via la RPC (SECURITY DEFINER) — aucune politique INSERT/DELETE directe

-- Mise à jour is_default par l'utilisateur lui-même
CREATE POLICY "utilisateur met a jour son defaut"
  ON utilisateur_dessinateurs FOR UPDATE
  USING (auth.uid() = utilisateur_id)
  WITH CHECK (auth.uid() = utilisateur_id);
```

## Composants impactés

### 1. `GestionUtilisateurs.js` (admin)

**Avant :** Un `<select>` unique "Dessinateur assigné" lié à `profiles.dessinateur_id`.

**Après :**
- Remplacement par une liste à coches multiples des dessinateurs actifs (role = dessinateur, statut = actif)
- Chaque dessinateur coché = présent dans `utilisateur_dessinateurs`
- Une radio/étoile "Défaut" cliquable par dessinateur coché pour marquer `is_default = true`
- Règle : un seul `is_default = true` à la fois parmi les cochés (changer le défaut décoche l'ancien)
- Sauvegarde : via RPC `set_dessinateurs_utilisateur` (atomique). La fonction `sauvegarderEdit` ne met **plus** à jour `profiles.dessinateur_id` (le champ est conservé en base mais n'est plus écrit depuis cette UI).

**Chargement :** Lors du clic sur un utilisateur, charger ses lignes `utilisateur_dessinateurs` depuis Supabase.

**Colonne "Dessinateur assigné" dans le tableau récapitulatif :** Afficher le nom du dessinateur `is_default = true` (ou le premier s'il n'y en a pas de marqué). Si plusieurs dessinateurs, afficher "Prénom Nom + N autre(s)". Les assignations sont chargées pour tous les comptes en parallèle avec le chargement des profils.

### 2. `PageMonCompte.js` (utilisateur)

**Remplacement :** Le bloc conditionnel existant `{role === "client" && ...}` (lettre morte, le rôle en base est `"utilisateur"` et non `"client"`) est supprimé et remplacé par une section `{role === "utilisateur" && ...}` "Mes dessinateurs".

La prop `dessinateurAssigne` (utilisée uniquement depuis `VueDessinateur`) reste inchangée. La nouvelle section charge ses propres données via Supabase au montage, indépendamment de toute prop.

**Contenu de la section :**
- Chargement au montage depuis `utilisateur_dessinateurs` où `utilisateur_id = profil.id`, joint avec `profiles` pour prénom/nom
- Liste des dessinateurs assignés (prénom + nom)
- Pour chacun : bouton radio "Définir par défaut" — deux requêtes UPDATE : passer tous à `is_default = false`, puis mettre le choisi à `true`
- Si aucun dessinateur : message "Aucun dessinateur assigné, contactez votre administrateur"

### 3. `VueUtilisateur.js` (formulaire nouvelle commande)

**Nouveau state :** `dessinateursDispos` (liste `[{ id, prenom, nom, is_default }]` des dessinateurs assignés à l'utilisateur courant).

**`formVide(defaultDessinateurId = "")` :** Le paramètre `defaultDessinateurId` est ajouté. Tous les appels à `formVide()` passent la valeur courante depuis `dessinateursDispos` :
- À l'initialisation : `useState(formVide())` → `""` (les données ne sont pas encore chargées)
- Après création d'une commande (reset du form, ligne 157) : `setForm(formVide(dessinateursDispos.find(d => d.is_default)?.id ?? ""))` pour re-pré-sélectionner le défaut

**Chargement :** Dans `chargerTout()`, ajouter une requête vers `utilisateur_dessinateurs` filtrée par `utilisateur_id = profil.id`. Après chargement, mettre à jour `dessinateursDispos` et appeler `setForm(f => ({ ...f, dessinateur_id: defaultId }))` pour pré-sélectionner.

**Sous-comptes (`master_id`) :** Un sous-compte utilise ses propres assignations (basé sur son propre `profil.id`). Pas d'héritage automatique depuis le compte maître.

**Affichage dans le formulaire :**
- `<select>` "Dessinateur" avec les dessinateurs depuis `dessinateursDispos`
- Pré-sélection automatique du dessinateur `is_default = true`
- Si un seul dessinateur : pré-sélectionné
- Si aucun : champ désactivé + message "Aucun dessinateur disponible, contactez votre administrateur"
- Champ obligatoire : `creerCommande()` bloque si `form.dessinateur_id` est vide

**Cas utilisateur actif sans dessinateur :** Le seul blocage est le champ désactivé dans le formulaire. Pas d'écran global.

**À la création :** Renseigner dans l'insert Supabase :
- `dessinateur_id` : UUID du dessinateur choisi
- `dessinateur` : `"Prénom Nom"` du dessinateur choisi (pour compatibilité affichage existant)

**Notification :** Passer `dessinateur_id` dans le body de `notify-commande` :
```js
supabase.functions.invoke("notify-commande", {
  body: { utilisateur_id: form.utilisateur_id, nom_plan: form.nom_plan, ref, dessinateur_id: form.dessinateur_id },
});
```

## Flux utilisateur

1. Admin ouvre GestionUtilisateurs → sélectionne un utilisateur → coche 1 ou plusieurs dessinateurs → marque un défaut → sauvegarde (via RPC atomique)
2. Utilisateur ouvre Mon Compte → voit ses dessinateurs dans "Mes dessinateurs" → peut changer le défaut
3. Utilisateur crée une commande → champ dessinateur pré-sélectionné avec le défaut → peut changer si plusieurs → soumet

## Contraintes

- Un utilisateur actif sans dessinateur assigné voit le champ désactivé dans le formulaire de commande
- Les sous-comptes ont leurs propres assignations (pas d'héritage du compte maître)
- L'admin peut toujours modifier le dessinateur d'une commande existante via le DetailCommandeModal (comportement inchangé)
- La sauvegarde des assignations se fait via RPC PostgreSQL (SECURITY DEFINER + vérification du rôle admin) pour garantir l'atomicité et la sécurité
- `profiles.dessinateur_id` est conservé en base mais n'est plus mis à jour depuis l'UI
