# Grand Reset — Plan 3 : Système d'emails (Edge Functions)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter les emails métier via Supabase Edge Functions — emails obligatoires (inscription, activation, refus, blocage) et emails optionnels selon préférences utilisateur (nouvelle commande, messages, ébauche).

**Architecture:** Une Edge Function `send-email` centrale gère l'envoi SMTP. Les autres fonctions l'appellent avec le template voulu. Les fonctions sont appelées depuis le frontend React après chaque action déclenchante. Deux fonctions admin (`invite-user`, `delete-user`) utilisent le Supabase Admin SDK.

**Tech Stack:** Supabase Edge Functions (Deno), SMTP via nodemailer ou fetch, Supabase Admin SDK

**Prérequis :** Plans 1 et 2 terminés. SMTP configuré dans Supabase Dashboard.

**Spec de référence:** `docs/superpowers/specs/2026-03-23-grand-reset-roles-commandes-design.md`

---

## Fichiers concernés

| Fichier | Action |
|---|---|
| `supabase/functions/send-email/index.ts` | Création — helper SMTP central |
| `supabase/functions/notify-inscription/index.ts` | Création — email à owner à l'inscription |
| `supabase/functions/notify-activation/index.ts` | Création — email à l'utilisateur activé/refusé/bloqué |
| `supabase/functions/notify-commande/index.ts` | Création — email au dessinateur (nouvelle commande) |
| `supabase/functions/notify-message/index.ts` | Création — email lors d'un nouveau message |
| `supabase/functions/notify-version/index.ts` | Création — email lors d'un dépôt d'ébauche |
| `supabase/functions/invite-user/index.ts` | Création — créer un compte via Admin SDK |
| `supabase/functions/delete-user/index.ts` | Création — supprimer un compte via Admin SDK |
| `src/components/GestionUtilisateurs.js` | Modifier — appels aux fonctions invite/delete |
| `src/components/VueUtilisateur.js` | Modifier — appel notify-commande à la création |
| `src/components/VueDessinateur.js` | Modifier — appel notify-version au dépôt |
| `src/components/Messagerie.js` | Modifier — appel notify-message à l'envoi |

---

### Task 1 : Initialiser Supabase CLI et la structure des fonctions

- [ ] **Step 1 : Vérifier que Supabase CLI est installé**

```bash
supabase --version
```

Si non installé :
```bash
npm install -g supabase
```

- [ ] **Step 2 : Initialiser le projet Supabase localement (si pas déjà fait)**

```bash
cd C:\Users\simon\Desktop\plans-incendie
supabase init
```

- [ ] **Step 3 : Se connecter à Supabase**

```bash
supabase login
supabase link --project-ref <project-ref>
```

Le `project-ref` se trouve dans Supabase Dashboard → Settings → General → Reference ID.

- [ ] **Step 4 : Créer la structure des fonctions**

```bash
supabase functions new send-email
supabase functions new notify-inscription
supabase functions new notify-activation
supabase functions new notify-commande
supabase functions new notify-message
supabase functions new notify-version
supabase functions new invite-user
supabase functions new delete-user
```

- [ ] **Step 5 : Commit**

```bash
git add supabase/
git commit -m "chore: initialize supabase edge functions structure"
```

---

### Task 2 : Créer la fonction `send-email` (helper SMTP central)

**Objectif :** Fonction utilitaire appelée par toutes les autres. Envoie un email via SMTP avec nodemailer.

- [ ] **Step 1 : Écrire `supabase/functions/send-email/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "incendieplan.fr";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "noreply@incendieplan.fr";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { to, subject, html } = await req.json();
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ error: "Missing fields: to, subject, html" }), { status: 400 });
  }

  try {
    // Utiliser nodemailer via npm CDN compatible Deno
    const nodemailer = await import("npm:nodemailer@6");
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true, // SSL/TLS sur port 465
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"First Incendie" <${SMTP_USER}>`,
      to,
      subject,
      html,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
