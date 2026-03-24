import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { formatDateMsg, formatDateCourt } from "../helpers";
import { planVide } from "../constants";
import Badge from "./Badge";
import BarreFiltres, { appliquerFiltresTri } from "./BarreFiltres";
import Messagerie from "./Messagerie";
import DetailCommandeModal from "./DetailCommandeModal";
import ZoneUpload from "./ZoneUpload";
import TableauPlans from "./TableauPlans";
import PageReglages from "./PageReglages";
import PageMonCompte from "./PageMonCompte";
import GestionUtilisateurs from "./GestionUtilisateurs";
import BlocAdresse from "./BlocAdresse";

export default function VueUtilisateur({ session, profil, onProfilUpdate }) {
  const [commandes, setCommandes] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState("commandes");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showMenuProfil, setShowMenuProfil] = useState(false);
  const [filtres, setFiltres] = useState({ statut: "", type: "", periode: "" });
  const [tri, setTri] = useState({ col: "created_at", dir: "desc" });
  const [showTerminees, setShowTerminees] = useState(false);
  const [showArchivees, setShowArchivees] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const [showModifModal, setShowModifModal] = useState(false);
  const [modifMsg, setModifMsg] = useState("");
  const [modifFichiers, setModifFichiers] = useState([]);
  const [envoyantModif, setEnvoyantModif] = useState(false);
  const [showValidModal, setShowValidModal] = useState(false);
  const [validant, setValidant] = useState(false);
  const [sousComptes, setSousComptes] = useState([]);
  const [userFilter, setUserFilter] = useState(null); // null = tous, uuid = sous-compte filtré

  const formVide = () => ({
    utilisateur_id: profil.id,
    nom_plan: "",
    client_nom: "", client_prenom: "", client_email: "", client_telephone: "",
    adresse1: "", adresse2: "", code_postal: "", ville: "",
    delai: "", plans: [planVide()], fichiersPlan: [], logoClient: [], instructions: "",
  });
  const [form, setForm] = useState(formVide());

  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();

  const nav = [
    { id: "commandes", label: "Commandes", icon: "📋" },
    { id: "reglages", label: "Réglages", icon: "⚙️" },
    { id: "mon-compte", label: "Mon compte", icon: "👤" },
    ...(profil.is_owner ? [{ id: "utilisateurs", label: "Utilisateurs", icon: "🛠️" }] : []),
  ];

  useEffect(() => {
    chargerTout();
    const canal = supabase
      .channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        setCommandes(prev => prev.map(c =>
          c.id === msg.commande_id ? { ...c, messages: [...c.messages, msg] } : c
        ));
        setSelected(prev =>
          prev && prev.id === msg.commande_id ? { ...prev, messages: [...prev.messages, msg] } : prev
        );
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, []); // eslint-disable-line

  async function chargerTout() {
    setLoading(true);
    const [{ data: cmd }, { data: ver }, { data: sub }] = await Promise.all([
      supabase.from("commandes").select("*, messages(*)").order("created_at", { ascending: false }),
      supabase.from("versions").select("*").order("numero", { ascending: true }),
      supabase.from("profiles").select("id, prenom, nom").eq("master_id", profil.id),
    ]);
    if (cmd) setCommandes(cmd.map(c => ({
      ...c,
      plans: c.plans || [],
      fichiersPlan: c.fichiers_plan || [],
      logoClient: c.logo_client || [],
      plansFinalises: c.plans_finalises || [],
      messages: (c.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    })));
    if (ver) setVersions(ver);
    if (sub) setSousComptes(sub);
    setLoading(false);
  }

  async function creerCommande() {
    if (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0) return;
    setSaving(true);
    setSaveError("");
    const ref = "CMD-" + String(commandes.length + 1).padStart(3, "0");
    const { data, error } = await supabase.from("commandes").insert([{
      ref,
      utilisateur_id: form.utilisateur_id,
      nom_plan: form.nom_plan,
      client_nom: form.client_nom, client_prenom: form.client_prenom,
      client_email: form.client_email, client_telephone: form.client_telephone,
      adresse1: form.adresse1, adresse2: form.adresse2,
      code_postal: form.code_postal, ville: form.ville,
      delai: form.delai, plans: form.plans,
      fichiers_plan: form.fichiersPlan, logo_client: form.logoClient,
      instructions: form.instructions,
      plans_finalises: [], statut: "En attente",
    }]).select("*, messages(*)").single();
    if (error) { setSaveError(error.message); setSaving(false); return; }
    if (data) {
      const nouvelleCommande = {
        ...data,
        plans: data.plans || [],
        fichiersPlan: data.fichiers_plan || [],
        logoClient: data.logo_client || [],
        plansFinalises: [],
        messages: [],
      };
      if (form.instructions?.trim()) {
        const { data: msg } = await supabase.from("messages").insert([{
          commande_id: data.id, auteur: auteurNom, texte: form.instructions.trim(),
          fichiers: [], date: formatDateMsg(),
        }]).select().single();
        if (msg) nouvelleCommande.messages = [msg];
      }
      setCommandes(prev => [nouvelleCommande, ...prev]);
    }
    // Notifier le dessinateur de la nouvelle commande
    supabase.functions.invoke("notify-commande", {
      body: { utilisateur_id: form.utilisateur_id, nom_plan: form.nom_plan, ref },
    });
    setSaving(false);
    setShowForm(false);
    setForm(formVide());
  }

  async function changerStatut(id, statut) {
    const { error } = await supabase.from("commandes").update({ statut }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
    }
  }

  async function envoyerMessage(commandeId, auteur, texte, fichiers = []) {
    const { data, error } = await supabase.from("messages").insert([{
      commande_id: commandeId, auteur, texte: texte || "", fichiers, date: formatDateMsg(),
    }]).select().single();
    if (!error && data) {
      setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, messages: [...c.messages, data] } : c));
      if (selected?.id === commandeId) setSelected(prev => ({ ...prev, messages: [...prev.messages, data] }));
      // Notifier l'autre partie du nouveau message
      supabase.functions.invoke("notify-message", {
        body: {
          commande_id: commandeId,
          auteur_id: session.user.id,
          auteur_nom: auteurNom,
          nom_plan: commandes.find(c => c.id === commandeId)?.nom_plan ?? "",
        },
      });
    }
  }

  async function envoyerDemandeModification() {
    if (!modifMsg.trim() || !selected) return;
    setEnvoyantModif(true);
    await envoyerMessage(selected.id, auteurNom, modifMsg, modifFichiers);
    await changerStatut(selected.id, "Modification dessinateur");
    setModifMsg(""); setModifFichiers([]); setShowModifModal(false); setEnvoyantModif(false);
  }

  async function validerCommande() {
    if (!selected) return;
    setValidant(true);
    await changerStatut(selected.id, "Validé");
    await envoyerMessage(selected.id, auteurNom, "✅ Commande validée. Merci pour votre travail !");
    setShowValidModal(false); setValidant(false);
  }

  async function archiver(id) {
    const { error } = await supabase.from("commandes").update({ statut: "Archivé" }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: "Archivé" } : c));
      setSelected(null);
    }
  }

  const commandesVisibles = userFilter ? commandes.filter(c => c.utilisateur_id === userFilter) : commandes;
  const cmdFiltrees = appliquerFiltresTri(commandesVisibles, filtres, tri);
  const actives   = cmdFiltrees.filter(c => c.statut !== "Validé" && c.statut !== "Archivé");
  const terminees = cmdFiltrees.filter(c => c.statut === "Validé");
  const archivees = cmdFiltrees.filter(c => c.statut === "Archivé");
  const versionsSelected = selected ? versions.filter(v => v.commande_id === selected.id) : [];

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 };

  return (
    <div onClick={() => showMenuProfil && setShowMenuProfil(false)} style={{ display: "flex", height: "100dvh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}>

      {/* Sidebar */}
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px 0 12px", gap: 4, position: "fixed", top: 0, height: "100dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
          <div style={{ width: 32, height: 32, background: "#122131", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontSize: 16 }}>🔥</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>First Incendie</span>
        </div>
        {nav.map(item => (
          <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#E8EDF2" : "transparent", color: vue === item.id ? "#122131" : "#6B7280", textAlign: "left", width: "100%" }}>
            <span>{item.icon}</span><span>{item.label}</span>
          </button>
        ))}
        <div style={{ marginTop: "auto", position: "relative", paddingBottom: 12 }}>
          {showMenuProfil && (
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.10)", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#122131" }}>{profil.prenom} {profil.nom}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{session?.user?.email}</div>
              </div>
              <button onClick={() => supabase.auth.signOut()} style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13, color: "#DC2626", cursor: "pointer" }}>
                ↪ Se déconnecter
              </button>
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); setShowMenuProfil(v => !v); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: "none", borderTop: "1px solid #E5E7EB", cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#122131", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {`${(profil.prenom?.[0] || "").toUpperCase()}${(profil.nom?.[0] || "").toUpperCase()}`}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#122131", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profil.prenom} {profil.nom}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Utilisateur{profil.is_owner ? " · Owner" : ""}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ marginLeft: 220, flex: 1, padding: "32px 32px", overflowY: "auto" }}>

        {vue === "reglages" && <PageReglages profil={profil} onProfilUpdate={onProfilUpdate} />}

        {vue === "mon-compte" && <PageMonCompte profil={profil} session={session} role="utilisateur" commandes={commandes} onProfilUpdate={onProfilUpdate} />}

        {vue === "utilisateurs" && profil.is_owner && <GestionUtilisateurs />}

        {vue === "commandes" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Commandes</h1>
              <button onClick={() => { setForm(formVide()); setShowForm(true); }}
                style={{ background: "#122131", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Nouvelle commande
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "En cours", val: commandes.filter(c => c.statut !== "Validé" && c.statut !== "Archivé").length, color: "#122131", bg: "#fff" },
                { label: "Validées", val: commandes.filter(c => c.statut === "Validé").length, color: "#059669", bg: "#F0FDF4" },
                { label: "Total", val: commandes.length, color: "#374151", bg: "#F8FAFC" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 22px" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", color: "#94A3B8", padding: 40 }}>Chargement...</div>
            ) : (
              <>
                <BarreFiltres commandes={commandes} filtres={filtres} setFiltres={setFiltres} tri={tri} setTri={setTri} dessinateurs={[]} showDessinateur={false} couleurAccent="#122131" />

                {sousComptes.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <select value={userFilter ?? ""} onChange={e => setUserFilter(e.target.value || null)}
                      style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer" }}>
                      <option value="">Tous les comptes</option>
                      <option value={profil.id}>{profil.prenom} {profil.nom} (moi)</option>
                      {sousComptes.map(p => (
                        <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {sousComptes.length > 0 && <span>User</span>}
                    <span>Plan</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
                  </div>
                  {actives.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande active.</div>}
                  {actives.map(c => {
                    const owner = sousComptes.find(s => s.id === c.utilisateur_id);
                    return (
                      <div key={c.id} onClick={() => setSelected(c)}
                        style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EEF3F8" : "transparent", transition: "background 0.1s" }}>
                        {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{owner ? `${owner.prenom} ${owner.nom}` : "Moi"}</div>}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                            {(() => {
                              const owner = sousComptes.find(s => s.id === c.utilisateur_id);
                              const prenom = owner ? owner.prenom : (c.utilisateur_id === profil.id ? profil.prenom : c.client_prenom);
                              const nom = owner ? owner.nom : (c.utilisateur_id === profil.id ? profil.nom : c.client_nom);
                              const nomStr = `${prenom ?? ""} ${nom ?? ""}`.trim();
                              return nomStr ? `${nomStr} — ${c.ref}` : c.ref;
                            })()}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans?.length ?? 0}</div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                        <Badge statut={c.statut} />
                      </div>
                    );
                  })}
                </div>

                {terminees.length > 0 && (
                  <div style={{ marginBottom: selected ? 24 : 0 }}>
                    <button onClick={() => setShowTerminees(v => !v)}
                      style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
                      {showTerminees ? "▲ Masquer les commandes validées" : `▼ Voir les ${terminees.length} commande${terminees.length > 1 ? "s" : ""} validée${terminees.length > 1 ? "s" : ""}`}
                    </button>
                    {showTerminees && (
                      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", opacity: 0.8 }}>
                        {terminees.map(c => {
                          const owner = sousComptes.find(s => s.id === c.utilisateur_id);
                          return (
                            <div key={c.id} onClick={() => setSelected(c)}
                              style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer" }}>
                              {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{owner ? `${owner.prenom} ${owner.nom}` : "Moi"}</div>}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                                  {(() => {
                                    const owner = sousComptes.find(s => s.id === c.utilisateur_id);
                                    const prenom = owner ? owner.prenom : (c.utilisateur_id === profil.id ? profil.prenom : c.client_prenom);
                                    const nom = owner ? owner.nom : (c.utilisateur_id === profil.id ? profil.nom : c.client_nom);
                                    const nomStr = `${prenom ?? ""} ${nom ?? ""}`.trim();
                                    return nomStr ? `${nomStr} — ${c.ref}` : c.ref;
                                  })()}
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans?.length ?? 0}</div>
                              <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                              <Badge statut={c.statut} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {archivees.length > 0 && (
                  <div style={{ marginBottom: selected ? 24 : 0 }}>
                    <button onClick={() => setShowArchivees(v => !v)}
                      style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
                      {showArchivees ? "▲ Masquer les commandes archivées" : `▼ Voir les ${archivees.length} commande${archivees.length > 1 ? "s" : ""} archivée${archivees.length > 1 ? "s" : ""}`}
                    </button>
                    {showArchivees && (
                      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", opacity: 0.7 }}>
                        {archivees.map(c => {
                          const owner = sousComptes.find(s => s.id === c.utilisateur_id);
                          return (
                            <div key={c.id} onClick={() => setSelected(c)}
                              style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer" }}>
                              {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{owner ? `${owner.prenom} ${owner.nom}` : "Moi"}</div>}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                              </div>
                              <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans?.length ?? 0}</div>
                              <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                              <Badge statut={c.statut} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {selected && (
                  <DetailCommandeModal
                    selected={selected}
                    versionsSelected={versionsSelected}
                    onClose={() => setSelected(null)}
                    onArchiver={() => archiver(selected.id)}
                    showContacts={true}
                    actionButtons={
                      selected.statut === "Ébauche déposée" ? (
                        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                          <button onClick={() => setShowModifModal(true)}
                            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#92400E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            ✏️ Demander une modification
                          </button>
                          <button onClick={() => setShowValidModal(true)}
                            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            ✅ Valider la commande
                          </button>
                        </div>
                      ) : selected.statut === "Validé" ? (
                        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46" }}>
                          ✅ Commande validée — messagerie fermée
                        </div>
                      ) : null
                    }
                    msgInput={msgInput}
                    setMsgInput={setMsgInput}
                    onEnvoyer={async (texte, fichiers) => {
                      if (!texte.trim() && !fichiers?.length) return;
                      await envoyerMessage(selected.id, auteurNom, texte, fichiers);
                    }}
                    auteurNom={auteurNom}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modal nouvelle commande */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 680, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nouvelle commande</h2>
              <button onClick={() => { setShowForm(false); setForm(formVide()); setSaveError(""); }} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#122131", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid #E5E7EB" }}>Informations client</div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Compte utilisateur</label>
                <select value={form.utilisateur_id} onChange={e => setForm({ ...form, utilisateur_id: e.target.value })} style={inputStyle}>
                  <option value={profil.id}>{profil.prenom} {profil.nom} (moi)</option>
                  {sousComptes.map(s => (
                    <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Nom du plan *</label>
                <input type="text" value={form.nom_plan} placeholder="Ex: Résidence Les Pins — Bât A" onChange={e => setForm({ ...form, nom_plan: e.target.value })} style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={labelStyle}>Prénom client</label><input type="text" value={form.client_prenom} onChange={e => setForm({ ...form, client_prenom: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Nom client</label><input type="text" value={form.client_nom} onChange={e => setForm({ ...form, client_nom: e.target.value })} style={inputStyle} /></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={labelStyle}>Email client</label><input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Téléphone</label><input type="tel" value={form.client_telephone} onChange={e => setForm({ ...form, client_telephone: e.target.value })} style={inputStyle} /></div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Adresse</label>
                <input type="text" value={form.adresse1} placeholder="Adresse ligne 1" onChange={e => setForm({ ...form, adresse1: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
                <input type="text" value={form.adresse2} placeholder="Complément d'adresse" onChange={e => setForm({ ...form, adresse2: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                  <input type="text" value={form.code_postal} placeholder="Code postal" onChange={e => setForm({ ...form, code_postal: e.target.value })} style={inputStyle} />
                  <input type="text" value={form.ville} placeholder="Ville" onChange={e => setForm({ ...form, ville: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#122131", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid #E5E7EB" }}>Détail du plan</div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Délai souhaité *</label>
                <input type="date" value={form.delai} min={new Date().toISOString().split("T")[0]} onChange={e => setForm({ ...form, delai: e.target.value })} style={inputStyle} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Plans à réaliser</label>
                <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px" }}>
                  <TableauPlans plans={form.plans} onChange={plans => setForm({ ...form, plans })} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
                <ZoneUpload label="📄 Fichiers du plan *" fichiers={form.fichiersPlan} onAjouter={f => setForm({ ...form, fichiersPlan: f })} onSupprimer={i => setForm({ ...form, fichiersPlan: form.fichiersPlan.filter((_, idx) => idx !== i) })} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf" maxFichiers={10} />
                <ZoneUpload label="🏢 Logo du client" fichiers={form.logoClient} onAjouter={f => setForm({ ...form, logoClient: f })} onSupprimer={() => setForm({ ...form, logoClient: [] })} accept="image/*" unique />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Instructions pour le dessinateur</label>
                <textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} rows={3} placeholder="Instructions, remarques..." style={{ ...inputStyle, resize: "vertical" }} />
              </div>
            </div>

            {saveError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>Erreur : {saveError}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => { setShowForm(false); setForm(formVide()); setSaveError(""); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={creerCommande} disabled={saving || !form.nom_plan || !form.delai || form.fichiersPlan.length === 0}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0) ? "not-allowed" : "pointer", background: (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0) ? "#F3F4F6" : "#122131", color: (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0) ? "#9CA3AF" : "#fff" }}>
                {saving ? "Enregistrement..." : "Créer la commande"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal demande modification */}
      {showModifModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✏️ Demander une modification</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Le statut passera en "Modification dessinateur".</div>
            <textarea value={modifMsg} onChange={e => setModifMsg(e.target.value)} rows={4} placeholder="Décrivez les modifications..." style={{ ...inputStyle, marginBottom: 14, resize: "vertical" }} />
            <ZoneUpload label="📎 Fichiers joints (optionnel)" fichiers={modifFichiers} onAjouter={f => setModifFichiers(f)} onSupprimer={i => setModifFichiers(modifFichiers.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf" maxFichiers={5} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => { setShowModifModal(false); setModifMsg(""); setModifFichiers([]); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={envoyerDemandeModification} disabled={!modifMsg.trim() || envoyantModif}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: !modifMsg.trim() ? "#F3F4F6" : "#D97706", color: !modifMsg.trim() ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: !modifMsg.trim() ? "not-allowed" : "pointer" }}>
                {envoyantModif ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal validation */}
      {showValidModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Confirmer la validation</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{selected?.nom_plan}</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 24 }}>Cette action est irréversible. La commande sera clôturée.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowValidModal(false)} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={validerCommande} disabled={validant}
                style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {validant ? "Validation..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
