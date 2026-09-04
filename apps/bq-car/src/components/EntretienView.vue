<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  ENTRETIENS_COL_ID, 
  getVehiclesRecords, 
  getCarburantRecords, 
  getEntretienRecords, 
  calculateCurrentMileage,
  formatToFrenchDate
} from '../db/queries';
import { Plus, Calendar, ShieldAlert, Sparkles, X } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const vehicles = ref<RecordEntry[]>([]);
const carburants = ref<RecordEntry[]>([]);
const entretiens = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const selectedVehicleId = ref(localStorage.getItem('bq-car-active-vehicle') || '');

// Form State
const showAddModal = ref(false);
const formEntretien = ref({
  date: new Date().toISOString().split('T')[0],
  type: 'Vidange',
  prix: '',
  partenaire: '',
  commentaire: '',
  kilometrage: ''
});

const typesList = ["Vidange", "Révision", "Contrôle technique", "Pneus", "Freins", "Courroie", "Batterie", "Réparation", "Autre"];

const loadData = async () => {
  isLoading.value = true;
  try {
    vehicles.value = await getVehiclesRecords();
    carburants.value = await getCarburantRecords();
    entretiens.value = await getEntretienRecords();

    const activeVehicles = vehicles.value.filter(v => v.data.is_active !== false);
    if (activeVehicles.length > 0) {
      if (!selectedVehicleId.value || !vehicles.value.some(v => v.id === selectedVehicleId.value)) {
        selectedVehicleId.value = activeVehicles[0].id!;
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

watch(selectedVehicleId, (newId) => {
  if (newId) {
    localStorage.setItem('bq-car-active-vehicle', newId);
  }
});

const activeVehicle = computed(() => {
  return vehicles.value.find(v => v.id === selectedVehicleId.value);
});

// Active vehicle's maintenance timeline
const activeVehicleEntretiens = computed(() => {
  if (!activeVehicle.value) return [];
  const vName = activeVehicle.value.data.nom;
  return entretiens.value.filter(e => String(e.data.vehicule).trim() === vName.trim());
});

// Current active mileage
const currentMileage = computed(() => {
  if (!activeVehicle.value) return 0;
  const initialKm = Number(activeVehicle.value.data.kilometrage_initial) || 0;
  return calculateCurrentMileage(activeVehicle.value.data.nom, initialKm, carburants.value, entretiens.value);
});

// --- PREDICATIVE MAINTENANCE SUGGESTIONS ENGINE ---
// Defined maintenance schedules/rules
const SCHEDULES = [
  {
    type: 'Vidange',
    label: 'Vidange & Filtre à huile',
    limitMonths: 12,
    limitKm: 15000,
    desc: 'Essentiel pour préserver le moteur et assurer sa longévité.'
  },
  {
    type: 'Contrôle technique',
    label: 'Contrôle Technique réglementaire',
    limitMonths: 24,
    limitKm: 999999, // CT doesn't have a km limit
    desc: 'Obligation légale de contrôle de sécurité routière tous les 2 ans.'
  },
  {
    type: 'Révision',
    label: 'Révision complète constructeur',
    limitMonths: 24,
    limitKm: 30000,
    desc: 'Vérification complète de tous les fluides, filtres d\'habitacle et bougies.'
  },
  {
    type: 'Freins',
    label: 'Contrôle des plaquettes et disques',
    limitMonths: 36,
    limitKm: 40000,
    desc: 'Garantit l\'efficacité de ton freinage d\'urgence.'
  }
];

const maintenanceSuggestions = computed(() => {
  if (!activeVehicle.value) return [];
  const myEntretiens = activeVehicleEntretiens.value;
  const curKm = currentMileage.value;
  const now = Date.now();

  return SCHEDULES.map(sch => {
    // Find the most recent maintenance of this specific type
    // We do a loose check on type (either exact match or name contains it)
    const matches = myEntretiens.filter(e => 
      String(e.data.type).toLowerCase() === sch.type.toLowerCase() ||
      String(e.data.commentaire).toLowerCase().includes(sch.type.toLowerCase())
    );

    if (matches.length === 0) {
      // Never done or no history
      return {
        ...sch,
        status: 'unknown',
        statusText: 'Aucun historique',
        statusColor: 'text-warning',
        badgeClass: 'badge-warning',
        detailText: `Saisie requise pour planifier. Limites : ${sch.limitMonths} mois ou ${sch.limitKm.toLocaleString('fr')} km.`
      };
    }

    const latest = matches[0]; // sorted desc, so first is latest
    const lastDate = new Date(latest.data.date);
    const lastKm = Number(latest.data.kilometrage) || 0;

    // Time elapsed calculations
    const elapsedMs = now - lastDate.getTime();
    const elapsedMonths = Math.floor(elapsedMs / (30.44 * 24 * 3600 * 1000)); // Average month in ms

    // Distance driven calculations
    const drivenKm = curKm - lastKm;

    // Check overdue thresholds
    const isOverdueTime = elapsedMonths >= sch.limitMonths;
    const isOverdueKm = drivenKm >= sch.limitKm;

    // Approaching threshold (within 15%)
    const isApproachingTime = elapsedMonths >= sch.limitMonths * 0.85;
    const isApproachingKm = drivenKm >= sch.limitKm * 0.85;

    let status = 'ok';
    let statusText = 'À jour 🟢';
    let statusColor = 'text-success';
    let badgeClass = 'badge-success';
    let detailText = '';

    if (isOverdueTime || isOverdueKm) {
      status = 'overdue';
      statusText = 'En retard 🔴';
      statusColor = 'text-danger';
      badgeClass = 'badge-danger';
      
      const reasons = [];
      if (isOverdueTime) reasons.push(`${elapsedMonths} mois écoulés (limite : ${sch.limitMonths}m)`);
      if (isOverdueKm) reasons.push(`${drivenKm.toLocaleString('fr')} km parcourus (limite : ${sch.limitKm.toLocaleString('fr')}km)`);
      detailText = `Dépassement : ${reasons.join(' et ')}.`;
    } else if (isApproachingTime || isApproachingKm) {
      status = 'soon';
      statusText = 'À prévoir bientôt 🟡';
      statusColor = 'text-warning';
      badgeClass = 'badge-warning';

      const reasons = [];
      if (isApproachingTime) reasons.push(`dans ${sch.limitMonths - elapsedMonths} mois`);
      if (isApproachingKm) reasons.push(`dans ${(sch.limitKm - drivenKm).toLocaleString('fr')} km`);
      detailText = `Échéance à prévoir : ${reasons.join(' ou ')}.`;
    } else {
      // completely ok
      const monthsLeft = sch.limitMonths - elapsedMonths;
      const kmLeft = sch.limitKm - drivenKm;
      
      const parts = [];
      if (sch.limitMonths < 100) parts.push(`tranquille pendant ${monthsLeft} mois`);
      if (sch.limitKm < 900000) parts.push(`encore ${kmLeft.toLocaleString('fr')} km possibles`);
      detailText = `Prochaine échéance : ${parts.join(' ou ')}. (Dernière fait à ${lastKm.toLocaleString('fr')} km le ${formatToFrenchDate(latest.data.date)}).`;
    }

    return {
      ...sch,
      status,
      statusText,
      statusColor,
      badgeClass,
      detailText,
      lastKm,
      lastDate: latest.data.date
    };
  });
});

// Open Add modal
const openAddModal = () => {
  if (!activeVehicle.value) {
    alert('Veuillez d\'abord ajouter un véhicule.');
    return;
  }
  formEntretien.value = {
    date: new Date().toISOString().split('T')[0],
    type: 'Vidange',
    prix: '',
    partenaire: '',
    commentaire: '',
    kilometrage: String(currentMileage.value || '') // pre-fill with current odometer!
  };
  showAddModal.value = true;
};

// Handle Log
const handleAddEntretien = async () => {
  if (!activeVehicle.value) return;
  const km = Number(formEntretien.value.kilometrage) || 0;
  const p = Number(formEntretien.value.prix) || 0;

  if (km <= 0) {
    alert('Veuillez saisir un kilométrage valide supérieur à 0.');
    return;
  }

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: ENTRETIENS_COL_ID,
      data: {
        date: formEntretien.value.date,
        vehicule: activeVehicle.value.data.nom,
        type: formEntretien.value.type,
        prix: p || null,
        partenaire: formEntretien.value.partenaire.trim(),
        kilometrage: km,
        commentaire: formEntretien.value.commentaire.trim()
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddModal.value = false;
    emit('data-updated');
    loadData();
    alert('Entretien enregistré !');
  } catch (err) {
    console.error(err);
  }
};

// Delete record
const handleDeleteEntretien = async (id: string) => {
  if (!confirm('Supprimer cette fiche d\'entretien ?')) return;
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
  <div class="entretien-view">
    <div class="view-header">
      <div>
        <h2>🔧 Carnet d'Entretien</h2>
        <p class="text-secondary">Enregistre tes révisions et vidanges pour anticiper les futurs entretiens et conserver un historique limpide.</p>
      </div>
      <div class="view-actions" v-if="vehicles.filter(v => v.data.is_active !== false).length > 0">
        <button @click="openAddModal" class="btn btn-primary">
          <Plus :size="18" /> Saisir un entretien
        </button>
      </div>
    </div>

    <!-- Active Vehicle Selector Dropdown -->
    <div class="card glass select-vehicle-card mb-4">
      <div class="flex-row justify-between flex-wrap gap-4">
        <div class="form-group mb-0 select-box-container">
          <label>VÉHICULE ACTIF</label>
          <select v-model="selectedVehicleId" class="select select-vehicle">
            <option v-if="vehicles.length === 0" value="">Aucun véhicule</option>
            <option 
              v-for="v in vehicles" 
              :key="v.id" 
              :value="v.id"
              :class="{ 'inactive-option': v.data.is_active === false }"
            >
              {{ v.data.nom }} {{ v.data.is_active === false ? '(Vendu / Inactif)' : '' }}
            </option>
          </select>
        </div>

        <!-- Current Mileage display -->
        <div class="mileage-info-box" v-if="activeVehicle">
          <span class="stat-label font-bold text-xs text-muted block uppercase">Odomètre actuel estimé</span>
          <span class="stat-val text-primary font-black text-xl">{{ Math.round(currentMileage).toLocaleString('fr') }} km</span>
        </div>
      </div>
    </div>

    <!-- Alert state if no active vehicle -->
    <div v-if="vehicles.filter(v => v.data.is_active !== false).length === 0" class="card glass text-center py-4 text-muted">
      <ShieldAlert class="mx-auto mb-2 text-warning" :size="36" />
      <h3>Aucun véhicule actif</h3>
      <p class="text-secondary text-sm mt-2">Saisis ton premier véhicule dans l'onglet **Garage (Options)** pour commencer à suivre tes entretiens.</p>
    </div>

    <div v-else class="entretien-dashboard-grid">
      <!-- Left Column: Predictive Maintenance Suggestions -->
      <div class="predictive-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Sparkles :size="18" class="text-accent" /> Calendrier de Maintenance Préventive</h3>
          <p class="text-secondary text-xs mb-4">Calculé dynamiquement selon tes limites recommandées de temps (mois) et d'usure (kilomètres parcourus depuis l'intervention).</p>

          <div v-if="isLoading" class="text-center py-4">
            <div class="mini-spinner"></div>
          </div>

          <div v-else class="suggestions-list">
            <div 
              v-for="sug in maintenanceSuggestions" 
              :key="sug.type" 
              class="suggestion-item-card"
              :class="sug.status"
            >
              <div class="sug-header">
                <div>
                  <h4 class="font-bold text-sm">{{ sug.label }}</h4>
                  <p class="text-muted text-xs mt-0.5">{{ sug.desc }}</p>
                </div>
                <span class="badge font-bold" :class="sug.badgeClass">{{ sug.statusText }}</span>
              </div>
              
              <div class="sug-details-box mt-3 text-sm text-secondary">
                {{ sug.detailText }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Timeline -->
      <div class="timeline-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Calendar :size="18" class="text-primary" /> Historique des Interventions</h3>
          
          <div v-if="isLoading" class="text-center py-4">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="activeVehicleEntretiens.length === 0" class="text-center py-4 text-muted">
            <p>Aucune fiche d'entretien enregistrée pour ce véhicule.</p>
            <button @click="openAddModal" class="btn btn-primary btn-sm mt-3">
              Créer ma première intervention
            </button>
          </div>

          <div v-else class="timeline-list">
            <div v-for="e in activeVehicleEntretiens" :key="e.id" class="timeline-item">
              <div class="timeline-badge-marker"></div>
              
              <div class="timeline-content card glass">
                <div class="timeline-header flex-row justify-between">
                  <span class="type-pill badge badge-primary">{{ e.data.type }}</span>
                  <span class="timeline-km font-bold text-accent text-sm">{{ e.data.kilometrage.toLocaleString('fr') }} km</span>
                </div>

                <div class="timeline-body mt-2 text-sm">
                  <div class="flex-row text-muted text-xs justify-between mb-1">
                    <span>Le {{ formatToFrenchDate(e.data.date) }}</span>
                    <span v-if="e.data.partenaire">Garage : <strong>{{ e.data.partenaire }}</strong></span>
                  </div>
                  <p class="text-secondary italic mt-1">{{ e.data.commentaire || 'Aucune note.' }}</p>
                  
                  <div class="flex-row justify-between border-top pt-2 mt-2" v-if="e.data.prix">
                    <span class="text-warning font-bold">{{ e.data.prix }} €</span>
                    <button @click="handleDeleteEntretien(e.id!)" class="delete-link text-xs">Supprimer</button>
                  </div>
                  <div class="flex-row justify-end border-top pt-2 mt-2" v-else>
                    <button @click="handleDeleteEntretien(e.id!)" class="delete-link text-xs">Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Saisie Entretien Modal -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>🔧 Saisir une Intervention d'Entretien</h3>
          <button @click="showAddModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Date de l'intervention</label>
            <input v-model="formEntretien.date" type="date" class="input" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Type de maintenance *</label>
              <select v-model="formEntretien.type" class="select">
                <option v-for="t in typesList" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Kilométrage (Compteur - km) *</label>
              <input v-model="formEntretien.kilometrage" type="number" min="0" placeholder="Ex: 145000" class="input" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Coût de l'intervention (€)</label>
              <input v-model="formEntretien.prix" type="number" step="0.01" min="0" placeholder="Ex: 120.00" class="input" />
            </div>
            <div class="form-group">
              <label>Garage / Partenaire</label>
              <input v-model="formEntretien.partenaire" type="text" placeholder="Ex: Norauto, Peugeot Lyon" class="input" />
            </div>
          </div>

          <div class="form-group mt-2">
            <label>Commentaire / Détails des travaux</label>
            <textarea v-model="formEntretien.commentaire" rows="3" placeholder="Ex: Vidange filtre à huile et filtre à air, contrôle niveaux..." class="textarea"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddEntretien" class="btn btn-primary" :disabled="!formEntretien.kilometrage">
            Enregistrer l'entretien
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.select-vehicle-card {
  border-color: rgba(59, 130, 246, 0.15);
  background-color: rgba(59, 130, 246, 0.01);
}

.select-box-container {
  width: 250px;
  @media (max-width: 768px) {
    width: 100%;
  }
}

.select-vehicle {
  font-weight: 800;
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.3);
  
  &:focus {
    border-color: var(--color-primary);
  }
}

.inactive-option {
  color: var(--text-muted);
  text-decoration: line-through;
}

.mileage-info-box {
  display: flex;
  flex-direction: column;
}

.entretien-dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.suggestion-item-card {
  border: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
  padding: 1rem;
  transition: var(--transition);
  
  &.overdue {
    border-color: rgba(239, 68, 68, 0.2);
    background-color: rgba(239, 68, 68, 0.02);
  }
  
  &.soon {
    border-color: rgba(245, 158, 11, 0.2);
    background-color: rgba(245, 158, 11, 0.02);
  }

  &.ok {
    border-color: rgba(16, 185, 129, 0.2);
    background-color: rgba(16, 185, 129, 0.01);
  }
}

.sug-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.sug-details-box {
  background-color: rgba(15, 23, 42, 0.4);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-left: 1rem;
  border-left: 2px solid var(--border-color);
  position: relative;
  margin-left: 0.5rem;
  margin-top: 1rem;
}

.timeline-item {
  position: relative;
}

.timeline-badge-marker {
  position: absolute;
  left: -21px;
  top: 14px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--color-primary);
  border: 2px solid var(--bg-primary);
}

.timeline-content {
  padding: 0.85rem !important;
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
.py-4 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
.font-bold { font-weight: 700; }
.text-center { text-align: center; }
.block { display: block; }
.font-black { font-weight: 900; }

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
