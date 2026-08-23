-- Constat 11 de AUDIT-SECURITE.md (partie « modification ») — 23/08/2026.
--
-- La politique messages_update ne vérifiait que la visibilité de la commande :
-- tout participant pouvait réécrire ou vider le message de quelqu'un d'autre.
--
-- On ne peut pas simplement restreindre la politique : le site met à jour le
-- champ lu_par des messages des AUTRES pour marquer « lu » (ListeCommandes,
-- ListeArchives, ModalDetailCommande — déjà dans la version en ligne d'avril).
-- Un trigger permet d'être précis : sur le message d'un autre, seul lu_par
-- peut changer.
--
-- La partie « auteur usurpé à l'écriture » n'est volontairement pas traitée :
-- le champ auteur est un texte libre, et le corriger proprement demande
-- d'ajouter une colonne auteur_id liée au compte, donc une modification du
-- site. À faire avec Simon.
create or replace function public.protege_messages_autrui()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_moi text;
begin
  if auth.uid() is null or auth.role() = 'service_role' then return new; end if;
  if public.is_admin() then return new; end if;

  select trim(concat(p.prenom, ' ', p.nom)) into v_moi
  from public.profiles p where p.id = auth.uid();

  if old.auteur is not distinct from v_moi then return new; end if;

  if new.texte        is distinct from old.texte
     or new.auteur       is distinct from old.auteur
     or new.commande_id  is distinct from old.commande_id
     or new.fichiers     is distinct from old.fichiers
     or new.visible_par  is distinct from old.visible_par
     or new.portee       is distinct from old.portee
     or new.date         is distinct from old.date
     or new.auteur_admin is distinct from old.auteur_admin then
    raise exception 'Seul l''auteur peut modifier son message.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protege_messages_autrui() from public, anon, authenticated;

drop trigger if exists trg_protege_messages_autrui on public.messages;
create trigger trg_protege_messages_autrui
  before update on public.messages
  for each row execute function public.protege_messages_autrui();
