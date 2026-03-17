import { TYPES_PLAN, ORIENTATIONS, FORMATS } from "../constants";

export default function TableauPlans({ plans, onChange }) {
  function updatePlan(i, key, val) { onChange(plans.map((p, idx) => idx === i ? { ...p, [key]: val } : p)); }
  function ajouterLigne()          { onChange([...plans, { ...plans[plans.length - 1] }]); }
  function supprimerLigne(i)       { onChange(plans.filter((_, idx) => idx !== i)); }
  const sel = { padding: "6px 8px", borderRadius: 6, border: "1px solid #E5E7EB", fontSize: 12, width: "100%", background: "#fff" };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr 28px", gap: 6, marginBottom: 6 }}>
        {["N°", "Type de plan", "Orientation", "Format", ""].map((h, i) => (
          <div key={i} style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{h}</div>
        ))}
      </div>
      {plans.map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr 28px", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", fontWeight: 600 }}>{i + 1}</div>
          <select value={p.type}        onChange={e => updatePlan(i, "type",        e.target.value)} style={sel}>{TYPES_PLAN.map(t   => <option key={t}>{t}</option>)}</select>
          <select value={p.orientation} onChange={e => updatePlan(i, "orientation", e.target.value)} style={sel}>{ORIENTATIONS.map(o => <option key={o}>{o}</option>)}</select>
          <select value={p.format}      onChange={e => updatePlan(i, "format",      e.target.value)} style={sel}>{FORMATS.map(f      => <option key={f}>{f}</option>)}</select>
          <button onClick={() => supprimerLigne(i)} disabled={i === 0}
            style={{ border: "none", background: "none", cursor: i === 0 ? "not-allowed" : "pointer", color: i === 0 ? "transparent" : "#D1D5DB", fontSize: 15, padding: 0 }}>✕</button>
        </div>
      ))}
      <button onClick={ajouterLigne}
        style={{ marginTop: 8, padding: "7px 14px", borderRadius: 6, border: "1px dashed #D1D5DB", background: "transparent", fontSize: 12, color: "#6B7280", cursor: "pointer", width: "100%" }}>
        + Ajouter un plan (copie la ligne précédente)
      </button>
    </div>
  );
}
