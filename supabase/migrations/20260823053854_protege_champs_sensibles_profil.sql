-- Constat 1 de AUDIT-SECURITE.md — correctif appliqué le 23/08/2026.
--
-- Problème : la politique profiles_update est définie avec USING seulement
-- (pas de WITH CHECK). En PostgreSQL, le USING sert alors aussi de contrôle
-- sur la nouvelle ligne : « id = auth.uid() » reste vrai même si l'utilisateur
-- se met is_owner = true. N'importe quel compte connecté pouvait donc se
-- promouvoir propriétaire de l'application.
--
-- Correctif : un trigger verrouille les trois champs qui donnent des droits.
-- master_id et dessinateur_id restent volontairement libres — ils servent au
-- rattachement à un groupe depuis « Mon compte » et ne donnent aucun droit
-- supplémentaire à celui qui les modifie (ils en donnent à l'autre partie).

create or replace function public.protege_champs_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (fonctions serveur : invite-user, update-user-email…)
  -- et appels internes : autorisés
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  -- le propriétaire de l'application garde tous les droits
  if public.is_owner() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.statut is distinct from old.statut
     or new.is_owner is distinct from old.is_owner then
    raise exception 'Modification interdite : role, statut et is_owner ne peuvent être changés que par un propriétaire.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protege_champs_profil on public.profiles;

create trigger trg_protege_champs_profil
  before update on public.profiles
  for each row
  execute function public.protege_champs_profil();
