import { 
  BQDatabase, 
  dbStatus, 
  exportDatabase as _exportDatabase,
  generateId as _generateId
} from '@bq/db-sync';
import { evaluateFormula } from './queries';

export type { 
  DBStatus, 
  FieldType, 
  FieldConfig, 
  CollectionSchema, 
  RecordEntry, 
  SavedFilter, 
  SavedView, 
  RecordTemplate 
} from '@bq/db-sync';

// BQMetrics Offline-First Dexie Database extending the generic BQDatabase
export class BQMetricsDatabase extends BQDatabase {
  constructor() {
    super('BQMetricsDatabase');
  }
}

export const db = new BQMetricsDatabase();
export { dbStatus };

// Helper to generate unique IDs
export function generateId(): string {
  return _generateId();
}

// Wrapped compatibility helper for Export
export async function exportDatabase(collectionIds?: string[]): Promise<string> {
  return _exportDatabase(db, collectionIds);
}

export interface ImportResult {
  success: boolean;
  error?: string;
  merged?: boolean;
}

export async function importDatabase(jsonString: string): Promise<ImportResult> {
  dbStatus.value = 'loading';
  try {
    let backup: any;
    try {
      backup = JSON.parse(jsonString);
    } catch (e) {
      dbStatus.value = 'ready';
      return { success: false, error: 'JSON malformé : Vérifie que le fichier a bien été copié en entier.' };
    }

    const collections = backup.collections || [];
    const records = backup.records || [];
    const views = backup.views || [];
    const templates = backup.templates || [];

    if (!Array.isArray(collections) || !Array.isArray(records) || !Array.isArray(views) || !Array.isArray(templates)) {
      dbStatus.value = 'ready';
      return { success: false, error: 'Structure invalide : collections, records, views et templates doivent être des listes.' };
    }

    if (collections.length === 0 && records.length === 0) {
      dbStatus.value = 'ready';
      return { success: false, error: 'Aucune donnée (modèle ou ligne) trouvée dans le fichier.' };
    }

    // Smart Merge (Fusion intelligente) : Upsert collections/views and append records
    await db.transaction('rw', [db.collections, db.records, db.views, db.templates], async () => {
      // 1. Upsert collections
      for (const col of collections) {
        await db.collections.put(col);
      }
      
      // 2. Append records with safe unique IDs
      for (const rec of records) {
        const col = collections.find((c: any) => c.id === rec.collectionId);
        if (col) {
          col.fields.forEach((f: any) => {
            if (f.type === 'boolean') {
              const val = rec.data[f.key];
              if (typeof val === 'string') {
                rec.data[f.key] = (val.toUpperCase() === 'TRUE');
              }
            }
          });

          col.fields.forEach((f: any) => {
            if (f.isCalculated && f.formula) {
              const val = rec.data[f.key];
              if (val === undefined || val === null || val === '') {
                const computedVal = evaluateFormula(f.formula, rec.data);
                if (computedVal !== undefined && computedVal !== null && computedVal !== '') {
                  rec.data[f.key] = computedVal;
                }
              }
            }
          });
        }

        if (rec.id) {
          const existing = await db.records.get(rec.id);
          if (existing) {
            rec.id = `rec-${generateId()}`;
          }
        } else {
          rec.id = `rec-${generateId()}`;
        }
        await db.records.put(rec);
      }
      
      // 3. Upsert saved views
      for (const view of views) {
        await db.views.put(view);
      }

      // 4. Upsert templates
      for (const temp of templates) {
        await db.templates.put(temp);
      }
    });

    dbStatus.value = 'ready';
    return { success: true, merged: true };
  } catch (err: any) {
    dbStatus.value = 'error';
    console.error('Erreur lors de l\'importation de la base de données:', err);
    return { success: false, error: err.message || 'Erreur d\'écriture de la base de données' };
  }
}

