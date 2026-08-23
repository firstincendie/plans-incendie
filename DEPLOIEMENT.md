# Guide de déploiement — Plans Incendie

Circuit : **travailler en local → déployer sur Vercel (test) → publier sur incendieplan.fr**,
directement depuis ton ordinateur avec l'outil **Vercel CLI** (sans passer par GitHub).

| Commande        | Ce qui se passe                                              |
| --------------- | ----------------------------------------------------------- |
| `npm start`     | Le site tourne sur ton ordinateur (http://localhost:3000)   |
| `vercel`        | Déploie une **version de TEST** (URL preview) — officiel intact |
| `vercel --prod` | Publie la **version officielle → incendieplan.fr**          |

---

## 1. Installer le projet en local (une seule fois)

Prérequis : [Node.js](https://nodejs.org) (v18+) et [Git](https://git-scm.com).

```bash
git clone https://github.com/firstincendie/plans-incendie.git
cd plans-incendie
npm install
npm start        # ouvre http://localhost:3000
```

> Aucune configuration secrète : la connexion Supabase est déjà incluse dans
> `src/supabase.js` (clé publique).

---

## 2. Installer et connecter Vercel CLI (une seule fois)

Dans le terminal, **à la racine du dossier plans-incendie** :

```bash
npm i -g vercel      # installe l'outil Vercel
vercel login         # connexion (Continue with GitHub, ou par email)
vercel link          # relie ce dossier au projet Vercel existant
```

Réponses pour `vercel link` :
- *Set up and deploy?* → **yes**
- *Which scope?* → ton compte
- *Link to existing project?* → **yes** → choisir le projet **plans-incendie**

Cela crée un dossier `.vercel/` (déjà ignoré par Git) qui mémorise le lien.

---

## 3. Déployer

```bash
vercel           # → VERSION DE TEST : donne une URL de preview unique
vercel --prod    # → VERSION OFFICIELLE : publie sur incendieplan.fr
```

- `vercel` sert à vérifier en ligne sans risque avant de publier.
- `vercel --prod` met à jour le site officiel.

---

## 4. Brancher le domaine incendieplan.fr (une seule fois)

À faire une fois dans le tableau de bord Vercel :

1. Ouvrir le projet sur **vercel.com** → **Settings → Domains**.
2. Ajouter `incendieplan.fr` (et `www.incendieplan.fr`).
3. Vercel affiche les **enregistrements DNS** à créer, en général :
   - `incendieplan.fr` → enregistrement **A** vers `76.76.21.21`
   - `www` → enregistrement **CNAME** vers `cname.vercel-dns.com`
   > ⚠️ Utiliser **exactement** les valeurs affichées par Vercel.
4. Chez ton **registrar** (où le domaine a été acheté : OVH, Gandi, IONOS…),
   ouvrir la **zone DNS** et créer ces enregistrements.
5. Attendre la propagation. Vercel affiche **« Valid Configuration »** quand c'est bon.
   Le **HTTPS est automatique**.

Une fois le domaine rattaché, chaque `vercel --prod` met à jour incendieplan.fr.

---

## Récapitulatif du quotidien

```bash
# développer et tester en local
npm start

# déployer une version de test en ligne
vercel

# publier la version officielle sur incendieplan.fr
vercel --prod
```
