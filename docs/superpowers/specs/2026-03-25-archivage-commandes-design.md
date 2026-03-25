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

### Migration

```sql
-- Ajout de la colonne
ALTER TABLE commandes ADD COLUMN is_archived BOOLEAN DEFAULT false NOT NULL;

-- Migration des données existantes : statut "Archivé" → is_archived = true + statut = "Validé"
UPDATE commandes SET is_archived = true, statut = 'Validé' WHERE statut = 'Archivé';
```

### Résultat

- `is_archived = false` (défaut) : commande visible dans la liste principale
- `is_archived = true` : commande masquée, visible dans la section collapsible "Archivées"
- Le statut (`En attente`, `Commencé`, `Validé`, etc.) reste inchangé lors d'un archivage

## Constantes (`constants.js`)

- Retirer `"Archivé"` de `STATUT_STYLE` (ou le laisser en fallback neutre pour les données legacy)
- `"Archivé"` n'apparaît plus dans `STATUTS_ADMIN`

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

- Remplacer `commandes.filter(c => c.statut === "Validé").length` par rien (ou fusionner avec "en cours")
- "En cours" = `!is_archived`

## Actions

### Archiver

- `UPDATE commandes SET is_archived = true WHERE id = ?`
- Accessible depuis le dropdown `···` sur toutes les commandes **non-archivées**
- Disponible pour : admin, client (ses propres commandes)

### Désarchiver

- `UPDATE commandes SET is_archived = false WHERE id = ?`
- Accessible depuis le dropdown `···` sur les commandes **archivées**
- Disponible pour : admin, client (ses propres commandes)

### Supprimer

- `DELETE FROM commandes WHERE id = ?`
- Accessible depuis le dropdown `···` sur les commandes **archivées uniquement** (on archive d'abord, puis on supprime — protection contre suppression accidentelle)
- Modal de confirmation : "Cette action est irréversible. La commande et toutes ses données associées (messages, versions, fichiers) seront définitivement supprimées."
- Disponible pour : admin, client (ses propres commandes)

## Dropdown `···` selon l'état

| État de la commande | Options disponibles |
|---|---|
| Non-archivée | Modifier / Dupliquer / Archiver |
| Archivée | Désarchiver / Supprimer |

## Fichiers à modifier

1. **Supabase** — migration SQL (`is_archived` + update des existants)
2. `src/constants.js` — retirer "Archivé" de STATUTS_ADMIN et STATUT_STYLE
3. `src/components/VueUtilisateur.js` — filtres, supprimer section terminees, nouvelles actions, dropdown
4. `src/components/VueDessinateur.js` — filtres, nouvelles actions, dropdown
5. `src/components/DetailCommandeModal.js` — adapter DropdownMenu (désarchiver + supprimer)
