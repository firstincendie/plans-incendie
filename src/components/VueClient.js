import { useState } from "react";
import Badge from "./Badge";
import HistoriqueVersions from "./HistoriqueVersions";
import { ListeFichiers, LogoCliquable } from "./VisuFichier";
import PageReglages from "./PageReglages";
import { formatDateCourt } from "../helpers";

export default function VueClient({ commandes, versions, clientSelectionne, noLayout = false }) {
  const [vue, setVue]       = useState("commandes");
  const [selected, setSelected] = useState(null);

  const mesCommandes    = commandes.filter(c => c.client === clientSelectionne?.nom_complet);
  const actives         = mesCommandes.filter(c => c.statut !== "Validé");
  const terminees       = mesCommandes.filter(c => c.statut === "Validé");
  const versionsSelected = selected ? versions.filter(v => v.commande_id === selected.id) : [];

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
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center", color: "#9CA3AF" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>👤</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#122131", marginBottom: 6 }}>
              {clientSelectionne?.prenom} {clientSelectionne?.nom}
            </div>
            <div style={{ fontSize: 13 }}>Aperçu — compte client</div>
          </div>
        )}

        {vue === "commandes" && (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "En cours",  val: actives.length,    color: "#122131", bg: "#fff" },
                { label: "Validées",  val: terminees.length,  color: "#059669", bg: "#F0FDF4" },
                { label: "Total",     val: mesCommandes.length, color: "#374151", bg: "#F8FAFC" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 22px" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tableau */}
            {mesCommandes.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 14, color: "#94A3B8" }}>Aucune commande pour ce client.</div>
              </div>
            ) : (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1.4fr", padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <span>Bâtiment</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span>
                </div>
                {[...actives, ...terminees].map(c => (
                  <div key={c.id} onClick={() => setSelected(c)}
                    style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr 1.4fr", padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: selected?.id === c.id ? "#EEF3F8" : "transparent", transition: "background 0.1s" }}>
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

            {/* Panneau détail */}
            {selected && (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.batiment || selected.client}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{selected.ref}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge statut={selected.statut} />
                    <button onClick={() => setSelected(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {[
                    { label: "Créé le",   val: formatDateCourt(selected.created_at) },
                    { label: "Délai",     val: selected.delai ? formatDateCourt(selected.delai) : "—" },
                    { label: "Nb. plans", val: selected.plans.length },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{f.val}</div>
                    </div>
                  ))}
                </div>

                {selected.plansFinalises?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Plans finalisés</div>
                    <ListeFichiers fichiers={selected.plansFinalises} couleurAccent="#059669" />
                  </div>
                )}

                {selected.logoClient?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8 }}>Logo client</div>
                    <LogoCliquable fichier={selected.logoClient[0]} />
                  </div>
                )}

                <HistoriqueVersions versions={versionsSelected} />

                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46", fontWeight: 500 }}>
                  Vue en lecture seule — mode preview client
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
