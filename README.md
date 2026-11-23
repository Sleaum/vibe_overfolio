# Overfolio

Suivi de patrimoine : frontend Vue.js, API Django, PostgreSQL, orchestrés avec Docker Compose et servis par nginx. Les données viennent d'un Google Sheet, lu en direct ou recopié en base.

## Structure du projet

```
overfolio/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── overfolio/                  # projet Django : configuration
│   │   ├── settings.py
│   │   └── urls.py                 # routage principal
│   ├── googlesheet/                # app : lecture et copie du Google Sheet
│   │   ├── services.py             # connexion Google, lecture des onglets
│   │   ├── views.py, urls.py       # GET /api/sheet (lecture en direct)
│   │   ├── data_views.py           # /api/data/ (lecture et synchronisation de la base)
│   │   ├── data_urls.py
│   │   ├── middleware.py           # DisableCSPMiddleware
│   │   ├── errors.py               # forme commune des erreurs de l'API (message, code, params)
│   │   ├── models.py               # SheetTable, SheetRow, SheetConfig, par propriétaire (voir « Base de données »)
│   │   ├── config.py               # paramètres d'accès (page GoogleSheet, sinon .env), correspondance des onglets
│   │   ├── sync.py                 # copie des onglets vers la base (sous le nom du site si l'onglet est relié)
│   │   ├── admin.py, tests.py, tests_tab_map.py
│   │   ├── migrations/
│   │   └── management/commands/sync_sheets.py
│   ├── accounts/                   # app : connexion avec Google (session Django)
│   │   ├── google.py               # OAuth 2.0 (code + PKCE), vérification du jeton d'identité
│   │   ├── drive.py                # mode 3 : accès aux feuilles choisies (drive.file), jeton chiffré, jeton court du Picker
│   │   ├── models.py               # GoogleAccount (sub Google, e-mail, nom, photo, accès Drive chiffré)
│   │   ├── services.py             # compte retrouvé par `sub` ou créé (profil du site recopié)
│   │   ├── views.py, urls.py       # /api/auth/ (start, callback, me, logout, drive/start, picker-token, drive/revoke)
│   │   ├── admin.py, tests.py, tests_drive.py
│   │   └── migrations/
│   ├── profiles/                   # app : profil gardé en base (couleurs des actifs, mode), un par compte
│   │   ├── models.py               # Profile (utilisateur facultatif, asset_colors, theme)
│   │   ├── views.py, urls.py       # /api/profile/
│   │   ├── admin.py, tests.py
│   │   └── migrations/
├── frontend/
│   ├── Dockerfile                  # stage "build" (Node 24, npm ci, Vite)
│   ├── index.html                  # page HTML ; pose le mode sombre avant l'affichage
│   ├── vite.config.ts              # build ; plugins « theme » (index.html, contrôle des couleurs) et « langues » (contrôle des traductions)
│   ├── tailwind.config.js          # classes de couleur et variables CSS générées depuis lib/theme.js, typographie, ombres
│   └── src/
│       ├── App.vue                 # en-tête, page affichée, pied de page, bandeau de l'export PDF
│       ├── router/index.ts         # routes (pages chargées à la demande)
│       ├── assets/tailwind.css     # base : focus clavier, animations réduites, colonne de contenu (aucune couleur)
│       ├── views/                  # une page par route
│       │   ├── HeroSection.vue     #   /                   présentation et vente
│       │   ├── SourcePage.vue      #   /sheet              onglets de la base, bouton Tout actualiser
│       │   ├── GraphiquesLayout.vue #  /graphiques         bouton Brut / Net, menu à gauche (6 entrées), couleurs des actifs, page choisie à droite
│       │   ├── GraphiquePage.vue   #   /graphiques/<nom>   un graphique
│       │   ├── PortfolioFlowPage.vue #  /portfolio-flow    l'historique mois par mois
│       │   ├── SnapshotPage.vue    #   /portfolio-snapshot  le patrimoine d'aujourd'hui
│       │   ├── StrategyPage.vue    #   /strategie          les actions : carte du monde, puis anneaux à deux niveaux
│       │   ├── EnvelopesPage.vue   #   /enveloppes         les enveloppes de placement (CTO, PEA, PER, PEE)
│       │   ├── VolatilityPage.vue  #   /volatilite         variation du prix de chaque placement
│       │   ├── SimulationPage.vue  #   /simulation         simulation de Monte-Carlo du patrimoine
│       │   ├── NotFoundPage.vue    #   toute autre adresse
│       │   └── NewPage.vue         #   /newpage            connexion avec Google
│       ├── components/
│       │   ├── Header.vue, Footer.vue   # en-tête : menus, bouton PDF, compte, langue, clair / sombre
│       │   ├── AccountMenu.vue     # en-tête : Connexion, ou photo du compte et menu (e-mail, Se déconnecter)
│       │   ├── PdfProgress.vue     # bandeau de progression de l'export PDF (absent du PDF)
│       │   ├── SheetSettings.vue   # formulaire « Connexion à Google Sheets » de la page /sheet
│       │   ├── SyncTabs.vue        # « Onglets à synchroniser » et onglets du document à cocher (page /sheet)
│       │   ├── TabMapping.vue      # « Correspondance des onglets » : onglet de ta feuille -> nom attendu par le site (page /sheet)
│       │   ├── ui/                 # AppButton, SegmentedControl, ThemeToggle (clair / sombre), LanguageSelect (langue)
│       │   ├── landing/            # sections de la page de présentation
│       │   └── charts/             # AssetColorSettings, BaseChart, ChartView, ChartCard, ChartGroup, DataTableView, ShareBars, StrategyCard, WorldMapCard
│       ├── i18n/                   # langues : index.js (liste, langue de départ), fr.json, en.json, th.json (textes),
│       │                           #   menu.js (noms des menus, toujours en anglais)
│       ├── composables/            # useTable (charge une table), useTheme (clair / sombre), useLocale (langue), useReducedMotion
│       └── lib/
│           ├── api.js              # appels /api/… (jeton CSRF ajouté aux requêtes qui modifient)
│           ├── auth.js             # état de la connexion (session), se connecter, se déconnecter
│           ├── googlePicker.js     # sélecteur de fichiers de Google (mode 3 de la page GoogleSheet)
│           ├── profile.js          # profil en base au démarrage et après connexion : couleurs, mode
│           ├── aggregate.js, dates.js, format.js   # calculs ; nombres, dates et noms de pays dans la langue active
│           ├── theme.js            # SOURCE UNIQUE des couleurs (clair et sombre)
│           ├── countries.js        # pays de la carte du monde (Strategy) : écritures de la colonne Area, centres
│           ├── preferences.js      # préférences gardées par le navigateur : thème, langue, réglages de la simulation, brut / net
│           ├── amounts.js          # bouton Brut / Net de Charts : montants bruts, nets ou dettes seules
│           ├── pdfExport.js        # bouton PDF : tout le site en un PDF, une page web = une page PDF
│           ├── palette.js, chartTheme.js, echartsSetup.js   # couleurs et briques communes des graphiques
│           ├── chartDark.js        # passe un graphique en sombre
│           ├── simulation.js, simulation.worker.js         # calculs de la page Simulation
│           ├── snapshot.js         # calculs de la page Snapshot
│           ├── strategy.js         # calculs de la page Strategy
│           ├── sample.js           # données FICTIVES de la page de présentation
│           └── charts/             # une spécification par graphique, index.js (liste et cartes) ; aides : sunburst, worldMap, assetDonut, evolution
├── nginx/
│   └── default.conf
├── .env                            # secrets, NE PAS COMMITER
├── .gitignore                      # exclut .env, clés SSH et fichiers de compte de service
├── docker-compose.yml
├── init.sh
├── CLAUDE.md                       # consignes pour Claude : façon de travailler, couleurs, fonctions à venir
└── README.md
```

## Prérequis

- Docker et Docker Compose v2 (`docker compose`)
- Un fichier `.env` à la racine (voir ci-dessous)
- Un Google Sheet partagé « Tous les utilisateurs disposant du lien », **ou** un compte de service Google qui a accès à la feuille (voir « Google Sheets »)

## Configuration : fichier `.env`

Exemple minimal :

```env
# Django
SECRET_KEY=une_cle_longue_et_aleatoire
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# PostgreSQL (lu par le conteneur db ET par settings.py)
POSTGRES_DB=overfoliodb
POSTGRES_USER=overfoliouser
POSTGRES_PASSWORD=overfoliopwd

# Google (compte de service) : facultatif si la feuille est partagée par lien (seul GOOGLE_SHEET_ID suffit alors)
TYPE=service_account
PROJECT_ID=...
PRIVATE_KEY_ID=...
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLIENT_EMAIL=...
CLIENT_ID=...
AUTH_URI=https://accounts.google.com/o/oauth2/auth
TOKEN_URI=https://oauth2.googleapis.com/token
AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
CLIENT_X509_CERT_URL=...
UNIVERSE_DOMAIN=googleapis.com

# Google Sheet
GOOGLE_SHEET_ID=...            # identifiant du document (voir ci-dessous)

# Connexion avec Google (facultatif : sans ces trois lignes, le site marche sans comptes)
GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost/api/auth/google/callback/

# Mode 3 de la page GoogleSheet « Compte Google » (facultatif, en plus des trois lignes ci-dessus)
GOOGLE_PICKER_API_KEY=...                 # clé API limitée à l'API Google Picker
GOOGLE_CLOUD_PROJECT_NUMBER=123456789012  # numéro (pas l'ID) du projet Google Cloud
FIELD_ENCRYPTION_KEY=...                  # clé Fernet : chiffre les jetons Google en base
```

Générer une `SECRET_KEY` :

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Variables optionnelles

