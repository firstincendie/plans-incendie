-- Fin du constat 16 : ces quatre fonctions gardaient encore EXECUTE via le
-- rôle générique PUBLIC, dont anon et authenticated héritent.
revoke all on function public.set_updated_at()         from public;
revoke all on function public.generate_invite_code()   from public;
revoke all on function public.check_no_nested_master() from public;
revoke all on function public.fill_commande_ref()      from public;
