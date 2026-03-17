import { useState } from "react";
import { formatDateLong } from "../helpers";
import VisuFichier from "./VisuFichier";

export default function HistoriqueVersions({ versions }) {
  const [showOld, setShowOld]       = useState(false);
  const [visuFichier, setVisuFichier] = useState(null);
  if (!versions || versions.length === 0) return null;
  const sorted   = [...versions].sort((a, b) => b.numero - a.numero);
  const derniere = sorted[0];
  const anciennes = sorted.slice(1);

  function BoutonsFichiers({ fichiers, couleur = "#5B21B6", borderCouleur = "#DDD6FE" }) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(fichiers || []).map((f, j) => (
          <button key={j} onClick={() => setVisuFichier(f)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, border: `1px solid ${borderCouleur}`, background: "#fff", fontSize: 11, color: couleur, cursor: "pointer", fontWeight: 500 }}>
            📄 {f.nom} <span style={{ fontSize: 10, color: "#9CA3AF" }}>👁</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 10 }}>
          📁 Versions déposées ({versions.length})
        </div>

        {/* Dernière version */}
        <div style={{ border: "1.5px solid #DDD6FE", borderRadius: 10, padding: "12px 16px", background: "#F5F3FF", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ background: "#7C3AED", color: "#fff", padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>v{derniere.numero}</span>
              <span style={{ fontSize: 12, color: "#5B21B6", fontWeight: 600 }}>Dernière version</span>
            </div>
            <div style={{ fontSize: 11, color: "#7C3AED" }}>{formatDateLong(derniere.created_at)}</div>
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 8 }}>Déposée par {derniere.deposee_par}</div>
          <BoutonsFichiers fichiers={derniere.fichiers} couleur="#5B21B6" borderCouleur="#DDD6FE" />
        </div>

        {/* Anciennes versions */}
        {anciennes.length > 0 && (
          <>
            <button onClick={() => setShowOld(!showOld)}
              style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontWeight: 600 }}>
              {showOld ? "▲ Masquer les anciennes versions" : `▼ Voir les ${anciennes.length} ancienne${anciennes.length > 1 ? "s" : ""} version${anciennes.length > 1 ? "s" : ""}`}
            </button>
            {showOld && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {anciennes.map(v => (
                  <div key={v.id} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", background: "#FAFAFA", opacity: 0.75 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ background: "#E5E7EB", color: "#6B7280", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>v{v.numero}</span>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{formatDateLong(v.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>Déposée par {v.deposee_par}</div>
                    <BoutonsFichiers fichiers={v.fichiers} couleur="#6B7280" borderCouleur="#E5E7EB" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {visuFichier && <VisuFichier fichier={visuFichier} onClose={() => setVisuFichier(null)} />}
    </>
  );
}