| Variable | Défaut | Rôle |
|---|---|---|
| `GOOGLE_SHEET_ID` | vide | Identifiant du document (partie de l'URL entre `/d/` et `/edit`). Si vide, le document est cherché par son nom, ce qui demande l'API Drive |
| `GOOGLE_SHEET_DOC_NAME` | `overfolio` | Nom du document, utilisé seulement si `GOOGLE_SHEET_ID` est vide |
| `ALLOWED_SHEET_DOCS` | vide | Liste blanche des documents lisibles via `/api/sheet` (séparés par des virgules). Vide : aucune restriction |
| `SHEET_CACHE_SECONDS` | `60` | Cache de `/api/sheet` (0 pour le désactiver) |
| `SHEET_SYNC_TABS` | `portfolio,inout,stock,budget,_history` | Onglets recopiés en base (modifiables sur la page GoogleSheet, au-dessus de Tout actualiser) |
| `SYNC_COOLDOWN_SECONDS` | `10` | Délai minimal entre deux synchronisations d'une même table |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | vide | Client OAuth « Application Web » de Google Cloud, pour la connexion avec Google (voir « Connexion avec Google »). Vides : bouton grisé, site utilisable sans compte |
| `GOOGLE_OAUTH_REDIRECT_URI` | vide | Adresse de retour après Google, **identique** à celle déclarée dans Google Cloud : `http://localhost/api/auth/google/callback/` (Docker), `http://localhost:5173/api/auth/google/callback/` (Vite en développement), `https://ton-domaine/api/auth/google/callback/` (production) |
| `GOOGLE_PICKER_API_KEY`, `GOOGLE_CLOUD_PROJECT_NUMBER` | vide | Mode 3 « Compte Google » de la page GoogleSheet : clé API du sélecteur de fichiers de Google et numéro du projet (voir « Mode 3 : compte Google »). Vides : mode 3 indisponible |
| `FIELD_ENCRYPTION_KEY` | vide | Clé de chiffrement des jetons Google gardés en base (mode 3). À générer une fois : `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. **Secret** ; la changer oblige chacun à autoriser de nouveau l'accès à sa feuille |
| `COOKIE_SECURE` | `False` | `True` en production (HTTPS) : cookies de session et CSRF envoyés seulement en HTTPS |
| `CSRF_TRUSTED_ORIGINS` | celles de `CORS_ALLOWED_ORIGINS` (`http://localhost:5173,http://127.0.0.1:5173`) | Origines acceptées pour les requêtes qui modifient quand l'hôte reçu par Django diffère (proxy de Vite). En production derrière HTTPS : `https://ton-domaine`. En Docker seul (sans Vite), `CSRF_TRUSTED_ORIGINS=http://localhost` évite de faire confiance au port 5173, où une autre application pourrait tourner |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Noms et adresses par lesquels on ouvre le site. Pour y accéder depuis un téléphone du même Wi-Fi, ajouter l'adresse IP locale du PC (`ipconfig` sous Windows), par exemple `localhost,127.0.0.1,192.168.1.20`, puis ouvrir `http://192.168.1.20` sur le téléphone |

Règles à respecter :

- Pas d'espaces autour du `=`.
- Fins de ligne Unix (LF). Vérifier avec `grep -c $'\r' .env` : le résultat doit être `0`.
- Les noms doivent être exacts (`POSTGRES_USER`, pas `POSTGRE_USER`).
- Un changement dans `.env` n'est pris en compte qu'après recréation du conteneur : `docker compose up -d --force-recreate backend`.
- Ne jamais commiter `.env` : il doit figurer dans `.gitignore`.

## Lancement

### Première installation ou reconstruction

```bash
chmod +x init.sh
./init.sh
```

Le script :

1. vérifie `.env` (présence, variables obligatoires, absence de CRLF) et la validité du compose ;
2. arrête les services et reconstruit les images ;
3. lance la stack et attend que l'application réponde ;
4. contrôle que le build du frontend a réussi et que les migrations sont appliquées ;
5. avec `--sync`, copie les onglets du Google Sheet en base.

Options :

```bash
./init.sh                      # lancement normal (données conservées)
./init.sh --sync               # lancement + synchronisation Google Sheets -> base
./init.sh --reset              # supprime les volumes : repart d'une base vide
./init.sh --reset --sync       # base vide, puis re-remplie depuis Google Sheets
./init.sh --no-cache           # reconstruit les images sans cache
```

> `--reset` supprime la base de données. À n'utiliser que si les données sont sans importance.

Après une reconstruction, si `/api/...` répond `502`, redémarre nginx : `docker compose restart nginx` (voir « Dépannage »).

### Lancement manuel

```bash
docker compose up --build -d
```

### Accès

| URL | Contenu |
|---|---|
| http://localhost | Page de présentation : promesse, aperçu, étapes, questions |
| http://localhost/sheet | GoogleSheet : les onglets de la base (menu déroulant, recherche, pagination, bouton Tout actualiser). L'ancienne adresse `/source` fonctionne toujours |
| http://localhost/graphiques | Rubrique Charts. Menu à gauche : Flow, Snapshot, Envelopes, Strategy, Volatility et Budget ; la page choisie s'affiche à droite (Flow par défaut). L'ancienne adresse `/echart` fonctionne toujours |
| http://localhost/simulation | Simulation de Monte-Carlo du patrimoine (page à part, lien « Simulation » de l'en-tête) |
| http://localhost/newpage | Connexion avec un compte Google (bouton « Connexion » de l'en-tête) |
| http://localhost/admin/ | Admin Django |

Le port 8000 du backend n'est **pas** exposé sur l'hôte : tout passe par nginx.

### Utilisation

1. **Brancher le Google Sheet** : page GoogleSheet (`/sheet`), bloc « Connexion à Google Sheets » (ou `.env`, voir « Google Sheets »).
2. **Copier les données en base** : bouton **Tout actualiser** de la même page (ou `./init.sh --sync`). Les graphiques lisent la base, pas le Google Sheet : sans cette étape, ils restent vides. Recommencer après chaque mise à jour de la feuille, ou automatiser (« Synchronisation automatique »).
3. **Lire les graphiques** : rubrique **Charts**, menu à gauche (Flow, Snapshot, Envelopes, Strategy, Volatility, Budget). Chaque graphique a une vue Tableau et une page d'explication (source des chiffres).
4. **Brut ou net** : le bouton **Brut / Net** en haut du menu de Charts choisit les montants de Flow, Snapshot et Envelopes : tes actifs seuls, ou actifs moins dettes (voir « Brut ou net »).
5. **Projeter** : page **Simulation**, réglages dans la page.
6. **Exporter en PDF** : bouton **PDF** de l'en-tête. Tout le site, une page web par page PDF, avec tes réglages du moment (voir « Le PDF »).
7. **Mode clair / sombre** : le site suit le réglage du système ; le bouton soleil/lune de l'en-tête force l'un ou l'autre, et le choix est gardé par le navigateur (et sur ton compte si tu es connecté).
8. **Se connecter** (facultatif) : bouton **Connexion** de l'en-tête, avec ton compte Google. Tes couleurs et ton mode clair / sombre sont alors enregistrés sur ton compte et retrouvés sur tous tes appareils (voir « Connexion avec Google »).
9. **Langue** : français, anglais ou thaï, avec le menu à globe de l'en-tête. Au premier passage, le site prend la langue du navigateur si elle est proposée, sinon le français ; le choix est gardé par le navigateur. Tout le site suit la langue : textes, graphiques, messages d'erreur, nombres et dates (voir « Langues »).

### Créer un compte administrateur

```bash
docker compose exec backend python manage.py createsuperuser
```

## Google Sheets

Sur la page **GoogleSheet**, le bloc « Connexion à Google Sheets » commence par le **mode de connexion**, trois cartes à choix unique ; seuls les champs du mode choisi s'affichent. Les onglets à synchroniser ne sont pas dans ce formulaire (voir « Onglets » ci-dessous) :

| Carte | Champs affichés |
|---|---|
| **1. Lien public** | lien du Google Sheet. Pas de nom de document : l'identifiant vient du lien |
| **2. Compte de service** | « Trouver le document par » **Lien** ou **Nom** (un seul des deux champs affiché ; enregistrer par nom vide le lien, sinon il serait utilisé à la place), compte de service (import du fichier JSON, champs, champs avancés). Le lien est plus sûr : la recherche par nom demande l'API Drive et prend le premier document de ce nom |
| **3. Compte Google** | compte connecté seulement : « Autoriser l'accès à ma feuille », puis « Choisir ma feuille » dans le sélecteur de fichiers de Google. Overfolio n'a accès qu'à cette feuille, qui reste privée (voir « Mode 3 : compte Google ») |

Enregistrer en mode 1 retire le compte de service enregistré (après confirmation). Cocher la carte 2 alors qu'aucun compte n'est en vigueur recharge le compte de service de la **base** s'il y en a un, sinon celui du **`.env`** (message « Compte de service chargé depuis… ») ; la clé privée n'est jamais envoyée au navigateur, elle est reprise à l'enregistrement, et celle du `.env` seulement pour le même e-mail de compte. Côté serveur, le mode en vigueur se déduit des valeurs enregistrées (`access_mode()` dans `backend/googlesheet/config.py`) :

| Mode | Quand | Ce qu'il faut | La feuille |
|---|---|---|---|
| **Lien public** (`public_link`) | aucun compte de service renseigné, mais un lien | seulement le **lien** du Google Sheet | partagée « Tous les utilisateurs disposant du lien » : **tout le monde peut la lire avec le lien** |
| **Compte de service** (`service_account`) | e-mail, ID du projet et clé privée renseignés | le lien (ou le nom) + le compte de service (fichier JSON) | privée possible, partagée seulement avec le compte |
| **Compte Google** (`google`) | compte connecté, feuille choisie dans le sélecteur de Google | se connecter avec Google, autoriser l'accès, choisir la feuille | **privée**, lue avec ton compte ; Overfolio ne voit que ce fichier (scope `drive.file`) |

```
lien seul ─────────────────► export Excel de toute la feuille ──┐
                              (docs.google.com/…/export?format=xlsx)│
                                                                   ├─► mêmes lignes ─► base (sync)
compte de service + lien ──► API Google Sheets (gspread) ─────────┤
compte Google + feuille choisie ──► API Google Sheets (gspread) ───┘
```

**Lien public** : colle le lien sur la page **GoogleSheet**, enregistre, puis Tout actualiser. Google exporte toute la feuille en un fichier Excel (tous les onglets, valeurs calculées) : les nombres arrivent en nombres, les dates en `AAAA-MM-JJ`, comme avec l'API. Si la feuille n'est pas partagée par lien, la synchronisation l'explique (`sheet_not_public`). À n'utiliser que si tu acceptes que quiconque a le lien voie ta feuille.

**Compte de service** :
1. Dans le projet Google Cloud du compte de service, active l'**API Google Sheets**. L'**API Drive** n'est nécessaire que si l'identifiant du document n'est pas renseigné.
2. Partage le document avec l'adresse du compte de service (`CLIENT_EMAIL`), en **Lecteur**. La feuille peut rester privée.
3. Renseigne les paramètres sur la page **GoogleSheet** (`/sheet`, bloc « Connexion à Google Sheets », bouton « Importer le fichier JSON »), ou dans `.env`. Le compte de service est complet dès qu'un de ses champs est rempli. Choisir la carte « 1. Lien public » puis Enregistrer repasse en lecture par lien.

**Onglets** : ils se règlent sur la page **GoogleSheet**, juste au-dessus de **Tout actualiser**, à part du formulaire de connexion. Le champ « Onglets à synchroniser » (noms séparés par des virgules, bouton Enregistrer) et, juste en dessous, « Proposer les onglets du document », qui lit les onglets de la feuille enregistrée (dans les deux modes) et les présente en cases à cocher. Cocher ou décocher une case enregistre la liste aussitôt. La liste **suit le document** : dès que ses onglets sont lus, ceux qui n'y existent pas (ceux d'un ancien document) sont retirés de « Onglets à synchroniser », et s'il n'en reste aucun, tous les onglets du document sont pris ; c'est enregistré aussitôt. Quand tu enregistres un autre document dans la connexion, ses onglets sont lus tout de suite. Les tables de l'ancien document disparaissent de la base au prochain Tout actualiser.

**Correspondance des onglets** : le site lit des tables aux noms fixes (`portfolio`, `_history`, `inout`, `budget`, `stock` : voir « Onglets utilisés » ci-dessous). Si un onglet de ta feuille porte un autre nom (par exemple `history` au lieu de `_history`), le tableau « Correspondance des onglets », sous « Onglets à synchroniser », le relie au nom attendu : une ligne par onglet du site, avec l'onglet de ta feuille (menu déroulant des onglets à synchroniser), le nom utilisé par le site et ce que l'onglet doit contenir. Chaque choix est enregistré aussitôt ; au prochain Tout actualiser, l'onglet choisi est enregistré sous le nom du site, et les graphiques le retrouvent sans rien changer à la feuille. « — aucun — » (ou « même nom ») revient au défaut : l'onglet qui porte le nom du site.

- La correspondance fait partie de la configuration GoogleSheet : une pour le site, une par compte connecté (`tab_map` de `googlesheet_sheetconfig`, `PUT /api/sheet-config/tab-map/`).
- Un onglet ne sert qu'à un seul nom du site ; les menus ne proposent que les onglets libres.
- Une ancienne copie de l'onglet sous son propre nom (synchronisée avant la correspondance) est remplacée.
- Si ta feuille a aussi un onglet au nom exact du site alors que ce nom est relié à un autre onglet (par exemple `portfolio` alors que `portfolio` ← `Positions`), il est ignoré à la synchronisation (`tab_shadowed`), pour ne pas écraser la table.
- Les autres onglets (ceux de Data Studio, par exemple) ne sont pas concernés : le site ne les lit que s'ils sont dans « Onglets à synchroniser ».

