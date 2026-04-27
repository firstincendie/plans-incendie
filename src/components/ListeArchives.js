import { useState } from "react";
import { useSearchParams, useNavigate, useOutletContext, Outlet } from "react-router-dom";
import { supabase } from "../supabase";
import { formatDateCourt, joursRestants } from "../helpers";
import Badge from "./Badge";
import BarreFiltres, { appliquerFiltresTri } from "./BarreFiltres";

export default function ListeArchives() {
  const { profil, commandes, setCommandes, sousComptes, session } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userFilter, setUserFilter] = useState(null);
  const [menuCmdId, setMenuCmdId] = useState(null);
  const [menuRect, setMenuRect] = useState(null);
  const [showConfirmSupprimer, setShowConfirmSupprimer] = useState(null);
  const navigate = useNavigate();

  // --- Filters from URL ---
  const filtres = {
    statut:      searchParams.get("statut") || "",
    dessinateur: searchParams.get("dessinateur") || "",
    type:        searchParams.get("type") || "",
    periode:     searchParams.get("periode") || "",
  };
  const tri = {
    col: searchParams.get("tri") || "created_at",
    dir: searchParams.get("dir") || "desc",
  };

  const setFiltres = (next) => {
    const params = new URLSearchParams(searchParams);
    ["statut", "dessinateur", "type", "periode"].forEach(k => {
      if (next[k]) params.set(k, next[k]);
      else params.delete(k);
    });
    setSearchParams(params, { replace: true });
  };

  const setTri = (updaterOrValue) => {
    const nextTri = typeof updaterOrValue === "function" ? updaterOrValue(tri) : updaterOrValue;
    const params = new URLSearchParams(searchParams);
    if (nextTri.col === "created_at" && nextTri.dir === "desc") {
      params.delete("tri"); params.delete("dir");
    } else {
      params.set("tri", nextTri.col); params.set("dir", nextTri.dir);
    }
    setSearchParams(params, { replace: true });
  };

  // --- Archive field per role ---
  const champArchive = profil.role === "dessinateur" ? "is_archived_dessinateur" : "is_archived";

  // --- userFilter sub-compte ---
  const commandesVisibles = userFilter
    ? commandes.filter(c => {
        if (profil.role === "dessinateur") return c.dessinateur_id === userFilter;
        return c.utilisateur_id === userFilter;
      })
    : commandes;

  // --- Apply filters + sort, then keep only archived ---
  const cmdFiltrees = appliquerFiltresTri(commandesVisibles, filtres, tri);
  const archivees = cmdFiltrees.filter(c => c[champArchive] === true);

  // --- Unread count helper ---
  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();
  const nonLusDe = c => c.messages
    ? c.messages.filter(m => m.auteur !== auteurNom && !(m.lu_par || []).includes(auteurNom)).length
    : 0;

  // --- Quick actions: desarchive ---
  async function desarchiver(id) {
    const { error } = await supabase.from("commandes").update({ is_archived: false }).eq("id", id);
    if (!error) setCommandes(prev => prev.map(c => c.id === id ? { ...c, is_archived: false } : c));
  }

  async function supprimerCommande(id) {
    const { error } = await supabase.from("commandes").delete().eq("id", id);
    if (!error) {
      setCommandes(prev => prev.filter(c => c.id !== id));
    } else {
      console.error("Erreur suppression commande:", error);
    }
  }

  async function desarchiverDessinateur(id) {
    const { error } = await supabase.from("commandes").update({ is_archived_dessinateur: false }).eq("id", id);
    if (!error) setCommandes(prev => prev.map(c => c.id === id ? { ...c, is_archived_dessinateur: false } : c));
  }

  // --- Row click handler ---
  function ouvrirDetail(c) {
    navigate(`/commandes/archives/${encodeURIComponent(c.ref)}`);
  }

  // ============================================================
  // UTILISATEUR / ADMIN table rendering
  // ============================================================
  const cmdCols = sousComptes.length > 0
    ? "1fr 2fr 1fr 1fr 0.6fr 1fr 1.4fr 28px"
    : "2fr 1fr 1fr 0.6fr 1fr 1.4fr 28px";

  function renderLigneCmdUtilisateur(c) {
    const owner = sousComptes.find(s => s.id === c.utilisateur_id);
    const ownerLabel = owner
      ? `${owner.prenom} ${owner.nom}`
      : (c.utilisateur_id === profil.id
          ? `${profil.prenom} ${profil.nom}`
          : `${c.client_prenom ?? ""} ${c.client_nom ?? ""}`.trim());
    const j = joursRestants(c.delai);
    const rouge = j !== null && j <= 3;
    return (
      <div key={c.id} onClick={() => ouvrirDetail(c)}
        style={{ display: "grid", gridTemplateColumns: cmdCols, padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: "transparent", opacity: 0.75, transition: "background 0.1s" }}
        onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{ownerLabel || "—"}</div>}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</span>
            {nonLusDe(c) > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{nonLusDe(c)}</span>}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{ownerLabel ? `${ownerLabel} — ${c.ref}` : c.ref}</div>
        </div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{c.dessinateur || "—"}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans?.length ?? 0}</div>
        <div>
          {c.delai ? (
            <>
              <div style={{ fontSize: 12, color: rouge ? "#DC2626" : "#6B7280" }}>{formatDateCourt(c.delai)}</div>
              {j !== null && <div style={{ fontSize: 10, fontWeight: 600, color: rouge ? "#DC2626" : "#9CA3AF" }}>{j === 0 ? "Aujourd'hui" : j < 0 ? `${Math.abs(j)}j dépassé` : `${j}j restant${j > 1 ? "s" : ""}`}</div>}
            </>
          ) : <span style={{ fontSize: 12, color: "#D1D5DB" }}>—</span>}
        </div>
        <Badge statut={c.statut} />
        <div onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenuCmdId(menuCmdId === c.id ? null : c.id); setMenuRect(r); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 18, padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}>
            ···
          </button>
        </div>
      </div>
    );
  }

  function renderCarteCmdUtilisateur(c) {
    const j = joursRestants(c.delai);
    const rouge = j !== null && j <= 3;
    const owner = sousComptes.find(s => s.id === c.utilisateur_id);
    const ownerLabel = owner ? `${owner.prenom} ${owner.nom}` : null;
    return (
      <div key={c.id} onClick={() => ouvrirDetail(c)}
        style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", opacity: 0.75 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nom_plan || "—"}</span>
              {nonLusDe(c) > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{nonLusDe(c)}</span>}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{ownerLabel ? `${ownerLabel} · ` : ""}{c.ref}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge statut={c.statut} />
            <div onClick={e => e.stopPropagation()}>
              <button
                onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenuCmdId(menuCmdId === c.id ? null : c.id); setMenuRect(r); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 18, padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}>
                ···
              </button>
            </div>
          </div>
        </div>
        {c.delai && (
          <div style={{ marginTop: 6, fontSize: 11, color: rouge ? "#DC2626" : "#9CA3AF", fontWeight: rouge ? 600 : 400 }}>
            {formatDateCourt(c.delai)}{j !== null ? ` · ${j === 0 ? "Aujourd'hui" : j < 0 ? `${Math.abs(j)}j dépassé` : `${j}j restant${j > 1 ? "s" : ""}`}` : ""}
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // DESSINATEUR table rendering
  // ============================================================
  const cmdColsDessinateur = sousComptes.length > 0
    ? "1fr 2fr 1fr 0.6fr 1fr 1.4fr 40px"
    : "2fr 1fr 0.6fr 1fr 1.4fr 40px";

  function renderLigneCmdDessinateur(c) {
    const sousD = sousComptes.find(s => s.id === c.dessinateur_id);
    const j = joursRestants(c.delai);
    const rouge = j !== null && j <= 3;
    return (
      <div key={c.id} onClick={() => ouvrirDetail(c)}
        style={{ display: "grid", gridTemplateColumns: cmdColsDessinateur, padding: "14px 20px", borderBottom: "1px solid #F3F4F6", alignItems: "center", cursor: "pointer", background: "transparent", opacity: 0.75, transition: "background 0.1s" }}
        onMouseEnter={e => e.currentTarget.style.background = "#FFF8F5"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        {sousComptes.length > 0 && <div style={{ fontSize: 12, color: "#6B7280" }}>{sousD ? `${sousD.prenom} ${sousD.nom}` : "Moi"}</div>}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{c.nom_plan || "—"}</span>
            {nonLusDe(c) > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{nonLusDe(c)}</span>}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>{c.ref}</div>
        </div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateCourt(c.created_at)}</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.plans?.length ?? 0}</div>
        <div>
          <div style={{ fontSize: 12, color: rouge ? "#DC2626" : "#6B7280" }}>{c.delai ? formatDateCourt(c.delai) : "—"}</div>
          {j !== null && <div style={{ fontSize: 10, fontWeight: 600, color: rouge ? "#DC2626" : "#9CA3AF" }}>{j === 0 ? "Aujourd'hui" : j < 0 ? `${Math.abs(j)}j dépassé` : `${j}j restant${j > 1 ? "s" : ""}`}</div>}
        </div>
        <Badge statut={c.statut} />
        <div onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenuCmdId(menuCmdId === c.id ? null : c.id); setMenuRect(r); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 18, padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}>
            ···
          </button>
        </div>
      </div>
    );
  }

  function renderCarteCmdDessinateur(c) {
    const j = joursRestants(c.delai);
    const rouge = j !== null && j <= 3;
    return (
      <div key={c.id} onClick={() => ouvrirDetail(c)}
        style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", opacity: 0.75 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nom_plan || "—"}</span>
              {nonLusDe(c) > 0 && <span style={{ background: "#FC6C1B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{nonLusDe(c)}</span>}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{c.ref}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge statut={c.statut} />
            <div onClick={e => e.stopPropagation()}>
              <button
                onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenuCmdId(menuCmdId === c.id ? null : c.id); setMenuRect(r); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 18, padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}>
                ···
              </button>
            </div>
          </div>
        </div>
        {c.delai && (
          <div style={{ marginTop: 6, fontSize: 11, color: rouge ? "#DC2626" : "#9CA3AF", fontWeight: rouge ? 600 : 400 }}>
            {formatDateCourt(c.delai)}{j !== null ? ` · ${j === 0 ? "Aujourd'hui" : j < 0 ? `${Math.abs(j)}j dépassé` : `${j}j restant${j > 1 ? "s" : ""}`}` : ""}
          </div>
        )}
      </div>
    );
  }

  const isDessinateur = profil.role === "dessinateur";

  return (
    <div onClick={() => { menuCmdId && setMenuCmdId(null); }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          {isDessinateur ? "Missions archivées" : "Archives"}
        </h1>
      </div>

      {/* Stats row */}
      {isDessinateur ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Archivées", val: archivees.length, color: "#FC6C1B", bg: "#FFF3EE" },
            { label: "Total missions", val: commandes.length, color: "#374151", bg: "#F8FAFC" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
          {[
            { label: "archivées", val: archivees.length, color: "#122131" },
            { label: "total",     val: commandes.length, color: "#9CA3AF" },
          ].map(s => (
            <span key={s.label} style={{ fontSize: 13, color: "#6B7280" }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: s.color }}>{s.val}</span> {s.label}
            </span>
          ))}
        </div>
      )}

      {/* Barre filtres */}
      <BarreFiltres
        commandes={commandes}
        filtres={filtres}
        setFiltres={setFiltres}
        tri={tri}
        setTri={setTri}
        showDessinateur={!isDessinateur}
        couleurAccent={isDessinateur ? "#FC6C1B" : "#122131"}
      />

      {/* Sélecteur sous-compte */}
      {sousComptes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <select
            value={userFilter ?? ""}
            onChange={e => setUserFilter(e.target.value || null)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer" }}>
            <option value="">{isDessinateur ? "Toutes les missions" : "Tous les comptes"}</option>
            <option value={profil.id}>{isDessinateur ? "Mes missions" : `${profil.prenom} ${profil.nom} (moi)`}</option>
            {sousComptes.map(s => (
              <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
            ))}
          </select>
        </div>
      )}

      {/* ---- UTILISATEUR / ADMIN TABLE ---- */}
      {!isDessinateur && (
        <>
          {/* Archivées — desktop */}
          <div className="cmd-table" style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: cmdCols, padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {sousComptes.length > 0 && <span>Compte</span>}
              <span>Plan</span><span>Dessinateur</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span><span></span>
            </div>
            {archivees.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande archivée.</div>}
            {archivees.map(c => renderLigneCmdUtilisateur(c))}
          </div>

          {/* Archivées — mobile */}
          <div className="cmd-cards" style={{ marginBottom: 16 }}>
            {archivees.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune commande archivée.</div>}
            {archivees.map(c => renderCarteCmdUtilisateur(c))}
          </div>
        </>
      )}

      {/* ---- DESSINATEUR TABLE ---- */}
      {isDessinateur && (
        <>
          {/* Archivées — desktop */}
          <div className="cmd-table" style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: cmdColsDessinateur, padding: "10px 20px", borderBottom: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase" }}>
              {sousComptes.length > 0 && <span>Dessinateur</span>}
              <span>Plan</span><span>Créé le</span><span>Plans</span><span>Délai</span><span>Statut</span><span></span>
            </div>
            {archivees.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune mission archivée.</div>}
            {archivees.map(c => renderLigneCmdDessinateur(c))}
          </div>

          {/* Archivées — mobile */}
          <div className="cmd-cards" style={{ marginBottom: 16 }}>
            {archivees.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Aucune mission archivée.</div>}
            {archivees.map(c => renderCarteCmdDessinateur(c))}
          </div>
        </>
      )}

      {/* Outlet — for modal detail */}
      <Outlet context={{ commandes, setCommandes, sousComptes, profil, session }} />

      {/* ---- DROPDOWN ··· (position fixed, escapes overflow:hidden) ---- */}
      {menuCmdId && menuRect && (() => {
        const c = commandes.find(x => x.id === menuCmdId);
        if (!c) return null;
        const spaceBelow = window.innerHeight - menuRect.bottom;
        const top = spaceBelow >= 180 ? menuRect.bottom + 4 : menuRect.top - 4;
        const transform = spaceBelow >= 180 ? "none" : "translateY(-100%)";
        return (
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "fixed", top, right: window.innerWidth - menuRect.right, transform, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 1000, minWidth: 210, overflow: "hidden" }}>
            {isDessinateur ? (
              /* Dessinateur menu: désarchiver uniquement */
              <button
                onClick={() => { setMenuCmdId(null); desarchiverDessinateur(c.id); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                📤 Désarchiver la mission
              </button>
            ) : (
              /* Utilisateur / admin menu: désarchiver + supprimer */
              <>
                <button
                  onClick={() => { setMenuCmdId(null); desarchiver(c.id); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  📤 Désarchiver la commande
                </button>
                <button
                  onClick={() => { setMenuCmdId(null); setShowConfirmSupprimer(c.id); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#DC2626", textAlign: "left" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  🗑️ Supprimer la commande
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* Modal confirmation suppression */}
      {showConfirmSupprimer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#122131", marginBottom: 12 }}>Supprimer la commande ?</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24, lineHeight: 1.6 }}>
              Cette action est irréversible. La commande et toutes ses données associées (messages, versions, fichiers) seront définitivement supprimées.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirmSupprimer(null)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #D1D5DB", background: "#F9FAFB", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={() => { supprimerCommande(showConfirmSupprimer); setShowConfirmSupprimer(null); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
