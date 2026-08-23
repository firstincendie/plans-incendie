# Incendie Plan (incendieplan.fr) — carte du projet

## ⚠️ Comment me parler (IMPORTANT)
Simon ne connaît **rien** au code. Parle-lui **comme à un enfant de 10 ans** :
- zéro jargon technique (ou alors explique le mot tout de suite, avec une image simple) ;
- des phrases courtes, une idée à la fois ;
- avant une action, dis en 1 phrase **ce que tu vas faire et pourquoi** ;
- propose toujours la **prochaine petite étape**, sans tout faire d'un coup ;
- Simon est souvent sous **Windows** (invite de commandes) — donner les commandes Windows (`ren`, `move`…), pas Mac/Linux (`mv`).

## ⛔ Projet séparé
Ce projet, c'est **uniquement** ce site : **Incendie Plan**, en ligne sur **incendieplan.fr**.
Il existe un **autre** projet, sans rapport : le tableau de bord des commerciaux (« First Incendie App », `app.firstincendie.com`). On n'y touche pas et on n'en parle pas ici.

## Le projet en une phrase
Un site pour **commander et suivre des plans incendie** (plans d'évacuation, d'intervention, SSI, plan de masse) : le client passe commande, le dessinateur dépose ses versions, on échange, le client valide.

## 🌿 Les branches (IMPORTANT — la situation réelle)
Le code vit sur GitHub (`firstincendie/plans-incendie`) avec plusieurs « versions » appelées branches :
- **`main`** = la **branche officielle** (les « releases »). C'est notre base de travail actuelle. Contient tout jusqu'à la v2.12.0 + la fonction chat (Ctrl+Entrée).
- **`dev`** = travail en cours. Contient une grosse fonctionnalité **« validation client »** (page publique `/validation`, envoi par email, historique…) faite en juillet, **jamais fusionnée dans main ni mise en ligne**. À intégrer un jour, sur demande de Simon.
- ⚠️ **Ce qui est EN LIGNE sur incendieplan.fr est une version d'avril** (elle était déployée depuis une branche `staging` aujourd'hui supprimée). Autrement dit : **le site public est en retard** sur `main`. Quand Simon voudra mettre le site à jour, il faudra publier `main` (voir « Publier en ligne »).

Règle : on travaille sur **`main`** sauf demande contraire. On ne mélange pas `dev` et `main` sans le dire à Simon.

## ☁️ Comptes et services externes
- **Supabase** = la base de données + les connexions + les emails automatiques. Le lien et la clé publique sont dans `src/supabase.js`. Les emails et notifications sont des « edge functions » dans `supabase/functions/` (ex. `notify-commande`, `send-email`, `invite-user`…).
- **Vercel** = l'hébergeur qui met le site en ligne. Le domaine **incendieplan.fr** est branché dessus.
- **GitHub** = le « coffre-fort » du code (source + historique). Même si on déploie autrement, on garde GitHub à jour pour ne rien perdre.

---

# 🎨 LES RÈGLES DE STYLE (à respecter TOUJOURS)

## 📱 Mobile first (RÈGLE TRÈS IMPORTANTE)
On pense **téléphone d'abord**, puis on **adapte vraiment** à l'ordinateur (obligatoire aussi) — pas juste une bande étroite perdue au milieu du grand écran.
- **Téléphone** : boutons/zones assez grands (doigt), texte lisible sans zoomer, **jamais** de défilement horizontal.
- **Ordinateur** : utiliser toute la largeur intelligemment (menu latéral fixe, infos sur 2 colonnes…), pas de bande étroite centrée.
- **Toujours vérifier les DEUX rendus avant de publier** : ~375 px (téléphone) **et** ~1280 px (ordinateur).

