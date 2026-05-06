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
  const res = await fetch(SEND_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": authHeader },
    body: JSON.stringify({ to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`send-email failed for ${to}:`, err);
  }
  return res;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  let commande_id: string, event: string;
  try {
    const body = await req.json();
    commande_id = body.commande_id;
    event = body.event;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!commande_id || !event) {
    return new Response(JSON.stringify({ error: "Missing commande_id or event" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: commande, error: commandeError } = await supabase
    .from("commandes")
    .select("utilisateur_id, dessinateur_id, nom_plan, ref")
    .eq("id", commande_id)
    .single();
  if (commandeError) console.error("Failed to fetch commande:", commandeError.message);

  if (!commande) {
    return new Response(JSON.stringify({ error: "commande not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { utilisateur_id, dessinateur_id, nom_plan, ref } = commande;

  // Fetch utilisateur profile
  const { data: utilisateur, error: utilisateurError } = await supabase
    .from("profiles")
    .select("email, prenom, notif_commande_acceptee, notif_commande_validee, notif_plans_finaux")
    .eq("id", utilisateur_id)
    .single();
  if (utilisateurError) console.error("Failed to fetch utilisateur profile:", utilisateurError.message);

  // Fetch dessinateur profile (if exists)
  const { data: dessinateur, error: dessinateurError } = dessinateur_id
    ? await supabase
        .from("profiles")
        .select("email, prenom, notif_demande_modification, notif_validation_en_cours, notif_commande_terminee")
        .eq("id", dessinateur_id)
        .single()
    : { data: null, error: null };
  if (dessinateurError) console.error("Failed to fetch dessinateur profile:", dessinateurError.message);

  const lienCommande = `<p><a href="${APP_URL}">Voir la commande — ${nom_plan} (${ref})</a></p>`;
  const results: string[] = [];

  if (event === "commencé") {
    if (utilisateur && utilisateur.notif_commande_acceptee !== false) {
      await sendEmail(authHeader, utilisateur.email,
        `Incendie Plan - Commande acceptée`,
        `<h2>Bonjour ${utilisateur.prenom},</h2>
         <p>Le dessinateur a accepté votre commande <strong>${nom_plan}</strong> (${ref}) et a commencé à travailler dessus.</p>
         ${lienCommande}`
      );
      results.push("utilisateur notifié: commande acceptée");
    }

  } else if (event === "modification") {
    if (dessinateur && dessinateur.notif_demande_modification !== false) {
      await sendEmail(authHeader, dessinateur.email,
        `Incendie Plan - Demande de modification`,
        `<h2>Bonjour ${dessinateur.prenom},</h2>
         <p>L'utilisateur a demandé des modifications sur la commande <strong>${nom_plan}</strong> (${ref}).</p>
         <p>Consultez le message dans la messagerie de la commande.</p>
         ${lienCommande}`
      );
      results.push("dessinateur notifié: demande modification");
    }

  } else if (event === "validation_en_cours") {
    if (utilisateur && utilisateur.notif_commande_validee !== false) {
      await sendEmail(authHeader, utilisateur.email,
        `Incendie Plan - Ébauche validée`,
        `<h2>Bonjour ${utilisateur.prenom},</h2>
         <p>Vous avez validé l'ébauche de la commande <strong>${nom_plan}</strong> (${ref}).</p>
         <p>Le dessinateur va maintenant déposer les plans finaux.</p>
         ${lienCommande}`
      );
      results.push("utilisateur notifié: ébauche validée");
    }
    if (dessinateur && dessinateur.notif_validation_en_cours !== false) {
      await sendEmail(authHeader, dessinateur.email,
        `Incendie Plan - En attente de votre dépôt final`,
        `<h2>Bonjour ${dessinateur.prenom},</h2>
         <p>L'utilisateur a validé l'ébauche de la commande <strong>${nom_plan}</strong> (${ref}).</p>
         <p>Vous pouvez maintenant déposer les plans finaux.</p>
         ${lienCommande}`
      );
      results.push("dessinateur notifié: validation en cours");
    }

  } else if (event === "plans_finaux") {
    if (utilisateur && utilisateur.notif_plans_finaux !== false) {
      await sendEmail(authHeader, utilisateur.email,
        `Incendie Plan - Plans finaux déposés`,
        `<h2>Bonjour ${utilisateur.prenom},</h2>
         <p>Le dessinateur a déposé tous les plans finaux pour la commande <strong>${nom_plan}</strong> (${ref}).</p>
         <p>Connectez-vous pour les consulter et valider la commande.</p>
         ${lienCommande}`
      );
      results.push("utilisateur notifié: plans finaux");
    }

  } else if (event === "termine") {
    if (dessinateur && dessinateur.notif_commande_terminee !== false) {
      await sendEmail(authHeader, dessinateur.email,
        `Incendie Plan - Commande terminée`,
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
