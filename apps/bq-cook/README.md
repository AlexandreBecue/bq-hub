# bq-cook 🍳

> L'assistant culinaire intelligent, mobile-first et hors-ligne pour la planification de repas, la gestion de recettes et les listes de courses interactives.

**bq-cook** est une micro-app spécialisée conçue pour fonctionner en symbiose avec **bq-metrics**. Alors que `bq-metrics` centralise et analyse toutes les données de ton quotidien sous forme de tableaux et graphiques génériques, `bq-cook` t'offre une interface sur-mesure, ergonomique et moderne, optimisée spécifiquement pour un usage en cuisine et au supermarché.

---

## 🌟 Fonctionnalités Clés de `bq-cook`

1. **🍳 Mode Cuisine Hands-Free** : Une interface claire, contrastée et simplifiée pour faire défiler les étapes de tes recettes sur tablette ou mobile pendant que tu cuisines, sans encombrer ton écran de tableaux complexes.
2. **📅 Journal de Repas & Planning Interactif** : Planifie tes repas de la semaine (Midi/Soir) et ajuste en temps réel le nombre de convives pour chaque repas.
3. **📊 Faisabilité des Recettes en Temps Réel** : Visualise instantanément si tu as assez d'ingrédients en stock pour cuisiner un repas programmé, avec des badges de statut clairs (`🟢 Suffisant`, `🟡 Partiel`, `🔴 Rupture`).
4. **🛒 Liste de Courses Intelligente & Mobile** : Génère automatiquement ta check-list de courses interactive basée sur tes seuils d'alerte de stock et tes repas prévus de la semaine. Coche tes articles en rayon sur ton mobile pour mettre à jour tes stocks en un clic.
5. **🪄 Ajustements et Substitutions à la Carte** : Adapte une recette au moment de la cuisiner en remplaçant, ajoutant ou retirant des ingrédients de la liste par défaut sans altérer la recette d'origine.

---

## ☁️ Architecture de Synchronisation Google Drive

Pour éviter les limitations de sécurité des navigateurs (Same-Origin Policy), `bq-cook` et `bq-metrics` possèdent chacun leur propre base IndexedDB locale mais communiquent et partagent leurs données de manière extrêmement élégante via **Google Drive** :

```
     [ bq-metrics ]                                  [ bq-cook ]
      (App Globale)                                  (App Cuisine)
           │                                              │
     ┌─────┴────────┐                               ┌─────┴────────┐
     │  IndexedDB   │                               │  IndexedDB   │
     │  (Dexie.js)  │                               │  (Dexie.js)  │
     └─────┬────────┘                               └─────┬────────┘
           │ (Sync)                                       │ (Sync)
           ▼                                              ▼
   💾 bq-metrics-backup.json ◄────────────────────► 💾 bq-cook-backup.json
   (Toutes les données)         (Lecture/Écriture       (Planning, Recettes,
                                 des stocks/recettes)    Stocks & Courses)
```

### Le mécanisme de synchronisation croisée :
1. **Base Locale Indépendante** : `bq-cook` possède sa propre base IndexedDB rapide et accessible à 100 % hors-ligne (PWA) pour stocker son planning de la semaine, ses idées de recettes et ses fiches de stocks.
2. **Sauvegarde Dédiée bq-cook** : Il synchronise ses données d'utilisation courante sur Google Drive dans un fichier dédié `bq-cook-backup.json`.
3. **Passerelle bq-metrics** : Lors de sa synchronisation, `bq-cook` lit également le fichier de sauvegarde global `bq-metrics-backup.json` pour y :
   *   **Récupérer** les stocks actuels et les recettes mis à jour depuis bq-metrics (ex: suite à un import de ticket de caisse Leclerc).
   *   **Mettre à jour** les stocks en retour suite à tes courses ou tes repas cuisinés (incrémentation/décrémentation).
   *   **Écrire** tes lignes d'achats directement dans l'historique de bq-metrics.

---

## 🛠️ Pile Technique (Identique à bq-metrics)

Pour assurer une compatibilité de code parfaite, une légèreté d'exécution et la réutilisation de tes composants d'UI favoris, `bq-cook` est basé sur la même pile moderne :

