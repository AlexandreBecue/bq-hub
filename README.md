# 🌐 bq-hub

Bienvenue dans **bq-hub**, la suite d'applications web personnelles d'aide à la vie quotidienne. Toutes les applications de cet écosystème partagent le même design et synchronisent leurs données de façon sécurisée sur ton espace Google Drive personnel, garantissant une gratuité totale d'infrastructure et une confidentialité absolue de tes données.

---

## 🏛️ Architecture du Projet

Le projet est structuré sous forme de **Monorepo NPM Workspaces** :

```text
bq-hub/
├── apps/                 # Les PWAs (Progressive Web Apps) prêtes pour PC et Mobile
│   ├── bq-coach/         # [ACTIF] Gestion et chronométrage des séances de sport (EF, TUT)
│   ├── bq-cook/          # [ACTIF] Gestion des repas, recettes, listes de courses et stocks
│   ├── bq-metrics/       # [ACTIF] Base de données dynamique, cockpit visuel et rapports
│   ├── bq-bank/          # [VIERGE] Gestion optimisée des comptes bancaires et budgets
│   ├── bq-car/           # [VIERGE] Suivi des entretiens de véhicules et consommation
│   ├── bq-cloth/         # [VIERGE] Garde-robe connectée et suggestions de tenues
│   ├── bq-play/          # [VIERGE] Historique des parties de jeux et compteur de scores
│   ├── bq-health/        # [VIERGE] Carnet de santé, RDV et ordonnances
│   └── bq-learn/         # [VIERGE] Spaced Repetition / Flashcards pour la culture G
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
  * `npm run dev:coach` (bq-coach)
  * `npm run dev:cook` (bq-cook)
  * `npm run dev:metrics` (bq-metrics)
* **Compiler l'intégralité du monorepo (Build de production)** :
  ```bash
  npm run build
  ```

---

## 📋 Idées & TODO : Recensement des biens

### 💡 Concept : `bq-stash` (ou intégration directe dans `bq-metrics`)

L'objectif est de recenser l'ensemble de tes biens (meubles, matériel de musique, vinyles, livres, électroménager, matériel d'escalade) afin de passer d'un inventaire statique à un outil actif au quotidien.

#### Deux options d'intégration possibles :
* **Option 1 : Intégration à bq-metrics**  
  Utiliser les collections dynamiques de `bq-metrics` pour stocker et lister les biens. Simple et rapide, pas d'application supplémentaire à maintenir.
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

Pour donner une cohérence globale à l'ensemble de la suite **bq-hub** tout en distinguant instantanément les applications, nous avons défini les principes directeurs suivants :

* [ ] **Identité visuelle unifiée** : Un design de base similaire (mise en page, cartes en glassmorphism, typographie, espacements unifiés via le package `@bq/theme`), avec quelques exceptions mineures selon le besoin de l'app.
* [ ] **Code couleur unique par application** : Chaque application possède sa propre couleur thématique (appliquée par exemple en couleur de fond, sur la barre de navigation ou sur les accents principaux) pour servir de repère visuel instantané.
  * *Idées de palettes pour repères instantanés* :
    * 🏃 **bq-coach** : Orange / Rouge athlétique
    * 🍳 **bq-cook** : Vert olive / Jaune cuisine chaleureux
    * 📊 **bq-metrics** : Bleu électrique / Néon
    * 💰 **bq-bank** : Vert émeraude / Doré financier
    * 🚗 **bq-car** : Rouge sport / Gris anthracite
    * 👕 **bq-cloth** : Bleu jean / Indigo élégant
    * 🎲 **bq-play** : Violet ludique
    * 🏥 **bq-health** : Turquoise / Bleu canard médical
    * 🧠 **bq-learn** : Rose fuschia / Violet améthyste
* [ ] **Icônes de PWAs cohérentes** : Créer un jeu d'icônes de PWA homogènes, harmonieuses et de style similaire (formes géométriques identiques, épaisseur de trait constante, etc.) pour ton écran d'accueil PC et Mobile.

