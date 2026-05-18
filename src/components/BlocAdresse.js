import LigneCopiable from "./LigneCopiable";

export default function BlocAdresse({ commande }) {
  const lignes = [
    { label: "N°",    val: commande.numero_rue },
    { label: "Rue",   val: commande.adresse1 },
    { label: "CP",    val: commande.code_postal },
    { label: "Ville", val: commande.ville },
  ];
  const hasAny = lignes.some(l => l.val);
  if (!hasAny) return null;

  return (
    <div style={{ marginBottom: 16, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {lignes.map(l => (
          <LigneCopiable key={l.label} label={l.label} valeur={l.val} labelWidth={60} />
        ))}
      </div>
    </div>
  );
}
