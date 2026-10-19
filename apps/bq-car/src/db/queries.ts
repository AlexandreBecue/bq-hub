import { db, type RecordEntry, type CollectionSchema, type FieldType } from './index';

// Collection IDs
export const VEHICLES_COL_ID = 'col-q8m4x2v9k';   // Véhicules
export const ENTRETIENS_COL_ID = 'col-344y1kegd'; // Voiture - Entretien
export const CARBURANTS_COL_ID = 'col-n37im2z5e'; // Voiture - Carburant
export const SUGGESTIONS_COL_ID = 'col-9w4b1v8zp'; // Inbox Suggestions (bq-bank)

/**
 * Format YYYY-MM-DD to DD/MM/YYYY
 */
export function formatToFrenchDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Initializes collections and migrates vehicle strings to the new Véhicules collection.
 */
export async function initializeCollections() {
  const existingCols = await db.collections.toArray();
  const colIds = existingCols.map(c => c.id);

  const newCols: CollectionSchema[] = [];

  // 1. New Vehicles Collection
  if (!colIds.includes(VEHICLES_COL_ID)) {
    newCols.push({
      id: VEHICLES_COL_ID,
      name: 'bq-car - véhicules',
      description: 'Ma flotte de véhicules',
      createdAt: Date.now(),
      primaryFieldKey: 'nom',
      fields: [
        { id: 'f-vnom', name: 'Nom', key: 'nom', type: 'text' as FieldType, required: true },
        { id: 'f-vcarb', name: 'Carburant', key: 'type_carburant', type: 'select' as FieldType, required: true, options: ["Gazole", "SP95", "SP98", "SP95-E10", "GPL", "Électrique", "Hybride"] },
        { id: 'f-vimmat', name: 'Immatriculation', key: 'immatriculation', type: 'text' as FieldType, required: false },
        { id: 'f-vkm', name: 'Kilométrage initial', key: 'kilometrage_initial', type: 'number' as FieldType, required: true },
        { id: 'f-vactive', name: 'Actif', key: 'is_active', type: 'boolean' as FieldType, required: true }
      ]
    });
  }

  // 2. Existing Voiture - Entretien
  if (!colIds.includes(ENTRETIENS_COL_ID)) {
    newCols.push({
      id: ENTRETIENS_COL_ID,
      name: 'bq-car - entretiens',
      description: 'Suivi des entretiens réalisés sur les voitures',
      createdAt: Date.now() + 10,
      primaryFieldKey: 'date',
      fields: [
        { id: 'rfm941is1', name: 'Date', key: 'date', type: 'date' as FieldType, required: true },
        { id: '7n19nosch', name: 'Véhicule', key: 'vehicule', type: 'text' as FieldType, required: true }, // can store vehicle name directly or ID
        { id: 'l2mu36niy', name: 'Type', key: 'type', type: 'select' as FieldType, required: true, options: ["Contrôle technique", "Révision", "Réparation", "Vidange", "Pneus", "Freins", "Courroie", "Autre"] },
        { id: 'ka10u8tfn', name: 'Prix', key: 'prix', type: 'number' as FieldType, required: false, unit: "€", decimals: 2 },
        { id: 'pnvkb66q6', name: 'Partenaire', key: 'partenaire', type: 'text' as FieldType, required: false },
        { id: 'yemuhf2e8', name: 'Commentaire', key: 'commentaire', type: 'text' as FieldType, required: false },
        { id: 'imp6b1xf4', name: 'Kilométrage', key: 'kilometrage', type: 'number' as FieldType, required: true, unit: "km", decimals: 1 }
      ]
    });
  }

  // 3. Existing Voiture - Carburant
  if (!colIds.includes(CARBURANTS_COL_ID)) {
    newCols.push({
      id: CARBURANTS_COL_ID,
      name: 'bq-car - carburants',
      description: 'Évolution de la consommation et du coût',
      createdAt: Date.now() + 20,
      primaryFieldKey: 'date',
      fields: [
        { id: 'l7ych2bux', name: 'Date', key: 'date', type: 'date' as FieldType, required: true },
        { id: 'qi5wkc2tx', name: 'Véhicule', key: 'vehicule', type: 'text' as FieldType, required: true },
        { id: 'rr6e1n5w5', name: 'Estimation', key: 'estimation', type: 'boolean' as FieldType, required: false },
        { id: '2sg8h5u11', name: 'Quantité', key: 'quantite', type: 'number' as FieldType, required: true, unit: "L", decimals: 2 },
        { id: 'ser32zztr', name: 'Prix', key: 'prix', type: 'number' as FieldType, required: true, unit: "€", decimals: 2 },
        { id: '18u7rqlem', name: 'Distance', key: 'distance', type: 'number' as FieldType, required: true, unit: "km", decimals: 1 },
        { id: 'jqzh0c9qr', name: 'Prix au litre', key: 'prix_au_litre', type: 'number' as FieldType, required: false, unit: "€", decimals: 3 },
        { id: 'ovzn3oml1', name: 'Consommation', key: 'consommation', type: 'number' as FieldType, required: false, unit: "L/100km", decimals: 2 },
        { id: 'dm52vpxag', name: 'Prix / 100km', key: 'prix_100km', type: 'number' as FieldType, required: false, unit: "€", decimals: 2 },
        { id: 'mdc4qun2b', name: 'Commentaire', key: 'commentaire', type: 'text' as FieldType, required: false }
      ]
    });
  }

  // 4. Suggestions inbox (transversal)
  if (!colIds.includes(SUGGESTIONS_COL_ID)) {
    newCols.push({
      id: SUGGESTIONS_COL_ID,
      name: 'bq-bank - suggestions',
      description: 'Boîte de réception pour suggestions transversales',
      createdAt: Date.now() + 30,
      primaryFieldKey: 'source_app',
      fields: [
        { id: 'f-sugsrc', name: 'Source', key: 'source_app', type: 'text' as FieldType, required: true },
        { id: 'f-sugact', name: 'Action', key: 'action', type: 'text' as FieldType, required: true },
        { id: 'f-sugpay', name: 'Contenu', key: 'payload', type: 'text' as FieldType, required: true },
        { id: 'f-sugstat', name: 'Statut', key: 'status', type: 'text' as FieldType, required: true }
      ]
    });
  }

  if (newCols.length > 0) {
    await db.collections.bulkAdd(newCols);
    console.log(`${newCols.length} collections initialisées.`);
  }

  // 5. Auto-migration of legacy vehicles to the new collection
  await performVehicleMigration();
}

