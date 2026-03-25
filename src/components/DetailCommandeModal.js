import { useState, useEffect, useRef } from "react";
import { formatDateCourt, formatDateBulle, joursRestants } from "../helpers";
import Badge from "./Badge";
import BlocAdresse from "./BlocAdresse";
import Messagerie from "./Messagerie";
import TableauPlans from "./TableauPlans";

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #E5E7EB" }}>
      {children}
    </div>
  );
}

function Accordeon({ label, children, couleur = "gris" }) {
  const [ouvert, setOuvert] = useState(false);
  const estBleu = couleur === "bleu";
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setOuvert(v => !v)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${estBleu ? "#BFDBFE" : "#D1D5DB"}`, borderRadius: ouvert ? "8px 8px 0 0" : 8, padding: "10px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", background: estBleu ? "#EFF6FF" : "#F3F4F6", color: estBleu ? "#1E40AF" : "#374151" }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 11 }}>{ouvert ? "▼" : "▶"}</span>
      </button>
      {ouvert && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, border: `1px solid ${estBleu ? "#BFDBFE" : "#D1D5DB"}`, borderTop: "none", borderRadius: "0 0 8px 8px", background: estBleu ? "#F0F9FF" : "#fff" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function LigneFichier({ fichier }) {
  const isImg = fichier.type && fichier.type.startsWith("image/");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff" }}>
      <span style={{ fontSize: 16 }}>{isImg ? "🖼️" : "📄"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fichier.nom}</div>
        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{fichier.taille}</div>
      </div>
      <a href={fichier.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563EB", fontWeight: 500, textDecoration: "none", flexShrink: 0 }}>Ouvrir</a>
    </div>
  );
}

function InfosContent({ selected, versionsSelected, showContacts }) {
  const jours = joursRestants(selected.delai);
  const couleurDelai = jours !== null && jours <= 3 ? "#DC2626" : "#78350F";
  const bgDelai = jours !== null && jours <= 3 ? "#FEF2F2" : "#FEF3C7";
  const borderDelai = jours !== null && jours <= 3 ? "#FECACA" : "#FDE68A";

  // Fichiers de toutes les versions
  const fichiersVersions = versionsSelected.flatMap(v =>
    (v.fichiers || []).map(f => ({ ...f, version: v.numero, versionDate: v.created_at }))
  );

  return (
    <div>
      {/* Informations */}
      <SectionTitle>Informations</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#F3F4F6", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Créé le</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{formatDateCourt(selected.created_at)}</div>
        </div>
        <div style={{ background: "#F3F4F6", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Dessinateur</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{selected.dessinateur || "—"}</div>
        </div>
        <div style={{ background: bgDelai, borderRadius: 8, padding: "10px 12px", border: `1px solid ${borderDelai}` }}>
          <div style={{ fontSize: 10, color: couleurDelai, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Délai</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: couleurDelai }}>{selected.delai ? formatDateCourt(selected.delai) : "—"}</div>
          {jours !== null && (
            <div style={{ fontSize: 11, color: couleurDelai, marginTop: 2, fontWeight: 600 }}>
              {jours === 0 ? "Aujourd'hui" : jours < 0 ? `${Math.abs(jours)}j dépassé` : `${jours} jour${jours > 1 ? "s" : ""} restant${jours > 1 ? "s" : ""}`}
            </div>
          )}
        </div>
        <div style={{ background: "#F3F4F6", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Nb. plans</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{selected.plans?.length ?? 0}</div>
        </div>
      </div>

      {/* Adresse + Contacts */}
      <div style={{ display: "grid", gridTemplateColumns: showContacts ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 24 }}>
        <div>
          <SectionTitle>Adresse</SectionTitle>
          <BlocAdresse commande={selected} copiable={showContacts} />
        </div>
        {showContacts && (
          <div>
            <SectionTitle>Contacts</SectionTitle>
            <div style={{ background: "#F9FAFB", border: "1px solid #D1D5DB", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {selected.client_prenom || selected.client_nom ? (
                <div>
                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Nom</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{`${selected.client_prenom ?? ""} ${selected.client_nom ?? ""}`.trim()}</div>
                </div>
              ) : null}
              {selected.client_email && (
                <div>
                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Email</div>
                  <a href={`mailto:${selected.client_email}`} style={{ fontSize: 13, color: "#2563EB", textDecoration: "none" }}>{selected.client_email}</a>
                </div>
              )}
              {selected.client_telephone && (
                <div>
                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Téléphone</div>
                  <a href={`tel:${selected.client_telephone}`} style={{ fontSize: 13, color: "#2563EB", textDecoration: "none" }}>{selected.client_telephone}</a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tableau des plans */}
      {selected.plans?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Plans à réaliser</SectionTitle>

          {/* Desktop : tableau */}
          <div className="plans-affichage-table">
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #D1D5DB", borderRadius: 8, overflow: "hidden", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#E5E7EB" }}>
                  {["N°", "Type de plan", "Emplacement", "Orientation", "Format", "Matière", "Fichier final"].map((h, i) => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", borderBottom: "2px solid #D1D5DB", borderRight: i < 6 ? "1px solid #D1D5DB" : "none" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.plans.map((p, i) => {
                  const fichierFinal = (selected.plansFinalises || []).find(f => f.plan_index === i);
                  return (
                    <tr key={i} style={{ background: i % 2 === 1 ? "#F9FAFB" : "#fff", borderBottom: i < selected.plans.length - 1 ? "1px solid #E5E7EB" : "none" }}>
                      <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", textAlign: "center", color: "#9CA3AF", fontWeight: 600 }}>{p.numero || (i + 1)}</td>
                      <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.type || "—"}</td>
                      <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.emplacement || "—"}</td>
                      <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.orientation || "—"}</td>
                      <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.format || "—"}</td>
                      <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.matiere || "—"}</td>
                      <td style={{ padding: "9px 12px", color: "#111827" }}>
                        {fichierFinal
                          ? <a href={fichierFinal.url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 11, color: "#2563EB", fontWeight: 500, textDecoration: "none" }}>
                              📐 {fichierFinal.nom}
                            </a>
                          : <span style={{ color: "#9CA3AF", fontSize: 11 }}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile : cartes */}
          <div className="plans-affichage-cartes">
            {selected.plans.map((p, i) => {
              const fichierFinal = (selected.plansFinalises || []).find(f => f.plan_index === i);
              return (
                <div key={i} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", marginBottom: 8, background: i % 2 === 1 ? "#F9FAFB" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Plan {p.numero || (i + 1)} — {p.type || "—"}</span>
                    <span style={{ fontSize: 11, color: "#6B7280" }}>{p.orientation || "—"} · {p.format || "—"}{p.matiere ? ` · ${p.matiere}` : ""}</span>
                  </div>
                  {p.emplacement && (
                    <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>{p.emplacement}</div>
                  )}
                  {fichierFinal
                    ? <a href={fichierFinal.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563EB", fontWeight: 500, textDecoration: "none" }}>📐 {fichierFinal.nom}</a>
                    : null
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fichiers du plan */}
      {selected.fichiersPlan?.length > 0 && (
        <Accordeon label={`📄 Fichiers du plan (${selected.fichiersPlan.length})`}>
          {selected.fichiersPlan.map((f, i) => <LigneFichier key={i} fichier={f} />)}
        </Accordeon>
      )}

      {/* Plans du dessinateur */}
      {fichiersVersions.length > 0 && (
        <Accordeon label={`📐 Plans partagés par le dessinateur (${fichiersVersions.length})`} couleur="bleu">
          {fichiersVersions.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #BFDBFE", borderRadius: 6, background: "#fff" }}>
              <span style={{ fontSize: 16 }}>📐</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nom}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{formatDateBulle(f.versionDate)}</div>
              </div>
              <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563EB", fontWeight: 500, textDecoration: "none", flexShrink: 0 }}>Ouvrir</a>
            </div>
          ))}
        </Accordeon>
      )}
    </div>
  );
}

function NotesSection({ note, setNote, onSaveNote, noteSaveError }) {
  return (
    <div style={{ marginTop: 24 }}>
      <SectionTitle>Mes notes</SectionTitle>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={onSaveNote}
        placeholder="Ajouter une note personnelle..."
        style={{
          width: "100%", minHeight: 80, padding: "8px 12px",
          borderRadius: 8, border: "1px solid #E5E7EB",
          fontSize: 16, fontFamily: "inherit", resize: "vertical",
          boxSizing: "border-box", outline: "none", lineHeight: 1.5,
        }}
      />
      {noteSaveError && (
        <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>
          Erreur lors de la sauvegarde
        </div>
      )}
    </div>
  );
}

function buildChangesText(original, editForm) {
  const lines = [];

  if ((editForm.nom_plan || "") !== (original.nom_plan || ""))
    lines.push(`- Nom du plan : "${original.nom_plan || ""}" → "${editForm.nom_plan || ""}"`);

  const delaiBefore = original.delai ? original.delai.substring(0, 10) : "";
  if (editForm.delai !== delaiBefore) {
    const fmtOld = original.delai ? formatDateCourt(original.delai) : "—";
    const fmtNew = editForm.delai ? formatDateCourt(editForm.delai + "T12:00:00") : "—";
    lines.push(`- Délai : ${fmtOld} → ${fmtNew}`);
  }

  const contactFields = ["client_nom", "client_prenom", "client_email", "client_telephone"];
  if (contactFields.some(f => (editForm[f] || "") !== (original[f] || "")))
    lines.push("- Contacts mis à jour");

  const adresseFields = ["adresse1", "adresse2", "code_postal", "ville"];
  if (adresseFields.some(f => (editForm[f] || "") !== (original[f] || "")))
    lines.push("- Adresse mise à jour");

  if ((editForm.instructions || "") !== (original.instructions || ""))
    lines.push("- Instructions mises à jour");

  if (JSON.stringify(editForm.plans) !== JSON.stringify(original.plans || []))
    lines.push("- Plans à réaliser mis à jour");

  return lines.length > 0 ? `✏️ Commande modifiée :\n${lines.join("\n")}` : null;
}

function EditContent({ editForm, setEditForm }) {
  const inputStyle = {
    width: "100%", padding: "7px 10px", borderRadius: 7,
    border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box",
    fontFamily: "inherit",
  };
  const labelStyle = {
    fontSize: 11, color: "#6B7280", fontWeight: 600,
    textTransform: "uppercase", display: "block", marginBottom: 3,
  };
  function set(key, val) { setEditForm(f => ({ ...f, [key]: val })); }

  return (
    <div>
      {/* Nom du plan */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Nom du plan</SectionTitle>
        <input style={inputStyle} value={editForm.nom_plan || ""} onChange={e => set("nom_plan", e.target.value)} />
      </div>

      {/* Délai */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Délai</SectionTitle>
        <input type="date" style={inputStyle} value={editForm.delai || ""} onChange={e => set("delai", e.target.value)} />
      </div>

      {/* Contacts */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Contacts</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={labelStyle}>Prénom</label><input style={inputStyle} value={editForm.client_prenom || ""} onChange={e => set("client_prenom", e.target.value)} /></div>
          <div><label style={labelStyle}>Nom</label><input style={inputStyle} value={editForm.client_nom || ""} onChange={e => set("client_nom", e.target.value)} /></div>
          <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={editForm.client_email || ""} onChange={e => set("client_email", e.target.value)} /></div>
          <div><label style={labelStyle}>Téléphone</label><input style={inputStyle} value={editForm.client_telephone || ""} onChange={e => set("client_telephone", e.target.value)} /></div>
        </div>
      </div>

      {/* Adresse */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Adresse</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input style={inputStyle} placeholder="Adresse ligne 1" value={editForm.adresse1 || ""} onChange={e => set("adresse1", e.target.value)} />
          <input style={inputStyle} placeholder="Adresse ligne 2" value={editForm.adresse2 || ""} onChange={e => set("adresse2", e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 6 }}>
            <input style={inputStyle} placeholder="Code postal" value={editForm.code_postal || ""} onChange={e => set("code_postal", e.target.value)} />
            <input style={inputStyle} placeholder="Ville" value={editForm.ville || ""} onChange={e => set("ville", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Plans à réaliser */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Plans à réaliser</SectionTitle>
        <TableauPlans plans={editForm.plans || []} onChange={plans => set("plans", plans)} />
      </div>

      {/* Instructions */}
      <div style={{ marginBottom: 16 }}>
        <SectionTitle>Instructions</SectionTitle>
        <textarea
          style={{ ...inputStyle, minHeight: 72, resize: "vertical", fontSize: 13 }}
          value={editForm.instructions || ""}
          onChange={e => set("instructions", e.target.value)}
        />
      </div>
    </div>
  );
}

function DropdownMenu({ onArchiver, onDesarchiver, onSupprimer, onDupliquer, onModifier }) {
  const [ouvert, setOuvert] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef();
  const HEADER_BTN = { height: 36, padding: "0 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", whiteSpace: "nowrap" };

  function handleOpen(e) {
    e.stopPropagation();
    if (!ouvert) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOuvert(v => !v);
  }

  return (
    <>
      <button ref={btnRef} style={HEADER_BTN} onClick={handleOpen}>•••</button>
      {ouvert && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 1999 }} onClick={() => setOuvert(false)} />
          <div style={{ position: "fixed", top: pos.top, right: pos.right, background: "#fff", border: "1px solid #D1D5DB", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.15)", zIndex: 2000, minWidth: 200, overflow: "hidden" }}>
            {onArchiver && (
              <>
                {onModifier && (
                  <button onClick={() => { onModifier(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#374151", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
                    ✏️ Modifier la commande
                  </button>
                )}
                {onDupliquer && (
                  <>
                    {onModifier && <div style={{ height: 1, background: "#E5E7EB", margin: "2px 0" }} />}
                    <button onClick={() => { onDupliquer(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#374151", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
                      📋 Dupliquer la commande
                    </button>
                  </>
                )}
                <div style={{ height: 1, background: "#E5E7EB", margin: "2px 0" }} />
                <button onClick={() => { onArchiver(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#DC2626", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
                  🗃️ Archiver la commande
                </button>
              </>
            )}
            {onDesarchiver && (
              <>
                <button onClick={() => { onDesarchiver(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#374151", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
                  📤 Désarchiver la commande
                </button>
                {onSupprimer && (
                  <>
                    <div style={{ height: 1, background: "#E5E7EB", margin: "2px 0" }} />
                    <button onClick={() => { onSupprimer(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#DC2626", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
                      🗑️ Supprimer la commande
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function DetailCommandeModal({
  selected, versionsSelected, onClose,
  onArchiver, onDesarchiver, onSupprimer, onDupliquer, showContacts,
  actionButtons,
  msgInput, setMsgInput, onEnvoyer, auteurNom,
  onMarquerLu,
  note, setNote, onSaveNote, noteSaveError,
  onModifierCommande, canModifier,
  startInEditMode,
}) {
  const [mobTab, setMobTab] = useState("infos");
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    onMarquerLu?.();
    if (startInEditMode && selected) {
      enterEditMode();
    } else {
      setEditMode(false);
    }
  }, [selected?.id]); // eslint-disable-line

  function enterEditMode() {
    if (!selected) return;
    setEditForm({
      nom_plan: selected.nom_plan || "",
      client_nom: selected.client_nom || "",
      client_prenom: selected.client_prenom || "",
      client_email: selected.client_email || "",
      client_telephone: selected.client_telephone || "",
      adresse1: selected.adresse1 || "",
      adresse2: selected.adresse2 || "",
      code_postal: selected.code_postal || "",
      ville: selected.ville || "",
      delai: selected.delai ? selected.delai.substring(0, 10) : "",
      plans: JSON.parse(JSON.stringify(selected.plans || [])),
      instructions: selected.instructions || "",
    });
    setEditMode(true);
  }

  async function saveEdit() {
    setSavingEdit(true);
    const updates = {
      nom_plan: editForm.nom_plan,
      client_nom: editForm.client_nom,
      client_prenom: editForm.client_prenom,
      client_email: editForm.client_email,
      client_telephone: editForm.client_telephone,
      adresse1: editForm.adresse1,
      adresse2: editForm.adresse2,
      code_postal: editForm.code_postal,
      ville: editForm.ville,
      delai: editForm.delai || null,
      plans: editForm.plans,
      instructions: editForm.instructions,
    };
    const changesText = buildChangesText(selected, editForm);
    try {
      await onModifierCommande(selected.id, updates, changesText);
      setEditMode(false);
    } catch {
      // save failed — stay in edit mode so user can retry
    } finally {
      setSavingEdit(false);
    }
  }

  if (!selected) return null;

  const nonLus = selected.messages.filter(m =>
    m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
  );

  // Nom du demandeur (sous-titre header)
  const nomDemandeur = `${selected.client_prenom ?? ""} ${selected.client_nom ?? ""}`.trim() ||
    (selected.utilisateur_prenom ? `${selected.utilisateur_prenom ?? ""} ${selected.utilisateur_nom ?? ""}`.trim() : "");
  const sousTitre = nomDemandeur ? `${nomDemandeur} — ${selected.ref}` : selected.ref;

  const HEADER_BTN = {
    height: 36, padding: "0 14px", borderRadius: 6, fontSize: 13, fontWeight: 600,
    cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", whiteSpace: "nowrap",
  };

  const chatContent = (
    <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
      onEnvoyer={onEnvoyer} auteurActif={auteurNom} allowFichier
      readOnly={selected.statut === "Validé"}
      instructions={selected.instructions || null} />
  );

  return (
    <div className={`detail-modal-overlay open`} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-modal-box">

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "2px solid #E5E7EB", flexShrink: 0, background: "#fff" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#122131" }}>{selected.nom_plan}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, fontWeight: 500 }}>{sousTitre}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge statut={selected.statut} />
            {(onArchiver || onDesarchiver || onDupliquer || canModifier) && !editMode && (
              <DropdownMenu
                onArchiver={onArchiver}
                onDesarchiver={onDesarchiver}
                onSupprimer={onSupprimer}
                onDupliquer={onDupliquer}
                onModifier={canModifier ? enterEditMode : undefined}
              />
            )}
            <button style={HEADER_BTN} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Onglets mobile */}
        <div className="detail-mobile-tabs">
          <div onClick={() => setMobTab("infos")} style={{ flex: 1, padding: 12, textAlign: "center", fontSize: 13, fontWeight: 600, cursor: "pointer", color: mobTab === "infos" ? "#122131" : "#9CA3AF", borderBottom: `3px solid ${mobTab === "infos" ? "#122131" : "transparent"}`, marginBottom: -2 }}>📋 Infos</div>
          <div onClick={() => { setMobTab("chat"); onMarquerLu?.(); }} style={{ flex: 1, padding: 12, textAlign: "center", fontSize: 13, fontWeight: 600, cursor: "pointer", color: mobTab === "chat" ? "#122131" : "#9CA3AF", borderBottom: `3px solid ${mobTab === "chat" ? "#122131" : "transparent"}`, marginBottom: -2 }}>
            💬 Chat {nonLus.length > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: 4 }}>{nonLus.length}</span>}
          </div>
        </div>

        {/* Desktop : 2 colonnes */}
        <div className="detail-desktop-body">
          <div className="detail-desktop-left">
            {editMode ? (
              <>
                <EditContent editForm={editForm} setEditForm={setEditForm} />
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button onClick={saveEdit} disabled={savingEdit}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 700, cursor: savingEdit ? "not-allowed" : "pointer" }}>
                    {savingEdit ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
                <NotesSection note={note ?? ""} setNote={setNote} onSaveNote={onSaveNote} noteSaveError={noteSaveError} />
                {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
              </>
            )}
          </div>
          <div className="detail-desktop-chat">
            <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".8px", padding: 14, borderBottom: "1px solid #E5E7EB", background: "#fff", flexShrink: 0 }}>Messagerie</div>
            {chatContent}
          </div>
        </div>

        {/* Mobile */}
        <div className="detail-mobile-body">
          <div className={`detail-tab-pane${mobTab === "infos" ? " active" : ""}`}>
            {editMode ? (
              <>
                <EditContent editForm={editForm} setEditForm={setEditForm} />
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button onClick={saveEdit} disabled={savingEdit}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 700, cursor: savingEdit ? "not-allowed" : "pointer" }}>
                    {savingEdit ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
                <NotesSection note={note ?? ""} setNote={setNote} onSaveNote={onSaveNote} noteSaveError={noteSaveError} />
                {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
              </>
            )}
          </div>
          <div className={`detail-chat-pane${mobTab === "chat" ? " active" : ""}`}>
            {chatContent}
          </div>
        </div>

      </div>
    </div>
  );
}
