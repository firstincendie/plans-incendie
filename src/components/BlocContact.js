import { useState } from "react";

export default function BlocContact({ commande }) {
  const [copie, setCopie] = useState(false);

  const lignes = [
    { label: "Société", val: commande.client_societe,    href: null },
    { label: "Nom",     val: commande.client_nom,        href: null },
    { label: "Prénom",  val: commande.client_prenom,     href: null },
    { label: "Email",   val: commande.client_email,      href: commande.client_email ? `mailto:${commande.client_email}` : null },
    { label: "Tel",     val: commande.client_telephone,  href: commande.client_telephone ? `tel:${commande.client_telephone}` : null },
  ];
  const hasAny = lignes.some(l => l.val);
  if (!hasAny) return null;

  const texteCopie = lignes.filter(l => l.val).map(l => l.val).join("\n");

  function copier() {
    navigator.clipboard.writeText(texteCopie).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    });
  }

  return (
    <div style={{ background: "#F9FAFB", border: "1px solid #D1D5DB", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>👤 Contact</div>
        <button onClick={copier} title="Copier le contact"
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 5, color: copie ? "#059669" : "#9CA3AF", flexShrink: 0, transition: "color 0.2s" }}>
          {copie ? "✓ Copié" : "⎘ Copier"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {lignes.map(l => (
          <div key={l.label} style={{ display: "grid", gridTemplateColumns: "70px 1fr", fontSize: 13, color: l.val ? "#374151" : "#9CA3AF" }}>
            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{l.label}</span>
            {l.href ? (
              <a href={l.href} style={{ color: "#2563EB", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.val}</a>
            ) : (
              <span>{l.val || "—"}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
