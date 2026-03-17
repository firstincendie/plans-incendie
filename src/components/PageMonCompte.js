import { useState, useRef } from "react";
import { supabase } from "../supabase";

export default function PageMonCompte({ profil, session, onProfilUpdate }) {
  const [form, setForm] = useState({
    prenom: profil?.prenom || "",
    nom: profil?.nom || "",
    telephone: profil?.telephone || "",
    adresse: profil?.adresse || "",
    code_postal: profil?.code_postal || "",
    ville: profil?.ville || "",
    mdp: "",
    mdp_confirm: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(profil?.avatar_url || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef();

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${session.user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setMsg("Erreur lors du téléversement du logo.");
      setAvatarUploading(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = data.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", session.user.id);
    setAvatarUrl(url);
    onProfilUpdate({ avatar_url: url });
    setAvatarUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (form.mdp && form.mdp !== form.mdp_confirm) {
      setMsg("Les mots de passe ne correspondent pas.");
      return;
    }
    if (form.mdp && form.mdp.length < 8) {
      setMsg("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setSaving(true);
    const updates = {
      prenom: form.prenom,
      nom: form.nom,
      telephone: form.telephone,
      adresse: form.adresse,
      code_postal: form.code_postal,
      ville: form.ville,
    };
    const { error: profErr } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", session.user.id);
    if (profErr) {
      setMsg("Erreur lors de la mise à jour du profil.");
      setSaving(false);
      return;
    }
    if (form.mdp) {
      const { error: mdpErr } = await supabase.auth.updateUser({ password: form.mdp });
      if (mdpErr) {
        setMsg("Profil mis à jour, mais erreur lors du changement de mot de passe.");
        setSaving(false);
        return;
      }
    }
    onProfilUpdate(updates);
    setForm((p) => ({ ...p, mdp: "", mdp_confirm: "" }));
    setMsg("✅ Modifications enregistrées.");
    setSaving(false);
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1.5px solid #E2E8F0",
    borderRadius: 8,
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
    background: "#fff",
  };
  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: "#122131",
    display: "block",
    marginBottom: 5,
  };
  const sectionTitle = {
    fontSize: 11,
    fontWeight: 700,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: "1px solid #F1F5F9",
  };

  const initiales = `${(form.prenom?.[0] || "").toUpperCase()}${(form.nom?.[0] || "").toUpperCase()}`;

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 28px 0", color: "#122131" }}>Mon compte</h1>

      <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Avatar */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
          <div style={sectionTitle}>Photo de profil</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ position: "relative" }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid #E2E8F0" }}
                />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#122131", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff", border: "3px solid #E2E8F0" }}>
                  {initiales || "?"}
                </div>
              )}
              {avatarUploading && (
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>...</div>
              )}
            </div>
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                disabled={avatarUploading}
                style={{ padding: "8px 16px", border: "1.5px solid #E2E8F0", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}
              >
                {avatarUploading ? "Téléversement..." : "Changer la photo"}
              </button>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 5 }}>PNG, JPG — max 2 Mo</div>
            </div>
          </div>
        </div>

        {/* Identité */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
          <div style={sectionTitle}>Informations personnelles</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Prénom</label>
              <input type="text" value={form.prenom} onChange={set("prenom")} style={inputStyle} placeholder="Jean" />
            </div>
            <div>
              <label style={labelStyle}>Nom</label>
              <input type="text" value={form.nom} onChange={set("nom")} style={inputStyle} placeholder="Dupont" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={session?.user?.email || ""}
                disabled
                style={{ ...inputStyle, background: "#F8FAFC", color: "#94A3B8", cursor: "not-allowed" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input type="tel" value={form.telephone} onChange={set("telephone")} style={inputStyle} placeholder="06 00 00 00 00" />
            </div>
          </div>
        </div>

        {/* Adresse */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
          <div style={sectionTitle}>Adresse</div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Rue</label>
            <input type="text" value={form.adresse} onChange={set("adresse")} style={inputStyle} placeholder="12 rue de la Paix" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Code postal</label>
              <input type="text" value={form.code_postal} onChange={set("code_postal")} style={inputStyle} placeholder="75001" />
            </div>
            <div>
              <label style={labelStyle}>Ville</label>
              <input type="text" value={form.ville} onChange={set("ville")} style={inputStyle} placeholder="Paris" />
            </div>
          </div>
        </div>

        {/* Mot de passe */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
          <div style={sectionTitle}>Changer le mot de passe</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Nouveau mot de passe</label>
              <input
                type="password"
                value={form.mdp}
                onChange={set("mdp")}
                autoComplete="new-password"
                style={inputStyle}
                placeholder="8 caractères minimum"
              />
            </div>
            <div>
              <label style={labelStyle}>Confirmer</label>
              <input
                type="password"
                value={form.mdp_confirm}
                onChange={set("mdp_confirm")}
                autoComplete="new-password"
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        {msg && (
          <div style={{
            background: msg.startsWith("✅") ? "#F0FDF4" : "#FEF2F2",
            border: `1px solid ${msg.startsWith("✅") ? "#BBF7D0" : "#FECACA"}`,
            borderRadius: 8, padding: "12px 16px", fontSize: 13,
            color: msg.startsWith("✅") ? "#166534" : "#DC2626",
          }}>
            {msg}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={saving}
            style={{ background: "#386CA3", color: "#fff", border: "none", borderRadius: 8, padding: "11px 28px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </form>
    </div>
  );
}
