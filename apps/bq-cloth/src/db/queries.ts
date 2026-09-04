import { db, type RecordEntry, type CollectionSchema, type FieldType } from './index';

// Collection IDs matching bq-metrics exactly for seamless synchronization!
export const CLOTHES_COL_ID = 'col-41w5uphny'; // Inventaire - Vêtements
export const TENUES_COL_ID = 'col-cj7vz5e37';  // Tenues
export const LESSIVES_COL_ID = 'col-lessives';  // Lessives (Nouvelle collection)
export const TENUES_TYPES_COL_ID = 'col-tenues-types'; // Tenues Types (Nouvelle collection)

/**
 * Format a YYYY-MM-DD date into DD/MM/YYYY French format
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
 * Ensures that the required collections exist in the database.
 */
export async function initializeCollections() {
  const existingCols = await db.collections.toArray();
  const colIds = existingCols.map(c => c.id);

  const newCols: CollectionSchema[] = [];

  if (!colIds.includes(CLOTHES_COL_ID)) {
    newCols.push({
      id: CLOTHES_COL_ID,
      name: 'Inventaire - Vêtements',
      description: 'Gestion du dressing',
      createdAt: Date.now(),
      primaryFieldKey: 'nom',
      fields: [
        { id: 'f-nom', name: 'Nom', key: 'nom', type: 'text' as FieldType, required: true },
        { id: 'f-cat', name: 'Catégorie', key: 'categorie', type: 'select' as FieldType, required: true, options: ["T-shirt", "Chemise", "Pull", "Chino", "Jean", "Short", "Veste", "Manteau", "Chaussures", "Accessoire"] },
        { id: 'f-couleur', name: 'Couleur', key: 'couleur', type: 'text' as FieldType, required: false },
        { id: 'f-marque', name: 'Marque', key: 'marque', type: 'text' as FieldType, required: false },
        { id: 'f-taille', name: 'Taille', key: 'taille', type: 'text' as FieldType, required: false },
        { id: 'f-matiere', name: 'Matière', key: 'matiere', type: 'text' as FieldType, required: false },
        { id: 'f-dispo', name: 'Disponible', key: 'is_available', type: 'boolean' as FieldType, required: false },
        { id: 'f-saison', name: 'Saison/Météo', key: 'saison', type: 'tags' as FieldType, required: false }
      ]
    });
  }

  if (!colIds.includes(TENUES_COL_ID)) {
    newCols.push({
      id: TENUES_COL_ID,
      name: 'Tenues',
      description: 'Suivi des tenues portées',
      createdAt: Date.now() + 10,
      primaryFieldKey: 'date',
      fields: [
        { id: 'f-date', name: 'Date', key: 'date', type: 'date' as FieldType, required: true },
        { id: 'f-vportes', name: 'Vêtements portés', key: 'vetements_portes', type: 'relation' as FieldType, required: false, relatedCollectionId: CLOTHES_COL_ID, isMultiple: true },
        { id: 'f-ctx', name: 'Contexte', key: 'contexte', type: 'text' as FieldType, required: false },
        { id: 'f-entourage', name: 'Entourage croisé', key: 'entourage_croise', type: 'tags' as FieldType, required: false }
      ]
    });
  }

  if (!colIds.includes(LESSIVES_COL_ID)) {
    newCols.push({
      id: LESSIVES_COL_ID,
      name: 'Lessives',
      description: 'Historique des lessives effectuées',
      createdAt: Date.now() + 20,
      primaryFieldKey: 'date',
      fields: [
        { id: 'f-ldate', name: 'Date', key: 'date', type: 'date' as FieldType, required: true },
        { id: 'f-vlaves', name: 'Vêtements lavés', key: 'vetements_laves', type: 'relation' as FieldType, required: false, relatedCollectionId: CLOTHES_COL_ID, isMultiple: true }
      ]
    });
  }

  if (!colIds.includes(TENUES_TYPES_COL_ID)) {
    newCols.push({
      id: TENUES_TYPES_COL_ID,
      name: 'Tenues Types',
      description: 'Associations favorites de vêtements',
      createdAt: Date.now() + 30,
      primaryFieldKey: 'nom',
      fields: [
        { id: 'f-ttnom', name: 'Nom de la tenue', key: 'nom', type: 'text' as FieldType, required: true },
        { id: 'f-ttassoc', name: 'Vêtements associés', key: 'vetements_associes', type: 'relation' as FieldType, required: true, relatedCollectionId: CLOTHES_COL_ID, isMultiple: true },
        { id: 'f-ttctx', name: 'Contexte d\'usage', key: 'contexte', type: 'text' as FieldType, required: false },
        { id: 'f-tttemp', name: 'Température idéale', key: 'temperature_ideale', type: 'number' as FieldType, required: false }
      ]
    });
  }

  if (newCols.length > 0) {
    await db.collections.bulkAdd(newCols);
    console.log(`${newCols.length} collections initialisées.`);
  }
}

