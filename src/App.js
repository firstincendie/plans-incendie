import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import AppRouter from "./components/AppRouter";

const INACTIVITE_MS = 30 * 60 * 1000; // 30 minutes

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profil, setProfil] = useState(null);
  const navigate = useNavigate();
  const timerInactivite = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) chargerProfil(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-mot-de-passe", { replace: true });
        return;
      }
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

  const handleProfilUpdate = (updates) => setProfil(prev => ({ ...prev, ...updates }));

  return (
    <AppRouter
      session={session}
      profil={profil}
      sessionLoading={session === undefined}
      profilLoading={!!session && !profil}
      onProfilUpdate={handleProfilUpdate}
    />
  );
}
