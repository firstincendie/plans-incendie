# Révision de sécurité — Incendie Plan (incendieplan.fr)

Date : 23 août 2026 · Base analysée : projet Supabase `plans-incendie` (custkyapdbvzkuxgurla) · Code : branche `main`

**Résumé en une phrase :** le site lui-même est bien écrit, mais **les portes de la base de données et du stockage sont grandes ouvertes**. Aujourd'hui, n'importe quelle personne ayant un compte peut se transformer en administrateur, et n'importe qui sur Internet peut lire tous les plans et envoyer des emails au nom de incendieplan.fr.

Chiffres concernés : **123 commandes**, **779 fichiers**, **8 comptes**.

---

## Tableau de bord

| # | Problème | Gravité | Qui peut en profiter |
|---|---|---|---|
| 1 | Un simple compte peut se nommer administrateur | ~~CRITIQUE~~ **CORRIGÉ** | ~~Tout compte connecté~~ |
| 2 | L'inscription permet de créer un compte « admin » actif direct | ~~CRITIQUE~~ **CORRIGÉ** | ~~N'importe qui~~ |
| 3 | Le service d'envoi d'emails est ouvert sans mot de passe | ~~CRITIQUE~~ **CORRIGÉ** | ~~N'importe qui~~ |
| 4 | Tous les fichiers des plans sont publics | ~~CRITIQUE~~ **CORRIGÉ** | ~~N'importe qui avec le lien~~ |
| 5 | Tout compte connecté peut effacer TOUS les fichiers | ~~CRITIQUE~~ **CORRIGÉ** | ~~Tout compte connecté~~ |
| 6 | Dépôt de fichiers anonyme, sans limite de taille | ~~ÉLEVÉ~~ **CORRIGÉ** | ~~N'importe qui~~ |
| 7 | Table `alertes` en accès libre (lecture + écriture) | ~~ÉLEVÉ~~ **CORRIGÉ** | ~~N'importe qui~~ |
| 8 | Table `notes_clients` sans aucune protection | ~~ÉLEVÉ~~ **CORRIGÉ** | ~~N'importe qui~~ |
| 9 | Bannir un compte ne coupe pas vraiment son accès | ~~ÉLEVÉ~~ **CORRIGÉ** | ~~Compte banni / en attente~~ |
| 10 | Tables Odoo lisibles par tout compte connecté | ~~MOYEN~~ **CORRIGÉ** | ~~Tout compte connecté~~ |
| 11 | Messages modifiables par autrui, faux auteur possible | **CORRIGÉ en partie** | Participant d'une commande |
| 12 | Texte injectable dans les emails automatiques | ~~MOYEN~~ **CORRIGÉ** | ~~Tout compte connecté~~ |
| 13 | 52 failles dans les librairies (2 critiques) | ~~MOYEN~~ **CORRIGÉ** (côté visiteur) | — |
| 14 | Mots de passe compromis autorisés | ~~FAIBLE~~ **CORRIGÉ** | — |
| 15 | Aucun en-tête de sécurité sur le site | **CORRIGÉ** (actif à la prochaine publication) | — |
| 16 | Fonctions internes appelables sans être connecté | ~~FAIBLE~~ **CORRIGÉ** | — |

---

# CRITIQUE — à corriger en premier

## 1. Un simple compte peut se nommer administrateur — CORRIGÉ le 23/08/2026

> Correctif appliqué : `supabase/migrations/20260823053854_protege_champs_sensibles_profil.sql`.
> Vérifié : l'auto-promotion est bloquée, et la modification du prénom, le rattachement
> à un groupe, la gestion des comptes par le propriétaire et les fonctions serveur
> fonctionnent toujours.

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

## 2. L'inscription permet de créer un compte « admin » déjà actif — CORRIGÉ le 23/08/2026

> Correctif appliqué : `supabase/migrations/20260823060000_inscription_toujours_utilisateur_en_attente.sql`.
> Choix de Simon : toute inscription libre donne un compte **utilisateur en attente**.
> Vérifié avec une inscription simulée réclamant « admin » : elle ressort en
> `utilisateur` / `en_attente`. Les invitations gardent le bon rôle.
> Corrige aussi un bug latent : le rôle par défaut `client` violait la contrainte.
> Conséquence : un dessinateur qui s'inscrit seul doit être promu à la main
> depuis Gestion utilisateurs. Le choix de rôle affiché sur la page d'inscription
> n'a plus d'effet — à retirer ou à transformer en simple souhait.

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

