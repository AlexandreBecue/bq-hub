# 🎬 bq-watch - Cinémathèque, Débriefing IA & Watchlist Streaming

**`bq-watch`** est une Progressive Web App (PWA) de la suite **`bq-hub`**, dédiée au suivi des visionnages de films, séries et documentaires. 

Elle résout le problème de la saisie manuelle fastidieuse grâce à l'autocomplétion TMDB, propose un **assistant conversationnel IA (Gemini)** capable de débriefer chaque œuvre en s'appuyant sur l'ensemble de vos avis historiques pour rédiger une synthèse et suggérer une note sur 10, gère une **boîte de réception (Inbox)** par glisser-déposer d'exports streaming (Netflix, Prime, Cinéma), et intègre une **Watchlist intelligente** détectant en temps réel les disponibilités en France sur les plateformes SVOD via TMDB et JustWatch.

---

## 🌟 Fonctionnalités Principales

### 1. 🍿 Bibliothèque & Cinémathèque (`LibraryView`)
* **Historique complet** : Consultation de tous les films et séries vus, triés par date de visionnage la plus récente.
* **Filtres multicritères** :
  * Par type : *Films*, *Séries*, *Documentaires*, *Autres*.
  * Par plateforme : *Netflix*, *Prime Video*, *Cinéma*, *Disney+*, *Canal+*, *DVD*, etc.
  * Par genre TMDB : *Action*, *Science-Fiction*, *Comédie*, *Drame*, *Animation*, etc.
  * Par tri : *Plus récents*, *Meilleures notes*, *Titre A-Z*.
* **Suivi des visionnages multiples (`Culture - Visionnages`)** :
  * Chaque œuvre dispose désormais d'un historique complet de ses différents visionnages (*date, support exact, commentaire*).
  * Badge « Vu X fois » sur les fiches de films revus plusieurs fois.
  * Ajout ou suppression directe d'un nouveau visionnage depuis la modale de détails.
* **Recherche instantanée** : Recherche textuelle plein-texte sur les titres, avis, réalisateurs ou plateformes.
* **Fiches détaillées & Affiches officielles** : Récupération des affiches officielles TMDB, affichage des notes sur 10, dates et avis complets, avec édition ou suppression en fenêtre modale.

### 2. 💬 Studio de débrief (`DebriefView`)
* **Autocomplétion TMDB** : Lors de la saisie du titre, suggestions automatiques avec affiches, années de sortie et types.
* **Conversation IA avec mémoire historique** :
  * Connecté à l'API **Google Gemini** (modèle *Gemini 1.5 Flash* / *Gemini 2.5 Flash*).
  * L'IA reçoit en contexte l'ensemble de vos 100+ avis passés et votre profil cinématographique. Elle sait ce que vous avez aimé (*La Ligne verte*, *Inception*, *Fury*, etc.) et ce qui vous a moins touché.
  * L'IA engage un échange chaleureux en 1 ou 2 questions courtes pour vous aider à exprimer votre ressenti.
* **Suggestion automatique de note & synthèse** :
  * Un clic sur *« 🪄 Générer la synthèse et la note »* produit un résumé fidèle à votre style d'écriture ainsi qu'une note suggérée sur 10.
  * Curseur interactif pour valider ou ajuster la note à volonté avant d'enregistrer dans la cinémathèque.
* **Débrief Express (30 secondes)** :
  * Pour les soirs sans discussion, sélection rapide d'une mention (*Chef-d’œuvre*, *Très fortement apprécié*, *Aimé*, *Mitigé*, etc.) et de tags de ressenti cliquables (*« Twist marquant »*, *« Excellente stratégie »*, *« Un peu long »*, etc.) pour générer automatiquement la fiche.

### 3. 📥 Boîte de Réception / Inbox (`InboxView`)
* **Zéro saisie manuelle de date et titre** :
  * Glissez-déposez vos fichiers d'historique bruts :
    * `NetflixViewingHistory.csv`
    * `AmazonPrimeVideoHistory*.json`
    * `cinema.csv`
  * L'application extrait les titres et dates, élimine automatiquement les doublons déjà présents dans votre bibliothèque et affiche la liste des contenus en attente de débriefing.
* **Flux d'action rapide** :
  * Bouton **« Débriefer »** : ouvre directement le studio de débriefing avec le film pré-rempli.
  * Bouton **« Vu »** : ajoute directement à la bibliothèque sans débrief.
  * Bouton **« Tout marquer comme vu »** pour vider la file en un clic.

### 4. 🎲 Watchlist Intelligente (`WatchlistView`)
* **Recherche & Ajout en 1 clic** : Ajout de n'importe quel film ou série à voir via la recherche TMDB.
* **Disponibilité streaming en temps réel (JustWatch / TMDB)** :
  * Détection automatique des abonnements SVOD en France (**Netflix**, **Prime Video**, **Disney+**, **Canal+**, **Apple TV+**, **Max**...).
  * Affichage des logos officiels des plateformes sur chaque carte.
* **Filtre « 🍿 Disponible en streaming ce soir »** : Isole instantanément les œuvres de votre Watchlist incluses dans vos abonnements actuels pour ne plus perdre de temps à chercher.
* **Validation de visionnage** : Le bouton **« ✅ Je l'ai vu ! »** transfère le film de la Watchlist vers le Débrief.

### 5. ⚙️ Paramètres & Synchronisation (`SettingsView`)
* **Synchronisation Cloud unifiée** : Intégration de `<BaseSettings />` (`@bq/theme`) connectée à Google Drive via `@bq/db-sync` et le fichier central `bq-metrics-sync.json`.
* **Configuration des clés API** :
  * Clé API **Google Gemini** (Google AI Studio, 100% gratuite).
  * Clé API **TMDB** (optionnelle, clé par défaut intégrée).
* **Gestion des tags du Débrief Express** : Ajout, suppression et réinitialisation de vos tags de ressenti personnalisés.
* **Sauvegarde & Restauration** : Export et import JSON de votre base de données.

---

## 🛠️ Commandes

```bash
# Lancer en mode développement
npm run dev -w bq-watch

# Ou depuis la racine du monorepo
npm run dev:watch

# Compiler pour la production
npm run build -w bq-watch
```

---

## 🎨 Charte Graphique & Spécifications

* **Couleur Primaire** : Rouge Velours Cinéma (`var(--color-bq-watch)` / `#f43f5e`)
* **Couleur Secondaire** : Ambre Projecteur (`var(--color-orange)` / `#f59e0b`)
* **Favicon PWA** : Clap de cinéma vectoriel flottant sur fond transparent avec `stroke-width="2.5"`.
* **Base de données locale** : Dexie / IndexedDB (`BQWatchDatabase`).
* **Collections standardisées (IDs aléatoires canoniques)** :
  * `col-h8rl3suoy` : **Culture - Films & Séries** (fiches principales, genres, avis, notes, affiches).
  * `col-v3p8m1k9r` : **Culture - Visionnages** (historique individuel de chaque visionnage avec date et support).
  * `col-w7t1p9k4x` : **Films & Séries - Boîte de réception** (fichiers d'imports en attente de débrief).
* **Identifiants** : Tous les identifiants d'enregistrements suivent le standard aléatoire `rec-[9 caractères]` généré de manière sécurisée sans aucune donnée intelligible.
