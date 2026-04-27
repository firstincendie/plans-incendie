# V2 — Routage par URL : Plan d'implémentation

> **Pour les agentic workers :** REQUIRED SUB-SKILL : Use superpowers:subagent-driven-development (recommandée) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal :** Ajouter un système de routage par URL (react-router-dom v7) à l'application plans-incendie, en remplaçant la navigation à base de `useState`, sans changer le visuel ni l'API des composants existants.

**Architecture :** `<App>` est wrappée dans `<BrowserRouter>` au niveau de `index.js`. La logique d'auth/profil/statut sort de `App.js` et migre dans un guard `<RequireAuth>`. Un `<LayoutPrincipal>` partagé monte la sidebar adaptée au rôle et rend `<Outlet/>`. Les routes imbriquées (`/commandes/:ref` sous `/commandes`) permettent au `DetailCommandeModal` de s'overlayer sur la liste sans démontage. Les filtres se synchronisent avec `useSearchParams`.

**Tech Stack :** React 19, react-scripts 5 (CRA), react-router-dom 7, Supabase JS 2.

**Spec source :** [docs/superpowers/specs/2026-04-27-routage-url-v2-design.md](../specs/2026-04-27-routage-url-v2-design.md)

**Branche d'exécution :** Ce plan doit s'exécuter sur la branche `V2`. Avant la Task 1 : `git checkout main && git checkout -b V2 && git push -u origin V2`. Tous les commits du plan se font sur cette branche.

**Terminologie & faits du code à connaître absolument avant d'implémenter :**

- Rôles dans la BDD (`profiles.role`) : `admin`, `dessinateur`, `utilisateur`. Il n'y a **pas** de rôle `client` — c'est le terme métier utilisé par l'utilisateur final mais le code dit `utilisateur`.
- Colonnes pertinentes sur `commandes` :
  - `utilisateur_id` (FK vers `profiles.id` du donneur d'ordre — pas `client_id`)
  - `dessinateur_id` (FK vers le profil dessinateur assigné)
  - `dessinateur` (nom string libre — utilisé dans `BarreFiltres` comme valeur de filtre)
  - `is_archived` (boolean, archivage côté donneur d'ordre)
  - `is_archived_dessinateur` (boolean, archivage **indépendant** côté dessinateur)
- Les fetchs actuels ne filtrent pas par scope : `supabase.from("commandes").select("*, messages(*)").order("created_at", { ascending: false })`. La sécurité est assurée par les **RLS Supabase**. La séparation actives/archivées et le filtrage par sous-compte sont **côté client**.
- Sous-comptes (sub-accounts) : un profil avec `is_owner = true` peut avoir des sous-comptes liés (cf. `super-comptes-sous-comptes` specs). `VueUtilisateur` charge `sousComptes` et expose un `userFilter` pour filtrer les commandes par owner. `VueDessinateur` a une logique équivalente côté dessinateur.

**Hors-scope tests automatisés :** La spec exclut explicitement les tests automatisés du routage. Le plan utilise des **vérifications manuelles dans le navigateur** entre chaque tâche. Chaque commit doit laisser l'app dans un état fonctionnel sur `npm start`.

**Conventions de vérification manuelle :**
- Démarrer le dev server : `npm start` (CRA, port 3000 par défaut).
- Comptes de test à avoir sous la main : 1 admin owner, 1 admin non-owner (si possible), 1 dessinateur, 1 client.
- Pour observer un statut de profil non-`actif`, modifier la colonne `statut` dans la table Supabase `profiles` pour un compte test, puis rafraîchir.
- Console DevTools ouverte pendant tous les tests pour repérer warnings/erreurs.

---

## Structure de fichiers

### Nouveaux fichiers (tous dans `src/components/`)

| Fichier | Responsabilité |
|---|---|
| `src/components/AppRouter.js` | Déclare l'arbre `<Routes>` complet de l'application |
| `src/components/RequireAuth.js` | Guard d'authentification + statut profil + écran bloquant |
| `src/components/RequireRole.js` | Guard de rôle/owner pour routes admin |
| `src/components/LayoutPrincipal.js` | Shell commun : sidebar + main + `<Outlet/>` |
| `src/components/Sidebar.js` | Items de navigation filtrés par rôle/owner |
| `src/components/ListeCommandes.js` | Page liste commandes actives, filtres URL, `<Outlet/>` pour modal |
| `src/components/ListeArchives.js` | Page liste commandes archivées, filtres URL, `<Outlet/>` pour modal |
| `src/components/ModalDetailCommande.js` | Wrapper qui pilote `DetailCommandeModal` depuis `useParams().ref` |
| `src/components/ModalDetailUtilisateur.js` | Wrapper qui pilote la sélection user dans `GestionUtilisateurs` depuis `useParams().uid` |
| `src/components/EcranEnAttente.js` | Écran bloquant statut `en_attente` (extrait de `App.js` l.88-103) |
| `src/components/EcranRefuse.js` | Écran bloquant statut `refuse` (extrait de `App.js` l.105-120) |
| `src/components/EcranBanni.js` | Écran bloquant statut `banni` (extrait de `App.js` l.122-137) |
| `src/components/Page404.js` | Page 404 avec lien retour `/commandes` |

### Fichiers modifiés

| Fichier | Modifications |
|---|---|
| `src/index.js` | Wrap `<App />` avec `<BrowserRouter>` |
| `src/App.js` | Drastiquement simplifié : ne fait plus que session+profil+inactivité, délègue le rendu à `<AppRouter>` |
| `src/components/auth/PageConnexion.js` | Callbacks props remplacés par `useNavigate` ; lecture de `?redirect=` après login |
| `src/components/auth/PageInscription.js` | Idem |
| `src/components/auth/PageMotDePasseOublie.js` | Idem |
| `src/components/auth/PageResetMotDePasse.js` | `onSuccess` callback → `navigate("/connexion")` |
| `package.json` / `package-lock.json` | Ajout `react-router-dom@^7` |

### Fichiers supprimés (en fin de migration)

| Fichier | Raison |
|---|---|
| `src/components/VueUtilisateur.js` | Logique migrée vers `LayoutPrincipal` + `ListeCommandes` |
| `src/components/VueDessinateur.js` | Idem |

### Composants inchangés (vérifier qu'ils continuent de fonctionner sans modification)

`DetailCommandeModal`, `BarreFiltres`, `TableauPlans`, `Messagerie`, `HistoriqueVersions`, `ZoneUpload`, `VisuFichier`, `BlocAdresse`, `Badge`, `ChampCopiable`, `PageReglages`, `PageMonCompte`, `GestionUtilisateurs`, `GestionCompteDessinateur`.

---

## Task 0 : Préparer la branche V2

**Objectif :** Créer la branche V2 à partir de main (état stable de production).

**Files :**
- (aucune modification de fichier)

- [ ] **Step 1 : Vérifier que main est à jour**

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git status
```

Expected : `Your branch is up to date with 'origin/main'. nothing to commit, working tree clean`

- [ ] **Step 2 : Créer la branche V2**

```bash
git checkout -b V2
git push -u origin V2
```

Expected : `Branch 'V2' set up to track 'origin/V2'`

- [ ] **Step 3 : Vérifier l'état de l'app sur V2 avant tout changement**

```bash
npm install
npm start
```

Ouvrir http://localhost:3000, se connecter, vérifier que :
- la page de login s'affiche
- la connexion fonctionne
- le dashboard s'affiche
- aucune erreur console

Si tout est OK, arrêter le dev server (Ctrl+C). Pas de commit (rien n'a changé).

---

## Task 1 : Installer react-router-dom et wrapper l'app dans BrowserRouter

**Objectif :** Ajouter le router au niveau le plus haut. À ce stade, aucune route n'est encore définie — l'app continue à fonctionner exactement comme avant grâce au rendu inchangé d'`<App>`.

**Files :**
- Modify : `package.json`, `package-lock.json` (via npm install)
- Modify : `src/index.js`

- [ ] **Step 1 : Installer react-router-dom v7**

```bash
npm install react-router-dom@^7
```

Expected : `added N packages`. Vérifier dans `package.json` que `"react-router-dom"` apparaît dans `dependencies` avec `^7.x.x`.

- [ ] **Step 2 : Wrapper `<App />` avec `<BrowserRouter>` dans `index.js`**

Remplacer le contenu de `src/index.js` par :

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
```

- [ ] **Step 3 : Vérification manuelle**

```bash
npm start
```

Ouvrir http://localhost:3000 :
- L'app fonctionne exactement comme avant (login, dashboard, navigation interne par sidebar).
- Console DevTools : aucune erreur, aucun warning lié à react-router.
- Tester de naviguer dans la sidebar (Commandes, Réglages, Mon compte) : fonctionne en interne.

Arrêter le dev server.

- [ ] **Step 4 : Commit**

```bash
git add package.json package-lock.json src/index.js
git commit -m "feat(v2): install react-router-dom v7 and wrap app in BrowserRouter"
```

---

## Task 2 : Extraire les écrans de statut bloquants

**Objectif :** Sortir les 3 écrans inline (`en_attente`, `refuse`, `banni`) de `App.js` vers des composants dédiés. Préparation pour `RequireAuth`. Aucun changement de comportement à ce stade.

**Files :**
- Create : `src/components/EcranEnAttente.js`, `src/components/EcranRefuse.js`, `src/components/EcranBanni.js`
- Modify : `src/App.js` (l.88-137 remplacés par les imports)

- [ ] **Step 1 : Créer `src/components/EcranEnAttente.js`**

```jsx
import { supabase } from "../supabase";

export default function EcranEnAttente() {
  return (
    <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 420, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: "#122131", marginBottom: 12 }}>Votre compte est en attente</div>
        <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Un administrateur va examiner votre demande et vous assigner un dessinateur. Vous recevrez un email dès que votre compte sera activé.
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Créer `src/components/EcranRefuse.js`**

```jsx
import { supabase } from "../supabase";

export default function EcranRefuse() {
  return (
    <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 420, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: "#122131", marginBottom: 12 }}>Accès refusé</div>
        <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Votre demande d'accès n'a pas été acceptée. Contactez-nous pour plus d'informations.
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Créer `src/components/EcranBanni.js`**

```jsx
import { supabase } from "../supabase";

export default function EcranBanni() {
  return (
    <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 420, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: "#122131", marginBottom: 12 }}>Compte bloqué</div>
        <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Votre compte a été bloqué. Contactez contact@firstincendie.com pour plus d'informations.
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Remplacer les blocs inline dans `src/App.js`**

Ajouter les imports en haut du fichier :

```jsx
import EcranEnAttente from "./components/EcranEnAttente";
import EcranRefuse from "./components/EcranRefuse";
import EcranBanni from "./components/EcranBanni";
```

Remplacer les lignes 88-103 (bloc `if (profil.statut === "en_attente")`) par :

```jsx
if (profil.statut === "en_attente") {
  return <EcranEnAttente />;
}
```

Remplacer les lignes 105-120 (bloc `if (profil.statut === "refuse")`) par :

```jsx
if (profil.statut === "refuse") {
  return <EcranRefuse />;
}
```

Remplacer les lignes 122-137 (bloc `if (profil.statut === "banni")`) par :

```jsx
if (profil.statut === "banni") {
  return <EcranBanni />;
}
```

- [ ] **Step 5 : Vérification manuelle**

```bash
npm start
```

- L'app fonctionne normalement en login + dashboard.
- Pour tester un écran bloquant : dans Supabase, modifier `profiles.statut` d'un compte test à `en_attente`, recharger l'app dans un onglet privé connecté avec ce compte → l'écran "Votre compte est en attente" s'affiche.
- Remettre le statut à `actif` après test.

- [ ] **Step 6 : Commit**

```bash
git add src/components/EcranEnAttente.js src/components/EcranRefuse.js src/components/EcranBanni.js src/App.js
git commit -m "refactor(v2): extract status screens to standalone components"
```

---

## Task 3 : Créer le guard `<RequireAuth>`

**Objectif :** Créer un composant qui encapsule la logique "session présente + profil chargé + statut actif". Pour l'instant on ne s'en sert pas — on le branchera dans Task 5.

**Files :**
- Create : `src/components/RequireAuth.js`

- [ ] **Step 1 : Créer `src/components/RequireAuth.js`**

```jsx
import { Navigate, useLocation, Outlet } from "react-router-dom";
import EcranEnAttente from "./EcranEnAttente";
import EcranRefuse from "./EcranRefuse";
import EcranBanni from "./EcranBanni";

export default function RequireAuth({ session, profil, sessionLoading, profilLoading }) {
  const location = useLocation();

  if (sessionLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 14 }}>
        Chargement...
      </div>
    );
  }

  if (!session) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?redirect=${redirect}`} replace />;
  }

  if (profilLoading || !profil) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 14 }}>
        Chargement du profil...
      </div>
    );
  }

  if (profil.statut === "en_attente") return <EcranEnAttente />;
  if (profil.statut === "refuse")     return <EcranRefuse />;
  if (profil.statut === "banni")      return <EcranBanni />;

  return <Outlet />;
}
```

