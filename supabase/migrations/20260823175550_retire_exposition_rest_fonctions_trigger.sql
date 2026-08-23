-- Suite du constat 16. Le « revoke ... from public » précédent ne suffisait
-- pas : Supabase accorde aussi EXECUTE directement aux rôles anon et
-- authenticated. Ces six fonctions sont exclusivement des triggers ;
-- PostgreSQL ne vérifie pas le droit EXECUTE au déclenchement d'un trigger,
-- on peut donc les retirer complètement de l'API REST sans rien casser.
revoke all on function public.handle_new_user()        from anon, authenticated;
revoke all on function public.protege_champs_profil()  from anon, authenticated;
revoke all on function public.set_updated_at()         from anon, authenticated;
revoke all on function public.generate_invite_code()   from anon, authenticated;
revoke all on function public.check_no_nested_master() from anon, authenticated;
revoke all on function public.fill_commande_ref()      from anon, authenticated;
