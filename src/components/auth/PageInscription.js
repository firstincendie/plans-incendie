import { useState, useCallback } from "react";
import { supabase } from "../../supabase";

const CHAMPS_INIT = {
  prenom: "", nom: "", email: "", telephone: "",
  entreprise: "", siren: "", adresse: "", code_postal: "", ville: "",
  mdp: "", mdp_confirm: ""
};

function validerSiren(siren) {
  const s = siren.replace(/\s/g, "");
  if (!/^\d{9}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = parseInt(s[i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

export default function PageInscription({ onRetour }) {
  const [champs, setChamps] = useState(CHAMPS_INIT);
  const [sirenInfo, setSirenInfo] = useState(null);
  const [sirenErreur, setSirenErreur] = useState("");
  const [sirenChargement, setSirenChargement] = useState(false);
  const [etape, setEtape] = useState(1); // 1 = infos, 2 = confirmé
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const set = (champ) => (e) => setChamps(prev => ({ ...prev, [champ]: e.target.value }));

  const verifierSiren = useCallback(async () => {
    const siren = champs.siren.replace(/\s/g, "");
    setSirenInfo(null);
    setSirenErreur("");
    if (!siren) return;
    if (!validerSiren(siren)) {
      setSirenErreur("Numéro SIREN invalide (9 chiffres requis, clé Luhn incorrecte).");
      return;
    }
    setSirenChargement(true);
    try {
      const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siren}&page=1&per_page=1`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const e = data.results[0];
        setSirenInfo({ raison_sociale: e.nom_raison_sociale || e.nom_complet, siren: e.siren, actif: e.etat_administratif === "A" });
        setChamps(prev => ({ ...prev, entreprise: e.nom_raison_sociale || e.nom_complet || prev.entreprise }));
      } else {
        setSirenErreur("Aucune entreprise trouvée pour ce SIREN.");
      }
    } catch {
      setSirenErreur("Impossible de vérifier le SIREN pour l'instant. Vous pouvez continuer.");
    }
    setSirenChargement(false);
  }, [champs.siren]);

  const handleSoumettre = async (e) => {
    e.preventDefault();
    setErreur("");
    if (champs.mdp !== champs.mdp_confirm) { setErreur("Les mots de passe ne correspondent pas."); return; }
    if (champs.mdp.length < 8) { setErreur("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (!sirenInfo && validerSiren(champs.siren.replace(/\s/g, ""))) {
      // SIREN valide formellement mais pas encore vérifié en ligne, on accepte
    }
    setChargement(true);
    const { error } = await supabase.auth.signUp({
      email: champs.email,
      password: champs.mdp,
      options: {
        data: {
          nom: champs.nom,
          prenom: champs.prenom,
          role: "client",
        }
      }
    });

    if (error) {
      setErreur(error.message === "User already registered" ? "Un compte existe déjà avec cet email." : "Une erreur est survenue. Réessayez.");
      setChargement(false);
      return;
    }

    // Compléter le profil après inscription
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({
        telephone: champs.telephone,
        entreprise: champs.entreprise,
        adresse: champs.adresse,
        code_postal: champs.code_postal,
        ville: champs.ville,
        siren: champs.siren.replace(/\s/g, ""),
        siren_valide: !!sirenInfo,
        raison_sociale: sirenInfo?.raison_sociale || champs.entreprise,
      }).eq("id", user.id);
    }

    setChargement(false);
    setEtape(2);
  };

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none" };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: "#122131", display: "block", marginBottom: 6 };
  const rowStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

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

          {/* Identité */}
          <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 4, marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase" }}>Identité</div>
          </div>
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

          {/* Entreprise */}
          <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 4, marginTop: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase" }}>Entreprise</div>
          </div>

          {/* SIREN */}
          <div>
            <label style={labelStyle}>Numéro SIREN *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={champs.siren}
                onChange={e => { set("siren")(e); setSirenInfo(null); setSirenErreur(""); }}
                required
                maxLength={9}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="123456789"
              />
              <button
                type="button"
                onClick={verifierSiren}
                disabled={sirenChargement}
                style={{ padding: "10px 14px", background: "#122131", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {sirenChargement ? "..." : "Vérifier"}
              </button>
            </div>
            {sirenErreur && <div style={{ color: "#DC2626", fontSize: 12, marginTop: 4 }}>⚠ {sirenErreur}</div>}
            {sirenInfo && (
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "8px 12px", marginTop: 6, fontSize: 12, color: "#166534" }}>
                ✅ <strong>{sirenInfo.raison_sociale}</strong> — SIREN {sirenInfo.siren} {!sirenInfo.actif && <span style={{ color: "#DC2626" }}>(entreprise inactive)</span>}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Nom de l'entreprise *</label>
            <input type="text" value={champs.entreprise} onChange={set("entreprise")} required style={inputStyle} placeholder="Mon Entreprise SAS" />
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

          {/* Sécurité */}
          <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 4, marginTop: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase" }}>Sécurité</div>
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Mot de passe *</label>
              <input type="password" value={champs.mdp} onChange={set("mdp")} required minLength={8} style={inputStyle} placeholder="8 caractères min." />
            </div>
            <div>
              <label style={labelStyle}>Confirmer *</label>
              <input type="password" value={champs.mdp_confirm} onChange={set("mdp_confirm")} required style={inputStyle} placeholder="••••••••" />
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
