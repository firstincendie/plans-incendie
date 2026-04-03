# Commande /note — Message privé dans le chat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une commande `/note` dans le chat qui crée un message privé visible uniquement par l'auteur, stocké dans la table `messages` avec une colonne `visible_par text[]`.

**Architecture:** La colonne `visible_par` (nullable) distingue messages publics (`NULL`) de notes privées (`[auteurNom]`). Le parsing `/note` se fait dans `Messagerie.js` avant d'appeler `onEnvoyer`. La confidentialité est assurée côté client : filtre Realtime (`visible_par=is.null`), filtre d'affichage, et exclusion du marquage "Lu". Aucune notification n'est envoyée pour les notes privées.

**Tech Stack:** React, Supabase (PostgreSQL + Realtime + Edge Functions), pas de framework de test établi — vérification manuelle dans le navigateur.

> ⚠️ **Ordre important :** Les Tasks 2 et 3 (mise à jour des vues parent) doivent être faites **avant** Task 4 (parsing dans Messagerie.js). Sinon, entre Task 4 et Tasks 2-3, un `/note` serait envoyé comme message public visible par l'autre partie.

---

## Fichiers modifiés

| Fichier | Rôle du changement |
|---------|-------------------|
| Supabase (dashboard ou MCP) | Migration colonne `visible_par text[]` + REPLICA IDENTITY FULL |
| `src/components/VueDessinateur.js` | Wrapper `onEnvoyer`, `envoyerMessage`, Realtime INSERT, `marquerMessagesLus` |
| `src/components/VueUtilisateur.js` | Idem VueDessinateur |
| `src/components/Messagerie.js` | Parsing `/note`, filtre affichage, bulle visuelle privée |

---

## Task 1 : Migration base de données

**Files:**
- Modify: Supabase dashboard ou MCP `apply_migration`

- [ ] **Step 1 : Appliquer la migration**