- [ ] **Step 2 : Vérification syntaxique (sans changement de comportement)**

```bash
npm start
```

L'app doit toujours fonctionner comme avant (le composant n'est pas encore utilisé). Si une erreur de compilation apparaît, corriger.

- [ ] **Step 3 : Commit**

```bash
git add src/components/RequireAuth.js
git commit -m "feat(v2): add RequireAuth route guard component"
```

---

## Task 4 : Créer le guard `<RequireRole>`

**Objectif :** Composant guard qui vérifie le rôle du profil et optionnellement le flag `is_owner`.

**Files :**
- Create : `src/components/RequireRole.js`

- [ ] **Step 1 : Créer `src/components/RequireRole.js`**

```jsx
import { Navigate, Outlet } from "react-router-dom";

export default function RequireRole({ profil, roles, requireOwner = false }) {
  if (!profil) return null;

  const roleOk = roles.includes(profil.role);
  const ownerOk = !requireOwner || profil.is_owner === true;

  if (!roleOk || !ownerOk) {
    return <Navigate to="/commandes" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/components/RequireRole.js
git commit -m "feat(v2): add RequireRole route guard component"
```

---

## Task 5 : Créer `<AppRouter>` minimal et brancher sur `<App>` (auth uniquement)

**Objectif :** Créer le squelette du router avec **uniquement** les routes publiques d'auth. `App.js` continue à gérer la session/profil/inactivité, mais délègue le rendu à `<AppRouter>` au lieu de faire son `if/else` géant.

**Files :**
- Create : `src/components/AppRouter.js`
- Modify : `src/App.js`
- Modify : `src/components/auth/PageConnexion.js`, `PageInscription.js`, `PageMotDePasseOublie.js`, `PageResetMotDePasse.js`

- [ ] **Step 1 : Modifier `PageConnexion.js` pour utiliser `useNavigate` et lire `?redirect=`**

Remplacer la signature de la fonction et la logique de redirection après login. La structure JSX et le formulaire ne changent pas.

```jsx
import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../../supabase";

export default function PageConnexion() {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleConnexion = async (e) => {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: mdp });
    if (error) {
      setErreur("Email ou mot de passe incorrect.");
      setChargement(false);
      return;
    }
    setChargement(false);
    const redirect = searchParams.get("redirect");
    navigate(redirect ? decodeURIComponent(redirect) : "/commandes", { replace: true });
  };

  // ... reste du JSX inchangé, sauf les boutons "mot de passe oublié" / "inscription" :
  // remplacer onClick={onMotDePasseOublie} par onClick={() => navigate("/mot-de-passe-oublie")}
  // remplacer onClick={onInscription} par onClick={() => navigate("/inscription")}
}
```

> **Note pour l'implémenteur :** lire d'abord le contenu actuel de `PageConnexion.js` en entier, identifier les deux occurrences de `onMotDePasseOublie` et `onInscription` dans le JSX, et les remplacer par les `navigate(...)` correspondants. Ne pas toucher au reste du JSX (style, libellés, formulaire).

- [ ] **Step 2 : Modifier `PageInscription.js` pour utiliser `useNavigate`**

Lire le fichier en entier. Remplacer la prop `onRetour` par `useNavigate` :

```jsx
// En haut du fichier, ajouter :
import { useNavigate } from "react-router-dom";

// Dans la signature :
export default function PageInscription() {
  const navigate = useNavigate();
  // ... reste de la logique inchangée

  // Remplacer chaque appel onRetour() par :
  navigate("/connexion");
}
```

- [ ] **Step 3 : Modifier `PageMotDePasseOublie.js` pour utiliser `useNavigate`**

Même pattern que Step 2 : remplacer `onRetour` par `useNavigate` et appeler `navigate("/connexion")` à sa place.

- [ ] **Step 4 : Modifier `PageResetMotDePasse.js` pour utiliser `useNavigate`**

Lire le fichier. Remplacer le pattern `onSuccess` par :

```jsx
import { useNavigate } from "react-router-dom";

export default function PageResetMotDePasse() {
  const navigate = useNavigate();
  // ... reste

  // Au moment du succès, remplacer onSuccess() par :
  await supabase.auth.signOut();
  navigate("/connexion", { replace: true });
}
```

- [ ] **Step 5 : Créer `src/components/AppRouter.js` — version minimale (auth uniquement)**

