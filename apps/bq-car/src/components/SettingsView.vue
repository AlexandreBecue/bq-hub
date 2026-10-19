<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { generateDemoData, VEHICLES_COL_ID, getVehiclesRecords } from '../db/queries';
import { syncEngine } from '../db/google-drive';
import BaseSettings from '@bq/theme/BaseSettings.vue';
import { Plus, X, Edit2, Trash2, ShieldAlert, Settings, Check } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

const vehicles = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const showAddVehicleModal = ref(false);
const showEditVehicleModal = ref(false);
const editingVehicle = ref<RecordEntry | null>(null);

const formVehicle = ref({
  nom: '',
  type_carburant: 'Gazole',
  immatriculation: '',
  kilometrage_initial: '',
  is_active: true
});

const fuelsList = ["Gazole", "SP95", "SP98", "SP95-E10", "GPL", "Électrique", "Hybride"];

const isDbEmpty = ref(true);
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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

const handleDataUpdated = async () => {
  await checkDbStatus();
  await loadVehicles();
  emit('data-updated');
};

const handleClearDatabaseLocal = async () => {
  await checkDbStatus();
  await loadVehicles();
  emit('data-updated');
};

onMounted(async () => {
  await checkDbStatus();
  await loadVehicles();
});

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
    formVehicle.value = { nom: '', type_carburant: 'Gazole', immatriculation: '', kilometrage_initial: '', is_active: true };
    emit('data-updated');
    await loadVehicles();
    toast.success('Véhicule enregistré dans le garage !');
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
    kilometrage_initial: String(item.data.kilometrage_initial || '0'),
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
  } catch (err) {
    console.error(err);
  }
};

// Toggle Active direct from list
const toggleActiveDirectly = async (item: RecordEntry) => {
  try {
    const nextActive = item.data.is_active === false;
    await db.records.update(item.id!, {
      'data.is_active': nextActive,
      updatedAt: Date.now()
    });
    emit('data-updated');
    await loadVehicles();
  } catch (err) {
    console.error(err);
  }
};

