# Cahier des charges — Tarification & Paiement

**Produit :** Plans‑Incendie · **Date :** 2026‑05‑25 · **Version :** 1.4 · **Statut :** À valider

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

**Inclus :** grille de prix par dessinateur, plans principaux & déclinaisons, formats de délai et SLA, pénalités, modifications, validation de prise en charge par le dessinateur, parcours de commande en 2 étapes, paiement carte + reversement, facture par commande, filigrane et stockage privé, statistiques.

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
- **Plan principal** : plan détaillé complet, facturé au **plein tarif** (type × format).
- **Déclinaison** : plan **dérivé** d'un principal — **d'intervention ou d'évacuation** —, réutilisant le travail (souvent en déplaçant le « Vous êtes ici ») → **tarif réduit forfaitaire**.
- **Déclassement** : recalcul automatique du prix au format réellement tenu quand le dessinateur est en retard.
- **Filigrane** : marquage visible **« ÉBAUCHE »** sur l'aperçu et le document téléchargeable, retiré après paiement.
- **Destination charge (Stripe Connect)** : le client paie une fois ; le prestataire répartit automatiquement la part du dessinateur et la commission de la société, sans porte‑monnaie permanent.

---

## 5. Catalogue & tarification

### 5.1 Types de plans

`Évacuation`, `Intervention`, `Plan de masse`. *(Le type « SSI » a été retiré du catalogue.)*

### 5.2 Plans principaux & déclinaisons

Une même base de travail sert souvent à produire plusieurs plans : le dessinateur réalise un plan, puis le **décline** (il ne recommence pas de zéro). On distingue donc :

- **Plan principal** : plan complet, **plein tarif** selon (type × format).
- **Déclinaison** : plan **dérivé** d'un principal, **d'intervention ou d'évacuation** (ex. une évacuation tirée de l'intervention, ou une copie où seul le « Vous êtes ici » change de place) → **tarif réduit forfaitaire**, **identique quel que soit son format ou son type**.

**Règles :**

- Un **Plan de masse** est **toujours principal et autonome** : il ne peut **jamais** être une déclinaison, et on ne lui rattache pas de déclinaison.
- Une déclinaison est rattachée à un principal **Intervention** ou **Évacuation**, et peut elle‑même être de type **Intervention** ou **Évacuation**.

**Composition à la commande (étape 1) :**

- Le client ajoute un **plan principal** (type + format → plein tarif).
- Sous un principal Intervention / Évacuation, il ajoute des **déclinaisons** (bouton « + Ajouter une déclinaison »), chacune avec son **type** (intervention ou évacuation), **format, orientation, matière et emplacement** → tarif déclinaison.
- Le client peut créer **plusieurs principaux** (bouton « + Ajouter un plan »), chacun avec ses déclinaisons.
- À la **prise en charge**, le dessinateur ne modifie pas lui‑même la commande : il peut **demander un changement** (format, requalification principal ↔ déclinaison, etc.) avec un commentaire ; **c'est le client qui modifie** sa commande (cf. §10).

Structure type :

```
• Plan intervention — A3 — Horizontal — Bâche        [principal]
     - Plan intervention — A3 — Horizontal — Bâche   [déclinaison]
     - Plan évacuation  — A3 — Horizontal — Bâche    [déclinaison]
     - + Ajouter une déclinaison
• Plan de masse — A2 — Vertical — PVC                [principal autonome]
+ Ajouter un plan
```

**Exemples :**

- *1 plan d'intervention A3 + 4 plans d'évacuation A4 (déclinaisons)* → 6 € + 4 × 5 € = **26 € HT** (× coefficient de délai).
- *3 plans d'évacuation (1 principal A3 + 2 déclinaisons)* → 6 € + 2 × 5 € = **16 € HT**.
- *1 plan d'évacuation A3 seul, en 48h* → 6 € × 1,5 = **9 € HT** (un plan seul n'a pas de surcoût).

### 5.3 Grille de prix des plans principaux (par dessinateur)

Prix **HT** du plan principal, tarif **« normale »**, par couple **(type × format papier)**. **A3 = tarif de référence** ; le prix **augmente avec la taille du format** (un plan plus grand = plus chargé).

