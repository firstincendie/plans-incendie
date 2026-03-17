import { PATTERNS_CONTACTS } from "./constants";

export function formatDateMsg() {
  const now = new Date();
  const d = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const h = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `Le ${d} à ${h}`;
}

export function formatDateCourt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateLong(iso) {
  if (!iso) return "—";
  const d = new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const h = new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `Le ${d} à ${h}`;
}

export function tempsRestant(delai) {
  if (!delai) return null;
  const diff = Math.ceil((new Date(delai) - new Date()) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return { label: `${Math.abs(diff)}j de retard`, color: "#DC2626", bg: "#FEF2F2" };
  if (diff === 0) return { label: "Aujourd'hui !", color: "#D97706", bg: "#FFFBEB" };
  if (diff <= 3)  return { label: `${diff}j restant${diff > 1 ? "s" : ""}`, color: "#D97706", bg: "#FFFBEB" };
  return { label: `${diff}j restants`, color: "#059669", bg: "#F0FDF4" };
}

export function getPeriode(created_at) {
  if (!created_at) return "";
  const d = new Date(created_at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function fichierAvecDate(f) {
  return { ...f, ajouteLe: f.ajouteLe || formatDateMsg() };
}

export function analyserMessage(texte) {
  for (const { regex, label } of PATTERNS_CONTACTS) {
    regex.lastIndex = 0;
    if (regex.test(texte)) return label;
  }
  return null;
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
