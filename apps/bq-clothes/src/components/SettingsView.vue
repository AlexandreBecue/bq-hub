<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, importDatabase, exportDatabase, generateId, type RecordEntry } from '../db/index';
import { 
  TENUES_TYPES_COL_ID,
  getClothesRecords,
  getTenuesTypesRecords
} from '../db/queries';
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
  Download, Upload, Trash2, Check, AlertTriangle, FileJson, 
  Cloud, RefreshCw, LogOut, Plus, Sparkles, X, Settings, Thermometer, Tag 
} from '@lucide/vue';

const emit = defineEmits(['data-updated']);

// Config State
const currentCity = ref(localStorage.getItem('bq-clothes-city') || 'Paris');
const dryingDelay = ref(Number(localStorage.getItem('bq-clothes-drying-delay') || '24'));

// Database State
const clothes = ref<RecordEntry[]>([]);
const tenuesTypes = ref<RecordEntry[]>([]);
const isImporting = ref(false);
const statusMessage = ref('');
const isError = ref(false);
const showConfirmClear = ref(false);
const isDbEmpty = ref(true);

// Tenue Type Modal Form State
const showAddTenueTypeModal = ref(false);
const formTenueType = ref({
  nom: '',
  contexte: 'Bureau',
  temperature_ideale: 15,
  vetements_associes: [] as string[]
});

const contexts = ["Bureau", "Télétravail", "Sport", "Escalade", "Sortie", "Détente"];
const citiesList = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Nantes', 'Strasbourg', 'Lille', 'Nice', 'Montpellier'];

const checkDbStatus = async () => {
  const count = await db.records.count();
  isDbEmpty.value = count === 0;
};

const loadClothesAndTenuesTypes = async () => {
  try {
    clothes.value = await getClothesRecords();
    tenuesTypes.value = await getTenuesTypesRecords();
  } catch (err) {
    console.error(err);
  }
};

onMounted(async () => {
  checkSavedConnectionState();
  await checkDbStatus();
  await loadClothesAndTenuesTypes();

  try {
    await loadGoogleScript();
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '653086696352-sr6n7etmnkd49j1kao8osvgqc0f042hl.apps.googleusercontent.com';
    initializeGisClient(clientId, async (token) => {
      const success = await triggerGoogleDriveSync(token);
      if (success) {
        emit('data-updated');
        await checkDbStatus();
        await loadClothesAndTenuesTypes();
      }
    });
  } catch (err) {
    console.warn("Script Google Drive indisponible.");
  }
});

// Save general preferences
const savePreferences = () => {
  localStorage.setItem('bq-clothes-city', currentCity.value);
  localStorage.setItem('bq-clothes-drying-delay', String(dryingDelay.value));
  alert('Préférences enregistrées avec succès !');
  emit('data-updated');
};

const handleSyncNow = async () => {
  const success = await triggerGoogleDriveSync();
  if (success) {
    emit('data-updated');
    await checkDbStatus();
    await loadClothesAndTenuesTypes();
  }
};

// Add New Typical Outfit (Tenue Type)
const handleAddTenueType = async () => {
  if (!formTenueType.value.nom.trim() || formTenueType.value.vetements_associes.length === 0) return;

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: TENUES_TYPES_COL_ID,
      data: {
        nom: formTenueType.value.nom.trim(),
        contexte: formTenueType.value.contexte,
        temperature_ideale: Number(formTenueType.value.temperature_ideale),
        vetements_associes: [...formTenueType.value.vetements_associes]
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddTenueTypeModal.value = false;
    formTenueType.value = { nom: '', contexte: 'Bureau', temperature_ideale: 15, vetements_associes: [] };
    await loadClothesAndTenuesTypes();
    alert('Tenue type ajoutée !');
  } catch (err) {
    console.error(err);
  }
};

// Delete Typical Outfit Template
const handleDeleteTenueType = async (id: string) => {
  if (!confirm('Supprimer cette tenue type ?')) return;
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    await loadClothesAndTenuesTypes();
  } catch (err) {
    console.error(err);
  }
};

