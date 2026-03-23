# Super Comptes — Plan 3 : Invitation + Gestion de compte dessinateur

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le système d'invitation (rejoindre/quitter un maître depuis Mon compte) et le composant GestionCompteDessinateur (sous-comptes + notes clients).

**Architecture:** PageMonCompte reçoit la section invitation (join/leave) après la section invite_code de Plan 1. GestionCompteDessinateur est un nouveau composant rendu via un onglet dans la sidebar dessinateur (App.js roleNav). VueDessinateur.js n'est pas modifié — l'onglet est géré dans App.js.

**Tech Stack:** React CRA, Supabase (requêtes directes dans GestionCompteDessinateur), inline styles

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `src/components/PageMonCompte.js` | Section "Rejoindre un maître" / "Quitter le groupe" |
| `src/components/GestionCompteDessinateur.js` | Nouveau composant — sous-comptes + notes clients |
| `src/App.js` | Onglet "gestion-compte" dans roleNav dessinateur + rendu conditionnel |

---

## Task 1 : PageMonCompte — rejoindre/quitter maître

**Context:**
Plan 1 (Task 3) a déjà ajouté :
- L'affichage du `invite_code` (read-only + bouton Copier)
- La section "Dessinateur assigné" pour les clients

Ce task ajoute la section interactive pour rejoindre/quitter un compte maître.

**Files:**
- Modify: `src/components/PageMonCompte.js`

- [ ] **Step 1 : Lire PageMonCompte.js entier pour confirmer la structure après Plan 1**

- [ ] **Step 2 : Ajouter les states rejoindre/quitter + nom du maître**

Dans le corps du composant `PageMonCompte`, après les states existants, ajouter :

```js
const [codeInvit, setCodeInvit]     = useState("");
const [rejoignant, setRejoignant]   = useState(false);
const [quittant, setQuittant]       = useState(false);
const [msgInvit, setMsgInvit]       = useState(""); // "" | "ok" | message d'erreur
const [nomMaitre, setNomMaitre]     = useState(null); // null | "Prénom Nom"
```

Ajouter un `useEffect` pour charger le nom du maître si le profil a un `master_id` :

```js
useEffect(() => {
  if (!profil?.master_id) { setNomMaitre(null); return; }
  supabase
    .from("profiles")
    .select("prenom, nom")
    .eq("id", profil.master_id)
    .single()
    .then(({ data }) => {
      if (data) setNomMaitre(`${data.prenom} ${data.nom}`);
    });
}, [profil?.master_id]); // eslint-disable-line
```

Note : `useEffect` et `useState` sont déjà importés dans PageMonCompte. Vérifier que `useEffect` est bien dans la liste des imports ; sinon l'ajouter.

- [ ] **Step 3 : Ajouter la fonction `rejoindreGroupe`**

```js
const rejoindreGroupe = async () => {
  if (!codeInvit.trim()) return;
  setRejoignant(true);
  setMsgInvit("");

  // 1. Chercher le maître par invite_code ET même rôle
  const { data: maitre, error } = await supabase
    .from("profiles")
    .select("id, prenom, nom, master_id")
    .eq("invite_code", codeInvit.trim().toUpperCase())
    .eq("role", profil.role)
    .maybeSingle();

  if (error || !maitre) {
    setMsgInvit("Code invalide ou aucun compte trouvé pour ce rôle.");
    setRejoignant(false);
    return;
  }
  // 2. Le maître ne doit pas être lui-même sous-compte
  if (maitre.master_id) {
    setMsgInvit("Ce compte est lui-même un sous-compte et ne peut pas être maître.");
    setRejoignant(false);
    return;
  }
  // 3. Ne pas rejoindre son propre compte
  if (maitre.id === profil.id) {
    setMsgInvit("Vous ne pouvez pas rejoindre votre propre compte.");
    setRejoignant(false);
    return;
  }
  // 4. Mettre à jour master_id (le trigger DB vérifie les autres contraintes)
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ master_id: maitre.id })
    .eq("id", session.user.id);

  if (updErr) {
    setMsgInvit(updErr.message || "Erreur lors du rattachement.");
  } else {
    setMsgInvit("ok");
    setCodeInvit("");
    setNomMaitre(`${maitre.prenom} ${maitre.nom}`);
    onProfilUpdate({ master_id: maitre.id });
  }
  setRejoignant(false);
};
```

- [ ] **Step 4 : Ajouter la fonction `quitterGroupe`**

```js
const quitterGroupe = async () => {
  setQuittant(true);
  const { error } = await supabase
    .from("profiles")
    .update({ master_id: null })
    .eq("id", session.user.id);
  if (!error) { setNomMaitre(null); onProfilUpdate({ master_id: null }); }
  setQuittant(false);
};
```

