import { db, type RecordEntry, type CollectionSchema, type FieldType } from './index';

// Collection IDs
export const VACCINS_COL_ID = 'col-7lp7tols4';     // Santé - Vaccins
export const RDVS_COL_ID = 'col-99i4k236h';        // Rendez-vous
export const PRESC_COL_ID = 'col-r4w9k2p7e';       // Traitements / Ordonnances
export const METRICS_COL_ID = 'col-h2n6v8b3m';     // Mensurations / Poids
export const SUGGESTIONS_COL_ID = 'col-9w4b1v8zp';  // Inbox Suggestions (bq-bank)

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
 * Initialize Dexie collections for bq-health.
 */
export async function initializeCollections() {
  const existingCols = await db.collections.toArray();
  const colIds = existingCols.map(c => c.id);

  const newCols: CollectionSchema[] = [];

  // 1. Existing Santé - Vaccins
  if (!colIds.includes(VACCINS_COL_ID)) {
    newCols.push({
      id: VACCINS_COL_ID,
      name: 'bq-health - vaccins',
      description: 'Suivi et historique de vaccination',
      createdAt: Date.now(),
      primaryFieldKey: 'date',
      fields: [
        { id: 'f-vdate', name: 'Date', key: 'date', type: 'date' as FieldType, required: true },
        { id: 'f-vtype', name: 'Type', key: 'type', type: 'select' as FieldType, required: true, options: ["BCG", "DTCaP", "Hépatite B", "ROR", "Méningocoque C", "Varicelle", "Test tuberculinique", "HPV", "Grippe", "Covid-19", "Autre"] },
        { id: 'f-vname', name: 'Vaccin', key: 'vaccin', type: 'text' as FieldType, required: true },
        { id: 'f-vstat', name: 'Statut', key: 'statut', type: 'select' as FieldType, required: true, options: ["Fait", "À faire / Rappel"] },
        { id: 'f-vrap', name: 'Prochain rappel', key: 'prochain_rappel', type: 'date' as FieldType, required: false }
      ]
    });
  }

  // 2. New Rendez-vous Collection
  if (!colIds.includes(RDVS_COL_ID)) {
    newCols.push({
      id: RDVS_COL_ID,
      name: 'bq-health - rendez-vous',
      description: 'Agenda de mes consultations médicales',
      createdAt: Date.now() + 10,
      primaryFieldKey: 'date',
      fields: [
        { id: 'f-rdate', name: 'Date', key: 'date', type: 'date' as FieldType, required: true },
        { id: 'f-rtime', name: 'Heure', key: 'heure', type: 'text' as FieldType, required: false },
        { id: 'f-rdoctor', name: 'Praticien', key: 'praticien', type: 'text' as FieldType, required: true },
        { id: 'f-rspec', name: 'Spécialité', key: 'specialite', type: 'select' as FieldType, required: true, options: ["Généraliste", "Dentiste", "Ophtalmologue", "Dermatologue", "Kinesithérapeute", "Ostéopathe", "Cardiologue", "Autre Spécialiste"] },
        { id: 'f-rmotif', name: 'Motif', key: 'motif', type: 'text' as FieldType, required: false },
        { id: 'f-rprice', name: 'Prix', key: 'prix', type: 'number' as FieldType, required: false, unit: "€", decimals: 2 },
        { id: 'f-rnotes', name: 'Notes', key: 'notes', type: 'text' as FieldType, required: false }
      ]
    });
  }

  // 3. New Prescriptions / Treatments Collection
  if (!colIds.includes(PRESC_COL_ID)) {
    newCols.push({
      id: PRESC_COL_ID,
      name: 'bq-health - traitements & ordonnances',
      description: 'Suivi de mes ordonnances et pilules',
      createdAt: Date.now() + 20,
      primaryFieldKey: 'nom_medicament',
      fields: [
        { id: 'f-pmed', name: 'Médicament', key: 'nom_medicament', type: 'text' as FieldType, required: true },
        { id: 'f-pposo', name: 'Posologie', key: 'posologie', type: 'text' as FieldType, required: true },
        { id: 'f-pstart', name: 'Date début', key: 'date_debut', type: 'date' as FieldType, required: true },
        { id: 'f-pend', name: 'Date fin', key: 'date_fin', type: 'date' as FieldType, required: false },
        { id: 'f-pactive', name: 'En cours', key: 'actif', type: 'boolean' as FieldType, required: true },
        { id: 'f-pdoc', name: 'Prescripteur', key: 'medecin_prescripteur', type: 'text' as FieldType, required: false }
      ]
    });
  }

  // 4. New Weight / Body Metrics Collection
  if (!colIds.includes(METRICS_COL_ID)) {
    newCols.push({
      id: METRICS_COL_ID,
      name: 'bq-health - mensurations',
      description: 'Suivi corporel anthropométrique',
      createdAt: Date.now() + 30,
      primaryFieldKey: 'date',
      fields: [
        { id: 'f-mdate', name: 'Date', key: 'date', type: 'date' as FieldType, required: true },
        { id: 'f-mweight', name: 'Poids', key: 'poids', type: 'number' as FieldType, required: true, unit: "kg", decimals: 1 },
        { id: 'f-mheight', name: 'Taille', key: 'taille', type: 'number' as FieldType, required: false, unit: "cm", decimals: 1 },
        { id: 'f-mwaist', name: 'Tour de taille', key: 'tour_taille', type: 'number' as FieldType, required: false, unit: "cm", decimals: 1 },
        { id: 'f-mshoulders', name: 'Tour d\'épaules', key: 'tour_epaules', type: 'number' as FieldType, required: false, unit: "cm", decimals: 1 },
        { id: 'f-mchest', name: 'Tour de poitrine', key: 'tour_poitrine', type: 'number' as FieldType, required: false, unit: "cm", decimals: 1 },
        { id: 'f-mthigh', name: 'Tour de cuisse', key: 'tour_cuisses', type: 'number' as FieldType, required: false, unit: "cm", decimals: 1 }
      ]
    });
  }

  // 5. Suggestions Inbox Collection (Transversal)
  if (!colIds.includes(SUGGESTIONS_COL_ID)) {
    newCols.push({
      id: SUGGESTIONS_COL_ID,
      name: 'bq-bank - suggestions',
      description: 'Boîte de réception pour suggestions transversales',
      createdAt: Date.now() + 40,
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
}

/**
 * Seeds a few standard French vaccine recommendations if collection is empty
 */
export async function seedDefaultVaccinesIfEmpty() {
  try {
    const count = await db.records.where('collectionId').equals(VACCINS_COL_ID).count();
    if (count > 0) return;

    const defaultVaccines: RecordEntry[] = [
      {
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: VACCINS_COL_ID,
        data: {
          date: '2026-01-15',
          type: 'DTCaP',
          vaccin: 'Repevax (Rappel)',
          statut: 'Fait',
          prochain_rappel: '2036-01-15'
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: VACCINS_COL_ID,
        data: {
          date: '2026-09-03',
          type: 'Méningocoque C',
          vaccin: 'Neisvac',
          statut: 'À faire / Rappel',
          prochain_rappel: ''
        },
        createdAt: Date.now() + 10,
        updatedAt: Date.now() + 10
      }
    ];

    await db.records.bulkAdd(defaultVaccines);
    console.log('Seeded default vaccines.');
  } catch (err) {
    console.error('Error seeding default vaccines:', err);
  }
}

/**
 * Getters
 */
export async function getVaccinsRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(VACCINS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
}

export async function getRdvsRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(RDVS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
}

export async function getPrescRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(PRESC_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date_debut || '').localeCompare(String(a.data.date_debut || ''));
  });
}

export async function getMetricsRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(METRICS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
}
