import { supabase } from "../supabase";

export default function PageReglages({ profil, onProfilUpdate }) {
  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Réglages</h1>
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
        <div style={{ fontSize: 14, color: "#94A3B8" }}>Aucun réglage disponible pour le moment.</div>
      </div>

      {/* Section Notifications */}
      {profil && (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Notifications email</div>
          {[
            ...(profil.role === "dessinateur" ? [
              { key: "notif_nouvelle_commande", label: "Nouvelle commande assignée", desc: "Recevoir un email quand un client crée une commande" },
            ] : []),
            { key: "notif_nouveau_message", label: "Nouveau message", desc: "Recevoir un email quand un message est posté dans une commande" },
            ...(profil.role === "utilisateur" ? [
              { key: "notif_nouvelle_version", label: "Ébauche déposée", desc: "Recevoir un email quand le dessinateur dépose une nouvelle version" },
            ] : []),
          ].map(({ key, label, desc }) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{desc}</div>
              </div>
              <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, cursor: "pointer" }}>
                <input type="checkbox" checked={profil[key] !== false} onChange={async (e) => {
                  const { error } = await supabase.from("profiles").update({ [key]: e.target.checked }).eq("id", profil.id);
                  if (!error) onProfilUpdate({ [key]: e.target.checked });
                }} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: "absolute", inset: 0, background: profil[key] !== false ? "#122131" : "#E5E7EB", borderRadius: 12, transition: "0.2s" }}>
                  <span style={{ position: "absolute", top: 2, left: profil[key] !== false ? 22 : 2, width: 20, height: 20, background: "#fff", borderRadius: "50%", transition: "0.2s" }} />
                </span>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
