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
│   │   ├── models.py               # SheetTable, SheetRow, SheetConfig
│   │   ├── config.py               # paramètres d'accès : page GoogleSheet, sinon .env
│   │   ├── sync.py                 # copie des onglets vers la base
│   │   ├── admin.py
│   │   ├── migrations/
│   │   └── management/commands/sync_sheets.py
├── frontend/
│   ├── Dockerfile                  # stage "build" (Vite)
│   ├── index.html                  # page HTML ; pose le mode sombre avant l'affichage
│   ├── vite.config.ts              # build ; plugin « theme » (index.html, contrôle des couleurs)
│   ├── tailwind.config.js          # classes de couleur et variables CSS générées depuis lib/theme.js, typographie, ombres
│   └── src/
│       ├── App.vue                 # en-tête, page affichée, pied de page
│       ├── router/index.ts         # routes (pages chargées à la demande)
│       ├── assets/tailwind.css     # base : focus clavier, animations réduites, colonne de contenu (aucune couleur)
│       ├── views/                  # une page par route
│       │   ├── HeroSection.vue     #   /                   présentation et vente
│       │   ├── SourcePage.vue      #   /sheet              onglets de la base, bouton Tout actualiser
│       │   ├── GraphiquesLayout.vue #  /graphiques         menu à gauche (6 entrées), page choisie à droite
│       │   ├── GraphiquePage.vue   #   /graphiques/<nom>   un graphique
│       │   ├── PortfolioFlowPage.vue #  /portfolio-flow    l'historique mois par mois
│       │   ├── SnapshotPage.vue    #   /portfolio-snapshot  le patrimoine d'aujourd'hui
│       │   ├── StrategyPage.vue    #   /strategie          les actions en anneaux à deux niveaux
│       │   ├── EnvelopesPage.vue   #   /enveloppes         les enveloppes de placement (CTO, PEA, PER, PEE)
│       │   ├── VolatilityPage.vue  #   /volatilite         variation du prix de chaque placement
│       │   ├── SimulationPage.vue  #   /simulation         simulation de Monte-Carlo du patrimoine
│       │   ├── NotFoundPage.vue    #   toute autre adresse
│       │   └── NewPage.vue         #   /newpage            connexion
│       ├── components/
│       │   ├── Header.vue, Footer.vue
│       │   ├── SheetSettings.vue   # formulaire « Connexion à Google Sheets » de la page /sheet
│       │   ├── ui/                 # AppButton, SegmentedControl, ThemeToggle (bouton clair / sombre)
│       │   ├── landing/            # sections de la page de présentation
│       │   └── charts/             # BaseChart, ChartView, ChartCard, ChartGroup, DataTableView, ShareBars, StrategyCard
│       ├── composables/            # useTable (charge une table), useTheme (mode clair / sombre), useReducedMotion
│       └── lib/
│           ├── api.js              # appels /api/data/...
│           ├── aggregate.js, dates.js, format.js   # calculs et formats français
│           ├── theme.js            # SOURCE UNIQUE des couleurs (clair et sombre) et de la clé du thème
│           ├── palette.js, chartTheme.js, echartsSetup.js   # couleurs et briques communes des graphiques
│           ├── chartDark.js        # passe un graphique en sombre
│           ├── simulation.js, simulation.worker.js         # calculs de la page Simulation
│           ├── snapshot.js         # calculs de la page Portfolio Snapshot
│           ├── strategy.js         # calculs de la page Stratégie CTO
│           ├── sample.js           # données FICTIVES de la page de présentation
│           └── charts/             # une spécification par graphique, index.js (liste et cartes) ; aides : sunburst, assetDonut, evolution
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
- Un compte de service Google avec accès au Google Sheet (voir « Google Sheets »)

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

