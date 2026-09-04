# 👕 bq-clothes (v0)

**bq-clothes** est ton application de garde-robe connectée et de suggestions intelligentes de tenues quotidiennes. Elle est conçue pour remplacer la saisie générique de tes vêtements dans `bq-metrics` par une interface taillée sur mesure pour gérer ton dressing, forcer la rotation de tes vêtements par contexte, et automatiser le suivi de tes lessives.

---

## 🎯 Fonctionnalités de la v0

### 🌤️ Suggestions & Saisie (Accueil)
* **Widget Météo Intégré** : Récupère automatiquement les conditions réelles et les températures (température, ressenti, code météo) via l'API publique et gratuite **Open-Meteo** (sans clé API) selon la ville configurée.
* **Moteur de Suggestions de Tenues Types** : Propose tes tenues types favorites adaptées à la température actuelle. 
* **Règle de Rotation Intelligente** : Le moteur écarte automatiquement les tenues trop similaires portées lors de tes 3 dernières sessions dans le même contexte (ex: évite de proposer la même tenue deux fois de suite pour le Bureau).
* **Sélecteur Manuel avec Exclusion Mutuelle** : Lors de la composition manuelle d'une tenue, dès qu'un vêtement d'une catégorie "unique" (ex: Bas ou Chaussures) est sélectionné, les autres pièces de cette catégorie sont masquées pour alléger instantanément la vue et t'éviter de scroller.
* **Option Linge Sale** : Lors de l'enregistrement de ta tenue, tu peux choisir de déposer directement ces vêtements au linge sale (les rendant instantanément indisponibles).

### 👗 Dressing (Mon Dressing)
* **Gestion complète de l'inventaire** : Ajout, modification et suppression rapide de vêtements (Nom, Catégorie, Couleur, Marque, Taille, Matière, Saisons).
* **Filtres de recherche avancés** : Recherche par mots-clés (nom, marque, matière) et filtrage par catégorie ou par disponibilité.
* **Disponibilité simple (Booléenne)** : Un simple switch pour marquer si ton vêtement est dans l'armoire (`Disponible`) ou s'il est au panier de linge sale (`Indisponible`).
* **Compteur dynamique de ports** : Affiche le nombre de fois où le vêtement a été porté depuis son dernier lavage (calculé dynamiquement à la volée en croisant tes historiques de tenues et de lessives, sans dupliquer la donnée).

### 🧺 Lessives (Entretien)
* **Saisie ultra-simplifiée** : Conçue pour être utilisée au moment où tu étends ton linge. L'app te suggère d'abord les vêtements actuellement indisponibles/sales.
* **Cycle de séchage automatisé** : Les habits enregistrés dans une lessive restent indisponibles le temps qu'ils sèchent (délai configurable, ex: 24h). Une tâche de fond les repasse automatiquement en `Disponible`, met à jour leur date de lavage et réinitialise leur compteur de ports à 0 une fois le délai écoulé.

### ⚙️ Options & Préférences
* **Configuration générale** : Choix de ta ville pour la météo et configuration du délai de séchage (en heures).
* **Gestionnaire de Tenues Types** : Crée tes associations favorites de vêtements, configure leur température idéale et leur contexte d'usage.
* **Sauvegarde Cloud (Google Drive)** : Intégration native avec `@bq/db-sync` pour synchroniser tes données en tâche de fond de manière transparente avec ton fichier global `bq-metrics-sync.json`.

---

## 💾 Modèle de Données (Dexie / @bq/db-sync)

L'application utilise une base IndexedDB locale hors-ligne (`BQClothesDatabase`) et réutilise les identifiants de collections de `bq-metrics` pour une compatibilité totale :

1. **`Inventaire - Vêtements` (ID : `col-41w5uphny`)**
   * `nom` (text, required)
   * `categorie` (select : T-shirt, Chemise, Pull, Chino, Jean, Short, Veste, Manteau, Chaussures, Accessoire)
   * `matiere` (text)
   * `couleur` (text)
   * `marque` (text)
   * `taille` (text)
   * `saison` (tags)
   * `is_available` (boolean)

2. **`Tenues Portées` (ID : `col-cj7vz5e37`)**
   * `date` (date, required)
   * `vetements_portes` (relation multiple vers `col-41w5uphny`)
   * `contexte` (text: Bureau, Télétravail, Sport, Escalade, Sortie, Détente)

3. **`Lessives` (ID : `col-lessives`)**
   * `date` (date, required)
   * `vetements_laves` (relation multiple vers `col-41w5uphny`)

4. **`Tenues Types` (ID : `col-tenues-types`)**
   * `nom` (text, required)
   * `vetements_associes` (relation multiple vers `col-41w5uphny`)
   * `contexte` (text)
   * `temperature_ideale` (number)

---

## 🛠️ Commandes utiles

Toutes les commandes sont à exécuter depuis la racine du monorepo :

* **Lancer l'application en développement** :
  ```bash
  npm run dev -w bq-clothes
  ```

* **Vérifier les types TypeScript & Compiler le projet (PWA)** :
  ```bash
  npm run build -w bq-clothes
  ```

* **Tester les assets compilés en local** :
  ```bash
  npm run preview -w bq-clothes
  ```
