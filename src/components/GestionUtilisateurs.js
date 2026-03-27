import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function GestionUtilisateurs() {
  const [comptes, setComptes] = useState([]);
  const [dessinateurs, setDessinateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", prenom: "", nom: "", role: "utilisateur" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [assignationsEdit, setAssignationsEdit] = useState([]); // [{ dessinateur_id, is_default }]
  const [loadingAssignations, setLoadingAssignations] = useState(false);
  useEffect(() => { chargerComptes(); }, []);

  async function chargerComptes() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setComptes(data);
      setDessinateurs(data.filter(p => p.role === "dessinateur" && p.statut === "actif"));
    }
    setLoading(false);
  }

  async function mettreAJourStatut(id, statut) {
    const { error } = await supabase.from("profiles").update({ statut }).eq("id", id);
    if (!error) {
      setComptes(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
      if (["actif", "refuse", "banni"].includes(statut)) {
        const compte = comptes.find(c => c.id === id);
        if (compte) {
          await supabase.functions.invoke("notify-activation", {
            body: { to: compte.email, prenom: compte.prenom, statut },
          });
        }
      }
    }
  }

  async function sauvegarderEdit() {
    if (!editForm || !selected) return;
    setSaving(true);
    setSaveError("");
    // Update profile (without dessinateur_id — managed via utilisateur_dessinateurs)
    const { error } = await supabase.from("profiles").update({
      prenom: editForm.prenom,
      nom: editForm.nom,
      role: editForm.role,
      statut: editForm.statut,
      is_owner: editForm.is_owner,
    }).eq("id", selected.id);
    if (error) { setSaveError(error.message); setSaving(false); return; }

    // Atomic save of dessinateur assignments via RPC
    if (editForm.role === "utilisateur") {
      const { error: rpcError } = await supabase.rpc("set_dessinateurs_utilisateur", {
        p_utilisateur_id: selected.id,
        p_dessinateurs: assignationsEdit,
      });
      if (rpcError) { setSaveError(rpcError.message); setSaving(false); return; }
    }

    setComptes(prev => prev.map(c => c.id === selected.id ? { ...c, ...editForm } : c));
    setSelected(prev => ({ ...prev, ...editForm }));
    setEditForm(null);
    setSaving(false);
  }

  async function supprimerCompte(id) {
    if (!window.confirm("Supprimer définitivement ce compte ? Cette action est irréversible.")) return;
    // Supprimer via Supabase Admin API (Edge Function nécessaire pour supprimer auth.users)
    const { error } = await supabase.functions.invoke("delete-user", { body: { user_id: id } });
    if (!error) {
      setComptes(prev => prev.filter(c => c.id !== id));
      if (selected?.id === id) setSelected(null);
    } else {
      alert("Erreur lors de la suppression : " + error.message);
    }
  }

  async function renvoyerResetMdp(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (!error) alert(`Email de réinitialisation envoyé à ${email}`);
    else alert("Erreur : " + error.message);
  }

  async function creerCompte() {
    if (!createForm.email || !createForm.prenom || !createForm.nom) return;
    setCreating(true);
    setCreateError("");
    // Invite via Edge Function (Supabase Admin API)
    const { error } = await supabase.functions.invoke("invite-user", {
      body: { email: createForm.email, prenom: createForm.prenom, nom: createForm.nom, role: createForm.role },
    });
    if (error) { setCreateError(error.message); setCreating(false); return; }
    setShowCreateModal(false);
    setCreateForm({ email: "", prenom: "", nom: "", role: "utilisateur" });
    setCreating(false);
    await chargerComptes();
  }

  async function handleSelectCompte(c) {
    setSelected(c);
    setEditForm({ prenom: c.prenom, nom: c.nom, role: c.role, statut: c.statut, is_owner: c.is_owner || false });
    setAssignationsEdit([]);
    setLoadingAssignations(true);
    const { data } = await supabase
      .from("utilisateur_dessinateurs")
      .select("dessinateur_id, is_default")
      .eq("utilisateur_id", c.id);
    setAssignationsEdit(data || []);
    setLoadingAssignations(false);
  }

  const comptesFiltres = filtre === "tous" ? comptes : comptes.filter(c => c.statut === filtre);

  const statutBadge = (statut) => {
    const styles = {
      en_attente: { bg: "#FEF3C7", color: "#92400E", label: "En attente" },
      actif: { bg: "#D1FAE5", color: "#065F46", label: "Actif" },
      refuse: { bg: "#FEE2E2", color: "#991B1B", label: "Refusé" },
      banni: { bg: "#F3F4F6", color: "#374151", label: "Banni" },
    };
    const s = styles[statut] || styles.en_attente;
    return <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
  };

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 };

  const filtresBtns = [
    { key: "tous", label: "Tous" },
    { key: "en_attente", label: "En attente" },
    { key: "actif", label: "Actifs" },
    { key: "refuse", label: "Refusés" },
    { key: "banni", label: "Bannis" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Utilisateurs</h1>
        <button onClick={() => setShowCreateModal(true)}
          style={{ background: "#122131", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {filtresBtns.map(f => {
          const count = f.key === "tous" ? comptes.length : comptes.filter(c => c.statut === f.key).length;
          return (
            <button key={f.key} onClick={() => setFiltre(f.key)}
              style={{ padding: "5px 12px", borderRadius: 20, border: "1.5px solid " + (filtre === f.key ? "#122131" : "#E5E7EB"), background: filtre === f.key ? "#122131" : "#fff", color: filtre === f.key ? "#fff" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {f.label} <span style={{ opacity: 0.65 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#94A3B8", padding: 40 }}>Chargement...</div>
      ) : (
        <>
          {/* Tableau desktop */}
          <div className="gu-table">
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <span>Compte</span><span>Rôle</span><span>Statut</span><span></span>
              </div>
              {comptesFiltres.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucun compte.</div>}
              {comptesFiltres.map(c => {
                const maitre = c.master_id ? comptes.find(p => p.id === c.master_id) : null;
                return (
                  <div key={c.id} onClick={() => handleSelectCompte(c)}
                    style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1.4fr", padding: "12px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#F8FAFC" : "transparent", transition: "background 0.1s" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.prenom} {c.nom}</span>
                        {c.is_owner && <span style={{ fontSize: 9, color: "#FC6C1B", fontWeight: 800, background: "#FFF3EE", borderRadius: 4, padding: "1px 5px" }}>OWNER</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{c.email}</div>
                      {maitre && <div style={{ fontSize: 10, color: "#6B7280", background: "#F1F5F9", borderRadius: 4, padding: "1px 6px", marginTop: 2, display: "inline-block" }}>↳ {maitre.prenom} {maitre.nom}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: "#374151" }}>{c.role === "dessinateur" ? "Dessinateur" : "Utilisateur"}</div>
                    <div>{statutBadge(c.statut)}</div>
                    <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                      {c.statut === "en_attente" && (
                        <>
                          <button onClick={() => mettreAJourStatut(c.id, "actif")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#D1FAE5", color: "#065F46", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Activer</button>
                          <button onClick={() => mettreAJourStatut(c.id, "refuse")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#FEE2E2", color: "#991B1B", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Refuser</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cartes mobile */}
          <div className="gu-cards">
            {comptesFiltres.length === 0 && <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, padding: 16 }}>Aucun compte.</div>}
            {comptesFiltres.map(c => {
              const maitre = c.master_id ? comptes.find(p => p.id === c.master_id) : null;
              return (
                <div key={c.id} onClick={() => handleSelectCompte(c)}
                  style={{ background: "#fff", border: "1.5px solid " + (selected?.id === c.id ? "#122131" : "#E5E7EB"), borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.prenom} {c.nom}</span>
                        {c.is_owner && <span style={{ fontSize: 9, color: "#FC6C1B", fontWeight: 800, background: "#FFF3EE", borderRadius: 4, padding: "1px 5px" }}>OWNER</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{c.email}</div>
                      {maitre && <div style={{ fontSize: 10, color: "#6B7280", background: "#F1F5F9", borderRadius: 4, padding: "1px 6px", marginTop: 3, display: "inline-block" }}>↳ {maitre.prenom} {maitre.nom}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      {statutBadge(c.statut)}
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{c.role === "dessinateur" ? "Dessinateur" : "Utilisateur"}</span>
                    </div>
                  </div>
                  {c.statut === "en_attente" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => mettreAJourStatut(c.id, "actif")} style={{ flex: 1, padding: "7px", borderRadius: 7, border: "none", background: "#D1FAE5", color: "#065F46", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Activer</button>
                      <button onClick={() => mettreAJourStatut(c.id, "refuse")} style={{ flex: 1, padding: "7px", borderRadius: 7, border: "none", background: "#FEE2E2", color: "#991B1B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Refuser</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Panneau édition */}
      {selected && editForm && (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 16 }}>
          {/* En-tête panneau */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #F3F4F6" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#122131" }}>{selected.prenom} {selected.nom}</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{selected.email}</div>
            </div>
            <button onClick={() => { setSelected(null); setEditForm(null); setSaveError(""); }} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
          </div>

          {/* Champs principaux */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div><label style={labelStyle}>Prénom</label><input value={editForm.prenom} onChange={e => setEditForm({ ...editForm, prenom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Nom</label><input value={editForm.nom} onChange={e => setEditForm({ ...editForm, nom: e.target.value })} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Rôle</label>
              <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={inputStyle}>
                <option value="utilisateur">Utilisateur</option>
                <option value="dessinateur">Dessinateur</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Statut</label>
              <select value={editForm.statut} onChange={e => setEditForm({ ...editForm, statut: e.target.value })} style={inputStyle}>
                <option value="en_attente">En attente</option>
                <option value="actif">Actif</option>
                <option value="refuse">Refusé</option>
                <option value="banni">Banni</option>
              </select>
            </div>
          </div>

          {/* Dessinateurs assignés */}
          {editForm.role === "utilisateur" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Dessinateurs assignés</label>
              {loadingAssignations ? (
                <div style={{ fontSize: 12, color: "#94A3B8" }}>Chargement...</div>
              ) : dessinateurs.length === 0 ? (
                <div style={{ fontSize: 12, color: "#94A3B8" }}>Aucun dessinateur actif disponible.</div>
              ) : (
                <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                  {dessinateurs.map(d => {
                    const assignation = assignationsEdit.find(a => a.dessinateur_id === d.id);
                    const estCoche = !!assignation;
                    const estDefaut = assignation?.is_default || false;
                    return (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #F3F4F6", background: estCoche ? "#F8FAFC" : "transparent" }}>
                        <input type="checkbox" checked={estCoche} onChange={e => {
                          if (e.target.checked) {
                            setAssignationsEdit([...assignationsEdit, { dessinateur_id: d.id, is_default: assignationsEdit.length === 0 }]);
                          } else {
                            const restantes = assignationsEdit.filter(a => a.dessinateur_id !== d.id);
                            if (estDefaut && restantes.length > 0) restantes[0] = { ...restantes[0], is_default: true };
                            setAssignationsEdit(restantes);
                          }
                        }} />
                        <span style={{ fontSize: 13, flex: 1 }}>{d.prenom} {d.nom}</span>
                        {estCoche && (
                          <button onClick={() => setAssignationsEdit(prev => prev.map(a => ({ ...a, is_default: a.dessinateur_id === d.id })))}
                            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: estDefaut ? "#FFF3EE" : "#fff", color: estDefaut ? "#FC6C1B" : "#9CA3AF", cursor: "pointer", fontWeight: estDefaut ? 700 : 400 }}>
                            {estDefaut ? "★ Défaut" : "☆ Défaut"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Options */}
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={editForm.is_owner} onChange={e => setEditForm({ ...editForm, is_owner: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Compte owner <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(accès gestion utilisateurs)</span></span>
            </label>
            {selected.master_id && (() => {
              const maitre = comptes.find(p => p.id === selected.master_id);
              return (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Sous-compte de</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#122131" }}>{maitre ? `${maitre.prenom} ${maitre.nom}` : "—"}</div>
                  </div>
                  <button onClick={async () => {
                    await supabase.from("profiles").update({ master_id: null }).eq("id", selected.id);
                    setComptes(prev => prev.map(c => c.id === selected.id ? { ...c, master_id: null } : c));
                    setSelected(prev => ({ ...prev, master_id: null }));
                  }} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Détacher
                  </button>
                </div>
              );
            })()}
          </div>

          {saveError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>Erreur : {saveError}</div>}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => renvoyerResetMdp(selected.email)} style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #E5E7EB", background: "#fff", fontSize: 12, cursor: "pointer", color: "#6B7280" }}>
                🔑 Reset mot de passe
              </button>
              <button onClick={() => supprimerCompte(selected.id)} style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #FECACA", background: "#FEF2F2", fontSize: 12, cursor: "pointer", color: "#DC2626", fontWeight: 600 }}>
                Supprimer
              </button>
            </div>
            <button onClick={sauvegarderEdit} disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {saving ? "Enregistrement..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      )}

      {/* Modal création */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 460, maxWidth: "90vw" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Nouveau compte</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={labelStyle}>Prénom *</label><input value={createForm.prenom} onChange={e => setCreateForm({ ...createForm, prenom: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Nom *</label><input value={createForm.nom} onChange={e => setCreateForm({ ...createForm, nom: e.target.value })} style={inputStyle} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={labelStyle}>Email *</label><input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} style={inputStyle} /></div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Rôle</label>
              <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} style={inputStyle}>
                <option value="utilisateur">Utilisateur</option>
                <option value="dessinateur">Dessinateur</option>
              </select>
            </div>
            {createError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>Erreur : {createError}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowCreateModal(false); setCreateForm({ email: "", prenom: "", nom: "", role: "utilisateur" }); setCreateError(""); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={creerCompte} disabled={creating || !createForm.email || !createForm.prenom || !createForm.nom}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {creating ? "Création..." : "Créer et inviter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
