# BQ Coach — Mon assistant sportif quotidien

**BQ Coach** est une Progressive Web App (PWA) moderne, légère et performante conçue pour planifier, guider, chronométrer et historiser les séances de sport quotidiennes (**Renfo** et **Cardio**).

L'application fonctionne en mode **Offline-First** via une base locale Dexie (IndexedDB) et synchronise l'ensemble de ses données et historiques sur Google Drive via le fichier pivot unifié du hub (`bq-metrics-sync.json`).

---

## 🎯 Objectifs de l'application

* **Libération de la charge mentale :** L'application déroule le programme établi en temps réel (exercice en cours, étape suivante, alternance automatique des temps d'effort et de repos, bips sonores de transition).
* **Gestion unifiée Renfo & Cardio :** Même modularité pour les deux disciplines (Échauffement, Circuit / Intervalles, Finisseur / Retour au calme).
* **Historisation automatisée :** Enregistrement en un clic du bilan complet dans des collections dédiées, avec télémétrie précise des exercices et détail complet des allures et distances cardio.
* **Ergonomie & Focus mobile :** Interface sobre en dark glassmorphism, pensée pour le smartphone posé au sol ou sur le vélo, avec maintien de l'écran allumé (*Wake Lock API*).

---

## 🚀 Fonctionnalités principales

### 1. Séance du jour & Guidage en temps réel
* **Navigation par onglets stables :** Présence systématique des onglets dédiés (**`[Renfo]`** et/ou **`[Cardio]`**) pour une disposition toujours stable et lisible.
* **Chronomètre Renfo sans dérive (`WorkoutPlayer`) :**
  - Horloge unique calée sur l'heure système : zéro décalage en cas de mise en veille ou d'arrière-plan.
  - Alternance visuelle des phases d'effort et de repos avec jauge dynamique et bips audio.
  - Présentation anticipée du prochain exercice, des muscles ciblés et du matériel requis.
  - Sauvegarde et reprise d'urgence : si l'application est quittée par inadvertance, la séance reprend exactement là où elle s'était arrêtée.

### 2. Planification hebdomadaire & Bibliothèque de séances
* **Éditeur de semaine (Lundi à Dimanche) :**
  - 4 types de journées : **`Renfo`**, **`Cardio`**, **`Hybride`** ou **`Repos`**.
  - **Structure modulaire identique pour le Renfo et le Cardio :**
    - 🔥 **Échauffement :** Durée (s), distance métrique optionnelle (m) et allure cible.
    - 🔁 **Circuit / Fractionné :** Nombre de tours/séries (`sets`), exercices ou blocs d'intervalles avec travail et repos (s), allures et distances.
    - 🏁 **Finisseur / Retour au calme :** Séries, durée et allure de récupération.
    - 💡 **Consignes & Allures :** Instructions spécifiques et allures recommandées (EF, allure seuil, etc.).
* **Bibliothèque de modèles de séances (`col-coach-templates`) :**
  - Sauvegarde d'une séance personnalisée en tant que modèle réutilisable en un clic.
  - Application instantanée d'un modèle type sur n'importe quel jour de la semaine.
  - Gestionnaire de modèles : consultation, filtrage par type et suppression.

### 3. Enregistrement & Historique
* **🏋️ Renforcement musculaire :**
  - Enregistre la séance dans `Sport - Renforcement musculaire - Séances` (titre, durée réelle, date).
  - Enregistre la télémétrie détaillée de chaque exercice dans `Sport - Renforcement musculaire - Exercices` (séries, travail, repos, phase).
* **🏃 Cardio :**
  - Enregistre la sortie dans `Sport - Cardio` (sport, distance en km, temps formaté).
  - **Pré-remplissage intelligent & formule détaillée :** Génère automatiquement le détail complet des allures et intervalles de la séance (ex. `30' à 5:40 + 4x500m à 4:00 + 10' à 6:00`), modifiable à la volée avant validation.

---

## 🗄️ Modèle de Données (Collections Dexie)

| Collection ID | Nom | Rôle |
| :--- | :--- | :--- |
| `col-coach-prog` | **Coach - Programme** | Stocke les 7 séances de la semaine (Lundi à Dimanche) |
| `col-coach-templates` | **Coach - Bibliothèque de séances** | Modèles et séances types réutilisables |
| `col-ejieq9cvm` | **Sport - Renforcement musculaire - Séances** | Historique global des séances de renfo terminées |
| `col-g87w9bmlw` | **Sport - Renforcement musculaire - Exercices** | Télémétrie individuelle des exercices exécutés |
| `col-c686fcnxs` | **Sport - Cardio** | Historique des sorties cardio (course à pied, cyclisme...) |

---

## ☁️ Synchronisation & Écosystème Hub

* **Dossier masqué Google Drive (appDataFolder) :** Synchronisation automatique avec le fichier masqué `bq-hub-sync.json` situé dans l'espace applicatif privé de Google Drive via le package partagé `@bq/db-sync`.
* **Export local :** Téléchargement ponctuel JSON au format standard `bq-coach-backup-YYYY-MM-DD.json`.
* **Données de démo :** Jeu complet de 7 séances et 7 modèles types généré à la demande en pur TypeScript via `generateDemoData()` (zéro fichier JSON statique dans les assets).

---

## 🛠️ Stack Technique

* **Framework :** Vue 3 (Composition API, `<script setup>`)
* **Langage :** TypeScript (typage strict sans assertions arbitraires)
* **Build tool :** Vite + `vite-plugin-pwa` (Service Worker Workbox, 100% Offline)
* **Design System :** `@bq/theme` (SCSS partagé, Dark Glassmorphism, tokens dynamiques de contraste WCAG, icônes `@lucide/vue`)
