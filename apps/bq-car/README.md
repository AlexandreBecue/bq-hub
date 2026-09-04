# 🚗 bq-car

**bq-car** est l'application dédiée au suivi complet de tes véhicules : entretiens, réparations, consommation de carburant et alertes de maintenance.

---

## 🎯 Objectifs & Besoins

* **Suivi de la consommation** : Calculer précisément ta consommation de carburant (L/100 km) entre chaque plein et suivre l'évolution du prix au litre.
* **Journal d'interventions** : Archiver toutes les factures, pièces changées et interventions effectuées sur tes véhicules.
* **Alertes de maintenance** : Mettre en place des rappels kilométriques ou calendaires (ex: vidange tous les 15 000 km ou 1 an) pour ne rater aucun entretien essentiel.
* **Multi-véhicule** : Gérer plusieurs véhicules au sein d'une seule interface.

---

## 💾 Modèle de Données (Collections suggérées)

* **`CAR_VEHICLES` (Véhicules)** :
  * Nom (ex: Ma Peugeot 208)
  * Immatriculation
  * Kilométrage actuel
  * Date d'achat
* **`CAR_FUEL` (Plein de Carburant)** :
  * Date
  * Kilométrage au compteur (km)
  * Volume de carburant (L)
  * Prix total (€)
  * Plein complet (Oui/Non) -> indispensable pour calculer l'allure de consommation moyenne
  * Station essence (ex: Total, Carrefour)
  * Véhicule (Relation vers `CAR_VEHICLES`)
* **`CAR_MAINTENANCE` (Interventions)** :
  * Date
  * Type d'intervention (Vidange, Courroie, Freins, Pneus, Contrôle Technique)
  * Kilométrage lors de l'intervention (km)
  * Garage / Fait soi-même
  * Description & pièces changées
  * Montant (€)
  * Scan de facture (Lien Drive)
  * Véhicule (Relation vers `CAR_VEHICLES`)

---

## 🔗 Interconnexions avec l'écosystème

* **Avec `bq-bank`** : Chaque plein ou facture d'entretien génère automatiquement une ligne de transaction correspondante de débit dans tes comptes.
* **Avec `bq-metrics`** : Permet de tracer de magnifiques graphiques de ta consommation de carburant, de l'évolution du prix au litre selon les stations, et d'obtenir le coût d'usage total de tes véhicules par kilomètre parcouru (TCO).
