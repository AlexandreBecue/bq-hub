# UX & Design System Guidelines — BQ-Hub

Ce document formalise les règles d'expérience utilisateur (UX), de design system et d'accessibilité appliquées uniformément sur l'ensemble des 10 applications de l'écosystème BQ-Hub.

---

## 1. Philosophie & Principes Fondamentaux

* **100% Global First :** Aucune règle CSS spécifique ou locale ne doit être introduite si elle peut être factorisée dans `@bq/theme`. Les fichiers de composants ne contiennent que le layout structurel spécifique.
* **Harmonie Transversale :** Un utilisateur navigant entre `bq-bank`, `bq-car`, `bq-coach` ou `bq-cook` doit retrouver exactement les mêmes réflexes ergonomiques et visuels.
* **Sobriété au repos, clarté à l'action :** L'interface doit être épurée par défaut pour laisser respirer les données, et révéler ses intentions sémantiques au survol et à l'interaction.

---

## 2. Palette, Couleurs & Accessibilité (Contrastes)

### 2.1 Rôles des couleurs
* **`--color-primary`** : Couleur identitaire forte de l'application (ex. Orange pour `bq-coach`, Kaki pour `bq-cloth`, Corail pour `bq-car`, Bleu pour `bq-bank`, Jaune pour `bq-cook`).
* **`--color-secondary`** : Couleur d'accentuation complémentaire (ex. Jaune pour `bq-coach`, Terracotta pour `bq-cloth`, Violet pour `bq-bank`).
* **Couleurs sémantiques universelles :**
  - `--color-success` (Vert) : Validation, solde positif, bon état.
  - `--color-warning` (Orange) : Attention, seuil d'alerte, rappel.
  - `--color-danger` (Rouge) : Suppression, erreur, dépassement critique.
  - `--color-info` (Bleu) : Information neutre, aide.
  - `--color-neutral` (Bleu nuit discret) : Arrière-plans de boutons et badges neutres.

### 2.2 Règle de contraste dynamique (`--color-*-contrast`)
* Tout élément à fond plein (`.btn-primary`, `.btn-secondary`, badges pleins) utilise obligatoirement sa variable de contraste dédiée (`--color-primary-contrast` / `--color-secondary-contrast`).
* **Règle absolue :** Dès qu'une couleur est claire (blanc, jaune, pastel, etc.), son texte est **automatiquement sombre (`#0b0f19`)**. Le texte blanc sur fond clair est strictement proscrit.

---

## 3. Boutons d'Action & CRUD (Règle d'Or)

### 3.1 Création (`create`)
* **Format obligatoire :** Toujours un **vrai bouton d'action principal** (`.btn.btn-primary`) comportant une icône (`Plus`) et un libellé clair (ex. *« Nouveau plein »*, *« Ajouter une recette »*, *« Nouvelle lessive »*).
* **Interdiction :** Ne jamais réduire une action de création majeure à une simple petite icône cliquable isolée.

### 3.2 Actions sur les lignes / cartes (`.action-btn`)
Pour toutes les interactions directes sur les entités d'une liste ou d'un tableau, la classe universelle unique **`.action-btn`** est utilisée :
* **Au repos :** Discret et neutre, icône grise (`var(--color-text-muted)`), fond transparent.
* **Modification (`.action-btn.edit`) :**
  - Utilise l'icône `Edit2`.
  - Au survol : s'illumine dans la **couleur primaire** de l'application (`var(--color-primary)`).
* **Duplication (`.action-btn.duplicate`) :**
  - Utilise l'icône `Copy`.
  - Au survol : s'illumine dans la **couleur secondaire** de l'application (`var(--color-secondary)`).
* **Suppression (`.action-btn.delete`) :**
  - Utilise l'icône `Trash2` ou `X`.
  - Au survol : s'illumine **strictement en rouge danger** (`var(--color-danger)`).
  - **Interdiction absolue :** Une suppression ne doit JAMAIS s'afficher en couleur primaire ou secondaire au survol.

