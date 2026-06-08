import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import pkg from "../../package.json";

export default function Sidebar({ session, profil, totalNonLus = 0, ticketsNonLus = 0, showMobileMenu, onCloseMobile }) {
  const [showMenuProfil, setShowMenuProfil] = useState(false);
  const [gestionOuvert, setGestionOuvert] = useState(false);
  const location = useLocation();
  // Pour les sous-items Gestion qui partagent le pathname /gestion, on compare
  // aussi le query (?tab=) pour déterminer lequel est actif.
  const cheminCourant = `${location.pathname}${location.search}`;

  const role = profil.role;
  const couleurAccent = role === "dessinateur" ? "#FC6C1B" : "#122131";
  const fondActif = role === "dessinateur" ? "#FFF3EE" : "#E8EDF2";
  const logoIcon = role === "dessinateur" ? "✏️" : "🔥";
  // Admin = propriétaire de compte non-dessinateur (cf. fonction SQL is_admin())
  const isAdmin = role !== "dessinateur" && profil.is_owner === true;

  const items = [
    {
      to: "/commandes",
      label: role === "dessinateur" ? "Missions en cours" : "Commandes en cours",
      icon: "📋",
      badge: totalNonLus,
    },
    {
      to: "/commandes/archives",
      label: role === "dessinateur" ? "Missions archivées" : "Commandes archivées",
      icon: "🗃️",
    },
    { to: "/reglages", label: "Réglages", icon: "⚙️" },
    // Badge tickets non lus sur "Mon compte" pour utilisateurs / dessinateurs
    { to: "/mon-compte", label: "Mon compte", icon: "👤", badge: isAdmin ? 0 : ticketsNonLus },
  ];

  // Sous-entrées du menu déroulant "Gestion" (admin uniquement)
  const gestionSousItems = [
    { to: "/utilisateurs", label: "Utilisateurs", icon: "🛠️" },
    { to: "/gestion?tab=tickets", label: "Signalements", icon: "🎫", badge: ticketsNonLus },
    { to: "/gestion?tab=annonces", label: "Annonces", icon: "📢" },
  ];

  const initialesAvatar = `${(profil.prenom?.[0] || "").toUpperCase()}${(profil.nom?.[0] || "").toUpperCase()}`;
  const roleLabel = role === "dessinateur" ? "Dessinateur" : `Utilisateur${profil.is_owner ? " · Owner" : ""}`;

  return (
    <div
      className={`app-sidebar${showMobileMenu ? " sidebar-open" : ""}`}
      style={{
        width: 220,
        background: "#fff",
        borderRight: "1px solid #E5E7EB",
        display: "flex",
        flexDirection: "column",
        padding: "24px 12px 0 12px",
        gap: 4,
        position: "fixed",
        top: 0,
        height: "100dvh",
        overflowY: "auto",
      }}
    >
      {/* Logo / header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
        <div style={{ width: 32, height: 32, background: couleurAccent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "white", fontSize: 16 }}>{logoIcon}</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Incendie Plan</span>
      </div>

      {/* Nav items */}
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/commandes"}
          onClick={onCloseMobile}
          style={({ isActive }) => ({
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            background: isActive ? fondActif : "transparent",
            color: isActive ? couleurAccent : "#6B7280",
            textAlign: "left",
            width: "100%",
            textDecoration: "none",
          })}
        >
          <span>{item.icon}</span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.badge > 0 && (
            <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
              {item.badge}
            </span>
          )}
        </NavLink>
      ))}

      {/* Menu déroulant "Gestion" (admin uniquement) */}
      {isAdmin && (
        <div>
          <button
            onClick={() => setGestionOuvert(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 400, background: "transparent", color: "#6B7280", textAlign: "left", width: "100%" }}
          >
            <span>🎫</span>
            <span style={{ flex: 1 }}>Gestion</span>
            {!gestionOuvert && ticketsNonLus > 0 && (
              <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{ticketsNonLus}</span>
            )}
            <span style={{ fontSize: 10 }}>{gestionOuvert ? "▼" : "▶"}</span>
          </button>
          {gestionOuvert && gestionSousItems.map(sous => {
            const actif = cheminCourant === sous.to;
            return (
            <NavLink
              key={sous.to}
              to={sous.to}
              onClick={onCloseMobile}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px 8px 28px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: actif ? 600 : 400,
                background: actif ? fondActif : "transparent",
                color: actif ? couleurAccent : "#6B7280",
                textAlign: "left",
                width: "100%",
                textDecoration: "none",
              }}
            >
              <span>{sous.icon}</span>
              <span style={{ flex: 1 }}>{sous.label}</span>
              {sous.badge > 0 && (
                <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{sous.badge}</span>
              )}
            </NavLink>
            );
          })}
        </div>
      )}

      {/* Pied de sidebar */}
      <div style={{ marginTop: "auto", position: "relative", paddingBottom: 12 }}>
        <div style={{ padding: "4px 12px", fontSize: 10, color: "#9CA3AF", textAlign: "left" }}>
          v{pkg.version}
        </div>
        {showMenuProfil && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.10)", overflow: "hidden" }}
          >
            <div style={{ padding: "12px 14px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#122131" }}>{profil.prenom} {profil.nom}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{session?.user?.email}</div>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13, color: "#DC2626", cursor: "pointer" }}
            >
              ↪ Se déconnecter
            </button>
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenuProfil(v => !v); }}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: "none", borderTop: "1px solid #E5E7EB", cursor: "pointer", textAlign: "left" }}
        >
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: couleurAccent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {initialesAvatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#122131", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profil.prenom} {profil.nom}</div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>{roleLabel}</div>
          </div>
        </button>
      </div>
    </div>
  );
}
