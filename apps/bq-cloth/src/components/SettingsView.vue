<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  TENUES_TYPES_COL_ID,
  CONTEXTS_COL_ID,
  getClothesRecords,
  getTenuesTypesRecords,
  getContextsRecords,
  generateDemoData
} from '../db/queries';
import { syncEngine } from '../db/google-drive';
import BaseSettings from '@bq/theme/BaseSettings.vue';
import { 
  Plus, Sparkles, X, Settings, Thermometer, Tag, Trash2, Check 
} from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

// Config State
const currentCity = ref(localStorage.getItem('bq-cloth-city') || 'Paris');
const dryingDelay = ref(Number(localStorage.getItem('bq-cloth-drying-delay') || '24'));

// Database State
const clothes = ref<RecordEntry[]>([]);
const tenuesTypes = ref<RecordEntry[]>([]);
const isDbEmpty = ref(true);

// Tenue Type Modal Form State
const showAddTenueTypeModal = ref(false);
const formTenueType = ref({
  nom: '',
  contexte: 'Bureau',
  temperature_ideale: 15,
  vetements_associes: [] as string[]
});

const contexts = computed(() => customContexts.value.map(c => String(c.data.nom || '')));
const customContexts = ref<RecordEntry[]>([]);
const newContextName = ref('');

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

watch(contexts, (newCtxs) => {
  if (newCtxs.length > 0 && !newCtxs.includes(formTenueType.value.contexte)) {
    formTenueType.value.contexte = newCtxs[0];
  }
});

const checkDbStatus = async () => {
  const count = await db.records.count();
  isDbEmpty.value = count === 0;
};

const loadClothesAndTenuesTypes = async () => {
  try {
    clothes.value = await getClothesRecords();
    tenuesTypes.value = await getTenuesTypesRecords();
    customContexts.value = await getContextsRecords();
  } catch (err) {
    console.error(err);
  }
};

const handleDataUpdated = async () => {
  await checkDbStatus();
  await loadClothesAndTenuesTypes();
  emit('data-updated');
};

const handleClearDatabaseLocal = async () => {
  await checkDbStatus();
  await loadClothesAndTenuesTypes();
  emit('data-updated');
};

const handleGenerateDemo = async () => {
  await generateDemoData();
  await checkDbStatus();
  emit('data-updated');
};

onMounted(async () => {
  await checkDbStatus();
  await loadClothesAndTenuesTypes();
});

// Save general preferences
const savePreferences = () => {
  localStorage.setItem('bq-cloth-city', currentCity.value);
  localStorage.setItem('bq-cloth-drying-delay', String(dryingDelay.value));
  toast.success('Préférences enregistrées avec succès !');
  emit('data-updated');
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
    formTenueType.value = { nom: '', contexte: contexts.value[0] || 'Bureau', temperature_ideale: 15, vetements_associes: [] };
    await loadClothesAndTenuesTypes();
    toast.success('Tenue type ajoutée !');
  } catch (err) {
    console.error(err);
  }
};

// Delete Typical Outfit Template
const handleDeleteTenueType = async (id: string) => {
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

// Custom Contexts Methods
const handleAddContext = async () => {
  const name = newContextName.value.trim();
  if (!name) return;
  if (contexts.value.includes(name)) {
    toast.warning('Ce contexte existe déjà !');
    return;
  }

  try {
    const newRec: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: CONTEXTS_COL_ID,
      data: { nom: name },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await db.records.add(newRec);
    newContextName.value = '';
    customContexts.value = await getContextsRecords();
    emit('data-updated');
  } catch (err) {
    console.error(err);
  }
};

const handleDeleteContext = async (id: string) => {
  if (customContexts.value.length <= 1) {
    toast.warning('Vous devez conserver au moins un contexte.');
    return;
  }
  const ctx = customContexts.value.find(c => c.id === id);
  if (!ctx) return;

  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    customContexts.value = await getContextsRecords();
    emit('data-updated');
  } catch (err) {
    console.error(err);
  }
};

const citiesList = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Nantes', 'Strasbourg', 'Lille', 'Nice', 'Montpellier'];
</script>

