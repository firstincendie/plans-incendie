import { useState, useEffect } from "react";
import { formatDateCourt, formatDateBulle, joursRestants } from "../helpers";
import Badge from "./Badge";
import BlocAdresse from "./BlocAdresse";
import Messagerie from "./Messagerie";

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#F3F4F6", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Créé le</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{formatDateCourt(selected.created_at)}</div>
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
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #D1D5DB", borderRadius: 8, overflow: "hidden", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#E5E7EB" }}>
                {["N°", "Type de plan", "Orientation", "Format"].map((h, i) => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", borderBottom: "2px solid #D1D5DB", borderRight: i < 3 ? "1px solid #D1D5DB" : "none" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.plans.map((p, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? "#F9FAFB" : "#fff", borderBottom: i < selected.plans.length - 1 ? "1px solid #E5E7EB" : "none" }}>
                  <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", textAlign: "center", color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.type || "—"}</td>
                  <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.orientation || "—"}</td>
                  <td style={{ padding: "9px 12px", color: "#111827" }}>{p.format || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

function DropdownMenu({ onArchiver }) {
  const [ouvert, setOuvert] = useState(false);
  const HEADER_BTN = { height: 36, padding: "0 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", whiteSpace: "nowrap" };
  return (
    <>
      <button style={HEADER_BTN} onClick={e => { setOuvert(v => !v); e.stopPropagation(); }}>•••</button>
      {ouvert && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setOuvert(false)} />
          <div style={{ position: "absolute", right: 0, top: 42, background: "#fff", border: "1px solid #D1D5DB", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.15)", zIndex: 1000, minWidth: 190, overflow: "hidden" }}>
            <div style={{ height: 1, background: "#E5E7EB", margin: "4px 0" }} />
            <button onClick={() => { onArchiver(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#DC2626", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
              🗃️ Archiver la commande
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default function DetailCommandeModal({
  selected, versionsSelected, onClose,
  onArchiver, showContacts,
  actionButtons,
  msgInput, setMsgInput, onEnvoyer, auteurNom,
  onMarquerLu,
}) {
  const [mobTab, setMobTab] = useState("infos");

  useEffect(() => {
    onMarquerLu?.();
  }, [selected?.id]); // eslint-disable-line

  if (!selected) return null;

  const nonLus = selected.messages.filter(m =>
    m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
  );

  // Nom du demandeur (sous-titre header)
  const nomDemandeur = `${selected.client_prenom ?? ""} ${selected.client_nom ?? ""}`.trim() ||
    selected.utilisateur_prenom ? `${selected.utilisateur_prenom ?? ""} ${selected.utilisateur_nom ?? ""}`.trim() : "";
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
            {onArchiver && (
              <div style={{ position: "relative" }}>
                <DropdownMenu onArchiver={onArchiver} />
              </div>
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
            <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
            {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
          </div>
          <div className="detail-desktop-chat">
            <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".8px", padding: 14, borderBottom: "1px solid #E5E7EB", background: "#fff", flexShrink: 0 }}>Messagerie</div>
            {chatContent}
          </div>
        </div>

        {/* Mobile */}
        <div className="detail-mobile-body">
          <div className={`detail-tab-pane${mobTab === "infos" ? " active" : ""}`}>
            <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
            {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
          </div>
          <div className={`detail-chat-pane${mobTab === "chat" ? " active" : ""}`}>
            {chatContent}
          </div>
        </div>

      </div>
    </div>
  );
}