/**
 * Fetch all clothing records
 */
export async function getClothesRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(CLOTHES_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const valA = String(a.data.nom || '').trim();
    const valB = String(b.data.nom || '').trim();
    return valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
  });
}

/**
 * Fetch all outfit records
 */
export async function getTenuesRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(TENUES_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
}

/**
 * Fetch all laundry records
 */
export async function getLessivesRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(LESSIVES_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
}

/**
 * Fetch all typical outfit template records
 */
export async function getTenuesTypesRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(TENUES_TYPES_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const valA = String(a.data.nom || '').trim();
    const valB = String(b.data.nom || '').trim();
    return valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
  });
}

/**
 * Computes dynamic statistics for a single garment.
 * Returns:
 * - count: number of times worn since last wash
 * - lastWornDate: ISO string date of last use, or ""
 * - lastWashDate: ISO string date of last wash, or ""
 */
export function calculateGarmentStats(
  garmentId: string, 
  allTenues: RecordEntry[], 
  allLessives: RecordEntry[]
) {
  // Find all laundry events for this garment
  const garmentLessives = allLessives.filter(l => {
    const vLaves = l.data.vetements_laves || [];
    return vLaves.includes(garmentId);
  });

  // Find latest wash date
  let lastWashDate = '';
  if (garmentLessives.length > 0) {
    // Dates are sorted desc, so first is latest if getLessivesRecords is sorted desc
    lastWashDate = garmentLessives[0].data.date || '';
  }

  // Find all times worn
  const garmentTenues = allTenues.filter(t => {
    const vPortes = t.data.vetements_portes || [];
    return vPortes.includes(garmentId);
  });

  let lastWornDate = '';
  if (garmentTenues.length > 0) {
    lastWornDate = garmentTenues[0].data.date || '';
  }

  // Count wears since last wash
  let wearsCount = 0;
  if (lastWashDate) {
    wearsCount = garmentTenues.filter(t => (t.data.date || '') > lastWashDate).length;
  } else {
    wearsCount = garmentTenues.length;
  }

  return {
    wearsCount,
    lastWornDate,
    lastWashDate
  };
}

/**
 * Runs automated drying delayed availability logic.
 * Check any unavailable garments, compare current timestamp with their latest laundry event.
 * If elapsed hours > dryingDelay, automatically set them as available.
 */
export async function checkAutomatedDryingAvailability() {
  try {
    const dryingDelayHours = Number(localStorage.getItem('bq-cloth-drying-delay') || '24');
    const clothes = await getClothesRecords();
    const unavailableGarments = clothes.filter(c => c.data.is_available === false || c.data.is_available === undefined);

    if (unavailableGarments.length === 0) return;

    const lessives = await getLessivesRecords();
    const now = Date.now();
    const delayMs = dryingDelayHours * 3600 * 1000;

    for (const garment of unavailableGarments) {
      const garmentId = garment.id!;
      const garmentLessives = lessives.filter(l => {
        const vLaves = l.data.vetements_laves || [];
        return vLaves.includes(garmentId);
      });

      if (garmentLessives.length > 0) {
        const latestLaundry = garmentLessives[0];
        const laundryTime = latestLaundry.createdAt || new Date(latestLaundry.data.date).getTime();
        
        if (now - laundryTime >= delayMs) {
          // Auto update to available!
          garment.data.is_available = true;
          garment.updatedAt = now;
          await db.records.put(garment);
          console.log(`Auto-activated garment availability after drying: ${garment.data.nom}`);
        }
      }
    }
  } catch (err) {
    console.error('Error in checkAutomatedDryingAvailability:', err);
  }
}
