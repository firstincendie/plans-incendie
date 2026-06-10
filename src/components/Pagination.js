// Barre de pagination réutilisable : sélecteur de taille (20/50/100) + flèches.
// Props :
//   total        – nombre total d'éléments
//   page         – page courante (1-indexée)
//   pageSize     – taille de page
//   onPage(n)    – change de page
//   onPageSize(n)– change la taille de page
//   couleur      – accent (défaut bleu foncé)
export default function Pagination({ total, page, pageSize, onPage, onPageSize, couleur = "#122131" }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const courante = Math.min(page, pageCount);
  const debut = total === 0 ? 0 : (courante - 1) * pageSize + 1;
  const fin = Math.min(courante * pageSize, total);

  const btn = (actif) => ({
    width: 30, height: 30, borderRadius: 7, border: "1px solid #E5E7EB",
    background: "#fff", color: actif ? couleur : "#D1D5DB", fontSize: 15,
    cursor: actif ? "pointer" : "not-allowed", display: "inline-flex",
    alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0,
  });

  // Ne rien afficher si tout tient sur une page et qu'on est en taille mini.
  if (total <= 20 && pageSize === 20) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#6B7280" }}>Afficher</span>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 12, background: "#fff", color: "#374151", cursor: "pointer" }}>
          {[20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>{debut}–{fin} sur {total}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => courante > 1 && onPage(courante - 1)} disabled={courante <= 1}
          title="Page précédente" style={btn(courante > 1)}>‹</button>
        <span style={{ fontSize: 12, color: "#6B7280", minWidth: 60, textAlign: "center" }}>{courante} / {pageCount}</span>
        <button onClick={() => courante < pageCount && onPage(courante + 1)} disabled={courante >= pageCount}
          title="Page suivante" style={btn(courante < pageCount)}>›</button>
      </div>
    </div>
  );
}
