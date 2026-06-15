import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase";
import { analyserMessage, fichierAvecDate, formatDateBulle } from "../helpers";
import VisuFichier from "./VisuFichier";

export default function Messagerie({ selected, msgInput, setMsgInput, onEnvoyer, onSupprimer, auteurActif, allowFichier = false, readOnly = false, instructions = null, onMarquerLu }) {
  const [fichierMsg, setFichierMsg]     = useState([]);
  const [alerte, setAlerte]             = useState(null);
  const [visuFichier, setVisuFichier]   = useState(null);
  const [instrOuvert, setInstrOuvert]   = useState(false);
  const [modeNote, setModeNote]         = useState(false); // false = message public, true = note privée
  const [modeOuvert, setModeOuvert]     = useState(false); // dropdown du mode
  const [confirmSupprId, setConfirmSupprId] = useState(null);
  const inputRef  = useRef();
  const bottomRef = useRef();

  // Auto-scroll au dernier message à chaque changement
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages?.length, selected?.id]);

  async function handleEnvoyer() {
    if (!msgInput.trim() && fichierMsg.length === 0) return;

    // Filtre regex — sauf pour Simon (admin)
    if (auteurActif !== "Simon") {
      const detection = analyserMessage(msgInput);
      if (detection) {
        setAlerte(`⛔ Message bloqué : ${detection} détecté(e). Le partage de coordonnées personnelles est interdit sur cette plateforme.`);
        setTimeout(() => setAlerte(null), 5000);
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

    // Le toggle UI prime ; backward-compat /note conservée.
    if (modeNote && auteurActif) {
      await onEnvoyer(msgInput.trim(), fichierMsg, { visible_par: [auteurActif] });
      setMsgInput("");
      setFichierMsg([]);
      return;
    }

    const trimmed = msgInput.trimStart();
    if (trimmed.toLowerCase().startsWith("/note") && auteurActif) {
      const afterCmd = trimmed.slice(5);
      if (!afterCmd.startsWith(" ")) {
        setAlerte("Syntaxe : /note [votre texte]");
        return;
      }
      const texteReel = afterCmd.slice(1).trim();
      if (!texteReel && fichierMsg.length === 0) return;
      await onEnvoyer(texteReel, fichierMsg, { visible_par: [auteurActif] });
    } else {
      await onEnvoyer(msgInput, fichierMsg, {});
    }

    setMsgInput("");
    setFichierMsg([]);
  }

  const messagesAfficher = (instructions
    ? selected.messages.filter((m, i) => i !== 0 || m.texte !== instructions)
    : selected.messages
  ).filter(m => !m.visible_par || m.visible_par.includes(auteurActif));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {instructions && (
        <div style={{ flexShrink: 0, margin: "8px 12px 0", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, overflow: "hidden" }}>
          <button onClick={() => setInstrOuvert(v => !v)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#92400E", textAlign: "left" }}>
            <span>📌 Instructions</span>
            <span style={{ fontSize: 11 }}>{instrOuvert ? "▲" : "▼"}</span>
          </button>
          {instrOuvert && (
            <div style={{ padding: "0 12px 10px", fontSize: 12, color: "#78350F", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{instructions}</div>
          )}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, overflowY: "auto", padding: 12 }}>
        {messagesAfficher.length === 0 && <div style={{ fontSize: 13, color: "#9CA3AF" }}>{instructions ? "Aucun autre message." : "Aucun message."}</div>}
        {messagesAfficher.map((m, i) => {
          const moi = m.auteur === auteurActif;
          const estNotePrivee = !!(m.visible_par && m.visible_par.includes(auteurActif));
          const peutSupprimer = moi && onSupprimer && (estNotePrivee || (m.lu_par || []).length === 0);
          return (
            <div key={i} style={{ alignSelf: moi ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              {estNotePrivee && (
                <div style={{ fontSize: 10, color: "#92400E", textAlign: moi ? "right" : "left", marginBottom: 2, paddingInline: 2 }}>
                  🔒 Note privée
                </div>
              )}
              <div style={{
                background: estNotePrivee ? "#FFFBEB" : moi ? "#fff" : "#EFF6FF",
                border: estNotePrivee ? "1.5px dashed #FCD34D" : `1px solid ${moi ? "#E5E7EB" : "#BFDBFE"}`,
                borderRadius: 8,
                padding: "10px 12px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: m.auteur_admin ? "#DC2626" : moi ? "#374151" : "#1E40AF" }}>
                  {m.auteur}{m.auteur_admin ? " · Support" : ""}
                </div>
                <div style={{ fontSize: 12, color: m.auteur_admin ? "#DC2626" : "#374151", marginTop: 4, whiteSpace: "pre-wrap" }}>{m.texte}</div>
                {m.fichiers && m.fichiers.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {m.fichiers.map((f, j) => (
                      <button key={j} onClick={() => setVisuFichier(f)}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#fff", fontSize: 11, color: "#374151", cursor: "pointer" }}>
                        📎 {f.nom} <span style={{ fontSize: 10, color: "#9CA3AF" }}>👁</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: 10,
                color: (!estNotePrivee && (m.lu_par || []).length > 0 && moi) ? "#2563EB" : "#9CA3AF",
                textAlign: moi ? "right" : "left",
                marginTop: 3,
                paddingInline: 2,
                display: "flex",
                gap: 6,
                justifyContent: moi ? "flex-end" : "flex-start",
                alignItems: "center",
              }}>
                <span>{formatDateBulle(m.created_at)}{!estNotePrivee && moi ? ` ${(m.lu_par || []).length > 0 ? "✓✓ Lu" : "✓✓"}` : ""}</span>
                {peutSupprimer && (
                  confirmSupprId === m.id ? (
                    <>
                      <span>Confirmer ?</span>
                      <button onClick={async () => { await onSupprimer(m.id); setConfirmSupprId(null); }} title="Supprimer"
                        style={{ background: "#DC2626", color: "#fff", border: "none", borderRadius: 4, padding: "1px 7px", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>Oui</button>
                      <button onClick={() => setConfirmSupprId(null)} title="Annuler"
                        style={{ background: "#fff", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 4, padding: "1px 7px", cursor: "pointer", fontSize: 10 }}>Non</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmSupprId(m.id)} title="Supprimer"
                      style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}>🗑</button>
                  )
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {visuFichier && <VisuFichier fichier={visuFichier} onClose={() => setVisuFichier(null)} />}
      {!readOnly && allowFichier && fichierMsg.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {fichierMsg.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: 11, color: "#374151" }}>
              📎 {f.nom}
              <button onClick={() => setFichierMsg(fichierMsg.filter((_, idx) => idx !== i))} style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 12, padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      {!readOnly && alerte && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#DC2626", fontWeight: 500 }}>
          {alerte}
        </div>
      )}
      {!readOnly && <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "10px 12px", borderTop: "2px solid #E5E7EB", background: "#fff", flexShrink: 0 }}>
        {allowFichier && (
          <>
            <button onClick={() => inputRef.current.click()}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 16, cursor: "pointer", flexShrink: 0 }} title="Joindre un fichier">
              📎
            </button>
            <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.pdf" multiple style={{ display: "none" }}
              onChange={async e => {
                const files = Array.from(e.target.files);
                e.target.value = "";
                const nouveaux = await Promise.all(files.map(async f => {
                  const chemin = `chat/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
                  const { error } = await supabase.storage.from("fichiers").upload(chemin, f);
                  if (error) { console.error("Upload:", error); return null; }
                  const { data: urlData } = supabase.storage.from("fichiers").getPublicUrl(chemin);
                  return fichierAvecDate({ nom: f.name, taille: (f.size / 1024).toFixed(0) + " Ko", url: urlData.publicUrl, type: f.type });
                }));
                setFichierMsg(prev => [...prev, ...nouveaux.filter(Boolean)].slice(0, 5));
              }} />
          </>
        )}
        <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleEnvoyer()}
          placeholder={modeNote ? "🔒 Note privée pour moi..." : "Écrire un message..."}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${modeNote ? "#FCD34D" : "#E5E7EB"}`, background: modeNote ? "#FFFBEB" : "#fff", fontSize: 13, outline: "none" }} />
        {/* Sélecteur de mode (compact, à gauche du Envoyer) */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button type="button"
            onClick={(e) => { e.stopPropagation(); setModeOuvert(v => !v); }}
            title={modeNote ? "Mode : Note privée" : "Mode : Message"}
            style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${modeNote ? "#FCD34D" : "#E5E7EB"}`, background: modeNote ? "#FFFBEB" : "#fff", fontSize: 13, cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 4 }}>
            {modeNote ? "🔒" : "💬"}<span style={{ fontSize: 10, color: "#9CA3AF" }}>▾</span>
          </button>
          {modeOuvert && (
            <>
              <div onClick={() => setModeOuvert(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
              <div onClick={e => e.stopPropagation()}
                style={{ position: "absolute", bottom: "calc(100% + 4px)", right: 0, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 51, minWidth: 180, overflow: "hidden" }}>
                <button type="button"
                  onClick={() => { setModeNote(false); setModeOuvert(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: modeNote ? "none" : "#F9FAFB", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}>
                  💬 Message
                  {!modeNote && <span style={{ marginLeft: "auto", color: "#059669" }}>✓</span>}
                </button>
                <button type="button"
                  onClick={() => { setModeNote(true); setModeOuvert(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: modeNote ? "#FFFBEB" : "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}>
                  🔒 Note privée
                  {modeNote && <span style={{ marginLeft: "auto", color: "#059669" }}>✓</span>}
                </button>
              </div>
            </>
          )}
        </div>
        <button onClick={handleEnvoyer}
          style={{ background: modeNote ? "#D97706" : (auteurActif === "Simon" ? "#122131" : "#FC6C1B"), color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          {modeNote ? "Enregistrer" : "Envoyer"}
        </button>
      </div>}
    </div>
  );
}
