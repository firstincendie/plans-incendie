import { Navigate, useLocation, Outlet } from "react-router-dom";
import EcranEnAttente from "./EcranEnAttente";
import EcranRefuse from "./EcranRefuse";
import EcranBanni from "./EcranBanni";

export default function RequireAuth({ session, profil, sessionLoading, profilLoading }) {
  const location = useLocation();

  if (sessionLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 14 }}>
        Chargement...
      </div>
    );
  }

  if (!session) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?redirect=${redirect}`} replace />;
  }

  if (profilLoading || !profil) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 14 }}>
        Chargement du profil...
      </div>
    );
  }

  if (profil.statut === "en_attente") return <EcranEnAttente />;
  if (profil.statut === "refuse")     return <EcranRefuse />;
  if (profil.statut === "banni")      return <EcranBanni />;

  return <Outlet />;
}
