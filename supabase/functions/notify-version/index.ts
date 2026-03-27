import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { commande_id, nom_plan, numero_version } = await req.json();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: commande } = await supabase
    .from("commandes")
    .select("utilisateur_id")
    .eq("id", commande_id)
    .single();

  if (!commande) {
    return new Response(JSON.stringify({ error: "commande not found" }), { status: 404 });
  }

  const { data: utilisateur } = await supabase
    .from("profiles")
    .select("email, prenom, notif_nouvelle_version")
    .eq("id", commande.utilisateur_id)
    .single();

  if (!utilisateur || utilisateur.notif_nouvelle_version === false) {
    return new Response(JSON.stringify({ skipped: "notifications disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
