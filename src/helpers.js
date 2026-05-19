import { PATTERNS_CONTACTS } from "./constants";

export function formatDateBulle(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const jour = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jour} à ${heure}`;
}

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
  if (tri.col) r.sort((a, b) => {
    const va = a[tri.col] || ""; const vb = b[tri.col] || "";
    return tri.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  return r;
}

// Retourne le nombre de jours entre aujourd'hui et une date ISO string.
// Négatif = dépassé. Null si pas de date.
export function joursRestants(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// Palette de couleurs pour l'affichage d'un délai en fonction des jours restants :
//  - dépassé (j < 0)      → violet
//  - urgent (0..2 jours)  → rouge
//  - proche (3..7 jours)  → orange
//  - loin (> 7) / null    → neutre gris
export function delaiPalette(j) {
  const neutre = { accent: false, text: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB" };
  if (j === null || j === undefined) return neutre;
  if (j < 0)  return { accent: true, text: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" }; // violet — dépassé
  if (j < 3)  return { accent: true, text: "#DC2626", bg: "#FEF2F2", border: "#FECACA" }; // rouge — < 3 jours
  if (j <= 7) return { accent: true, text: "#D97706", bg: "#FFFBEB", border: "#FDE68A" }; // orange — 3 à 7 jours
  return neutre;
}
