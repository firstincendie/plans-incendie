import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// Modèles par défaut (utilisés tant que le compte n'a rien personnalisé).
const DEFAUTS = {
  validation_envoi: {
    sujet: "Validation de votre plan de sécurité incendie — {{nom_plan}}",
    corps: "Bonjour {{prenom}},\n\nVotre plan de sécurité incendie « {{nom_plan}} » est prêt à être validé.\n\nCliquez sur le bouton ci-dessous pour le vérifier, puis le valider ou signaler les points à corriger.\n\n{{lien}}\n\n{{signature}}",
  },
  validation_relance: {
    sujet: "Rappel — validation de votre plan {{nom_plan}}",
    corps: "Bonjour {{prenom}},\n\nSauf erreur de notre part, votre plan « {{nom_plan}} » est toujours en attente de votre validation.\n\n{{lien}}\n\n{{signature}}",
  },
  signature: {
    corps: "Cordialement,\n{{societe}}",
  },
};

const VARS = [
  ["{{prenom}}", "Prénom du destinataire"],
  ["{{nom_plan}}", "Nom du plan"],
  ["{{ref}}", "N° de commande"],
  ["{{lien}}", "Bouton de validation"],
  ["{{societe}}", "Votre société"],
  ["{{signature}}", "Votre signature"],
];

export default function ReglagesEmails({ profil }) {
  const [mod, setMod] = useState(DEFAUTS);
  const [statut, setStatut] = useState("chargement"); // chargement | pret | enreg | ok | erreur

  useEffect(() => {
    supabase.from("email_modeles").select("cle, sujet, corps").eq("user_id", profil.id).then(({ data }) => {
      const base = JSON.parse(JSON.stringify(DEFAUTS));
      (data || []).forEach((r) => {
        base[r.cle] = { ...(base[r.cle] || {}), ...(r.sujet != null ? { sujet: r.sujet } : {}), ...(r.corps != null ? { corps: r.corps } : {}) };
      });
      setMod(base);
      setStatut("pret");
    });
  }, [profil.id]);

  const set = (cle, champ, val) => setMod((m) => ({ ...m, [cle]: { ...m[cle], [champ]: val } }));

  async function enregistrer() {
    setStatut("enreg");
    const rows = [
      { user_id: profil.id, cle: "validation_envoi", sujet: mod.validation_envoi.sujet, corps: mod.validation_envoi.corps, updated_at: new Date().toISOString() },
      { user_id: profil.id, cle: "validation_relance", sujet: mod.validation_relance.sujet, corps: mod.validation_relance.corps, updated_at: new Date().toISOString() },
      { user_id: profil.id, cle: "signature", corps: mod.signature.corps, updated_at: new Date().toISOString() },
    ];
    const { error } = await supabase.from("email_modeles").upsert(rows, { onConflict: "user_id,cle" });
    setStatut(error ? "erreur" : "ok");
    if (!error) setTimeout(() => setStatut("pret"), 2500);
  }

  const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", color: "#111827" };
  const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 6, display: "block" };

  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Emails de validation client</div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16, lineHeight: 1.5 }}>
        Personnalisez les emails envoyés au client (ou au technicien) pour la validation des plans.
      </div>

      {/* Variables */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {VARS.map(([v, desc]) => (
          <span key={v} title={desc} style={{ fontSize: 11, fontWeight: 600, background: "#F3F7FC", border: "1px solid #E1E8F1", color: "#2C4E74", padding: "3px 8px", borderRadius: 6 }}>{v}</span>
        ))}
      </div>

      {statut === "chargement" ? (
        <div style={{ fontSize: 13, color: "#9CA3AF" }}>Chargement…</div>
      ) : (
        <>
          {[["validation_envoi", "Email d'envoi", "Envoyé quand vous transmettez le lien de validation."],
            ["validation_relance", "Email de relance", "Envoyé automatiquement tous les 7 jours si le lien est en attente (si les relances sont activées)."]].map(([cle, titre, desc]) => (
            <div key={cle} style={{ paddingBottom: 20, marginBottom: 20, borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>{titre}</div>
              <div style={{ fontSize: 11.5, color: "#9CA3AF", marginBottom: 12 }}>{desc}</div>
              <label style={labelStyle}>Sujet</label>
              <input value={mod[cle].sujet || ""} onChange={(e) => set(cle, "sujet", e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
              <label style={labelStyle}>Corps du message</label>
              <textarea value={mod[cle].corps || ""} onChange={(e) => set(cle, "corps", e.target.value)} rows={7} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
            </div>
          ))}

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>Signature</div>
            <div style={{ fontSize: 11.5, color: "#9CA3AF", marginBottom: 12 }}>Ajoutée en bas de chaque email via la variable {"{{signature}}"}.</div>
            <textarea value={mod.signature.corps || ""} onChange={(e) => set("signature", "corps", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={enregistrer} disabled={statut === "enreg"}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 700, cursor: statut === "enreg" ? "wait" : "pointer" }}>
              {statut === "enreg" ? "Enregistrement…" : "Enregistrer"}
            </button>
            {statut === "ok" && <span style={{ fontSize: 13, color: "#047857", fontWeight: 600 }}>✓ Enregistré</span>}
            {statut === "erreur" && <span style={{ fontSize: 13, color: "#DC2626", fontWeight: 600 }}>Échec de l'enregistrement</span>}
          </div>
        </>
      )}
    </div>
  );
}
