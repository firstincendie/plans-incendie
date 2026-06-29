import LigneCopiable from "./LigneCopiable";
import ChampCopiable from "./ChampCopiable";

export default function BlocAdresse({ commande, complet = false }) {
  const lignes = [
    { label: "N°",    val: commande.numero_rue },
    { label: "Rue",   val: commande.adresse1 },
    { label: "CP",    val: commande.code_postal },
    { label: "Ville", val: commande.ville },
  ];
  const hasAny = lignes.some(l => l.val);
  if (!hasAny) return null;

  // Adresse complète sur une ligne. Format : "12 rue des Lilas, 75001 Paris"
  const rue   = [commande.numero_rue, commande.adresse1].filter(Boolean).join(" ");
  const ville = [commande.code_postal, commande.ville].filter(Boolean).join(" ");
  const adresseComplete = [rue, ville].filter(Boolean).join(", ");

  // Mode "adresse complète" (dessinateur) : une seule ligne copiable.
  if (complet) {
    return (
      <div style={{ marginBottom: 16, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
        <ChampCopiable valeur={adresseComplete} label="l'adresse" />
      </div>
    );
  }

  // Vue détaillée : adresse complète copiable en haut + champs découpés en dessous.
  return (
    <div style={{ marginBottom: 16, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
      <div style={{ paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid #E5E7EB" }}>
        <ChampCopiable valeur={adresseComplete} label="l'adresse" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {lignes.map(l => (
          <LigneCopiable key={l.label} label={l.label} valeur={l.val} labelWidth={60} />
        ))}
      </div>
    </div>
  );
}
