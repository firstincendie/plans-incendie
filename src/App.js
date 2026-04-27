import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import VueUtilisateur from "./components/VueUtilisateur";
import VueDessinateur from "./components/VueDessinateur";
import PageConnexion from "./components/auth/PageConnexion";
import PageInscription from "./components/auth/PageInscription";
import PageMotDePasseOublie from "./components/auth/PageMotDePasseOublie";
import PageResetMotDePasse from "./components/auth/PageResetMotDePasse";
import EcranEnAttente from "./components/EcranEnAttente";
import EcranRefuse from "./components/EcranRefuse";
import EcranBanni from "./components/EcranBanni";

const INACTIVITE_MS = 30 * 60 * 1000; // 30 minutes

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profil, setProfil] = useState(null);
  const [pageAuth, setPageAuth] = useState("connexion");
  const [resetMode, setResetMode] = useState(false);
  const timerInactivite = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) chargerProfil(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { setResetMode(true); return; }
      setSession(session);
      if (session) chargerProfil(session.user.id);
      else { setProfil(null); }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!session) return;

    function resetTimer() {
      clearTimeout(timerInactivite.current);
      timerInactivite.current = setTimeout(() => {
        supabase.auth.signOut();
      }, INACTIVITE_MS);
    }

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timerInactivite.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [session]); // eslint-disable-line

  async function chargerProfil(uid) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();
    setProfil(data);
  }

  if (resetMode) {
    return <PageResetMotDePasse onSuccess={() => { setResetMode(false); supabase.auth.signOut(); }} />;
  }

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 14 }}>
        Chargement...
      </div>
    );
  }

  if (!session) {
    if (pageAuth === "inscription") return <PageInscription onRetour={() => setPageAuth("connexion")} />;
    if (pageAuth === "mdp_oublie") return <PageMotDePasseOublie onRetour={() => setPageAuth("connexion")} />;
    return <PageConnexion onMotDePasseOublie={() => setPageAuth("mdp_oublie")} onInscription={() => setPageAuth("inscription")} />;
  }

  if (!profil) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 14 }}>
        Chargement du profil...
      </div>
    );
  }

  if (profil.statut === "en_attente") {
    return <EcranEnAttente />;
  }

  if (profil.statut === "refuse") {
    return <EcranRefuse />;
  }

  if (profil.statut === "banni") {
    return <EcranBanni />;
  }

  if (profil.role === "dessinateur") {
    return (
      <VueDessinateur
        session={session}
        profil={profil}
        onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))}
      />
    );
  }

  return (
    <VueUtilisateur
      session={session}
      profil={profil}
      onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))}
    />
  );
}
