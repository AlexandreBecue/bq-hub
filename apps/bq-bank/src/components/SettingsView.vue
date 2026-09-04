<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, importDatabase, exportDatabase, generateId, type RecordEntry } from '../db/index';
import { COMPTES_COL_ID, BUDGETS_COL_ID, getComptesRecords, getBudgetsRecords } from '../db/queries';
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
  Cloud, RefreshCw, LogOut, Plus, X, Edit2, Landmark, Tag
} from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const comptes = ref<RecordEntry[]>([]);
const budgets = ref<RecordEntry[]>([]);
const isLoading = ref(true);

// Modals State
const showAddCompteModal = ref(false);
const showEditCompteModal = ref(false);
const editingCompte = ref<RecordEntry | null>(null);

const showAddBudgetModal = ref(false);
const showEditBudgetModal = ref(false);
const editingBudget = ref<RecordEntry | null>(null);

// Forms State
const formCompte = ref({
  nom: '',
  solde_initial: 0,
  is_active: true
});

const formBudget = ref({
  nom: '',
  plafond_mensuel: 100
});

const isImporting = ref(false);
const statusMessage = ref('');
const isError = ref(false);
const showConfirmClear = ref(false);
const isDbEmpty = ref(true);

const checkDbStatus = async () => {
  const count = await db.records.count();
  isDbEmpty.value = count === 0;
};

