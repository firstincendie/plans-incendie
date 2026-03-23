import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;

serve(async (req) => {
  const { utilisateur_id, nom_plan, ref } = await req.json();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: utilisateur } = await supabase
    .from("profiles")
    .select("dessinateur_id")
    .eq("id", utilisateur_id)
    .single();

  if (!utilisateur?.dessinateur_id) {
    return new Response(JSON.stringify({ skipped: "no dessinateur assigned" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: dessinateur } = await supabase
    .from("profiles")
    .select("email, prenom, notif_nouvelle_commande")
    .eq("id", utilisateur.dessinateur_id)
    .single();

  if (!dessinateur || dessinateur.notif_nouvelle_commande === false) {
    return new Response(JSON.stringify({ skipped: "notifications disabled" }), {
      headers: { "Content-Type": "application/json" },
    });
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