```jsx
import { Routes, Route, Navigate } from "react-router-dom";
import PageConnexion from "./auth/PageConnexion";
import PageInscription from "./auth/PageInscription";
import PageMotDePasseOublie from "./auth/PageMotDePasseOublie";
import PageResetMotDePasse from "./auth/PageResetMotDePasse";

export default function AppRouter({ session, profil, sessionLoading, profilLoading, legacyShell }) {
  // Si déjà connecté avec profil actif et qu'on est sur une route auth → rediriger vers /commandes
  // (À implémenter complètement dans une task ultérieure ; pour l'instant on garde le legacyShell pour les connectés)

  return (
    <Routes>
      <Route path="/connexion" element={<PageConnexion />} />
      <Route path="/inscription" element={<PageInscription />} />
      <Route path="/mot-de-passe-oublie" element={<PageMotDePasseOublie />} />
      <Route path="/reset-mot-de-passe" element={<PageResetMotDePasse />} />
      {/* Toutes les autres routes : pour cette task, on rend le legacy shell tant qu'on n'a pas migré */}
      <Route path="*" element={legacyShell} />
    </Routes>
  );
}
```

- [ ] **Step 6 : Modifier `src/App.js` pour utiliser `<AppRouter>` et supprimer le state `pageAuth`**

Le nouveau `App.js` doit :
- Garder la logique session/profil/inactivité.
- Garder `resetMode` (sera migré dans Task 6).
- Supprimer `pageAuth` et son state.
- Construire le `legacyShell` : c'est le rendu actuel des `if (!profil) ... if (profil.role === "dessinateur") <VueDessinateur/> ... else <VueUtilisateur/>`.
- Passer le tout à `<AppRouter>`.

```jsx
import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import AppRouter from "./components/AppRouter";
import VueUtilisateur from "./components/VueUtilisateur";
import VueDessinateur from "./components/VueDessinateur";
import PageResetMotDePasse from "./components/auth/PageResetMotDePasse";

const INACTIVITE_MS = 30 * 60 * 1000;

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profil, setProfil] = useState(null);
  const [resetMode, setResetMode] = useState(false);
  const timerInactivite = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) chargerProfil(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setResetMode(true); return; }
      setSession(session);
      if (session) chargerProfil(session.user.id);
      else setProfil(null);
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!session) return;
    function resetTimer() {
      clearTimeout(timerInactivite.current);
      timerInactivite.current = setTimeout(() => supabase.auth.signOut(), INACTIVITE_MS);
    }
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(timerInactivite.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [session]); // eslint-disable-line

  async function chargerProfil(uid) {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfil(data);
  }

  if (resetMode) {
    return <PageResetMotDePasse onSuccess={() => { setResetMode(false); supabase.auth.signOut(); }} />;
  }

  // Construction du legacy shell : ce qui s'affichait avant pour un utilisateur connecté.
  // Cette branche sera progressivement remplacée par les routes dans les tasks suivantes.
  let legacyShell = null;
  if (session && profil) {
    legacyShell = profil.role === "dessinateur"
      ? <VueDessinateur session={session} profil={profil} onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))} />
      : <VueUtilisateur session={session} profil={profil} onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))} />;
  }

  return (
    <AppRouter
      session={session}
      profil={profil}
      sessionLoading={session === undefined}
      profilLoading={!!session && !profil}
      legacyShell={legacyShell}
    />
  );
}
```

- [ ] **Step 7 : Vérification manuelle**

```bash
npm start
```

Tests à effectuer :
- Naviguer vers http://localhost:3000/connexion → page de connexion s'affiche.
- Saisir des identifiants invalides → erreur "Email ou mot de passe incorrect" affichée.
- Cliquer "Mot de passe oublié" → URL devient `/mot-de-passe-oublie`, page correspondante s'affiche.
- Cliquer "Retour" sur cette page → URL revient à `/connexion`.
- Cliquer "S'inscrire" → URL devient `/inscription`, page correspondante s'affiche.
- Connexion réussie → l'app affiche le dashboard (legacyShell). URL ne change pas particulièrement (reste sur `/connexion` ou ce qu'on avait), mais le contenu est le bon.
- Console : aucune erreur.

- [ ] **Step 8 : Commit**

```bash
git add src/components/AppRouter.js src/App.js src/components/auth/
git commit -m "feat(v2): wire AppRouter with public auth routes, remove pageAuth state"
```

---

## Task 6 : Migrer la détection PASSWORD_RECOVERY vers une navigation

**Objectif :** Remplacer le state `resetMode` par une navigation vers `/reset-mot-de-passe`. Cohérent avec le routage. Doit fonctionner même si l'utilisateur arrive depuis n'importe quelle URL.

**Files :**
- Modify : `src/App.js`

- [ ] **Step 1 : Remplacer la logique `resetMode` par un `navigate`**

Modifier le `onAuthStateChange` dans `App.js`. Comme `useNavigate` ne peut pas être utilisé directement dans `App` (qui est au-dessus de `<Routes>`, mais en-dessous de `<BrowserRouter>` — donc si, on peut), ajouter l'import et utiliser le hook.

Note : `<App>` est rendu **à l'intérieur** du `<BrowserRouter>` (cf. `index.js` modifié en Task 1). `useNavigate` fonctionne donc.

```jsx
// Ajouter en haut :
import { useNavigate } from "react-router-dom";

// Dans App() :
const navigate = useNavigate();

// Dans le useEffect du onAuthStateChange, remplacer :
if (event === "PASSWORD_RECOVERY") { setResetMode(true); return; }

// Par :
if (event === "PASSWORD_RECOVERY") {
  navigate("/reset-mot-de-passe", { replace: true });
  return;
}

// Supprimer le state resetMode et le bloc if (resetMode) return <PageResetMotDePasse...
// L'import de PageResetMotDePasse dans App.js peut maintenant être supprimé (déjà importé dans AppRouter).
```

Le `navigate` doit être stable : déclarer la dépendance dans le `useEffect` ou utiliser une ref. Solution la plus propre : utiliser une ref pour `navigate` (re-déclaration inoffensive en pratique, mais on évite le warning ESLint).

