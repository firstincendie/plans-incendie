import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const STATUTS_ADMIN       = ["En attente", "Commencé", "Ébauche déposée", "Modification dessinateur", "Validé"];
const STATUTS_DESSINATEUR = ["Commencé", "Ébauche déposée"];

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

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function Badge({ statut }) {
  const s = STATUT_STYLE[statut] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {statut}
    </span>
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
          <button onClick={() => supprimerLigne(i)} disabled={plans.length === 1}
            style={{ border: "none", background: "none", cursor: plans.length === 1 ? "not-allowed" : "pointer", color: "#D1D5DB", fontSize: 15, padding: 0 }}>✕</button>
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
      <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</label>
      <div onClick={() => inputRef.current.click()}
        style={{ border: "1.5px dashed #D1D5DB", borderRadius: 8, padding: "16px", textAlign: "center", cursor: "pointer", background: "#F9FAFB", marginBottom: fichiers.length > 0 ? 10 : 0 }}>
        <div style={{ fontSize: 22, marginBottom: 4 }}>📎</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{unique ? "Cliquer pour choisir un fichier" : `Cliquer pour ajouter (max ${maxFichiers})`}</div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{accept}</div>
        <input ref={inputRef} type="file" accept={accept} multiple={!unique} style={{ display: "none" }} onChange={handleFiles} />
      </div>
      {fichiers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {fichiers.map((f, i) => (
            <div key={i} style={{ position: "relative", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
              {isImage(f)
                ? <img src={f.url} alt={f.nom} style={{ width: 80, height: 80, objectFit: "cover", display: "block" }} />
                : <div style={{ width: 80, height: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span style={{ fontSize: 24 }}>📄</span>
                    <span style={{ fontSize: 9, color: "#6B7280", textAlign: "center", padding: "0 4px", wordBreak: "break-all" }}>{f.nom}</span>
                  </div>
              }
              <div style={{ fontSize: 9, color: "#9CA3AF", textAlign: "center", padding: "3px 4px", borderTop: "1px solid #F3F4F6", background: "#F9FAFB" }}>{f.taille}</div>
              <button onClick={() => onSupprimer(i)}
                style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page Réglages ────────────────────────────────────────────────────────────

function PageReglages({ settings, onSave }) {
  const [local, setLocal] = useState(settings);
  const [sauve, setSauve] = useState(false);
  const logoRef = useRef();
  function handleLogoChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setLocal({ ...local, logoUrl: URL.createObjectURL(f), logoNom: f.name });
  }
  function sauvegarder() { onSave(local); setSauve(true); setTimeout(() => setSauve(false), 2000); }
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
            <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoChange} />
          </div>
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Dessinateurs</div>
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

// ─── Vue Dessinateur ──────────────────────────────────────────────────────────

function VueDessinateur({ commandes, nomDessinateur, onChangerStatut, onEnvoyerMessage, onUploaderPlansFinalises }) {
  const [selected, setSelected] = useState(null);
  const [msgInput, setMsgInput] = useState("");
  const [fichiersFinaux, setFichiersFinaux] = useState([]);

  const mesMissions = commandes.filter(c =>
    c.dessinateur === nomDessinateur && c.statut !== "Validé"
  );
  const mesTerminees = commandes.filter(c =>
    c.dessinateur === nomDessinateur && c.statut === "Validé"
  );

  async function handleEnvoyer() {
    if (!msgInput.trim() || !selected) return;
    await onEnvoyerMessage(selected.id, nomDessinateur, msgInput.trim());
    setSelected(prev => ({
      ...prev,
      messages: [...prev.messages, { auteur: nomDessinateur, texte: msgInput.trim(), date: "Maintenant" }]
    }));
    setMsgInput("");
  }

  async function handleUploadFinalises() {
    if (!fichiersFinaux.length || !selected) return;
    await onUploaderPlansFinalises(selected.id, fichiersFinaux);
    setFichiersFinaux([]);
    alert("Plans déposés avec succès !");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F9FAFB", color: "#111827" }}>

      {/* Sidebar dessinateur */}
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px", gap: 4, position: "fixed", height: "100vh" }}>
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
        <div style={{ fontSize: 11, color: "#9CA3AF", padding: "8px 12px", marginTop: 8 }}>
          {mesMissions.length} mission{mesMissions.length > 1 ? "s" : ""} en cours
        </div>
        <div style={{ marginTop: "auto", borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
          <div style={{ padding: "8px 12px", fontSize: 12, color: "#9CA3AF" }}>
            Mode test — vue dessinateur
          </div>
        </div>
      </div>

      {/* Main dessinateur */}
      <div style={{ marginLeft: 220, flex: 1, padding: "32px 32px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Mes missions</h1>

        {mesMissions.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
            Aucune mission assignée pour l'instant.
          </div>
        )}

        {/* Liste des missions */}
        {mesMissions.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 0.8fr 1fr 1.3fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span>Bâtiment</span><span>Client</span><span>Plans</span><span>Délai</span><span>Statut</span>
            </div>
            {mesMissions.map(c => (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 0.8fr 1fr 1.3fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EFF6FF" : "transparent", transition: "background 0.1s" }}>
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
        )}

        {/* Détail mission dessinateur */}
        {selected && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.batiment}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.ref} · {selected.client}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
            </div>

            {/* Infos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
              {[
                { label: "Délai",     val: selected.delai || "—" },
                { label: "Nb. plans", val: selected.plans.length },
                { label: "Statut",    val: <Badge statut={selected.statut} /> },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div>
                </div>
              ))}
            </div>

            {/* Tableau plans */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Plans à réaliser</div>
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

            {/* Fichiers source fournis par admin */}
            {selected.fichiersPlan?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Fichiers sources</div>
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

            {/* Logo client */}
            {selected.logoClient?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Logo client</div>
                <img src={selected.logoClient[0].url} alt="logo client" style={{ height: 48, objectFit: "contain", border: "1px solid #E5E7EB", borderRadius: 6, padding: 4, background: "#fff" }} />
              </div>
            )}

            {/* Changer statut (limité) */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>Mettre à jour le statut</div>
              <div style={{ display: "flex", gap: 6 }}>
                {STATUTS_DESSINATEUR.map(s => (
                  <button key={s} onClick={() => { onChangerStatut(selected.id, s); setSelected(prev => ({ ...prev, statut: s })); }}
                    style={{ padding: "7px 16px", borderRadius: 100, border: selected.statut === s ? "2px solid #2563EB" : "1px solid #E5E7EB", background: selected.statut === s ? "#EFF6FF" : "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: selected.statut === s ? "#1D4ED8" : "#6B7280" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload plans finalisés */}
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#065F46", marginBottom: 10 }}>📤 Déposer les plans finalisés</div>
              <ZoneUpload
                label=""
                fichiers={fichiersFinaux}
                onAjouter={f => setFichiersFinaux(f)}
                onSupprimer={i => setFichiersFinaux(fichiersFinaux.filter((_, idx) => idx !== i))}
                accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf,.ai"
                maxFichiers={20}
              />
              {fichiersFinaux.length > 0 && (
                <button onClick={handleUploadFinalises}
                  style={{ marginTop: 12, padding: "8px 18px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Confirmer le dépôt ({fichiersFinaux.length} fichier{fichiersFinaux.length > 1 ? "s" : ""})
                </button>
              )}
            </div>

            {/* Messagerie */}
            <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "#374151" }}>Messagerie</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto", marginBottom: 12 }}>
                {selected.messages.length === 0 && <div style={{ fontSize: 13, color: "#9CA3AF" }}>Aucun message.</div>}
                {selected.messages.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.auteur === nomDessinateur ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2, textAlign: m.auteur === nomDessinateur ? "right" : "left" }}>{m.auteur} · {m.date}</div>
                    <div style={{ background: m.auteur === nomDessinateur ? "#EFF6FF" : "#F3F4F6", color: m.auteur === nomDessinateur ? "#1E3A5F" : "#111827", padding: "8px 12px", borderRadius: 10, fontSize: 13 }}>{m.texte}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleEnvoyer()}
                  placeholder="Écrire un message..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, outline: "none" }} />
                <button onClick={handleEnvoyer}
                  style={{ background: "#2563EB", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Missions terminées */}
        {mesTerminees.length > 0 && (
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#9CA3AF", marginBottom: 12 }}>Missions terminées</h2>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
              {mesTerminees.map(c => (
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 0.8fr 1fr 1.3fr", padding: "12px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", opacity: 0.6 }}>
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
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App principale ───────────────────────────────────────────────────────────

export default function App() {
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [vue, setVue]             = useState("dashboard");
  const [selected, setSelected]   = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [msgInput, setMsgInput]   = useState("");
  const [saving, setSaving]       = useState(false);

  // Switcher Admin / Dessinateur
  const [modeVue, setModeVue]               = useState("admin"); // "admin" | "dessinateur"
  const [dessinateurActif, setDessinateurActif] = useState("");

  const [settings, setSettings] = useState({
    nomEntreprise: "First Incendie",
    email: "contact@firstincendie.fr",
    telephone: "02 XX XX XX XX",
    logoUrl: null, logoNom: null,
    dessinateurs: ["Marc L.", "Thomas R."],
  });

  const formVide = () => ({ batiment: "", client: "", delai: "", dessinateur: "", notes: "", plans: [planVide()], fichiersPlan: [], logoClient: [] });
  const [form, setForm] = useState(formVide());

  useEffect(() => { chargerCommandes(); }, []);

  async function chargerCommandes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("commandes")
      .select("*, messages(*)")
      .order("created_at", { ascending: false });
    if (error) { console.error("Erreur chargement:", error); }
    else {
      setCommandes(data.map(c => ({
        ...c,
        plans: c.plans || [],
        fichiersPlan: c.fichiers_plan || [],
        logoClient: c.logo_client || [],
        messages: (c.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      })));
    }
    setLoading(false);
  }

  async function creerCommande() {
    if (!form.batiment || !form.client) return;
    setSaving(true);
    const ref = "CMD-" + String(commandes.length + 1).padStart(3, "0");
    const { data, error } = await supabase.from("commandes").insert([{
      ref, batiment: form.batiment, client: form.client, delai: form.delai,
      dessinateur: form.dessinateur, notes: form.notes, plans: form.plans,
      fichiers_plan: form.fichiersPlan, logo_client: form.logoClient, statut: "En attente",
    }]).select("*, messages(*)").single();
    if (!error && data) {
      setCommandes([{ ...data, plans: data.plans || [], fichiersPlan: data.fichiers_plan || [], logoClient: data.logo_client || [], messages: [] }, ...commandes]);
    }
    setSaving(false);
    setShowForm(false);
    setForm(formVide());
  }

  async function changerStatut(id, statut) {
    const { error } = await supabase.from("commandes").update({ statut }).eq("id", id);
    if (!error) {
      setCommandes(commandes.map(c => c.id === id ? { ...c, statut } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
    }
  }

  async function envoyerMessage(commandeId, auteur, texte) {
    const { data, error } = await supabase.from("messages").insert([{
      commande_id: commandeId, auteur, texte,
      date: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" }),
    }]).select().single();
    if (!error && data) {
      setCommandes(commandes.map(c =>
        c.id === commandeId ? { ...c, messages: [...c.messages, data] } : c
      ));
    }
  }

  async function envoyerMessageAdmin() {
    if (!msgInput.trim() || !selected) return;
    await envoyerMessage(selected.id, "Simon", msgInput.trim());
    setSelected(prev => ({ ...prev, messages: [...prev.messages, { auteur: "Simon", texte: msgInput.trim(), date: "Maintenant" }] }));
    setMsgInput("");
  }

  async function uploaderPlansFinalises(commandeId, fichiers) {
    const { error } = await supabase.from("commandes").update({ plans_finalises: fichiers }).eq("id", commandeId);
    if (!error) {
      setCommandes(commandes.map(c => c.id === commandeId ? { ...c, plansFinalises: fichiers } : c));
    }
  }

  const stats = {
    total:   commandes.length,
    enCours: commandes.filter(c => c.statut === "Commencé" || c.statut === "Ébauche déposée").length,
    attente: commandes.filter(c => c.statut === "En attente" || c.statut === "Modification dessinateur").length,
    valides: commandes.filter(c => c.statut === "Validé").length,
  };

  const cmdAffichees = vue === "dashboard" ? commandes.slice(0, 5) : commandes;
  const inputStyle   = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle   = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4 };

  // ── Switcher barre ──
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

  // ── Vue dessinateur ──
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
            <VueDessinateur
              commandes={commandes}
              nomDessinateur={dessinateurActif}
              onChangerStatut={changerStatut}
              onEnvoyerMessage={envoyerMessage}
              onUploaderPlansFinalises={uploaderPlansFinalises}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Vue admin ──
  return (
    <div>
      <SwitcherBarre />
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F9FAFB", color: "#111827", paddingTop: 44 }}>

        {/* Sidebar */}
        <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px", gap: 4, position: "fixed", top: 44, height: "calc(100vh - 44px)" }}>
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
            { id: "dashboard", label: "Dashboard", icon: "📊" },
            { id: "commandes", label: "Commandes", icon: "📋" },
            { id: "reglages",  label: "Réglages",  icon: "⚙️" },
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

        {/* Main admin */}
        <div style={{ marginLeft: 220, flex: 1, padding: "32px 32px" }}>

          {vue === "reglages" && <PageReglages settings={settings} onSave={s => setSettings(s)} />}

          {vue !== "reglages" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{vue === "dashboard" ? "Dashboard" : "Toutes les commandes"}</h1>
                <button onClick={() => setShowForm(true)}
                  style={{ background: "#DC2626", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
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

              {loading ? (
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
                  Chargement des commandes...
                </div>
              ) : (
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: selected ? 24 : 0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 0.8fr 1fr 1.3fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <span>Bâtiment</span><span>Client</span><span>Plans</span><span>Délai</span><span>Statut</span>
                  </div>
                  {cmdAffichees.length === 0 && (
                    <div style={{ padding: "32px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande. Créez votre première commande !</div>
                  )}
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
              )}

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
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>Changer le statut</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {STATUTS_ADMIN.map(s => (
                        <button key={s} onClick={() => changerStatut(selected.id, s)}
                          style={{ padding: "5px 12px", borderRadius: 100, border: selected.statut === s ? "2px solid #DC2626" : "1px solid #E5E7EB", background: selected.statut === s ? "#FEF2F2" : "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: selected.statut === s ? "#DC2626" : "#6B7280" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selected.notes && (
                    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400E", marginBottom: 20 }}>
                      📝 {selected.notes}
                    </div>
                  )}
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
                        onKeyDown={e => e.key === "Enter" && envoyerMessageAdmin()}
                        placeholder="Écrire un message..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, outline: "none" }} />
                      <button onClick={envoyerMessageAdmin}
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
      </div>

      {/* Modal nouvelle commande */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 620, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nouvelle commande</h2>
              <button onClick={() => setShowForm(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
            </div>
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
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Plans à réaliser</label>
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px" }}>
                <TableauPlans plans={form.plans} onChange={plans => setForm({ ...form, plans })} />
              </div>
            </div>
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
                <button onClick={creerCommande} disabled={saving}
                  style={{ padding: "9px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: !form.batiment || !form.client ? "not-allowed" : "pointer", background: !form.batiment || !form.client ? "#F3F4F6" : "#DC2626", color: !form.batiment || !form.client ? "#9CA3AF" : "#fff" }}>
                  {saving ? "Enregistrement..." : "Créer la commande"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
