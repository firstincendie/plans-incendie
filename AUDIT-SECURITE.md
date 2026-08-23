# Révision de sécurité — Incendie Plan (incendieplan.fr)

Date : 23 août 2026 · Base analysée : projet Supabase `plans-incendie` (custkyapdbvzkuxgurla) · Code : branche `main`

**Résumé en une phrase :** le site lui-même est bien écrit, mais **les portes de la base de données et du stockage sont grandes ouvertes**. Aujourd'hui, n'importe quelle personne ayant un compte peut se transformer en administrateur, et n'importe qui sur Internet peut lire tous les plans et envoyer des emails au nom de incendieplan.fr.

Chiffres concernés : **123 commandes**, **779 fichiers**, **8 comptes**.

---

## Tableau de bord

| # | Problème | Gravité | Qui peut en profiter |
|---|---|---|---|
| 1 | Un simple compte peut se nommer administrateur | CRITIQUE | Tout compte connecté |
| 2 | L'inscription permet de créer un compte « admin » actif direct | CRITIQUE | N'importe qui |
| 3 | Le service d'envoi d'emails est ouvert sans mot de passe | CRITIQUE | N'importe qui |
| 4 | Tous les fichiers des plans sont publics | CRITIQUE | N'importe qui avec le lien |
| 5 | Tout compte connecté peut effacer TOUS les fichiers | CRITIQUE | Tout compte connecté |
| 6 | Dépôt de fichiers anonyme, sans limite de taille | ÉLEVÉ | N'importe qui |
| 7 | Table `alertes` en accès libre (lecture + écriture) | ÉLEVÉ | N'importe qui |
| 8 | Table `notes_clients` sans aucune protection | ÉLEVÉ | N'importe qui |
| 9 | Bannir un compte ne coupe pas vraiment son accès | ÉLEVÉ | Compte banni / en attente |
| 10 | Tables Odoo lisibles par tout compte connecté | MOYEN | Tout compte connecté |
| 11 | Messages modifiables par autrui, faux auteur possible | MOYEN | Participant d'une commande |
| 12 | Texte injectable dans les emails automatiques | MOYEN | Tout compte connecté |
| 13 | 52 failles dans les librairies (2 critiques) | MOYEN | — |
| 14 | Mots de passe compromis autorisés | FAIBLE | — |
| 15 | Aucun en-tête de sécurité sur le site | FAIBLE | — |
| 16 | Fonctions internes appelables sans être connecté | FAIBLE | — |

---

# CRITIQUE — à corriger en premier

## 1. Un simple compte peut se nommer administrateur

**Le problème.** La règle qui autorise quelqu'un à modifier sa fiche personnelle (`profiles`) dit seulement « tu peux modifier la ligne qui est la tienne ». Elle ne dit **pas** « mais tu n'as pas le droit de toucher aux cases *rôle*, *propriétaire* et *statut* ». Aucun garde-fou n'existe non plus côté base.

Résultat : n'importe quelle personne connectée (un client, un dessinateur) peut demander à la base de mettre `is_owner = true` sur sa propre fiche. Elle devient **propriétaire de l'application**.

**Ce que ça permet ensuite :** lire et modifier les 123 commandes et toutes les fiches clients, supprimer des comptes, **changer l'adresse email de n'importe quel compte** (donc voler ce compte), générer des liens de validation.

**Détail technique.** Politique `profiles_update` : `USING ((id = auth.uid()) OR is_owner())`, sans `WITH CHECK`. En PostgreSQL, quand `WITH CHECK` est absent, c'est le `USING` qui sert de contrôle — la nouvelle ligne passe donc, même avec `is_owner = true`. Aucun trigger ne s'y oppose (`trg_no_nested_master` ne surveille que `master_id`).

**Correction proposée.**
```sql
-- 1) Un utilisateur ne peut plus toucher aux cases sensibles de sa fiche
create or replace function public.protege_champs_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    if new.role is distinct from old.role
       or new.is_owner is distinct from old.is_owner
       or new.statut is distinct from old.statut
       or new.master_id is distinct from old.master_id
       or new.dessinateur_id is distinct from old.dessinateur_id then
      raise exception 'Modification interdite de ce champ';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_protege_champs_profil on public.profiles;
create trigger trg_protege_champs_profil
  before update on public.profiles
  for each row execute function public.protege_champs_profil();
```

