# Spec : V2 — Routage par URL

**Date :** 2026-04-27
**Statut :** En revue
**Branche cible :** `V2`

## Contexte

L'application plans-incendie n'a aujourd'hui aucun routage par URL. Toute la navigation se fait via `useState` dans `App.js` et dans les composants `VueUtilisateur` / `VueDessinateur`. L'URL reste constamment `https://incendieplan.fr/` quel que soit l'écran affiché. Conséquences :

- Impossible de bookmarker une commande précise.
- Impossible de partager un lien vers une page (filtres, commande, réglage).
- Le bouton précédent du navigateur ne fonctionne pas comme attendu.
- Le rafraîchissement de la page ramène toujours sur l'écran d'accueil.

À terme, Simon souhaite faire valider les plans par les clients via un lien partageable. V2 ne livre pas cette fonctionnalité, mais pose l'**architecture de routage** qui la rendra possible.

## Objectifs

- Introduire un vrai système de routage par URL (`react-router-dom` v7).
- Définir une URL canonique pour chaque écran de l'application.
- Permettre de partager un lien vers une commande précise (`/commandes/REF-2024-0142`).
- Synchroniser les filtres de la liste avec l'URL pour pouvoir partager une vue filtrée.
- **Ne pas toucher au visuel** : on garde tous les composants existants, on ajoute juste le routage par-dessus.

## Hors-scope

