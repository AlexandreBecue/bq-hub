<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  VACCINS_COL_ID, 
  getVaccinsRecords, 
  formatToFrenchDate 
} from '../db/queries';
import { Plus, X, ShieldCheck, ShieldAlert } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const vaccins = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const showAddModal = ref(false);

// Form State
const formVaccin = ref({
  date: new Date().toISOString().split('T')[0],
  type: 'DTCaP',
  vaccin: '',
  statut: 'Fait', // Fait, À faire / Rappel
  prochain_rappel: ''
});

const typesList = ["BCG", "DTCaP", "Hépatite B", "ROR", "Méningocoque C", "Varicelle", "Test tuberculinique", "HPV", "Grippe", "Covid-19", "Autre"];
const statusList = ["Fait", "À faire / Rappel"];

const loadData = async () => {
  isLoading.value = true;
  try {
    vaccins.value = await getVaccinsRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Handle Log
const handleAddVaccin = async () => {
  if (!formVaccin.value.vaccin.trim()) {
    alert('Veuillez saisir le nom commercial du vaccin.');
    return;
  }

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: VACCINS_COL_ID,
      data: {
        date: formVaccin.value.date,
        type: formVaccin.value.type,
        vaccin: formVaccin.value.vaccin.trim(),
        statut: formVaccin.value.statut,
        prochain_rappel: formVaccin.value.statut === 'Fait' ? formVaccin.value.prochain_rappel : ''
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddModal.value = false;
    formVaccin.value = {
      date: new Date().toISOString().split('T')[0],
      type: 'DTCaP',
      vaccin: '',
      statut: 'Fait',
      prochain_rappel: ''
    };
    emit('data-updated');
    loadData();
    alert('Vaccination enregistrée !');
  } catch (err) {
    console.error(err);
  }
};

// Delete record
const handleDeleteVaccin = async (id: string) => {
  if (!confirm('Supprimer ce vaccin ?')) return;
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
  <div class="vaccins-view">
    <div class="view-header">
      <div>
        <h2>💉 Mes Vaccinations</h2>
        <p class="text-secondary">Enregistre ton historique de vaccinations et planifie tes prochains rappels de vaccins.</p>
      </div>
      <div class="view-actions">
        <button @click="showAddModal = true" class="btn btn-primary">
          <Plus :size="18" /> Saisir un vaccin
        </button>
      </div>
    </div>

    <!-- Main Content layout -->
    <div class="vaccins-dashboard-layout">
      <div class="card glass">
        <h3 class="font-bold flex-row mb-4"><ShieldCheck :size="18" class="text-primary" /> Carnet de Vaccination</h3>
        
        <div v-if="isLoading" class="text-center py-4">
          <div class="spinner"></div>
        </div>

        <div v-else-if="vaccins.length === 0" class="text-center py-4 text-muted text-sm">
          <p>Aucun vaccin enregistré.</p>
        </div>

        <div v-else class="vaccines-table-list">
          <div v-for="v in vaccins" :key="v.id" class="vaccine-row-card flex-row justify-between gap-4 flex-wrap">
            <div class="v-main flex-row gap-3">
              <span class="v-type-icon flex-row" :class="v.data.statut === 'Fait' ? 'done' : 'todo'">
                <ShieldCheck v-if="v.data.statut === 'Fait'" :size="14" />
                <ShieldAlert v-else :size="14" />
              </span>
              
              <div>
                <h4 class="v-name font-bold text-sm">{{ v.data.vaccin }} <span class="badge badge-primary text-xs ml-1">{{ v.data.type }}</span></h4>
                <p class="v-dates text-xs text-secondary mt-0.5">
                  Fait le : {{ formatToFrenchDate(v.data.date) }}
                  <span v-if="v.data.prochain_rappel"> • Prochain rappel : <strong class="text-accent">{{ formatToFrenchDate(v.data.prochain_rappel) }}</strong></span>
                </p>
              </div>
            </div>

            <div class="v-actions flex-row gap-3">
              <span class="badge" :class="v.data.statut === 'Fait' ? 'badge-success' : 'badge-warning'">
                {{ v.data.statut }}
              </span>
              <button @click="handleDeleteVaccin(v.id!)" class="delete-link text-xs">Supprimer</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Saisie Vaccin Modal -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>💉 Enregistrer un Vaccin</h3>
          <button @click="showAddModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Date d'injection *</label>
              <input v-model="formVaccin.date" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>Type de Vaccin *</label>
              <select v-model="formVaccin.type" class="select">
                <option v-for="t in typesList" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Nom du Vaccin (Commercial) *</label>
              <input v-model="formVaccin.vaccin" type="text" placeholder="Ex: Repevax, Boostrixtetra" class="input" />
            </div>
            <div class="form-group">
              <label>Statut *</label>
              <select v-model="formVaccin.statut" class="select">
                <option v-for="s in statusList" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>

          <!-- Booster date is only relevant if done -->
          <div class="form-group" v-if="formVaccin.statut === 'Fait'">
            <label>Date du Prochain Rappel (Optionnelle)</label>
            <input v-model="formVaccin.prochain_rappel" type="date" class="input" />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddVaccin" class="btn btn-primary" :disabled="!formVaccin.vaccin.trim()">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.vaccins-dashboard-layout {
  max-width: 800px;
  margin: 0 auto;
}

.vaccines-table-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.vaccine-row-card {
  border: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.01);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
}

.v-type-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  align-self: center;
  
  &.done {
    background-color: rgba(16, 185, 129, 0.1);
    color: #34d399;
  }
  &.todo {
    background-color: rgba(245, 158, 11, 0.1);
    color: #fbbf24;
  }
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
.font-bold { font-weight: 700; }
.text-center { text-align: center; }
.ml-1 { margin-left: 0.25rem; }

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
