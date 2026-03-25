# Detail Commande Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le panneau de détail inline par une popup modale responsive (2 colonnes desktop, onglets mobile) avec sections enrichies et archivage des commandes.

**Architecture:** Nouveau composant `DetailCommandeModal` partagé entre VueUtilisateur et VueDessinateur. Le CSS responsive est ajouté dans `index.css`. Les deux vues gardent leur logique métier propre et passent les bonnes props au composant.

**Tech Stack:** React (inline styles + index.css pour media queries), Supabase

---

## File Map

| Fichier | Action | Rôle |
|---------|--------|------|
| `src/index.css` | Modifier | Ajouter classes CSS responsive pour la modal |
| `src/helpers.js` | Modifier | Ajouter `joursRestants(dateDelai)` |
| `src/components/DetailCommandeModal.js` | Créer | Composant modal responsive (desktop 2-col + mobile tabs) |
| `src/components/VueUtilisateur.js` | Modifier | Utiliser DetailCommandeModal, archivage, nom demandeur |
| `src/components/VueDessinateur.js` | Modifier | Utiliser DetailCommandeModal, nom demandeur |

---

## Task 1 : Helper `joursRestants` + CSS responsive

**Files:**
- Modify: `src/helpers.js`
- Modify: `src/index.css`

- [ ] **Lire `src/helpers.js`** pour voir les helpers existants

- [ ] **Ajouter `joursRestants` dans `src/helpers.js`**

```js
// Retourne le nombre de jours entre aujourd'hui et une date ISO string.
// Négatif = dépassé. Null si pas de date.
export function joursRestants(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}
```

- [ ] **Ajouter les classes CSS responsive dans `src/index.css`**

```css
/* ===== Modal DetailCommande ===== */
.detail-modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 500;
  align-items: center;
  justify-content: center;
}
.detail-modal-overlay.open {
  display: flex;
}
.detail-modal-box {
  background: #fff;
  width: 90%;
  height: 90vh;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.3);
}
.detail-desktop-body {
  display: grid;
  grid-template-columns: 70% 30%;
  flex: 1;
  overflow: hidden;
}
.detail-desktop-left {
  padding: 24px;
  border-right: 2px solid #E5E7EB;
  overflow-y: auto;
}
.detail-desktop-chat {
  display: flex;
  flex-direction: column;
  background: #F9FAFB;
  overflow: hidden;
}
.detail-mobile-tabs { display: none; }
.detail-mobile-body {
  display: none;
  flex: 1;
  overflow: hidden;
  flex-direction: column;
}
.detail-tab-pane {
  display: none;
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.detail-tab-pane.active { display: block; }
.detail-chat-pane {
  display: none;
  flex: 1;
  overflow: hidden;
  flex-direction: column;
}
.detail-chat-pane.active { display: flex; }

@media (max-width: 768px) {
  .detail-modal-overlay.open {
    align-items: stretch;
    justify-content: stretch;
  }
  .detail-modal-box {
    width: 100%;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
  }
  .detail-desktop-body { display: none; }
  .detail-mobile-tabs {
    display: flex;
    border-bottom: 2px solid #E5E7EB;
    background: #fff;
    flex-shrink: 0;
  }
  .detail-mobile-body { display: flex; }
}
```

- [ ] **Commit**

```bash
git add src/helpers.js src/index.css
git commit -m "feat: add joursRestants helper and responsive modal CSS"
```

---

## Task 2 : Composant `DetailCommandeModal`

**Files:**
- Create: `src/components/DetailCommandeModal.js`

Ce composant reçoit toutes les données et callbacks, gère le layout desktop/mobile.

**Props :**
- `selected` — commande sélectionnée (ou null)
- `versionsSelected` — tableau des versions
- `onClose` — fermer la modal
- `onArchiver` — fonction d'archivage (null = pas de bouton)
- `showContacts` — boolean (true pour utilisateur, false pour dessinateur)
- `actionButtons` — JSX des boutons d'action (Commencer, Valider, etc.) ou null
- `msgInput` / `setMsgInput` / `onEnvoyer` / `auteurNom` — pour la messagerie