## 🚫 Zéro emoji dans l'appli — de vraies icônes (RÈGLE IMPORTANTE)
Dans l'appli, **aucun emoji** : Simon les trouve horribles. On utilise de **vraies icônes** (SVG propre) — pour les boutons, les pastilles, les statuts, les menus…
- Remplacer les emojis existants (📄, 📁, 🔒…) par des icônes SVG **au fil de l'eau**, quand on touche un écran.
- Icônes sobres et cohérentes (trait fin, couleur `currentColor`, taille régulière).
- (Cette règle concerne l'appli, **pas** ce fichier de notes — ici les emojis servent juste de repères.)

## ✂️ Aller à l'essentiel — zéro texte explicatif (RÈGLE IMPORTANTE)
Simon **sait ce qu'il crée** : ne jamais réexpliquer l'appli à l'écran. Mettre le **minimum d'infos**.
- **Pas de phrases d'explication** dans l'appli (« à quoi sert cet onglet », modes d'emploi sous les champs…). Un écran bien fait se comprend sans notice.
- **Noms de colonnes courts** : un seul mot quand c'est possible.
- Une précision vraiment utile → en **info-bulle** (`title`), pas en texte visible.

## 📊 Tous les tableaux se ressemblent (RÈGLE IMPORTANTE)
Chaque tableau doit être fait **exactement pareil** (même recette), en prenant comme modèle le tableau principal du site (la **liste des commandes**) :
- des **colonnes** avec un titre en haut ;
- **cliquer sur un titre de colonne pour trier** (croissant / décroissant) ;
- **pagination** (composant `Pagination.js`) : jamais 500 lignes d'un coup, on tourne les pages ;
- **même look** (couleurs, espacement, boutons) que les autres tableaux ;
- et bien sûr **mobile + ordinateur**.
But : tous les tableaux ont la même tête et se manipulent pareil.

## 🗂️ Couper en onglets (RÈGLE IMPORTANTE)
Dès qu'une page a **beaucoup d'infos**, on la **découpe en plusieurs onglets** — jamais tout empilé sur une seule page.
- Même look et même façon de changer d'onglet partout.
- On garde en mémoire **quel onglet est ouvert**, et bien sûr **mobile + ordinateur**.
But : ne jamais noyer Simon sous trop d'infos d'un coup ; une page = une idée à la fois.

## 🎨 Couleurs des statuts (source unique)
Les statuts des commandes ont **toujours** la même couleur, définie **une seule fois** dans `src/constants.js` (`STATUT_STYLE`). Toujours réutiliser cette source, **jamais** une couleur écrite en dur ailleurs.

| Statut | Couleur (dans `STATUT_STYLE`) |
|---|---|
| En attente | jaune |
| Commencé | bleu |
| Ébauche déposée | violet |
| Modification dessinateur | rose/rouge |
| Validation en cours | vert clair |
| Validé | vert |

Les listes de choix (types de plan, formats, matières, motifs…) sont aussi dans `src/constants.js` : les modifier **là**, pas en dur dans un écran.

## ⚙️ Toujours penser « Réglages » (RÈGLE IMPORTANTE)
À **chaque** modif, se poser 2 questions avant de coder :
1. **Est-ce réglable ?** (un texte, un lien, un délai, un on/off…) → si oui, ça a plutôt sa place dans la page **« Réglages »**, pas en dur dans le code.
2. **À quel niveau ?** Qui peut le régler et qui est concerné (l'admin ? chaque utilisateur ? toute l'appli ?).
Toujours **proposer la question à Simon** (« on met ça dans les Réglages ? et pour qui ? ») au lieu de décider tout seul.

## ⚡ Toujours optimiser la vitesse (RÈGLE IMPORTANTE)
La rapidité est primordiale (souvent utilisé au téléphone, parfois en 4G). Principe : **aucune dépendance extérieure au chargement**.
- Le site est construit avec React (`npm run build`) : les librairies sont déjà **empaquetées dans le build** et servies par Vercel — ne pas ajouter de `<script>`/`<link>` vers un site tiers (CDN, `fonts.googleapis.com`, `unpkg`, `jsdelivr`, `esm.sh`).
- **Polices** : à héberger avec le site, pas de lien Google Fonts.
- **Charger à la demande** ce qui est lourd et ne sert pas au démarrage.
- **Vérifier après coup** : la page se charge avec **0 ressource externe**.
But : premier chargement rapide **et** appli qui marche même si un site tiers tombe.

---

## 🔢 Système de version
La version de l'appli est le champ `"version"` de **`package.json`** (aujourd'hui **2.12.0**). Elle est affichée en bas de la barre latérale (`src/components/Sidebar.js` lit `package.json`).
Format `MAJEUR.MINEUR.CORRECTIF`. **À chaque vraie livraison, augmenter la version** puis faire un commit clair `release: vX.Y.Z — ...` :
- **Correctif** (`2.12.0`→`2.12.1`) : petite retouche (bug, ajustement, texte).
- **Mineur** (`2.12.3`→`2.13.0`) : une nouveauté.
- **Majeur** (`2.14.1`→`3.0.0`) : très gros changement / refonte.

## 🚀 Publier en ligne (Vercel) — DEUX niveaux
- 🧪 **TEST** : essayer une modif en ligne sans toucher au site officiel → version **preview** (pousser sur une branche autre que `main`, ou `vercel` en local).
- ✅ **OFFICIEL / incendieplan.fr** : **seulement si Simon le demande** (« passe en prod », « publie en officiel »). **Jamais automatiquement.**
- ⚠️ **À confirmer une fois avec Simon** : la « Production Branch » dans Vercel (le dernier déploiement officiel venait de `staging`, en avril). Vérifier Vercel → Settings → Git avant la première vraie mise en prod.
- Détails pas-à-pas (Windows) : `DEPLOIEMENT.md` à la racine.

## 📌 Règle « dernière version »
Ce dépôt fait foi. On modifie les fichiers **sur place** (jamais de copie « fichier-v2 » à côté). Commits clairs, et on garde GitHub à jour (sauvegarde).

## 🗂️ Où se trouve quoi (ouvrir seulement si besoin)
- `src/components/` — tous les écrans (React) :
  - `AppRouter.js` — la liste des pages : `/commandes`, `/commandes/archives`, `/reglages`, `/mon-compte`, `/utilisateurs`, `/gestion`, + connexion.
  - `ListeCommandes.js`, `ModalDetailCommande.js`, `NouvelleCommandeModal.js` — le cœur : les commandes de plans. **Le tableau des commandes est le modèle pour tous les tableaux.**
  - `Pagination.js`, `BarreFiltres.js`, `TableauPlans.js` — briques de tableau/filtre réutilisables.
  - `Messagerie.js`, `TicketChat.js` — discussions / support.
  - `PageReglages.js` — les réglages (penser à y mettre tout ce qui est réglable).
  - `GestionUtilisateurs.js`, `RequireAuth.js`, `RequireRole.js` — comptes et accès (rôles `admin` / `utilisateur`).
  - `HistoriqueVersions.js`, `ZoneUpload.js`, `PiecesJointes.js` — dépôt et affichage des fichiers de plans.
- `src/constants.js` — statuts, couleurs, types de plan, formats, matières, motifs (à modifier ici en priorité).
- `src/supabase.js` — connexion à la base.
- `supabase/functions/` — emails et notifications automatiques (côté serveur).
- `DEPLOIEMENT.md` — comment publier (local → test → incendieplan.fr).

## ⚙️ Comment lancer en local (rappel)
Dans le dossier du projet : `npm install` (une fois), puis `npm start` → le site s'ouvre sur http://localhost:3000. Pour vérifier que tout se construit : `npm run build`.
