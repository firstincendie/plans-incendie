import { useState, useEffect } from "react";
import Badge from "./Badge";
import BlocAdresse from "./BlocAdresse";
import ChampCopiable from "./ChampCopiable";
import HistoriqueVersions from "./HistoriqueVersions";
import { ListeFichiers, LogoCliquable } from "./VisuFichier";
import Messagerie from "./Messagerie";
import BarreFiltres, { appliquerFiltresTri } from "./BarreFiltres";
import ZoneUpload from "./ZoneUpload";
import { formatDateCourt, tempsRestant } from "../helpers";

export default function VueDessinateur({ commandes, versions, nomDessinateur, onChangerStatut, onEnvoyerMessage, onDeposerVersion, noLayout = false, sousComptes = [] }) {
  const [selected, setSelected]                 = useState(null);
  const [msgInput, setMsgInput]                 = useState("");
  const [fichiersNouveaux, setFichiersNouveaux] = useState([]);
  const [deposant, setDeposant]                 = useState(false);
  const [filtres, setFiltres]                   = useState({ statut: "", type: "", periode: "", client: "", dessinateur: "" });
  const [tri, setTri]                           = useState({ col: "created_at", dir: "desc" });
  const [showTermineesDessin, setShowTermineesDessin] = useState(false);

  const nomsVisibles = [
    nomDessinateur,
    ...sousComptes.map(p => `${p.prenom} ${p.nom}`),
  ].filter(Boolean);

  const toutes        = commandes.filter(c => nomsVisibles.includes(c.dessinateur));
  const mesMissions   = toutes.filter(c => c.statut !== "Validé");
  const mesTerminees  = toutes.filter(c => c.statut === "Validé");
  const missionsFiltrees = appliquerFiltresTri(mesMissions, { ...filtres, dessinateur: "" }, tri);

  useEffect(() => {
    if (selected) {
      const updated = commandes.find(c => c.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [commandes]); // eslint-disable-line

  async function handleDeposer() {
    if (!fichiersNouveaux.length || !selected) return;
    setDeposant(true);
    const mesVersions = versions.filter(v => v.commande_id === selected.id);
    await onDeposerVersion(selected.id, fichiersNouveaux, mesVersions.length + 1, nomDessinateur);
    await onChangerStatut(selected.id, "Ébauche déposée");
    setFichiersNouveaux([]);
    setDeposant(false);
  }

  const versionsCommande = selected ? versions.filter(v => v.commande_id === selected.id) : [];

  function InfosDetail({ c }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Client",        val: <ChampCopiable valeur={c.client} label="le client" /> },
          { label: "Créé le",       val: formatDateCourt(c.created_at) },
          { label: "Délai",         val: c.delai ? formatDateCourt(c.delai) : "—" },
          { label: "Temps restant", val: tempsRestant(c.delai) ? <span style={{ background: tempsRestant(c.delai).bg, color: tempsRestant(c.delai).color, padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>{tempsRestant(c.delai).label}</span> : "—" },
        ].map(f => <div key={f.label}><div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div></div>)}
      </div>
    );
  }

  return (
    <div style={noLayout ? {} : { display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F5FAFF", color: "#111827" }}>
      {!noLayout && (
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", padding: "24px 12px", gap: 4, position: "fixed", top: 44, height: "calc(100vh - 44px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "0 8px" }}>
          <div style={{ width: 32, height: 32, background: "#FC6C1B", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontSize: 16 }}>✏️</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Espace dessinateur</span>
        </div>
        <div style={{ padding: "8px 12px", background: "#FFF3ED", borderRadius: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "#FDB99A", marginBottom: 2 }}>Connecté en tant que</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#B84E10" }}>{nomDessinateur}</div>
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", padding: "8px 12px" }}>
          {mesMissions.length} mission{mesMissions.length > 1 ? "s" : ""} en cours
        </div>
        <div style={{ marginTop: "auto", borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
          <div style={{ padding: "8px 12px", fontSize: 11, color: "#9CA3AF" }}>Mode test — vue dessinateur</div>
        </div>
      </div>
      )}

      <div style={noLayout ? {} : { marginLeft: 220, flex: 1, padding: "32px 32px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Mes missions</h1>

        <BarreFiltres commandes={mesMissions} filtres={filtres} setFiltres={setFiltres} tri={tri} setTri={setTri} dessinateurs={[]} showDessinateur={false} couleurAccent="#FC6C1B" />

        {missionsFiltrees.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Aucune mission à afficher.</div>
        )}

        {missionsFiltrees.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr" : "2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {sousComptes.length > 0 && <span>Dessinateur</span>}
              <span>Bâtiment</span><span>Client</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Temps restant</span><span>Statut</span>
            </div>
            {missionsFiltrees.map(c => {
              const tr = tempsRestant(c.delai);
              const dernierMsg = c.messages[c.messages.length - 1];
              const hasNouveauMsg = dernierMsg && !nomsVisibles.includes(dernierMsg.auteur) && selected?.id !== c.id;
              return (
                <div key={c.id} onClick={() => { setSelected(c); setFichiersNouveaux([]); }}
                  style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr" : "2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#FFF3ED" : "transparent", transition: "background 0.1s" }}>
                  {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{c.dessinateur}</div>}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.batiment || c.client}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{c.client}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                  <div>{tr && <span style={{ background: tr.bg, color: tr.color, padding: "3px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>{tr.label}</span>}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Badge statut={c.statut} />
                    {hasNouveauMsg && (
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FC6C1B", display: "inline-block", flexShrink: 0 }} title="Nouveau message" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selected && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.batiment || selected.client}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>{selected.ref} · {selected.client}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge statut={selected.statut} />
                <button onClick={() => { setSelected(null); setFichiersNouveaux([]); }} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
              </div>
            </div>

            {/* EN ATTENTE */}
            {selected.statut === "En attente" && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nouvelle mission disponible</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>Client : <strong>{selected.client}</strong></div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>{selected.plans.length} plan{selected.plans.length > 1 ? "s" : ""} à réaliser</div>
                {tempsRestant(selected.delai) && (
                  <div style={{ marginBottom: 24 }}>
                    <span style={{ background: tempsRestant(selected.delai).bg, color: tempsRestant(selected.delai).color, padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600 }}>
                      {tempsRestant(selected.delai).label}
                    </span>
                  </div>
                )}
                <button onClick={() => onChangerStatut(selected.id, "Commencé")}
                  style={{ padding: "12px 36px", borderRadius: 10, border: "none", background: "#FC6C1B", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  ▶ Commencer la mission
                </button>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 12 }}>Les détails seront visibles après avoir commencé</div>
              </div>
            )}

            {/* COMMENCÉ ou MODIFICATION */}
            {(selected.statut === "Commencé" || selected.statut === "Modification dessinateur") && (
              <>
                {selected.statut === "Modification dessinateur" && (
                  <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#92400E", fontWeight: 500 }}>
                    ⚠️ Modification demandée — déposez une nouvelle version
                  </div>
                )}
                <InfosDetail c={selected} />

                <BlocAdresse commande={selected} copiable={true} />

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Plans à réaliser</div>
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
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Fichiers sources</div>
                    <ListeFichiers fichiers={selected.fichiersPlan} couleurAccent="#FC6C1B" />
                  </div>
                )}

                {selected.logoClient?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Logo client</div>
                    <LogoCliquable fichier={selected.logoClient[0]} />
                  </div>
                )}

                <HistoriqueVersions versions={versionsCommande} />

                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 18, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#065F46", marginBottom: 4 }}>
                    📤 {versionsCommande.length > 0 ? `Déposer la version ${versionsCommande.length + 1}` : "Déposer l'ébauche"}
                  </div>
                  <ZoneUpload label="" fichiers={fichiersNouveaux} onAjouter={f => setFichiersNouveaux(f)} onSupprimer={i => setFichiersNouveaux(fichiersNouveaux.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf,.ai" maxFichiers={20} />
                  {fichiersNouveaux.length > 0 && (
                    <button onClick={handleDeposer} disabled={deposant}
                      style={{ marginTop: 12, padding: "9px 20px", borderRadius: 8, border: "none", background: deposant ? "#9CA3AF" : "#059669", color: "#fff", fontSize: 13, fontWeight: 700, cursor: deposant ? "not-allowed" : "pointer" }}>
                      {deposant ? "Dépôt en cours..." : `✓ Confirmer le dépôt (${fichiersNouveaux.length} fichier${fichiersNouveaux.length > 1 ? "s" : ""})`}
                    </button>
                  )}
                </div>
                <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
                  onEnvoyer={async (texte) => { if (!texte.trim()) return; await onEnvoyerMessage(selected.id, nomDessinateur, texte, []); }}
                  auteurActif={nomDessinateur} />
              </>
            )}

            {/* ÉBAUCHE DÉPOSÉE */}
            {selected.statut === "Ébauche déposée" && (
              <>
                <InfosDetail c={selected} />
                <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6" }}>✅ Ébauche déposée — en attente de retour</div>
                </div>
                <HistoriqueVersions versions={versionsCommande} />
                <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 18, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 10 }}>Redéposer une version corrigée</div>
                  <ZoneUpload label="" fichiers={fichiersNouveaux} onAjouter={f => setFichiersNouveaux(f)} onSupprimer={i => setFichiersNouveaux(fichiersNouveaux.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf,.ai" maxFichiers={20} />
                  {fichiersNouveaux.length > 0 && (
                    <button onClick={handleDeposer} disabled={deposant}
                      style={{ marginTop: 10, padding: "8px 18px", borderRadius: 8, border: "none", background: deposant ? "#9CA3AF" : "#FC6C1B", color: "#fff", fontSize: 13, fontWeight: 700, cursor: deposant ? "not-allowed" : "pointer" }}>
                      {deposant ? "Dépôt en cours..." : `↩ Redéposer (${fichiersNouveaux.length} fichier${fichiersNouveaux.length > 1 ? "s" : ""})`}
                    </button>
                  )}
                </div>
                <Messagerie selected={selected} msgInput={msgInput} setMsgInput={setMsgInput}
                  onEnvoyer={async (texte) => { if (!texte.trim()) return; await onEnvoyerMessage(selected.id, nomDessinateur, texte, []); }}
                  auteurActif={nomDessinateur} />
              </>
            )}
          </div>
        )}

        {mesTerminees.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setShowTermineesDessin(v => !v)}
              style={{ fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 0", marginBottom: 8 }}>
              {showTermineesDessin ? "▲ Masquer les missions terminées" : `▼ Voir les ${mesTerminees.length} mission${mesTerminees.length > 1 ? "s" : ""} terminée${mesTerminees.length > 1 ? "s" : ""}`}
            </button>
            {showTermineesDessin && (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16, opacity: 0.85 }}>
                <div style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr" : "2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {sousComptes.length > 0 && <span>Dessinateur</span>}
                  <span>Bâtiment</span><span>Client</span><span>Créé le</span><span>Plans</span><span>Délai</span><span></span><span>Statut</span>
                </div>
                {mesTerminees.map(c => (
                  <div key={c.id} onClick={() => { setSelected(c); setFichiersNouveaux([]); }}
                    style={{ display: "grid", gridTemplateColumns: sousComptes.length > 0 ? "1fr 2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr" : "2fr 1fr 1fr 0.6fr 1fr 1fr 1.2fr", padding: "12px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#FFF3ED" : "transparent" }}>
                    {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{c.dessinateur}</div>}
                    <div><div style={{ fontWeight: 600, fontSize: 13 }}>{c.batiment || c.client}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div></div>
                    <div style={{ fontSize: 12 }}>{c.client}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans.length}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
                    <div></div>
                    <Badge statut={c.statut} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Détail mission terminée — messagerie + versions accessibles */}
        {selected && selected.statut === "Validé" && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24, marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.batiment || selected.client}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>{selected.ref} · {selected.client}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge statut={selected.statut} />
                <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
              </div>
            </div>
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#065F46", fontWeight: 500 }}>
              ✅ Mission terminée et validée
            </div>
            <HistoriqueVersions versions={versions.filter(v => v.commande_id === selected.id)} />
          </div>
        )}
      </div>
    </div>
  );
}
