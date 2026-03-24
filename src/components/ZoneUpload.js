import { useRef, useState } from "react";
import { supabase } from "../supabase";
import { fichierAvecDate } from "../helpers";

export default function ZoneUpload({ label, fichiers, onAjouter, onSupprimer, accept, maxFichiers = 10, unique = false }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  async function handleFiles(e) {
    const files = Array.from(e.target.files);
    e.target.value = "";
    setUploading(true);
    const nouveaux = await Promise.all(files.map(async f => {
      const chemin = `${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("fichiers").upload(chemin, f);
      if (error) { console.error("Upload:", error); return null; }
      const { data: urlData } = supabase.storage.from("fichiers").getPublicUrl(chemin);
      return fichierAvecDate({ nom: f.name, taille: (f.size / 1024).toFixed(0) + " Ko", url: urlData.publicUrl, type: f.type });
    }));
    setUploading(false);
    const valides = nouveaux.filter(Boolean);
    if (unique) { onAjouter([valides[0]]); }
    else        { onAjouter([...fichiers, ...valides].slice(0, maxFichiers)); }
  }
  const isImage = (f) => f.type && f.type.startsWith("image/");
  return (
    <div>
      {label ? <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</label> : null}
      <div onClick={() => !uploading && inputRef.current.click()}
        style={{ border: "1.5px dashed #D1D5DB", borderRadius: 8, padding: "14px", textAlign: "center", cursor: uploading ? "wait" : "pointer", background: "#F9FAFB", marginBottom: fichiers.length > 0 ? 10 : 0, opacity: uploading ? 0.6 : 1 }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}>{uploading ? "⏳" : "📎"}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{uploading ? "Envoi en cours..." : unique ? "Cliquer pour choisir" : `Ajouter fichiers (max ${maxFichiers})`}</div>
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
