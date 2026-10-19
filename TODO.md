# 📋 Tableau de Bord - Suivi des Chantiers & TODOs (bq-hub)

Ce document centralise l'ensemble des tâches de nettoyage, d'interconnexion, de refactoring et d'évolutions futures pour l'écosystème **bq-hub**. Il sert de feuille de route pour les sessions de développement et de tests.

---

## ⚙️ Processus d'Audit & Validation (Par Application)

Pour chaque application du hub, nous procédons de manière séquentielle selon le protocole rigoureux suivant (en s'appuyant sur notre script de diagnostic automatique : `node scripts/audit-app.js <nom-app>`) :

1. **Audit des Styles Inline** : Lancer le script d'audit pour l'app concernée afin d'identifier tous les composants ou balises HTML possédant un attribut `style="..."` codé en dur, et les migrer vers des classes CSS réutilisables ou des styles locaux `<style scoped>`.
2. **Audit des Redondances CSS** : Vérifier si des fichiers ou composants contiennent des classes CSS qui font doublon avec le style global de `@bq/theme` afin d'uniformiser au maximum le design. Ne surcharger que pour des besoins très spécifiques.
3. **Intégration du Système de Toasts** : Lancer le script d'audit pour vérifier la présence d'alertes natives, et remplacer l'ensemble de ces appels `alert(...)` par notre composant global de notifications réactives `useToast` issu de `@bq/theme`.
4. **Vérification des TODOs Spécifiques** : Analyser s'il y a des actions TODO particulières mentionnées pour l'application dans ce document ou dans son propre README, et les implémenter.
5. **Build de Validation Global** : Lancer un build de production complet (`npm run build`) pour s'assurer de l'absence de régressions, d'erreurs TypeScript ou de compilation.
6. **Lancement en Développement** : Lancer le serveur local de l'application (`npm run dev:<app>`).
7. **Revue Finale & Peaufinage Utilisateur** : Vérification manuelle en direct des textes, de la syntaxe, de l'ergonomie et du rendu visuel par l'utilisateur pour corriger ou ajuster selon ses préférences.

## 🎨 Charte Graphique & UX Standardisée (Règles Design System)

Lors de l'audit et de l'intégration de chaque application, nous appliquons rigoureusement ces règles de style unifiées pour homogénéiser l'écosystème :

1. **Palette de Marque stricte à 2 Couleurs (Doux/Pastel)** :
   - Chaque application possède exclusivement une couleur principale (`--color-primary`) et une couleur secondaire (`--color-secondary`), définies de façon centralisée dans `@bq/theme` (ex: Bleu et Violet pour `bq-bank`).
   - Tout code couleur hexadécimal `#...` ou `rgb/rgba` en dur est interdit localement dans l'application.
2. **Couleurs Sémantiques d'Alerte (Vives/Néons)** :
   - Les indicateurs d'état ou d'alertes utilisent les variables sémantiques universelles : `success` (vert vif), `warning` (orange vif), `danger` (rouge vif), et `info` (bleu vif) pour contraster avec la douceur pastel de l'application.
   - Les icônes ou badges de catégories (ex: types de comptes) utilisent `color-mix` pour des fonds translucides dynamiques : `color-mix(in srgb, var(--color-X) 10%, transparent)`.
3. **Texture des Boutons (Solid vs Outline) pour l'UX** :
   - **Bouton Plein (Solid)** (`.btn-primary` ou `.btn-secondary`) : Réservé aux actions **sûres** qui n'altèrent pas les données existantes (ex : enregistrer, exporter les données, générer des données de démo).
   - **Bouton Contour (Outline)** (`.btn-outline` + `.btn-X`) : Réservé aux actions **dangereuses/mutatives** qui impactent, écrasent ou connectent des données réelles (ex : se connecter à Drive, importer une sauvegarde, réinitialiser).
   - **Bouton Neutre** (`.btn-neutral`) : Bouton gris ardoise réservé aux annulations pour ne pas polluer l'écran.

---

## 🏛️ 1. Chantiers Transversaux (Toutes applications)

Ces tâches concernent l'homogénéisation de l'expérience utilisateur et de la base de code sur l'ensemble du monorepo.

- [ ] **Remplacement des alertes natives** : Remplacer tous les appels JavaScript `alert(...)` par des bannières de notification non-bloquantes ou des fenêtres modals élégantes (ex: dans `bq-health` lors de l'enregistrement de rendez-vous, etc.). *(✔️ Fait pour `bq-bank`, `bq-car`, `bq-cloth`, `bq-coach`, `bq-cook`, `bq-health`, `bq-learn`, `bq-play` et `bq-watch`)*
- [ ] **Nettoyage CSS Global (Refactoring)** : 
  - Supprimer les styles locaux redondants dans les fichiers `style.scss` locaux qui font doublon avec `@bq/theme`.
  - Migrer les styles en dur (attributs `style="..."` restants dans les templates Vue) vers des classes utilitaires communes de `@bq/theme` ou des styles locaux `<style scoped>`. *(✔️ Fait pour `bq-bank`, `bq-car`, `bq-cloth`, `bq-coach`, `bq-cook`, `bq-health`, `bq-learn`, `bq-play` et `bq-watch`)*

---

## 🔄 2. Suggestions Cross-App (Inbox Financière de `bq-bank`)

Mise en place et validation de la file d'attente transversale des suggestions de transactions financières (`col-1nb0x-sug`).

| Flux de Suggestion | Description | Statut |
| :--- | :--- | :---: |
| **`bq-car` ➔ `bq-bank`** | Saisie d'un plein d'essence ➔ Proposition de dépense pré-remplie (Budget "Voiture"). | **✔️ Effectué** |
| **`bq-health` ➔ `bq-bank`** | Saisie d'un RDV médical payant ➔ Proposition de dépense pré-remplie (Budget "Santé"). | **✔️ Effectué** |
| **`bq-cook` ➔ `bq-bank`** | Validation de panier ou import de ticket de caisse ➔ Proposition de dépense (Budget "Courses"). | **✔️ Effectué** |
| **`bq-stash` ➔ `bq-bank`** | Achat d'un bien de valeur ➔ Proposition de dépense (Garantie / Électronique / Loisir). | **❌ À faire** |

---

## 🧹 3. Nettoyage des Données de Test & Démo

Isolation complète des jeux de données de démonstration pour que l'utilisateur démarre avec une base vierge et saine, tout en ayant le choix d'injecter des données d'exemples s'il le souhaite.

- [x] **`bq-car`** : Isolation des véhicules "Twingo" et "308 SW" dans une fonction optionnelle `generateDemoData()` appelée uniquement via les paramètres ou sur base vide.
- [x] **`bq-cloth`** : Isolation complète du jeu de données dressing de départ pour éviter toute pollution d'inventaire automatique.
- [x] **`bq-watch`** : Suppression des seeds automatiques et du dataset personnel en dur. Données de démonstration génériques (8 films vus, 3 en watchlist, 1 en boîte de réception) accessibles uniquement sur action volontaire dans les Paramètres.

---

## 📱 4. Feuille de Route & Évolutions par Application

### Global à toutes les apps
- [x] **Boutons CRUD** : Dans les settings, les boutons de modification et de suppression sont colorés ; je les préfère gris et colorés seulement au survol, comme les op-actions dans bq-bank. Et la couleur pour le bouton "éditer" est le bleu "info", pas la couleur principale.
- [x] **Suppression des alertes** : Il reste des alertes via "confirm()".
- [x] **Composant de reset bdd** : Mettre en évidence le composant de reset bdd dans les settings, comme c'était le cas dans bq-metrics.
- [x] **Centralisation css** : Centraliser les éléments css globaux (card, btn, etc.) dans le theme global.
- [x] **Fonction css** : Créer une fonction css permettant de choisir la couleur du texte en fonction du fond (ex. si fond jaune, texte noir, si fond bleu, texte blanc).
- [x] **Naming css** : Epurer les identifications par couleur (primary, secondary, accent, theme, etc.).

### 🎬 bq-watch
- [x] **Bibliothèque & Fiches Cinéma** : Recherche instantanée, affiches TMDB, genres automatiques et notes sur 10.
- [x] **Suivi des Visionnages (`Culture - Visionnages`)** : Collection dédiée avec support et date pour suivre les rewatches multiples.
- [x] **Débriefing IA Gemini** : Chat contextuel avec synthèse et suggestion automatique de note.
- [x] **Boîte de Réception (Inbox)** : Glisser-déposer d'exports Netflix, Prime Video et Cinéma.
- [x] **Watchlist Streaming JustWatch** : Détection des disponibilités SVOD France et filtrage strict par fournisseur.
- [x] **Nettoyage & Production-Ready** : Zéro seed automatique, zéro donnée personnelle en dur, code allégé.
- [x] **Suppression du profil Gemini par défaut** : Supprimer le profil par défaut stocké dans le service gemini

### 💰 bq-bank
- [x] **Optimisation Mobile du bandeau de rappel récurrent** : Le bandeau de notification de modèle s'adapte parfaitement sur écran mobile (layout vertical, texte aligné à gauche et bouton d'action principal étiré).

### 📊 bq-graph
- [x] **Compilation & Nettoyage Hub** : Résolution des erreurs strictes de compilation, 0 style inline, alertes remplacées par `useToast` et `<ToastsContainer />` global.
- [x] **Harmonisation Navigation & Design System** : Remplacement de l'ancienne barre latérale fixe (280px) et du tiroir par le shell standard du Hub (en-tête léger en haut, barre de navigation unifiée en bas, 100% de largeur pour les tableaux et graphiques, styles alignés sur `@bq/theme`).
- [x] **Intégration de `bq-watch`** : Ajout de la 9ème application du Hub dans le lanceur d'accueil et le gestionnaire d'épinglage des Paramètres.
- [x] **Badge de statut dans le header** : Un badge est afficher dans le header pour indiquer le status de la bdd (Hors-ligne ou Synchronisé), les autres apps ne l'ont pas. Uniformiser cette feature sur toutes les apps (composant Header global)
- [ ] **Graphiques complexes (`CollectionChartsView.vue`)** :
  - Superposition multi-séries (comparer plusieurs périodes sur un même tracé).
  - Double Axe Y (ex: afficher kilomètres cumulés vs. vitesse moyenne).
- [ ] **Indicateurs de tendance (Trends)** : Ajouter des variations calculées (ex : `+5%` ou `-2 €`) sur l'écran d'accueil.

### 🧠 bq-learn
- [x] **Moteur algorithmique de répétition espacée (SRS)** : Implémenter l'algorithme SuperMemo SM-2 (intervalles, facteurs de facilité E-factor, répétitions consécutives).
- [x] **Interface de révision "Swipe & Rate"** : Créer un composant tactile fluide sur mobile pour évaluer ses réponses de 1 à 5 étoiles.

### 🍳 bq-car
- [x] **Toggle `Véhicule inactif` caché** : Le bouton toggle est invisible.
- [x] **Revoir les données de démo** : Modifier les véhicules proposés et ajouter des entrées de carburant et d'entretien pour simuler une utilisation.

### 🍳 bq-coach
- [x] **Planning en mode édition par défaut** : Afficher le planning en mode lectur et ajouter un bouton pour passer en mode édition.

### 🍳 bq-cloth
- [x] **Impossible de créer un vêtement** : Erreur lors de la création d'un vêtement

### 🍳 bq-cook
- [x] **Impossible de créer une recette ou un repas** : Erreur lors de la création d'une recette ou d'un repas.
- [x] **Suggestions de dépenses vers `bq-bank`** (voir Section 2).

### 📦 bq-stash (Nouveau module de recensement)
*Application / module à concevoir pour répertorier le patrimoine personnel.*
- [ ] **Mode A : Garanties & Assurances** (High-tech, électroménager, meubles, calcul valeur patrimoine).
- [ ] **Mode B : Technique & Entretien** (Notices PDF, notes d'entretien, alertes révisions).
- [ ] **Mode C : Collectionneur & Partage** (Vinyles, livres, jeux, suggestion au hasard).
- [ ] **Interconnexions** : suggestions de dépenses vers `bq-bank` et interconnexions ludiques avec `bq-play`.
