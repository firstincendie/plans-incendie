import { useEffect, useState } from "react";
import { PATTERNS_CONTACTS } from "./constants";
import { supabase } from "./supabase";

const BUCKET_FICHIERS = "fichiers";

// ---------------------------------------------------------------------------
// Liens temporaires vers les fichiers (constat 4 de AUDIT-SECURITE.md)
//
// Le dossier de stockage des plans passe en privé : une adresse ne fonctionne
// plus toute seule, il faut demander un lien signé valable un temps limité.
//
// 555 fiches en base contiennent déjà d'anciennes adresses publiques. On ne les
// réécrit pas : on en extrait le chemin du fichier, et on redemande un lien à
// chaque affichage. Les deux formes fonctionnent donc, anciennes et nouvelles.
// ---------------------------------------------------------------------------

// Extrait le chemin de stockage d'une adresse enregistrée en base.
// Renvoie null si l'adresse ne concerne pas le dossier des plans (avatar,
// lien externe…) : dans ce cas on la laisse telle quelle.
export function cheminStockage(url) {
  if (!url) return null;
  const s = String(url);
  const m = s.match(/\/storage\/v1\/object\/(?:public|sign)\/fichiers\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (!/^https?:\/\//i.test(s)) return s.replace(/^\/+/, ""); // déjà un chemin
  return null;
}

// Transforme une adresse enregistrée en lien temporaire (1 heure par défaut).
// En cas de souci, renvoie l'adresse d'origine plutôt que rien : le fichier
// reste accessible tant que le dossier n'est pas passé en privé.
export async function lienFichier(url, secondes = 3600) {
  const chemin = cheminStockage(url);
  if (!chemin) return url;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_FICHIERS)
      .createSignedUrl(chemin, secondes);
    if (error || !data?.signedUrl) return url;
    return data.signedUrl;
  } catch {
    return url;
  }
}

// Version pour l'affichage (<img>, <iframe>) : renvoie null tant que le lien
// n'est pas prêt, pour ne pas afficher une image cassée entre-temps.
export function useLienFichier(url) {
  const [lien, setLien] = useState(null);
  useEffect(() => {
    let annule = false;
    setLien(null);
    if (!url) return undefined;
    lienFichier(url).then(u => { if (!annule) setLien(u); });
    return () => { annule = true; };
  }, [url]);
  return lien;
}


// Télécharge un fichier de façon fiable : on récupère les octets bruts via
// fetch (le stockage Supabase autorise le CORS) puis on sauvegarde le blob.
// Évite toute corruption liée au param ?download / Content-Disposition et
// garantit un fichier identique à l'original.
export async function telechargerFichier(fichier) {
  if (!fichier?.url) return;
  const lien = await lienFichier(fichier.url);
  try {
    const res = await fetch(lien);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = fichier.nom || "fichier";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
  } catch (e) {
    console.error("Téléchargement:", e);
    // Repli : ouvrir dans un nouvel onglet
    window.open(lien, "_blank", "noopener");
  }
}

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

// Ajoute days jours à baseDateStr (ou à aujourd'hui si baseDateStr est null/vide)
// et retourne au format ISO court "YYYY-MM-DD" — directement compatible <input type="date" />.
// NB : on formate en date LOCALE (pas toISOString qui passe en UTC et peut
// reculer d'un jour selon le fuseau, ex. UTC+2 en heure d'été).
export function ajouterJours(baseDateStr, days) {
  const d = baseDateStr ? new Date(baseDateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const an = d.getFullYear();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${an}-${mois}-${jour}`;
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
