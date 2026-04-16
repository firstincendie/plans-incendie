# Staging Codespaces + Vercel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place un environnement staging (branche `staging` + Vercel) et configurer GitHub Codespaces pour permettre de travailler avec Claude Code depuis n'importe quel navigateur.

**Architecture:** Deux branches permanentes — `staging` auto-déploie sur Vercel (URL test), `main` déploie sur incendieplan.fr via GitHub Actions FTP (inchangé). GitHub Codespaces fournit un environnement de développement complet accessible depuis n'importe quel navigateur grâce à un `.devcontainer/devcontainer.json`.

**Tech Stack:** React CRA, GitHub Actions, GitHub Codespaces, Vercel

**Spec:** `docs/superpowers/specs/2026-04-16-staging-codespaces-vercel-design.md`

> **Note préalable :** Les clés Supabase sont hardcodées dans `src/supabase.js`. Aucune variable d'environnement n'est à configurer ni dans Vercel ni dans Codespaces.

> **Avertissement Supabase :** staging et production partagent le **même projet Supabase** (même base de données). Toute migration de schéma exécutée depuis l'environnement staging affecte aussi la production. Ne pas appliquer de migrations sans être sûr de l'impact.

---

## Fichiers créés / modifiés

| Fichier | Action | Responsabilité |
|---|---|---|
| `.devcontainer/devcontainer.json` | Créer | Configure l'environnement Codespaces (Node 20, npm install auto) |
| `vercel.json` | Créer | Règle de rewrite SPA pour React Router |

Aucun fichier existant n'est modifié.

---

## Task 1 : Créer la branche `staging` et les fichiers de config

**Files:**
- Create: `.devcontainer/devcontainer.json`
- Create: `vercel.json`

- [ ] **Step 1 : Créer la branche `staging` depuis `main`**

```bash
git checkout main
git pull
git checkout -b staging
```

Expected: branche `staging` créée et active.

- [ ] **Step 2 : Créer `.devcontainer/devcontainer.json`**

```json
{
  "name": "plans-incendie",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "postCreateCommand": "npm install",
  "forwardPorts": [3000]
}
```

- [ ] **Step 3 : Créer `vercel.json` à la racine**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 4 : Vérifier que le build React fonctionne toujours**

```bash
npm run build
```

Expected: `Compiled successfully.` — pas d'erreur de build.

- [ ] **Step 5 : Commit et push de la branche `staging`**

```bash
git add .devcontainer/devcontainer.json vercel.json
git commit -m "feat: ajouter devcontainer + vercel.json pour staging"
git push -u origin staging
```

Expected: branche `staging` visible sur GitHub.

---

## Task 2 : Configurer Vercel (étapes manuelles)

> Ces étapes se font depuis le navigateur sur vercel.com.

- [ ] **Step 1 : Créer un compte Vercel**