// Delete Vehicle
const handleDeleteVehicle = async (id: string) => {
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
    exportFileNamePrefix="bq-car"
    @data-updated="handleDataUpdated"
    @clear-database="handleClearDatabaseLocal"
    @generate-demo="handleGenerateDemo"
  >
    <!-- Custom content slot: Fleet Management -->
    <div class="custom-settings-content">
      <div class="view-header">
        <div>
          <h2>Garage</h2>
          <p class="text-sub">Gère ta flotte de véhicules actifs, modifie leurs caractéristiques ou vends-les de ta liste d'outils.</p>
        </div>
        <button @click="showAddVehicleModal = true" class="btn btn-primary flex-row">
          <Plus :size="16" /> Enregistrer un véhicule
        </button>
      </div>

      <!-- Fleet Management Card (Full Width) -->
      <div class="card glass w-100">
        <h3 class="font-bold mb-4"><Settings :size="18" /> Véhicules</h3>
        
        <div v-if="isLoading" class="text-center py-4">
          <div class="spinner"></div>
        </div>

        <div v-else-if="vehicles.length === 0" class="empty-state text-center py-4 text-muted">
          <ShieldAlert class="mx-auto mb-2 text-muted" :size="36" />
          <p class="text-sm">Ton garage est vide pour le moment.</p>
          <button @click="showAddVehicleModal = true" class="btn btn-neutral btn-edit btn-sm mt-3">Saisir mon premier véhicule</button>
        </div>

        <div v-else class="vehicles-fleet-grid">
          <div 
            v-for="v in vehicles" 
            :key="v.id" 
            class="vehicle-item-card card glass"
            :class="{ 'inactive-v': v.data.is_active === false }"
          >
            <div class="v-card-header flex-row justify-between">
              <div>
                <h4 class="v-name font-bold text-sm">{{ v.data.nom }}</h4>
                <span class="v-immat text-xs text-muted block mt-1" v-if="v.data.immatriculation">Plaque : {{ v.data.immatriculation }}</span>
              </div>
              <div class="v-actions flex-row gap-2">
                <button @click="openEditModal(v)" class="action-btn edit" title="Modifier"><Edit2 :size="14" /></button>
                <button @click="handleDeleteVehicle(v.id!)" class="action-btn delete" title="Supprimer"><Trash2 :size="14" /></button>
              </div>
            </div>

            <div class="v-card-body flex-row gap-4 mt-3 flex-wrap align-center justify-between">
              <div class="flex-row gap-2">
                <span class="badge badge-primary text-xs">{{ v.data.type_carburant }}</span>
                <span class="badge badge-warning text-xs">{{ Number(v.data.kilometrage_initial).toLocaleString('fr') }} km</span>
              </div>
              
              <div class="active-toggle flex-row align-center gap-2">
                <label class="switch-toggle">
                  <input 
                    type="checkbox" 
                    :checked="v.data.is_active !== false" 
                    @change="toggleActiveDirectly(v)" 
                    class="active-checkbox" />
                  <span class="slider"></span>
                </label>
                <span class="active-lbl text-xs font-bold" :style="{ color: v.data.is_active !== false ? 'var(--color-success)' : 'var(--color-danger)' }">
                  {{ v.data.is_active !== false ? 'Actif' : 'Vendu' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseSettings>

  <!-- Modals Layer -->
  <Teleport to="body">
    <!-- Modal : Add Vehicle -->
    <div v-if="showAddVehicleModal" class="modal-overlay" @click.self="showAddVehicleModal = false">
      <div class="modal-container card glass fade-in">
        <div class="modal-header">
          <h3>Enregistrer un nouveau véhicule</h3>
          <button @click="showAddVehicleModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group mb-3">
            <label class="text-xs font-bold text-sub mb-1">Nom du véhicule (Constructeur / Modèle) *</label>
            <input v-model="formVehicle.nom" type="text" placeholder="Ex: 308 SW, Twingo" class="input" />
          </div>

          <div class="form-grid mb-3">
            <div class="form-group">
              <label class="text-xs font-bold text-sub mb-1">Type de Carburant *</label>
              <select v-model="formVehicle.type_carburant" class="select">
                <option v-for="f in fuelsList" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="text-xs font-bold text-sub mb-1">Plaque (Immatriculation)</label>
              <input v-model="formVehicle.immatriculation" type="text" placeholder="Ex: AA-123-BB" class="input" />
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="text-xs font-bold text-sub mb-1">Kilométrage initial à l'achat (km) *</label>
            <input v-model="formVehicle.kilometrage_initial" type="number" min="0" placeholder="Ex: 124000" class="input" />
          </div>
        </div>
        <div class="modal-footer pt-3 border-top flex-row justify-end gap-2">
          <button @click="showAddVehicleModal = false" class="btn btn-secondary btn-sm">Annuler</button>
          <button @click="handleAddVehicle" class="btn btn-neutral btn-edit btn-sm flex-row">
            <Check :size="16" /> Enregistrer
          </button>
        </div>
      </div>
    </div>

    <!-- Modal : Edit Vehicle -->
    <div v-if="showEditVehicleModal" class="modal-overlay" @click.self="showEditVehicleModal = false">
      <div class="modal-container card glass fade-in">
        <div class="modal-header">
          <h3>Modifier les détails du véhicule</h3>
          <button @click="showEditVehicleModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group mb-3">
            <label class="text-xs font-bold text-sub mb-1">Nom du véhicule *</label>
            <input v-model="formVehicle.nom" type="text" class="input" />
          </div>

          <div class="form-grid mb-3">
            <div class="form-group">
              <label class="text-xs font-bold text-sub mb-1">Type de Carburant *</label>
              <select v-model="formVehicle.type_carburant" class="select">
                <option v-for="f in fuelsList" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="text-xs font-bold text-sub mb-1">Plaque (Immatriculation)</label>
              <input v-model="formVehicle.immatriculation" type="text" class="input" />
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="text-xs font-bold text-sub mb-1">Kilométrage initial à l'achat (km) *</label>
            <input v-model="formVehicle.kilometrage_initial" type="number" min="0" class="input" />
          </div>

          <div class="form-group mb-3">
            <label class="checkbox-container text-xs font-bold text-sub cursor-pointer">
              <label class="switch-toggle"><input type="checkbox" v-model="formVehicle.is_active" class="active-checkbox" /><span class="slider"></span></label>
              <span>Véhicule actif (présent dans le garage)</span>
            </label>
          </div>
        </div>
        <div class="modal-footer pt-3 border-top flex-row justify-end gap-2">
          <button @click="showEditVehicleModal = false" class="btn btn-secondary btn-sm">Annuler</button>
          <button @click="handleUpdateVehicle" class="btn btn-primary btn-sm flex-row">
            <Check :size="16" /> Enregistrer les modifications
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.custom-settings-content {
  margin-top: 3rem;
  width: 100%;
}

.view-header {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-white) 6%, transparent);
  padding-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  width: 100%;
}

.vehicles-fleet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
}

.vehicle-item-card {
  background-color: color-mix(in srgb, var(--color-white) 1%, transparent) !important;
  border-color: color-mix(in srgb, var(--color-white) 5%, transparent);
  transition: border-color 0.2s;
}

.v-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
}

.v-name {
  font-size: 1.05rem;
  font-weight: 800;
  margin: 0;
}

.v-immat {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
  margin-top: 4px;
}

.v-actions {
  display: flex;
  gap: 0.5rem;
}

.edit-btn-color, .delete-btn-color {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  transition: var(--transition);
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.edit-btn-color:hover {
  color: var(--color-info);
  background-color: color-mix(in srgb, var(--color-info) 15%, transparent);
}

.delete-btn-color:hover {
  color: var(--color-danger);
  background-color: color-mix(in srgb, var(--color-danger) 15%, transparent);
}

.v-card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: 1rem;
  width: 100%;
}

.switch {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.active-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.active-lbl {
  font-size: 0.75rem;
}

.inactive-v {
  opacity: 0.5;
  border-color: color-mix(in srgb, var(--color-danger) 15%, transparent) !important;
}

.modal-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  inset: 0;
  background-color: color-mix(in srgb, var(--color-black) 50%, transparent);
  z-index: 1000;
}

.modal-container {
  width: 480px;
  max-width: 95vw;
  padding: 1.5rem !important;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.modal-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
}

.spinner {
  border: 3px solid color-mix(in srgb, var(--color-white) 5%, transparent);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  margin: 0 auto;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>