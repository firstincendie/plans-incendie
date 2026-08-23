-- est_actif() n'est utilisée que dans des politiques déclarées pour le rôle
-- authenticated : anon n'en a aucun besoin. Supabase accorde EXECUTE à anon
-- automatiquement à la création d'une fonction, d'où ce retrait explicite.
revoke all on function public.est_actif() from anon;
