import { Routes, Route, Navigate, useOutletContext } from "react-router-dom";
import PageConnexion from "./auth/PageConnexion";
import PageInscription from "./auth/PageInscription";
import PageMotDePasseOublie from "./auth/PageMotDePasseOublie";
import PageResetMotDePasse from "./auth/PageResetMotDePasse";
import RequireAuth from "./RequireAuth";
import LayoutPrincipal from "./LayoutPrincipal";
import PageReglages from "./PageReglages";
import PageMonCompte from "./PageMonCompte";

export default function AppRouter({ session, profil, sessionLoading, profilLoading, legacyShell, onProfilUpdate }) {
  const dejaConnecte = !!session && !!profil && profil.statut === "actif";

  return (
    <Routes>
      <Route path="/connexion" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageConnexion />} />
      <Route path="/inscription" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageInscription />} />
      <Route path="/mot-de-passe-oublie" element={dejaConnecte ? <Navigate to="/commandes" replace /> : <PageMotDePasseOublie />} />
      <Route path="/reset-mot-de-passe" element={<PageResetMotDePasse />} />

      <Route element={<RequireAuth session={session} profil={profil} sessionLoading={sessionLoading} profilLoading={profilLoading} />}>
        <Route element={<LayoutPrincipal session={session} profil={profil} onProfilUpdate={onProfilUpdate} />}>
          <Route path="/reglages" element={<PageReglagesWrapper />} />
          <Route path="/mon-compte" element={<PageMonCompteWrapper />} />
        </Route>
      </Route>

      <Route path="*" element={legacyShell} />
    </Routes>
  );
}

function PageReglagesWrapper() {
  const { profil, onProfilUpdate } = useOutletContext();
  return <PageReglages profil={profil} onProfilUpdate={onProfilUpdate} />;
}

function PageMonCompteWrapper() {
  const { session, profil, onProfilUpdate, commandes } = useOutletContext();
  // PageMonCompte takes a `role` prop with values "dessinateur" or "utilisateur".
  // The legacy code maps admin and utilisateur both to "utilisateur" (cf VueUtilisateur.js:517).
  const roleProp = profil.role === "dessinateur" ? "dessinateur" : "utilisateur";
  return <PageMonCompte profil={profil} session={session} role={roleProp} commandes={commandes} onProfilUpdate={onProfilUpdate} />;
}
