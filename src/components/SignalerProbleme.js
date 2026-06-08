import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { MOTIFS_TICKET } from "../constants";
import TicketChat from "./TicketChat";

// Bouton "Signaler un problème" (rouge) + modale.
// Affiché dans la sidebar pour utilisateurs et dessinateurs.
// La modale permet de créer un ticket et de suivre ses tickets existants.
export default function SignalerProbleme({ profil }) {
  const [ouvert, setOuvert] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [selId, setSelId] = useState(null);
  const [mode, setMode] = useState("liste"); // "liste" | "nouveau"
  const [motif, setMotif] = useState(MOTIFS_TICKET[0]);
  const [titre, setTitre] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();

  useEffect(() => {
    if (!ouvert) return;
    chargerTickets();
  }, [ouvert]); // eslint-disable-line

  async function chargerTickets() {
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("createur_id", profil.id)
      .order("created_at", { ascending: false });
    setTickets(data || []);
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
      // Premier message = le commentaire initial
      await supabase.from("ticket_messages").insert([{
        ticket_id: data.id,
        auteur_id: profil.id,
        auteur: auteurNom,
        texte: commentaire.trim(),
      }]);
      setTickets(prev => [data, ...prev]);
      setTitre(""); setCommentaire(""); setMotif(MOTIFS_TICKET[0]);
      setSelId(data.id);
      setMode("liste");
    }
    setEnvoi(false);
  }

  function fermer() {
    setOuvert(false);
    setSelId(null);
    setMode("liste");
  }

  const selected = tickets.find(t => t.id === selId);

  return (
    <>
      {/* Bouton dans la sidebar — volontairement discret */}
      <button
        onClick={() => setOuvert(true)}
        style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "4px 12px", marginBottom: 4, background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 400, color: "#DC2626", textAlign: "left" }}>
        <span>Signaler un problème</span>
      </button>

      {/* Modale */}
      {ouvert && (
        <div onClick={fermer} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: 520, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {selected ? selected.titre : mode === "nouveau" ? "Nouveau signalement" : "Signaler un problème"}
              </h2>
              <button onClick={fermer} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
            </div>

            {/* --- Vue détail d'un ticket --- */}
            {selected ? (
              <div>
                <button onClick={() => setSelId(null)}
                  style={{ fontSize: 12, color: "#6B7280", background: "none", border: "none", cursor: "pointer", marginBottom: 10, padding: 0 }}>
                  ← Retour
                </button>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, fontSize: 12, color: "#6B7280" }}>
                  <span style={{ background: "#F3F4F6", borderRadius: 6, padding: "2px 8px" }}>{selected.motif}</span>
                  <StatutBadge statut={selected.statut} />
                </div>
                <TicketChat
                  ticket={selected}
                  userId={profil.id}
                  auteurNom={auteurNom}
                  isAdmin={false}
                  onStatutChange={(s) => setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, statut: s } : t))}
                />
              </div>
            ) : mode === "nouveau" ? (
              /* --- Formulaire création --- */
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button onClick={() => setMode("liste")} style={btnSecondaire}>Annuler</button>
                  <button onClick={creer} disabled={!titre.trim() || !commentaire.trim() || envoi} style={btnPrimaire(!titre.trim() || !commentaire.trim())}>
                    {envoi ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </div>
            ) : (
              /* --- Liste des tickets --- */
              <div>
                <button onClick={() => setMode("nouveau")}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 14 }}>
                  + Nouveau signalement
                </button>
                {tickets.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: 20 }}>Aucun signalement pour le moment.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {tickets.map(t => (
                      <button key={t.id} onClick={() => setSelId(t.id)}
                        style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", cursor: "pointer", textAlign: "left" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{t.titre}</span>
                          <StatutBadge statut={t.statut} />
                        </div>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>{t.motif}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
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
const btnSecondaire = { padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" };
const btnPrimaire = (disabled) => ({ padding: "9px 18px", borderRadius: 8, border: "none", background: disabled ? "#F3F4F6" : "#122131", color: disabled ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" });
