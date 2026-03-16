import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const STATUTS_ADMIN = ["En attente", "Commencé", "Ébauche déposée", "Modification dessinateur", "Validé"];
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
const planVide = () => ({ type: "Évacuation", orientation: "Paysage", format: "A3" });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateMsg() {
  const now = new Date();
  const d = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const h = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `Le ${d} à ${h}`;
}

function formatDateCourt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateLong(iso) {
  if (!iso) return "—";
  const d = new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const h = new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `Le ${d} à ${h}`;
}

function tempsRestant(delai) {
  if (!delai) return null;
  const diff = Math.ceil((new Date(delai) - new Date()) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return { label: `${Math.abs(diff)}j de retard`, color: "#DC2626", bg: "#FEF2F2" };
  if (diff === 0) return { label: "Aujourd'hui !", color: "#D97706", bg: "#FFFBEB" };
  if (diff <= 3)  return { label: `${diff}j restant${diff > 1 ? "s" : ""}`, color: "#D97706", bg: "#FFFBEB" };
  return { label: `${diff}j restants`, color: "#059669", bg: "#F0FDF4" };
}

function getPeriode(created_at) {
  if (!created_at) return "";
  const d = new Date(created_at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ChampCopiable({ valeur, label, style = {} }) {
  const [copie, setCopie] = useState(false);
  if (!valeur) return null;
  function copier() {
    navigator.clipboard.writeText(valeur).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    });
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, ...style }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{valeur}</span>
      <button onClick={copier} title={`Copier ${label || ""}`}
        style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 5, color: copie ? "#059669" : "#9CA3AF", flexShrink: 0, transition: "color 0.2s" }}>
        {copie ? "✓" : "⎘"}
      </button>
    </div>
  );
}

function BlocAdresse({ commande, copiable = false }) {
  const adresse = [commande.adresse1, commande.adresse2, commande.code_postal, commande.ville].filter(Boolean).join(", ");
  if (!adresse) return null;
  return (
    <div style={{ marginBottom: 16, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 4 }}>📍 Adresse</div>
      {copiable ? (
        <ChampCopiable valeur={adresse} label="l'adresse" />
      ) : (
        <div style={{ fontSize: 13, color: "#374151" }}>{adresse}</div>
      )}
    </div>
  );
}

function fichierAvecDate(f) {
  return { ...f, ajouteLe: f.ajouteLe || formatDateMsg() };
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function Badge({ statut }) {
  const s = STATUT_STYLE[statut] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <div><span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" }}>{statut}</span></div>
  );
}

