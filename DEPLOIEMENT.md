# Guide de déploiement — Plans Incendie

Ce guide explique **tout le circuit** : travailler en local → tester en ligne → publier sur
**incendieplan.fr**. Il est écrit pour être suivi même sans connaissances techniques.

Le principe (comme une vraie application) :

| Ce que tu fais              | Ce qui se passe                                           |
| --------------------------- | --------------------------------------------------------- |
| `npm start` en local        | Le site tourne sur ton ordinateur (http://localhost:3000) |
| Push sur une branche `test` | Vercel crée une **URL de test** (preview), site officiel intact |
| Push sur la branche `main`  | Met à jour la **version officielle → incendieplan.fr**    |

---

## 1. Installer le projet en local (une seule fois)

Prérequis : installer [Node.js](https://nodejs.org) (version 18 ou plus) et [Git](https://git-scm.com).

```bash
git clone https://github.com/firstincendie/plans-incendie.git
cd plans-incendie
npm install
npm start        # ouvre http://localhost:3000
```

> Aucune configuration secrète à ajouter : la connexion Supabase est déjà incluse
> dans `src/supabase.js` (clé publique).

---

## 2. Connecter le projet à Vercel (une seule fois)

Vercel est l'hébergeur qui met le site en ligne automatiquement à chaque `git push`. C'est gratuit.

1. Aller sur **https://vercel.com** → **Sign Up**.
2. Choisir **« Continue with GitHub »** et se connecter avec le compte GitHub qui possède
   le dépôt `firstincendie/plans-incendie`. Autoriser Vercel à accéder au dépôt.
3. Dans le tableau de bord Vercel : **Add New… → Project**.
4. Choisir le dépôt **plans-incendie** → **Import**.
5. Vercel reconnaît automatiquement « Create React App ». Ne rien changer :
   - Framework Preset : **Create React App**
   - Build Command : `npm run build`
   - Output Directory : `build`
6. Cliquer **Deploy**. Au bout d'~1 minute, le site est en ligne sur une adresse du type
   `plans-incendie-xxxx.vercel.app`.

À partir de là, **chaque push GitHub redéploie tout seul.**

---

## 3. Comprendre « test » vs « officiel »

Vercel déploie automatiquement à chaque push, différemment selon la branche :

- **Branche `main`** = **Production** → c'est ce qui sera visible sur **incendieplan.fr**.
- **Toute autre branche** (ex. `test`) = **Preview** → une URL de test unique
  (`plans-incendie-git-test-...vercel.app`) qui **ne touche pas** au site officiel.

Ainsi tu peux tout essayer en ligne sans risque avant de publier.

---

## 4. Brancher le domaine incendieplan.fr (une seule fois)

1. Dans Vercel : ouvrir le projet → **Settings → Domains**.
2. Taper `incendieplan.fr` → **Add**. Ajouter aussi `www.incendieplan.fr`.
3. Vercel affiche les **enregistrements DNS** à créer. En général :
   - Domaine principal `incendieplan.fr` → enregistrement **A** vers `76.76.21.21`
   - `www` → enregistrement **CNAME** vers `cname.vercel-dns.com`
   > ⚠️ Utiliser **exactement** les valeurs affichées par Vercel (elles peuvent différer).
4. Se connecter chez le **registrar** où incendieplan.fr a été acheté (OVH, Gandi, IONOS…),
   ouvrir la **zone DNS** et créer ces enregistrements.
5. Attendre la propagation (quelques minutes à quelques heures). Vercel affiche
   **« Valid Configuration »** quand c'est bon. Le **HTTPS (cadenas) est automatique**.

---

## 5. Le travail au quotidien

```bash
# 1. Récupérer la dernière version officielle
git checkout main
git pull

# 2. Créer une branche de travail (ou réutiliser "test")
git checkout -b test

# 3. Modifier le code, tester en local
npm start

# 4. Envoyer sur la branche de test → URL de preview Vercel
git add -A
git commit -m "Description de la modification"
git push -u origin test
#    → Vercel donne une URL de test dans le tableau de bord (ou via GitHub)

# 5. Quand c'est validé, publier sur incendieplan.fr :
git checkout main
git merge test
git push
#    → incendieplan.fr est mis à jour automatiquement
```

---

## Récapitulatif

- **Local** : `npm start` pour développer.
- **Tester en ligne** : push sur `test` → URL de preview Vercel.
- **Publier** : push (ou merge) sur `main` → **incendieplan.fr**.
- Vercel s'occupe du build, de la mise en ligne et du HTTPS automatiquement.
