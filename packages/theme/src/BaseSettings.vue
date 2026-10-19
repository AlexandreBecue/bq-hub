<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { importDatabase, exportDatabase } from '@bq/db-sync';
import { 
  Cloud, RefreshCw, LogOut, Download, Upload, Trash2, FileJson, X, Sparkles
} from '@lucide/vue';

const props = defineProps<{
  db: any;
  syncEngine: any;
  clientId: string;
  isDbEmpty: boolean;
  exportFileNamePrefix: string;
}>();

const emit = defineEmits(['data-updated', 'clear-database', 'generate-demo']);

const isImporting = ref(false);
const statusMessage = ref('');
const isError = ref(false);
const showConfirmClear = ref(false);

const isDriveConnected = props.syncEngine.isDriveConnected;
const lastSyncTime = props.syncEngine.lastSyncTime;
const syncStatusMsg = props.syncEngine.syncStatusMsg;
const isSyncing = props.syncEngine.isSyncing;

onMounted(async () => {
  props.syncEngine.checkSavedConnectionState();
  try {
    await props.syncEngine.loadGoogleScript();
    if (props.clientId) {
      props.syncEngine.initializeGisClient(props.clientId, async (token: string) => {
        const success = await props.syncEngine.triggerGoogleDriveSync(token);
        if (success) {
          emit('data-updated');
        }
      });
    }
  } catch (err) {
    console.warn("Script Google Drive indisponible ou Client ID manquant.");
  }
});

const handleSyncNow = async () => {
  const success = await props.syncEngine.triggerGoogleDriveSync();
  if (success) {
    emit('data-updated');
  }
};

const handleConnectDrive = () => {
  props.syncEngine.connectGoogleDrive();
};

const handleDisconnectDrive = () => {
  props.syncEngine.disconnectGoogleDrive();
};

// JSON Local Export
const handleExport = async () => {
  try {
    statusMessage.value = 'Préparation de l\'exportation...';
    isError.value = false;

    const backupJson = await exportDatabase(props.db, undefined, {
      excludeDeleted: true,
      appPrefix: props.exportFileNamePrefix
    });
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.exportFileNamePrefix}-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    statusMessage.value = 'Sauvegarde exportée avec succès !';
    isError.value = false;
  } catch (err) {
    statusMessage.value = 'Erreur lors de l\'exportation.';
    isError.value = true;
  }
};

// JSON Local Import
const handleImport = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  isImporting.value = true;
  statusMessage.value = 'Importation des données en cours...';
  isError.value = false;

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const jsonText = e.target?.result as string;
      const result = await importDatabase(props.db, jsonText);
      
      isImporting.value = false;
      if (result.success) {
        statusMessage.value = result.merged 
          ? 'Données fusionnées avec succès !' 
          : 'Données écrasées et importées avec succès !';
        emit('data-updated');
      } else {
        statusMessage.value = result.error || 'Fichier JSON invalide ou corrompu.';
        isError.value = true;
      }
    };
    reader.readAsText(file);
  } catch (err) {
    isImporting.value = false;
    statusMessage.value = 'Erreur système lors de l\'importation.';
    isError.value = true;
  }
};

// Clear Database / Reset
const handleClearDatabase = async () => {
  try {
    await props.db.transaction('rw', [props.db.collections, props.db.records, props.db.views, props.db.templates], async () => {
      await props.db.collections.clear();
      await props.db.records.clear();
      await props.db.views.clear();
      await props.db.templates.clear();
    });
    
    showConfirmClear.value = false;
    statusMessage.value = 'Application réinitialisée !';
    isError.value = false;
    emit('clear-database');
  } catch (err) {
    statusMessage.value = 'Échec de la réinitialisation.';
    isError.value = true;
  }
};
</script>

