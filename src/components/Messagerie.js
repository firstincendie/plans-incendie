import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase";
import { analyserMessage, fichierAvecDate } from "../helpers";
import VisuFichier from "./VisuFichier";

export default function Messagerie({ selected, msgInput, setMsgInput, onEnvoyer, auteurActif, allowFichier = false }) {
  const [fichierMsg, setFichierMsg]     = useState([]);
  const [alerte, setAlerte]             = useState(null);
  const [visuFichier, setVisuFichier]   = useState(null);
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
              <div style={{ background: moi ? (auteurActif === "Simon" ? "#EEF3F8" : "#FFF3ED") : "#F3F4F6", color: moi ? (auteurActif === "Simon" ? "#122131" : "#9A3D08") : "#111827", padding: "8px 12px", borderRadius: 10, fontSize: 13 }}>
                {m.texte}
                {m.fichiers && m.fichiers.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {m.fichiers.map((f, j) => (
                      <button key={j} onClick={() => setVisuFichier(f)}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, border: `1px solid ${moi ? (auteurActif === "Simon" ? "#C5D5E4" : "#FDDCC8") : "#E5E7EB"}`, background: "#fff", fontSize: 11, color: moi ? (auteurActif === "Simon" ? "#122131" : "#9A3D08") : "#374151", cursor: "pointer" }}>
                        📎 {f.nom} <span style={{ fontSize: 10, color: "#9CA3AF" }}>👁</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {visuFichier && <VisuFichier fichier={visuFichier} onClose={() => setVisuFichier(null)} />}
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
          style={{ background: auteurActif === "Simon" ? "#122131" : "#FC6C1B", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          Envoyer
        </button>
      </div>
    </div>
  );
}
