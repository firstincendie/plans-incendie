-- Nettoyage des fonctions ajoutées par les correctifs des constats 1 et 5.
--
-- PostgreSQL accorde EXECUTE à PUBLIC par défaut : ces deux fonctions étaient
-- donc appelables depuis l'API REST (/rest/v1/rpc/…), ce que remontait le
-- linter Supabase.
--
-- protege_champs_profil est un trigger : PostgreSQL ne vérifie pas le droit
-- EXECUTE lors du déclenchement, on peut tout retirer sans risque.
--
-- peut_deposer_plan_final est utilisée dans une politique RLS de
-- storage.objects, évaluée sous le rôle authenticated : ce rôle doit garder
-- EXECUTE, sinon le dessinateur ne peut plus redéposer un plan final.

revoke all on function public.protege_champs_profil() from public;
revoke all on function public.peut_deposer_plan_final(text) from public;
grant execute on function public.peut_deposer_plan_final(text) to authenticated;