// --- Seed Data Helper ---
export async function seedDatabaseIfEmpty() {
  const count = await db.collections.count();
  if (count > 0) return; // DB already seeded

  dbStatus.value = 'loading';
  console.log('Database empty, seeding default collections and records...');

  // 1. Seed Collection: Consommation Gazole
  const fuelCollectionId = 'col-gazole';
  const fuelCollection: any = {
    id: fuelCollectionId,
    name: 'Consommation Gazole',
    description: 'Suivi de la consommation de carburant de ma voiture',
    createdAt: Date.now(),
    primaryFieldKey: 'date',
    fields: [
      { id: 'f-date', name: 'Date', key: 'date', type: 'date', required: true },
      { id: 'f-price-l', name: 'Prix au Litre (€)', key: 'price_per_l', type: 'number', required: true },
      { id: 'f-total-price', name: 'Montant total (€)', key: 'total_price', type: 'number', required: true },
      { id: 'f-mileage', name: 'Kilométrage (km)', key: 'mileage', type: 'number', required: true },
      { id: 'f-full', name: 'Plein complet', key: 'full_tank', type: 'boolean', required: false },
      { id: 'f-tags', name: 'Tags', key: 'tags', type: 'tags', required: false }
    ]
  };

  // 2. Seed Collection: Jeux de Société
  const boardGamesId = 'col-jeux-societe';
  const boardGamesCollection: any = {
    id: boardGamesId,
    name: 'Jeux de Société',
    description: 'Collection de jeux de société et configurations de joueurs',
    createdAt: Date.now() - 1000,
    primaryFieldKey: 'title',
    fields: [
      { id: 'bg-title', name: 'Titre', key: 'title', type: 'text', required: true },
      { id: 'bg-min-players', name: 'Joueurs Min', key: 'min_players', type: 'number', required: true },
      { id: 'bg-max-players', name: 'Joueurs Max', key: 'max_players', type: 'number', required: true },
      { id: 'bg-playtime', name: 'Durée moyenne (min)', key: 'playtime', type: 'number', required: false },
      { id: 'bg-difficulty', name: 'Difficulté', key: 'difficulty', type: 'select', required: false, options: ['Facile', 'Moyen', 'Expert'] },
      { id: 'bg-tags', name: 'Mécaniques / Tags', key: 'tags', type: 'tags', required: false }
    ]
  };

  // 3. Seed Collection: Dépenses Voiture
  const carExpensesId = 'col-depenses-voiture';
  const carExpensesCollection: any = {
    id: carExpensesId,
    name: 'Dépenses Voiture',
    description: 'Suivi des frais annexes liés aux voitures (assurance, entretien, gazole, etc.)',
    createdAt: Date.now() - 2000,
    primaryFieldKey: 'description',
    fields: [
      { id: 'ce-date', name: 'Date', key: 'date', type: 'date', required: true },
      { id: 'ce-desc', name: 'Description', key: 'description', type: 'text', required: true },
      { id: 'ce-category', name: 'Catégorie', key: 'category', type: 'select', required: true, options: ['Entretien', 'Assurance', 'Péage/Parking', 'Carburant', 'Autre'] },
      { id: 'ce-amount', name: 'Montant (€)', key: 'amount', type: 'number', required: true }
    ]
  };

  await db.collections.bulkAdd([fuelCollection, boardGamesCollection, carExpensesCollection]);

  // Seed Records
  const records: any[] = [
    // Fuel Records
    {
      collectionId: fuelCollectionId,
      createdAt: Date.now() - 30 * 24 * 3600 * 1000,
      updatedAt: Date.now() - 30 * 24 * 3600 * 1000,
      data: {
        date: '2026-05-01',
        price_per_l: 1.82,
        total_price: 81.9,
        mileage: 142350,
        full_tank: true,
        tags: ['Gazole', 'Total']
      }
    },
    {
      collectionId: fuelCollectionId,
      createdAt: Date.now() - 15 * 24 * 3600 * 1000,
      updatedAt: Date.now() - 15 * 24 * 3600 * 1000,
      data: {
        date: '2026-05-16',
        price_per_l: 1.79,
        total_price: 78.76,
        mileage: 143120,
        full_tank: true,
        tags: ['Gazole', 'Carrefour']
      }
    },
    {
      collectionId: fuelCollectionId,
      createdAt: Date.now() - 2 * 24 * 3600 * 1000,
      updatedAt: Date.now() - 2 * 24 * 3600 * 1000,
      data: {
        date: '2026-05-30',
        price_per_l: 1.81,
        total_price: 83.26,
        mileage: 143910,
        full_tank: true,
        tags: ['Gazole', 'Total']
      }
    },

    // Board Games Records
    {
      collectionId: boardGamesId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: {
        title: '7 Wonders Duo',
        min_players: 2,
        max_players: 2,
        playtime: 30,
        difficulty: 'Moyen',
        tags: ['Cartes', 'Draft', 'Stratégie', '2 joueurs']
      }
    },
    {
      collectionId: boardGamesId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: {
        title: 'Carcassonne',
        min_players: 2,
        max_players: 5,
        playtime: 45,
        difficulty: 'Facile',
        tags: ['Tuiles', 'Meeples', 'Familial']
      }
    },
    {
      collectionId: boardGamesId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: {
        title: 'Terraforming Mars',
        min_players: 1,
        max_players: 5,
        playtime: 120,
        difficulty: 'Expert',
        tags: ['Espace', 'Cartes', 'Gestion de ressources']
      }
    },

    // Car Expenses Records
    {
      collectionId: carExpensesId,
      createdAt: Date.now() - 28 * 24 * 3600 * 1000,
      updatedAt: Date.now() - 28 * 24 * 3600 * 1000,
      data: {
        date: '2026-05-03',
        description: 'Assurance mensuelle',
        category: 'Assurance',
        amount: 54.90
      }
    },
    {
      collectionId: carExpensesId,
      createdAt: Date.now() - 12 * 24 * 3600 * 1000,
      updatedAt: Date.now() - 12 * 24 * 3600 * 1000,
      data: {
        date: '2026-05-18',
        description: 'Plein Gazole Carrefour',
        category: 'Carburant',
        amount: 78.76
      }
    },
    {
      collectionId: carExpensesId,
      createdAt: Date.now() - 5 * 24 * 3600 * 1000,
      updatedAt: Date.now() - 5 * 24 * 3600 * 1000,
      data: {
        date: '2026-05-25',
        description: 'Remplacement Essuie-glaces',
        category: 'Entretien',
        amount: 34.50
      }
    }
  ];

  for (const rec of records) {
    await db.records.add(rec);
  }

  // Seed default saved views
  const views: any[] = [
    {
      id: 'view-games-3',
      collectionId: boardGamesId,
      name: 'Jeux jouables à 3',
      logicalOperator: 'and',
      createdAt: Date.now(),
      filters: [
        { fieldKey: 'min_players', operator: 'lte', value: 3 },
        { fieldKey: 'max_players', operator: 'gte', value: 3 }
      ],
      chartType: 'none'
    },
    {
      id: 'view-car-expenses-pie',
      collectionId: carExpensesId,
      name: 'Répartition des dépenses de voiture',
      logicalOperator: 'and',
      createdAt: Date.now() - 500,
      filters: [],
      chartType: 'pie',
      chartConfig: {
        xAxisKey: 'category',
        yAxisKey: 'amount',
        aggregate: 'sum'
      }
    },
    {
      id: 'view-fuel-evolution',
      collectionId: fuelCollectionId,
      name: 'Évolution du prix du gazole',
      logicalOperator: 'and',
      createdAt: Date.now() - 600,
      filters: [],
      sortBy: 'date',
      sortOrder: 'asc',
      chartType: 'line',
      chartConfig: {
        xAxisKey: 'date',
        yAxisKey: 'price_per_l',
        aggregate: 'avg'
      }
    }
  ];

  await db.views.bulkAdd(views);
  dbStatus.value = 'ready';
  console.log('Database successfully seeded!');
}