<template>
  <BaseSettings
    :db="db"
    :syncEngine="syncEngine"
    :clientId="clientId"
    :isDbEmpty="isDbEmpty"
    exportFileNamePrefix="bq-cloth"
    @data-updated="handleDataUpdated"
    @clear-database="handleClearDatabaseLocal"
    @generate-demo="handleGenerateDemo"
  >
    <!-- Custom content slot: Dressing & Contexts & Outfits Management -->
    <div class="custom-settings-content">
      <div class="view-header">
        <div>
          <h2>Configuration du dressing</h2>
          <p class="text-sub">Personnalise tes contextes d'usage de vêtements, configure tes associations d'outfits récurrentes et tes temps de séchage.</p>
        </div>
      </div>

      <div class="settings-grid">
        <!-- Left Column: Preferences & Custom Contexts -->
        <div class="left-col-settings flex-col gap-4 w-100">
          <!-- Preferences Card -->
          <div class="card glass">
            <h3 class="font-bold mb-4"><Settings :size="18" /> Préférences de l'application</h3>
            
            <div class="form-grid">
              <div class="form-group">
                <label class="text-xs font-bold text-sub mb-1">Ma ville (Météo)</label>
                <select v-model="currentCity" class="select">
                  <option v-for="c in citiesList" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>

              <div class="form-group">
                <label class="text-xs font-bold text-sub mb-1">Temps de séchage (Heures)</label>
                <input v-model="dryingDelay" type="number" min="1" max="168" class="input" />
              </div>
            </div>
            
            <p class="text-xs text-muted mt-2 mb-4 line-height-14">
              Le délai de séchage définit le nombre d'heures après lesquelles un habit fraîchement lavé redevient automatiquement marqué comme "Disponible".
            </p>

            <button @click="savePreferences" class="btn btn-primary w-100 height-38">Enregistrer les préférences</button>
          </div>

          <!-- Custom Contexts Manager Card -->
          <div class="card glass">
            <h3 class="font-bold mb-2"><Tag :size="18" /> Contextes d'usage</h3>
            <p class="text-muted text-xs mb-4">Personnalise les contextes d'usage de tes vêtements et tenues.</p>

            <div class="form-group flex-row gap-2 mb-4 w-100">
              <input v-model="newContextName" type="text" placeholder="Nouveau contexte..." class="input flex-grow-1" @keyup.enter="handleAddContext" />
              <button @click="handleAddContext" class="btn btn-primary flex-row align-center justify-center add-context-btn">
                <Plus :size="16" />
              </button>
            </div>

            <div class="contexts-badges-list flex-row flex-wrap gap-2 mt-2">
              <span v-for="c in customContexts" :key="c.id" class="badge badge-primary text-xs flex-row gap-1 align-center pt-1 pb-1 pl-2 pr-2">
                {{ c.data.nom }}
                <button @click="handleDeleteContext(c.id!)" class="action-btn delete p-0 ml-1 context-delete-btn" title="Supprimer">
                  <X :size="12" />
                </button>
              </span>
            </div>
          </div>
        </div>

        <!-- Right Column: Tenues Types Manager Card -->
        <div class="right-col-settings w-100">
          <div class="card glass w-100">
            <div class="tenues-types-header">
              <h3 class="font-bold m-0"><Sparkles :size="18" /> Associations (tenues types)</h3>
              <button @click="showAddTenueTypeModal = true" class="btn btn-primary btn-sm flex-row">
                <Plus :size="14" /> Nouvelle tenue type
              </button>
            </div>

            <div v-if="tenuesTypes.length === 0" class="text-muted text-center py-4">
              <p class="text-sm">Aucune association type enregistrée. Crée des associations favorites pour recevoir des suggestions intelligentes sur la page d'accueil.</p>
            </div>

            <div v-else class="tenues-types-list flex-col gap-3">
              <div v-for="tt in tenuesTypes" :key="tt.id" class="tt-item card glass pt-3 pb-3 pl-4 pr-4">
                <div class="tt-header flex-row justify-between align-start w-100">
                  <div>
                    <h4 class="font-bold text-sm m-0 tt-title">{{ tt.data.nom }}</h4>
                    <div class="tt-tags mt-1">
                      <span class="badge badge-primary text-xs align-center gap-1"><Tag :size="11" /> {{ tt.data.contexte }}</span>
                      <span class="badge badge-warning text-xs align-center gap-1"><Thermometer :size="11" /> {{ tt.data.temperature_ideale }}°C</span>
                    </div>
                  </div>
                  <button @click="handleDeleteTenueType(tt.id!)" class="action-btn delete" title="Supprimer"><Trash2 :size="14" /></button>
                </div>
                <div class="tt-garments mt-2 text-muted text-xs">
                  <strong>Composée de :</strong> 
                  {{ tt.data.vetements_associes.map((id: string) => clothes.find(c => c.id === id)?.data.nom || 'Vêtement inconnu').join(' + ') }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseSettings>

  <!-- Modals Layer -->
  <Teleport to="body">
    <!-- Modal : Add Tenue Type -->
    <div v-if="showAddTenueTypeModal" class="modal-overlay" @click.self="showAddTenueTypeModal = false">
      <div class="modal-container card glass fade-in">
        <div class="modal-header flex-row align-center justify-between mb-4">
          <h3>➕ Nouvelle Tenue Type</h3>
          <button @click="showAddTenueTypeModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group mb-4">
            <label class="text-xs font-bold text-sub block mb-1">Nom de la tenue type *</label>
            <input v-model="formTenueType.nom" type="text" placeholder="Ex: Chemise Lin & Chino Sable" class="input" />
          </div>

          <div class="form-grid mb-4">
            <div class="form-group">
              <label class="text-xs font-bold text-sub block mb-1">Contexte d'usage</label>
              <select v-model="formTenueType.contexte" class="select">
                <option v-for="ctx in contexts" :key="ctx" :value="ctx">{{ ctx }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="text-xs font-bold text-sub block mb-1">Température Idéale (°C)</label>
              <input v-model="formTenueType.temperature_ideale" type="number" class="input" />
            </div>
          </div>

          <div class="clothes-selector-box mt-4">
            <label class="font-bold text-xs text-sub mb-2 block">SÉLECTIONNE LES VÊTEMENTS DE CETTE TENUE *</label>
            
            <div class="tt-clothes-checklist">
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
          <span class="badge badge-primary text-xs pt-1 pb-1 pl-2 pr-2 modal-footer-badge" v-if="formTenueType.vetements_associes.length > 0">
            {{ formTenueType.vetements_associes.length }} vêtements associés
          </span>
          <button @click="showAddTenueTypeModal = false" class="btn btn-secondary btn-sm height-34">Annuler</button>
          <button @click="handleAddTenueType" class="btn btn-secondary btn-sm height-34" :disabled="!formTenueType.nom.trim() || formTenueType.vetements_associes.length === 0">
            Enregistrer
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

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
  width: 100%;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.height-38 {
  height: 38px;
}

.height-34 {
  height: 34px;
}

.line-height-14 {
  line-height: 1.4;
}

.add-context-btn {
  height: 38px;
  width: 38px;
  padding: 0;
  flex-shrink: 0;
}

.context-delete-btn {
  display: inline-flex;
  border: none;
  background: transparent;
  cursor: pointer;
  color: color-mix(in srgb, var(--color-white) 60%, transparent);
  padding-left: 2px;
}

.tenues-types-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-white) 6%, transparent);
  width: 100%;
}