Approche simple : ajouter `navigate` au tableau de dépendances du `useEffect` et accepter le ré-abonnement si nécessaire (ou conserver `// eslint-disable-line` comme aujourd'hui).

- [ ] **Step 2 : Vérification manuelle**

```bash
npm start
```

- L'app continue à fonctionner normalement.
- Pour tester PASSWORD_RECOVERY : dans Supabase, déclencher un envoi de reset password à un compte test, ouvrir le lien email reçu. → On doit arriver sur `/reset-mot-de-passe` avec le formulaire. Soumettre un nouveau mot de passe → redirection vers `/connexion`.

- [ ] **Step 3 : Commit**

```bash
git add src/App.js
git commit -m "feat(v2): handle PASSWORD_RECOVERY via navigation instead of state"
```

---

## Task 7 : Bloquer les routes auth pour les utilisateurs déjà connectés

**Objectif :** Si un utilisateur connecté tape `/connexion` ou `/inscription`, le rediriger vers `/commandes`. Exception : `/reset-mot-de-passe` reste accessible (cas du PASSWORD_RECOVERY pendant que la session est encore active).

**Files :**
- Modify : `src/components/AppRouter.js`

- [ ] **Step 1 : Ajouter la redirection dans `AppRouter.js`**

```jsx
import { Routes, Route, Navigate } from "react-router-dom";
import PageConnexion from "./auth/PageConnexion";
import PageInscription from "./auth/PageInscription";
import PageMotDePasseOublie from "./auth/PageMotDePasseOublie";
import PageResetMotDePasse from "./auth/PageResetMotDePasse";

export default function AppRouter({ session, profil, sessionLoading, profilLoading, legacyShell }) {
  const dejaConnecte = !!session && !!profil && profil.statut === "actif";

  return (
    <Routes>
      <Route path="/connexion" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageConnexion />} />
      <Route path="/inscription" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageInscription />} />
      <Route path="/mot-de-passe-oublie" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageMotDePasseOublie />} />
      <Route path="/reset-mot-de-passe" element={<PageResetMotDePasse />} />
      <Route path="*" element={legacyShell} />
    </Routes>
  );
}
```

- [ ] **Step 2 : Vérification manuelle**

```bash
npm start
```

- Connecté, naviguer vers `/connexion` → redirige vers `/commandes`.
- Connecté, naviguer vers `/inscription` → redirige vers `/commandes`.
- `/commandes` n'existe pas encore comme route, donc on retombe sur le `*` qui rend le `legacyShell`. À ce stade c'est acceptable car le legacy shell affiche bien la liste des commandes.
- Déconnecté, naviguer vers `/connexion` → page de connexion s'affiche.

- [ ] **Step 3 : Commit**

```bash
git add src/components/AppRouter.js
git commit -m "feat(v2): redirect authenticated users away from auth pages"
```

---

## Task 8 : Construire `<Sidebar>` et `<LayoutPrincipal>`

**Objectif :** Créer le shell partagé (sidebar + main avec `<Outlet/>`). Pour l'instant on ne le branche pas dans le router — c'est fait en Task 9.

**Files :**
- Create : `src/components/Sidebar.js`
- Create : `src/components/LayoutPrincipal.js`

- [ ] **Step 1 : Étudier les sidebars existantes**

Lire les passages suivants pour reproduire fidèlement le visuel :
- `src/components/VueUtilisateur.js` lignes 59-65 (items nav admin/client) et 460-470 (rendu sidebar)
- `src/components/VueDessinateur.js` lignes 38-43 (items nav dessinateur) et 295-310 (rendu sidebar)

Identifier : les styles CSS-in-JS, les couleurs d'accent par rôle (admin = `#122131`, dessinateur = `#FC6C1B`), la gestion du menu mobile.

- [ ] **Step 2 : Créer `src/components/Sidebar.js`**

Squelette à compléter avec les styles existants. Conserver la couleur d'accent par rôle.

```jsx
import { NavLink } from "react-router-dom";
import { supabase } from "../supabase";

export default function Sidebar({ profil, onAvatarClick, mobileOpen, onMobileClose }) {
  const role = profil.role;
  const couleurAccent = role === "dessinateur" ? "#FC6C1B" : "#122131";
  const fondActif = role === "dessinateur" ? "#FFF3EE" : "#E8EDF2";

  // Items selon rôle
  const items = [
    { to: "/commandes", label: role === "dessinateur" ? "Mes missions" : "Commandes", icon: "📋" },
    ...(role === "dessinateur" ? [{ to: "/gestion-compte", label: "Gestion de compte", icon: "📁" }] : []),
    { to: "/reglages", label: "Réglages", icon: "⚙️" },
    { to: "/mon-compte", label: "Mon compte", icon: "👤" },
    ...(role !== "dessinateur" && profil.is_owner ? [{ to: "/utilisateurs", label: "Utilisateurs", icon: "🛠️" }] : []),
  ];

  // Reproduire le markup et les styles existants des sidebars (header avec logo, liste d'items en NavLink,
  // pied avec bouton "Se déconnecter", responsive mobile via mobileOpen / onMobileClose).
  // Utiliser <NavLink> de react-router-dom : il fournit un état "active" automatique selon l'URL.

  return (
    <aside style={{ /* styles existants */ }}>
      {/* logo / header */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, padding: 12 }}>
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onMobileClose}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 8,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              background: isActive ? fondActif : "transparent",
              color: isActive ? couleurAccent : "#6B7280",
            })}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      {/* bouton avatar / déconnexion */}
      <button onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
    </aside>
  );
}
```

> **Note pour l'implémenteur :** copier le markup et les styles exacts depuis `VueUtilisateur.js` et `VueDessinateur.js` pour préserver le visuel pixel-near. Adapter `onClick` → `<NavLink to=...>`.

- [ ] **Step 3 : Créer `src/components/LayoutPrincipal.js`**

`<LayoutPrincipal>` est le bon endroit pour charger **les commandes + les sous-comptes + la souscription realtime messages**, car :
- Plusieurs pages enfants en ont besoin (`ListeCommandes`, `ListeArchives`, `PageMonCompte`).
- Cela évite de dupliquer la logique entre `ListeCommandes` et `ListeArchives`.
- Cela évite que le démontage/remontage entre `/commandes` et `/commandes/archives` réabonne le canal realtime à chaque changement de route (cf. risque #4 de la spec).
- Les pages enfants lisent via `useOutletContext()` ce dont elles ont besoin.

```jsx
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "./Sidebar";

export default function LayoutPrincipal({ session, profil, onProfilUpdate }) {
  const [commandes, setCommandes] = useState([]);
  const [sousComptes, setSousComptes] = useState([]);

  useEffect(() => {
    chargerTout();
    // Souscription realtime messages : reproduire la logique exacte des Vue* (cf. notes implémenteur)
    const canal = supabase.channel("messages-realtime").on(/* ... */).subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [profil.id]); // eslint-disable-line

  async function chargerTout() {
    // Reproduction du fetch actuel (pas de .eq scope — RLS Supabase gère la sécurité)
    const [{ data: cmd }, { data: sub }] = await Promise.all([
      supabase.from("commandes").select("*, messages(*)").order("created_at", { ascending: false }),
      // Charger les sous-comptes selon le rôle :
      // - utilisateur owner : sub-comptes utilisateur (cf. logique actuelle dans VueUtilisateur, l.~120-126)
      // - dessinateur owner : sub-comptes dessinateur (cf. VueDessinateur)
      // - admin / non-owner : tableau vide
      // À reproduire fidèlement depuis le code existant.
      profil.is_owner ? supabase.from("profiles").select("*").eq("parent_id", profil.id) : Promise.resolve({ data: [] }),
    ]);

    if (cmd) setCommandes(cmd.map(c => ({
      ...c,
      // reproduire les normalisations actuelles (plans, fichiersPlan, logoClient, plansFinalises, messages)
      // cf. VueUtilisateur.js l.115-125 et VueDessinateur.js l.86-96
    })));
    if (sub) setSousComptes(sub);
  }

  return (
    <div style={{ /* shell — reproduire styles des Vue* */ }}>
      <Sidebar profil={profil} />
      <main style={{ /* main */ }}>
        <Outlet context={{ session, profil, onProfilUpdate, commandes, setCommandes, sousComptes }} />
      </main>
    </div>
  );
}
```

> **Notes pour l'implémenteur :**
> - Le contexte exposé via `<Outlet context>` doit contenir : `session`, `profil`, `onProfilUpdate`, `commandes`, `setCommandes`, `sousComptes`. Ces valeurs sont lues par les pages enfants via `useOutletContext()`.
> - **Reproduire fidèlement** le fetch et les normalisations depuis `VueUtilisateur.js:104-126` et `VueDessinateur.js:84-96`. Ne pas inventer de scope `.eq(...)` : la sécurité passe par les RLS Supabase, pas par des filtres côté client.
> - **Reproduire fidèlement** la souscription realtime depuis le canal `messages-realtime` (chercher `supabase.channel` dans `VueUtilisateur.js` et `VueDessinateur.js`). Le pattern est presque identique des deux côtés.
> - Le chargement de `sousComptes` est conditionnel à `profil.is_owner`. La requête exacte (table source, colonne de relation comme `parent_id` ou autre) doit être copiée depuis le code existant — le squelette ci-dessus est indicatif.
> - Si la logique des deux Vue* diverge sur un point (ex: dessinateur charge des données supplémentaires comme `dessinateur_id` filtering), capturer cette divergence avec un `if (profil.role === "dessinateur") { ... }`.

- [ ] **Step 4 : Vérification de compilation**

```bash
npm start
```

L'app fonctionne toujours via `legacyShell` (les nouveaux composants ne sont pas encore branchés). Vérifier qu'il n'y a pas d'erreur de compilation.

- [ ] **Step 5 : Commit**

```bash
git add src/components/Sidebar.js src/components/LayoutPrincipal.js
git commit -m "feat(v2): add LayoutPrincipal shell with role-aware Sidebar"
```

---

## Task 9 : Brancher `<RequireAuth>` + `<LayoutPrincipal>` et migrer `/reglages`, `/mon-compte`

**Objectif :** Première vraie route protégée. À la fin de cette task, `/reglages` et `/mon-compte` passent par le nouveau layout, le reste passe encore par `legacyShell`.

**Files :**
- Modify : `src/components/AppRouter.js`

- [ ] **Step 1 : Mettre à jour `AppRouter.js`**

```jsx
import { Routes, Route, Navigate, useOutletContext } from "react-router-dom";
import PageConnexion from "./auth/PageConnexion";
import PageInscription from "./auth/PageInscription";
import PageMotDePasseOublie from "./auth/PageMotDePasseOublie";
import PageResetMotDePasse from "./auth/PageResetMotDePasse";
import RequireAuth from "./RequireAuth";
import LayoutPrincipal from "./LayoutPrincipal";
import PageReglages from "./PageReglages";
import PageMonCompte from "./PageMonCompte";

export default function AppRouter({ session, profil, sessionLoading, profilLoading, legacyShell, onProfilUpdate }) {
  const dejaConnecte = !!session && !!profil && profil.statut === "actif";

  return (
    <Routes>
      <Route path="/connexion" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageConnexion />} />
      <Route path="/inscription" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageInscription />} />
      <Route path="/mot-de-passe-oublie" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageMotDePasseOublie />} />
      <Route path="/reset-mot-de-passe" element={<PageResetMotDePasse />} />

      <Route element={<RequireAuth session={session} profil={profil} sessionLoading={sessionLoading} profilLoading={profilLoading} />}>
        <Route element={<LayoutPrincipal session={session} profil={profil} onProfilUpdate={onProfilUpdate} />}>
          <Route path="/reglages" element={<PageReglagesWrapper />} />
          <Route path="/mon-compte" element={<PageMonCompteWrapper />} />
        </Route>
      </Route>

      {/* Tout le reste passe encore par le legacy shell pour le moment */}
      <Route path="*" element={legacyShell} />
    </Routes>
  );
}

function PageReglagesWrapper() {
  const { profil, onProfilUpdate } = useOutletContext();
  return <PageReglages profil={profil} onProfilUpdate={onProfilUpdate} />;
}

function PageMonCompteWrapper() {
  const { session, profil, onProfilUpdate, commandes } = useOutletContext();
  // PageMonCompte attend une prop `role` valant "dessinateur" ou "utilisateur"
  // (cf. PageMonCompte.js l.5, l.374, l.450). Le rôle "admin" est mappé sur "utilisateur"
  // pour préserver le comportement de VueUtilisateur.js:517 qui passe role="utilisateur".
  const roleProp = profil.role === "dessinateur" ? "dessinateur" : "utilisateur";
  return <PageMonCompte profil={profil} session={session} role={roleProp} commandes={commandes} onProfilUpdate={onProfilUpdate} />;
}
```

> **Notes pour l'implémenteur :**
> - L'import de `useOutletContext` est explicite dans la première ligne d'import (ne pas oublier).
> - `commandes` vient maintenant du contexte exposé par `<LayoutPrincipal>` (cf. Task 8 Step 3). Plus de placeholder vide.
> - Le mapping `roleProp` reproduit exactement le comportement actuel : `VueUtilisateur` (utilisé pour admin et utilisateur) passe `role="utilisateur"` ; `VueDessinateur` passe `role="dessinateur"`.

- [ ] **Step 2 : Mettre à jour `App.js` pour passer `onProfilUpdate` à `<AppRouter>`**

```jsx
// Dans le return final de App.js, ajouter la prop :
return (
  <AppRouter
    session={session}
    profil={profil}
    sessionLoading={session === undefined}
    profilLoading={!!session && !profil}
    legacyShell={legacyShell}
    onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))}
  />
);
```

- [ ] **Step 3 : Vérification manuelle**

```bash
npm start
```

- Connecté admin : naviguer manuellement vers `/reglages` (taper l'URL) → la nouvelle layout s'affiche avec sa sidebar + `PageReglages`.
- Cliquer sur "Réglages" dans la sidebar → URL devient `/reglages`, page reste affichée.
- Cliquer sur "Mon compte" → URL devient `/mon-compte`, page s'affiche.
- Cliquer sur "Commandes" dans la sidebar → URL devient `/commandes`, le contenu rendu est `legacyShell` (ce qui affiche encore l'ancienne `VueUtilisateur`). La sidebar du legacy s'affiche, mais c'est attendu à ce stade.
- Connecté dessinateur : tester `/reglages` et `/mon-compte` → fonctionnent.
- Déconnecté : taper `/reglages` → redirigé vers `/connexion?redirect=%2Freglages`. Login réussi → retour sur `/reglages`.
- Console : pas d'erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/components/AppRouter.js src/App.js
git commit -m "feat(v2): wire RequireAuth + LayoutPrincipal for /reglages and /mon-compte"
```

---

## Task 10 : Ajouter `/gestion-compte` (dessinateur) et `/utilisateurs` (admin owner)

**Objectif :** Les deux dernières routes "simples" qui ne dépendent pas des commandes.

**Files :**
- Modify : `src/components/AppRouter.js`

- [ ] **Step 1 : Ajouter les routes**

Dans `AppRouter.js`, à l'intérieur du `<Route element={<LayoutPrincipal ...>}>` :

```jsx
import RequireRole from "./RequireRole";
import GestionCompteDessinateur from "./GestionCompteDessinateur";
import GestionUtilisateurs from "./GestionUtilisateurs";

// ... dans la JSX, à l'intérieur du <Route element={<LayoutPrincipal>}> :
<Route element={<RequireRole profil={profil} roles={["dessinateur"]} />}>
  <Route path="/gestion-compte" element={<GestionCompteDessinateurWrapper />} />
</Route>

<Route element={<RequireRole profil={profil} roles={["admin", "utilisateur"]} requireOwner />}>
  <Route path="/utilisateurs" element={<GestionUtilisateurs />} />
</Route>
```

> **Important :** les rôles dans le code sont `admin`, `dessinateur`, `utilisateur`. Il n'y a pas de rôle `client`. La règle d'accès actuelle pour `/utilisateurs` est `profil.is_owner === true` (cf. `VueUtilisateur.js:63`), ce qui inclut admin owner ET utilisateur owner. Le `roles={["admin", "utilisateur"]} requireOwner` reproduit ce comportement à l'identique.

```jsx
function GestionCompteDessinateurWrapper() {
  const { profil, sousComptes } = useOutletContext();
  return <GestionCompteDessinateur profil={profil} sousComptes={sousComptes} />;
}
```

> **Note pour l'implémenteur :** `sousComptes` vient du contexte du `<LayoutPrincipal>` (Task 8 Step 3). Ne pas re-fetcher ici. Vérifier que la requête de chargement dans `<LayoutPrincipal>` couvre bien le scope dessinateur (c'est-à-dire qu'un dessinateur owner voit ses sous-comptes dessinateurs). Si la logique diverge entre rôles, faire un `if` dans `chargerTout()` du layout.

- [ ] **Step 2 : Vérification manuelle**

```bash
npm start
```

- Dessinateur : naviguer vers `/gestion-compte` → la page s'affiche avec sidebar dessinateur (orange).
- Dessinateur : naviguer vers `/utilisateurs` → redirige vers `/commandes` (RequireRole bloque).
- Admin owner : naviguer vers `/utilisateurs` → la page `GestionUtilisateurs` s'affiche.
- Admin non-owner (si dispo) : naviguer vers `/utilisateurs` → redirige vers `/commandes`.
- Admin : naviguer vers `/gestion-compte` → redirige vers `/commandes`.
- Sidebar : items affichés correctement par rôle (cf. table des items dans la spec).

- [ ] **Step 3 : Commit**

```bash
git add src/components/AppRouter.js
git commit -m "feat(v2): add /gestion-compte and /utilisateurs routes with role guards"
```

---

## Task 11 : Créer `<ListeCommandes>` avec filtres synchronisés URL

**Objectif :** La page liste des commandes en route propre, avec filtres dans l'URL via `useSearchParams`. Pour l'instant **sans le modal détail** (Task 12).

**Files :**
- Create : `src/components/ListeCommandes.js`
- Modify : `src/components/AppRouter.js`

- [ ] **Step 1 : Étudier la logique métier des Vue\***

Lire et comprendre :
- `VueUtilisateur.js` la branche `vue === "commandes"` (l.521 et suivantes) : chargement des commandes, filtres, tri, rendu du tableau, gestion du modal.
- `VueDessinateur.js` la branche `vue === "commandes"` (l.354 et suivantes) : équivalent côté dessinateur (libellés différents, scope des commandes différent).
- `BarreFiltres.js` : API exacte des props.

Identifier :
- Comment les commandes sont chargées (fetch Supabase + realtime).
- Comment elles sont filtrées par rôle (admin voit tout, dessinateur seulement les siennes, client seulement les siennes).
- Le rendu du tableau (colonnes, formatage).
- Les actions disponibles par ligne (clic ouvre modal, autres actions).

- [ ] **Step 2 : Créer `src/components/ListeCommandes.js`**

`ListeCommandes` **ne fetch pas** : elle consomme `commandes` et `sousComptes` exposés par `<LayoutPrincipal>`. Elle gère :
- les filtres URL,
- la séparation actives/archivées (filtrage côté client sur `is_archived` ou `is_archived_dessinateur` selon le rôle),
- le filtrage par sous-compte (`userFilter` pour les owners),
- le tri,
- le rendu du tableau (markup à reproduire fidèlement depuis les Vue*),
- la sous-route modal détail via `<Outlet>`.

```jsx
import { useState } from "react";
import { useSearchParams, useNavigate, useOutletContext, Outlet } from "react-router-dom";
import BarreFiltres, { appliquerFiltresTri } from "./BarreFiltres";
// + autres imports nécessaires (Badge, etc.)

export default function ListeCommandes() {
  const { profil, commandes, setCommandes, sousComptes } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userFilter, setUserFilter] = useState(null); // null = tous, uuid = sous-compte filtré
  const navigate = useNavigate();

  // Filtres lus depuis l'URL
  const filtres = {
    statut:      searchParams.get("statut") || "",
    dessinateur: searchParams.get("dessinateur") || "",
    type:        searchParams.get("type") || "",
    periode:     searchParams.get("periode") || "",
  };
  const tri = {
    col: searchParams.get("tri") || "created_at",
    dir: searchParams.get("dir") || "desc",
  };

  const setFiltres = (next) => {
    const params = new URLSearchParams(searchParams);
    ["statut", "dessinateur", "type", "periode"].forEach(k => {
      if (next[k]) params.set(k, next[k]);
      else params.delete(k);
    });
    setSearchParams(params, { replace: true });
  };

  const setTri = (updaterOrValue) => {
    const nextTri = typeof updaterOrValue === "function" ? updaterOrValue(tri) : updaterOrValue;
    const params = new URLSearchParams(searchParams);
    if (nextTri.col === "created_at" && nextTri.dir === "desc") {
      params.delete("tri"); params.delete("dir");
    } else {
      params.set("tri", nextTri.col); params.set("dir", nextTri.dir);
    }
    setSearchParams(params, { replace: true });
  };

  // 1. Filtre actives/archivées selon le rôle
  //    - dessinateur : utilise is_archived_dessinateur (archivage propre au dessinateur)
  //    - autres rôles (admin, utilisateur) : utilise is_archived
  const champArchive = profil.role === "dessinateur" ? "is_archived_dessinateur" : "is_archived";
  const actives = commandes.filter(c => !c[champArchive]);

  // 2. Filtre par sous-compte si applicable (cf. VueUtilisateur.js:363, VueDessinateur.js:268-273)
  const apresUserFilter = userFilter
    ? actives.filter(c => {
        if (profil.role === "dessinateur") {
          // Filtre par sous-dessinateur : missions assignées à dessinateur_id = userFilter
          return c.dessinateur_id === userFilter;
        }
        // Filtre par sous-compte utilisateur : utilisateur_id = userFilter
        return c.utilisateur_id === userFilter;
      })
    : actives;

  // 3. Application des filtres + tri standards via le helper existant
  const commandesFiltrees = appliquerFiltresTri(apresUserFilter, filtres, tri);

  return (
    <div>
      {/* Sélecteur sous-compte si owner avec sous-comptes */}
      {sousComptes.length > 0 && (
        <select value={userFilter ?? ""} onChange={e => setUserFilter(e.target.value || null)}>
          <option value="">Tous les comptes</option>
          {sousComptes.map(s => <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>)}
        </select>
      )}

      <BarreFiltres
        commandes={actives}
        filtres={filtres}
        setFiltres={setFiltres}
        tri={tri}
        setTri={setTri}
        showDessinateur={profil.role === "admin"}
        couleurAccent={profil.role === "dessinateur" ? "#FC6C1B" : "#122131"}
      />

      <table>
        {commandesFiltrees.map(c => (
          <tr key={c.id} onClick={() => navigate(`/commandes/${encodeURIComponent(c.ref)}`)}>
            {/* Reproduire les colonnes existantes — voir VueUtilisateur.js:380+ et VueDessinateur.js:480+ */}
          </tr>
        ))}
      </table>

      <Outlet context={{ commandes, setCommandes, sousComptes, profil }} />
    </div>
  );
}
```

> **Notes pour l'implémenteur :**
> - **Pas de `.eq(...)` côté client** : la sécurité passe par les RLS Supabase. Filtrer en JS uniquement pour actives/archivées et userFilter.
> - **Reproduire fidèlement** le markup du tableau (colonnes, badges, tooltips, boutons d'action, gestion des plans non lus, etc.) depuis `VueUtilisateur.js` (rendu commandes l.~380-500) et `VueDessinateur.js` (rendu missions l.~480-570). Les colonnes diffèrent légèrement entre les deux rôles — adapter via `if (profil.role === "dessinateur") { ... }`.
> - **Tri par défaut `desc` sur `created_at`** : intentionnellement aligné avec l'état actuel du code. La spec mentionne `asc` comme défaut quand `?tri=` est défini sans `?dir=` — au moment où l'utilisateur partage une URL avec `?tri=delai`, le destinataire verra `desc`. Si le comportement souhaité est `asc` par défaut (cohérent avec la spec), changer `searchParams.get("dir") || "desc"` en `searchParams.get("dir") || "asc"`. **À confirmer avec l'utilisateur** si les URL partagées doivent toujours s'ouvrir en `asc`.
> - **Sortir le `userFilter` dans l'URL ?** Pour V2, on garde `userFilter` en `useState` local (pas dans l'URL), ce qui correspond au comportement actuel des Vue*. Si l'utilisateur veut le partager via lien plus tard, on pourra le migrer vers `useSearchParams` dans une itération séparée.

- [ ] **Step 3 : Brancher la route dans `AppRouter.js`**

À l'intérieur du `<Route element={<LayoutPrincipal>}>` :

```jsx
<Route path="/commandes" element={<ListeCommandes />} />
```

Important : ajouter aussi une redirection `/` → `/commandes` :

```jsx
<Route index element={<Navigate to="/commandes" replace />} />
```

- [ ] **Step 4 : Vérification manuelle**

```bash
npm start
```

- Admin connecté : `/commandes` affiche la liste avec sidebar admin. Filtres fonctionnent : sélectionner un statut → URL devient `?statut=...`. Recharger la page → filtre conservé. Copier l'URL dans un autre onglet → mêmes filtres.
- Dessinateur : `/commandes` affiche ses missions, sidebar dessinateur orange.
- Tri : cliquer sur "Date" → `?tri=created_at&dir=asc`, recliquer → bascule en `desc` et `?tri` et `?dir` disparaissent (valeurs par défaut).
- Clic sur une ligne : URL devient `/commandes/REF-XXX` mais le modal n'est pas encore implémenté → c'est acceptable pour cette task (passe à Task 12 immédiatement après).
- Compteur de plans, statuts, dessinateurs : doivent être identiques à l'ancien rendu.

- [ ] **Step 5 : Commit**

```bash
git add src/components/ListeCommandes.js src/components/AppRouter.js
git commit -m "feat(v2): add ListeCommandes route with URL-synced filters and sort"
```

---

## Task 12 : Ajouter le modal détail commande synchronisé avec l'URL

**Objectif :** `/commandes/:ref` ouvre `DetailCommandeModal` au-dessus de la liste.

**Files :**
- Create : `src/components/ModalDetailCommande.js`
- Modify : `src/components/AppRouter.js`
- Modify : `src/components/ListeCommandes.js` (s'assurer que `<Outlet>` est rendu)

- [ ] **Step 1 : Créer `src/components/ModalDetailCommande.js`**

```jsx
import { useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import DetailCommandeModal from "./DetailCommandeModal";

export default function ModalDetailCommande({ retour = "/commandes" }) {
  const { ref } = useParams();
  const navigate = useNavigate();
  const { commandes, setCommandes } = useOutletContext();

  const commande = commandes.find(c => c.ref === decodeURIComponent(ref || ""));

  useEffect(() => {
    if (commandes.length > 0 && !commande) {
      // Ref inexistante : toast + redirection
      // (Si pas de système de toast en place, simple console.warn + redirection)
      console.warn(`Commande introuvable : ${ref}`);
      navigate(retour, { replace: true });
    }
  }, [commande, commandes.length, ref, retour, navigate]);

  if (!commande) return null;

  return (
    <DetailCommandeModal
      commande={commande}
      onFermer={() => navigate(retour)}
      onMaJ={(updated) => setCommandes(prev => prev.map(c => c.id === updated.id ? updated : c))}
      // + autres props requises par DetailCommandeModal — à reproduire depuis l'usage actuel dans VueUtilisateur/VueDessinateur
    />
  );
}
```

> **Note pour l'implémenteur :**
> - Lire `DetailCommandeModal` pour identifier toutes ses props requises.
> - Comparer avec l'usage actuel dans `VueUtilisateur.js` et `VueDessinateur.js` pour les passer toutes correctement.
> - Le système de toast peut être un simple `alert` ou un `console.warn` initialement ; un vrai toast peut être ajouté plus tard.

- [ ] **Step 2 : Imbriquer la sous-route dans `AppRouter.js`**

```jsx
<Route path="/commandes" element={<ListeCommandes />}>
  <Route path=":ref" element={<ModalDetailCommande />} />
</Route>
```

- [ ] **Step 3 : Vérifier que `<ListeCommandes>` rend bien `<Outlet>`**

Le squelette de Task 11 inclut `<Outlet context={...}>` ; vérifier que c'est bien présent et que `commandes` et `setCommandes` sont passés via `context`.

- [ ] **Step 4 : Vérification manuelle**

```bash
npm start
```

- Cliquer sur une ligne du tableau → URL devient `/commandes/REF-XXX`, modal s'ouvre par-dessus.
- Fermer le modal (croix) → URL revient à `/commandes`.
- Bouton précédent du navigateur → ferme le modal.
- Copier `/commandes/REF-XXX` dans un autre onglet → liste se charge, modal s'ouvre directement.
- Naviguer vers `/commandes/REF-INEXISTANT` → console warn + redirection vers `/commandes`.
- Pendant que le modal est ouvert : modifier le statut (si autorisé), envoyer un message → vérifier que ça marche comme avant.

- [ ] **Step 5 : Commit**

```bash
git add src/components/ModalDetailCommande.js src/components/AppRouter.js src/components/ListeCommandes.js
git commit -m "feat(v2): wire commande detail modal to /commandes/:ref route"
```

---

## Task 13 : Créer `<ListeArchives>` et son modal détail

**Objectif :** Reproduire le pattern de Task 11 + 12 pour `/commandes/archives` et `/commandes/archives/:ref`.

**Files :**
- Create : `src/components/ListeArchives.js`
- Modify : `src/components/AppRouter.js`

- [ ] **Step 1 : Créer `src/components/ListeArchives.js`**

C'est essentiellement une copie de `ListeCommandes.js` avec **une seule différence** : la première étape de filtrage prend les **archivées** au lieu des actives :

```jsx
const champArchive = profil.role === "dessinateur" ? "is_archived_dessinateur" : "is_archived";
const archivees = commandes.filter(c => c[champArchive] === true);
```

Le reste (filtres URL, sous-comptes, tri, rendu) est identique. Sur clic ligne : `navigate(\`/commandes/archives/${encodeURIComponent(c.ref)}\`)`. `<Outlet>` rend `<ModalDetailCommande retour="/commandes/archives" />`.

> **Note pour l'implémenteur :** la duplication avec `ListeCommandes` est volontaire pour V2 (cf. spec migration step 7 « dupliquer le pattern »). Si la duplication dépasse 80% à l'implémentation, envisager une factorisation en `<ListeBase mode="actives|archivees" />` mais ne pas le faire prématurément. La spec autorise l'évaluation pendant l'implémentation.

> **Important :** les RLS Supabase doivent autoriser les commandes archivées dans le résultat du fetch unique fait par `<LayoutPrincipal>`. Vérifier en démarrant l'app et en allant sur `/commandes/archives` que les archivées s'affichent bien — si la query renvoyée ne les contient pas, c'est une RLS qui les exclut côté serveur, et il faudra ajuster le fetch ou les RLS.

- [ ] **Step 2 : Brancher les routes dans `AppRouter.js`**

```jsx
<Route path="/commandes/archives" element={<ListeArchives />}>
  <Route path=":ref" element={<ModalDetailCommande retour="/commandes/archives" />} />
</Route>
```

> **Important :** déclarer `/commandes/archives` AVANT `/commandes/:ref` dans le tableau de routes — sinon `archives` sera matché comme un `:ref`. Avec react-router-dom v7, l'ordre dans le JSX importe pour les routes statiques vs dynamiques.

- [ ] **Step 3 : Vérification manuelle**

```bash
npm start
```

- Naviguer vers `/commandes/archives` (depuis le menu 3 points existant ou en tapant l'URL) → liste des archivées s'affiche.
- Cliquer sur une commande archivée → URL devient `/commandes/archives/REF-XXX`, modal détail s'ouvre.
- Fermer → revient à `/commandes/archives`.
- Recharger sur `/commandes/archives/REF-XXX` → liste archives + modal directement.

- [ ] **Step 4 : Commit**

```bash
git add src/components/ListeArchives.js src/components/AppRouter.js
git commit -m "feat(v2): add archives route with nested detail modal"
```

---

## Task 14 : Modal détail utilisateur pour `/utilisateurs/:uid`

**Objectif :** Pattern symétrique au modal commande pour la gestion utilisateurs.

**Files :**
- Create : `src/components/ModalDetailUtilisateur.js`
- Modify : `src/components/GestionUtilisateurs.js` — exposer la sélection via `<Outlet>`
- Modify : `src/components/AppRouter.js`

- [ ] **Step 1 : Lire `GestionUtilisateurs.js` en entier**

Comprendre :
- Comment `selected` est utilisé (cf. `GestionUtilisateurs.js:8`).
- Où le panneau de détail/modal est rendu.
- Comment la fermeture est déclenchée (`setSelected(null)`).
- Quelle structure exposer aux enfants (la liste des comptes, le setter).

- [ ] **Step 2 : Modifier `GestionUtilisateurs` pour rendre `<Outlet context={...}>` et naviguer au clic ligne**

Au lieu d'avoir un panneau de détail piloté directement par le state local `selected`, on délègue à la sous-route. Modifications précises :

1. **Ajouter l'import** : `import { Outlet, useNavigate } from "react-router-dom";`
2. **Ajouter `const navigate = useNavigate();`** au début de la fonction.
3. **Remplacer le clic ligne** : à la ligne 139 (`setSelected(c)` dans le `onClick` des lignes du tableau, à confirmer en lisant le fichier — chercher l'occurrence où une ligne du tableau appelle `setSelected(c)` pour ouvrir le panneau de détail), remplacer par `navigate(\`/utilisateurs/\${c.id}\`)`.
4. **Conserver `selected` et `setSelected` internes** : ils restent utilisés par le panneau de détail interne (édition de l'utilisateur). C'est `<ModalDetailUtilisateur>` qui synchronise `selected` avec `useParams().uid`.
5. **Ajouter `<Outlet context={{ comptes, selected, setSelected }} />`** à la fin du JSX retourné, après le panneau de détail existant (qui reste rendu en interne).

> **Note pour l'implémenteur :** lire le fichier en entier d'abord. Le clic ligne actuel se trouve dans la fonction de rendu d'une ligne du tableau (chercher `style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1.4fr"` qui est la ligne 218 d'après le grep). La ligne porte un `onClick` qui appelle `setSelected(c)` — c'est cette occurrence à transformer en `navigate(\`/utilisateurs/\${c.id}\`)`.

- [ ] **Step 3 : Créer `src/components/ModalDetailUtilisateur.js`**

```jsx
import { useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";

export default function ModalDetailUtilisateur() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { comptes, setSelected } = useOutletContext();

  const compte = comptes.find(c => c.id === uid);

  useEffect(() => {
    if (comptes.length > 0 && !compte) {
      console.warn(`Utilisateur introuvable : ${uid}`);
      navigate("/utilisateurs", { replace: true });
      return;
    }
    if (compte) setSelected(compte);
    return () => setSelected(null);
  }, [uid, compte, comptes.length, navigate, setSelected]);

  // Le panneau de détail est en fait rendu par GestionUtilisateurs lui-même via le state `selected`
  // (qu'on vient de mettre à jour). Donc ce composant ne rend rien visuellement, il pilote juste le state.
  return null;
}
```

- [ ] **Step 4 : Brancher la route imbriquée**

> **Important :** la route `/utilisateurs` a déjà été déclarée en Task 10 Step 1. Cette étape **modifie** la déclaration existante pour ajouter la sous-route `:uid`, et ne duplique pas la route parente. Localiser le bloc créé en Task 10 dans `AppRouter.js` et le remplacer par la version imbriquée ci-dessous (mêmes rôles, même `requireOwner`) :

```jsx
<Route element={<RequireRole profil={profil} roles={["admin", "utilisateur"]} requireOwner />}>
  <Route path="/utilisateurs" element={<GestionUtilisateurs />}>
    <Route path=":uid" element={<ModalDetailUtilisateur />} />
  </Route>
</Route>
```

- [ ] **Step 5 : Vérification manuelle**

```bash
npm start
```

- Admin owner : naviguer vers `/utilisateurs` → liste s'affiche, panneau détail vide.
- Cliquer sur une ligne → URL devient `/utilisateurs/<uid>`, panneau détail s'ouvre avec les infos.
- Fermer le panneau (X ou clic ailleurs) → URL revient à `/utilisateurs`.
- Naviguer vers `/utilisateurs/uid-bidon` → console warn + redirection vers `/utilisateurs`.
- Modification d'un utilisateur (changement de rôle, ban) : doit fonctionner exactement comme avant.

- [ ] **Step 6 : Commit**

```bash
git add src/components/ModalDetailUtilisateur.js src/components/GestionUtilisateurs.js src/components/AppRouter.js
git commit -m "feat(v2): wire user detail modal to /utilisateurs/:uid route"
```

---

## Task 15 : Ajouter `<Page404>` et nettoyer le legacy shell

**Objectif :** Toutes les routes sont maintenant migrées. Plus besoin du `legacyShell` ni du `path="*"` qui le rendait.

**Files :**
- Create : `src/components/Page404.js`
- Modify : `src/components/AppRouter.js`
- Modify : `src/App.js` (suppression de la construction de `legacyShell`)

- [ ] **Step 1 : Créer `src/components/Page404.js`**

```jsx
import { Link } from "react-router-dom";

export default function Page404() {
  return (
    <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 420, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤔</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: "#122131", marginBottom: 12 }}>Page introuvable</div>
        <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Cette page n'existe pas ou a été déplacée.
        </div>
        <Link to="/commandes" style={{ background: "#122131", color: "#fff", textDecoration: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13 }}>
          Retour aux commandes
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Remplacer `path="*" element={legacyShell}` par `<Page404 />` dans `AppRouter.js`**

```jsx
import Page404 from "./Page404";

// Dans le <Routes>, à la place du fallback legacy :
<Route path="*" element={<Page404 />} />
```

- [ ] **Step 3 : Nettoyer `App.js`**

```jsx
// Supprimer :
// - import VueUtilisateur from "./components/VueUtilisateur";
// - import VueDessinateur from "./components/VueDessinateur";
// - le bloc `let legacyShell = null; if (session && profil) { ... }`
// - la prop legacyShell passée à AppRouter

// App.js devient beaucoup plus simple — il ne fait plus que session/profil/inactivité/PASSWORD_RECOVERY
// puis délègue à AppRouter.
```

- [ ] **Step 4 : Vérification manuelle**

```bash
npm start
```

- Naviguer vers `/n-importe-quoi-bidon` → Page 404 s'affiche avec lien retour.
- Cliquer sur le lien → revient à `/commandes`.
- Toutes les routes existantes continuent à fonctionner : `/commandes`, `/commandes/REF-X`, `/commandes/archives`, `/utilisateurs`, `/reglages`, `/mon-compte`, `/gestion-compte`.
- Login + déconnexion + reset password : OK.

- [ ] **Step 5 : Commit**

```bash
git add src/components/Page404.js src/components/AppRouter.js src/App.js
git commit -m "feat(v2): add 404 page and remove legacy shell fallback"
```

---

## Task 16 : Supprimer `VueUtilisateur` et `VueDessinateur`

**Objectif :** Plus rien n'utilise ces composants. On les supprime.

**Files :**
- Delete : `src/components/VueUtilisateur.js`
- Delete : `src/components/VueDessinateur.js`

- [ ] **Step 1 : Vérifier qu'aucun fichier n'importe ces composants**

```bash
grep -rn "VueUtilisateur\|VueDessinateur" src/
```

Expected : aucun résultat (ou uniquement les fichiers eux-mêmes).

Si des résultats apparaissent en dehors des deux fichiers cibles, **ne pas continuer** — analyser et corriger d'abord.

- [ ] **Step 2 : Supprimer les deux fichiers**

```bash
git rm src/components/VueUtilisateur.js src/components/VueDessinateur.js
```

- [ ] **Step 3 : Vérification manuelle**

```bash
npm start
```

- L'app compile sans erreur.
- Toutes les routes fonctionnent.
- Tous les rôles fonctionnent.

- [ ] **Step 4 : Commit**

```bash
git commit -m "chore(v2): remove obsolete VueUtilisateur and VueDessinateur"
```

---

## Task 17 : Tester sur Vercel staging et mettre à jour la config Supabase

**Objectif :** Premier vrai test en condition réelle. Préparer la config Supabase pour le redirect_to du reset password.

**Files :**
- (aucune modification de fichier ; uniquement déploiement et config externe)

- [ ] **Step 1 : Pousser V2 vers staging**

```bash
git checkout staging
git pull --ff-only origin staging
git merge V2
git push origin staging
```

Cela déclenche le déploiement automatique Vercel sur la branche `staging` (cf. `docs/superpowers/specs/2026-04-16-staging-codespaces-vercel-design.md`).

- [ ] **Step 2 : Attendre la fin du build Vercel**

Aller sur Vercel Dashboard → projet plans-incendie → suivre le build. Récupérer l'URL de déploiement (typiquement `plans-incendie.vercel.app` ou similaire).

- [ ] **Step 3 : Ajouter l'URL Vercel staging à la whitelist Supabase**

Dans Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, ajouter :
- `https://<URL-Vercel-staging>/reset-mot-de-passe`

(Le wildcard `https://<URL-Vercel-staging>/*` est aussi acceptable pour faciliter les futurs ajouts.)

- [ ] **Step 4 : Tests manuels sur l'URL Vercel staging**

Dérouler la checklist complète de la spec section "Tests manuels à valider avant merge V2 → main" :

- [ ] Login admin / dessinateur / client → arrive bien sur `/commandes`.
- [ ] Deep link `/commandes/REF-XXX` non connecté → redirige `/connexion?redirect=...`, après login retourne à la commande.
- [ ] Filtres : changer statut/type/periode/dessinateur, copier l'URL dans un autre onglet → mêmes filtres appliqués.
- [ ] Tri : cliquer une colonne, vérifier que `?tri=` et `?dir=` apparaissent et que recharger la page conserve le tri.
- [ ] Sélection puis désélection d'un filtre → param disparaît de l'URL.
- [ ] Modal détail commande : fermeture via croix / overlay / échap / bouton précédent → URL revient à `/commandes` ou `/commandes/archives`.
- [ ] Référence ou uid inexistant → toast/warn + URL nettoyée.
- [ ] Lien email reset mot de passe → arrive sur `/reset-mot-de-passe`.
- [ ] Inactivité 30 min → redirection vers `/connexion`.
- [ ] Statuts profil : `en_attente`, `refuse`, `banni` → écran bloquant correct, URL inchangée.
- [ ] Admin owner accède à `/utilisateurs`, autres rôles redirigés.
- [ ] Dessinateur accède à `/gestion-compte`, autres redirigés.
- [ ] Page 404 sur URL inconnue.
- [ ] Rafraîchissement F5 sur n'importe quelle URL → pas de 404 serveur.
- [ ] Bouton précédent du navigateur cohérent.
- [ ] Realtime Supabase (messages dans modal commande) continue de fonctionner.

- [ ] **Step 5 : Si bugs détectés**

Pour chaque bug identifié :
1. Reproduire en local.
2. Corriger sur la branche V2.
3. Re-merger V2 → staging.
4. Re-tester.

Ne pas passer à la Task 18 tant que tous les tests sont verts.

- [ ] **Step 6 : Pas de commit (déploiement uniquement)**

---

## Task 18 : Préparer la prod (rewrite SPA) puis merger V2 → main

**Objectif :** S'assurer que `incendieplan.fr` gère les rewrites SPA, puis basculer V2 en prod.

**Files :**
- Possiblement : ajouter un fichier `.htaccess` ou équivalent dans `public/` selon le serveur

- [ ] **Step 1 : Identifier le type d'hébergement de incendieplan.fr**

Le déploiement actuel passe par GitHub Actions FTP (cf. spec staging). Identifier le serveur cible :
- Apache → ajouter un `.htaccess`
- Nginx → la config est côté serveur, pas dans le repo
- Hébergement statique pur → potentiellement bloquant

À demander à l'utilisateur si l'info n'est pas dans le repo.

- [ ] **Step 2 : Si Apache, ajouter `public/.htaccess`**

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

> **Note :** ce fichier est copié dans `build/` par CRA et déployé tel quel par le workflow FTP.

- [ ] **Step 3 : Vérifier le `redirect_to` dans la config Supabase pour la prod**

Dans Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, vérifier que `https://incendieplan.fr/reset-mot-de-passe` est bien dans la liste. L'ajouter sinon.

- [ ] **Step 4 : Tester le rewrite sur staging avant prod**

Sur l'URL Vercel : taper `/commandes/REF-XYZ` directement dans la barre d'adresse, valider, F5. Si pas de 404 → la règle Vercel fonctionne.

- [ ] **Step 4bis : Vérifier que `.htaccess` est bien copié dans le build**

Si le Step 2 a ajouté `public/.htaccess`, exécuter en local :

```bash
npm run build
ls build/.htaccess
```

Expected : le fichier existe dans `build/`. CRA copie normalement `public/` vers `build/` y compris les dotfiles, mais certains workflows FTP excluent les fichiers cachés par défaut. Inspecter `.github/workflows/deploy.yml` pour vérifier que `.htaccess` n'est pas exclu lors de l'upload FTP. Si exclusion → ajuster le pattern du workflow.

- [ ] **Step 5 : Merger V2 → main**

```bash
git checkout main
git pull --ff-only origin main
git merge V2
git push origin main
```

Cela déclenche GitHub Actions FTP qui déploie sur incendieplan.fr.

- [ ] **Step 6 : Tests manuels sur la prod**

Re-dérouler les tests critiques sur https://incendieplan.fr :
- Login OK.
- Naviguer vers `/commandes/REF-XXX` directement → pas de 404.
- F5 sur n'importe quelle URL → pas de 404.
- Reset password via email → fonctionne.

- [ ] **Step 7 : Si tout est OK, commit éventuel pour `.htaccess`**

Si Step 2 a ajouté un fichier :

```bash
git add public/.htaccess
git commit -m "chore(v2): add SPA rewrite rule for production hosting"
git push origin main
```

---

## Récap final

À l'issue de ce plan :
- ✅ Toutes les pages ont une URL canonique.
- ✅ Les commandes sont partageables via lien direct (interne, protégé par auth).
- ✅ Les filtres sont dans l'URL, partageables.
- ✅ Le bouton précédent du navigateur fonctionne naturellement.
- ✅ Les composants existants (`DetailCommandeModal`, `BarreFiltres`, etc.) ne sont pas modifiés.
- ✅ Le visuel est préservé (sidebar, pages, modals).
- ✅ L'architecture est prête pour ajouter une page publique `/validation/<token>` plus tard sans refonte.

## Prochains chantiers (hors V2)

- Page publique de validation client (`/validation/<token>`) avec génération de token + révocation.
- Tests automatisés du routage (smoke tests sur RequireAuth, RequireRole, navigation).
- Lazy loading des routes si le bundle grossit.