---

## 2. L'inscription permet de créer un compte « admin » déjà actif

**Le problème.** Au moment de l'inscription, le rôle est envoyé **par le navigateur** (`options.data.role`). La fonction `handle_new_user()` recopie ce rôle tel quel, et pire : si le rôle vaut `admin`, elle met le statut à `actif` **sans validation par un humain**.

Il suffit donc de s'inscrire en envoyant `role: "admin"` pour obtenir un compte actif immédiatement, en sautant complètement l'étape « un administrateur examine votre demande ».

**Correction proposée.**
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nom, prenom, role, statut)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    -- seuls ces deux rôles sont acceptés à l'inscription, jamais 'admin'
    case when new.raw_user_meta_data->>'role' = 'dessinateur'
         then 'dessinateur' else 'utilisateur' end,
    'en_attente'   -- TOUJOURS en attente, sans exception
  );
  return new;
end $$;
```

---

## 3. Le service d'envoi d'emails est ouvert à tout Internet

**Le problème.** Les **10 fonctions serveur** sont configurées avec `verify_jwt: false` — autrement dit, elles répondent à n'importe qui, sans connexion.

La plus dangereuse est `send-email` : elle accepte un destinataire, un sujet et un contenu HTML **libres**, et n'effectue **aucune vérification**. N'importe qui dans le monde peut donc envoyer les emails qu'il veut, signés `noreply@incendieplan.fr`.

**Ce que ça permet :** de l'hameçonnage (« phishing ») aux couleurs de votre marque, envoyé à vos clients ; la mise en liste noire de votre domaine (vos vrais emails finiraient en spam) ; une facture Resend qui explose.

Les fonctions `notify-*` sont dans le même cas : elles déclenchent des emails sans vérifier qui appelle.

*(Bon point : `invite-user`, `delete-user` et `update-user-email` vérifient bien elles-mêmes que l'appelant est propriétaire.)*

**Correction proposée.** Dans Supabase → Edge Functions, activer **Verify JWT** sur toutes les fonctions. Puis, dans `send-email` et chaque `notify-*`, ajouter en début de code une vérification du jeton de l'appelant (comme celle déjà présente dans `delete-user`). Idéalement, `send-email` ne devrait être appelable **que** par les autres fonctions serveur, jamais depuis le navigateur.

---

## 4. Tous les fichiers des plans sont publics

**Le problème.** Le dossier de stockage `fichiers` est marqué **public**, et la règle `Lecture publique fichiers` autorise la lecture à tout le monde, connecté ou non.

Les **779 fichiers** (plans d'évacuation, plans d'intervention, documents clients, avec adresses de bâtiments) sont donc téléchargeables par toute personne qui possède ou devine l'adresse du fichier. Un lien transféré par email, retrouvé dans un historique, ou indexé par un moteur de recherche suffit.

**Correction proposée.** Passer le dossier `fichiers` en **privé**, remplacer la lecture publique par une règle réservée aux personnes concernées par la commande, et faire générer par l'application des **liens temporaires** (« signed URLs », valables par exemple 1 heure). Le dossier `avatars` peut rester public, ce n'est pas sensible.

Attention : Cette correction demande une petite modification du code d'affichage des fichiers — à faire ensemble, pas à la va-vite.

---

## 5. Tout compte connecté peut effacer ou remplacer TOUS les fichiers

**Le problème.** Les règles `Suppression authentifiée fichiers` et `Update authentifié fichiers` disent seulement « il faut être connecté ». Elles ne vérifient **pas** que le fichier appartient à la personne.

N'importe quel compte — y compris un compte en attente de validation — peut donc supprimer les 779 fichiers, ou remplacer un plan par un autre document sans que personne ne le voie.

**Correction proposée.**
```sql
drop policy "Suppression authentifiée fichiers" on storage.objects;
drop policy "Update authentifié fichiers" on storage.objects;

-- seuls le propriétaire du fichier et l'administrateur peuvent effacer/remplacer
create policy "fichiers_delete_proprietaire" on storage.objects for delete
  using (bucket_id = 'fichiers' and (owner = auth.uid() or public.is_admin()));

