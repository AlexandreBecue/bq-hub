# Tableau de Bord - Suivi des Chantiers \& TODOs (bq-hub)

Ce document centralise l'ensemble des tâches de nettoyage, d'interconnexion, de refactoring et d'évolutions futures pour l'écosystème **bq-hub**. Il sert de feuille de route pour les sessions de développement et de tests.

---

## Processus d'Audit \& Validation (Par Application)

Pour chaque application du hub, nous procédons de manière séquentielle selon le protocole rigoureux suivant (en s'appuyant sur notre script de diagnostic automatique : `node scripts/audit-app.js <nom-app>`) :

1. **Audit des Styles Inline** : Lancer le script d'audit pour l'app concernée afin d'identifier tous les composants ou balises HTML possédant un attribut `style="..."` codé en dur, et les migrer vers des classes CSS réutilisables ou des styles locaux `<style scoped>`.
2. **Audit des Redondances CSS** : Vérifier si des fichiers ou composants contiennent des classes CSS qui font doublon avec le style global de `@bq/theme` afin d'uniformiser au maximum le design. Ne surcharger que pour des besoins très spécifiques.
3. **Intégration du Système de Toasts** : Lancer le script d'audit pour vérifier la présence d'alertes natives, et remplacer l'ensemble de ces appels `alert(...)` par notre composant global de notifications réactives `useToast` issu de `@bq/theme`.
4. **Vérification des TODOs Spécifiques** : Analyser s'il y a des actions TODO particulières mentionnées pour l'application dans ce document ou dans son propre README, et les implémenter.
5. **Build de Validation Global** : Lancer un build de production complet (`npm run build`) pour s'assurer de l'absence de régressions, d'erreurs TypeScript ou de compilation.
6. **Lancement en Développement** : Lancer le serveur local de l'application (`npm run dev:<app>`).
7. **Revue Finale \& Peaufinage Utilisateur** : Vérification manuelle en direct des textes, de la syntaxe, de l'ergonomie et du rendu visuel par l'utilisateur pour corriger ou ajuster selon ses préférences.

## Charte Graphique \& UX Standardisée (Règles Design System)

Lors de l'audit et de l'intégration de chaque application, nous appliquons rigoureusement ces règles de style unifiées pour homogénéiser l'écosystème :

1. **Palette de Marque stricte à 2 Couleurs (Doux/Pastel)** :

   * Chaque application possède exclusivement une couleur principale (`--color-primary`) et une couleur secondaire (`--color-secondary`), définies de façon centralisée dans `@bq/theme` (ex: Bleu et Violet pour `bq-bank`).
   * Tout code couleur hexadécimal `#...` ou `rgb/rgba` en dur est interdit localement dans l'application.
2. **Couleurs Sémantiques d'Alerte (Vives/Néons)** :

   * Les indicateurs d'état ou d'alertes utilisent les variables sémantiques universelles : `success` (vert vif), `warning` (orange vif), `danger` (rouge vif), et `info` (bleu vif) pour contraster avec la douceur pastel de l'application.
   * Les icônes ou badges de catégories (ex: types de comptes) utilisent `color-mix` pour des fonds translucides dynamiques : `color-mix(in srgb, var(--color-X) 10%, transparent)`.
3. **Texture des Boutons (Solid vs Outline) pour l'UX** :

   * **Bouton Plein (Solid)** (`.btn-primary` ou `.btn-secondary`) : Réservé aux actions **sûres** qui n'altèrent pas les données existantes (ex : enregistrer, exporter les données, générer des données de démo).
   * **Bouton Contour (Outline)** (`.btn-outline` + `.btn-X`) : Réservé aux actions **dangereuses/mutatives** qui impactent, écrasent ou connectent des données réelles (ex : se connecter à Drive, importer une sauvegarde, réinitialiser).
   * **Bouton Neutre** (`.btn-neutral`) : Bouton gris ardoise réservé aux annulations pour ne pas polluer l'écran.

---

## Chantiers Transversaux (Toutes applications)

Ces tâches concernent l'homogénéisation de l'expérience utilisateur et de la base de code sur l'ensemble du monorepo.

* [x] **Remplacement des alertes natives** : Remplacer tous les appels JavaScript `alert(...)` par des bannières de notification non-bloquantes ou des fenêtres modals élégantes (ex: dans `bq-health` lors de l'enregistrement de rendez-vous, etc.). *(✔️ Fait pour `bq-bank`, `bq-car`, `bq-cloth`, `bq-coach`, `bq-cook`, `bq-health`, `bq-learn`, `bq-play` et `bq-watch`)*
* [x] **Nettoyage CSS Global (Refactoring)** :

  * Supprimer les styles locaux redondants dans les fichiers `style.scss` locaux qui font doublon avec `@bq/theme`.
  * Migrer les styles en dur (attributs `style="..."` restants dans les templates Vue) vers des classes utilitaires communes de `@bq/theme` ou des styles locaux `<style scoped>`.

---

## Feuille de Route \& Évolutions par Application

### Global à toutes les apps

* [x] **Boutons CRUD** : Dans les settings, les boutons de modification et de suppression sont colorés ; je les préfère gris et colorés seulement au survol. Et la couleur pour le bouton "éditer" est le bleu "info", pas la couleur principale.
* [x] **Centralisation css** : Centraliser les éléments css globaux (card, btn, etc.) dans le theme global.

### bq-graph

* [ ] **Suppression des devs spécifiques** : Supprimer les fonctionnalités initialement prévues pour bq-metrics qui n'ont plus d'utilité (modèles de saisie).
* [ ] **Graphiques complexes (`CollectionChartsView.vue`)** :

  * Superposition multi-séries (comparer plusieurs périodes sur un même tracé).
  * Double Axe Y (ex: afficher kilomètres cumulés vs. vitesse moyenne).
* [ ] **Indicateurs de tendance (Trends)** : Ajouter des variations calculées (ex : `+5%` ou `-2 €`) sur l'écran d'accueil.

### bq-stash (Nouveau module de recensement)

*Application / module à concevoir pour répertorier le patrimoine personnel.*

* [ ] **Mode A : Garanties \& Assurances** (High-tech, électroménager, meubles, calcul valeur patrimoine).
* [ ] **Mode B : Technique \& Entretien** (Notices PDF, notes d'entretien, alertes révisions).
* [ ] **Mode C : Collectionneur \& Partage** (Vinyles, livres, jeux, suggestion au hasard).
* [ ] **Interconnexions** : suggestions de dépenses vers `bq-bank` et interconnexions ludiques avec `bq-play`.

## Retours utilisateur

* [x] **bq-hub** : sauvegarder les données des settings dans google drive
* [x] **bq-hub** : finalement l'icone "éditer" doit être en couleur "info" plutôt que "primary"
* [x] **bq-hub** : de nombreux types de données ne peuvent pas être modifiés dans les différentes apps (tenue du jour dans bq-cloth par exemple)
* [x] **bq-hub** : remplacer les quelques boutons "Supprimer" par l'icone de suppression, et ajouter l'icone de modification
* [x] **bq-watch** : pas besoin des colonnes "origine" et "dernier visionnage" dans la collection des films maintenant que les visionnages sont dans une collection à part
* [x] **bq-watch** : pas besoin d'une vue entière pour l'inbox, un bouton avec popup suffit comme l'import de ticket de caisse dans bq-cook
* [x] **bq-watch** : la sync google drive empêche la suppression des films de la watchlist
* [x] **bq-watch** : on ne peut pas ajouter de film dans la watchlist si un autre film porte le même nom (vérifier l'id plutôt que le nom)
* [x] **bq-health** : revoir le cœur de la favicon (pas assez marqué, voir pour le colorer)
* [x] **bq-health** : “traitement & ordonnance” devient “traitement & médication” et permet de gérer la médication autonome (doliprane, spasfon, lysopaine)
* [x] **bq-health** : ajouter la possibilité d'ajouter un commentaire à la prise d'un médicament (notamment pour y renseigner la raison, la cause)
* [x] **bq-health** : ajouter un suivi médical (bilans, opérations, scanners, IRM, radio, examen gynécologique, mammographie, etc.) avec commentaire optionnel
* [x] **bq-health** : dans le cockpit, pouvoir voir un décompte des médicaments à prendre (pour gérer le stock par exemple)
* [x] **bq-health** : dans le cockpit, pouvoir cliquer sur “médicament pris” pour que ça alimente une collection de prise de médicaments (afficher la date de la dernière prise)
* [x] **bq-health** : dans le cas où la posologie dépasse 1 prise par jour, afficher un compteur plutôt qu’une checkbox pour la saisie de prise du jour
* [x] **bq-health** : permettre à l'utilisateur d'ajouter la prise de médicaments ou les rdvs dans son google agenda
* [x] **bq-health** : intégrer gemini (débrief de document médical, demande de conseils sur la médication automnome en fonction des traitements en cours et des médicaments déjà pris, etc.)
* [x] **bq-coach** : des colonnes ont été supprimées : allure, vitesse, accompagné, officiel ; ce qui impacte négativement mes graphiques dans bq-graph
* [x] **bq-cook** : revoir la favicon : manche du couteau en couleur secondaire
* [x] **bq-bank** : revoir la favicon : intégrer la couleur secondaire dans l'icone
* [x] **bq-graph** : revoir la favicon : axes du graphique en couleur secondaire
* [x] **bq-graph** : Les settings n'ont pas la même largeur que sur les autres applications (on n'a pas de marges laterales)
* [x] **bq-graph** : On a récemment ajouté des champs oubliés dans bq-coach au niveau des séances cardio, ces champs n'apparraissent pas dans bq-graph
* [x] **bq-cloth** : Erreur lors de la modification d'une tenue
* [x] **bq-cloth** : J'ai trouvé des émojis dans la popup d'ajout/modification de tenues types, il me semble qu'on s'était mis d'accord pour supprimer les emojis pour ne mettre que des icones lucide
* [x] **bq-coach** : Permettre de modifier la date de la sortie cardio
* [x] **bq-coach** : J'ai retouché légèrement le formulaire de saisie de sortie cardio, ne pas écraser ces modifications
* [x] **bq-coach** : La saisie de la durée doit être au format hh:mm:ss, on n'écrit pas 90.5 minutes pour 01:30:30
* [x] **bq-coach** : Le hover de la couleur primary est rouge, trop éloigné de la couleur primary
* [x] **bq-coach** : Les sports proposés pour les séances cardio sont statiques et s'affichent en double. Il faudrait que l'utilisateur puisse créer ses sports dans les settings, et ne pas les afficher en double.
* [x] **bq-hub** : Le petit décallage des icones du footer en fonction du overflow-x de la page consultée est génant (si la page est scrollable, la scrollbar s'affiche et cela réduit l'espace disponible pour le reste, donc crée un décallage). On devrait mettre un overflow-x: visible même quand la page n'est pas scrollable pour limiter cet effet de décalage
* [x] **bq-hub** : l'icone calendrier noire est peu lisible, les autres icones (comme les flèches des select) sont plus claires (blanc ou gris clair), il faut utiliser cette même couleur
* [x] **bq-hub** : lorsque deux champs de formulaire sont côte-à-côte on met un w-50 pour qu'ils prennent 50% de l'espace disponible chacun. Pourtant, si ces deux champs sont des select ou des champs de type date par exemple, le w-50 n'est pas respecté et les champs sont moins larges que l'espace disponible. J'ai remarqué ça dans la popup d'enregistrement de séance cardio de bq-coach mais j'imagine que c'est pareil ailleurs
* [x] **bq-hub** : retirer les boutons d’ajout de données qui s’affichent quand le composant est vide. Si aucune donnée n’existe, on affiche le message indiquant l’absence de données, et l’utilisateur peut cliquer sur le bouton d’ajout déjà existant ; pas besoin d’en ajouter un nouveau
* [x] **bq-health** : quand le médicament du jour est pris, le bouton est blanc sur gris clair donc illisible
* [x] **bq-health** : il y a deux boutons identiques pour ajouter un examen médical, supprimer l
* [x] **bq-health** : double icône sur l’ajout de médication/traitement (le + suivi de l'icone dédiée au type de médicament), supprimer la deuxième
* [x] **bq-health** : revoir les termes “automédication et ordonnance” car on veut plutôt  différencier les traitements et les prises ponctuelles
* [x] **bq-health** : les médications ponctuelles ne doivent jamais être actives, puisqu’elles sont ponctuelles
* [x] **bq-watch** : Avec l'ajout du bouton d'import, les boutons qui débordent sur mobile
* [x] **bq-watch** : Le débrief en cours disparaît au changement d’onglet
* [x] **bq-watch** : La mention “ce film est déjà dans la bibliothèque” apparait même si c’est pas le cas
* [x] **bq-watch** : Améliorer le prompt pour que les debriefs soient formulés de la même manière (rédigés à la 3e personne, pas de spoil, pas de comparaison avec d'autres films, etc.)
