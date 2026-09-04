<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  METRICS_COL_ID, 
  getMetricsRecords, 
  formatToFrenchDate 
} from '../db/queries';
import { Plus, X, Ruler, Scale, ArrowUpRight, ArrowDownLeft } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const metrics = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const showAddModal = ref(false);

// Form State
const formMetric = ref({
  date: new Date().toISOString().split('T')[0],
  poids: '',
  taille: '',
  tour_taille: '',
  tour_epaules: '',
  tour_poitrine: '',
  tour_cuisses: ''
});

const loadData = async () => {
  isLoading.value = true;
  try {
    metrics.value = await getMetricsRecords();
    
    // Pre-fill height based on latest entry if any
    if (metrics.value.length > 0) {
      const latestWithHeight = metrics.value.find(m => m.data.taille);
      if (latestWithHeight) {
        formMetric.value.taille = String(latestWithHeight.data.taille);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Latest body log entry
const latestLog = computed(() => {
  return metrics.value.length > 0 ? metrics.value[0] : null;
});

// Calculate BMI based on latest weight and height
const imcDetails = computed(() => {
  if (!latestLog.value) return null;
  
  const p = Number(latestLog.value.data.poids) || 0;
  
  // Find latest height logged anywhere in history
  const latestWithHeight = metrics.value.find(m => m.data.taille);
  const t = latestWithHeight ? Number(latestWithHeight.data.taille) || 0 : 0;

  if (p <= 0 || t <= 0) return null;

  const heightMeters = t / 100;
  const imc = p / (heightMeters * heightMeters);

  let category = 'Normal';
  let categoryColor = 'text-success';
  let desc = 'Ton poids est parfaitement adapté à ta taille.';

  if (imc < 18.5) {
    category = 'Insuffisance pondérale';
    categoryColor = 'text-warning';
    desc = 'Poids léger par rapport à ta taille.';
  } else if (imc >= 30) {
    category = 'Obésité';
    categoryColor = 'text-danger';
    desc = 'Pense à consulter un nutritionniste.';
  } else if (imc >= 25) {
    category = 'Surpoids';
    categoryColor = 'text-warning';
    desc = 'Légèrement au-dessus de la courbe idéale.';
  }

  return {
    imc,
    category,
    categoryColor,
    desc,
    weight: p,
    height: t
  };
});

// Weight progression (gain/loss compared to previous log)
const weightProgression = computed(() => {
  if (metrics.value.length < 2) return null;
  const current = Number(metrics.value[0].data.poids) || 0;
  const previous = Number(metrics.value[1].data.poids) || 0;
  const diff = current - previous;
  return {
    diff,
    isGain: diff > 0,
    isLoss: diff < 0
  };
});

// Handle Log
const handleAddMetric = async () => {
  const p = Number(formMetric.value.poids) || 0;
  if (p <= 0) {
    alert('Veuillez saisir un poids valide supérieur à 0.');
    return;
  }

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: METRICS_COL_ID,
      data: {
        date: formMetric.value.date,
        poids: p,
        taille: Number(formMetric.value.taille) || null,
        tour_taille: Number(formMetric.value.tour_taille) || null,
        tour_epaules: Number(formMetric.value.tour_epaules) || null,
        tour_poitrine: Number(formMetric.value.tour_poitrine) || null,
        tour_cuisses: Number(formMetric.value.tour_cuisses) || null
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddModal.value = false;
    formMetric.value = {
      date: new Date().toISOString().split('T')[0],
      poids: '',
      taille: formMetric.value.taille, // retain height
      tour_taille: '',
      tour_epaules: '',
      tour_poitrine: '',
      tour_cuisses: ''
    };
    emit('data-updated');
    loadData();
    alert('Mesures corporelles enregistrées !');
  } catch (err) {
    console.error(err);
  }
};

// Delete record
const handleDeleteMetric = async (id: string) => {
  if (!confirm('Supprimer cette fiche de mesures corporelles ?')) return;
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
  <div class="mensurations-view">
    <div class="view-header">
      <div>
        <h2>📏 Poids & Mensurations</h2>
        <p class="text-secondary">Enregistre régulièrement ton poids, ta taille historique de carnet de santé et tes mensurations de couture.</p>
      </div>
      <div class="view-actions">
        <button @click="showAddModal = true" class="btn btn-primary">
          <Plus :size="18" /> Saisir des mesures
        </button>
      </div>
    </div>

    <!-- Main Content Layout -->
    <div v-if="isLoading" class="text-center py-4">
      <div class="spinner"></div>
    </div>

    <div v-else-if="metrics.length === 0" class="card glass text-center py-4 text-muted text-sm">
      <Scale class="mx-auto mb-2 text-muted" :size="36" />
      <p>Aucun relevé corporel enregistré pour le moment.</p>
      <button @click="showAddModal = true" class="btn btn-primary btn-sm mt-3">Enregistrer mes premières mesures</button>
    </div>

    <div v-else class="metrics-dashboard-grid">
      <!-- Left Column: BMI & Sizing cheat sheet -->
      <div class="metrics-summary-col">
        <!-- BMI Card -->
        <div class="card glass imc-card mb-4 text-center" v-if="imcDetails">
          <span class="lbl font-bold text-xs text-muted block uppercase mb-1">INDICE DE MASSE CORPORELLE (IMC)</span>
          <h3 class="imc-val font-black text-2xl text-primary">{{ imcDetails.imc.toFixed(1) }}</h3>
          <span class="badge font-bold mt-2" :class="imcDetails.categoryColor === 'text-success' ? 'badge-success' : 'badge-warning'">
            {{ imcDetails.category }}
          </span>
          <p class="text-secondary text-xs mt-3">{{ imcDetails.desc }}</p>
          <div class="imc-base-info mt-3 text-xs text-muted">
            Basé sur ton poids actuel de {{ imcDetails.weight }} kg et ta taille de {{ imcDetails.height }} cm.
          </div>
        </div>

        <!-- Weight Progression Card -->
        <div class="card glass progression-card mb-4 flex-row justify-between" v-if="weightProgression">
          <div class="prog-info">
            <span class="lbl font-bold text-xs text-muted block uppercase">Évolution de Poids</span>
            <p class="text-secondary text-xs mt-1">Par rapport au relevé précédent :</p>
          </div>
          
          <div class="prog-val flex-row font-black text-lg" :class="weightProgression.isLoss ? 'text-success' : 'text-danger'">
            <ArrowDownLeft v-if="weightProgression.isLoss" :size="18" />
            <ArrowUpRight v-if="weightProgression.isGain" :size="18" />
            {{ weightProgression.diff > 0 ? '+' : '' }}{{ weightProgression.diff.toFixed(1) }} kg
          </div>
        </div>

        <!-- Sizing Cheat Sheet -->
        <div class="card glass sizing-cheat-card" v-if="latestLog">
          <h3 class="font-bold flex-row text-sm mb-3"><Ruler :size="16" class="text-accent" /> Aide-Mémoire Shopping</h3>
          <p class="text-secondary text-xs mb-3">Tes dernières mensurations de couture (pratique pour l'achat de vêtements) :</p>

          <div class="sizing-sheet-table text-sm">
            <div class="sizing-row flex-row justify-between mb-2">
              <span class="lbl text-secondary font-bold">Tour de taille :</span>
              <span class="val font-black text-accent">{{ latestLog.data.tour_taille ? latestLog.data.tour_taille + ' cm' : '-' }}</span>
            </div>
            <div class="sizing-row flex-row justify-between mb-2">
              <span class="lbl text-secondary font-bold">Tour d'épaules :</span>
              <span class="val font-black text-accent">{{ latestLog.data.tour_epaules ? latestLog.data.tour_epaules + ' cm' : '-' }}</span>
            </div>
            <div class="sizing-row flex-row justify-between mb-2">
              <span class="lbl text-secondary font-bold">Tour de poitrine :</span>
              <span class="val font-black text-accent">{{ latestLog.data.tour_poitrine ? latestLog.data.tour_poitrine + ' cm' : '-' }}</span>
            </div>
            <div class="sizing-row flex-row justify-between">
              <span class="lbl text-secondary font-bold">Tour de cuisse :</span>
              <span class="val font-black text-accent">{{ latestLog.data.tour_cuisses ? latestLog.data.tour_cuisses + ' cm' : '-' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: History List -->
      <div class="metrics-history-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Scale :size="18" class="text-primary" /> Historique de pesées</h3>

          <div class="metrics-history-list">
            <div v-for="m in metrics" :key="m.id" class="history-metric-item">
              <div class="item-header flex-row justify-between">
                <span class="item-date font-bold text-sm">{{ formatToFrenchDate(m.data.date) }}</span>
                <button @click="handleDeleteMetric(m.id!)" class="delete-link text-xs">Supprimer</button>
              </div>

              <div class="item-grid mt-3">
                <div class="m-box">
                  <span class="lbl">Poids :</span>
                  <span class="val font-black">{{ m.data.poids }} kg</span>
                </div>
                <div class="m-box" v-if="m.data.taille">
                  <span class="lbl">Taille :</span>
                  <span class="val font-bold">{{ m.data.taille }} cm</span>
                </div>
                <div class="m-box" v-if="m.data.tour_taille">
                  <span class="lbl">Taille (cm) :</span>
                  <span class="val">{{ m.data.tour_taille }} cm</span>
                </div>
                <div class="m-box" v-if="m.data.tour_epaules">
                  <span class="lbl">Épaules :</span>
                  <span class="val">{{ m.data.tour_epaules }} cm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Saisie Metric Modal -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>📏 Saisir des Mesures Corporelles</h3>
          <button @click="showAddModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Date *</label>
              <input v-model="formMetric.date" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>Poids (kg) *</label>
              <input v-model="formMetric.poids" type="number" step="0.1" min="0" placeholder="Ex: 72.4" class="input font-bold" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Taille (cm)</label>
              <input v-model="formMetric.taille" type="number" step="0.1" min="0" placeholder="Ex: 178" class="input" />
            </div>
            <div class="form-group">
              <label>Tour de taille (cm)</label>
              <input v-model="formMetric.tour_taille" type="number" step="0.1" min="0" placeholder="Ex: 84" class="input" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Tour d'épaules (cm)</label>
              <input v-model="formMetric.tour_epaules" type="number" step="0.1" min="0" placeholder="Ex: 110" class="input" />
            </div>
            <div class="form-group">
              <label>Tour de poitrine (cm)</label>
              <input v-model="formMetric.tour_poitrine" type="number" step="0.1" min="0" placeholder="Ex: 96" class="input" />
            </div>
          </div>

          <div class="form-group">
            <label>Tour de cuisse (cm)</label>
            <input v-model="formMetric.tour_cuisses" type="number" step="0.1" min="0" placeholder="Ex: 52" class="input" />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddMetric" class="btn btn-primary" :disabled="!formMetric.poids">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.metrics-dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.imc-card {
  border-color: rgba(6, 182, 212, 0.2);
  background-color: rgba(6, 182, 212, 0.02);
}

.sizing-sheet-table {
  background-color: rgba(15, 23, 42, 0.4);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.metrics-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-metric-item {
  border: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.01);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  font-size: 0.8rem;
  
  @media (max-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.m-box {
  display: flex;
  flex-direction: column;
  
  .lbl { color: var(--text-muted); font-weight: 700; }
  .val { color: var(--text-secondary); }
}

.delete-link {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-weight: 700;
  
  &:hover {
    color: var(--color-danger);
    text-decoration: underline;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.text-success { color: #34d399 !important; }
.text-danger { color: #f87171 !important; }

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.text-lg { font-size: 1.15rem; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }
.text-center { text-align: center; }
.block { display: block; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }

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
