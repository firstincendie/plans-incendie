import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { supabase } from "../supabase";
import Sidebar from "./Sidebar";

export default function LayoutPrincipal({ session, profil, onProfilUpdate }) {
  const [commandes, setCommandes] = useState([]);
  const [sousComptes, setSousComptes] = useState([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // auteurNom used in realtime handler and normalizations
  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();
  // Keep a ref so the realtime handler always reads the current value
  const auteurNomRef = useRef(auteurNom);
  auteurNomRef.current = auteurNom;

  // Total unread messages across non-archived commandes (for sidebar badge)
  const role = profil.role;
  const totalNonLus = commandes
    .filter(c => role === "dessinateur" ? !c.is_archived_dessinateur : !c.is_archived)
    .reduce((acc, c) => {
      const n = c.messages.filter(
        m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)
      ).length;
      return acc + n;
    }, 0);

  useEffect(() => {
    chargerTout();

    // Realtime channel — reproduit le canal de VueUtilisateur.js:68-101
    // et VueDessinateur.js:47-81 (patterns identiques, seul le nom du canal diffère).
    const canal = supabase
      .channel("messages-layout")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        const nom = auteurNomRef.current;
        // Ne pas stocker les notes privées d'autrui dans le state local
        if (msg.visible_par?.length && !msg.visible_par.includes(nom)) return;
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

    return () => { supabase.removeChannel(canal); };
  }, [profil.id]); // eslint-disable-line

  async function chargerTout() {
    const nom = auteurNomRef.current;

    // Requête commandes — reproduit VueUtilisateur.js:107 et VueDessinateur.js:86
    // Requête sous-comptes — les deux Vue* utilisent eq("master_id", profil.id) :
    //   VueUtilisateur.js:109 : profiles.select("id, prenom, nom").eq("master_id", profil.id)
    //   VueDessinateur.js:88 : profiles.select("id, prenom, nom").eq("master_id", profil.id)
    const [{ data: cmd }, { data: sub }] = await Promise.all([
      supabase
        .from("commandes")
        .select("*, messages(*)")
        .order("created_at", { ascending: false }),
      profil.is_owner
        ? supabase.from("profiles").select("id, prenom, nom").eq("master_id", profil.id)
        : Promise.resolve({ data: [] }),
    ]);

    if (cmd) {
      // Normalisation reproduite de VueUtilisateur.js:115-124 et VueDessinateur.js:90-99
      setCommandes(cmd.map(c => ({
        ...c,
        plans: c.plans || [],
        fichiersPlan: c.fichiers_plan || [],
        logoClient: c.logo_client || [],
        plansFinalises: c.plans_finalises || [],
        messages: (c.messages || [])
          .filter(m => !m.visible_par || m.visible_par.includes(nom))
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      })));
    }

    if (sub) setSousComptes(sub);
  }

  return (
    <div
      onClick={() => { showMobileMenu && setShowMobileMenu(false); }}
      style={{ display: "flex", height: "100dvh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}
    >
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
            }}
          />
        </div>
      </div>
    </div>
  );
}