create policy "fichiers_update_proprietaire" on storage.objects for update
  using (bucket_id = 'fichiers' and (owner = auth.uid() or public.is_admin()))
  with check (bucket_id = 'fichiers' and (owner = auth.uid() or public.is_admin()));
```

---

# ÉLEVÉ

## 6. Dépôt de fichiers anonyme, sans aucune limite

La règle `validation_anon_upload` laisse **n'importe qui, sans compte**, déposer des fichiers dans `fichiers/validation/`. Et le dossier `fichiers` n'a **ni limite de taille, ni liste de types autorisés**.

Conséquence : quelqu'un peut y stocker autant de fichiers qu'il veut, de n'importe quel type (virus, contenu illégal), hébergés sous votre nom, et faire gonfler votre facture de stockage.

**Correction :** fixer une limite de taille (ex. 20 Mo) et une liste de types autorisés (PDF, images) sur le dossier `fichiers`, et n'autoriser le dépôt anonyme que si un jeton de validation valide est présenté.

## 7. La table `alertes` est en accès totalement libre

Une règle nommée `Allow all` autorise **tout le monde** (même sans compte) à lire, ajouter, modifier et supprimer les 5 lignes de cette table. Elle contient les messages bloqués par la modération (colonnes `auteur`, `message_bloque`) — donc du contenu privé de conversations.

**Correction :**
```sql
drop policy "Allow all" on public.alertes;
create policy "alertes_admin" on public.alertes for all
  to authenticated using (public.is_admin()) with check (public.is_admin());
```

## 8. La table `notes_clients` n'a aucune protection

La sécurité par ligne (RLS) est **désactivée** sur cette table, et elle n'a aucune règle. Elle est donc entièrement exposée en lecture, écriture et suppression à toute personne possédant la clé publique du site — clé qui est visible dans le code du navigateur.

Elle est vide aujourd'hui, mais **la première note écrite dedans sera publique**.

**Correction :**
```sql
alter table public.notes_clients enable row level security;
create policy "notes_clients_dessinateur" on public.notes_clients for all
  to authenticated
  using (dessinateur_id = auth.uid() or public.is_admin())
  with check (dessinateur_id = auth.uid() or public.is_admin());
```

## 9. Bannir un compte ne coupe pas vraiment son accès

Le statut du compte (`en_attente`, `refuse`, `banni`) n'est vérifié **que par l'écran React** (`RequireAuth.js`). La base de données, elle, ne le vérifie presque jamais — seule la création de commande exige `statut = 'actif'`.

Un compte banni conserve donc un jeton de connexion valide et peut continuer à interroger l'API directement (hors du site) : lire les tables Odoo, lire les messages et versions des commandes qu'il voyait, supprimer des fichiers du stockage.

**Correction :** ajouter la condition « compte actif » dans les règles de la base. Le plus simple est une fonction réutilisable :
```sql
create or replace function public.est_actif() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and statut = 'actif');
$$;
```
... puis l'ajouter (`and public.est_actif()`) dans les règles de `commandes`, `messages`, `versions`, `tickets`, `odoo_*` et du stockage.

---

# MOYEN

## 10. Les tables Odoo sont lisibles par tout compte connecté
`odoo_clients`, `odoo_commandes`, `odoo_factures`, `odoo_sync_state` ont une règle de lecture `true` pour tout compte connecté. Ces tables sont vides aujourd'hui, mais elles sont prévues pour contenir votre fichier clients et vos factures. Le jour où elles seront remplies, **le moindre client inscrit verra la totalité**. À restreindre aux administrateurs avant toute synchronisation.

## 11. Messages modifiables par autrui, et faux auteur possible
Les règles de la table `messages` vérifient seulement que la commande est visible. Conséquences : on peut **modifier ou supprimer le message de quelqu'un d'autre** sur une commande partagée, et le champ `auteur` étant du texte libre envoyé par le navigateur, on peut **écrire un message en se faisant passer pour un autre**. Même remarque pour `versions` : tout participant peut ajouter une version.
→ Ajouter dans les règles la condition « l'auteur, c'est bien moi » et lier l'auteur à `auth.uid()` plutôt qu'à un nom en texte.

## 12. Texte injectable dans les emails automatiques
Dans les fonctions serveur, les valeurs `${prenom}`, `${nom_plan}`, `${auteur_nom}` sont insérées **directement** dans le HTML de l'email, sans nettoyage. Quelqu'un peut nommer un plan de façon à glisser un faux bouton ou un lien piégé dans un email qui, lui, est parfaitement authentique. Combiné au point 3, c'est un bon outil d'hameçonnage.
→ Échapper les caractères `< > & " '` avant insertion.

