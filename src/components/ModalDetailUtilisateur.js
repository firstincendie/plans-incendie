import { useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";

export default function ModalDetailUtilisateur() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { comptes, setSelected } = useOutletContext();

  const compte = comptes.find(c => c.id === uid);

  useEffect(() => {
    if (comptes.length > 0 && !compte) {
      console.warn(`Utilisateur introuvable : ${uid}`);
      navigate("/utilisateurs", { replace: true });
      return;
    }
    if (compte) setSelected(compte);
    return () => setSelected(null);
  }, [uid, compte, comptes.length, navigate, setSelected]);

  return null;
}
