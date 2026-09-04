import { BQDriveSync } from '@bq/db-sync';
import { db } from './index';

// Instantiate the shared sync engine with BQMetrics's database and backup file name
const syncEngine = new BQDriveSync(db, 'bq-metrics-sync.json');

// Re-export reactive states for UI components
export const isDriveConnected = syncEngine.isDriveConnected;
export const lastSyncTime = syncEngine.lastSyncTime;
export const syncStatusMsg = syncEngine.syncStatusMsg;
export const isSyncing = syncEngine.isSyncing;

// Re-export methods
export function loadGoogleScript(): Promise<void> {
  return syncEngine.loadGoogleScript();
}

export function initializeGisClient(clientId: string, callback: (token: string) => void) {
  return syncEngine.initializeGisClient(clientId, callback);
}

export function connectGoogleDrive() {
  return syncEngine.connectGoogleDrive();
}

export function disconnectGoogleDrive() {
  return syncEngine.disconnectGoogleDrive();
}

export function checkSavedConnectionState() {
  return syncEngine.checkSavedConnectionState();
}

export function triggerGoogleDriveSync(tokenOverride?: string): Promise<boolean> {
  return syncEngine.triggerGoogleDriveSync(tokenOverride);
}

export function syncMergeDatabase(cloudData: any): Promise<boolean> {
  return syncEngine.syncMergeDatabase(cloudData);
}
