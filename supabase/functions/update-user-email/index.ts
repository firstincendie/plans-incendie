import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Vérifier que l'appelant est is_owner
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const { data: profil } = await supabase.from("profiles").select("is_owner").eq("id", user.id).single();
  if (!profil?.is_owner) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

  const { user_id, new_email } = await req.json();
  if (!user_id || !new_email) {
    return new Response(JSON.stringify({ error: "Missing user_id or new_email" }), { status: 400, headers: corsHeaders });
  }

  // Mettre à jour l'email dans auth.users (connexion)
  const { error: authUpdateError } = await supabase.auth.admin.updateUserById(user_id, {
    email: new_email,
    email_confirm: true,
  });
  if (authUpdateError) {
    return new Response(JSON.stringify({ error: authUpdateError.message }), { status: 400, headers: corsHeaders });
  }

  // Mettre à jour l'email dans la table profiles (notifications)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ email: new_email })
    .eq("id", user_id);
  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
