-- Constat 16 de AUDIT-SECURITE.md — correctif appliqué le 23/08/2026.
--
-- 1) search_path figé sur les fonctions qui ne l'avaient pas. ALTER FUNCTION
--    ajoute seulement le réglage : le corps n'est pas réécrit, donc aucun
--    risque de régression.
alter function public.set_updated_at()                          set search_path = public;
alter function public.is_owner()                                set search_path = public;
alter function public.generate_invite_code()                    set search_path = public;
alter function public.check_no_nested_master()                  set search_path = public;
alter function public.set_dessinateurs_utilisateur(uuid, jsonb) set search_path = public;
alter function public.fill_commande_ref()                       set search_path = public;

-- 2) Retrait de l'exposition REST des fonctions internes.
revoke all on function public.handle_new_user() from public;
revoke all on function public.set_dessinateurs_utilisateur(uuid, jsonb) from anon;

-- NB : is_admin(), is_owner() et est_mon_dessinateur() gardent volontairement
-- leur droit d'exécution. Elles sont utilisées dans des politiques RLS
-- déclarées pour le rôle « public », donc évaluées aussi sous anon (page
-- publique de validation) : les leur retirer ferait échouer ces requêtes au
-- lieu de simplement renvoyer une liste vide.
