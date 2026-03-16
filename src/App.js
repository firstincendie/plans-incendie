import { useState, useRef } from "react";

const STATUTS = ["En attente", "Commencé", "Ébauche déposée", "Modification dessinateur", "Validé"];

const STATUT_STYLE = {
  "En attente":               { bg: "#FEF3C7", color: "#92400E" },
  "Commencé":                 { bg: "#DBEAFE", color: "#1E40AF" },
  "Ébauche déposée":          { bg: "#EDE9FE", color: "#5B21B6" },
  "Modification dessinateur": { bg: "#FFE4E6", color: "#9F1239" },
  "Validé":                   { bg: "#D1FAE5", color: "#065F46" },
};

const TYPES_PLAN   = ["Évacuation", "Intervention", "SSI", "Plan de masse"];
const FORMATS      = ["A4", "A3", "A2", "A1", "A0"];
const ORIENTATIONS = ["Portrait", "Paysage"];
const DESSINATEURS = ["Marc L.", "Thomas R."];

const planVide = () => ({ type: "Évacuation", orientation: "Paysage", format: "A3" });

const initCommandes = [
  {
    id: 1, ref: "CMD-001", batiment: "Résidence Les Acacias", client: "Syndic Acacias",
    delai: "2024-03-20", dessinateur: "Marc L.", statut: "Commencé", notes: "3 niveaux + sous-sol",
    plans: [
      { type: "Évacuation",   orientation: "Paysage",  format: "A2" },
      { type: "Intervention", orientation: "Paysage",  format: "A3" },
      { type: "Évacuation",   orientation: "Portrait", format: "A3" },
    ],
    fichiersPlan: [], logoClient: null,
    messages: [
      { auteur: "Simon",   texte: "Commande transmise.",       date: "10 mars" },
      { auteur: "Marc L.", texte: "Reçu, je commence demain.", date: "10 mars" },
    ],
  },
  {
    id: 2, ref: "CMD-002", batiment: "Entrepôt Nord – Bât. B", client: "LogiPro",
    delai: "2024-03-18", dessinateur: "Thomas R.", statut: "Modification dessinateur",
    notes: "Ajouter issues de secours côté nord",
    plans: [{ type: "Intervention", orientation: "Paysage", format: "A2" }],
    fichiersPlan: [], logoClient: null,
    messages: [{ auteur: "Simon", texte: "Le client demande un ajout côté nord.", date: "12 mars" }],
  },
  {
    id: 3, ref: "CMD-003", batiment: "Hôtel du Port", client: "Hôtel du Port",
    delai: "2024-03-15", dessinateur: "Marc L.", statut: "Validé", notes: "",
    plans: [
      { type: "Évacuation",   orientation: "Paysage", format: "A2" },
      { type: "Évacuation",   orientation: "Paysage", format: "A2" },
      { type: "Intervention", orientation: "Paysage", format: "A3" },
    ],
    fichiersPlan: [], logoClient: null,
    messages: [
      { auteur: "Marc L.", texte: "Plans finaux déposés.",         date: "14 mars" },
      { auteur: "Simon",   texte: "Validé par le client. Merci !", date: "15 mars" },
    ],
  },
  {
    id: 4, ref: "CMD-004", batiment: "École Jules Ferry", client: "Mairie de Rennes",
    delai: "2024-03-25", dessinateur: "", statut: "En attente",
    notes: "Bâtiment principal + gymnase",
    plans: [
      { type: "Évacuation", orientation: "Portrait", format: "A3" },
      { type: "Évacuation", orientation: "Portrait", format: "A3" },
    ],
    fichiersPlan: [], logoClient: null,
    messages: [],
  },
];

// ─── Composants utilitaires ───────────────────────────────────────────────────

function Badge({ statut }) {
  const s = STATUT_STYLE[statut] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {statut}
    </span>
  );
}