# Google (compte de service)
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
| `SHEET_SYNC_TABS` | `portfolio,inout,stock,budget,_history` | Onglets recopiés en base |
| `SYNC_COOLDOWN_SECONDS` | `10` | Délai minimal entre deux synchronisations d'une même table |
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
| http://localhost/graphiques | Menu à gauche : Flow, Snapshot, Enveloppes, Strategy, Volatilité et Budget ; la page choisie s'affiche à droite (Portfolio Flow par défaut). L'ancienne adresse `/echart` fonctionne toujours |
| http://localhost/simulation | Simulation de Monte-Carlo du patrimoine (page à part, lien « Simulation » de l'en-tête) |
| http://localhost/admin/ | Admin Django |

Le port 8000 du backend n'est **pas** exposé sur l'hôte : tout passe par nginx.

### Utilisation

1. **Brancher le Google Sheet** : page GoogleSheet (`/sheet`), bloc « Connexion à Google Sheets » (ou `.env`, voir « Google Sheets »).
2. **Copier les données en base** : bouton **Tout actualiser** de la même page (ou `./init.sh --sync`). Les graphiques lisent la base, pas le Google Sheet : sans cette étape, ils restent vides. Recommencer après chaque mise à jour de la feuille, ou automatiser (« Synchronisation automatique »).
3. **Lire les graphiques** : rubrique **Graphiques**, menu à gauche (Flow, Snapshot, Enveloppes, Strategy, Volatilité, Budget). Chaque graphique a une vue Tableau et une page d'explication (source des chiffres).
4. **Projeter** : page **Simulation**, réglages dans la page.
5. **Mode clair / sombre** : le site suit le réglage du système ; le bouton soleil/lune de l'en-tête force l'un ou l'autre, et le choix est gardé par le navigateur.

### Créer un compte administrateur

```bash
docker compose exec backend python manage.py createsuperuser
```

## Google Sheets

1. Dans le projet Google Cloud du compte de service, active l'**API Google Sheets**. L'**API Drive** n'est nécessaire que si l'identifiant du document n'est pas renseigné.
2. Partage le document avec l'adresse du compte de service (`CLIENT_EMAIL`), en **Lecteur**. Un partage « toute personne disposant du lien » ne suffit pas pour que le compte de service le liste, mais l'ouverture par identifiant fonctionne dès que le compte y a accès.
3. Renseigne les paramètres sur la page **GoogleSheet** (`/sheet`, bloc « Connexion à Google Sheets »), ou dans `.env`.

### Paramètres saisis sur la page GoogleSheet

Les variables Google du `.env` (`TYPE`, `PROJECT_ID`, `PRIVATE_KEY_ID`, `PRIVATE_KEY`, `CLIENT_EMAIL`, `CLIENT_ID`, `AUTH_URI`, `TOKEN_URI`, `AUTH_PROVIDER_X509_CERT_URL`, `CLIENT_X509_CERT_URL`, `UNIVERSE_DOMAIN`, `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_DOC_NAME`, `SHEET_SYNC_TABS`) se modifient aussi depuis la page GoogleSheet :

- Les champs sont préremplis avec les valeurs en vigueur. Tant que rien n'a été enregistré, ce sont celles du `.env`.
- **Enregistrer** les écrit en base (table `googlesheet_sheetconfig`, une seule ligne). Elles remplacent alors le `.env` pour la synchronisation, la commande `sync_sheets` et `/api/sheet`, sans redémarrer le backend.
- **Revenir aux valeurs du .env** efface la ligne enregistrée.
- **Importer le fichier JSON** remplit les champs du compte de service depuis le fichier téléchargé dans Google Cloud (lu dans le navigateur).
- L'identifiant du document accepte aussi l'adresse complète du Google Sheet.
- La **clé privée n'est jamais renvoyée au navigateur** : le champ reste vide. Laissé vide, la clé en vigueur est conservée.

API : `GET /api/sheet-config/` (valeurs, sans la clé privée), `PUT /api/sheet-config/` (enregistre ; 400 avec `fields` si la saisie est incomplète), `DELETE /api/sheet-config/` (retour au `.env`).

