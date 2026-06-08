import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "../supabase";
import { formatDateCourt } from "../helpers";
import TicketChat from "./TicketChat";
import ZoneUpload from "./ZoneUpload";
import PiecesJointes from "./PiecesJointes";

export default function PageGestion() {
  const { profil, tickets: ticketsGlobal = [], setTickets: setTicketsGlobal } = useOutletContext();
  const [searchParams] = useSearchParams();
  const onglet = searchParams.get("tab") === "annonces" ? "annonces" : "tickets";
  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();

  // Propage la lecture au state global (badges sidebar).
  function marquerLuGlobal(ticketId, messageIds) {
    setTicketsGlobal?.(prev => prev.map(t =>
      t.id !== ticketId ? t : {
        ...t,
        messages: (t.messages || []).map(m =>
          messageIds.includes(m.id) ? { ...m, lu_par: [...(m.lu_par || []), profil.id] } : m
        ),
      }
    ));
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px" }}>
        {onglet === "annonces" ? "Annonces" : "Signalements"}
      </h1>

      {onglet === "tickets" ? <OngletTickets profil={profil} auteurNom={auteurNom} onLu={marquerLuGlobal} ticketsGlobal={ticketsGlobal} /> : <OngletAnnonces profil={profil} />}
    </div>
  );
}