## 3. Le service d'envoi d'emails est ouvert à tout Internet — CORRIGÉ le 23/08/2026

> Les 7 fonctions concernées ont été réécrites et redéployées (`supabase/functions/`).
> - `send-email` n'accepte plus que la **clé de service**, que seules les autres fonctions
>   serveur possèdent : elle n'est plus joignable depuis un navigateur.
> - Les 6 `notify-*` exigent un utilisateur **connecté et actif** ; `notify-activation`
>   exige en plus d'être **propriétaire**, et `notify-inscription` lit le nom et l'email
>   dans la fiche de l'appelant au lieu du corps de la requête.
> - `verify_jwt` reste volontairement désactivé : il laisserait passer n'importe quel
>   utilisateur connecté, donc moins strict que le contrôle fait dans le code.
> Corrige en même temps les constats **12** (échappement du HTML des emails), **11 en partie**
> (l'auteur d'un message est l'utilisateur authentifié, plus une valeur du navigateur)
> et **17** (CORS limité à incendieplan.fr, ses previews Vercel et localhost:3000).
>
> **Vérifié en conditions réelles**, en appelant les fonctions depuis l'extérieur :
> les 10 tentatives sans compte ou avec la clé publique du site sont refusées (401/403) ;
> un compte de test *en attente* est refusé ; le même compte *actif* est accepté ;
> un compte actif non-propriétaire est refusé sur `notify-activation` ; et la chaîne
> complète `notify-commande` → `send-email` → Resend a bien envoyé (`envoyes: 1`).
> Compte de test et outils de test supprimés ensuite ; base identique à l'avant-test.

**Le problème.** Les **10 fonctions serveur** sont configurées avec `verify_jwt: false` — autrement dit, elles répondent à n'importe qui, sans connexion.

La plus dangereuse est `send-email` : elle accepte un destinataire, un sujet et un contenu HTML **libres**, et n'effectue **aucune vérification**. N'importe qui dans le monde peut donc envoyer les emails qu'il veut, signés `noreply@incendieplan.fr`.

**Ce que ça permet :** de l'hameçonnage (« phishing ») aux couleurs de votre marque, envoyé à vos clients ; la mise en liste noire de votre domaine (vos vrais emails finiraient en spam) ; une facture Resend qui explose.

Les fonctions `notify-*` sont dans le même cas : elles déclenchent des emails sans vérifier qui appelle.

*(Bon point : `invite-user`, `delete-user` et `update-user-email` vérifient bien elles-mêmes que l'appelant est propriétaire.)*

**Correction proposée.** Dans Supabase → Edge Functions, activer **Verify JWT** sur toutes les fonctions. Puis, dans `send-email` et chaque `notify-*`, ajouter en début de code une vérification du jeton de l'appelant (comme celle déjà présente dans `delete-user`). Idéalement, `send-email` ne devrait être appelable **que** par les autres fonctions serveur, jamais depuis le navigateur.

---

## 4. Tous les fichiers des plans sont publics — CORRIGÉ le 23/08/2026

> Fait en deux temps, dans l'ordre imposé.
> **1.** Le site a été adapté (`helpers.js`, `VisuFichier.js`, `ZoneUpload.js`) pour
> demander des **liens temporaires d'une heure**, puis publié par Simon et vérifié.
> Les 705 adresses publiques déjà en base ne sont pas réécrites : on en extrait le
> chemin à chaque affichage.
> **2.** Le dossier est ensuite passé en **privé**, lecture réservée aux comptes
> connectés et actifs.
> Vérifié : un visiteur sans compte ne lit plus rien ; client et dessinateur
> connectés lisent les 778 fichiers ; un compte banni est bloqué ; les avatars sont
> intacts.
>
> **Limite connue.** 597 fichiers sont déposés à la racine du dossier, sans
> rattachement à une commande dans leur chemin. Impossible donc de cloisonner par
> client sans revoir l'organisation des chemins. **Tout compte actif peut lire les
> fichiers du dossier** — sans commune mesure avec « tout Internet », mais ce n'est
> pas un cloisonnement client par client. À traiter dans un second temps.

**Le problème.** Le dossier de stockage `fichiers` est marqué **public**, et la règle `Lecture publique fichiers` autorise la lecture à tout le monde, connecté ou non.

Les **779 fichiers** (plans d'évacuation, plans d'intervention, documents clients, avec adresses de bâtiments) sont donc téléchargeables par toute personne qui possède ou devine l'adresse du fichier. Un lien transféré par email, retrouvé dans un historique, ou indexé par un moteur de recherche suffit.

**Correction proposée.** Passer le dossier `fichiers` en **privé**, remplacer la lecture publique par une règle réservée aux personnes concernées par la commande, et faire générer par l'application des **liens temporaires** (« signed URLs », valables par exemple 1 heure). Le dossier `avatars` peut rester public, ce n'est pas sensible.

### Plan précis (préparé le 23/08/2026, pas encore appliqué)

**La difficulté n'est pas de rendre le dossier privé — c'est que 555 fiches en base
stockent déjà des adresses publiques** qui cesseraient de fonctionner :

| Emplacement | Fiches concernées |
|---|---|
| `commandes.fichiers_plan` | 123 |
| `versions.fichiers` | 239 |
| `messages.fichiers` | 122 |
| `commandes.plans_finalises` | 71 |

**3 endroits fabriquent une adresse publique** (à remplacer) :
`ZoneUpload.js:17`, `Messagerie.js:212`, `ModalDetailCommande.js:316`.
*(`PageMonCompte.js:135` concerne les avatars : à laisser tel quel, ce dossier reste public.)*

**3 écrans affichent les fichiers** (à adapter) : `VisuFichier.js`, `ZoneUpload.js`, `DetailCommandeModal.js`.

**Marche à suivre, dans cet ordre :**
1. Ajouter dans `src/helpers.js` une fonction qui, à partir d'une adresse stockée,
   extrait le chemin du fichier et demande un **lien temporaire** (`createSignedUrl`,
   1 heure). Elle doit accepter les deux formes : anciennes adresses publiques déjà
   en base, et nouveaux chemins.
2. Faire passer les 3 écrans d'affichage par cette fonction.
3. Ne plus stocker l'adresse complète mais **le chemin** pour les nouveaux dépôts.
4. Publier le site et **vérifier qu'un plan s'affiche encore**.
5. **Seulement ensuite** : passer le dossier `fichiers` en privé et remplacer la règle
   « Lecture publique fichiers » par une règle réservée aux personnes concernées par
   la commande.

**L'ordre est impératif** : passer le dossier en privé avant de publier le site
casserait l'affichage de tous les plans, y compris sur la version actuellement en
ligne. C'est pour cela que ce point n'a pas été appliqué en autonomie.

---

## 5. Tout compte connecté peut effacer ou remplacer TOUS les fichiers — CORRIGÉ le 23/08/2026

> Correctif appliqué : `supabase/migrations/20260823061500_storage_fichiers_suppression_restreinte.sql`.
> Suppression réservée au propriétaire du fichier et à l'administrateur ;
> remplacement idem, plus le dessinateur assigné pour les `finals/<id_commande>/…`
> (nécessaire car `deposerPlanFinal()` dépose en `upsert` et une commande peut
> changer de dessinateur).
> Vérifié : un compte client ne peut plus effacer que ses 2 propres fichiers,
> les 776 autres sont protégés. Un dessinateur non assigné ne peut plus remplacer
> un plan final ; le dessinateur assigné et l'administrateur le peuvent toujours.
> Le site ne supprime jamais de fichier : aucune fonctionnalité restreinte.

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

## 6. Dépôt de fichiers anonyme, sans aucune limite — CORRIGÉ le 23/08/2026

> Correctif : `supabase/migrations/20260823175303_limite_depots_fichiers_et_anonymes.sql`.
> Limite de taille à **50 Mo** sur le bucket (le plus gros fichier existant fait 30 Mo).
> Le dépôt anonyme n'est plus accepté que sous `validation/<id_commande>/…` **et**
> uniquement si cette commande a un lien de validation actif et non expiré.
> Vérifié : dépôt anonyme sur une commande sans lien → bloqué ; à la racine du
> stockage → bloqué ; avec un lien actif → accepté ; avec un lien expiré → bloqué.
>
> **Pas de liste blanche de types de fichiers**, volontairement : le site accepte
> aussi `.dwg` et `.dxf`, que les navigateurs envoient souvent en
> `application/octet-stream`. Une liste qui inclut ce type n'apporterait rien ;
> une liste qui l'exclut casserait le dépôt de plans CAO.

La règle `validation_anon_upload` laisse **n'importe qui, sans compte**, déposer des fichiers dans `fichiers/validation/`. Et le dossier `fichiers` n'a **ni limite de taille, ni liste de types autorisés**.

Conséquence : quelqu'un peut y stocker autant de fichiers qu'il veut, de n'importe quel type (virus, contenu illégal), hébergés sous votre nom, et faire gonfler votre facture de stockage.

**Correction :** fixer une limite de taille (ex. 20 Mo) et une liste de types autorisés (PDF, images) sur le dossier `fichiers`, et n'autoriser le dépôt anonyme que si un jeton de validation valide est présenté.

## 7. La table `alertes` est en accès totalement libre — CORRIGÉ le 23/08/2026

> Correctif : `supabase/migrations/20260823063000_fermeture_tables_alertes_et_notes_clients.sql`.
> Lecture, modification et suppression réservées à l'administrateur. L'insertion
> reste ouverte aux comptes connectés — `Messagerie.js` enregistre l'alerte au
> moment où le message est bloqué, et n'inspecte pas l'erreur : un refus serait
> passé inaperçu et la modération n'aurait plus rien tracé.
> Vérifié : un visiteur non connecté ne lit ni n'écrit plus rien ; un utilisateur
> normal ne lit rien et n'efface rien mais déclenche bien une alerte ;
> l'administrateur lit les 5 alertes.

Une règle nommée `Allow all` autorise **tout le monde** (même sans compte) à lire, ajouter, modifier et supprimer les 5 lignes de cette table. Elle contient les messages bloqués par la modération (colonnes `auteur`, `message_bloque`) — donc du contenu privé de conversations.

**Correction :**
```sql
drop policy "Allow all" on public.alertes;
create policy "alertes_admin" on public.alertes for all
  to authenticated using (public.is_admin()) with check (public.is_admin());
```

## 8. La table `notes_clients` n'a aucune protection — CORRIGÉ le 23/08/2026

> Correctif : même migration. RLS activée, chaque dessinateur ne voit que ses
> propres notes ; l'administrateur voit tout.
> Vérifié : un visiteur non connecté ne peut plus écrire ; un dessinateur écrit
> et relit sa note ; un autre dessinateur ne la voit pas.
> L'erreur « RLS Disabled in Public » a disparu du contrôle Supabase — il ne
> reste plus aucune erreur, uniquement des avertissements (constats 14 et 16).

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

## 9. Bannir un compte ne coupe pas vraiment son accès — CORRIGÉ le 23/08/2026

> Correctif : `supabase/migrations/20260823180416_exige_compte_actif_dans_la_base.sql`.
> Fonction `est_actif()` + politiques **RESTRICTIVE** sur `commandes`, `messages`,
> `versions` et le stockage des plans. Ces politiques se combinent en « ET » avec les
> règles existantes sans les réécrire, donc sans risque d'avoir mal recopié une règle
> métier.
> Vérifié : un dessinateur temporairement banni ne lit plus aucune commande, aucun
> message, aucune version, et ne peut plus remplacer de plan ; remis actif, il
> retrouve tout (116 commandes, 1072 messages). Client et administrateur inchangés.

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

## 10. Les tables Odoo sont lisibles par tout compte connecté — CORRIGÉ le 23/08/2026

> Lecture réservée à l'administrateur. Aucune version du site n'interroge ces tables :
> vérifié dans `main` **et** dans la version en ligne d'avril.
`odoo_clients`, `odoo_commandes`, `odoo_factures`, `odoo_sync_state` ont une règle de lecture `true` pour tout compte connecté. Ces tables sont vides aujourd'hui, mais elles sont prévues pour contenir votre fichier clients et vos factures. Le jour où elles seront remplies, **le moindre client inscrit verra la totalité**. À restreindre aux administrateurs avant toute synchronisation.

## 11. Messages modifiables par autrui, et faux auteur possible — CORRIGÉ EN PARTIE le 23/08/2026

> **Fait** : un trigger empêche de modifier le message de quelqu'un d'autre. Seul le
> champ « lu par » peut changer, car le site marque comme lus les messages des autres
> (déjà le cas dans la version en ligne d'avril).
> Vérifié : réécrire ou s'attribuer le message d'un autre est bloqué ; marquer comme
> lu et modifier son propre message fonctionnent toujours.
>
> **Reste à faire, avec Simon** : empêcher d'écrire un message sous un faux nom. Le
> champ `auteur` est un texte libre ; le corriger proprement demande d'ajouter une
> colonne `auteur_id` liée au compte, donc **une modification du site**. Un contrôle
> par comparaison de nom serait fragile : il refuserait les messages d'un utilisateur
> renommé en cours de session.
Les règles de la table `messages` vérifient seulement que la commande est visible. Conséquences : on peut **modifier ou supprimer le message de quelqu'un d'autre** sur une commande partagée, et le champ `auteur` étant du texte libre envoyé par le navigateur, on peut **écrire un message en se faisant passer pour un autre**. Même remarque pour `versions` : tout participant peut ajouter une version.
→ Ajouter dans les règles la condition « l'auteur, c'est bien moi » et lier l'auteur à `auth.uid()` plutôt qu'à un nom en texte.

## 12. Texte injectable dans les emails automatiques — CORRIGÉ le 23/08/2026

> Corrigé avec le constat 3 : une fonction `esc()` échappe `< > & " '` avant toute
> insertion dans le HTML. Les sujets d'emails, qui sont du texte brut, ne sont pas
> échappés (sinon on y verrait des codes). Le nom du plan est de plus lu dans la base
> plutôt que dans le corps de la requête.
Dans les fonctions serveur, les valeurs `${prenom}`, `${nom_plan}`, `${auteur_nom}` sont insérées **directement** dans le HTML de l'email, sans nettoyage. Quelqu'un peut nommer un plan de façon à glisser un faux bouton ou un lien piégé dans un email qui, lui, est parfaitement authentique. Combiné au point 3, c'est un bon outil d'hameçonnage.
→ Échapper les caractères `< > & " '` avant insertion.

## 13. 52 failles connues dans les librairies — CORRIGÉ le 23/08/2026 (côté visiteur)

> **Le chiffre de 52 était trompeur.** `react-scripts` et toute sa chaîne sont déclarés
> comme dépendances normales alors que ce sont des **outils de construction** : ils ne
> partent jamais chez le visiteur. Le site n'embarque en réalité que 4 paquets :
> `react`, `react-dom`, `react-router-dom` et `@supabase/supabase-js`.
>
> **Fait :**
> - `react-router-dom` passé de **7.14.2 à 7.18.2** — c'était le seul paquet livré au
>   navigateur qui portait des avis de sécurité (CSRF, déni de service).
> - `yaml` retiré : déclaré mais **utilisé nulle part** dans le projet.
>
> **Résultat : plus aucun paquet vulnérable dans ce qui tourne chez le visiteur.**
> Vérifié : le site se construit toujours (162,8 ko contre 162,5 ko avant), les 15 pages
> sont là, les tests passent, et la page produite ne charge **aucune ressource externe**
> (règle du projet).
>
> **Reste (sans urgence)** : 50 avis subsistent, tous sur les outils de construction —
> ils concernent l'ordinateur qui compile, pas les visiteurs. La vraie sortie est de
> quitter `react-scripts`, qui n'est plus maintenu, pour un outil moderne (Vite). C'est
> un chantier à part entière, à planifier calmement.
>
> À noter aussi : le projet ne contient **qu'un seul test**, et il ne vérifie rien
> (`expect(true)`). Il n'y a donc pas de filet de sécurité automatique.
`npm audit` remonte **52 vulnérabilités : 2 critiques, 28 élevées**. La grande majorité vient de `react-scripts 5.0.1`, un outil de construction qui n'est plus maintenu — ces failles concernent surtout votre ordinateur au moment de la compilation, pas les visiteurs.
Deux exceptions à traiter, car elles tournent chez le visiteur : `react-router-dom` (avis CSRF et déni de service). À mettre à jour.

---

# FAIBLE (à faire quand il y aura le temps)

**14. Mots de passe compromis autorisés — CORRIGÉ le 23/08/2026 par Simon.**
Protection HaveIBeenPwned activée et longueur minimale portée à 8 dans Supabase.
Vérifié : l'avertissement `auth_leaked_password_protection` a disparu du contrôle Supabase.
_Constat d'origine :_ La protection Supabase qui refuse les mots de passe déjà volés sur Internet (HaveIBeenPwned) est désactivée. La longueur minimale de 8 caractères n'est vérifiée que par l'écran, pas par le serveur. → Activer dans Supabase → Authentication → Passwords.

**15. Aucun en-tête de sécurité — CORRIGÉ le 23/08/2026.** `vercel.json` ajoute désormais
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Strict-Transport-Security` et `Permissions-Policy`. **Ces protections ne seront
actives qu'à la prochaine publication du site.** Pas de `Content-Security-Policy` :
trop strict, il casserait l'affichage s'il n'est pas testé écran par écran.
_Constat d'origine :_ `vercel.json` ne contient qu'une redirection. Il manque les protections standard du navigateur (`X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`…). Sans `X-Frame-Options`, un site malveillant peut afficher incendieplan.fr dans un cadre invisible pour piéger les clics.

**16. Fonctions internes appelables sans être connecté — CORRIGÉ le 23/08/2026.**
`search_path` figé sur les 12 fonctions à privilèges. Les 6 fonctions qui ne sont que
des déclencheurs internes (`handle_new_user`, `protege_champs_profil`, `set_updated_at`,
`generate_invite_code`, `check_no_nested_master`, `fill_commande_ref`) ne sont plus
joignables depuis l'API, ni par un anonyme ni par un compte connecté ; vérifié que
l'inscription, la génération du code d'invitation et la référence automatique des
commandes fonctionnent toujours. `set_dessinateurs_utilisateur` et
`peut_deposer_plan_final` sont fermées aux anonymes.
Restent volontairement ouvertes : `is_admin`, `is_owner`, `est_mon_dessinateur`
(utilisées dans des règles RLS évaluées aussi sous anon — les fermer ferait échouer
ces requêtes) et les 5 `validation_*` (page publique de validation).
Le linter Supabase ne remonte plus aucun avertissement `search_path`.
_Constat d'origine :_ Neuf fonctions `SECURITY DEFINER` sont exposées à l'API publique, dont `handle_new_user()` qui ne devrait être qu'un déclencheur interne. Sept fonctions n'ont pas de `search_path` fixé. → Retirer le droit d'exécution (`revoke execute ... from anon`) sur celles qui ne servent pas à la page publique de validation, et ajouter `set search_path = public` partout.

**17. Le partage d'origine (CORS) est ouvert à `*`** sur toutes les fonctions serveur. → Le limiter à `https://incendieplan.fr`.

**18. Hygiène des comptes — enquête faite le 23/08/2026, suppression en attente de Simon.**
Les 4 comptes sans fiche sont `user1@test.com`, `user2@test.com`, `dessinateur1@test.com`
et `dessinateur2@test.com`, tous créés le 23/03/2026. Vérifié : **jamais connectés,
0 commande liée, 0 fichier déposé**. Ce sont des comptes de test.
Ils ne sont plus dangereux depuis le constat 9 (un compte sans fiche ne voit plus rien),
mais ils n'ont rien à faire là. **Supprimés le 23/08/2026** sur accord de Simon.
Vérifié après suppression : 4 comptes pour 4 fiches, plus aucun orphelin ;
123 commandes, 1121 messages et 778 fichiers intacts.

---

# Vérification de deuxième passe (23/08/2026)

Après les 12 correctifs, j'ai refait un tour complet pour m'assurer qu'aucun nouveau trou
n'avait été créé.

**Les 23 tables ont la protection par ligne activée, et plus aucune règle n'est ouverte à tous.**

Test le plus parlant : j'ai créé un compte neuf, actif, sans aucun lien — le pire cas d'un
inscrit malveillant validé par erreur — et compté ce qu'il peut lire :

| Table | Il voit | Il existe en base |
|---|---|---|
| commandes | **0** | 123 |
| messages | **0** | 1 121 |
| versions | **0** | 239 |
| alertes | **0** | 5 |
| commande_notes | **0** | 17 |
| tickets / ticket_messages | **0** | 1 / 6 |
| validation_liens / réponses | **0** | 6 / 12 |
| utilisateur_dessinateurs | **0** | 3 |
| tables Odoo | **0** | 0 |
| profiles | 1 (la sienne) | 5 |
| annonces | 3 | 3 — *normal, les annonces s'adressent à tous* |

Avant les correctifs, ce même compte aurait pu se nommer propriétaire et tout lire.

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

1. ~~**Aujourd'hui** — points 1 et 2 (blocage de l'auto-promotion en administrateur).~~ **FAIT et vérifié.**
2. ~~**Aujourd'hui** — points 5, 7 et 8 (effacement des fichiers, tables ouvertes).~~ **FAIT et vérifié.**
3. ~~**Cette semaine** — point 3 (fermeture de l'envoi d'emails).~~ **FAIT et vérifié.**
4. ~~**Cette semaine** — point 6 (limites sur les dépôts de fichiers).~~ **FAIT et vérifié.**
5. ~~**Ensuite, ensemble** — point 4 (fichiers privés avec liens temporaires).~~ **FAIT.**
6. ~~**Puis** — points 9, 10, 11 (partie modification), 13.~~ **FAIT.**
7. ~~**Quand il y aura le temps** — points 14 à 18.~~ **FAIT.**

**Reste uniquement le point 4** (plans publics), qui demande de modifier puis republier le site.