| Type \ Format | A4 | **A3 (réf.)** | A2 | A1 | A0 |
|---|---|---|---|---|---|
| Intervention / Évacuation | … | 6 € | … | … | … |
| Plan de masse | … | … | … | … | … |

Règles : **tous les prix obligatoires et > 0 €** (grille incomplète = non activable) ; la **matière** et l'**orientation** n'influencent pas le prix.

### 5.4 Tarif de déclinaison

Forfait **unique** par déclinaison (ex. **5 €**), **fixé par le dessinateur**, indépendant du format et du type.

### 5.5 Formats de délai et prix

Le prix dépend aussi du **format de délai**. La grille correspond au tarif **« normale »** ; chaque dessinateur définit un **coefficient multiplicateur** appliqué au sous‑total des plans.

| Format | Coefficient (exemple) |
|---|---|
| Normale (7 j) | ×1,0 |
| 72h | ×1,2 |
| 48h | ×1,5 |
| 24h | ×2,0 |

> **À valider :** mécanisme exact (coefficient multiplicateur — recommandé) vs grille distincte par format de délai.

### 5.6 TVA

Chaque dessinateur renseigne **son propre taux de TVA** (ex. 20 %), **0 %** possible (étranger / franchise).

### 5.7 Validation des tarifs et disponibilités

- L'**admin** peut saisir / corriger directement la grille d'un dessinateur (initialisation).
- Le **dessinateur** modifie sa grille / tarif de déclinaison / TVA / coefficients / **disponibilités**, puis **soumet une demande** ; les valeurs actives restent inchangées jusqu'à **approbation par l'admin**.

### 5.8 Prix verrouillé

Le prix est **verrouillé au devis**. Un changement de grille ultérieur **ne touche jamais** les commandes déjà passées.

---

## 6. Délais & engagements (SLA)

### 6.1 Principe du chrono

Le délai est un **budget de temps dessinateur**, décompté **uniquement pendant ses heures de travail** et **mis en pause** dès que la balle est dans le camp du client (relecture, demande de modification, envoi de fichiers). Le chrono de la **première ébauche démarre à la prise en charge** (cf. §10).

### 6.2 Disponibilités du dessinateur

Le dessinateur saisit ses **jours et heures de travail** (ex. lundi → samedi, 8h–19h), **soumis à validation de l'admin**. Ils servent à **calculer la date/heure exacte de livraison** affichée au client et à **décompter** le temps de travail.

### 6.3 SLA par étape

| Format | Première ébauche | Chaque modification | Plans finaux |
|---|---|---|---|
| 24h | 24h | 12h | 12h |
| 48h | 48h | 12h | 12h |
| 72h | 72h | 12h | 12h |
| Normale | 7 j | 24h | 24h |

### 6.4 Affichage & traçabilité

- **Compte à rebours** affiché sur chaque commande.
- **Deadline affichée** : seule celle de la **première ébauche** est annoncée à la commande ; les suivantes s'affichent à leur démarrage.
- À chaque dépôt, le **temps consommé est inscrit dans le chat** : *« Nouvelle ébauche déposée (temps : 11h 52min) »*.

### 6.5 Règle stricte

Le dessinateur **ne peut en aucun cas rallonger** un délai.

---

## 7. Modifications

- Les **modifications pendant l'élaboration** (échanges jusqu'à l'ébauche validée par le client) sont **incluses**.
- Les **modifications demandées après validation** sont **chiffrées au cas par cas** par le dessinateur : il ajoute une **ligne facturée** que le client accepte, ajoutée au total.
- Chaque tour de modification dispose de son propre délai (cf. §6.3).

---

## 8. Pénalités de retard

Le dessinateur ne pouvant pas rallonger le délai, tout dépassement entraîne **automatiquement** :

1. un **déclassement** : recalcul au **format réellement tenu** (ex. une 24h livrée dans la plage des 48h est retarifée au coefficient 48h) ;
2. un **malus** appliqué **par‑dessus**, selon le **format commandé** :

| Format commandé | Malus |
|---|---|
| 24h | −15 % |
| 48h | −10 % |
| 72h | −7 % |
| Normale | −5 % |
| Au‑delà de 7 j | aucun |