// ============================================================
// ONGLET TICKETS
// ============================================================
function OngletTickets({ profil, auteurNom, onLu, ticketsGlobal = [] }) {
  const [tickets, setTickets] = useState([]);
  const [filtre, setFiltre] = useState("ouvert"); // "ouvert" | "cloture" | "tous"
  const [selId, setSelId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Nb de messages non lus d'un ticket (depuis le state global porteur de lu_par).
  const nonLusDe = (ticketId) => {
    const g = ticketsGlobal.find(t => t.id === ticketId);
    return (g?.messages || []).filter(m => m.auteur_id !== profil.id && !(m.lu_par || []).includes(profil.id)).length;
  };

  useEffect(() => { charger(); }, []); // eslint-disable-line

  async function charger() {
    setLoading(true);
    const { data } = await supabase.from("tickets").select("*").order("updated_at", { ascending: false });
    setTickets(data || []);
    setLoading(false);
  }

  const visibles = tickets.filter(t => filtre === "tous" ? true : t.statut === filtre);

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { v: "ouvert", l: "Ouverts" },
          { v: "cloture", l: "Clôturés" },
          { v: "tous", l: "Tous" },
        ].map(f => (
          <button key={f.v} onClick={() => setFiltre(f.v)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: filtre === f.v ? "#122131" : "#fff", color: filtre === f.v ? "#fff" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: "#9CA3AF", padding: 20 }}>Chargement…</div>
      ) : visibles.length === 0 ? (
        <div style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: 30, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12 }}>
          Aucun signalement {filtre === "ouvert" ? "ouvert" : filtre === "cloture" ? "clôturé" : ""}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visibles.map(t => (
            <div key={t.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
              <button onClick={() => setSelId(selId === t.id ? null : t.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t.titre}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                    {t.motif} · {t.createur_nom}{t.createur_role ? ` (${t.createur_role})` : ""} · {formatDateCourt(t.created_at)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {nonLusDe(t.id) > 0 && (
                    <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{nonLusDe(t.id)}</span>
                  )}
                  <StatutBadge statut={t.statut} />
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>{selId === t.id ? "▲" : "▼"}</span>
                </div>
              </button>
              {selId === t.id && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid #F3F4F6" }}>
                  <div style={{ height: 12 }} />
                  <TicketChat
                    ticket={t}
                    userId={profil.id}
                    auteurNom={auteurNom}
                    isAdmin={true}
                    onStatutChange={(s) => setTickets(prev => prev.map(x => x.id === t.id ? { ...x, statut: s } : x))}
                    onLu={onLu}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ONGLET ANNONCES (messages broadcast)
// ============================================================
function OngletAnnonces({ profil }) {
  const [annonces, setAnnonces] = useState([]);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [type, setType] = useState("info");
  const [fichiers, setFichiers] = useState([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { charger(); }, []); // eslint-disable-line

  async function charger() {
    const { data } = await supabase.from("annonces").select("*").order("created_at", { ascending: false });
    setAnnonces(data || []);
  }

  async function creer() {
    if (!titre.trim() || !contenu.trim() || envoi) return;
    setEnvoi(true);
    const { data, error } = await supabase.from("annonces").insert([{
      titre: titre.trim(),
      contenu: contenu.trim(),
      type,
      fichiers,
      created_by: profil.id,
    }]).select().single();
    if (!error && data) {
      setAnnonces(prev => [data, ...prev]);
      setTitre(""); setContenu(""); setType("info"); setFichiers([]);
    }
    setEnvoi(false);
  }

  async function toggleActive(a) {
    const { error } = await supabase.from("annonces").update({ active: !a.active }).eq("id", a.id);
    if (!error) setAnnonces(prev => prev.map(x => x.id === a.id ? { ...x, active: !a.active } : x));
  }

  async function supprimer(id) {
    const { error } = await supabase.from("annonces").delete().eq("id", id);
    if (!error) setAnnonces(prev => prev.filter(x => x.id !== id));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }} className="gestion-annonces-grid">
      {/* Formulaire création */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Nouvelle annonce</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
              <option value="info">Information</option>
              <option value="warning">Attention</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Titre</label>
            <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex : Mise à jour 2.6.1" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Message</label>
            <textarea value={contenu} onChange={e => setContenu(e.target.value)} rows={4} placeholder="Contenu visible par tous les utilisateurs…" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={labelStyle}>Pièces jointes (optionnel)</label>
            <ZoneUpload label="" fichiers={fichiers} onAjouter={setFichiers}
              onSupprimer={i => setFichiers(fichiers.filter((_, idx) => idx !== i))}
              accept=".png,.jpg,.jpeg,.pdf" maxFichiers={5} />
          </div>
          <button onClick={creer} disabled={!titre.trim() || !contenu.trim() || envoi}
            style={{ padding: 10, borderRadius: 8, border: "none", background: (!titre.trim() || !contenu.trim()) ? "#F3F4F6" : "#122131", color: (!titre.trim() || !contenu.trim()) ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: (!titre.trim() || !contenu.trim()) ? "not-allowed" : "pointer" }}>
            {envoi ? "Publication…" : "Publier l'annonce"}
          </button>
        </div>
      </div>

      {/* Liste des annonces */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Annonces publiées</div>
        {annonces.length === 0 ? (
          <div style={{ fontSize: 13, color: "#9CA3AF", padding: 20, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, textAlign: "center" }}>Aucun message.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {annonces.map(a => (
              <div key={a.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 14px", opacity: a.active ? 1 : 0.55 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{a.type === "warning" ? "⚠️" : "ℹ️"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{a.titre}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#374151", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.contenu}</div>
                    <PiecesJointes fichiers={a.fichiers} compact />
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 6 }}>{formatDateCourt(a.created_at)} · {a.active ? "Actif" : "Masqué"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button onClick={() => toggleActive(a)} style={lienBtn("#1E40AF")}>{a.active ? "Masquer" : "Réactiver"}</button>
                  <button onClick={() => supprimer(a.id)} style={lienBtn("#DC2626")}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatutBadge({ statut }) {
  const cloture = statut === "cloture";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 100, padding: "2px 10px", background: cloture ? "#F3F4F6" : "#FEF3C7", color: cloture ? "#6B7280" : "#92400E" }}>
      {cloture ? "Clôturé" : "Ouvert"}
    </span>
  );
}

const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 };
const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" };
const lienBtn = (color) => ({ fontSize: 12, fontWeight: 600, color, background: "none", border: "none", cursor: "pointer", padding: 0 });
