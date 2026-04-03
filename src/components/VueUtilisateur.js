import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { formatDateMsg, formatDateCourt, joursRestants } from "../helpers";
import { planVide } from "../constants";
import Badge from "./Badge";
import BarreFiltres, { appliquerFiltresTri } from "./BarreFiltres";
import DetailCommandeModal from "./DetailCommandeModal";
import ZoneUpload from "./ZoneUpload";
import TableauPlans from "./TableauPlans";
import PageReglages from "./PageReglages";
import PageMonCompte from "./PageMonCompte";
import GestionUtilisateurs from "./GestionUtilisateurs";

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
  const [filtres, setFiltres] = useState({ statut: "", dessinateur: "", type: "", periode: "" });
  const [tri, setTri] = useState({ col: "created_at", dir: "desc" });
  const [showArchivees, setShowArchivees] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const [showModifModal, setShowModifModal] = useState(false);
  const [modifMsg, setModifMsg] = useState("");
  const [modifFichiers, setModifFichiers] = useState([]);
  const [envoyantModif, setEnvoyantModif] = useState(false);
  const [demandantValidation, setDemandantValidation] = useState(false);
  const [showDemandeValidationModal, setShowDemandeValidationModal] = useState(false);
  const [showValiderCommandeModal, setShowValiderCommandeModal] = useState(false);
  const [validant, setValidant] = useState(false);
  const [sousComptes, setSousComptes] = useState([]);
  const [dessinateursDispos, setDessinateursDispos] = useState([]); // [{ id, prenom, nom, is_default }]
  const [userFilter, setUserFilter] = useState(null); // null = tous, uuid = sous-compte filtré
  const [note, setNote] = useState("");
  const [noteSaveError, setNoteSaveError] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [menuCmdId, setMenuCmdId] = useState(null);
  const [menuRect, setMenuRect] = useState(null);
  const [showConfirmSupprimer, setShowConfirmSupprimer] = useState(null); // id de la commande à supprimer
  const [openDetailInEditMode, setOpenDetailInEditMode] = useState(false);

  const formVide = (defaultDessinateurId = "") => ({
    utilisateur_id: profil.id,
    nom_plan: "",
    client_nom: "", client_prenom: "", client_email: "", client_telephone: "",
    adresse1: "", adresse2: "", code_postal: "", ville: "",
    delai: "", plans: [planVide()], fichiersPlan: [], logoClient: [], instructions: "",
    dessinateur_id: defaultDessinateurId,
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "visible_par=is.null" }, (payload) => {
        const msg = payload.new;
        setCommandes(prev => prev.map(c => {
          if (c.id !== msg.commande_id) return c;
          if (msg.auteur === auteurNom) return c;
          if (c.messages.some(m => m.id === msg.id)) return c;
          return { ...c, messages: [...c.messages, msg] };
        }));
        setSelected(prev => {
          if (!prev || prev.id !== msg.commande_id) return prev;
          if (msg.auteur === auteurNom) return prev;
          if (prev.messages.some(m => m.id === msg.id)) return prev;
          return { ...prev, messages: [...prev.messages, msg] };
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        setCommandes(prev => prev.map(c =>
          c.id === msg.commande_id
            ? { ...c, messages: c.messages.map(m => m.id === msg.id ? { ...m, lu_par: msg.lu_par } : m) }
            : c
        ));
        setSelected(prev =>
          prev && prev.id === msg.commande_id
            ? { ...prev, messages: prev.messages.map(m => m.id === msg.id ? { ...m, lu_par: msg.lu_par } : m) }
            : prev
        );
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, []); // eslint-disable-line

  async function chargerTout() {
    setLoading(true);
    const [{ data: cmd }, { data: ver }, { data: sub }, { data: dessinateurs }] = await Promise.all([
      supabase.from("commandes").select("*, messages(*)").order("created_at", { ascending: false }),
      supabase.from("versions").select("*").order("numero", { ascending: true }),
      supabase.from("profiles").select("id, prenom, nom").eq("master_id", profil.id),
      supabase
        .from("utilisateur_dessinateurs")
        .select("dessinateur_id, is_default, profiles:dessinateur_id(prenom, nom)")
        .eq("utilisateur_id", profil.id),
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
    if (dessinateurs) {
      const liste = dessinateurs.map(d => ({
        id: d.dessinateur_id,
        prenom: d.profiles?.prenom || "",
        nom: d.profiles?.nom || "",
        is_default: d.is_default,
      }));
      setDessinateursDispos(liste);
      const defaultId = liste.find(d => d.is_default)?.id ?? liste[0]?.id ?? "";
      setForm(f => ({ ...f, dessinateur_id: defaultId }));
    }
    setLoading(false);
  }

  async function creerCommande() {
    if (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0 || !form.dessinateur_id) return;
    setSaving(true);
    setSaveError("");
    const ref = "CMD-" + String(commandes.length + 1).padStart(3, "0");
    const dessinateurChoisi = dessinateursDispos.find(d => d.id === form.dessinateur_id);
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
      dessinateur_id: form.dessinateur_id || null,
      dessinateur: dessinateurChoisi ? `${dessinateurChoisi.prenom} ${dessinateurChoisi.nom}` : null,
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
      body: { utilisateur_id: form.utilisateur_id, nom_plan: form.nom_plan, ref, dessinateur_id: form.dessinateur_id },
    });
    setSaving(false);
    setShowForm(false);
    setForm(formVide(dessinateursDispos.find(d => d.is_default)?.id ?? dessinateursDispos[0]?.id ?? ""));
  }

  async function changerStatut(id, statut) {
    const { error } = await supabase.from("commandes").update({ statut }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
    }
  }

  async function envoyerMessage(commandeId, auteur, texte, fichiers = [], options = {}) {
    const { data, error } = await supabase.from("messages").insert([{
      commande_id: commandeId, auteur, texte: texte || "", fichiers,
      date: formatDateMsg(),
      visible_par: options.visible_par ?? null,
    }]).select().single();
    if (!error && data) {
      setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, messages: [...c.messages, data] } : c));
      if (selected?.id === commandeId) setSelected(prev => ({ ...prev, messages: [...prev.messages, data] }));
      // Pas de notification pour les notes privées
      if (!options.visible_par?.length) {
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
  }

  async function envoyerDemandeModification() {
    if (!modifMsg.trim() || !selected) return;
    setEnvoyantModif(true);
    await envoyerMessage(selected.id, auteurNom, modifMsg, modifFichiers);
    await changerStatut(selected.id, "Modification dessinateur");
    supabase.functions.invoke("notify-statut", {
      body: { commande_id: selected.id, event: "modification" },
    });
    setModifMsg(""); setModifFichiers([]); setShowModifModal(false); setEnvoyantModif(false);
  }

  async function demanderValidation() {
    if (!selected || demandantValidation) return;
    setDemandantValidation(true);
    setShowDemandeValidationModal(false);
    await changerStatut(selected.id, "Validation en cours");
    await envoyerMessage(selected.id, auteurNom, "📋 Validation demandée.");
    supabase.functions.invoke("notify-statut", {
      body: { commande_id: selected.id, event: "validation_en_cours" },
    });
    setDemandantValidation(false);
  }

  async function validerCommande() {
    if (!selected || validant) return;
    setValidant(true);
    setShowValiderCommandeModal(false);
    await changerStatut(selected.id, "Validé");
    await envoyerMessage(selected.id, auteurNom, "✅ Commande validée.");
    supabase.functions.invoke("notify-statut", {
      body: { commande_id: selected.id, event: "termine" },
    });
    setValidant(false);
  }

  async function dupliquer(c) {
    const ref = "CMD-" + String(commandes.length + 1).padStart(3, "0");
    const { data, error } = await supabase.from("commandes").insert([{
      ref,
      utilisateur_id: c.utilisateur_id,
      nom_plan: c.nom_plan + " (copie)",
      client_nom: c.client_nom, client_prenom: c.client_prenom,
      client_email: c.client_email, client_telephone: c.client_telephone,
      adresse1: c.adresse1, adresse2: c.adresse2,
      code_postal: c.code_postal, ville: c.ville,
      delai: c.delai, plans: c.plans,
      fichiers_plan: c.fichiers_plan || [], logo_client: c.logo_client || [],
      instructions: c.instructions,
      plans_finalises: [], statut: "En attente",
      dessinateur_id: c.dessinateur_id || null,
      dessinateur: c.dessinateur || null,
    }]).select("*, messages(*)").single();
    if (!error && data) {
      setCommandes(prev => [{ ...data, plans: data.plans || [], fichiersPlan: data.fichiers_plan || [], logoClient: data.logo_client || [], plansFinalises: [], messages: [] }, ...prev]);
      setSelected(null);
    }
  }

  async function archiver(id) {
    const { error } = await supabase.from("commandes").update({ is_archived: true }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, is_archived: true } : c));
      setSelected(null);
    }
  }

  async function desarchiver(id) {
    const { error } = await supabase.from("commandes").update({ is_archived: false }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, is_archived: false } : c));
      setSelected(null);
    }
  }

  async function supprimerCommande(id) {
    const { error } = await supabase.from("commandes").delete().eq("id", id);
    if (!error) {
      setCommandes(prev => prev.filter(c => c.id !== id));
      setSelected(null);
    } else {
      console.error("Erreur suppression commande:", error);
    }
  }

  async function marquerMessagesLus(commandeId) {
    if (!commandeId) return;
    const commande = commandes.find(c => c.id === commandeId);
    if (!commande) return;
    const nonLus = commande.messages.filter(m =>
      m.auteur !== auteurNom &&
      !m.visible_par &&
      !(m.lu_par || []).includes(auteurNom)
    );
    if (nonLus.length === 0) return;
    await Promise.all(nonLus.map(m =>
      supabase.from("messages").update({ lu_par: [...(m.lu_par || []), auteurNom] }).eq("id", m.id)
    ));
    const marquer = m => nonLus.some(n => n.id === m.id) ? { ...m, lu_par: [...(m.lu_par || []), auteurNom] } : m;
    setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, messages: c.messages.map(marquer) } : c));
    setSelected(prev => prev && prev.id === commandeId ? { ...prev, messages: prev.messages.map(marquer) } : prev);
  }

  async function modifierCommande(id, updates, changesText) {
    const { error } = await supabase.from("commandes").update(updates).eq("id", id);
    if (error) throw error;
    const localUpdates = { ...updates };
    if (localUpdates.delai && localUpdates.delai.length === 10) {
      localUpdates.delai = localUpdates.delai + "T12:00:00";
    }
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, ...localUpdates } : c));
    setSelected(prev => ({ ...prev, ...localUpdates }));
    if (changesText) await envoyerMessage(id, auteurNom, changesText);
  }

  useEffect(() => {
    if (!selected) { setNote(""); setNoteSaveError(false); return; }
    supabase.from("commande_notes")
      .select("note")
      .eq("commande_id", selected.id)
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setNote(data?.note ?? ""));
  }, [selected?.id]); // eslint-disable-line

  async function sauvegarderNote() {
    if (!selected) return;
    const { error } = await supabase.from("commande_notes").upsert({
      commande_id: selected.id,
      user_id: session.user.id,
      note,
      updated_at: new Date().toISOString(),
    });
    setNoteSaveError(!!error);
  }

  const nonLusDe = c => c.messages.filter(
    m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
  ).length;
  const totalNonLus = commandes.filter(c => !c.is_archived).reduce((acc, c) => acc + nonLusDe(c), 0);
  // canModifier : pas archivée ET pas validée (messagerie fermée sur les validées)
  const canModifier = selected && !selected.is_archived && selected.statut !== "Validé";

  const commandesVisibles = userFilter ? commandes.filter(c => c.utilisateur_id === userFilter) : commandes;
  const cmdFiltrees = appliquerFiltresTri(commandesVisibles, filtres, tri);
  const actives   = cmdFiltrees.filter(c => !c.is_archived);
  const archivees = cmdFiltrees.filter(c => c.is_archived);
  const versionsSelected = selected ? versions.filter(v => v.commande_id === selected.id) : [];

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 };

  const cmdCols = sousComptes.length > 0 ? "1fr 2fr 1fr 1fr 0.6fr 1fr 1.4fr 28px" : "2fr 1fr 1fr 0.6fr 1fr 1.4fr 28px";

  function renderLigneCmd(c, dim = false) {
    const owner = sousComptes.find(s => s.id === c.utilisateur_id);
    const ownerLabel = owner
      ? `${owner.prenom} ${owner.nom}`
      : (c.utilisateur_id === profil.id ? `${profil.prenom} ${profil.nom}` : `${c.client_prenom ?? ""} ${c.client_nom ?? ""}`.trim());
    const j = joursRestants(c.delai);
    const rouge = j !== null && j <= 3;
    return (
      <div key={c.id} onClick={() => setSelected(c)}
        style={{ display: "grid", gridTemplateColumns: cmdCols, padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EEF3F8" : "transparent", opacity: dim ? 0.75 : 1, transition: "background 0.1s" }}>
        {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{ownerLabel || "—"}</div>}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</span>
            {nonLusDe(c) > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{nonLusDe(c)}</span>}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{ownerLabel ? `${ownerLabel} — ${c.ref}` : c.ref}</div>
        </div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{c.dessinateur || "—"}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans?.length ?? 0}</div>
        <div>
          {c.delai ? (
            <>
              <div style={{ fontSize: 12, color: rouge ? "#DC2626" : "#6B7280" }}>{formatDateCourt(c.delai)}</div>
              {j !== null && <div style={{ fontSize: 10, fontWeight: 600, color: rouge ? "#DC2626" : "#9CA3AF" }}>{j === 0 ? "Aujourd'hui" : j < 0 ? `${Math.abs(j)}j dépassé` : `${j}j restant${j > 1 ? "s" : ""}`}</div>}
            </>
          ) : <span style={{ fontSize: 12, color: "#D1D5DB" }}>—</span>}
        </div>
        <Badge statut={c.statut} />
        <div onClick={e => e.stopPropagation()}>
          <button onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenuCmdId(menuCmdId === c.id ? null : c.id); setMenuRect(r); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 18, padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}>
            ···
          </button>
        </div>
      </div>
    );
  }

  function renderCarteCmd(c, dim = false) {
    const j = joursRestants(c.delai);
    const rouge = j !== null && j <= 3;
    const owner = sousComptes.find(s => s.id === c.utilisateur_id);
    const ownerLabel = owner ? `${owner.prenom} ${owner.nom}` : null;
    return (
      <div key={c.id} onClick={() => setSelected(c)}
        style={{ background: "#fff", border: "1.5px solid " + (selected?.id === c.id ? "#122131" : "#E5E7EB"), borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", opacity: dim ? 0.75 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nom_plan || "—"}</span>
              {nonLusDe(c) > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{nonLusDe(c)}</span>}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{ownerLabel ? `${ownerLabel} · ` : ""}{c.ref}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge statut={c.statut} />
            <div onClick={e => e.stopPropagation()}>
              <button onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenuCmdId(menuCmdId === c.id ? null : c.id); setMenuRect(r); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 18, padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}>
                ···
              </button>
            </div>
          </div>
        </div>
        {c.delai && (
          <div style={{ marginTop: 6, fontSize: 11, color: rouge ? "#DC2626" : "#9CA3AF", fontWeight: rouge ? 600 : 400 }}>
            {formatDateCourt(c.delai)}{j !== null ? ` · ${j === 0 ? "Aujourd'hui" : j < 0 ? `${Math.abs(j)}j dépassé` : `${j}j restant${j > 1 ? "s" : ""}`}` : ""}
          </div>
        )}
      </div>
    );
  }

  return (
    <div onClick={() => { showMenuProfil && setShowMenuProfil(false); showMobileMenu && setShowMobileMenu(false); menuCmdId && setMenuCmdId(null); }} style={{ display: "flex", height: "100dvh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}>

      {/* Backdrop mobile */}
      <div className={`sidebar-backdrop${showMobileMenu ? " sidebar-open" : ""}`} onClick={(e) => { e.stopPropagation(); setShowMobileMenu(false); }} />

      {/* Sidebar */}
      <div className={`app-sidebar${showMobileMenu ? " sidebar-open" : ""}`} style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px 0 12px", gap: 4, position: "fixed", top: 0, height: "100dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
          <div style={{ width: 32, height: 32, background: "#122131", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontSize: 16 }}>🔥</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>First Incendie</span>
        </div>
        {nav.map(item => (
          <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); setShowMobileMenu(false); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#E8EDF2" : "transparent", color: vue === item.id ? "#122131" : "#6B7280", textAlign: "left", width: "100%" }}>
            <span>{item.icon}</span><span style={{ flex: 1 }}>{item.label}</span>
            {item.id === "commandes" && totalNonLus > 0 && (
              <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                {totalNonLus}
              </span>
            )}
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

      {/* Main wrapper */}
      <div className="app-main-wrapper" style={{ marginLeft: 220, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Mobile header */}
        <div className="mobile-header">
          <button onClick={(e) => { e.stopPropagation(); setShowMobileMenu(v => !v); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#374151", padding: "4px 8px 4px 0", lineHeight: 1 }}>☰</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, background: "#122131", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 14 }}>🔥</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 13 }}>First Incendie</span>
          </div>
          {totalNonLus > 0 && <span style={{ marginLeft: "auto", background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{totalNonLus}</span>}
        </div>
        {/* Contenu */}
        <div className="app-main-content" style={{ flex: 1, padding: "32px 32px", overflowY: "auto" }}>

        {vue === "reglages" && <PageReglages profil={profil} onProfilUpdate={onProfilUpdate} />}

        {vue === "mon-compte" && <PageMonCompte profil={profil} session={session} role="utilisateur" commandes={commandes} onProfilUpdate={onProfilUpdate} />}

        {vue === "utilisateurs" && profil.is_owner && <GestionUtilisateurs />}

        {vue === "commandes" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Commandes</h1>
              <button onClick={() => { setForm(formVide(dessinateursDispos.find(d => d.is_default)?.id ?? dessinateursDispos[0]?.id ?? "")); setShowForm(true); }}
                style={{ background: "#122131", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Nouvelle commande
              </button>
            </div>

            <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
              {[
                { label: "en cours", val: commandes.filter(c => !c.is_archived).length, color: "#122131" },
                { label: "total", val: commandes.length, color: "#9CA3AF" },
              ].map(s => (
                <span key={s.label} style={{ fontSize: 13, color: "#6B7280" }}>
                  <span style={{ fontWeight: 700, fontSize: 18, color: s.color }}>{s.val}</span> {s.label}
                </span>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", color: "#94A3B8", padding: 40 }}>Chargement...</div>
            ) : (
              <>
                <BarreFiltres commandes={commandes} filtres={filtres} setFiltres={setFiltres} tri={tri} setTri={setTri} showDessinateur={true} couleurAccent="#122131" />

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

                {/* Actives — desktop */}
                <div className="cmd-table" style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: cmdCols, padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {sousComptes.length > 0 && <span>Compte</span>}
                    <span>Plan</span><span>Dessinateur</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span><span></span>
                  </div>
                  {actives.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande active.</div>}
                  {actives.map(c => renderLigneCmd(c))}
                </div>

                {/* Actives — mobile */}
                <div className="cmd-cards" style={{ marginBottom: 16 }}>
                  {actives.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande active.</div>}
                  {actives.map(c => renderCarteCmd(c))}
                </div>

                {/* Archivées */}
                {archivees.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <button onClick={() => setShowArchivees(v => !v)}
                      style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
                      {showArchivees ? "▲ Masquer les archivées" : `▼ ${archivees.length} commande${archivees.length > 1 ? "s" : ""} archivée${archivees.length > 1 ? "s" : ""}`}
                    </button>
                    {showArchivees && (
                      <>
                        <div className="cmd-table" style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                          {archivees.map(c => renderLigneCmd(c, true))}
                        </div>
                        <div className="cmd-cards" style={{ marginBottom: 16 }}>
                          {archivees.map(c => renderCarteCmd(c, true))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {selected && (
                  <DetailCommandeModal
                    selected={selected}
                    versionsSelected={versionsSelected}
                    onClose={() => { setSelected(null); setOpenDetailInEditMode(false); }}
                    startInEditMode={openDetailInEditMode}
                    onArchiver={!selected?.is_archived ? () => archiver(selected.id) : undefined}
                    onDesarchiver={selected?.is_archived ? () => desarchiver(selected.id) : undefined}
                    onSupprimer={selected?.is_archived ? () => setShowConfirmSupprimer(selected.id) : undefined}
                    onDupliquer={!selected?.is_archived ? () => dupliquer(selected) : undefined}
                    showContacts={true}
                    actionButtons={
                      selected.statut === "Ébauche déposée" ? (
                        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                          <button onClick={() => setShowModifModal(true)}
                            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#92400E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            ✏️ Demander une modification
                          </button>
                          <button onClick={() => setShowDemandeValidationModal(true)} disabled={demandantValidation}
                            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: demandantValidation ? "not-allowed" : "pointer" }}>
                            📋 Demander la validation
                          </button>
                        </div>
                      ) : selected.statut === "Validation en cours" ? (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#047857", marginBottom: 10 }}>
                            📋 Validation en cours — {(selected.plansFinalises || []).length}/{(selected.plans || []).length} plan(s) déposé(s)
                          </div>
                          {(selected.plansFinalises || []).length === (selected.plans || []).length && (selected.plans || []).length > 0 && (
                            <button onClick={() => setShowValiderCommandeModal(true)} disabled={validant}
                              style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: validant ? "#D1FAE5" : "#065F46", color: "#fff", fontSize: 13, fontWeight: 700, cursor: validant ? "not-allowed" : "pointer" }}>
                              {validant ? "Validation..." : "✅ Valider la commande"}
                            </button>
                          )}
                        </div>
                      ) : selected.statut === "Validé" ? (
                        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46" }}>
                          ✅ Commande validée — messagerie fermée
                        </div>
                      ) : null
                    }
                    msgInput={msgInput}
                    setMsgInput={setMsgInput}
                    onEnvoyer={async (texte, fichiers, options = {}) => {
                      if (!texte.trim() && !fichiers?.length) return;
                      await envoyerMessage(selected.id, auteurNom, texte, fichiers, options);
                    }}
                    auteurNom={auteurNom}
                    onMarquerLu={() => marquerMessagesLus(selected?.id)}
                    note={note}
                    setNote={setNote}
                    onSaveNote={sauvegarderNote}
                    noteSaveError={noteSaveError}
                    onModifierCommande={modifierCommande}
                    canModifier={canModifier}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
      </div>

      {/* Dropdown ··· commande (position fixed, échappe overflow:hidden) */}
      {menuCmdId && menuRect && (() => {
        const c = commandes.find(x => x.id === menuCmdId);
        if (!c) return null;
        const spaceBelow = window.innerHeight - menuRect.bottom;
        const top = spaceBelow >= 180 ? menuRect.bottom + 4 : menuRect.top - 4;
        const transform = spaceBelow >= 180 ? "none" : "translateY(-100%)";
        return (
          <div onClick={e => e.stopPropagation()} style={{ position: "fixed", top, right: window.innerWidth - menuRect.right, transform, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 1000, minWidth: 210, overflow: "hidden" }}>
            {!c.is_archived ? (
              <>
                <button onClick={() => { setMenuCmdId(null); setSelected(c); setOpenDetailInEditMode(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  ✏️ Modifier la commande
                </button>
                <button onClick={() => { setMenuCmdId(null); dupliquer(c); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  📋 Dupliquer la commande
                </button>
                <button onClick={() => { setMenuCmdId(null); archiver(c.id); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#DC2626", textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  🗃️ Archiver la commande
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setMenuCmdId(null); desarchiver(c.id); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  📤 Désarchiver la commande
                </button>
                <button onClick={() => { setMenuCmdId(null); setShowConfirmSupprimer(c.id); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#DC2626", textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  🗑️ Supprimer la commande
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* Modal confirmation suppression */}
      {showConfirmSupprimer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#122131", marginBottom: 12 }}>Supprimer la commande ?</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24, lineHeight: 1.6 }}>
              Cette action est irréversible. La commande et toutes ses données associées (messages, versions, fichiers) seront définitivement supprimées.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirmSupprimer(null)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={() => { supprimerCommande(showConfirmSupprimer); setShowConfirmSupprimer(null); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nouvelle commande */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 680, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nouvelle commande</h2>
              <button onClick={() => { setShowForm(false); setForm(formVide(dessinateursDispos.find(d => d.is_default)?.id ?? dessinateursDispos[0]?.id ?? "")); setSaveError(""); }} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
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
                <label style={labelStyle}>Dessinateur *</label>
                {dessinateursDispos.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#94A3B8", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#F9FAFB" }}>
                    Aucun dessinateur disponible, contactez votre administrateur.
                  </div>
                ) : (
                  <select
                    value={form.dessinateur_id}
                    onChange={e => setForm({ ...form, dessinateur_id: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">— Sélectionner un dessinateur —</option>
                    {dessinateursDispos.map(d => (
                      <option key={d.id} value={d.id}>{d.prenom} {d.nom}{d.is_default ? " (défaut)" : ""}</option>
                    ))}
                  </select>
                )}
              </div>

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
              <button onClick={() => { setShowForm(false); setForm(formVide(dessinateursDispos.find(d => d.is_default)?.id ?? dessinateursDispos[0]?.id ?? "")); setSaveError(""); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={creerCommande} disabled={saving || !form.nom_plan || !form.delai || form.fichiersPlan.length === 0 || !form.dessinateur_id}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0 || !form.dessinateur_id) ? "not-allowed" : "pointer", background: (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0 || !form.dessinateur_id) ? "#F3F4F6" : "#122131", color: (!form.nom_plan || !form.delai || form.fichiersPlan.length === 0 || !form.dessinateur_id) ? "#9CA3AF" : "#fff" }}>
                {saving ? "Enregistrement..." : "Créer la commande"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation valider la commande */}
      {showValiderCommandeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>✅ Valider la commande</div>
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 20 }}>
              Cette action est définitive. La commande passera au statut "Validé" et la messagerie sera fermée. Êtes-vous sûr ?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowValiderCommandeModal(false)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={() => validerCommande()} disabled={validant}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#065F46", color: "#fff", fontSize: 13, fontWeight: 600, cursor: validant ? "not-allowed" : "pointer" }}>
                {validant ? "Validation..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation demande de validation */}
      {showDemandeValidationModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📋 Demander la validation</div>
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 20 }}>
              Le dessinateur recevra une notification et devra déposer les plans finaux. Êtes-vous sûr ?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowDemandeValidationModal(false)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={() => demanderValidation()} disabled={demandantValidation}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#065F46", color: "#fff", fontSize: 13, fontWeight: 600, cursor: demandantValidation ? "not-allowed" : "pointer" }}>
                {demandantValidation ? "Envoi..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal demande modification */}
      {showModifModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
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


    </div>
  );
}
