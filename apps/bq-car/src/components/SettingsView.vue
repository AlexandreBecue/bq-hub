<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, importDatabase, exportDatabase, generateId, type RecordEntry } from '../db/index';
import { VEHICLES_COL_ID, getVehiclesRecords } from '../db/queries';
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
  Cloud, RefreshCw, LogOut, Plus, X, Settings, ShieldAlert, Edit2
} from '@lucide/vue';

const emit = defineEmits(['data-updated']);

// Vehicles Fleet State
const vehicles = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const showAddVehicleModal = ref(false);
const showEditVehicleModal = ref(false);
const editingVehicle = ref<RecordEntry | null>(null);

// Forms State
const formVehicle = ref({
  nom: '',
  type_carburant: 'Gazole',
  immatriculation: '',
  kilometrage_initial: 0,
  is_active: true
});

const isImporting = ref(false);
const statusMessage = ref('');
const isError = ref(false);
const showConfirmClear = ref(false);
const isDbEmpty = ref(true);

const fuelsList = ["Gazole", "SP95", "SP98", "SP95-E10", "GPL", "Électrique", "Hybride"];

const checkDbStatus = async () => {
  const count = await db.records.count();
  isDbEmpty.value = count === 0;
};

const loadVehicles = async () => {
  isLoading.value = true;
  try {
    vehicles.value = await getVehiclesRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  checkSavedConnectionState();
  await checkDbStatus();
  await loadVehicles();

  try {
    await loadGoogleScript();
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '653086696352-sr6n7etmnkd49j1kao8osvgqc0f042hl.apps.googleusercontent.com';
    initializeGisClient(clientId, async (token) => {
      const success = await triggerGoogleDriveSync(token);
      if (success) {
        emit('data-updated');
        await checkDbStatus();
        await loadVehicles();
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
    await loadVehicles();
  }
};

// Add Vehicle
const handleAddVehicle = async () => {
  if (!formVehicle.value.nom.trim()) return;

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: VEHICLES_COL_ID,
      data: {
        nom: formVehicle.value.nom.trim(),
        type_carburant: formVehicle.value.type_carburant,
        immatriculation: formVehicle.value.immatriculation.trim(),
        kilometrage_initial: Number(formVehicle.value.kilometrage_initial) || 0,
        is_active: formVehicle.value.is_active
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddVehicleModal.value = false;
    formVehicle.value = { nom: '', type_carburant: 'Gazole', immatriculation: '', kilometrage_initial: 0, is_active: true };
    emit('data-updated');
    await loadVehicles();
    alert('Véhicule enregistré dans le garage !');
  } catch (err) {
    console.error(err);
  }
};

// Open Edit Vehicle Modal
const openEditModal = (item: RecordEntry) => {
  editingVehicle.value = item;
  formVehicle.value = {
    nom: item.data.nom || '',
    type_carburant: item.data.type_carburant || 'Gazole',
    immatriculation: item.data.immatriculation || '',
    kilometrage_initial: Number(item.data.kilometrage_initial) || 0,
    is_active: item.data.is_active !== false
  };
  showEditVehicleModal.value = true;
};

// Update Vehicle
const handleUpdateVehicle = async () => {
  if (!editingVehicle.value || !formVehicle.value.nom.trim()) return;

  try {
    await db.records.update(editingVehicle.value.id!, {
      data: {
        nom: formVehicle.value.nom.trim(),
        type_carburant: formVehicle.value.type_carburant,
        immatriculation: formVehicle.value.immatriculation.trim(),
        kilometrage_initial: Number(formVehicle.value.kilometrage_initial) || 0,
        is_active: formVehicle.value.is_active
      },
      updatedAt: Date.now()
    });

    showEditVehicleModal.value = false;
    editingVehicle.value = null;
    emit('data-updated');
    await loadVehicles();
    alert('Véhicule mis à jour !');
  } catch (err) {
    console.error(err);
  }
};

// Toggle active directly from list
const toggleActiveDirectly = async (item: RecordEntry) => {
  try {
    const currentVal = item.data.is_active !== false;
    await db.records.update(item.id!, {
      'data.is_active': !currentVal,
      updatedAt: Date.now()
    });
    emit('data-updated');
    await loadVehicles();
  } catch (err) {
    console.error(err);
  }
};

// Delete vehicle
const handleDeleteVehicle = async (id: string) => {
  if (!confirm('Supprimer définitivement ce véhicule du garage ? (Cela n\'effacera pas son historique de carburant/entretien)')) return;
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    emit('data-updated');
    await loadVehicles();
  } catch (err) {
    console.error(err);
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
    a.download = `bq-car-backup-${new Date().toISOString().split('T')[0]}.json`;
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
        await loadVehicles();
      } else {
        statusMessage.value = result.error || 'Échec de l\'importation.';
        isError.value = true;
      }
    } catch (err) {
      statusMessage.value = 'Fichier JSON corrompu.';
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
    await loadVehicles();
  } catch (err) {
    console.error(err);
  }
};
</script>

<template>
  <div class="settings-view">
    <div class="view-header">
      <div>
        <h2>🚗 Mon Garage & Options</h2>
        <p class="text-secondary">Enregistre de nouveaux véhicules, désactive les voitures vendues, et gère tes synchronisations Google Drive.</p>
      </div>
      <div class="view-actions">
        <button @click="showAddVehicleModal = true" class="btn btn-primary">
          <Plus :size="18" /> Ajouter un Véhicule
        </button>
      </div>
    </div>

    <div class="settings-grid">
      <!-- Left Column: Fleet Management -->
      <div class="left-col-settings">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Settings :size="18" class="text-primary" /> Flotte Automobile (Garage)</h3>
          
          <div v-if="isLoading" class="text-center py-4">
            <div class="spinner"></div>
          </div>

          <div v-else-if="vehicles.length === 0" class="empty-state card glass text-center py-4 text-muted">
            <ShieldAlert class="mx-auto mb-2 text-muted" :size="36" />
            <p>Ton garage est vide.</p>
            <button @click="showAddVehicleModal = true" class="btn btn-primary btn-sm mt-3">Saisir mon premier véhicule</button>
          </div>

          <div v-else class="vehicles-fleet-list">
            <div 
              v-for="v in vehicles" 
              :key="v.id" 
              class="vehicle-item-card"
              :class="{ 'inactive-v': v.data.is_active === false }"
            >
              <div class="v-card-header flex-row justify-between">
                <div>
                  <h4 class="v-name font-bold">{{ v.data.nom }}</h4>
                  <span class="v-immat text-xs text-muted" v-if="v.data.immatriculation">Plaque : {{ v.data.immatriculation }}</span>
                </div>
                <div class="v-actions flex-row">
                  <button @click="openEditModal(v)" class="icon-btn" title="Modifier">
                    <Edit2 :size="14" />
                  </button>
                  <button @click="handleDeleteVehicle(v.id!)" class="icon-btn delete-btn" title="Supprimer">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>

              <div class="v-card-body flex-row gap-4 mt-3 flex-wrap">
                <span class="badge badge-primary">{{ v.data.type_carburant }}</span>
                <span class="badge badge-warning">Km initial : {{ Number(v.data.kilometrage_initial).toLocaleString('fr') }} km</span>
                
                <div class="active-toggle ml-auto flex-row">
                  <label class="switch">
                    <input 
                      type="checkbox" 
                      :checked="v.data.is_active !== false" 
                      @change="toggleActiveDirectly(v)" 
                    />
                    <span class="slider"></span>
                  </label>
                  <span class="active-lbl text-xs font-bold" :class="v.data.is_active !== false ? 'text-success' : 'text-danger'">
                    {{ v.data.is_active !== false ? 'Véhicule Actif' : 'Vendu / Inactif' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Cloud Sync and Maintenance Actions -->
      <div class="right-col-settings">
        <!-- Cloud Sync Card -->
        <div class="card glass mb-4">
          <div class="card-header flex-row gap-2">
            <Cloud class="text-primary" :size="20" />
            <h3 class="font-bold">Sauvegarde Google Drive</h3>
          </div>

          <div class="sync-actions-box mt-4">
            <div v-if="!isDriveConnected" class="drive-inactive-box text-center py-2">
              <p class="text-secondary text-sm mb-3">Connecte ton compte Google Drive pour synchroniser ta consommation.</p>
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

    <!-- Modal : Add Vehicle -->
    <div v-if="showAddVehicleModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>🚗 Enregistrer un Nouveau Véhicule</h3>
          <button @click="showAddVehicleModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom du véhicule (Constructeur / Modèle) *</label>
            <input v-model="formVehicle.nom" type="text" placeholder="Ex: 308 SW, Twingo" class="input" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Type de Carburant *</label>
              <select v-model="formVehicle.type_carburant" class="select">
                <option v-for="f in fuelsList" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Kilométrage initial à l'achat (km) *</label>
              <input v-model="formVehicle.kilometrage_initial" type="number" min="0" placeholder="Ex: 124000" class="input" />
            </div>
          </div>

          <div class="form-group">
            <label>Immatriculation (optionnelle)</label>
            <input v-model="formVehicle.immatriculation" type="text" placeholder="Ex: AA-123-BB" class="input" />
          </div>

          <div class="form-group mt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="formVehicle.is_active" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold text-sm">Véhicule Actif</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddVehicleModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddVehicle" class="btn btn-primary" :disabled="!formVehicle.nom.trim()">
            Créer le véhicule
          </button>
        </div>
      </div>
    </div>

    <!-- Modal : Edit Vehicle -->
    <div v-if="showEditVehicleModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>✏️ Modifier le Véhicule</h3>
          <button @click="showEditVehicleModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom du véhicule *</label>
            <input v-model="formVehicle.nom" type="text" placeholder="Ex: 308 SW, Twingo" class="input" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Type de Carburant *</label>
              <select v-model="formVehicle.type_carburant" class="select">
                <option v-for="f in fuelsList" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Kilométrage initial à l'achat (km) *</label>
              <input v-model="formVehicle.kilometrage_initial" type="number" min="0" placeholder="Ex: 124000" class="input" />
            </div>
          </div>

          <div class="form-group">
            <label>Immatriculation (optionnelle)</label>
            <input v-model="formVehicle.immatriculation" type="text" placeholder="Ex: AA-123-BB" class="input" />
          </div>

          <div class="form-group mt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="formVehicle.is_active" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold text-sm">Véhicule Actif</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showEditVehicleModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleUpdateVehicle" class="btn btn-primary" :disabled="!formVehicle.nom.trim()">
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

.vehicles-fleet-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.vehicle-item-card {
  border: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
  padding: 1rem;
  transition: var(--transition);
  
  &.inactive-v {
    opacity: 0.55;
    background-color: rgba(30, 41, 59, 0.2);
    border-color: rgba(239, 68, 68, 0.15);
  }
}

.v-card-header {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
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

.active-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.active-lbl {
  width: 100px;
}

.text-success { color: var(--color-accent) !important; }
.text-danger { color: var(--color-danger) !important; }

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

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.cursor-pointer {
  cursor: pointer;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.ml-auto {
  margin-left: auto;
}

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.font-bold { font-weight: 700; }
.text-center { text-align: center; }

.spinner {
  width: 32px;
  height: 32px;
  border: 4px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