*   **Framework** : [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
*   **Langage** : [TypeScript](https://www.typescriptlang.org/) (pour une robustesse et une sécurité de code totale)
*   **Compilateur/Bundler** : [Vite](https://vitejs.dev/) (démarrage instantané et build ultra-optimisé)
*   **Base de Données Locale** : [Dexie.js](https://dexie.org/) (IndexedDB rapide avec gestion de transactions réactives)
*   **Styles** : [Sass (SCSS)](https://sass-lang.com/) et variables CSS customisées (pour recréer le superbe style Glassmorphism sombre de bq-metrics)
*   **Icônes** : [Lucide Icons Vue](https://lucide.dev/) (pour une charte d'icônes unifiée)
*   **PWA (Progressive Web App)** : [Vite PWA Plugin](https://vite-pwa-org.netlify.app/) (Service workers, installation mobile écran d'accueil et fonctionnement offline complet en cuisine ou en magasin)

---

## 🚀 Lancement du Projet en Développement

Une fois les dépendances installées :

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement Vite
npm run dev

# 3. Compiler l'application pour la production
npm run build
```

---

## 📋 Feuille de Route / TODO (Héritage `TabZoindKoi`)

Fonctionnalités identifiées lors de la transition depuis le brouillon historique `tabzoindkoi` et prévues pour les prochaines itérations :

- [ ] **Génération de la liste de courses basée sur les repas planifiés** :
  - *Actuel* : La liste de courses n'affiche que les produits dont le stock actuel est inférieur au seuil d'alerte.
  - *Objectif* : Agréger automatiquement les ingrédients nécessaires aux repas programmés dans le planning :
    $$\text{Quantité à acheter} = \max(0, \text{Seuil} - \text{Stock}) + \sum (\text{Ingrédients des repas prévus} \times \text{Convives})$$

- [ ] **Validation directe de la check-list vers les stocks (sans ticket)** :
  - *Actuel* : L'incrémentation des stocks en rayon repose exclusivement sur l'import texte de ticket de caisse.
  - *Objectif* : Ajouter un bouton « Valider le caddie » permettant de transférer directement les articles cochés dans l'inventaire en augmentant leurs quantités en stock.

- [ ] **Gestion des produits spécifiques / achats ponctuels (`KESKIMANQUE ?`)** :
  - *Actuel* : Tout article sur la liste doit obligatoirement exister comme fiche permanente dans l'inventaire `Stocks`.
  - *Objectif* : Pouvoir insérer des articles ponctuels ou hors-catalogue (ex. : sushis, pastèque, ampoule, produit ménager exceptionnel) avec nom, quantité, prix estimé et rayon directement dans la liste de courses.

- [ ] **Arrondi intelligent au conditionnement commercial (`/+`)** :
  - *Actuel* : Gestion linéaire brute des quantités en stock.
  - *Objectif* : Calculer le nombre de paquets réels à acheter en rayon selon la contenance unitaire du produit (ex. : besoin de 300 g de pâtes vendues en paquets de 250 g $\rightarrow$ acheter 2 paquets).

- [ ] **Estimation du budget total du panier de courses** :
  - *Actuel* : Les prix ne sont visibles que sur l'historique des achats passés.
  - *Objectif* : Calculer et afficher le montant total prévisionnel du panier de courses en temps réel à partir des derniers prix unitaires enregistrés.

- [ ] **Cycle de réapprovisionnement & Faisabilité temporelle** :
  - *Actuel* : Le statut de faisabilité d'une recette ne tient compte que du stock instantané.
  - *Objectif* : Configurer un cycle de courses régulier (ex. : le jeudi toutes les 2 semaines). Les alertes de rupture sur les repas ne s'activent que pour les repas ayant lieu *avant* le prochain jour de réapprovisionnement programmé.

- [ ] **Gestion des membres du foyer / Mangeurs multiples** :
  - *Actuel* : Un simple champ numérique global « Convives ».
  - *Objectif* : Permettre de spécifier individuellement qui mange à chaque repas (avec option « Tous ») pour affiner la personnalisation des menus et des portions.

---
*Développé avec ❤️ pour simplifier ton quotidien culinaire.*