const toggleGarmentInTemplate = (id: string) => {
  const idx = formTenueType.value.vetements_associes.indexOf(id);
  if (idx > -1) {
    formTenueType.value.vetements_associes.splice(idx, 1);
  } else {
    formTenueType.value.vetements_associes.push(id);
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
    a.download = `bq-clothes-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    statusMessage.value = 'Sauvegarde exportée !';
    isError.value = false;
  } catch (err) {
    statusMessage.value = 'Erreur lors de l\'exportation.';
    isError.value = true;
  }
};

const handleImport = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  
  const file = input.files[0];
  const reader = new FileReader();
  
  isImporting.value = true;
  statusMessage.value = 'Importation en cours...';
  
  reader.onload = async (e) => {
    try {
      const jsonText = e.target?.result as string;
      const result = await importDatabase(jsonText);
      if (result.success) {
        statusMessage.value = 'Données importées avec succès !';
        isError.value = false;
        emit('data-updated');
        await checkDbStatus();
        await loadClothesAndTenuesTypes();
      } else {
        statusMessage.value = result.error || 'Échec de l\'importation.';
        isError.value = true;
      }
    } catch (err) {
      statusMessage.value = 'Fichier invalide.';
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
    statusMessage.value = 'Application réinitialisée !';
    isError.value = false;
    emit('data-updated');
    await checkDbStatus();
    await loadClothesAndTenuesTypes();
  } catch (err) {
    console.error(err);
  }
};
</script>

<template>
  <div class="settings-view">
    <div class="view-header">
      <div>
        <h2>⚙️ Configuration & Préférences</h2>
        <p class="text-secondary">Gère tes préférences de séchage, configure tes suggestions de tenues types et synchronise tes données avec le cloud.</p>
      </div>
    </div>

    <div class="settings-grid">
      <!-- General Prefs and Tenues Types in Left Column -->
      <div class="left-col-settings">
        <!-- Preferences Card -->
        <div class="card glass mb-4">
          <h3 class="font-bold flex-row mb-4"><Settings :size="18" class="text-primary" /> Préférences de l'application</h3>
          
          <div class="form-grid">
            <div class="form-group">
              <label>Ma Ville (Météo)</label>
              <select v-model="currentCity" class="select">
                <option v-for="c in citiesList" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>

            <div class="form-group">
              <label>Temps de séchage (Heures)</label>
              <input v-model="dryingDelay" type="number" min="1" max="168" class="input" />
            </div>
          </div>
          
          <p class="text-xs text-muted mb-4">
            Le délai de séchage définit le nombre d'heures après lesquelles un habit fraîchement lavé redevient automatiquement marqué comme "Disponible".
          </p>

          <button @click="savePreferences" class="btn btn-primary">Enregistrer les préférences</button>
        </div>

        <!-- Tenues Types Manager Card -->
        <div class="card glass">
          <div class="tenues-types-header mb-4">
            <h3 class="font-bold flex-row"><Sparkles :size="18" class="text-accent" /> Mes Associations (Tenues Types)</h3>
            <button @click="showAddTenueTypeModal = true" class="btn btn-accent btn-sm">
              <Plus :size="14" /> Nouvelle Tenue Type
            </button>
          </div>

          <div v-if="tenuesTypes.length === 0" class="text-muted text-center py-4">
            <p class="text-sm">Aucune association type enregistrée. Crée des associations favorites pour recevoir des suggestions intelligentes sur la page d'accueil.</p>
          </div>

          <div v-else class="tenues-types-list">
            <div v-for="tt in tenuesTypes" :key="tt.id" class="tt-item">
              <div class="tt-header">
                <div>
                  <h4 class="font-bold text-md">{{ tt.data.nom }}</h4>
                  <div class="tt-tags flex-row mt-1">
                    <span class="badge badge-purple text-xs"><Tag :size="12" /> {{ tt.data.contexte }}</span>
                    <span class="badge badge-warning text-xs"><Thermometer :size="12" /> {{ tt.data.temperature_ideale }}°C</span>
                  </div>
                </div>
                <button @click="handleDeleteTenueType(tt.id!)" class="icon-btn delete-btn" title="Supprimer">
                  <Trash2 :size="14" />
                </button>
              </div>
              <div class="tt-garments mt-2 text-secondary text-sm">
                <strong>Composée de :</strong> 
                {{ tt.data.vetements_associes.map((id: string) => clothes.find(c => c.id === id)?.data.nom || 'Vêtement inconnu').join(' + ') }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cloud Sync and Actions in Right Column -->
      <div class="right-col-settings">
        <!-- Cloud Sync Card -->
        <div class="card glass mb-4">
          <div class="card-header">
            <div class="icon-wrapper primary">
              <Cloud :size="20" />
            </div>
            <h3 class="font-bold">Sauvegarde Google Drive</h3>
          </div>

          <div class="sync-actions-box mt-4">
            <div v-if="!isDriveConnected" class="drive-inactive-box text-center py-2">
              <p class="text-secondary text-sm mb-3">Connecte ton compte Google Drive pour activer la synchronisation automatique en tâche de fond.</p>
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
          <p class="text-secondary text-xs mb-4">Réinitialise l'application et vide toutes les données locales en cas de souci.</p>

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

    <!-- Modal : Add Tenue Type -->
    <div v-if="showAddTenueTypeModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>➕ Nouvelle Tenue Type</h3>
          <button @click="showAddTenueTypeModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom de la tenue type *</label>
            <input v-model="formTenueType.nom" type="text" placeholder="Ex: Chemise Lin & Chino Sable" class="input" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Contexte d'usage</label>
              <select v-model="formTenueType.contexte" class="select">
                <option v-for="ctx in contexts" :key="ctx" :value="ctx">{{ ctx }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Température Idéale (°C)</label>
              <input v-model="formTenueType.temperature_ideale" type="number" class="input" />
            </div>
          </div>

          <div class="clothes-selector-box mt-4">
            <label class="font-bold text-xs text-secondary mb-2 block">SÉLECTIONNE LES VÊTEMENTS DE CETTE TENUE *</label>
            
            <div class="tt-clothes-checklist mt-2">
              <div 
                v-for="item in clothes" 
                :key="item.id"
                class="garment-check-item"
                :class="{ 'checked': formTenueType.vetements_associes.includes(item.id!) }"
                @click="toggleGarmentInTemplate(item.id!)"
              >
                <div class="check-box">
                  <Check v-if="formTenueType.vetements_associes.includes(item.id!)" :size="12" />
                </div>
                <span>{{ item.data.nom }} <span class="text-xs text-muted">({{ item.data.categorie }})</span></span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <span class="badge badge-primary text-xs mr-auto" v-if="formTenueType.vetements_associes.length > 0">
            {{ formTenueType.vetements_associes.length }} vêtements associés
          </span>
          <button @click="showAddTenueTypeModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddTenueType" class="btn btn-accent" :disabled="!formTenueType.nom.trim() || formTenueType.vetements_associes.length === 0">
            Enregistrer
          </button>
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

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.tenues-types-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tenues-types-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tt-item {
  border: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
}

.tt-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
}

.tt-tags {
  display: flex;
  gap: 0.35rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
}

.status-msg {
  white-space: pre-wrap;
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

.mr-auto {
  margin-right: auto;
}

.block {
  display: block;
}

.tt-clothes-checklist {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  background-color: rgba(15, 23, 42, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.garment-check-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.6rem;
  font-size: 0.825rem;
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    background-color: var(--border-hover);
    border-color: var(--border-hover);
  }
  
  &.checked {
    background-color: rgba(16, 185, 129, 0.1);
    border-color: var(--color-accent);
    
    .check-box {
      background-color: var(--color-accent);
      border-color: var(--color-accent);
    }
  }
}

.check-box {
  width: 18px;
  height: 18px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(15, 23, 42, 0.6);
  flex-shrink: 0;
}

.icon-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 0.35rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    color: var(--text-primary);
    background-color: var(--border-hover);
  }
  
  &.delete-btn:hover {
    color: var(--color-danger);
    background-color: rgba(239, 68, 68, 0.1);
  }
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
