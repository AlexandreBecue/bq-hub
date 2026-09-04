import { db, type RecordEntry, type CollectionSchema, type FieldType } from './index';

// Collection IDs
export const VEHICLES_COL_ID = 'col-q8m4x2v9k';   // Véhicules (Nouvelle collection)
export const ENTRETIENS_COL_ID = 'col-344y1kegd'; // Voiture - Entretien (Existant)
export const CARBURANTS_COL_ID = 'col-n37im2z5e'; // Voiture - Carburant (Existant)
export const SUGGESTIONS_COL_ID = 'col-1nb0x-sug'; // Inbox Suggestions (Transversal)

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
      name: 'Véhicules',
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
      name: 'Voiture - Entretien',
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
      name: 'Voiture - Carburant',
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
      name: 'Inbox / Suggestions',
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
      // Seed default vehicles if no records exist at all
      const defaultVehicles: RecordEntry[] = [
        {
          id: `rec-${Math.random().toString(36).substring(2, 11)}`,
          collectionId: VEHICLES_COL_ID,
          data: { nom: '308 SW', type_carburant: 'Gazole', immatriculation: '', kilometrage_initial: 0, is_active: true },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: `rec-${Math.random().toString(36).substring(2, 11)}`,
          collectionId: VEHICLES_COL_ID,
          data: { nom: 'Twingo', type_carburant: 'SP95', immatriculation: '', kilometrage_initial: 0, is_active: true },
          createdAt: Date.now() + 10,
          updatedAt: Date.now() + 10
        }
      ];
      await db.records.bulkAdd(defaultVehicles);
      console.log('Seeded default vehicles.');
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
 * Computes current mileage of a vehicle by looking at the maximum mileage 
 * found in fuel fillups or maintenance events. If none found, returns the kilometrage_initial.
 */
export function calculateCurrentMileage(vehicleName: string, initialKm: number, allCarburants: RecordEntry[], allEntretiens: RecordEntry[]): number {
  let maxKm = initialKm;

  // Check fuel fillups (legacy or active)
  // Wait, in Voiture - Carburant, there is no direct kilometrage field, but wait! 
  // Let's check if the legacy backup had a kilometrage field or if mileage was only tracked in Entretien.
  // Actually, Voiture - Entretien has a "kilometrage" field.
  // Do fuel records have a cumulative mileage?
  // Let's check Voiture - Carburant fields in the backup. It has "distance" but no "kilometrage" field.
  // But wait! We can add a "kilometrage" field in the new Carburant form! Yes, it's very useful to track the current odometer reading.
  // But for existing data, we look at Voiture - Entretien's "kilometrage" field.
  const vehicleEntretiens = allEntretiens.filter(e => String(e.data.vehicule).trim() === vehicleName.trim());
  vehicleEntretiens.forEach(e => {
    const km = Number(e.data.kilometrage) || 0;
    if (km > maxKm) maxKm = km;
  });

  // Let's also check if carburant records have kilometrage (just in case they are added in our new form)
  const vehicleCarburants = allCarburants.filter(c => String(c.data.vehicule).trim() === vehicleName.trim());
  vehicleCarburants.forEach(c => {
    const km = Number(c.data.kilometrage) || 0;
    if (km > maxKm) maxKm = km;
  });

  return maxKm;
}