function TableauPlans({ plans, onChange }) {
  function updatePlan(i, key, val) { onChange(plans.map((p, idx) => idx === i ? { ...p, [key]: val } : p)); }
  function ajouterLigne()          { onChange([...plans, { ...plans[plans.length - 1] }]); }
  function supprimerLigne(i)       { onChange(plans.filter((_, idx) => idx !== i)); }
  const sel = { padding: "6px 8px", borderRadius: 6, border: "1px solid #E5E7EB", fontSize: 12, width: "100%", background: "#fff" };
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
          <button onClick={() => supprimerLigne(i)} disabled={i === 0}
            style={{ border: "none", background: "none", cursor: i === 0 ? "not-allowed" : "pointer", color: i === 0 ? "transparent" : "#D1D5DB", fontSize: 15, padding: 0 }}>✕</button>
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
    const nouveaux = Array.from(e.target.files).map(f => fichierAvecDate({
      nom: f.name, taille: (f.size / 1024).toFixed(0) + " Ko",
      url: URL.createObjectURL(f), type: f.type,
    }));
    if (unique) { onAjouter([nouveaux[0]]); }
    else        { onAjouter([...fichiers, ...nouveaux].slice(0, maxFichiers)); }
    e.target.value = "";
  }
  const isImage = (f) => f.type && f.type.startsWith("image/");
  return (
    <div>
      {label ? <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</label> : null}
      <div onClick={() => inputRef.current.click()}
        style={{ border: "1.5px dashed #D1D5DB", borderRadius: 8, padding: "14px", textAlign: "center", cursor: "pointer", background: "#F9FAFB", marginBottom: fichiers.length > 0 ? 10 : 0 }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}>📎</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{unique ? "Cliquer pour choisir" : `Ajouter fichiers (max ${maxFichiers})`}</div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{accept}</div>
        <input ref={inputRef} type="file" accept={accept} multiple={!unique} style={{ display: "none" }} onChange={handleFiles} />
      </div>
      {fichiers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {fichiers.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}>
              <span style={{ fontSize: 18 }}>{isImage(f) ? "🖼️" : "📄"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nom}</a>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{f.taille} · {f.ajouteLe || "—"}</div>
              </div>
              <button onClick={() => onSupprimer(i)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 14, padding: 0, flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Visionneuse fichier universelle (image + PDF) ───────────────────────────

function VisuFichier({ fichier, onClose }) {
  if (!fichier) return null;
  const isPdf   = fichier.type === "application/pdf" || fichier.nom?.toLowerCase().endsWith(".pdf");
  const isImage = fichier.type && fichier.type.startsWith("image/");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: isPdf ? "85vw" : "auto", height: isPdf ? "88vh" : "auto", display: "flex", flexDirection: "column", borderRadius: 10, overflow: "hidden", background: "#1E293B" }}>
        {/* Barre du haut */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#0F172A" }}>
          <span style={{ fontSize: 13, color: "#E2E8F0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
            {isPdf ? "📄" : "🖼️"} {fichier.nom}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <a href={fichier.url} download={fichier.nom}
              style={{ padding: "5px 14px", borderRadius: 6, background: "#2563EB", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              ⬇ Télécharger
            </a>
            <button onClick={onClose}
              style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#334155", color: "#E2E8F0", fontSize: 14, cursor: "pointer" }}>✕</button>
          </div>
        </div>
        {/* Contenu */}
        {isPdf && (
          <iframe src={fichier.url} title={fichier.nom} style={{ flex: 1, width: "100%", border: "none" }} />
        )}
        {isImage && (
          <img src={fichier.url} alt={fichier.nom} style={{ maxWidth: "88vw", maxHeight: "80vh", objectFit: "contain" }} />
        )}
        {!isPdf && !isImage && (
          <div style={{ padding: 32, color: "#94A3B8", fontSize: 14, textAlign: "center" }}>
            Aperçu non disponible pour ce type de fichier.<br />
            <a href={fichier.url} download={fichier.nom} style={{ color: "#60A5FA", marginTop: 12, display: "inline-block" }}>⬇ Télécharger directement</a>
          </div>
        )}
      </div>
    </div>
  );
}

function LogoCliquable({ fichier }) {
  const [visu, setVisu] = useState(false);
  if (!fichier) return null;
  const isImage = fichier.type && fichier.type.startsWith("image/");
  return (
    <>
      <div style={{ display: "inline-block", cursor: "pointer" }} onClick={() => setVisu(true)}>
        {isImage
          ? <img src={fichier.url} alt="logo" style={{ height: 56, maxWidth: 140, objectFit: "contain", border: "1px solid #E5E7EB", borderRadius: 8, padding: 6, background: "#fff" }} />
          : <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 12, color: "#374151" }}>📄 {fichier.nom}</div>
        }
      </div>
      {visu && <VisuFichier fichier={fichier} onClose={() => setVisu(false)} />}
    </>
  );
}

// ─── Liste de fichiers avec visionneuse ──────────────────────────────────────

function ListeFichiers({ fichiers, couleurAccent = "#1D4ED8" }) {
  const [visuFichier, setVisuFichier] = useState(null);
  if (!fichiers || fichiers.length === 0) return null;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {fichiers.map((f, i) => {
          const isPdf   = f.type === "application/pdf" || f.nom?.toLowerCase().endsWith(".pdf");
          const isImage = f.type && f.type.startsWith("image/");
          const peutApercu = isPdf || isImage;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}>
              <span style={{ fontSize: 18 }}>{isImage ? "🖼️" : "📄"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nom}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{f.taille}{f.ajouteLe ? ` · ${f.ajouteLe}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {peutApercu && (
                  <button onClick={() => setVisuFichier(f)}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    👁 Aperçu
                  </button>
                )}
                <a href={f.url} download={f.nom}
                  style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${couleurAccent}20`, background: `${couleurAccent}10`, color: couleurAccent, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                  ⬇
                </a>
              </div>
            </div>
          );
        })}
      </div>
      {visuFichier && <VisuFichier fichier={visuFichier} onClose={() => setVisuFichier(null)} />}
    </>
  );
}

function HistoriqueVersions({ versions }) {
  const [showOld, setShowOld] = useState(false);
  if (!versions || versions.length === 0) return null;
  const sorted     = [...versions].sort((a, b) => b.numero - a.numero);
  const derniere   = sorted[0];
  const anciennes  = sorted.slice(1);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 10 }}>
        📁 Versions déposées ({versions.length})
      </div>

      {/* Dernière version — mise en avant */}
      <div style={{ border: "1.5px solid #DDD6FE", borderRadius: 10, padding: "12px 16px", background: "#F5F3FF", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ background: "#7C3AED", color: "#fff", padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>v{derniere.numero}</span>
            <span style={{ fontSize: 12, color: "#5B21B6", fontWeight: 600 }}>Dernière version</span>
          </div>
          <div style={{ fontSize: 11, color: "#7C3AED" }}>{formatDateLong(derniere.created_at)}</div>
        </div>
        <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 8 }}>Déposée par {derniere.deposee_par}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {(derniere.fichiers || []).map((f, j) => (
            <a key={j} href={f.url} target="_blank" rel="noreferrer" download={f.nom}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: "1px solid #DDD6FE", background: "#fff", fontSize: 11, color: "#5B21B6", textDecoration: "none" }}>
              📄 {f.nom} <span style={{ color: "#9CA3AF" }}>⬇</span>
            </a>
          ))}
        </div>
      </div>

      {/* Anciennes versions — repliées */}
      {anciennes.length > 0 && (
        <>
          <button onClick={() => setShowOld(!showOld)}
            style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontWeight: 600 }}>
            {showOld ? "▲ Masquer les anciennes versions" : `▼ Voir les ${anciennes.length} ancienne${anciennes.length > 1 ? "s" : ""} version${anciennes.length > 1 ? "s" : ""}`}
          </button>
          {showOld && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {anciennes.map(v => (
                <div key={v.id} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", background: "#FAFAFA", opacity: 0.75 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ background: "#E5E7EB", color: "#6B7280", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>v{v.numero}</span>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{formatDateLong(v.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>Déposée par {v.deposee_par}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(v.fichiers || []).map((f, j) => (
                      <a key={j} href={f.url} target="_blank" rel="noreferrer" download={f.nom}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#fff", fontSize: 11, color: "#6B7280", textDecoration: "none" }}>
                        📄 {f.nom} <span style={{ color: "#9CA3AF" }}>⬇</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Filtres + tri ────────────────────────────────────────────────────────────

function BarreFiltres({ commandes, filtres, setFiltres, tri, setTri, dessinateurs, showDessinateur = true }) {
  const periodes    = [...new Set(commandes.map(c => getPeriode(c.created_at)).filter(Boolean))].sort().reverse();
  const typesDispos = [...new Set(commandes.flatMap(c => (c.plans || []).map(p => p.type)).filter(Boolean))];
  const clients     = [...new Set(commandes.map(c => c.client).filter(Boolean))].sort();
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
            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E5E7EB", fontSize: 11, fontWeight: 600, cursor: "pointer", background: tri.col === col ? "#EFF6FF" : "#fff", color: tri.col === col ? "#1D4ED8" : "#6B7280" }}>
            {label}{tri.col === col ? (tri.dir === "asc" ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function appliquerFiltresTri(commandes, filtres, tri) {
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

// ─── Page Réglages ────────────────────────────────────────────────────────────

function PageReglages({ settings, onSave }) {
  const [local, setLocal] = useState(settings);
  const [sauve, setSauve] = useState(false);
  const logoRef = useRef();
  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4 };
  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Réglages</h1>
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Informations entreprise</div>
        {[
          { label: "Nom de l'entreprise", key: "nomEntreprise", type: "text" },
          { label: "Email de contact",    key: "email",         type: "email" },
          { label: "Téléphone",           key: "telephone",     type: "text" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{f.label}</label>
            <input type={f.type} value={local[f.key]} onChange={e => setLocal({ ...local, [f.key]: e.target.value })} style={inputStyle} />
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Logo de l'entreprise</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 80, height: 80, border: "1px solid #E5E7EB", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#F9FAFB", flexShrink: 0 }}>
            {local.logoUrl ? <img src={local.logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 11, color: "#9CA3AF" }}>Aucun logo</span>}
          </div>
          <div>
            <button onClick={() => logoRef.current.click()}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer", marginBottom: 6, display: "block" }}>
              {local.logoUrl ? "Changer le logo" : "Choisir un logo"}
            </button>
            {local.logoNom && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{local.logoNom}</div>}
            <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
              const f = e.target.files[0];
              if (f) setLocal({ ...local, logoUrl: URL.createObjectURL(f), logoNom: f.name });
            }} />
          </div>
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Dessinateurs</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>Un nom par ligne</div>
        <textarea value={local.dessinateurs.join("\n")} onChange={e => setLocal({ ...local, dessinateurs: e.target.value.split("\n").filter(d => d.trim()) })} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      </div>
      <button onClick={() => { onSave(local); setSauve(true); setTimeout(() => setSauve(false), 2000); }}
        style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: sauve ? "#059669" : "#DC2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.3s" }}>
        {sauve ? "✓ Sauvegardé !" : "Sauvegarder les réglages"}
      </button>
    </div>
  );
}

// ─── Filtre anti-coordonnées ──────────────────────────────────────────────────

const PATTERNS_CONTACTS = [
  // Email complet
  { regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, label: "adresse email" },
  // Téléphone FR format complet : 06 12 34 56 78 / +33612345678 / 0612345678
  { regex: /(\+33|0033)[\s.\-]?[1-9]([\s.\-]?\d{2}){4}/g,        label: "numéro de téléphone" },
  { regex: /\b0[1-9]([\s.\-]?\d{2}){4}\b/g,                       label: "numéro de téléphone" },
  // URL avec protocole ou www
  { regex: /(https?:\/\/|www\.)\S+/gi,                             label: "lien web" },
  // Domaine explicite avec extension
  { regex: /\b[a-zA-Z0-9\-]{2,}\.(fr|com|net|org|io|co|eu|pro|biz)\b/gi, label: "nom de domaine" },
  // Réseaux sociaux
  { regex: /\b(instagram|facebook|linkedin|twitter|tiktok|whatsapp|telegram|signal|skype|discord|snapchat|messenger)\b/gi, label: "contact externe" },
];

function analyserMessage(texte) {
  for (const { regex, label } of PATTERNS_CONTACTS) {
    regex.lastIndex = 0;
    if (regex.test(texte)) return label;
  }
  return null;
}

// ─── Messagerie ───────────────────────────────────────────────────────────────

function Messagerie({ selected, msgInput, setMsgInput, onEnvoyer, auteurActif, allowFichier = false }) {
  const [fichierMsg, setFichierMsg]   = useState([]);
  const [alerte, setAlerte]           = useState(null);
  const inputRef = useRef();

  async function handleEnvoyer() {
    if (!msgInput.trim() && fichierMsg.length === 0) return;

    // Filtre regex — sauf pour Simon (admin)
    if (auteurActif !== "Simon") {
      const detection = analyserMessage(msgInput);
      if (detection) {
        setAlerte(`⛔ Message bloqué : ${detection} détecté(e). Le partage de coordonnées personnelles est interdit sur cette plateforme.`);
        setTimeout(() => setAlerte(null), 5000);
        // Enregistrement de l'alerte en base pour notification admin
        await supabase.from("alertes").insert([{
          commande_id: selected.id,
          auteur: auteurActif,
          message_bloque: msgInput,
          type_detection: detection,
        }]);
        return;
      }
    }

    setAlerte(null);
    await onEnvoyer(msgInput, fichierMsg);
    setMsgInput("");
    setFichierMsg([]);
  }

  return (
    <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "#374151" }}>Messagerie</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", marginBottom: 12 }}>
        {selected.messages.length === 0 && <div style={{ fontSize: 13, color: "#9CA3AF" }}>Aucun message.</div>}
        {selected.messages.map((m, i) => {
          const moi = m.auteur === auteurActif;
          return (
            <div key={i} style={{ alignSelf: moi ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2, textAlign: moi ? "right" : "left" }}>{m.auteur} · {m.date}</div>
              <div style={{ background: moi ? "#FEF2F2" : "#F3F4F6", color: moi ? "#7F1D1D" : "#111827", padding: "8px 12px", borderRadius: 10, fontSize: 13 }}>
                {m.texte}
                {m.fichiers && m.fichiers.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {m.fichiers.map((f, j) => (
                      <a key={j} href={f.url} target="_blank" rel="noreferrer" download={f.nom}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, border: `1px solid ${moi ? "#FECACA" : "#E5E7EB"}`, background: "#fff", fontSize: 11, color: moi ? "#DC2626" : "#374151", textDecoration: "none" }}>
                        📎 {f.nom} ⬇
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {allowFichier && fichierMsg.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {fichierMsg.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: 11, color: "#374151" }}>
              📎 {f.nom}
              <button onClick={() => setFichierMsg(fichierMsg.filter((_, idx) => idx !== i))} style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 12, padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      {alerte && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#DC2626", fontWeight: 500 }}>
          {alerte}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        {allowFichier && (
          <>
            <button onClick={() => inputRef.current.click()}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 16, cursor: "pointer", flexShrink: 0 }} title="Joindre un fichier">
              📎
            </button>
            <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.pdf" multiple style={{ display: "none" }}
              onChange={e => {
                const nouveaux = Array.from(e.target.files).map(f => fichierAvecDate({ nom: f.name, taille: (f.size / 1024).toFixed(0) + " Ko", url: URL.createObjectURL(f), type: f.type }));
                setFichierMsg(prev => [...prev, ...nouveaux].slice(0, 5));
                e.target.value = "";
              }} />
          </>
        )}
        <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleEnvoyer()}
          placeholder="Écrire un message..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, outline: "none" }} />
        <button onClick={handleEnvoyer}
          style={{ background: auteurActif === "Simon" ? "#DC2626" : "#2563EB", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          Envoyer
        </button>
      </div>
    </div>
  );
}

// ─── Vue Dessinateur ──────────────────────────────────────────────────────────

function VueDessinateur({ commandes, versions, nomDessinateur, onChangerStatut, onEnvoyerMessage, onDeposerVersion }) {
  const [selected, setSelected]                 = useState(null);
  const [msgInput, setMsgInput]                 = useState("");
  const [fichiersNouveaux, setFichiersNouveaux] = useState([]);
  const [deposant, setDeposant]                 = useState(false);
  const [filtres, setFiltres]                   = useState({ statut: "", type: "", periode: "", client: "", dessinateur: "" });
  const [tri, setTri]                           = useState({ col: "created_at", dir: "desc" });

  const toutes       = commandes.filter(c => c.dessinateur === nomDessinateur);
  const mesMissions  = toutes.filter(c => c.statut !== "Validé");
  const mesTerminees = toutes.filter(c => c.statut === "Validé");
  const missionsFiltrees = appliquerFiltresTri(mesMissions, { ...filtres, dessinateur: "" }, tri);

  useEffect(() => {
    if (selected) {
      const updated = commandes.find(c => c.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [commandes]); // eslint-disable-line

  async function handleDeposer() {
    if (!fichiersNouveaux.length || !selected) return;
    setDeposant(true);
    const mesVersions = versions.filter(v => v.commande_id === selected.id);
    await onDeposerVersion(selected.id, fichiersNouveaux, mesVersions.length + 1, nomDessinateur);
    await onChangerStatut(selected.id, "Ébauche déposée");
    setFichiersNouveaux([]);
    setDeposant(false);
  }

  const versionsCommande = selected ? versions.filter(v => v.commande_id === selected.id) : [];

  function InfosDetail({ c }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Client",        val: <ChampCopiable valeur={c.client} label="le client" /> },
          { label: "Créé le",       val: formatDateCourt(c.created_at) },
          { label: "Délai",         val: c.delai ? formatDateCourt(c.delai) : "—" },
          { label: "Temps restant", val: tempsRestant(c.delai) ? <span style={{ background: tempsRestant(c.delai).bg, color: tempsRestant(c.delai).color, padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>{tempsRestant(c.delai).label}</span> : "—" },
        ].map(f => <div key={f.label}><div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div></div>)}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F9FAFB", color: "#111827" }}>
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px", gap: 4, position: "fixed", top: 44, height: "calc(100vh - 44px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
          <div style={{ width: 32, height: 32, background: "#2563EB", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontSize: 16 }}>✏️</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Espace dessinateur</span>
        </div>
        <div style={{ padding: "8px 12px", background: "#EFF6FF", borderRadius: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "#93C5FD", marginBottom: 2 }}>Connecté en tant que</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1D4ED8" }}>{nomDessinateur}</div>
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", padding: "8px 12px" }}>
          {mesMissions.length} mission{mesMissions.length > 1 ? "s" : ""} en cours
        </div>
        <div style={{ marginTop: "auto", borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
          <div style={{ padding: "8px 12px", fontSize: 11, color: "#9CA3AF" }}>Mode test — vue dessinateur</div>
        </div>
      </div>

      <div style={{ marginLeft: 220, flex: 1, padding: "32px 32px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Mes missions</h1>

        <BarreFiltres commandes={mesMissions} filtres={filtres} setFiltres={setFiltres} tri={tri} setTri={setTri} dessinateurs={[]} showDessinateur={false} />

        {missionsFiltrees.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Aucune mission à afficher.</div>
        )}

        {missionsFiltrees.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span>Bâtiment</span><span>Client</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Temps restant</span><span>Statut</span>
            </div>
            {missionsFiltrees.map(c => {
              const tr = tempsRestant(c.delai);
              return (
                <div key={c.id} onClick={() => { setSelected(c); setFichiersNouveaux([]); }}
                  style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EFF6FF" : "transparent", transition: "background 0.1s" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.batiment || c.client}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{c.client}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                  <div>{tr && <span style={{ background: tr.bg, color: tr.color, padding: "3px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>{tr.label}</span>}</div>
                  <Badge statut={c.statut} />
                </div>
              );
            })}
          </div>
        )}

        {selected && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.batiment || selected.client}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>{selected.ref} · {selected.client}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge statut={selected.statut} />
                <button onClick={() => { setSelected(null); setFichiersNouveaux([]); }} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
              </div>
            </div>

            {/* EN ATTENTE */}
            {selected.statut === "En attente" && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nouvelle mission disponible</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>Client : <strong>{selected.client}</strong></div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>{selected.plans.length} plan{selected.plans.length > 1 ? "s" : ""} à réaliser</div>
                {tempsRestant(selected.delai) && (
                  <div style={{ marginBottom: 24 }}>
                    <span style={{ background: tempsRestant(selected.delai).bg, color: tempsRestant(selected.delai).color, padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600 }}>
                      {tempsRestant(selected.delai).label}
                    </span>
                  </div>
                )}
                <button onClick={() => onChangerStatut(selected.id, "Commencé")}
                  style={{ padding: "12px 36px", borderRadius: 10, border: "none", background: "#2563EB", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  ▶ Commencer la mission
                </button>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 12 }}>Les détails seront visibles après avoir commencé</div>
              </div>
            )}

            {/* COMMENCÉ ou MODIFICATION */}
            {(selected.statut === "Commencé" || selected.statut === "Modification dessinateur") && (
              <>
                {selected.statut === "Modification dessinateur" && (
                  <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#92400E", fontWeight: 500 }}>
                    ⚠️ Modification demandée — déposez une nouvelle version
                  </div>
                )}
                <InfosDetail c={selected} />

                <BlocAdresse commande={selected} copiable={true} />

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Plans à réaliser</div>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "8px 14px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
                      <span>N°</span><span>Type</span><span>Orientation</span><span>Format</span>
                    </div>
                    {selected.plans.map((p, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "9px 14px", borderBottom: i < selected.plans.length - 1 ? "1px solid #F3F4F6" : "none", fontSize: 13 }}>
                        <span style={{ color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</span>
                        <span>{p.type}</span><span style={{ color: "#6B7280" }}>{p.orientation}</span><span style={{ color: "#6B7280" }}>{p.format}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.fichiersPlan?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Fichiers sources</div>
                    <ListeFichiers fichiers={selected.fichiersPlan} couleurAccent="#2563EB" />
                  </div>
                )}

                {selected.logoClient?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Logo client</div>
                    <LogoCliquable fichier={selected.logoClient[0]} />
                  </div>
                )}

                <HistoriqueVersions versions={versionsCommande} />

                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 18, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#065F46", marginBottom: 4 }}>
                    📤 {versionsCommande.length > 0 ? `Déposer la version ${versionsCommande.length + 1}` : "Déposer l'ébauche"}
                  </div>
                  <ZoneUpload label="" fichiers={fichiersNouveaux} onAjouter={f => setFichiersNouveaux(f)} onSupprimer={i => setFichiersNouveaux(fichiersNouveaux.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf,.ai" maxFichiers={20} />
                  {fichiersNouveaux.length > 0 && (
                    <button onClick={handleDeposer} disabled={deposant}
                      style={{ marginTop: 12, padding: "9px 20px", borderRadius: 8, border: "none", background: deposant ? "#9CA3AF" : "#059669", color: "#fff", fontSize: 13, fontWeight: 700, cursor: deposant ? "not-allowed" : "pointer" }}>
                      {deposant ? "Dépôt en cours..." : `✓ Confirmer le dépôt (${fichiersNouveaux.length} fichier${fichiersNouveaux.length > 1 ? "s" : ""})`}
                    </button>
                  )}
                </div>
                <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
                  onEnvoyer={async (texte) => { if (!texte.trim()) return; await onEnvoyerMessage(selected.id, nomDessinateur, texte, []); }}
                  auteurActif={nomDessinateur} />
              </>
            )}

            {/* ÉBAUCHE DÉPOSÉE */}
            {selected.statut === "Ébauche déposée" && (
              <>
                <InfosDetail c={selected} />
                <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6" }}>✅ Ébauche déposée — en attente de retour</div>
                </div>
                <HistoriqueVersions versions={versionsCommande} />
                <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 18, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 10 }}>Redéposer une version corrigée</div>
                  <ZoneUpload label="" fichiers={fichiersNouveaux} onAjouter={f => setFichiersNouveaux(f)} onSupprimer={i => setFichiersNouveaux(fichiersNouveaux.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf,.ai" maxFichiers={20} />
                  {fichiersNouveaux.length > 0 && (
                    <button onClick={handleDeposer} disabled={deposant}
                      style={{ marginTop: 10, padding: "8px 18px", borderRadius: 8, border: "none", background: deposant ? "#9CA3AF" : "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 700, cursor: deposant ? "not-allowed" : "pointer" }}>
                      {deposant ? "Dépôt en cours..." : `↩ Redéposer (${fichiersNouveaux.length} fichier${fichiersNouveaux.length > 1 ? "s" : ""})`}
                    </button>
                  )}
                </div>
                <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
                  onEnvoyer={async (texte) => { if (!texte.trim()) return; await onEnvoyerMessage(selected.id, nomDessinateur, texte, []); }}
                  auteurActif={nomDessinateur} />
              </>
            )}
          </div>
        )}

        {mesTerminees.length > 0 && (
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#9CA3AF", marginBottom: 12 }}>Missions terminées</h2>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
              {mesTerminees.map(c => (
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr", padding: "12px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", opacity: 0.6 }}>
                  <div><div style={{ fontWeight: 600, fontSize: 13 }}>{c.batiment || c.client}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div></div>
                  <div style={{ fontSize: 12 }}>{c.client}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                  <div></div>
                  <Badge statut={c.statut} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App principale ───────────────────────────────────────────────────────────

export default function App() {
  const [commandes, setCommandes]               = useState([]);
  const [versions, setVersions]                 = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [vue, setVue]                           = useState("dashboard");
  const [selected, setSelected]                 = useState(null);
  const [showForm, setShowForm]                 = useState(false);
  const [msgInput, setMsgInput]                 = useState("");
  const [saving, setSaving]                     = useState(false);
  const [modeVue, setModeVue]                   = useState("admin");
  const [dessinateurActif, setDessinateurActif] = useState("");
  const [filtres, setFiltres]                   = useState({ statut: "", dessinateur: "", type: "", periode: "", client: "" });
  const [tri, setTri]                           = useState({ col: "created_at", dir: "desc" });
  const [showModifModal, setShowModifModal]     = useState(false);
  const [modifMsg, setModifMsg]                 = useState("");
  const [modifFichiers, setModifFichiers]       = useState([]);
  const [envoyantModif, setEnvoyantModif]       = useState(false);
  const [showValidModal, setShowValidModal]     = useState(false);
  const [validant, setValidant]                 = useState(false);
  const [showTermineesAdmin, setShowTermineesAdmin] = useState(false);

  const [settings, setSettings] = useState({
    nomEntreprise: "First Incendie", email: "contact@firstincendie.fr",
    telephone: "02 XX XX XX XX", logoUrl: null, logoNom: null,
    dessinateurs: ["Marc L.", "Thomas R."],
  });

  const formVide = () => ({
    client: "", batiment: "", adresse1: "", adresse2: "", code_postal: "", ville: "",
    delai: "", dessinateur: "", notes: "", plans: [planVide()], fichiersPlan: [], logoClient: [],
  });
  const [form, setForm] = useState(formVide());

  useEffect(() => { chargerTout(); }, []);

  async function chargerTout() {
    setLoading(true);
    const [{ data: cmd }, { data: ver }] = await Promise.all([
      supabase.from("commandes").select("*, messages(*)").order("created_at", { ascending: false }),
      supabase.from("versions").select("*").order("numero", { ascending: true }),
    ]);
    if (cmd) setCommandes(cmd.map(c => ({
      ...c,
      plans: c.plans || [], fichiersPlan: c.fichiers_plan || [],
      logoClient: c.logo_client || [], plansFinalises: c.plans_finalises || [],
      messages: (c.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    })));
    if (ver) setVersions(ver);
    setLoading(false);
  }

  async function creerCommande() {
    if (!form.client || !form.dessinateur || !form.delai || form.fichiersPlan.length === 0) return;
    const aujourd_hui = new Date().toISOString().split("T")[0];
    if (form.delai < aujourd_hui) { alert("La date ne peut pas être inférieure à aujourd'hui."); return; }
    setSaving(true);
    const ref = "CMD-" + String(commandes.length + 1).padStart(3, "0");
    const { data, error } = await supabase.from("commandes").insert([{
      ref, client: form.client, batiment: form.batiment, delai: form.delai,
      dessinateur: form.dessinateur, plans: form.plans,
      fichiers_plan: form.fichiersPlan, logo_client: form.logoClient,
      adresse1: form.adresse1, adresse2: form.adresse2,
      code_postal: form.code_postal, ville: form.ville,
      plans_finalises: [], statut: "En attente",
    }]).select("*, messages(*)").single();
    if (!error && data) {
      const nouvelleCommande = { ...data, plans: data.plans || [], fichiersPlan: data.fichiers_plan || [], logoClient: data.logo_client || [], plansFinalises: [], messages: [] };
      // Si des instructions ont été saisies, les envoyer comme premier message
      if (form.notes.trim()) {
        const { data: msg } = await supabase.from("messages").insert([{
          commande_id: data.id, auteur: "Simon", texte: form.notes.trim(), fichiers: [],
          date: formatDateMsg(),
        }]).select().single();
        if (msg) nouvelleCommande.messages = [msg];
      }
      setCommandes(prev => [nouvelleCommande, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
    setForm(formVide());
  }

  async function changerStatut(id, statut) {
    const { error } = await supabase.from("commandes").update({ statut }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
    }
  }

  async function envoyerMessage(commandeId, auteur, texte, fichiers = []) {
    const { data, error } = await supabase.from("messages").insert([{
      commande_id: commandeId, auteur, texte: texte || "", fichiers,
      date: formatDateMsg(),
    }]).select().single();
    if (!error && data) {
      setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, messages: [...c.messages, data] } : c));
      if (selected?.id === commandeId) setSelected(prev => ({ ...prev, messages: [...prev.messages, data] }));
    }
  }

  async function deposerVersion(commandeId, fichiers, numero, deposee_par) {
    const { data, error } = await supabase.from("versions").insert([{ commande_id: commandeId, fichiers, numero, deposee_par }]).select().single();
    if (!error && data) setVersions(prev => [...prev, data]);
  }

  async function envoyerDemandeModification() {
    if (!modifMsg.trim() || !selected) return;
    setEnvoyantModif(true);
    await envoyerMessage(selected.id, "Simon", modifMsg, modifFichiers);
    await changerStatut(selected.id, "Modification dessinateur");
    setModifMsg(""); setModifFichiers([]); setShowModifModal(false); setEnvoyantModif(false);
  }

  async function validerCommande() {
    if (!selected) return;
    setValidant(true);
    await changerStatut(selected.id, "Validé");
    await envoyerMessage(selected.id, "Simon", "✅ Commande validée. Merci pour votre travail !");
    setShowValidModal(false); setValidant(false);
  }

  const stats = {
    total:   commandes.length,
    enCours: commandes.filter(c => c.statut === "Commencé" || c.statut === "Ébauche déposée").length,
    attente: commandes.filter(c => c.statut === "En attente" || c.statut === "Modification dessinateur").length,
    valides: commandes.filter(c => c.statut === "Validé").length,
  };

  const cmdFiltrees  = appliquerFiltresTri(commandes, filtres, tri);
  const cmdAffichees = vue === "dashboard" ? cmdFiltrees.slice(0, 5) : cmdFiltrees;
  const inputStyle   = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle   = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4 };
  const versionsSelected = selected ? versions.filter(v => v.commande_id === selected.id) : [];

  const SwitcherBarre = () => (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "#1E293B", padding: "8px 20px", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, letterSpacing: "0.05em" }}>MODE TEST</span>
      <div style={{ display: "flex", gap: 4, background: "#0F172A", borderRadius: 8, padding: 3 }}>
        <button onClick={() => setModeVue("admin")}
          style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: modeVue === "admin" ? "#DC2626" : "transparent", color: modeVue === "admin" ? "#fff" : "#94A3B8" }}>
          👤 Admin
        </button>
        <button onClick={() => setModeVue("dessinateur")}
          style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: modeVue === "dessinateur" ? "#2563EB" : "transparent", color: modeVue === "dessinateur" ? "#fff" : "#94A3B8" }}>
          ✏️ Dessinateur
        </button>
      </div>
      {modeVue === "dessinateur" && (
        <select value={dessinateurActif} onChange={e => setDessinateurActif(e.target.value)}
          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#E2E8F0", fontSize: 12 }}>
          <option value="">— Choisir un dessinateur —</option>
          {settings.dessinateurs.map(d => <option key={d}>{d}</option>)}
        </select>
      )}
    </div>
  );

  if (modeVue === "dessinateur") {
    return (
      <div>
        <SwitcherBarre />
        <div style={{ paddingTop: 44 }}>
          {!dessinateurActif ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 32 }}>✏️</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Choisissez un dessinateur dans la barre du haut</div>
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>pour simuler son interface</div>
            </div>
          ) : (
            <VueDessinateur commandes={commandes} versions={versions} nomDessinateur={dessinateurActif}
              onChangerStatut={changerStatut} onEnvoyerMessage={envoyerMessage} onDeposerVersion={deposerVersion} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SwitcherBarre />
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F9FAFB", color: "#111827", paddingTop: 44 }}>
        <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px", gap: 4, position: "fixed", top: 44, height: "calc(100vh - 44px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
            {settings.logoUrl ? <img src={settings.logoUrl} alt="logo" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 6 }} />
              : <div style={{ width: 32, height: 32, background: "#DC2626", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "white", fontSize: 16 }}>🔥</span></div>}
            <span style={{ fontWeight: 700, fontSize: 14 }}>{settings.nomEntreprise}</span>
          </div>
          {[{ id: "dashboard", label: "Dashboard", icon: "📊" }, { id: "commandes", label: "Commandes", icon: "📋" }, { id: "reglages", label: "Réglages", icon: "⚙️" }].map(item => (
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

        <div style={{ marginLeft: 220, flex: 1, padding: "32px 32px" }}>
          {vue === "reglages" && <PageReglages settings={settings} onSave={s => setSettings(s)} />}

          {vue !== "reglages" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{vue === "dashboard" ? "Dashboard" : "Toutes les commandes"}</h1>
                <button onClick={() => setShowForm(true)} style={{ background: "#DC2626", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  + Nouvelle commande
                </button>
              </div>

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

              <BarreFiltres commandes={commandes} filtres={filtres} setFiltres={setFiltres} tri={tri} setTri={setTri} dessinateurs={settings.dessinateurs} showDessinateur={true} />

              {loading ? (
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "40px", textAlign: "center", color: "#9CA3AF" }}>Chargement...</div>
              ) : (() => {
                const actives  = cmdAffichees.filter(c => c.statut !== "Validé");
                const terminees = cmdAffichees.filter(c => c.statut === "Validé");

                const EnteteTableau = () => (
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <span>Client</span><span>Bâtiment</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
                  </div>
                );

                const LigneCommande = ({ c }) => {
                  const dernierMsg = c.messages[c.messages.length - 1];
                  const hasNouveauMsg = dernierMsg && dernierMsg.auteur !== "Simon" && selected?.id !== c.id;
                  return (
                    <div onClick={() => setSelected(c)}
                      style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#FEF2F2" : "transparent", transition: "background 0.1s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                            {c.client}
                            {hasNouveauMsg && (
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#DC2626", display: "inline-block", flexShrink: 0 }} title="Nouveau message" />
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{c.batiment || "—"}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                      <Badge statut={c.statut} />
                    </div>
                  );
                };

                return (
                  <>
                    {/* Commandes actives */}
                    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                      <EnteteTableau />
                      {actives.length === 0 && <div style={{ padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande active.</div>}
                      {actives.map(c => <LigneCommande key={c.id} c={c} />)}
                    </div>

                    {/* Commandes terminées — repliables */}
                    {terminees.length > 0 && (
                      <div style={{ marginBottom: selected ? 24 : 0 }}>
                        <button onClick={() => setShowTermineesAdmin(v => !v)}
                          style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
                          {showTermineesAdmin ? "▲ Masquer les commandes validées" : `▼ Voir les ${terminees.length} commande${terminees.length > 1 ? "s" : ""} validée${terminees.length > 1 ? "s" : ""}`}
                        </button>
                        {showTermineesAdmin && (
                          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", opacity: 0.8 }}>
                            <EnteteTableau />
                            {terminees.map(c => <LigneCommande key={c.id} c={c} />)}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              {selected && (
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.client}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.ref}{selected.batiment ? ` · ${selected.batiment}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge statut={selected.statut} />
                      <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                    {[
                      { label: "Client",      val: <ChampCopiable valeur={selected.client} label="le client" /> },
                      { label: "Dessinateur", val: selected.dessinateur || "Non assigné" },
                      { label: "Créé le",     val: formatDateCourt(selected.created_at) },
                      { label: "Délai",       val: selected.delai ? formatDateCourt(selected.delai) : "—" },
                      { label: "Nb. plans",   val: selected.plans.length },
                    ].map(f => <div key={f.label}><div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div></div>)}
                  </div>

                  {/* Adresse */}
                  <BlocAdresse commande={selected} copiable={true} />

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Détail des plans</div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "8px 14px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
                        <span>N°</span><span>Type</span><span>Orientation</span><span>Format</span>
                      </div>
                      {selected.plans.map((p, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "9px 14px", borderBottom: i < selected.plans.length - 1 ? "1px solid #F3F4F6" : "none", fontSize: 13 }}>
                          <span style={{ color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</span>
                          <span>{p.type}</span><span style={{ color: "#6B7280" }}>{p.orientation}</span><span style={{ color: "#6B7280" }}>{p.format}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fichiers sources */}
                  {selected.fichiersPlan?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Fichiers sources ({selected.fichiersPlan.length})</div>
                      <ListeFichiers fichiers={selected.fichiersPlan} couleurAccent="#DC2626" />
                    </div>
                  )}

                  {/* Logo client */}
                  {selected.logoClient?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Logo client</div>
                      <LogoCliquable fichier={selected.logoClient[0]} />
                    </div>
                  )}

                  <HistoriqueVersions versions={versionsSelected} />

                  {/* Boutons action admin */}
                  {selected.statut === "Ébauche déposée" && (
                    <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                      <button onClick={() => setShowModifModal(true)}
                        style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#92400E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        ✏️ Demander une modification
                      </button>
                      <button onClick={() => setShowValidModal(true)}
                        style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        ✅ Valider la commande
                      </button>
                    </div>
                  )}

                  <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
                    onEnvoyer={async (texte, fichiers) => { if (!texte.trim() && (!fichiers || fichiers.length === 0)) return; await envoyerMessage(selected.id, "Simon", texte, fichiers); }}
                    auteurActif="Simon" allowFichier={true} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal demande modification */}
      {showModifModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✏️ Demander une modification</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Le statut passera en "Modification dessinateur".</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 }}>Message *</label>
              <textarea value={modifMsg} onChange={e => setModifMsg(e.target.value)} rows={4} placeholder="Décrivez les modifications..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <ZoneUpload label="📎 Fichiers joints (optionnel)" fichiers={modifFichiers} onAjouter={f => setModifFichiers(f)} onSupprimer={i => setModifFichiers(modifFichiers.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf" maxFichiers={5} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowModifModal(false); setModifMsg(""); setModifFichiers([]); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={envoyerDemandeModification} disabled={!modifMsg.trim() || envoyantModif}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: !modifMsg.trim() ? "#F3F4F6" : "#D97706", color: !modifMsg.trim() ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: !modifMsg.trim() ? "not-allowed" : "pointer" }}>
                {envoyantModif ? "Envoi..." : "Envoyer la demande"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal validation */}
      {showValidModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Confirmer la validation</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{selected?.client}</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 24 }}>Cette action est irréversible. La commande sera clôturée.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowValidModal(false)} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={validerCommande} disabled={validant}
                style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {validant ? "Validation..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nouvelle commande */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 640, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nouvelle commande</h2>
              <button onClick={() => setShowForm(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
            </div>

            {/* Client en premier */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={labelStyle}>Client *</label><input type="text" value={form.client} placeholder="Nom de la société" onChange={e => setForm({ ...form, client: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Bâtiment / Référence</label><input type="text" value={form.batiment} placeholder="Ex: Résidence Les Pins" onChange={e => setForm({ ...form, batiment: e.target.value })} style={inputStyle} /></div>
            </div>

            {/* Adresse */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Adresse</label>
              <input type="text" value={form.adresse1} placeholder="Adresse ligne 1" onChange={e => setForm({ ...form, adresse1: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
              <input type="text" value={form.adresse2} placeholder="Complément d'adresse" onChange={e => setForm({ ...form, adresse2: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                <input type="text" value={form.code_postal} placeholder="Code postal" onChange={e => setForm({ ...form, code_postal: e.target.value })} style={inputStyle} />
                <input type="text" value={form.ville} placeholder="Ville" onChange={e => setForm({ ...form, ville: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Délai souhaité *</label>
                <input type="date" value={form.delai} min={new Date().toISOString().split("T")[0]} onChange={e => setForm({ ...form, delai: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Dessinateur *</label>
                <select value={form.dessinateur} onChange={e => setForm({ ...form, dessinateur: e.target.value })} style={inputStyle}>
                  <option value="">— Choisir un dessinateur —</option>
                  {settings.dessinateurs.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Plans à réaliser</label>
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px" }}>
                <TableauPlans plans={form.plans} onChange={plans => setForm({ ...form, plans })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <ZoneUpload label="📄 Fichiers du plan *" fichiers={form.fichiersPlan} onAjouter={f => setForm({ ...form, fichiersPlan: f })} onSupprimer={i => setForm({ ...form, fichiersPlan: form.fichiersPlan.filter((_, idx) => idx !== i) })} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf" maxFichiers={10} />
              <ZoneUpload label="🏢 Logo du client" fichiers={form.logoClient} onAjouter={f => setForm({ ...form, logoClient: f })} onSupprimer={() => setForm({ ...form, logoClient: [] })} accept="image/*" unique={true} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Instructions pour le dessinateur</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Ce message sera envoyé automatiquement dans le chat de la commande..." style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            {(() => {
              const manque = [];
              if (!form.client)      manque.push("client");
              if (!form.dessinateur) manque.push("dessinateur");
              if (!form.delai)       manque.push("délai");
              else if (form.delai < new Date().toISOString().split("T")[0]) manque.push("délai invalide");
              if (form.fichiersPlan.length === 0) manque.push("1 fichier minimum");
              const ok = manque.length === 0;
              return (
                <div>
                  {!ok && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>Champs manquants : {manque.join(", ")}</div>}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button onClick={() => { setShowForm(false); setForm(formVide()); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
                    <button onClick={creerCommande} disabled={saving || !ok}
                      style={{ padding: "9px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: !ok ? "not-allowed" : "pointer", background: !ok ? "#F3F4F6" : "#DC2626", color: !ok ? "#9CA3AF" : "#fff" }}>
                      {saving ? "Enregistrement..." : "Créer la commande"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}