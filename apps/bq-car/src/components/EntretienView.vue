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
import { Plus, Calendar, ShieldAlert, Sparkles, X, Edit2, Trash2, Wrench } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

const vehicles = ref<RecordEntry[]>([]);
const carburants = ref<RecordEntry[]>([]);
const entretiens = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const selectedVehicleId = ref(localStorage.getItem('bq-car-active-vehicle') || '');

// Form State
const showAddModal = ref(false);
const editingEntretien = ref<RecordEntry | null>(null);
const formEntretien = ref({
  date: new Date().toISOString().split('T')[0],
  type: 'Vidange',
  prix: '',
  partenaire: '',
  commentaire: '',
  kilometrage: ''
});

const typesList = ["Vidange", "Révision", "Contrôle technique", "Pneus", "Freins", "Courroie", "Batterie", "Bougies", "Climatisation", "Réparation", "Autre"];

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

// Total maintenance cost
const totalMaintenanceCost = computed(() => {
  return activeVehicleEntretiens.value.reduce((sum, e) => {
    return sum + (Number(e.data.prix) || 0);
  }, 0);
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
    label: 'Contrôle Technique',
    limitMonths: 24,
    limitKm: 999999, // CT doesn't have a km limit
    desc: 'Obligation légale de contrôle de sécurité routière tous les 2 ans.'
  },
  {
    type: 'Révision',
    label: 'Révision complète',
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
  },
  {
    type: 'Pneus',
    label: 'Changement ou permutation des pneus',
    limitMonths: 60,
    limitKm: 45000,
    desc: 'Assure une bonne adhérence au sol et des distances de freinage optimales.'
  },
  {
    type: 'Batterie',
    label: 'Remplacement de la batterie',
    limitMonths: 48,
    limitKm: 999999,
    desc: 'Prévient les pannes de démarrage, notamment en période hivernale.'
  },
  {
    type: 'Courroie',
    label: 'Courroie de distribution',
    limitMonths: 120,
    limitKm: 120000,
    desc: 'Élément capital. Son remplacement préventif évite une casse moteur définitive.'
  },
  {
    type: 'Bougies',
    label: 'Bougies d\'allumage ou de préchauffage',
    limitMonths: 48,
    limitKm: 60000,
    desc: 'Garantit une bonne combustion, réduit les émissions et facilite les démarrages.'
  },
  {
    type: 'Climatisation',
    label: 'Recharge clim & Filtre habitacle',
    limitMonths: 24,
    limitKm: 30000,
    desc: 'Maintient un air sain dans l\'habitacle et prévient l\'usure prématurée du compresseur.'
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
        statusLabel: 'Aucun historique',
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
    let statusText = 'À jour';
    let statusLabel = 'À jour';
    let statusColor = 'text-success';
    let badgeClass = 'badge-success';
    let detailText = '';

    if (isOverdueTime || isOverdueKm) {
      status = 'overdue';
      statusText = 'En retard';
      statusLabel = 'En retard';
      statusColor = 'text-danger';
      badgeClass = 'badge-danger';

      const reasons = [];
      if (isOverdueTime) reasons.push(`${elapsedMonths} mois écoulés (limite : ${sch.limitMonths}m)`);
      if (isOverdueKm) reasons.push(`${drivenKm.toLocaleString('fr')} km parcourus (limite : ${sch.limitKm.toLocaleString('fr')}km)`);
      detailText = `Dépassement : ${reasons.join(' et ')}.`;
    } else if (isApproachingTime || isApproachingKm) {
      status = 'soon';
      statusText = 'À prévoir bientôt';
      statusLabel = 'À prévoir bientôt';
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
      statusLabel,
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
    toast.warning('Veuillez d\'abord ajouter un véhicule.');
    return;
  }
  editingEntretien.value = null;
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

// Open Edit modal
const openEditModal = (e: RecordEntry) => {
  editingEntretien.value = e;
  formEntretien.value = {
    date: e.data.date || new Date().toISOString().split('T')[0],
    type: e.data.type || 'Vidange',
    prix: e.data.prix !== null && e.data.prix !== undefined ? String(e.data.prix) : '',
    partenaire: e.data.partenaire || '',
    commentaire: e.data.commentaire || '',
    kilometrage: String(e.data.kilometrage || '')
  };
  showAddModal.value = true;
};

// Close Modal
const closeModal = () => {
  showAddModal.value = false;
  editingEntretien.value = null;
};

// Handle Log / Save (Add and Edit support)
const handleSaveEntretien = async () => {
  if (!activeVehicle.value) return;
  const km = Number(formEntretien.value.kilometrage) || 0;
  const p = Number(formEntretien.value.prix) || 0;

  if (km <= 0) {
    toast.warning('Veuillez saisir un kilométrage valide supérieur à 0.');
    return;
  }

  try {
    if (editingEntretien.value) {
      // Edit Mode
      await db.records.update(editingEntretien.value.id!, {
        data: {
          ...editingEntretien.value.data,
          date: formEntretien.value.date,
          type: formEntretien.value.type,
          prix: p || null,
          partenaire: formEntretien.value.partenaire.trim(),
          kilometrage: km,
          commentaire: formEntretien.value.commentaire.trim()
        },
        updatedAt: Date.now()
      });
      toast.success('Entretien mis à jour !');
    } else {
      // Add Mode
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
      toast.success('Entretien enregistré !');
    }

    showAddModal.value = false;
    editingEntretien.value = null;
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

// Delete record
const handleDeleteEntretien = async (id: string) => {
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
        <h2>Carnet d'entretien</h2>
        <p class="text-sub">Enregistre tes révisions et vidanges pour anticiper les futurs entretiens et conserver un historique limpide.</p>
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

        <!-- Current Mileage & Total Cost displays -->
        <div class="summary-stats-row" v-if="activeVehicle">
          <div class="mileage-info-box">
            <span class="stat-label font-bold text-xs text-muted block">ODOMÈTRE ESTIMÉ</span>
            <span class="stat-val font-black text-xl">{{ Math.round(currentMileage).toLocaleString('fr') }} km</span>
          </div>
          <div class="cost-info-box">
            <span class="stat-label font-bold text-xs text-muted block">DÉPENSES ENTRETIEN</span>
            <span class="stat-val font-black text-xl">{{ totalMaintenanceCost.toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} €</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Alert state if no active vehicle -->
    <div v-if="vehicles.filter(v => v.data.is_active !== false).length === 0" class="card glass text-center py-4 text-muted">
      <ShieldAlert class="mx-auto mb-2 text-warning" :size="36" />
      <h3>Aucun véhicule actif</h3>
      <p class="text-sub text-sm mt-2">Saisis ton premier véhicule dans l'onglet <strong>Paramètres</strong> pour commencer à suivre tes entretiens.</p>
    </div>

    <div v-else class="entretien-dashboard-grid" :class="{ 'single-col': activeVehicle && activeVehicle.data.is_active === false }">
      <!-- Left Column: Predictive Maintenance Suggestions -->
      <div class="predictive-col" v-if="activeVehicle && activeVehicle.data.is_active !== false">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Sparkles :size="18" /> Calendrier de maintenance préventive</h3>
          <p class="text-sub text-xs mb-4">Calculé dynamiquement selon tes limites recommandées de temps (mois) et d'usure (kilomètres parcourus depuis l'intervention).</p>

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
                <span class="badge font-bold sug-status-badge" :class="sug.badgeClass">
                  <span class="badge-text">{{ sug.statusLabel }}</span>
                </span>
              </div>
              
              <div class="sug-details-box mt-3 text-sm text-sub">
                {{ sug.detailText }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Timeline -->
      <div class="timeline-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Calendar :size="18" /> Historique des interventions</h3>
          
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
                  <span class="badge badge-primary">{{ e.data.type }}</span>
                  <span class="timeline-km font-bold text-sub text-sm">
                    {{ (e.data.kilometrage !== undefined && e.data.kilometrage !== null) ? Number(e.data.kilometrage).toLocaleString('fr') : 'N/A' }} km
                  </span>
                </div>

                <div class="timeline-body mt-2 text-sm">
                  <div class="flex-row text-muted text-xs justify-between mb-1">
                    <span>{{ formatToFrenchDate(e.data.date) }}</span>
                    <span v-if="e.data.partenaire" class="ml-4"><strong>{{ e.data.partenaire }}</strong></span>
                  </div>
                  <p class="text-primary font-bold mt-1" v-if="e.data.prix !== undefined && e.data.prix !== null">{{ Number(e.data.prix).toFixed(2) }} €</p>
                  
                  <div class="flex-row justify-between border-top pt-2 mt-2">
                    <span class="text-muted text-xs italic">{{ e.data.commentaire || 'Aucun commentaire.' }}</span>
                    <div class="action-buttons flex-row gap-2">
                      <button @click="openEditModal(e)" class="action-btn edit" title="Modifier">
                        <Edit2 :size="14" />
                      </button>
                      <button @click="handleDeleteEntretien(e.id!)" class="action-btn delete" title="Supprimer">
                        <Trash2 :size="14" />
                      </button>
                    </div>
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
          <h3 class="flex-row align-center gap-1"><Wrench :size="18" /> {{ editingEntretien ? 'Modifier l\'intervention d\'entretien' : 'Saisir une intervention d\'entretien' }}</h3>
          <button @click="closeModal" class="modal-close"><X :size="20" /></button>
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
              <label>Kilométrage enregistré *</label>
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
            <label>Commentaire</label>
            <textarea v-model="formEntretien.commentaire" rows="3" placeholder="Ex: Vidange filtre à huile et filtre à air, contrôle niveaux..." class="textarea"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeModal" class="btn btn-secondary">Annuler</button>
          <button @click="handleSaveEntretien" class="btn btn-primary" :disabled="!formEntretien.kilometrage">
            {{ editingEntretien ? 'Enregistrer les modifications' : 'Enregistrer l\'entretien' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.select-vehicle-card {
  border-color: color-mix(in srgb, var(--color-primary) 15%, transparent);
  background-color: color-mix(in srgb, var(--color-primary) 1%, transparent);
}

.select-box-container {
  width: 250px;
  @media (max-width: 768px) {
    width: 100%;
  }
}

.select-vehicle {
  font-weight: 800;
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  
  &:focus {
    border-color: var(--color-primary);
  }
}

.inactive-option {
  color: var(--text-muted);
  text-decoration: line-through;
}

.summary-stats-row {
  display: flex;
  gap: 2rem;
  align-items: center;
  flex-wrap: wrap;
}

.mileage-info-box,
.cost-info-box {
  display: flex;
  flex-direction: column;
}

.entretien-dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  &.single-col {
    grid-template-columns: 1fr;
  }
  
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
  background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
  border-radius: var(--radius-sm);
  padding: 1rem;
  transition: var(--transition);
  
  &.overdue {
    border-color: color-mix(in srgb, var(--color-danger) 20%, transparent);
    background-color: color-mix(in srgb, var(--color-danger) 2%, transparent);
  }
  
  &.soon {
    border-color: color-mix(in srgb, var(--color-warning) 20%, transparent);
    background-color: color-mix(in srgb, var(--color-warning) 2%, transparent);
  }

  &.ok {
    border-color: color-mix(in srgb, var(--color-success) 20%, transparent);
    background-color: color-mix(in srgb, var(--color-success) 1%, transparent);
  }
}

.sug-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  
  @media (max-width: 576px) {
    align-items: center;
  }
}

.sug-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  white-space: nowrap;
  
  @media (max-width: 576px) {
    padding: 0;
    border-radius: 50%;
    width: 26px;
    height: 26px;
    justify-content: center;
    align-items: center;
    
    .badge-text {
      display: none;
    }
    
    .badge-emoji {
      font-size: 0.85rem;
      line-height: 1;
      margin: 0;
    }
  }
}

.sug-details-box {
  background-color: var(--bg-glass);
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
.action-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.text-xs { font-size: 0.75rem; }
</style>
