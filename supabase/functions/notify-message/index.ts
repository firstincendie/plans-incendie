import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;

serve(async (req) => {
  const { commande_id, auteur_id, auteur_nom, nom_plan } = await req.json();
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
    .select("email, prenom, dessinateur_id, notif_nouveau_message")
    .eq("id", commande.utilisateur_id)
    .single();

  const destinataires: string[] = [];

  if (utilisateur?.dessinateur_id === auteur_id) {
    // Auteur = dessinateur → notifier l'utilisateur
    if (utilisateur.notif_nouveau_message !== false) {
      destinataires.push(utilisateur.email);
    }
  } else {
    // Auteur = utilisateur → notifier le dessinateur
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

  return new Response(JSON.stringify({ sent: destinataires.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
