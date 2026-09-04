# BQ Coach - Mon assistant sportif quotidien

BQ Coach est une Progressive Web App (PWA) moderne, légère et performante conçue pour guider et chronométrer l'utilisateur durant ses séances de sport quotidiennes (renforcement musculaire et cardio).

L'application fonctionne de manière autonome (Offline-First) et sauvegarde la planification des séances ainsi que l'historique d'entraînement directement sur son compte Google Drive.

---

## Objectif de l'application

L'objectif de bq-coach est d'accompagner l'utilisateur durant l'effort afin qu'il n'ait plus à se soucier du déroulé de sa séance :
* **Libération de la charge mentale** : L'application indique en temps réel l'exercice en cours, l'étape suivante, et gère l'alternance des temps d'effort et de repos.
* **Automatisation du suivi** : Plus besoin de compter manuellement les séries, les tours ou les répétitions. L'application déroule le programme établi et émet des signaux sonores et vibratoires lors des transitions.
* **Ergonomie et focus** : L'affichage est conçu pour tenir entièrement sur l'écran d'un mobile sans nécessiter de défilement tactile durant la séance, permettant à l'utilisateur de rester concentré sur ses mouvements.

---

## Fonctionnalités principales

### Séance du jour et entraînements hybrides
* **Chronométrage et guidage** : Affichage de l'exercice actif, du décompte du temps de travail, et de la progression au sein du circuit (tour en cours et étape active).
* **Navigation par onglets pour séances hybrides** : Pour les séances mixtes (renforcement + cardio), un système d'onglets sépare la musculation du cardio. L'onglet actif cible automatiquement l'activité en cours (renforcement, ou cardio si le renforcement est déjà complété).
* **Interface adaptative** : Le bouton d'action principal et le chronomètre de l'en-tête s'adaptent en temps réel à l'onglet affiché (lancement de la musculation ou du cardio) pour guider précisément l'effort.
* **Décompte visuel dynamique** : Jauge circulaire de progression qui s'allume selon la phase (effort ou repos) et se vide de manière linéaire à la seconde près.
* **Anticipation des pauses** : Pendant les temps de récupération, l'écran présente l'exercice suivant avec le matériel requis et les groupes musculaires ciblés pour permettre à l'utilisateur de s'installer.

### Planification & édition des séances
* **Éditeur de séances intégré** : Création et modification complètes des séances de la semaine directement depuis l'application (ajout/suppression d'exercices d'échauffement, du circuit ou du finisseur, édition des temps d'effort et de récupération, nombre de séries, etc.).
* **Activités cardio structurées** : Les séances cardio du planning (course à pied, cyclisme...) sont modélisées comme des exercices complets avec leurs spécificités et matériels requis intégrés.
* **Gestion ergonomique** : Menu de sélection des jours personnalisé, tactile et fluide pour organiser son programme du lundi au dimanche.

### Séance libre et cardio
* **Minuteur de fractionné libre** : Ce module indépendant fait office de chronomètre et d'émetteur de vibrations à intervalles réguliers configurables pour des séances libres hors planification (par pas tactiles de 5s / 1min).
* **Lancement automatisé** : Les séances cardio issues du planning démarrent automatiquement avec la durée et l'intervalle de vibration configurés.
* **Suivi de distance et détection du sport** : Enregistrement de la distance parcourue en fin de séance et identification dynamique de l'activité (course à pied ou cyclisme) pour l'historisation automatique dans bq-metrics.

---

## Spécificités techniques et optimisations

### Synchronisation Google Drive et historique
L'application communique directement avec l'API Google Drive v3 de l'utilisateur (scope drive.file) de manière transparente et sécurisée :
* **Sauvegarde de la planification** : Vos séances personnalisées sont stockées dans un fichier dédié `bq-coach-workouts.json` sur Google Drive et synchronisées en cache local. Si vous n'êtes pas connecté ou hors ligne, bq-coach utilise des programmes locaux par défaut et sauvegarde vos modifications localement.
* **Historisation automatique** : Lors de la validation d'une fin de séance (renforcement musculaire ou course à pied), bq-coach enregistre automatiquement le bilan détaillé dans une collection d'historique dédiée sur Google Drive. Cela permet de conserver un historique complet de vos performances pour votre suivi personnel.
* **Migration simplifiée** : L'application intègre un système de migration automatique pour récupérer vos anciens plannings s'ils provenaient historiquement de l'écosystème bq-metrics.

### Horloge unique sans dérive
Les minuteurs de navigateurs standard subissent des retards d'exécution dus aux mises en veille du système ou aux latences de rendu. Pour garantir une précision parfaite, bq-coach utilise une architecture à horloge unique :
* Chaque étape de l'entraînement possède un repère temporel de début et de fin pré-calculé de façon cumulative.
* Un unique chronomètre central basé sur l'heure système de l'appareil sert de référence de temps réel.
* Les transitions de séries et les bips de fin de décompte s'exécutent en phase à la milliseconde près.

### Sauvegarde et reprise automatique de séance
* L'état de l'entraînement en cours (exercice, temps restant, chrono cumulé) est enregistré en local chaque seconde.
* En cas de rechargement accidentel de l'application ou d'interruption (appel téléphonique, changement d'application), un écran de secours propose de reprendre instantanément la séance au même endroit en mode pause, ou de recommencer à zéro.

### Déconnexion et sauvegarde différée
* Si l'utilisateur complète une séance alors qu'il n'est pas connecté à son Google Drive, il peut utiliser l'option de connexion directe sur l'écran de fin.
* L'application conserve les données de la séance en attente, réalise la redirection de connexion, et effectue l'enregistrement automatique de l'historique dès son retour sur la page d'accueil.

---

## Fiche technique

* **Architecture logicielle :** Vue 3 (Composition API, syntaxe script setup)
* **Langage de programmation :** TypeScript (typage strict)
* **Outils de développement :** Vite (compilation ultra-rapide) et vite-plugin-pwa (mise en cache complète des composants, ressources et fichiers sonores pour un accès 100% hors-ligne)
* **Design et styles :** Vanilla CSS scoped, conception mobile-first et adaptative, prise en charge des thèmes clairs et sombres du système par des couleurs transparentes progressives (rgba).
