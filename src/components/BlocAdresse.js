import { useState } from "react";

export default function BlocAdresse({ commande }) {
  const [copie, setCopie] = useState(false);

  const lignes = [
    { label: "N°",    val: commande.numero_rue },
    { label: "Rue",   val: commande.adresse1 },
    { label: "CP",    val: commande.code_postal },
    { label: "Ville", val: commande.ville },
  ];
  const hasAny = lignes.some(l => l.val);
  if (!hasAny) return null;

  // Format multiligne pour le presse-papier
  const texteCopie = [
    commande.numero_rue,
    commande.adresse1,
    [commande.code_postal, commande.ville].filter(Boolean).join(" "),
  ].filter(Boolean).join("\n");

  function copier() {
    navigator.clipboard.writeText(texteCopie).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    });
  }

  return (
    <div style={{ marginBottom: 16, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>📍 Adresse</div>
        <button onClick={copier} title="Copier l'adresse"
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 5, color: copie ? "#059669" : "#9CA3AF", flexShrink: 0, transition: "color 0.2s" }}>
          {copie ? "✓ Copié" : "⎘ Copier"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {lignes.map(l => (
          <div key={l.label} style={{ display: "grid", gridTemplateColumns: "60px 1fr", fontSize: 13, color: l.val ? "#374151" : "#9CA3AF" }}>
            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{l.label}</span>
            <span>{l.val || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
