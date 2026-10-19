<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, type RecordEntry, generateId } from '../db/index';
import { generateDemoData, COMPTES_COL_ID, BUDGETS_COL_ID, getComptesRecords, getBudgetsRecords } from '../db/queries';
import { syncEngine } from '../db/google-drive';
import BaseSettings from '@bq/theme/BaseSettings.vue';
import { Plus, X, Edit2, Landmark, Mail, Trash2, Check } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

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
  type: 'Classique',
  is_active: true
});

const formBudget = ref({
  nom: '',
  plafond_mensuel: 100
});

const isDbEmpty = ref(true);
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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

const handleDataUpdated = async () => {
  await checkDbStatus();
  await loadSettingsData();
  emit('data-updated');
};

const handleClearDatabaseLocal = async () => {
  await checkDbStatus();
  await loadSettingsData();
  emit('data-updated');
};

onMounted(async () => {
  await checkDbStatus();
  await loadSettingsData();
});

// Add Account
const handleAddCompte = async () => {
  if (!formCompte.value.nom.trim()) return;

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: COMPTES_COL_ID,
      data: {
        nom: formCompte.value.nom.trim(),
        type: formCompte.value.type,
        is_active: formCompte.value.is_active,
        solde_initial: 0
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddCompteModal.value = false;
    formCompte.value = { nom: '', type: 'Classique', is_active: true };
    emit('data-updated');
    await loadSettingsData();
    toast.success('Compte bancaire ajouté !');
  } catch (err) {
    console.error(err);
  }
};

