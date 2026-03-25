import { useState } from "react";
import { TYPES_PLAN, ORIENTATIONS, FORMATS } from "../constants";

export default function TableauPlans({ plans, onChange }) {
  const [dragOver, setDragOver] = useState(null);

  function updatePlan(i, key, val) { onChange(plans.map((p, idx) => idx === i ? { ...p, [key]: val } : p)); }
  function ajouterLigne()          { onChange([...plans, { ...plans[plans.length - 1] }]); }
  function supprimerLigne(i)       { if (plans.length === 1) return; onChange(plans.filter((_, idx) => idx !== i)); }

  function moveRow(from, to) {
    if (from === to) return;
    const next = [...plans];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  const sel = { padding: "6px 8px", borderRadius: 6, border: "1px solid #E5E7EB", fontSize: 12, width: "100%", background: "#fff" };
  const inp = { padding: "6px 8px", borderRadius: 6, border: "1px solid #E5E7EB", fontSize: 12, width: "100%", boxSizing: "border-box" };

  return (
    <div>
      <div className="tableau-plans-entete">
        {["", "N°", "Type de plan", "Emplacement", "Orientation", "Format", ""].map((h, i) => (
          <div key={i} style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{h}</div>
        ))}
      </div>
      {plans.map((p, i) => (
        <div key={i} className="tableau-plans-ligne"
          draggable
          onDragStart={e => {
            if (!e.target.closest(".tp-handle")) { e.preventDefault(); return; }
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(i));
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(i); }}
          onDrop={e => { e.preventDefault(); moveRow(Number(e.dataTransfer.getData("text/plain")), i); setDragOver(null); }}
          onDragEnd={() => setDragOver(null)}
          style={dragOver === i ? { opacity: 0.4 } : undefined}
        >
          <div className="tp-handle" draggable>⠿</div>
          <input  className="tp-num"  value={p.numero || String(i + 1)} onChange={e => updatePlan(i, "numero", e.target.value)} style={{ ...inp, textAlign: "center" }} />
          <select className="tp-type" value={p.type}              onChange={e => updatePlan(i, "type",        e.target.value)} style={sel}>{TYPES_PLAN.map(t => <option key={t}>{t}</option>)}</select>
          <input  className="tp-empl" value={p.emplacement ?? ""} onChange={e => updatePlan(i, "emplacement", e.target.value)} style={inp} placeholder="ex: RDC Hall" />
          <select className="tp-ori"  value={p.orientation ?? ""} onChange={e => updatePlan(i, "orientation", e.target.value)} style={sel}>
            <option value="">—</option>
            {ORIENTATIONS.filter(o => o).map(o => <option key={o}>{o}</option>)}
          </select>
          <select className="tp-fmt"  value={p.format}            onChange={e => updatePlan(i, "format",      e.target.value)} style={sel}>{FORMATS.map(f => <option key={f}>{f}</option>)}</select>
          <button className="tp-del"  onClick={() => supprimerLigne(i)} disabled={plans.length === 1}
            style={{ border: "none", background: "none", cursor: plans.length === 1 ? "not-allowed" : "pointer", color: plans.length === 1 ? "transparent" : "#D1D5DB", fontSize: 15, padding: 0 }}>✕</button>
        </div>
      ))}
      <button onClick={ajouterLigne}
        style={{ marginTop: 8, padding: "7px 14px", borderRadius: 6, border: "1px dashed #D1D5DB", background: "transparent", fontSize: 12, color: "#6B7280", cursor: "pointer", width: "100%" }}>
        + Ajouter un plan (copie la ligne précédente)
      </button>
    </div>
  );
}
