import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

// Fil de discussion d'un ticket. Réutilisé côté créateur et côté admin.
// Props :
//   ticket      – { id, statut, ... }
//   userId      – id du profil courant
//   auteurNom   – nom affiché de l'auteur courant
//   isAdmin     – l'utilisateur courant est-il admin (peut clôturer / rouvrir)
//   onStatutChange(nouveauStatut) – callback après clôture / réouverture
export default function TicketChat({ ticket, userId, auteurNom, isAdmin, onStatutChange, onLu }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const bottomRef = useRef();

  const cloture = ticket.statut === "cloture";

  useEffect(() => {
    let annule = false;
    supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true })
      .then(async ({ data }) => {
        if (annule) return;
        setMessages(data || []);
        // Marque comme lus les messages des autres auteurs non encore lus.
        const nonLus = (data || []).filter(m => m.auteur_id !== userId && !(m.lu_par || []).includes(userId));
        if (nonLus.length > 0) {
          await Promise.all(nonLus.map(m =>
            supabase.from("ticket_messages")
              .update({ lu_par: [...(m.lu_par || []), userId] })
              .eq("id", m.id)
          ));
          onLu?.(ticket.id, nonLus.map(m => m.id));
        }
      });
    return () => { annule = true; };
  }, [ticket.id]); // eslint-disable-line

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function envoyer() {
    const texte = input.trim();
    if (!texte || envoi) return;
    setEnvoi(true);
    const { data, error } = await supabase.from("ticket_messages").insert([{
      ticket_id: ticket.id,
      auteur_id: userId,
      auteur: auteurNom,
      texte,
    }]).select().single();
    if (!error && data) {
      setMessages(prev => [...prev, data]);
      setInput("");
      // Touch updated_at du ticket (best-effort, ignore si non admin et RLS bloque)
      supabase.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticket.id);
    }
    setEnvoi(false);
  }

  async function changerStatut(nouveau) {
    const updates = { statut: nouveau, closed_at: nouveau === "cloture" ? new Date().toISOString() : null };
    const { error } = await supabase.from("tickets").update(updates).eq("id", ticket.id);
    if (!error) onStatutChange?.(nouveau);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Messages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto", padding: "4px 2px" }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: 12 }}>Aucun message.</div>
        )}
        {messages.map(m => {
          const moi = m.auteur_id === userId;
          return (
            <div key={m.id} style={{ alignSelf: moi ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <div style={{ background: moi ? "#fff" : "#EFF6FF", border: `1px solid ${moi ? "#E5E7EB" : "#BFDBFE"}`, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: moi ? "#374151" : "#1E40AF" }}>{m.auteur}</div>
                <div style={{ fontSize: 12, color: "#374151", marginTop: 3, whiteSpace: "pre-wrap" }}>{m.texte}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie / statut */}
      {cloture ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#F3F4F6", borderRadius: 8, padding: "8px 12px" }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>🔒 Ticket clôturé</span>
          {isAdmin && (
            <button onClick={() => changerStatut("ouvert")}
              style={{ fontSize: 12, fontWeight: 600, color: "#1E40AF", background: "none", border: "none", cursor: "pointer" }}>
              Rouvrir
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") envoyer(); }}
              placeholder="Votre message…"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box" }}
            />
            <button onClick={envoyer} disabled={!input.trim() || envoi}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: !input.trim() ? "#F3F4F6" : "#122131", color: !input.trim() ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: !input.trim() ? "not-allowed" : "pointer" }}>
              {envoi ? "…" : "Envoyer"}
            </button>
          </div>
          {isAdmin && (
            <button onClick={() => changerStatut("cloture")}
              style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 600, color: "#059669", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>
              ✓ Clôturer le ticket
            </button>
          )}
        </>
      )}
    </div>
  );
}