// Open Edit Account Modal
const openEditCompte = (item: RecordEntry) => {
  editingCompte.value = item;
  formCompte.value = {
    nom: item.data.nom || '',
    type: item.data.type || 'Classique',
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
        type: formCompte.value.type,
        is_active: formCompte.value.is_active,
        solde_initial: Number(editingCompte.value.data.solde_initial) || 0
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

// Delete Account
const handleDeleteCompte = async (id: string) => {
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
    toast.success('Enveloppe budgétaire ajoutée !');
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

const handleGenerateDemo = async () => {
  await generateDemoData();
  await checkDbStatus();
  emit('data-updated');
};
</script>

<template>
  <!-- Render the shared settings base and place accounts/budgets in the custom slot! -->
  <BaseSettings
    :db="db"
    :syncEngine="syncEngine"
    :clientId="clientId"
    :isDbEmpty="isDbEmpty"
    exportFileNamePrefix="bq-bank"
    @data-updated="handleDataUpdated"
    @clear-database="handleClearDatabaseLocal"
    @generate-demo="handleGenerateDemo"
  >
    <!-- Custom content slot: Wallet and Envelopes Management -->
    <div class="custom-settings-content mt-5">
      <div class="view-header mb-4 pb-4 settings-header">
        <h2>Comptes & Enveloppes</h2>
        <p class="text-sub">Configure tes comptes courants, d'épargne ou liquide, et définis les plafonds budgétaires mensuels de tes dépenses.</p>
      </div>

      <div class="settings-grid">
        <!-- Accounts Card -->
        <div class="card glass">
          <div class="card-header flex-row justify-between align-center w-100">
            <div class="flex-row gap-2">
              <Landmark :size="20" />
              <h3 class="font-bold">Comptes bancaires</h3>
            </div>
            <button @click="showAddCompteModal = true" class="btn btn-primary btn-xs flex-row">
              <Plus :size="12" /> Ajouter
            </button>
          </div>

          <div v-if="comptes.length === 0" class="empty-state text-center py-4 text-muted text-xs">
            Aucun compte bancaire enregistré.
          </div>

          <div v-else class="items-settings-list flex-col gap-2 mt-4">
            <div v-for="c in comptes" :key="c.id" class="settings-list-item flex-row justify-between align-center pt-2 pb-2 pl-3 pr-3">
              <div>
                <span class="font-bold text-sm" :class="{ 'text-muted': c.data.is_active === false }">
                  {{ c.data.nom }}
                </span>
                <span class="badge text-xs ml-2" :class="c.data.type === 'Épargne' ? 'badge-yellow' : c.data.type === 'Investissement' ? 'badge-purple' : 'badge-primary'">{{ c.data.type }}</span>
              </div>
              <div class="flex-row gap-2">
                <button @click="openEditCompte(c)" class="action-btn edit" title="Modifier"><Edit2 :size="14" /></button>
                <button @click="handleDeleteCompte(c.id!)" class="action-btn delete" title="Supprimer"><Trash2 :size="14" /></button>
              </div>
            </div>
          </div>
        </div>

        <!-- Budgets Card -->
        <div class="card glass">
          <div class="card-header flex-row justify-between align-center w-100">
            <div class="flex-row gap-2">
              <Mail :size="20" />
              <h3 class="font-bold">Enveloppes budgétaires</h3>
            </div>
            <button @click="showAddBudgetModal = true" class="btn btn-primary btn-xs flex-row">
              <Plus :size="12" /> Ajouter
            </button>
          </div>

          <div v-if="budgets.length === 0" class="empty-state text-center py-4 text-muted text-xs">
            Aucun budget enveloppe configuré.
          </div>

          <div v-else class="items-settings-list flex-col gap-2 mt-4">
            <div v-for="b in budgets" :key="b.id" class="settings-list-item flex-row justify-between align-center pt-2 pb-2 pl-3 pr-3">
              <div>
                <span class="font-bold text-sm">{{ b.data.nom }}</span>
                <span class="badge badge-primary text-xs ml-2">{{ b.data.plafond_mensuel.toFixed(2) }} € / mois</span>
              </div>
              <div class="flex-row gap-2">
                <button @click="openEditBudgetModal(b)" class="action-btn edit" title="Modifier"><Edit2 :size="14" /></button>
                <button @click="handleDeleteBudget(b.id!)" class="action-btn delete" title="Supprimer"><Trash2 :size="14" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseSettings>

  <!-- Modals Layer -->
  <Teleport to="body">
    <!-- Add Account Modal -->
    <div v-if="showAddCompteModal" class="modal-overlay" @click.self="showAddCompteModal = false">
      <div class="modal-container card glass fade-in modal-settings-container">
        <div class="modal-header">
          <h3 class="font-bold text-md m-0">Ajouter un compte</h3>
          <button @click="showAddCompteModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group mb-4">
            <label class="text-xs font-bold text-sub mb-1">Nom du compte *</label>
            <input v-model="formCompte.nom" type="text" class="input" placeholder="Ex: Compte Courant, Livret A, Cash" />
          </div>
          <div class="form-group mb-4">
            <label class="text-xs font-bold text-sub mb-1">Type de compte</label>
            <select v-model="formCompte.type" class="select">
              <option value="Classique">Classique</option>
              <option value="Épargne">Épargne</option>
              <option value="Investissement">Investissement</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddCompteModal = false" class="btn btn-secondary btn-sm">Annuler</button>
          <button @click="handleAddCompte" class="btn btn-neutral btn-edit btn-sm flex-row">
            <Check :size="16" /> Enregistrer
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Account Modal -->
    <div v-if="showEditCompteModal" class="modal-overlay" @click.self="showEditCompteModal = false">
      <div class="modal-container card glass fade-in modal-settings-container">
        <div class="modal-header">
          <h3 class="font-bold text-md m-0">Modifier le compte</h3>
          <button @click="showEditCompteModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group mb-4">
            <label class="text-xs font-bold text-sub mb-1">Nom du compte *</label>
            <input v-model="formCompte.nom" type="text" class="input" />
          </div>
          <div class="form-group mb-4">
            <label class="text-xs font-bold text-sub mb-1">Type de compte</label>
            <select v-model="formCompte.type" class="select">
              <option value="Classique">Classique</option>
              <option value="Épargne">Épargne</option>
              <option value="Investissement">Investissement</option>
            </select>
          </div>
          <div class="form-group mb-4">
            <label class="checkbox-container text-xs font-bold text-sub cursor-pointer flex-row align-center gap-2 checkbox-label">
              <input type="checkbox" v-model="formCompte.is_active" class="checkbox-input" />
              <span>Compte actif</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showEditCompteModal = false" class="btn btn-secondary btn-sm">Annuler</button>
          <button @click="handleUpdateCompte" class="btn btn-neutral btn-edit btn-sm flex-row">
            <Check :size="16" /> Enregistrer
          </button>
        </div>
      </div>
    </div>

    <!-- Add Budget Modal -->
    <div v-if="showAddBudgetModal" class="modal-overlay" @click.self="showAddBudgetModal = false">
      <div class="modal-container card glass fade-in modal-settings-container">
        <div class="modal-header">
          <h3 class="font-bold text-md m-0">Créer une enveloppe</h3>
          <button @click="showAddBudgetModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group mb-4">
            <label class="text-xs font-bold text-sub mb-1">Nom de l'enveloppe *</label>
            <input v-model="formBudget.nom" type="text" class="input" placeholder="Ex: Courses, Shopping, Loisirs" />
          </div>
          <div class="form-group mb-4">
            <label class="text-xs font-bold text-sub mb-1">Plafond mensuel (€) *</label>
            <input v-model="formBudget.plafond_mensuel" type="number" class="input" />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddBudgetModal = false" class="btn btn-secondary btn-sm">Annuler</button>
          <button @click="handleAddBudget" class="btn btn-primary btn-sm flex-row">
            <Check :size="16" /> Enregistrer
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Budget Modal -->
    <div v-if="showEditBudgetModal" class="modal-overlay" @click.self="showEditBudgetModal = false">
      <div class="modal-container card glass fade-in modal-settings-container">
        <div class="modal-header">
          <h3 class="font-bold text-md m-0">Modifier l'enveloppe</h3>
          <button @click="showEditBudgetModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group mb-4">
            <label class="text-xs font-bold text-sub mb-1">Nom de l'enveloppe *</label>
            <input v-model="formBudget.nom" type="text" class="input" />
          </div>
          <div class="form-group mb-4">
            <label class="text-xs font-bold text-sub mb-1">Plafond mensuel (€) *</label>
            <input v-model="formBudget.plafond_mensuel" type="number" class="input" />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showEditBudgetModal = false" class="btn btn-secondary btn-sm">Annuler</button>
          <button @click="handleUpdateBudget" class="btn btn-primary btn-sm flex-row">
            <Check :size="16" /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
  align-items: start;
  width: 100%;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.settings-header {
  border-bottom: 1px solid color-mix(in srgb, var(--color-white) 6%, transparent);
}

.settings-list-item {
  background-color: color-mix(in srgb, var(--color-white) 1%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-white) 5%, transparent);
  border-radius: var(--radius-sm);
}

.modal-settings-container {
  max-width: 400px;
  padding: 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}
</style>
