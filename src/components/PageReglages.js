import { useState, useRef } from "react";

export default function PageReglages({ settings, onSave }) {
  const [local, setLocal] = useState(settings);
  const [sauve, setSauve] = useState(false);
  const logoRef = useRef();
  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4 };
  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Réglages</h1>
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 20 }}>
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
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Logo de l'entreprise</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 80, height: 80, border: "1px solid #E5E7EB", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#F9FAFB", flexShrink: 0 }}>
            {local.logoUrl ? <img src={local.logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 11, color: "#9CA3AF" }}>Aucun logo</span>}
          </div>
          <div>
            <button onClick={() => logoRef.current.click()}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer", marginBottom: 6, display: "block" }}>
              {local.logoUrl ? "Changer le logo" : "Choisir un logo"}
            </button>
            {local.logoNom && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{local.logoNom}</div>}
            <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
              const f = e.target.files[0];
              if (f) setLocal({ ...local, logoUrl: URL.createObjectURL(f), logoNom: f.name });
            }} />
          </div>
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Dessinateurs</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>Un nom par ligne</div>
        <textarea value={local.dessinateurs.join("\n")} onChange={e => setLocal({ ...local, dessinateurs: e.target.value.split("\n").filter(d => d.trim()) })} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      </div>
      <button onClick={() => { onSave(local); setSauve(true); setTimeout(() => setSauve(false), 2000); }}
        style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: sauve ? "#059669" : "#122131", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.3s" }}>
        {sauve ? "✓ Sauvegardé !" : "Sauvegarder les réglages"}
      </button>
    </div>
  );
}
