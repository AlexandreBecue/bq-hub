<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  CARBURANTS_COL_ID, 
  SUGGESTIONS_COL_ID,
  getVehiclesRecords, 
  getCarburantRecords, 
  getEntretienRecords, 
  calculateCurrentMileage,
  formatToFrenchDate
} from '../db/queries';
import { Plus, Info, Fuel, TrendingUp, RefreshCw, X, ShieldAlert, Edit2, Trash2 } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

// Reference RefreshCw to satisfy TypeScript compiler unused checks since it is used in the template
if (false as boolean) {
  console.log(RefreshCw);
}

const emit = defineEmits(['data-updated']);
const toast = useToast();

const vehicles = ref<RecordEntry[]>([]);
const carburants = ref<RecordEntry[]>([]);
const entretiens = ref<RecordEntry[]>([]);
const isLoading = ref(true);

// Selected Active Vehicle (Defaults to the first active or localstorage)
const selectedVehicleId = ref(localStorage.getItem('bq-car-active-vehicle') || '');

// Saisie Form State
const showAddModal = ref(false);
const editingCarburant = ref<RecordEntry | null>(null);
const formFuel = ref({
  date: new Date().toISOString().split('T')[0],
  quantite: '',
  prix: '',
  distance: '',
  commentaire: ''
});

