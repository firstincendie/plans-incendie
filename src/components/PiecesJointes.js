import { useState } from "react";
import VisuFichier from "./VisuFichier";

// Affiche une liste de pièces jointes cliquables (ouvre l'aperçu plein écran).
// fichiers : [{ nom, url, type, taille }]
export default function PiecesJointes({ fichiers, compact = false }) {
  const [visu, setVisu] = useState(null);
  if (!fichiers || fichiers.length === 0) return null;
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: compact ? 6 : 8 }}>
        {fichiers.map((f, i) => {
          const isImage = f.type && f.type.startsWith("image/");
          return (
            <button key={i} onClick={() => setVisu(f)}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#fff", fontSize: 11, color: "#374151", cursor: "pointer" }}>
              {isImage ? "🖼️" : "📎"} {f.nom} <span style={{ fontSize: 10, color: "#9CA3AF" }}>👁</span>
            </button>
          );
        })}
      </div>
      {visu && <VisuFichier fichier={visu} onClose={() => setVisu(null)} />}
    </>
  );
}
