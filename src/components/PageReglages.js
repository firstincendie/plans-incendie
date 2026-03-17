import { useState } from "react";

export default function PageReglages({ settings, onSave }) {
  const [local, setLocal] = useState(settings);
  const [sauve, setSauve] = useState(false);
  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4 };
  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Réglages</h1>
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Informations entreprise</div>
        {[
          { label: "Nom de l'entreprise", key: "nomEntreprise", type: "text" },
          { label: "Email de contact",    key: "email",         type: "email" },
          { label: "Téléphone",           key: "telephone",     type: "text" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{f.label}</label>
            <input type={f.type} value={local[f.key]} onChange={e => setLocal({ ...local, [f.key]: e.target.value })} style={inputStyle} />
          </div>
        ))}
      </div>
      <button onClick={() => { onSave(local); setSauve(true); setTimeout(() => setSauve(false), 2000); }}
        style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: sauve ? "#059669" : "#122131", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.3s" }}>
        {sauve ? "✓ Sauvegardé !" : "Sauvegarder les réglages"}
      </button>
    </div>
  );
}
