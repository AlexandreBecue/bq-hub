<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  PRESC_COL_ID, 
  getPrescRecords, 
  formatToFrenchDate 
} from '../db/queries';
import { getGoogleCalendarUrl } from '../services/calendar';
import { Plus, X, Heart, ShieldAlert, Edit2, Trash2, Calendar, Pill, Package } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

const presc = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const showAddModal = ref(false);
const editingPrescId = ref<string | null>(null);
const activeCategoryFilter = ref<'all' | 'traitements' | 'ponctuel'>('all');

// Form State
const formPresc = ref({
  nom_medicament: '',
  type_medicament: 'Traitement' as 'Traitement' | 'Ponctuel',
  posologie: '',
  posologie_par_jour: 1,
  stock_actuel: '',
  date_debut: new Date().toISOString().split('T')[0],
  date_fin: '',
  actif: true,
  medecin_prescripteur: '',
  motif_habituel: ''
});

const automedicationSuggestions = [
  { name: 'Doliprane 1000mg', posologie: '1 comprimé toutes les 6h si douleur ou fièvre (max 3/j)', maxJour: 3, motif: 'Douleurs, maux de tête, fièvre' },
  { name: 'Spasfon', posologie: '2 comprimés en cas de crise (max 6/j)', maxJour: 6, motif: 'Douleurs spasmodiques abdominales ou règles' },
  { name: 'Lysopaïne', posologie: '1 pastille à sucer 3 à 6 fois par jour', maxJour: 6, motif: 'Mal de gorge peu intense' },
  { name: 'Ibuprofène 400mg', posologie: '1 comprimé pendant un repas (max 3/j, max 3 jours)', maxJour: 3, motif: 'Douleurs inflammatoires, règles' },
  { name: 'Gaviscon', posologie: '1 sachet après les repas', maxJour: 4, motif: 'Brûlures d\'estomac et reflux' }
];

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

const isPonctuelItem = (p: RecordEntry): boolean => {
  const t = p.data.type_medicament;
  return t === 'Ponctuel' || t === 'Automédication';
};

const treatmentsList = computed(() => presc.value.filter(p => !isPonctuelItem(p)));
const ponctuelsList = computed(() => presc.value.filter(p => isPonctuelItem(p)));

// Segment treatments into active vs finished (ponctuels are never active)
const treatmentsActive = computed(() => treatmentsList.value.filter(p => p.data.actif === true || p.data.actif === 1));
const treatmentsFinished = computed(() => treatmentsList.value.filter(p => p.data.actif === false || p.data.actif === 0));

const openAddModal = (type: 'Traitement' | 'Ponctuel' = 'Traitement') => {
  editingPrescId.value = null;
  formPresc.value = {
    nom_medicament: '',
    type_medicament: type,
    posologie: type === 'Ponctuel' ? '1 prise si besoin' : '1 par jour',
    posologie_par_jour: 1,
    stock_actuel: '',
    date_debut: new Date().toISOString().split('T')[0],
    date_fin: '',
    actif: type === 'Traitement',
    medecin_prescripteur: '',
    motif_habituel: ''
  };
  showAddModal.value = true;
};

const openEditPresc = (p: RecordEntry) => {
  editingPrescId.value = p.id || null;
  const isP = isPonctuelItem(p);
  formPresc.value = {
    nom_medicament: p.data.nom_medicament || '',
    type_medicament: isP ? 'Ponctuel' : 'Traitement',
    posologie: p.data.posologie || '',
    posologie_par_jour: p.data.posologie_par_jour || 1,
    stock_actuel: p.data.stock_actuel !== undefined && p.data.stock_actuel !== null ? String(p.data.stock_actuel) : '',
    date_debut: p.data.date_debut || new Date().toISOString().split('T')[0],
    date_fin: p.data.date_fin || '',
    actif: isP ? false : (p.data.actif !== false),
    medecin_prescripteur: p.data.medecin_prescripteur || '',
    motif_habituel: p.data.motif_habituel || ''
  };
  showAddModal.value = true;
};

