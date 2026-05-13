import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../supabase";
import { formatDateMsg } from "../helpers";
import { planVide } from "../constants";
import TableauPlans from "./TableauPlans";
import ZoneUpload from "./ZoneUpload";

const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };
const labelStyle = { fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 600 };

export default function NouvelleCommandeModal({ retour = "/commandes" }) {
  const { setCommandes, sousComptes, profil } = useOutletContext();
  const navigate = useNavigate();

  const [dessinateursDispos, setDessinateursDispos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const formVide = (defaultDessinateurId = "") => ({
    utilisateur_id: profil.id,
    nom_plan: "",
    client_nom: "", client_prenom: "", client_email: "", client_telephone: "",
    adresse1: "", adresse2: "", code_postal: "", ville: "",
    delai: "",
    plans: [planVide()],
    fichiersPlan: [],
    logoClient: [],
    instructions: "",
    dessinateur_id: defaultDessinateurId,
  });
  const [form, setForm] = useState(formVide());

  const auteurNom = `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim();

  // Charge la liste des dessinateurs autorisés pour cet utilisateur (table de liaison V1)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("utilisateur_dessinateurs")
        .select("dessinateur_id, is_default, profiles:dessinateur_id(prenom, nom)")
        .eq("utilisateur_id", profil.id);
      if (cancelled) return;
      const liste = (data || []).map(d => ({
        id: d.dessinateur_id,
        prenom: d.profiles?.prenom || "",
        nom: d.profiles?.nom || "",
        is_default: d.is_default,
      }));
      setDessinateursDispos(liste);
      const defaultId = liste.find(d => d.is_default)?.id ?? liste[0]?.id ?? "";
      setForm(f => ({ ...f, dessinateur_id: defaultId }));
    })();
    return () => { cancelled = true; };
  }, [profil.id]);

  const fermer = () => navigate(retour, { replace: true });

  async function creerCommande() {
    if (!form.nom_plan || form.fichiersPlan.length === 0 || !form.dessinateur_id) return;
    setSaving(true);
    setSaveError("");
    const dessinateurChoisi = dessinateursDispos.find(d => d.id === form.dessinateur_id);
    // NB: pas de `ref` envoyé — le trigger Postgres `fill_commande_ref` le génère.
    const { data, error } = await supabase.from("commandes").insert([{
      utilisateur_id: form.utilisateur_id,
      nom_plan: form.nom_plan,
      client_nom: form.client_nom, client_prenom: form.client_prenom,
      client_email: form.client_email, client_telephone: form.client_telephone,
      adresse1: form.adresse1, adresse2: form.adresse2,
      code_postal: form.code_postal, ville: form.ville,
      delai: form.delai || null,
      plans: form.plans,
      fichiers_plan: form.fichiersPlan,
      logo_client: form.logoClient,
      instructions: form.instructions,
      plans_finalises: [],
      statut: "En attente",
      dessinateur_id: form.dessinateur_id || null,
      dessinateur: dessinateurChoisi ? `${dessinateurChoisi.prenom} ${dessinateurChoisi.nom}` : null,
    }]).select("*, messages(*)").single();
    if (error) { setSaveError(error.message); setSaving(false); return; }
    if (data) {
      const nouvelleCommande = {
        ...data,
        plans: data.plans || [],
        fichiersPlan: data.fichiers_plan || [],
        logoClient: data.logo_client || [],
        plansFinalises: [],
        messages: [],
      };
      if (form.instructions?.trim()) {
        const { data: msg } = await supabase.from("messages").insert([{
          commande_id: data.id,
          auteur: auteurNom,
          texte: form.instructions.trim(),
          fichiers: [],
          date: formatDateMsg(),
        }]).select().single();
        if (msg) nouvelleCommande.messages = [msg];
      }
      setCommandes(prev => [nouvelleCommande, ...prev]);
      // Notifier le dessinateur — fire-and-forget
      supabase.functions.invoke("notify-commande", {
        body: {
          utilisateur_id: form.utilisateur_id,
          nom_plan: form.nom_plan,
          ref: data.ref,
          dessinateur_id: form.dessinateur_id,
        },
      });
    }
    setSaving(false);
    fermer();
  }

  const submitDisabled = !form.nom_plan || form.fichiersPlan.length === 0 || !form.dessinateur_id;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 680, maxWidth: "calc(100vw - 24px)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nouvelle commande</h2>
          <button onClick={fermer} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#122131", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid #E5E7EB" }}>Informations client</div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Compte utilisateur</label>
            <select value={form.utilisateur_id} onChange={e => setForm({ ...form, utilisateur_id: e.target.value })} style={inputStyle}>
              <option value={profil.id}>{profil.prenom} {profil.nom} (moi)</option>
              {sousComptes.map(s => (
                <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Nom du plan *</label>
            <input type="text" value={form.nom_plan} placeholder="Ex: Résidence Les Pins — Bât A" onChange={e => setForm({ ...form, nom_plan: e.target.value })} style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><label style={labelStyle}>Prénom client</label><input type="text" value={form.client_prenom} onChange={e => setForm({ ...form, client_prenom: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Nom client</label><input type="text" value={form.client_nom} onChange={e => setForm({ ...form, client_nom: e.target.value })} style={inputStyle} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><label style={labelStyle}>Email client</label><input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Téléphone</label><input type="tel" value={form.client_telephone} onChange={e => setForm({ ...form, client_telephone: e.target.value })} style={inputStyle} /></div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Adresse</label>
            <input type="text" value={form.adresse1} placeholder="Adresse ligne 1" onChange={e => setForm({ ...form, adresse1: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
            <input type="text" value={form.adresse2} placeholder="Complément d'adresse" onChange={e => setForm({ ...form, adresse2: e.target.value })} style={{ ...inputStyle, marginBottom: 6 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
              <input type="text" value={form.code_postal} placeholder="Code postal" onChange={e => setForm({ ...form, code_postal: e.target.value })} style={inputStyle} />
              <input type="text" value={form.ville} placeholder="Ville" onChange={e => setForm({ ...form, ville: e.target.value })} style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#122131", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid #E5E7EB" }}>Détail du plan</div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Dessinateur *</label>
            {dessinateursDispos.length === 0 ? (
              <div style={{ fontSize: 12, color: "#94A3B8", padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#F9FAFB" }}>
                Aucun dessinateur disponible, contactez votre administrateur.
              </div>
            ) : (
              <select
                value={form.dessinateur_id}
                onChange={e => setForm({ ...form, dessinateur_id: e.target.value })}
                style={inputStyle}
              >
                <option value="">— Sélectionner un dessinateur —</option>
                {dessinateursDispos.map(d => (
                  <option key={d.id} value={d.id}>{d.prenom} {d.nom}{d.is_default ? " (défaut)" : ""}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Délai souhaité</label>
            <input type="date" value={form.delai} min={new Date().toISOString().split("T")[0]} onChange={e => setForm({ ...form, delai: e.target.value })} style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Plans à réaliser</label>
            <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px" }}>
              <TableauPlans plans={form.plans} onChange={plans => setForm({ ...form, plans })} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
            <ZoneUpload
              label="📄 Fichiers du plan *"
              fichiers={form.fichiersPlan}
              onAjouter={f => setForm({ ...form, fichiersPlan: f })}
              onSupprimer={i => setForm({ ...form, fichiersPlan: form.fichiersPlan.filter((_, idx) => idx !== i) })}
              accept=".png,.jpg,.jpeg,.pdf,.dwg,.dxf"
              maxFichiers={10}
            />
            <ZoneUpload
              label="🏢 Logo du client"
              fichiers={form.logoClient}
              onAjouter={f => setForm({ ...form, logoClient: f })}
              onSupprimer={() => setForm({ ...form, logoClient: [] })}
              accept="image/*"
              unique
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Instructions pour le dessinateur</label>
            <textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} rows={3} placeholder="Instructions, remarques..." style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        </div>

        {saveError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>Erreur : {saveError}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={fermer} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button
            onClick={creerCommande}
            disabled={saving || submitDisabled}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: submitDisabled ? "not-allowed" : "pointer",
              background: submitDisabled ? "#F3F4F6" : "#122131",
              color: submitDisabled ? "#9CA3AF" : "#fff",
            }}>
            {saving ? "Enregistrement..." : "Créer la commande"}
          </button>
        </div>

      </div>
    </div>
  );
}
