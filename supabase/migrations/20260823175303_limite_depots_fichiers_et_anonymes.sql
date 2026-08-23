-- Constat 6 de AUDIT-SECURITE.md — correctif appliqué le 23/08/2026.
--
-- Problème : la politique validation_anon_upload laissait n'importe qui, sans
-- compte, déposer des fichiers dans fichiers/validation/, et le bucket n'avait
-- ni limite de taille ni liste de types. Stockage illimité offert à Internet.
--
-- Correctif :
--  1. limite de taille à 50 Mo (le plus gros fichier existant fait 30 Mo,
--     sur 778 fichiers et 427 Mo au total) ;
--  2. le dépôt anonyme n'est accepté que sous validation/<id_commande>/… ET
--     seulement si cette commande a un lien de validation actif et non expiré.
--
-- Pas de liste blanche de types MIME : le site accepte aussi .dwg et .dxf
-- (NouvelleCommandeModal, ModalDetailCommande), que les navigateurs envoient
-- souvent en application/octet-stream. Une liste qui inclut octet-stream
-- n'apporterait rien, une liste qui l'exclut casserait le dépôt de plans CAO.

update storage.buckets set file_size_limit = 50 * 1024 * 1024 where id = 'fichiers';

create or replace function public.validation_depot_autorise(p_commande text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_commande ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (
      select 1 from public.validation_liens v
      where v.commande_id = p_commande::uuid
        and v.actif = true
        and (v.expire_le is null or v.expire_le > now())
    )
    else false
  end;
$$;

revoke all on function public.validation_depot_autorise(text) from public;
grant execute on function public.validation_depot_autorise(text) to anon, authenticated;

drop policy if exists "validation_anon_upload" on storage.objects;

create policy "validation_anon_upload" on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'fichiers'
    and (storage.foldername(name))[1] = 'validation'
    and public.validation_depot_autorise((storage.foldername(name))[2])
  );
