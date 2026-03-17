import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const STATUT_STYLE = {
  en_attente: { bg: "#FFF7ED", color: "#C2410C", label: "En attente" },
  actif:      { bg: "#F0FDF4", color: "#166534", label: "Actif" },
  refuse:     { bg: "#FEF2F2", color: "#DC2626", label: "Refusé" },
};

const ROLE_LABEL = { admin: "Admin", client: "Client", dessinateur: "Dessinateur" };

export default function GestionUtilisateurs() {
  const [profils, setProfils] = useState([]);
  const [dessinateurs, setDessinateurs] = useState([]);
  const [liaisons, setLiaisons] = useState([]);
  const [filtre, setFiltre] = useState("en_attente");
  const [selectionne, setSelectionne] = useState(null);
  const [notesAdmin, setNotesAdmin] = useState("");
  const [chargement, setChargement] = useState(true);
  const [actionEnCours, setActionEnCours] = useState(false);

  const charger = async () => {
    setChargement(true);
    const [{ data: p }, { data: l }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("client_dessinateurs").select("*"),
    ]);
    setProfils(p || []);
    setDessinateurs((p || []).filter(x => x.role === "dessinateur"));
    setLiaisons(l || []);
    setChargement(false);
  };

  useEffect(() => { charger(); }, []);

  const profils_filtres = profils.filter(p => {
    if (filtre === "tous") return true;
    return p.statut === filtre;
  });

  const nbAttente = profils.filter(p => p.statut === "en_attente").length;

  const ouvrirFiche = (profil) => {
    setSelectionne(profil);
    setNotesAdmin(profil.notes_admin || "");
  };

  const changerStatut = async (profil_id, nouveau_statut) => {
    setActionEnCours(true);
    await supabase.from("profiles").update({ statut: nouveau_statut, notes_admin: notesAdmin }).eq("id", profil_id);
    await charger();
    setSelectionne(null);
    setActionEnCours(false);
  };

  const toggleDessinateur = async (client_id, dessinateur_id) => {
    const existe = liaisons.find(l => l.client_id === client_id && l.dessinateur_id === dessinateur_id);
    if (existe) {
      await supabase.from("client_dessinateurs").delete().eq("id", existe.id);
    } else {
      await supabase.from("client_dessinateurs").insert({ client_id, dessinateur_id });
    }
    const { data: l } = await supabase.from("client_dessinateurs").select("*");
    setLiaisons(l || []);
  };

  const dessinateursClient = (client_id) =>
    liaisons.filter(l => l.client_id === client_id).map(l => l.dessinateur_id);

  const inputStyle = { width: "100%", padding: "8px 10px", border: "1.5px solid #E2E8F0", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#122131" }}>Gestion des utilisateurs</h2>
        <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 14 }}>Gérez les demandes d'accès et les comptes clients</p>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { key: "en_attente", label: "En attente", badge: nbAttente },
          { key: "actif", label: "Actifs" },
          { key: "refuse", label: "Refusés" },
          { key: "tous", label: "Tous" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltre(f.key)}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: filtre === f.key ? "#122131" : "#F1F5F9",
              color: filtre === f.key ? "#fff" : "#475569",
              display: "flex", alignItems: "center", gap: 6
            }}
          >
            {f.label}
            {f.badge > 0 && (
              <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>
                {f.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      {chargement ? (
        <div style={{ color: "#64748B", fontSize: 14 }}>Chargement...</div>
      ) : profils_filtres.length === 0 ? (
        <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
          Aucun utilisateur dans cette catégorie
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {profils_filtres.map(profil => {
            const st = STATUT_STYLE[profil.statut] || STATUT_STYLE.en_attente;
            const dessinIds = dessinateursClient(profil.id);
            return (
              <div key={profil.id}
                style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 12, padding: "16px 20px", cursor: "pointer", transition: "border-color 0.15s" }}
                onClick={() => ouvrirFiche(profil)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#122131" }}>
                      {profil.prenom} {profil.nom}
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, background: "#F1F5F9", color: "#475569", borderRadius: 4, padding: "2px 7px" }}>
                        {ROLE_LABEL[profil.role]}
                      </span>
                    </div>
                    <div style={{ color: "#64748B", fontSize: 13, marginTop: 2 }}>{profil.email}</div>
                    {profil.entreprise && <div style={{ color: "#94A3B8", fontSize: 12, marginTop: 1 }}>{profil.entreprise}{profil.siren ? ` — SIREN ${profil.siren}` : ""}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {profil.role === "client" && dessinIds.length > 0 && (
                      <span style={{ fontSize: 11, color: "#64748B" }}>{dessinIds.length} dessinateur{dessinIds.length > 1 ? "s" : ""}</span>
                    )}
                    <span style={{ background: st.bg, color: st.color, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{st.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal fiche */}
      {selectionne && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setSelectionne(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: 540, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#122131" }}>
                {selectionne.prenom} {selectionne.nom}
              </div>
              <button onClick={() => setSelectionne(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94A3B8" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 20 }}>
              {[
                ["Email", selectionne.email],
                ["Téléphone", selectionne.telephone || "—"],
                ["Entreprise", selectionne.entreprise || "—"],
                ["SIREN", selectionne.siren ? `${selectionne.siren} ${selectionne.siren_valide ? "✅" : "⚠"}` : "—"],
                ["Adresse", selectionne.adresse || "—"],
                ["Ville", selectionne.ville ? `${selectionne.code_postal} ${selectionne.ville}` : "—"],
                ["Rôle", ROLE_LABEL[selectionne.role]],
                ["Demande le", new Date(selectionne.created_at).toLocaleDateString("fr-FR")],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                  <div style={{ fontSize: 14, color: "#122131", marginTop: 2 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Assignation dessinateurs (clients uniquement) */}
            {selectionne.role === "client" && dessinateurs.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                  Dessinateurs assignés
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dessinateurs.map(d => {
                    const assigne = liaisons.find(l => l.client_id === selectionne.id && l.dessinateur_id === d.id);
                    return (
                      <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 12px", borderRadius: 8, background: assigne ? "#EFF6FF" : "#F8FAFC", border: `1.5px solid ${assigne ? "#93C5FD" : "#E2E8F0"}` }}>
                        <input
                          type="checkbox"
                          checked={!!assigne}
                          onChange={() => toggleDessinateur(selectionne.id, d.id)}
                          style={{ cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#122131" }}>{d.prenom} {d.nom}</span>
                        <span style={{ fontSize: 12, color: "#64748B" }}>{d.email}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes admin */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                Notes internes
              </label>
              <textarea
                value={notesAdmin}
                onChange={e => setNotesAdmin(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Notes visibles uniquement par les admins..."
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              {selectionne.statut !== "actif" && (
                <button
                  onClick={() => changerStatut(selectionne.id, "actif")}
                  disabled={actionEnCours}
                  style={{ background: "#166534", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  ✅ Valider le compte
                </button>
              )}
              {selectionne.statut !== "refuse" && (
                <button
                  onClick={() => changerStatut(selectionne.id, "refuse")}
                  disabled={actionEnCours}
                  style={{ background: "#DC2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  ❌ Refuser
                </button>
              )}
              {selectionne.statut === "actif" && (
                <button
                  onClick={() => changerStatut(selectionne.id, selectionne.statut)}
                  disabled={actionEnCours}
                  style={{ background: "#386CA3", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  💾 Sauvegarder
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
