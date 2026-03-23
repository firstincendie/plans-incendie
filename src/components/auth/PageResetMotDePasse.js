import { useState } from "react";
import { supabase } from "../../supabase";

export default function PageResetMotDePasse({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [fait, setFait] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur("");
    if (password.length < 8) { setErreur("Le mot de passe doit faire au moins 8 caractères."); return; }
    if (password !== confirm) { setErreur("Les mots de passe ne correspondent pas."); return; }
    setChargement(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErreur(error.message);
    } else {
      setFait(true);
      setTimeout(() => onSuccess(), 2000);
    }
    setChargement(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 400, boxShadow: "0 4px 24px rgba(18,33,49,0.10)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: "#122131" }}>Nouveau mot de passe</div>
          <div style={{ color: "#64748B", fontSize: 14, marginTop: 4 }}>Choisissez un mot de passe sécurisé</div>
        </div>

        {fait ? (
          <div style={{ textAlign: "center", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: 16, color: "#166534", fontSize: 14 }}>
            ✅ Mot de passe mis à jour. Redirection...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#122131", display: "block", marginBottom: 6 }}>Nouveau mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                placeholder="8 caractères minimum" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#122131", display: "block", marginBottom: 6 }}>Confirmer le mot de passe</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                placeholder="Répétez le mot de passe" />
            </div>
            {erreur && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", color: "#DC2626", fontSize: 13 }}>
                {erreur}
              </div>
            )}
            <button type="submit" disabled={chargement}
              style={{ background: "#386CA3", color: "#fff", border: "none", borderRadius: 8, padding: 12, fontWeight: 700, fontSize: 15, cursor: chargement ? "not-allowed" : "pointer", opacity: chargement ? 0.7 : 1 }}>
              {chargement ? "Enregistrement..." : "Définir le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
