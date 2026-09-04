# 🎮 bq-games (v0)

**bq-games** est ton application mobile-first et hors-ligne de ludothèque unifiée et de carnet de score interactif. Elle fusionne tes inventaires de jeux de société et de jeux vidéo au même endroit et intègre une scorecard interactive manche par manche avec alerte de score limite, persistant tes parties pour tes analyses statistiques globales.

---

## 🎯 Fonctionnalités de la v0

### 🎮 Ma Ludothèque (Inventaire Unifié)
* **Ludothèque fusionnée** : Fini la séparation stricte de tes jeux. Tout est rassemblé au même endroit, distingué par un simple champ `Type de jeu` (Société vs Vidéo).
* **Filtres de recherche** : Recherche instantanée par nom, plateforme ou type de jeu, et filtrage de progression (Jamais joué, En cours, Terminé, 100% - idéal pour ton backlog de jeux vidéo).
* **Auto-Migration Rétroactive** :
  * Au premier démarrage de l'app, un script d'auto-migration scanne tes anciennes tables d'inventaire séparées de `bq-metrics` (`col-03eraqmvo` : Jeux vidéo, et `col-h9eomlsdp` / `col-jeux-societe` : Jeux de société) et **copie automatiquement l'intégralité de tes jeux** dans ta nouvelle collection unifiée sans aucune perte de données !

### 🎲 Scorecard (Calculateur de Score en Direct)
* **Configuration rapide** : Sélectionne le jeu dans ta ludothèque, renseigne tes joueurs sous forme de puces interactives, et définis un score limite (ex : 100 points).
* **Saisie manche par manche** : Saisis les scores de chaque joueur pour la manche en cours. L'application calcule et met à jour les totaux en temps réel.
* **Résilience au rafraîchissement (LocalStorage)** : La partie active est sauvegardée en direct. Si ton téléphone s'éteint ou si tu fermes l'application par accident, tu la rouvres et tu reprends ta partie exactement à la même manche !
* **🚨 Alerte Limite Franchie** : L'application flashe un message d'alerte rouge très clair dès qu'un joueur a franchi ou dépassé la limite de score fixée, te permettant de savoir immédiatement quand s'arrête la partie.
* **Enregistrement de l'historique** : Enregistre ta partie terminée, confirme le vainqueur final (avec couronne 👑), ce qui archive l'historique de tes manches dans la collection unifiée et vide la scorecard.

### 📊 Historique (Mes Sessions)
* **Timeline chronologique** : Liste complète de toutes tes sessions enregistrées avec la date, le jeu, les participants et le vainqueur.
* **Drawer détaillé par manches** : Clique sur une partie de l'historique pour déplier une table détaillant le score de chaque joueur manche par manche ! Idéal pour revivre tes plus belles victoires.

### ⚙️ Options & Paramètres
* **Synchronisation Cloud (Google Drive)** : Synchronisation automatique en tâche de fond de tes scores et de ta ludothèque avec ton fichier global `bq-metrics-sync.json`.

---

## 💾 Modèle de Données (Dexie / @bq/db-sync)

L'application utilise une base IndexedDB locale hors-ligne (`BQGamesDatabase`) et réutilise les identifiants de collections de `bq-metrics` :

1. **`Ludothèque` (ID : `col-v9p4k1m8s`)**
   * `nom` (text, required)
   * `type_jeu` (select : "Jeux de société", "Jeux vidéo")
   * `min_players` (number)
   * `max_players` (number)
   * `playtime` (number)
   * `progression` (select : "Jamais joué", "En cours", "Terminé", "100%")
   * `plateforme` (select)
   * `possede` (boolean)

2. **`Sessions de Jeu` (ID : `col-r8t5w2q3n`)**
   * `date` (date, required)
   * `jeu` (text, required - stocke le nom du jeu pour bq-metrics)
   * `participants` (tags, required)
   * `score_limite` (number)
   * `vainqueur` (text, required)
   * `scores_finaux` (text, JSON map joueur -> total)
   * `manches_historique` (text, JSON array de manches et scores)

---

## 🛠️ Commandes utiles

Toutes les commandes sont à exécuter depuis la racine du monorepo :

* **Lancer l'application en développement** :
  ```bash
  npm run dev:games
  ```

* **Vérifier les types TypeScript & Compiler le projet (PWA)** :
  ```bash
  npm run build -w bq-games
  ```

* **Tester les assets compilés en local** :
  ```bash
  npm run preview -w bq-games
  ```
