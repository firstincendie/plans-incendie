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
  const { nom_plan, ref, dessinateur_id, utilisateur_id } = await req.json();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (dessinateur_id) {
    const { data: dessinateur } = await supabase
      .from("profiles")
      .select("email, prenom, notif_nouvelle_commande")
      .eq("id", dessinateur_id)
      .single();

    if (dessinateur && dessinateur.notif_nouvelle_commande !== false) {
      await fetch(SEND_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") ?? "" },
        body: JSON.stringify({
          to: dessinateur.email,
          subject: `Incendie Plan - Nouvelle commande`,
          html: `
            <h2>Bonjour ${dessinateur.prenom},</h2>
            <p>Une nouvelle commande vient d'être créée et vous est assignée.</p>
            <p><strong>Plan :</strong> ${nom_plan}</p>
            <p><strong>Référence :</strong> ${ref}</p>
            <p><a href="https://incendieplan.fr">Voir la commande</a></p>
          `,
        }),
      });
    }
  }

  // Notifier l'utilisateur créateur (confirmation commande créée)
  if (utilisateur_id) {
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
          subject: `Incendie Plan - Commande créée`,
          html: `
            <h2>Bonjour ${utilisateur.prenom},</h2>
            <p>Votre commande <strong>${nom_plan}</strong> (${ref}) a bien été créée et est en attente de traitement.</p>
            <p><a href="https://incendieplan.fr">Voir la commande</a></p>
          `,
        }),
      });
    }
  }

  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
});
