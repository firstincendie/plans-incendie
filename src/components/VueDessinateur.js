import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { formatDateMsg, formatDateCourt, appliquerFiltresTri, joursRestants } from "../helpers";
import Badge from "./Badge";
import BarreFiltres from "./BarreFiltres";
import ZoneUpload from "./ZoneUpload";
import PageReglages from "./PageReglages";
import PageMonCompte from "./PageMonCompte";
import GestionCompteDessinateur from "./GestionCompteDessinateur";
import DetailCommandeModal from "./DetailCommandeModal";

export default function VueDessinateur({ session, profil, onProfilUpdate }) {
  const [commandes, setCommandes] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState("commandes");
  const [selected, setSelected] = useState(null);
  const [showMenuProfil, setShowMenuProfil] = useState(false);
  const [filtres, setFiltres] = useState({ statut: "", type: "", periode: "" });
  const [tri, setTri] = useState({ col: "created_at", dir: "desc" });
  const [showTerminees, setShowTerminees] = useState(false);
  const [showArchivees, setShowArchivees] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const [showDepotModal, setShowDepotModal] = useState(false);
  const [fichiersDepot, setFichiersDepot] = useState([]);
  const [messageDepot, setMessageDepot] = useState("");
  const [deposant, setDeposant] = useState(false);
  const [showPlansFinalModal, setShowPlansFinalModal] = useState(false);
  const [uploadingPlanIndex, setUploadingPlanIndex] = useState(null);
  const [sousComptes, setSousComptes] = useState([]);
  const [userFilter, setUserFilter] = useState(null); // null = tous, uuid = sous-dessinateur filtré
  const [note, setNote] = useState("");
  const [noteSaveError, setNoteSaveError] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();
  const nav = [
    { id: "commandes", label: "Mes missions", icon: "📋" },
    { id: "gestion-compte", label: "Gestion de compte", icon: "📁" },
    { id: "reglages", label: "Réglages", icon: "⚙️" },
    { id: "mon-compte", label: "Mon compte", icon: "👤" },
  ];

  useEffect(() => {
    chargerTout();
    const canal = supabase
      .channel("messages-dessinateur")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
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

  async function commencer(id) {
    const { error } = await supabase.from("commandes").update({ statut: "Commencé" }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: "Commencé" } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, statut: "Commencé" }));
      await envoyerMessage(id, auteurNom, "🚀 Mission commencée.");
    }
  }

  async function annulerPlansFinal() {
    if (!selected) return;
    await supabase.from("commandes").update({ plans_finalises: [], statut: "Ébauche déposée" }).eq("id", selected.id);
    setCommandes(prev => prev.map(c => c.id === selected.id ? { ...c, plansFinalises: [], statut: "Ébauche déposée" } : c));
    setSelected(prev => ({ ...prev, plansFinalises: [], statut: "Ébauche déposée" }));
    await envoyerMessage(selected.id, auteurNom, "↩️ Plans finaux annulés. Retour en ébauche.");
  }

  async function deposerPlanFinal(planIndex, file) {
    setUploadingPlanIndex(planIndex);
    const ext = file.name.split(".").pop();
    const refNumber = selected.ref.split("-")[1]; // "CMD-003" → "003"
    const nomFichier = `${selected.nom_plan}-${refNumber}-${planIndex + 1}.${ext}`;
    const chemin = `finals/${selected.id}/${nomFichier}`;

    const { error: uploadError } = await supabase.storage.from("fichiers").upload(chemin, file, { upsert: true });
    if (uploadError) { console.error(uploadError); setUploadingPlanIndex(null); return; }

    const { data: urlData } = supabase.storage.from("fichiers").getPublicUrl(chemin);
    const nouvelleEntree = {
      plan_index: planIndex,
      nom: nomFichier,
      url: urlData.publicUrl,
      taille: (file.size / 1024).toFixed(0) + " Ko",
      ajouteLe: new Date().toLocaleDateString("fr-FR"),
    };

    const anciens = (selected.plansFinalises || []).filter(p => p.plan_index !== planIndex);
    const nouveaux = [...anciens, nouvelleEntree];

    await supabase.from("commandes").update({ plans_finalises: nouveaux }).eq("id", selected.id);

    setCommandes(prev => prev.map(c => c.id === selected.id ? { ...c, plansFinalises: nouveaux } : c));
    setSelected(prev => ({ ...prev, plansFinalises: nouveaux }));
    setUploadingPlanIndex(null);

    if (nouveaux.length === selected.plans.length) {
      await envoyerMessage(selected.id, auteurNom, "📐 Plans finaux déposés — en attente de validation.");
    }
  }

  async function deposerVersion() {
    if (!fichiersDepot.length || !selected) return;
    setDeposant(true);
    const numero = versions.filter(v => v.commande_id === selected.id).length + 1;
    const { data: ver } = await supabase.from("versions").insert([{
      commande_id: selected.id, fichiers: fichiersDepot, numero, deposee_par: auteurNom,
    }]).select().single();
    if (ver) setVersions(prev => [...prev, ver]);
    const { error } = await supabase.from("commandes").update({ statut: "Ébauche déposée" }).eq("id", selected.id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === selected.id ? { ...c, statut: "Ébauche déposée" } : c));
      setSelected(prev => ({ ...prev, statut: "Ébauche déposée" }));
      // Notifier l'utilisateur de l'ébauche déposée
      supabase.functions.invoke("notify-version", {
        body: { commande_id: selected.id, nom_plan: selected.nom_plan, numero_version: numero },
      });
      const texteMsg = messageDepot.trim()
        ? `📎 Version ${numero} déposée.\n${messageDepot.trim()}`
        : `📎 Version ${numero} déposée.`;
      await envoyerMessage(selected.id, auteurNom, texteMsg);
    }
    setFichiersDepot([]); setMessageDepot(""); setShowDepotModal(false); setDeposant(false);
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

  async function marquerMessagesLus(commandeId) {
    if (!commandeId) return;
    const commande = commandes.find(c => c.id === commandeId);
    if (!commande) return;
    const nonLus = commande.messages.filter(m =>
      m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
    );
    if (nonLus.length === 0) return;
    await Promise.all(nonLus.map(m =>
      supabase.from("messages").update({ lu_par: [...(m.lu_par || []), auteurNom] }).eq("id", m.id)
    ));
    const marquer = m => nonLus.some(n => n.id === m.id) ? { ...m, lu_par: [...(m.lu_par || []), auteurNom] } : m;
    setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, messages: c.messages.map(marquer) } : c));
    setSelected(prev => prev && prev.id === commandeId ? { ...prev, messages: prev.messages.map(marquer) } : prev);
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

  const commandesVisibles = userFilter
    ? commandes.filter(c => {
        const sousDessinateur = sousComptes.find(s => s.id === userFilter);
        // Filtrer par sous-dessinateur : missions directement assignées (dessinateur_id = sous.id)
        return sousDessinateur && c.dessinateur_id === userFilter;
      })
    : commandes;
  const nonLusDe = c => c.messages.filter(
    m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
  ).length;
  const totalNonLus = commandes.filter(c => !["Validé", "Archivé"].includes(c.statut)).reduce((acc, c) => acc + nonLusDe(c), 0);

  const cmdFiltrees = appliquerFiltresTri(commandesVisibles, filtres, tri);
  const actives   = cmdFiltrees.filter(c => c.statut !== "Validé" && c.statut !== "Archivé");
  const terminees = cmdFiltrees.filter(c => c.statut === "Validé");
  const archivees = cmdFiltrees.filter(c => c.statut === "Archivé");
  const versionsSelected = selected ? versions.filter(v => v.commande_id === selected.id) : [];
  const peutDeposer = selected && ["Commencé", "Modification dessinateur"].includes(selected.statut);

  return (
    <div onClick={() => { showMenuProfil && setShowMenuProfil(false); showMobileMenu && setShowMobileMenu(false); }} style={{ display: "flex", height: "100dvh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}>

      {/* Backdrop mobile */}
      <div className={`sidebar-backdrop${showMobileMenu ? " sidebar-open" : ""}`} onClick={(e) => { e.stopPropagation(); setShowMobileMenu(false); }} />

      {/* Sidebar */}
      <div className={`app-sidebar${showMobileMenu ? " sidebar-open" : ""}`} style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px 0 12px", gap: 4, position: "fixed", top: 0, height: "100dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
          <div style={{ width: 32, height: 32, background: "#FC6C1B", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontSize: 16 }}>✏️</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>First Incendie</span>
        </div>
        {nav.map(item => (
          <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); setShowMobileMenu(false); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#FFF3EE" : "transparent", color: vue === item.id ? "#FC6C1B" : "#6B7280", textAlign: "left", width: "100%" }}>
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
                <div style={{ fontSize: 13, fontWeight: 700 }}>{profil.prenom} {profil.nom}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{session?.user?.email}</div>
              </div>
              <button onClick={() => supabase.auth.signOut()} style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13, color: "#DC2626", cursor: "pointer" }}>↪ Se déconnecter</button>
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); setShowMenuProfil(v => !v); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: "none", borderTop: "1px solid #E5E7EB", cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#FC6C1B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {`${(profil.prenom?.[0] || "").toUpperCase()}${(profil.nom?.[0] || "").toUpperCase()}`}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#122131", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profil.prenom} {profil.nom}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Dessinateur</div>
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
            <div style={{ width: 28, height: 28, background: "#FC6C1B", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 14 }}>✏️</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 13 }}>First Incendie</span>
          </div>
          {totalNonLus > 0 && <span style={{ marginLeft: "auto", background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{totalNonLus}</span>}
        </div>
        {/* Contenu */}
        <div className="app-main-content" style={{ flex: 1, padding: "32px 32px", overflowY: "auto" }}>
        {vue === "reglages" && <PageReglages profil={profil} onProfilUpdate={onProfilUpdate} />}
        {vue === "mon-compte" && <PageMonCompte profil={profil} session={session} role="dessinateur" commandes={commandes} onProfilUpdate={onProfilUpdate} />}
        {vue === "gestion-compte" && <GestionCompteDessinateur profil={profil} sousComptes={sousComptes} />}

        {vue === "commandes" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Mes missions</h1>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "En cours", val: commandes.filter(c => c.statut !== "Validé" && c.statut !== "Archivé").length, color: "#FC6C1B", bg: "#FFF3EE" },
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
                <BarreFiltres commandes={commandes} filtres={filtres} setFiltres={setFiltres} tri={tri} setTri={setTri} dessinateurs={[]} showDessinateur={false} couleurAccent="#FC6C1B" />

                {sousComptes.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <select value={userFilter ?? ""} onChange={e => setUserFilter(e.target.value || null)}
                      style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer" }}>
                      <option value="">Toutes les missions</option>
                      <option value={profil.id}>Mes missions</option>
                      {sousComptes.map(p => (
                        <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase" }}>
                    {sousComptes.length > 0 && <span>Dessinateur</span>}
                    <span>Plan</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
                  </div>
                  {actives.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune mission active.</div>}
                  {actives.map(c => {
                    const sousD = sousComptes.find(s => s.id === c.dessinateur_id);
                    return (
                      <div key={c.id} onClick={() => setSelected(c)}
                        style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#FFF3EE" : "transparent", transition: "background 0.1s" }}>
                        {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{sousD ? `${sousD.prenom} ${sousD.nom}` : "Moi"}</div>}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</span>
                            {nonLusDe(c) > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{nonLusDe(c)}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                            {(() => {
                              const nomClient = `${c.client_prenom ?? ""} ${c.client_nom ?? ""}`.trim();
                              return nomClient ? `${nomClient} — ${c.ref}` : c.ref;
                            })()}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans?.length ?? 0}</div>
                        {(() => { const j = joursRestants(c.delai); const rouge = j !== null && j <= 3; return (
                          <div>
                            <div style={{ fontSize: 12, color: rouge ? "#DC2626" : "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                            {j !== null && <div style={{ fontSize: 10, fontWeight: 600, color: rouge ? "#DC2626" : "#9CA3AF" }}>{j === 0 ? "Aujourd'hui" : j < 0 ? `${Math.abs(j)}j dépassé` : `${j}j restant${j > 1 ? "s" : ""}`}</div>}
                          </div>
                        ); })()}
                        <Badge statut={c.statut} />
                      </div>
                    );
                  })}
                </div>

                {terminees.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <button onClick={() => setShowTerminees(v => !v)} style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
                      {showTerminees ? "▲ Masquer les validées" : `▼ Voir les ${terminees.length} mission${terminees.length > 1 ? "s" : ""} validée${terminees.length > 1 ? "s" : ""}`}
                    </button>
                    {showTerminees && (
                      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", opacity: 0.8 }}>
                        {terminees.map(c => {
                          const sousD = sousComptes.find(s => s.id === c.dessinateur_id);
                          return (
                            <div key={c.id} onClick={() => setSelected(c)}
                              style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer" }}>
                              {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{sousD ? `${sousD.prenom} ${sousD.nom}` : "Moi"}</div>}
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</span>
                                </div>
                                <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                                  {(() => {
                                    const nomClient = `${c.client_prenom ?? ""} ${c.client_nom ?? ""}`.trim();
                                    return nomClient ? `${nomClient} — ${c.ref}` : c.ref;
                                  })()}
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                              {(() => { const j = joursRestants(c.delai); const rouge = j !== null && j <= 3; return (
                          <div>
                            <div style={{ fontSize: 12, color: rouge ? "#DC2626" : "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                            {j !== null && <div style={{ fontSize: 10, fontWeight: 600, color: rouge ? "#DC2626" : "#9CA3AF" }}>{j === 0 ? "Aujourd'hui" : j < 0 ? `${Math.abs(j)}j dépassé` : `${j}j restant${j > 1 ? "s" : ""}`}</div>}
                          </div>
                        ); })()}
                              <Badge statut={c.statut} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {archivees.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <button onClick={() => setShowArchivees(v => !v)} style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
                      {showArchivees ? "▲ Masquer les missions archivées" : `▼ Voir les ${archivees.length} mission${archivees.length > 1 ? "s" : ""} archivée${archivees.length > 1 ? "s" : ""}`}
                    </button>
                    {showArchivees && (
                      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", opacity: 0.7 }}>
                        {archivees.map(c => {
                          const sousD = sousComptes.find(s => s.id === c.dessinateur_id);
                          return (
                            <div key={c.id} onClick={() => setSelected(c)}
                              style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer" }}>
                              {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{sousD ? `${sousD.prenom} ${sousD.nom}` : "Moi"}</div>}
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</span>
                                </div>
                                <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                                  {(() => {
                                    const nomClient = `${c.client_prenom ?? ""} ${c.client_nom ?? ""}`.trim();
                                    return nomClient ? `${nomClient} — ${c.ref}` : c.ref;
                                  })()}
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                              {(() => { const j = joursRestants(c.delai); const rouge = j !== null && j <= 3; return (
                          <div>
                            <div style={{ fontSize: 12, color: rouge ? "#DC2626" : "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                            {j !== null && <div style={{ fontSize: 10, fontWeight: 600, color: rouge ? "#DC2626" : "#9CA3AF" }}>{j === 0 ? "Aujourd'hui" : j < 0 ? `${Math.abs(j)}j dépassé` : `${j}j restant${j > 1 ? "s" : ""}`}</div>}
                          </div>
                        ); })()}
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
                    onArchiver={null}
                    showContacts={false}
                    actionButtons={
                      <>
                        {selected.statut === "En attente" && (
                          <button onClick={() => commencer(selected.id)}
                            style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#FC6C1B", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
                            🚀 Commencer la mission
                          </button>
                        )}
                        {peutDeposer && (
                          <button onClick={() => setShowDepotModal(true)}
                            style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
                            📤 Déposer une ébauche
                          </button>
                        )}
                        {selected.statut === "Validation en cours" && (
                          <>
                            <button onClick={() => setShowPlansFinalModal(true)}
                              style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#047857", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
                              📐 Déposer les plans finaux
                            </button>
                            <button onClick={() => annulerPlansFinal()}
                              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#92400E", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>
                              ↩️ Revenir en ébauche
                            </button>
                          </>
                        )}
                        {selected.statut === "Validé" && (
                          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46" }}>
                            ✅ Mission validée par le client
                          </div>
                        )}
                      </>
                    }
                    msgInput={msgInput}
                    setMsgInput={setMsgInput}
                    onEnvoyer={async (texte, fichiers) => {
                      if (!texte.trim() && !fichiers?.length) return;
                      await envoyerMessage(selected.id, auteurNom, texte, fichiers);
                    }}
                    auteurNom={auteurNom}
                    onMarquerLu={() => marquerMessagesLus(selected?.id)}
                    note={note}
                    setNote={setNote}
                    onSaveNote={sauvegarderNote}
                    noteSaveError={noteSaveError}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
      </div>

      {/* Modal dépôt plans finaux */}
      {showPlansFinalModal && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 560, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📐 Déposer les plans finaux</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>1 fichier requis par plan. Le client validera la commande une fois tous les plans déposés.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selected.plans.map((p, i) => {
                const fichierExistant = (selected.plansFinalises || []).find(f => f.plan_index === i);
                const enUpload = uploadingPlanIndex === i;
                const disabled = uploadingPlanIndex !== null;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: fichierExistant ? "#F0FDF4" : "#F9FAFB" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>N°{i + 1} — {p.type} · {p.orientation} · {p.format}</div>
                      <div style={{ fontSize: 11, color: fichierExistant ? "#047857" : "#9CA3AF", marginTop: 2 }}>
                        {fichierExistant ? `✅ ${fichierExistant.nom} (${fichierExistant.taille})` : "Pas encore déposé"}
                      </div>
                    </div>
                    <label style={{ flexShrink: 0 }}>
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf" style={{ display: "none" }}
                        disabled={disabled}
                        onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) deposerPlanFinal(i, f); }} />
                      <span style={{ display: "inline-block", padding: "7px 14px", borderRadius: 7, border: "1px solid #D1D5DB", background: disabled ? "#F3F4F6" : "#fff", color: disabled ? "#9CA3AF" : "#374151", fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" }}>
                        {enUpload ? "⏳ Envoi..." : fichierExistant ? "🔄 Remplacer" : "📎 Choisir"}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowPlansFinalModal(false)} disabled={uploadingPlanIndex !== null}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: uploadingPlanIndex !== null ? "not-allowed" : "pointer" }}>
                ✕ Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal dépôt ébauche */}
      {showDepotModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📤 Déposer une ébauche</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Le statut passera en "Ébauche déposée" automatiquement.</div>
            <ZoneUpload label="Fichiers de l'ébauche *" fichiers={fichiersDepot} onAjouter={f => setFichiersDepot(f)} onSupprimer={i => setFichiersDepot(fichiersDepot.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf" maxFichiers={20} />
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Message joint (optionnel)</label>
              <textarea value={messageDepot} onChange={e => setMessageDepot(e.target.value)} rows={3} placeholder="Ajoutez un commentaire sur cette ébauche..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => { setShowDepotModal(false); setFichiersDepot([]); setMessageDepot(""); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={deposerVersion} disabled={!fichiersDepot.length || deposant}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: !fichiersDepot.length ? "#F3F4F6" : "#122131", color: !fichiersDepot.length ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: !fichiersDepot.length ? "not-allowed" : "pointer" }}>
                {deposant ? "Dépôt..." : "Déposer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