### 3.3 Boutons de suppression contextuels
* Si un bouton d'action textuel effectue une suppression (ex. supprimer une étape, un finisseur, une entrée), il doit utiliser la classe **`.btn.btn-danger`** avec l'icône `Trash2`, garantissant un fond rouge bien visible et un texte blanc contrasté (aucun bouton "blanc sur blanc").

---

## 4. Badges vs Pills : Taxonomie Unifiée

* **Suppression du terme "pill" :** Le terme `pill` est banni du vocabulaire CSS et HTML du hub.
* **Norme `.badge` :** Tous les marqueurs de statut, catégories ou compteurs utilisent exclusivement la classe **`.badge`**.
* **Forme :** Tous les badges du hub ont des bords arrondis gélule (`border-radius: 9999px`).
* **Variantes disponibles :**
  - Sémantiques : `.badge-primary`, `.badge-secondary`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-neutral`.
  - Palette complète : `.badge-blue`, `.badge-green`, `.badge-red`, `.badge-yellow`, `.badge-purple`, `.badge-orange`, `.badge-pink`, `.badge-terracotta`, `.badge-grey`.

---

## 5. Typographie & Intégrité Sémantique

### 5.1 Titres globaux (`h1` à `h6`)
* Alignement automatique : Tous les titres disposent d'un `display: flex; align-items: center; gap: 0.5rem;` global.
* Les icônes enfants ont `flex-shrink: 0;` pour éviter tout écrasement sur les longs titres.
* Par défaut, les icônes de titres héritent de la couleur naturelle du texte (`var(--color-text-main)`), sans surcharge de couleur artificielle.

### 5.2 Règle sémantique WCAG (Titres vs Données Chiffrées)
* Les balises `h1`-`h6` sont réservées exclusivement à la hiérarchie de sections du document.
* **Interdiction :** Ne jamais utiliser une balise `h2` ou `h3` simplement pour afficher un indicateur chiffré ou une métrique en grand (ex. solde de patrimoine, compteur de kilomètres, score). Utiliser un `<div class="font-black text-2xl ...">` ou `<span class="metric-val ...">`.

---

## 6. Dispositions Flexbox & Espacement

* **`.flex-row` :** Intègre par défaut `align-items: center;` et `gap: 0.5rem;` (8px). Dès qu'une icône et du texte sont encapsulés dans un `.flex-row`, l'espacement et l'alignement vertical sont garantis sans ajout de classes manuelles.
* **Surcharges d'espacement :** Les classes `.gap-0`, `.gap-1` (4px), `.gap-2` (8px), `.gap-3` (12px), `.gap-4` (16px) permettent d'ajuster si nécessaire avec priorité `!important`.

---

## 7. Cartes & Effets de Survol

* **`.card.glass` :** Fond translucide sombre avec flou de matière (`backdrop-filter: blur(12px)`).
* **`.card.hoverable` :**
  - Au survol : élévation légère (`transform: translateY(-2px)`).
  - La bordure (`--color-border-hover`) et le halo lumineux (`--shadow-glow`) sont dérivés automatiquement de `var(--color-primary)` de l'application courante.

---

## 8. Architecture des Données & Synchronisation

* **Nomenclature unifiée des collections (`<nom-app> - <nom>`) :**
  - Le nom de toute collection Dexie doit être obligatoirement préfixé par le nom de l'application qu'elle concerne en minuscules : `<nom-app> - <nom de la collection>` (ex. `bq-bank - finances`, `bq-bank - enveloppes budgétaires`, `bq-coach - séances cardio`, `bq-cook - stocks & ingrédients`).
* **Format d'identifiants strictement aléatoires :**
  - Tous les identifiants techniques sont obligatoirement des chaînes base36 aléatoires de 9-10 caractères préfixées par le type d'entité :
    - Collections : `col-<random9>` (ex. `col-c686fcnxs`, `col-9w4b1v8zp`)
    - Enregistrements : `rec-<random9>` (ex. `rec-d81sa9i6u`)
    - Vues : `view-<random9>` (ex. `view-91dqg5edgi`)
    - Modèles / Templates : `temp-<random9>` (ex. `temp-6se8a7q321`)
    - Champs : `fld-<random9>`
  - Ne jamais utiliser de chaînes sémantiques codées en dur (bannir `col-vetements`, `col-tenues`, `col-decks`, `col-parties`, `col-vehicules`, `col-coach-prog`, etc.).
* **Suggestions transversales (`bq-bank - suggestions`) :**
  - La collection `col-9w4b1v8zp` (`bq-bank - suggestions`) appartient à `bq-bank` et sert de passerelle d'écriture commune pour les suggestions de transactions émises par les autres applications dépensières (`bq-car`, `bq-cook`, `bq-health`...).
* **Sports configurables (`bq-coach - sports`) :**
  - La collection `col-s8d2m4k7v` (`bq-coach - sports`) gère la liste personnalisable des sports pratiqués, éliminant tout sport codé en dur dans l'interface.
* **Schémas purs dans `initializeCollections()` :** Ne doit créer que les schémas de collections Dexie (`db.collections`). Ne doit **jamais** injecter automatiquement des données par défaut ou de démo à l'initialisation.
* **Données de démo en TypeScript :** Les données de démonstration sont produites par `generateDemoData()` via du code TypeScript natif. Aucun fichier `.json` statique n'est embarqué dans `src/assets/`.
* **Règle de gestion des seuils d'alerte (Stocks / Inventaires) :**
  - Si la quantité en stock est égale ou supérieure au seuil (`quantite >= seuil_d_alerte`), le niveau est considéré comme **suffisant** (`Suffisant`).
  - L'alerte d'achat (`À acheter`) et l'ajout automatique à la liste de courses ne se déclenchent que si la quantité est **strictement inférieure** au seuil défini (`quantite < seuil_d_alerte`).
* **Export JSON propre & Scruté par application (`exportDatabase`) :**
  - **Exclusion des tombstones :** Tout export JSON manuel exclut automatiquement les enregistrements marqués comme supprimés (`deletedAt`), produisant un fichier 100% propre et optimisé.
  - **Périmètre applicatif :** Chaque application n'exporte que ses propres collections (dont le nom débute par `<nom-app> - `). Si des collections d'autres applications sont présentes dans la base IndexedDB locale, elles sont ignorées lors de l'export de cette app.
  - **Exception universelle `bq-graph` :** Seule `bq-graph` conserve son rôle de super-explorateur et exporte l'intégralité de toutes les collections et enregistrements de toutes les applications du hub.
* **Synchronisation Google Drive Masquée (`appDataFolder`) :**
  - Toutes les applications du hub synchronisent leurs collections Dexie respectives vers **un fichier masqué : `bq-hub-sync.json`** situé dans le dossier applicatif privé de Google Drive (`spaces=appDataFolder`, scope `https://www.googleapis.com/auth/drive.appdata`).
  - Ce fichier est **totalement invisible** dans l'interface utilisateur de Google Drive, empêchant toute suppression ou déplacement accidentel.
  - L'ancien fichier pivot visible `bq-metrics-sync.json` de la racine Google Drive est définitivement abandonné.
  - Le préfixe `${app}-backup-YYYY-MM-DD.json` reste réservé exclusivement aux téléchargements manuels de sauvegarde sur la machine locale.

---

## 9. Iconographie & Émojis

* **Icônes Lucide obligatoires (`@lucide/vue`) :** Toutes les applications du hub exploitent la bibliothèque vectorielle Lucide. L'utilisation d'émojis bruts système dans les titres, boutons, badges et cartes est proscrite (rendu disparate selon l'OS, rupture de la charte sombre).
* **Symbolique sportive (`bq-coach`) :**
  - **Renfo :** `BicepsFlexed` (bras musclé) ou `Dumbbell` (matériel).
  - **Cardio :** `HeartPulse` (cœur avec impulsion d'effort / endurance).
  - **Hybride :** `Zap` (énergie combinée).
  - **Repos :** `Moon` (récupération).
  - **Échauffement :** `Flame` (activation).
  - **Circuit :** `Repeat` (répétition / tours).
