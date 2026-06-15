import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "./Sidebar";
import AnnoncesModal from "./AnnoncesModal";

export default function LayoutPrincipal({ session, profil, onProfilUpdate }) {
  const [commandes, setCommandes] = useState([]);
  const [sousComptes, setSousComptes] = useState([]);
  // Utilisateurs supervisables par l'admin (filtre "par utilisateur" dans Commandes).
  // Compatible avec un futur système de compte parent (children via master_id).
  const [utilisateursSupervises, setUtilisateursSupervises] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const isAdmin = profil.role !== "dessinateur" && profil.is_owner === true;

  // auteurNom used in realtime handler and normalizations
  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();
  // Keep a ref so the realtime handler always reads the current value
  const auteurNomRef = useRef(auteurNom);
  auteurNomRef.current = auteurNom;

  // Visibilité d'un message selon le rôle (notes privées historiques + portée).
  // Ref pour rester accessible dans le handler realtime.
  const peutVoirMessageRef = useRef();
  peutVoirMessageRef.current = (m, nom) => {
    if (m.auteur === nom) return true; // l'auteur voit toujours son propre message
    if (m.visible_par && !m.visible_par.includes(nom)) return false;
    // /note : visible par l'auteur (ci-dessus) + l'admin (ou parent, à venir)
    const estAdmin = profil.role !== "dessinateur" && profil.is_owner === true;
    if ((m.portee || "public") === "note" && !estAdmin) return false;
    return true;
  };

  // Nombre de commandes actives avec notification (messages non lus OU marquage manuel)
  // — même décompte que la pastille a cote du titre de la page Commandes.
  const role = profil.role;
  // Notifications uniquement sur SES propres commandes (proprietaire ou
  // dessinateur assigne) — pas en supervision admin.
  const estMaCommande = (c) => c.utilisateur_id === profil.id || c.dessinateur_id === profil.id;
  const totalNonLus = commandes.filter(c => {
    if (!estMaCommande(c)) return false;
    const archived = role === "dessinateur" ? c.is_archived_dessinateur : c.is_archived;
    if (archived) return false;
    const nbNonLus = (c.messages || []).filter(
      m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
    ).length;
    return nbNonLus > 0 || c.marque_non_lu;
  }).length;

  // Nombre de tickets avec au moins un message non lu (badge sidebar).
  // Un message est non lu s'il vient d'un autre auteur et que mon id n'est
  // pas dans lu_par. Calque du décompte des notifications de commandes.
  const uid = session?.user?.id;
  const ticketsNonLus = tickets.filter(t =>
    (t.messages || []).some(m => m.auteur_id !== uid && !(m.lu_par || []).includes(uid))
  ).length;

  useEffect(() => {
    chargerTout();

    // Realtime channel — reproduit le canal de VueUtilisateur.js:68-101
    // et VueDessinateur.js:47-81 (patterns identiques, seul le nom du canal diffère).
    const canal = supabase
      .channel("messages-layout")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        const nom = auteurNomRef.current;
        // Ne pas stocker les messages non visibles pour ce rôle (notes privées / portée)
        if (!peutVoirMessageRef.current(msg, nom)) return;
        setCommandes(prev => prev.map(c => {
          if (c.id !== msg.commande_id) return c;
          if (msg.auteur === nom) return c;
          if (c.messages.some(m => m.id === msg.id)) return c;
          return { ...c, messages: [...c.messages, msg] };
        }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        setCommandes(prev => prev.map(c =>
          c.id === msg.commande_id
            ? { ...c, messages: c.messages.map(m => m.id === msg.id ? { ...m, lu_par: msg.lu_par } : m) }
            : c
        ));
      })
      .subscribe();

    // Canal tickets — INSERT d'un message met à jour le décompte des non-lus.
    const canalTickets = supabase
      .channel("ticket-messages-layout")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, (payload) => {
        const m = payload.new;
        setTickets(prev => prev.map(t => {
          if (t.id !== m.ticket_id) return t;
          if ((t.messages || []).some(x => x.id === m.id)) return t;
          return { ...t, messages: [...(t.messages || []), { id: m.id, auteur_id: m.auteur_id, lu_par: m.lu_par || [] }] };
        }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ticket_messages" }, (payload) => {
        const m = payload.new;
        setTickets(prev => prev.map(t =>
          t.id === m.ticket_id
            ? { ...t, messages: (t.messages || []).map(x => x.id === m.id ? { ...x, lu_par: m.lu_par || [] } : x) }
            : t
        ));
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); supabase.removeChannel(canalTickets); };
  }, [profil.id]); // eslint-disable-line

  async function chargerTout() {
    const nom = auteurNomRef.current;

    // Requête commandes — reproduit VueUtilisateur.js:107 et VueDessinateur.js:86
    // Requête sous-comptes — les deux Vue* utilisent eq("master_id", profil.id) :
    //   VueUtilisateur.js:109 : profiles.select("id, prenom, nom").eq("master_id", profil.id)
    //   VueDessinateur.js:88 : profiles.select("id, prenom, nom").eq("master_id", profil.id)
    const [{ data: cmd }, { data: sub }, { data: marques }, { data: tks }, { data: superv }] = await Promise.all([
      supabase
        .from("commandes")
        .select("*, messages(*)")
        .order("created_at", { ascending: false }),
      profil.is_owner
        ? supabase.from("profiles").select("id, prenom, nom").eq("master_id", profil.id)
        : Promise.resolve({ data: [] }),
      supabase.from("commande_marquage_non_lu").select("commande_id"),
      // Tickets + messages (id/auteur/lu_par) pour le décompte des non-lus.
      // RLS limite déjà : admin voit tout, utilisateur voit ses tickets.
      supabase
        .from("tickets")
        .select("id, statut, ticket_messages(id, auteur_id, lu_par)")
        .order("updated_at", { ascending: false }),
      // Admin : liste des utilisateurs (clients) pour le filtre "par utilisateur".
      isAdmin
        ? supabase.from("profiles").select("id, prenom, nom").eq("role", "utilisateur").neq("id", profil.id)
        : Promise.resolve({ data: [] }),
    ]);

    if (cmd) {
      const marquesSet = new Set((marques || []).map(m => m.commande_id));
      // Normalisation reproduite de VueUtilisateur.js:115-124 et VueDessinateur.js:90-99
      setCommandes(cmd.map(c => ({
        ...c,
        plans: c.plans || [],
        fichiersPlan: c.fichiers_plan || [],
        logoClient: c.logo_client || [],
        plansFinalises: c.plans_finalises || [],
        marque_non_lu: marquesSet.has(c.id),
        messages: (c.messages || [])
          .filter(m => peutVoirMessageRef.current(m, nom))
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      })));
    }

    if (sub) setSousComptes(sub);
    setUtilisateursSupervises(superv || []);

    // Normalise tickets : on expose messages = ticket_messages pour le décompte
    setTickets((tks || []).map(t => ({ ...t, messages: t.ticket_messages || [] })));
  }

  return (
    <div
      onClick={() => { showMobileMenu && setShowMobileMenu(false); }}
      style={{ display: "flex", height: "100dvh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}
    >
      {/* Annonces broadcast — modale affichée à la connexion */}
      <AnnoncesModal profil={profil} />

      {/* Backdrop mobile — reproduit de VueUtilisateur.js:453 et VueDessinateur.js:291 */}
      <div
        className={`sidebar-backdrop${showMobileMenu ? " sidebar-open" : ""}`}
        onClick={(e) => { e.stopPropagation(); setShowMobileMenu(false); }}
      />

      {/* Sidebar */}
      <Sidebar
        session={session}
        profil={profil}
        totalNonLus={totalNonLus}
        ticketsNonLus={ticketsNonLus}
        showMobileMenu={showMobileMenu}
        onCloseMobile={() => setShowMobileMenu(false)}
      />

      {/* Main wrapper — reproduit de VueUtilisateur.js:500-513 et VueDessinateur.js:336-348 */}
      <div
        className="app-main-wrapper"
        style={{ marginLeft: 220, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* Mobile header */}
        <div className="mobile-header">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMobileMenu(v => !v); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#374151", padding: "4px 8px 4px 0", lineHeight: 1 }}
          >
            ☰
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, background: profil.role === "dessinateur" ? "#FC6C1B" : "#122131", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 14 }}>{profil.role === "dessinateur" ? "✏️" : "🔥"}</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Incendie Plan</span>
          </div>
          {totalNonLus > 0 && (
            <span style={{ marginLeft: "auto", background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>
              {totalNonLus}
            </span>
          )}
        </div>

        {/* Contenu — pages enfants via Outlet */}
        <div
          className="app-main-content"
          style={{ flex: 1, padding: "32px 32px", overflowY: "auto" }}
        >
          <Outlet
            context={{
              session,
              profil,
              onProfilUpdate,
              commandes,
              setCommandes,
              sousComptes,
              utilisateursSupervises,
              tickets,
              setTickets,
            }}
          />
        </div>
      </div>
    </div>
  );
}
