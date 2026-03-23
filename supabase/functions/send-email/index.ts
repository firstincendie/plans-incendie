import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "incendieplan.fr";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "noreply@incendieplan.fr";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { to, subject, html } = await req.json();
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ error: "Missing fields: to, subject, html" }), { status: 400 });
  }

  try {
    const nodemailer = await import("npm:nodemailer@6");
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"First Incendie" <${SMTP_USER}>`,
      to,
      subject,
      html,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
