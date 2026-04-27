import { Navigate, Outlet } from "react-router-dom";

/**
 * Route guard that checks role (and optionally is_owner).
 *
 * Props:
 *   profil      – the current user profile object
 *   roles       – array of allowed role strings (e.g. ["admin", "utilisateur"])
 *   requireOwner – if true, profil.is_owner must also be true
 *
 * Renders <Outlet /> when access is granted, otherwise redirects to /commandes.
 */
export default function RequireRole({ profil, roles = [], requireOwner = false }) {
  if (!profil) return <Navigate to="/connexion" replace />;

  const roleOk = roles.includes(profil.role);
  const ownerOk = !requireOwner || profil.is_owner === true;

  if (!roleOk || !ownerOk) {
    return <Navigate to="/commandes" replace />;
  }

  return <Outlet />;
}