- [ ] **Step 5 : Ajouter la section UI dans le JSX**

Après la section "Code d'invitation" (ajoutée par Plan 1), ajouter la section "Rejoindre / Quitter" :

```jsx
{/* Rejoindre un maître / Quitter le groupe */}
{role !== "admin" && (
  <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
    {profil?.master_id ? (
      // Déjà rattaché — afficher le maître et proposer de quitter
      <>
        <div style={sectionTitle}>Compte maître</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#122131" }}>
            {nomMaitre ?? "Chargement..."}
          </div>
          <button
            type="button"
            onClick={quitterGroupe}
            disabled={quittant}
            style={{ padding: "8px 14px", border: "1.5px solid #FECACA", borderRadius: 8, background: "#FEF2F2", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#DC2626" }}>
            {quittant ? "..." : "Quitter le groupe"}
          </button>
        </div>
      </>
    ) : (
      // Pas encore rattaché — formulaire de rejoindre
      <>
        <div style={sectionTitle}>Rejoindre un groupe</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input
            type="text"
            value={codeInvit}
            onChange={e => { setCodeInvit(e.target.value.toUpperCase()); setMsgInvit(""); }}
            placeholder="Code d'invitation (ex: A3F7K2M9)"
            maxLength={8}
            style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}
          />
          <button
            type="button"
            onClick={rejoindreGroupe}
            disabled={rejoignant || codeInvit.length < 8}
            style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: codeInvit.length < 8 ? "#F3F4F6" : "#122131", color: codeInvit.length < 8 ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: codeInvit.length < 8 ? "not-allowed" : "pointer", flexShrink: 0 }}>
            {rejoignant ? "..." : "Rejoindre"}
          </button>
        </div>
        {msgInvit === "ok" && (
          <div style={{ fontSize: 12, color: "#059669", marginTop: 8 }}>✅ Rattachement effectué avec succès.</div>
        )}
        {msgInvit && msgInvit !== "ok" && (
          <div style={{ fontSize: 12, color: "#DC2626", marginTop: 8 }}>{msgInvit}</div>
        )}
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>
          Entrez le code d'invitation d'un autre compte pour rejoindre son groupe.
        </div>
      </>
    )}
  </div>
)}
```

Note : `sectionTitle` est le style déjà défini dans PageMonCompte pour les titres de section. Vérifier le nom exact dans le fichier et l'utiliser.

- [ ] **Step 6 : Vérifier (npm start)**

```bash
npm start
```
Note : la section "Rejoindre un groupe" est cachée pour le rôle admin (`role !== "admin"`). Tester avec un compte dessinateur ou client.
- Connecter `dessinateur1@test.com` → Mon compte : vérifier que la section invite_code + rejoindre apparaissent
- Tester avec un code invalide → message d'erreur affiché
- Tester avec un code valide d'un autre compte de même rôle → rattachement effectué, nom du maître affiché + bouton "Quitter le groupe"

- [ ] **Step 7 : Commit**

```bash
git add src/components/PageMonCompte.js
git commit -m "feat: PageMonCompte — rejoindre/quitter groupe via invite_code"
```

---

## Task 2 : GestionCompteDessinateur.js — nouveau composant

**Context:**
Ce composant a deux sous-onglets :
- **Sous-comptes** : liste des sous-dessinateurs (profiles WHERE master_id = profil.id), pour chacun les clients assignés via `client_dessinateurs`, bouton "Assigner un user"
- **Notes clients** : liste des clients dédupliqués depuis les commandes du dessinateur, textarea éditable, upsert dans `notes_clients`

**Files:**
- Create: `src/components/GestionCompteDessinateur.js`

- [ ] **Step 1 : Créer le composant avec la structure de base**

```jsx
import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function GestionCompteDessinateur({ profil, commandes }) {
  const [sousOnglet, setSousOnglet] = useState("sous-comptes");
  const nomDessinateur = `${profil.prenom} ${profil.nom}`;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 24px 0" }}>Gestion de compte</h1>

      {/* Sous-onglets */}
      <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 10, padding: 4, marginBottom: 24, width: "fit-content" }}>
        {[
          { id: "sous-comptes", label: "Sous-comptes" },
          { id: "notes",        label: "Notes clients" },
        ].map(t => (
          <button key={t.id} onClick={() => setSousOnglet(t.id)}
            style={{ padding: "7px 16px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: sousOnglet === t.id ? "#fff" : "transparent", color: sousOnglet === t.id ? "#122131" : "#64748B", boxShadow: sousOnglet === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {sousOnglet === "sous-comptes" && <SousComptesTab profil={profil} />}
      {sousOnglet === "notes" && <NotesClientsTab profil={profil} nomDessinateur={nomDessinateur} commandes={commandes} />}
    </div>
  );
}
```

