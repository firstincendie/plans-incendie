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

**RLS — stratégie retenue : enforcement côté client uniquement**

L'application identifie les utilisateurs par un nom en clair (champ `auteur`, ex. `"Simon"`), non par un UUID Supabase. Écrire une policy RLS qui compare `auth.uid()` à ce nom string nécessiterait une infrastructure supplémentaire (custom claim JWT, trigger d'hydratation) absente du projet.

La décision est donc de filtrer les notes privées **côté client uniquement** :
- Filtre de souscription Realtime (section 3)
- Filtre d'affichage dans `Messagerie.js` (section 4)
- Filtre dans `marquerMessagesLus` (section 5)

**Risque accepté :** un utilisateur malveillant qui lirait directement l'API Supabase pourrait voir les notes privées. Dans le contexte de cette application (petite équipe, utilisateurs connus), ce risque est acceptable.

---

### 2. Envoi du message

**Parsing dans `src/components/Messagerie.js` :**

Le parsing du préfixe `/note` est fait dans `handleEnvoyer()` de `Messagerie.js`. La détection se fait **après** l'appel à `analyserMessage` (le texte brut incluant le préfixe `/note ` est analysé, ce qui est intentionnel — les tentatives de contournement via `/note` sont également détectées et loguées dans `alertes` avec le texte brut).

Si `/note` est détecté, le préfixe est retiré et `onEnvoyer` est appelé avec un troisième argument `options` :

```
// Après analyserMessage, si texte commence par "/note " :
texteReel = texte.slice("/note ".length).trim()
onEnvoyer(texteReel, fichiers, { visible_par: [auteurActif] })

// Sinon (message public) :
onEnvoyer(texte, fichiers, {})
```

**Validation :** `/note` seul sans texte ni fichiers → ne pas envoyer.  
**Guard :** si `auteurActif` est vide (nom non défini), ne pas permettre l'envoi d'une note privée.

**Modification du callback `onEnvoyer` dans `VueDessinateur.js` et `VueUtilisateur.js` :**

Le wrapper lambda doit être mis à jour pour accepter et transmettre `options` :

```js
// Avant :
onEnvoyer={async (texte, fichiers) => {
  await envoyerMessage(selected.id, auteurNom, texte, fichiers);
}}

// Après :
onEnvoyer={async (texte, fichiers, options = {}) => {
  await envoyerMessage(selected.id, auteurNom, texte, fichiers, options);
}}
```

**Logique dans `envoyerMessage()` dans `VueDessinateur.js` et `VueUtilisateur.js` :**

```
options.visible_par défini ?
  → oui (note privée) :
      - Insérer avec visible_par = options.visible_par
      - Ne PAS appeler notify-message
  → non (message public) :
      - Insérer avec visible_par = null
      - Appeler notify-message normalement
```

---

### 3. Souscription Realtime

**Problème :** la souscription Realtime actuelle reçoit tous les `INSERT` sur `messages`, y compris les notes privées d'autres utilisateurs.

**Solution : filtrer la souscription INSERT pour ne recevoir que les messages publics.**

```js
// Dans VueDessinateur.js et VueUtilisateur.js
supabase.channel("messages-realtime")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "messages",
    filter: "visible_par=is.null"  // uniquement les messages publics
  }, handler)
```

**Prérequis :** le filtre Realtime `visible_par=is.null` ne fonctionne que si la table `messages` a `REPLICA IDENTITY FULL` activé (ou si la colonne `visible_par` fait partie de la replica identity). Vérifier ce point lors de la migration — si ce n'est pas le cas, ajouter `ALTER TABLE messages REPLICA IDENTITY FULL;` à la migration.

**Notes privées pour l'auteur :** ajoutées **optimistement** au state local immédiatement après l'insert, sans passer par Realtime.

**Souscription UPDATE :** la souscription UPDATE existante (pour `lu_par`) ne nécessite aucune modification. Les notes privées n'étant jamais marquées comme lues, aucun UPDATE ne sera jamais envoyé sur ces lignes.

---

### 4. Affichage

**Filtrage dans `src/components/Messagerie.js` (couche de défense supplémentaire) :**

`Messagerie.js` utilise la prop `auteurActif` (et non `auteurNom`) pour identifier l'utilisateur courant :

```js
messages.filter(m =>
  !m.visible_par || m.visible_par.includes(auteurActif)
)
```

**Style de la bulle de note privée :**
- Alignée à droite (comme les propres messages de l'auteur)
- Fond jaune pâle, bordure pointillée
- Icône 🔒 + label "Note privée" affiché au-dessus du texte
- Timestamp conservé au format habituel : `27/03 à 08:29`
- Pas de statut "Lu" (non applicable à une note privée)

---

### 5. Marquage "Lu"

La fonction `marquerMessagesLus` dans `VueDessinateur.js` et `VueUtilisateur.js` doit **exclure les messages avec `visible_par` non null** :

```js
const aMarquer = messages.filter(m =>
  m.auteur !== auteurNom &&
  !m.visible_par &&  // exclure les notes privées
  !(m.lu_par || []).includes(auteurNom)
)
```

---

### 6. Filtrage du contenu (`analyserMessage`)

`analyserMessage` est appelé sur le texte brut (incluant le préfixe `/note `) avant parsing. Si une note privée contient des informations de contact, elle est bloquée et une ligne est insérée dans `alertes` avec le texte brut (préfixe inclus). Ce comportement est intentionnel : on souhaite détecter les tentatives de contournement même via les notes privées.

Les dessinateurs (Simon) passent toujours outre ce filtre, comme actuellement.

---

### 7. Notifications

La fonction Edge `notify-message` **n'est pas appelée** pour les notes privées. Aucune notification n'est envoyée à qui que ce soit.

---

## Extensibilité future

La colonne `visible_par text[]` est prévue pour supporter des commandes futures :
- `/mp <nom>` → `visible_par = [auteurNom, nomDestinataire]`

Le filtre Realtime devra être adapté pour `/mp` (la note devra arriver au destinataire via Realtime). La stratégie sera à définir lors de l'implémentation de `/mp`.

---

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `supabase/migrations/` | Nouvelle migration : ajout colonne `visible_par text[]` + `REPLICA IDENTITY FULL` si nécessaire |
| `src/components/Messagerie.js` | Parsing `/note` dans `handleEnvoyer`, extension `onEnvoyer(texte, fichiers, options)`, filtre affichage avec `auteurActif`, style bulle privée |
| `src/components/VueDessinateur.js` | Mise à jour wrapper `onEnvoyer` pour transmettre `options`, mise à jour `envoyerMessage` pour `options.visible_par`, filtre Realtime INSERT, exclusion dans `marquerMessagesLus` |
| `src/components/VueUtilisateur.js` | Idem VueDessinateur |

---

## Ce qui ne change pas

- Format de date des messages (`27/03 à 08:29`)
- Logique d'envoi des messages normaux (`visible_par = null`)
- Comportement de `notify-message` pour les messages publics
- Souscription Realtime UPDATE (`lu_par`)
- Comportement de `analyserMessage` (appliqué aux notes privées des utilisateurs, texte brut avec préfixe)
