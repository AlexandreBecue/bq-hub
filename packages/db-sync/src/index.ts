import Dexie, { type Table } from 'dexie';
import { ref } from 'vue';

export type DBStatus = 'ready' | 'loading' | 'saving' | 'error';
export const dbStatus = ref<DBStatus>('ready');

// Define Field types
export type FieldType = 'text' | 'number' | 'date' | 'tags' | 'boolean' | 'select' | 'relation';

export interface FieldConfig {
  id: string;
  name: string;              // E.g., "Prix au Litre", "Titre"
  key: string;               // E.g., "pricePerLiter", "title"
  type: FieldType;
  required: boolean;
  options?: string[];        // For 'select' type
  unit?: string;             // Custom unit for numeric fields, e.g., "€", "L / km"
  decimals?: number;         // Number of decimals to display for numeric fields
  relatedCollectionId?: string; // For 'relation' type
  isMultiple?: boolean;      // For 'relation' type (allow selecting multiple related records)
  isCalculated?: boolean;    // Is this field dynamically calculated via formula?
  formula?: string;          // Calculation formula e.g. "SPEED({distance}, TIME_TO_SEC({temps}))"
  autoFillMappings?: { sourceKey: string; targetKey: string }[]; // For relation fields
}

// Collection Schema (Data Model)
export interface CollectionSchema {
  id: string;                // UUID/Unique ID
  name: string;              // E.g., "Consommation Gazole"
  description?: string;
  fields: FieldConfig[];
  primaryFieldKey: string;   // The field used as the "label" or "title" for this record
  createdAt: number;
  updatedAt?: number;        // Tracked for sync
  deletedAt?: number;        // Soft delete tombstone
  defaultSortByField?: string;
  defaultSortOrder?: 'asc' | 'desc';
}

// Record (Actual dynamic entry)
export interface RecordEntry {
  id?: string;               // Auto-incremented / UUID in string
  collectionId: string;      // Links to collection.id
  data: Record<string, any>; // Dynamic fields data e.g. { title: 'Dune', players: 4 }
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;        // Soft delete tombstone
}

// Saved Filter Definition
export interface SavedFilter {
  fieldKey: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'in_tags' | 'is_empty' | 'is_not_empty';
  value: any;
  isInteractive?: boolean;
}

// Saved View (Filters, sorting, and charts configurations)
export interface SavedView {
  id: string;
  collectionId: string;
  name: string;              // E.g., "Jeux jouables à 3"
  filters: SavedFilter[];
  logicalOperator: 'and' | 'or';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  chartType: 'none' | 'bar' | 'pie' | 'line' | 'doughnut';
  chartConfig?: {
    xAxisKey: string;        // Field key for X axis
    yAxisKey: string;        // Field key for Y axis, or "count"
    aggregate: 'sum' | 'avg' | 'count' | 'monthly_avg' | 'balance' | 'moving_avg' | 'monthly_sum' | 'monthly_count' | 'usage_since_reset';
    tooltipFields?: string[];
  };
  createdAt: number;
  updatedAt?: number;        // Tracked for sync
  deletedAt?: number;        // Soft delete tombstone
}

// Record Template Definition
export interface RecordTemplate {
  id: string;                // UUID/Unique ID
  collectionId: string;      // Links to collection.id
  name: string;              // E.g., "Loyer Mensuel"
  data: Record<string, any>; // Dynamic prefilled fields data
  isAutomated: boolean;      // True if automated alert is enabled
  recurrence?: 'monthly' | 'yearly';
  recurrenceDay?: number;    // Day of month (1 to 31)
  recurrenceMonth?: number;  // Month of year (1 to 12)
  lastGeneratedPeriod?: string; // e.g. "2026-06" or "2026"
  createdAt: number;
  updatedAt?: number;        // Tracked for sync
  deletedAt?: number;        // Soft delete tombstone
}

// Generic Offline-First Dexie Database
export class BQDatabase extends Dexie {
  collections!: Table<CollectionSchema, string>;
  records!: Table<RecordEntry, string>;
  views!: Table<SavedView, string>;
  templates!: Table<RecordTemplate, string>;

  constructor(dbName: string) {
    super(dbName);
    this.version(2).stores({
      collections: 'id, name, createdAt',
      records: 'id, collectionId, createdAt',
      views: 'id, collectionId, createdAt',
      templates: 'id, collectionId, createdAt'
    });
  }
}

