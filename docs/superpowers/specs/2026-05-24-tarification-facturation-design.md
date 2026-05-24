# Spec : Tarification & facturation mensuelle

**Date :** 2026-05-24
**Statut :** Brouillon — en attente de validation

## Contexte

Aujourd'hui l'application gère tout le cycle de vie d'une commande (création → dépôt
d'ébauche → validation → plans finaux) mais **aucune notion de prix ni de facturation**.
Les commandes n'ont aucun champ de montant (`commandes` n'a ni `prix`, ni `montant`, ni
`tarif`). L'objectif de cette spec est d'introduire :

1. Une **tarification par dessinateur** : chaque dessinateur dispose de sa propre grille
   de prix (par type de plan × format) et de ses propres paramètres (TVA, ajustement délai).
2. Un **calcul automatique du montant** d'une commande, affiché au client au moment de
   commander et figé à la validation.
3. Une **facturation mensuelle** : en fin de mois, chaque client reçoit une facture par
   dessinateur, agrégeant les commandes validées du mois. Le **paiement ne passe pas par
   la plateforme** (règles propres à chaque dessinateur), avec une échéance de 15 jours et
   une alerte admin en cas d'impayé.
4. Des **statistiques** par mois et par dessinateur, côté client comme côté dessinateur.

Le paiement en ligne (Stripe ou autre) est **hors périmètre** de cette phase.

## Décisions validées

