// send-email — envoi effectif via Resend.
//
// SÉCURITÉ (constat 3 de AUDIT-SECURITE.md) : cette fonction acceptait
// n'importe quel appel, sans authentification, avec destinataire et contenu
// HTML libres. N'importe qui pouvait envoyer des emails signés
// noreply@incendieplan.fr — hameçonnage, mise en liste noire du domaine,
// facture Resend.
//
// Elle n'accepte désormais QUE la clé de service, que seules les autres
// fonctions serveur possèdent. Elle n'est plus joignable depuis un navigateur.
// verify_jwt reste désactivé volontairement : il laisserait passer n'importe
// quel utilisateur connecté, ce qui serait plus permissif que ce contrôle-ci.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
const FROM_EMAIL = "noreply@incendieplan.fr";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://incendieplan.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(corps: unknown, status: number) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Sans clé de service configurée, on refuse tout : ne jamais échouer ouvert.
  if (!SERVICE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY absente : envoi refuse par securite.");
    return json({ error: "Service indisponible" }, 500);
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token !== SERVICE_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  let to: string, subject: string, html: string;
  try {
    ({ to, subject, html } = await req.json());
  } catch {
    return json({ error: "Corps JSON invalide" }, 400);
  }
  if (!to || !subject || !html) {
    return json({ error: "Missing fields: to, subject, html" }, 400);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `First Incendie <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Resend error:", res.status, JSON.stringify(data));
    return json({ resend_status: res.status, error: data }, 500);
  }

  return json({ success: true, id: data.id }, 200);
});
