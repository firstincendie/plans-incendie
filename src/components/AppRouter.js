import { Routes, Route, Navigate } from "react-router-dom";
import PageConnexion from "./auth/PageConnexion";
import PageInscription from "./auth/PageInscription";
import PageMotDePasseOublie from "./auth/PageMotDePasseOublie";
import PageResetMotDePasse from "./auth/PageResetMotDePasse";

export default function AppRouter({ session, profil, sessionLoading, profilLoading, legacyShell }) {
  const dejaConnecte = !!session && !!profil && profil.statut === "actif";

  return (
    <Routes>
      <Route path="/connexion" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageConnexion />} />
      <Route path="/inscription" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageInscription />} />
      <Route path="/mot-de-passe-oublie" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageMotDePasseOublie />} />
      <Route path="/reset-mot-de-passe" element={<PageResetMotDePasse />} />
      {/* Toutes les autres routes : pour cette task, on rend le legacy shell tant qu'on n'a pas migré */}
      <Route path="*" element={legacyShell} />
    </Routes>
  );
}
