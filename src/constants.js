export const STATUTS_ADMIN = ["En attente", "Commencé", "Ébauche déposée", "Modification dessinateur", "Validation en cours", "Validé"];
export const STATUT_STYLE = {
  "En attente":               { bg: "#FEF3C7", color: "#92400E" },
  "Commencé":                 { bg: "#DBEAFE", color: "#1E40AF" },
  "Ébauche déposée":          { bg: "#EDE9FE", color: "#5B21B6" },
  "Modification dessinateur": { bg: "#FFE4E6", color: "#9F1239" },
  "Validation en cours":      { bg: "#ECFDF5", color: "#047857" },
  "Validé":                   { bg: "#D1FAE5", color: "#065F46" },
  "Archivé":                  { bg: "#F3F4F6", color: "#6B7280", border: "1px solid #D1D5DB" },
};
export const TYPES_PLAN   = ["Évacuation", "Intervention", "SSI", "Plan de masse"];
export const FORMATS      = ["A4", "A3", "A2", "A1", "A0"];
export const MATIERES     = ["Bache M1", "Plexiglass", "Aluminium"];
export const ORIENTATIONS = ["", "Horizontale", "Verticale"];
export const planVide = () => ({ numero: "", type: "Évacuation", emplacement: "", orientation: "", format: "A3", matiere: "" });

export const PATTERNS_CONTACTS = [
  // Email complet
  { regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: "adresse email" }, // eslint-disable-line no-useless-escape
  // Téléphone FR format complet : 06 12 34 56 78 / +33612345678 / 0612345678
  { regex: /(\+33|0033)[\s.\-]?[1-9]([\s.\-]?\d{2}){4}/g,        label: "numéro de téléphone" }, // eslint-disable-line no-useless-escape
  { regex: /\b0[1-9]([\s.\-]?\d{2}){4}\b/g,                       label: "numéro de téléphone" }, // eslint-disable-line no-useless-escape
  // URL avec protocole ou www
  { regex: /(https?:\/\/|www\.)\S+/gi,                             label: "lien web" },
  // Domaine explicite avec extension
  { regex: /\b[a-zA-Z0-9-]{2,}\.(fr|com|net|org|io|co|eu|pro|biz)\b/gi, label: "nom de domaine" },
  // Réseaux sociaux
  { regex: /\b(instagram|facebook|linkedin|twitter|tiktok|whatsapp|telegram|signal|skype|discord|snapchat|messenger)\b/gi, label: "contact externe" },
];
