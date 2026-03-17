import { STATUTS_ADMIN } from "../constants";
import { getPeriode } from "../helpers";

export default function BarreFiltres({ commandes, filtres, setFiltres, tri, setTri, showDessinateur = true, couleurAccent = "#122131" }) {
  const periodes    = [...new Set(commandes.map(c => getPeriode(c.created_at)).filter(Boolean))].sort().reverse();
  const typesDispos = [...new Set(commandes.flatMap(c => (c.plans || []).map(p => p.type)).filter(Boolean))];
  const clients     = [...new Set(commandes.map(c => c.client).filter(Boolean))].sort();
  const dessinateurs = [...new Set(commandes.map(c => c.dessinateur).filter(Boolean))].sort();
  function toggleTri(col) { setTri(prev => prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }); }
  const selStyle = { padding: "6px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, background: "#fff", color: "#374151", cursor: "pointer" };
  const actif = filtres.statut || filtres.dessinateur || filtres.type || filtres.periode || filtres.client;
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>FILTRES</span>
      <select value={filtres.statut} onChange={e => setFiltres({ ...filtres, statut: e.target.value })} style={selStyle}>
        <option value="">Tous les statuts</option>
        {STATUTS_ADMIN.map(s => <option key={s}>{s}</option>)}
      </select>
      {showDessinateur && (
        <select value={filtres.dessinateur} onChange={e => setFiltres({ ...filtres, dessinateur: e.target.value })} style={selStyle}>
          <option value="">Tous les dessinateurs</option>
          {dessinateurs.map(d => <option key={d}>{d}</option>)}
        </select>
      )}
      <select value={filtres.client || ""} onChange={e => setFiltres({ ...filtres, client: e.target.value })} style={selStyle}>
        <option value="">Tous les clients</option>
        {clients.map(c => <option key={c}>{c}</option>)}
      </select>
      <select value={filtres.type} onChange={e => setFiltres({ ...filtres, type: e.target.value })} style={selStyle}>
        <option value="">Tous les types</option>
        {typesDispos.map(t => <option key={t}>{t}</option>)}
      </select>
      <select value={filtres.periode} onChange={e => setFiltres({ ...filtres, periode: e.target.value })} style={selStyle}>
        <option value="">Toutes les périodes</option>
        {periodes.map(p => {
          const [y, m] = p.split("-");
          return <option key={p} value={p}>{new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</option>;
        })}
      </select>
      {actif && (
        <button onClick={() => setFiltres({ statut: "", dessinateur: "", type: "", periode: "", client: "" })}
          style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          ✕ Réinitialiser
        </button>
      )}
      <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginRight: 2 }}>TRIER</span>
        {[
          { col: "batiment",    label: "Bâtiment" },
          { col: "client",      label: "Client" },
          { col: "created_at",  label: "Date" },
          { col: "delai",       label: "Délai" },
          { col: "statut",      label: "Statut" },
          ...(showDessinateur ? [{ col: "dessinateur", label: "Dessinateur" }] : []),
        ].map(({ col, label }) => (
          <button key={col} onClick={() => toggleTri(col)}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 11, fontWeight: 600, cursor: "pointer", background: tri.col === col ? "#EEF3F8" : "#fff", color: tri.col === col ? couleurAccent : "#6B7280" }}>
            {label}{tri.col === col ? (tri.dir === "asc" ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

export function appliquerFiltresTri(commandes, filtres, tri) {
  let r = [...commandes];
  if (filtres.statut)      r = r.filter(c => c.statut === filtres.statut);
  if (filtres.dessinateur) r = r.filter(c => c.dessinateur === filtres.dessinateur);
  if (filtres.type)        r = r.filter(c => (c.plans || []).some(p => p.type === filtres.type));
  if (filtres.periode)     r = r.filter(c => getPeriode(c.created_at) === filtres.periode);
  if (filtres.client)      r = r.filter(c => c.client === filtres.client);
  if (tri.col) r.sort((a, b) => {
    const va = a[tri.col] || ""; const vb = b[tri.col] || "";
    return tri.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  return r;
}
