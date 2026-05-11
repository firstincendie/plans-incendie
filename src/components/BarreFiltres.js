import { STATUTS_ADMIN } from "../constants";
import { getPeriode } from "../helpers";

export default function BarreFiltres({ commandes, filtres, setFiltres, showDessinateur = true, couleurAccent = "#122131" }) {
  const periodes     = [...new Set(commandes.map(c => getPeriode(c.created_at)).filter(Boolean))].sort().reverse();
  const typesDispos  = [...new Set(commandes.flatMap(c => (c.plans || []).map(p => p.type)).filter(Boolean))];
  const dessinateurs = [...new Set(commandes.map(c => c.dessinateur).filter(Boolean))].sort();

  const selStyle = { padding: "6px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, background: "#fff", color: "#374151", cursor: "pointer" };
  const actif = filtres.statut || filtres.dessinateur || filtres.type || filtres.periode || filtres.q || filtres.nonlus;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
      {/* Recherche */}
      <input
        type="text"
        value={filtres.q || ""}
        onChange={e => setFiltres({ ...filtres, q: e.target.value })}
        placeholder="🔍 Rechercher (plan, client, ref)"
        style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, background: "#fff", color: "#374151", minWidth: 180, flex: "1 1 220px", boxSizing: "border-box" }}
      />

      {/* Toggle notifications */}
      <button
        onClick={() => setFiltres({ ...filtres, nonlus: filtres.nonlus ? "" : "1" })}
        style={{
          padding: "6px 10px",
          borderRadius: 7,
          border: "1px solid " + (filtres.nonlus ? couleurAccent : "#E5E7EB"),
          background: filtres.nonlus ? "#FFF3EE" : "#fff",
          color: filtres.nonlus ? couleurAccent : "#374151",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}>
        🔔 Avec notifications
      </button>

      <select value={filtres.statut} onChange={e => setFiltres({ ...filtres, statut: e.target.value })} style={selStyle}>
        <option value="">Tous les statuts</option>
        {STATUTS_ADMIN.map(s => <option key={s}>{s}</option>)}
      </select>
      {showDessinateur && dessinateurs.length > 0 && (
        <select value={filtres.dessinateur} onChange={e => setFiltres({ ...filtres, dessinateur: e.target.value })} style={selStyle}>
          <option value="">Tous les dessinateurs</option>
          {dessinateurs.map(d => <option key={d}>{d}</option>)}
        </select>
      )}
      {typesDispos.length > 0 && (
        <select value={filtres.type} onChange={e => setFiltres({ ...filtres, type: e.target.value })} style={selStyle}>
          <option value="">Tous les types</option>
          {typesDispos.map(t => <option key={t}>{t}</option>)}
        </select>
      )}
      <select value={filtres.periode} onChange={e => setFiltres({ ...filtres, periode: e.target.value })} style={selStyle}>
        <option value="">Toutes les périodes</option>
        {periodes.map(p => {
          const [y, m] = p.split("-");
          return <option key={p} value={p}>{new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</option>;
        })}
      </select>
      {actif && (
        <button onClick={() => setFiltres({ statut: "", dessinateur: "", type: "", periode: "", q: "", nonlus: "" })}
          style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          ✕ Réinitialiser
        </button>
      )}
    </div>
  );
}

// Insensible à la casse + accents
function norm(s) {
  return (s == null ? "" : String(s)).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Sortable: nulls / vides toujours en fin de liste, peu importe la direction.
const DATE_COLS = new Set(["delai", "created_at"]);

export function appliquerFiltresTri(commandes, filtres, tri) {
  let r = [...commandes];
  if (filtres.statut)      r = r.filter(c => c.statut === filtres.statut);
  if (filtres.dessinateur) r = r.filter(c => c.dessinateur === filtres.dessinateur);
  if (filtres.type)        r = r.filter(c => (c.plans || []).some(p => p.type === filtres.type));
  if (filtres.periode)     r = r.filter(c => getPeriode(c.created_at) === filtres.periode);
  if (filtres.q) {
    const q = norm(filtres.q);
    r = r.filter(c =>
      norm(c.nom_plan).includes(q) ||
      norm(c.client_nom).includes(q) ||
      norm(c.client_prenom).includes(q) ||
      norm(c.ref).includes(q)
    );
  }
  if (tri.col) {
    r.sort((a, b) => {
      const va = a[tri.col]; const vb = b[tri.col];
      const aN = va == null || va === "";
      const bN = vb == null || vb === "";
      if (aN && bN) return 0;
      if (aN) return 1;
      if (bN) return -1;
      if (DATE_COLS.has(tri.col)) {
        return tri.dir === "asc" ? new Date(va) - new Date(vb) : new Date(vb) - new Date(va);
      }
      const sa = String(va), sb = String(vb);
      return tri.dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }
  return r;
}
