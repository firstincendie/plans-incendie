import ChampCopiable from "./ChampCopiable";

export default function BlocAdresse({ commande, copiable = false }) {
  const adresse = [commande.adresse1, commande.adresse2, commande.code_postal, commande.ville].filter(Boolean).join(", ");
  if (!adresse) return null;
  return (
    <div style={{ marginBottom: 16, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 4 }}>📍 Adresse</div>
      {copiable ? (
        <ChampCopiable valeur={adresse} label="l'adresse" />
      ) : (
        <div style={{ fontSize: 13, color: "#374151" }}>{adresse}</div>
      )}
    </div>
  );
}
