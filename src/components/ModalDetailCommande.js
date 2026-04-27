import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../supabase";
import { formatDateMsg } from "../helpers";
import DetailCommandeModal from "./DetailCommandeModal";

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

  // ---- Handlers ----

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
    const ref2 = "CMD-" + String(commandes.length + 1).padStart(3, "0");
    const { data, error } = await supabase.from("commandes").insert([{
      ref: ref2,
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

  return (
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
      actionButtons={null}
      msgInput={msgInput}
      setMsgInput={setMsgInput}
      onEnvoyer={async (texte, fichiers, options = {}) => {
        if (!texte.trim() && !fichiers?.length) return;
        await envoyerMessage(commande.id, auteurNom, texte, fichiers, options);
        setMsgInput("");
      }}
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
  );
}