- ❌ Refonte visuelle, nouveau design, nouveaux composants UI.
- ❌ Page publique de validation client (`/validation/<token>`) — futur chantier.
- ❌ Système de tokens partagés (génération, expiration, révocation).
- ❌ Dashboard distinct de la liste des commandes.
- ❌ Lazy loading / code splitting des routes.
- ❌ Tests automatisés du routage (à discuter séparément).
- ❌ Switcher de vue admin/dessinateur (n'existe plus dans la base actuelle).

## Stack et choix techniques

### Routeur : `react-router-dom` v7
- Supporte React 19 nativement.
- API stable (`<Routes>`, `<Route>`, `useParams`, `useSearchParams`, `useNavigate`).
- Bundle ~12 KB gzip (négligeable).
- Permet de gérer routes protégées, redirections, et synchronisation query params.

### Type de router : `<BrowserRouter>`
- URLs propres (`/commandes/REF-XXX`), pas de `#`.
- Compatible avec la config existante : `vercel.json` contient déjà la règle de rewrite SPA (`/(.*) → /index.html`), et le déploiement FTP sur `incendieplan.fr` devra recevoir une config équivalente (voir section "Déploiement").

### Identifiant d'URL pour une commande : la **référence**
- URL : `/commandes/REF-2024-0142`.
- Lisible, debuggable, parlant.
- Aucun risque d'exposition de données : V2 est intégralement protégé par auth. Les futurs liens clients passeront par un système de tokens séparé, pas par l'URL canonique.

## Architecture

### Hiérarchie générale

```
<BrowserRouter>
  <App>                                    ← gère session + profil + statut compte
    <Routes>
      ├── Routes publiques
      │   ├── /connexion              → PageConnexion
      │   ├── /inscription            → PageInscription
      │   ├── /mot-de-passe-oublie    → PageMotDePasseOublie
      │   └── /reset-mot-de-passe     → PageResetMotDePasse
      │
      └── <RequireAuth>                  ← garde toutes les routes connectées
          └── <LayoutPrincipal>         ← sidebar + zone contenu via <Outlet/>
              ├── /                       → redirige /commandes
              ├── /commandes              → ListeCommandes
              │   └── /:ref               → idem + ModalDetailCommande
              ├── /commandes/archives     → ListeArchives
              │   └── /:ref               → idem + ModalDetailCommande
              ├── /utilisateurs           → <RequireRole role="admin">/GestionUtilisateurs
              │   └── /:uid               → idem + modal user
              ├── /reglages               → PageReglages
              ├── /mon-compte             → PageMonCompte
              └── *                       → Page404
  </App>
</BrowserRouter>
```

### Composants nouveaux à créer

| Composant | Rôle |
|---|---|
| `<RequireAuth>` | Vérifie session + statut profil. Redirige vers `/connexion?redirect=...` si non auth. Si statut ≠ `actif`, affiche `<EcranEnAttente>` / `<EcranRefuse>` / `<EcranBanni>` à la place du contenu (URL conservée). |
| `<RequireRole role>` | Vérifie que `profil.role === role`. Redirige vers `/commandes` sinon. |
| `<LayoutPrincipal>` | Shell commun : sidebar + main. Filtre les items de sidebar selon `profil.role`. Rend `<Outlet/>`. Remplace `VueUtilisateur` et `VueDessinateur`. |
| `<Sidebar>` | Liste d'items, filtrée par rôle. |
| `<ListeCommandes>` | Extrait la logique "écran commandes" de `VueUtilisateur` / `VueDessinateur`. Charge les commandes, gère filtres via `useSearchParams`, rend `BarreFiltres` + tableau + `<Outlet/>` pour le modal. |
| `<ListeArchives>` | Idem `<ListeCommandes>` mais sur la vue archives. |
| `<ModalDetailCommande>` | Wrapper qui lit `useParams().ref`, fetch ou récupère la commande, et rend `DetailCommandeModal` avec `onFermer={() => navigate(parent)}`. |
| `<EcranEnAttente>` / `<EcranRefuse>` / `<EcranBanni>` | Extraction des écrans bloquants actuellement inline dans `App.js` lignes 88–137. |
| `<Page404>` | Page simple avec un lien retour `/commandes`. |

### Composants inchangés

`DetailCommandeModal`, `BarreFiltres`, `TableauPlans`, `Messagerie`, `HistoriqueVersions`, `ZoneUpload`, `VisuFichier`, `BlocAdresse`, `Badge`, `ChampCopiable`, `PageReglages`, `PageMonCompte`, `GestionUtilisateurs`, `GestionCompteDessinateur`, toutes les pages d'auth.

### Composants supprimés à la fin de la migration

`VueUtilisateur.js` et `VueDessinateur.js` disparaissent une fois que `<LayoutPrincipal>` couvre les deux rôles. Leur logique métier est extraite vers `<ListeCommandes>` (qui adapte son rendu selon `profil.role`, comme aujourd'hui).

## Sitemap détaillé

### Routes publiques (non connecté)

| URL | Composant | Notes |
|---|---|---|
| `/connexion` | `PageConnexion` | Si déjà connecté → redirige `/commandes`. Lit `?redirect=` après login. |
| `/inscription` | `PageInscription` | Idem. |
| `/mot-de-passe-oublie` | `PageMotDePasseOublie` | |
| `/reset-mot-de-passe` | `PageResetMotDePasse` | URL ajoutée à la whitelist Supabase Auth. |

### Routes protégées

| URL | Rôles | Composant |
|---|---|---|
| `/` | tous | redirige `/commandes` |
| `/commandes` | admin, dessinateur, client | `ListeCommandes` |
| `/commandes/:ref` | idem | `ListeCommandes` + `ModalDetailCommande` |
| `/commandes/archives` | admin, dessinateur | `ListeArchives` |
| `/commandes/archives/:ref` | idem | `ListeArchives` + `ModalDetailCommande` |
| `/utilisateurs` | admin uniquement | `GestionUtilisateurs` |
| `/utilisateurs/:uid` | admin uniquement | `GestionUtilisateurs` + modal user |
| `/reglages` | tous | `PageReglages` |
| `/mon-compte` | tous | `PageMonCompte` |
| `*` | tous | `Page404` |

### Items de sidebar par rôle

| Item | admin | dessinateur | client |
|---|:---:|:---:|:---:|
| Commandes (`/commandes`) | ✅ | ✅ | ✅ |
| Utilisateurs (`/utilisateurs`) | ✅ | ❌ | ❌ |
| Réglages (`/reglages`) | ✅ | ✅ | ✅ |
| Mon compte (`/mon-compte`) | ✅ | ✅ | ✅ |

## Modal détail synchronisé avec l'URL

Pattern « modal-on-list » via routes imbriquées et `<Outlet/>`.

### Déclaration des routes

```jsx
<Route element={<LayoutPrincipal />}>
  <Route path="commandes" element={<ListeCommandes />}>
    <Route path=":ref" element={<ModalDetailCommande />} />
  </Route>
  <Route path="commandes/archives" element={<ListeArchives />}>
    <Route path=":ref" element={<ModalDetailCommande />} />
  </Route>
</Route>
```

### Comportements

- **Clic sur une ligne du tableau** → `navigate("/commandes/" + ref)` → le modal s'ouvre.
- **Fermeture du modal** (croix, overlay, échap) → `navigate("/commandes")` (ou `/commandes/archives`) → retour à la liste.
- **Bouton précédent du navigateur** → ferme le modal naturellement (c'est juste de la navigation arrière).
- **Deep link** : `/commandes/REF-XXX` ouvert dans un nouvel onglet → liste chargée + modal ouvert directement.
- **Référence inexistante** (`/commandes/REF-INCONNU`) → toast d'erreur "Commande introuvable" + `navigate("/commandes", { replace: true })`. Pas de page 404.

## Filtres dans l'URL

Tous les filtres de `BarreFiltres` sont synchronisés avec l'URL via `useSearchParams`.

### Conventions de noms

| Filtre | Param URL | Valeurs |
|---|---|---|
| Statut | `?statut=` | `en_attente`, `commence`, `ebauche_deposee`, `modification`, `valide`. Absent = tous. |
| Dessinateur (admin) | `?dessinateur=` | uid. Absent = tous. |
| Recherche texte | `?q=` | URL-encoded. Absent = vide. |
| Tri | `?tri=` | `date_desc` (défaut, absent), `date_asc`, `ref_asc`, etc. |

Exemple partageable : `/commandes?statut=en_attente&dessinateur=abc123&tri=date_asc`.

### Règles d'écriture

- **`replace: true`** sur tout changement de filtre — ne pas créer une entrée d'historique par frappe au clavier.
- **Debounce 300 ms** sur la recherche texte avant de toucher à l'URL.
- **Valeurs par défaut absentes de l'URL** (pas de `?statut=tous` ; on supprime le param). URL plus propre.
- **Filtres scopés à la route** : changer d'onglet (Commandes → Archives → Commandes) ne conserve pas les filtres précédents.

### Impact sur `BarreFiltres`

L'API du composant `BarreFiltres` (props in / setters out) **ne change pas**. Seule l'implémentation du parent change : au lieu de `useState`, c'est `useSearchParams`.

## Auth, redirections et lien email

### 1. Pas connecté qui accède à une route protégée

- `<RequireAuth>` détecte `!session`.
- Redirige vers `/connexion?redirect=<URL-actuelle>`.
- Après login réussi, `PageConnexion` lit `?redirect=` et navigue vers cette destination (fallback : `/commandes`).

### 2. Connecté qui accède à une route publique

- Si `/connexion`, `/inscription`, `/mot-de-passe-oublie` accédées avec session active → redirige `/commandes`.
- `/reset-mot-de-passe` reste accessible même connecté (cas du PASSWORD_RECOVERY).

### 3. Lien email de reset mot de passe

- Le redirect_to configuré côté Supabase doit pointer vers `https://<URL-V2>/reset-mot-de-passe`.
- À l'arrivée sur cette route, l'event `PASSWORD_RECOVERY` est consommé par `App` (déjà en place via `onAuthStateChange`).
- **Action de configuration** : ajouter `https://<URL-V2>/reset-mot-de-passe` à la whitelist des redirect URLs dans Supabase Auth.
- Pendant le développement V2, l'URL test sera celle de Vercel (via la branche staging — voir Déploiement).

### 4. Statut profil ≠ `actif`

- `<RequireAuth>` regarde `profil.statut` après chargement.
- `actif` → laisse passer.
- `en_attente` / `refuse` / `banni` → affiche `<EcranEnAttente>` / `<EcranRefuse>` / `<EcranBanni>` à la place du contenu. **L'URL n'est pas modifiée** : l'utilisateur reste sur l'URL tentée, seul le contenu est remplacé.

### 5. Déconnexion

- `supabase.auth.signOut()` déclenche `onAuthStateChange` → `session = null`.
- `<RequireAuth>` redirige automatiquement vers `/connexion`. Aucune logique de redirection manuelle à ajouter.

### 6. Inactivité 30 minutes

- La logique actuelle dans `App.js` (timer + listeners d'événements) est conservée à l'identique.
- L'auto-`signOut()` provoque la même redirection automatique que le bouton manuel.

## Migration incrémentale

Étapes ordonnées, chaque étape laisse l'app fonctionnelle.

1. **Setup**
   - Installer `react-router-dom@7`.
   - Wrap `<App>` dans `<BrowserRouter>` (dans `index.js`).
   - Créer `<RequireAuth>` qui réplique exactement la logique actuelle (auth + statut profil → écrans bloquants).

2. **Routes auth publiques**
   - Extraire `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/reset-mot-de-passe`.
   - Supprimer le state `pageAuth` de `App.js`.
   - Brancher la redirection `?redirect=` après login.

3. **Layout principal**
   - Créer `<LayoutPrincipal>` + `<Sidebar>` qui adaptent les items selon `profil.role`.
   - Brancher `<Outlet/>` pour le contenu de route.

4. **Routes simples**
   - `/reglages`, `/mon-compte`, `/utilisateurs` (avec `<RequireRole role="admin">`).
   - Test de bout en bout sur ces pages.

5. **Liste des commandes + filtres URL**
   - Créer `<ListeCommandes>` qui extrait la logique des deux vues actuelles.
   - Brancher `useSearchParams` pour les filtres.
   - Vérifier qu'admin / dessinateur / client voient bien leurs commandes respectives.

6. **Modal détail synchronisé**
   - Ajouter la sous-route `:ref` avec `<ModalDetailCommande>`.
   - Wrapper `DetailCommandeModal` (composant inchangé) pour le piloter via URL.

7. **Archives**
   - Dupliquer le pattern (5+6) pour `/commandes/archives`.

8. **Modal user pour `/utilisateurs/:uid`**
   - Pattern identique au modal commande (sous-route + wrapper).

9. **Page 404**
   - Composant simple avec lien retour.

10. **Nettoyage**
    - Supprimer `VueUtilisateur.js` et `VueDessinateur.js`.
    - Audit final : rechercher les imports obsolètes, du code mort.

## Déploiement et stratégie de branche

### Branches en jeu

| Branche | Rôle | Déploiement |
|---|---|---|
| `main` | Production | GitHub Actions FTP → `incendieplan.fr` |
| `staging` | Test pré-prod | Vercel auto-deploy (`plans-incendie.vercel.app`) |
| `V2` | Développement V2 | aucun déploiement direct |

### Workflow proposé

1. Créer `V2` à partir de `main`.
2. Travail itératif sur `V2` (commits par étape de la migration).
3. Pour tester en condition réelle : merger `V2` → `staging` → Vercel déploie automatiquement.
4. Une fois V2 validée sur l'URL Vercel, merger `V2` → `main` → déploiement FTP sur `incendieplan.fr`.
5. Pendant le développement de V2, `main` reste stable. Tout patch urgent peut s'appliquer directement sur `main`.

### Configuration Supabase à mettre à jour

- Ajouter l'URL Vercel staging (ex: `https://plans-incendie.vercel.app/reset-mot-de-passe`) à la whitelist Auth → Redirect URLs.
- Aucune migration de schéma : V2 ne change pas la base de données.

### Configuration FTP/serveur (incendieplan.fr)

- Le serveur doit gérer les rewrites SPA pour que `https://incendieplan.fr/commandes/REF-XXX` ne renvoie pas un 404 mais bien `index.html`.
- Pour Apache : `.htaccess` avec règle de rewrite vers `index.html`.
- Pour Nginx : `try_files $uri /index.html;`.
- **À vérifier** : la nature du serveur d'hébergement et la possibilité d'ajouter cette règle. Si impossible (hébergement statique pur sans config), il faudra basculer la prod vers Vercel ou un équivalent.
- C'est un prérequis bloquant pour V2 en production.

## Tests manuels à valider avant merge V2 → main

- [ ] Login admin / dessinateur / client → arrive bien sur `/commandes`.
- [ ] Deep link `/commandes/REF-XXX` non connecté → redirige `/connexion?redirect=...`, après login retourne à la commande.
- [ ] Filtres : changer le statut, copier l'URL dans un autre onglet → mêmes filtres appliqués.
- [ ] Recherche texte avec debounce : pas d'entrée d'historique parasite.
- [ ] Modal détail : fermeture via croix / overlay / échap / bouton précédent → URL revient à `/commandes`.
- [ ] Référence inexistante → toast + URL nettoyée.
- [ ] Lien email reset mot de passe (avec config Supabase à jour).
- [ ] Inactivité 30 min → redirection vers `/connexion`.
- [ ] Statuts profil : `en_attente`, `refuse`, `banni` → écran bloquant s'affiche correctement.
- [ ] Admin accède à `/utilisateurs`, dessinateur ne peut pas (redirige `/commandes`).
- [ ] Page 404 sur URL inconnue.
- [ ] Rafraîchissement F5 sur n'importe quelle URL → la page se recharge sans 404.
- [ ] Bouton précédent du navigateur cohérent dans tous les flux.

## Risques identifiés

| Risque | Probabilité | Mitigation |
|---|---|---|
| Hébergement FTP `incendieplan.fr` ne supporte pas les rewrites SPA | Moyenne | Vérifier la config serveur **avant** de merger V2 → main. Tester d'abord sur Vercel via staging. |
| Rupture de comportement subtile lors de l'extraction de `VueUtilisateur` / `VueDessinateur` vers `<LayoutPrincipal>` + `<ListeCommandes>` | Moyenne | Migration étape par étape, app fonctionnelle à chaque étape. Tests manuels par rôle après chaque étape. |
| Lien email de reset mot de passe cassé pendant la transition (URL whitelist) | Faible | Mettre à jour la whitelist Supabase **avant** de basculer V2 en prod. Pendant le développement, tester via Vercel staging. |
| Realtime Supabase qui se ré-abonne en boucle suite au remontage de composants liés au routage | Faible | Vérifier que les abonnements realtime sont attachés à des composants stables (`App` ou un hook au-dessus du router), pas à des composants de route qui se démontent. |
