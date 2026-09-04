<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  PRESC_COL_ID, 
  getPrescRecords, 
  formatToFrenchDate 
} from '../db/queries';
import { Plus, X, Heart, ShieldAlert } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const presc = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const showAddModal = ref(false);

// Form State
const formPresc = ref({
  nom_medicament: '',
  posologie: '',
  date_debut: new Date().toISOString().split('T')[0],
  date_fin: '',
  actif: true,
  medecin_prescripteur: ''
});

const loadData = async () => {
  isLoading.value = true;
  try {
    presc.value = await getPrescRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Segment treatments:
// 1. En cours (Actif)
// 2. Terminé (Inactif)
const treatmentsGrouped = computed(() => {
  const active = presc.value.filter(p => p.data.actif === true || p.data.actif === 1);
  const finished = presc.value.filter(p => p.data.actif === false || p.data.actif === 0);
  return {
    active,
    finished
  };
});

// Toggle active state (finish treatment)
const toggleTreatmentActive = async (item: RecordEntry) => {
  try {
    const currentVal = item.data.actif !== false;
    await db.records.update(item.id!, {
      'data.actif': !currentVal,
      updatedAt: Date.now()
    });
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

// Handle Log
const handleAddPresc = async () => {
  if (!formPresc.value.nom_medicament.trim() || !formPresc.value.posologie.trim()) {
    alert('Veuillez renseigner le nom du médicament et sa posologie.');
    return;
  }

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: PRESC_COL_ID,
      data: {
        nom_medicament: formPresc.value.nom_medicament.trim(),
        posologie: formPresc.value.posologie.trim(),
        date_debut: formPresc.value.date_debut,
        date_fin: formPresc.value.date_fin,
        actif: formPresc.value.actif,
        medecin_prescripteur: formPresc.value.medecin_prescripteur.trim()
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddModal.value = false;
    formPresc.value = {
      nom_medicament: '',
      posologie: '',
      date_debut: new Date().toISOString().split('T')[0],
      date_fin: '',
      actif: true,
      medecin_prescripteur: ''
    };
    emit('data-updated');
    loadData();
    alert('Traitement enregistré !');
  } catch (err) {
    console.error(err);
  }
};

// Delete record
const handleDeletePresc = async (id: string) => {
  if (!confirm('Supprimer cette fiche de traitement ?')) return;
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
  <div class="traitements-view">
    <div class="view-header">
      <div>
        <h2>💊 Traitements & Ordonnances</h2>
        <p class="text-secondary">Suis tes ordonnances actives, renseigne tes posologies pour alimenter ton pilulier quotidien et archive tes anciens traitements.</p>
      </div>
      <div class="view-actions">
        <button @click="showAddModal = true" class="btn btn-primary">
          <Plus :size="18" /> Nouveau Traitement
        </button>
      </div>
    </div>

    <!-- Main Content Layout -->
    <div class="traitements-dashboard-layout">
      <!-- Active Treatments Card -->
      <div class="card glass mb-4">
        <h3 class="font-bold flex-row mb-4"><Heart class="text-primary" :size="18" /> Traitements en cours (Actifs)</h3>
        
        <div v-if="isLoading" class="text-center py-4">
          <div class="spinner"></div>
        </div>

        <div v-else-if="treatmentsGrouped.active.length === 0" class="text-center py-4 text-muted text-sm">
          <ShieldAlert class="mx-auto mb-2 text-muted" :size="36" />
          <p>Aucun traitement en cours.</p>
          <button @click="showAddModal = true" class="btn btn-primary btn-sm mt-3">Ajouter un traitement</button>
        </div>

        <div v-else class="treatments-grid">
          <div v-for="t in treatmentsGrouped.active" :key="t.id" class="card glass hoverable treatment-card active">
            <div class="t-card-header flex-row justify-between">
              <div>
                <h4 class="t-name font-black text-md">{{ t.data.nom_medicament }}</h4>
                <span class="badge badge-success text-xs mt-1">En cours</span>
              </div>
              <button @click="handleDeletePresc(t.id!)" class="icon-btn delete-btn" title="Supprimer">
                <X :size="14" />
              </button>
            </div>

            <div class="t-card-body mt-3 text-sm text-secondary">
              <p class="posology-highlight font-bold text-accent">{{ t.data.posologie }}</p>
              <div class="t-dates-row mt-2 text-xs text-muted flex-row justify-between flex-wrap gap-2">
                <span>Début : <strong>{{ formatToFrenchDate(t.data.date_debut) }}</strong></span>
                <span v-if="t.data.date_fin">Fin : <strong>{{ formatToFrenchDate(t.data.date_fin) }}</strong></span>
                <span v-if="t.data.medecin_prescripteur">Prescrit par : <strong>{{ t.data.medecin_prescripteur }}</strong></span>
              </div>
            </div>

            <div class="t-card-footer mt-4 border-top pt-2 flex-row justify-between">
              <span class="text-xs text-secondary">Finir le traitement :</span>
              <div class="active-toggle flex-row">
                <label class="switch">
                  <input type="checkbox" :checked="t.data.actif !== false" @change="toggleTreatmentActive(t)" />
                  <span class="slider"></span>
                </label>
                <span class="active-lbl text-xs font-bold" :class="t.data.actif !== false ? 'text-success' : 'text-danger'">
                  Actif
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Historical Treatments Card -->
      <div class="card glass">
        <h3 class="font-bold flex-row mb-4"><Heart class="text-muted" :size="18" /> Historique (Traitements terminés)</h3>
        
        <div v-if="isLoading" class="text-center py-4">
          <div class="spinner"></div>
        </div>

        <div v-else-if="treatmentsGrouped.finished.length === 0" class="text-center py-4 text-muted text-sm">
          <p>Aucun traitement archivé.</p>
        </div>

        <div v-else class="treatments-grid finished-grid">
          <div v-for="t in treatmentsGrouped.finished" :key="t.id" class="card glass hoverable treatment-card finished">
            <div class="t-card-header flex-row justify-between">
              <div>
                <h4 class="t-name font-bold text-sm">{{ t.data.nom_medicament }}</h4>
                <span class="badge badge-danger text-xs mt-1">Terminé</span>
              </div>
              <button @click="handleDeletePresc(t.id!)" class="icon-btn delete-btn" title="Supprimer">
                <X :size="14" />
              </button>
            </div>

            <div class="t-card-body mt-3 text-xs text-muted">
              <p class="font-bold">Posologie : {{ t.data.posologie }}</p>
              <p class="mt-1">Période : {{ formatToFrenchDate(t.data.date_debut) }} <span v-if="t.data.date_fin">➔ {{ formatToFrenchDate(t.data.date_fin) }}</span></p>
            </div>

            <div class="t-card-footer mt-3 border-top pt-2 flex-row justify-between">
              <span class="text-xs text-muted">Reprendre le traitement :</span>
              <div class="active-toggle flex-row">
                <label class="switch">
                  <input type="checkbox" :checked="t.data.actif !== false" @change="toggleTreatmentActive(t)" />
                  <span class="slider"></span>
                </label>
                <span class="active-lbl text-xs font-bold text-muted">
                  Inactif
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Saisie Traitement Modal -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>➕ Enregistrer un Traitement</h3>
          <button @click="showAddModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Médicament *</label>
            <input v-model="formPresc.nom_medicament" type="text" placeholder="Ex: Doliprane 1000, Amoxicilline" class="input" />
          </div>

          <div class="form-group">
            <label>Posologie / Fréquence *</label>
            <input v-model="formPresc.posologie" type="text" placeholder="Ex: 1 gélule matin et soir au milieu du repas" class="input" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Date de début *</label>
              <input v-model="formPresc.date_debut" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>Date de fin (Optionnelle)</label>
              <input v-model="formPresc.date_fin" type="date" class="input" />
            </div>
          </div>

          <div class="form-group">
            <label>Médecin prescripteur</label>
            <input v-model="formPresc.medecin_prescripteur" type="text" placeholder="Ex: Dr Martin (Généraliste)" class="input" />
          </div>

          <div class="form-group mt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="formPresc.actif" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold text-sm">Traitement en cours (Actif)</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddPresc" class="btn btn-primary" :disabled="!formPresc.nom_medicament.trim() || !formPresc.posologie.trim()">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.traitements-dashboard-layout {
  max-width: 900px;
  margin: 0 auto;
}

.treatments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  
  &.finished-grid {
    opacity: 0.75;
  }
}

.treatment-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  
  &.finished {
    background-color: rgba(30, 41, 59, 0.2);
  }
}

.posology-highlight {
  background-color: rgba(6, 182, 212, 0.05);
  border: 1px solid rgba(6, 182, 212, 0.15);
  padding: 0.4rem 0.65rem;
  border-radius: var(--radius-sm);
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
  width: 50px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.border-top {
  border-top: 1px solid var(--border-color);
}

.pt-2 {
  padding-top: 0.5rem;
}

.text-success { color: #34d399 !important; }
.text-danger { color: #f87171 !important; }

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }
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
