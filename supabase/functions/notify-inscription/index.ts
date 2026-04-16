import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;
const OWNER_EMAIL = "contact@firstincendie.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
        <h2>Nouvelle inscription sur Incendie Plan</h2>
        <p><strong>Nom :</strong> ${prenom} ${nom}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p>Connectez-vous à l'application pour activer ou refuser ce compte.</p>
      `,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
