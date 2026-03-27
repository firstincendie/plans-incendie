import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import VueUtilisateur from "./components/VueUtilisateur";
import VueDessinateur from "./components/VueDessinateur";
import PageConnexion from "./components/auth/PageConnexion";
import PageInscription from "./components/auth/PageInscription";
import PageMotDePasseOublie from "./components/auth/PageMotDePasseOublie";
import PageResetMotDePasse from "./components/auth/PageResetMotDePasse";

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
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 420, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#122131", marginBottom: 12 }}>Votre compte est en attente</div>
          <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Un administrateur va examiner votre demande et vous assigner un dessinateur. Vous recevrez un email dès que votre compte sera activé.
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (profil.statut === "refuse") {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 420, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#122131", marginBottom: 12 }}>Accès refusé</div>
          <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Votre demande d'accès n'a pas été acceptée. Contactez-nous pour plus d'informations.
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (profil.statut === "banni") {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 420, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#122131", marginBottom: 12 }}>Compte bloqué</div>
          <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Votre compte a été bloqué. Contactez contact@firstincendie.com pour plus d'informations.
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "#F1F5F9", color: "#64748B", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
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
