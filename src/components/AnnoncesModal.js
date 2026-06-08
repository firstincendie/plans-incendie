import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// Modale affichée à la connexion : empile les annonces actives non lues.
// L'utilisateur ferme → marque toutes comme lues.
export default function AnnoncesModal({ profil }) {
  const [annonces, setAnnonces] = useState([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      // Annonces actives + lectures de l'utilisateur courant
      const [{ data: actives }, { data: lectures }] = await Promise.all([
        supabase.from("annonces").select("*").eq("active", true).order("created_at", { ascending: false }),
        supabase.from("annonce_lectures").select("annonce_id").eq("user_id", profil.id),
      ]);
      if (annule) return;
      const luSet = new Set((lectures || []).map(l => l.annonce_id));
      const nonLues = (actives || []).filter(a => !luSet.has(a.id));
      setAnnonces(nonLues);
      setPret(true);
    })();
    return () => { annule = true; };
  }, [profil.id]);

  async function fermer() {
    // Marque toutes les annonces affichées comme lues
    if (annonces.length > 0) {
      const rows = annonces.map(a => ({ annonce_id: a.id, user_id: profil.id }));
      await supabase.from("annonce_lectures").upsert(rows, { onConflict: "annonce_id,user_id" });
    }
    setAnnonces([]);
  }

  if (!pret || annonces.length === 0) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 480, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
            📢 {annonces.length > 1 ? `${annonces.length} nouveaux messages` : "Nouveau message"}
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {annonces.map(a => (
            <div key={a.id} style={{ border: `1px solid ${a.type === "warning" ? "#FECACA" : "#BFDBFE"}`, background: a.type === "warning" ? "#FEF2F2" : "#EFF6FF", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{a.type === "warning" ? "⚠️" : "ℹ️"}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: a.type === "warning" ? "#9F1239" : "#1E40AF" }}>{a.titre}</span>
              </div>
              <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{a.contenu}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={fermer}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
