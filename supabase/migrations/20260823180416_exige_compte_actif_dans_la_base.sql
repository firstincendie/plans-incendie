-- Constat 9 de AUDIT-SECURITE.md — correctif appliqué le 23/08/2026.
--
-- Le statut du compte (en_attente / refuse / banni) n'était vérifié que par
-- l'écran React (RequireAuth.js). Côté base, seule la création de commande
-- l'exigeait. Un compte banni gardait donc une clé d'accès valide et pouvait
-- continuer à interroger l'API directement, hors du site.
--
-- Correctif par politiques RESTRICTIVE : elles se combinent en « ET » avec les
-- règles existantes sans les réécrire — donc sans risque de casser une règle
-- métier qu'on aurait mal recopiée.
create or replace function public.est_actif()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and statut = 'actif'
  );
$$;

revoke all on function public.est_actif() from public;
grant execute on function public.est_actif() to authenticated;

create policy "commandes_compte_actif" on public.commandes
  as restrictive for all to authenticated
  using (public.est_actif()) with check (public.est_actif());

create policy "messages_compte_actif" on public.messages
  as restrictive for all to authenticated
  using (public.est_actif()) with check (public.est_actif());

create policy "versions_compte_actif" on public.versions
  as restrictive for all to authenticated
  using (public.est_actif()) with check (public.est_actif());

-- Uniquement le bucket des plans, pour ne pas gêner les avatars.
create policy "fichiers_compte_actif" on storage.objects
  as restrictive for all to authenticated
  using      (bucket_id <> 'fichiers' or public.est_actif())
  with check (bucket_id <> 'fichiers' or public.est_actif());
