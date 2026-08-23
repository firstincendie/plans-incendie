// notify-commande — prévient le dessinateur qu'une commande lui est assignée,
// et confirme au client que sa commande est créée.
//
// SÉCURITÉ (constat 3) : la fonction répondait à n'importe qui, sans compte.
// Elle exige désormais un utilisateur connecté et actif.
// (constat 12) : le nom du plan et la référence sont échappés avant d'être
// insérés dans le HTML de l'email.
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
  const { exigerActif = true, exigerOwner = false } = options;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (!SERVICE_KEY) return json({ error: "Service indisponible" }, 500, req);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const qui = await appelant(req, supabase);
  if (!qui) return json({ error: "Unauthorized" }, 401, req);

  let nom_plan: string, ref: string, dessinateur_id: string | null, utilisateur_id: string | null;
  try {
    ({ nom_plan, ref, dessinateur_id, utilisateur_id } = await req.json());
  } catch {
    return json({ error: "Corps JSON invalide" }, 400, req);
  }

  const plan = esc(nom_plan);
  const reference = esc(ref);
  let envoyes = 0;

  if (dessinateur_id) {
    const { data: dessinateur } = await supabase
      .from("profiles")
      .select("email, prenom, notif_nouvelle_commande")
      .eq("id", dessinateur_id)
      .single();

    if (dessinateur?.email && dessinateur.notif_nouvelle_commande !== false) {
      const ok = await envoyerEmail(
        dessinateur.email,
        "Incendie Plan - Nouvelle commande",
        `<h2>Bonjour ${esc(dessinateur.prenom)},</h2>
         <p>Une nouvelle commande vient d'être créée et vous est assignée.</p>
         <p><strong>Plan :</strong> ${plan}</p>
         <p><strong>Référence :</strong> ${reference}</p>
         <p><a href="https://incendieplan.fr">Voir la commande</a></p>`,
      );
      if (ok) envoyes++;
    }
  }

  if (utilisateur_id) {
    const { data: utilisateur } = await supabase
      .from("profiles")
      .select("email, prenom, notif_commande_creee")
      .eq("id", utilisateur_id)
      .single();

    if (utilisateur?.email && utilisateur.notif_commande_creee !== false) {
      const ok = await envoyerEmail(
        utilisateur.email,
        "Incendie Plan - Commande créée",
        `<h2>Bonjour ${esc(utilisateur.prenom)},</h2>
         <p>Votre commande <strong>${plan}</strong> (${reference}) a bien été créée et est en attente de traitement.</p>
         <p><a href="https://incendieplan.fr">Voir la commande</a></p>`,
      );
      if (ok) envoyes++;
    }
  }

  return json({ success: true, envoyes }, 200, req);
});