- [ ] **Step 2 : Implémenter `SousComptesTab`**

```jsx
function SousComptesTab({ profil }) {
  const [sousDessinateurs, setSousDessinateurs] = useState([]);
  const [clientsDisponibles, setClientsDisponibles] = useState([]);
  const [assignments, setAssignments] = useState({}); // { dessinateur_id: [client_id, ...] }
  const [assignant, setAssignant] = useState(null); // dessinateur_id en cours d'assignation
  const [loading, setLoading] = useState(true);

  useEffect(() => { charger(); }, []); // eslint-disable-line

  const charger = async () => {
    setLoading(true);
    // Sous-dessinateurs
    const { data: sub } = await supabase
      .from("profiles")
      .select("id, prenom, nom, statut")
      .eq("master_id", profil.id);

    // Clients actifs
    const { data: clients } = await supabase
      .from("profiles")
      .select("id, prenom, nom")
      .eq("role", "client")
      .eq("statut", "actif");

    // Assignments existants
    const { data: cd } = await supabase
      .from("client_dessinateurs")
      .select("client_id, dessinateur_id")
      .in("dessinateur_id", (sub || []).map(s => s.id));

    const map = {};
    (cd || []).forEach(row => {
      if (!map[row.dessinateur_id]) map[row.dessinateur_id] = [];
      map[row.dessinateur_id].push(row.client_id);
    });

    setSousDessinateurs(sub || []);
    setClientsDisponibles(clients || []);
    setAssignments(map);
    setLoading(false);
  };

  const assigner = async (dessinateurId, clientId) => {
    setAssignant(dessinateurId);
    await supabase.from("client_dessinateurs").insert([{ dessinateur_id: dessinateurId, client_id: clientId }]);
    await charger();
    setAssignant(null);
  };

  if (loading) return <div style={{ color: "#9CA3AF", fontSize: 13, padding: 24 }}>Chargement...</div>;

  if (sousDessinateurs.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#122131", marginBottom: 4 }}>Aucun sous-compte</div>
        <div style={{ fontSize: 12, color: "#94A3B8" }}>Partagez votre code d'invitation pour avoir des sous-comptes.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sousDessinateurs.map(sd => {
        const clientsAssignes = (assignments[sd.id] || [])
          .map(cid => clientsDisponibles.find(c => c.id === cid))
          .filter(Boolean);
        const clientsNonAssignes = clientsDisponibles.filter(c => !(assignments[sd.id] || []).includes(c.id));

        return (
          <div key={sd.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#122131" }}>{sd.prenom} {sd.nom}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {clientsAssignes.length} client{clientsAssignes.length > 1 ? "s" : ""} assigné{clientsAssignes.length > 1 ? "s" : ""}
                </div>
              </div>
              {clientsNonAssignes.length > 0 && (
                <select
                  value=""
                  onChange={e => e.target.value && assigner(sd.id, e.target.value)}
                  disabled={assignant === sd.id}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, color: "#374151", background: "#F9FAFB", cursor: "pointer" }}>
                  <option value="">+ Assigner un client</option>
                  {clientsNonAssignes.map(c => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                  ))}
                </select>
              )}
            </div>
            {clientsAssignes.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {clientsAssignes.map(c => (
                  <span key={c.id} style={{ fontSize: 12, background: "#FFF3ED", color: "#B84E10", borderRadius: 6, padding: "3px 10px", fontWeight: 500 }}>
                    {c.prenom} {c.nom}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3 : Implémenter `NotesClientsTab`**

```jsx
function NotesClientsTab({ profil, nomDessinateur, commandes }) {
  const [notes, setNotes]       = useState({}); // { client_nom: note_text }
  const [saving, setSaving]     = useState(null); // client_nom en cours de sauvegarde
  const [clientActif, setClientActif] = useState(null);

  // Clients dédupliqués depuis les commandes du dessinateur
  const clients = [...new Set(
    commandes
      .filter(c => c.dessinateur === nomDessinateur)
      .map(c => c.client)
      .filter(Boolean)
  )].sort();

  useEffect(() => {
    if (clients.length === 0) return;
    supabase
      .from("notes_clients")
      .select("client_nom, note")
      .eq("dessinateur_id", profil.id)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(row => { map[row.client_nom] = row.note; });
        setNotes(map);
      });
  }, []); // eslint-disable-line

  const sauvegarder = async (clientNom) => {
    setSaving(clientNom);
    await supabase
      .from("notes_clients")
      .upsert(
        { dessinateur_id: profil.id, client_nom: clientNom, note: notes[clientNom] || "", updated_at: new Date().toISOString() },
        { onConflict: "dessinateur_id,client_nom" }
      );
    setSaving(null);
  };

  if (clients.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#122131", marginBottom: 4 }}>Aucun client</div>
        <div style={{ fontSize: 12, color: "#94A3B8" }}>Les clients de vos commandes apparaîtront ici.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, minHeight: 300 }}>
      {/* Liste clients */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        {clients.map(nom => (
          <button key={nom} onClick={() => setClientActif(nom)}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: "1px solid #F3F4F6", fontSize: 13, fontWeight: clientActif === nom ? 600 : 400, background: clientActif === nom ? "#EEF3F8" : "transparent", color: clientActif === nom ? "#122131" : "#374151", cursor: "pointer" }}>
            {nom}
            {notes[nom] && <span style={{ fontSize: 10, color: "#059669", marginLeft: 6 }}>●</span>}
          </button>
        ))}
      </div>

      {/* Zone note */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
        {!clientActif ? (
          <div style={{ color: "#9CA3AF", fontSize: 13, padding: 16 }}>Sélectionnez un client pour ajouter une note.</div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#122131", marginBottom: 12 }}>{clientActif}</div>
            <textarea
              value={notes[clientActif] || ""}
              onChange={e => setNotes(prev => ({ ...prev, [clientActif]: e.target.value }))}
              rows={8}
              placeholder="Notes internes sur ce client (jamais visible par le client)..."
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={() => sauvegarder(clientActif)} disabled={saving === clientActif}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#122131", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {saving === clientActif ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Vérifier (npm start — en tant que dessinateur1@test.com)**

```bash
npm start
```

Note : GestionCompteDessinateur n'est pas encore accessible depuis la sidebar (Task 3). Pour tester à ce stade, importer temporairement dans App.js ou utiliser React DevTools.

- [ ] **Step 5 : Commit**

```bash
git add src/components/GestionCompteDessinateur.js
git commit -m "feat: add GestionCompteDessinateur component (sous-comptes + notes clients)"
```

---

## Task 3 : App.js + import — onglet Gestion de compte pour dessinateurs

**Files:**
- Modify: `src/App.js` (lignes ~1-21, ~408-413, ~465-495)

- [ ] **Step 1 : Ajouter l'import de GestionCompteDessinateur dans App.js**

Après l'import de `PageMonCompte` (~ligne 18), ajouter :

```js
import GestionCompteDessinateur from "./components/GestionCompteDessinateur";
```

- [ ] **Step 2 : Lire App.js lignes ~403-415 pour voir le `roleNav` actuel, puis le mettre à jour**

Lire les lignes ~403-415 pour voir l'état exact du `roleNav` (il peut avoir été modifié par Plan 1 ou pas encore). La version cible est :

```js
const roleNav = [
  { id: "commandes",      label: isDessinateur ? "Mes missions" : "Commandes", icon: "📋" },
  ...(isDessinateur ? [{ id: "gestion-compte", label: "Gestion de compte", icon: "📁" }] : []),
  { id: "reglages",       label: "Réglages",   icon: "⚙️" },
  { id: "mon-compte",     label: "Mon compte", icon: "👤" },
];
```

- [ ] **Step 3 : Ajouter le rendu conditionnel de GestionCompteDessinateur**

Dans la zone contenu du layout dessinateur/client (~lignes 465-505), après `{vue === "mon-compte" && (...)}`, ajouter :

```jsx
{vue === "gestion-compte" && isDessinateur && (
  <GestionCompteDessinateur profil={profil} commandes={commandes} />
)}
```

- [ ] **Step 4 : Vérifier (npm start)**

```bash
npm start
```
- Connecter `dessinateur1@test.com` → vérifier l'onglet "Gestion de compte" dans la sidebar
- Cliquer → sous-onglet "Sous-comptes" : liste vide si pas de sous-comptes
- Cliquer → sous-onglet "Notes clients" : liste des clients du dessinateur
- Saisir une note, sauvegarder → rafraîchir, vérifier que la note est persistée
- Vérifier que l'onglet n'apparaît PAS dans la sidebar client

- [ ] **Step 5 : Commit**

```bash
git add src/App.js
git commit -m "feat: add Gestion de compte tab for dessinateurs in sidebar"
```

---

## Task 4 : Push

- [ ] **Push vers main**

```bash
git push
```
