import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const templates: Record<string, { subject: string; html: (prenom: string) => string }> = {
  actif: {
    subject: "Votre compte Incendie Plan est activé",
    html: (prenom) => `
      <h2>Bienvenue, ${prenom} !</h2>
      <p>Votre compte a été activé. Vous pouvez maintenant vous connecter à l'application.</p>
      <p><a href="https://incendieplan.fr">Accéder à l'application</a></p>
    `,
  },
  refuse: {
    subject: "Votre demande d'accès Incendie Plan",
    html: (prenom) => `
      <h2>Bonjour ${prenom},</h2>
      <p>Votre demande d'accès n'a pas pu être acceptée.</p>
      <p>Contactez-nous à <a href="mailto:contact@firstincendie.com">contact@firstincendie.com</a> pour plus d'informations.</p>
    `,
  },
  banni: {
    subject: "Votre compte Incendie Plan a été suspendu",
    html: (prenom) => `
      <h2>Bonjour ${prenom},</h2>
      <p>Votre compte a été temporairement suspendu.</p>
      <p>Contactez-nous à <a href="mailto:contact@firstincendie.com">contact@firstincendie.com</a> pour plus d'informations.</p>
    `,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { to, prenom, statut } = await req.json();
  const template = templates[statut];
  if (!template) return new Response(JSON.stringify({ error: "Unknown statut" }), { status: 400, headers: corsHeaders });

  const res = await fetch(SEND_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") ?? "" },
    body: JSON.stringify({ to, subject: template.subject, html: template.html(prenom) }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
