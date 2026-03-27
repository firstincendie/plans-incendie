# Emails et Notifications — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le système complet d'emails de notification pour les changements de statut de commande, avec réglages oui/non par utilisateur.

**Architecture:** Nouvelle Edge Function `notify-statut` qui gère tous les events de statut (commencé, modification, validation_en_cours, plans_finaux, terminé) en une seule fonction. Extension de `notify-commande` pour confirmer la création à l'utilisateur. Le frontend appelle ces fonctions en fire-and-forget depuis les fonctions d'action nommées.

**Tech Stack:** Deno/TypeScript (Edge Functions Supabase), React JS (frontend), Resend API (emails via `send-email` existante), Supabase MCP (migration DB).

**Spec:** `docs/superpowers/specs/2026-03-27-emails-notifications-design.md`

---

## Fichiers concernés

| Fichier | Action |
|---|---|
| `supabase/functions/notify-statut/index.ts` | Créer |
| `supabase/functions/notify-commande/index.ts` | Modifier |
| `src/components/VueUtilisateur.js` | Modifier |
| `src/components/VueDessinateur.js` | Modifier |
| `src/components/PageReglages.js` | Modifier |

---

## Task 1 : Migration DB — Nouvelles colonnes `profiles`

**Files:**
- Supabase MCP : `apply_migration`

- [ ] **Step 1 : Appliquer la migration via Supabase MCP**

Utiliser l'outil `mcp__claude_ai_Supabase__apply_migration` avec ce SQL :

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_commande_creee       boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_commande_acceptee    boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_commande_validee     boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_plans_finaux         boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_demande_modification  boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_validation_en_cours   boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_commande_terminee     boolean DEFAULT true;
```

- [ ] **Step 2 : Vérifier les colonnes**

Utiliser `mcp__claude_ai_Supabase__execute_sql` :

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name LIKE 'notif_%'
ORDER BY column_name;
```

Attendu : 10 lignes (3 existantes + 7 nouvelles), toutes `boolean`, default `true`.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "feat: migration DB nouvelles colonnes notif profiles"
```

---

## Task 2 : Edge Function `notify-statut`

**Files:**
- Créer : `supabase/functions/notify-statut/index.ts`

- [ ] **Step 1 : Créer le fichier**

```typescript
// supabase/functions/notify-statut/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://incendieplan.fr";

