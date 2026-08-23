-- ANNULATION de 20260823200000_fichiers_prive_lecture_reservee.sql, le même jour.
--
-- Le passage en privé a été appliqué en croyant, sur confirmation, que le site
-- adapté était publié. Les plans ont aussitôt cessé de s'afficher.
--
-- Les journaux Supabase ont tranché : la seule requête de stockage reçue visait
-- /storage/v1/object/public/..., et AUCUNE requête /object/sign/ n'a été émise.
-- Autrement dit le navigateur exécutait encore l'ancien code — la publication
-- n'avait pas pris effet (mauvaise branche, ou cache du navigateur).
--
-- Le dossier repasse donc en public le temps que la publication soit effective.
--
-- LEÇON, à appliquer avant de retenter : ne plus se fier à une confirmation
-- visuelle. Vérifier d'abord dans les journaux qu'une requête /object/sign/
-- arrive bien quand quelqu'un ouvre un plan. C'est la preuve que le nouveau
-- code tourne. Ensuite seulement, repasser le dossier en privé.

update storage.buckets set public = true where id = 'fichiers';

drop policy if exists "fichiers_lecture_connecte" on storage.objects;

create policy "Lecture publique fichiers" on storage.objects
  for select using (bucket_id = 'fichiers');