<template>
  <div class="settings-view fade-in">
    <!-- Configuration Banner -->
    <div v-if="statusMessage" class="card glass settings-banner" :class="{ 'error-banner': isError, 'success-banner': !isError }">
      <div class="settings-banner-row">
        <p class="text-sm font-bold settings-banner-text">{{ statusMessage }}</p>
        <button @click="statusMessage = ''" class="settings-banner-close" title="Fermer"><X :size="16" /></button>
      </div>
    </div>

    <div class="settings-grid">
      <!-- Google Drive Sync Card -->
      <div class="card glass">
        <div class="card-header">
          <div class="icon-wrapper primary">
            <Cloud class="icon" />
          </div>
          <h2>Sauvegarde Cloud</h2>
        </div>
        <p class="card-desc">
          Sauvegarde, synchronise et fusionne automatiquement tes données de vie sur ton espace Google Drive personnel en toute confidentialité.
        </p>

        <div class="sync-status mt-4">
          <div class="sync-status-row">
            <span class="text-sub">Statut de la connexion :</span>
            <span class="font-bold status-text" :class="{ 'connected': isDriveConnected, 'disconnected': !isDriveConnected }">
              {{ isDriveConnected ? 'Connecté 🟢' : 'Déconnecté 🔘' }}
            </span>
          </div>

          <div v-if="lastSyncTime" class="last-sync-row text-sub">
            <span>Dernière synchronisation :</span>
            <span class="font-bold text-primary">{{ lastSyncTime }}</span>
          </div>

          <p v-if="syncStatusMsg" class="sync-error-msg font-bold">
            {{ syncStatusMsg }}
          </p>

          <div class="sync-actions-row">
            <button v-if="!isDriveConnected" @click="handleConnectDrive" class="btn btn-primary btn-outline flex-1">
              Se connecter à Google Drive
            </button>
            <template v-else>
              <button @click="handleSyncNow" class="btn btn-primary flex-2 btn-submit-row" :disabled="isSyncing">
                <RefreshCw :class="{ 'animate-spin-slow': isSyncing }" :size="16" />
                <span>{{ isSyncing ? 'Synchronisation...' : 'Synchroniser' }}</span>
              </button>
              <button @click="handleDisconnectDrive" class="btn btn-secondary btn-outline btn-icon-only" title="Déconnecter">
                <LogOut :size="16" />
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- Backup Card -->
      <div class="card glass">
        <div class="card-header">
          <div class="icon-wrapper secondary">
            <FileJson class="icon" />
          </div>
          <h2>Sauvegarde locale</h2>
        </div>
        <p class="card-desc">
          Exporte l'intégralité de tes données locales dans un fichier physique JSON sur ta machine, ou ré-importe un fichier de sauvegarde existant.
        </p>

        <div class="backup-actions">
          <button @click="handleExport" class="btn btn-secondary flex-row flex-1 justify-center btn-submit-row">
            <Download :size="16" /> Exporter les données
          </button>

          <label class="btn btn-secondary btn-outline flex-row cursor-pointer text-center flex-1 justify-center btn-submit-row">
            <Upload :size="16" /> Importer une sauvegarde
            <input type="file" accept=".json" @change="handleImport" class="hidden-input" />
          </label>
        </div>
      </div>

      <!-- Danger Zone / Data resetting -->
      <div v-if="!isDbEmpty" class="card glass danger-card">
        <div class="card-header">
          <div class="icon-wrapper danger">
            <Trash2 class="icon" />
          </div>
          <h2>Réinitialisation des données</h2>
        </div>
        <p class="card-desc">
          Cette action supprimera définitivement toutes tes collections, enregistrements et vues sauvegardés sur cet appareil.
        </p>

        <button v-if="!showConfirmClear" @click="showConfirmClear = true" class="btn btn-danger btn-danger-action w-100">
          <Trash2 :size="16" />
          Réinitialiser l'application
        </button>

        <div v-else class="confirm-box">
          <p class="confirm-title">Es-tu absolument sûr ?</p>
          <p class="confirm-desc">Toutes tes données locales seront perdues à jamais.</p>
          <div class="confirm-actions-row">
            <button @click="handleClearDatabase" class="btn btn-danger btn-sm">Oui, tout supprimer</button>
            <button @click="showConfirmClear = false" class="btn btn-neutral btn-sm">Annuler</button>
          </div>
        </div>
      </div>

      <!-- Demo Data Seeding Card -->
      <div v-else class="card glass">
        <div class="card-header">
          <div class="icon-wrapper secondary">
            <Sparkles class="icon" />
          </div>
          <h2>Données de démonstration</h2>
        </div>
        <p class="card-desc">
          Tu veux tester l'application tout de suite ? Génère un jeu de données complet de test cohérent en un clic pour simuler rapidement une utilisation.
        </p>

        <button @click="emit('generate-demo')" class="btn btn-secondary w-100 btn-submit-row">
          <Sparkles :size="16" />
          Générer des données de test
        </button>
      </div>
    </div>

    <!-- App-specific slot for custom settings views (e.g. pinned apps or accounts management) -->
    <slot />
  </div>
