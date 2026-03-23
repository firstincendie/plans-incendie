# Grand Reset — Plan 2 : Core App (Auth, Vues, Gestion Utilisateurs)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réécrire App.js, VueUtilisateur, VueDessinateur et GestionUtilisateurs avec une logique de rôles propre, sans SwitcherBarre, avec chargement des commandes par UUID.

**Architecture:** App.js route selon `profil.role` et `profil.is_owner`. Chaque vue charge uniquement ses propres données depuis Supabase. VueClient.js est remplacé par VueUtilisateur.js. Pas de state global pour les "autres rôles".

**Tech Stack:** React (CRA), Supabase JS client, CSS inline (style existant)

**Prérequis :** Plan 1 (migrations Supabase) doit être terminé.

**Spec de référence:** `docs/superpowers/specs/2026-03-23-grand-reset-roles-commandes-design.md`

---

## Fichiers concernés

| Fichier | Action |
|---|---|
| `src/App.js` | Réécriture complète |
| `src/components/VueUtilisateur.js` | Création (remplace VueClient.js) |
| `src/components/VueDessinateur.js` | Réécriture |
| `src/components/GestionUtilisateurs.js` | Réécriture |
| `src/components/VueClient.js` | Supprimer à la fin |
| `src/components/GestionCompteDessinateur.js` | Supprimer à la fin |
| `src/components/PageReglages.js` | Modifier — ajouter section notifications |

---

### Task 1 : Réécrire App.js — auth et routing

**Objectif :** App.js ne fait qu'une chose : gérer la session, charger le profil, et router vers la bonne vue selon le rôle. Plus de logique de commandes dans App.js.

- [ ] **Step 1 : Lire App.js actuel pour référence**

```bash
# Lire les 100 premières lignes pour voir les imports actuels
```

Lire `src/App.js` (offset 0, limit 100) pour noter les imports à conserver.

- [ ] **Step 2 : Réécrire App.js**

Remplacer le contenu complet de `src/App.js` par :

```javascript
import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import VueUtilisateur from "./components/VueUtilisateur";
import VueDessinateur from "./components/VueDessinateur";
import PageConnexion from "./components/auth/PageConnexion";
import PageInscription from "./components/auth/PageInscription";
import PageMotDePasseOublie from "./components/auth/PageMotDePasseOublie";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profil, setProfil] = useState(null);
  const [pageAuth, setPageAuth] = useState("connexion");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) chargerProfil(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) chargerProfil(session.user.id);
      else { setProfil(null); }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line

  async function chargerProfil(uid) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();
    setProfil(data);
  }

  // Chargement initial
  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 14 }}>
        Chargement...
      </div>
    );
  }

  // Non connecté
  if (!session) {
    if (pageAuth === "inscription") return <PageInscription onRetour={() => setPageAuth("connexion")} />;
    if (pageAuth === "mdp_oublie") return <PageMotDePasseOublie onRetour={() => setPageAuth("connexion")} />;
    return <PageConnexion onMotDePasseOublie={() => setPageAuth("mdp_oublie")} onInscription={() => setPageAuth("inscription")} />;
  }

  // Profil pas encore chargé
  if (!profil) {
    return (
      <div style={{ minHeight: "100vh", background: "#F5FAFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 14 }}>
        Chargement du profil...
      </div>
    );
  }

  // Compte en attente
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

  // Compte refusé
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

  // Compte bloqué
  if (profil.statut === "bloque") {
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

  // Routing par rôle
  if (profil.role === "dessinateur") {
    return (
      <VueDessinateur
        session={session}
        profil={profil}
        onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))}
      />
    );
  }

  // Par défaut : utilisateur (incluant is_owner)
  return (
    <VueUtilisateur
      session={session}
      profil={profil}
      onProfilUpdate={(updates) => setProfil(prev => ({ ...prev, ...updates }))}
    />
  );
}
```

- [ ] **Step 3 : Lancer l'app et vérifier le routing de base**

```bash
npm start
```

Vérifier : se connecter avec un compte `utilisateur` → pas d'erreur de rendu. Se connecter avec un compte `dessinateur` → idem.

- [ ] **Step 4 : Commit**

```bash
git add src/App.js
git commit -m "feat: rewrite App.js — clean role routing, no more SwitcherBarre"
```

---

### Task 2 : Créer VueUtilisateur.js

**Objectif :** Vue principale pour les utilisateurs — liste de leurs commandes chargées par UUID, formulaire nouvelle commande en 2 sections, sous-comptes en dropdown.

- [ ] **Step 1 : Créer `src/components/VueUtilisateur.js`**

