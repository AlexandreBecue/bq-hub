# 🧠 bq-quiz

**bq-quiz** est ton application personnelle de révision de notions clés (principalement la culture générale) utilisant un moteur algorithmique de répétition espacée (Spaced Repetition) pour maximiser ta mémorisation à long terme sans effort superflu.

---

## 🎯 Objectifs & Besoins

* **Spaced Repetition (SRS)** : Intégrer un algorithme éprouvé (comme l'algorithme SuperMemo SM-2) qui planifie la révision d'une fiche juste avant que ton cerveau ne s'apprête à l'oublier (plus une carte est facile, plus l'intervalle s'allonge).
* **Création de fiches intuitive** : Saisir facilement des fiches sous forme de flashcards (Recto / Verso) directement sur mobile ou PC.
* **Révision mobile quotidienne** : Une interface "Swipe & Rate" fluide (ex: évaluer ta réponse de 1 à 5 étoiles) utilisable n'importe où (PWA en mode hors-ligne).
* **Multi-thématiques** : Catégoriser tes fiches par paquets (decks) : Histoire, Géographie, Littérature, Sciences, etc.

---

## 💾 Modèle de Données (Collections suggérées)

* **`QUIZ_DECKS` (Paquets de cartes)** :
  * Nom (ex: Capitales d'Europe, Histoire du Moyen Âge)
  * Couleur / Icone thématique
* **`QUIZ_CARDS` (Flashcards de révision)** :
  * Recto (La question ou l'indice, ex: "Quelle est la capitale de l'Islande ?")
  * Verso (La réponse ou explication, ex: "Reykjavik")
  * Deck associé (Relation vers `QUIZ_DECKS`)
  * Intervalle actuel (nombre de jours) -> géré par l'algorithme SRS
  * Facteur de facilité (E-factor) -> géré par l'algorithme SRS (défaut: 2.5)
  * Nombre de répétitions consécutives réussies
  * Date de la prochaine révision planifiée (timestamp)

---

## 🔗 Interconnexions avec l'écosystème

* **Avec `bq-metrics`** : Permet de suivre des graphiques de progression (le nombre de cartes apprises, le profil d'oubli, le taux de réussite par thématique, le nombre de cartes prévues par jour sur le mois à venir).
* **Synchronisation Google Drive** : Toutes tes fiches de révision sont partagées sur ton compte Google Drive de manière transparente, te permettant d'apprendre une notion sur ton PC et de la réviser dans le bus sur ton téléphone de manière transparente.