</template>

<style scoped lang="scss">
.settings-view {
  width: 100%;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
  align-items: start;
  margin-bottom: 2rem;
  width: 100%;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.settings-banner {
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
  
  &.error-banner {
    border-color: rgba(239, 68, 68, 0.2);
    background-color: rgba(239, 68, 68, 0.02);
    .settings-banner-text { color: var(--color-danger); }
  }
  
  &.success-banner {
    border-color: rgba(16, 185, 129, 0.2);
    background-color: rgba(16, 185, 129, 0.02);
    .settings-banner-text { color: var(--color-success); }
  }
}

.settings-banner-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.settings-banner-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  
  &:hover {
    color: var(--text-primary);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  
  h2 {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0;
  }
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm, 6px);
  
  &.primary {
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
  }
  &.secondary {
    background-color: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    color: var(--color-secondary);
  }
  &.danger {
    background-color: color-mix(in srgb, var(--color-danger) 10%, transparent);
    color: var(--color-danger);
  }
}

.card-desc {
  color: var(--color-text-sub);
  font-size: 0.85rem;
  line-height: 1.4;
  margin-bottom: 1.25rem;
}

.sync-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  
  .status-text {
    &.connected { color: var(--color-success); }
    &.disconnected { color: var(--color-warning); }
  }
}

.last-sync-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  margin-bottom: 1rem;
}

.sync-error-msg {
  font-size: 0.75rem;
  color: var(--color-warning);
  margin-top: 0.5rem;
  margin-bottom: 1rem;
}

.sync-actions-row {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.backup-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.confirm-box {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--color-danger) 20%, transparent);
  background-color: color-mix(in srgb, var(--color-danger) 2%, transparent);
}

.danger-card {
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
  background-color: color-mix(in srgb, var(--color-danger) 4%, transparent);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  &:hover {
    border-color: var(--color-danger) !important;
    box-shadow: 0 0 25px color-mix(in srgb, var(--color-danger) 30%, transparent), var(--shadow-lg);
    animation: dangerPulse 2s infinite ease-in-out;
  }

  .btn-danger-action {
    background-color: var(--color-danger);
    color: #ffffff;
    border: 1px solid var(--color-danger);
    font-weight: 700;
    transition: var(--transition);

    &:hover:not(:disabled) {
      background-color: var(--color-danger-hover);
      box-shadow: 0 0 15px color-mix(in srgb, var(--color-danger) 50%, transparent);
      transform: translateY(-1px);
    }
  }
}

@keyframes dangerPulse {
  0%, 100% {
    box-shadow: 0 0 15px color-mix(in srgb, var(--color-danger) 20%, transparent);
    border-color: var(--color-danger);
  }
  50% {
    box-shadow: 0 0 30px color-mix(in srgb, var(--color-danger) 45%, transparent);
    border-color: var(--color-danger-hover);
  }
}

.confirm-title {
  color: var(--color-danger);
  margin: 0;
  font-size: 0.9rem;
  font-weight: bold;
}

.confirm-desc {
  color: var(--text-muted);
  font-size: 0.75rem;
  margin: 4px 0 1rem 0;
}

.confirm-actions-row {
  display: flex;
  gap: 0.5rem;
}

.btn-submit-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.btn-icon-only {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.btn-secondary {
  background-color: var(--color-secondary);
  color: #ffffff;
  border: none;
  
  &:hover:not(:disabled) {
    background-color: var(--color-secondary-hover);
  }
}

.hidden-input {
  display: none;
}

.flex-1 { flex: 1; }
.flex-2 { flex: 2; }
.w-100 { width: 100%; }
.mt-4 { margin-top: 1rem; }
.cursor-pointer { cursor: pointer; }
.text-center { text-align: center; }

@keyframes spin {
  to { transform: rotate(360deg); }
}

.animate-spin-slow {
  animation: spin 2s linear infinite;
}
</style>
