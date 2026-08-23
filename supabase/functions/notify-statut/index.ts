// notify-statut — prévient client et dessinateur des étapes d'une commande.
//
// SÉCURITÉ (constat 3) : exige un utilisateur connecté et actif.
// (constat 12) : le nom du plan et la référence, lus dans la base, sont
// échappés avant d'être insérés dans le HTML des emails.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Bloc commun (recopié dans chaque fonction : les edge functions sont déployées
// indépendamment, elles ne partagent pas de fichier).
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-email`;

const ORIGINES_AUTORISEES = [
  "https://incendieplan.fr",
  "https://www.incendieplan.fr",
  "http://localhost:3000",
];

function cors(req: Request): Record<string, string> {
  const origine = req.headers.get("Origin") ?? "";
  const autorisee =
    ORIGINES_AUTORISEES.includes(origine) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origine);
  return {
    "Access-Control-Allow-Origin": autorisee ? origine : ORIGINES_AUTORISEES[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(corps: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

// Échappe le texte avant de l'insérer dans le HTML d'un email : sans cela, un
// nom de plan ou un prénom peut glisser un faux bouton ou un lien piégé dans
// un email par ailleurs authentique.
function esc(valeur: unknown): string {
  return String(valeur ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jeton(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

type Appelant = { id: string; profil: Record<string, unknown> };

// Vérifie que l'appel vient bien d'un utilisateur connecté de l'application.
// Renvoie null si ce n'est pas le cas : l'appelant reçoit alors un 401/403.
async function appelant(
  req: Request,
  supabase: any,
  options: { exigerActif?: boolean; exigerOwner?: boolean } = {},
): Promise<Appelant | null> {
  const exigerActif = options.exigerActif !== false;
  const exigerOwner = options.exigerOwner === true;
  const token = jeton(req);
  // La clé publiable et la clé de service ne sont pas des jetons d'utilisateur.
  if (!token || token === SERVICE_KEY) return null;

  const { data } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (!user) return null;

  const { data: profil } = await supabase
    .from("profiles")
    .select("id, statut, role, is_owner, prenom, nom, email")
    .eq("id", user.id)
    .single();
  if (!profil) return null;
  if (exigerActif && profil.statut !== "actif") return null;
  if (exigerOwner && profil.is_owner !== true) return null;

  return { id: user.id, profil };
}

// Appelle send-email en s'authentifiant avec la clé de service : send-email
// n'accepte plus que ça, il n'est donc plus joignable depuis un navigateur.
async function envoyerEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch(SEND_EMAIL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ to, subject, html }),
  });
  if (!res.ok) console.error(`send-email a echoue pour ${to}:`, await res.text());
  return res.ok;
}

const APP_URL = "https://incendieplan.fr";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (!SERVICE_KEY) return json({ error: "Service indisponible" }, 500, req);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const qui = await appelant(req, supabase);
  if (!qui) return json({ error: "Unauthorized" }, 401, req);

  let commande_id: string, event: string;
  try {
    ({ commande_id, event } = await req.json());
  } catch {
    return json({ error: "Invalid JSON body" }, 400, req);
  }
  if (!commande_id || !event) {
    return json({ error: "Missing commande_id or event" }, 400, req);
  }

  const { data: commande, error: commandeError } = await supabase
    .from("commandes")
    .select("utilisateur_id, dessinateur_id, nom_plan, ref")
    .eq("id", commande_id)
    .single();
  if (commandeError) console.error("Failed to fetch commande:", commandeError.message);
  if (!commande) return json({ error: "commande not found" }, 404, req);

  const { utilisateur_id, dessinateur_id, nom_plan, ref } = commande;
  const plan = esc(nom_plan);
  const reference = esc(ref);

  const { data: utilisateur } = await supabase
    .from("profiles")
    .select("email, prenom, notif_commande_acceptee, notif_commande_validee, notif_plans_finaux")
    .eq("id", utilisateur_id)
    .single();

  const { data: dessinateur } = dessinateur_id
    ? await supabase
        .from("profiles")
        .select("email, prenom, notif_demande_modification, notif_validation_en_cours, notif_commande_terminee")
        .eq("id", dessinateur_id)
        .single()
    : { data: null };

  const lienCommande = `<p><a href="${APP_URL}">Voir la commande — ${plan} (${reference})</a></p>`;
  const results: string[] = [];

  if (event === "commencé") {
    if (utilisateur?.email && utilisateur.notif_commande_acceptee !== false) {
      await envoyerEmail(utilisateur.email,
        "Incendie Plan - Commande acceptée",
        `<h2>Bonjour ${esc(utilisateur.prenom)},</h2>
         <p>Le dessinateur a accepté votre commande <strong>${plan}</strong> (${reference}) et a commencé à travailler dessus.</p>
         ${lienCommande}`);
      results.push("utilisateur notifié: commande acceptée");
    }

  } else if (event === "modification") {
    if (dessinateur?.email && dessinateur.notif_demande_modification !== false) {
      await envoyerEmail(dessinateur.email,
        "Incendie Plan - Demande de modification",
        `<h2>Bonjour ${esc(dessinateur.prenom)},</h2>
         <p>L'utilisateur a demandé des modifications sur la commande <strong>${plan}</strong> (${reference}).</p>
         <p>Consultez le message dans la messagerie de la commande.</p>
         ${lienCommande}`);
      results.push("dessinateur notifié: demande modification");
    }

  } else if (event === "validation_en_cours") {
    if (utilisateur?.email && utilisateur.notif_commande_validee !== false) {
      await envoyerEmail(utilisateur.email,
        "Incendie Plan - Ébauche validée",
        `<h2>Bonjour ${esc(utilisateur.prenom)},</h2>
         <p>Vous avez validé l'ébauche de la commande <strong>${plan}</strong> (${reference}).</p>
         <p>Le dessinateur va maintenant déposer les plans finaux.</p>
         ${lienCommande}`);
      results.push("utilisateur notifié: ébauche validée");
    }
    if (dessinateur?.email && dessinateur.notif_validation_en_cours !== false) {
      await envoyerEmail(dessinateur.email,
        "Incendie Plan - En attente de votre dépôt final",
        `<h2>Bonjour ${esc(dessinateur.prenom)},</h2>
         <p>L'utilisateur a validé l'ébauche de la commande <strong>${plan}</strong> (${reference}).</p>
         <p>Vous pouvez maintenant déposer les plans finaux.</p>
         ${lienCommande}`);
      results.push("dessinateur notifié: validation en cours");
    }

  } else if (event === "plans_finaux") {
    if (utilisateur?.email && utilisateur.notif_plans_finaux !== false) {
      await envoyerEmail(utilisateur.email,
        "Incendie Plan - Plans finaux déposés",
        `<h2>Bonjour ${esc(utilisateur.prenom)},</h2>
         <p>Le dessinateur a déposé tous les plans finaux pour la commande <strong>${plan}</strong> (${reference}).</p>
         <p>Connectez-vous pour les consulter et valider la commande.</p>
         ${lienCommande}`);
      results.push("utilisateur notifié: plans finaux");
    }

  } else if (event === "termine") {
    if (dessinateur?.email && dessinateur.notif_commande_terminee !== false) {
      await envoyerEmail(dessinateur.email,
        "Incendie Plan - Commande terminée",
        `<h2>Bonjour ${esc(dessinateur.prenom)},</h2>
         <p>L'utilisateur a validé les plans finaux de la commande <strong>${plan}</strong> (${reference}).</p>
         <p>La mission est terminée.</p>
         ${lienCommande}`);
      results.push("dessinateur notifié: commande terminée");
    }

  } else {
    return json({ error: `Unknown event: ${event}` }, 400, req);
  }

  return json({ success: true, results }, 200, req);
});
