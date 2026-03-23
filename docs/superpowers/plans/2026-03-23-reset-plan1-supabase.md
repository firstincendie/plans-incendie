# Grand Reset — Plan 1 : Fondation Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer la base de données Supabase vers le nouveau schéma (profiles simplifié, commandes restructurées, RLS propre, SMTP configuré).

**Architecture:** Migrations SQL appliquées via Supabase MCP, RLS configurée par table et par rôle, colonnes inutiles supprimées proprement. Toutes les données existantes sont conservées ou migrées avant suppression.

**Tech Stack:** Supabase (PostgreSQL), Supabase MCP tools, SQL

**Spec de référence:** `docs/superpowers/specs/2026-03-23-grand-reset-roles-commandes-design.md`

---

## Fichiers concernés

- Aucun fichier React modifié dans ce plan
- Toutes les opérations sont dans Supabase via MCP tools

---

### Task 1 : Ajouter les nouvelles colonnes sur `profiles`

**Objectif :** Ajouter `is_owner`, `dessinateur_id`, et les 3 colonnes de préférences email.

- [ ] **Step 1 : Ajouter `is_owner` et `dessinateur_id`**

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dessinateur_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
```

- [ ] **Step 2 : Ajouter les préférences de notifications**

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_nouvelle_commande boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_nouveau_message boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_nouvelle_version boolean NOT NULL DEFAULT true;
```

- [ ] **Step 3 : Vérifier dans Supabase Table Editor**

Ouvrir `profiles` dans le dashboard Supabase. Vérifier que les 5 nouvelles colonnes apparaissent avec les bons types et valeurs par défaut.

- [ ] **Step 4 : Passer `contact@firstincendie.com` en `is_owner = true`**

```sql
UPDATE profiles
SET is_owner = true
WHERE email = 'contact@firstincendie.com';
```

Vérifier dans le Table Editor que la ligne est bien mise à jour.

---

### Task 2 : Ajouter les nouvelles colonnes sur `commandes`

**Objectif :** Ajouter toutes les colonnes du nouveau schéma commande (partie Client + Plan).

- [ ] **Step 1 : Ajouter les colonnes partie "Client"**

```sql
ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS nom_plan text,
  ADD COLUMN IF NOT EXISTS utilisateur_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_nom text,
  ADD COLUMN IF NOT EXISTS client_prenom text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_telephone text,
  ADD COLUMN IF NOT EXISTS instructions text;
```

- [ ] **Step 2 : Migrer les données existantes**

Copier les données de l'ancienne colonne `client` (texte libre) vers `nom_plan` pour ne pas perdre les références existantes :

```sql
UPDATE commandes
SET nom_plan = client
WHERE nom_plan IS NULL AND client IS NOT NULL;
```

Migrer `client_id` (UUID existant) vers `utilisateur_id` :

```sql
UPDATE commandes
SET utilisateur_id = client_id
WHERE utilisateur_id IS NULL AND client_id IS NOT NULL;
```

- [ ] **Step 3 : Vérifier la migration**

```sql
SELECT id, ref, nom_plan, utilisateur_id, client, client_id
FROM commandes
LIMIT 10;
```

Vérifier que `nom_plan` et `utilisateur_id` sont bien remplis pour les commandes existantes.

---

### Task 3 : Supprimer les anciennes colonnes

**Objectif :** Nettoyer les colonnes obsolètes après migration des données.

> ⚠️ Ne faire cette étape qu'après avoir vérifié la migration Task 2.

- [ ] **Step 1 : Supprimer les colonnes obsolètes de `commandes`**

```sql
ALTER TABLE commandes
  DROP COLUMN IF EXISTS client,
  DROP COLUMN IF EXISTS client_id,
  DROP COLUMN IF EXISTS batiment,
  DROP COLUMN IF EXISTS dessinateur;
```

- [ ] **Step 2 : Supprimer `master_id` de `profiles`**

```sql
ALTER TABLE profiles
  DROP COLUMN IF EXISTS master_id;
```

- [ ] **Step 3 : Supprimer la table `client_dessinateurs`**

```sql
DROP TABLE IF EXISTS client_dessinateurs;
```

- [ ] **Step 4 : Vérifier dans le Table Editor**

Ouvrir `commandes` et `profiles` dans le dashboard. Confirmer que les anciennes colonnes ont disparu et que les nouvelles sont présentes.

---

### Task 4 : Configurer les RLS sur `commandes`

**Objectif :** Chaque rôle ne voit que les commandes qui le concernent.

- [ ] **Step 1 : Activer RLS sur `commandes` si pas déjà fait**