Aller sur [vercel.com](https://vercel.com) → "Sign Up" → choisir "Continue with GitHub" → autoriser Vercel à accéder aux repos.

- [ ] **Step 2 : Créer un nouveau projet Vercel**

Dans le dashboard Vercel → "Add New..." → "Project" → sélectionner le repo `plans-incendie` → "Import".

- [ ] **Step 3 : Configurer le projet**

Dans l'écran de configuration :
- **Framework Preset** : Vercel devrait détecter "Create React App" automatiquement
- **Build Command** : `npm run build` (auto-détecté)
- **Output Directory** : `build` (auto-détecté)
- **Environment Variables** : aucune à ajouter (les clés Supabase sont dans le code source)
- Cliquer **"Deploy"** — ce premier déploiement sera ignoré, c'est normal.

- [ ] **Step 4 : Empêcher Vercel de déployer la branche `main`**

> **Objectif :** seule la branche `staging` doit déclencher un déploiement Vercel. La branche `main` reste gérée par GitHub Actions FTP.

Dans Vercel → Project → Settings → Git → section **"Ignored Build Step"** :

Entrer la commande suivante :
```
[ "$VERCEL_GIT_COMMIT_REF" = "main" ] && exit 0 || exit 1
```

Cela indique à Vercel d'ignorer tout build déclenché par un push sur `main`. Les pushs sur `staging` (et toute autre branche) continuent de se déployer normalement.

- [ ] **Step 5 : Vérifier l'URL Vercel assignée**

Dans Vercel → Project → Overview → noter l'URL du projet (ex. `plans-incendie.vercel.app`).

---

## Task 3 : Vérifier le déploiement staging

- [ ] **Step 1 : Faire un push de test sur `staging`**

Depuis le terminal (local ou Codespaces) :

```bash
git checkout staging
# Faire une modification mineure visible, ex. ajouter un commentaire dans src/App.js
git add src/App.js
git commit -m "test: vérification déploiement Vercel staging"
git push origin staging
```

- [ ] **Step 2 : Vérifier le déploiement dans Vercel**

Dans Vercel → Project → Deployments : un nouveau déploiement doit apparaître, déclenché par le push sur `staging`.

Attendre ~1-2 min que le statut passe à **"Ready"**.

- [ ] **Step 3 : Tester l'URL staging**

Ouvrir l'URL Vercel dans le navigateur. Vérifier :
- L'application charge correctement
- La connexion Supabase fonctionne (essayer de se connecter)
- Les routes React Router fonctionnent (naviguer vers une page, rafraîchir — ne doit pas donner 404)

- [ ] **Step 4 : Revenir sur `main` et confirmer que GitHub Actions FTP est inchangé**

```bash
git checkout main
```

Aller sur GitHub → Actions → vérifier que le workflow "Deploy to incendieplan.fr" ne s'est pas déclenché suite aux pushs sur `staging`.

Expected : aucun run déclenché par les commits sur `staging`.

---

## Task 4 : Configurer GitHub Codespaces (étapes manuelles)

> Ces étapes se font depuis le navigateur sur github.com.

- [ ] **Step 1 : Vérifier que le devcontainer est reconnu**

Sur GitHub → repo `plans-incendie` → branche `staging` → cliquer le bouton vert **"Code"** → onglet **"Codespaces"**.

GitHub devrait proposer "Create codespace on staging".

- [ ] **Step 2 : Créer un Codespace de test**

Cliquer "Create codespace on staging". Attendre ~1-2 min que l'environnement se charge.

Expected :
- VS Code s'ouvre dans le navigateur
- Le terminal est disponible
- `node -v` affiche `v20.x.x`
- Les `node_modules` sont déjà installés (grâce à `postCreateCommand`)

- [ ] **Step 3 : Installer Claude Code CLI et s'authentifier**

Dans le terminal du Codespace :

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

Puis lancer l'authentification :

```bash
claude
```

Claude Code va demander une clé API Anthropic. La récupérer sur [console.anthropic.com](https://console.anthropic.com) → API Keys → "Create Key". Suivre les instructions dans le terminal.

Expected : Claude Code CLI installé, authentifié, prêt à l'emploi.

> Note : l'authentification (clé API) est stockée dans le Codespace et persiste tant que celui-ci existe. À refaire uniquement si le Codespace est supprimé et recréé.

> Note : l'installation npm est propre à chaque nouveau Codespace (quelques secondes).

---

## Task 5 : Tester le flux complet end-to-end

- [ ] **Step 1 : Le Codespace de la Task 4 est toujours ouvert — ne pas en créer un nouveau**

Rester dans le Codespace déjà ouvert à la Task 4. Si fermé par erreur, en créer un nouveau : github.com → repo → Code → Codespaces → "Create codespace on staging".

- [ ] **Step 2 : Faire une modification visible avec Claude Code**

Dans le terminal Codespace :
```bash
claude
```
Demander à Claude Code une modification mineure et observable (ex. changer un texte dans l'interface).

- [ ] **Step 3 : Pusher depuis le Codespace**

```bash
git add src/
git commit -m "test: modification depuis Codespace"
git push origin staging
```

> `git add src/` stage uniquement les fichiers source. Évite d'inclure accidentellement des fichiers de build ou des fichiers sensibles.

- [ ] **Step 4 : Valider sur l'URL Vercel**

Attendre le déploiement Vercel (~1-2 min) puis vérifier la modification sur l'URL staging.

- [ ] **Step 5 : Merger `staging` → `main` pour passer en production**

```bash
git checkout main
git merge staging
git push origin main
```

- [ ] **Step 6 : Vérifier le déploiement production**

Dans GitHub → Actions → "Deploy to incendieplan.fr" → le workflow doit se déclencher et se terminer avec succès.

Vérifier la modification sur incendieplan.fr.

- [ ] **Step 7 : Revenir sur `staging` pour la suite du développement**

```bash
git checkout staging
```

> Le workflow au quotidien est désormais : toujours travailler sur `staging`, merger sur `main` quand c'est prêt pour la prod.
