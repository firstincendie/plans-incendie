# Design : Archivage, désarchivage et suppression des commandes

Date : 2026-03-25

## Contexte

Actuellement, "Archivé" est un statut dans la table `commandes` (au même titre que "Validé", "Commencé", etc.).
Les commandes validées disparaissent de la liste principale et vont dans une section collapsible "▼ X commandes validées".

Ce design corrige deux problèmes :
1. Les commandes "Validé" ne doivent pas être cachées dans une section séparée — elles restent visibles dans la liste principale.
2. "Archivé" ne doit pas être un statut métier mais un flag de visibilité.

## Objectifs

- Les commandes validées restent dans la liste principale avec toutes les autres.
- Archiver = masquer de la vue principale (flag `is_archived`), pas changer le statut.
- Désarchiver = remettre visible.
- Supprimer = suppression définitive avec confirmation.
- Admin et client peuvent archiver, désarchiver et supprimer leurs propres commandes.

## Base de données

### Migration (dans une transaction)

```sql
BEGIN;
ALTER TABLE commandes ADD COLUMN is_archived BOOLEAN DEFAULT false NOT NULL;
UPDATE commandes SET is_archived = true, statut = 'Validé' WHERE statut = 'Archivé';
COMMIT;
```

### Résultat

- `is_archived = false` (défaut) : commande visible dans la liste principale
- `is_archived = true` : commande masquée, visible dans la section collapsible "Archivées"
- Le statut reste inchangé lors d'un archivage (on peut archiver une commande "Commencé", "En attente", etc.)

### Sécurité / RLS

La sécurité est gérée au niveau UI/query (pas de RLS strict sur cette table). Les requêtes client filtrent déjà par `utilisateur_id = profil.id`. La vérification d'appartenance pour archiver/supprimer se fait dans le code JS avant d'exécuter la requête.

## Constantes (`constants.js`)

- Retirer `"Archivé"` de `STATUTS_ADMIN`
- Retirer `"Archivé"` de `STATUT_STYLE` (ou conserver en fallback neutre pour l'affichage de données legacy)

## Requête Supabase

Les fetches actuels font un `select("*, messages(*)")` sans filtre sur `statut` — pas de changement nécessaire côté requête. Le filtrage `actives`/`archivees` reste en JS.

## Affichage des listes

### VueUtilisateur.js et VueDessinateur.js

Avant :
```js
const actives   = cmdFiltrees.filter(c => c.statut !== "Validé" && c.statut !== "Archivé");
const terminees = cmdFiltrees.filter(c => c.statut === "Validé");
const archivees = cmdFiltrees.filter(c => c.statut === "Archivé");
```

Après :
```js
const actives   = cmdFiltrees.filter(c => !c.is_archived);
const archivees = cmdFiltrees.filter(c => c.is_archived);
```

- Supprimer la section `terminees` / "▼ X commandes validées" dans VueUtilisateur
- Dans VueDessinateur, les commandes "Validé" sont maintenant visibles dans la liste principale (elles disparaissaient avant)
- La section collapsible "Archivées" reste en bas, comme aujourd'hui

### Compteurs de stats

- Supprimer le compteur "validées" (`commandes.filter(c => c.statut === "Validé").length`)
- "En cours" = `commandes.filter(c => !c.is_archived).length`

## Actions

### Archiver

- `UPDATE commandes SET is_archived = true WHERE id = ?`
- Accessible sur toutes les commandes **non-archivées**, quel que soit le statut
- Disponible pour : admin (toutes commandes), client (ses commandes : `utilisateur_id = profil.id`)

### Désarchiver

- `UPDATE commandes SET is_archived = false WHERE id = ?`
- Accessible sur les commandes **archivées**
- Disponible pour : admin (toutes commandes), client (ses commandes)

### Supprimer

- `DELETE FROM commandes WHERE id = ?`
- Accessible sur les commandes **archivées uniquement** (on archive d'abord, puis on supprime — protection contre suppression accidentelle)
- Modal de confirmation : "Cette action est irréversible. La commande et toutes ses données associées (messages, versions, fichiers) seront définitivement supprimées."
- Disponible pour : admin (toutes commandes), client (ses commandes)

### Dupliquer (comportement inchangé, précision ajoutée)

- La duplication crée toujours une commande avec `is_archived = false`, quel que soit l'état de la commande source.

## Dropdown `···` selon l'état

| État de la commande | Options disponibles |
|---|---|
| Non-archivée | Modifier / Dupliquer / Archiver |
| Archivée | Désarchiver / Supprimer |

## Fichiers à modifier

1. **Supabase** — migration SQL (`is_archived` + update des existants)
2. `src/constants.js` — retirer "Archivé" de STATUTS_ADMIN et STATUT_STYLE
3. `src/components/VueUtilisateur.js` — filtres, supprimer section terminees, nouvelles actions archiver/désarchiver/supprimer, adapter dropdown
4. `src/components/VueDessinateur.js` — filtres, nouvelles actions, adapter dropdown
5. `src/components/DetailCommandeModal.js` — adapter `DropdownMenu` : ajouter props `onDesarchiver` et `onSupprimer`, afficher selon l'état `is_archived` de la commande sélectionnée
