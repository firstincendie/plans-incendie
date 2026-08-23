-- Constats 7 et 8 de AUDIT-SECURITE.md — correctifs appliqués le 23/08/2026.
--
-- alertes : la politique « Allow all » (ALL, rôle public, USING true) laissait
-- tout le monde, même sans compte, lire / modifier / supprimer les messages
-- bloqués par la modération — du contenu privé de conversations.
-- L'insertion doit rester ouverte aux comptes connectés : Messagerie.js
-- enregistre l'alerte au moment où le message de l'utilisateur est bloqué
-- (et n'inspecte pas l'erreur retournée, donc un refus passerait inaperçu).
--
-- notes_clients : RLS désactivée et aucune politique — table entièrement
-- exposée en lecture, écriture et suppression à quiconque possède la clé
-- publiable, forcément visible dans le navigateur. Table vide et pas encore
-- utilisée par le site : on pose dès maintenant la règle prévue par le schéma
-- (chaque dessinateur ne voit que ses propres notes).

-- ---------- alertes ----------
drop policy if exists "Allow all" on public.alertes;

create policy "alertes_insert_connecte" on public.alertes
  for insert to authenticated
  with check (true);

create policy "alertes_select_admin" on public.alertes
  for select to authenticated
  using (public.is_admin());

create policy "alertes_update_admin" on public.alertes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "alertes_delete_admin" on public.alertes
  for delete to authenticated
  using (public.is_admin());

-- ---------- notes_clients ----------
alter table public.notes_clients enable row level security;

create policy "notes_clients_dessinateur_ou_admin" on public.notes_clients
  for all to authenticated
  using      (dessinateur_id = auth.uid() or public.is_admin())
  with check (dessinateur_id = auth.uid() or public.is_admin());
