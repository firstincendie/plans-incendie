-- Constat 5 de AUDIT-SECURITE.md — correctif appliqué le 23/08/2026.
--
-- Problème : « Suppression authentifiée fichiers » et « Update authentifié
-- fichiers » n'exigeaient que d'être connecté (auth.role() = 'authenticated'),
-- sans aucun contrôle de propriété. N'importe quel compte — y compris un
-- compte en attente de validation — pouvait supprimer les 778 fichiers du
-- bucket, ou remplacer un plan par un autre document sans que personne ne
-- le voie.
--
-- Correctif :
--   suppression  -> le propriétaire du fichier, ou un administrateur
--   remplacement -> idem, PLUS le dessinateur assigné à la commande pour les
--                   fichiers finals/<id_commande>/… : deposerPlanFinal()
--                   dépose avec upsert:true, et une commande peut changer de
--                   dessinateur — sans cela le nouveau ne pourrait plus
--                   redéposer un plan final.
--
-- Le site ne supprime jamais de fichier (il ne fait qu'en déposer) : aucune
-- fonctionnalité existante n'est restreinte par ce correctif.

-- Le dessinateur assigné à la commande (ou son sous-compte), ou un admin.
-- Prend le segment de chemin en texte : évite un cast uuid sur un chemin
-- qui ne serait pas au format attendu.
create or replace function public.peut_deposer_plan_final(p_commande text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_commande ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_admin()
         or exists (
           select 1 from public.commandes c
           where c.id = p_commande::uuid
             and ( c.dessinateur_id = auth.uid()
                   or c.dessinateur_id in (
                     select p.id from public.profiles p where p.master_id = auth.uid()
                   ) )
         )
    else false
  end;
$$;

revoke execute on function public.peut_deposer_plan_final(text) from anon;

drop policy if exists "Suppression authentifiée fichiers" on storage.objects;
drop policy if exists "Update authentifié fichiers" on storage.objects;

create policy "fichiers_delete_proprietaire_ou_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fichiers'
    and ( owner = auth.uid() or public.is_admin() )
  );

create policy "fichiers_update_proprietaire_ou_dessinateur"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'fichiers'
    and ( owner = auth.uid()
          or public.is_admin()
          or ( (storage.foldername(name))[1] = 'finals'
               and public.peut_deposer_plan_final((storage.foldername(name))[2]) ) )
  )
  with check (
    bucket_id = 'fichiers'
    and ( owner = auth.uid()
          or public.is_admin()
          or ( (storage.foldername(name))[1] = 'finals'
               and public.peut_deposer_plan_final((storage.foldername(name))[2]) ) )
  );
