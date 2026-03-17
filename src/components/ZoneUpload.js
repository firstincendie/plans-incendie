import { useRef } from "react";
import { fichierAvecDate } from "../helpers";

export default function ZoneUpload({ label, fichiers, onAjouter, onSupprimer, accept, maxFichiers = 10, unique = false }) {
  const inputRef = useRef();
  function handleFiles(e) {
    const nouveaux = Array.from(e.target.files).map(f => fichierAvecDate({
      nom: f.name, taille: (f.size / 1024).toFixed(0) + " Ko",
      url: URL.createObjectURL(f), type: f.type,
    }));
    if (unique) { onAjouter([nouveaux[0]]); }
    else        { onAjouter([...fichiers, ...nouveaux].slice(0, maxFichiers)); }
    e.target.value = "";
  }
  const isImage = (f) => f.type && f.type.startsWith("image/");
  return (
    <div>
      {label ? <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</label> : null}
      <div onClick={() => inputRef.current.click()}
        style={{ border: "1.5px dashed #D1D5DB", borderRadius: 8, padding: "14px", textAlign: "center", cursor: "pointer", background: "#F9FAFB", marginBottom: fichiers.length > 0 ? 10 : 0 }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}>📎</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{unique ? "Cliquer pour choisir" : `Ajouter fichiers (max ${maxFichiers})`}</div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{accept}</div>
        <input ref={inputRef} type="file" accept={accept} multiple={!unique} style={{ display: "none" }} onChange={handleFiles} />
      </div>
      {fichiers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {fichiers.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}>
              <span style={{ fontSize: 18 }}>{isImage(f) ? "🖼️" : "📄"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "#122131", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nom}</a>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{f.taille} · {f.ajouteLe || "—"}</div>
              </div>
              <button onClick={() => onSupprimer(i)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 14, padding: 0, flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
