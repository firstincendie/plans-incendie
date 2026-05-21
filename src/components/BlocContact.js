import LigneCopiable from "./LigneCopiable";

export default function BlocContact({ commande }) {
  const lignes = [
    { label: "Société", val: commande.client_societe,   href: null },
    { label: "Prénom",  val: commande.client_prenom,    href: null },
    { label: "Nom",     val: commande.client_nom,       href: null },
    { label: "Tel",     val: commande.client_telephone, href: commande.client_telephone ? `tel:${commande.client_telephone}` : null },
    { label: "Email",   val: commande.client_email,     href: commande.client_email ? `mailto:${commande.client_email}` : null },
  ];
  const hasAny = lignes.some(l => l.val);
  if (!hasAny) return null;

  return (
    <div style={{ background: "#F9FAFB", border: "1px solid #D1D5DB", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {lignes.map(l => (
          <LigneCopiable key={l.label} label={l.label} valeur={l.val} href={l.href} labelWidth={70} />
        ))}
      </div>
    </div>
  );
}
