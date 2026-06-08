import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../supabase";
import { MOTIFS_TICKET } from "../constants";
import TicketChat from "./TicketChat";
import ZoneUpload from "./ZoneUpload";

// Section "Mes tickets" de la page Mon compte.
// Liste tous les tickets de l'utilisateur, permet d'en créer, et affiche
// le fil de discussion en inline (pas dans une popup).
export default function MesTickets({ profil }) {
  // setTickets (global, LayoutPrincipal) pour rafraîchir les badges quand on lit.
  const { setTickets: setTicketsGlobal } = useOutletContext();
  const [tickets, setTickets] = useState([]);
  const [selId, setSelId] = useState(null);
  const [creation, setCreation] = useState(false);
  const [motif, setMotif] = useState(MOTIFS_TICKET[0]);
  const [titre, setTitre] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [fichiers, setFichiers] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [loading, setLoading] = useState(true);

  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();

  // Met à jour le state global (badges sidebar) quand des messages sont lus.
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

  useEffect(() => { charger(); }, []); // eslint-disable-line

  async function charger() {
    setLoading(true);
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("createur_id", profil.id)
      .order("updated_at", { ascending: false });
    setTickets(data || []);
    setLoading(false);
  }

  async function creer() {
    if (!titre.trim() || !commentaire.trim() || envoi) return;
    setEnvoi(true);
    const { data, error } = await supabase.from("tickets").insert([{
      createur_id: profil.id,
      createur_nom: auteurNom,
      createur_role: profil.role,
      motif,
      titre: titre.trim(),
    }]).select().single();
    if (!error && data) {
      await supabase.from("ticket_messages").insert([{
        ticket_id: data.id,
        auteur_id: profil.id,
        auteur: auteurNom,
        texte: commentaire.trim(),
        fichiers,
      }]);
      setTickets(prev => [data, ...prev]);
      setTitre(""); setCommentaire(""); setMotif(MOTIFS_TICKET[0]); setFichiers([]);
      setCreation(false);
      setSelId(data.id);
    }
    setEnvoi(false);
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={sectionTitle}>Mes tickets</div>
        {!creation && (
          <button onClick={() => { setCreation(true); setSelId(null); }}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Nouveau signalement
          </button>
        )}
      </div>

      {/* Formulaire de création */}
      {creation && (
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 16, marginBottom: 16, background: "#FAFAFA" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Motif</label>
              <select value={motif} onChange={e => setMotif(e.target.value)} style={inputStyle}>
                {MOTIFS_TICKET.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Titre</label>
              <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Résumé court du problème" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Commentaire</label>
              <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={4} placeholder="Décrivez le problème en détail…" style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Pièces jointes (optionnel)</label>
              <ZoneUpload label="" fichiers={fichiers} onAjouter={setFichiers}
                onSupprimer={i => setFichiers(fichiers.filter((_, idx) => idx !== i))}
                accept=".png,.jpg,.jpeg,.pdf" maxFichiers={5} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setCreation(false)} style={btnSecondaire}>Annuler</button>
              <button onClick={creer} disabled={!titre.trim() || !commentaire.trim() || envoi} style={btnPrimaire(!titre.trim() || !commentaire.trim())}>
                {envoi ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des tickets */}
      {loading ? (
        <div style={{ fontSize: 13, color: "#9CA3AF", padding: 16 }}>Chargement…</div>
      ) : tickets.length === 0 && !creation ? (
        <div style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "24px 0" }}>
          Aucun signalement pour le moment.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tickets.map(t => (
            <div key={t.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => setSelId(selId === t.id ? null : t.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t.titre}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{t.motif}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <StatutBadge statut={t.statut} />
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>{selId === t.id ? "▲" : "▼"}</span>
                </div>
              </button>
              {selId === t.id && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid #F3F4F6" }}>
                  <div style={{ height: 12 }} />
                  <TicketChat
                    ticket={t}
                    userId={profil.id}
                    auteurNom={auteurNom}
                    isAdmin={false}
                    onStatutChange={(s) => setTickets(prev => prev.map(x => x.id === t.id ? { ...x, statut: s } : x))}
                    onLu={marquerLuGlobal}
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

function StatutBadge({ statut }) {
  const cloture = statut === "cloture";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 100, padding: "2px 10px", background: cloture ? "#F3F4F6" : "#FEF3C7", color: cloture ? "#6B7280" : "#92400E" }}>
      {cloture ? "Clôturé" : "Ouvert"}
    </span>
  );
}

const sectionTitle = { fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em" };
const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 };
const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" };
const btnSecondaire = { padding: "8px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" };
const btnPrimaire = (disabled) => ({ padding: "8px 16px", borderRadius: 8, border: "none", background: disabled ? "#F3F4F6" : "#122131", color: disabled ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" });