const applySuggestion = (s: typeof automedicationSuggestions[0]) => {
  formPresc.value.nom_medicament = s.name;
  formPresc.value.type_medicament = 'Ponctuel';
  formPresc.value.posologie = s.posologie;
  formPresc.value.posologie_par_jour = s.maxJour;
  formPresc.value.motif_habituel = s.motif;
  formPresc.value.actif = false;
};

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
    toast.info(currentVal ? 'Traitement marqué comme terminé.' : 'Traitement réactivé.');
  } catch (err) {
    console.error(err);
  }
};

// Add or Edit Treatment
const handleSavePresc = async () => {
  if (!formPresc.value.nom_medicament.trim() || !formPresc.value.posologie.trim()) {
    toast.warning('Veuillez renseigner le nom du médicament et sa posologie.');
    return;
  }

  try {
    const isP = formPresc.value.type_medicament === 'Ponctuel';
    const dataPayload = {
      nom_medicament: formPresc.value.nom_medicament.trim(),
      type_medicament: formPresc.value.type_medicament,
      posologie: formPresc.value.posologie.trim(),
      posologie_par_jour: Number(formPresc.value.posologie_par_jour) || 1,
      stock_actuel: formPresc.value.stock_actuel !== '' ? Number(formPresc.value.stock_actuel) : null,
      date_debut: isP ? '' : formPresc.value.date_debut,
      date_fin: isP ? null : (formPresc.value.date_fin || null),
      actif: isP ? false : formPresc.value.actif,
      medecin_prescripteur: isP ? '' : formPresc.value.medecin_prescripteur.trim(),
      motif_habituel: formPresc.value.motif_habituel.trim()
    };

    if (editingPrescId.value) {
      await db.records.update(editingPrescId.value, {
        data: dataPayload,
        updatedAt: Date.now()
      });
      toast.success('Médication modifiée avec succès !');
    } else {
      const newRecord: RecordEntry = {
        id: `rec-${generateId()}`,
        collectionId: PRESC_COL_ID,
        data: dataPayload,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.records.add(newRecord);
      toast.success('Médication enregistrée !');
    }

    showAddModal.value = false;
    editingPrescId.value = null;
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

// Delete record
const handleDeletePresc = async (id: string) => {
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    emit('data-updated');
    loadData();
    toast.success('Médicament supprimé.');
  } catch (err) {
    console.error(err);
  }
};

const handleAddToGoogleCalendar = (t: RecordEntry) => {
  const url = getGoogleCalendarUrl({
    title: `Prise : ${t.data.nom_medicament}`,
    startDate: t.data.date_debut || new Date().toISOString().split('T')[0],
    startTime: '08:00',
    durationMinutes: 15,
    details: `Posologie : ${t.data.posologie}\n${t.data.motif_habituel ? `Motif : ${t.data.motif_habituel}\n` : ''}${t.data.medecin_prescripteur ? `Prescrit par : ${t.data.medecin_prescripteur}` : ''}`
  });
  window.open(url, '_blank');
};
</script>

<template>
  <div class="traitements-view">
    <div class="view-header flex-row justify-between align-center flex-wrap gap-3">
      <div>
        <h2>Traitements & médication</h2>
        <p class="text-sub">Pilulier personnel : gère tes traitements en cours et ton armoire à pharmacie de prises ponctuelles (doliprane, spasfon...).</p>
      </div>
      <div class="view-actions flex-row gap-2">
        <button @click="openAddModal('Ponctuel')" class="btn btn-secondary flex-row align-center gap-1">
          <Plus :size="16" /> Prise ponctuelle
        </button>
        <button @click="openAddModal('Traitement')" class="btn btn-primary flex-row align-center gap-1">
          <Plus :size="16" /> Nouveau traitement
        </button>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="filter-pills-row flex-row gap-2 mb-4">
      <button 
        class="filter-pill" 
        :class="{ active: activeCategoryFilter === 'all' }" 
        @click="activeCategoryFilter = 'all'"
      >
        Tous ({{ presc.length }})
      </button>
      <button 
        class="filter-pill" 
        :class="{ active: activeCategoryFilter === 'traitements' }" 
        @click="activeCategoryFilter = 'traitements'"
      >
        Traitements ({{ treatmentsList.length }})
      </button>
      <button 
        class="filter-pill" 
        :class="{ active: activeCategoryFilter === 'ponctuel' }" 
        @click="activeCategoryFilter = 'ponctuel'"
      >
        Prises ponctuelles ({{ ponctuelsList.length }})
      </button>
    </div>

    <!-- Main Content Layout -->
    <div class="traitements-dashboard-layout flex-col gap-4">
      <!-- 1. Active Treatments Card -->
      <div v-if="activeCategoryFilter !== 'ponctuel'" class="card glass">
        <h3 class="font-bold flex-row mb-4"><Heart :size="18" class="text-primary" /> Traitements en cours</h3>
        
        <div v-if="isLoading" class="text-center py-4">
          <div class="spinner"></div>
        </div>

        <div v-else-if="treatmentsActive.length === 0" class="text-center py-4 text-muted text-sm">
          <ShieldAlert class="mx-auto mb-2 text-muted" :size="36" />
          <p>Aucun traitement régulier actif en ce moment.</p>
        </div>

        <div v-else class="treatments-grid">
          <div v-for="t in treatmentsActive" :key="t.id" class="card glass hoverable treatment-card active">
            <div class="t-card-header flex-row justify-between align-start">
              <div>
                <h4 class="t-name font-black text-md">{{ t.data.nom_medicament }}</h4>
                <div class="flex-row gap-1 mt-1">
                  <span class="badge badge-primary text-xs">Traitement</span>
                  <span class="badge badge-success text-xs">En cours</span>
                  <span 
                    v-if="t.data.stock_actuel !== null && t.data.stock_actuel !== undefined" 
                    class="badge text-xs flex-row gap-1"
                    :class="t.data.stock_actuel <= 3 ? 'badge-danger font-bold' : 'badge-neutral'"
                  >
                    <Package :size="11" /> Stock: {{ t.data.stock_actuel }}
                  </span>
                </div>
              </div>
              <div class="flex-row gap-1">
                <button @click="handleAddToGoogleCalendar(t)" class="action-btn" title="Ajouter rappel dans Google Agenda">
                  <Calendar :size="14" />
                </button>
                <button @click="openEditPresc(t)" class="action-btn edit" title="Modifier">
                  <Edit2 :size="14" />
                </button>
                <button @click="handleDeletePresc(t.id!)" class="action-btn delete" title="Supprimer">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <div class="t-card-body mt-3 text-sm text-sub">
              <p class="posology-highlight font-bold text-sub">{{ t.data.posologie }}</p>
              <div class="t-dates-row mt-2 text-xs text-muted flex-row justify-between flex-wrap gap-2">
                <span>Début : <strong>{{ formatToFrenchDate(t.data.date_debut) }}</strong></span>
                <span v-if="t.data.date_fin">Fin : <strong>{{ formatToFrenchDate(t.data.date_fin) }}</strong></span>
                <span v-if="t.data.medecin_prescripteur">Prescrit par : <strong>Dr {{ t.data.medecin_prescripteur }}</strong></span>
              </div>
            </div>

            <div class="t-card-footer mt-4 border-top pt-2 flex-row justify-between">
              <span class="text-xs text-sub">Statut :</span>
              <div class="active-toggle flex-row">
                <label class="switch">
                  <input type="checkbox" :checked="t.data.actif !== false" @change="toggleTreatmentActive(t)" />
                  <span class="slider"></span>
                </label>
                <span class="active-lbl text-xs font-bold text-success">
                  En cours
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Ponctual Medications (Pharmacie / Armoire) - Never marked active -->
      <div v-if="activeCategoryFilter !== 'traitements'" class="card glass">
        <h3 class="font-bold flex-row mb-4"><Pill :size="18" class="text-secondary" /> Prises ponctuelles (Pharmacie personnelle)</h3>
        
        <div v-if="isLoading" class="text-center py-4">
          <div class="spinner"></div>
        </div>

        <div v-else-if="ponctuelsList.length === 0" class="text-center py-4 text-muted text-sm">
          <p>Aucune médication ponctuelle enregistrée (ex: Doliprane, Spasfon...).</p>
        </div>

        <div v-else class="treatments-grid">
          <div v-for="t in ponctuelsList" :key="t.id" class="card glass hoverable treatment-card ponctuel">
            <div class="t-card-header flex-row justify-between align-start">
              <div>
                <h4 class="t-name font-black text-md">{{ t.data.nom_medicament }}</h4>
                <div class="flex-row gap-1 mt-1">
                  <span class="badge badge-secondary text-xs">Ponctuel</span>
                  <span 
                    v-if="t.data.stock_actuel !== null && t.data.stock_actuel !== undefined" 
                    class="badge text-xs flex-row gap-1"
                    :class="t.data.stock_actuel <= 3 ? 'badge-danger font-bold' : 'badge-neutral'"
                  >
                    <Package :size="11" /> Stock: {{ t.data.stock_actuel }}
                  </span>
                </div>
              </div>
              <div class="flex-row gap-1">
                <button @click="openEditPresc(t)" class="action-btn edit" title="Modifier">
                  <Edit2 :size="14" />
                </button>
                <button @click="handleDeletePresc(t.id!)" class="action-btn delete" title="Supprimer">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <div class="t-card-body mt-3 text-sm text-sub">
              <p class="posology-highlight font-bold text-sub">{{ t.data.posologie }}</p>
              <p v-if="t.data.motif_habituel" class="text-xs text-muted mt-2 italic">
                Indications : {{ t.data.motif_habituel }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Historical Treatments Card -->
      <div v-if="activeCategoryFilter !== 'ponctuel'" class="card glass">
        <h3 class="font-bold flex-row mb-4"><Heart class="text-muted" :size="18" /> Historique des traitements terminés</h3>
        
        <div v-if="isLoading" class="text-center py-4">
          <div class="spinner"></div>
        </div>

        <div v-else-if="treatmentsFinished.length === 0" class="text-center py-4 text-muted text-sm">
          <p>Aucun traitement archivé.</p>
        </div>

        <div v-else class="treatments-grid">
          <div v-for="t in treatmentsFinished" :key="t.id" class="card glass hoverable treatment-card finished">
            <div class="t-card-header flex-row justify-between align-start">
              <div>
                <h4 class="t-name font-bold text-sm text-muted">{{ t.data.nom_medicament }}</h4>
                <div class="flex-row gap-1 mt-1">
                  <span class="badge badge-neutral text-xs">Traitement</span>
                  <span class="badge badge-neutral text-xs">Terminé</span>
                </div>
              </div>
              <div class="flex-row gap-1">
                <button @click="openEditPresc(t)" class="action-btn edit" title="Modifier">
                  <Edit2 :size="14" />
                </button>
                <button @click="handleDeletePresc(t.id!)" class="action-btn delete" title="Supprimer">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <div class="t-card-body mt-2 text-xs text-muted">
              <p>{{ t.data.posologie }}</p>
              <p class="mt-1">Période : {{ formatToFrenchDate(t.data.date_debut) }} - {{ formatToFrenchDate(t.data.date_fin) || 'Arrêt' }}</p>
            </div>

            <div class="t-card-footer mt-3 border-top pt-2 flex-row justify-between">
              <span class="text-xs text-sub">Réactiver :</span>
              <button @click="toggleTreatmentActive(t)" class="btn btn-secondary btn-sm text-xs">
                Remettre aux traitements en cours
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Saisie / Modification Modal -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3 class="flex-row gap-2">
            <Pill class="text-primary" />
            {{ editingPrescId ? 'Modifier la médication' : (formPresc.type_medicament === 'Ponctuel' ? 'Ajouter une prise ponctuelle' : 'Ajouter un traitement régulier') }}
          </h3>
          <button @click="showAddModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <!-- Type selection -->
          <div class="form-group mb-3">
            <label class="mb-1 block">Catégorie de médication *</label>
            <div class="flex-row gap-4">
              <label class="flex-row gap-2 align-center cursor-pointer">
                <input type="radio" value="Traitement" v-model="formPresc.type_medicament" />
                <span>Traitement régulier</span>
              </label>
              <label class="flex-row gap-2 align-center cursor-pointer">
                <input type="radio" value="Ponctuel" v-model="formPresc.type_medicament" />
                <span>Prise ponctuelle</span>
              </label>
            </div>
          </div>

          <!-- Quick suggestions for ponctuel -->
          <div v-if="formPresc.type_medicament === 'Ponctuel'" class="mb-3 card glass p-2">
            <span class="text-xs font-bold text-muted uppercase block mb-1">Suggestions rapides :</span>
            <div class="flex-row flex-wrap gap-1">
              <button 
                type="button" 
                v-for="s in automedicationSuggestions" 
                :key="s.name" 
                class="btn btn-secondary btn-sm text-xs" 
                @click="applySuggestion(s)"
              >
                {{ s.name }}
              </button>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Nom du médicament *</label>
              <input v-model="formPresc.nom_medicament" type="text" placeholder="Ex: Doliprane 1000mg, Amoxicilline..." class="input" />
            </div>
            <div class="form-group">
              <label>Posologie textuelle *</label>
              <input v-model="formPresc.posologie" type="text" placeholder="Ex: 1 comprimé 3x/jour, 1 si besoin..." class="input" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Nombre de prises max par jour</label>
              <input v-model.number="formPresc.posologie_par_jour" type="number" min="1" max="10" class="input" />
              <span class="text-xs text-muted">Permet d'afficher un compteur journalier si > 1</span>
            </div>
            <div class="form-group">
              <label>Stock restant (comprimés / gélules)</label>
              <input v-model="formPresc.stock_actuel" type="number" min="0" placeholder="Ex: 16 (optionnel)" class="input" />
              <span class="text-xs text-muted">Se décompte automatiquement à chaque prise</span>
            </div>
          </div>

          <div class="form-grid" v-if="formPresc.type_medicament === 'Traitement'">
            <div class="form-group">
              <label>Date début *</label>
              <input v-model="formPresc.date_debut" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>Date fin (si limitée)</label>
              <input v-model="formPresc.date_fin" type="date" class="input" />
            </div>
          </div>

          <div class="form-group mb-3" v-if="formPresc.type_medicament === 'Traitement'">
            <label>Médecin prescripteur</label>
            <input v-model="formPresc.medecin_prescripteur" type="text" placeholder="Ex: Dr Martin" class="input" />
          </div>

          <div class="form-group mb-3" v-if="formPresc.type_medicament === 'Ponctuel'">
            <label>Raison / Symptômes habituels</label>
            <input v-model="formPresc.motif_habituel" type="text" placeholder="Ex: Maux de tête, maux de gorge, crampes..." class="input" />
          </div>
        </div>

        <div class="modal-footer flex-row justify-end gap-2 border-top pt-3 mt-4">
          <button @click="showAddModal = false" class="btn btn-neutral">Annuler</button>
          <button @click="handleSavePresc" class="btn btn-primary">
            {{ editingPrescId ? 'Enregistrer les modifications' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.filter-pills-row {
  display: flex;
  overflow-x: auto;
}

.filter-pill {
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-full, 9999px);
  background: color-mix(in srgb, var(--color-border) 40%, transparent);
  border: 1px solid var(--color-border);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    color: var(--text-primary);
  }

  &.active {
    background: var(--color-primary);
    color: var(--color-primary-contrast, #fff);
    border-color: var(--color-primary);
  }
}

.treatments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.treatment-card {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  &.active {
    border-left: 3px solid var(--color-primary);
  }
  &.finished {
    opacity: 0.75;
  }
}

.posology-highlight {
  font-size: 0.95rem;
  line-height: 1.4;
}
</style>
