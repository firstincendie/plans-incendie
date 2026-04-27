import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";

export default function PageMotDePasseOublie() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const handleEnvoi = async (e) => {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      setErreur("Service email temporairement indisponible. Contactez l'administrateur pour réinitialiser votre mot de passe.");
    } else {
      setEnvoye(true);
    }
    setChargement(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 400, boxShadow: "0 4px 24px rgba(18,33,49,0.10)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: "#122131" }}>Mot de passe oublié</div>
          <div style={{ color: "#64748B", fontSize: 14, marginTop: 4 }}>
            Nous vous enverrons un lien de réinitialisation
          </div>
        </div>

        {envoye ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "16px", color: "#166534", fontSize: 14, marginBottom: 24 }}>
              ✅ Email envoyé ! Vérifiez votre boîte mail et suivez le lien pour réinitialiser votre mot de passe.
            </div>
            <button onClick={() => navigate("/connexion")} style={{ background: "none", border: "none", color: "#386CA3", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
              ← Retour à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={handleEnvoi} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#122131", display: "block", marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none" }}
                placeholder="votre@email.com"
              />
            </div>

            {erreur && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", color: "#DC2626", fontSize: 13 }}>
                {erreur}
              </div>
            )}

            <button
              type="submit"
              disabled={chargement}
              style={{ background: "#386CA3", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, fontSize: 15, cursor: chargement ? "not-allowed" : "pointer", opacity: chargement ? 0.7 : 1 }}
            >
              {chargement ? "Envoi..." : "Envoyer le lien"}
            </button>

            <button type="button" onClick={() => navigate("/connexion")} style={{ background: "none", border: "none", color: "#386CA3", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
              ← Retour à la connexion
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
