# Cahier des charges — Tarification & Paiement

**Produit :** Plans‑Incendie · **Date :** 2026‑05‑25 · **Version :** 1.1 · **Statut :** À valider

> Ce document remplace le brouillon de brainstorm précédent (facturation mensuelle / modèle linéaire), abandonné au profit du modèle décrit ici : **commande à formats de délai, paiement par carte à la validation, encaissement par la société puis reversement aux dessinateurs**.

---

## 1. Contexte & objectif

Plans‑Incendie met en relation des **clients** (sociétés, confrères du secteur incendie) avec des **dessinateurs** qui réalisent des plans (plan d'évacuation, plan d'intervention, plan de masse). L'application gère aujourd'hui tout le cycle de vie d'une commande **sans aucune notion de prix ni de paiement**.

Point important sur l'usage : le client **transmet l'ébauche à son propre client final** pour validation, puis **revient sur la plateforme** avec les modifications éventuelles ou la validation. L'ébauche est donc un document que le client fait circuler — d'où un filigrane **neutre** (cf. §12).

L'objectif est d'ajouter :

1. une **tarification par dessinateur** (grille de prix + TVA + formats de délai) ;
2. des **engagements de délai** (24h / 48h / 72h / normale) chronométrés sur le temps de travail réel du dessinateur, avec **pénalités** en cas de retard ;
3. un **paiement par carte à la validation finale**, encaissé par la société puis reversé aux dessinateurs, avec **facture par commande** ;
4. la **protection des livrables** (filigrane + verrouillage tant que ce n'est pas payé).

---

## 2. Périmètre

**Inclus :** grille de prix par dessinateur, formats de délai et SLA, pénalités, retouches incluses/payantes, validation de prise en charge par le dessinateur, parcours de commande en 2 étapes, paiement carte + reversement, facture par commande, filigrane et stockage privé, statistiques.

**Exclu (pour cette phase) :** porte‑monnaie / cagnotte prépayée, facturation mensuelle groupée, paiement différé hors plateforme, gestion comptable complète (export FEC, etc.).

---

## 3. Acteurs & rôles

- **Client** (`utilisateur`) — société vérifiée (SIREN, raison sociale) ; crée et valide les commandes, paie.
- **Dessinateur** (`dessinateur`) — réalise les plans ; définit sa grille et ses disponibilités (soumises à validation admin) ; valide la prise en charge ; reçoit les versements.
- **Admin** — valide les comptes, les grilles de tarifs et les disponibilités, supervise les paiements et les litiges.

---

## 4. Glossaire

- **Format de délai** : engagement de rapidité choisi à la commande (24h, 48h, 72h, normale).
- **Temps dessinateur** : temps réellement passé par le dessinateur, décompté **uniquement pendant ses heures de travail** et **mis en pause** quand on attend le client.
- **Déclassement** : recalcul automatique du prix au format réellement tenu quand le dessinateur est en retard.
- **Filigrane** : marquage visible **« ÉBAUCHE »** sur l'aperçu et le document téléchargeable, retiré après paiement.
- **Plan principal / annexe** : le plan détaillé complet vs ses déclinaisons où seul le repère « Vous êtes ici » change de place (cf. §5.2).
- **Destination charge (Stripe Connect)** : le client paie une fois ; le prestataire répartit automatiquement la part du dessinateur et la commission de la société, sans porte‑monnaie permanent.

---

## 5. Catalogue & grille tarifaire

### 5.1 Types de plans

`Évacuation`, `Intervention`, `Plan de masse`. *(Le type « SSI » a été retiré du catalogue.)*

### 5.2 Structure de prix d'un plan

Un plan ne se résume pas à un prix unique par type. En pratique :

- il y a le **plan principal** (le plan détaillé complet), qui coûte le prix plein ;
- puis souvent des **annexes / déclinaisons** : des variantes du même plan où **seul le repère « Vous êtes ici » change de place** (une par emplacement / niveau). Elles sont **généralement moins chères**.

La grille doit donc distinguer le **prix du plan principal** et le **prix d'une annexe**.

> **À définir avec la dessinatrice (en cours) :** structure exacte — prix principal + prix annexe, rôle éventuel du format papier, tarif forfaitaire ou unitaire. La grille (type × format) ci‑dessous est une base qui sera ajustée selon sa réponse.

### 5.3 Grille de prix (par dessinateur)

Prix **HT** du **plan principal**, tarif **« normale »**, par couple **(type de plan × format papier)** :

| Type \ Format | A4 | A3 | A2 | A1 | A0 |
|---|---|---|---|---|---|
| Évacuation | … | … | … | … | … |
| Intervention | … | … | … | … | … |
| Plan de masse | … | … | … | … | … |

Règles :

- **Tous les prix sont obligatoires et strictement supérieurs à 0 €.** Une grille incomplète ne peut pas être activée.
- La **matière** (bâche, plexi, alu) et l'**orientation** n'influencent pas le prix.

### 5.4 Formats de délai et prix

Le prix dépend aussi du **format de délai** choisi. La grille correspond au tarif **« normale »** ; chaque dessinateur définit un **coefficient multiplicateur** pour les formats plus rapides.

| Format | Coefficient (exemple) |
|---|---|
| Normale (7 j) | ×1,0 |
| 72h | ×1,2 |
| 48h | ×1,5 |
| 24h | ×2,0 |

> **À valider :** mécanisme exact (coefficient multiplicateur par format, fixé par le dessinateur — recommandé) vs grille de prix distincte par format.

### 5.5 TVA

Chaque dessinateur renseigne **son propre taux de TVA** (ex. 20 %), **0 %** possible (dessinateurs à l'étranger / franchise).

### 5.6 Validation des tarifs et disponibilités

- L'**admin** peut saisir / corriger directement la grille d'un dessinateur (initialisation).
- Le **dessinateur** modifie sa grille / TVA / coefficients / **disponibilités**, puis **soumet une demande** ; les valeurs actives restent inchangées jusqu'à **approbation par l'admin**.

### 5.7 Prix verrouillé

Le prix est **verrouillé au devis** (à la création de la commande). Un changement de grille ultérieur **ne touche jamais** les commandes déjà passées.

---

## 6. Délais & engagements (SLA)

### 6.1 Principe du chrono

Le délai est un **budget de temps dessinateur**, décompté **uniquement pendant ses heures de travail** et **mis en pause** dès que la balle est dans le camp du client (relecture, demande de modification, envoi de fichiers). Le chrono de la **première ébauche démarre à la prise en charge** par le dessinateur (cf. §10).

### 6.2 Disponibilités du dessinateur

Le dessinateur saisit ses **jours et heures de travail** (ex. lundi → samedi, 8h–19h), **soumis à validation de l'admin**. Ils servent à :

- **calculer la date/heure exacte de livraison** affichée au client à la commande (« pas de surprise ») ;
- **décompter** le temps de travail.

### 6.3 SLA par étape

| Format | Première ébauche | Chaque retouche | Plans finaux |
|---|---|---|---|
| 24h | 24h | 12h | 12h |
| 48h | 48h | 12h | 12h |
| 72h | 72h | 12h | 12h |
| Normale | 7 j | 24h | 24h |

### 6.4 Affichage & traçabilité

- **Compte à rebours** affiché sur chaque commande.
- **Deadline affichée** : seule celle de la **première ébauche** est annoncée à la commande ; les deadlines des étapes suivantes s'affichent à leur démarrage.
- À chaque dépôt, le **temps consommé est inscrit dans le chat** : *« Nouvelle ébauche déposée (temps : 11h 52min) »*.

### 6.5 Règle stricte

Le dessinateur **ne peut en aucun cas rallonger** un délai.

---

## 7. Retouches

- **10 retouches incluses par plan.**
- Au‑delà, le client achète des **packs de retouches** supplémentaires, dont le **prix est fixé par le dessinateur**.
- Chaque tour de retouche dispose de son propre délai (cf. §6.3).
- Le montant des packs s'ajoute au **total final** de la commande (réglé à la validation).

---

## 8. Pénalités de retard

Le dessinateur ne pouvant pas rallonger le délai, tout dépassement entraîne **automatiquement** :

1. un **déclassement** : recalcul du prix au **format réellement tenu** (ex. une 24h livrée dans la plage des 48h est retarifée au coefficient 48h) ;
2. un **malus** appliqué **par‑dessus**, selon le **format commandé** :

| Format commandé | Malus |
|---|---|
| 24h | −15 % |
| 48h | −10 % |
| 72h | −7 % |
| Normale | −5 % |
| Au‑delà de 7 j | aucun |

Le malus est une **réduction au profit du client**. Le paiement intervenant **à la fin**, la pénalité est simplement **déduite du montant final** — aucun remboursement à gérer.

> **Hypothèse retenue :** déclassement **puis** malus. **À valider :** le déclenchement exact (dépassement de la première ébauche, ou de n'importe quelle étape).

---

## 9. Parcours de commande (2 étapes)

**Étape 1 — Plans & estimation :** le client ajoute tous les plans (type, format papier, etc.), choisit son **dessinateur** et le **format de délai**. S'affichent alors : le **prix** (HT/TVA/TTC), le **délai** et les **horaires du dessinateur** avec la **date/heure de livraison** de la première ébauche.

**Étape 2 — Coordonnées & validation :** adresse, téléphone et informations de la commande, puis **validation de la création**. *(Aucun paiement à ce stade.)*

**Ajout d'un plan en cours de commande :** reste **sur la même commande**. Le supplément **s'ajoute au total**, et le **délai est réinitialisé** (le budget de la première ébauche repart à zéro à partir de l'ajout).

---

## 10. Cycle de vie de la commande

Statuts (existants) : `En attente` → `Commencé` → `Ébauche déposée` → `Modification dessinateur` → `Validation en cours` → `Validé`.

**Prise en charge par le dessinateur.** Après création, la commande est en attente de **validation de prise en charge** par le dessinateur. Il peut :

- **accepter** la commande → la prise en charge **démarre le chrono** de la première ébauche ;
- **demander une correction au client** s'il estime la commande inadaptée (ex. le client a saisi un A3 mais le plan relève d'un A2) → la commande retourne au client pour modification, puis est resoumise.

Ensuite : dépôt des **plans finaux sous filigrane** (« Validation en cours ») → le client **valide** → **paiement par carte** → **déblocage automatique** des fichiers sans filigrane → `Validé`.

La **date retenue pour les statistiques / la facture** est celle du **dépôt des plans finaux** (le retard du dessinateur reste ainsi pénalisable).

---

## 11. Paiement

### 11.1 Principe

- **Paiement par carte, à la validation client** (fin de commande). Le client paie pour **débloquer les plans non filigranés**.
- Le **montant est calculé une seule fois**, au moment de la validation, quand tout est connu (plans, ajouts, retouches, pénalités).
- **La société encaisse** et **reverse au dessinateur** via un **découpage type Stripe Connect (destination charge)** : un seul paiement, réparti automatiquement entre la **part du dessinateur** et la **commission** de la société. Pas de porte‑monnaie permanent.

### 11.2 Montant final

```
Montant HT = Σ (prix grille[type, format papier] × coefficient[format délai])
           + annexes/déclinaisons + packs de retouches éventuels
Montant HT = Montant HT × (1 − malus)        si retard (après déclassement)
TVA        = Montant HT × taux_tva(dessinateur)
Montant TTC = Montant HT + TVA
```

### 11.3 Facture & vérification des comptes

- Une **facture par commande** est émise à la validation.
- Les clients étant des **sociétés vérifiées** (SIREN, raison sociale validés par l'admin), le risque d'impayé est faible ; le paiement carte fournit en outre la **preuve** de règlement.
- Les **dessinateurs** sont onboardés comme **comptes connectés** (vérification d'identité requise pour les versements).

### 11.4 Commande non aboutie

Si le client n'aboutit jamais (ne valide pas / ne paie pas) : le travail reste **filigrané et verrouillé** (le client ne peut rien exploiter). **Pas de fermeture automatique** ; en revanche le **dessinateur peut déposer une réclamation / une demande à l'admin** pour faire intervenir et débloquer la situation.

> **À valider avec un comptable / juriste :** structure d'encaissement‑reversement (qui émet la facture au client : la société ou le dessinateur ?), TVA, configuration du compte Stripe Connect.

---

## 12. Protection des livrables

- Les fichiers de plans passent en **stockage privé** (ils sont **publics aujourd'hui** — correctif de sécurité indispensable) : **rien n'est téléchargeable propre avant paiement**.
- Le client visualise **et peut télécharger** un **aperçu filigrané automatique** (PDF / image) marqué **« ÉBAUCHE »**, afin de le **transmettre à son propre client** pour validation. *(Faisable côté plateforme.)*
- Les fichiers **CAO (.dwg / .dxf)** ne sont pas filigranables automatiquement : ils restent **verrouillés** jusqu'au paiement ; le document filigrané téléchargeable est alors le **rendu PDF / image**.
- **Au paiement → déblocage automatique** des fichiers propres (tous formats).

---

## 13. Statistiques

Côté **client** comme côté **dessinateur** : chiffre d'affaires / dépenses **par mois** et **par dessinateur**, historique des factures.

---

## 14. Notifications

Réutilisation du mécanisme e‑mail existant (Resend via fonction `send-email`). Nouveaux événements : tarifs / disponibilités approuvés ou refusés, demande de prise en charge / correction, paiement reçu et facture (client), réclamation (admin).

---

## Annexe technique

### A. Modèle de données (ajouts)

**`profiles` (dessinateur) :** jours de travail, heure début/fin, identifiant compte connecté Stripe.

**`tarifs_dessinateur`** : `dessinateur_id` (PK), `taux_tva`, `coef_24h`, `coef_48h`, `coef_72h`, `coef_normale`, `actif`.

**`tarifs_grille`** : `dessinateur_id`, `type_plan`, `format`, `prix_principal_ht`, `prix_annexe_ht`. Unique (dessinateur_id, type_plan, format). *(Structure principal/annexe à confirmer — §5.2.)*

**`tarifs_demandes`** : workflow d'approbation des tarifs **et des disponibilités** (`statut`, `payload` JSONB, `commentaire_admin`, horodatages).

**`commandes` (ajouts)** : `format_delai`, `pris_en_charge_at`, `montant_base`, `coef_delai`, `malus_pct`, `montant_ht`, `taux_tva`, `montant_tva`, `montant_ttc`, `lignes_facturation` (JSONB, avec principal/annexe), `deadline_ebauche`, `date_depot_finaux`, `statut_paiement`, `stripe_payment_intent_id`, `numero_facture`.

**`commande_evenements`** : journal des transitions de statut (horodaté) → calcul du **temps dessinateur** par étape (en pause hors heures ouvrées / hors responsabilité dessinateur) et des **pénalités**.

**`commande_retouches`** : compteur de retouches par plan + packs achetés.

**`factures`** : `numero`, `commande_id`, `montant_ht/tva/ttc`, `date_emission`.

### B. Impacts applicatifs

- **`NouvelleCommandeModal`** : passage en **2 étapes** ; sélection du format de délai ; distinction **principal / annexe** (selon réponse dessinatrice) ; **affichage prix + délai + date/heure de livraison**.
- **`ModalDetailCommande` / `DetailCommandeModal`** : **validation de prise en charge** (accepter / demander une correction au client) ; dépôt des plans finaux filigranés ; **paywall** (paiement → déblocage) ; affichage du montant et du chrono ; **journal du temps** dans le chat ; **réclamation / demande admin**.
- **Compte dessinateur** : onglets **Tarifs** (grille + TVA + coefficients), **Disponibilités** (→ demande validée par l'admin), **Facturation/Stats**.
- **Compte client** : onglet **Facturation/Stats** ; **téléchargement de l'ébauche filigranée**.
- **`GestionUtilisateurs`** (admin) : validation des **demandes de tarifs / disponibilités**, supervision des paiements/factures, traitement des **réclamations**.
- **Stockage** : bucket de plans **privé** + **liens signés** conditionnés au paiement ; génération d'**aperçus filigranés** (« ÉBAUCHE », PDF/image, téléchargeables).
- **Paiement** : intégration **Stripe Connect** (comptes connectés, destination charges, commission), webhooks → déblocage.

### C. Points à valider

1. Structure de prix d'un plan : **plan principal vs annexes/déclinaisons** — à définir avec la dessinatrice (§5.2).
2. Mécanisme prix × format de délai (coefficient vs grille distincte) — §5.4.
3. Déclenchement exact des pénalités (première ébauche vs toute étape) — §8.
4. Structure juridique encaissement / facturation / TVA (Stripe Connect) — §11.4.