| Sujet | Décision |
|-------|----------|
| Paiement en ligne | **Non** en phase 1. La plateforme calcule et facture ; le règlement se fait hors plateforme, selon les règles du dessinateur. |
| Granularité de la grille | **Par dessinateur.** Chaque dessinateur a sa propre grille. |
| Axe de tarification | **Type de plan × format** (A0–A4). |
| Influence de la matière | **Aucune.** La matière (Bâche M1 / Plexiglass / Aluminium) ne change pas le prix. |
| Facturation des modifications | **Non facturées.** Les modifications demandées par le client sont incluses. |
| Formule délai | **Linéaire par jour**, référence **5 jours** = prix de base (0 %). Au-delà : remise/jour. En-deçà : majoration/jour. |
| Garde-fous délai | **Taux fixés par le dessinateur** (remise/jour, majoration/jour) ; **plafonds + délai minimum = constantes plateforme** fixées par l'admin. |
| TVA | **Gérée**, **taux propre à chaque dessinateur** (modifiable dans ses tarifs). Peut être 0 % (dessinateurs à l'étranger / franchise). |
| Cycle de facturation | **Mensuel.** Facture en fin de mois, par client et par dessinateur. Échéance **15 jours**. Impayé → e-mail à l'admin pour suspension. |
| Visibilité | Onglet « Facturation » côté dessinateur (total par client/mois) **et** côté client (dû par dessinateur/mois). Statistiques par mois et par dessinateur des deux côtés. |

## Points à valider (⚠ avant implémentation)

1. **Type de plan « SSI ».** `SSI` est aujourd'hui un type de plan commandable
   (`constants.js:10` → `TYPES_PLAN = ["Évacuation", "Intervention", "SSI", "Plan de masse"]`).
   En entretien il a été dit que « SSI ne veut rien dire ». Deux options :
   - **(Recommandé)** Le tarifer comme les autres (ligne de grille par format), pour ne pas
     casser les commandes existantes ni le formulaire. Si un dessinateur ne veut pas le
     proposer, il met simplement un prix nul / le laisse vide.
   - Le **retirer** de `TYPES_PLAN`. Impact : vérifier qu'aucune commande historique n'a de
     plan de type `SSI` (sinon affichage à gérer).
   → **Cette spec part de l'option recommandée** : la grille couvre les 4 types.

2. **Entité facturée pour les sous-comptes.** L'app a des comptes maîtres / sous-comptes
   (`profiles.master_id`, `is_owner`). Proposition : **facturer au niveau du compte maître**
   (le propriétaire paie pour ses sous-comptes). À confirmer (alternative : facturer chaque
   sous-compte individuellement).

3. **Émission de la facture : automatique ou manuelle ?** Proposition : **automatique** le
   1ᵉʳ du mois (job planifié) pour le mois écoulé, avec possibilité pour le dessinateur de
   consulter le brouillon en cours de mois. Alternative : émission manuelle par le dessinateur.

4. **Règle « modifications sous 3 jours ».** Évoquée précédemment. Comme les modifications ne
   sont pas facturées, il s'agit d'un **engagement de délai (SLA)**, pas d'un élément de prix.
   À préciser : simple affichage informatif, ou échéance/alerte ? → **Hors périmètre de cette
   spec tarifaire** sauf indication contraire.

## Modèle de tarification

### Grille par dessinateur

Chaque dessinateur possède une grille de prix **HT** indexée sur `(type_plan, format)` :

| Type \ Format | A4 | A3 | A2 | A1 | A0 |
|---------------|----|----|----|----|----|
| Évacuation    | …  | …  | …  | …  | …  |
| Intervention  | …  | …  | …  | …  | …  |
| SSI           | …  | …  | …  | …  | …  |
| Plan de masse | …  | …  | …  | …  | …  |

La **matière** et l'**orientation** n'entrent pas dans le calcul.

### Paramètres par dessinateur

- `taux_tva` (ex. 20 % ; 0 % autorisé).
- `taux_remise_jour` : remise par jour **au-delà** de la référence (ex. 3 %/jour).
- `taux_majoration_jour` : majoration par jour **en-deçà** de la référence (ex. 10 %/jour).

### Constantes plateforme (fixées par l'admin)

- `DELAI_REF_JOURS = 5` — délai de référence (prix de base, ajustement 0 %).
- `PLAFOND_REMISE` — ex. 30 %.
- `PLAFOND_MAJORATION` — ex. 100 %.
- `DELAI_MIN_JOURS` — ex. 2 — délai en-dessous duquel une commande ne peut pas être passée.

### Formule de calcul

Soit une commande avec `n` plans. Pour chaque plan `i` de type `t_i` et format `f_i` :

```
prix_ligne_i = grille[dessinateur][t_i][f_i]          (HT)
montant_base = Σ prix_ligne_i
```

Soit `d` = nombre de jours (calendaires) entre aujourd'hui et le délai souhaité.

```
si d ≥ DELAI_REF_JOURS :
    pct = − min(taux_remise_jour × (d − DELAI_REF_JOURS), PLAFOND_REMISE)
sinon :
    pct = + min(taux_majoration_jour × (DELAI_REF_JOURS − d), PLAFOND_MAJORATION)

montant_ht  = arrondi( montant_base × (1 + pct), 2 )
montant_tva = arrondi( montant_ht × taux_tva, 2 )
montant_ttc = montant_ht + montant_tva
```

Contrainte : `d ≥ DELAI_MIN_JOURS`, sinon la commande est bloquée à la saisie.

### Exemple chiffré

Dessinateur : `taux_remise_jour = 3 %`, `taux_majoration_jour = 10 %`, `taux_tva = 20 %`.
Plafonds plateforme : remise 30 %, majoration 100 %. Référence 5 j. `montant_base = 100 €`.

| Délai `d` | Ajustement | Montant HT | TTC (20 %) |
|-----------|-----------|-----------|-----------|
| 5 j       | 0 %       | 100,00 €  | 120,00 €  |
| 10 j      | − 15 %    | 85,00 €   | 102,00 €  |
| 20 j      | − 30 % (plafonné) | 70,00 € | 84,00 € |
| 3 j       | + 20 %    | 120,00 €  | 144,00 €  |
| 2 j       | + 30 %    | 130,00 €  | 156,00 €  |
| 1 j       | **bloqué** (< DELAI_MIN) | — | — |

### Figeage (snapshot)

Le prix dépend de la grille du dessinateur (qui peut changer) et du délai (qui peut être
modifié). Règle :

- **À la création** : on calcule et on **stocke sur la commande** le détail (lignes, base,
  ajustement, HT/TVA/TTC, taux TVA appliqué).
- **À chaque modification** de la commande (plans / délai / dessinateur) **avant validation** :
  on **recalcule** le snapshot.
- **À la validation** (`statut = "Validé"`) : le snapshot est **figé** et la commande devient
  éligible à la facturation du mois de validation. Une modification post-validation (statut
  `Modification dessinateur`) ne change pas le montant (modifications incluses).

## Base de données

### Nouvelle table : `tarifs_dessinateur` (paramètres, 1 ligne par dessinateur)

```sql
CREATE TABLE tarifs_dessinateur (
  dessinateur_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  taux_tva              NUMERIC(5,4) NOT NULL DEFAULT 0.20,   -- 0.20 = 20 %
  taux_remise_jour      NUMERIC(5,4) NOT NULL DEFAULT 0,      -- 0.03 = 3 %/jour
  taux_majoration_jour  NUMERIC(5,4) NOT NULL DEFAULT 0,      -- 0.10 = 10 %/jour
  actif                 BOOLEAN NOT NULL DEFAULT false,       -- true quand une grille validée existe
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Nouvelle table : `tarifs_grille` (lignes de prix)

```sql
CREATE TABLE tarifs_grille (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dessinateur_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type_plan       TEXT NOT NULL,   -- "Évacuation" | "Intervention" | "SSI" | "Plan de masse"
  format          TEXT NOT NULL,   -- "A4" | "A3" | "A2" | "A1" | "A0"
  prix_ht         NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE (dessinateur_id, type_plan, format)
);
```

### Nouvelle table : `tarifs_demandes` (workflow d'approbation)

Le dessinateur ne modifie pas sa grille en direct : il soumet une **demande** que l'admin
valide ou refuse. L'admin, lui, peut éditer directement (initialisation / correction).

```sql
CREATE TABLE tarifs_demandes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dessinateur_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  statut          TEXT NOT NULL DEFAULT 'en_attente',  -- en_attente | approuvee | refusee
  -- payload proposé : { taux_tva, taux_remise_jour, taux_majoration_jour,
  --                     grille: [{ type_plan, format, prix_ht }, ...] }
  payload         JSONB NOT NULL,
  commentaire     TEXT,                 -- mot du dessinateur
  commentaire_admin TEXT,               -- motif de refus éventuel
  traite_par      UUID REFERENCES profiles(id),
  traite_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

À l'approbation, le `payload` est appliqué à `tarifs_dessinateur` + `tarifs_grille`
(via une RPC `appliquer_tarifs_demande`, atomique).

### Nouvelle table : `factures` (facture mensuelle par client × dessinateur)

```sql
CREATE TABLE factures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT UNIQUE,                 -- ex. "F-2026-05-0001" (trigger)
  client_id       UUID NOT NULL REFERENCES profiles(id),   -- compte facturé (cf. point 2)
  dessinateur_id  UUID NOT NULL REFERENCES profiles(id),
  periode         DATE NOT NULL,               -- 1er jour du mois facturé (ex. 2026-05-01)
  montant_ht      NUMERIC(10,2) NOT NULL,
  montant_tva     NUMERIC(10,2) NOT NULL,
  montant_ttc     NUMERIC(10,2) NOT NULL,
  statut          TEXT NOT NULL DEFAULT 'emise', -- emise | payee | en_retard | annulee
  date_emission   TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_echeance   DATE NOT NULL,               -- date_emission + 15 jours
  date_paiement   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, dessinateur_id, periode)
);
```

### Modifications de la table `commandes`

Ajout des colonnes de snapshot et du lien de facturation :

```sql
ALTER TABLE commandes
  ADD COLUMN montant_base       NUMERIC(10,2),   -- somme des lignes, avant ajustement délai
  ADD COLUMN ajustement_pct     NUMERIC(6,4),    -- ex. -0.15 (remise) ou +0.20 (majoration)
  ADD COLUMN montant_ht         NUMERIC(10,2),
  ADD COLUMN taux_tva           NUMERIC(5,4),    -- taux figé au moment du calcul
  ADD COLUMN montant_tva        NUMERIC(10,2),
  ADD COLUMN montant_ttc        NUMERIC(10,2),
  ADD COLUMN lignes_facturation JSONB,           -- [{ type_plan, format, prix_ht }, ...]
  ADD COLUMN delai_jours        INTEGER,         -- d retenu pour l'ajustement
  ADD COLUMN date_validation    TIMESTAMPTZ,     -- horodatage du passage à "Validé"
  ADD COLUMN facture_id         UUID REFERENCES factures(id);  -- renseigné à l'émission
```

`date_validation` est posée lorsque `statut` passe à `"Validé"` (dans la transition de statut
de `ModalDetailCommande.js`). Elle détermine le **mois de facturation**.

### RPC Supabase

- `appliquer_tarifs_demande(p_demande_id)` — `SECURITY DEFINER`, vérifie `role = 'admin'`,
  applique le payload à `tarifs_dessinateur` + `tarifs_grille` (upsert) et passe la demande
  à `approuvee`.
- `set_tarifs_dessinateur(p_dessinateur_id, p_payload)` — édition directe admin (atomique).
- `generer_factures_mois(p_periode DATE)` — agrège les commandes `Validé` du mois `p_periode`
  par `(client_id, dessinateur_id)`, crée/complète les `factures`, lie les `commandes.facture_id`.
  Idempotente (ON CONFLICT sur `UNIQUE(client_id, dessinateur_id, periode)`).
- `marquer_facture_payee(p_facture_id)` — réservée au dessinateur propriétaire de la facture
  (ou admin) ; pose `statut='payee'`, `date_paiement=now()`.

### Politiques RLS (principes)

- `tarifs_grille` / `tarifs_dessinateur` :
  - lecture : le dessinateur lit la sienne ; un client lit la grille des dessinateurs qui lui
    sont assignés (`utilisateur_dessinateurs`) — nécessaire pour afficher le prix à la commande ;
    admin lit tout.
  - écriture : **uniquement via RPC** (pas d'INSERT/UPDATE direct).
- `tarifs_demandes` : le dessinateur crée/lit les siennes ; admin lit/traite toutes.
- `factures` : le client lit les siennes (`client_id = auth.uid()` ou compte maître) ; le
  dessinateur lit celles qu'il a émises ; admin lit tout. Écriture via RPC / edge function.

## Workflow de tarification

1. **Initialisation** : l'admin saisit (ou pré-remplit) la première grille d'un dessinateur
   via `GestionUtilisateurs` (RPC `set_tarifs_dessinateur`). `tarifs_dessinateur.actif = true`.
2. **Demande de modification** : le dessinateur édite sa grille / TVA / taux dans son onglet
   « Tarifs » et **soumet une demande** (`tarifs_demandes`, statut `en_attente`). Sa grille
   active reste inchangée tant que la demande n'est pas approuvée.
3. **Revue admin** : l'admin voit les demandes en attente (diff ancienne ↔ proposée), puis
   **approuve** (→ `appliquer_tarifs_demande`) ou **refuse** (avec `commentaire_admin`).
4. Le dessinateur est notifié de l'issue (réutilisation de `send-email`).

## Facturation mensuelle

### Émission (job mensuel)

Le 1ᵉʳ de chaque mois, un **job planifié** (pg_cron → edge function `generer-factures`) appelle
`generer_factures_mois(mois_précédent)` :
- agrège toutes les commandes `Validé` du mois (par `date_validation`), groupées par
  `(client facturé, dessinateur)` ;
- crée une `facture` par groupe : `montant_*` = somme des commandes, `date_echeance = +15 j`,
  `statut = 'emise'` ;
- lie chaque commande à sa facture (`commandes.facture_id`) ;
- envoie un e-mail au client (« Votre facture du mois … »).

### Échéance & impayé (job quotidien)

Un **job quotidien** (pg_cron → edge function `verifier-echeances`) :
- passe à `en_retard` les factures `emise` dont `date_echeance < aujourd'hui` ;
- envoie un **e-mail à l'admin** listant les clients en retard, **pour suspension manuelle**
  du compte (l'admin utilise le contrôle de statut existant dans `GestionUtilisateurs` :
  `statut = 'banni'` / suspendu). **Pas de suspension automatique.**

### Règlement

- Le paiement se fait **hors plateforme**, selon les règles du dessinateur.
- C'est le **dessinateur** (qui reçoit le paiement) qui **marque la facture comme payée** dans
  son onglet « Facturation » (`marquer_facture_payee`). L'admin peut aussi le faire.

## Composants impactés (UI)

### 1. `NouvelleCommandeModal.js` — affichage du prix + délai par défaut

- **Délai par défaut** : passer de `ajouterJours(null, 7)` (ligne 26) à
  `ajouterJours(null, DELAI_REF_JOURS)` (5 jours). `min` du `<input type="date">` (ligne 203)
  passé à `aujourd'hui + DELAI_MIN_JOURS`.
- **Récapitulatif de prix en direct** : sous les lignes de plan, afficher pour le dessinateur
  sélectionné : détail par ligne (type/format → prix HT), `montant_base`, ajustement délai
  (libellé « Express +X % » ou « Délai long −X % »), HT, TVA (taux), **TTC**.
  - Nécessite un **dessinateur sélectionné** (le prix en dépend) — déjà obligatoire à la
    commande (cf. spec sélection-dessinateur).
  - Si le dessinateur n'a pas de grille active : message « Tarifs non disponibles, contactez
    votre dessinateur/l'administrateur » et blocage de la commande.
- **À l'enregistrement** : écrire le snapshot (`montant_base`, `ajustement_pct`, `montant_ht`,
  `taux_tva`, `montant_tva`, `montant_ttc`, `lignes_facturation`, `delai_jours`).
- **Calcul** : helper partagé `calculerMontantCommande(plans, delaiDate, tarif)` (cf. helpers).

### 2. `ModalDetailCommande.js` / `DetailCommandeModal.js`

- Afficher le montant de la commande (HT/TVA/TTC + détail) dans le détail.
- **Recalcul du snapshot** si plans/délai/dessinateur changent avant validation.
- À la transition vers `"Validé"` : poser `date_validation = now()` et figer le snapshot.

### 3. `GestionCompteDessinateur.js` — nouveaux onglets

Ajout de deux onglets (à côté de « Sous-comptes » / « Notes clients ») :

- **Onglet « Tarifs »** : édition de la grille (tableau type × format), `taux_tva`,
  `taux_remise_jour`, `taux_majoration_jour`. Bouton « Soumettre pour validation » →
  crée une `tarifs_demandes`. Affiche la grille active + l'état de la demande en cours.
- **Onglet « Facturation »** : liste des factures émises, total par client et par mois,
  bouton « Marquer payée », filtres par mois/client, **statistiques** (CA par mois, par client).

> Remarque : ces onglets concernent le dessinateur. Si seuls les comptes `is_owner` doivent y
> accéder (comme la gestion de compte actuelle), à confirmer ; par défaut accessible à tout
> dessinateur pour sa propre activité.

### 4. Côté client — onglet « Facturation »

Nouvel onglet/route « Facturation » (dans `PageMonCompte.js` ou route dédiée `/facturation`) :
- montant dû **par dessinateur et par mois** ;
- liste des factures (période, montant TTC, échéance, statut) ;
- **statistiques** : dépenses par mois, par dessinateur.

### 5. `GestionUtilisateurs.js` (admin)

- **Édition directe** de la grille d'un dessinateur (initialisation).
- **File des demandes de tarifs** : liste des `tarifs_demandes` en attente, vue diff,
  boutons Approuver / Refuser.
- **Vue factures** : consultation de toutes les factures, marquage payé, repérage des impayés.

### 6. `Sidebar.js` / `AppRouter.js`

- Ajout de l'entrée de menu « Facturation » selon le rôle, et des routes correspondantes
  (protégées par `RequireRole`).

## Edge functions & jobs planifiés

| Fonction | Déclencheur | Rôle |
|----------|-------------|------|
| `generer-factures` | pg_cron, 1ᵉʳ du mois | appelle `generer_factures_mois(mois précédent)` + e-mails clients |
| `verifier-echeances` | pg_cron, quotidien | passe en `en_retard`, e-mail admin pour suspension |
| `send-email` (existant) | appelée par les ci-dessus | envoi via Resend |
| `notify-tarifs` (nouveau, optionnel) | approbation/refus demande | informe le dessinateur |

Templates e-mail à ajouter : facture émise (client), retard de paiement (admin),
issue de demande de tarifs (dessinateur).

## Constantes & helpers

- `constants.js` : ajouter `DELAI_REF_JOURS = 5`, `DELAI_MIN_JOURS`, `PLAFOND_REMISE`,
  `PLAFOND_MAJORATION` (ou les stocker en table de config admin si on veut les rendre
  modifiables sans déploiement — à trancher).
- `helpers.js` : ajouter
  - `calculerAjustementDelai(delaiDate, tarif)` → `pct`
  - `calculerMontantCommande(plans, delaiDate, tarif)` → `{ base, pct, ht, tva, ttc, lignes }`
  - `formatMontant(n)` → `"123,45 €"`

## Flux récapitulatifs

**Commande → prix**
1. Le client choisit un dessinateur, ajoute des plans (type/format), choisit un délai.
2. Le prix HT/TVA/TTC s'affiche en direct (grille du dessinateur + ajustement délai).
3. À l'enregistrement, le snapshot est figé sur la commande.

**Validation → facturation**
1. La commande passe à `Validé` → `date_validation` posée, montant figé.
2. Le 1ᵉʳ du mois suivant, le job agrège les commandes validées du mois → une facture par
   (client, dessinateur), échéance +15 j, e-mail au client.
3. Le dessinateur marque la facture payée quand il reçoit le règlement.
4. À J+15 sans paiement → facture `en_retard`, e-mail à l'admin → suspension manuelle.

**Tarifs**
1. Admin initialise la grille d'un dessinateur.
2. Le dessinateur propose une modification → demande en attente.
3. Admin approuve/refuse → la grille active est mise à jour à l'approbation.

## Contraintes & hors-périmètre

- **Pas de paiement en ligne** en phase 1 (Stripe = phase 2 éventuelle).
- La matière et l'orientation **n'influencent pas** le prix.
- Les **modifications sont incluses** (non facturées).
- Les grilles de prix ne sont modifiables que **via demande validée par l'admin** (sauf
  édition directe admin).
- Les commandes **antérieures** à la mise en place de la tarification n'ont pas de snapshot
  (`montant_* = NULL`) et sont exclues de la facturation.
- Le **délai minimum** empêche les commandes trop urgentes ; le délai de référence (5 j) sert
  de point neutre pour l'ajustement.
- Suspension de compte **manuelle** (l'app alerte l'admin, ne suspend pas automatiquement).
