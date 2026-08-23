-- Constat 10 de AUDIT-SECURITE.md — correctif appliqué le 23/08/2026.
--
-- Les quatre tables Odoo avaient une règle de lecture « true » pour tout compte
-- connecté. Elles sont vides aujourd'hui, mais prévues pour recevoir le fichier
-- clients, les commandes et les factures : le jour de la synchronisation, le
-- moindre client inscrit aurait vu la totalité.
--
-- Aucune version du site (ni main, ni celle en ligne d'avril) n'interroge ces
-- tables : les restreindre ne casse rien.
drop policy if exists "team read odoo_clients"    on public.odoo_clients;
drop policy if exists "team read odoo_commandes"  on public.odoo_commandes;
drop policy if exists "team read odoo_factures"   on public.odoo_factures;
drop policy if exists "team read odoo_sync_state" on public.odoo_sync_state;

create policy "odoo_clients_admin"    on public.odoo_clients    for select to authenticated using (public.is_admin());
create policy "odoo_commandes_admin"  on public.odoo_commandes  for select to authenticated using (public.is_admin());
create policy "odoo_factures_admin"   on public.odoo_factures   for select to authenticated using (public.is_admin());
create policy "odoo_sync_state_admin" on public.odoo_sync_state for select to authenticated using (public.is_admin());