function TableauPlans({ plans, onChange }) {
  function updatePlan(i, key, val) {
    onChange(plans.map((p, idx) => idx === i ? { ...p, [key]: val } : p));
  }
  function ajouterLigne() {
    // copie la dernière ligne
    const derniere = { ...plans[plans.length - 1] };
    onChange([...plans, derniere]);
  }
  function supprimerLigne(i) {
    onChange(plans.filter((_, idx) => idx !== i));
  }

  const sel = {
    padding: "6px 8px", borderRadius: 6, border: "1px solid #E5E7EB",
    fontSize: 12, width: "100%", background: "#fff",
  };

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
          <button onClick={() => supprimerLigne(i)} disabled={plans.length === 1}
            style={{ border: "none", background: "none", cursor: plans.length === 1 ? "not-allowed" : "pointer", color: "#D1D5DB", fontSize: 15, padding: 0 }}>
            ✕
          </button>
        </div>
      ))}
      <button onClick={ajouterLigne}
        style={{ marginTop: 8, padding: "7px 14px", borderRadius: 6, border: "1px dashed #D1D5DB", background: "transparent", fontSize: 12, color: "#6B7280", cursor: "pointer", width: "100%" }}>
        + Ajouter un plan (copie la ligne précédente)
      </button>
    </div>
  );
}

