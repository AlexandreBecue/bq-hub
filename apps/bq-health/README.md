# 🩺 bq-health (v0)

**bq-health** est ton carnet de santé personnel, numérique, sécurisé, mobile-first et hors-ligne. Elle est conçue pour remplacer la saisie médicale éparse dans `bq-metrics` par un carnet de santé complet qui gère ton profil d'urgence, planifie tes pilules journalières, suit tes vaccins historiques et tes courbes de poids, tout en envoyant tes frais de santé directement vers ton portefeuille bancaire.

---

## 🎯 Fonctionnalités de la v0

### 🩺 Cockpit Santé & Fiche de Secours (Accueil)
* **Fiche de Secours (ICE)** : Visualise instantanément tes informations vitales (Groupe sanguin, Allergies/Intolérances critiques, Antécédents médicaux majeurs, et ton contact d'urgence principal).
* **Pilulier Actif** : Affiche les médicaments que tu dois prendre aujourd'hui d'après tes ordonnances et traitements actifs.
* **Alertes Vaccins** : Liste les vaccins déclarés "À faire" ou dont la date de rappel est dépassée (en te donnant le retard précis en jours).

### 📅 Consultations & RDVs
* **Timeline Chronologique** : Suis tes rendez-vous médicaux futurs et passe en revue l'historique complet de tes consultations passées.
* **Carnet de Praticiens** : Enregistre tes médecins par spécialité (Généraliste, Dentiste, Kiné, Ostéo, Ophtalmo, etc.).
* **🔗 Interconnexion financière (`bq-health` ➔ `bq-bank`)** :
  * Si tu indiques un coût lors d'une consultation médicale, `bq-health` dépose automatiquement une suggestion de dépense pré-remplie (Date, Montant exact, Budget "Santé", Tiers: "Docteur [Nom]") dans l'Inbox transversale.
  * Tu n'as plus qu'à l'ouvrir dans `bq-bank` pour l'importer et choisir ton compte de paiement en 3 secondes !

### 💊 Traitements (Ordonnances)
* **Garde-boue des prescriptions** : Renseigne tes ordonnances (Nom, posologie détaillée, date de début, date de fin, médecin prescripteur).
* **Pilulier dynamique** : Un simple switch te permet de marquer un traitement comme "Terminé" pour le retirer de ton pilulier actif.

### 📏 Poids & Mensurations (Suivi Corporel)
* **Historique de pesées** : Entre tes relevés de poids réguliers et consulte tes courbes historiques.
* **Calculateur d'IMC** : Estime ton **Indice de Masse Corporelle (IMC)** en temps réel d'après ton dernier poids et ta taille, et t'indique ta catégorie de corpulence (Normal, Surpoids, etc.).
* **Aide-Mémoire Mensurations** : Enregistre tes mensurations corporelles (Tour de taille, tour d'épaules, poitrine, cuisses) pour les avoir sous la main lors de tes achats de vêtements (parfaitement raccord avec `bq-clothes` !).

### 💉 Vaccins (Historique)
* **Compatibilité Rétroactive** : Réutilise et affiche instantanément tout ton historique de vaccins stocké sur ton Google Drive unifié (ID de collection existant `col-7lp7tols4`).
* **Suivi des échéances** : Ajoute tes nouvelles injections et configure tes dates de prochains rappels (ex : dans 10 ans pour les rappels adultes).

### ⚙️ Options & Paramètres
* **Édition du Profil ICE** : Configure ton groupe sanguin, tes allergies et tes contacts d'urgence.
* **Synchronisation Cloud (Google Drive)** : Synchronisation automatique en tâche de fond avec ton fichier de sauvegarde unique `bq-metrics-sync.json`.

---

## 💾 Modèle de Données (Dexie / @bq/db-sync)

L'application utilise une base IndexedDB locale hors-ligne (`BQHealthDatabase`) et réutilise les identifiants de collections existants pour une compatibilité totale :

1. **`Santé - Vaccins` (ID existant : `col-7lp7tols4`)**
   * `date` (date, required)
   * `type` (select: BCG, DTCaP, Hépatite B, ROR, Méningocoque C, Varicelle, Test tuberculinique, HPV, Grippe, Covid-19, Autre)
   * `vaccin` (text, required)
   * `statut` (select: Fait, À faire / Rappel)
   * `prochain_rappel` (date)

2. **`Rendez-vous Médicaux` (ID : `col-y7u1o2p3w`)**
   * `date` (date, required)
   * `heure` (text)
   * `praticien` (text, required)
   * `specialite` (select: Généraliste, Dentiste, Ophtalmologue, Dermatologue, Kinesithérapeute, Ostéopathe, Cardiologue, Autre Spécialiste)
   * `motif` (text)
   * `prix` (number)
   * `notes` (text)

3. **`Traitements & Ordonnances` (ID : `col-n9p5m2r8t`)**
   * `nom_medicament` (text, required)
   * `posologie` (text, required)
   * `date_debut` (date, required)
   * `date_fin` (date)
   * `actif` (boolean)
   * `medecin_prescripteur` (text)

4. **`Poids & Mensurations` (ID : `col-p01ds-m3ns`)**
   * `date` (date, required)
   * `poids` (number, required)
   * `taille` (number)
   * `tour_taille` (number)
   * `tour_epaules` (number)
   * `tour_poitrine` (number)
   * `tour_cuisses` (number)

5. **`Inbox / Suggestions` (ID transversal : `col-1nb0x-sug`)**
   * `source_app` (text)
   * `action` (text)
   * `payload` (JSON string)
   * `status` (text)

---

## 🛠️ Commandes utiles

Toutes les commandes sont à exécuter depuis la racine du monorepo :

* **Lancer l'application en développement** :
  ```bash
  npm run dev:health
  ```

* **Vérifier les types TypeScript & Compiler le projet (PWA)** :
  ```bash
  npm run build -w bq-health
  ```

* **Tester les assets compilés en local** :
  ```bash
  npm run preview -w bq-health
  ```
