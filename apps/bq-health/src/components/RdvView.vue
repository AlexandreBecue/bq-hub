<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  RDVS_COL_ID, 
  SUGGESTIONS_COL_ID,
  getRdvsRecords, 
  formatToFrenchDate 
} from '../db/queries';
import { Plus, Calendar, ShieldCheck, X, Clock, Sparkles } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const rdvs = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const showAddModal = ref(false);

// Form State
const formRdv = ref({
  date: new Date().toISOString().split('T')[0],
  heure: '',
  praticien: '',
  specialite: 'Généraliste',
  motif: '',
  prix: '',
  notes: ''
});

const specialitiesList = ["Généraliste", "Dentiste", "Ophtalmologue", "Dermatologue", "Kinesithérapeute", "Ostéopathe", "Cardiologue", "Autre Spécialiste"];

const loadData = async () => {
  isLoading.value = true;
  try {
    rdvs.value = await getRdvsRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Separate upcoming appointments and past consultations
const sortedAppointments = computed(() => {
  const nowStr = new Date().toISOString().split('T')[0];
  
  const upcoming = rdvs.value
    .filter(r => (r.data.date || '') >= nowStr)
    .sort((a, b) => String(a.data.date).localeCompare(String(b.data.date))); // ascending for future
    
  const past = rdvs.value
    .filter(r => (r.data.date || '') < nowStr); // already sorted descending in getRdvsRecords
    
  return {
    upcoming,
    past
  };
});

// Handle Log
const handleAddRdv = async () => {
  const doc = formRdv.value.praticien.trim();
  if (!doc) {
    alert('Veuillez saisir le nom du praticien.');
    return;
  }

  try {
    const p = Number(formRdv.value.prix) || 0;
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: RDVS_COL_ID,
      data: {
        date: formRdv.value.date,
        heure: formRdv.value.heure.trim(),
        praticien: doc,
        specialite: formRdv.value.specialite,
        motif: formRdv.value.motif.trim(),
        prix: p || null,
        notes: formRdv.value.notes.trim()
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);

    // If there's a cost, emit a transversal suggestion for bq-bank!
    if (p > 0) {
      try {
        const sugRecord: RecordEntry = {
          id: `rec-${generateId()}`,
          collectionId: SUGGESTIONS_COL_ID,
          data: {
            source_app: 'bq-health',
            action: 'Nouvelle Dépense',
            payload: JSON.stringify({
              date: formRdv.value.date,
              montant: p,
              partenaire: `Docteur ${doc} (${formRdv.value.specialite})`,
              commentaire: `Consultation médicale : ${formRdv.value.motif.trim() || formRdv.value.specialite}`,
              budget: 'Santé'
            }),
            status: 'pending'
          },
          createdAt: Date.now() + 5,
          updatedAt: Date.now() + 5
        };
        await db.records.add(sugRecord);
        console.log('Cross-app suggestion emitted to bq-bank!');
      } catch (errSug) {
        console.error('Failed to write suggestion to bq-bank:', errSug);
      }
    }

    showAddModal.value = false;
    emit('data-updated');
    loadData();
    alert('Rendez-vous enregistré !');
  } catch (err) {
    console.error(err);
  }
};

// Delete record
const handleDeleteRdv = async (id: string) => {
  if (!confirm('Supprimer ce rendez-vous ?')) return;
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
  <div class="rdv-view">
    <div class="view-header">
      <div>
        <h2>📅 Consultations & RDVs</h2>
        <p class="text-secondary">Planifie tes rendez-vous de santé futurs et conserve un historique complet de tes visites chez le médecin.</p>
      </div>
      <div class="view-actions">
        <button @click="showAddModal = true" class="btn btn-primary">
          <Plus :size="18" /> Nouveau RDV
        </button>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="rdvs-dashboard-grid">
      <!-- Left Column: Upcoming Appointments -->
      <div class="upcoming-rdvs-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Clock :size="18" class="text-primary" /> Rendez-vous à venir</h3>
          
          <div v-if="isLoading" class="text-center py-4">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="sortedAppointments.upcoming.length === 0" class="text-center py-4 text-muted text-sm">
            <p>Aucun rendez-vous futur planifié.</p>
          </div>

          <div v-else class="rdv-list-stack">
            <div v-for="r in sortedAppointments.upcoming" :key="r.id" class="rdv-card-item card glass hoverable">
              <div class="rdv-card-header flex-row justify-between">
                <div>
                  <h4 class="font-bold text-sm">Dr {{ r.data.praticien }}</h4>
                  <span class="badge badge-primary text-xs mt-1">{{ r.data.specialite }}</span>
                </div>
                <span class="badge badge-success text-xs font-bold flex-row"><Calendar :size="12" /> {{ formatToFrenchDate(r.data.date) }} <span v-if="r.data.heure">à {{ r.data.heure }}</span></span>
              </div>
              
              <div class="rdv-card-body text-sm text-secondary mt-3">
                <p v-if="r.data.motif"><strong>Motif :</strong> {{ r.data.motif }}</p>
                <p class="italic text-xs text-muted mt-2" v-if="r.data.notes">{{ r.data.notes }}</p>
              </div>

              <div class="rdv-card-footer flex-row justify-between border-top pt-2 mt-3">
                <span class="text-warning text-xs font-bold" v-if="r.data.prix">{{ r.data.prix }} €</span>
                <span class="text-xs text-muted" v-else>Prix non renseigné</span>
                <button @click="handleDeleteRdv(r.id!)" class="delete-link text-xs">Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Past consultations -->
      <div class="past-rdvs-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><ShieldCheck :size="18" class="text-accent" /> Consultations passées</h3>
          
          <div v-if="isLoading" class="text-center py-4">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="sortedAppointments.past.length === 0" class="text-center py-4 text-muted text-sm">
            <p>Aucun historique de consultations passées.</p>
          </div>

          <div v-else class="rdv-list-stack">
            <div v-for="r in sortedAppointments.past" :key="r.id" class="rdv-card-item card glass hoverable past-item">
              <div class="rdv-card-header flex-row justify-between">
                <div>
                  <h4 class="font-bold text-sm">Dr {{ r.data.praticien }}</h4>
                  <span class="badge badge-primary text-xs mt-1">{{ r.data.specialite }}</span>
                </div>
                <span class="badge badge-primary text-xs flex-row"><Calendar :size="12" /> Le {{ formatToFrenchDate(r.data.date) }}</span>
              </div>
              
              <div class="rdv-card-body text-sm text-secondary mt-3">
                <p v-if="r.data.motif"><strong>Motif :</strong> {{ r.data.motif }}</p>
                <p class="italic text-xs text-muted mt-2" v-if="r.data.notes">{{ r.data.notes }}</p>
              </div>

              <div class="rdv-card-footer flex-row justify-between border-top pt-2 mt-3">
                <span class="text-warning text-xs font-bold" v-if="r.data.prix">{{ r.data.prix }} €</span>
                <span class="text-xs text-muted" v-else>Gratuit / Remboursé</span>
                <button @click="handleDeleteRdv(r.id!)" class="delete-link text-xs">Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Saisie RDV Modal -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>📅 Enregistrer un Rendez-vous</h3>
          <button @click="showAddModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Date du RDV *</label>
              <input v-model="formRdv.date" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>Heure du RDV</label>
              <input v-model="formRdv.heure" type="text" placeholder="Ex: 14:30" class="input" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Praticien *</label>
              <input v-model="formRdv.praticien" type="text" placeholder="Ex: Martin, Dupuis" class="input" />
            </div>
            <div class="form-group">
              <label>Spécialité *</label>
              <select v-model="formRdv.specialite" class="select">
                <option v-for="s in specialitiesList" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Motif de la consultation</label>
              <input v-model="formRdv.motif" type="text" placeholder="Ex: Contrôle annuel, Detartrage" class="input" />
            </div>
            <div class="form-group">
              <label>Coût / Prix payé (€)</label>
              <input v-model="formRdv.prix" type="number" step="0.01" min="0" placeholder="Ex: 25.00" class="input" />
            </div>
          </div>

          <div class="form-group mt-2">
            <label>Notes / Ordonnances / Symptômes</label>
            <textarea v-model="formRdv.notes" rows="3" placeholder="Ex: Prescription de gouttes oculaires, repos préconisé..." class="textarea"></textarea>
          </div>

          <!-- Financial connection note -->
          <p class="text-xs text-muted flex-row mt-2" v-if="Number(formRdv.prix) > 0">
            <Sparkles :size="12" class="text-primary" /> Un virement suggéré de {{ formRdv.prix }} € sera émis vers l'Inbox de <strong>bq-bank</strong> !
          </p>
        </div>
        <div class="modal-footer">
          <button @click="showAddModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddRdv" class="btn btn-primary" :disabled="!formRdv.praticien.trim()">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rdvs-dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.rdv-list-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.rdv-card-item {
  border: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.01);
  border-radius: var(--radius-sm);
  padding: 0.85rem 1.15rem;
  
  &.past-item {
    opacity: 0.8;
    background-color: rgba(30, 41, 59, 0.2);
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

.border-top {
  border-top: 1px solid var(--border-color);
}

.pt-2 {
  padding-top: 0.5rem;
}

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.font-bold { font-weight: 700; }
.text-center { text-align: center; }

.mini-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 1rem auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
