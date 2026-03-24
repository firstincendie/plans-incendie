import { useState } from "react";
import { supabase } from "../../supabase";

const CHAMPS_INIT = {
  prenom: "", nom: "", email: "", telephone: "",
  entreprise: "", siren: "", adresse: "", code_postal: "", ville: "",
  mdp: "", mdp_confirm: ""
};

const inputStyle = { width: "100%", padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none" };
const labelStyle = { fontSize: 13, fontWeight: 600, color: "#122131", display: "block", marginBottom: 6 };
const rowStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

function SectionHeader({ children, marginTop }) {
  return (
    <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 4, marginTop, marginBottom: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase" }}>{children}</div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, required, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input type={show ? "text" : "password"} value={value} onChange={onChange} required={required} minLength={minLength}
        autoComplete="new-password" style={{ ...inputStyle, paddingRight: 38 }} placeholder={placeholder} />
      <button type="button" onClick={() => setShow(v => !v)}
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 16, padding: 0, lineHeight: 1 }}>
        {show ? "🙈" : "👁"}
      </button>
    </div>
  );
}

export default function PageInscription({ onRetour }) {
  const [role, setRole] = useState("client");
  const [champs, setChamps] = useState(CHAMPS_INIT);
  const [etape, setEtape] = useState(1);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const set = (champ) => (e) => setChamps(prev => ({ ...prev, [champ]: e.target.value }));

  const handleSoumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    if (champs.mdp !== champs.mdp_confirm) { setErreur("Les mots de passe ne correspondent pas."); return; }
    if (champs.mdp.length < 8) { setErreur("Le mot de passe doit contenir au moins 8 caractères."); return; }
    setChargement(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: champs.email,
        password: champs.mdp,
        options: { data: { nom: champs.nom, prenom: champs.prenom, role } }
      });
      if (error) {
        setErreur(error.message === "User already registered" ? "Un compte existe déjà avec cet email." : "Une erreur est survenue. Réessayez.");
        return;
      }
      const user = data?.user;
      await Promise.all([
        user && supabase.from("profiles").update({
          telephone: champs.telephone,
          entreprise: champs.entreprise,
          adresse: champs.adresse,
          code_postal: champs.code_postal,
          ville: champs.ville,
          siren: champs.siren.replace(/\s/g, ""),
          raison_sociale: champs.entreprise,
        }).eq("id", user.id),
        supabase.functions.invoke("notify-inscription", {
          body: { prenom: champs.prenom, nom: champs.nom, email: champs.email },
        }),
      ]);
      setEtape(2);
    } finally {
      setChargement(false);
    }
  };

  if (etape === 2) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", width: 440, boxShadow: "0 4px 24px rgba(18,33,49,0.10)", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: "#122131", marginBottom: 12 }}>Demande envoyée !</div>
          <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Votre demande d'accès a bien été reçue. Un administrateur va examiner votre dossier et vous recevrez un email de confirmation à <strong>{champs.email}</strong> une fois votre compte activé.
          </div>
          <button onClick={onRetour} style={{ background: "#386CA3", color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px", width: "100%", maxWidth: 520, boxShadow: "0 4px 24px rgba(18,33,49,0.10)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔥</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: "#122131" }}>Demande d'accès</div>
          <div style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>Votre demande sera examinée par un administrateur</div>
        </div>

        <form onSubmit={handleSoumettre} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <SectionHeader>Type de compte</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { value: "client", label: "Utilisateur", desc: "Je commande des plans", activeColor: "#1D4ED8", activeBg: "#EFF6FF", activeBorder: "#93C5FD" },
              { value: "dessinateur", label: "Dessinateur", desc: "Je réalise des plans", activeColor: "#FC6C1B", activeBg: "#FFF7F3", activeBorder: "#FC6C1B" },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
                style={{ padding: "12px 14px", borderRadius: 10, border: `2px solid ${role === opt.value ? opt.activeBorder : "#E2E8F0"}`, background: role === opt.value ? opt.activeBg : "#fff", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: role === opt.value ? opt.activeColor : "#122131" }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>

          <SectionHeader marginTop={8}>Identité</SectionHeader>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Prénom *</label>
              <input type="text" value={champs.prenom} onChange={set("prenom")} required style={inputStyle} placeholder="Jean" />
            </div>
            <div>
              <label style={labelStyle}>Nom *</label>
              <input type="text" value={champs.nom} onChange={set("nom")} required style={inputStyle} placeholder="Dupont" />
            </div>
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" value={champs.email} onChange={set("email")} required style={inputStyle} placeholder="jean@exemple.fr" />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input type="tel" value={champs.telephone} onChange={set("telephone")} style={inputStyle} placeholder="06 00 00 00 00" />
            </div>
          </div>

          <SectionHeader marginTop={8}>Entreprise</SectionHeader>
          <div>
            <label style={labelStyle}>Nom de l'entreprise *</label>
            <input type="text" value={champs.entreprise} onChange={set("entreprise")} required style={inputStyle} placeholder="Mon Entreprise SAS" />
          </div>
          <div>
            <label style={labelStyle}>Numéro SIREN</label>
            <input type="text" value={champs.siren} onChange={set("siren")} maxLength={9} style={inputStyle} placeholder="123456789" />
          </div>
          <div>
            <label style={labelStyle}>Adresse</label>
            <input type="text" value={champs.adresse} onChange={set("adresse")} style={inputStyle} placeholder="12 rue de la Paix" />
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Code postal</label>
              <input type="text" value={champs.code_postal} onChange={set("code_postal")} style={inputStyle} placeholder="75001" />
            </div>
            <div>
              <label style={labelStyle}>Ville</label>
              <input type="text" value={champs.ville} onChange={set("ville")} style={inputStyle} placeholder="Paris" />
            </div>
          </div>

          <SectionHeader marginTop={8}>Sécurité</SectionHeader>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Mot de passe *</label>
              <PasswordInput value={champs.mdp} onChange={set("mdp")} required minLength={8} placeholder="8 caractères min." />
            </div>
            <div>
              <label style={labelStyle}>Confirmer *</label>
              <PasswordInput value={champs.mdp_confirm} onChange={set("mdp_confirm")} required placeholder="••••••••" />
            </div>
          </div>

          {erreur && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", color: "#DC2626", fontSize: 13 }}>
              {erreur}
            </div>
          )}

          <button
            type="submit"
            disabled={chargement}
            style={{ background: "#FC6C1B", color: "#fff", border: "none", borderRadius: 8, padding: "13px", fontWeight: 700, fontSize: 15, cursor: chargement ? "not-allowed" : "pointer", opacity: chargement ? 0.7 : 1, marginTop: 4 }}
          >
            {chargement ? "Envoi en cours..." : "Envoyer ma demande"}
          </button>

          <button type="button" onClick={onRetour} style={{ background: "none", border: "none", color: "#386CA3", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
            ← Retour à la connexion
          </button>
        </form>
      </div>
    </div>
  );
}
