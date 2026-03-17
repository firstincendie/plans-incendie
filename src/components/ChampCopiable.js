import { useState } from "react";

export default function ChampCopiable({ valeur, label, style = {} }) {
  const [copie, setCopie] = useState(false);
  if (!valeur) return null;
  function copier() {
    navigator.clipboard.writeText(valeur).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    });
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, ...style }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{valeur}</span>
      <button onClick={copier} title={`Copier ${label || ""}`}
        style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 5, color: copie ? "#059669" : "#9CA3AF", flexShrink: 0, transition: "color 0.2s" }}>
        {copie ? "✓" : "⎘"}
      </button>
    </div>
  );
}
