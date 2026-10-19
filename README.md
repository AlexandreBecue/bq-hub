# 🌐 bq-hub

Bienvenue dans **bq-hub**, la suite d'applications web personnelles d'aide à la vie quotidienne. Toutes les applications de cet écosystème partagent le même design et synchronisent leurs données de façon sécurisée sur ton espace Google Drive personnel, garantissant une gratuité totale d'infrastructure et une confidentialité absolue de tes données.

---

## 🏛️ Architecture du Projet

Le projet est structuré sous forme de **Monorepo NPM Workspaces** :

```text
bq-hub/
├── apps/                 # Les PWAs (Progressive Web Apps) prêtes pour PC et Mobile
│   ├── bq-bank/          # [ACTIF] Gestion optimisée des comptes bancaires et budgets
│   ├── bq-car/           # [ACTIF] Suivi des entretiens de véhicules et consommation
│   ├── bq-cloth/         # [ACTIF] Garde-robe connectée, suggestions de tenues et lessives
│   ├── bq-coach/         # [ACTIF] Gestion et chronométrage des séances de sport (EF, TUT)
│   ├── bq-cook/          # [ACTIF] Gestion des repas, recettes, listes de courses et stocks
│   ├── bq-graph/         # [ACTIF] Base de données dynamique, cockpit visuel et rapports
│   ├── bq-health/        # [ACTIF] Carnet de santé, RDV, pilulier et vaccins
│   ├── bq-learn/         # [ACTIF] Spaced Repetition / Flashcards pour la culture G (Leitner)
│   ├── bq-play/          # [ACTIF] Historique des parties de jeux et compteur de scores
│   └── bq-watch/         # [ACTIF] Cinémathèque, débriefing IA (Gemini) et watchlist SVOD
├── packages/             # Le code partagé et réutilisable (zéro duplication)
│   ├── db-sync/          # Moteur de base locale (Dexie/IndexedDB) + Sync Google Drive
│   └── theme/            # Fiches de styles SASS, couleurs unifiées et reset CSS
```

---

## 🛠️ Commandes Utiles

Toutes les commandes s'exécutent depuis la racine du dossier `bq-hub/` :

* **Installer les dépendances et lier les packages** :
  ```bash
  npm install
  ```
* **Lancer une application en développement** :
  * `npm run dev:bank` (bq-bank)
  * `npm run dev:car` (bq-car)
  * `npm run dev:cloth` (bq-cloth)
  * `npm run dev:coach` (bq-coach)
  * `npm run dev:cook` (bq-cook)
  * `npm run dev:graph` (bq-graph)
  * `npm run dev:health` (bq-health)
  * `npm run dev:learn` (bq-learn)
  * `npm run dev:play` (bq-play)
  * `npm run dev:watch` (bq-watch)
* **Compiler l'intégralité du monorepo (Build de production)** :
  ```bash
  npm run build
  ```

---

## 📋 Idées & TODO : Recensement des biens

### 💡 Concept : `bq-stash` (ou intégration directe dans `bq-graph`)

