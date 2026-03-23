import { useState, useEffect } from "react";
import Badge from "./Badge";
import HistoriqueVersions from "./HistoriqueVersions";
import { ListeFichiers, LogoCliquable } from "./VisuFichier";
import PageReglages from "./PageReglages";
import PageMonCompte from "./PageMonCompte";
import Messagerie from "./Messagerie";
import ZoneUpload from "./ZoneUpload";
import BlocAdresse from "./BlocAdresse";
import ChampCopiable from "./ChampCopiable";
import { formatDateCourt, tempsRestant } from "../helpers";
import BarreFiltres, { appliquerFiltresTri } from "./BarreFiltres";

export default function VueClient({
  commandes = [], versions = [], clientSelectionne, noLayout = false,
  sousComptes = [],
  session, profil, onProfilUpdate,
  onChangerStatut, onEnvoyerMessage,
  onNouvelleCommande,
}) {
  const [vue, setVue]       = useState("commandes");
  const [selected, setSelected] = useState(null);
  const [msgInput, setMsgInput] = useState("");
  const [showModifModal, setShowModifModal] = useState(false);
  const [showValidModal, setShowValidModal] = useState(false);
  const [modifMsg, setModifMsg]   = useState("");
  const [modifFichiers, setModifFichiers] = useState([]);
  const [envoyantModif, setEnvoyantModif] = useState(false);
  const [validant, setValidant]   = useState(false);
  const [filtres, setFiltres]           = useState({ statut: "", type: "", periode: "", client: "", dessinateur: "" });
  const [tri, setTri]                   = useState({ col: "created_at", dir: "desc" });
  const [userFilter, setUserFilter]     = useState(null);
  const [showTerminees, setShowTerminees] = useState(false);

  const nomsVisibles = [
    clientSelectionne?.nom_complet,
    ...sousComptes.map(p => `${p.prenom} ${p.nom}`),
  ].filter(Boolean);

  const mesCommandes = commandes.filter(c => nomsVisibles.includes(c.client));
  const commandesFiltrees = appliquerFiltresTri(
    userFilter ? mesCommandes.filter(c => c.client === userFilter) : mesCommandes,
    filtres,
    tri
  );
  const actives   = commandesFiltrees.filter(c => c.statut !== "Validé");
  const terminees = commandesFiltrees.filter(c => c.statut === "Validé");
  const versionsSelected = selected ? versions.filter(v => v.commande_id === selected.id) : [];

  useEffect(() => {
    setSelected(null);
    setVue("commandes");
  }, [clientSelectionne]); // eslint-disable-line

  async function envoyerDemandeModification() {
    if (!modifMsg.trim() || !selected) return;
    setEnvoyantModif(true);
    await onEnvoyerMessage(selected.id, "Simon", modifMsg, modifFichiers);
    await onChangerStatut(selected.id, "Modification dessinateur");
    setModifMsg(""); setModifFichiers([]); setShowModifModal(false); setEnvoyantModif(false);
  }

  async function validerCommande() {
    if (!selected) return;
    setValidant(true);
    await onChangerStatut(selected.id, "Validé");
    await onEnvoyerMessage(selected.id, "Simon", "✅ Commande validée. Merci pour votre travail !");
    setShowValidModal(false); setValidant(false);
  }

  const nav = [
    { id: "commandes",  label: "Commandes",  icon: "📋" },
    { id: "reglages",   label: "Réglages",   icon: "⚙️" },
    { id: "mon-compte", label: "Mon compte", icon: "👤" },
  ];

  return (
    <div style={noLayout ? {} : { display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}>

      {!noLayout && (
        <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px", gap: 4, position: "fixed", top: 44, height: "calc(100vh - 44px)", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
            <div style={{ width: 32, height: 32, background: "#059669", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 16 }}>👥</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Espace client</span>
          </div>
          <div style={{ padding: "8px 12px", background: "#F0FDF4", borderRadius: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#86EFAC", marginBottom: 2 }}>Connecté en tant que</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}>{clientSelectionne?.nom_complet ?? "—"}</div>
          </div>
          {nav.map(item => (
            <button key={item.id} onClick={() => { setVue(item.id); setSelected(null); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vue === item.id ? 600 : 400, background: vue === item.id ? "#E8EDF2" : "transparent", color: vue === item.id ? "#122131" : "#6B7280", textAlign: "left", width: "100%" }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div style={{ marginTop: "auto", borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
            <div style={{ padding: "8px 12px", fontSize: 11, color: "#9CA3AF" }}>Mode test — vue client</div>
          </div>
        </div>
      )}

      <div style={noLayout ? {} : { marginLeft: 220, flex: 1, padding: "32px 32px" }}>

        {vue === "reglages" && <PageReglages />}

        {vue === "mon-compte" && (
          <PageMonCompte
            profil={profil}
            session={session}
            role="client"
            commandes={mesCommandes}
            onProfilUpdate={onProfilUpdate}
          />
        )}

        {vue === "commandes" && (
          <>
            {/* En-tête avec bouton Nouvelle commande */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Commandes</h1>
              {onNouvelleCommande && (
                <button onClick={onNouvelleCommande}
                  style={{ background: "#059669", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  + Nouvelle commande
                </button>
              )}
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "En cours",  val: mesCommandes.filter(c => c.statut !== "Validé").length, color: "#122131", bg: "#fff" },
                { label: "Validées",  val: mesCommandes.filter(c => c.statut === "Validé").length, color: "#059669", bg: "#F0FDF4" },
                { label: "Total",     val: mesCommandes.length, color: "#374151", bg: "#F8FAFC" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 22px" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filtre sous-compte (super mode) */}
            {sousComptes.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <select value={userFilter ?? ""} onChange={e => setUserFilter(e.target.value || null)}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer" }}>
                  <option value="">Tous les utilisateurs</option>
                  <option value={clientSelectionne?.nom_complet}>{clientSelectionne?.nom_complet} (moi)</option>
                  {sousComptes.map(p => (
                    <option key={p.id} value={`${p.prenom} ${p.nom}`}>{p.prenom} {p.nom}</option>
                  ))}
                </select>
              </div>
            )}

            {/* BarreFiltres */}
            <BarreFiltres
              commandes={mesCommandes}
              filtres={filtres} setFiltres={setFiltres}
              tri={tri} setTri={setTri}
              dessinateurs={[]} showDessinateur={false}
              couleurAccent="#059669"
            />

            {/* Tableau actives */}
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {sousComptes.length > 0 && <span>User</span>}
                <span>Bâtiment</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
              </div>
              {actives.length === 0 && (
                <div style={{ padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande active.</div>
              )}
              {actives.map(c => (
                <div key={c.id} onClick={() => setSelected(c)}
                  style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EEF3F8" : "transparent", transition: "background 0.1s" }}>
                  {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{c.client}</div>}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.batiment || "—"}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
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
                    <div style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {sousComptes.length > 0 && <span>User</span>}
                      <span>Bâtiment</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
                    </div>
                    {terminees.map(c => (
                      <div key={c.id} onClick={() => setSelected(c)}
                        style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr" : "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EEF3F8" : "transparent" }}>
                        {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{c.client}</div>}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.batiment || "—"}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
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
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.client}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.ref}{selected.batiment ? ` · ${selected.batiment}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge statut={selected.statut} />
                    <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                  {[
                    { label: "Client",      val: <ChampCopiable valeur={selected.client} label="le client" /> },
                    { label: "Dessinateur", val: selected.dessinateur || "Non assigné" },
                    { label: "Créé le",     val: formatDateCourt(selected.created_at) },
                    { label: "Délai",       val: selected.delai ? formatDateCourt(selected.delai) : "—" },
                    { label: "Nb. plans",   val: selected.plans.length },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div>
                    </div>
                  ))}
                </div>

                <BlocAdresse commande={selected} copiable={true} />

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Détail des plans</div>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "8px 14px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
                      <span>N°</span><span>Type</span><span>Orientation</span><span>Format</span>
                    </div>
                    {selected.plans.map((p, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr", padding: "9px 14px", borderBottom: i < selected.plans.length - 1 ? "1px solid #F3F4F6" : "none", fontSize: 13 }}>
                        <span style={{ color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</span>
                        <span>{p.type}</span><span style={{ color: "#6B7280" }}>{p.orientation}</span><span style={{ color: "#6B7280" }}>{p.format}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.fichiersPlan?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Fichiers sources ({selected.fichiersPlan.length})</div>
                    <ListeFichiers fichiers={selected.fichiersPlan} couleurAccent="#122131" />
                  </div>
                )}

                {selected.logoClient?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Logo client</div>
                    <LogoCliquable fichier={selected.logoClient[0]} />
                  </div>
                )}

                <HistoriqueVersions versions={versionsSelected} />

                {selected.statut === "Ébauche déposée" && (
                  <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                    <button onClick={() => setShowModifModal(true)}
                      style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#92400E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      ✏️ Demander une modification
                    </button>
                    <button onClick={() => setShowValidModal(true)}
                      style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      ✅ Valider la commande
                    </button>
                  </div>
                )}

                {selected.statut === "Validé" ? (
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46", fontWeight: 500 }}>
                    ✅ Commande validée — messagerie fermée
                  </div>
                ) : (
                  <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
                    onEnvoyer={async (texte, fichiers) => { if (!texte.trim() && (!fichiers || fichiers.length === 0)) return; await onEnvoyerMessage(selected.id, "Simon", texte, fichiers); }}
                    auteurActif="Simon" allowFichier={true} />
                )}
              </div>
            )}
          </>
        )}

      </div>

      {/* Modal demande modification */}
      {showModifModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✏️ Demander une modification</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Le statut passera en "Modification dessinateur".</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 }}>Message *</label>
              <textarea value={modifMsg} onChange={e => setModifMsg(e.target.value)} rows={4} placeholder="Décrivez les modifications..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <ZoneUpload label="📎 Fichiers joints (optionnel)" fichiers={modifFichiers} onAjouter={f => setModifFichiers(f)} onSupprimer={i => setModifFichiers(modifFichiers.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf" maxFichiers={5} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowModifModal(false); setModifMsg(""); setModifFichiers([]); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={envoyerDemandeModification} disabled={!modifMsg.trim() || envoyantModif}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: !modifMsg.trim() ? "#F3F4F6" : "#D97706", color: !modifMsg.trim() ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: !modifMsg.trim() ? "not-allowed" : "pointer" }}>
                {envoyantModif ? "Envoi..." : "Envoyer la demande"}
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
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{selected?.client}</div>
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