```sql
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2 : Supprimer les policies existantes (pour repartir propre)**

```sql
DROP POLICY IF EXISTS "commandes_select" ON commandes;
DROP POLICY IF EXISTS "commandes_insert" ON commandes;
DROP POLICY IF EXISTS "commandes_update" ON commandes;
DROP POLICY IF EXISTS "commandes_delete" ON commandes;
```

- [ ] **Step 3 : Policy SELECT**

```sql
CREATE POLICY "commandes_select" ON commandes
FOR SELECT USING (
  -- is_owner voit tout
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_owner = true)
  OR
  -- Utilisateur voit ses propres commandes
  utilisateur_id = auth.uid()
  OR
  -- Dessinateur voit les commandes des utilisateurs qui lui sont assignés
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = commandes.utilisateur_id
    AND profiles.dessinateur_id = auth.uid()
  )
);
```

- [ ] **Step 4 : Policy INSERT**

```sql
CREATE POLICY "commandes_insert" ON commandes
FOR INSERT WITH CHECK (
  -- Seuls les utilisateurs actifs peuvent créer des commandes
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND statut = 'actif')
  AND utilisateur_id = auth.uid()
);
```

- [ ] **Step 5 : Policy UPDATE**

```sql
CREATE POLICY "commandes_update" ON commandes
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_owner = true)
  OR utilisateur_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = commandes.utilisateur_id
    AND profiles.dessinateur_id = auth.uid()
  )
);
```

- [ ] **Step 6 : Policy DELETE (is_owner seulement)**

```sql
CREATE POLICY "commandes_delete" ON commandes
FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_owner = true)
);
```

- [ ] **Step 7 : Vérifier les policies dans le dashboard**

Supabase Dashboard → Authentication → Policies → table `commandes`. Confirmer que les 4 policies apparaissent.

---

### Task 5 : Configurer les RLS sur `profiles`

**Objectif :** Contrôler qui peut lire et modifier les profils.

- [ ] **Step 1 : Activer RLS sur `profiles`**

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2 : Supprimer les policies existantes**

```sql
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
```

- [ ] **Step 3 : Policy SELECT**

```sql
CREATE POLICY "profiles_select" ON profiles
FOR SELECT USING (
  -- Chacun voit son propre profil
  id = auth.uid()
  OR
  -- is_owner voit tout
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_owner = true)
  OR
  -- Dessinateur voit les profils des utilisateurs qui lui sont assignés
  dessinateur_id = auth.uid()
);
```

- [ ] **Step 4 : Policy INSERT (trigger auto à l'inscription)**

```sql
CREATE POLICY "profiles_insert" ON profiles
FOR INSERT WITH CHECK (id = auth.uid());
```

- [ ] **Step 5 : Policy UPDATE**

```sql
CREATE POLICY "profiles_update" ON profiles
FOR UPDATE USING (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_owner = true)
);
```

- [ ] **Step 6 : Policy DELETE (is_owner seulement)**

```sql
CREATE POLICY "profiles_delete" ON profiles
FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_owner = true)
);
```

---

### Task 6 : Configurer RLS sur `messages` et `versions`

- [ ] **Step 1 : RLS messages**

```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;

CREATE POLICY "messages_select" ON messages
FOR SELECT USING (
  EXISTS (SELECT 1 FROM commandes WHERE commandes.id = messages.commande_id)
);

CREATE POLICY "messages_insert" ON messages
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM commandes WHERE commandes.id = messages.commande_id)
);
```

- [ ] **Step 2 : RLS versions**

```sql
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "versions_select" ON versions;
DROP POLICY IF EXISTS "versions_insert" ON versions;

CREATE POLICY "versions_select" ON versions
FOR SELECT USING (
  EXISTS (SELECT 1 FROM commandes WHERE commandes.id = versions.commande_id)
);

CREATE POLICY "versions_insert" ON versions
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM commandes WHERE commandes.id = versions.commande_id)
);
```

---

### Task 7 : Configurer le SMTP dans Supabase

- [ ] **Step 1 : Ouvrir les paramètres SMTP**

Supabase Dashboard → Project Settings → Authentication → SMTP Settings

- [ ] **Step 2 : Remplir les champs**

- Enable Custom SMTP : **ON**
- Sender name : `First Incendie`
- Sender email : `noreply@incendieplan.fr`
- Host : `incendieplan.fr`
- Port : `465`
- Username : `noreply@incendieplan.fr`
- Password : mot de passe du compte noreply@incendieplan.fr

- [ ] **Step 3 : Tester l'envoi**

Cliquer "Send test email" dans le dashboard. Vérifier la réception dans la boîte mail.

- [ ] **Step 4 : Personnaliser les templates auth**

Supabase Dashboard → Authentication → Email Templates

**Reset Password** — modifier le sujet et corps :
- Subject : `Réinitialisation de votre mot de passe — First Incendie`
- Body : conserver le lien `{{ .ConfirmationURL }}`, adapter le texte en français

**Confirm signup** — adapter en français si la confirmation email est activée.

---

### Task 8 : Vérification finale et commit doc

- [ ] **Step 1 : Test complet RLS**

Se connecter avec un compte `utilisateur` test. Vérifier dans le dashboard Supabase que les requêtes ne retournent que les données autorisées (via le SQL Editor avec `SET request.jwt.claim.sub = '<uuid-utilisateur>'`).

- [ ] **Step 2 : Vérifier le schéma final**

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('profiles', 'commandes')
ORDER BY table_name, ordinal_position;
```

Confirmer que toutes les nouvelles colonnes sont présentes et les anciennes absentes.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "feat: migrate supabase schema — new profiles/commandes columns, RLS, SMTP"
```