Le malus est une **réduction au profit du client**. Le paiement intervenant **à la fin**, la pénalité est **déduite du montant final** — aucun remboursement à gérer.

> **Hypothèse retenue :** déclassement **puis** malus. **À valider :** le déclenchement exact (première ébauche vs n'importe quelle étape).

---

## 9. Parcours de commande (2 étapes)

**Étape 1 — Plans & estimation :** le client compose la commande (**principaux + déclinaisons**, cf. §5.2), choisit son **dessinateur** et le **format de délai**. S'affichent : le **prix** (HT/TVA/TTC), le **délai** et les **horaires du dessinateur** avec la **date/heure de livraison** de la première ébauche.

**Étape 2 — Coordonnées & validation :** adresse, téléphone et informations, puis **validation de la création**. *(Aucun paiement à ce stade.)*

**Ajout d'un plan en cours de commande :** reste **sur la même commande** ; le supplément **s'ajoute au total** et le **délai est réinitialisé** (le budget de la première ébauche repart à zéro).

---

## 10. Cycle de vie de la commande

Statuts : `En attente` → (`Changement demandé`) → `Commencé` → `Ébauche déposée` → `Modification dessinateur` → `Validation en cours` → `Validé`. *(`Changement demandé` est un nouveau statut à ajouter.)*

**Prise en charge par le dessinateur.** À la création (statut `En attente`), le dessinateur examine la commande et choisit **l'une des deux actions** :

- **« Commencer »** → statut `Commencé` : le chrono de la première ébauche **démarre**.
- **« Demander un changement »** (avec **commentaire obligatoire**) → ex. « ce plan doit être en A2, pas en A3 » → la commande passe en **`Changement demandé`** et **retourne au client**. Le client **doit modifier sa commande** (le prix se recalcule) puis la **resoumettre** ; le dessinateur réexamine et peut à nouveau « Commencer » ou « Demander un changement ».

Cette boucle se répète jusqu'à ce que le dessinateur accepte (« Commencer »). Le **chrono ne démarre jamais** tant qu'un changement est en attente côté client.

Ensuite : dépôt des **plans finaux sous filigrane** → le client **valide** → **paiement par carte** → **déblocage automatique** des fichiers propres → `Validé`.

La **date retenue pour les statistiques / la facture** est celle du **dépôt des plans finaux**.

---

## 11. Paiement

### 11.1 Principe

- **Paiement par carte, à la validation client** (fin de commande), pour **débloquer les plans non filigranés**.
- Le **montant est calculé une seule fois**, quand tout est connu (plans, déclinaisons, ajouts, modifications, pénalités).
- **La société encaisse** et **reverse au dessinateur** via un **découpage type Stripe Connect (destination charge)** : un paiement unique, réparti entre la **part du dessinateur** et la **commission** de la société. Pas de porte‑monnaie permanent.

### 11.2 Montant final

```
Sous-total plans = Σ prix_principal[type, format] + (nb déclinaisons × tarif_déclinaison)
Montant HT       = Sous-total plans × coefficient[format délai]
Montant HT       = Montant HT × (1 - malus)        si retard (après déclassement)
Montant HT       = Montant HT + modifications post-validation éventuelles
TVA              = Montant HT × taux_tva(dessinateur)
Montant TTC      = Montant HT + TVA
```

### 11.3 Facture & vérification des comptes

- Une **facture par commande** est émise à la validation.
- Les clients étant des **sociétés vérifiées** (SIREN), le risque d'impayé est faible ; le paiement carte fournit la **preuve** de règlement.
- Les **dessinateurs** sont onboardés comme **comptes connectés** (vérification d'identité requise pour les versements).

### 11.4 Commande non aboutie

Si le client n'aboutit jamais : le travail reste **filigrané et verrouillé**. **Pas de fermeture automatique** ; le **dessinateur peut déposer une réclamation / demande à l'admin** pour débloquer la situation.

> **À valider avec un comptable / juriste :** structure d'encaissement‑reversement (qui émet la facture : société ou dessinateur ?), TVA, configuration Stripe Connect.

---

## 12. Protection des livrables

- Les fichiers de plans passent en **stockage privé** (ils sont **publics aujourd'hui** — correctif de sécurité indispensable) : **rien n'est téléchargeable propre avant paiement**.
- Le client visualise **et peut télécharger** un **aperçu filigrané automatique** (PDF / image) marqué **« ÉBAUCHE »**, pour le **transmettre à son propre client**. *(Faisable côté plateforme.)*
- Les fichiers **CAO (.dwg / .dxf)** ne sont pas filigranables automatiquement : **verrouillés** jusqu'au paiement ; le document filigrané téléchargeable est alors le **rendu PDF / image**.
- **Au paiement → déblocage automatique** des fichiers propres (tous formats).

---

## 13. Statistiques

Côté **client** comme **dessinateur** : chiffre d'affaires / dépenses **par mois** et **par dessinateur**, historique des factures.

---

## 14. Notifications

Réutilisation du mécanisme e‑mail existant (Resend via `send-email`). Nouveaux événements : tarifs / disponibilités approuvés ou refusés, demande de prise en charge / correction, paiement reçu et facture (client), réclamation (admin).

---

## Annexe technique

### A. Modèle de données (ajouts)

**`profiles` (dessinateur) :** jours de travail, heure début/fin, identifiant compte connecté Stripe.

**`tarifs_dessinateur`** : `dessinateur_id` (PK), `taux_tva`, `tarif_declinaison`, `coef_24h`, `coef_48h`, `coef_72h`, `coef_normale`, `actif`.

**`tarifs_grille`** : `dessinateur_id`, `type_plan`, `format`, `prix_ht` (plan principal). Unique (dessinateur_id, type_plan, format).

**`tarifs_demandes`** : workflow d'approbation des tarifs **et** des disponibilités (`statut`, `payload` JSONB, `commentaire_admin`, horodatages).

**`commandes` (ajouts)** : `format_delai`, `pris_en_charge_at`, `commentaire_changement`, `montant_base`, `coef_delai`, `malus_pct`, `montant_ht`, `taux_tva`, `montant_tva`, `montant_ttc`, `lignes_facturation` (JSONB : chaque ligne `principal | déclinaison`, type, format, prix), `deadline_ebauche`, `date_depot_finaux`, `statut_paiement`, `stripe_payment_intent_id`, `numero_facture`. Le champ `plans` exprime le **rattachement déclinaison → principal**. Nouveau statut **`Changement demandé`** à ajouter dans `constants.js`.

**`commande_evenements`** : journal des transitions de statut (horodaté) → calcul du **temps dessinateur** par étape et des **pénalités**.

**`factures`** : `numero`, `commande_id`, `montant_ht/tva/ttc`, `date_emission`.

### B. Impacts applicatifs

- **`NouvelleCommandeModal`** : **2 étapes** ; composition **principaux + déclinaisons** ; format de délai ; **affichage prix + délai + date/heure de livraison**.
- **`ModalDetailCommande` / `DetailCommandeModal`** : **prise en charge** (boutons **« Commencer »** ou **« Demander un changement »** + commentaire → le client modifie et resoumet) ; dépôt des plans finaux filigranés ; **paywall** ; affichage montant + chrono ; **journal du temps** ; **réclamation / demande admin**.
- **Compte dessinateur** : onglets **Tarifs** (grille + déclinaison + TVA + coefficients), **Disponibilités** (→ validation admin), **Facturation/Stats**.
- **Compte client** : onglet **Facturation/Stats** ; **téléchargement de l'ébauche filigranée**.
- **`GestionUtilisateurs`** (admin) : validation des **demandes de tarifs / disponibilités**, supervision paiements/factures, **réclamations**.
- **Stockage** : bucket de plans **privé** + **liens signés** conditionnés au paiement ; **aperçus filigranés** (« ÉBAUCHE », PDF/image, téléchargeables).
- **Paiement** : intégration **Stripe Connect** (comptes connectés, destination charges, commission), webhooks → déblocage.

### C. Points à valider

1. Mécanisme prix × format de délai (coefficient vs grille distincte) — §5.5.
2. Déclenchement exact des pénalités (première ébauche vs toute étape) — §8.
3. Structure juridique encaissement / facturation / TVA (Stripe Connect) — §11.4.