Exécuter le SQL suivant sur la base Supabase (via le dashboard SQL Editor ou l'outil MCP `apply_migration`) :

```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS visible_par text[];
ALTER TABLE messages REPLICA IDENTITY FULL;
```

`REPLICA IDENTITY FULL` est requis pour que le filtre Realtime `visible_par=is.null` fonctionne correctement sur la nouvelle colonne.

- [ ] **Step 2 : Vérifier**

Dans le dashboard Supabase → Table Editor → `messages` : confirmer que la colonne `visible_par` de type `text[]` est présente, nullable, sans valeur par défaut.

---

## Task 2 : VueDessinateur.js — envoyerMessage + onEnvoyer wrapper

**Files:**
- Modify: `src/components/VueDessinateur.js:179-196` (envoyerMessage)
- Modify: `src/components/VueDessinateur.js:473-476` (onEnvoyer lambda)

- [ ] **Step 1 : Mettre à jour la signature de `envoyerMessage`**

Remplacer la fonction `envoyerMessage` (lignes 179–196) par :

```js
async function envoyerMessage(commandeId, auteur, texte, fichiers = [], options = {}) {
  const { data, error } = await supabase.from("messages").insert([{
    commande_id: commandeId, auteur, texte: texte || "", fichiers,
    date: formatDateMsg(),
    visible_par: options.visible_par ?? null,
  }]).select().single();
  if (!error && data) {
    setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, messages: [...c.messages, data] } : c));
    if (selected?.id === commandeId) setSelected(prev => ({ ...prev, messages: [...prev.messages, data] }));
    // Pas de notification pour les notes privées
    if (!options.visible_par) {
      supabase.functions.invoke("notify-message", {
        body: {
          commande_id: commandeId,
          auteur_id: session.user.id,
          auteur_nom: auteurNom,
          nom_plan: commandes.find(c => c.id === commandeId)?.nom_plan ?? "",
        },
      });
    }
  }
}
```

- [ ] **Step 2 : Mettre à jour le wrapper `onEnvoyer`**

Remplacer les lignes 473–476 :

```js
onEnvoyer={async (texte, fichiers, options = {}) => {
  if (!texte.trim() && !fichiers?.length) return;
  await envoyerMessage(selected.id, auteurNom, texte, fichiers, options);
}}
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/VueDessinateur.js
git commit -m "feat: VueDessinateur — envoyerMessage supporte visible_par + pas de notify pour /note"
```

---

## Task 3 : VueUtilisateur.js — envoyerMessage + onEnvoyer wrapper

**Files:**
- Modify: `src/components/VueUtilisateur.js:194-211` (envoyerMessage)
- Modify: `src/components/VueUtilisateur.js:630-633` (onEnvoyer lambda)

- [ ] **Step 1 : Mettre à jour la signature de `envoyerMessage`**

Remplacer la fonction `envoyerMessage` (lignes 194–211) par :

```js
async function envoyerMessage(commandeId, auteur, texte, fichiers = [], options = {}) {
  const { data, error } = await supabase.from("messages").insert([{
    commande_id: commandeId, auteur, texte: texte || "", fichiers,
    date: formatDateMsg(),
    visible_par: options.visible_par ?? null,
  }]).select().single();
  if (!error && data) {
    setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, messages: [...c.messages, data] } : c));
    if (selected?.id === commandeId) setSelected(prev => ({ ...prev, messages: [...prev.messages, data] }));
    // Pas de notification pour les notes privées
    if (!options.visible_par) {
      supabase.functions.invoke("notify-message", {
        body: {
          commande_id: commandeId,
          auteur_id: session.user.id,
          auteur_nom: auteurNom,
          nom_plan: commandes.find(c => c.id === commandeId)?.nom_plan ?? "",
        },
      });
    }
  }
}
```

- [ ] **Step 2 : Mettre à jour le wrapper `onEnvoyer`**

Remplacer les lignes 630–633 :

```js
onEnvoyer={async (texte, fichiers, options = {}) => {
  if (!texte.trim() && !fichiers?.length) return;
  await envoyerMessage(selected.id, auteurNom, texte, fichiers, options);
}}
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/VueUtilisateur.js
git commit -m "feat: VueUtilisateur — envoyerMessage supporte visible_par + pas de notify pour /note"
```

---

## Task 4 : Messagerie.js — parsing `/note` et envoi

**Files:**
- Modify: `src/components/Messagerie.js:19-42`

> ℹ️ Tasks 2 et 3 doivent être complétées avant cette task pour éviter qu'un `/note` soit envoyé comme message public.

- [ ] **Step 1 : Modifier `handleEnvoyer` pour détecter `/note`**

Remplacer la fonction `handleEnvoyer` (lignes 19–42) par :

```js
async function handleEnvoyer() {
  if (!msgInput.trim() && fichierMsg.length === 0) return;

  // Filtre regex — sauf pour Simon (admin)
  if (auteurActif !== "Simon") {
    const detection = analyserMessage(msgInput);
    if (detection) {
      setAlerte(`⛔ Message bloqué : ${detection} détecté(e). Le partage de coordonnées personnelles est interdit sur cette plateforme.`);
      setTimeout(() => setAlerte(null), 5000);
      await supabase.from("alertes").insert([{
        commande_id: selected.id,
        auteur: auteurActif,
        message_bloque: msgInput,
        type_detection: detection,
      }]);
      return;
    }
  }

  setAlerte(null);

  // Détection commande /note
  if (msgInput.trimStart().startsWith("/note ") && auteurActif) {
    const texteReel = msgInput.trimStart().slice("/note ".length).trim();
    if (!texteReel && fichierMsg.length === 0) return;
    await onEnvoyer(texteReel, fichierMsg, { visible_par: [auteurActif] });
  } else {
    await onEnvoyer(msgInput, fichierMsg, {});
  }

  setMsgInput("");
  setFichierMsg([]);
}
```

- [ ] **Step 2 : Tester manuellement**

Depuis le dessinateur, taper `/note test` et envoyer. Vérifier dans Supabase dashboard → Table `messages` que la ligne insérée a `visible_par = ["<nom>"]`. Vérifier qu'aucune notification push n'est reçue par l'autre partie.

- [ ] **Step 3 : Commit**

```bash
git add src/components/Messagerie.js
git commit -m "feat: parsing commande /note dans handleEnvoyer"
```

---

## Task 5 : Filtre Realtime INSERT (les deux vues)

**Files:**
- Modify: `src/components/VueDessinateur.js:47-60` (subscription INSERT)
- Modify: `src/components/VueUtilisateur.js:70-84` (subscription INSERT)

> ℹ️ Ce filtre exclut les notes privées du broadcast Realtime. Note : si une commande `/mp` est ajoutée à l'avenir, ce filtre devra être revu pour inclure les messages destinés à l'utilisateur courant.

- [ ] **Step 1 : VueDessinateur — ajouter le filtre Realtime**

Dans le bloc `.on("postgres_changes", { event: "INSERT", ... })` (ligne ~47 de VueDessinateur.js), ajouter `filter: "visible_par=is.null"` :

```js
.on("postgres_changes", {
  event: "INSERT",
  schema: "public",
  table: "messages",
  filter: "visible_par=is.null",
}, (payload) => {
  const msg = payload.new;
  setCommandes(prev => prev.map(c => {
    if (c.id !== msg.commande_id) return c;
    if (msg.auteur === auteurNom) return c;
    if (c.messages.some(m => m.id === msg.id)) return c;
    return { ...c, messages: [...c.messages, msg] };
  }));
  setSelected(prev => {
    if (!prev || prev.id !== msg.commande_id) return prev;
    if (msg.auteur === auteurNom) return prev;
    if (prev.messages.some(m => m.id === msg.id)) return prev;
    return { ...prev, messages: [...prev.messages, msg] };
  });
})
```

- [ ] **Step 2 : VueUtilisateur — même modification**

Même changement dans VueUtilisateur.js (ligne ~70) : ajouter `filter: "visible_par=is.null"` dans le bloc INSERT (garder le corps du handler identique à l'existant).

- [ ] **Step 3 : Tester manuellement**

Ouvrir deux onglets : un en tant que dessinateur, un en tant qu'utilisateur. Depuis le dessinateur, envoyer `/note test secret`. Vérifier que l'onglet utilisateur **ne reçoit pas** le message en temps réel. Envoyer ensuite un message public et vérifier que l'onglet utilisateur le reçoit normalement.

- [ ] **Step 4 : Commit**

```bash
git add src/components/VueDessinateur.js src/components/VueUtilisateur.js
git commit -m "feat: filtre Realtime INSERT visible_par=is.null (notes privées hors broadcast)"
```

---

## Task 6 : Exclure les notes privées du marquage "Lu"

**Files:**
- Modify: `src/components/VueDessinateur.js:198-212` (marquerMessagesLus)
- Modify: `src/components/VueUtilisateur.js:297-311` (marquerMessagesLus)

- [ ] **Step 1 : VueDessinateur — exclure `visible_par` non null**

Dans `marquerMessagesLus` (lignes 198–212), modifier le filtre `nonLus` :

```js
const nonLus = commande.messages.filter(m =>
  m.auteur !== auteurNom &&
  !m.visible_par &&
  !(m.lu_par || []).includes(auteurNom)
);
```

- [ ] **Step 2 : VueUtilisateur — même modification**

Même changement dans `marquerMessagesLus` de VueUtilisateur.js (lignes 297–311).

- [ ] **Step 3 : Commit**

```bash
git add src/components/VueDessinateur.js src/components/VueUtilisateur.js
git commit -m "fix: exclure les notes privées du marquage lu"
```

---

## Task 7 : Messagerie.js — filtre d'affichage + bulle visuelle

**Files:**
- Modify: `src/components/Messagerie.js:44-87`

- [ ] **Step 1 : Ajouter le filtre d'affichage**

Remplacer les lignes 44–46 (calcul de `messagesAfficher`) :

```js
const messagesAfficher = (instructions
  ? selected.messages.filter((m, i) => i !== 0 || m.texte !== instructions)
  : selected.messages
).filter(m => !m.visible_par || m.visible_par.includes(auteurActif));
```

- [ ] **Step 2 : Ajouter le rendu visuel de la bulle privée**

Dans la boucle de rendu des messages (lignes 64–87), remplacer le `return (...)` par :

```js
const moi = m.auteur === auteurActif;
const estNotePrivee = !!(m.visible_par && m.visible_par.includes(auteurActif));
return (
  <div key={i} style={{ alignSelf: moi ? "flex-end" : "flex-start", maxWidth: "80%" }}>
    {estNotePrivee && (
      <div style={{ fontSize: 10, color: "#92400E", textAlign: "right", marginBottom: 2, paddingInline: 2 }}>
        🔒 Note privée
      </div>
    )}
    <div style={{
      background: estNotePrivee ? "#FFFBEB" : moi ? "#fff" : "#EFF6FF",
      border: estNotePrivee ? "1.5px dashed #FCD34D" : `1px solid ${moi ? "#E5E7EB" : "#BFDBFE"}`,
      borderRadius: 8,
      padding: "10px 12px",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: moi ? "#374151" : "#1E40AF" }}>{m.auteur}</div>
      <div style={{ fontSize: 12, color: "#374151", marginTop: 4, whiteSpace: "pre-wrap" }}>{m.texte}</div>
      {m.fichiers && m.fichiers.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {m.fichiers.map((f, j) => (
            <button key={j} onClick={() => setVisuFichier(f)}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, border: "1px solid #E5E7EB", background: "#fff", fontSize: 11, color: "#374151", cursor: "pointer" }}>
              📎 {f.nom} <span style={{ fontSize: 10, color: "#9CA3AF" }}>👁</span>
            </button>
          ))}
        </div>
      )}
    </div>
    <div style={{
      fontSize: 10,
      color: (!estNotePrivee && (m.lu_par || []).length > 0 && moi) ? "#2563EB" : "#9CA3AF",
      textAlign: moi ? "right" : "left",
      marginTop: 3,
      paddingInline: 2,
    }}>
      {formatDateBulle(m.created_at)}{!estNotePrivee && moi ? ` ${(m.lu_par || []).length > 0 ? "✓✓ Lu" : "✓✓"}` : ""}
    </div>
  </div>
);
```

- [ ] **Step 3 : Tester manuellement (scénario complet)**

1. Ouvrir deux onglets : dessinateur + utilisateur, même commande
2. Depuis le dessinateur, envoyer `/note ceci est secret`
3. Vérifier : dans l'onglet dessinateur, la bulle apparaît avec fond jaune, bordure pointillée, label "🔒 Note privée", timestamp normal (ex. `02/04 à 10:30`), sans indicateur "✓✓"
4. Vérifier : dans l'onglet utilisateur, **aucune bulle n'apparaît** et **aucune notification reçue**
5. Rafraîchir la page dessinateur : la note réapparaît correctement
6. Envoyer un message public normal : les deux onglets le reçoivent normalement avec "✓✓ Lu" fonctionnel

- [ ] **Step 4 : Commit**

```bash
git add src/components/Messagerie.js
git commit -m "feat: affichage bulle note privée (/note) — fond jaune, bordure pointillée, icône cadenas"
```

---

## Récapitulatif des commits

```
feat: VueDessinateur — envoyerMessage supporte visible_par + pas de notify pour /note
feat: VueUtilisateur — envoyerMessage supporte visible_par + pas de notify pour /note
feat: parsing commande /note dans handleEnvoyer
feat: filtre Realtime INSERT visible_par=is.null (notes privées hors broadcast)
fix: exclure les notes privées du marquage lu
feat: affichage bulle note privée (/note) — fond jaune, bordure pointillée, icône cadenas
```
