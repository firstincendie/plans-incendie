import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { formatDateMsg, formatDateCourt, appliquerFiltresTri } from "../helpers";
import Badge from "./Badge";
import BarreFiltres from "./BarreFiltres";
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
  const [showTerminees, setShowTerminees] = useState(false);
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
                      style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#FFF3EE" : "transparent", transition: "background 0.1s" }}>
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
