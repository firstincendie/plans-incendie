// notify-activation — prévient une personne que son compte est activé, refusé
// ou suspendu.
//
// SÉCURITÉ (constat 3) : la fonction répondait à n'importe qui et acceptait un
// destinataire libre — un excellent outil d'envoi de masse signé
// incendieplan.fr. Elle est désormais réservée au propriétaire, ce qui
// correspond à l'écran « Gestion utilisateurs » d'où elle est appelée.
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

const modeles: Record<string, { subject: string; html: (prenom: string) => string }> = {
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (!SERVICE_KEY) return json({ error: "Service indisponible" }, 500, req);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const qui = await appelant(req, supabase, { exigerActif: false, exigerOwner: true });
  if (!qui) return json({ error: "Forbidden" }, 403, req);

  let to: string, prenom: string, statut: string;
  try {
    ({ to, prenom, statut } = await req.json());
  } catch {
    return json({ error: "Corps JSON invalide" }, 400, req);
  }

  const modele = modeles[statut];
  if (!modele) return json({ error: "Unknown statut" }, 400, req);
  if (!to) return json({ error: "Missing to" }, 400, req);

  const envoye = await envoyerEmail(to, modele.subject, modele.html(esc(prenom)));
  return json({ success: envoye }, envoye ? 200 : 502, req);
});
