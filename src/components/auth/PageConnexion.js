import { useState } from "react";
import { supabase } from "../../supabase";

export default function PageConnexion({ onMotDePasseOublie, onInscription }) {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const handleConnexion = async (e) => {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: mdp });
    if (error) {
      setErreur("Email ou mot de passe incorrect.");
    }
    setChargement(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 400, boxShadow: "0 4px 24px rgba(18,33,49,0.10)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔥</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: "#122131" }}>First Incendie</div>
          <div style={{ color: "#64748B", fontSize: 14, marginTop: 4 }}>Connexion à votre espace</div>
        </div>

        <form onSubmit={handleConnexion} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#122131", display: "block", marginBottom: 6 }}>Mot de passe</label>
            <input
              type="password"
              value={mdp}
              onChange={e => setMdp(e.target.value)}
              required
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none" }}
              placeholder="••••••••"
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
            style={{ background: "#386CA3", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, fontSize: 15, cursor: chargement ? "not-allowed" : "pointer", opacity: chargement ? 0.7 : 1, marginTop: 4 }}
          >
            {chargement ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center", display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onMotDePasseOublie} style={{ background: "none", border: "none", color: "#386CA3", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
            Mot de passe oublié ?
          </button>
          <div style={{ color: "#64748B", fontSize: 13 }}>
            Pas encore de compte ?{" "}
            <button onClick={onInscription} style={{ background: "none", border: "none", color: "#FC6C1B", fontSize: 13, cursor: "pointer", fontWeight: 700, padding: 0 }}>
              Faire une demande
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