```

- [ ] **Step 2 : Configurer les secrets SMTP dans Supabase**

```bash
supabase secrets set SMTP_HOST=incendieplan.fr
supabase secrets set SMTP_PORT=465
supabase secrets set SMTP_USER=noreply@incendieplan.fr
supabase secrets set SMTP_PASS=<mot-de-passe-email>
```

- [ ] **Step 3 : Déployer la fonction**

```bash
supabase functions deploy send-email
```

- [ ] **Step 4 : Tester manuellement**

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/send-email \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"to":"contact@firstincendie.com","subject":"Test send-email","html":"<p>Test OK</p>"}'
```

Vérifier la réception dans la boîte mail.

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/send-email/
git commit -m "feat: add send-email edge function (SMTP helper)"
```

---

### Task 3 : Email d'inscription (notify-inscription)

**Objectif :** Notifier `contact@firstincendie.com` quand quelqu'un crée un compte.

- [ ] **Step 1 : Écrire `supabase/functions/notify-inscription/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;
const OWNER_EMAIL = "contact@firstincendie.com";

serve(async (req) => {
  const { prenom, nom, email } = await req.json();

  const res = await fetch(SEND_EMAIL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": req.headers.get("Authorization") ?? "",
    },
    body: JSON.stringify({
      to: OWNER_EMAIL,
      subject: `Nouvelle inscription — ${prenom} ${nom}`,
      html: `
        <h2>Nouvelle inscription sur First Incendie</h2>
        <p><strong>Nom :</strong> ${prenom} ${nom}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p>Connectez-vous à l'application pour activer ou refuser ce compte.</p>
      `,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
});
```

- [ ] **Step 2 : Déployer**

```bash
supabase functions deploy notify-inscription
```

- [ ] **Step 3 : Appeler depuis PageInscription.js après inscription réussie**

Dans `src/components/auth/PageInscription.js`, après la création du compte Supabase (`supabase.auth.signUp`), ajouter :

```javascript
// Notifier l'owner
await supabase.functions.invoke("notify-inscription", {
  body: { prenom: form.prenom, nom: form.nom, email: form.email },
});
```

- [ ] **Step 4 : Tester**

Créer un compte test. Vérifier que `contact@firstincendie.com` reçoit l'email de notification.

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/notify-inscription/ src/components/auth/PageInscription.js
git commit -m "feat: notify owner on new user inscription"
```

---

### Task 4 : Emails d'activation/refus/blocage (notify-activation)

**Objectif :** Notifier l'utilisateur quand son compte change de statut (actif, refusé, bloqué).

- [ ] **Step 1 : Écrire `supabase/functions/notify-activation/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;

const templates: Record<string, { subject: string; html: (prenom: string) => string }> = {
  actif: {
    subject: "Votre compte First Incendie est activé",
    html: (prenom) => `
      <h2>Bienvenue, ${prenom} !</h2>
      <p>Votre compte a été activé. Vous pouvez maintenant vous connecter à l'application.</p>
      <p><a href="https://incendieplan.fr">Accéder à l'application</a></p>
    `,
  },
  refuse: {
    subject: "Votre demande d'accès First Incendie",
    html: (prenom) => `
      <h2>Bonjour ${prenom},</h2>
      <p>Votre demande d'accès n'a pas pu être acceptée.</p>
      <p>Contactez-nous à <a href="mailto:contact@firstincendie.com">contact@firstincendie.com</a> pour plus d'informations.</p>
    `,
  },
  bloque: {
    subject: "Votre compte First Incendie a été suspendu",
    html: (prenom) => `
      <h2>Bonjour ${prenom},</h2>
      <p>Votre compte a été temporairement suspendu.</p>
      <p>Contactez-nous à <a href="mailto:contact@firstincendie.com">contact@firstincendie.com</a> pour plus d'informations.</p>
    `,
  },
};

serve(async (req) => {
  const { to, prenom, statut } = await req.json();
  const template = templates[statut];
  if (!template) return new Response(JSON.stringify({ error: "Unknown statut" }), { status: 400 });

  const res = await fetch(SEND_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") ?? "" },
    body: JSON.stringify({ to, subject: template.subject, html: template.html(prenom) }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
});
```

- [ ] **Step 2 : Déployer**

```bash
supabase functions deploy notify-activation
```

- [ ] **Step 3 : Appeler depuis GestionUtilisateurs.js**

Dans la fonction `mettreAJourStatut` de `GestionUtilisateurs.js`, après la mise à jour Supabase, ajouter :

```javascript
// Notifier l'utilisateur du changement de statut
if (["actif", "refuse", "bloque"].includes(statut)) {
  const compte = comptes.find(c => c.id === id);
  if (compte) {
    await supabase.functions.invoke("notify-activation", {
      body: { to: compte.email, prenom: compte.prenom, statut },
    });
  }
}
```

- [ ] **Step 4 : Tester**

Activer un compte test. Vérifier que l'utilisateur reçoit l'email d'activation.

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/notify-activation/ src/components/GestionUtilisateurs.js
git commit -m "feat: email notification on account activation/refusal/block"
```

---

### Task 5 : Email nouvelle commande au dessinateur (notify-commande)

**Objectif :** Notifier le dessinateur assigné quand une nouvelle commande est créée (si `notif_nouvelle_commande = true`).

- [ ] **Step 1 : Écrire `supabase/functions/notify-commande/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;

serve(async (req) => {
  const { utilisateur_id, nom_plan, ref } = await req.json();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Trouver le dessinateur assigné à cet utilisateur
  const { data: utilisateur } = await supabase
    .from("profiles")
    .select("dessinateur_id")
    .eq("id", utilisateur_id)
    .single();

  if (!utilisateur?.dessinateur_id) return new Response(JSON.stringify({ skipped: "no dessinateur assigned" }));

  const { data: dessinateur } = await supabase
    .from("profiles")
    .select("email, prenom, notif_nouvelle_commande")
    .eq("id", utilisateur.dessinateur_id)
    .single();

  if (!dessinateur || dessinateur.notif_nouvelle_commande === false) {
    return new Response(JSON.stringify({ skipped: "notifications disabled" }));
  }

  const res = await fetch(SEND_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") ?? "" },
    body: JSON.stringify({
      to: dessinateur.email,
      subject: `Nouvelle commande — ${nom_plan}`,
      html: `
        <h2>Bonjour ${dessinateur.prenom},</h2>
        <p>Une nouvelle commande vient d'être créée et vous est assignée.</p>
        <p><strong>Plan :</strong> ${nom_plan}</p>
        <p><strong>Référence :</strong> ${ref}</p>
        <p><a href="https://incendieplan.fr">Voir la commande</a></p>
      `,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
});
```

- [ ] **Step 2 : Déployer**

```bash
supabase functions deploy notify-commande
```

- [ ] **Step 3 : Appeler depuis VueUtilisateur.js**

Dans la fonction `creerCommande`, après insertion réussie, ajouter :

```javascript
// Notifier le dessinateur
await supabase.functions.invoke("notify-commande", {
  body: { utilisateur_id: form.utilisateur_id, nom_plan: form.nom_plan, ref },
});
```

- [ ] **Step 4 : Tester**

Créer une commande avec un utilisateur dont le dessinateur a `notif_nouvelle_commande = true`. Vérifier que le dessinateur reçoit l'email.

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/notify-commande/ src/components/VueUtilisateur.js
git commit -m "feat: notify dessinateur on new commande (respects preferences)"
```

---

### Task 6 : Email nouveau message (notify-message)

**Objectif :** Notifier l'autre partie quand un message est envoyé dans une commande.

- [ ] **Step 1 : Écrire `supabase/functions/notify-message/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;

serve(async (req) => {
  const { commande_id, auteur_id, auteur_nom, nom_plan } = await req.json();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Récupérer la commande pour trouver utilisateur et dessinateur
  const { data: commande } = await supabase
    .from("commandes")
    .select("utilisateur_id")
    .eq("id", commande_id)
    .single();

  if (!commande) return new Response(JSON.stringify({ error: "commande not found" }), { status: 404 });

  const { data: utilisateur } = await supabase
    .from("profiles")
    .select("email, prenom, dessinateur_id, notif_nouveau_message")
    .eq("id", commande.utilisateur_id)
    .single();

  const destinataires: string[] = [];

  // Si l'auteur est le dessinateur → notifier l'utilisateur
  if (utilisateur?.dessinateur_id === auteur_id) {
    if (utilisateur.notif_nouveau_message !== false) {
      destinataires.push(utilisateur.email);
    }
  } else {
    // Si l'auteur est l'utilisateur → notifier le dessinateur
    if (utilisateur?.dessinateur_id) {
      const { data: dessinateur } = await supabase
        .from("profiles")
        .select("email, prenom, notif_nouveau_message")
        .eq("id", utilisateur.dessinateur_id)
        .single();
      if (dessinateur && dessinateur.notif_nouveau_message !== false) {
        destinataires.push(dessinateur.email);
      }
    }
  }

  for (const to of destinataires) {
    await fetch(SEND_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") ?? "" },
      body: JSON.stringify({
        to,
        subject: `Nouveau message — ${nom_plan}`,
        html: `
          <h2>Nouveau message de ${auteur_nom}</h2>
          <p><strong>Commande :</strong> ${nom_plan}</p>
          <p><a href="https://incendieplan.fr">Voir le message</a></p>
        `,
      }),
    });
  }

  return new Response(JSON.stringify({ sent: destinataires.length }), { headers: { "Content-Type": "application/json" } });
});
```

- [ ] **Step 2 : Déployer**

```bash
supabase functions deploy notify-message
```

- [ ] **Step 3 : Identifier comment appeler depuis la messagerie**

Dans `src/components/Messagerie.js`, la fonction d'envoi de message est appelée depuis les parents (`VueUtilisateur` et `VueDessinateur`). Ajouter l'appel à `notify-message` dans les fonctions `envoyerMessage` des deux composants :

```javascript
// Dans envoyerMessage, après l'insert réussi :
await supabase.functions.invoke("notify-message", {
  body: {
    commande_id: commandeId,
    auteur_id: session.user.id,
    auteur_nom: auteurNom,
    nom_plan: commandes.find(c => c.id === commandeId)?.nom_plan ?? "",
  },
});
```

- [ ] **Step 4 : Tester**

Envoyer un message depuis l'utilisateur. Vérifier que le dessinateur reçoit l'email (si `notif_nouveau_message = true`).

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/notify-message/ src/components/VueUtilisateur.js src/components/VueDessinateur.js
git commit -m "feat: email notification on new message (respects preferences)"
```

---

### Task 7 : Email dépôt ébauche (notify-version)

**Objectif :** Notifier l'utilisateur quand le dessinateur dépose une ébauche.

- [ ] **Step 1 : Écrire `supabase/functions/notify-version/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;

serve(async (req) => {
  const { commande_id, nom_plan, numero_version } = await req.json();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: commande } = await supabase
    .from("commandes")
    .select("utilisateur_id")
    .eq("id", commande_id)
    .single();

  if (!commande) return new Response(JSON.stringify({ error: "commande not found" }), { status: 404 });

  const { data: utilisateur } = await supabase
    .from("profiles")
    .select("email, prenom, notif_nouvelle_version")
    .eq("id", commande.utilisateur_id)
    .single();

  if (!utilisateur || utilisateur.notif_nouvelle_version === false) {
    return new Response(JSON.stringify({ skipped: "notifications disabled" }));
  }

  const res = await fetch(SEND_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") ?? "" },
    body: JSON.stringify({
      to: utilisateur.email,
      subject: `Ébauche déposée — ${nom_plan}`,
      html: `
        <h2>Bonjour ${utilisateur.prenom},</h2>
        <p>Le dessinateur a déposé la <strong>version ${numero_version}</strong> de votre plan.</p>
        <p><strong>Plan :</strong> ${nom_plan}</p>
        <p>Connectez-vous pour la consulter et valider ou demander des modifications.</p>
        <p><a href="https://incendieplan.fr">Voir l'ébauche</a></p>
      `,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
});
```

- [ ] **Step 2 : Déployer**

```bash
supabase functions deploy notify-version
```

- [ ] **Step 3 : Appeler depuis VueDessinateur.js**

Dans la fonction `deposerVersion`, après le changement de statut réussi, ajouter :

```javascript
await supabase.functions.invoke("notify-version", {
  body: { commande_id: selected.id, nom_plan: selected.nom_plan, numero_version: numero },
});
```

- [ ] **Step 4 : Tester**

Déposer une ébauche depuis le dessinateur. Vérifier que l'utilisateur reçoit l'email.

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/notify-version/ src/components/VueDessinateur.js
git commit -m "feat: email notification when dessinateur deposits a version"
```

---

### Task 8 : Fonctions admin (invite-user et delete-user)

**Objectif :** Permettre à GestionUtilisateurs de créer et supprimer des comptes Supabase Auth via l'Admin SDK (nécessite le service role key, donc edge function).

- [ ] **Step 1 : Écrire `supabase/functions/invite-user/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const { email, prenom, nom, role } = await req.json();
  if (!email || !prenom || !nom) {
    return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Inviter l'utilisateur (envoie un email magic link)
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { prenom, nom, role },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  // Créer le profil immédiatement
  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email,
      prenom,
      nom,
      role,
      statut: "actif", // Invité directement par owner = actif
    });
  }

  return new Response(JSON.stringify({ success: true, user_id: data.user?.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2 : Écrire `supabase/functions/delete-user/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const { user_id } = await req.json();
  if (!user_id) return new Response(JSON.stringify({ error: "Missing user_id" }), { status: 400 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Supprimer le profil d'abord (cascade si RLS le permet, sinon explicite)
  await supabase.from("profiles").delete().eq("id", user_id);

  // Supprimer le compte Auth
  const { error } = await supabase.auth.admin.deleteUser(user_id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 3 : Configurer le secret service role**

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Le service role key se trouve dans Supabase Dashboard → Settings → API → `service_role` key.

> ⚠️ Ne jamais exposer ce secret côté client. Il ne doit être utilisé que dans les Edge Functions.

- [ ] **Step 4 : Déployer**

```bash
supabase functions deploy invite-user
supabase functions deploy delete-user
```

- [ ] **Step 5 : Tester**

Dans GestionUtilisateurs, créer un nouveau compte test via le modal. Vérifier qu'un email d'invitation Supabase est reçu et que le profil apparaît dans la liste.

- [ ] **Step 6 : Commit**

```bash
git add supabase/functions/invite-user/ supabase/functions/delete-user/
git commit -m "feat: admin edge functions for user invite and deletion"
```

---

### Task 9 : Sécuriser les Edge Functions (vérification JWT owner)

**Objectif :** S'assurer que les fonctions sensibles (invite-user, delete-user) ne peuvent être appelées que par un utilisateur `is_owner`.

- [ ] **Step 1 : Ajouter la vérification dans invite-user et delete-user**

Au début de chaque fonction, ajouter :

```typescript
// Vérifier que l'appelant est is_owner
const authHeader = req.headers.get("Authorization");
if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

const token = authHeader.replace("Bearer ", "");
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

const { data: profil } = await supabase.from("profiles").select("is_owner").eq("id", user.id).single();
if (!profil?.is_owner) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
```

- [ ] **Step 2 : Redéployer**

```bash
supabase functions deploy invite-user
supabase functions deploy delete-user
```

- [ ] **Step 3 : Tester avec un compte non-owner**

Tenter d'appeler `invite-user` avec un token utilisateur normal. Vérifier que la réponse est 403 Forbidden.

- [ ] **Step 4 : Commit et push final**

```bash
git add -A
git commit -m "feat: secure admin edge functions with is_owner check"
git push origin main
```
