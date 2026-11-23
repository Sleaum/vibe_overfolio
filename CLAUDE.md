# Consignes pour Claude

Ce fichier est lu au début de chaque session sur ce dépôt. Le README décrit le projet (installation, architecture, fonctionnement) : le lire avant de modifier le code.

## Façon de travailler

- **Une PR par modification**, toujours créée à partir du `main` à jour (`git fetch origin main`). Ne jamais ajouter de commit à une PR déjà ouverte : elle peut être mergée à tout moment, et le commit serait perdu.
- Commits et PR en français, avec un titre qui dit ce qui change pour l'utilisateur.
- **README à tenir à jour dans la même PR** que le code : arborescence, pages, graphiques, schémas, apparence.
- Vérifier avant de pousser : `cd frontend && npm run build` (vérification TypeScript, build Vite et contrôle des couleurs en dur).
- Interface et documentation en français ; tutoiement dans les textes de l'interface.

## Couleurs et mode clair / sombre

- **`frontend/src/lib/theme.js` est la seule source des couleurs** (clair et sombre). Ne jamais écrire une valeur de couleur ailleurs.
- Composants : uniquement les classes de couleur (`bg-paper`, `text-ink`, `border-line`…), jamais `bg-white`, `text-black` ni de code couleur.
- Graphiques : couleurs prises dans `frontend/src/lib/palette.js`. Une couleur volontairement fixe (texte blanc sur une couleur de série) porte le commentaire `// couleur fixe` sur sa ligne, sinon le build affiche un avertissement.

## Langues

- Site en français (défaut et secours), anglais et thaï. **Aucun texte en dur** dans un composant ou un graphique : une clé dans `frontend/src/i18n/fr.json`, `en.json` **et** `th.json` (le build s'arrête s'il en manque une), puis `t('rubrique.cle')`. Le build vérifie aussi que chaque clé écrite dans le code existe.
- Nombres et dates : toujours par `frontend/src/lib/format.js` (langue active), jamais `new Intl.…('fr-FR')`.
- Ne pas traduire les données de la feuille (instruments, types d'actifs, colonnes) ni les adresses des pages.
- **Noms des menus toujours en anglais**, dans toutes les langues : GoogleSheet, Charts, Simulation, Flow, Snapshot, Envelopes, Strategy, Volatility, Budget. Ils sont dans `frontend/src/i18n/menu.js` (`MENU_NAMES`), jamais dans les fichiers de langue. Tout le reste est traduit, y compris les titres des pages ; une phrase qui renvoie à un menu reprend son nom anglais.
- Tout le site est traduit : tout nouveau texte arrive dans les trois langues dans la même PR, avec les mots du **glossaire** du README (section « Langues »). Signaler que le thaï est à faire relire.
- Graphiques : titre, résumé, explication et source en getters (`get title() { return t(…) }`), jamais en chaîne fixe.
- Erreurs de l'API : toujours avec un `code` (`backend/googlesheet/errors.py`), traduit dans la rubrique `apiErrors` des fichiers de langue.

## Préférences

- Toute préférence gardée par le navigateur passe par `frontend/src/lib/preferences.js` (liste `PREFERENCES`) : jamais d'appel direct à `localStorage`. C'est ce qui permettra de les ranger sur le compte plus tard.
- Les réglages à retrouver sur tous les appareils vont dans le **profil en base** (`backend/profiles`, `GET /api/profile/`) : couleurs des types d'actifs et mode clair / sombre. Profil du site sans connexion, un par compte connecté (`current_profile`).

## Fonctions à venir : à prévoir dès maintenant

### Comptes et connexion

La connexion avec un compte Google est branchée (`backend/accounts`, page `/newpage`, `frontend/src/lib/auth.js`) : session Django, compte retrouvé par l'identifiant Google `sub`. Elle est facultative : sans connexion, le site marche comme avant. **Garder l'adresse `/newpage`.**

Pour toute nouvelle fonction :

- l'API est encore publique sans connexion : toute nouvelle route sous `/api/` doit pouvoir être réservée aux comptes connectés plus tard sans changer son fonctionnement ;
- avec une session, les requêtes qui modifient exigent le jeton CSRF : passer par `request()` de `frontend/src/lib/api.js` (qui l'ajoute), jamais un `fetch` direct ; côté Django, ne pas désactiver l'authentification d'une vue (`authentication_classes([])`) ;
- un réglage propre à une personne et à retrouver sur tous ses appareils va dans le profil (`current_profile`) ; un réglage propre à un navigateur reste dans `lib/preferences.js` ;
- configuration GoogleSheet et données synchronisées sont **par propriétaire** (le site, ou un compte) : toute lecture ou écriture de `SheetConfig` / `SheetTable` passe par `config.request_owner(request)` et filtre sur `user` ; un compte n'hérite jamais du `.env` du site ;
- ne jamais écrire un jeton, un code OAuth, un secret ou une donnée sensible dans la console ou les logs.

## Sécurité

- Ne jamais commiter de secret : `.env`, clés privées, identifiants Google.
- Le dépôt est public. Une clé SSH privée (`keysave`) a été commitée par erreur puis retirée : elle reste dans l'historique git, ne jamais la réutiliser. Le `.gitignore` de la racine exclut désormais `.env`, les clés et les fichiers de compte de service.