### Par compte

Sans connexion, la page GoogleSheet règle la **feuille du site** (repli sur le `.env`) et montre les **données du site**. Connecté avec Google, chacun a **sa propre configuration et ses propres données** : sa ligne `googlesheet_sheetconfig`, ses tables `googlesheet_sheettable`, invisibles pour les autres comptes et pour les visiteurs. Un compte part de zéro : il n'hérite ni du `.env`, ni de la configuration ou des données du site (sinon tout compte pourrait lire la feuille du site). Le compte de service du `.env` n'est jamais proposé à un compte, et sa clé jamais reprise. Côté serveur, tout passe par le propriétaire de la requête (`config.request_owner(request)` : l'utilisateur connecté, sinon `None` pour le site) : `config.py`, `sync.py`, `services.open_spreadsheet()` et `data_views.py`. La commande `sync_sheets` et `/api/sheet` travaillent pour le site.

**Session changée pendant que la page est ouverte** : chaque modification (enregistrer, effacer, onglets, Tout actualiser) porte l'en-tête `X-Sheet-Scope` (`account` ou `site`), la configuration que la page affiche. Si la session a expiré ou changé dans un autre onglet, le serveur refuse (`session_expired`, `scope_changed`) au lieu d'écrire dans une autre configuration — sinon une feuille privée pourrait finir dans celle du site, lisible par tous — et la page se recharge.

### Mode 3 : compte Google

1. Se connecter avec Google (bouton **Connexion** de l'en-tête).
2. Page **GoogleSheet**, carte **3. Compte Google**, bouton **Autoriser l'accès à ma feuille** : Google demande l'accord pour « les fichiers Google Drive que tu utilises avec cette application » (scope `drive.file`). Overfolio garde un jeton de rafraîchissement **chiffré** (`FIELD_ENCRYPTION_KEY`), jamais renvoyé au navigateur.
3. **Choisir ma feuille** : le sélecteur de fichiers de Google s'ouvre (`lib/googlePicker.js`, script `apis.google.com/js/api.js`) avec un jeton d'accès court donné par `GET /api/auth/google/picker-token/`. La feuille choisie est enregistrée (`PUT /api/sheet-config/` avec `method: "google"`).
4. Choisir les onglets, puis **Tout actualiser** : les onglets sont lus avec ton compte Google (gspread).

**Retirer l'accès** le révoque chez Google et l'oublie en base ; si l'accès est retiré depuis le compte Google (réponse `invalid_grant`), la synchronisation le détecte (`google_access_revoked`) et la page repropose de l'autoriser. Une erreur passagère de Google garde l'accès (`google_unreachable`). Si `FIELD_ENCRYPTION_KEY` change, les accès gardés sont oubliés et la page repropose l'autorisation. L'admin Django n'affiche jamais le jeton chiffré.

À créer dans Google Cloud, en plus du client OAuth (voir « Connexion avec Google ») :
- **API et services → Bibliothèque** : activer **Google Picker API**, **Google Sheets API** et **Google Drive API**.
- **Écran de consentement OAuth → Accès aux données** : ajouter le scope `.../auth/drive.file` (non sensible : pas de validation Google demandée).
- **Identifiants → Créer des identifiants → Clé API** : la limiter à l'**API Google Picker** et aux sites `http://localhost/*`, `http://localhost:5173/*`, `https://ton-domaine/*` ; la copier dans `GOOGLE_PICKER_API_KEY`.
- **Numéro du projet** (tableau de bord du projet, « Numéro du projet ») dans `GOOGLE_CLOUD_PROJECT_NUMBER`.
- Générer `FIELD_ENCRYPTION_KEY` (commande dans « Variables optionnelles »).

### Paramètres saisis sur la page GoogleSheet

Les variables Google du `.env` (`TYPE`, `PROJECT_ID`, `PRIVATE_KEY_ID`, `PRIVATE_KEY`, `CLIENT_EMAIL`, `CLIENT_ID`, `AUTH_URI`, `TOKEN_URI`, `AUTH_PROVIDER_X509_CERT_URL`, `CLIENT_X509_CERT_URL`, `UNIVERSE_DOMAIN`, `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_DOC_NAME`, `SHEET_SYNC_TABS`) se modifient aussi depuis la page GoogleSheet :

- Les champs sont préremplis avec les valeurs en vigueur. Tant que rien n'a été enregistré, ce sont celles du `.env`.
- **Enregistrer** les écrit en base (table `googlesheet_sheetconfig`, une ligne pour le site, une par compte connecté). Elles remplacent alors le `.env` pour la synchronisation, la commande `sync_sheets` et `/api/sheet`, sans redémarrer le backend.
- **Revenir aux valeurs du .env** efface la ligne enregistrée (connecté : **Effacer ces paramètres**, qui efface celle du compte).
- **Importer le fichier JSON** remplit les champs du compte de service depuis le fichier téléchargé dans Google Cloud (lu dans le navigateur).
- L'identifiant du document accepte aussi l'adresse complète du Google Sheet.
- La **clé privée n'est jamais renvoyée au navigateur** : le champ reste vide. Laissé vide, la clé en vigueur est conservée.
- Les **onglets à synchroniser** (`SHEET_SYNC_TABS`) ne font pas partie du formulaire de connexion : ils s'enregistrent seuls, au-dessus de Tout actualiser (`PUT /api/sheet-config/tabs/`). Le formulaire de connexion garde la liste enregistrée. Enregistrer les onglets alors que rien n'était enregistré recopie les valeurs du `.env` en base, comme le formulaire.

API : `GET /api/sheet-config/` (valeurs, sans la clé privée), `PUT /api/sheet-config/` (enregistre ; 400 avec `fields` si la saisie est incomplète), `DELETE /api/sheet-config/` (retour au `.env`, ou rien pour un compte). Connecté : celles du compte.

> ⚠️ Sans connexion, cette route est publique : toute personne qui atteint l'application peut changer le document lu **du site**. La configuration d'un compte n'est accessible qu'à ce compte. Ne pas exposer l'application sur Internet sans réserver l'API aux comptes.

Onglets utilisés :

| Onglet | Contenu | Utilisé par |
|---|---|---|
| `portfolio` | Positions actuelles (en-tête en ligne 2, la ligne 1 est une synthèse) | Snapshot, Strategy (anneaux et carte du monde), Envelopes, point de départ de Simulation |
| `_history` | Historique des relevés (et tes objectifs : lignes avec seulement une date et un montant) | Flow, Envelopes, Volatility, variations de Snapshot, objectif de Simulation |
| `inout` | Entrées et sorties d'argent (colonnes date, in, out, tax) | Graphique Entrées, sorties et impôts de Flow, versement proposé par Simulation |
| `budget` | Budget : de quelle source vers quelle destination | Flux du budget |
| `stock` | Valeurs suivies | Strategy (secteur, moat, note…), page GoogleSheet |

La lecture détecte seule la ligne d'en-tête. Les nombres sont lus en valeurs brutes (pas de format régional ni de symbole monétaire).

## Connexion avec Google

La connexion est **facultative** : sans compte, le site marche comme avant (profil du site, préférences du navigateur). Avec un compte Google, chacun a son **profil en base** : couleurs des types d'actifs et mode clair / sombre, retrouvés sur tous ses appareils.

### Ce qui se passe

```
En-tête « Connexion » ──► /newpage ──► « Continuer avec Google »
   ──► GET /api/auth/google/start/?next=/page      state + vérificateur PKCE gardés en session
   ──► accounts.google.com (choix du compte, accord)
   ──► GET /api/auth/google/callback/?state&code   state vérifié, code échangé (avec PKCE),
                                                   jeton d'identité vérifié (signature, destinataire, e-mail vérifié)
   ──► compte retrouvé par son identifiant Google (`sub`) ou créé ; session Django ouverte
   ──► retour sur /page                            en cas d'échec : /newpage?error=<code>, message traduit
```

- **Compte** : un utilisateur Django par compte Google, retrouvé par `sub` (jamais par l'e-mail, qui peut changer). Pas de mot de passe. E-mail, nom et photo sont remis à jour à chaque connexion (`accounts_googleaccount`).
- **Première connexion** : le nouveau profil reprend une fois les réglages du profil du site (couleurs), et le mode clair / sombre de ce navigateur s'il en avait un. Ensuite, chaque profil vit sa vie.
- **Jetons Google** : la connexion ne demande que l'identité (`openid`, e-mail, profil), sans accès hors ligne ; aucun jeton n'est gardé. Seul le mode 3 de la page GoogleSheet, s'il est autorisé, garde un jeton de rafraîchissement, chiffré (voir « Mode 3 : compte Google »).
- **Session** : cookie `sessionid` (HttpOnly, SameSite=Lax, 30 jours, `Secure` avec `COOKIE_SECURE=True`). Avec une session ouverte, toute requête qui modifie exige le jeton CSRF : le site le lit dans le cookie `csrftoken` (posé par `GET /api/auth/me/`) et l'envoie dans l'en-tête `X-CSRFToken` (`frontend/src/lib/api.js`).
- **Feuille et données** : chaque compte a sa configuration GoogleSheet et ses données synchronisées, invisibles pour les autres (voir « Par compte »). Sans compte, l'API reste publique, avec la feuille et les données du site.
- **Déconnexion** : la page est rechargée, pour qu'aucune donnée du compte ne reste affichée.
- **Administrateur** : une session ouverte sur `/admin/` vaut aussi pour le site (même domaine) : l'administrateur y voit son propre profil, pas celui du site. Se déconnecter de l'admin pour revenir au profil du site.
- **Petits écrans** : sous 640 px, « Connexion » / « Se déconnecter » passent dans le menu burger.

### Créer le client OAuth dans Google Cloud

1. [console.cloud.google.com](https://console.cloud.google.com) : créer un projet (ou reprendre celui du compte de service).
2. **API et services → Écran de consentement OAuth** : type « Externe », nom de l'application (Overfolio), e-mail d'assistance. Scopes : `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (pas de scope sensible). Tant que l'application est « En test », ajouter les adresses Gmail autorisées dans « Utilisateurs test ».
3. **Identifiants → Créer des identifiants → ID client OAuth → Application Web** :
   - Origines JavaScript autorisées : `http://localhost`, `http://localhost:5173` (développement), `https://ton-domaine` (production).
   - URI de redirection autorisés : `http://localhost/api/auth/google/callback/`, `http://localhost:5173/api/auth/google/callback/`, `https://ton-domaine/api/auth/google/callback/`.
4. Copier l'ID client et le code secret dans `.env` (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`), et l'URI de retour de l'environnement dans `GOOGLE_OAUTH_REDIRECT_URI`, puis `docker compose up -d --force-recreate backend`.

L'URI de retour doit être **exactement** la même dans Google Cloud et dans `.env` (protocole, port, barre finale), sinon Google affiche `redirect_uri_mismatch`.

## Architecture

### Les 4 services

| Service | Rôle | Port exposé |
|---|---|---|
| `nginx` | Serveur web, reverse proxy | 80 |
| `frontend` | Build Vue.js/Vite (job one-shot, s'arrête après le build) | aucun |
| `backend` | API Django servie par gunicorn | aucun (8000 interne) |
| `db` | PostgreSQL 15 | aucun (5432 interne) |

### Ordre de démarrage

```
db (healthy) ──► backend (migrate + collectstatic + gunicorn) ──┐
frontend (build, exit 0) ───────────────────────────────────────┴──► nginx
```

- `backend` attend que `db` soit **healthy** (`pg_isready`).
- `nginx` attend que le build `frontend` soit **terminé avec succès** et que `backend` soit démarré.
- Le conteneur `frontend` en statut `Exited (0)` est le comportement normal.
- Les tables de la base sont créées par `migrate`, lancé à chaque démarrage du backend.

### Communication interne (réseau Docker)

| Émetteur | Accède à | Pourquoi | Adresse |
|---|---|---|---|
| nginx | frontend (build) | Sert les fichiers `dist` | volume `frontend-dist` monté sur `/usr/share/nginx/html` |
| nginx | backend | Proxy `/api/` et `/admin/` | `http://backend:8000` |
| nginx | backend (statiques) | Sert `/static/` | volume `static_data` monté sur `/staticfiles` |
| backend | db | Accès PostgreSQL | `db:5432` |
| backend | Google Sheets | Lecture des onglets | HTTPS : API avec le compte de service, ou export Excel de la feuille partagée par lien |

### Schéma d'ensemble

```
                         🌍 Navigateur
                               │
                        http://localhost
                               │
                           [nginx:80]
              ┌────────────────┼──────────────────┐
              │                │                  │
        fichiers Vue      /api  /admin         /static
        (volume dist)          │             (volume static_data)
                               ▼
                        [backend:8000]
                         gunicorn + Django
                      ┌────────┴─────────┐
                      │                  │
                      ▼                  ▼
                 [db:5432]         ☁ Google Sheets
                 PostgreSQL        (API Sheets)
```

### Deux chemins pour les données

```
Chemin 1 : lecture en direct (toujours à jour, cache 60 s)
  Navigateur ──► /api/sheet?doc_name=...&sheet_name=... ──► Google Sheets
  disponible, mais plus utilisé par l'interface actuelle

Chemin 2 : lecture de la base (rapide, à jour après synchronisation)
  Navigateur ──► /api/data/<onglet>/ ──► PostgreSQL
  utilisé par : la page GoogleSheet, les pages de Charts et la page Simulation

Profil (réglages gardés en base, pas dans le navigateur)
  Navigateur ◄──► /api/profile/ ◄──► PostgreSQL (table profiles_profile)
  utilisé par : les couleurs des actifs (menu de Charts) et, pour un compte connecté, le mode clair / sombre

Connexion avec Google (facultative)
  Navigateur ──► /api/auth/google/start/ ──► Google ──► /api/auth/google/callback/ ──► session Django

Synchronisation Google Sheets ──► PostgreSQL
  - commande : python manage.py sync_sheets
  - bouton « Tout actualiser » de la page GoogleSheet (tous les onglets de la liste)
  - ./init.sh --sync
```

La base n'est **jamais mise à jour automatiquement**. Pour une mise à jour régulière, voir « Synchronisation automatique ».

## API

| Méthode | URL | Rôle |
|---|---|---|
| GET | `/api/sheet?doc_name=&sheet_name=&header_row=&refresh=1` | Lit un onglet dans Google Sheets (cache 60 s, `refresh=1` pour le contourner) |
| GET | `/api/data/` | Liste des tables en base (nom, nombre de lignes, date de synchronisation) : celles du compte connecté, sinon celles du site. Il en va de même pour toutes les routes `/api/data/` et `/api/sheet-config/`. En-tête facultatif `X-Sheet-Scope: account|site` sur les requêtes qui modifient : 401 `session_expired` ou 409 `scope_changed` si la session ne correspond plus |
| GET | `/api/data/<onglet>/` | Colonnes (dans l'ordre) et lignes d'une table |
| POST | `/api/data/sync/` | Relit tous les onglets de la liste et met la base à jour. Un onglet en erreur garde ses anciennes données s'il vient du même document. Les tables d'un **autre document** (feuille changée sur la page GoogleSheet), ou d'origine inconnue et non relues, sont retirées et listées dans `removed`. 502 si aucun onglet n'a pu être enregistré. Rien n'est retiré si le document ne s'ouvre pas |
| POST | `/api/data/<onglet>/sync/` | Relit l'onglet dans Google Sheets et met la base à jour |
| GET, PUT, DELETE | `/api/sheet-config/` | Paramètres d'accès au Google Sheet, avec le mode en vigueur (`mode` : `public_link`, `service_account` ou `none`) et le compte de service à proposer en mode 2 (`account` : `source` `page`/`env`, `values` sans la clé, `private_key_set`). `PUT` avec `clear_credentials: true` retire le compte de service (voir « Paramètres saisis sur la page GoogleSheet ») |
| GET, PUT | `/api/profile/` | Profil gardé en base : celui du compte connecté, sinon celui du site. `GET` : `{ asset_colors: { type: "#rrggbb" }, theme, updated_at }`. `PUT {"theme": "dark"}` : mode clair / sombre (`light`, `dark`, ou `""` pour suivre le système ; 400 `invalid_theme` sinon) |
| PUT | `/api/profile/asset-colors/` | `{"asset_colors": {"crypto": "#f9ab00"}}` : remplace les couleurs choisies (`{}` = couleurs par défaut). Types mis en minuscules ; 400 `invalid_asset_colors` si une couleur n'est pas au format `#rrggbb`, si un type est vide ou dépasse 100 caractères, ou au-delà de 200 types |
| GET | `/api/auth/google/start/?next=/page` | Navigation (pas d'appel JSON) : part se connecter chez Google, puis revient sur `next` (une page du site seulement). Sans réglages Google : retour sur `/newpage?error=google_not_configured` |
| GET | `/api/auth/google/callback/` | Retour de Google (adresse déclarée dans Google Cloud) : vérifie `state`, échange le code (PKCE), vérifie le jeton d'identité, ouvre la session. Échec : `/newpage?error=` `google_denied`, `google_state_invalid`, `google_token_failed`, `google_token_invalid`, `google_email_unverified`, `account_disabled` (compte désactivé dans l'admin) |
| GET | `/api/auth/google/drive/start/?next=/sheet` | Navigation, compte connecté : autorise l'accès aux feuilles choisies (`drive.file`, accès hors ligne, autorisation progressive). Retour sur `next` avec `?google=connected`, ou `?google_error=` `google_drive_not_configured`, `google_account_mismatch` (autre compte choisi chez Google), `google_drive_denied` (case décochée), `google_token_failed`… |
| GET | `/api/auth/google/picker-token/` | Compte connecté et accès accordé : `{ access_token, expires_in, api_key, app_id }` pour le sélecteur de Google (jamais le jeton de rafraîchissement ; `Cache-Control: no-store`). 401 `login_required`, 409 `google_not_authorized` ou `google_access_revoked`, 503 `google_drive_not_configured` |
| POST | `/api/auth/google/drive/revoke/` | Retire l'accès aux feuilles (chez Google et en base) |
| GET | `/api/auth/me/` | `{ configured, authenticated, user?: { email, name, picture }, first_login? }`. Pose le cookie `csrftoken` |
| POST | `/api/auth/logout/` | Ferme la session (jeton CSRF exigé si une session est ouverte) |
| PUT | `/api/sheet-config/tab-map/` | `{"tab_map": {"_history": "history"}}` : correspondance des onglets (nom attendu par le site → onglet de la feuille ; même nom ou vide = défaut). Renvoie les paramètres comme `/api/sheet-config/`, qui donne aussi `tab_map` et `site_tabs`. 400 `invalid_tab_map` (nom du site inconnu, valeur non valable) ou `tab_map_duplicate` (un onglet relié à deux noms) |
| GET, PUT | `/api/sheet-config/tabs/` | `GET` : onglets du document, `{ mode, tabs, selected }`, dans les deux modes. `PUT {"sync_tabs": "portfolio, budget"}` : enregistre seulement la liste des onglets à synchroniser et renvoie les paramètres comme `/api/sheet-config/` (400 `sync_tabs_required` si la liste est vide) |

Les erreurs sont renvoyées en JSON `{"error": "message en français", "code": "code_stable", "params": {…}}` (`backend/googlesheet/errors.py`) : `404` (onglet ou document introuvable), `429` (synchronisation trop rapprochée), `502` (erreur de l'API Google). Le site affiche le message dans la langue choisie à partir de `code` et `params` (rubrique `apiErrors` de `frontend/src/i18n/*.json`) ; `error` reste en français pour la ligne de commande. Un formulaire invalide (`400`) ajoute `fields` (messages par champ) et `field_codes` (codes par champ). Le résultat de chaque onglet d'une synchronisation porte aussi `code` et `params`.

**Ajouter une erreur** : choisir un code, le passer à `error_response` (ou à `SheetError(message, code, **params)`), puis ajouter `apiErrors.<code>` dans les trois fichiers de langue.

> Sans connexion, ces routes restent publiques (choix assumé : le site marche sans compte). Avec une session ouverte, les requêtes qui modifient exigent le jeton CSRF. Avant d'exposer le site sur Internet, réserve les données aux comptes connectés.

## Base de données

PostgreSQL, tables créées par les migrations Django (lancées au démarrage du backend).

### Schéma

```mermaid
erDiagram
  googlesheet_sheettable ||--o{ googlesheet_sheetrow : "contient"
  auth_user |o--o| profiles_profile : "un profil par compte"
  auth_user ||--o| accounts_googleaccount : "compte Google"
  auth_user |o--o{ googlesheet_sheettable : "tables du compte"
  auth_user |o--o| googlesheet_sheetconfig : "feuille du compte"
  googlesheet_sheettable {
    bigint id PK
    int user_id FK "vide = site"
    varchar name "unique par propriétaire"
    jsonb columns "ordre des colonnes"
    int header_row "ligne d'en-tête"
    int row_count
    timestamp synced_at
    varchar source "document d'origine"
  }
  googlesheet_sheetrow {
    bigint id PK
    bigint table_id FK
    int position "unique par table"
    jsonb data "colonne vers valeur"
  }
  googlesheet_sheetconfig {
    bigint id PK
    int user_id FK, UK "vide = site"
    varchar method "google ou vide"
    varchar client_email "compte de service"
    text private_key
    varchar sheet_id
    varchar doc_name
    varchar sync_tabs
    jsonb tab_map "nom du site vers onglet"
    timestamp updated_at
  }
  profiles_profile {
    bigint id PK
    int user_id FK "vide = profil du site"
    jsonb asset_colors "type vers couleur"
    varchar theme "light, dark ou vide"
    timestamp updated_at
  }
  accounts_googleaccount {
    bigint id PK
    int user_id FK, UK
    varchar sub UK "identifiant Google"
    varchar email
    varchar name
    varchar picture
    text drive_refresh_token "chiffré (mode 3)"
    timestamp drive_authorized_at
    timestamp created_at
    timestamp updated_at
  }
  auth_user {
    int id PK
    varchar username
    varchar email
  }
```

Le schéma ne montre que les tables du projet ; Django ajoute les siennes (sessions, admin, permissions, migrations). Une ligne sans utilisateur (`user_id` vide) appartient au site : visiteurs non connectés. Pour `auth_user`, seules les colonnes utiles ici sont montrées.

### Tables

| Table | Modèle | Contenu |
|---|---|---|
| `googlesheet_sheettable` | `SheetTable` | Une ligne par onglet et par propriétaire (`user` vide = site, sinon un compte ; nom unique par propriétaire) : nom, ordre des colonnes, ligne d'en-tête, nombre de lignes, date de synchronisation, `source` (document d'origine : son identifiant, ou `nom:<nom>` ; vide pour les tables d'avant ce champ) |
| `googlesheet_sheetrow` | `SheetRow` | Une ligne par ligne de données, sous la forme JSON `{colonne: valeur}` : n'importe quelle structure de feuille passe sans migration |
| `googlesheet_sheetconfig` | `SheetConfig` | Paramètres d'accès saisis sur la page GoogleSheet : une ligne pour le site (absente tant que rien n'est enregistré : le `.env` s'applique), une par compte connecté (jamais de repli sur le `.env`) ; une seule par propriétaire (contrainte `uniq_sheetconfig_owner`). `method` = `google` pour le mode 3, `tab_map` = correspondance des onglets. La clé privée n'est jamais renvoyée au navigateur |
| `profiles_profile` | `Profile` | Réglages gardés en base : couleurs des types d'actifs (`asset_colors`), mode clair / sombre (`theme`). Un profil sans utilisateur pour le site (visiteurs non connectés), puis un par compte connecté (voir « Connexion avec Google ») |
| `accounts_googleaccount` | `GoogleAccount` | Compte Google d'un utilisateur : identifiant Google `sub` (unique), e-mail, nom, photo. Mode 3 : jeton de rafraîchissement Google **chiffré** (`drive_refresh_token`, vide si l'accès n'est pas accordé) |
| `auth_user` | `User` (Django) | Comptes Django : l'administrateur (`createsuperuser`) et un utilisateur par compte Google connecté (`google-<sub>`, sans mot de passe) |

### Synchronisation

La synchronisation recopie chaque onglet dans `googlesheet_sheettable` et `googlesheet_sheetrow`, pour le propriétaire de la requête : le site, ou le compte connecté. La commande `python manage.py sync_sheets` synchronise le site.

Chaque synchronisation remplace le contenu d'un onglet en une seule transaction. Un onglet en erreur n'empêche pas les autres, et un onglet qui renvoie zéro ligne n'écrase pas des données existantes.

Exemple de requête (total en euros par type d'actif) :

```bash
docker compose exec db psql -U overfoliouser -d overfoliodb -c "
select r.data->>'Asset' as asset,
       sum(nullif(r.data->>'Assets Master Currency','')::numeric) as total_eur
from googlesheet_sheetrow r
join googlesheet_sheettable t on t.id = r.table_id
where t.name = 'portfolio'
group by 1 order by 2 desc;"
```

## Synchronisation Google Sheets vers la base

```bash
# Simulation : lit les onglets sans rien écrire
docker compose exec -T backend python manage.py sync_sheets --dry-run

# Synchronisation complète
docker compose exec -T backend python manage.py sync_sheets

# Quelques onglets seulement
docker compose exec -T backend python manage.py sync_sheets --tabs portfolio,_history

# Forcer la ligne d'en-tête d'un onglet (si elle est mal détectée)
docker compose exec -T backend python manage.py sync_sheets --header-row budget=2
```

Autres options : `--allow-empty` (autorise un onglet vide à remplacer des données), `--doc` (nom du document).

### Synchronisation automatique

Cron sur la machine hôte (`crontab -e`), toutes les 30 minutes :

```
*/30 * * * * cd ~/overfolio && docker compose exec -T backend python manage.py sync_sheets >> ~/overfolio/sync.log 2>&1
```

Sous WSL, le service cron doit être démarré (`sudo service cron start`), et la synchronisation ne s'exécute que lorsque WSL est ouvert. Évite un intervalle inférieur à 5 minutes, à cause des quotas de l'API Google.

## Interface

Le front est en Vue 3 (`<script setup>`), Tailwind 3, ECharts et vue-i18n. Il ne lit que la base, par `/api/data/...` : l'API et le backend ne sont pas concernés par l'interface.

Bibliothèques chargées à la demande seulement : `world-atlas` et `topojson-client` (frontières des pays, page Strategy), `html2canvas` et `jspdf` (bouton PDF).

### Pages

| Adresse | Fichier | Contenu |
|---|---|---|
| `/` | `views/HeroSection.vue` et `components/landing/` | Présentation : promesse, aperçu, avantages, étapes, questions fréquentes |
| `/sheet` | `views/SourcePage.vue` | Connexion (`SheetSettings.vue`), onglets à synchroniser (`SyncTabs.vue`), correspondance des onglets (`TabMapping.vue`), menu des onglets, tableau (en-tête fixe, recherche, 50 lignes par page), bouton Tout actualiser. `/sheet?onglet=budget` ouvre un onglet précis |
| `/graphiques` | `views/GraphiquesLayout.vue` | Mise en page de la rubrique : en haut à gauche le bouton Brut / Net (`lib/amounts.js`), puis le menu en colonne (liste `MENU` de `lib/charts/index.js` : Flow, Snapshot, Envelopes, Strategy, Volatility, Budget), puis « Couleurs des actifs » (`components/charts/AssetColorSettings.vue`, voir « Couleurs des graphiques »), page choisie à droite. `/graphiques` ouvre Flow. Les six pages et `/graphiques/<nom>` s'affichent dans cette mise en page ; sur mobile, le menu devient une rangée d'onglets |
| `/graphiques/<nom>` | `views/GraphiquePage.vue` et `components/charts/ChartView.vue` | Un graphique : titre, date des données, explication, source des chiffres, vue tableau. `flux-budget` ou l'un des graphiques de Flow, Envelopes ou Volatility (leur fil d'Ariane passe par leur page) |
| `/portfolio-flow` | `views/PortfolioFlowPage.vue` et `components/charts/ChartGroup.vue` | L'historique mois par mois : les graphiques de Flow sur une seule page (« Tes dettes » en plus en mode Brut), avec un choix d'année (`?annee=2026`) qui remplace les pages 2024, 2025 et 2026 de l'ancien rapport |
| `/enveloppes` | `views/EnvelopesPage.vue` et `lib/charts/envelopes.js` | Les enveloppes de placement (celles qui contiennent des actions, des ETF ou des fonds) : anneau enveloppe → instrument, évolution, répartition par sous-type et par zone. Montants bruts ou nets selon le bouton Brut / Net |
| `/volatilite` | `views/VolatilityPage.vue` et `lib/charts/volatility.js` | Une bulle par placement : montant détenu et variation du prix unitaire sur 1 mois, 3 mois et 1 an |
| `/simulation` | `views/SimulationPage.vue`, `lib/simulation.js`, `lib/simulation.worker.js` et `lib/charts/simulationFan.js` | Page à part (lien « Simulation » de l'en-tête, hors de la rubrique Graphiques) : simulation de Monte-Carlo du patrimoine net (5 000 trajectoires mensuelles) et probabilité d'atteindre l'objectif. Voir « La simulation » |
| `/portfolio-snapshot` | `views/SnapshotPage.vue` et `lib/snapshot.js` | Le patrimoine d'aujourd'hui : brut, net, variation de l'année et du mois, anneau des types d'actifs, détail par type ; en mode Brut, la liste « Tes dettes ». Voir « Snapshot » |
| `/strategie` | `views/StrategyPage.vue`, `components/charts/StrategyCard.vue`, `components/charts/WorldMapCard.vue`, `lib/strategy.js`, `lib/charts/sunburst.js` et `lib/charts/worldMap.js` | Strategy : une carte du monde des pays de tes actions (colonne `Area`), puis tes actions en anneaux à deux niveaux (secteur, moat, localisation, note S&P, business, place de cotation, instruments), avec un choix d'enveloppe |
| autre adresse | `views/NotFoundPage.vue` | Page introuvable |
| `/newpage` | `views/NewPage.vue`, `lib/auth.js` | Connexion avec un compte Google (seule méthode). Connecté : e-mail du compte, Ouvrir Charts, Se déconnecter. Affiche le message traduit d'un échec (`?error=`), et un bouton grisé si Google n'est pas réglé sur le serveur. `?next=/page` : page où revenir après la connexion |

Les pages, hors accueil, sont chargées à la demande : ECharts n'est téléchargé que lorsqu'on ouvre un graphique.

### Fonctionnement du frontend

D'une table de la base à un graphique affiché :

```
Page (views/*.vue)
  │  useTable('portfolio')                  composables/useTable.js
  ▼
lib/api.js ──► GET /api/data/<onglet>/ ──► PostgreSQL
  │  { columns, rows }
  ▼
Spécification du graphique                  lib/charts/<nom>.js : build(table)
  │  { option ECharts, tableau, textes }    couleurs prises dans lib/palette.js
  ▼
BaseChart.vue ──► en mode sombre : lib/chartDark.js remplace les couleurs claires
  │
  ▼
ECharts (canvas)          + vue Tableau (DataTableView.vue) avec les mêmes chiffres
```

Mode clair / sombre : une seule source, `lib/theme.js`, lue par tous les autres fichiers (dans un seul sens).

```
                            lib/theme.js
               (couleurs clair + sombre, clé du choix)
  ┌────────────────────┬──────────┴─────────┬─────────────────────┐
  ▼                    ▼                    ▼                     ▼
tailwind.config.js   vite.config.ts       lib/palette.js        composables/useTheme.js
classes + variables  injecte dans         couleurs des          état isDark, bascule,
CSS :root/html.dark  index.html           graphiques + DARK     choix mémorisé
  │                    │                    │                     │               │
  ▼                    ▼                    ▼◄────────────────────┘               ▼
composants Vue       script d'avant-      BaseChart.vue                         ThemeToggle.vue
(bg-paper,           affichage : classe   (recolore en                          (bouton de
 text-ink…)          « dark » sur <html>  sombre)                               l'en-tête)
```

La classe `dark` sur `<html>` décide de tout : les composants n'utilisent que des noms de couleur (`bg-paper`, `text-ink`) et ne savent pas dans quel mode ils sont.

### Les graphiques

Quinze graphiques ont leur propre page `/graphiques/<nom>` : Budget et ceux de Flow, Envelopes et Volatility. Chacun est un fichier de `frontend/src/lib/charts/`. Les noms de colonnes doivent être ceux de la table ; la casse, les accents et les espaces sont ignorés.

| `<nom>` dans l'adresse | Table | Colonnes lues |
|---|---|---|
| `flux-budget` | `budget` | `Source`, `Destination`, `Valeur`. Lignes supérieures à 0, doublons additionnés |
| `patrimoine-devises` | `_history` | `Date` et une colonne de montants par devise dont le nom contient `CHF`, `EUR` ou `USD` (par exemple `EUR` ou `Assets CHF`). Les colonnes de prix, de quantité et de dettes sont ignorées. Brut ou net selon le bouton Brut / Net |
| `repartition-mensuelle` | `_history` | `Date`, `Asset`, `Assets Master Currency`. Barres à 100 % par mois |
| `evolution-par-actif` | `_history` | `Date`, `Asset`, `Assets Master Currency`. Une courbe par type d'actif |
| `dettes-par-actif` | `_history` | `Date`, `Asset`, `Liabilities Master Currency` (ou `EUR` négatif). Tes dettes en positif, une courbe par type d'actif. Sur la page Flow, seulement en mode Brut |
| `variation-mensuelle` | `_history` | `Date`, `Assets Master Currency`. Variation en % du total d'un mois à l'autre |
| `entrees-sorties` | `inout` | `date`, `in`, `out`, `tax` (facultative). Barres par mois ; sorties et impôts saisis en négatif comptés en valeur absolue |
| `patrimoine-tendance` | `_history` | `Date` et la colonne en euros (`EUR`, sinon `Assets Master Currency`). Barres par relevé, droite de tendance prolongée jusqu'au dernier objectif, et objectifs (lignes sans `Asset` ni `Instrument`) |
| `enveloppes-instruments` | `portfolio` | `Envelope` (ou `Account`), `Instrument`, `Assets Master Currency`, `Asset` |
| `enveloppes-evolution` | `_history` | `Date`, `Envelope`, `Asset`, `Assets Master Currency` |
| `enveloppes-types`, `enveloppes-zones` | `portfolio` | `Envelope`, `Sub Asset` (ou `Area`), `Assets Master Currency` |
| `volatilite-1-mois`, `volatilite-3-mois`, `volatilite-1-an` | `_history` | `Date`, `Instrument`, `Quantity`, `Assets Master Currency` (et `Asset`, `Envelope`, `Broker`). Prix unitaire = montant ÷ quantité ; liquidités, immobilier, biens qui se déprécient et objets écartés. Chaque bulle porte son nom (avec l'enveloppe quand le même instrument est dans plusieurs enveloppes) ; les noms de bulles presque superposées sont écartés. Une ligne pas encore détenue à la date de référence est nommée dans la note |

Les graphiques de `patrimoine-devises` à `patrimoine-tendance` forment la page `/portfolio-flow`. Ils prennent, pour chaque mois, le **dernier relevé** du mois (plusieurs relevés par mois ne s'additionnent pas). Une date isolée, à plus de 6 mois des autres (un objectif en 2039, un vieux relevé), est écartée des graphiques mensuels, et la page le signale ; le graphique `patrimoine-tendance` garde toutes les dates et affiche les objectifs à part.

Les anciens graphiques à part (évolution du patrimoine, répartition par type d'actif, par zone, par compte, plus grosses positions) ont été retirés : Snapshot et Strategy couvrent la répartition. Le fichier `lib/charts/evolution.js` reste, mais seulement comme courbe de l'aperçu de la page d'accueil.

Les totaux utilisent uniquement `Assets Master Currency` (et `Liabilities Master Currency`) : `Currency Price` est la devise de cotation et `Equity` mélange plusieurs devises, donc aucun des deux ne sert à additionner.

### Brut ou net

En haut du menu de Charts, le bouton **Brut / Net** choisit les montants des pages Flow, Snapshot et Envelopes. Le choix est gardé par le navigateur (préférence `amounts` de `lib/preferences.js`). Volatility (prix), Budget et « Entrées, sorties et impôts » (flux) et Strategy (actions seulement) ne changent pas. Tout est dans `frontend/src/lib/amounts.js`.

| Mode | Montants |
|---|---|
| Brut | Tes actifs (`Assets Master Currency`), sans les dettes. La page Flow ajoute le graphique « Tes dettes » (`dettes-par-actif`), la page Snapshot la liste « Tes dettes » par instrument |
| Net | Actifs moins dettes. Chaque dette reste sur sa ligne, donc dans son type d'actif, son enveloppe… : le prêt de la maison est retiré de `real estate`. Les découpages additionnent chaque groupe, puis écartent un groupe négatif (ses dettes dépassent ses actifs), avec une note sous le graphique |

- Dans la feuille, une ligne est soit un actif, soit une dette. Les colonnes de devise (`EUR`, `USD`, `CHF`, `THB`) portent les deux : positives pour un actif, négatives pour une dette. Elles suivent le mode, comme `Assets Master Currency`.
- Les anciens relevés n'ont ni `Assets Master Currency` ni `Liabilities Master Currency`, seulement les colonnes de devise : la colonne `EUR` décide, selon son signe. Une ligne sans `Asset`, `Instrument` ni `Envelope` (un objectif) n'est ni un actif ni une dette.
- Une spécification de graphique suit le bouton en déclarant `amounts: true` (`amounts: 'debt'` pour les dettes seules) : `buildChart()` lui passe une copie de la table avec les montants du mode, et ajoute à sa note la nature des montants.

Si une colonne manque, la page du graphique le dit en clair et renvoie vers la page GoogleSheet. Si la table n'a jamais été synchronisée, elle propose d'ouvrir l'onglet correspondant pour cliquer sur Tout actualiser.

### Snapshot

La page `/portfolio-snapshot` lit la table `portfolio` (et `_history` pour deux chiffres). Tous les calculs sont dans `frontend/src/lib/snapshot.js`.

| Élément | Calcul |
|---|---|
| Patrimoine brut | Somme des `Assets Master Currency` supérieurs à 0 (anciens relevés : `EUR` positif). Ne dépend pas du bouton Brut / Net |
| Patrimoine net | Brut + somme des `Liabilities Master Currency` (les dettes sont négatives). Sans cette colonne, net = brut. Ne dépend pas du bouton Brut / Net |
| Anneau, montants par type | Selon le bouton Brut / Net (voir « Brut ou net »). En net, un type négatif est écarté et signalé |
| Tes dettes | Mode Brut : les dettes par instrument, en positif, avec leur part du total des dettes |
| Cette année, Ce mois-ci | Variation du total (brut ou net, selon le bouton) de `_history` entre le dernier relevé avant le 1er janvier (ou le 1er du mois) et le dernier relevé jusqu'à la date des positions. Elle inclut tes versements et retraits : ce n'est pas un rendement. Sans assez de relevés, elle affiche « – » |
| Détail par type d'actif | Un bloc par valeur de `Asset`, avec des barres pour chaque découpage dont la colonne existe : Sous-type (`Sub Asset`), Instrument (`Instrument`), Enveloppe (`Envelope`, `Enveloppe`, sinon `Account`), Courtier (`Broker`), Zone (`Area`). Les 6 plus gros sont affichés, le reste est regroupé en « Autres ». Le détail montre toujours les actifs du type ; en net, l'en-tête du type donne son montant net et les dettes retirées |

Seules `Asset` et `Assets Master Currency` sont obligatoires. La page écrit en bas les colonnes réellement lues pour chaque découpage, ce qui permet de vérifier d'un coup d'œil. Pour accepter un autre nom de colonne, ajouter ce nom dans la liste `DIMENSIONS` de `snapshot.js`. Sur Snapshot, les zones restent une liste ; la carte du monde est sur la page Strategy.

### Strategy

La page `/strategie` reprend la page « Strategy » de Looker Studio : une carte du monde, puis sept anneaux à deux niveaux (graphiques « sunburst » d'ECharts, sans bibliothèque en plus). L'anneau intérieur donne les catégories, l'anneau extérieur leur détail, en nuances de la même couleur. Tous les calculs sont dans `frontend/src/lib/strategy.js`.

| Anneau | Intérieur | Extérieur | Colonnes cherchées (la première trouvée est lue) |
|---|---|---|---|
| Secteur | secteur | instrument | `Sector`, `Secteur` |
| Moat | moat | instrument | `Moat` |
| Localisation | zone | instrument | `Area`, `Localisation`, `Pays`, `Country`, `Zone` |
| Note S&P | note | instrument | `Note SP Trié`, `Note SP`, `S&P Rating`, `Rating`, `Notation` |
| Business | modèle d'affaires | instrument | `Business`, `Business Model` |
| Place de cotation | place | instrument | `Exchange`, `New Field`, `Place`, `Bourse` ; sinon le début du ticker avant `:` (`NYSE:KO` → `NYSE`) |
| Instruments | enveloppe (CTO, PEA…) | instrument (`Instrument`) | `Envelope`, `Enveloppe`, `Account`, `Compte`. Sans colonne d'enveloppe : les instruments seuls, sur un anneau |

- **Quelles lignes ?** Seules les lignes dont `Asset` vaut `public equity` (ou `equity`, `action`, `stock`) et dont `Assets Master Currency` est supérieur à 0. S'il n'y en a aucune, toutes les lignes sont comptées et la page le dit.
- **Où sont les attributs ?** Chaque attribut est cherché d'abord dans `portfolio`, puis dans la table `stock`, rattachée ligne à ligne par `Ticker` (sinon `Instrument`, sinon `Name`). Un anneau dont la colonne n'existe nulle part n'est pas affiché : la page l'écrit dans « Anneaux non affichés », avec le nom de colonne attendu. Le bloc « Colonnes lues dans la feuille », en bas de la page, montre d’où vient chaque anneau.
- **Enveloppe.** Le menu « Enveloppe » filtre tous les anneaux à la fois. Il propose « Toutes les enveloppes », « PEA et CTO » (choix par défaut quand les deux existent), puis chaque enveloppe. C'est la lecture des filtres « action / peacto / cto » des graphiques de Looker Studio : si ta feuille les définit autrement, le menu est le seul endroit à adapter (`buildScopes` dans `strategy.js`).
- **Couleurs.** Les 8 plus grosses catégories prennent des nuances de bleu, de la plus foncée (la plus grosse) à la plus claire ; le reste est regroupé en « Autres (n) » (gris), « Non renseigné » est toujours en dernier (gris clair). L'anneau extérieur montre au plus 6 détails par catégorie puis « Autres (n) » ; la vue Tableau liste tout. Les notes S&P suivent l'échelle (AAA, AA+, AA…) au lieu de la taille.
- **Carte du monde.** En premier, avant les anneaux, chaque pays est coloré selon le montant des actions dont la colonne `Area` désigne ce pays (la même colonne que l'anneau Localisation), avec une bulle à sa taille au centre du pays, pour que les petits pays restent visibles. Au survol : le montant, la part et les actions du pays ; la liste des pays et une vue Tableau sont dessous. Elle suit le menu « Enveloppe ». Une valeur qui n'est pas un pays (`world`, `europe`) est listée sous la carte. Les écritures reconnues (`usa`, `pays-bas`, `taïwan`, `korea`…) sont dans `frontend/src/lib/countries.js` : ajouter une écriture dans `aliases`, ou un pays avec son centre. Les frontières viennent du paquet `world-atlas` (110m, licence ISC), converties par `topojson-client`, et ne sont chargées qu'à l'ouverture de Strategy (`lib/charts/worldMap.js`, `components/charts/WorldMapCard.vue`). Le nom des pays est affiché dans la langue active (`countryName` de `lib/format.js`).
- **Noms sur les anneaux.** Comme sur la page Envelopes, chaque catégorie a son nom au centre, et chaque détail assez large pour être lisible a le sien sur l'anneau extérieur (`withLabels` de `lib/charts/sunburst.js`). Les autres se lisent au survol, dans la légende et dans la vue Tableau.
- Pour accepter un autre nom de colonne, l'ajouter dans la liste `ATTRIBUTES` de `strategy.js`.

### Le PDF

Le bouton **PDF** de l'en-tête (entre Simulation et la langue) fabrique un PDF de **tout le site** : une page web = une page PDF, à sa taille réelle, sans découpage en A4. Tout est dans `frontend/src/lib/pdfExport.js` :

- le site parcourt lui-même chaque page (`sitePages()`) : accueil, GoogleSheet, Flow, Snapshot, Envelopes, Strategy, Volatility, la page de chaque graphique (`/graphiques/<nom>`, Budget compris), Simulation et la page de connexion. Une nouvelle page du site y est à ajouter ;
- pour chaque page, il attend la fin du chargement (plus aucun élément `role="status"` dans le contenu pendant près d'une seconde, 25 s au plus), puis la photographie en entier telle qu'elle s'affiche (`html2canvas`) : mise en page, largeur de la fenêtre, mode clair ou sombre, brut ou net, langue, en-tête et pied de page compris ;
- les images sont assemblées en un PDF (`jsPDF`), téléchargé sous le nom `Overfolio AAAA-MM-JJ.pdf` ; la page de départ revient ensuite. Rien n'est envoyé au serveur ;
- pendant l'export, un bandeau (`components/PdfProgress.vue`) montre la progression et permet d'annuler ; il n'apparaît pas dans le PDF (`data-pdf-ignore`), et les graphiques ne sont pas animés (`BaseChart.vue`) ;
- `html2canvas` et `jspdf` (licence MIT) ne sont chargés qu'au clic sur le bouton.

Le PDF est fait d'images : le texte n'y est pas sélectionnable. Compter une quarantaine de secondes et quelques Mo pour tout le site.

### La simulation

La page `/simulation` (lien de l'en-tête, à part de la rubrique Graphiques) tire 5 000 trajectoires mois par mois jusqu'à la date de l'objectif. Elle affiche la médiane, les fourchettes 25-75 % et 10-90 %, et la part des trajectoires qui atteignent l'objectif à sa date.

- **Point de départ** : la table `portfolio` (montants par `Asset` au dernier relevé, et dette totale tirée de `Liabilities Master Currency`).
- **Valeurs proposées** : le versement mensuel est la moyenne des 12 derniers mois complets de `inout` (`in - out - tax`). L'objectif est la prochaine ligne d'objectif de `_history`. Les hypothèses par type d'actif (rendement, volatilité, lien avec les actions) sont des ordres de grandeur de long terme, dans `DEFAULT_ASSUMPTIONS` de `lib/simulation.js`.
- **Modèle** : rendements mensuels log-normaux, chocs de Student à 5 degrés de liberté (krachs plus fréquents qu'avec une loi normale) et corrélation par un facteur « marché actions ». Les versements sont répartis au prorata des actifs cochés, et les frais sont prélevés sur les actifs financiers. La dette baisse du capital remboursé chaque mois.
- **Limites** : ni impôt à la sortie ni rééquilibrage. Les résultats sont reproductibles : une graine fixe donne le même résultat pour les mêmes hypothèses.
- Tout se règle dans la page, et les réglages sont gardés par le navigateur (préférence `simulation` de `lib/preferences.js`). Le calcul tourne dans un Web Worker, en 0,3 s environ.

### Ajouter un graphique

1. Copier `frontend/src/lib/charts/budgetFlow.js` sous un nouveau nom (c'est le plus simple à lire).
2. Renseigner `slug` (l'adresse), `title`, `summary` (une phrase), `table` (l'onglet lu), `explain` (un ou deux paragraphes) et `source` (les colonnes utilisées). Ajouter `thumb` (miniature de la carte : `line`, `donut`, `sunburst` ou `sankey`) si le graphique a sa propre carte.
3. Écrire `build(table)` : `requireColumns(table, …)` retrouve les colonnes et lève un message clair si l'une manque, puis la fonction renvoie `{ subtitle, summary, option, height, table: { columns, numeric, rows } }`, ou `{ empty: 'message' }` quand il n'y a rien à afficher.
4. L'ajouter à `frontend/src/lib/charts/index.js` : `import` et tableau `CHARTS` (la page `/graphiques/<slug>` apparaît seule). Pour une entrée dans le menu de la rubrique Graphiques, ajouter aussi une entrée à `MENU` ; pour l'intégrer à une page qui en réunit plusieurs, l'ajouter à `FLOW_CHARTS`, `ENVELOPE_CHARTS` ou `VOLATILITY_CHARTS` (liste `GROUPS`).

Couleurs : n'en écrire aucune en dur, les prendre dans `lib/palette.js` (`BLUE`, `blues(n)`, `NEGATIVE`, `assignAssetColors`, `INK`, `GRID`…), sinon elles ne passent pas en mode sombre. Le build le signale ; une couleur voulue fixe (texte blanc sur une couleur de série) porte le commentaire « couleur fixe ».

Deux cas particuliers : un type ECharts encore inutilisé (par exemple `radar`) doit être enregistré dans `lib/echartsSetup.js` (actuellement : barres, courbes, secteurs, Sankey, nuage de points, anneaux à deux niveaux, carte, ligne de repère).

### Couleurs des graphiques

Toutes dans `frontend/src/lib/palette.js`, dans l'esprit des couleurs Google :

- **Types d'actifs** (colonne `Asset`) : une teinte vive par type, la même dans tous les graphiques (anneau, barres empilées, volatilité, Snapshot). Les teintes proposées sont `ASSET_SWATCHES` : 8 teintes Google (bleu, rouge, jaune, vert, orange, rose, violet, cyan), en vif et en clair. Par défaut : public equity bleu, real estate orange, fiat vert, crypto jaune, commodity cyan, managed futures violet, exotic rose, depreciating rouge ; un autre type prend une teinte restée libre. Dans le menu de Charts, « Couleurs des actifs » liste les types habituels et ceux de la feuille (table `portfolio`) : un clic sur un type ouvre ses teintes. Si la teinte est déjà prise, les deux types échangent leurs couleurs. Le choix est **enregistré en base, sur le profil** (`GET /api/profile/`, `PUT /api/profile/asset-colors/`, app `backend/profiles`) : il se retrouve sur tous les navigateurs et appareils. Les couleurs sont chargées au démarrage et à chaque connexion ou déconnexion (`lib/profile.js`, puis `applyProfileAssetColors` de `lib/palette.js`), affichées tout de suite à chaque clic, et remises comme avant avec un message si l'enregistrement échoue. « Couleurs par défaut » efface le choix. Les couleurs gardées par le navigateur avant ce changement sont recopiées une fois sur le profil, puis effacées du navigateur.
- **Profil et comptes** : sans connexion, le profil du site (sans utilisateur) s'applique. Connecté avec Google, chacun a son propre profil (`current_profile` dans `backend/profiles/views.py`) ; à la création du compte, il reprend une fois les couleurs du profil du site.
- **Tout le reste** (devises, enveloppes, catégories de Strategy, courbes du patrimoine, simulation, carte, budget) : des nuances de bleu (`BLUES`, du bleu nuit au bleu pâle). `blues(n)` donne `n` nuances bien séparées, la plus foncée pour la plus grosse catégorie ; `BLUE` est le bleu principal, `NAVY` le repère posé sur du bleu (tendance, objectif).
- **Montants négatifs** (baisse d'un mois sur l'autre, sorties d'argent, dettes) : rouge `NEGATIVE`, et orange `NEGATIVE_2` pour un second montant négatif (impôts).
- « Autres » reste gris (`CONTEXT`), « Non renseigné » gris clair.

### Apparence

| Où | Quoi |
|---|---|
| `frontend/src/lib/theme.js` | **Seule source des couleurs du site, en clair et en sombre** (`paper`, `wash`, `ink`, `line`, `accent`, `on-accent`, `danger`, `success`…), ombres des graphiques. Changer une couleur ici change le site, les graphiques et la barre du navigateur |
| `frontend/tailwind.config.js` | Crée une classe Tailwind par couleur de `theme.js` et génère les variables CSS `:root` (clair) et `html.dark` (sombre). Tailles de texte (`text-body`, `text-lead`, `text-h2`, `text-display`), ombres |
| `frontend/vite.config.ts` | Plugin `theme` : injecte la clé du thème (`preferences.js`) et les couleurs de fond de `theme.js` dans `index.html`, et signale au build toute couleur écrite en dur dans `src/lib/` (à faire passer par `palette.js`, ou à commenter « couleur fixe ») |
| `frontend/src/lib/palette.js` | Les couleurs des graphiques (voir « Couleurs des graphiques » ci-dessous), et les couleurs de fond, d'encre et de filet des graphiques, lues dans `theme.js` avec leur équivalent sombre (`DARK`) |
| `frontend/src/assets/tailwind.css` | Base : focus clavier visible, animations réduites si le système le demande, largeur du contenu. Aucune couleur |
| `frontend/src/composables/useTheme.js` | Mode sombre : suit le réglage du système ; le bouton (`components/ui/ThemeToggle.vue`) force clair ou sombre et s'en souvient (préférence `theme` de `lib/preferences.js`). Connecté, le choix est aussi enregistré sur le profil (`PUT /api/profile/`) et repris sur les autres appareils (`applyProfileTheme`). `index.html` pose la classe `dark` avant le premier affichage |
| `frontend/src/lib/chartDark.js` | Passe les graphiques en sombre dans `BaseChart.vue` : remplace les couleurs claires de `palette.js` par celles de `DARK` |
| `frontend/src/lib/sample.js` | Données **fictives** de l'aperçu de la page d'accueil. Ce ne sont pas les tiennes |

Accessibilité : lien « Aller au contenu », menu mobile utilisable au clavier (fermeture avec Échap), focus visible, animation de la courbe d'accueil désactivée avec `prefers-reduced-motion`, et chaque graphique a une version tableau.

### Langues

Le site est proposé en **français** (langue par défaut et de secours), **anglais** et **thaï**. Tous les textes sont dans `frontend/src/i18n/`, un fichier par langue, avec exactement les mêmes clés.

```
              i18n/index.js                          i18n/fr.json · en.json · th.json
   (liste des langues, langue de départ)              (mêmes clés, un texte chacune)
                     └─────────────────┬───────────────────┘
                                       ▼
                     vue-i18n : langue active (mémorisée, lib/preferences.js)
      ┌──────────────────┬─────────────┴──────┬──────────────────────┐
      ▼                  ▼                    ▼                      ▼
composants Vue      routeur              lib/format.js          LanguageSelect.vue
t('nav.charts')     titre de l'onglet    nombres et dates       (menu de l'en-tête)
                                         dans la langue active
```

| Où | Quoi |
|---|---|
| `frontend/src/i18n/index.js` | `LANGUAGES` : code, nom dans la langue elle-même, réglage des nombres et dates (`intl`). Le thaï impose le calendrier grégorien (sinon 2026 s'écrirait 2569). Langue de départ : choix enregistré, sinon celle du navigateur, sinon le français |
| `frontend/src/i18n/fr.json`, `en.json`, `th.json` | Les textes, rangés par rubrique (`nav`, `footer`, `chartsMenu`, `pages`…). Un texte avec une valeur : `"legal": "© {year} Overfolio…"`, appelé par `t('footer.legal', { year })` |
| `frontend/src/lib/format.js` | Montants, pourcentages et dates dans la langue active. Le « 1er » du mois et l'écriture « 12,5 k€ » ne s'appliquent qu'en français |
| `frontend/src/App.vue` | Au changement de langue, la page est réaffichée (`<router-view :key="locale">`) pour que tout soit refait dans la nouvelle langue |
| `frontend/vite.config.ts` | Plugin `langues` : le build s'arrête si une clé existe dans une langue et pas dans une autre, ou si une clé écrite dans le code (`t('…')`, `tList('…')`, `keypath="…"`) n'existe pas |

**Écrire un texte** : jamais de phrase en dur dans un composant ou un graphique. Ajouter la clé dans les **trois** fichiers, puis `{{ t('rubrique.cle') }}` dans le template (`const { t } = useI18n()`), ou `t()` importé de `i18n/index.js` hors composant. Les données de ta feuille (instruments, types d'actifs, colonnes) ne sont pas traduites.

**Ajouter une langue** : une entrée dans `LANGUAGES` et un fichier `<code>.json` avec toutes les clés.

**Couverture** : tout le site est traduit, pages, graphiques (titres, explications, légendes, infobulles, vues tableau, textes pour les lecteurs d'écran), messages d'erreur du serveur, nombres, dates et pourcentages. Restent tels quels : les données de ta feuille, les noms de colonnes et d'onglets, les noms des menus et les messages destinés aux développeurs (console, ligne de commande). Les traductions thaïes sont à faire relire par une personne qui parle thaï.

**Menus** : leurs noms sont toujours en anglais, dans toutes les langues : en-tête et pied de page (GoogleSheet, Charts, Simulation) et menu de la rubrique Charts (Flow, Snapshot, Envelopes, Strategy, Volatility, Budget). Ils sont dans `frontend/src/i18n/menu.js` (`MENU_NAMES`), pas dans les fichiers de langue. Tout le reste est traduit, titres des pages compris (« Historique du patrimoine » sous le menu Flow, « Patrimoine aujourd’hui » sous Snapshot…). Une phrase qui renvoie à un menu reprend son nom anglais (« la page Charts »).

**Dans le code** : un graphique déclare son titre, son résumé, son explication et sa source par des getters (`get title() { return t('charts.<nom>.title') }`), lus au moment de l'affichage ; les paragraphes sont des listes (`tList()`). Un texte au pluriel s'écrit « un | plusieurs » et s'appelle `t('cle', { count }, count)`. Un paragraphe qui contient un lien utilise `<i18n-t keypath="…">` avec un emplacement par lien, pour que le lien tombe au bon endroit dans chaque langue.

**Glossaire** : les mêmes mots partout, dans chaque langue.

| Français | Anglais | Thaï |
|---|---|---|
| patrimoine / patrimoine net / patrimoine brut | wealth / net worth / gross assets | ทรัพย์สิน / ทรัพย์สินสุทธิ / ทรัพย์สินรวม |
| actifs / dettes | assets / debts | สินทรัพย์ / หนี้สิน |
| Brut / Net (bouton de Charts) | Gross / Net | รวม / สุทธิ |
| type d'actif | asset type | ประเภทสินทรัพย์ |
| enveloppe (de placement) | (investment) envelope | บัญชีลงทุน |
| instrument / placement | instrument / investment | ตราสาร / การลงทุน |
| relevé | record | บันทึก |
| onglet / table | tab / table | แท็บ / ตาราง |
| Tout actualiser / synchroniser | Refresh all / sync | รีเฟรชทั้งหมด / ซิงค์ |
| entrées / sorties / impôts | inflows / outflows / taxes | เงินเข้า / เงินออก / ภาษี |
| versement | contribution | เงินลงทุน |
| objectif / tendance | goal / trend | เป้าหมาย / แนวโน้ม |
| médiane / trajectoire | median / path | ค่ามัธยฐาน / เส้นทาง |
| Autres / Non renseigné | Others / Not specified | อื่น ๆ / ไม่ระบุ |
| pays / carte du monde | country / world map | ประเทศ / แผนที่โลก |
| Connexion / se connecter / se déconnecter | Sign in / sign in / sign out | เข้าสู่ระบบ / เข้าสู่ระบบ / ออกจากระบบ |
| compte / profil | account / profile | บัญชี / โปรไฟล์ |
| correspondance des onglets | tab mapping | การจับคู่แท็บ |
| sélecteur de fichiers (de Google) / autoriser l'accès | (Google) file picker / allow access | ตัวเลือกไฟล์ (ของ Google) / อนุญาตการเข้าถึง |

## Commandes utiles

```bash
docker compose ps -a                    # état des services
docker compose logs -f backend          # logs du backend en direct
docker compose logs --tail 30 nginx     # derniers logs nginx
docker compose config                   # valide et affiche le compose
docker compose down                     # arrête (données conservées)
docker compose down -v                  # arrête ET supprime la base

# Migrations
docker compose exec backend python manage.py showmigrations googlesheet
docker compose exec backend python manage.py makemigrations --check --dry-run

# Tester la config nginx sans lancer la stack
docker run --rm \
  -v "$PWD/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  --add-host backend:127.0.0.1 \
  nginx:alpine nginx -t

# Accès à la base
docker compose exec db psql -U overfoliouser -d overfoliodb

# Failles connues dans les paquets Python du backend (versions de backend/requirements.txt)
pipx run pip-audit -r backend/requirements.txt

# Failles connues et versions dépassées des paquets du frontend (versions de package-lock.json)
cd frontend && npm audit && npm outdated
```

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `502 Bad Gateway` après un `up --build` | nginx garde l'ancienne adresse du backend recréé | `docker compose restart nginx` |
| `502 Bad Gateway`, backend `Exited` | Le backend plante au démarrage | `docker compose logs backend --tail 30` |
| `host not found in upstream "backend"` | Backend non démarré | Corriger le backend, puis relancer |
| `yaml: could not find expected ':'` | Clé mal indentée, tabulation ou espace insécable | `cat -A docker-compose.yml`, puis `docker compose config` |
| `SECRET_KEY not found in environment variables` | Variable absente ou mal nommée dans `.env` | Corriger `.env`, recréer le backend |
| `db` reste `unhealthy`, `backend` en `Created` | Healthcheck en échec | `docker inspect --format '{{range .State.Health.Log}}{{.Output}}{{end}}' db` |
| `role "..." does not exist` | Volume initialisé avec d'anciens identifiants | `docker compose down -v` puis relancer |
| `ImportError: cannot import name 'SheetError'` | `views.py` et `services.py` de versions différentes | Copier les deux fichiers ensemble |
| `Unknown command: 'sync_sheets'` | `management/commands/` ou un `__init__.py` manquant | Vérifier l'arborescence de `backend/googlesheet/` |
| `Document non autorisé` | Nom absent de `ALLOWED_SHEET_DOCS` | Corriger `.env`, puis `docker compose up -d --force-recreate backend` |
| `Feuille introuvable` | Document non partagé avec `CLIENT_EMAIL`, ou mauvais `GOOGLE_SHEET_ID` | Partager en Lecteur, vérifier l'identifiant |
| « La feuille n'est pas partagée par lien » | Mode lien public, mais la feuille est en accès limité | Dans Google Sheets : Partager → « Tous les utilisateurs disposant du lien », ou renseigner un compte de service |
| `Onglet 'x' introuvable` | Nom d'onglet différent (casse, espaces) | Utiliser le nom exact |
| `Google Drive API has not been used...` | API Drive désactivée | L'activer, ou définir `GOOGLE_SHEET_ID` |
| La page GoogleSheet ou un graphique dit que la table n'est pas dans la base | Onglet jamais synchronisé | Bouton Tout actualiser de la page GoogleSheet, ou `sync_sheets` |
| « Les données ne correspondent pas à ce graphique » | Nom de colonne différent de celui attendu | Comparer avec la table « Les graphiques » ci-dessus, puis corriger la feuille ou la spécification du graphique |
| Un graphique de répartition ou de flux est vide alors que la table a des lignes | Montants à 0, négatifs ou non numériques | Ces lignes sont ignorées ; vérifier la colonne de montant dans la page GoogleSheet |
| L'interface n'a pas changé après une modification du front | Le build Vue n'a pas été refait | `./init.sh` ou `docker compose up --build -d`, puis recharger sans cache |
| `failed to prepare extraction snapshot` (build) | Stockage d'images Docker incohérent | `docker image rm -f overfolio-backend overfolio-frontend`, `docker builder prune -af` |
| Google affiche `redirect_uri_mismatch` | `GOOGLE_OAUTH_REDIRECT_URI` différente de l'URI déclarée dans Google Cloud | Mettre exactement la même (protocole, port, `/` final), puis recréer le backend |
| Google affiche « Accès bloqué : l'application n'a pas été validée » | Écran de consentement « En test », adresse absente des utilisateurs test | Ajouter l'adresse Gmail dans « Utilisateurs test », ou publier l'application |
| `/newpage?error=google_token_failed` | Google injoignable au retour (réseau), ou code expiré | Réessayer ; vérifier que le serveur accède à Internet et que son horloge est à l'heure |
| `/newpage?error=google_state_invalid` | Cookie de session perdu entre le départ et le retour (autre nom d'hôte, cookies bloqués, retour trop tardif) | Ouvrir le site par la même adresse que l'URI de retour (`localhost` partout), réessayer |
| `403` « CSRF Failed » après connexion | Jeton CSRF absent, ou origine non reconnue (proxy, HTTPS) | Recharger la page (le cookie `csrftoken` est reposé) ; en production, renseigner `CSRF_TRUSTED_ORIGINS` |
| `?google_error=google_drive_denied` au retour sur GoogleSheet | Chez Google, la case d'accès aux fichiers n'a pas été cochée | Recommencer « Autoriser l'accès à ma feuille » et cocher la case |
| Le sélecteur de Google ne s'ouvre pas, ou affiche « The API developer key is invalid » | Clé API absente, non limitée à l'API Google Picker, ou site non autorisé dans ses restrictions | Vérifier `GOOGLE_PICKER_API_KEY` et les restrictions de la clé (sites `http://localhost/*`…) ; activer l'API Google Picker |
| Synchronisation en mode 3 : « Feuille introuvable ou plus autorisée » | Feuille supprimée, ou choisie par un autre compte | « Choisir une autre feuille » dans la carte 3 |
| `google_not_authorized` après un changement de `FIELD_ENCRYPTION_KEY` | Les jetons gardés ne se déchiffrent plus | Autoriser de nouveau l'accès (carte 3) |
| `git push` : mot de passe refusé | GitHub n'accepte plus les mots de passe | Clé SSH ou token d'accès personnel |

> Les identifiants PostgreSQL ne sont lus qu'à la **première initialisation** du volume. Si tu les modifies dans `.env`, recrée le volume (`docker compose down -v`).

## À venir

- **Synchronisation automatique des comptes** : la commande `sync_sheets` (et donc sa planification) ne synchronise que le site ; chaque compte synchronise avec Tout actualiser.
- **API réservée aux comptes** : aujourd'hui l'API reste publique sans connexion ; la réserver aux comptes connectés permettra d'exposer le site sur Internet.

## Sécurité

- `.env` ne doit jamais être commité, ni les fichiers `env` ou `backend/overfolio/.env`, ni une clé SSH ou un fichier JSON de compte de service : le `.gitignore` de la racine les exclut. Un fichier déjà suivi par git n'est pas concerné par le `.gitignore` : le retirer avec `git rm --cached <fichier>`. Si une clé privée a été exposée (capture d'écran, commit), la révoquer dans Google Cloud (IAM → Comptes de service → Clés) et en générer une nouvelle.
- Le mode « lien public » exige une feuille lisible par quiconque a son lien : elle contient l'intégralité du patrimoine. Pour une feuille privée, utilise un compte de service et partage-la seulement avec `CLIENT_EMAIL`.
- Passer à `DEBUG=False` (lu dans `.env`) et restreindre `ALLOWED_HOSTS` en production : en mode debug, une page d'erreur montre des valeurs internes.
- Paquets du backend : toutes les versions sont fixées dans `backend/requirements.txt` (Django 5.2, version à support long jusqu'en avril 2028). Vérifier régulièrement les failles connues avec `pip-audit` (voir « Commandes utiles »), puis monter les versions et reconstruire l'image (`./init.sh`).
- Paquets du frontend : les versions installées sont celles de `frontend/package-lock.json` (l'image les installe avec `npm ci`). Vérifier avec `npm audit` ; `npm audit fix` corrige ce qui ne demande pas de changer de version majeure. Après une mise à jour, refaire `npm run build` et tester le bouton PDF et quelques graphiques.
- Les routes `/api/sheet`, `/api/data/` et `/api/sheet-config/` sont publiques sans connexion : les restreindre avant toute exposition sur Internet.
- Connexion avec Google : flux « authorization code » côté serveur avec `state` (à usage unique) et PKCE, jeton d'identité vérifié (signature, destinataire, e-mail vérifié), compte retrouvé par `sub`, nouvelle clé de session à la connexion, adresse de retour limitée aux pages du site. Aucun mot de passe n'est gardé ; le seul jeton Google gardé (mode 3) est chiffré avec `FIELD_ENCRYPTION_KEY` et limité au scope `drive.file`. `GOOGLE_OAUTH_CLIENT_SECRET` et `FIELD_ENCRYPTION_KEY` sont des secrets : `.env` seulement. Chaque compte ne voit que sa configuration et ses données ; un compte n'hérite jamais du `.env` ni du compte de service du site. En production : `COOKIE_SECURE=True`, `CSRF_TRUSTED_ORIGINS=https://ton-domaine`.
- Le PDF du bouton PDF est fabriqué dans le navigateur et contient tout ton patrimoine : rien n'est envoyé au serveur, mais le fichier téléchargé est à garder comme une donnée sensible.

## Notes pour la production

- Retirer le montage `./backend:/app` du service `backend`.
- Utiliser un Dockerfile frontend multi-stage (build Node, puis copie du `dist` dans une image nginx).
- Dans `nginx/default.conf`, utiliser `resolver 127.0.0.11` et `set $backend http://backend:8000;` pour que nginx résolve le backend à chaque requête et évite le `502` après reconstruction.
- Mettre en place HTTPS (certificat ; `SECURE_PROXY_SSL_HEADER` est déjà réglé sur l'en-tête `X-Forwarded-Proto` de nginx), puis `COOKIE_SECURE=True`, `CSRF_TRUSTED_ORIGINS=https://ton-domaine` et l'URI de retour Google en `https://`.
- Sauvegarder régulièrement le volume `postgres_data`.