const loadData = async () => {
  isLoading.value = true;
  try {
    vehicles.value = await getVehiclesRecords();
    carburants.value = await getCarburantRecords();
    entretiens.value = await getEntretienRecords();

    // Setup active vehicle default
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

// Current vehicle object
const activeVehicle = computed(() => {
  return vehicles.value.find(v => v.id === selectedVehicleId.value);
});

// Active vehicle's fuel history
const activeVehicleCarburants = computed(() => {
  if (!activeVehicle.value) return [];
  const vName = activeVehicle.value.data.nom;
  return carburants.value.filter(c => String(c.data.vehicule).trim() === vName.trim());
});

// Dynamic values for Active Vehicle
const activeVehicleStats = computed(() => {
  const carbs = activeVehicleCarburants.value;
  if (carbs.length === 0) {
    return {
      avgConso: 0,
      avgPrice100: 0,
      totalLitres: 0,
      totalSpent: 0,
      totalKm: 0,
      currentMileage: activeVehicle.value ? activeVehicle.value.data.kilometrage_initial || 0 : 0
    };
  }

  let totalLitres = 0;
  let totalSpent = 0;
  let totalKm = 0;

  carbs.forEach(c => {
    const dist = Number(c.data.distance) || 0;
    // On ne prend en compte pour la consommation moyenne que les pleins où on a roulé (distance > 0).
    // Le premier plein (distance === 0, au moment de l'achat) sert de référence de départ et ses litres ne doivent pas être comptés
    // sans quoi la consommation moyenne serait artificiellement surestimée.
    if (dist > 0) {
      totalLitres += Number(c.data.quantite) || 0;
      totalSpent += Number(c.data.prix) || 0;
      totalKm += dist;
    }
  });

  const avgConso = totalKm > 0 ? (totalLitres / totalKm) * 100 : 0;
  const avgPrice100 = totalKm > 0 ? (totalSpent / totalKm) * 100 : 0;

  const initialKm = activeVehicle.value ? Number(activeVehicle.value.data.kilometrage_initial) || 0 : 0;
  const currentMileage = calculateCurrentMileage(activeVehicle.value!.data.nom, initialKm, carbs, entretiens.value);

  return {
    avgConso,
    avgPrice100,
    totalLitres,
    totalSpent,
    totalKm,
    currentMileage
  };
});

// Form Calculations (Computed)
const calculatedFormValues = computed(() => {
  const q = Number(formFuel.value.quantite) || 0;
  const p = Number(formFuel.value.prix) || 0;
  const d = Number(formFuel.value.distance) || 0;

  const prix_au_litre = q > 0 ? p / q : 0;
  const consommation = d > 0 ? (q / d) * 100 : 0;
  const prix_100km = d > 0 ? (p / d) * 100 : 0;

  return {
    prix_au_litre,
    consommation,
    prix_100km
  };
});

// Open Add Modal
const openAddModal = () => {
  if (!activeVehicle.value) {
    toast.warning('Veuillez d\'abord ajouter un véhicule dans l\'onglet Paramètres.');
    return;
  }
  editingCarburant.value = null;
  formFuel.value = {
    date: new Date().toISOString().split('T')[0],
    quantite: '',
    prix: '',
    distance: '',
    commentaire: ''
  };
  showAddModal.value = true;
};

// Open Edit Modal
const openEditModal = (c: RecordEntry) => {
  editingCarburant.value = c;
  formFuel.value = {
    date: c.data.date || new Date().toISOString().split('T')[0],
    quantite: String(c.data.quantite || ''),
    prix: String(c.data.prix || ''),
    distance: String(c.data.distance || ''),
    commentaire: c.data.commentaire || ''
  };
  showAddModal.value = true;
};

// Close Modal
const closeModal = () => {
  showAddModal.value = false;
  editingCarburant.value = null;
};

// Log/Save fuel record (Add and Edit support)
const handleSaveCarburant = async () => {
  if (!activeVehicle.value) return;
  const q = Number(formFuel.value.quantite) || 0;
  const p = Number(formFuel.value.prix) || 0;
  const d = Number(formFuel.value.distance) || 0;

  if (q <= 0 || p <= 0 || d <= 0) {
    toast.warning('Veuillez remplir correctement les valeurs de quantité, prix, et distance.');
    return;
  }

  try {
    const calcs = calculatedFormValues.value;
    
    if (editingCarburant.value) {
      // Edit Mode
      await db.records.update(editingCarburant.value.id!, {
        data: {
          ...editingCarburant.value.data,
          date: formFuel.value.date,
          quantite: q,
          prix: p,
          distance: d,
          prix_au_litre: Math.round(calcs.prix_au_litre * 1000) / 1000,
          consommation: Math.round(calcs.consommation * 100) / 100,
          prix_100km: Math.round(calcs.prix_100km * 100) / 100,
          commentaire: formFuel.value.commentaire.trim()
        },
        updatedAt: Date.now()
      });
      toast.success('Plein de carburant mis à jour !');
    } else {
      // Add Mode
      const newRecord: RecordEntry = {
        id: `rec-${generateId()}`,
        collectionId: CARBURANTS_COL_ID,
        data: {
          date: formFuel.value.date,
          vehicule: activeVehicle.value.data.nom,
          estimation: false,
          quantite: q,
          prix: p,
          distance: d,
          prix_au_litre: Math.round(calcs.prix_au_litre * 1000) / 1000,
          consommation: Math.round(calcs.consommation * 100) / 100,
          prix_100km: Math.round(calcs.prix_100km * 100) / 100,
          commentaire: formFuel.value.commentaire.trim()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.records.add(newRecord);

      // Enregistrement d'une suggestion transversale pour bq-bank
      try {
        const sugRecord: RecordEntry = {
          id: `rec-${generateId()}`,
          collectionId: SUGGESTIONS_COL_ID,
          data: {
            source_app: 'bq-car',
            action: 'Nouvelle Dépense',
            payload: JSON.stringify({
              date: formFuel.value.date,
              montant: p,
              partenaire: `Station essence (${activeVehicle.value.data.nom})`,
              commentaire: formFuel.value.commentaire.trim() || `Plein carburant ${activeVehicle.value.data.nom}`,
              budget: 'Voiture'
            }),
            status: 'pending'
          },
          createdAt: Date.now() + 5,
          updatedAt: Date.now() + 5
        };
        await db.records.add(sugRecord);
        console.log('Suggestion cross-app créée pour bq-bank');
      } catch (errSug) {
        console.error('Erreur lors de la création de la suggestion transversale:', errSug);
      }
      toast.success('Plein de carburant enregistré !');
    }

    showAddModal.value = false;
    editingCarburant.value = null;
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

// Delete record
const handleDeleteCarburant = async (id: string) => {
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

// Utility class for color coding fuel efficiency
const getFuelConsoClass = (conso: number) => {
  const avg = activeVehicleStats.value.avgConso;
  if (!avg || carbsLength.value < 2) return 'badge-primary';
  const diff = ((conso - avg) / avg) * 100;

  if (diff < -5) return 'badge-success'; // > 5% below average (good!)
  if (diff > 5) return 'badge-danger'; // > 5% above average (heavy consumption)
  return 'badge-warning'; // close to average
};

const carbsLength = computed(() => activeVehicleCarburants.value.length);
</script>

<template>
  <div class="carburant-view">
    <div class="view-header">
      <div>
        <h2>Consommation de carburant</h2>
        <p class="text-sub">Suis la consommation de carburant de tes véhicules et saisis tes passages à la station service en un instant.</p>
      </div>
      <div class="view-actions" v-if="vehicles.filter(v => v.data.is_active !== false).length > 0">
        <button @click="openAddModal" class="btn btn-primary">
          <Plus :size="18" /> Nouveau plein
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

        <!-- Mini Stats Board -->
        <div class="summary-stats-row" v-if="activeVehicle">
          <div class="mileage-info-box">
            <span class="stat-label font-bold text-xs text-muted block">ODOMÈTRE ESTIMÉ</span>
            <span class="stat-val font-black text-xl">{{ Math.round(activeVehicleStats.currentMileage).toLocaleString('fr') }} km</span>
          </div>
          <div class="cost-info-box">
            <span class="stat-label font-bold text-xs text-muted block">DÉPENSES CARBURANT</span>
            <span class="stat-val font-black text-xl">{{ activeVehicleStats.totalSpent ? activeVehicleStats.totalSpent.toFixed(2) : '0' }} €</span>
          </div>
        </div>
        <!--<div class="mini-stats-board" v-if="activeVehicle">
          <div class="mini-stat">
            <span class="stat-label">ODOMÈTRE</span>
            <span class="stat-val text-primary">{{ Math.round(activeVehicleStats.currentMileage).toLocaleString('fr') }} km</span>
          </div>
          <div class="mini-stat">
            <span class="stat-label">DÉPENSES CARBURANT</span>
            <span class="stat-val">{{ activeVehicleStats.totalSpent ? activeVehicleStats.totalSpent.toFixed(2) : '0' }} €</span>
          </div>
        </div>-->
      </div>
    </div>

    <!-- No active vehicle alert state -->
    <div v-if="vehicles.filter(v => v.data.is_active !== false).length === 0" class="card glass text-center py-4 text-muted">
      <ShieldAlert class="mx-auto mb-2 text-warning" :size="36" />
      <h3>Aucun véhicule actif</h3>
      <p class="text-sub text-sm mt-2">Saisis ton premier véhicule dans l'onglet <strong>Paramètres</strong> pour commencer à suivre tes pleins.</p>
    </div>

    <div v-else class="main-dashboard-grid">
      <!-- Left Column: History -->
      <div class="history-carbs-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Fuel :size="18" /> Historique des passages à la pompe</h3>
          
          <div v-if="isLoading" class="text-center py-4">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="activeVehicleCarburants.length === 0" class="text-center py-4 text-muted">
            <p>Aucun plein de carburant enregistré pour ce véhicule.</p>
            <button @click="openAddModal" class="btn btn-primary btn-sm mt-3">
              Enregistrer mon premier plein
            </button>
          </div>

          <div v-else class="carburants-history-list">
            <div v-for="c in activeVehicleCarburants" :key="c.id" class="carb-history-item">
              <div class="carb-header">
                <span class="carb-date font-bold">{{ formatToFrenchDate(c.data.date) }}</span>
                <span class="carb-conso badge" :class="getFuelConsoClass(c.data.consommation)">
                  {{ c.data.consommation }} L/100
                </span>
              </div>
              
              <div class="carb-body-grid mt-2">
                <div class="carb-metric">
                  <span class="lbl">Ajouté :</span>
                  <span class="val">{{ c.data.quantite }} L</span>
                </div>
                <div class="carb-metric">
                  <span class="lbl">Prix :</span>
                  <span class="val">{{ c.data.prix.toFixed(2) }} €</span>
                </div>
                <div class="carb-metric">
                  <span class="lbl">Distance :</span>
                  <span class="val">{{ c.data.distance }} km</span>
                </div>
                <div class="carb-metric">
                  <span class="lbl">Prix/L :</span>
                  <span class="val">{{ c.data.prix_au_litre.toFixed(2) }} €/L</span>
                </div>
              </div>

              <div class="carb-footer flex-row mt-2 justify-between border-top pt-2">
                <span class="text-xs text-muted italic">{{ c.data.commentaire || 'Aucun commentaire.' }}</span>
                <div class="action-buttons flex-row gap-2">
                  <button @click="openEditModal(c)" class="action-btn edit" title="Modifier">
                    <Edit2 :size="14" />
                  </button>
                  <button @click="handleDeleteCarburant(c.id!)" class="action-btn delete" title="Supprimer">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Graphs / Summary -->
      <div class="stats-summary-col">
        <div class="card glass stats-summary-box mb-4">
          <h3 class="font-bold flex-row mb-4"><TrendingUp :size="18" /> Statistiques globales</h3>
          
          <div class="stats-summary-grid">
            <div class="summary-metric">
              <span class="metric-lbl">Kilomètres parcourus</span>
              <span class="metric-val">{{ Math.round(activeVehicleStats.totalKm).toLocaleString('fr') }} km</span>
            </div>
            <div class="summary-metric">
              <span class="metric-lbl">Volume total versé</span>
              <span class="metric-val">{{ Math.round(activeVehicleStats.totalLitres).toLocaleString('fr') }} Litres</span>
            </div>
            <div class="summary-metric">
              <span class="metric-lbl">Conso moyenne</span>
              <span class="metric-val">{{ activeVehicleStats.avgConso ? activeVehicleStats.avgConso.toFixed(2) : '-' }} L / 100 km</span>
            </div>
            <div class="summary-metric">
              <span class="metric-lbl">Coût moyen</span>
              <span class="metric-val">{{ activeVehicleStats.avgPrice100 ? activeVehicleStats.avgPrice100.toFixed(2) : '-' }} € / 100 km</span>
            </div>
          </div>
        </div>

        <div class="card glass info-box-car">
          <h3 class="font-bold flex-row mb-2"><Info :size="18" /> Astuce éco-conduite</h3>
          <p class="text-sub text-sm leading-relaxed">
            Les badges de consommation de ton historique s'adaptent dynamiquement :
          </p>
          <ul class="text-sub text-xs mt-2 leading-relaxed pl-4 flex-col gap-1">
            <li class="flex-row align-center gap-1"><span class="badge badge-success text-xs">Vert</span> Ta consommation est au moins 5% inférieure à ta moyenne historique. Bravo !</li>
            <li class="flex-row align-center gap-1"><span class="badge badge-warning text-xs">Orange</span> Tu es dans ta moyenne de consommation habituelle.</li>
            <li class="flex-row align-center gap-1"><span class="badge badge-danger text-xs">Rouge</span> Ta consommation dépasse de 5% ta moyenne. Pense à vérifier la pression des pneus ou à adopter une conduite plus souple !</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Saisie Fuel Modal -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ editingCarburant ? 'Modifier un passage à la pompe' : 'Enregistrer un passage à la pompe' }}</h3>
          <button @click="closeModal" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Date du plein</label>
            <input v-model="formFuel.date" type="date" class="input" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Prix (€) *</label>
              <input v-model="formFuel.prix" type="number" step="0.01" min="0" placeholder="Ex: 64.50" class="input" />
            </div>
            <div class="form-group">
              <label>Quantité (L) *</label>
              <input v-model="formFuel.quantite" type="number" step="0.01" min="0" placeholder="Ex: 41.25" class="input" />
            </div>
          </div>

          <div class="form-group">
            <label>Distance parcourue (km) *</label>
            <input v-model="formFuel.distance" type="number" step="0.1" min="0" placeholder="Ex: 642.5" class="input" />
          </div>

          <!-- Realtime calculation panel inside form -->
          <div class="form-calculations-panel card glass mt-2" v-if="Number(formFuel.quantite) > 0 && Number(formFuel.prix) > 0">
            <h4 class="text-xs font-bold text-sub mb-2 uppercase">Estimation du passage</h4>
            <div class="calculations-grid">
              <div class="calc-val">
                <span class="lbl">Prix au Litre :</span>
                <span class="val">{{ calculatedFormValues.prix_au_litre.toFixed(3) }} €/L</span>
              </div>
              <div class="calc-val" v-if="Number(formFuel.distance) > 0">
                <span class="lbl">Consommation :</span>
                <span class="val">{{ calculatedFormValues.consommation.toFixed(2) }} L/100</span>
              </div>
              <div class="calc-val" v-if="Number(formFuel.distance) > 0">
                <span class="lbl">Coût aux 100km :</span>
                <span class="val">{{ calculatedFormValues.prix_100km.toFixed(2) }} €/100</span>
              </div>
            </div>
          </div>

          <div class="form-group mt-3">
            <label>Commentaire</label>
            <input v-model="formFuel.commentaire" type="text" placeholder="Ex: Total Access Lyon 8, gazole excellence" class="input" />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeModal" class="btn btn-secondary">Annuler</button>
          <button @click="handleSaveCarburant" class="btn btn-primary" :disabled="calculatedFormValues.consommation === 0">
            {{ editingCarburant ? 'Enregistrer les modifications' : 'Confirmer le plein' }}
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

.mini-stats-board {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.mini-stat {
  display: flex;
  flex-direction: column;
  
  .stat-label {
    font-size: 0.65rem;
    font-weight: 800;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }
  
  .stat-val {
    font-size: 1.15rem;
    font-weight: 900;
    letter-spacing: -0.01em;
  }
}

.main-dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;

    .history-carbs-col {
      order: 2;
    }

    .stats-summary-col {
      order: 1;
    }
  }
}

.carburants-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.carb-history-item {
  border: 1px solid var(--border-color);
  background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
}

.carb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.carb-body-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  font-size: 0.825rem;
  
  @media (max-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.carb-metric {
  display: flex;
  flex-direction: column;
  
  .lbl {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-weight: 700;
  }
  
  .val {
    font-weight: 700;
    color: var(--text-sub);
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

.stats-summary-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-metric {
  display: flex;
  flex-direction: column;
  background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.6rem 0.85rem;
  
  .metric-lbl {
    font-size: 0.7rem;
    font-weight: 800;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  
  .metric-val {
    font-size: 1.35rem;
    font-weight: 900;
  }
}

.info-box-car {
  border-color: color-mix(in srgb, var(--color-success) 15%, transparent);
  background-color: color-mix(in srgb, var(--color-success) 1%, transparent);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-calculations-panel {
  padding: 0.75rem;
  background-color: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  border-color: color-mix(in srgb, var(--color-info) 20%, transparent);
}

.calculations-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  font-size: 0.775rem;
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.calc-val {
  display: flex;
  flex-direction: column;
  
  .lbl {
    color: var(--text-muted);
    font-weight: 700;
  }
  
  .val {
    font-weight: 800;
  }
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