.tenues-types-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tt-item {
  border: 1px solid var(--border-color);
  background-color: color-mix(in srgb, var(--color-white) 1%, transparent) !important;
  border-color: color-mix(in srgb, var(--color-white) 5%, transparent);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
}

.tt-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
}

.tt-title {
  font-size: 1.05rem;
  font-weight: 800;
}

.tt-tags {
  display: flex;
  gap: 0.35rem;
  margin-top: 4px;
}

.cursor-pointer {
  cursor: pointer;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: color-mix(in srgb, var(--color-black) 50%, transparent);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-container {
  width: 500px;
  max-width: 95vw;
  padding: 1.5rem !important;
}

.modal-close {
  background: transparent;
  border: none;
  cursor: pointer;
}

.tt-clothes-checklist {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--bg-primary) 30%, transparent);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem;
}

.garment-check-item {
  background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.6rem;
  font-size: 0.825rem;
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background-color: var(--border-hover);
    border-color: var(--border-hover);
  }
  
  &.checked {
    background-color: color-mix(in srgb, var(--color-success) 10%, transparent) !important;
    border-color: var(--color-accent) !important;
    
    .check-box {
      background-color: var(--color-accent) !important;
      border-color: var(--color-accent) !important;
    }
  }
}

.check-box {
  width: 18px;
  height: 18px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: color-mix(in srgb, var(--bg-primary) 60%, transparent);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-footer {
  border-top: 1px solid color-mix(in srgb, var(--color-white) 6%, transparent);
  margin-top: 1.5rem;
  padding-top: 1rem;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
}

.modal-footer-badge {
  margin-right: auto;
}

.tt-garments {
  margin-top: 0.5rem;
  line-height: 1.4;
}
</style>