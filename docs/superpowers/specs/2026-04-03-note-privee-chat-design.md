# Design : Commande /note — Message privé dans le chat

**Date :** 2026-04-03  
**Statut :** Approuvé

---

## Contexte

Dans le chat de `DetailCommandeModal`, les utilisateurs (client et dessinateur) peuvent envoyer des messages visibles par tous les participants. L'objectif est d'ajouter une commande `/note` permettant à n'importe quel utilisateur d'envoyer une note privée visible uniquement par lui-même, dans le fil de chat normal.

Cette fonctionnalité est la première d'une famille de commandes slash extensible (ex. `/mp` pour message privé à une tierce personne).

---

## Architecture

### 1. Base de données

**Migration :**
```sql
ALTER TABLE messages ADD COLUMN visible_par text[];
```

- `visible_par = NULL` → message public (comportement existant inchangé)
- `visible_par = ["simon"]` → visible uniquement par l'utilisateur "simon"

**Règle RLS (policy SELECT sur `messages`) :**

Modifier la policy SELECT existante pour ajouter la condition :
```sql
visible_par IS NULL
OR auteur = <nom_utilisateur_courant>
```

Puisque l'application identifie les utilisateurs par leur nom (champ `auteur`), la condition s'appuie sur le nom de l'utilisateur authentifié extrait du JWT ou passé en contexte.

---

### 2. Envoi du message

**Fichier concerné :** `src/components/Messagerie.js`

Lors du submit du message, avant l'insertion Supabase :

```
texte commence par "/note " ?
  → oui :
      - Extraire le texte réel (supprimer "/note " du début)
      - Insérer avec visible_par = [auteurNom]
      - Ne PAS appeler notify-message (aucune notification)
  → non :
      - Comportement actuel inchangé
      - visible_par = null
      - Appeler notify-message normalement
```

**Validation :** Si l'utilisateur tape uniquement `/note` sans texte, ne pas envoyer (même règle que message vide).

---

### 3. Affichage

**Fichier concerné :** `src/components/Messagerie.js`

**Filtrage avant affichage :**
```js
messages.filter(m =>
  !m.visible_par || m.visible_par.includes(auteurNom)
)
```

**Style de la bulle de note privée :**
- Alignée à droite (comme les propres messages de l'auteur)
- Fond jaune pâle, bordure pointillée
- Icône 🔒 + label "Note privée" affiché au-dessus du texte
- Timestamp conservé au format habituel : `27/03 à 08:29`
- Pas de statut "Lu" (non applicable à une note privée)

---

### 4. Notifications

La fonction Edge `notify-message` **n'est pas appelée** pour les notes privées. L'auteur ne reçoit pas non plus de notification — la note est simplement insérée silencieusement.

---

## Extensibilité future

La colonne `visible_par text[]` est prévue pour supporter des commandes futures :
- `/mp <nom>` → `visible_par = [auteurNom, nomDestinataire]`

Aucune modification supplémentaire de schéma ne sera nécessaire pour ce cas d'usage.

---

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `supabase/migrations/` | Nouvelle migration : ajout colonne `visible_par` |
| `src/components/Messagerie.js` | Parsing `/note`, filtrage affichage, style bulle privée |
| Supabase dashboard (RLS) | Modifier policy SELECT sur table `messages` |

---

## Ce qui ne change pas

- Format de date des messages
- Logique d'envoi des messages normaux
- Comportement de `notify-message` pour les messages publics
- Filtrage du contenu (`analyserMessage`) — appliqué aussi aux notes privées
