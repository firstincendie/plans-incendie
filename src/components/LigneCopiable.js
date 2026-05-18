import { useState } from "react";

// Ligne label + valeur + bouton de copie ; bouton masqué si valeur vide.
export default function LigneCopiable({ label, valeur, href = null, labelWidth = 60 }) {
  const [copie, setCopie] = useState(false);

  function copier() {
    if (!valeur) return;
    navigator.clipboard.writeText(valeur).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: `${labelWidth}px 1fr 26px`, alignItems: "center", fontSize: 13, color: valeur ? "#374151" : "#9CA3AF", gap: 6 }}>
      <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{label}</span>
      {valeur && href ? (
        <a href={href} style={{ color: "#2563EB", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{valeur}</a>
      ) : (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{valeur || "—"}</span>
      )}
      {valeur ? (
        <button onClick={copier} title={`Copier ${label}`}
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, padding: "2px 4px", borderRadius: 4, color: copie ? "#059669" : "#9CA3AF", flexShrink: 0, transition: "color 0.2s", lineHeight: 1 }}>
          {copie ? "✓" : "⎘"}
        </button>
      ) : <span />}
    </div>
  );
}
