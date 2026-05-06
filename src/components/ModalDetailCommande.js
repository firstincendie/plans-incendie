import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../supabase";
import { formatDateMsg } from "../helpers";
import DetailCommandeModal from "./DetailCommandeModal";
import ZoneUpload from "./ZoneUpload";

export default function ModalDetailCommande({ retour = "/commandes" }) {
  const { ref } = useParams();
  const navigate = useNavigate();
  const { commandes, setCommandes, profil, session } = useOutletContext();

  const commande = commandes.find(c => c.ref === decodeURIComponent(ref || ""));

  // Local state handled by this adapter
  const [msgInput, setMsgInput] = useState("");
  const [note, setNote] = useState("");
  const [noteSaveError, setNoteSaveError] = useState(false);
  const [versions, setVersions] = useState([]);

  // Dessinateur workflow state
  const [showDepotModal, setShowDepotModal] = useState(false);
  const [fichiersDepot, setFichiersDepot] = useState([]);
  const [messageDepot, setMessageDepot] = useState("");
  const [deposant, setDeposant] = useState(false);
  const [showPlansFinalModal, setShowPlansFinalModal] = useState(false);
  const [uploadingPlanIndex, setUploadingPlanIndex] = useState(null);

  // Admin/utilisateur workflow state
  const [showModifModal, setShowModifModal] = useState(false);
  const [modifMsg, setModifMsg] = useState("");
  const [modifFichiers, setModifFichiers] = useState([]);
  const [envoyantModif, setEnvoyantModif] = useState(false);
  const [demandantValidation, setDemandantValidation] = useState(false);
  const [showDemandeValidationModal, setShowDemandeValidationModal] = useState(false);
  const [showValiderCommandeModal, setShowValiderCommandeModal] = useState(false);
  const [validant, setValidant] = useState(false);

  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();
  const isDessinateur = profil.role === "dessinateur";

  // Navigate away if commande not found (after data is loaded)
  useEffect(() => {
    if (commandes.length > 0 && !commande) {
      console.warn(`Commande introuvable : ${ref}`);
      navigate(retour, { replace: true });
    }
  }, [commande, commandes.length, ref, retour, navigate]);

  // Fetch versions for this commande
  useEffect(() => {
    if (!commande) return;
    supabase
      .from("versions")
      .select("*")
      .eq("commande_id", commande.id)
      .order("numero", { ascending: true })
      .then(({ data }) => setVersions(data || []));
  }, [commande?.id]); // eslint-disable-line

  // Load note for this commande
  useEffect(() => {
    if (!commande) { setNote(""); setNoteSaveError(false); return; }
    if (!session?.user?.id) return;
    supabase
      .from("commande_notes")
      .select("note")
      .eq("commande_id", commande.id)
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setNote(data?.note ?? ""));
  }, [commande?.id, session?.user?.id]); // eslint-disable-line

  if (!commande) return null;

  const versionsSelected = versions.filter(v => v.commande_id === commande.id);

  // ---- Helpers ----

  async function envoyerMessage(commandeId, auteur, texte, fichiers = [], options = {}) {
    const { data, error } = await supabase.from("messages").insert([{
      commande_id: commandeId,
      auteur,
      texte: texte || "",
      fichiers,
      date: formatDateMsg(),
      visible_par: options.visible_par ?? null,
    }]).select().single();
    if (!error && data) {
      setCommandes(prev =>
        prev.map(c => c.id === commandeId ? { ...c, messages: [...c.messages, data] } : c)
      );
      if (!options.visible_par?.length) {
        supabase.functions.invoke("notify-message", {
          body: {
            commande_id: commandeId,
            auteur_id: session?.user?.id,
            auteur_nom: auteurNom,
            nom_plan: commandes.find(c => c.id === commandeId)?.nom_plan ?? "",
          },
        });
      }
    }
  }

  async function changerStatut(id, statut) {
    const { error } = await supabase.from("commandes").update({ statut }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut } : c));
    }
  }

  // ---- Handlers ----

  async function envoyerMessageHandler(texte, fichiers, options = {}) {
    if (!texte.trim() && !fichiers?.length) return;
    await envoyerMessage(commande.id, auteurNom, texte, fichiers, options);
    setMsgInput("");
  }

  async function marquerMessagesLus(commandeId) {
    if (!commandeId) return;
    const cmd = commandes.find(c => c.id === commandeId);
    if (!cmd) return;
    const nonLus = cmd.messages.filter(m =>
      m.auteur !== auteurNom &&
      !m.visible_par &&
      !(m.lu_par || []).includes(auteurNom)
    );
    if (nonLus.length === 0) return;
    await Promise.all(
      nonLus.map(m =>
        supabase.from("messages").update({ lu_par: [...(m.lu_par || []), auteurNom] }).eq("id", m.id)
      )
    );
    const marquer = m => nonLus.some(n => n.id === m.id) ? { ...m, lu_par: [...(m.lu_par || []), auteurNom] } : m;
    setCommandes(prev =>
      prev.map(c => c.id === commandeId ? { ...c, messages: c.messages.map(marquer) } : c)
    );
  }

  async function sauvegarderNote() {
    if (!commande || !session?.user?.id) return;
    const { error } = await supabase.from("commande_notes").upsert({
      commande_id: commande.id,
      user_id: session.user.id,
      note,
      updated_at: new Date().toISOString(),
    });
    setNoteSaveError(!!error);
  }

  async function modifierCommande(id, updates, changesText) {
    const { error } = await supabase.from("commandes").update(updates).eq("id", id);
    if (error) throw error;
    const localUpdates = { ...updates };
    if (localUpdates.delai && localUpdates.delai.length === 10) {
      localUpdates.delai = localUpdates.delai + "T12:00:00";
    }
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, ...localUpdates } : c));
    if (changesText) await envoyerMessage(id, auteurNom, changesText);
  }

  async function archiver(id) {
    const { error } = await supabase.from("commandes").update({ is_archived: true }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, is_archived: true } : c));
      navigate(retour, { replace: true });
    }
  }

  async function desarchiver(id) {
    const { error } = await supabase.from("commandes").update({ is_archived: false }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, is_archived: false } : c));
      navigate(retour, { replace: true });
    }
  }

  async function desarchiverDessinateur(id) {
    const { error } = await supabase.from("commandes").update({ is_archived_dessinateur: false }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, is_archived_dessinateur: false } : c));
      navigate(retour, { replace: true });
    }
  }

  async function archiverDessinateur(id) {
    const { error } = await supabase.from("commandes").update({ is_archived_dessinateur: true }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, is_archived_dessinateur: true } : c));
      navigate(retour, { replace: true });
    }
  }

  async function dupliquer(c) {
    const { data, error } = await supabase.from("commandes").insert([{
      utilisateur_id: c.utilisateur_id,
      nom_plan: c.nom_plan + " (copie)",
      client_nom: c.client_nom, client_prenom: c.client_prenom,
      client_email: c.client_email, client_telephone: c.client_telephone,
      adresse1: c.adresse1, adresse2: c.adresse2,
      code_postal: c.code_postal, ville: c.ville,
      delai: c.delai, plans: c.plans,
      fichiers_plan: c.fichiers_plan || [], logo_client: c.logo_client || [],
      instructions: c.instructions,
      plans_finalises: [], statut: "En attente",
      dessinateur_id: c.dessinateur_id || null,
      dessinateur: c.dessinateur || null,
    }]).select("*, messages(*)").single();
    if (!error && data) {
      setCommandes(prev => [
        { ...data, plans: data.plans || [], fichiersPlan: data.fichiers_plan || [], logoClient: data.logo_client || [], plansFinalises: [], messages: [] },
        ...prev,
      ]);
      navigate(retour, { replace: true });
    }
  }

  // ---- Dessinateur workflow handlers ----

  async function commencer(id) {
    const { error } = await supabase.from("commandes").update({ statut: "Commencé" }).eq("id", id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: "Commencé" } : c));
      await envoyerMessage(id, auteurNom, "🚀 Mission commencée.");
      supabase.functions.invoke("notify-statut", {
        body: { commande_id: id, event: "commencé" },
      });
    }
  }

  async function annulerPlansFinal() {
    await supabase.from("commandes").update({ plans_finalises: [], statut: "Ébauche déposée" }).eq("id", commande.id);
    setCommandes(prev => prev.map(c => c.id === commande.id ? { ...c, plansFinalises: [], statut: "Ébauche déposée" } : c));
    await envoyerMessage(commande.id, auteurNom, "↩️ Plans finaux annulés. Retour en ébauche.");
  }

  async function deposerPlanFinal(planIndex, file) {
    setUploadingPlanIndex(planIndex);
    const ext = (file.name.split(".").pop() || "").replace(/[^a-zA-Z0-9]/g, "");
    const refNumber = commande.ref.split("-")[1];
    const nomPlanSafe = (commande.nom_plan || "plan").replace(/[^a-zA-Z0-9._-]/g, "_");
    const nomFichier = `${nomPlanSafe}-${refNumber}-${planIndex + 1}.${ext}`;
    const chemin = `finals/${commande.id}/${nomFichier}`;

    const { error: uploadError } = await supabase.storage.from("fichiers").upload(chemin, file, { upsert: true });
    if (uploadError) {
      console.error(uploadError);
      setUploadingPlanIndex(null);
      alert("Échec du dépôt du plan : " + (uploadError.message || "erreur inconnue"));
      return;
    }

    const { data: urlData } = supabase.storage.from("fichiers").getPublicUrl(chemin);
    const nouvelleEntree = {
      plan_index: planIndex,
      nom: nomFichier,
      url: urlData.publicUrl,
      taille: (file.size / 1024).toFixed(0) + " Ko",
      ajouteLe: new Date().toLocaleDateString("fr-FR"),
    };

    const anciens = (commande.plansFinalises || []).filter(p => p.plan_index !== planIndex);
    const nouveaux = [...anciens, nouvelleEntree];

    await supabase.from("commandes").update({ plans_finalises: nouveaux }).eq("id", commande.id);
    setCommandes(prev => prev.map(c => c.id === commande.id ? { ...c, plansFinalises: nouveaux } : c));
    setUploadingPlanIndex(null);

    if (nouveaux.length === commande.plans.length) {
      await envoyerMessage(commande.id, auteurNom, "📐 Plans finaux déposés — en attente de validation.");
      supabase.functions.invoke("notify-statut", {
        body: { commande_id: commande.id, event: "plans_finaux" },
      });
    }
  }

  async function deposerVersion() {
    if (!fichiersDepot.length) return;
    setDeposant(true);
    const numero = versions.filter(v => v.commande_id === commande.id).length + 1;
    const { data: ver } = await supabase.from("versions").insert([{
      commande_id: commande.id, fichiers: fichiersDepot, numero, deposee_par: auteurNom,
    }]).select().single();
    if (ver) setVersions(prev => [...prev, ver]);
    const { error } = await supabase.from("commandes").update({ statut: "Ébauche déposée" }).eq("id", commande.id);
    if (!error) {
      setCommandes(prev => prev.map(c => c.id === commande.id ? { ...c, statut: "Ébauche déposée" } : c));
      supabase.functions.invoke("notify-version", {
        body: { commande_id: commande.id, nom_plan: commande.nom_plan, numero_version: numero },
      });
      const texteMsg = messageDepot.trim()
        ? `📎 Version ${numero} déposée.\n${messageDepot.trim()}`
        : `📎 Version ${numero} déposée.`;
      await envoyerMessage(commande.id, auteurNom, texteMsg);
    }
    setFichiersDepot([]); setMessageDepot(""); setShowDepotModal(false); setDeposant(false);
  }

  // ---- Admin/utilisateur workflow handlers ----

  async function envoyerDemandeModification() {
    if (!modifMsg.trim()) return;
    setEnvoyantModif(true);
    await envoyerMessage(commande.id, auteurNom, modifMsg, modifFichiers);
    await changerStatut(commande.id, "Modification dessinateur");
    supabase.functions.invoke("notify-statut", {
      body: { commande_id: commande.id, event: "modification" },
    });
    setModifMsg(""); setModifFichiers([]); setShowModifModal(false); setEnvoyantModif(false);
  }

  async function demanderValidation() {
    if (demandantValidation) return;
    setDemandantValidation(true);
    setShowDemandeValidationModal(false);
    await changerStatut(commande.id, "Validation en cours");
    await envoyerMessage(commande.id, auteurNom, "📋 Validation demandée.");
    supabase.functions.invoke("notify-statut", {
      body: { commande_id: commande.id, event: "validation_en_cours" },
    });
    setDemandantValidation(false);
  }

  async function validerCommande() {
    if (validant) return;
    setValidant(true);
    setShowValiderCommandeModal(false);
    await changerStatut(commande.id, "Validé");
    await envoyerMessage(commande.id, auteurNom, "✅ Commande validée.");
    supabase.functions.invoke("notify-statut", {
      body: { commande_id: commande.id, event: "termine" },
    });
    setValidant(false);
  }

  // canModifier : not archived and not validated
  const canModifier = !isDessinateur && !commande.is_archived && commande.statut !== "Validé";

  // Role-specific props
  const onArchiver = isDessinateur
    ? (!commande.is_archived_dessinateur ? () => archiverDessinateur(commande.id) : undefined)
    : (!commande.is_archived ? () => archiver(commande.id) : undefined);

  const onDesarchiver = isDessinateur
    ? (commande.is_archived_dessinateur ? () => desarchiverDessinateur(commande.id) : undefined)
    : (commande.is_archived ? () => desarchiver(commande.id) : undefined);

  const onSupprimer = (!isDessinateur && commande.is_archived)
    ? undefined  // suppression non supportée dans ce contexte sans modal de confirmation
    : undefined;

  const onDupliquer = (!isDessinateur && !commande.is_archived)
    ? () => dupliquer(commande)
    : undefined;

  // ---- Action buttons (role-aware) ----

  const peutDeposer = ["Commencé", "Modification dessinateur"].includes(commande.statut);

  const actionButtons = isDessinateur ? (
    <>
      {commande.statut === "En attente" && (
        <button onClick={() => commencer(commande.id)}
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
      {commande.statut === "Validation en cours" && (
        <>
          <button onClick={() => setShowPlansFinalModal(true)}
            style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#047857", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
            📐 Déposer les plans finaux
          </button>
          <button onClick={() => annulerPlansFinal()}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#92400E", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>
            ↩️ Revenir en ébauche
          </button>
        </>
      )}
      {commande.statut === "Validé" && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46" }}>
          ✅ Mission validée par le client
        </div>
      )}
    </>
  ) : (
    // admin / utilisateur
    commande.statut === "Ébauche déposée" ? (
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setShowModifModal(true)}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#92400E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ✏️ Demander une modification
        </button>
        <button onClick={() => setShowDemandeValidationModal(true)} disabled={demandantValidation}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#065F46", fontSize: 13, fontWeight: 600, cursor: demandantValidation ? "not-allowed" : "pointer" }}>
          📋 Demander la validation
        </button>
      </div>
    ) : commande.statut === "Validation en cours" ? (
      <div style={{ marginBottom: 20 }}>
        <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#047857", marginBottom: 10 }}>
          📋 Validation en cours — {(commande.plansFinalises || []).length}/{(commande.plans || []).length} plan(s) déposé(s)
        </div>
        {(commande.plansFinalises || []).length === (commande.plans || []).length && (commande.plans || []).length > 0 && (
          <button onClick={() => setShowValiderCommandeModal(true)} disabled={validant}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: validant ? "#D1FAE5" : "#065F46", color: "#fff", fontSize: 13, fontWeight: 700, cursor: validant ? "not-allowed" : "pointer" }}>
            {validant ? "Validation..." : "✅ Valider la commande"}
          </button>
        )}
      </div>
    ) : commande.statut === "Validé" ? (
      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#065F46" }}>
        ✅ Commande validée — messagerie fermée
      </div>
    ) : null
  );

  return (
    <>
      <DetailCommandeModal
        selected={commande}
        versionsSelected={versionsSelected}
        onClose={() => navigate(retour)}
        onArchiver={onArchiver}
        onDesarchiver={onDesarchiver}
        onSupprimer={onSupprimer}
        onDupliquer={onDupliquer}
        showContacts={!isDessinateur}
        hideClientName={isDessinateur}
        actionButtons={actionButtons}
        msgInput={msgInput}
        setMsgInput={setMsgInput}
        onEnvoyer={envoyerMessageHandler}
        auteurNom={auteurNom}
        onMarquerLu={() => marquerMessagesLus(commande.id)}
        note={note}
        setNote={setNote}
        onSaveNote={sauvegarderNote}
        noteSaveError={noteSaveError}
        onModifierCommande={modifierCommande}
        canModifier={canModifier}
        startInEditMode={false}
      />

      {/* Modal dépôt plans finaux (dessinateur) */}
      {showPlansFinalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 560, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📐 Déposer les plans finaux</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>1 fichier requis par plan. Le client validera la commande une fois tous les plans déposés.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {commande.plans.map((p, i) => {
                const fichierExistant = (commande.plansFinalises || []).find(f => f.plan_index === i);
                const enUpload = uploadingPlanIndex === i;
                const disabled = uploadingPlanIndex !== null;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: fichierExistant ? "#F0FDF4" : "#F9FAFB" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>N°{i + 1} — {p.type} · {p.orientation} · {p.format}</div>
                      <div style={{ fontSize: 11, color: fichierExistant ? "#047857" : "#9CA3AF", marginTop: 2 }}>
                        {fichierExistant ? `✅ ${fichierExistant.nom} (${fichierExistant.taille})` : "Pas encore déposé"}
                      </div>
                    </div>
                    <label style={{ flexShrink: 0 }}>
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf" style={{ display: "none" }}
                        disabled={disabled}
                        onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) deposerPlanFinal(i, f); }} />
                      <span style={{ display: "inline-block", padding: "7px 14px", borderRadius: 7, border: "1px solid #D1D5DB", background: disabled ? "#F3F4F6" : "#fff", color: disabled ? "#9CA3AF" : "#374151", fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" }}>
                        {enUpload ? "⏳ Envoi..." : fichierExistant ? "🔄 Remplacer" : "📎 Choisir"}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowPlansFinalModal(false)} disabled={uploadingPlanIndex !== null}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: uploadingPlanIndex !== null ? "not-allowed" : "pointer" }}>
                ✕ Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal dépôt ébauche (dessinateur) */}
      {showDepotModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📤 Déposer une ébauche</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Le statut passera en "Ébauche déposée" automatiquement.</div>
            <ZoneUpload label="Fichiers de l'ébauche *" fichiers={fichiersDepot} onAjouter={f => setFichiersDepot(f)} onSupprimer={i => setFichiersDepot(fichiersDepot.filter((_, idx) => idx !== i))} accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf" maxFichiers={20} />
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Message joint (optionnel)</label>
              <textarea value={messageDepot} onChange={e => setMessageDepot(e.target.value)} rows={3} placeholder="Ajoutez un commentaire sur cette ébauche..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => { setShowDepotModal(false); setFichiersDepot([]); setMessageDepot(""); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={deposerVersion} disabled={!fichiersDepot.length || deposant}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: !fichiersDepot.length ? "#F3F4F6" : "#122131", color: !fichiersDepot.length ? "#9CA3AF" : "#fff", fontSize: 13, fontWeight: 600, cursor: !fichiersDepot.length ? "not-allowed" : "pointer" }}>
                {deposant ? "Dépôt..." : "Déposer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation valider la commande (admin/utilisateur) */}
      {showValiderCommandeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>✅ Valider la commande</div>
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 20 }}>
              Cette action est définitive. La commande passera au statut "Validé" et la messagerie sera fermée. Êtes-vous sûr ?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowValiderCommandeModal(false)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={() => validerCommande()} disabled={validant}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#065F46", color: "#fff", fontSize: 13, fontWeight: 600, cursor: validant ? "not-allowed" : "pointer" }}>
                {validant ? "Validation..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation demande de validation (admin/utilisateur) */}
      {showDemandeValidationModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📋 Demander la validation</div>
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 20 }}>
              Le dessinateur recevra une notification et devra déposer les plans finaux. Êtes-vous sûr ?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowDemandeValidationModal(false)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={() => demanderValidation()} disabled={demandantValidation}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#065F46", color: "#fff", fontSize: 13, fontWeight: 600, cursor: demandantValidation ? "not-allowed" : "pointer" }}>
                {demandantValidation ? "Envoi..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal demande modification (admin/utilisateur) */}
      {showModifModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✏️ Demander une modification</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Le statut passera en "Modification dessinateur".</div>
            <textarea value={modifMsg} onChange={e => setModifMsg(e.target.value)} rows={4} placeholder="Décrivez les modifications..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, resize: "vertical", boxSizing: "border-box", marginBottom: 14 }} />
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
    </>
  );
}
