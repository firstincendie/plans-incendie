import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import AppRouter from "./components/AppRouter";
import VueUtilisateur from "./components/VueUtilisateur";
import VueDessinateur from "./components/VueDessinateur";
import PageResetMotDePasse from "./components/auth/PageResetMotDePasse";
import EcranEnAttente from "./components/EcranEnAttente";
import EcranRefuse from "./components/EcranRefuse";
import EcranBanni from "./components/EcranBanni";

const INACTIVITE_MS = 30 * 60 * 1000; // 30 minutes

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profil, setProfil] = useState(null);
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

  // resetMode is preserved here (Task 6 will migrate it to navigation)
  if (resetMode) {
    return <PageResetMotDePasse />;
  }

  // Status screen checks — will be moved to RequireAuth in Task 9
  if (profil) {
    if (profil.statut === "en_attente") return <EcranEnAttente />;
    if (profil.statut === "refuse") return <EcranRefuse />;
    if (profil.statut === "banni") return <EcranBanni />;
  }

  // Build the legacy shell: what was rendered before for an authenticated user.
  // This will be progressively replaced by routes in subsequent tasks.
  let legacyShell = null;
  if (session && profil) {
    legacyShell = profil.role === "dessinateur"
      ? <VueDessinateur session={session} profil={profil} onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))} />
      : <VueUtilisateur session={session} profil={profil} onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))} />;
  }

  return (
    <AppRouter
      session={session}
      profil={profil}
      sessionLoading={session === undefined}
      profilLoading={!!session && !profil}
      legacyShell={legacyShell}
    />
  );
}