- [ ] **Créer `src/components/DetailCommandeModal.js`**

```jsx
import { useState } from "react";
import { formatDateCourt } from "../helpers";
import { joursRestants } from "../helpers";
import Badge from "./Badge";
import BlocAdresse from "./BlocAdresse";
import Messagerie from "./Messagerie";

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #E5E7EB" }}>
      {children}
    </div>
  );
}

function Accordeon({ label, children, couleur = "gris" }) {
  const [ouvert, setOuvert] = useState(false);
  const estBleu = couleur === "bleu";
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setOuvert(v => !v)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${estBleu ? "#BFDBFE" : "#D1D5DB"}`, borderRadius: ouvert ? "8px 8px 0 0" : 8, padding: "10px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", background: estBleu ? "#EFF6FF" : "#F3F4F6", color: estBleu ? "#1E40AF" : "#374151" }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 11 }}>{ouvert ? "▼" : "▶"}</span>
      </button>
      {ouvert && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, border: `1px solid ${estBleu ? "#BFDBFE" : "#D1D5DB"}`, borderTop: "none", borderRadius: "0 0 8px 8px", background: estBleu ? "#F0F9FF" : "#fff" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function LigneFichier({ fichier }) {
  const isImg = fichier.type && fichier.type.startsWith("image/");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 6, background: "#fff" }}>
      <span style={{ fontSize: 16 }}>{isImg ? "🖼️" : "📄"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fichier.nom}</div>
        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{fichier.taille}</div>
      </div>
      <a href={fichier.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563EB", fontWeight: 500, textDecoration: "none", flexShrink: 0 }}>Ouvrir</a>
    </div>
  );
}

