# Spec : Environnement staging — GitHub Codespaces + Vercel

**Date :** 2026-04-16
**Statut :** Approuvé

## Contexte

Actuellement, les mises à jour du site passent par un cycle local : développement sur `localhost:3000`, puis déploiement sur `incendieplan.fr` via GitHub Actions (FTP). Ce workflow impose d'être sur sa machine principale.

L'objectif est de pouvoir faire appel à Claude Code depuis n'importe quel appareil (autre PC, tablette) pour modifier l'application, en passant par une URL de test avant de pousser en production.

## Objectifs

- Permettre de travailler avec Claude Code depuis n'importe quel navigateur
- Disposer d'une URL de test stable pour valider les changements avant la mise en production
- Ne pas toucher au déploiement production sur incendieplan.fr

## Architecture

### Branches permanentes

| Branche | Rôle | Cible de déploiement |
|---|---|---|
| `staging` | Développement & test | Vercel (URL test) |
| `main` | Production | incendieplan.fr via FTP (inchangé) |

### Flux de travail

```
[GitHub Codespaces — navigateur]
        |
        | push
        ↓
  branche staging
        |
        | auto-deploy (Vercel)
        ↓
  plans-incendie.vercel.app  ← validation
        |
        | merge staging → main
        ↓
  GitHub Actions (FTP)
        |
        ↓
  incendieplan.fr  ← production
```

## Composants

### 1. Branche `staging`

- Créée à partir de `main`
- Branche permanente (ne se supprime pas après merge)
- Les merges `staging → main` se font manuellement une fois la validation faite sur l'URL test

### 2. Vercel (staging URL)

- Projet Vercel connecté au repo GitHub via OAuth
- Déploiement automatique configuré **uniquement sur la branche `staging`**
- Le déploiement automatique de `main` est désactivé dans Vercel (la prod reste sous GitHub Actions FTP)
- Variables d'environnement à configurer dans Vercel Dashboard :
  - `REACT_APP_SUPABASE_URL`
  - `REACT_APP_SUPABASE_ANON_KEY`
- URL résultante : `plans-incendie.vercel.app` (ou similaire, assigné par Vercel)
- Build command : `npm run build` / Output directory : `build` (Vercel détecte CRA automatiquement, à confirmer)
- **Règle SPA à configurer** : ajouter un fichier `vercel.json` à la racine pour que React Router fonctionne correctement (les routes directes ne renvoient pas 404) :

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Note Supabase :** staging et production partagent le même projet Supabase. Une migration de schéma sur staging impacte aussi la production — à garder en tête.

### 3. GitHub Codespaces

- Fichier `.devcontainer/devcontainer.json` ajouté au repo pour pré-configurer l'environnement :

```json
{
  "name": "plans-incendie",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "postCreateCommand": "npm install",
  "forwardPorts": [3000],
  "remoteEnv": {
    "REACT_APP_SUPABASE_URL": "${localEnv:REACT_APP_SUPABASE_URL}",
    "REACT_APP_SUPABASE_ANON_KEY": "${localEnv:REACT_APP_SUPABASE_ANON_KEY}"
  }
}
```

- Claude Code CLI s'installe manuellement via le terminal à la première ouverture (`npm install -g @anthropic-ai/claude-code`)
- Accès : depuis `github.com/[repo]` → bouton "Code" → "Codespaces" → "Create codespace on staging"

**Limite free tier GitHub :** 60h/mois (mise en veille automatique après 30 min d'inactivité).

### 4. GitHub Actions (inchangé)

- Le workflow `.github/workflows/deploy.yml` existant reste intact
- Il se déclenche uniquement sur push vers `main`
- La branche `staging` ne déclenche aucun déploiement FTP

## Ce qui ne change pas

- Le déploiement sur incendieplan.fr
- La configuration Supabase (Edge Functions, Auth, Realtime)
- La structure du code React

## Étapes d'implémentation (aperçu)

1. Créer la branche `staging` depuis `main`
2. Ajouter `.devcontainer/devcontainer.json`
3. Créer un compte/projet Vercel, connecter le repo GitHub
4. Configurer Vercel : branche `staging` uniquement, variables d'environnement
5. Confirmer que le workflow GitHub Actions cible uniquement `main` (aucun changement nécessaire — déjà correct)
6. Tester le flux complet : push sur staging → URL Vercel → merge → incendieplan.fr
