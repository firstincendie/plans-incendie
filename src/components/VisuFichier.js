import { useState } from "react";

export default function VisuFichier({ fichier, onClose }) {
  if (!fichier) return null;
  const isPdf   = fichier.type === "application/pdf" || fichier.nom?.toLowerCase().endsWith(".pdf");
  const isImage = fichier.type && fichier.type.startsWith("image/");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: isPdf ? "85vw" : "auto", height: isPdf ? "88vh" : "auto", display: "flex", flexDirection: "column", borderRadius: 10, overflow: "hidden", background: "#1E293B" }}>
        {/* Barre du haut */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#0F172A" }}>
          <span style={{ fontSize: 13, color: "#E2E8F0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
            {isPdf ? "📄" : "🖼️"} {fichier.nom}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <a href={fichier.url} download={fichier.nom}
              style={{ padding: "5px 14px", borderRadius: 6, background: "#122131", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              ⬇ Télécharger
            </a>
            <button onClick={onClose}
              style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "#334155", color: "#E2E8F0", fontSize: 14, cursor: "pointer" }}>✕</button>
          </div>
        </div>
        {/* Contenu */}
        {isPdf && (
          <iframe src={fichier.url} title={fichier.nom} style={{ flex: 1, width: "100%", border: "none" }} />
        )}
        {isImage && (
          <img src={fichier.url} alt={fichier.nom} style={{ maxWidth: "88vw", maxHeight: "80vh", objectFit: "contain" }} />
        )}
        {!isPdf && !isImage && (
          <div style={{ padding: 32, color: "#94A3B8", fontSize: 14, textAlign: "center" }}>
            Aperçu non disponible pour ce type de fichier.<br />
            <a href={fichier.url} download={fichier.nom} style={{ color: "#60A5FA", marginTop: 12, display: "inline-block" }}>⬇ Télécharger directement</a>
          </div>
        )}
      </div>
    </div>
  );
}

export function LogoCliquable({ fichier }) {
  const [visu, setVisu] = useState(false);
  if (!fichier) return null;
  const isImage = fichier.type && fichier.type.startsWith("image/");
  return (
    <>
      <div style={{ display: "inline-block", cursor: "pointer" }} onClick={() => setVisu(true)}>
        {isImage
          ? <img src={fichier.url} alt="logo" style={{ height: 56, maxWidth: 140, objectFit: "contain", border: "1px solid #E5E7EB", borderRadius: 8, padding: 6, background: "#fff" }} />
          : <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 12, color: "#374151" }}>📄 {fichier.nom}</div>
        }
      </div>
      {visu && <VisuFichier fichier={fichier} onClose={() => setVisu(false)} />}
    </>
  );
}

export function ListeFichiers({ fichiers, couleurAccent = "#122131" }) {
  const [visuFichier, setVisuFichier] = useState(null);
  if (!fichiers || fichiers.length === 0) return null;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {fichiers.map((f, i) => {
          const isPdf   = f.type === "application/pdf" || f.nom?.toLowerCase().endsWith(".pdf");
          const isImage = f.type && f.type.startsWith("image/");
          // eslint-disable-next-line no-unused-vars
          const peutApercu = isPdf || isImage;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", cursor: "pointer" }}
              onClick={() => setVisuFichier(f)}>
              <span style={{ fontSize: 18 }}>{isImage ? "🖼️" : "📄"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#122131", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nom}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{f.taille}{f.ajouteLe ? ` · ${f.ajouteLe}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>👁 Voir</span>
              </div>
            </div>
          );
        })}
      </div>
      {visuFichier && <VisuFichier fichier={visuFichier} onClose={() => setVisuFichier(null)} />}
    </>
  );
}
