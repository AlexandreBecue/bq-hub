import { ref } from 'vue';
import type { BQDatabase, CollectionSchema, RecordEntry, SavedView, RecordTemplate } from './index';

export class BQDriveSync {
  private db: BQDatabase;
  private syncFileName: string;

  // Reactive States for Google Drive Sync
  public isDriveConnected = ref(localStorage.getItem('bq_drive_connected') === 'true');
  public lastSyncTime = ref(localStorage.getItem('bq_last_sync_time') || '');
  public syncStatusMsg = ref('');
  public isSyncing = ref(false);

  private googleGisClient: any = null;

  constructor(db: BQDatabase, syncFileName: string = 'bq-sync.json') {
    this.db = db;
    this.syncFileName = syncFileName;
  }

  /**
   * Load Google API script dynamically
   */
  public loadGoogleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.getElementById('google-gis-script')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.id = 'google-gis-script';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Échec du chargement de Google GIS client.'));
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize Google Identity Services Client
   */
  public initializeGisClient(clientId: string, callback: (token: string) => void) {
    if (this.googleGisClient) return;

    this.googleGisClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response: any) => {
        if (response.error) {
          this.syncStatusMsg.value = 'Authentification annulée ou refusée.';
          this.isDriveConnected.value = false;
          localStorage.setItem('bq_drive_connected', 'false');
          return;
        }
        const token = response.access_token;
        localStorage.setItem('bq_google_auth_token', token);
        localStorage.setItem('bq_google_token_expiry', String(Date.now() + (Number(response.expires_in) * 1000)));
        this.isDriveConnected.value = true;
        localStorage.setItem('bq_drive_connected', 'true');
        callback(token);
      }
    });
  }

  public connectGoogleDrive() {
    if (this.googleGisClient) {
      this.googleGisClient.requestAccessToken();
    } else {
      const errorMsg = 'Erreur : Google Client non initialisé (vérifie que ton fichier .env local contient les configurations Google nécessaires).';
      this.syncStatusMsg.value = errorMsg;
      console.error(errorMsg);
    }
  }

  public disconnectGoogleDrive() {
    localStorage.removeItem('bq_google_auth_token');
    localStorage.removeItem('bq_google_token_expiry');
    localStorage.setItem('bq_drive_connected', 'false');
    this.isDriveConnected.value = false;
    this.syncStatusMsg.value = 'Compte Google déconnecté.';
  }

  public checkSavedConnectionState() {
    const token = localStorage.getItem('bq_google_auth_token');
    const expiry = Number(localStorage.getItem('bq_google_token_expiry') || '0');
    
    if (token && Date.now() < expiry) {
      this.isDriveConnected.value = true;
      localStorage.setItem('bq_drive_connected', 'true');
    } else {
      this.disconnectGoogleDrive();
    }
  }

  private async getValidAuthToken(): Promise<string> {
    const token = localStorage.getItem('bq_google_auth_token');
    const expiry = Number(localStorage.getItem('bq_google_token_expiry') || '0');

    if (token && Date.now() < expiry) {
      return token;
    }

    return new Promise((resolve, reject) => {
      if (!this.googleGisClient) {
        reject(new Error('Google Client non initialisé.'));
        return;
      }
      this.googleGisClient.callback = (response: any) => {
        if (response.error) {
          reject(new Error('Authentification annulée.'));
          return;
        }
        const token = response.access_token;
        localStorage.setItem('bq_google_auth_token', token);
        localStorage.setItem('bq_google_token_expiry', String(Date.now() + (Number(response.expires_in) * 1000)));
        this.isDriveConnected.value = true;
        localStorage.setItem('bq_drive_connected', 'true');
        resolve(token);
      };
      this.googleGisClient.requestAccessToken();
    });
  }

  /**
   * Find the sync file in user's Drive appFolder/root
   */
  private async findSyncFileId(token: string): Promise<string | null> {
    const q = encodeURIComponent(`name = '${this.syncFileName}' and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`;
    
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!resp.ok) {
      if (resp.status === 401) {
        this.disconnectGoogleDrive();
        throw new Error('Session Google expirée. Reconnecte-toi.');
      }
      throw new Error('Impossible d\'interroger Google Drive.');
    }
    
    const data = await resp.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  }

  private async downloadCloudData(token: string, fileId: string): Promise<any> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!resp.ok) {
      throw new Error('Erreur de téléchargement de la sauvegarde.');
    }
    
    return await resp.json();
  }

  private async uploadCloudData(token: string, backupData: any, fileId?: string): Promise<string> {
    const metadata = {
      name: this.syncFileName,
      mimeType: 'application/json'
    };
    
    const boundary = 'bq_metrics_sync_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    const body = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(backupData, null, 2) +
      closeDelimiter;

    const url = fileId 
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      
    const method = fileId ? 'PATCH' : 'POST';

    const resp = await fetch(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    });

    if (!resp.ok) {
      throw new Error('Erreur de téléversement vers Google Drive.');
    }

    const fileInfo = await resp.json();
    return fileInfo.id;
  }

  // --- Smart Merge Engine ---

  private mergeLists(localList: any[], cloudList: any[]): any[] {
    const map = new Map<string, any>();
    
    // Insert all local items
    localList.forEach(item => {
      map.set(item.id, item);
    });
    
    // Merge cloud items
    cloudList.forEach(cloudItem => {
      const localItem = map.get(cloudItem.id);
      if (!localItem) {
        // Cloud item doesn't exist locally: accept it
        map.set(cloudItem.id, cloudItem);
      } else {
        // Conflict: compare last update timestamps
        const localTime = localItem.updatedAt || localItem.createdAt || 0;
        const cloudTime = cloudItem.updatedAt || cloudItem.createdAt || 0;
        
        if (cloudTime > localTime) {
          // Cloud item is newer: replace local
          map.set(cloudItem.id, cloudItem);
        }
      }
    });
    
    return Array.from(map.values());
  }

  public async syncMergeDatabase(cloudData: any): Promise<boolean> {
    const cloudCollections: CollectionSchema[] = cloudData.collections || [];
    const cloudRecords: RecordEntry[] = cloudData.records || [];
    const cloudViews: SavedView[] = cloudData.views || [];
    const cloudTemplates: RecordTemplate[] = cloudData.templates || [];

    const localCollections = await this.db.collections.toArray();
    const localRecords = await this.db.records.toArray();
    const localViews = await this.db.views.toArray();
    const localTemplates = await this.db.templates.toArray();

    // Merge each table
    const mergedCollections = this.mergeLists(localCollections, cloudCollections);
    const mergedRecords = this.mergeLists(localRecords, cloudRecords);
    const mergedViews = this.mergeLists(localViews, cloudViews);
    const mergedTemplates = this.mergeLists(localTemplates, cloudTemplates);

    await this.db.transaction('rw', [this.db.collections, this.db.records, this.db.views, this.db.templates], async () => {
      for (const c of mergedCollections) await this.db.collections.put(c);
      for (const r of mergedRecords) await this.db.records.put(r);
      for (const v of mergedViews) await this.db.views.put(v);
      for (const t of mergedTemplates) await this.db.templates.put(t);
    });

    return true;
  }

  /**
   * Trigger dynamic synchronisation with Google Drive sync file
   */
  public async triggerGoogleDriveSync(tokenOverride?: string): Promise<boolean> {
    this.isSyncing.value = true;
    this.syncStatusMsg.value = 'Connexion à Google Drive...';
    
    try {
      const token = tokenOverride || await this.getValidAuthToken();
      const fileId = await this.findSyncFileId(token);
      
      const localCollections = await this.db.collections.toArray();
      const localRecords = await this.db.records.toArray();
      const localViews = await this.db.views.toArray();
      const localTemplates = await this.db.templates.toArray();
      
      const localBackup = {
        version: 2,
        collections: localCollections,
        records: localRecords,
        views: localViews,
        templates: localTemplates,
        exportedAt: Date.now()
      };
      
      if (!fileId) {
        // Scenario A: First sync ever! Simply upload local data to a new file
        this.syncStatusMsg.value = 'Premier enregistrement sur Google Drive...';
        await this.uploadCloudData(token, localBackup);
      } else {
        // Scenario B: Sync file exists! Download, merge, and upload result
        this.syncStatusMsg.value = 'Téléchargement de la version Cloud...';
        const cloudBackup = await this.downloadCloudData(token, fileId);
        
        this.syncStatusMsg.value = 'Fusion des données locales et distantes...';
        await this.syncMergeDatabase(cloudBackup);
        
        // Get the freshly merged database state to save it back to the Cloud
        const mergedCollections = await this.db.collections.toArray();
        const mergedRecords = await this.db.records.toArray();
        const mergedViews = await this.db.views.toArray();
        const mergedTemplates = await this.db.templates.toArray();
        
        const mergedBackup = {
          version: 2,
          collections: mergedCollections,
          records: mergedRecords,
          views: mergedViews,
          templates: mergedTemplates,
          exportedAt: Date.now()
        };
        
        this.syncStatusMsg.value = 'Mise à jour du fichier sur Google Drive...';
        await this.uploadCloudData(token, mergedBackup, fileId);
      }
      
      const now = new Date();
      const dateStr = 'le ' + now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      this.lastSyncTime.value = dateStr;
      localStorage.setItem('bq_last_sync_time', dateStr);
      
      this.syncStatusMsg.value = 'Données synchronisées avec succès.';
      this.isSyncing.value = false;
      return true;
    } catch (err: any) {
      this.isSyncing.value = false;
      this.syncStatusMsg.value = err.message || 'Erreur lors de la synchronisation.';
      console.error('Erreur Synchro Drive:', err);
      return false;
    }
  }
}