async function sendEmail(authHeader: string, to: string, subject: string, html: string) {
  return fetch(SEND_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": authHeader },
    body: JSON.stringify({ to, subject, html }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const { commande_id, event } = await req.json();

  if (!commande_id || !event) {
    return new Response(JSON.stringify({ error: "Missing commande_id or event" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: commande } = await supabase
    .from("commandes")
    .select("utilisateur_id, dessinateur_id, nom_plan, ref")
    .eq("id", commande_id)
    .single();

  if (!commande) {
    return new Response(JSON.stringify({ error: "commande not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { utilisateur_id, dessinateur_id, nom_plan, ref } = commande;

  // Fetch utilisateur profile
  const { data: utilisateur } = await supabase
    .from("profiles")
    .select("email, prenom, notif_commande_acceptee, notif_commande_validee, notif_plans_finaux")
    .eq("id", utilisateur_id)
    .single();

  // Fetch dessinateur profile (if exists)
  const { data: dessinateur } = dessinateur_id
    ? await supabase
        .from("profiles")
        .select("email, prenom, notif_demande_modification, notif_validation_en_cours, notif_commande_terminee")
        .eq("id", dessinateur_id)
        .single()
    : { data: null };

  const lienCommande = `<p><a href="${APP_URL}">Voir la commande — ${nom_plan} (${ref})</a></p>`;
  const results: string[] = [];

  if (event === "commencé") {
    // → Notifier l'utilisateur : commande acceptée par le dessinateur
    if (utilisateur && utilisateur.notif_commande_acceptee !== false) {
      await sendEmail(authHeader, utilisateur.email,
        `Commande acceptée — ${nom_plan}`,
        `<h2>Bonjour ${utilisateur.prenom},</h2>
         <p>Le dessinateur a accepté votre commande <strong>${nom_plan}</strong> (${ref}) et a commencé à travailler dessus.</p>
         ${lienCommande}`
      );
      results.push("utilisateur notifié: commande acceptée");
    }

  } else if (event === "modification") {
    // → Notifier le dessinateur : demande de modification
    if (dessinateur && dessinateur.notif_demande_modification !== false) {
      await sendEmail(authHeader, dessinateur.email,
        `Demande de modification — ${nom_plan}`,
        `<h2>Bonjour ${dessinateur.prenom},</h2>
         <p>L'utilisateur a demandé des modifications sur la commande <strong>${nom_plan}</strong> (${ref}).</p>
         <p>Consultez le message dans la messagerie de la commande.</p>
         ${lienCommande}`
      );
      results.push("dessinateur notifié: demande modification");
    }

  } else if (event === "validation_en_cours") {
    // → Notifier l'utilisateur : ébauche validée (confirmation)
    if (utilisateur && utilisateur.notif_commande_validee !== false) {
      await sendEmail(authHeader, utilisateur.email,
        `Ébauche validée — ${nom_plan}`,
        `<h2>Bonjour ${utilisateur.prenom},</h2>
         <p>Vous avez validé l'ébauche de la commande <strong>${nom_plan}</strong> (${ref}).</p>
         <p>Le dessinateur va maintenant déposer les plans finaux.</p>
         ${lienCommande}`
      );
      results.push("utilisateur notifié: ébauche validée");
    }
    // → Notifier le dessinateur : en attente de dépôt final (skip silencieux si pas de dessinateur)
    if (dessinateur && dessinateur.notif_validation_en_cours !== false) {
      await sendEmail(authHeader, dessinateur.email,
        `En attente de votre dépôt final — ${nom_plan}`,
        `<h2>Bonjour ${dessinateur.prenom},</h2>
         <p>L'utilisateur a validé l'ébauche de la commande <strong>${nom_plan}</strong> (${ref}).</p>
         <p>Vous pouvez maintenant déposer les plans finaux.</p>
         ${lienCommande}`
      );
      results.push("dessinateur notifié: validation en cours");
    }

  } else if (event === "plans_finaux") {
    // → Notifier l'utilisateur : plans finaux déposés
    if (utilisateur && utilisateur.notif_plans_finaux !== false) {
      await sendEmail(authHeader, utilisateur.email,
        `Plans finaux déposés — ${nom_plan}`,
        `<h2>Bonjour ${utilisateur.prenom},</h2>
         <p>Le dessinateur a déposé tous les plans finaux pour la commande <strong>${nom_plan}</strong> (${ref}).</p>
         <p>Connectez-vous pour les consulter et valider la commande.</p>
         ${lienCommande}`
      );
      results.push("utilisateur notifié: plans finaux");
    }

  } else if (event === "termine") {
    // → Notifier le dessinateur : commande terminée
    if (dessinateur && dessinateur.notif_commande_terminee !== false) {
      await sendEmail(authHeader, dessinateur.email,
        `Commande terminée — ${nom_plan}`,
        `<h2>Bonjour ${dessinateur.prenom},</h2>
         <p>L'utilisateur a validé les plans finaux de la commande <strong>${nom_plan}</strong> (${ref}).</p>
         <p>La mission est terminée.</p>
         ${lienCommande}`
      );
      results.push("dessinateur notifié: commande terminée");
    }

  } else {
    return new Response(JSON.stringify({ error: `Unknown event: ${event}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2 : Déployer la fonction**

```bash
npx supabase functions deploy notify-statut --project-ref custkyapdbvzkuxgurla
```

- [ ] **Step 3 : Commit**

```bash
git add supabase/functions/notify-statut/index.ts
git commit -m "feat: Edge Function notify-statut pour les changements de statut commande"
```

---

## Task 3 : Modifier `notify-commande` — Confirmation à l'utilisateur

**Files:**
- Modifier : `supabase/functions/notify-commande/index.ts`

- [ ] **Step 1 : Lire le fichier actuel**

Lire `supabase/functions/notify-commande/index.ts` pour avoir le contexte exact avant de modifier.

- [ ] **Step 2 : Ajouter le payload `utilisateur_id` et la notification utilisateur**

Modifier la fonction pour :
1. Déstructurer `utilisateur_id` depuis le payload (il est déjà envoyé par le frontend)
2. Après l'envoi au dessinateur, récupérer le profil utilisateur et lui envoyer un email de confirmation si `notif_commande_creee !== false`

Le payload actuel reçu est `{ nom_plan, ref, dessinateur_id, utilisateur_id }` — `utilisateur_id` est déjà là, il suffit de le déstructurer.

Ajouter après la section envoi au dessinateur (avant la dernière ligne `return`) :

```typescript
  // Notifier l'utilisateur créateur (confirmation commande créée)
  const { data: utilisateur } = await supabase
    .from("profiles")
    .select("email, prenom, notif_commande_creee")
    .eq("id", utilisateur_id)
    .single();

  if (utilisateur && utilisateur.notif_commande_creee !== false) {
    await fetch(SEND_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") ?? "" },
      body: JSON.stringify({
        to: utilisateur.email,
        subject: `Commande créée — ${nom_plan}`,
        html: `
          <h2>Bonjour ${utilisateur.prenom},</h2>
          <p>Votre commande <strong>${nom_plan}</strong> (${ref}) a bien été créée et est en attente de traitement.</p>
          <p><a href="https://incendieplan.fr">Voir la commande</a></p>
        `,
      }),
    });
  }
```

Important : La ligne `const { nom_plan, ref, dessinateur_id } = await req.json();` doit devenir `const { nom_plan, ref, dessinateur_id, utilisateur_id } = await req.json();`.

- [ ] **Step 3 : Restructurer les deux early-returns existants**

La fonction actuelle a **deux** early-returns à corriger :

**Early-return 1 (lignes ~20-24) :** `if (!dessinateur_id) { return new Response(...) }`
→ Convertir en condition non-retournante : `if (dessinateur_id) { /* notifier dessinateur */ }`

**Early-return 2 (lignes ~32-36) :** `if (!dessinateur || dessinateur.notif_nouvelle_commande === false) { return new Response(...) }`
→ Convertir également en condition non-retournante, à l'intérieur du bloc `if (dessinateur_id)`. Sans ce changement, si le dessinateur a désactivé ses notifications, la confirmation à l'utilisateur ne s'enverrait jamais.

Structure finale de la fonction :
1. Déstructurer `{ nom_plan, ref, dessinateur_id, utilisateur_id }`
2. Si `dessinateur_id` → récupérer profil dessinateur → si notif activée → envoyer email dessinateur
3. Si `utilisateur_id` → récupérer profil utilisateur → si notif activée → envoyer email utilisateur
4. Retourner `{ success: true }` (toujours, même si aucun email envoyé)

- [ ] **Step 4 : Déployer**

```bash
npx supabase functions deploy notify-commande --project-ref custkyapdbvzkuxgurla
```

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/notify-commande/index.ts
git commit -m "feat: notify-commande envoie aussi confirmation à l'utilisateur créateur"
```

---

## Task 4 : Déclencheurs dans `VueUtilisateur.js`

**Files:**
- Modifier : `src/components/VueUtilisateur.js`

Ajouter 3 appels `notify-statut` dans les fonctions d'action nommées existantes.

- [ ] **Step 1 : Lire les fonctions cibles**

Lire `src/components/VueUtilisateur.js` lignes 213–237 pour voir `envoyerDemandeModification`, `demanderValidation`, `validerCommande`.

- [ ] **Step 2 : Ajouter dans `envoyerDemandeModification`**

Dans la fonction `envoyerDemandeModification` (ligne ~213), après `await changerStatut(...)`, ajouter :

```js
supabase.functions.invoke("notify-statut", {
  body: { commande_id: selected.id, event: "modification" },
});
```

La fonction complète devient :
```js
async function envoyerDemandeModification() {
  if (!modifMsg.trim() || !selected) return;
  setEnvoyantModif(true);
  await envoyerMessage(selected.id, auteurNom, modifMsg, modifFichiers);
  await changerStatut(selected.id, "Modification dessinateur");
  supabase.functions.invoke("notify-statut", {
    body: { commande_id: selected.id, event: "modification" },
  });
  setModifMsg(""); setModifFichiers([]); setShowModifModal(false); setEnvoyantModif(false);
}
```

- [ ] **Step 3 : Ajouter dans `demanderValidation`**

Dans `demanderValidation` (ligne ~221), après `await changerStatut(...)` :

```js
supabase.functions.invoke("notify-statut", {
  body: { commande_id: selected.id, event: "validation_en_cours" },
});
```

La fonction complète devient :
```js
async function demanderValidation() {
  if (!selected || demandantValidation) return;
  setDemandantValidation(true);
  setShowDemandeValidationModal(false);
  await changerStatut(selected.id, "Validation en cours");
  await envoyerMessage(selected.id, auteurNom, "📋 Validation demandée.");
  supabase.functions.invoke("notify-statut", {
    body: { commande_id: selected.id, event: "validation_en_cours" },
  });
  setDemandantValidation(false);
}
```

- [ ] **Step 4 : Ajouter dans `validerCommande`**

Dans `validerCommande` (ligne ~230), après `await changerStatut(...)` :

```js
supabase.functions.invoke("notify-statut", {
  body: { commande_id: selected.id, event: "termine" },
});
```

La fonction complète devient :
```js
async function validerCommande() {
  if (!selected || validant) return;
  setValidant(true);
  setShowValiderCommandeModal(false);
  await changerStatut(selected.id, "Validé");
  await envoyerMessage(selected.id, auteurNom, "✅ Commande validée.");
  supabase.functions.invoke("notify-statut", {
    body: { commande_id: selected.id, event: "termine" },
  });
  setValidant(false);
}
```

- [ ] **Step 5 : Commit**

```bash
git add src/components/VueUtilisateur.js
git commit -m "feat: appels notify-statut dans VueUtilisateur (modification, validation, terminé)"
```

---

## Task 5 : Déclencheurs dans `VueDessinateur.js`

**Files:**
- Modifier : `src/components/VueDessinateur.js`

- [ ] **Step 1 : Lire les fonctions cibles**

Lire `src/components/VueDessinateur.js` lignes 99–147 pour voir `commencer` et `deposerPlanFinal`.

- [ ] **Step 2 : Ajouter dans `commencer(id)`**

Dans la fonction `commencer(id)` (ligne ~99), après le bloc `if (!error)` (après l'envoi de message) :

```js
supabase.functions.invoke("notify-statut", {
  body: { commande_id: id, event: "commencé" },
});
```

La fonction complète devient :
```js
async function commencer(id) {
  const { error } = await supabase.from("commandes").update({ statut: "Commencé" }).eq("id", id);
  if (!error) {
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: "Commencé" } : c));
    if (selected?.id === id) setSelected(prev => ({ ...prev, statut: "Commencé" }));
    await envoyerMessage(id, auteurNom, "🚀 Mission commencée.");
    supabase.functions.invoke("notify-statut", {
      body: { commande_id: id, event: "commencé" },
    });
  }
}
```

Note : utiliser `id` (le paramètre), pas `selected.id`.

- [ ] **Step 3 : Ajouter dans `deposerPlanFinal` — bloc tous-déposés**

Dans `deposerPlanFinal` (ligne ~116), dans le bloc `if (nouveaux.length === selected.plans.length)` (ligne ~144), après `await envoyerMessage(...)` :

```js
if (nouveaux.length === selected.plans.length) {
  await envoyerMessage(selected.id, auteurNom, "📐 Plans finaux déposés — en attente de validation.");
  supabase.functions.invoke("notify-statut", {
    body: { commande_id: selected.id, event: "plans_finaux" },
  });
}
```

> **Note :** Ne pas ajouter de `changerStatut` ici. Le statut reste `"Validation en cours"` — c'est normal per le flux : c'est l'utilisateur qui passe la commande à `"Validé"` dans `VueUtilisateur`. L'event `plans_finaux` déclenche uniquement l'email.

- [ ] **Step 4 : Commit**

```bash
git add src/components/VueDessinateur.js
git commit -m "feat: appels notify-statut dans VueDessinateur (commencé, plans finaux)"
```

---

## Task 6 : Mise à jour `PageReglages.js`

**Files:**
- Modifier : `src/components/PageReglages.js`

- [ ] **Step 1 : Lire le fichier actuel**

Lire `src/components/PageReglages.js` pour voir la structure exacte des toggles actuels.

- [ ] **Step 2 : Remplacer la liste de toggles**

Remplacer la liste `[...]` de toggles par la liste complète par rôle.

> **Note :** Dans le code actuel, `notif_nouveau_message` est dans la liste globale visible par tous les rôles. Le remplacement le déplace dans les tableaux role-specific — c'est intentionnel : les admins n'ont pas de section notifications (voir spec). Ce n'est pas une régression.

```js
[
  // --- DESSINATEUR ---
  ...(profil.role === "dessinateur" ? [
    { key: "notif_nouvelle_commande", label: "Nouvelle commande assignée", desc: "Recevoir un email quand une commande vous est assignée" },
    { key: "notif_demande_modification", label: "Demande de modification", desc: "Recevoir un email quand l'utilisateur demande une modification" },
    { key: "notif_validation_en_cours", label: "Ébauche validée — dépôt final attendu", desc: "Recevoir un email quand l'utilisateur valide une ébauche et attend les plans finaux" },
    { key: "notif_commande_terminee", label: "Commande terminée", desc: "Recevoir un email quand l'utilisateur valide les plans finaux" },
    { key: "notif_nouveau_message", label: "Nouveau message", desc: "Recevoir un email quand un message est posté dans une commande" },
  ] : []),
  // --- UTILISATEUR ---
  ...(profil.role === "utilisateur" ? [
    { key: "notif_commande_creee", label: "Commande créée (confirmation)", desc: "Recevoir un email de confirmation à chaque création de commande" },
    { key: "notif_commande_acceptee", label: "Commande acceptée par le dessinateur", desc: "Recevoir un email quand le dessinateur commence votre commande" },
    { key: "notif_nouvelle_version", label: "Ébauche déposée", desc: "Recevoir un email quand le dessinateur dépose une nouvelle ébauche" },
    { key: "notif_commande_validee", label: "Commande validée", desc: "Recevoir un email de confirmation quand vous validez une ébauche" },
    { key: "notif_plans_finaux", label: "Plans finaux déposés", desc: "Recevoir un email quand tous les plans finaux sont disponibles" },
    { key: "notif_nouveau_message", label: "Nouveau message", desc: "Recevoir un email quand un message est posté dans une commande" },
  ] : []),
]
```

- [ ] **Step 3 : Vérifier que le rendu conditionnel admin est correct**

La section Notifications ne doit pas s'afficher pour le rôle `admin`. Vérifier que la condition actuelle `{profil && (` soit renforcée : si la liste générée est vide (cas admin), ne rien afficher. Ajouter un filtre :

```js
// Calculer la liste avant le rendu
const notifItems = [...];
// Ne rendre la section que si la liste n'est pas vide
{profil && notifItems.length > 0 && (
  <div ...>
    ...
  </div>
)}
```

- [ ] **Step 4 : Vérifier visuellement dans le navigateur**

- Se connecter en tant que dessinateur → Réglages → doit afficher 5 toggles
- Se connecter en tant qu'utilisateur → Réglages → doit afficher 6 toggles
- Se connecter en tant qu'admin → Réglages → la section Notifications ne doit pas apparaître

- [ ] **Step 5 : Commit**

```bash
git add src/components/PageReglages.js
git commit -m "feat: PageReglages notifications complètes par rôle (dessinateur 5, utilisateur 6)"
```

---

## Task 7 : Push et déploiement

- [ ] **Step 1 : Push sur main (Netlify déploie automatiquement)**

```bash
git push origin main
```

- [ ] **Step 2 : Vérifier le déploiement Netlify**

Attendre ~2 minutes puis ouvrir https://incendieplan.fr pour vérifier que l'app se charge sans erreur.

---

## Task 8 : Fix lien "Confirm your signup" — Manuel

> ⚠️ Cette étape est manuelle dans le Supabase Dashboard, pas de code.

- [ ] **Step 1 : Aller dans Supabase Dashboard**

URL : https://supabase.com/dashboard/project/custkyapdbvzkuxgurla/auth/url-configuration

- [ ] **Step 2 : Ajouter les Redirect URLs**

Dans "Redirect URLs", ajouter :
- `https://incendieplan.fr`
- `https://incendieplan.fr/**`

- [ ] **Step 3 : Vérifier le Site URL**

S'assurer que "Site URL" est bien `https://incendieplan.fr`.

- [ ] **Step 4 : Tester**

Créer un compte test → l'email de confirmation doit contenir un lien vers `incendieplan.fr` (et non `custkyapdbvzkuxgurla.supabase.co`).

---

## Récapitulatif des emails implémentés

| Email | Destinataire | Préférence |
|---|---|---|
| Commande créée (confirmation) | Utilisateur | `notif_commande_creee` |
| Commande acceptée par le dessinateur | Utilisateur | `notif_commande_acceptee` |
| Ébauche validée (confirmation) | Utilisateur | `notif_commande_validee` |
| Plans finaux déposés | Utilisateur | `notif_plans_finaux` |
| Demande de modification | Dessinateur | `notif_demande_modification` |
| Ébauche validée — dépôt final attendu | Dessinateur | `notif_validation_en_cours` |
| Commande terminée | Dessinateur | `notif_commande_terminee` |
