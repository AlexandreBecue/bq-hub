<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  LESSIVES_COL_ID, 
  getClothesRecords, 
  getLessivesRecords, 
  formatToFrenchDate 
} from '../db/queries';
import { Plus, Calendar, Check, Clock, ShieldAlert, X, Archive } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const clothes = ref<RecordEntry[]>([]);
const lessives = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const showAddModal = ref(false);

// New Laundry Form State
const dateSaisie = ref(new Date().toISOString().split('T')[0]);
const selectedGarments = ref<string[]>([]);
const makeAvailableImmediately = ref(false); // option to bypass drying delay

const loadData = async () => {
  isLoading.value = true;
  try {
    clothes.value = await getClothesRecords();
    lessives.value = await getLessivesRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Segment garments into:
// 1. Wet/Linge Sale (is_available === false) - highly likely to be washed
// 2. Already available (is_available !== false)
const clothesSortedByLikelihood = computed(() => {
  const unavailable = clothes.value.filter(c => c.data.is_available === false);
  const available = clothes.value.filter(c => c.data.is_available !== false);
  return {
    unavailable,
    available
  };
});

// Toggle garment in laundry selection
const toggleGarment = (id: string) => {
  const idx = selectedGarments.value.indexOf(id);
  if (idx > -1) {
    selectedGarments.value.splice(idx, 1);
  } else {
    selectedGarments.value.push(id);
  }
};

const selectAllUnavailable = () => {
  selectedGarments.value = clothesSortedByLikelihood.value.unavailable.map(c => c.id!);
};

const deselectAll = () => {
  selectedGarments.value = [];
};

// Add Laundry Event
const handleAddLessive = async () => {
  if (selectedGarments.value.length === 0) return;

  try {
    const now = Date.now();
    // 1. Add historical Lessive record
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: LESSIVES_COL_ID,
      data: {
        date: dateSaisie.value,
        vetements_laves: [...selectedGarments.value]
      },
      createdAt: now,
      updatedAt: now
    };

    await db.records.add(newRecord);

    // 2. Update washed clothes availability state
    // If "makeAvailableImmediately" is true, they become available (is_available: true)
    // If false, they are marked as unavailable (is_available: false) since they are still wet/drying!
    for (const id of selectedGarments.value) {
      await db.records.update(id, {
        'data.is_available': makeAvailableImmediately.value,
        updatedAt: now
      });
    }

    showAddModal.value = false;
    selectedGarments.value = [];
    makeAvailableImmediately.value = false;
    emit('data-updated');
    loadData();
    alert('Lessive enregistrée !');
  } catch (err) {
    console.error(err);
  }
};

// Delete historical Laundry record
const handleDeleteLessive = async (id: string) => {
  if (!confirm('Es-tu sûr de vouloir supprimer cet historique de lessive ? (Cela ne modifiera pas la disponibilité des vêtements)')) return;
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};
</script>

<template>
  <div class="lessives-view">
    <div class="view-header">
      <div>
        <h2>🧺 Mes Lessives</h2>
        <p class="text-secondary">Enregistre tes machines au moment d'étendre ton linge pour suivre son cycle de séchage et réinitialiser sa fraîcheur.</p>
      </div>
      <div class="view-actions">
        <button @click="showAddModal = true" class="btn btn-purple">
          <Plus :size="18" /> Nouvelle Lessive
        </button>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="lessives-grid-layout">
      <!-- Historical List Card -->
      <div class="card glass history-card">
        <h3 class="font-bold flex-row mb-4"><Archive :size="18" /> Historique des Lessives</h3>
        
        <div v-if="isLoading" class="text-center py-4">
          <div class="spinner"></div>
        </div>

        <div v-else-if="lessives.length === 0" class="empty-state text-center py-4 text-muted">
          <ShieldAlert :size="36" class="mx-auto mb-2 text-muted" />
          <p>Aucune lessive enregistrée pour le moment.</p>
        </div>

        <div v-else class="history-list">
          <div v-for="les in lessives" :key="les.id" class="history-item">
            <div class="history-header">
              <span class="history-date flex-row"><Calendar :size="14" /> {{ formatToFrenchDate(les.data.date) }}</span>
              <button @click="handleDeleteLessive(les.id!)" class="delete-link">Supprimer</button>
            </div>
            <div class="history-clothes text-secondary mt-2">
              <div class="garment-pills">
                <span 
                  v-for="gId in les.data.vetements_laves || []" 
                  :key="gId" 
                  class="garment-pill"
                >
                  {{ clothes.find(c => c.id === gId)?.data.nom || 'Vêtement inconnu' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Explanation Card -->
      <div class="card glass info-card-side">
        <h3 class="font-bold flex-row mb-2"><Clock :size="18" class="text-purple" /> Comment ça marche ?</h3>
        <p class="text-secondary text-sm leading-relaxed mb-4">
          1. Dès que tu mets un habit au linge sale, décoche sa disponibilité dans l'onglet <strong>Dressing</strong> (ou coche l'option lors de l'enregistrement de ta tenue).
        </p>
        <p class="text-secondary text-sm leading-relaxed mb-4">
          2. Quand tu étends ta machine, clique sur <strong>Nouvelle Lessive</strong> et sélectionne les vêtements lavés.
        </p>
        <p class="text-secondary text-sm leading-relaxed mb-4">
          3. Sauf si tu coches "Disponible immédiatement", les habits resteront indisponibles le temps qu'ils sèchent (délai de séchage configurable dans les <strong>Préférences</strong>, par défaut 24 heures).
        </p>
        <p class="text-secondary text-sm leading-relaxed">
          4. Une fois secs, l'application les remettra **automatiquement disponibles**, remettra à zéro leur nombre d'utilisations, et mettra à jour leur date de dernier lavage !
        </p>
      </div>
    </div>

    <!-- Add Laundry Event Modal -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>🧺 Enregistrer une Lessive</h3>
          <button @click="showAddModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Date de la lessive / lavage</label>
            <input v-model="dateSaisie" type="date" class="input" />
          </div>

          <div class="clothes-selector-box mt-4">
            <label class="font-bold text-xs text-secondary mb-2 block">SÉLECTIONNE LES VÊTEMENTS LAVÉS *</label>
            
            <div class="selection-actions flex-row mb-2">
              <button @click="selectAllUnavailable" class="btn btn-sm text-xs btn-purple" :disabled="clothesSortedByLikelihood.unavailable.length === 0">
                Tout sélectionner au linge sale ({{ clothesSortedByLikelihood.unavailable.length }})
              </button>
              <button @click="deselectAll" class="btn btn-sm text-xs btn-secondary">
                Tout désélectionner
              </button>
            </div>

            <div class="laundry-clothes-list mt-2">
              <!-- Unavailable clothes (Highly likely to be washed) -->
              <div class="laundry-section" v-if="clothesSortedByLikelihood.unavailable.length > 0">
                <span class="section-label">Au linge sale (Indisponibles)</span>
                <div class="garment-checkbox-grid">
                  <div 
                    v-for="item in clothesSortedByLikelihood.unavailable" 
                    :key="item.id"
                    class="garment-check-item"
                    :class="{ 'checked': selectedGarments.includes(item.id!) }"
                    @click="toggleGarment(item.id!)"
                  >
                    <div class="check-box">
                      <Check v-if="selectedGarments.includes(item.id!)" :size="12" />
                    </div>
                    <span>{{ item.data.nom }} <span class="text-xs text-muted">({{ item.data.categorie }})</span></span>
                  </div>
                </div>
              </div>

              <!-- Available clothes (Can also be checked) -->
              <div class="laundry-section mt-4">
                <span class="section-label">Autres vêtements (Déjà marqués disponibles)</span>
                <div class="garment-checkbox-grid">
                  <div 
                    v-for="item in clothesSortedByLikelihood.available" 
                    :key="item.id"
                    class="garment-check-item"
                    :class="{ 'checked': selectedGarments.includes(item.id!) }"
                    @click="toggleGarment(item.id!)"
                  >
                    <div class="check-box">
                      <Check v-if="selectedGarments.includes(item.id!)" :size="12" />
                    </div>
                    <span>{{ item.data.nom }} <span class="text-xs text-muted">({{ item.data.categorie }})</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Immediate Availability option -->
          <div class="form-group mt-4 border-top pt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="makeAvailableImmediately" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold text-sm">Disponibles immédiatement (déjà secs)</span>
            </div>
            <p class="text-xs text-muted mt-1 ml-10">(Si décoché, ils deviendront disponibles après le délai de séchage configuré)</p>
          </div>
        </div>
        <div class="modal-footer">
          <span class="badge badge-primary text-xs mr-auto" v-if="selectedGarments.length > 0">
            {{ selectedGarments.length }} vêtements sélectionnés
          </span>
          <button @click="showAddModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddLessive" class="btn btn-purple" :disabled="selectedGarments.length === 0">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lessives-grid-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-item {
  border: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
  padding: 1rem;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
}

.history-date {
  font-weight: 700;
  font-size: 0.9rem;
}

.delete-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  
  &:hover {
    color: var(--color-danger);
    text-decoration: underline;
  }
}

.garment-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.garment-pill {
  font-size: 0.775rem;
  font-weight: 700;
  background-color: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
}

.info-card-side {
  border-color: rgba(139, 92, 246, 0.15);
  background-color: rgba(139, 92, 246, 0.01);
}

.block {
  display: block;
}

.laundry-clothes-list {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  background-color: rgba(15, 23, 42, 0.3);
}

.laundry-section {
  .section-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 800;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.025em;
    margin-bottom: 0.5rem;
  }
}

.garment-checkbox-grid {
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
    background-color: rgba(139, 92, 246, 0.1);
    border-color: var(--color-purple);
    
    .check-box {
      background-color: var(--color-purple);
      border-color: var(--color-purple);
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

.border-top {
  border-top: 1px solid var(--border-color);
}

.pt-4 {
  padding-top: 1rem;
}

.ml-10 {
  margin-left: 3rem;
}

.mr-auto {
  margin-right: auto;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 4px solid var(--border-color);
  border-top-color: var(--color-purple);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
