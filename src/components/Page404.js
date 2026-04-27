import { Link } from "react-router-dom";

export default function Page404() {
  return (
    <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 420, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤔</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: "#122131", marginBottom: 12 }}>Page introuvable</div>
        <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Cette page n'existe pas ou a été déplacée.
        </div>
        <Link to="/commandes" style={{ background: "#122131", color: "#fff", textDecoration: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13 }}>
          Retour aux commandes
        </Link>
      </div>
    </div>
  );
}