export async function generateDemoData() {
  const vehiclesCount = await db.records.where('collectionId').equals(VEHICLES_COL_ID).count();
  if (vehiclesCount > 0) return;

  const now = Date.now();
  const oneDay = 24 * 3600 * 1000;

  const vehicule1_id = `rec-${Math.random().toString(36).substring(2, 11)}`;
  const vehicule2_id = `rec-${Math.random().toString(36).substring(2, 11)}`;

  const defaultVehicles: RecordEntry[] = [
    {
      id: vehicule1_id,
      collectionId: VEHICLES_COL_ID,
      data: { nom: 'Volkswagen Golf VIII', type_carburant: 'SP95', immatriculation: 'AB-123-CD', kilometrage_initial: 45000, is_active: true },
      createdAt: now,
      updatedAt: now
    },
    {
      id: vehicule2_id,
      collectionId: VEHICLES_COL_ID,
      data: { nom: 'Renault Clio V', type_carburant: 'Gazole', immatriculation: 'EF-456-GH', kilometrage_initial: 80000, is_active: true },
      createdAt: now + 10,
      updatedAt: now + 10
    }
  ];
  await db.records.bulkAdd(defaultVehicles);

  const demoRecords: RecordEntry[] = [
    // --- 5 Pleins pour Volkswagen Golf VIII ---
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: CARBURANTS_COL_ID,
      data: {
        date: new Date(now - 75 * oneDay).toISOString().split('T')[0],
        vehicule: 'Volkswagen Golf VIII',
        estimation: false,
        quantite: 41.2,
        prix: 72.10,
        distance: 620.0,
        prix_au_litre: 1.75,
        consommation: 6.65,
        prix_100km: 11.63,
        commentaire: 'Plein station autoroute'
      },
      createdAt: now + 100,
      updatedAt: now + 100
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: CARBURANTS_COL_ID,
      data: {
        date: new Date(now - 60 * oneDay).toISOString().split('T')[0],
        vehicule: 'Volkswagen Golf VIII',
        estimation: false,
        quantite: 42.0,
        prix: 71.40,
        distance: 660.0,
        prix_au_litre: 1.70,
        consommation: 6.36,
        prix_100km: 10.82,
        commentaire: 'Trajet travail quotidien'
      },
      createdAt: now + 110,
      updatedAt: now + 110
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: CARBURANTS_COL_ID,
      data: {
        date: new Date(now - 45 * oneDay).toISOString().split('T')[0],
        vehicule: 'Volkswagen Golf VIII',
        estimation: false,
        quantite: 40.8,
        prix: 69.36,
        distance: 670.0,
        prix_au_litre: 1.70,
        consommation: 6.09,
        prix_100km: 10.35,
        commentaire: 'Plein supermarché'
      },
      createdAt: now + 120,
      updatedAt: now + 120
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: CARBURANTS_COL_ID,
      data: {
        date: new Date(now - 25 * oneDay).toISOString().split('T')[0],
        vehicule: 'Volkswagen Golf VIII',
        estimation: false,
        quantite: 39.5,
        prix: 67.94,
        distance: 640.0,
        prix_au_litre: 1.72,
        consommation: 6.17,
        prix_100km: 10.62,
        commentaire: 'Retour week-end'
      },
      createdAt: now + 130,
      updatedAt: now + 130
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: CARBURANTS_COL_ID,
      data: {
        date: new Date(now - 8 * oneDay).toISOString().split('T')[0],
        vehicule: 'Volkswagen Golf VIII',
        estimation: false,
        quantite: 41.0,
        prix: 70.52,
        distance: 660.0,
        prix_au_litre: 1.72,
        consommation: 6.21,
        prix_100km: 10.68,
        commentaire: 'Plein complet avant départ'
      },
      createdAt: now + 140,
      updatedAt: now + 140
    },

    // --- 5 Entretiens pour Volkswagen Golf VIII ---
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: new Date(now - 180 * oneDay).toISOString().split('T')[0],
        vehicule: 'Volkswagen Golf VIII',
        type: 'Vidange',
        prix: 119.00,
        partenaire: 'Norauto Lyon',
        commentaire: 'Vidange huile 5W30 + filtre à huile',
        kilometrage: 42000
      },
      createdAt: now + 150,
      updatedAt: now + 150
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: new Date(now - 120 * oneDay).toISOString().split('T')[0],
        vehicule: 'Volkswagen Golf VIII',
        type: 'Pneus',
        prix: 240.00,
        partenaire: 'Euromaster',
        commentaire: 'Remplacement 2 pneus avant Michelin Primacy 4',
        kilometrage: 44500
      },
      createdAt: now + 160,
      updatedAt: now + 160
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: new Date(now - 90 * oneDay).toISOString().split('T')[0],
        vehicule: 'Volkswagen Golf VIII',
        type: 'Freins',
        prix: 165.00,
        partenaire: 'Garage VW Saint-Étienne',
        commentaire: 'Changement des plaquettes de frein avant',
        kilometrage: 45200
      },
      createdAt: now + 170,
      updatedAt: now + 170
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: new Date(now - 40 * oneDay).toISOString().split('T')[0],
        vehicule: 'Volkswagen Golf VIII',
        type: 'Climatisation',
        prix: 79.00,
        partenaire: 'Midas',
        commentaire: 'Recharge gaz clim + filtre habitacle anti-allergène',
        kilometrage: 47100
      },
      createdAt: now + 180,
      updatedAt: now + 180
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: new Date(now - 15 * oneDay).toISOString().split('T')[0],
        vehicule: 'Volkswagen Golf VIII',
        type: 'Contrôle technique',
        prix: 85.00,
        partenaire: 'Autovision',
        commentaire: 'Contrôle technique périodique vierge - RAS',
        kilometrage: 48000
      },
      createdAt: now + 190,
      updatedAt: now + 190
    },

    // --- 5 Pleins pour Renault Clio V ---
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: CARBURANTS_COL_ID,
      data: {
        date: new Date(now - 80 * oneDay).toISOString().split('T')[0],
        vehicule: 'Renault Clio V',
        estimation: false,
        quantite: 38.5,
        prix: 63.53,
        distance: 750.0,
        prix_au_litre: 1.65,
        consommation: 5.13,
        prix_100km: 8.47,
        commentaire: 'Plein station Total'
      },
      createdAt: now + 200,
      updatedAt: now + 200
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: CARBURANTS_COL_ID,
      data: {
        date: new Date(now - 62 * oneDay).toISOString().split('T')[0],
        vehicule: 'Renault Clio V',
        estimation: false,
        quantite: 41.0,
        prix: 67.24,
        distance: 830.0,
        prix_au_litre: 1.64,
        consommation: 4.94,
        prix_100km: 8.10,
        commentaire: 'Trajets mixtes voie rapide'
      },
      createdAt: now + 210,
      updatedAt: now + 210
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: CARBURANTS_COL_ID,
      data: {
        date: new Date(now - 44 * oneDay).toISOString().split('T')[0],
        vehicule: 'Renault Clio V',
        estimation: false,
        quantite: 39.8,
        prix: 64.48,
        distance: 810.0,
        prix_au_litre: 1.62,
        consommation: 4.91,
        prix_100km: 7.96,
        commentaire: 'Plein station Leclerc'
      },
      createdAt: now + 220,
      updatedAt: now + 220
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: CARBURANTS_COL_ID,
      data: {
        date: new Date(now - 28 * oneDay).toISOString().split('T')[0],
        vehicule: 'Renault Clio V',
        estimation: false,
        quantite: 40.5,
        prix: 66.83,
        distance: 830.0,
        prix_au_litre: 1.65,
        consommation: 4.88,
        prix_100km: 8.05,
        commentaire: 'Trajet vacances'
      },
      createdAt: now + 230,
      updatedAt: now + 230
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: CARBURANTS_COL_ID,
      data: {
        date: new Date(now - 10 * oneDay).toISOString().split('T')[0],
        vehicule: 'Renault Clio V',
        estimation: false,
        quantite: 41.2,
        prix: 68.39,
        distance: 830.0,
        prix_au_litre: 1.66,
        consommation: 4.96,
        prix_100km: 8.24,
        commentaire: 'Plein habituel'
      },
      createdAt: now + 240,
      updatedAt: now + 240
    },

    // --- 5 Entretiens pour Renault Clio V ---
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: new Date(now - 210 * oneDay).toISOString().split('T')[0],
        vehicule: 'Renault Clio V',
        type: 'Courroie',
        prix: 580.00,
        partenaire: 'Garage Renault Minute',
        commentaire: 'Kit distribution + pompe à eau',
        kilometrage: 75000
      },
      createdAt: now + 250,
      updatedAt: now + 250
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: new Date(now - 150 * oneDay).toISOString().split('T')[0],
        vehicule: 'Renault Clio V',
        type: 'Vidange',
        prix: 130.00,
        partenaire: 'Renault Service',
        commentaire: 'Vidange synthèse + filtre huile et filtre gazole',
        kilometrage: 79500
      },
      createdAt: now + 260,
      updatedAt: now + 260
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: new Date(now - 100 * oneDay).toISOString().split('T')[0],
        vehicule: 'Renault Clio V',
        type: 'Batterie',
        prix: 145.00,
        partenaire: 'Feu Vert',
        commentaire: 'Remplacement batterie Start & Stop 70Ah',
        kilometrage: 80500
      },
      createdAt: now + 270,
      updatedAt: now + 270
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: new Date(now - 50 * oneDay).toISOString().split('T')[0],
        vehicule: 'Renault Clio V',
        type: 'Bougies',
        prix: 110.00,
        partenaire: 'Garage de la Gare',
        commentaire: 'Remplacement 4 bougies de préchauffage',
        kilometrage: 82000
      },
      createdAt: now + 280,
      updatedAt: now + 280
    },
    {
      id: `rec-${Math.random().toString(36).substring(2, 11)}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: new Date(now - 20 * oneDay).toISOString().split('T')[0],
        vehicule: 'Renault Clio V',
        type: 'Révision',
        prix: 195.00,
        partenaire: 'Renault',
        commentaire: 'Révision intermédiaire des 80000 km, purge liquide de frein',
        kilometrage: 83500
      },
      createdAt: now + 290,
      updatedAt: now + 290
    }
  ];

  await db.records.bulkAdd(demoRecords);
  console.log('Seeded vehicles and demo records (5 fuel + 5 maint per vehicle).');

  console.log('Seeded vehicles and demo records.');
}

/**
 * Extract vehicle strings from old records and register them in the new Véhicules collection.
 */
export async function performVehicleMigration() {
  try {
    const vehiclesCount = await db.records.where('collectionId').equals(VEHICLES_COL_ID).count();
    if (vehiclesCount > 0) return; // Already migrated/populated

    const carburants = await db.records.where('collectionId').equals(CARBURANTS_COL_ID).toArray();
    const entretiens = await db.records.where('collectionId').equals(ENTRETIENS_COL_ID).toArray();

    // Get unique vehicles from records
    const vehicleNames = new Set<string>();
    carburants.forEach(r => { if (r.data.vehicule) vehicleNames.add(String(r.data.vehicule).trim()); });
    entretiens.forEach(r => { if (r.data.vehicule) vehicleNames.add(String(r.data.vehicule).trim()); });

    if (vehicleNames.size === 0) {
      return;
    }

    // Otherwise, create vehicles from found names
    const newVehicles: RecordEntry[] = [];
    let idx = 0;
    for (const name of vehicleNames) {
      let carbType = 'SP95';
      if (name.toLowerCase().includes('dci') || name.toLowerCase().includes('hdi') || name.toLowerCase().includes('308')) {
        carbType = 'Gazole';
      }

      newVehicles.push({
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: VEHICLES_COL_ID,
        data: {
          nom: name,
          type_carburant: carbType,
          immatriculation: '',
          kilometrage_initial: 0,
          is_active: true
        },
        createdAt: Date.now() + idx * 10,
        updatedAt: Date.now() + idx * 10
      });
      idx++;
    }

    await db.records.bulkAdd(newVehicles);
    console.log(`Migrated ${newVehicles.length} vehicles from legacy records.`);
  } catch (err) {
    console.error('Error in performVehicleMigration:', err);
  }
}

/**
 * Fetch active vehicles
 */
export async function getVehiclesRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(VEHICLES_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const valA = String(a.data.nom || '').trim();
    const valB = String(b.data.nom || '').trim();
    return valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
  });
}

/**
 * Fetch all fuel records
 */
export async function getCarburantRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(CARBURANTS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
}

/**
 * Fetch all maintenance records
 */
export async function getEntretienRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(ENTRETIENS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
}

/**
 * Computes current mileage of a vehicle by adding fuel fillup distances to the initial mileage,
 * while maintaining a safety check against any higher absolute mileage entered in maintenance or fuel events.
 */
export function calculateCurrentMileage(vehicleName: string, initialKm: number, allCarburants: RecordEntry[], allEntretiens: RecordEntry[]): number {
  let totalFuelKm = 0;
  const vehicleCarburants = allCarburants.filter(c => String(c.data.vehicule).trim() === vehicleName.trim());
  vehicleCarburants.forEach(c => {
    totalFuelKm += Number(c.data.distance) || 0;
  });

  let maxKm = initialKm + totalFuelKm;

  // Check if any absolute mileage in maintenance is higher (safety net)
  const vehicleEntretiens = allEntretiens.filter(e => String(e.data.vehicule).trim() === vehicleName.trim());
  vehicleEntretiens.forEach(e => {
    const km = Number(e.data.kilometrage) || 0;
    if (km > maxKm) maxKm = km;
  });

  // Check if any absolute mileage in fuel is higher (safety net)
  vehicleCarburants.forEach(c => {
    const km = Number(c.data.kilometrage) || 0;
    if (km > maxKm) maxKm = km;
  });

  return maxKm;
}
