import { STATUT_STYLE } from "../constants";

export default function Badge({ statut }) {
  const s = STATUT_STYLE[statut] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <div><span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" }}>{statut}</span></div>
  );
}
