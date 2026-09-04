<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, importDatabase, exportDatabase } from '../db/index';
import { 
  isDriveConnected, 
  lastSyncTime, 
  syncStatusMsg, 
  isSyncing, 
  loadGoogleScript, 
  initializeGisClient, 
  connectGoogleDrive, 
  disconnectGoogleDrive, 
  checkSavedConnectionState, 
  triggerGoogleDriveSync 
} from '../db/google-drive';
import { 
  Download, Upload, Check, AlertTriangle, FileJson, 
  Cloud, RefreshCw, LogOut
} from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const isImporting = ref(false);
const statusMessage = ref('');
const isError = ref(false);
const showConfirmClear = ref(false);
const isDbEmpty = ref(true);

const checkDbStatus = async () => {
  const count = await db.records.count();
  isDbEmpty.value = count === 0;
};

onMounted(async () => {
  checkSavedConnectionState();
  await checkDbStatus();

  try {
    await loadGoogleScript();
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '653086696352-sr6n7etmnkd49j1kao8osvgqc0f042hl.apps.googleusercontent.com';
    initializeGisClient(clientId, async (token) => {
      const success = await triggerGoogleDriveSync(token);
      if (success) {
        emit('data-updated');
        await checkDbStatus();
      }
    });
  } catch (err) {
    console.warn("Script Google Drive indisponible.");
  }
});

const handleSyncNow = async () => {
  const success = await triggerGoogleDriveSync();
  if (success) {
    emit('data-updated');
    await checkDbStatus();
  }
};

// DB Operations
const handleExport = async () => {
  try {
    const backupJson = await exportDatabase();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bq-play-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    statusMessage.value = 'Sauvegarde exportée avec succès !';
    isError.value = false;
  } catch (err) {
    statusMessage.value = 'Erreur d\'exportation.';
    isError.value = true;
  }
};

const handleImport = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  
  const file = input.files[0];
  const reader = new FileReader();
  
  isImporting.value = true;
  statusMessage.value = 'Importation...';
  
  reader.onload = async (e) => {
    try {
      const jsonText = e.target?.result as string;
      const result = await importDatabase(jsonText);
      if (result.success) {
        statusMessage.value = 'Données importées avec succès !';
        isError.value = false;
        emit('data-updated');
        await checkDbStatus();
      } else {
        statusMessage.value = result.error || 'Échec de l\'importation.';
        isError.value = true;
      }
    } catch (err) {
      statusMessage.value = 'Fichier JSON invalide.';
      isError.value = true;
    } finally {
      isImporting.value = false;
    }
  };

  reader.readAsText(file);
};

const handleClearDatabase = async () => {
  try {
    await db.transaction('rw', [db.collections, db.records, db.views, db.templates], async () => {
      await db.collections.clear();
      await db.records.clear();
      await db.views.clear();
      await db.templates.clear();
    });
    showConfirmClear.value = false;
    statusMessage.value = 'Application vidée !';
    isError.value = false;
    emit('data-updated');
    await checkDbStatus();
  } catch (err) {
    console.error(err);
  }
};
</script>

<template>
  <div class="settings-view">
    <div class="view-header">
      <div>
        <h2>⚙️ Configuration & Options</h2>
        <p class="text-secondary">Gère tes synchronisations Google Drive, tes imports d'historique et tes sauvegardes.</p>
      </div>
    </div>

    <div class="settings-grid">
      <!-- Sync Column -->
      <div class="left-col-settings">
        <!-- Cloud Sync Card -->
        <div class="card glass mb-4">
          <div class="card-header flex-row gap-2">
            <Cloud class="text-primary" :size="20" />
            <h3 class="font-bold">Sauvegarde Google Drive</h3>
          </div>

          <div class="sync-actions-box mt-4">
            <div v-if="!isDriveConnected" class="drive-inactive-box text-center py-2">
              <p class="text-secondary text-sm mb-3">Connecte ton compte Google Drive pour synchroniser ton carnet de score et ta ludothèque.</p>
              <button @click="connectGoogleDrive" class="btn btn-primary flex-row mx-auto">
                <Cloud :size="16" /> Connexion Google Drive
              </button>
            </div>

            <div v-else class="drive-active-box">
              <div class="drive-status-info text-sm mb-3">
                <span class="badge badge-success flex-row"><Check :size="12" /> Connecté au Cloud</span>
              </div>
              
              <div class="status-row text-xs text-secondary mb-3">
                <p>Dernière synchronisation : <strong>{{ lastSyncTime || 'Jamais' }}</strong></p>
                <p v-if="syncStatusMsg" class="status-msg text-muted mt-1">{{ syncStatusMsg }}</p>
              </div>

              <div class="flex-row">
                <button @click="handleSyncNow" class="btn btn-accent btn-sm flex-row" :disabled="isSyncing">
                  <RefreshCw :size="14" :class="{ 'spin-icon': isSyncing }" /> Synchroniser maintenant
                </button>
                <button @click="disconnectGoogleDrive" class="btn btn-danger btn-sm flex-row">
                  <LogOut :size="14" /> Déconnexion
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- JSON backups column -->
      <div class="right-col-settings">
        <!-- Raw Actions Card -->
        <div class="card glass mb-4">
          <h3 class="font-bold flex-row mb-4"><FileJson :size="18" class="text-primary" /> Import / Export JSON</h3>
          
          <div class="actions-group flex-row">
            <button @click="handleExport" class="btn btn-secondary btn-sm flex-row">
              <Download :size="14" /> Exporter la BDD
            </button>
            
            <label class="btn btn-secondary btn-sm flex-row cursor-pointer">
              <Upload :size="14" /> Importer JSON
              <input type="file" accept=".json" @change="handleImport" class="hidden-input" />
            </label>
          </div>

          <p v-if="statusMessage" class="status-message text-xs mt-3" :class="isError ? 'text-danger' : 'text-accent'">
            {{ statusMessage }}
          </p>
        </div>

        <!-- Danger Zone -->
        <div class="card glass danger-card">
          <h3 class="font-bold text-danger flex-row mb-2"><AlertTriangle :size="18" /> Zone de danger</h3>
          <p class="text-secondary text-xs mb-4">Réinitialise l'application et vide toutes les données de ta ludothèque locale.</p>

          <button v-if="!showConfirmClear" @click="showConfirmClear = true" class="btn btn-danger btn-sm">
            Vider l'application
          </button>
          
          <div v-else class="confirm-box mt-2">
            <p class="text-danger font-bold text-xs mb-2">⚠️ Attention : Toutes les données seront supprimées définitivement.</p>
            <div class="flex-row">
              <button @click="handleClearDatabase" class="btn btn-danger btn-sm">Oui, supprimer tout !</button>
              <button @click="showConfirmClear = false" class="btn btn-secondary btn-sm">Annuler</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.sync-actions-box {
  display: flex;
  flex-direction: column;
}

.hidden-input {
  display: none;
}

.danger-card {
  border-color: rgba(239, 68, 68, 0.2) !important;
  background-color: rgba(239, 68, 68, 0.02) !important;
}

.cursor-pointer {
  cursor: pointer;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.font-bold { font-weight: 700; }
.text-center { text-align: center; }

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
