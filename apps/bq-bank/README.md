# 💰 bq-bank (v0)

**bq-bank** est ton application de gestion financière optimisée, mobile-first et hors-ligne. Elle est conçue pour remplacer la saisie financière complexe de `bq-metrics` par un carnet de comptes ergonomique et intelligent, capable de calculer tes soldes en temps réel, de suivre tes enveloppes budgétaires et d'importer tes dépenses depuis d'autres applications en un clic.

---

## 🎯 Fonctionnalités de la v0

### 💸 Saisie & Opérations (Accueil)
* **Formulaire ultra-rapide** : Saisis tes dépenses (Sorties), revenus (Entrées) et transferts (Internes) en quelques secondes sur mobile.
* **Historique Chronologique** : Liste des transactions récentes avec code couleur clair (Rouge pour les sorties, Vert pour les entrées, Bleu pour les transferts).
* **📥 Boîte de Réception Intégrée (Inbox suggestions)** :
  * Première intégration du **mécanisme transversal d'import/suggestion entre les applications** (Inbox / Suggestions message queue).
  * Quand tu saisis un plein d'essence dans `bq-car`, cette dernière dépose une suggestion de dépense pré-remplie (Date, Montant exact, Budget "Voiture", Commentaire "Station essence...") dans la collection transversale.
  * À l'ouverture de `bq-bank`, un bandeau interactif te propose d'importer cette dépense. Tu peux d'un clic la rejeter, ou l'accepter pour pré-remplir le formulaire, choisir le compte débité et la valider définitivement !

### 🏦 Mes Comptes (Soldes en temps réel)
* **Calcul du solde réel dynamique** : Solde en temps réel pour chacun de tes comptes actifs (Compte Courant, Livret A, PayPal, Revolut...) calculé à partir de sa valeur de départ plus ou moins l'historique complet de tes transactions.
* **Patrimoine Global** : Affiche la somme cumulée de l'ensemble de tes avoirs bancaires en temps réel.

### 📊 Budgets (Enveloppes Mensuelles)
* **Progress Bars de catégories** : Configure des plafonds mensuels sur tes budgets récurrents (ex : Courses, Loisirs, Transport).
* **Suivi de progression** : Des jauges de progression interactives changent de couleur (Vert s'il te reste de la marge, Orange au-delà de 75%, Rouge si l'enveloppe est dépassée !) pour t'aider à évaluer ton reste à vivre d'un seul coup d'œil.
* **Sélecteur Temporel** : Navigue facilement d'un mois sur l'autre (M-1, M+1) pour consulter tes balances de dépenses passées ou futures.

### ⚙️ Options & Paramètres
* **Gestionnaire de Comptes** : Ajoute de nouveaux comptes, initialise leur solde bancaire de départ ou archive/désactive les anciens comptes vendus ou clôturés.
* **Gestionnaire d'Enveloppes Budgétaires** : Définis tes enveloppes et ajuste leurs plafonds mensuels.
* **Synchronisation Cloud (Google Drive)** : Intégration native avec `@bq/db-sync` pour sauvegarder et fusionner tes finances dans le fichier global `bq-metrics-sync.json`.

---

## 💾 Modèle de Données (Dexie / @bq/db-sync)

L'application utilise une base IndexedDB locale hors-ligne (`BQBankDatabase`) et réutilise les identifiants de collections de `bq-metrics` pour une compatibilité totale :

1. **`Finances` (ID : `col-t2scpu7k7`)**
   * `date` (date, required)
   * `type` (select: Entrée, Sortie, Interne)
   * `montant` (number, €)
   * `compte` (text)
   * `categorie` (select : Revenu, Dépense, Cadeau, Remboursement, Prêt, Vente, Crédit, Virement)
   * `budget` (text)
   * `partenaire` (text)
   * `commentaire` (text)

2. **`Comptes Bancaires` (ID : `col-c9mpt3s`)**
   * `nom` (text, required)
   * `solde_initial` (number)
   * `is_active` (boolean)

3. **`Enveloppes Budgétaires` (ID : `col-b8dg3ts`)**
   * `nom` (text, required)
   * `plafond_mensuel` (number)

4. **`Inbox / Suggestions` (ID transversal : `col-1nb0x-sug`)**
   * `source_app` (text, required)
   * `action` (text, required)
   * `payload` (JSON string)
   * `status` (text: pending, accepted, rejected)

---

## 🛠️ Commandes utiles

Toutes les commandes sont à exécuter depuis la racine du monorepo :

* **Lancer l'application en développement** :
  ```bash
  npm run dev:bank
  ```

* **Vérifier les types TypeScript & Compiler le projet (PWA)** :
  ```bash
  npm run build -w bq-bank
  ```

* **Tester les assets compilés en local** :
  ```bash
  npm run preview -w bq-bank
  ```
