# Spec — Redesign panneau de détail des commandes

**Date :** 2026-03-24
**Périmètre :** VueUtilisateur, VueDessinateur

---

## Objectif

Remplacer le panneau de détail inline (sous la liste) par une **popup modale** avec un layout 2 colonnes sur desktop et onglets sur mobile. Enrichir les informations affichées et ajouter la fonction d'archivage.

---

## Layout général

### Desktop (> 768px)
- Popup modale centrée : **90% de largeur**, **90vh de hauteur**, border-radius 14px, fond semi-transparent derrière
- **Colonne gauche (70%)** : informations de la commande, scrollable
- **Colonne droite (30%)** : messagerie, hauteur fixe avec scroll interne
- Fermeture : bouton ✕ ou clic en dehors

### Mobile (≤ 768px)
- Popup **plein écran** (width: 100%, height: 100%, border-radius: 0)
- **Onglets** en haut : "📋 Infos" / "💬 Chat" (badge orange avec nb messages)
- Onglet Infos : scroll vertical, tout le contenu
- Onglet Chat : messagerie avec input sticky en bas

---

## Header de la popup (commun desktop + mobile)

- **Titre** : `nom_plan`
- **Sous-titre** : `Prénom NOM — CMD-XXX` (prénom+nom du profil utilisateur, ou client_prenom+client_nom en fallback)
- **Boutons uniformes** (même hauteur 36px) : badge statut | ••• | ✕

### Menu ••• (dropdown)
- 📋 Dupliquer la commande *(non implémenté dans ce sprint, juste affiché)*
- Séparateur
- 🗃️ Archiver la commande → passe le statut à `"Archivé"`, ferme la modal

---

## Vue Utilisateur (VueUtilisateur.js)

### Liste des commandes — ligne
- Sous le `nom_plan` : afficher `Prénom NOM — CMD-XXX` au lieu de juste `CMD-XXX`
  - Prénom/Nom = profil du `utilisateur_id` (via `sousComptes`) ou `profil.prenom profil.nom` pour le compte principal

### Colonne gauche de la popup

**Section Informations** (3 cartes) :
- Créé le
- Délai : date + "(X jours restants)" — rouge si ≤ 3 jours, orange sinon
- Nb. plans

**Adresse + Contacts** (2 colonnes côte à côte) :
- Adresse : `adresse1`, `adresse2`, `code_postal ville`
- Contacts : Nom client, Email (lien `mailto:`), Téléphone (lien `tel:`)

**Plans à réaliser** (tableau lecture seule) :
- Colonnes : N° | Type de plan | Orientation | Format
- Données depuis `selected.plans[]`

**Accordéon : 📄 Fichiers du plan (N)**
- Affiche `selected.fichiersPlan[]`
- Fermé par défaut

**Accordéon : 📐 Plans partagés par le dessinateur (N)**
- Affiche les fichiers des versions (`versionsSelected`) — tous les fichiers de toutes les versions
- Fond bleu (`#EFF6FF`)
- Fermé par défaut

### Colonne droite (desktop) / Onglet Chat (mobile)

- Messagerie existante (`<Messagerie />`)
- First Incendie (admin/dessinateur) : fond bleu `#EFF6FF`, bordure `#BFDBFE`
- Utilisateur : fond blanc, bordure `#E5E7EB`

### Section Archivées
- Même pattern que "Validées" : bouton toggle "▼ Voir les N commandes archivées"
- Filtre : `statut === "Archivé"`

---

## Vue Dessinateur (VueDessinateur.js)

### Liste — ligne
- Sous le `nom_plan` : afficher `Prénom NOM — CMD-XXX`
  - Prénom/Nom = `client_prenom client_nom` de la commande (ou profil utilisateur si disponible)

### Colonne gauche de la popup

**Section Informations** : identique vue utilisateur

**Adresse uniquement** (pas de contacts) : 1 colonne pleine largeur

**Plans à réaliser** (tableau lecture seule) : identique vue utilisateur

**Accordéon : 📄 Fichiers sources (N)** : `selected.fichiersPlan[]`

**Accordéon : 📐 Plans partagés (N)** : fichiers des versions

Pas de menu ••• (pas d'archivage côté dessinateur).

---

## Base de données

Aucun changement de schéma. Le statut `"Archivé"` est une nouvelle valeur string dans la colonne `statut` existante (comme `"Validé"`).

---

## Responsive — règle de breakpoint

`@media (max-width: 768px)` — géré en CSS pur, pas de JS pour détecter la taille d'écran.

---

## Ce qui ne change PAS

- Composant `<Messagerie />` : aucune modification
- Composant `<HistoriqueVersions />` : supprimé du détail (remplacé par l'accordéon "Plans partagés")
- Composant `<BlocAdresse />` : réutilisé tel quel
- Formulaire "Nouvelle commande" : inchangé
- Vue Admin (App.js) : hors périmètre
