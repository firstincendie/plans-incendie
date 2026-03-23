import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { planVide } from "./constants";
import { formatDateMsg, formatDateCourt, appliquerFiltresTri } from "./helpers";
import Badge from "./components/Badge";
import BlocAdresse from "./components/BlocAdresse";
import ChampCopiable from "./components/ChampCopiable";
import TableauPlans from "./components/TableauPlans";
import ZoneUpload from "./components/ZoneUpload";
import { ListeFichiers, LogoCliquable } from "./components/VisuFichier";
import HistoriqueVersions from "./components/HistoriqueVersions";
import BarreFiltres from "./components/BarreFiltres";
import Messagerie from "./components/Messagerie";
import PageReglages from "./components/PageReglages";
import VueDessinateur from "./components/VueDessinateur";
import VueClient from "./components/VueClient";
import GestionUtilisateurs from "./components/GestionUtilisateurs";
import PageMonCompte from "./components/PageMonCompte";
import GestionCompteDessinateur from "./components/GestionCompteDessinateur";
import PageConnexion from "./components/auth/PageConnexion";
import PageInscription from "./components/auth/PageInscription";
import PageMotDePasseOublie from "./components/auth/PageMotDePasseOublie";

function SwitcherBarre({
  modeVue, setModeVue,
  profilesDessinateurs, dessinateurSelectionne, setDessinateurSelectionne,
  showDropdownDessinateur, setShowDropdownDessinateur,
  profilesClients, clientSelectionne, setClientSelectionne,
  showDropdownClient, setShowDropdownClient,
}) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "#1E293B", padding: "8px 20px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, letterSpacing: "0.05em", marginRight: 4 }}>VUE ADMIN</span>
      <div style={{ display: "flex", gap: 4, background: "#0F172A", borderRadius: 8, padding: 3 }}>

        {/* Admin */}
        <button onClick={() => setModeVue("admin")}
          style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: modeVue === "admin" ? "#386CA3" : "transparent", color: modeVue === "admin" ? "#fff" : "#94A3B8" }}>
          👤 Admin
        </button>

        {/* Dessinateur */}
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (modeVue !== "dessinateur") { setModeVue("dessinateur"); setShowDropdownDessinateur(false); setShowDropdownClient(false); }
              else if (profilesDessinateurs.length > 1) setShowDropdownDessinateur(v => !v);
            }}
            disabled={profilesDessinateurs.length === 0}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: profilesDessinateurs.length === 0 ? "not-allowed" : "pointer", background: modeVue === "dessinateur" ? "#FC6C1B" : "transparent", color: modeVue === "dessinateur" ? "#fff" : profilesDessinateurs.length === 0 ? "#4B5563" : "#94A3B8", display: "flex", alignItems: "center", gap: 6 }}>
            ✏️ {dessinateurSelectionne?.nom_complet ?? "Aucun compte"}{profilesDessinateurs.length > 1 ? " ▾" : ""}
          </button>
          {showDropdownDessinateur && profilesDessinateurs.length > 0 && (
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#1E293B", border: "1px solid #334155", borderRadius: 8, overflow: "hidden", minWidth: 160, zIndex: 200 }}>
              {profilesDessinateurs.map(p => (
                <button key={p.id} onClick={() => { setDessinateurSelectionne(p); setShowDropdownDessinateur(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: dessinateurSelectionne?.id === p.id ? "#0F172A" : "transparent", border: "none", fontSize: 12, color: dessinateurSelectionne?.id === p.id ? "#FC6C1B" : "#CBD5E1", cursor: "pointer", fontWeight: dessinateurSelectionne?.id === p.id ? 700 : 400 }}>
                  {p.nom_complet}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Client */}
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (modeVue !== "client") { setModeVue("client"); setShowDropdownClient(false); setShowDropdownDessinateur(false); }
              else if (profilesClients.length > 1) setShowDropdownClient(v => !v);
            }}
            disabled={profilesClients.length === 0}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: profilesClients.length === 0 ? "not-allowed" : "pointer", background: modeVue === "client" ? "#059669" : "transparent", color: modeVue === "client" ? "#fff" : profilesClients.length === 0 ? "#4B5563" : "#94A3B8", display: "flex", alignItems: "center", gap: 6 }}>
            👥 {clientSelectionne?.nom_complet ?? "Aucun compte"}{profilesClients.length > 1 ? " ▾" : ""}
          </button>
          {showDropdownClient && profilesClients.length > 0 && (
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#1E293B", border: "1px solid #334155", borderRadius: 8, overflow: "hidden", minWidth: 160, zIndex: 200 }}>
              {profilesClients.map(p => (
                <button key={p.id} onClick={() => { setClientSelectionne(p); setShowDropdownClient(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: clientSelectionne?.id === p.id ? "#0F172A" : "transparent", border: "none", fontSize: 12, color: clientSelectionne?.id === p.id ? "#059669" : "#CBD5E1", cursor: "pointer", fontWeight: clientSelectionne?.id === p.id ? 700 : 400 }}>
                  {p.nom_complet}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession]                   = useState(undefined); // undefined = chargement, null = non connecté
  const [profil, setProfil]                     = useState(null);
  const [pageAuth, setPageAuth]                 = useState("connexion"); // connexion | inscription | mdp_oublie
  const [nbAttente, setNbAttente]               = useState(0);
  const [showMenuProfil, setShowMenuProfil]     = useState(false);

  const [commandes, setCommandes]               = useState([]);
  const [versions, setVersions]                 = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [vue, setVue]                           = useState("commandes");
  const [selected, setSelected]                 = useState(null);
  const [showForm, setShowForm]                 = useState(false);
  const [msgInput, setMsgInput]                 = useState("");
  const [saving, setSaving]                     = useState(false);
  const [modeVue, setModeVue]                   = useState("admin");
  const [profilesDessinateurs, setProfilesDessinateurs] = useState([]);
  const [profilesClients, setProfilesClients]           = useState([]);
  const [dessinateurSelectionne, setDessinateurSelectionne] = useState(null);
  const [clientSelectionne, setClientSelectionne]       = useState(null);
  const [showDropdownDessinateur, setShowDropdownDessinateur] = useState(false);
  const [showDropdownClient, setShowDropdownClient]     = useState(false);
  const [filtres, setFiltres]                   = useState({ statut: "", dessinateur: "", type: "", periode: "", client: "" });
  const [tri, setTri]                           = useState({ col: "created_at", dir: "desc" });
  const [showModifModal, setShowModifModal]     = useState(false);
  const [modifMsg, setModifMsg]                 = useState("");
  const [modifFichiers, setModifFichiers]       = useState([]);
  const [envoyantModif, setEnvoyantModif]       = useState(false);
  const [showValidModal, setShowValidModal]     = useState(false);
  const [validant, setValidant]                 = useState(false);
  const [showTermineesAdmin, setShowTermineesAdmin] = useState(false);
  const [dessinateurAssigne, setDessinateurAssigne] = useState(null);
  const [sousComptes, setSousComptes] = useState([]);

  // eslint-disable-next-line no-unused-vars
  const [settings, setSettings] = useState({
    nomEntreprise: "First Incendie", email: "contact@firstincendie.fr",
    telephone: "02 XX XX XX XX", logoUrl: null, logoNom: null,
  });

  const formVide = () => ({
    client: "", batiment: "", adresse1: "", adresse2: "", code_postal: "", ville: "",
    delai: "", dessinateur: settings.nomEntreprise, notes: "", plans: [planVide()], fichiersPlan: [], logoClient: [],
  });
  const [form, setForm] = useState(formVide());

  // Auth : écoute la session Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) chargerProfil(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) chargerProfil(session.user.id);
      else setProfil(null);
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line

  const chargerProfil = async (uid) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfil(data);
    setSousComptes([]);
    if (data?.role === "admin") { chargerNbAttente(); chargerProfilesPreview(); }
    // Charger dessinateur assigné pour les clients
    if (data?.role === "client") {
      const { data: lien } = await supabase
        .from("client_dessinateurs")
        .select("dessinateur_id, profiles!dessinateur_id(prenom, nom)")
        .eq("client_id", uid)
        .limit(1)
        .maybeSingle();
      setDessinateurAssigne(lien?.profiles ? `${lien.profiles.prenom} ${lien.profiles.nom}` : null);
    }
    // Sous-comptes pour client/dessinateur
    if (data?.role === "client" || data?.role === "dessinateur") {
      const { data: sub } = await supabase
        .from("profiles")
        .select("id, prenom, nom, role")
        .eq("master_id", uid);
      setSousComptes(sub || []);
    }
  };

  const chargerNbAttente = async () => {
    const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("statut", "en_attente");
    setNbAttente(count || 0);
  };

  const chargerProfilesPreview = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, prenom, nom, role")
      .in("role", ["dessinateur", "client"])
      .eq("statut", "actif")
      .ilike("email", "%@test.com");
    if (error) { console.warn("chargerProfilesPreview:", error.message); return; }
    const dessinateurs = (data || []).filter(p => p.role === "dessinateur")
      .map(p => ({ ...p, nom_complet: `${p.prenom} ${p.nom}` }));
    const clients = (data || []).filter(p => p.role === "client")
      .map(p => ({ ...p, nom_complet: `${p.prenom} ${p.nom}` }));
    setProfilesDessinateurs(dessinateurs);
    setProfilesClients(clients);
    setDessinateurSelectionne(dessinateurs[0] ?? null);
    setClientSelectionne(clients[0] ?? null);
  };

  useEffect(() => {
    chargerTout();

    // Realtime — nouveau message → badge instantané
    const canal = supabase
      .channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        setCommandes(prev => prev.map(c =>
          c.id === msg.commande_id
            ? { ...c, messages: [...c.messages, msg] }
            : c
        ));
        // Sync selected si la commande est ouverte
        setSelected(prev =>
          prev && prev.id === msg.commande_id
            ? { ...prev, messages: [...prev.messages, msg] }
            : prev
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, []); // eslint-disable-line

  async function chargerTout() {
    setLoading(true);
    const [{ data: cmd }, { data: ver }] = await Promise.all([
      supabase.from("commandes").select("*, messages(*)").order("created_at", { ascending: false }),
      supabase.from("versions").select("*").order("numero", { ascending: true }),
    ]);
    if (cmd) setCommandes(cmd.map(c => ({
      ...c,
      plans: c.plans || [], fichiersPlan: c.fichiers_plan || [],
      logoClient: c.logo_client || [], plansFinalises: c.plans_finalises || [],
      messages: (c.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    })));
    if (ver) setVersions(ver);
    setLoading(false);
  }

  async function creerCommande() {
    if (!form.client || !form.delai || form.fichiersPlan.length === 0) return;
    const aujourd_hui = new Date().toISOString().split("T")[0];
    if (form.delai < aujourd_hui) { alert("La date ne peut pas être inférieure à aujourd'hui."); return; }
    setSaving(true);
    const ref = "CMD-" + String(commandes.length + 1).padStart(3, "0");
    const { data, error } = await supabase.from("commandes").insert([{
      ref, client: form.client, batiment: form.batiment, delai: form.delai,
      dessinateur: form.dessinateur, plans: form.plans,
      fichiers_plan: form.fichiersPlan, logo_client: form.logoClient,
      adresse1: form.adresse1, adresse2: form.adresse2,
      code_postal: form.code_postal, ville: form.ville,
      plans_finalises: [], statut: "En attente",
    }]).select("*, messages(*)").single();
    if (!error && data) {
      const nouvelleCommande = { ...data, plans: data.plans || [], fichiersPlan: data.fichiers_plan || [], logoClient: data.logo_client || [], plansFinalises: [], messages: [] };
      // Si des instructions ont été saisies, les envoyer comme premier message
      if (form.notes.trim()) {
        const { data: msg } = await supabase.from("messages").insert([{
          commande_id: data.id, auteur: "Simon", texte: form.notes.trim(), fichiers: [],
          date: formatDateMsg(),
        }]).select().single();
        if (msg) nouvelleCommande.messages = [msg];
      }
      setCommandes(prev => [nouvelleCommande, ...prev]);
    }
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
      commande_id: commandeId, auteur, texte: texte || "", fichiers,
      date: formatDateMsg(),
    }]).select().single();
    if (!error && data) {
      setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, messages: [...c.messages, data] } : c));
      if (selected?.id === commandeId) setSelected(prev => ({ ...prev, messages: [...prev.messages, data] }));
    }
  }

  async function deposerVersion(commandeId, fichiers, numero, deposee_par) {
    const { data, error } = await supabase.from("versions").insert([{ commande_id: commandeId, fichiers, numero, deposee_par }]).select().single();
    if (!error && data) setVersions(prev => [...prev, data]);
  }

  async function envoyerDemandeModification() {
    if (!modifMsg.trim() || !selected) return;
    setEnvoyantModif(true);
    await envoyerMessage(selected.id, "Simon", modifMsg, modifFichiers);
    await changerStatut(selected.id, "Modification dessinateur");
    setModifMsg(""); setModifFichiers([]); setShowModifModal(false); setEnvoyantModif(false);
  }

  async function validerCommande() {
    if (!selected) return;
    setValidant(true);
    await changerStatut(selected.id, "Validé");
    await envoyerMessage(selected.id, "Simon", "✅ Commande validée. Merci pour votre travail !");
    setShowValidModal(false); setValidant(false);
  }

  const stats = {
    total:   commandes.length,
    enCours: commandes.filter(c => c.statut === "Commencé" || c.statut === "Ébauche déposée").length,
    attente: commandes.filter(c => c.statut === "En attente" || c.statut === "Modification dessinateur").length,
    valides: commandes.filter(c => c.statut === "Validé").length,
  };

  const cmdFiltrees  = appliquerFiltresTri(commandes, filtres, tri);
  const cmdAffichees = vue === "dashboard" ? cmdFiltrees.slice(0, 5) : cmdFiltrees;
  const inputStyle   = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle   = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4 };

  // Affichage de chargement initial
  if (session === undefined) {
    return <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 14 }}>Chargement...</div>;
  }

  // Pages d'authentification (non connecté)
  if (!session) {
    if (pageAuth === "inscription") return <PageInscription onRetour={() => setPageAuth("connexion")} />;
    if (pageAuth === "mdp_oublie") return <PageMotDePasseOublie onRetour={() => setPageAuth("connexion")} />;
    return <PageConnexion onMotDePasseOublie={() => setPageAuth("mdp_oublie")} onInscription={() => setPageAuth("inscription")} />;
  }

  // Compte en attente de validation
  if (profil && profil.statut === "en_attente") {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 420, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#122131", marginBottom: 12 }}>Votre compte est en attente</div>
          <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Un administrateur va examiner votre demande. Vous recevrez un email dès que votre compte sera activé.
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // Compte refusé
  if (profil && profil.statut === "refuse") {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 420, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#122131", marginBottom: 12 }}>Demande refusée</div>
          <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Votre demande d'accès n'a pas été acceptée. Contactez-nous pour plus d'informations.
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }
  const versionsSelected = selected ? versions.filter(v => v.commande_id === selected.id) : [];

  if (modeVue === "dessinateur" && profil?.role === "admin") {
    return (
      <div onClick={() => { setShowMenuProfil(false); setShowDropdownDessinateur(false); setShowDropdownClient(false); }}>
        <SwitcherBarre
          modeVue={modeVue} setModeVue={setModeVue}
          profilesDessinateurs={profilesDessinateurs}
          dessinateurSelectionne={dessinateurSelectionne} setDessinateurSelectionne={setDessinateurSelectionne}
          showDropdownDessinateur={showDropdownDessinateur} setShowDropdownDessinateur={setShowDropdownDessinateur}
          profilesClients={profilesClients}
          clientSelectionne={clientSelectionne} setClientSelectionne={setClientSelectionne}
          showDropdownClient={showDropdownClient} setShowDropdownClient={setShowDropdownClient}
        />
        <div style={{ paddingTop: 44 }}>
          <VueDessinateur commandes={commandes} versions={versions}
            nomDessinateur={dessinateurSelectionne?.nom_complet ?? ""}
            onChangerStatut={changerStatut} onEnvoyerMessage={envoyerMessage} onDeposerVersion={deposerVersion} />
        </div>
      </div>
    );
  }

  if (modeVue === "client" && profil?.role === "admin") {
    return (
      <div onClick={() => { setShowMenuProfil(false); setShowDropdownDessinateur(false); setShowDropdownClient(false); }}>
        <SwitcherBarre
          modeVue={modeVue} setModeVue={setModeVue}
          profilesDessinateurs={profilesDessinateurs}
          dessinateurSelectionne={dessinateurSelectionne} setDessinateurSelectionne={setDessinateurSelectionne}
          showDropdownDessinateur={showDropdownDessinateur} setShowDropdownDessinateur={setShowDropdownDessinateur}
          profilesClients={profilesClients}
          clientSelectionne={clientSelectionne} setClientSelectionne={setClientSelectionne}
          showDropdownClient={showDropdownClient} setShowDropdownClient={setShowDropdownClient}
        />
        <div style={{ paddingTop: 44 }}>
          <VueClient
            commandes={commandes}
            versions={versions}
            clientSelectionne={clientSelectionne}
            session={session}
            profil={profil}
            onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))}
            onChangerStatut={changerStatut}
            onEnvoyerMessage={envoyerMessage}
          />
        </div>
      </div>
    );
  }

  // Layout pour les rôles dessinateur et client
  if (profil?.role === "dessinateur" || profil?.role === "client") {
    const isDessinateur = profil.role === "dessinateur";
    const nomDessinateur = `${profil.prenom} ${profil.nom}`;
    const roleLabel = isDessinateur ? "Dessinateur" : "Client";
    const roleNav = [
      { id: "commandes",      label: isDessinateur ? "Mes missions" : "Commandes", icon: "📋" },
      ...(isDessinateur ? [{ id: "gestion-compte", label: "Gestion de compte", icon: "📁" }] : []),
      { id: "reglages",       label: "Réglages",   icon: "⚙️" },
      { id: "mon-compte",     label: "Mon compte", icon: "👤" },
    ];
    return (
      <div onClick={() => showMenuProfil && setShowMenuProfil(false)} style={{ display: "flex", height: "100dvh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}>
        {/* Sidebar */}
        <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px 0 12px", gap: 4, position: "fixed", top: 0, height: "100dvh", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
            <div style={{ width: 32, height: 32, background: "#122131", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 16 }}>🔥</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{settings.nomEntreprise}</span>
          </div>
          {roleNav.map(item => (
            <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#E8EDF2" : "transparent", color: vue === item.id ? "#122131" : "#6B7280", textAlign: "left", width: "100%" }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          {/* Bas de sidebar — menu utilisateur */}
          <div style={{ marginTop: "auto", position: "relative", paddingBottom: 12 }}>
            {showMenuProfil && (
              <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.10)", overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#122131" }}>{profil?.prenom} {profil?.nom}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{session?.user?.email}</div>
                </div>
                <button onClick={() => supabase.auth.signOut()}
                  style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13, color: "#DC2626", cursor: "pointer" }}>
                  ↪ Se déconnecter
                </button>
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); setShowMenuProfil(v => !v); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: showMenuProfil ? "#F1F5F9" : "transparent", border: "none", borderTop: "1px solid #E5E7EB", cursor: "pointer", textAlign: "left" }}>
              {profil?.avatar_url ? (
                <img src={profil.avatar_url} alt="avatar" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid #E2E8F0" }} />
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#122131", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {profil ? `${(profil.prenom?.[0] || "").toUpperCase()}${(profil.nom?.[0] || "").toUpperCase()}` : "?"}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#122131", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {profil ? `${profil.prenom} ${profil.nom}` : "—"}
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{roleLabel}</div>
              </div>
              <span style={{ fontSize: 9, color: "#CBD5E1", flexShrink: 0 }}>{showMenuProfil ? "▼" : "▲"}</span>
            </button>
          </div>
        </div>

        {/* Contenu principal */}
        <div style={{ marginLeft: 220, flex: 1, padding: "32px 32px", overflowY: "auto" }}>
          {vue === "reglages" && <PageReglages />}

          {vue === "mon-compte" && (
            <PageMonCompte profil={profil} session={session} role={profil.role} commandes={commandes}
              dessinateurAssigne={dessinateurAssigne}
              onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))} />
          )}

          {vue === "gestion-compte" && isDessinateur && (
            <GestionCompteDessinateur profil={profil} commandes={commandes} />
          )}

          {vue === "commandes" && isDessinateur && (
            <VueDessinateur noLayout commandes={commandes} versions={versions} nomDessinateur={nomDessinateur}
              sousComptes={sousComptes}
              onChangerStatut={changerStatut} onEnvoyerMessage={envoyerMessage} onDeposerVersion={deposerVersion} />
          )}

          {vue === "commandes" && !isDessinateur && (
            <VueClient
              noLayout
              commandes={commandes}
              versions={versions}
              clientSelectionne={{ ...profil, nom_complet: `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim() }}
              sousComptes={sousComptes}
              session={session}
              profil={profil}
              onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))}
              onChangerStatut={changerStatut}
              onEnvoyerMessage={envoyerMessage}
              onNouvelleCommande={() => {
                setForm({ ...formVide(), client: `${profil.prenom} ${profil.nom}` });
                setShowForm(true);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  const isAdmin = profil?.role === "admin";
  const barreVisible = isAdmin;
  const topOffset = barreVisible ? 44 : 0;

  const ROLE_LABELS = { admin: "Admin", client: "Client", dessinateur: "Dessinateur" };

  return (
    <div onClick={() => { setShowMenuProfil(false); setShowDropdownDessinateur(false); setShowDropdownClient(false); }}>
      <SwitcherBarre
        modeVue={modeVue} setModeVue={setModeVue}
        profilesDessinateurs={profilesDessinateurs}
        dessinateurSelectionne={dessinateurSelectionne} setDessinateurSelectionne={setDessinateurSelectionne}
        showDropdownDessinateur={showDropdownDessinateur} setShowDropdownDessinateur={setShowDropdownDessinateur}
        profilesClients={profilesClients}
        clientSelectionne={clientSelectionne} setClientSelectionne={setClientSelectionne}
        showDropdownClient={showDropdownClient} setShowDropdownClient={setShowDropdownClient}
      />
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827", paddingTop: topOffset }}>
        <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px 0 12px", gap: 4, position: "fixed", top: topOffset, height: `calc(100dvh - ${topOffset}px)`, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
            {settings.logoUrl ? <img src={settings.logoUrl} alt="logo" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 6 }} />
              : <div style={{ width: 32, height: 32, background: "#122131", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "white", fontSize: 16 }}>🔥</span></div>}
            <span style={{ fontWeight: 700, fontSize: 14 }}>{settings.nomEntreprise}</span>
          </div>
          {[
            { id: "commandes", label: "Commandes", icon: "📋" },
            { id: "utilisateurs", label: "Utilisateurs", icon: "👥", badge: nbAttente },
            { id: "reglages", label: "Réglages", icon: "⚙️" },
            { id: "mon-compte", label: "Mon compte", icon: "👤" },
          ].map(item => (
            <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); if (item.id === "utilisateurs") chargerNbAttente(); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#E8EDF2" : "transparent", color: vue === item.id ? "#122131" : "#6B7280", textAlign: "left", width: "100%" }}>
              <span>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{item.badge}</span>}
            </button>
          ))}
          <div style={{ marginTop: "auto", position: "relative", paddingBottom: 12 }}>
            {showMenuProfil && (
              <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.10)", overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#122131" }}>{profil?.prenom} {profil?.nom}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{session?.user?.email}</div>
                </div>
                <button onClick={() => supabase.auth.signOut()}
                  style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13, color: "#DC2626", cursor: "pointer" }}>
                  ↪ Se déconnecter
                </button>
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenuProfil(v => !v); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: showMenuProfil ? "#F1F5F9" : "transparent", border: "none", borderTop: "1px solid #E5E7EB", cursor: "pointer", textAlign: "left" }}
            >
              {profil?.avatar_url ? (
                <img src={profil.avatar_url} alt="avatar" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid #E2E8F0" }} />
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#122131", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0, letterSpacing: "0.02em" }}>
                  {profil ? `${(profil.prenom?.[0] || "").toUpperCase()}${(profil.nom?.[0] || "").toUpperCase()}` : "?"}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#122131", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {profil ? `${profil.prenom} ${profil.nom}` : "—"}
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{ROLE_LABELS[profil?.role] || "—"}</div>
              </div>
              <span style={{ fontSize: 9, color: "#CBD5E1", flexShrink: 0 }}>
                {showMenuProfil ? "▼" : "▲"}
              </span>
            </button>
          </div>
        </div>

        <div style={{ marginLeft: 220, flex: 1, padding: "32px 32px" }}>
          {vue === "reglages" && <PageReglages />}
          {vue === "utilisateurs" && <GestionUtilisateurs />}
          {vue === "mon-compte" && <PageMonCompte profil={profil} session={session} role="admin" commandes={commandes} dessinateurAssigne={dessinateurAssigne} onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))} />}

          {vue !== "reglages" && vue !== "utilisateurs" && vue !== "mon-compte" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Commandes</h1>
                <button onClick={() => setShowForm(true)} style={{ background: "#122131", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  + Nouvelle commande
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Total commandes",     val: stats.total,   color: "#111827" },
                  { label: "En cours",            val: stats.enCours, color: "#122131" },
                  { label: "En attente / modif.", val: stats.attente, color: "#B45309" },
                  { label: "Validés",             val: stats.valides, color: "#059669" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>

              <BarreFiltres commandes={commandes} filtres={filtres} setFiltres={setFiltres} tri={tri} setTri={setTri} showDessinateur={true} />

              {loading ? (
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "40px", textAlign: "center", color: "#9CA3AF" }}>Chargement...</div>
              ) : (() => {
                const actives  = cmdAffichees.filter(c => c.statut !== "Validé");
                const terminees = cmdAffichees.filter(c => c.statut === "Validé");

                const EnteteTableau = () => (
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <span>Client</span><span>Bâtiment</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
                  </div>
                );

                const LigneCommande = ({ c }) => {
                  const dernierMsg = c.messages[c.messages.length - 1];
                  const hasNouveauMsg = dernierMsg && dernierMsg.auteur !== "Simon" && selected?.id !== c.id;
                  return (
                    <div onClick={() => setSelected(c)}
                      style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EEF3F8" : "transparent", transition: "background 0.1s" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.client}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{c.batiment || "—"}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Badge statut={c.statut} />
                        {hasNouveauMsg && (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FC6C1B", display: "inline-block", flexShrink: 0 }} title="Nouveau message" />
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {/* Commandes actives */}
                    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                      <EnteteTableau />
                      {actives.length === 0 && <div style={{ padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande active.</div>}
                      {actives.map(c => <LigneCommande key={c.id} c={c} />)}
                    </div>

                    {/* Commandes terminées — repliables */}
                    {terminees.length > 0 && (
                      <div style={{ marginBottom: selected ? 24 : 0 }}>
                        <button onClick={() => setShowTermineesAdmin(v => !v)}
                          style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
                          {showTermineesAdmin ? "▲ Masquer les commandes validées" : `▼ Voir les ${terminees.length} commande${terminees.length > 1 ? "s" : ""} validée${terminees.length > 1 ? "s" : ""}`}
                        </button>
                        {showTermineesAdmin && (
                          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", opacity: 0.8 }}>
                            <EnteteTableau />
                            {terminees.map(c => <LigneCommande key={c.id} c={c} />)}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              {selected && (
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.client}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.ref}{selected.batiment ? ` · ${selected.batiment}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge statut={selected.statut} />
                      <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                    {[
                      { label: "Client",      val: <ChampCopiable valeur={selected.client} label="le client" /> },
                      { label: "Dessinateur", val: selected.dessinateur || "Non assigné" },
                      { label: "Créé le",     val: formatDateCourt(selected.created_at) },
                      { label: "Délai",       val: selected.delai ? formatDateCourt(selected.delai) : "—" },
                      { label: "Nb. plans",   val: selected.plans.length },
                    ].map(f => <div key={f.label}><div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div></div>)}
                  </div>

                  {/* Adresse */}
                  <BlocAdresse commande={selected} copiable={true} />

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Détail des plans</div>
                    <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "8px 14px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
                        <span>N°</span><span>Type</span><span>Orientation</span><span>Format</span>
                      </div>
                      {selected.plans.map((p, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "9px 14px", borderBottom: i < selected.plans.length - 1 ? "1px solid #F3F4F6" : "none", fontSize: 13 }}>
                          <span style={{ color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</span>
                          <span>{p.type}</span><span style={{ color: "#6B7280" }}>{p.orientation}</span><span style={{ color: "#6B7280" }}>{p.format}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fichiers sources */}
                  {selected.fichiersPlan?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Fichiers sources ({selected.fichiersPlan.length})</div>
                      <ListeFichiers fichiers={selected.fichiersPlan} couleurAccent="#122131" />
                    </div>
                  )}

                  {/* Logo client */}
                  {selected.logoClient?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Logo client</div>
                      <LogoCliquable fichier={selected.logoClient[0]} />
                    </div>
                  )}

                  <HistoriqueVersions versions={versionsSelected} />

                  {/* Boutons action admin */}
                  {selected.statut === "Ébauche déposée" && (
                    <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                      <button onClick={() => setShowModifModal(true)}
                        style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#92400E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        ✏️ Demander une modification
                      </button>
                      <button onClick={() => setShowValidModal(true)}
                        style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        ✅ Valider la commande
                      </button>
                    </div>
                  )}

                  {selected.statut === "Validé" ? (
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46", fontWeight: 500 }}>
                      ✅ Commande validée — messagerie fermée
                    </div>
                  ) : (
                    <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
                      onEnvoyer={async (texte, fichiers) => { if (!texte.trim() && (!fichiers || fichiers.length === 0)) return; await envoyerMessage(selected.id, "Simon", texte, fichiers); }}
                      auteurActif="Simon" allowFichier={true} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal demande modification */}
      {showModifModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✏️ Demander une modification</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Le statut passera en "Modification dessinateur".</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 }}>Message *</label>
              <textarea value={modifMsg} onChange={e => setModifMsg(e.target.value)} rows={4} placeholder="Décrivez les modifications..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <ZoneUpload label="📎 Fichiers joints (optionnel)" fichiers={modifFichiers} onAjouter={f => setModifFichiers(f)} onSupprimer={i => setModifFichiers(modifFichiers.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf" maxFichiers={5} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowModifModal(false); setModifMsg(""); setModifFichiers([]); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={envoyerDemandeModification} disabled={!modifMsg.trim() || envoyantModif}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: !modifMsg.trim() ? "#F3F4F6" : "#D97706", color: !modifMsg.trim() ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: !modifMsg.trim() ? "not-allowed" : "pointer" }}>
                {envoyantModif ? "Envoi..." : "Envoyer la demande"}
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
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{selected?.client}</div>
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

      {/* Modal nouvelle commande */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 640, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nouvelle commande</h2>
              <button onClick={() => setShowForm(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
            </div>

            {/* Client en premier */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={labelStyle}>Client *</label><input type="text" value={form.client} placeholder="Nom de la société" onChange={e => setForm({ ...form, client: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Bâtiment / Référence</label><input type="text" value={form.batiment} placeholder="Ex: Résidence Les Pins" onChange={e => setForm({ ...form, batiment: e.target.value })} style={inputStyle} /></div>
            </div>

            {/* Adresse */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Adresse</label>
              <input type="text" value={form.adresse1} placeholder="Adresse ligne 1" onChange={e => setForm({ ...form, adresse1: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
              <input type="text" value={form.adresse2} placeholder="Complément d'adresse" onChange={e => setForm({ ...form, adresse2: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                <input type="text" value={form.code_postal} placeholder="Code postal" onChange={e => setForm({ ...form, code_postal: e.target.value })} style={inputStyle} />
                <input type="text" value={form.ville} placeholder="Ville" onChange={e => setForm({ ...form, ville: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Délai souhaité *</label>
                <input type="date" value={form.delai} min={new Date().toISOString().split("T")[0]} onChange={e => setForm({ ...form, delai: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Plans à réaliser</label>
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px" }}>
                <TableauPlans plans={form.plans} onChange={plans => setForm({ ...form, plans })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <ZoneUpload label="📄 Fichiers du plan *" fichiers={form.fichiersPlan} onAjouter={f => setForm({ ...form, fichiersPlan: f })} onSupprimer={i => setForm({ ...form, fichiersPlan: form.fichiersPlan.filter((_, idx) => idx !== i) })} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf" maxFichiers={10} />
              <ZoneUpload label="🏢 Logo du client" fichiers={form.logoClient} onAjouter={f => setForm({ ...form, logoClient: f })} onSupprimer={() => setForm({ ...form, logoClient: [] })} accept="image/*" unique={true} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Instructions pour le dessinateur</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Ce message sera envoyé automatiquement dans le chat de la commande..." style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            {(() => {
              const manque = [];
              if (!form.client)      manque.push("client");
              if (!form.delai)       manque.push("délai");
              else if (form.delai < new Date().toISOString().split("T")[0]) manque.push("délai invalide");
              if (form.fichiersPlan.length === 0) manque.push("1 fichier minimum");
              const ok = manque.length === 0;
              return (
                <div>
                  {!ok && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>Champs manquants : {manque.join(", ")}</div>}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button onClick={() => { setShowForm(false); setForm(formVide()); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
                    <button onClick={creerCommande} disabled={saving || !ok}
                      style={{ padding: "9px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: !ok ? "not-allowed" : "pointer", background: !ok ? "#F3F4F6" : "#122131", color: !ok ? "#9CA3AF" : "#fff" }}>
                      {saving ? "Enregistrement..." : "Créer la commande"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
