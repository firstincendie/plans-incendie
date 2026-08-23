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

## 📱💻 Ordinateur ET téléphone
Le site est surtout utilisé sur **ordinateur** (admins, dessinateurs), mais il doit **aussi** rester correct sur **téléphone**. Avant de publier une modif visuelle, **vérifier les deux** : ~1280 px (ordinateur) et ~375 px (téléphone). Jamais de défilement horizontal sur téléphone.
(Si un doute sur l'appareil principal, demander à Simon.)

## ✂️ Aller à l'essentiel — peu de texte à l'écran
Simon sait ce qu'il crée : ne pas réexpliquer l'appli à l'écran. Mettre le **minimum d'infos**, des titres de colonnes courts. Une précision utile → en **info-bulle** (`title`), pas en gros texte.

## 🎨 Couleurs des statuts (source unique)
Les statuts des commandes ont **toujours** la même couleur, définie **une seule fois** dans `src/constants.js` (`STATUT_STYLE`). Toujours réutiliser cette source, **jamais** une couleur écrite en dur ailleurs.

| Statut | (défini dans `STATUT_STYLE`) |
|---|---|
| En attente | jaune |
| Commencé | bleu |
| Ébauche déposée | violet |
| Modification dessinateur | rose/rouge |
| Validation en cours | vert clair |
| Validé | vert |

Les listes de choix (types de plan, formats, matières, motifs de ticket…) sont aussi dans `src/constants.js` : les modifier **là**, pas en dur dans un écran.

## 🚫 Préférence : éviter les emojis dans l'appli
Simon n'aime pas les emojis dans l'interface. Il en reste quelques-uns (📄, 📁, 🔒…) : les **remplacer petit à petit par de vraies icônes** (SVG propre) quand on retouche un écran. (Cette règle concerne l'appli, **pas** ce fichier de notes.)

## 🔢 Système de version
La version de l'appli est le champ `"version"` de **`package.json`** (aujourd'hui **2.12.0**). Elle est affichée en bas de la barre latérale (`src/components/Sidebar.js` lit `package.json`).
Format `MAJEUR.MINEUR.CORRECTIF`. **À chaque vraie livraison, augmenter la version** puis faire un commit clair `release: vX.Y.Z — ...` :
- **Correctif** (ex. `2.12.0`→`2.12.1`) : petite retouche (bug, ajustement, texte).
- **Mineur** (ex. `2.12.3`→`2.13.0`) : une nouveauté.
- **Majeur** (ex. `2.14.1`→`3.0.0`) : très gros changement / refonte.

## 🚀 Publier en ligne (Vercel) — DEUX niveaux
- 🧪 **TEST** : pour essayer une modif en ligne sans toucher au site officiel → publier une version **preview**. Deux façons : pousser sur une branche autre que `main` (Vercel crée une URL de test), ou en local `vercel` (Vercel CLI).
- ✅ **OFFICIEL / incendieplan.fr** : **seulement si Simon le demande** (« passe en prod », « publie en officiel »). **Jamais automatiquement.** Concrètement : amener le code voulu sur la branche de production Vercel, ou `vercel --prod` en local.
- ⚠️ **À confirmer une fois avec Simon** : la « Production Branch » réglée dans Vercel (le dernier déploiement officiel venait de `staging`, en avril). Vérifier dans Vercel → Settings → Git avant la première vraie mise en prod, pour publier la bonne branche sur incendieplan.fr.
- Détails pas-à-pas (Windows) : `DEPLOIEMENT.md` à la racine.

## 📌 Règle « dernière version »
Ce dépôt fait foi. On modifie les fichiers **sur place** (jamais de copie « fichier-v2 » à côté). On fait des commits clairs, et on garde GitHub à jour (sauvegarde).

## 🗂️ Où se trouve quoi (ouvrir seulement si besoin)
- `src/components/` — tous les écrans et morceaux d'écran (React). Points d'entrée utiles :
  - `AppRouter.js` — la liste des pages (routes) : `/commandes`, `/commandes/archives`, `/reglages`, `/mon-compte`, `/utilisateurs`, `/gestion`, + pages de connexion.
  - `ListeCommandes.js`, `ModalDetailCommande.js`, `NouvelleCommandeModal.js` — le cœur : les commandes de plans.
  - `Messagerie.js`, `TicketChat.js` — les discussions / le support.
  - `PageReglages.js` — les réglages. **Réflexe** : si une modif touche un texte, un lien, un délai, un on/off → se demander si ça a sa place dans les Réglages plutôt qu'en dur.
  - `GestionUtilisateurs.js`, `RequireAuth.js`, `RequireRole.js` — les comptes et les accès (rôles `admin` / `utilisateur`).
  - `HistoriqueVersions.js`, `ZoneUpload.js`, `PiecesJointes.js` — le dépôt et l'affichage des fichiers de plans.
- `src/constants.js` — statuts, couleurs, types de plan, formats, matières, motifs (à modifier ici en priorité).
- `src/supabase.js` — connexion à la base.
- `supabase/functions/` — les emails et notifications automatiques (côté serveur).
- `DEPLOIEMENT.md` — comment publier (local → test → incendieplan.fr).

## ⚙️ Comment lancer en local (rappel)
Dans le dossier du projet : `npm install` (une fois), puis `npm start` → le site s'ouvre sur http://localhost:3000. Pour vérifier que tout se construit : `npm run build`.
