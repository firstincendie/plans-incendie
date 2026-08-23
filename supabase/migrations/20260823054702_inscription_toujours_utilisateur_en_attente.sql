-- Constat 2 de AUDIT-SECURITE.md — correctif appliqué le 23/08/2026.
--
-- Problème : le rôle était envoyé par le navigateur au moment de l'inscription
-- (signUp options.data.role) et recopié tel quel dans le profil. Si ce rôle
-- valait 'admin', le compte était activé immédiatement (statut 'actif'), sans
-- aucune validation humaine. N'importe qui pouvait donc entrer dans
-- l'application en sautant l'étape d'approbation.
--
-- Décision de Simon : toute inscription libre donne un compte « utilisateur »
-- en attente. Les dessinateurs sont promus à la main depuis Gestion
-- utilisateurs, ou invités via l'edge function invite-user.
--
-- Les invitations ne sont pas concernées : invite-user repasse juste après en
-- service_role pour poser le bon rôle et activer le compte.
--
-- Corrige au passage un bug latent : la valeur par défaut était 'client', qui
-- viole la contrainte profiles_role_check (admin/utilisateur/dessinateur) —
-- une inscription sans rôle dans les métadonnées échouait.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nom, prenom, role, statut)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    'utilisateur',   -- jamais le rôle réclamé par le navigateur
    'en_attente'     -- toujours en attente de validation, sans exception
  );
  return new;
end;
$$;