const loadSettingsData = async () => {
  isLoading.value = true;
  try {
    comptes.value = await getComptesRecords();
    budgets.value = await getBudgetsRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  checkSavedConnectionState();
  await checkDbStatus();
  await loadSettingsData();

  try {
    await loadGoogleScript();
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '653086696352-sr6n7etmnkd49j1kao8osvgqc0f042hl.apps.googleusercontent.com';
    initializeGisClient(clientId, async (token) => {
      const success = await triggerGoogleDriveSync(token);
      if (success) {
        emit('data-updated');
        await checkDbStatus();
        await loadSettingsData();
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
    await loadSettingsData();
  }
};

// Add Account
const handleAddCompte = async () => {
  if (!formCompte.value.nom.trim()) return;

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: COMPTES_COL_ID,
      data: {
        nom: formCompte.value.nom.trim(),
        solde_initial: Number(formCompte.value.solde_initial) || 0,
        is_active: formCompte.value.is_active
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddCompteModal.value = false;
    formCompte.value = { nom: '', solde_initial: 0, is_active: true };
    emit('data-updated');
    await loadSettingsData();
    alert('Compte bancaire ajouté !');
  } catch (err) {
    console.error(err);
  }
};

// Open Edit Account Modal
const openEditCompteModal = (item: RecordEntry) => {
  editingCompte.value = item;
  formCompte.value = {
    nom: item.data.nom || '',
    solde_initial: Number(item.data.solde_initial) || 0,
    is_active: item.data.is_active !== false
  };
  showEditCompteModal.value = true;
};

// Update Account
const handleUpdateCompte = async () => {
  if (!editingCompte.value || !formCompte.value.nom.trim()) return;

  try {
    await db.records.update(editingCompte.value.id!, {
      data: {
        nom: formCompte.value.nom.trim(),
        solde_initial: Number(formCompte.value.solde_initial) || 0,
        is_active: formCompte.value.is_active
      },
      updatedAt: Date.now()
    });

    showEditCompteModal.value = false;
    editingCompte.value = null;
    emit('data-updated');
    await loadSettingsData();
  } catch (err) {
    console.error(err);
  }
};

const toggleCompteActive = async (item: RecordEntry) => {
  try {
    const currentVal = item.data.is_active !== false;
    await db.records.update(item.id!, {
      'data.is_active': !currentVal,
      updatedAt: Date.now()
    });
    emit('data-updated');
    await loadSettingsData();
  } catch (err) {
    console.error(err);
  }
};

// Delete Account
const handleDeleteCompte = async (id: string) => {
  if (!confirm('Supprimer définitivement ce compte ? (Cela n\'effacera pas ses transactions dans l\'historique)')) return;
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    emit('data-updated');
    await loadSettingsData();
  } catch (err) {
    console.error(err);
  }
};

// Add Budget Envelope
const handleAddBudget = async () => {
  if (!formBudget.value.nom.trim()) return;

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: BUDGETS_COL_ID,
      data: {
        nom: formBudget.value.nom.trim(),
        plafond_mensuel: Number(formBudget.value.plafond_mensuel) || 0
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddBudgetModal.value = false;
    formBudget.value = { nom: '', plafond_mensuel: 100 };
    emit('data-updated');
    await loadSettingsData();
    alert('Enveloppe budgétaire ajoutée !');
  } catch (err) {
    console.error(err);
  }
};

// Open Edit Budget Modal
const openEditBudgetModal = (item: RecordEntry) => {
  editingBudget.value = item;
  formBudget.value = {
    nom: item.data.nom || '',
    plafond_mensuel: Number(item.data.plafond_mensuel) || 0
  };
  showEditBudgetModal.value = true;
};

// Update Budget Envelope
const handleUpdateBudget = async () => {
  if (!editingBudget.value || !formBudget.value.nom.trim()) return;

  try {
    await db.records.update(editingBudget.value.id!, {
      data: {
        nom: formBudget.value.nom.trim(),
        plafond_mensuel: Number(formBudget.value.plafond_mensuel) || 0
      },
      updatedAt: Date.now()
    });

    showEditBudgetModal.value = false;
    editingBudget.value = null;
    emit('data-updated');
    await loadSettingsData();
  } catch (err) {
    console.error(err);
  }
};

// Delete Budget Envelope
const handleDeleteBudget = async (id: string) => {
  if (!confirm('Supprimer définitivement cette enveloppe budgétaire ?')) return;
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    emit('data-updated');
    await loadSettingsData();
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
    a.download = `bq-bank-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    statusMessage.value = 'Sauvegarde exportée !';
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
        statusMessage.value = 'Données importées !';
        isError.value = false;
        emit('data-updated');
        await checkDbStatus();
        await loadSettingsData();
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
    statusMessage.value = 'Application vidée !';
    isError.value = false;
    emit('data-updated');
    await checkDbStatus();
    await loadSettingsData();
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
        <p class="text-secondary">Gère tes comptes bancaires, tes enveloppes budgétaires, et active la synchronisation de tes finances.</p>
      </div>
    </div>

    <div class="settings-grid">
      <!-- Left Column: Accounts & Budgets lists -->
      <div class="left-col-settings">
        <!-- Accounts manager -->
        <div class="card glass mb-4">
          <div class="comptes-list-header flex-row justify-between mb-4">
            <h3 class="font-bold flex-row"><Landmark :size="18" class="text-primary" /> Gestion des Comptes</h3>
            <button @click="showAddCompteModal = true" class="btn btn-primary btn-sm"><Plus :size="14" /> Nouveau Compte</button>
          </div>

          <div v-if="comptes.length === 0" class="text-muted text-center py-4 text-sm">
            <p>Aucun compte bancaire.</p>
          </div>

          <div v-else class="fleet-list">
            <div v-for="c in comptes" :key="c.id" class="fleet-item-card" :class="{ 'inactive-v': c.data.is_active === false }">
              <div class="v-card-header flex-row justify-between">
                <div>
                  <h4 class="v-name font-bold">{{ c.data.nom }}</h4>
                  <span class="text-xs text-muted">Solde initial : {{ Number(c.data.solde_initial).toFixed(2) }} €</span>
                </div>
                <div class="v-actions flex-row">
                  <button @click="openEditCompteModal(c)" class="icon-btn" title="Modifier"><Edit2 :size="14" /></button>
                  <button @click="handleDeleteCompte(c.id!)" class="icon-btn delete-btn" title="Supprimer"><Trash2 :size="14" /></button>
                </div>
              </div>

              <div class="v-card-body flex-row justify-between mt-3">
                <span class="badge" :class="c.data.is_active !== false ? 'badge-success' : 'badge-danger'">
                  {{ c.data.is_active !== false ? 'Actif' : 'Inactif' }}
                </span>
                
                <div class="active-toggle flex-row">
                  <label class="switch">
                    <input type="checkbox" :checked="c.data.is_active !== false" @change="toggleCompteActive(c)" />
                    <span class="slider"></span>
                  </label>
                  <span class="active-lbl text-xs font-bold" :class="c.data.is_active !== false ? 'text-success' : 'text-danger'">
                    {{ c.data.is_active !== false ? 'Actif' : 'Archivé' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Budgets manager -->
        <div class="card glass">
          <div class="comptes-list-header flex-row justify-between mb-4">
            <h3 class="font-bold flex-row"><Tag :size="18" class="text-accent" /> Enveloppes Budgétaires</h3>
            <button @click="showAddBudgetModal = true" class="btn btn-accent btn-sm"><Plus :size="14" /> Nouvelle Enveloppe</button>
          </div>

          <div v-if="budgets.length === 0" class="text-muted text-center py-4 text-sm">
            <p>Aucune enveloppe budgétaire.</p>
          </div>

          <div v-else class="fleet-list">
            <div v-for="b in budgets" :key="b.id" class="fleet-item-card">
              <div class="v-card-header flex-row justify-between">
                <div>
                  <h4 class="v-name font-bold">{{ b.data.nom }}</h4>
                  <span class="text-xs text-muted">Plafond mensuel : <strong class="text-primary">{{ Number(b.data.plafond_mensuel).toFixed(2) }} €</strong></span>
                </div>
                <div class="v-actions flex-row">
                  <button @click="openEditBudgetModal(b)" class="icon-btn" title="Modifier"><Edit2 :size="14" /></button>
                  <button @click="handleDeleteBudget(b.id!)" class="icon-btn delete-btn" title="Supprimer"><Trash2 :size="14" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Cloud sync and raw operations -->
      <div class="right-col-settings">
        <!-- Cloud Sync Card -->
        <div class="card glass mb-4">
          <div class="card-header flex-row gap-2">
            <Cloud class="text-primary" :size="20" />
            <h3 class="font-bold">Sauvegarde Google Drive</h3>
          </div>

          <div class="sync-actions-box mt-4">
            <div v-if="!isDriveConnected" class="drive-inactive-box text-center py-2">
              <p class="text-secondary text-sm mb-3">Connecte ton compte Google Drive pour synchroniser tes finances.</p>
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

    <!-- Modals : Add/Edit Account -->
    <div v-if="showAddCompteModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>🏦 Nouveau Compte Bancaire</h3>
          <button @click="showAddCompteModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom du compte bancaire *</label>
            <input v-model="formCompte.nom" type="text" placeholder="Ex: Livret A, Compte Courant, PayPal" class="input" />
          </div>

          <div class="form-group">
            <label>Solde Initial (€) *</label>
            <input v-model="formCompte.solde_initial" type="number" step="0.01" class="input" />
          </div>

          <div class="form-group mt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="formCompte.is_active" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold text-sm">Compte Actif</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddCompteModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddCompte" class="btn btn-primary" :disabled="!formCompte.nom.trim()">
            Créer le compte
          </button>
        </div>
      </div>
    </div>

    <div v-if="showEditCompteModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>✏️ Modifier le Compte</h3>
          <button @click="showEditCompteModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom du compte *</label>
            <input v-model="formCompte.nom" type="text" placeholder="Ex: Livret A, Compte Courant" class="input" />
          </div>

          <div class="form-group">
            <label>Solde Initial (€) *</label>
            <input v-model="formCompte.solde_initial" type="number" step="0.01" class="input" />
          </div>

          <div class="form-group mt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="formCompte.is_active" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold text-sm">Compte Actif</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showEditCompteModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleUpdateCompte" class="btn btn-primary" :disabled="!formCompte.nom.trim()">
            Enregistrer
          </button>
        </div>
      </div>
    </div>

    <!-- Modals : Add/Edit Budget Envelope -->
    <div v-if="showAddBudgetModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>🏷️ Nouvelle Enveloppe Budgétaire</h3>
          <button @click="showAddBudgetModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom de l'enveloppe / Catégorie *</label>
            <input v-model="formBudget.nom" type="text" placeholder="Ex: Courses, Loisirs, Transport" class="input" />
          </div>

          <div class="form-group">
            <label>Plafond Mensuel (€) *</label>
            <input v-model="formBudget.plafond_mensuel" type="number" step="1" class="input" />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddBudgetModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddBudget" class="btn btn-primary" :disabled="!formBudget.nom.trim()">
            Créer l'enveloppe
          </button>
        </div>
      </div>
    </div>

    <div v-if="showEditBudgetModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>✏️ Modifier l'Enveloppe Budgétaire</h3>
          <button @click="showEditBudgetModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom de l'enveloppe *</label>
            <input v-model="formBudget.nom" type="text" placeholder="Ex: Courses, Loisirs" class="input" />
          </div>

          <div class="form-group">
            <label>Plafond Mensuel (€) *</label>
            <input v-model="formBudget.plafond_mensuel" type="number" step="1" class="input" />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showEditBudgetModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleUpdateBudget" class="btn btn-primary" :disabled="!formBudget.nom.trim()">
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

.fleet-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fleet-item-card {
  border: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
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
  width: 80px;
}

.text-success { color: #34d399 !important; }
.text-danger { color: #f87171 !important; }

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
