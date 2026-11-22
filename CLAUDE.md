# Consignes pour Claude

Ce fichier est lu au début de chaque session sur ce dépôt. Le README décrit le projet (installation, architecture, fonctionnement) : le lire avant de modifier le code.

## Façon de travailler

- **Une PR par modification**, toujours créée à partir du `main` à jour (`git fetch origin main`). Ne jamais ajouter de commit à une PR déjà ouverte : elle peut être mergée à tout moment, et le commit serait perdu.
- Commits et PR en français, avec un titre qui dit ce qui change pour l'utilisateur.
- **README à tenir à jour dans la même PR** que le code : arborescence, pages, graphiques, schémas, apparence.
- Vérifier avant de pousser : `cd frontend && npm run build` (vérification TypeScript, build Vite et contrôle des couleurs en dur).
- Interface et documentation en français ; tutoiement dans les textes de l'interface.

## Couleurs et mode clair / sombre

- **`frontend/src/lib/theme.js` est la seule source des couleurs** (clair et sombre) et de la clé du thème. Ne jamais écrire une valeur de couleur ailleurs.
- Composants : uniquement les classes de couleur (`bg-paper`, `text-ink`, `border-line`…), jamais `bg-white`, `text-black` ni de code couleur.
- Graphiques : couleurs prises dans `frontend/src/lib/palette.js`. Une couleur volontairement fixe (texte blanc sur une couleur de série) porte le commentaire `// couleur fixe` sur sa ligne, sinon le build affiche un avertissement.

## Fonctions à venir : à prévoir dès maintenant

### Comptes et connexion

La page `/newpage` (`frontend/src/views/NewPage.vue`) est la **future page de connexion**. Elle est factice pour l'instant (aucune vérification, rien n'est envoyé au serveur). **La garder, ne pas réutiliser son adresse.**

Quand elle sera branchée : comptes Django, session, et API réservée aux utilisateurs connectés. En attendant, pour toute nouvelle fonction :

- ne pas supposer que l'API restera publique : toute nouvelle route sous `/api/` doit pouvoir être protégée plus tard sans changer son fonctionnement ;
- les réglages propres à une personne (mode sombre, réglages de la simulation…) restent dans le navigateur (`localStorage`), mais regroupés pour pouvoir passer sur le compte plus tard ;
- ne jamais écrire un mot de passe ou une donnée sensible dans la console ou les logs (le `console.log` de `NewPage.vue` est à retirer lors du branchement).

## Sécurité

- Ne jamais commiter de secret : `.env`, clés privées, identifiants Google.
- Le dépôt est public. Une clé SSH privée (`keysave`) a été commitée par erreur puis retirée : elle reste dans l'historique git, ne jamais la réutiliser. Le `.gitignore` de la racine exclut désormais `.env`, les clés et les fichiers de compte de service.