> ⚠️ Comme le reste de l'API, cette route est publique : toute personne qui atteint l'application peut changer le document lu. Ne pas exposer l'application sur Internet sans authentification.

Onglets utilisés :

| Onglet | Contenu | Utilisé par |
|---|---|---|
| `portfolio` | Positions actuelles (en-tête en ligne 2, la ligne 1 est une synthèse) | Portfolio Snapshot, Stratégie CTO |
| `_history` | Historique des relevés (et tes objectifs : lignes avec seulement une date et un montant) | Portfolio Flow, Enveloppes, Volatilité, variations de Portfolio Snapshot |
| `inout` | Entrées et sorties d'argent (colonnes date, in, out, tax) | Graphique Entrées, sorties et impôts de Portfolio Flow |
| `budget` | Budget : de quelle source vers quelle destination | Flux du budget |
| `stock` | Valeurs suivies | Stratégie CTO (secteur, moat, note…), page GoogleSheet |

La lecture détecte seule la ligne d'en-tête. Les nombres sont lus en valeurs brutes (pas de format régional ni de symbole monétaire).

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
| backend | Google Sheets | Lecture des onglets | HTTPS, compte de service |

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
  utilisé par : la page GoogleSheet et les pages de graphiques

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
| GET | `/api/data/` | Liste des tables en base (nom, nombre de lignes, date de synchronisation) |
| GET | `/api/data/<onglet>/` | Colonnes (dans l'ordre) et lignes d'une table |
| POST | `/api/data/sync/` | Relit tous les onglets de la liste et met la base à jour. Un onglet en erreur garde ses anciennes données ; 502 si aucun n'a pu être enregistré |
| POST | `/api/data/<onglet>/sync/` | Relit l'onglet dans Google Sheets et met la base à jour |
| GET, PUT, DELETE | `/api/sheet-config/` | Paramètres d'accès au Google Sheet (voir « Paramètres saisis sur la page GoogleSheet ») |

Les erreurs sont renvoyées en JSON `{"error": "..."}` : `404` (onglet ou document introuvable), `429` (synchronisation trop rapprochée), `502` (erreur de l'API Google).

> Ces routes n'ont pas d'authentification. Avant d'exposer le site sur Internet, restreins l'API aux utilisateurs connectés.

## Base de données

La synchronisation recopie chaque onglet dans deux tables :

| Table | Contenu |
|---|---|
| `googlesheet_sheettable` | Une ligne par onglet : nom, ordre des colonnes, ligne d'en-tête, nombre de lignes, date de synchronisation |
| `googlesheet_sheetrow` | Une ligne par ligne de données, sous la forme JSON `{colonne: valeur}` |

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

Le front est en Vue 3 (`<script setup>`), Tailwind 3 et ECharts. Il ne lit que la base, par `/api/data/...` : l'API et le backend ne sont pas concernés par l'interface.

### Pages

| Adresse | Fichier | Contenu |
|---|---|---|
| `/` | `views/HeroSection.vue` et `components/landing/` | Présentation : promesse, aperçu, avantages, étapes, questions fréquentes |
| `/sheet` | `views/SourcePage.vue` | Menu des onglets, tableau (en-tête fixe, recherche, 50 lignes par page), bouton Tout actualiser. `/sheet?onglet=budget` ouvre un onglet précis |
| `/graphiques` | `views/GraphiquesLayout.vue` | Mise en page de la rubrique : menu en colonne à gauche (liste `MENU` de `lib/charts/index.js` : Flow, Snapshot, Enveloppes, Strategy, Volatilité, Budget), page choisie à droite. `/graphiques` ouvre Portfolio Flow. Les six pages et `/graphiques/<nom>` s'affichent dans cette mise en page ; sur mobile, le menu devient une rangée d'onglets |
| `/graphiques/<nom>` | `views/GraphiquePage.vue` et `components/charts/ChartView.vue` | Un graphique : titre, date des données, explication, source des chiffres, vue tableau. `flux-budget` ou l'un des graphiques de Portfolio Flow, Enveloppes ou Volatilité (leur fil d'Ariane passe par leur page) |
| `/portfolio-flow` | `views/PortfolioFlowPage.vue` et `components/charts/ChartGroup.vue` | L'historique mois par mois : les 6 graphiques « Portfolio Flow » sur une seule page, avec un choix d'année (`?annee=2026`) qui remplace les pages 2024, 2025 et 2026 de l'ancien rapport |
| `/enveloppes` | `views/EnvelopesPage.vue` et `lib/charts/envelopes.js` | Les enveloppes de placement (celles qui contiennent des actions, des ETF ou des fonds) : anneau enveloppe → instrument, évolution, répartition par sous-type et par zone |
| `/volatilite` | `views/VolatilityPage.vue` et `lib/charts/volatility.js` | Une bulle par placement : montant détenu et variation du prix unitaire sur 1 mois, 3 mois et 1 an |
| `/simulation` | `views/SimulationPage.vue`, `lib/simulation.js`, `lib/simulation.worker.js` et `lib/charts/simulationFan.js` | Page à part (lien « Simulation » de l'en-tête, hors de la rubrique Graphiques) : simulation de Monte-Carlo du patrimoine net (5 000 trajectoires mensuelles) et probabilité d'atteindre l'objectif. Voir « La simulation » |
| `/portfolio-snapshot` | `views/SnapshotPage.vue` et `lib/snapshot.js` | Le patrimoine d'aujourd'hui : brut, net, variation de l'année et du mois, anneau des types d'actifs, détail par type |
| `/strategie` | `views/StrategyPage.vue`, `components/charts/StrategyCard.vue`, `lib/strategy.js` et `lib/charts/sunburst.js` | Stratégie CTO : tes actions en anneaux à deux niveaux (secteur, moat, localisation, note S&P, business, place de cotation, instruments), avec un choix d'enveloppe |
| autre adresse | `views/NotFoundPage.vue` | Page introuvable |
| `/newpage` | `views/NewPage.vue` | Connexion, au style du site (carte à filet fin, bleu d'accent, clair ou sombre). La connexion est encore une simulation : rien n'est envoyé au serveur |

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

Quatorze graphiques ont leur propre page `/graphiques/<nom>` : Flux du budget et ceux de Portfolio Flow, Enveloppes et Volatilité. Chacun est un fichier de `frontend/src/lib/charts/`. Les noms de colonnes doivent être ceux de la table ; la casse, les accents et les espaces sont ignorés.

| `<nom>` dans l'adresse | Table | Colonnes lues |
|---|---|---|
| `flux-budget` | `budget` | `Source`, `Destination`, `Valeur`. Lignes supérieures à 0, doublons additionnés |
| `patrimoine-devises` | `_history` | `Date` et une colonne de montants par devise dont le nom contient `CHF`, `EUR` ou `USD` (par exemple `Assets CHF`). Les colonnes de prix, de quantité et de dettes sont ignorées |
| `repartition-mensuelle` | `_history` | `Date`, `Asset`, `Assets Master Currency`. Barres à 100 % par mois |
| `evolution-par-actif` | `_history` | `Date`, `Asset`, `Assets Master Currency`. Une courbe par type d'actif |
| `variation-mensuelle` | `_history` | `Date`, `Assets Master Currency`. Variation en % du total d'un mois à l'autre |
| `entrees-sorties` | `inout` | `date`, `in`, `out`, `tax` (facultative). Barres par mois ; sorties et impôts saisis en négatif comptés en valeur absolue |
| `patrimoine-tendance` | `_history` | `Date` et la colonne en euros (`EUR`, sinon `Assets Master Currency`). Barres par relevé, droite de tendance prolongée jusqu'au dernier objectif, et objectifs (lignes sans `Asset` ni `Instrument`) |
| `enveloppes-instruments` | `portfolio` | `Envelope` (ou `Account`), `Instrument`, `Assets Master Currency`, `Asset` |
| `enveloppes-evolution` | `_history` | `Date`, `Envelope`, `Asset`, `Assets Master Currency` |
| `enveloppes-types`, `enveloppes-zones` | `portfolio` | `Envelope`, `Sub Asset` (ou `Area`), `Assets Master Currency` |
| `volatilite-1-mois`, `volatilite-3-mois`, `volatilite-1-an` | `_history` | `Date`, `Instrument`, `Quantity`, `Assets Master Currency` (et `Asset`, `Envelope`, `Broker`). Prix unitaire = montant ÷ quantité ; liquidités, immobilier, biens qui se déprécient et objets écartés |

Les graphiques de `patrimoine-devises` à `patrimoine-tendance` forment la page `/portfolio-flow`. Ils prennent, pour chaque mois, le **dernier relevé** du mois (plusieurs relevés par mois ne s'additionnent pas). Une date isolée, à plus de 6 mois des autres (un objectif en 2039, un vieux relevé), est écartée des graphiques mensuels, et la page le signale ; le graphique `patrimoine-tendance` garde toutes les dates et affiche les objectifs à part.

Les anciens graphiques à part (évolution du patrimoine, répartition par type d'actif, par zone, par compte, plus grosses positions) ont été retirés : Portfolio Snapshot et Stratégie CTO couvrent la répartition. Le fichier `lib/charts/evolution.js` reste, mais seulement comme courbe de l'aperçu de la page d'accueil.

Les totaux utilisent uniquement `Assets Master Currency` (et `Liabilities Master Currency`) : `Currency Price` est la devise de cotation et `Equity` mélange plusieurs devises, donc aucun des deux ne sert à additionner.

Si une colonne manque, la page du graphique le dit en clair et renvoie vers la page GoogleSheet. Si la table n'a jamais été synchronisée, elle propose d'ouvrir l'onglet correspondant pour cliquer sur Tout actualiser.

### Portfolio Snapshot

La page `/portfolio-snapshot` lit la table `portfolio` (et `_history` pour deux chiffres). Tous les calculs sont dans `frontend/src/lib/snapshot.js`.

| Élément | Calcul |
|---|---|
| Patrimoine brut | Somme des `Assets Master Currency` supérieurs à 0 |
| Patrimoine net | Brut + somme des `Liabilities Master Currency` (les dettes sont négatives). Sans cette colonne, net = brut |
| Cette année, Ce mois-ci | Variation du total de `_history` entre le dernier relevé avant le 1er janvier (ou le 1er du mois) et le dernier relevé jusqu'à la date des positions. Elle inclut tes versements et retraits : ce n'est pas un rendement. Sans assez de relevés, elle affiche « – » |
| Détail par type d'actif | Un bloc par valeur de `Asset`, avec des barres pour chaque découpage dont la colonne existe : Sous-type (`Sub Asset`), Instrument (`Instrument`), Enveloppe (`Envelope`, `Enveloppe`, sinon `Account`), Courtier (`Broker`), Zone (`Area`). Les 6 plus gros sont affichés, le reste est regroupé en « Autres » |

Seules `Asset` et `Assets Master Currency` sont obligatoires. La page écrit en bas les colonnes réellement lues pour chaque découpage, ce qui permet de vérifier d'un coup d'œil. Pour accepter un autre nom de colonne, ajouter ce nom dans la liste `DIMENSIONS` de `snapshot.js`. La carte du monde de Looker Studio est remplacée par une liste de zones : une carte demanderait un fichier de fonds de carte, donc une nouvelle ressource.

### Stratégie CTO

La page `/strategie` reprend la page « Stratégie CTO » de Looker Studio : sept anneaux à deux niveaux (graphiques « sunburst » d'ECharts, sans bibliothèque en plus). L'anneau intérieur donne les catégories, l'anneau extérieur leur détail, en nuances de la même couleur. Tous les calculs sont dans `frontend/src/lib/strategy.js`.

| Anneau | Intérieur | Extérieur | Colonnes cherchées (la première trouvée est lue) |
|---|---|---|---|
| Secteur | secteur | instrument | `Sector`, `Secteur` |
| Moat | moat | instrument | `Moat` |
| Localisation | zone | instrument | `Area`, `Localisation`, `Pays`, `Country`, `Zone` |
| Note S&P | note | instrument | `Note SP Trié`, `Note SP`, `S&P Rating`, `Rating`, `Notation` |
| Business | modèle d'affaires | instrument | `Business`, `Business Model` |
| Place de cotation | place | instrument | `Exchange`, `New Field`, `Place`, `Bourse` ; sinon le début du ticker avant `:` (`NYSE:KO` → `NYSE`) |
| Instruments | instrument (`Instrument`) | enveloppe | `Envelope`, `Enveloppe`, `Account`, `Compte` |

- **Quelles lignes ?** Seules les lignes dont `Asset` vaut `public equity` (ou `equity`, `action`, `stock`) et dont `Assets Master Currency` est supérieur à 0. S'il n'y en a aucune, toutes les lignes sont comptées et la page le dit.
- **Où sont les attributs ?** Chaque attribut est cherché d'abord dans `portfolio`, puis dans la table `stock`, rattachée ligne à ligne par `Ticker` (sinon `Instrument`, sinon `Name`). Un anneau dont la colonne n'existe nulle part n'est pas affiché : la page l'écrit dans « Anneaux non affichés », avec le nom de colonne attendu. Le bloc « Colonnes lues dans la feuille », en bas de la page, montre d’où vient chaque anneau.
- **Enveloppe.** Le menu « Enveloppe » filtre tous les anneaux à la fois. Il propose « Toutes les enveloppes », « PEA et CTO » (choix par défaut quand les deux existent), puis chaque enveloppe. C'est la lecture des filtres « action / peacto / cto » des graphiques de Looker Studio : si ta feuille les définit autrement, le menu est le seul endroit à adapter (`buildScopes` dans `strategy.js`).
- **Couleurs.** Les 8 plus grosses catégories prennent les couleurs de la palette dans l'ordre ; le reste est regroupé en « Autres (n) » (gris), « Non renseigné » est toujours en dernier (gris clair). L'anneau extérieur montre au plus 6 détails par catégorie puis « Autres (n) » ; la vue Tableau liste tout. Les notes S&P suivent l'échelle (AAA, AA+, AA…) au lieu de la taille.
- Pour accepter un autre nom de colonne, l'ajouter dans la liste `ATTRIBUTES` de `strategy.js`.

### La simulation

La page `/simulation` (lien de l'en-tête, à part de la rubrique Graphiques) tire 5 000 trajectoires mois par mois jusqu'à la date de l'objectif. Elle affiche la médiane, les fourchettes 25-75 % et 10-90 %, et la part des trajectoires qui atteignent l'objectif à sa date.

- **Point de départ** : la table `portfolio` (montants par `Asset` au dernier relevé, et dette totale tirée de `Liabilities Master Currency`).
- **Valeurs proposées** : le versement mensuel est la moyenne des 12 derniers mois complets de `inout` (`in - out - tax`). L'objectif est la prochaine ligne d'objectif de `_history`. Les hypothèses par type d'actif (rendement, volatilité, lien avec les actions) sont des ordres de grandeur de long terme, dans `DEFAULT_ASSUMPTIONS` de `lib/simulation.js`.
- **Modèle** : rendements mensuels log-normaux, chocs de Student à 5 degrés de liberté (krachs plus fréquents qu'avec une loi normale) et corrélation par un facteur « marché actions ». Les versements sont répartis au prorata des actifs cochés, et les frais sont prélevés sur les actifs financiers. La dette baisse du capital remboursé chaque mois.
- **Limites** : ni impôt à la sortie ni rééquilibrage. Les résultats sont reproductibles : une graine fixe donne le même résultat pour les mêmes hypothèses.
- Tout se règle dans la page, et les réglages sont gardés par le navigateur (`localStorage`). Le calcul tourne dans un Web Worker, en 0,3 s environ.

### Ajouter un graphique

1. Copier `frontend/src/lib/charts/budgetFlow.js` sous un nouveau nom (c'est le plus simple à lire).
2. Renseigner `slug` (l'adresse), `title`, `summary` (une phrase), `table` (l'onglet lu), `explain` (un ou deux paragraphes) et `source` (les colonnes utilisées). Ajouter `thumb` (miniature de la carte : `line`, `donut`, `sunburst` ou `sankey`) si le graphique a sa propre carte.
3. Écrire `build(table)` : `requireColumns(table, …)` retrouve les colonnes et lève un message clair si l'une manque, puis la fonction renvoie `{ subtitle, summary, option, height, table: { columns, numeric, rows } }`, ou `{ empty: 'message' }` quand il n'y a rien à afficher.
4. L'ajouter à `frontend/src/lib/charts/index.js` : `import` et tableau `CHARTS` (la page `/graphiques/<slug>` apparaît seule). Pour une entrée dans le menu de la rubrique Graphiques, ajouter aussi une entrée à `MENU` ; pour l'intégrer à une page qui en réunit plusieurs, l'ajouter à `FLOW_CHARTS`, `ENVELOPE_CHARTS` ou `VOLATILITY_CHARTS` (liste `GROUPS`).

Couleurs : n'en écrire aucune en dur, les prendre dans `lib/palette.js` (`SERIES`, `INK`, `GRID`…), sinon elles ne passent pas en mode sombre. Le build le signale ; une couleur voulue fixe (texte blanc sur une couleur de série) porte le commentaire « couleur fixe ».

Deux cas particuliers : un type ECharts encore inutilisé (par exemple `radar`) doit être enregistré dans `lib/echartsSetup.js` (actuellement : barres, courbes, secteurs, Sankey, nuage de points, anneaux à deux niveaux, ligne de repère).

### Apparence

| Où | Quoi |
|---|---|
| `frontend/src/lib/theme.js` | **Seule source des couleurs du site, en clair et en sombre** (`paper`, `wash`, `ink`, `line`, `accent`, `on-accent`, `danger`, `success`…), ombres des graphiques et clé du choix enregistré. Changer une couleur ici change le site, les graphiques et la barre du navigateur |
| `frontend/tailwind.config.js` | Crée une classe Tailwind par couleur de `theme.js` et génère les variables CSS `:root` (clair) et `html.dark` (sombre). Tailles de texte (`text-body`, `text-lead`, `text-h2`, `text-display`), ombres |
| `frontend/vite.config.ts` | Plugin `theme` : injecte la clé et les couleurs de fond de `theme.js` dans `index.html`, et signale au build toute couleur écrite en dur dans `src/lib/` (à faire passer par `palette.js`, ou à commenter « couleur fixe ») |
| `frontend/src/lib/palette.js` | Les 8 couleurs des graphiques (un type d'actif garde la même couleur partout), et les couleurs de fond, d'encre et de filet des graphiques, lues dans `theme.js` avec leur équivalent sombre (`DARK`) |
| `frontend/src/assets/tailwind.css` | Base : focus clavier visible, animations réduites si le système le demande, largeur du contenu. Aucune couleur |
| `frontend/src/composables/useTheme.js` | Mode sombre : suit le réglage du système ; le bouton (`components/ui/ThemeToggle.vue`) force clair ou sombre et s'en souvient. `index.html` pose la classe `dark` avant le premier affichage |
| `frontend/src/lib/chartDark.js` | Passe les graphiques en sombre dans `BaseChart.vue` : remplace les couleurs claires de `palette.js` par celles de `DARK` |
| `frontend/src/lib/sample.js` | Données **fictives** de l'aperçu de la page d'accueil. Ce ne sont pas les tiennes |

Accessibilité : lien « Aller au contenu », menu mobile utilisable au clavier (fermeture avec Échap), focus visible, animation de la courbe d'accueil désactivée avec `prefers-reduced-motion`, et chaque graphique a une version tableau.

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
| `Onglet 'x' introuvable` | Nom d'onglet différent (casse, espaces) | Utiliser le nom exact |
| `Google Drive API has not been used...` | API Drive désactivée | L'activer, ou définir `GOOGLE_SHEET_ID` |
| La page GoogleSheet ou un graphique dit que la table n'est pas dans la base | Onglet jamais synchronisé | Bouton Tout actualiser de la page GoogleSheet, ou `sync_sheets` |
| « Les données ne correspondent pas à ce graphique » | Nom de colonne différent de celui attendu | Comparer avec la table « Les graphiques » ci-dessus, puis corriger la feuille ou la spécification du graphique |
| Un graphique de répartition ou de flux est vide alors que la table a des lignes | Montants à 0, négatifs ou non numériques | Ces lignes sont ignorées ; vérifier la colonne de montant dans la page GoogleSheet |
| L'interface n'a pas changé après une modification du front | Le build Vue n'a pas été refait | `./init.sh` ou `docker compose up --build -d`, puis recharger sans cache |
| `failed to prepare extraction snapshot` (build) | Stockage d'images Docker incohérent | `docker image rm -f overfolio-backend overfolio-frontend`, `docker builder prune -af` |
| `git push` : mot de passe refusé | GitHub n'accepte plus les mots de passe | Clé SSH ou token d'accès personnel |

> Les identifiants PostgreSQL ne sont lus qu'à la **première initialisation** du volume. Si tu les modifies dans `.env`, recrée le volume (`docker compose down -v`).

## À venir

- **Comptes et connexion.** La page `/newpage` est la future page de connexion ; elle est factice pour l'instant (aucun compte vérifié, rien n'est envoyé au serveur). Une fois branchée (comptes Django, session), l'API sera réservée aux utilisateurs connectés, ce qui permettra d'exposer le site sur Internet. Les nouvelles fonctions sont écrites en le prévoyant (voir `CLAUDE.md`).

## Sécurité

- `.env` ne doit jamais être commité, ni les fichiers `env` ou `backend/overfolio/.env`, ni une clé SSH ou un fichier JSON de compte de service : le `.gitignore` de la racine les exclut. Un fichier déjà suivi par git n'est pas concerné par le `.gitignore` : le retirer avec `git rm --cached <fichier>`. Si une clé privée a été exposée (capture d'écran, commit), la révoquer dans Google Cloud (IAM → Comptes de service → Clés) et en générer une nouvelle.
- Ne partage pas le Google Sheet par lien public : il contient l'intégralité du patrimoine. Partage-le seulement avec `CLIENT_EMAIL`.
- Passer à `DEBUG=False` et restreindre `ALLOWED_HOSTS` en production.
- Les routes `/api/sheet`, `/api/data/` et `/api/sheet-config/` sont publiques : les restreindre avant toute exposition sur Internet.

## Notes pour la production

- Retirer le montage `./backend:/app` du service `backend`.
- Utiliser un Dockerfile frontend multi-stage (build Node, puis copie du `dist` dans une image nginx).
- Dans `nginx/default.conf`, utiliser `resolver 127.0.0.11` et `set $backend http://backend:8000;` pour que nginx résolve le backend à chaque requête et évite le `502` après reconstruction.
- Mettre en place HTTPS (certificat, `SECURE_PROXY_SSL_HEADER`, `CSRF_TRUSTED_ORIGINS`).
- Sauvegarder régulièrement le volume `postgres_data`.
