import { Routes, Route } from "react-router-dom";
import PageConnexion from "./auth/PageConnexion";
import PageInscription from "./auth/PageInscription";
import PageMotDePasseOublie from "./auth/PageMotDePasseOublie";
import PageResetMotDePasse from "./auth/PageResetMotDePasse";

export default function AppRouter({ session, profil, sessionLoading, profilLoading, legacyShell }) {
  return (
    <Routes>
      <Route path="/connexion" element={<PageConnexion />} />
      <Route path="/inscription" element={<PageInscription />} />
      <Route path="/mot-de-passe-oublie" element={<PageMotDePasseOublie />} />
      <Route path="/reset-mot-de-passe" element={<PageResetMotDePasse />} />
      {/* Toutes les autres routes : pour cette task, on rend le legacy shell tant qu'on n'a pas migré */}
      <Route path="*" element={legacyShell} />
    </Routes>
  );
}
