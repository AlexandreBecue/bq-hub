import { 
  BQDatabase, 
  dbStatus, 
  exportDatabase as _exportDatabase, 
  importDatabase as _importDatabase,
  generateId as _generateId
} from '@bq/db-sync';

export type { 
  DBStatus, 
  FieldType, 
  FieldConfig, 
  CollectionSchema, 
  RecordEntry, 
  SavedFilter, 
  SavedView, 
  RecordTemplate, 
  DatabaseBackup 
} from '@bq/db-sync';

// Define Local Dexie Database extending the generic BQDatabase
export class BQHealthDatabase extends BQDatabase {
  constructor() {
    super('BQHealthDatabase');
  }
}

export const db = new BQHealthDatabase();
export { dbStatus };

// Generate unique IDs
export function generateId(): string {
  return _generateId();
}

// Wrapped compatibility helpers for Import/Export
export async function exportDatabase(collectionIds?: string[]): Promise<string> {
  return _exportDatabase(db, collectionIds);
}

export async function importDatabase(jsonText: string): Promise<{ success: boolean; error?: string; merged?: boolean }> {
  return _importDatabase(db, jsonText);
}
