import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function GestionCompteDessinateur({ profil, sousComptes = [] }) {
  const [sousOnglet, setSousOnglet] = useState("sous-comptes");

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 24px 0" }}>Gestion de compte</h1>

      <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 10, padding: 4, marginBottom: 24, width: "fit-content" }}>
        {[
          { id: "sous-comptes", label: "Sous-comptes" },
          { id: "notes", label: "Notes clients" },
        ].map(t => (
          <button key={t.id} onClick={() => setSousOnglet(t.id)}
            style={{ padding: "7px 16px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: sousOnglet === t.id ? "#fff" : "transparent", color: sousOnglet === t.id ? "#122131" : "#64748B", boxShadow: sousOnglet === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {sousOnglet === "sous-comptes" && <SousComptesTab profil={profil} sousComptes={sousComptes} />}
      {sousOnglet === "notes" && <NotesClientsTab profil={profil} />}
    </div>
  );
}

function SousComptesTab({ profil, sousComptes }) {
  const [clientsDisponibles, setClientsDisponibles] = useState([]);
  const [assignments, setAssignments] = useState({}); // { dessinateur_id: [client_id, ...] }
  const [assignant, setAssignant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { charger(); }, []); // eslint-disable-line

  const charger = async () => {
    setLoading(true);
    const [{ data: clients }, { data: cd }] = await Promise.all([
      supabase.from("profiles").select("id, prenom, nom").eq("role", "utilisateur").eq("statut", "actif"),
      supabase.from("client_dessinateurs").select("client_id, dessinateur_id")
        .in("dessinateur_id", sousComptes.map(s => s.id)),
    ]);

    const map = {};
    (cd || []).forEach(row => {
      if (!map[row.dessinateur_id]) map[row.dessinateur_id] = [];
      map[row.dessinateur_id].push(row.client_id);
    });

    setClientsDisponibles(clients || []);
    setAssignments(map);
    setLoading(false);
  };

  const assigner = async (dessinateurId, clientId) => {
    setAssignant(dessinateurId);
    await supabase.from("client_dessinateurs").insert([{ dessinateur_id: dessinateurId, client_id: clientId }]);
    await charger();
    setAssignant(null);
  };

  if (loading) return <div style={{ color: "#9CA3AF", fontSize: 13, padding: 24 }}>Chargement...</div>;

  if (sousComptes.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#122131", marginBottom: 4 }}>Aucun sous-compte</div>
        <div style={{ fontSize: 12, color: "#94A3B8" }}>Partagez votre code d'invitation pour avoir des sous-comptes.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sousComptes.map(sd => {
        const clientsAssignes = (assignments[sd.id] || [])
          .map(cid => clientsDisponibles.find(c => c.id === cid))
          .filter(Boolean);
        const clientsNonAssignes = clientsDisponibles.filter(c => !(assignments[sd.id] || []).includes(c.id));

        return (
          <div key={sd.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#122131" }}>{sd.prenom} {sd.nom}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {clientsAssignes.length} client{clientsAssignes.length !== 1 ? "s" : ""} assigné{clientsAssignes.length !== 1 ? "s" : ""}
                </div>
              </div>
              {clientsNonAssignes.length > 0 && (
                <select value="" onChange={e => e.target.value && assigner(sd.id, e.target.value)}
                  disabled={assignant === sd.id}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12, color: "#374151", background: "#F9FAFB", cursor: "pointer" }}>
                  <option value="">+ Assigner un client</option>
                  {clientsNonAssignes.map(c => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                  ))}
                </select>
              )}
            </div>
            {clientsAssignes.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {clientsAssignes.map(c => (
                  <span key={c.id} style={{ fontSize: 12, background: "#FFF3ED", color: "#B84E10", borderRadius: 6, padding: "3px 10px", fontWeight: 500 }}>
                    {c.prenom} {c.nom}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NotesClientsTab({ profil }) {
  const [clients, setClients] = useState([]);
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState(null);
  const [clientActif, setClientActif] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      // Clients dédupliqués depuis les commandes du dessinateur (via utilisateur_id)
      const { data: cmds } = await supabase
        .from("commandes")
        .select("utilisateur_id, profiles!commandes_utilisateur_id_fkey(prenom, nom)")
        .not("utilisateur_id", "is", null);

      const map = {};
      (cmds || []).forEach(c => {
        if (c.profiles && !map[c.utilisateur_id]) {
          map[c.utilisateur_id] = `${c.profiles.prenom} ${c.profiles.nom}`;
        }
      });
      const listeClients = Object.entries(map).map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom));
      setClients(listeClients);

      // Notes existantes
      const { data: notesData } = await supabase
        .from("notes_clients")
        .select("client_nom, note")
        .eq("dessinateur_id", profil.id);
      const notesMap = {};
      (notesData || []).forEach(row => { notesMap[row.client_nom] = row.note; });
      setNotes(notesMap);
      setLoading(false);
    };
    charger();
  }, []); // eslint-disable-line

  const sauvegarder = async (clientNom) => {
    setSaving(clientNom);
    await supabase.from("notes_clients").upsert(
      { dessinateur_id: profil.id, client_nom: clientNom, note: notes[clientNom] || "", updated_at: new Date().toISOString() },
      { onConflict: "dessinateur_id,client_nom" }
    );
    setSaving(null);
  };

  if (loading) return <div style={{ color: "#9CA3AF", fontSize: 13, padding: 24 }}>Chargement...</div>;

  if (clients.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#122131", marginBottom: 4 }}>Aucun client</div>
        <div style={{ fontSize: 12, color: "#94A3B8" }}>Les clients de vos commandes apparaîtront ici.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, minHeight: 300 }}>
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        {clients.map(({ id, nom }) => (
          <button key={id} onClick={() => setClientActif(nom)}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: "1px solid #F3F4F6", fontSize: 13, fontWeight: clientActif === nom ? 600 : 400, background: clientActif === nom ? "#EEF3F8" : "transparent", color: clientActif === nom ? "#122131" : "#374151", cursor: "pointer" }}>
            {nom}
            {notes[nom] && <span style={{ fontSize: 10, color: "#059669", marginLeft: 6 }}>●</span>}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
        {!clientActif ? (
          <div style={{ color: "#9CA3AF", fontSize: 13, padding: 16 }}>Sélectionnez un client pour ajouter une note.</div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#122131", marginBottom: 12 }}>{clientActif}</div>
            <textarea
              value={notes[clientActif] || ""}
              onChange={e => setNotes(prev => ({ ...prev, [clientActif]: e.target.value }))}
              rows={8}
              placeholder="Notes internes (jamais visibles par le client)..."
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={() => sauvegarder(clientActif)} disabled={saving === clientActif}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#FC6C1B", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {saving === clientActif ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