function InfosContent({ selected, versionsSelected, showContacts }) {
  const jours = joursRestants(selected.delai);
  const couleurDelai = jours !== null && jours <= 3 ? "#DC2626" : "#78350F";
  const bgDelai = jours !== null && jours <= 3 ? "#FEF2F2" : "#FEF3C7";
  const borderDelai = jours !== null && jours <= 3 ? "#FECACA" : "#FDE68A";

  // Fichiers de toutes les versions
  const fichiersVersions = versionsSelected.flatMap(v =>
    (v.fichiers || []).map(f => ({ ...f, version: v.numero }))
  );

  return (
    <div>
      {/* Informations */}
      <SectionTitle>Informations</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#F3F4F6", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Créé le</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{formatDateCourt(selected.created_at)}</div>
        </div>
        <div style={{ background: bgDelai, borderRadius: 8, padding: "10px 12px", border: `1px solid ${borderDelai}` }}>
          <div style={{ fontSize: 10, color: couleurDelai, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Délai</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: couleurDelai }}>{selected.delai ? formatDateCourt(selected.delai) : "—"}</div>
          {jours !== null && (
            <div style={{ fontSize: 11, color: couleurDelai, marginTop: 2, fontWeight: 600 }}>
              {jours === 0 ? "Aujourd'hui" : jours < 0 ? `${Math.abs(jours)}j dépassé` : `${jours} jour${jours > 1 ? "s" : ""} restant${jours > 1 ? "s" : ""}`}
            </div>
          )}
        </div>
        <div style={{ background: "#F3F4F6", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Nb. plans</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{selected.plans?.length ?? 0}</div>
        </div>
      </div>

      {/* Adresse + Contacts */}
      <div style={{ display: "grid", gridTemplateColumns: showContacts ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 24 }}>
        <div>
          <SectionTitle>Adresse</SectionTitle>
          <BlocAdresse commande={selected} copiable={showContacts} />
        </div>
        {showContacts && (
          <div>
            <SectionTitle>Contacts</SectionTitle>
            <div style={{ background: "#F9FAFB", border: "1px solid #D1D5DB", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {selected.client_prenom || selected.client_nom ? (
                <div>
                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Nom</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{`${selected.client_prenom ?? ""} ${selected.client_nom ?? ""}`.trim()}</div>
                </div>
              ) : null}
              {selected.client_email && (
                <div>
                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Email</div>
                  <a href={`mailto:${selected.client_email}`} style={{ fontSize: 13, color: "#2563EB", textDecoration: "none" }}>{selected.client_email}</a>
                </div>
              )}
              {selected.client_telephone && (
                <div>
                  <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Téléphone</div>
                  <a href={`tel:${selected.client_telephone}`} style={{ fontSize: 13, color: "#2563EB", textDecoration: "none" }}>{selected.client_telephone}</a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tableau des plans */}
      {selected.plans?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Plans à réaliser</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #D1D5DB", borderRadius: 8, overflow: "hidden", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#E5E7EB" }}>
                {["N°", "Type de plan", "Orientation", "Format"].map((h, i) => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151", borderBottom: "2px solid #D1D5DB", borderRight: i < 3 ? "1px solid #D1D5DB" : "none" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.plans.map((p, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? "#F9FAFB" : "#fff", borderBottom: i < selected.plans.length - 1 ? "1px solid #E5E7EB" : "none" }}>
                  <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", textAlign: "center", color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.type || "—"}</td>
                  <td style={{ padding: "9px 12px", borderRight: "1px solid #E5E7EB", color: "#111827" }}>{p.orientation || "—"}</td>
                  <td style={{ padding: "9px 12px", color: "#111827" }}>{p.format || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fichiers du plan */}
      {selected.fichiersPlan?.length > 0 && (
        <Accordeon label={`📄 Fichiers du plan (${selected.fichiersPlan.length})`}>
          {selected.fichiersPlan.map((f, i) => <LigneFichier key={i} fichier={f} />)}
        </Accordeon>
      )}

      {/* Plans du dessinateur */}
      {fichiersVersions.length > 0 && (
        <Accordeon label={`📐 Plans partagés par le dessinateur (${fichiersVersions.length})`} couleur="bleu">
          {fichiersVersions.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #BFDBFE", borderRadius: 6, background: "#fff" }}>
              <span style={{ fontSize: 16 }}>📐</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nom}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>Version {f.version}</div>
              </div>
              <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563EB", fontWeight: 500, textDecoration: "none", flexShrink: 0 }}>Ouvrir</a>
            </div>
          ))}
        </Accordeon>
      )}
    </div>
  );
}

export default function DetailCommandeModal({
  selected, versionsSelected, onClose,
  onArchiver, showContacts,
  actionButtons,
  msgInput, setMsgInput, onEnvoyer, auteurNom,
}) {
  const [mobTab, setMobTab] = useState("infos");
  if (!selected) return null;

  // Nom du demandeur (sous-titre header)
  const nomDemandeur = `${selected.client_prenom ?? ""} ${selected.client_nom ?? ""}`.trim() ||
    selected.utilisateur_prenom ? `${selected.utilisateur_prenom ?? ""} ${selected.utilisateur_nom ?? ""}`.trim() : "";
  const sousTitre = nomDemandeur ? `${nomDemandeur} — ${selected.ref}` : selected.ref;

  const HEADER_BTN = {
    height: 36, padding: "0 14px", borderRadius: 6, fontSize: 13, fontWeight: 600,
    cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", whiteSpace: "nowrap",
  };

  const chatContent = (
    <>
      <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        {selected.messages?.map((m, i) => {
          const estAdmin = m.auteur !== auteurNom;
          return (
            <div key={i} style={{ background: estAdmin ? "#EFF6FF" : "#fff", border: `1px solid ${estAdmin ? "#BFDBFE" : "#E5E7EB"}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: estAdmin ? "#1E40AF" : "#374151" }}>{m.auteur}</div>
              <div style={{ fontSize: 12, color: "#374151", marginTop: 4 }}>{m.texte}</div>
              <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 5 }}>{m.date}</div>
            </div>
          );
        })}
      </div>
      {selected.statut !== "Validé" && (
        <div style={{ padding: 10, borderTop: "2px solid #E5E7EB", background: "#fff", flexShrink: 0 }}>
          <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
            onEnvoyer={onEnvoyer} auteurActif={auteurNom} allowFichier />
        </div>
      )}
    </>
  );

  return (
    <div className={`detail-modal-overlay open`} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-modal-box">

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "2px solid #E5E7EB", flexShrink: 0, background: "#fff" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#122131" }}>{selected.nom_plan}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, fontWeight: 500 }}>{sousTitre}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge statut={selected.statut} />
            {onArchiver && (
              <div style={{ position: "relative" }}>
                <DropdownMenu onArchiver={onArchiver} />
              </div>
            )}
            <button style={HEADER_BTN} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Onglets mobile */}
        <div className="detail-mobile-tabs">
          <div onClick={() => setMobTab("infos")} style={{ flex: 1, padding: 12, textAlign: "center", fontSize: 13, fontWeight: 600, cursor: "pointer", color: mobTab === "infos" ? "#122131" : "#9CA3AF", borderBottom: `3px solid ${mobTab === "infos" ? "#122131" : "transparent"}`, marginBottom: -2 }}>📋 Infos</div>
          <div onClick={() => setMobTab("chat")} style={{ flex: 1, padding: 12, textAlign: "center", fontSize: 13, fontWeight: 600, cursor: "pointer", color: mobTab === "chat" ? "#122131" : "#9CA3AF", borderBottom: `3px solid ${mobTab === "chat" ? "#122131" : "transparent"}`, marginBottom: -2 }}>
            💬 Chat {selected.messages?.length > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: 4 }}>{selected.messages.length}</span>}
          </div>
        </div>

        {/* Desktop : 2 colonnes */}
        <div className="detail-desktop-body">
          <div className="detail-desktop-left">
            <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
            {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
          </div>
          <div className="detail-desktop-chat">
            <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".8px", padding: 14, borderBottom: "1px solid #E5E7EB", background: "#fff", flexShrink: 0 }}>Messagerie</div>
            {chatContent}
          </div>
        </div>

        {/* Mobile */}
        <div className="detail-mobile-body">
          <div className={`detail-tab-pane${mobTab === "infos" ? " active" : ""}`}>
            <InfosContent selected={selected} versionsSelected={versionsSelected} showContacts={showContacts} />
            {actionButtons && <div style={{ marginTop: 16 }}>{actionButtons}</div>}
          </div>
          <div className={`detail-chat-pane${mobTab === "chat" ? " active" : ""}`}>
            {chatContent}
          </div>
        </div>

      </div>
    </div>
  );
}

function DropdownMenu({ onArchiver }) {
  const [ouvert, setOuvert] = useState(false);
  const HEADER_BTN = { height: 36, padding: "0 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", whiteSpace: "nowrap" };
  return (
    <>
      <button style={HEADER_BTN} onClick={e => { setOuvert(v => !v); e.stopPropagation(); }}>•••</button>
      {ouvert && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setOuvert(false)} />
          <div style={{ position: "absolute", right: 0, top: 42, background: "#fff", border: "1px solid #D1D5DB", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.15)", zIndex: 1000, minWidth: 190, overflow: "hidden" }}>
            <div style={{ height: 1, background: "#E5E7EB", margin: "4px 0" }} />
            <button onClick={() => { onArchiver(); setOuvert(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: "#DC2626", cursor: "pointer", border: "none", background: "none", width: "100%", textAlign: "left", fontWeight: 500 }}>
              🗃️ Archiver la commande
            </button>
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Commit**

```bash
git add src/components/DetailCommandeModal.js
git commit -m "feat: create DetailCommandeModal responsive component"
```

---

## Task 3 : Mettre à jour `VueUtilisateur.js`

**Files:**
- Modify: `src/components/VueUtilisateur.js`

**Changements :**
1. Import `DetailCommandeModal` et `joursRestants`
2. Ajouter state `showArchivees`
3. Ajouter fonction `archiver(id)`
4. Mettre à jour `actives` / `terminees` / ajouter `archivees`
5. Mettre à jour les lignes de liste (sous-titre avec nom)
6. Remplacer le bloc `{selected && ...}` inline par `<DetailCommandeModal />`
7. Ajouter section "Archivées"

- [ ] **Lire `src/components/VueUtilisateur.js`** entier pour avoir le contexte complet

- [ ] **Ajouter l'import** en haut du fichier (après les imports existants)

```js
import DetailCommandeModal from "./DetailCommandeModal";
import { joursRestants } from "../helpers";
```

- [ ] **Ajouter le state `showArchivees`** dans la liste des useState

```js
const [showArchivees, setShowArchivees] = useState(false);
```

- [ ] **Ajouter la fonction `archiver`** après `validerCommande`

```js
async function archiver(id) {
  const { error } = await supabase.from("commandes").update({ statut: "Archivé" }).eq("id", id);
  if (!error) {
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: "Archivé" } : c));
    setSelected(null);
  }
}
```

- [ ] **Mettre à jour les dérivations** (remplacer les lignes actives/terminees existantes)

```js
const actives   = cmdFiltrees.filter(c => c.statut !== "Validé" && c.statut !== "Archivé");
const terminees = cmdFiltrees.filter(c => c.statut === "Validé");
const archivees = cmdFiltrees.filter(c => c.statut === "Archivé");
```

- [ ] **Mettre à jour chaque ligne de liste** — remplacer le `<div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>` par le sous-titre avec nom demandeur

Dans la boucle `actives.map(c => ...)` et `terminees.map(c => ...)`, remplacer :
```jsx
<div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
```
par :
```jsx
<div style={{ fontSize: 11, color: "#9CA3AF" }}>
  {(() => {
    const owner = sousComptes.find(s => s.id === c.utilisateur_id);
    const prenom = owner ? owner.prenom : (c.utilisateur_id === profil.id ? profil.prenom : c.client_prenom);
    const nom = owner ? owner.nom : (c.utilisateur_id === profil.id ? profil.nom : c.client_nom);
    const nomStr = `${prenom ?? ""} ${nom ?? ""}`.trim();
    return nomStr ? `${nomStr} — ${c.ref}` : c.ref;
  })()}
</div>
```

- [ ] **Supprimer le bloc `{selected && (...)}` inline** (lignes ~340–395 dans VueUtilisateur) et le **remplacer par `<DetailCommandeModal />`** après la section `terminees` :

```jsx
{selected && (
  <DetailCommandeModal
    selected={selected}
    versionsSelected={versionsSelected}
    onClose={() => setSelected(null)}
    onArchiver={() => archiver(selected.id)}
    showContacts={true}
    actionButtons={
      selected.statut === "Ébauche déposée" ? (
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
      ) : selected.statut === "Validé" ? (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46" }}>
          ✅ Commande validée — messagerie fermée
        </div>
      ) : null
    }
    msgInput={msgInput}
    setMsgInput={setMsgInput}
    onEnvoyer={async (texte, fichiers) => {
      if (!texte.trim() && !fichiers?.length) return;
      await envoyerMessage(selected.id, auteurNom, texte, fichiers);
    }}
    auteurNom={auteurNom}
  />
)}
```

- [ ] **Ajouter la section Archivées** après la section `terminees` (et avant `<DetailCommandeModal>`) :

```jsx
{archivees.length > 0 && (
  <div style={{ marginBottom: selected ? 24 : 0 }}>
    <button onClick={() => setShowArchivees(v => !v)}
      style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
      {showArchivees ? "▲ Masquer les commandes archivées" : `▼ Voir les ${archivees.length} commande${archivees.length > 1 ? "s" : ""} archivée${archivees.length > 1 ? "s" : ""}`}
    </button>
    {showArchivees && (
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", opacity: 0.7 }}>
        {archivees.map(c => {
          const owner = sousComptes.find(s => s.id === c.utilisateur_id);
          return (
            <div key={c.id} onClick={() => setSelected(c)}
              style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer" }}>
              {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{owner ? `${owner.prenom} ${owner.nom}` : "Moi"}</div>}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
              </div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans?.length ?? 0}</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
              <Badge statut={c.statut} />
            </div>
          );
        })}
      </div>
    )}
  </div>
)}
```

- [ ] **Supprimer l'import `HistoriqueVersions`** s'il n'est plus utilisé ailleurs dans VueUtilisateur

- [ ] **Commit**

```bash
git add src/components/VueUtilisateur.js
git commit -m "feat: VueUtilisateur — modal detail, archive, nom demandeur"
```

---

## Task 4 : Mettre à jour `VueDessinateur.js`

**Files:**
- Modify: `src/components/VueDessinateur.js`

**Changements :**
1. Import `DetailCommandeModal`
2. Mettre à jour les lignes de liste (sous-titre avec nom client)
3. Remplacer le bloc `{selected && ...}` inline par `<DetailCommandeModal />`

- [ ] **Lire `src/components/VueDessinateur.js`** entier

- [ ] **Ajouter l'import**

```js
import DetailCommandeModal from "./DetailCommandeModal";
```

- [ ] **Mettre à jour les lignes de liste** dans `actives.map` et `terminees.map`

Remplacer `<div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>` par :
```jsx
<div style={{ fontSize: 11, color: "#9CA3AF" }}>
  {(() => {
    const nomClient = `${c.client_prenom ?? ""} ${c.client_nom ?? ""}`.trim();
    return nomClient ? `${nomClient} — ${c.ref}` : c.ref;
  })()}
</div>
```

- [ ] **Remplacer le bloc `{selected && (...)}` inline** par `<DetailCommandeModal />` :

```jsx
{selected && (
  <DetailCommandeModal
    selected={selected}
    versionsSelected={versionsSelected}
    onClose={() => setSelected(null)}
    onArchiver={null}
    showContacts={false}
    actionButtons={
      <>
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
        {selected.statut === "Validé" && (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46" }}>
            ✅ Mission validée par le client
          </div>
        )}
      </>
    }
    msgInput={msgInput}
    setMsgInput={setMsgInput}
    onEnvoyer={async (texte, fichiers) => {
      if (!texte.trim() && !fichiers?.length) return;
      await envoyerMessage(selected.id, auteurNom, texte, fichiers);
    }}
    auteurNom={auteurNom}
  />
)}
```

- [ ] **Supprimer les imports inutilisés** (`HistoriqueVersions`, `ListeFichiers`, `LogoCliquable`) si plus utilisés dans VueDessinateur

- [ ] **Commit**

```bash
git add src/components/VueDessinateur.js
git commit -m "feat: VueDessinateur — modal detail, nom demandeur"
```

---

## Task 5 : Vérification et nettoyage

- [ ] **Tester manuellement** dans le navigateur :
  - Vue utilisateur : cliquer une commande → modal s'ouvre, 2 colonnes desktop
  - Réduire la fenêtre à < 768px → onglets Infos/Chat
  - Bouton ••• → menu → Archiver → commande disparaît de la liste principale
  - Section "Archivées" apparaît avec la commande
  - Liens email/tel cliquables
  - Accordéons fichiers fonctionnent
  - Vue dessinateur : même vérifications (sans contacts, sans archive)

- [ ] **Vérifier la Badge `"Archivé"`** dans `src/components/Badge.js` — ajouter le cas si absent

```jsx
// Dans Badge.js, ajouter dans le switch/map des statuts :
// "Archivé" → couleur grise
```

- [ ] **Commit final**

```bash
git add -A
git commit -m "feat: detail commande responsive — polish et nettoyage"
```