```javascript
import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { planVide, formatDateMsg, formatDateCourt } from "../helpers";
import Badge from "./Badge";
import BarreFiltres, { appliquerFiltresTri } from "./BarreFiltres";
import Messagerie from "./Messagerie";
import HistoriqueVersions from "./HistoriqueVersions";
import ZoneUpload from "./ZoneUpload";
import TableauPlans from "./TableauPlans";
import PageReglages from "./PageReglages";
import PageMonCompte from "./PageMonCompte";
import GestionUtilisateurs from "./GestionUtilisateurs";
import { ListeFichiers, LogoCliquable } from "./VisuFichier";
import BlocAdresse from "./BlocAdresse";
import ChampCopiable from "./ChampCopiable";

export default function VueUtilisateur({ session, profil, onProfilUpdate }) {
  const [commandes, setCommandes] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState("commandes");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showMenuProfil, setShowMenuProfil] = useState(false);
  const [filtres, setFiltres] = useState({ statut: "", type: "", periode: "" });
  const [tri, setTri] = useState({ col: "created_at", dir: "desc" });
  const [showTerminees, setShowTerminees] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const [showModifModal, setShowModifModal] = useState(false);
  const [modifMsg, setModifMsg] = useState("");
  const [modifFichiers, setModifFichiers] = useState([]);
  const [envoyantModif, setEnvoyantModif] = useState(false);
  const [showValidModal, setShowValidModal] = useState(false);
  const [validant, setValidant] = useState(false);
  const [sousComptes, setSousComptes] = useState([]);

  const formVide = () => ({
    utilisateur_id: profil.id,
    nom_plan: "",
    client_nom: "", client_prenom: "", client_email: "", client_telephone: "",
    adresse1: "", adresse2: "", code_postal: "", ville: "",
    delai: "", plans: [planVide()], fichiersPlan: [], logoClient: [], instructions: "",
  });
  const [form, setForm] = useState(formVide());

  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();

  const nav = [
    { id: "commandes", label: "Commandes", icon: "📋" },
    { id: "reglages", label: "Réglages", icon: "⚙️" },
    { id: "mon-compte", label: "Mon compte", icon: "👤" },
    ...(profil.is_owner ? [{ id: "utilisateurs", label: "Utilisateurs", icon: "🛠️" }] : []),
  ];

  useEffect(() => {
    chargerTout();
    const canal = supabase
      .channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        setCommandes(prev => prev.map(c =>
          c.id === msg.commande_id ? { ...c, messages: [...c.messages, msg] } : c
        ));
        setSelected(prev =>
          prev && prev.id === msg.commande_id ? { ...prev, messages: [...prev.messages, msg] } : prev
        );
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, []); // eslint-disable-line

  async function chargerTout() {
    setLoading(true);
    const [{ data: cmd }, { data: ver }, { data: sub }] = await Promise.all([
      supabase.from("commandes").select("*, messages(*)").order("created_at", { ascending: false }),
      supabase.from("versions").select("*").order("numero", { ascending: true }),
      supabase.from("profiles").select("id, prenom, nom").eq("dessinateur_id", profil.dessinateur_id ?? "").neq("id", profil.id),
    ]);
    if (cmd) setCommandes(cmd.map(c => ({
      ...c,
      plans: c.plans || [],
      fichiersPlan: c.fichiers_plan || [],
      logoClient: c.logo_client || [],
      plansFinalises: c.plans_finalises || [],
      messages: (c.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    })));
    if (ver) setVersions(ver);
    if (sub) setSousComptes(sub);
    setLoading(false);
  }

  async function creerCommande() {
    if (!form.nom_plan || !form.delai) return;
    setSaving(true);
    setSaveError("");
    const ref = "CMD-" + String(commandes.length + 1).padStart(3, "0");
    const { data, error } = await supabase.from("commandes").insert([{
      ref,
      utilisateur_id: form.utilisateur_id,
      nom_plan: form.nom_plan,
      client_nom: form.client_nom, client_prenom: form.client_prenom,
      client_email: form.client_email, client_telephone: form.client_telephone,
      adresse1: form.adresse1, adresse2: form.adresse2,
      code_postal: form.code_postal, ville: form.ville,
      delai: form.delai, plans: form.plans,
      fichiers_plan: form.fichiersPlan, logo_client: form.logoClient,
      instructions: form.instructions,
      plans_finalises: [], statut: "En attente",
    }]).select("*, messages(*)").single();
    if (error) { setSaveError(error.message); setSaving(false); return; }
    if (data) {
      const nouvelleCommande = { ...data, plans: data.plans || [], fichiersPlan: data.fichiers_plan || [], logoClient: data.logo_client || [], plansFinalises: [], messages: [] };
      if (form.instructions?.trim()) {
        const { data: msg } = await supabase.from("messages").insert([{
          commande_id: data.id, auteur: auteurNom, texte: form.instructions.trim(),
          fichiers: [], date: formatDateMsg(),
        }]).select().single();
        if (msg) nouvelleCommande.messages = [msg];
      }
      setCommandes(prev => [nouvelleCommande, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
    setForm(formVide());
  }

  async function changerStatut(id, statut) {
    const { error } = await supabase.from("commandes").update({ statut }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
    }
  }

  async function envoyerMessage(commandeId, auteur, texte, fichiers = []) {
    const { data, error } = await supabase.from("messages").insert([{
      commande_id: commandeId, auteur, texte: texte || "", fichiers, date: formatDateMsg(),
    }]).select().single();
    if (!error && data) {
      setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, messages: [...c.messages, data] } : c));
      if (selected?.id === commandeId) setSelected(prev => ({ ...prev, messages: [...prev.messages, data] }));
    }
  }

  async function envoyerDemandeModification() {
    if (!modifMsg.trim() || !selected) return;
    setEnvoyantModif(true);
    await envoyerMessage(selected.id, auteurNom, modifMsg, modifFichiers);
    await changerStatut(selected.id, "Modification dessinateur");
    setModifMsg(""); setModifFichiers([]); setShowModifModal(false); setEnvoyantModif(false);
  }

  async function validerCommande() {
    if (!selected) return;
    setValidant(true);
    await changerStatut(selected.id, "Validé");
    await envoyerMessage(selected.id, auteurNom, "✅ Commande validée. Merci pour votre travail !");
    setShowValidModal(false); setValidant(false);
  }

  const cmdFiltrees = appliquerFiltresTri(commandes, filtres, tri);
  const actives = cmdFiltrees.filter(c => c.statut !== "Validé");
  const terminees = cmdFiltrees.filter(c => c.statut === "Validé");
  const versionsSelected = selected ? versions.filter(v => v.commande_id === selected.id) : [];

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 };

  return (
    <div onClick={() => showMenuProfil && setShowMenuProfil(false)} style={{ display: "flex", height: "100dvh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}>

      {/* Sidebar */}
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px 0 12px", gap: 4, position: "fixed", top: 0, height: "100dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
          <div style={{ width: 32, height: 32, background: "#122131", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontSize: 16 }}>🔥</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>First Incendie</span>
        </div>
        {nav.map(item => (
          <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#E8EDF2" : "transparent", color: vue === item.id ? "#122131" : "#6B7280", textAlign: "left", width: "100%" }}>
            <span>{item.icon}</span><span>{item.label}</span>
          </button>
        ))}
        {/* Menu utilisateur en bas */}
        <div style={{ marginTop: "auto", position: "relative", paddingBottom: 12 }}>
          {showMenuProfil && (
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.10)", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#122131" }}>{profil.prenom} {profil.nom}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{session?.user?.email}</div>
              </div>
              <button onClick={() => supabase.auth.signOut()} style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13, color: "#DC2626", cursor: "pointer" }}>
                ↪ Se déconnecter
              </button>
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); setShowMenuProfil(v => !v); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: "none", borderTop: "1px solid #E5E7EB", cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#122131", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {`${(profil.prenom?.[0] || "").toUpperCase()}${(profil.nom?.[0] || "").toUpperCase()}`}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#122131", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profil.prenom} {profil.nom}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Utilisateur{profil.is_owner ? " · Owner" : ""}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ marginLeft: 220, flex: 1, padding: "32px 32px", overflowY: "auto" }}>

        {vue === "reglages" && <PageReglages profil={profil} onProfilUpdate={onProfilUpdate} />}

        {vue === "mon-compte" && <PageMonCompte profil={profil} session={session} role="utilisateur" commandes={commandes} onProfilUpdate={onProfilUpdate} />}

        {vue === "utilisateurs" && profil.is_owner && <GestionUtilisateurs />}

        {vue === "commandes" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Commandes</h1>
              <button onClick={() => { setForm(formVide()); setShowForm(true); }}
                style={{ background: "#122131", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Nouvelle commande
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "En cours", val: commandes.filter(c => c.statut !== "Validé").length, color: "#122131", bg: "#fff" },
                { label: "Validées", val: commandes.filter(c => c.statut === "Validé").length, color: "#059669", bg: "#F0FDF4" },
                { label: "Total", val: commandes.length, color: "#374151", bg: "#F8FAFC" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 22px" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", color: "#94A3B8", padding: 40 }}>Chargement...</div>
            ) : (
              <>
                <BarreFiltres commandes={commandes} filtres={filtres} setFiltres={setFiltres} tri={tri} setTri={setTri} dessinateurs={[]} showDessinateur={false} couleurAccent="#122131" />

                {/* Tableau actives */}
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <span>Plan</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
                  </div>
                  {actives.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande active.</div>}
                  {actives.map(c => (
                    <div key={c.id} onClick={() => setSelected(c)}
                      style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EEF3F8" : "transparent" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans?.length ?? 0}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                      <Badge statut={c.statut} />
                    </div>
                  ))}
                </div>

                {/* Terminées repliables */}
                {terminees.length > 0 && (
                  <div style={{ marginBottom: selected ? 24 : 0 }}>
                    <button onClick={() => setShowTerminees(v => !v)}
                      style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
                      {showTerminees ? "▲ Masquer les commandes validées" : `▼ Voir les ${terminees.length} commande${terminees.length > 1 ? "s" : ""} validée${terminees.length > 1 ? "s" : ""}`}
                    </button>
                    {showTerminees && (
                      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", opacity: 0.8 }}>
                        {terminees.map(c => (
                          <div key={c.id} onClick={() => setSelected(c)}
                            style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer" }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</div>
                              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                            </div>
                            <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans?.length ?? 0}</div>
                            <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                            <Badge statut={c.statut} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Panneau détail */}
                {selected && (
                  <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.nom_plan}</div>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.ref}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge statut={selected.statut} />
                        <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                      {[
                        { label: "Client", val: `${selected.client_prenom ?? ""} ${selected.client_nom ?? ""}`.trim() || "—" },
                        { label: "Email client", val: selected.client_email || "—" },
                        { label: "Téléphone", val: selected.client_telephone || "—" },
                        { label: "Créé le", val: formatDateCourt(selected.created_at) },
                        { label: "Délai", val: selected.delai ? formatDateCourt(selected.delai) : "—" },
                        { label: "Nb. plans", val: selected.plans?.length ?? 0 },
                      ].map(f => (
                        <div key={f.label}>
                          <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div>
                        </div>
                      ))}
                    </div>

                    <BlocAdresse commande={selected} copiable />
                    <HistoriqueVersions versions={versionsSelected} />

                    {selected.statut === "Ébauche déposée" && (
                      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                        <button onClick={() => setShowModifModal(true)}
                          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#92400E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          ✏️ Demander une modification
                        </button>
                        <button onClick={() => setShowValidModal(true)}
                          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          ✅ Valider la commande
                        </button>
                      </div>
                    )}

                    {selected.statut === "Validé" ? (
                      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46" }}>
                        ✅ Commande validée — messagerie fermée
                      </div>
                    ) : (
                      <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
                        onEnvoyer={async (texte, fichiers) => { if (!texte.trim() && !fichiers?.length) return; await envoyerMessage(selected.id, auteurNom, texte, fichiers); }}
                        auteurActif={auteurNom} allowFichier />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modal nouvelle commande */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 680, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nouvelle commande</h2>
              <button onClick={() => { setShowForm(false); setForm(formVide()); setSaveError(""); }} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
            </div>

            {/* Section Client */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#122131", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid #E5E7EB" }}>Informations client</div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Compte utilisateur</label>
                <select value={form.utilisateur_id} onChange={e => setForm({ ...form, utilisateur_id: e.target.value })} style={inputStyle}>
                  <option value={profil.id}>{profil.prenom} {profil.nom} (moi)</option>
                  {sousComptes.map(s => (
                    <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Nom du plan *</label>
                <input type="text" value={form.nom_plan} placeholder="Ex: Résidence Les Pins — Bât A" onChange={e => setForm({ ...form, nom_plan: e.target.value })} style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={labelStyle}>Prénom client</label><input type="text" value={form.client_prenom} onChange={e => setForm({ ...form, client_prenom: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Nom client</label><input type="text" value={form.client_nom} onChange={e => setForm({ ...form, client_nom: e.target.value })} style={inputStyle} /></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={labelStyle}>Email client</label><input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Téléphone</label><input type="tel" value={form.client_telephone} onChange={e => setForm({ ...form, client_telephone: e.target.value })} style={inputStyle} /></div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Adresse</label>
                <input type="text" value={form.adresse1} placeholder="Adresse ligne 1" onChange={e => setForm({ ...form, adresse1: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
                <input type="text" value={form.adresse2} placeholder="Complément d'adresse" onChange={e => setForm({ ...form, adresse2: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                  <input type="text" value={form.code_postal} placeholder="Code postal" onChange={e => setForm({ ...form, code_postal: e.target.value })} style={inputStyle} />
                  <input type="text" value={form.ville} placeholder="Ville" onChange={e => setForm({ ...form, ville: e.target.value })} style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Section Plan */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#122131", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid #E5E7EB" }}>Détail du plan</div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Délai souhaité *</label>
                <input type="date" value={form.delai} min={new Date().toISOString().split("T")[0]} onChange={e => setForm({ ...form, delai: e.target.value })} style={inputStyle} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Plans à réaliser</label>
                <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px" }}>
                  <TableauPlans plans={form.plans} onChange={plans => setForm({ ...form, plans })} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
                <ZoneUpload label="📄 Fichiers du plan" fichiers={form.fichiersPlan} onAjouter={f => setForm({ ...form, fichiersPlan: f })} onSupprimer={i => setForm({ ...form, fichiersPlan: form.fichiersPlan.filter((_, idx) => idx !== i) })} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf" maxFichiers={10} />
                <ZoneUpload label="🏢 Logo du client" fichiers={form.logoClient} onAjouter={f => setForm({ ...form, logoClient: f })} onSupprimer={() => setForm({ ...form, logoClient: [] })} accept="image/*" unique />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Instructions pour le dessinateur</label>
                <textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} rows={3} placeholder="Instructions, remarques..." style={{ ...inputStyle, resize: "vertical" }} />
              </div>
            </div>

            {saveError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>Erreur : {saveError}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => { setShowForm(false); setForm(formVide()); setSaveError(""); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={creerCommande} disabled={saving || !form.nom_plan || !form.delai}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: (!form.nom_plan || !form.delai) ? "not-allowed" : "pointer", background: (!form.nom_plan || !form.delai) ? "#F3F4F6" : "#122131", color: (!form.nom_plan || !form.delai) ? "#9CA3AF" : "#fff" }}>
                {saving ? "Enregistrement..." : "Créer la commande"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal demande modification */}
      {showModifModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✏️ Demander une modification</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Le statut passera en "Modification dessinateur".</div>
            <textarea value={modifMsg} onChange={e => setModifMsg(e.target.value)} rows={4} placeholder="Décrivez les modifications..." style={{ ...inputStyle, marginBottom: 14, resize: "vertical" }} />
            <ZoneUpload label="📎 Fichiers joints (optionnel)" fichiers={modifFichiers} onAjouter={f => setModifFichiers(f)} onSupprimer={i => setModifFichiers(modifFichiers.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf" maxFichiers={5} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => { setShowModifModal(false); setModifMsg(""); setModifFichiers([]); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={envoyerDemandeModification} disabled={!modifMsg.trim() || envoyantModif}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: !modifMsg.trim() ? "#F3F4F6" : "#D97706", color: !modifMsg.trim() ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: !modifMsg.trim() ? "not-allowed" : "pointer" }}>
                {envoyantModif ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal validation */}
      {showValidModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Confirmer la validation</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{selected?.nom_plan}</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 24 }}>Cette action est irréversible. La commande sera clôturée.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowValidModal(false)} style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={validerCommande} disabled={validant}
                style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {validant ? "Validation..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier que l'app compile sans erreur**

```bash
npm start
```

Se connecter avec le compte utilisateur test. Vérifier : la liste de commandes s'affiche, le formulaire s'ouvre, les 2 sections Client/Plan sont visibles.

- [ ] **Step 3 : Créer une commande test et vérifier qu'elle apparaît**

Créer une commande via le formulaire. Vérifier qu'elle apparaît immédiatement dans la liste sans rechargement.

- [ ] **Step 4 : Commit**

```bash
git add src/components/VueUtilisateur.js
git commit -m "feat: create VueUtilisateur — UUID-based commandes, two-section form, sous-comptes dropdown"
```

---

### Task 3 : Réécrire VueDessinateur.js

**Objectif :** Le dessinateur voit uniquement ses missions (via RLS). Les statuts évoluent par actions contextuelles uniquement.

- [ ] **Step 1 : Réécrire `src/components/VueDessinateur.js`**

```javascript
import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { formatDateMsg, formatDateCourt } from "../helpers";
import Badge from "./Badge";
import BarreFiltres, { appliquerFiltresTri } from "./BarreFiltres";
import Messagerie from "./Messagerie";
import HistoriqueVersions from "./HistoriqueVersions";
import ZoneUpload from "./ZoneUpload";
import PageReglages from "./PageReglages";
import PageMonCompte from "./PageMonCompte";
import BlocAdresse from "./BlocAdresse";
import { ListeFichiers, LogoCliquable } from "./VisuFichier";