## 13. 52 failles connues dans les librairies
`npm audit` remonte **52 vulnérabilités : 2 critiques, 28 élevées**. La grande majorité vient de `react-scripts 5.0.1`, un outil de construction qui n'est plus maintenu — ces failles concernent surtout votre ordinateur au moment de la compilation, pas les visiteurs.
Deux exceptions à traiter, car elles tournent chez le visiteur : `react-router-dom` (avis CSRF et déni de service). À mettre à jour.

---

# FAIBLE (à faire quand il y aura le temps)

**14. Mots de passe compromis autorisés.** La protection Supabase qui refuse les mots de passe déjà volés sur Internet (HaveIBeenPwned) est désactivée. La longueur minimale de 8 caractères n'est vérifiée que par l'écran, pas par le serveur. → Activer dans Supabase → Authentication → Passwords.

**15. Aucun en-tête de sécurité.** `vercel.json` ne contient qu'une redirection. Il manque les protections standard du navigateur (`X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`…). Sans `X-Frame-Options`, un site malveillant peut afficher incendieplan.fr dans un cadre invisible pour piéger les clics.

**16. Fonctions internes appelables sans être connecté.** Neuf fonctions `SECURITY DEFINER` sont exposées à l'API publique, dont `handle_new_user()` qui ne devrait être qu'un déclencheur interne. Sept fonctions n'ont pas de `search_path` fixé. → Retirer le droit d'exécution (`revoke execute ... from anon`) sur celles qui ne servent pas à la page publique de validation, et ajouter `set search_path = public` partout.

**17. Le partage d'origine (CORS) est ouvert à `*`** sur toutes les fonctions serveur. → Le limiter à `https://incendieplan.fr`.

**18. Hygiène des comptes.** Il y a **8 comptes de connexion pour seulement 4 fiches**. Quatre comptes existent donc sans profil : ils ne peuvent pas utiliser le site, mais ils possèdent un jeton valide. À nettoyer.

---

# Ce qui va bien

- **Aucune faille XSS dans le site** : pas de `dangerouslySetInnerHTML`, pas de `eval`, pas de `innerHTML`. React protège correctement l'affichage.
- **Aucun mot de passe ni clé secrète dans le code.** La clé présente dans `src/supabase.js` est la clé *publiable*, c'est normal qu'elle soit là.
- **Aucune donnée sensible stockée dans le navigateur** (`localStorage`) au-delà de ce que gère Supabase.
- **Les 3 fonctions serveur sensibles** (`invite-user`, `delete-user`, `update-user-email`) vérifient correctement que l'appelant est propriétaire.
- **La RLS est activée sur 22 tables sur 23**, avec des règles souvent bien pensées (tickets, annonces, commandes).
- **Le jeton de validation client est bien conçu** : 24 octets aléatoires, stocké haché en SHA-256, avec une expiration à 30 jours.
- **Le mot de passe est bien géré par Supabase**, jamais manipulé par le site.

---

# Ordre de correction conseillé

1. **Aujourd'hui** — points 1 et 2 (blocage de l'auto-promotion en administrateur). Deux commandes SQL, effet immédiat, aucun changement dans le site.
2. **Aujourd'hui** — point 5 (protection contre l'effacement des fichiers) et points 7 et 8 (tables ouvertes). SQL uniquement.
3. **Cette semaine** — point 3 (fermeture de l'envoi d'emails) : réglage Supabase + petite modification des fonctions.
4. **Cette semaine** — point 6 (limites sur les dépôts de fichiers).
5. **Ensuite, ensemble** — point 4 (fichiers privés avec liens temporaires) : c'est le seul qui demande de toucher au site, donc à tester avant.
6. **Puis** — points 9 à 13.
7. **Quand il y aura le temps** — points 14 à 18.