function ZoneUpload({ label, fichiers, onAjouter, onSupprimer, accept, maxFichiers = 10, unique = false }) {
  const inputRef = useRef();

  function handleFiles(e) {
    const nouveaux = Array.from(e.target.files).map(f => ({
      nom: f.name,
      taille: (f.size / 1024).toFixed(0) + " Ko",
      url: URL.createObjectURL(f),
      type: f.type,
    }));
    if (unique) {
      onAjouter([nouveaux[0]]);
    } else {
      const total = [...fichiers, ...nouveaux].slice(0, maxFichiers);
      onAjouter(total);
    }
    e.target.value = "";
  }

  const isImage = (f) => f.type && f.type.startsWith("image/");

  return (
    <div>
      <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</label>

      {/* Zone drop / clic */}
      <div onClick={() => inputRef.current.click()}
        style={{ border: "1.5px dashed #D1D5DB", borderRadius: 8, padding: "16px", textAlign: "center", cursor: "pointer", background: "#F9FAFB", marginBottom: fichiers.length > 0 ? 10 : 0 }}>
        <div style={{ fontSize: 22, marginBottom: 4 }}>📎</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>
          {unique ? "Cliquer pour choisir un fichier" : `Cliquer pour ajouter des fichiers (max ${maxFichiers})`}
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{accept}</div>
        <input ref={inputRef} type="file" accept={accept} multiple={!unique} style={{ display: "none" }} onChange={handleFiles} />
      </div>

      {/* Aperçu fichiers */}
      {fichiers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {fichiers.map((f, i) => (
            <div key={i} style={{ position: "relative", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
              {isImage(f) ? (
                <img src={f.url} alt={f.nom} style={{ width: 80, height: 80, objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: 80, height: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <span style={{ fontSize: 24 }}>📄</span>
                  <span style={{ fontSize: 9, color: "#6B7280", textAlign: "center", padding: "0 4px", wordBreak: "break-all" }}>{f.nom}</span>
                </div>
              )}
              <div style={{ fontSize: 9, color: "#9CA3AF", textAlign: "center", padding: "3px 4px", borderTop: "1px solid #F3F4F6", background: "#F9FAFB" }}>{f.taille}</div>
              {/* Bouton supprimer */}
              <button onClick={() => onSupprimer(i)}
                style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page Réglages ────────────────────────────────────────────────────────────

function PageReglages({ settings, onSave }) {
  const [local, setLocal]   = useState(settings);
  const [sauve, setSauve]   = useState(false);
  const logoRef             = useRef();

  function handleLogoChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setLocal({ ...local, logoUrl: URL.createObjectURL(f), logoNom: f.name });
  }

  function sauvegarder() {
    onSave(local);
    setSauve(true);
    setTimeout(() => setSauve(false), 2000);
  }

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4 };

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Réglages</h1>

      {/* Infos entreprise */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "#374151" }}>Informations entreprise</div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nom de l'entreprise</label>
          <input type="text" value={local.nomEntreprise} onChange={e => setLocal({ ...local, nomEntreprise: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email de contact</label>
          <input type="email" value={local.email} onChange={e => setLocal({ ...local, email: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 0 }}>
          <label style={labelStyle}>Téléphone</label>
          <input type="text" value={local.telephone} onChange={e => setLocal({ ...local, telephone: e.target.value })} style={inputStyle} />
        </div>
      </div>

      {/* Logo entreprise */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "#374151" }}>Logo de l'entreprise</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 80, height: 80, border: "1px solid #E5E7EB", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#F9FAFB", flexShrink: 0 }}>
            {local.logoUrl
              ? <img src={local.logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <span style={{ fontSize: 11, color: "#9CA3AF" }}>Aucun logo</span>
            }
          </div>
          <div>
            <button onClick={() => logoRef.current.click()}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer", marginBottom: 6, display: "block" }}>
              {local.logoUrl ? "Changer le logo" : "Choisir un logo"}
            </button>
            {local.logoNom && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{local.logoNom}</div>}
            <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoChange} />
          </div>
        </div>
      </div>

      {/* Dessinateurs */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#374151" }}>Dessinateurs</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>Un nom par ligne</div>
        <textarea value={local.dessinateurs.join("\n")}
          onChange={e => setLocal({ ...local, dessinateurs: e.target.value.split("\n").filter(d => d.trim()) })}
          rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <button onClick={sauvegarder}
        style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: sauve ? "#059669" : "#DC2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.3s" }}>
        {sauve ? "✓ Sauvegardé !" : "Sauvegarder les réglages"}
      </button>
    </div>
  );
}

// ─── App principale ───────────────────────────────────────────────────────────

export default function App() {
  const [commandes, setCommandes] = useState(initCommandes);
  const [vue, setVue]             = useState("dashboard");
  const [selected, setSelected]   = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [msgInput, setMsgInput]   = useState("");

  const [settings, setSettings] = useState({
    nomEntreprise: "First Incendie",
    email: "contact@firstincendie.fr",
    telephone: "02 XX XX XX XX",
    logoUrl: null,
    logoNom: null,
    dessinateurs: ["Marc L.", "Thomas R."],
  });

  const formVide = () => ({ batiment: "", client: "", delai: "", dessinateur: "", notes: "", plans: [planVide()], fichiersPlan: [], logoClient: [] });
  const [form, setForm] = useState(formVide());

  const stats = {
    total:   commandes.length,
    enCours: commandes.filter(c => c.statut === "Commencé" || c.statut === "Ébauche déposée").length,
    attente: commandes.filter(c => c.statut === "En attente" || c.statut === "Modification dessinateur").length,
    valides: commandes.filter(c => c.statut === "Validé").length,
  };

  function creerCommande() {
    if (!form.batiment || !form.client) return;
    setCommandes([{
      id: Date.now(),
      ref: "CMD-" + String(commandes.length + 1).padStart(3, "0"),
      batiment: form.batiment, client: form.client, delai: form.delai,
      dessinateur: form.dessinateur, notes: form.notes, plans: form.plans,
      fichiersPlan: form.fichiersPlan, logoClient: form.logoClient,
      statut: "En attente", messages: [],
    }, ...commandes]);
    setShowForm(false);
    setForm(formVide());
  }

  function changerStatut(id, statut) {
    setCommandes(commandes.map(c => c.id === id ? { ...c, statut } : c));
    if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
  }

  function envoyerMessage() {
    if (!msgInput.trim() || !selected) return;
    const msg = { auteur: "Simon", texte: msgInput.trim(), date: "Maintenant" };
    setCommandes(commandes.map(c => c.id === selected.id ? { ...c, messages: [...c.messages, msg] } : c));
    setSelected(prev => ({ ...prev, messages: [...prev.messages, msg] }));
    setMsgInput("");
  }

  const cmdAffichees = vue === "dashboard" ? commandes.slice(0, 5) : commandes;
  const inputStyle   = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle   = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4 };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F9FAFB", color: "#111827" }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px", gap: 4, position: "fixed", height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
          {settings.logoUrl
            ? <img src={settings.logoUrl} alt="logo" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 6 }} />
            : <div style={{ width: 32, height: 32, background: "#DC2626", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "white", fontSize: 16 }}>🔥</span>
              </div>
          }
          <span style={{ fontWeight: 700, fontSize: 14 }}>{settings.nomEntreprise}</span>
        </div>

        {[
          { id: "dashboard", label: "Dashboard",  icon: "📊" },
          { id: "commandes", label: "Commandes",  icon: "📋" },
          { id: "reglages",  label: "Réglages",   icon: "⚙️" },
        ].map(item => (
          <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#FEF2F2" : "transparent", color: vue === item.id ? "#DC2626" : "#6B7280", textAlign: "left" }}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}

        <div style={{ marginTop: "auto", borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", fontSize: 13, color: "#6B7280" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#DC2626" }}>SR</div>
            Simon R. — Admin
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ marginLeft: 220, flex: 1, padding: "32px 32px" }}>

        {/* Page Réglages */}
        {vue === "reglages" && (
          <PageReglages settings={settings} onSave={s => setSettings(s)} />
        )}

        {/* Dashboard + Commandes */}
        {vue !== "reglages" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{vue === "dashboard" ? "Dashboard" : "Toutes les commandes"}</h1>
              <button onClick={() => setShowForm(true)}
                style={{ background: "#DC2626", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Nouvelle commande
              </button>
            </div>

            {/* Stats */}
            {vue === "dashboard" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Total commandes",     val: stats.total,   color: "#111827" },
                  { label: "En cours",            val: stats.enCours, color: "#1D4ED8" },
                  { label: "En attente / modif.", val: stats.attente, color: "#B45309" },
                  { label: "Validés",             val: stats.valides, color: "#059669" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tableau commandes */}
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: selected ? 24 : 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 0.8fr 1fr 1.3fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <span>Bâtiment</span><span>Client</span><span>Plans</span><span>Délai</span><span>Statut</span>
              </div>
              {cmdAffichees.map(c => (
                <div key={c.id} onClick={() => setSelected(c)}
                  style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 0.8fr 1fr 1.3fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#FEF2F2" : "transparent", transition: "background 0.1s" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.batiment}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                  </div>
                  <div style={{ fontSize: 13 }}>{c.client}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai || "—"}</div>
                  <Badge statut={c.statut} />
                </div>
              ))}
            </div>

            {/* Détail commande */}
            {selected && (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.batiment}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.ref}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {[
                    { label: "Client",      val: selected.client },
                    { label: "Dessinateur", val: selected.dessinateur || "Non assigné" },
                    { label: "Délai",       val: selected.delai || "—" },
                    { label: "Nb. plans",   val: selected.plans.length },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div>
                    </div>
                  ))}
                </div>

                {/* Tableau plans lecture */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Détail des plans</div>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "8px 14px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
                      <span>N°</span><span>Type</span><span>Orientation</span><span>Format</span>
                    </div>
                    {selected.plans.map((p, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "9px 14px", borderBottom: i < selected.plans.length - 1 ? "1px solid #F3F4F6" : "none", fontSize: 13 }}>
                        <span style={{ color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</span>
                        <span>{p.type}</span>
                        <span style={{ color: "#6B7280" }}>{p.orientation}</span>
                        <span style={{ color: "#6B7280" }}>{p.format}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fichiers joints */}
                {(selected.fichiersPlan?.length > 0 || selected.logoClient?.length > 0) && (
                  <div style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {selected.fichiersPlan?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Fichiers du plan ({selected.fichiersPlan.length})</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {selected.fichiersPlan.map((f, i) => (
                            <a key={i} href={f.url} target="_blank" rel="noreferrer"
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: 11, color: "#374151", textDecoration: "none" }}>
                              📄 {f.nom}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {selected.logoClient?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Logo client</div>
                        <img src={selected.logoClient[0].url} alt="logo client" style={{ height: 48, objectFit: "contain", border: "1px solid #E5E7EB", borderRadius: 6, padding: 4, background: "#fff" }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Changer statut */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>Changer le statut</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {STATUTS.map(s => (
                      <button key={s} onClick={() => changerStatut(selected.id, s)}
                        style={{ padding: "5px 12px", borderRadius: 100, border: selected.statut === s ? "2px solid #DC2626" : "1px solid #E5E7EB", background: selected.statut === s ? "#FEF2F2" : "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: selected.statut === s ? "#DC2626" : "#6B7280" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {selected.notes && (
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400E", marginBottom: 20 }}>
                    📝 {selected.notes}
                  </div>
                )}

                {/* Messagerie */}
                <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "#374151" }}>Messagerie</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto", marginBottom: 12 }}>
                    {selected.messages.length === 0 && <div style={{ fontSize: 13, color: "#9CA3AF" }}>Aucun message.</div>}
                    {selected.messages.map((m, i) => (
                      <div key={i} style={{ alignSelf: m.auteur === "Simon" ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2, textAlign: m.auteur === "Simon" ? "right" : "left" }}>{m.auteur} · {m.date}</div>
                        <div style={{ background: m.auteur === "Simon" ? "#FEF2F2" : "#F3F4F6", color: m.auteur === "Simon" ? "#7F1D1D" : "#111827", padding: "8px 12px", borderRadius: 10, fontSize: 13 }}>{m.texte}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && envoyerMessage()}
                      placeholder="Écrire un message..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, outline: "none" }} />
                    <button onClick={envoyerMessage}
                      style={{ background: "#DC2626", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Envoyer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal nouvelle commande ── */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 620, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nouvelle commande</h2>
              <button onClick={() => setShowForm(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
            </div>

            {/* Infos générales */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Bâtiment / Référence *</label>
                <input type="text" value={form.batiment} placeholder="Ex: Résidence Les Pins"
                  onChange={e => setForm({ ...form, batiment: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Client *</label>
                <input type="text" value={form.client} placeholder="Nom de la société"
                  onChange={e => setForm({ ...form, client: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Délai souhaité</label>
                <input type="date" value={form.delai} onChange={e => setForm({ ...form, delai: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Dessinateur</label>
                <select value={form.dessinateur} onChange={e => setForm({ ...form, dessinateur: e.target.value })} style={inputStyle}>
                  <option value="">— Assigner plus tard —</option>
                  {settings.dessinateurs.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Tableau des plans */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Plans à réaliser</label>
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px" }}>
                <TableauPlans plans={form.plans} onChange={plans => setForm({ ...form, plans })} />
              </div>
            </div>

            {/* Uploads */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <ZoneUpload
                label="📄 Fichiers du plan"
                fichiers={form.fichiersPlan}
                onAjouter={f => setForm({ ...form, fichiersPlan: f })}
                onSupprimer={i => setForm({ ...form, fichiersPlan: form.fichiersPlan.filter((_, idx) => idx !== i) })}
                accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf"
                maxFichiers={10}
              />
              <ZoneUpload
                label="🏢 Logo du client"
                fichiers={form.logoClient}
                onAjouter={f => setForm({ ...form, logoClient: f })}
                onSupprimer={() => setForm({ ...form, logoClient: [] })}
                accept="image/*"
                unique={true}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={3} placeholder="Informations complémentaires..."
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                {form.plans.length} plan{form.plans.length > 1 ? "s" : ""} · {form.fichiersPlan.length} fichier{form.fichiersPlan.length > 1 ? "s" : ""}
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowForm(false); setForm(formVide()); }}
                  style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>
                  Annuler
                </button>
                <button onClick={creerCommande}
                  style={{ padding: "9px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: !form.batiment || !form.client ? "not-allowed" : "pointer", background: !form.batiment || !form.client ? "#F3F4F6" : "#DC2626", color: !form.batiment || !form.client ? "#9CA3AF" : "#fff" }}>
                  Créer la commande
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
