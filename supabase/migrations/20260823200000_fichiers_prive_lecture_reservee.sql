-- Constat 4 de AUDIT-SECURITE.md — appliqué le 23/08/2026, APRÈS publication
-- du site (l'ordre inverse aurait cassé l'affichage de tous les plans).
--
-- Le dossier « fichiers » était public : les 778 plans étaient téléchargeables
-- par toute personne connaissant ou devinant l'adresse, sans aucun compte.
--
-- Il passe en privé. La lecture est réservée aux comptes connectés ; la
-- politique RESTRICTIVE « fichiers_compte_actif » (constat 9) y ajoute
-- automatiquement la condition « compte actif ».
--
-- Le site sait demander des liens signés d'une heure (helpers.js :
-- lienFichier / useLienFichier), publié avant ce changement.
--
-- Le dossier « avatars » n'est pas touché : il reste public, ce n'est pas
-- sensible.
--
-- LIMITE CONNUE : 597 fichiers sont déposés à la racine du dossier, sans
-- rattachement à une commande dans leur chemin. Impossible donc de cloisonner
-- par client au niveau de la base sans revoir l'organisation des chemins.
-- Tout compte actif peut lire les fichiers du dossier : sans commune mesure
-- avec « tout Internet », mais ce n'est pas un cloisonnement client par
-- client — à traiter dans un second temps.
--
-- ANNULATION, si besoin :
--   update storage.buckets set public = true where id = 'fichiers';
--   create policy "Lecture publique fichiers" on storage.objects
--     for select using (bucket_id = 'fichiers');

update storage.buckets set public = false where id = 'fichiers';

drop policy if exists "Lecture publique fichiers" on storage.objects;

create policy "fichiers_lecture_connecte" on storage.objects
  for select to authenticated
  using (bucket_id = 'fichiers');
