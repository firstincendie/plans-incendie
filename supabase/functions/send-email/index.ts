import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "noreply@incendieplan.fr";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { to, subject, html } = await req.json();
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ error: "Missing fields: to, subject, html" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `First Incendie <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Resend error:", res.status, JSON.stringify(data));
    return new Response(JSON.stringify({ resend_status: res.status, error: data }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, id: data.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
