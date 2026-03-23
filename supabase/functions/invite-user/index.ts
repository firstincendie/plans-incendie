import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Vérifier que l'appelant est is_owner
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { data: profil } = await supabase.from("profiles").select("is_owner").eq("id", user.id).single();
  if (!profil?.is_owner) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const { email, prenom, nom, role } = await req.json();
  if (!email || !prenom || !nom) {
    return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { prenom, nom, role },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email,
      prenom,
      nom,
      role,
      statut: "actif",
    });
  }

  return new Response(JSON.stringify({ success: true, user_id: data.user?.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