// Helper to generate unique IDs
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// --- Backup & Restore (JSON Import/Export) ---
export interface DatabaseBackup {
  version: number;
  collections: CollectionSchema[];
  records: RecordEntry[];
  views: SavedView[];
  templates?: RecordTemplate[];
  exportedAt: number;
}

export interface ExportOptions {
  excludeDeleted?: boolean;
  appPrefix?: string;
  collectionIds?: string[];
}

export async function exportDatabase(
  db: BQDatabase, 
  collectionIdsOrOptions?: string[] | ExportOptions,
  options?: ExportOptions
): Promise<string> {
  let opts: ExportOptions = { excludeDeleted: true };
  
  if (Array.isArray(collectionIdsOrOptions)) {
    opts.collectionIds = collectionIdsOrOptions;
    if (options) opts = { ...opts, ...options };
  } else if (collectionIdsOrOptions && typeof collectionIdsOrOptions === 'object') {
    opts = { ...opts, ...collectionIdsOrOptions };
  }

  let collections = await db.collections.toArray();
  let records = await db.records.toArray();
  let views = await db.views.toArray();
  let templates = await db.templates.toArray();

  // 1. Exclude soft-deleted tombstones (default: true)
  if (opts.excludeDeleted !== false) {
    collections = collections.filter(c => !c.deletedAt);
    records = records.filter(r => !r.deletedAt);
    views = views.filter(v => !v.deletedAt);
    templates = templates.filter(t => !t.deletedAt);
  }

  // 2. Filter by appPrefix (unless bq-graph or empty)
  if (opts.appPrefix && opts.appPrefix !== 'bq-graph') {
    const prefix = opts.appPrefix.toLowerCase();
    const appCols = collections.filter(c => c.name.toLowerCase().startsWith(prefix));
    const appColIds = new Set(appCols.map(c => c.id));

    collections = appCols;
    records = records.filter(r => appColIds.has(r.collectionId));
    views = views.filter(v => appColIds.has(v.collectionId));
    templates = templates.filter(t => appColIds.has(t.collectionId));
  } else if (opts.collectionIds && opts.collectionIds.length > 0) {
    const filterSet = new Set(opts.collectionIds);
    collections = collections.filter(c => filterSet.has(c.id));
    records = records.filter(r => filterSet.has(r.collectionId));
    views = views.filter(v => filterSet.has(v.collectionId));
    templates = templates.filter(t => filterSet.has(t.collectionId));
  }

  const backup: DatabaseBackup = {
    version: 2,
    collections,
    records,
    views,
    templates,
    exportedAt: Date.now()
  };

  return JSON.stringify(backup, null, 2);
}

export async function importDatabase(db: BQDatabase, jsonText: string): Promise<{ success: boolean; error?: string; merged?: boolean }> {
  dbStatus.value = 'loading';
  try {
    const backup: DatabaseBackup = JSON.parse(jsonText);
    if (backup.version !== 2) {
      dbStatus.value = 'ready';
      return { success: false, error: "Version de sauvegarde non supportée. Version attendue : 2." };
    }

    const collections = backup.collections || [];
    const records = backup.records || [];
    const views = backup.views || [];
    const templates = backup.templates || [];

    // Perform inside a transaction
    await db.transaction('rw', [db.collections, db.records, db.views, db.templates], async () => {
      // Smart Merge (Fusion intelligente) : Upsert collections/views/templates and append records
      for (const col of collections) {
        await db.collections.put(col);
      }

      for (const rec of records) {
        if (rec.id) {
          const existing = await db.records.get(rec.id);
          if (existing) {
            const existingTime = existing.updatedAt || existing.createdAt || 0;
            const importTime = rec.updatedAt || rec.createdAt || 0;
            if (importTime > existingTime) {
              await db.records.put(rec);
            }
          } else {
            await db.records.add(rec);
          }
        }
      }

      for (const view of views) {
        await db.views.put(view);
      }

      for (const temp of templates) {
        await db.templates.put(temp);
      }
    });

    dbStatus.value = 'ready';
    return { success: true, merged: true };
  } catch (err: any) {
    dbStatus.value = 'error';
    return { success: false, error: err.message || String(err) };
  }
}

export * from './google-drive';