export default function VueDessinateur({ session, profil, onProfilUpdate }) {
  const [commandes, setCommandes] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState("commandes");
  const [selected, setSelected] = useState(null);
  const [showMenuProfil, setShowMenuProfil] = useState(false);
  const [filtres, setFiltres] = useState({ statut: "", type: "", periode: "" });
  const [tri, setTri] = useState({ col: "created_at", dir: "desc" });
  const [msgInput, setMsgInput] = useState("");
  const [showDepotModal, setShowDepotModal] = useState(false);
  const [fichiersDepot, setFichiersDepot] = useState([]);
  const [deposant, setDeposant] = useState(false);

  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();
  const nav = [
    { id: "commandes", label: "Mes missions", icon: "📋" },
    { id: "reglages", label: "Réglages", icon: "⚙️" },
    { id: "mon-compte", label: "Mon compte", icon: "👤" },
  ];

  useEffect(() => {
    chargerTout();
    const canal = supabase
      .channel("messages-dessinateur")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        setCommandes(prev => prev.map(c =>
          c.id === msg.commande_id ? { ...c, messages: [...c.messages, msg] } : c
        ));
        setSelected(prev =>
          prev && prev.id === msg.commande_id ? { ...prev, messages: [...prev.messages, msg] } : prev
        );
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, []); // eslint-disable-line

  async function chargerTout() {
    setLoading(true);
    // RLS filtre automatiquement : seules les commandes des utilisateurs assignés à ce dessinateur
    const [{ data: cmd }, { data: ver }] = await Promise.all([
      supabase.from("commandes").select("*, messages(*)").order("created_at", { ascending: false }),
      supabase.from("versions").select("*").order("numero", { ascending: true }),
    ]);
    if (cmd) setCommandes(cmd.map(c => ({
      ...c,
      plans: c.plans || [],
      fichiersPlan: c.fichiers_plan || [],
      logoClient: c.logo_client || [],
      plansFinalises: c.plans_finalises || [],
      messages: (c.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    })));
    if (ver) setVersions(ver);
    setLoading(false);
  }

  async function commencer(id) {
    const { error } = await supabase.from("commandes").update({ statut: "Commencé" }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: "Commencé" } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, statut: "Commencé" }));
      await envoyerMessage(id, auteurNom, "🚀 Mission commencée.");
    }
  }

  async function deposerVersion() {
    if (!fichiersDepot.length || !selected) return;
    setDeposant(true);
    const numero = versions.filter(v => v.commande_id === selected.id).length + 1;
    const { data: ver } = await supabase.from("versions").insert([{
      commande_id: selected.id, fichiers: fichiersDepot, numero, deposee_par: auteurNom,
    }]).select().single();
    if (ver) setVersions(prev => [...prev, ver]);
    const { error } = await supabase.from("commandes").update({ statut: "Ébauche déposée" }).eq("id", selected.id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === selected.id ? { ...c, statut: "Ébauche déposée" } : c));
      setSelected(prev => ({ ...prev, statut: "Ébauche déposée" }));
      await envoyerMessage(selected.id, auteurNom, `📎 Version ${numero} déposée.`);
    }
    setFichiersDepot([]); setShowDepotModal(false); setDeposant(false);
  }

  async function envoyerMessage(commandeId, auteur, texte, fichiers = []) {
    const { data, error } = await supabase.from("messages").insert([{
      commande_id: commandeId, auteur, texte: texte || "", fichiers, date: formatDateMsg(),
    }]).select().single();
    if (!error && data) {
      setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, messages: [...c.messages, data] } : c));
      if (selected?.id === commandeId) setSelected(prev => ({ ...prev, messages: [...prev.messages, data] }));
    }
  }

  const cmdFiltrees = appliquerFiltresTri(commandes, filtres, tri);
  const actives = cmdFiltrees.filter(c => c.statut !== "Validé");
  const terminees = cmdFiltrees.filter(c => c.statut === "Validé");
  const [showTerminees, setShowTerminees] = useState(false);
  const versionsSelected = selected ? versions.filter(v => v.commande_id === selected.id) : [];
  const peutDeposer = selected && ["Commencé", "Modification dessinateur"].includes(selected.statut);

  return (
    <div onClick={() => showMenuProfil && setShowMenuProfil(false)} style={{ display: "flex", height: "100dvh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}>

      {/* Sidebar */}
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px 0 12px", gap: 4, position: "fixed", top: 0, height: "100dvh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
          <div style={{ width: 32, height: 32, background: "#FC6C1B", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontSize: 16 }}>✏️</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>First Incendie</span>
        </div>
        {nav.map(item => (
          <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#FFF3EE" : "transparent", color: vue === item.id ? "#FC6C1B" : "#6B7280", textAlign: "left", width: "100%" }}>
            <span>{item.icon}</span><span>{item.label}</span>
          </button>
        ))}
        <div style={{ marginTop: "auto", position: "relative", paddingBottom: 12 }}>
          {showMenuProfil && (
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 -4px 20px rgba(0,0,0,0.10)", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{profil.prenom} {profil.nom}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{session?.user?.email}</div>
              </div>
              <button onClick={() => supabase.auth.signOut()} style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13, color: "#DC2626", cursor: "pointer" }}>↪ Se déconnecter</button>
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); setShowMenuProfil(v => !v); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: "none", borderTop: "1px solid #E5E7EB", cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#FC6C1B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {`${(profil.prenom?.[0] || "").toUpperCase()}${(profil.nom?.[0] || "").toUpperCase()}`}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#122131", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profil.prenom} {profil.nom}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Dessinateur</div>
            </div>
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ marginLeft: 220, flex: 1, padding: "32px 32px", overflowY: "auto" }}>
        {vue === "reglages" && <PageReglages profil={profil} onProfilUpdate={onProfilUpdate} />}
        {vue === "mon-compte" && <PageMonCompte profil={profil} session={session} role="dessinateur" commandes={commandes} onProfilUpdate={onProfilUpdate} />}

        {vue === "commandes" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Mes missions</h1>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "En cours", val: commandes.filter(c => c.statut !== "Validé").length, color: "#FC6C1B", bg: "#FFF3EE" },
                { label: "Validées", val: commandes.filter(c => c.statut === "Validé").length, color: "#059669", bg: "#F0FDF4" },
                { label: "Total", val: commandes.length, color: "#374151", bg: "#F8FAFC" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 22px" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", color: "#94A3B8", padding: 40 }}>Chargement...</div>
            ) : (
              <>
                <BarreFiltres commandes={commandes} filtres={filtres} setFiltres={setFiltres} tri={tri} setTri={setTri} dessinateurs={[]} showDessinateur={false} couleurAccent="#FC6C1B" />

                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase" }}>
                    <span>Plan</span><span>Créé le</span><span>Délai</span><span>Statut</span>
                  </div>
                  {actives.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune mission active.</div>}
                  {actives.map(c => (
                    <div key={c.id} onClick={() => setSelected(c)}
                      style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#FFF3EE" : "transparent" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                      <Badge statut={c.statut} />
                    </div>
                  ))}
                </div>

                {terminees.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <button onClick={() => setShowTerminees(v => !v)} style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
                      {showTerminees ? "▲ Masquer les validées" : `▼ Voir les ${terminees.length} mission${terminees.length > 1 ? "s" : ""} validée${terminees.length > 1 ? "s" : ""}`}
                    </button>
                    {showTerminees && (
                      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", opacity: 0.8 }}>
                        {terminees.map(c => (
                          <div key={c.id} onClick={() => setSelected(c)}
                            style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer" }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</div>
                              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                            </div>
                            <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                            <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                            <Badge statut={c.statut} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Panneau détail */}
                {selected && (
                  <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.nom_plan}</div>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.ref}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge statut={selected.statut} />
                        <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                      {[
                        { label: "Client", val: `${selected.client_prenom ?? ""} ${selected.client_nom ?? ""}`.trim() || "—" },
                        { label: "Créé le", val: formatDateCourt(selected.created_at) },
                        { label: "Délai", val: selected.delai ? formatDateCourt(selected.delai) : "—" },
                      ].map(f => (
                        <div key={f.label}>
                          <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div>
                        </div>
                      ))}
                    </div>

                    <BlocAdresse commande={selected} />

                    {selected.instructions && (
                      <div style={{ background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 4 }}>Instructions</div>
                        <div style={{ fontSize: 13, color: "#374151" }}>{selected.instructions}</div>
                      </div>
                    )}

                    {selected.fichiersPlan?.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Fichiers sources</div>
                        <ListeFichiers fichiers={selected.fichiersPlan} couleurAccent="#FC6C1B" />
                      </div>
                    )}

                    {selected.logoClient?.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Logo client</div>
                        <LogoCliquable fichier={selected.logoClient[0]} />
                      </div>
                    )}

                    <HistoriqueVersions versions={versionsSelected} />

                    {/* Actions contextuelles selon statut */}
                    {selected.statut === "En attente" && (
                      <button onClick={() => commencer(selected.id)}
                        style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#FC6C1B", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
                        🚀 Commencer la mission
                      </button>
                    )}

                    {peutDeposer && (
                      <button onClick={() => setShowDepotModal(true)}
                        style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>
                        📤 Déposer une ébauche
                      </button>
                    )}

                    {selected.statut === "Validé" ? (
                      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46" }}>
                        ✅ Mission validée par le client
                      </div>
                    ) : (
                      <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
                        onEnvoyer={async (texte, fichiers) => { if (!texte.trim() && !fichiers?.length) return; await envoyerMessage(selected.id, auteurNom, texte, fichiers); }}
                        auteurActif={auteurNom} allowFichier />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modal dépôt ébauche */}
      {showDepotModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📤 Déposer une ébauche</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Le statut passera en "Ébauche déposée" automatiquement.</div>
            <ZoneUpload label="Fichiers de l'ébauche *" fichiers={fichiersDepot} onAjouter={f => setFichiersDepot(f)} onSupprimer={i => setFichiersDepot(fichiersDepot.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf" maxFichiers={20} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => { setShowDepotModal(false); setFichiersDepot([]); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={deposerVersion} disabled={!fichiersDepot.length || deposant}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: !fichiersDepot.length ? "#F3F4F6" : "#122131", color: !fichiersDepot.length ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: !fichiersDepot.length ? "not-allowed" : "pointer" }}>
                {deposant ? "Dépôt..." : "Déposer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier dans le navigateur**

Se connecter avec le compte dessinateur test. Vérifier :
- La liste de missions s'affiche (filtrée par RLS)
- Le bouton "Commencer" apparaît sur une mission "En attente"
- Le bouton "Déposer une ébauche" apparaît sur "Commencé"

- [ ] **Step 3 : Commit**

```bash
git add src/components/VueDessinateur.js
git commit -m "feat: rewrite VueDessinateur — RLS-filtered missions, contextual action buttons"
```

---

### Task 4 : Réécrire GestionUtilisateurs.js

**Objectif :** Interface complète de gestion des comptes pour `is_owner`. Visible uniquement depuis VueUtilisateur si `profil.is_owner === true`.

- [ ] **Step 1 : Réécrire `src/components/GestionUtilisateurs.js`**

```javascript
import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function GestionUtilisateurs() {
  const [comptes, setComptes] = useState([]);
  const [dessinateurs, setDessinateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", prenom: "", nom: "", role: "utilisateur" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => { chargerComptes(); }, []);

  async function chargerComptes() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setComptes(data);
      setDessinateurs(data.filter(p => p.role === "dessinateur" && p.statut === "actif"));
    }
    setLoading(false);
  }

  async function mettreAJourStatut(id, statut) {
    const { error } = await supabase.from("profiles").update({ statut }).eq("id", id);
    if (!error) {
      setComptes(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
    }
  }

  async function sauvegarderEdit() {
    if (!editForm || !selected) return;
    setSaving(true);
    setSaveError("");
    const { error } = await supabase.from("profiles").update({
      prenom: editForm.prenom,
      nom: editForm.nom,
      role: editForm.role,
      statut: editForm.statut,
      is_owner: editForm.is_owner,
      dessinateur_id: editForm.dessinateur_id || null,
    }).eq("id", selected.id);
    if (error) { setSaveError(error.message); setSaving(false); return; }
    setComptes(prev => prev.map(c => c.id === selected.id ? { ...c, ...editForm } : c));
    setSelected(prev => ({ ...prev, ...editForm }));
    setEditForm(null);
    setSaving(false);
  }

  async function supprimerCompte(id) {
    if (!window.confirm("Supprimer définitivement ce compte ? Cette action est irréversible.")) return;
    // Supprimer via Supabase Admin API (Edge Function nécessaire pour supprimer auth.users)
    const { error } = await supabase.functions.invoke("delete-user", { body: { user_id: id } });
    if (!error) {
      setComptes(prev => prev.filter(c => c.id !== id));
      if (selected?.id === id) setSelected(null);
    } else {
      alert("Erreur lors de la suppression : " + error.message);
    }
  }

  async function renvoyerResetMdp(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (!error) alert(`Email de réinitialisation envoyé à ${email}`);
    else alert("Erreur : " + error.message);
  }

  async function creerCompte() {
    if (!createForm.email || !createForm.prenom || !createForm.nom) return;
    setCreating(true);
    setCreateError("");
    // Invite via Edge Function (Supabase Admin API)
    const { error } = await supabase.functions.invoke("invite-user", {
      body: { email: createForm.email, prenom: createForm.prenom, nom: createForm.nom, role: createForm.role },
    });
    if (error) { setCreateError(error.message); setCreating(false); return; }
    setShowCreateModal(false);
    setCreateForm({ email: "", prenom: "", nom: "", role: "utilisateur" });
    setCreating(false);
    await chargerComptes();
  }

  const comptesFiltres = filtre === "tous" ? comptes : comptes.filter(c => c.statut === filtre);

  const statutBadge = (statut) => {
    const styles = {
      en_attente: { bg: "#FEF3C7", color: "#92400E", label: "En attente" },
      actif: { bg: "#D1FAE5", color: "#065F46", label: "Actif" },
      refuse: { bg: "#FEE2E2", color: "#991B1B", label: "Refusé" },
      bloque: { bg: "#F3F4F6", color: "#374151", label: "Bloqué" },
    };
    const s = styles[statut] || styles.en_attente;
    return <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
  };

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Gestion des utilisateurs</h1>
        <button onClick={() => setShowCreateModal(true)}
          style={{ background: "#122131", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nouveau compte
        </button>
      </div>

      {/* Filtres statut */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["tous", "en_attente", "actif", "refuse", "bloque"].map(f => (
          <button key={f} onClick={() => setFiltre(f)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: filtre === f ? "#122131" : "#fff", color: filtre === f ? "#fff" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {f === "tous" ? "Tous" : f === "en_attente" ? "En attente" : f === "actif" ? "Actifs" : f === "refuse" ? "Refusés" : "Bloqués"}
            {" "}({f === "tous" ? comptes.length : comptes.filter(c => c.statut === f).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#94A3B8", padding: 40 }}>Chargement...</div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1.5fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase" }}>
            <span>Nom</span><span>Email</span><span>Rôle</span><span>Statut</span><span>Dessinateur</span><span>Actions</span>
          </div>
          {comptesFiltres.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucun compte.</div>}
          {comptesFiltres.map(c => {
            const dessinateurAssigne = dessinateurs.find(d => d.id === c.dessinateur_id);
            return (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1.5fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", background: selected?.id === c.id ? "#F8FAFC" : "transparent" }}>
                <div style={{ cursor: "pointer" }} onClick={() => { setSelected(c); setEditForm({ prenom: c.prenom, nom: c.nom, role: c.role, statut: c.statut, is_owner: c.is_owner || false, dessinateur_id: c.dessinateur_id || "" }); }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.prenom} {c.nom}</div>
                  {c.is_owner && <div style={{ fontSize: 10, color: "#FC6C1B", fontWeight: 700 }}>OWNER</div>}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{c.email}</div>
                <div style={{ fontSize: 12, color: "#374151" }}>{c.role === "dessinateur" ? "Dessinateur" : "Utilisateur"}</div>
                <div>{statutBadge(c.statut)}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{dessinateurAssigne ? `${dessinateurAssigne.prenom} ${dessinateurAssigne.nom}` : "—"}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {c.statut === "en_attente" && (
                    <>
                      <button onClick={() => mettreAJourStatut(c.id, "actif")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#D1FAE5", color: "#065F46", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Activer</button>
                      <button onClick={() => mettreAJourStatut(c.id, "refuse")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#FEE2E2", color: "#991B1B", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Refuser</button>
                    </>
                  )}
                  {c.statut === "actif" && (
                    <button onClick={() => mettreAJourStatut(c.id, "bloque")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#F3F4F6", color: "#374151", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Bloquer</button>
                  )}
                  {(c.statut === "refuse" || c.statut === "bloque") && (
                    <button onClick={() => mettreAJourStatut(c.id, "actif")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#D1FAE5", color: "#065F46", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Réactiver</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panneau détail / édition */}
      {selected && editForm && (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.prenom} {selected.nom}</div>
            <button onClick={() => { setSelected(null); setEditForm(null); }} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div><label style={labelStyle}>Prénom</label><input value={editForm.prenom} onChange={e => setEditForm({ ...editForm, prenom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Nom</label><input value={editForm.nom} onChange={e => setEditForm({ ...editForm, nom: e.target.value })} style={inputStyle} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Rôle</label>
              <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={inputStyle}>
                <option value="utilisateur">Utilisateur</option>
                <option value="dessinateur">Dessinateur</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Statut</label>
              <select value={editForm.statut} onChange={e => setEditForm({ ...editForm, statut: e.target.value })} style={inputStyle}>
                <option value="en_attente">En attente</option>
                <option value="actif">Actif</option>
                <option value="refuse">Refusé</option>
                <option value="bloque">Bloqué</option>
              </select>
            </div>
          </div>

          {editForm.role === "utilisateur" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Dessinateur assigné</label>
              <select value={editForm.dessinateur_id} onChange={e => setEditForm({ ...editForm, dessinateur_id: e.target.value })} style={inputStyle}>
                <option value="">— Non assigné —</option>
                {dessinateurs.map(d => (
                  <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={editForm.is_owner} onChange={e => setEditForm({ ...editForm, is_owner: e.target.checked })} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Compte owner (accès gestion utilisateurs)</span>
            </label>
          </div>

          {saveError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>Erreur : {saveError}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => renvoyerResetMdp(selected.email)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 12, cursor: "pointer", color: "#6B7280" }}>
                📧 Renvoyer reset mot de passe
              </button>
              <button onClick={() => supprimerCompte(selected.id)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", fontSize: 12, cursor: "pointer", color: "#DC2626", fontWeight: 600 }}>
                🗑️ Supprimer le compte
              </button>
            </div>
            <button onClick={sauvegarderEdit} disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {saving ? "Enregistrement..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      )}

      {/* Modal création compte */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 460 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Nouveau compte</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={labelStyle}>Prénom *</label><input value={createForm.prenom} onChange={e => setCreateForm({ ...createForm, prenom: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Nom *</label><input value={createForm.nom} onChange={e => setCreateForm({ ...createForm, nom: e.target.value })} style={inputStyle} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={labelStyle}>Email *</label><input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} style={inputStyle} /></div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Rôle</label>
              <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} style={inputStyle}>
                <option value="utilisateur">Utilisateur</option>
                <option value="dessinateur">Dessinateur</option>
              </select>
            </div>
            {createError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>Erreur : {createError}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowCreateModal(false); setCreateForm({ email: "", prenom: "", nom: "", role: "utilisateur" }); setCreateError(""); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={creerCompte} disabled={creating || !createForm.email || !createForm.prenom || !createForm.nom}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {creating ? "Création..." : "Créer et inviter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier dans le navigateur**

Se connecter avec `contact@firstincendie.com`. Vérifier :
- L'onglet "Utilisateurs" apparaît dans la sidebar
- La liste des comptes s'affiche
- Les boutons Activer/Refuser apparaissent uniquement pour les comptes `en_attente`
- Le bouton Bloquer apparaît uniquement pour les comptes `actif`
- Le panneau d'édition s'ouvre au clic sur un compte

- [ ] **Step 3 : Commit**

```bash
git add src/components/GestionUtilisateurs.js
git commit -m "feat: rewrite GestionUtilisateurs — full CRUD, statut actions, dessinateur assignment"
```

---

### Task 5 : Ajouter les préférences de notifications dans PageReglages

**Objectif :** Ajouter une section "Notifications email" dans la page Réglages avec des toggles par préférence.

- [ ] **Step 1 : Lire PageReglages.js**

Lire `src/components/PageReglages.js` pour comprendre la structure actuelle.

- [ ] **Step 2 : Ajouter la section notifications**

Ajouter à la fin du composant PageReglages, avant le `return` final, la section notifications. Les props nécessaires : `profil` et `onProfilUpdate`.

Modifier la signature : `export default function PageReglages({ profil, onProfilUpdate })` si pas déjà le cas.

Ajouter la section dans le JSX :

```javascript
{/* Section Notifications */}
{profil && (
  <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 16 }}>
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Notifications email</div>
    {[
      ...(profil.role === "dessinateur" ? [
        { key: "notif_nouvelle_commande", label: "Nouvelle commande assignée", desc: "Recevoir un email quand un client crée une commande" },
      ] : []),
      { key: "notif_nouveau_message", label: "Nouveau message", desc: "Recevoir un email quand un message est posté dans une commande" },
      ...(profil.role === "utilisateur" ? [
        { key: "notif_nouvelle_version", label: "Ébauche déposée", desc: "Recevoir un email quand le dessinateur dépose une nouvelle version" },
      ] : []),
    ].map(({ key, label, desc }) => (
      <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{desc}</div>
        </div>
        <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, cursor: "pointer" }}>
          <input type="checkbox" checked={profil[key] !== false} onChange={async (e) => {
            const { error } = await supabase.from("profiles").update({ [key]: e.target.checked }).eq("id", profil.id);
            if (!error) onProfilUpdate({ [key]: e.target.checked });
          }} style={{ opacity: 0, width: 0, height: 0 }} />
          <span style={{ position: "absolute", inset: 0, background: profil[key] !== false ? "#122131" : "#E5E7EB", borderRadius: 12, transition: "0.2s" }}>
            <span style={{ position: "absolute", top: 2, left: profil[key] !== false ? 22 : 2, width: 20, height: 20, background: "#fff", borderRadius: "50%", transition: "0.2s" }} />
          </span>
        </label>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 3 : Vérifier que les toggles fonctionnent**

Aller dans Réglages. Activer/désactiver un toggle. Recharger la page. Vérifier que le choix est persisté.

- [ ] **Step 4 : Commit**

```bash
git add src/components/PageReglages.js
git commit -m "feat: add email notification preferences to PageReglages"
```

---

### Task 6 : Nettoyer les anciens fichiers

- [ ] **Step 1 : Supprimer VueClient.js**

```bash
rm src/components/VueClient.js
```

- [ ] **Step 2 : Supprimer GestionCompteDessinateur.js**

```bash
rm src/components/GestionCompteDessinateur.js
```

- [ ] **Step 3 : Vérifier qu'il n'y a plus d'imports cassés**

```bash
npm start
```

Vérifier qu'il n'y a aucune erreur de compilation liée aux fichiers supprimés.

- [ ] **Step 4 : Commit final**

```bash
git add -A
git commit -m "chore: remove obsolete VueClient.js and GestionCompteDessinateur.js"
```

---

### Task 7 : Test end-to-end complet

- [ ] **Step 1 : Test compte utilisateur**
  - Se connecter avec le compte utilisateur test
  - Créer une nouvelle commande — vérifier qu'elle apparaît dans la liste
  - Ouvrir le détail — vérifier toutes les infos
  - Envoyer un message

- [ ] **Step 2 : Test compte dessinateur**
  - Se connecter avec le compte dessinateur test
  - Vérifier que les commandes de l'utilisateur assigné apparaissent
  - Cliquer "Commencer" sur une commande → statut passe à "Commencé"
  - Déposer une ébauche → statut passe à "Ébauche déposée"

- [ ] **Step 3 : Test compte owner**
  - Se connecter avec `contact@firstincendie.com`
  - Vérifier l'onglet "Utilisateurs" visible
  - Activer un compte en attente
  - Assigner un dessinateur à un utilisateur
  - Modifier les infos d'un compte

- [ ] **Step 4 : Commit final**

```bash
git add -A
git commit -m "feat: grand reset plan 2 complete — core app fully rewritten"
git push origin main
```