L'objectif est de recenser l'ensemble de tes biens (meubles, matériel de musique, vinyles, livres, électroménager, matériel d'escalade) afin de passer d'un inventaire statique à un outil actif au quotidien.

#### Deux options d'intégration possibles :
* **Option 1 : Intégration à bq-graph**  
  Utiliser les collections dynamiques de `bq-graph` pour stocker et lister les biens. Simple et rapide, pas d'application supplémentaire à maintenir.
* **Option 2 : Création de la PWA dédiée `apps/bq-stash`**  
  Créer une application spécialisée qui se branche sur `@bq/db-sync` et `@bq/theme` pour proposer une interface utilisateur optimisée avec 3 modes d'affichage dédiés :

---

### 🛡️ Spécifications du module de recensement (bq-stash)

* [ ] **Mode A : Garanties & Assurances (High-Tech, Électroménager, Meubles)**
  * **But** : Ne plus perdre de facture et anticiper les fins de garanties.
  * **Champs** : Date d'achat, Prix d'achat, Durée de garantie (compte à rebours + alerte de fin), Numéro de série, Scan/Photo du ticket (PDF sur Google Drive).
  * **Fonctionnalité** : Calcul automatique de la valeur totale estimée de ton patrimoine pour déclaration aux assurances habitations.

* [ ] **Mode B : Technique & Entretien (Matériel de musique, Escalade, Outillage)**
  * **But** : Suivre l'état du matériel et avoir les notices à portée de main.
  * **Champs** : Lien vers notice PDF constructeur, Notes de configuration (ex: tirant de cordes pour guitares, tension pédales d'effet), Date de dernière révision.
  * **Fonctionnalité** : Alertes automatiques de maintenance (ex : "Changer les cordes de guitare tous les 6 mois", "Vérifier le matériel d'escalade").

* [ ] **Mode C : Collectionneur & Partage (Vinyles, Livres, Jeux de société)**
  * **But** : Profiter de ses collections et gérer les prêts.
  * **Champs** : Genre musical/littéraire, Note personnelle, État (Neuf, Bon, Rayé), Statut de prêt ("Prêté à [Nom] le [Date]").
  * **Fonctionnalité** : Bouton *"Suggère-moi un vinyle au hasard"* selon tes goûts ou le genre sélectionné pour lancer un disque facilement le soir.

#### 🔗 Idées d'interconnexions :
* **Avec `bq-bank`** : Un achat de matériel inséré dans `bq-stash` crée automatiquement une écriture de débit correspondante dans tes comptes bancaires.
* **Avec `bq-play`** : Ta collection de jeux listée dans ton inventaire est automatiquement synchronisée avec le compteur de scores de tes soirées jeux.

---

## 🎨 Charte Graphique & Identité Visuelle (Design System)

Pour donner une cohérence globale à l'ensemble de la suite **bq-hub** tout en distinguant instantanément les applications, nous avons défini un design unifié et des chartes colorimétriques strictes :

* **Identité visuelle unifiée** : Un design de base similaire (mise en page, cartes en glassmorphism, typographie, espacements unifiés via le package `@bq/theme`), avec quelques exceptions mineures selon le besoin de l'app.
* **Code couleur unique par application** : Chaque application possède sa propre couleur thématique (appliquée par exemple en couleur de fond, sur la barre de navigation ou sur les accents principaux) pour servir de repère visuel instantané :
  * 💰 **bq-bank** : Bleu financier (`#3b82f6`) — Richesse et gestion budgétaire.
  * 🚗 **bq-car** : Rouge (`#ef4444`) — Couleur classique automobile et carburant.
  * 👕 **bq-cloth** : Beige chaleureux (`#c5a880`) — Mode, dressing et garde-robe.
  * 🏃 **bq-coach** : Orange athlétique (`#f97316`) — Énergie, entraînement physique et dynamisme.
  * 🍳 **bq-cook** : Jaune gourmet (`#eab308`) — Préparations, stocks et plaisirs gourmands.
  * 📊 **bq-graph** : Turquoise analytique (`#06b6d4`) — Cockpit de graphiques et données.
  * 🏥 **bq-health** : Vert médical (`#10b981`) — Profil d'urgence ICE, santé et soins.
  * 🧠 **bq-learn** : Rose cérébral (`#f4abba`) — Concentration intellectuelle, flashcards et méthode Leitner.
  * 🎲 **bq-play** : Violet ludique (`#8b5cf6`) — Univers fantastique des jeux et scores.
  * 🎬 **bq-watch** : Rouge velours cinéma (`#f43f5e`) — Films, séries et débriefing cinématographique.
* **Spécifications des Favicons & Icônes (PWA)** :
  Pour garantir un look minimaliste, lisible et ultra-professionnel sur tous tes appareils (onglets de navigateur et écrans d'accueil d'ordinateurs et smartphones), les favicons doivent respecter un standard géométrique rigoureux :
  * **Transparence Absolue** : Aucun cercle ni carré d'arrière-plan coloré dans le fichier `favicon.svg` source. L'icône flotte directement sur fond transparent pour s'ajuster avec sobriété aux modes clairs ou sombres des navigateurs.
  * **Couleur Unique** : Le tracé vectoriel doit être dessiné à 100% avec la couleur thématique officielle de l'application (le code hexadécimal listé ci-dessus).
  * **Épaisseur Améliorée (Bold)** : Pour que le symbole reste parfaitement reconnaissable et net à l'échelle d'un micro-onglet de `16x16px`, le tracé vectoriel doit utiliser une épaisseur de trait accrue de **`stroke-width="2.5"`** (ou équivalent).
  
  Voici la liste des symboles et icônes officiels préconisés pour chaque application :
  * 💰 **bq-bank** ➔ Icône **`Euro` (`€`)** / `#3b82f6` (Bleu) — Symbole de la monnaie universelle.
  * 🚗 **bq-car** ➔ Icône **`Car` (Voiture)** / `#ef4444` (Rouge) — Silhouette de route de l'automobile.
  * 👕 **bq-cloth** ➔ Icône **`Shirt` (T-shirt)** / `#c5a880` (Beige) — Symbole épuré de la mode et du dressing.
  * 🏃 **bq-coach** ➔ Icône **`Whistle` (Sifflet)** / `#f97316` (Orange) — L'énergie sportive, l'effort et le dépassement.
  * 🍳 **bq-cook** ➔ Icône **`Utensils` (Couverts)** / `#eab308` (Jaune) — Fourchette et couteau de la cuisine.
  * 📊 **bq-graph** ➔ Icône **`BarChart3` (Graphique)** / `#06b6d4` (Turquoise) — Les barres de progression des statistiques.
  * 🏥 **bq-health** ➔ Icône **`Heart` (Cœur)** / `#10b981` (Vert) — Pulsation cardiaque des soins et de l'ICE.
  * 🧠 **bq-learn** ➔ Icône **`Brain` (Cerveau de profil)** / `#f4abba` (Rose) — Le centre intellectuel et mémoriel.
  * 🎲 **bq-play** ➔ Icône **`Dice5` (Dé à jouer 3D)** / `#8b5cf6` (Violet) — Le dé traditionnel en relief 3D des jeux de société et de plateaux.
  * 🎬 **bq-watch** ➔ Icône **`Clapperboard` (Clap de cinéma)** / `#f43f5e` (Rouge velours) — Le clap de tournage et grand écran.

---

## 📝 TODO Globaux & Nettoyage des Données de Test (Post-Sync)

Pour faciliter le développement et éviter de devoir saisir à la main des jeux de tests au démarrage, des données par défaut ou des mécanismes d'auto-migration assistée sont temporairement présents dans le code de certaines applications. 

Une fois que tu auras connecté et synchronisé ton compte Google Drive personnel (ce qui aura pour effet d'enregistrer ces données dans ton fichier cloud unifié `bq-metrics-sync.json`), il faudra nettoyer les fichiers suivants pour rendre la base de code 100% générique :

* [ ] **`bq-car`** : Supprimer l'injection en dur des véhicules de test ("Twingo", "308 SW") dans `apps/bq-car/src/db/queries.ts` (méthode `performVehicleMigration`).
* [ ] **`bq-cloth`** : Vérifier s'il y a d'autres mockups de départ à nettoyer une fois la base de données dressing stabilisée sur ton Cloud.
* [ ] **`Alertes Natives`** : Retirer toutes les fenêtres d'alertes natives (`alert(...)`) à travers les applications de l'écosystème pour les remplacer par des bannières de notifications non-bloquantes ou des modals avant la mise en production.

---

## 🧹 Refactoring & Bonnes Pratiques CSS (Clean Code)

Afin de maintenir une base de code hautement réutilisable, propre et maintenable à long terme à travers l'écosystème **bq-hub**, deux chantiers de refactoring majeurs doivent être respectés lors des développements futurs :

### 1. 🚫 Suppression de la redondance CSS dans les Apps
Étant donné que chaque application du monorepo importe déjà globalement la feuille de style commune `@import "@bq/theme/style.scss"`, il est **strictement inutile et redondant** de redéfinir localement des classes de base ou des utilitaires généraux (comme les marges, boutons, inputs, réinitialisations ou effets glass) dans les fichiers `style.scss` de chaque application.
* **Consigne** : Supprimer toute classe dupliquée dans les fichiers `style.scss` locaux des applications pour s'appuyer uniquement sur le package de style partagé `@bq/theme`.

### 2. 🚫 Bannissement des Styles Inline (Attribut `style="..."`)
L'attribut `style="..."` codé en dur directement dans le HTML des vues Vue (actuellement ~268 apparitions réparties dans 27 fichiers) doit être traqué et éliminé. L'ensemble de ces styles doit être migré :
* **Soit vers des classes globales utilitaires** communes à toutes les applications de la suite (définies dans `packages/theme/src/style.scss` telles que `.flex-row`, `.align-center`, `.gap-2`, `.mt-4`, `.text-xs`, `.text-secondary`, etc.).
* **Soit vers des classes CSS spécifiques** définies localement dans les balises `<style scoped>` de chaque composant Vue pour surcharger ou affiner la mise en page de manière propre et isolée.

* [ ] **`Global CSS Refactoring`** : Nettoyer les fichiers locaux `style.scss` pour supprimer les doublons avec `@bq/theme` et migrer les ~268 styles inline en dur vers les nouvelles classes utilitaires globales ou locales.

---

### 📥 Évolutions : Suggestions Cross-App (Inbox financière)

Suite au succès de l'intégration entre la pompe à essence (`bq-car`) et ton portefeuille (`bq-bank`), voici les prochaines intégrations de suggestions d'écritures à implémenter :

* [ ] **Dépenses d'Entretien (`bq-car` ➔ `bq-bank`)** : Faire en sorte que l'enregistrement d'une facture d'entretien (ex: vidange, pneus, CT) dans `bq-car` dépose également une suggestion de dépense pré-remplie avec le type d'intervention dans l'Inbox de `bq-bank` (budget "Voiture").
* [ ] **Tickets de Caisse Alimentaires (`bq-cook` ➔ `bq-bank`)** : Lors de la validation d'un panier ou de l'import d'un ticket de caisse dans `bq-cook`, émettre une suggestion de dépense vers l'Inbox de `bq-bank` (montant total, date du jour, budget "Courses", catégorie "Dépense").
* [ ] **Achats de Matériel de Valeur (`bq-stash` / `bq-graph` ➔ `bq-bank`)** : Connecter le futur module de recensement des biens de valeur pour suggérer automatiquement la transaction de débit correspondante lors de l'enregistrement d'un achat à conserver (facture/garantie).
