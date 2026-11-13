<script setup lang="ts">
import { ref, computed, onMounted, toRaw } from 'vue';
import { db, generateId, type RecordEntry } from '../db';
import { 
  PLANNING_COL_ID, 
  getPlanningRecords, 
  getRecipeRecords, 
  getStockRecords, 
  runStockAutomations, 
  consumeMealWithLeftovers,
  formatToFrenchDate 
} from '../db/queries';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  User, 
  X, 
  Play, 
  Edit2, 
  AlertTriangle, 
  Check, 
  Copy, 
  UtensilsCrossed 
} from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';
import { openGoogleCalendar } from '@bq/theme/calendar';

const toast = useToast();

const planningList = ref<RecordEntry[]>([]);
const recipes = ref<RecordEntry[]>([]);
const stockItems = ref<RecordEntry[]>([]);

// Active sub-tab
const activeTab = ref<'upcoming' | 'consumed' | 'all'>('upcoming');

// Add/Edit Planning Modal States
const showAddModal = ref(false);
const editingPlanningId = ref<string | null>(null);

const formDate = ref(new Date().toISOString().split('T')[0]);
const formMoment = ref<'Midi' | 'Soir' | 'Autre'>('Midi');
const formStatut = ref<'Prévu' | 'Préparé' | 'Consommé'>('Prévu');
const formRepasId = ref('');
const formConvives = ref(1);
const formIngredients = ref<string[]>([]);
const formCommentaire = ref('');

// Filter out non-food categories (hygiène, bazar, etc.) while preserving any manually selected items
const isNonFoodCategory = (cat?: string): boolean => {
  if (!cat) return false;
  const c = cat.toLowerCase();
  return c.includes('hygiène') || c.includes('hygiene') || c.includes('entretien') || c.includes('bazar');
};

const foodStockItems = computed(() => {
  return stockItems.value.filter(item => {
    if (formIngredients.value.includes(item.id!)) {
      return true;
    }
    return !isNonFoodCategory(item.data.categorie);
  });
});

// Consume Modal & Leftovers States
const showConsumeModal = ref(false);
const mealToConsume = ref<RecordEntry | null>(null);
const consumeForm = ref({
  consumedParts: 1,
  hasLeftovers: false,
  leftoverParts: 0,
  leftoverDate: '',
  leftoverMoment: 'Midi' as 'Midi' | 'Soir' | 'Autre',
  leftoverComment: ''
});

interface MissingIngredient {
  id: string;
  nom: string;
  disponible: number;
  requis: number;
  unite: string;
}

const getRecipeName = (recipeId?: string): string => {
  if (!recipeId) return 'Repas inconnu';
  const found = recipes.value.find(r => r.id === recipeId);
  return found?.data.nom || 'Repas inconnu';
};

const getMissingIngredients = (rec: RecordEntry): MissingIngredient[] => {
  if (rec.data.statut === 'Consommé' || rec.data.stock_decremente) {
    return [];
  }

  const ingredients = rec.data.ingredients_consommes || [];
  const convives = Number(rec.data.convives) || 1;
  const missing: MissingIngredient[] = [];

  for (const ingId of ingredients) {
    const stockItem = stockItems.value.find(item => item.id === ingId);
    if (stockItem) {
      const currentStock = Number(stockItem.data.quantite) || 0;
      const portionStd = Number(stockItem.data.quantite_standard_portion) || 1;
      const requiredQty = convives * portionStd;

      if (currentStock < requiredQty) {
        missing.push({
          id: ingId,
          nom: stockItem.data.nom,
          disponible: currentStock,
          requis: requiredQty,
          unite: stockItem.data.unite || 'unité'
        });
      }
    } else {
      missing.push({
        id: ingId,
        nom: 'Produit non répertorié',
        disponible: 0,
        requis: convives,
        unite: 'unité'
      });
    }
  }

  return missing;
};

const loadData = async () => {
  planningList.value = await getPlanningRecords();
  recipes.value = await getRecipeRecords();
  stockItems.value = await getStockRecords();
};

onMounted(() => {
  loadData();
});

// Ordering moments chronologically and reverse chronologically
const MOMENT_ORDER_ASC: Record<string, number> = { 'Midi': 1, 'Soir': 2, 'Autre': 3 };
const MOMENT_ORDER_DESC: Record<string, number> = { 'Autre': 1, 'Soir': 2, 'Midi': 3 };

// Upcoming Meals: Prévus & Préparés (Ascending: closest date first)
const upcomingMeals = computed(() => {
  return planningList.value
    .filter(r => r.data.statut !== 'Consommé')
    .sort((a, b) => {
      const dateA = String(a.data.date || '');
      const dateB = String(b.data.date || '');
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      const ordA = MOMENT_ORDER_ASC[a.data.moment] || 99;
      const ordB = MOMENT_ORDER_ASC[b.data.moment] || 99;
      return ordA - ordB;
    });
});

// Consumed Meals: Sorted by date desc then moment desc (most recent first)
const consumedMeals = computed(() => {
  return planningList.value
    .filter(r => r.data.statut === 'Consommé')
    .sort((a, b) => {
      const dateA = String(a.data.date || '');
      const dateB = String(b.data.date || '');
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      const ordA = MOMENT_ORDER_DESC[a.data.moment] || 99;
      const ordB = MOMENT_ORDER_DESC[b.data.moment] || 99;
      return ordA - ordB;
    });
});

// Filtered list according to current tab
const displayedMeals = computed(() => {
  if (activeTab.value === 'upcoming') return upcomingMeals.value;
  if (activeTab.value === 'consumed') return consumedMeals.value;
  return planningList.value; // all meals
});

const onRepasChange = () => {
  if (!formRepasId.value) {
    formIngredients.value = [];
    return;
  }
  const selectedRecipe = recipes.value.find(r => r.id === formRepasId.value);
  if (selectedRecipe && selectedRecipe.data.ingredients) {
    formIngredients.value = [...selectedRecipe.data.ingredients];
  } else {
    formIngredients.value = [];
  }
};

const openAddModal = () => {
  editingPlanningId.value = null;
  formDate.value = new Date().toISOString().split('T')[0];
  formMoment.value = 'Midi';
  formStatut.value = 'Prévu';
  formRepasId.value = '';
  formConvives.value = 1;
  formIngredients.value = [];
  formCommentaire.value = '';
  showAddModal.value = true;
};

const openEditModal = (rec: RecordEntry) => {
  editingPlanningId.value = rec.id || null;
  formDate.value = rec.data.date || new Date().toISOString().split('T')[0];
  formMoment.value = rec.data.moment || 'Midi';
  formStatut.value = rec.data.statut || 'Prévu';
  formRepasId.value = rec.data.repas || '';
  formConvives.value = Number(rec.data.convives) || 1;
  formCommentaire.value = rec.data.commentaire || '';
  formIngredients.value = [...(rec.data.ingredients_consommes || [])];
  showAddModal.value = true;
};

// Duplicate meal (consumed or planned) as a new planning entry
const openDuplicateModal = (rec: RecordEntry) => {
  editingPlanningId.value = null; // Create mode
  formDate.value = new Date().toISOString().split('T')[0];
  formMoment.value = rec.data.moment || 'Midi';
  formStatut.value = 'Prévu';
  formRepasId.value = rec.data.repas || '';
  formConvives.value = Number(rec.data.convives) || 1;
  formCommentaire.value = rec.data.commentaire || '';
  formIngredients.value = [...(rec.data.ingredients_consommes || [])];
  showAddModal.value = true;
  toast.info('Repas dupliqué en nouveau projet ! Ajuste la date et enregistre.');
};

const handleSavePlanning = async () => {
  if (!formRepasId.value) {
    toast.warning('Le choix du repas est obligatoire.');
    return;
  }

  try {
    if (editingPlanningId.value) {
      await db.records.update(editingPlanningId.value, {
        'data.date': formDate.value,
        'data.moment': formMoment.value,
        'data.statut': formStatut.value,
        'data.repas': formRepasId.value,
        'data.convives': formConvives.value || 1,
        'data.ingredients_consommes': [...formIngredients.value],
        'data.commentaire': formCommentaire.value.trim(),
        updatedAt: Date.now()
      });

      const updated = await db.records.get(editingPlanningId.value);
      if (updated && (formStatut.value === 'Préparé' || formStatut.value === 'Consommé')) {
        await runStockAutomations(updated, false);
      }

      toast.success('Repas modifié avec succès !');
    } else {
      const record: RecordEntry = {
        id: `rec-${generateId()}`,
        collectionId: PLANNING_COL_ID,
        data: {
          date: formDate.value,
          moment: formMoment.value,
          statut: formStatut.value,
          repas: formRepasId.value,
          convives: formConvives.value || 1,
          ingredients_consommes: [...formIngredients.value],
          stock_decremente: false,
          commentaire: formCommentaire.value.trim()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.records.add(record);

      if (formStatut.value === 'Préparé' || formStatut.value === 'Consommé') {
        await runStockAutomations(record, true);
      }

      toast.success('Repas planifié avec succès !');
    }

    showAddModal.value = false;
    editingPlanningId.value = null;
    await loadData();
  } catch (err) {
    console.error('Erreur lors de la planification du repas:', err);
  }
};

const handleDeletePlanning = async (id: string) => {
  try {
    await db.records.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });
    await loadData();
    toast.success('Repas supprimé du planning.');
  } catch (err) {
    console.error('Erreur lors de la suppression:', err);
  }
};

// Open Consumption Modal with Leftovers Management
const openConsumeModal = (rec: RecordEntry) => {
  mealToConsume.value = rec;
  const initial = Number(rec.data.convives) || 1;
  consumeForm.value.consumedParts = initial;
  consumeForm.value.hasLeftovers = false;
  consumeForm.value.leftoverParts = 0;

  // Determine smart default date & moment for leftovers
  const mealDate = rec.data.date || new Date().toISOString().split('T')[0];
  if (rec.data.moment === 'Midi') {
    consumeForm.value.leftoverDate = mealDate;
    consumeForm.value.leftoverMoment = 'Soir';
  } else {
    // Tomorrow noon
    try {
      const d = new Date(mealDate);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 1);
        consumeForm.value.leftoverDate = d.toISOString().split('T')[0];
      } else {
        consumeForm.value.leftoverDate = new Date().toISOString().split('T')[0];
      }
    } catch {
      consumeForm.value.leftoverDate = new Date().toISOString().split('T')[0];
    }
    consumeForm.value.leftoverMoment = 'Midi';
  }

  const recipeName = getRecipeName(rec.data.repas);
  consumeForm.value.leftoverComment = `Reste de ${recipeName}`;
  showConsumeModal.value = true;
};

const onConsumedPartsInput = () => {
  if (!mealToConsume.value) return;
  const initial = Number(mealToConsume.value.data.convives) || 1;
  let val = Number(consumeForm.value.consumedParts) || 1;
  if (val < 1) val = 1;
  if (val > initial) val = initial;
  consumeForm.value.consumedParts = val;

  const diff = initial - val;
  if (diff > 0) {
    consumeForm.value.hasLeftovers = true;
    consumeForm.value.leftoverParts = diff;
  } else {
    consumeForm.value.hasLeftovers = false;
    consumeForm.value.leftoverParts = 0;
  }
};

const handleConfirmConsume = async () => {
  if (!mealToConsume.value) return;

  if (consumeForm.value.hasLeftovers && consumeForm.value.leftoverParts > 0) {
    if (!consumeForm.value.leftoverDate) {
      toast.warning('Veuillez renseigner la date pour les restes.');
      return;
    }
  }

  try {
    const rawMeal = toRaw(mealToConsume.value);
    await consumeMealWithLeftovers({
      mealRecord: rawMeal,
      consumedParts: Number(consumeForm.value.consumedParts) || 1,
      hasLeftovers: Boolean(consumeForm.value.hasLeftovers),
      leftoverParts: Number(consumeForm.value.leftoverParts) || 0,
      leftoverDate: consumeForm.value.leftoverDate,
      leftoverMoment: consumeForm.value.leftoverMoment,
      leftoverComment: consumeForm.value.leftoverComment
    });

    showConsumeModal.value = false;
    const partsDone = consumeForm.value.consumedParts;
    const partsLeft = consumeForm.value.leftoverParts;

    if (consumeForm.value.hasLeftovers && partsLeft > 0) {
      toast.success(`Repas consommé (${partsDone} part${partsDone > 1 ? 's' : ''}) ! ${partsLeft} part${partsLeft > 1 ? 's' : ''} restante(s) ajoutée(s) au statut "Préparé".`);
    } else {
      toast.success('Repas consommé ! Les stocks ont été déduits.');
    }

    mealToConsume.value = null;
    await loadData();
  } catch (err) {
    console.error('Erreur lors de la consommation:', err);
    toast.error('Erreur lors de la consommation du repas.');
  }
};

// Google Calendar Integration for planned meals
const handleAddToCalendar = (rec: RecordEntry) => {
  const recipeName = getRecipeName(rec.data.repas);
  const moment = rec.data.moment || 'Midi';
  const startTime = moment === 'Soir' ? '19:30' : (moment === 'Midi' ? '12:30' : '09:00');

  openGoogleCalendar({
    title: `Repas : ${recipeName}`,
    startDate: rec.data.date,
    startTime,
    durationMinutes: 60,
    details: `Menu prévu : ${recipeName}\nConvives : ${rec.data.convives || 1} pers\nMoment : ${moment}${rec.data.commentaire ? '\nNotes : ' + rec.data.commentaire : ''}`
  });
  toast.info('Ouverture de Google Agenda...');
};

const getMealFeasibility = (rec: RecordEntry): 'disponible' | 'partiel' | 'rupture' | 'N/A' => {
  if (rec.data.statut === 'Consommé' || rec.data.stock_decremente) {
    return 'N/A';
  }

  const ingredients = rec.data.ingredients_consommes || [];
  const convives = Number(rec.data.convives) || 1;

  if (ingredients.length === 0) return 'N/A';

  let sufficientCount = 0;

  for (const ingId of ingredients) {
    const stockItem = stockItems.value.find(item => item.id === ingId);
    if (stockItem) {
      const currentStock = Number(stockItem.data.quantite) || 0;
      const portionStd = Number(stockItem.data.quantite_standard_portion) || 1;
      const requiredQty = convives * portionStd;

      if (currentStock >= requiredQty) {
        sufficientCount++;
      }
    }
  }

  if (sufficientCount === ingredients.length) return 'disponible';
  if (sufficientCount > 0) return 'partiel';
  return 'rupture';
};
</script>

<template>
  <div class="planning-view">
    <div class="view-header-row">
      <div class="title-sub">
        <h2>Planning de repas</h2>
        <p class="desc">Planifie tes repas, gère tes restes et suis la disponibilité de tes stocks</p>
      </div>
      <button @click="openAddModal" class="btn btn-primary btn-sm">
        <Plus class="btn-icon" /> Planifier un repas
      </button>
    </div>

    <!-- Navigation Sub-Tabs -->
    <div class="sub-tabs-row flex-row gap-2">
      <button 
        class="sub-tab-btn" 
        :class="{ active: activeTab === 'upcoming' }"
        @click="activeTab = 'upcoming'"
      >
        <Calendar :size="15" />
        À venir ({{ upcomingMeals.length }})
      </button>
      <button 
        class="sub-tab-btn" 
        :class="{ active: activeTab === 'consumed' }"
        @click="activeTab = 'consumed'"
      >
        <UtensilsCrossed :size="15" />
        Consommés ({{ consumedMeals.length }})
      </button>
      <button 
        class="sub-tab-btn" 
        :class="{ active: activeTab === 'all' }"
        @click="activeTab = 'all'"
      >
        Tous ({{ planningList.length }})
      </button>
    </div>

    <!-- Planning List -->
    <div class="planning-list">
      <div v-if="displayedMeals.length === 0" class="empty-state text-center card glass">
        <Calendar class="empty-icon" />
        <p v-if="activeTab === 'upcoming'">Aucun repas prévu ou préparé à venir. Programme tes prochains repas !</p>
        <p v-else-if="activeTab === 'consumed'">Aucun repas consommé pour le moment.</p>
        <p v-else>Rien dans ton planning. Programme tes repas de la semaine !</p>
      </div>

      <div 
        v-else 
        v-for="rec in displayedMeals" 
        :key="rec.id" 
        class="card glass planning-card"
      >
        <div class="planning-card-header">
          <div class="date-badge">
            <span class="day-num">{{ formatToFrenchDate(rec.data.date) }}</span>
            <span class="moment-label" :class="rec.data.moment?.toLowerCase()">{{ rec.data.moment }}</span>
          </div>

          <div class="meal-info">
            <div class="flex-row align-center gap-2">
              <h3>{{ getRecipeName(rec.data.repas) }}</h3>
              <span v-if="rec.data.is_reste" class="badge badge-warning text-xs font-bold">Reste</span>
            </div>
            <p v-if="rec.data.commentaire" class="commentaire-text">"{{ rec.data.commentaire }}"</p>
            <div class="meal-meta">
              <span><User class="meta-icon" /> {{ rec.data.convives || 1 }} part{{ (rec.data.convives || 1) > 1 ? 's' : '' }}</span>
              <span>•</span>
              <span class="status-indicator" :class="rec.data.statut?.toLowerCase()">{{ rec.data.statut }}</span>
            </div>
          </div>

          <!-- Feasibility Badge (for upcoming un-decremented meals) -->
          <div class="feasibility-section">
            <span v-if="rec.data.statut === 'Préparé'" class="feasibility-badge true flex-row align-center gap-1">
              <Check :size="12" /> Déjà cuisiné
            </span>
            <span v-else-if="getMealFeasibility(rec) === 'disponible'" class="feasibility-badge true flex-row align-center gap-1">
              <Check :size="12" /> Stock Suffisant
            </span>
          </div>

          <!-- Actions -->
          <div class="planning-actions flex-row align-center gap-1">
            <!-- Consommer (sur Prévu ou Préparé) -->
            <button 
              v-if="rec.data.statut !== 'Consommé'" 
              @click="openConsumeModal(rec)" 
              class="btn btn-secondary btn-xs flex-row align-center gap-1"
              title="Consommer ce repas (gérer les restes si besoin)"
            >
              <Play :size="12" /> Consommer
            </button>

            <!-- Ajouter à Google Agenda (sur repas prévus / préparés) -->
            <button 
              v-if="rec.data.statut !== 'Consommé'" 
              @click="handleAddToCalendar(rec)" 
              class="action-btn"
              title="Ajouter à Google Agenda"
            >
              <Calendar :size="14" />
            </button>

            <!-- Dupliquer (disponible pour tout repas, notamment les repas consommés) -->
            <button 
              @click="openDuplicateModal(rec)" 
              class="action-btn duplicate"
              title="Dupliquer ce repas"
            >
              <Copy :size="14" />
            </button>

            <!-- Modifier -->
            <button 
              @click="openEditModal(rec)" 
              class="action-btn edit"
              title="Modifier le repas"
            >
              <Edit2 :size="14" />
            </button>

            <!-- Supprimer -->
            <button 
              @click="handleDeletePlanning(rec.id!)" 
              class="action-btn delete" 
              title="Supprimer du planning"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <!-- Missing Ingredients Alert List -->
        <div v-if="getMissingIngredients(rec).length > 0" class="missing-ingredients-box mt-3 border-top pt-2">
          <div class="flex-row align-center gap-2 mb-1">
            <span class="text-xs font-bold text-danger flex-row align-center gap-1">
              <AlertTriangle :size="13" /> Ingrédients manquants en stock :
            </span>
          </div>
          <div class="missing-chips-flex">
            <span 
              v-for="ing in getMissingIngredients(rec)" 
              :key="ing.id" 
              class="missing-ingredient-chip"
            >
              <strong>{{ ing.nom }}</strong> (Dispo: {{ ing.disponible }} / Requis: {{ ing.requis }} {{ ing.unite }})
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Consume Modal with Leftovers Management -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showConsumeModal && mealToConsume" class="modal-overlay" @click.self="showConsumeModal = false">
          <div class="modal-card card glass fade-in">
            <div class="modal-header">
              <h2>Consommer le repas</h2>
              <button @click="showConsumeModal = false" class="btn-close-modal"><X /></button>
            </div>
            
            <div class="modal-body text-left">
              <div class="consume-summary-box mb-3">
                <h3 class="font-bold text-base mb-1">{{ getRecipeName(mealToConsume.data.repas) }}</h3>
                <p class="text-sub text-xs">
                  Prévu le {{ formatToFrenchDate(mealToConsume.data.date) }} • {{ mealToConsume.data.moment }} 
                  ({{ mealToConsume.data.convives || 1 }} part{{ (mealToConsume.data.convives || 1) > 1 ? 's' : '' }} au total)
                </p>
              </div>

              <div class="form-group">
                <label for="consumedPartsInput">Nombre de parts consommées à ce repas</label>
                <div class="flex-row align-center gap-2 mt-1">
                  <input 
                    id="consumedPartsInput" 
                    v-model.number="consumeForm.consumedParts" 
                    type="number" 
                    class="form-control col-convives" 
                    min="1" 
                    :max="mealToConsume.data.convives || 1"
                    @input="onConsumedPartsInput"
                    @change="onConsumedPartsInput"
                  />
                  <span class="text-sub text-xs">
                    sur {{ mealToConsume.data.convives || 1 }} part{{ (mealToConsume.data.convives || 1) > 1 ? 's' : '' }} préparée(s)
                  </span>
                </div>
              </div>

              <!-- Leftovers Box -->
              <div v-if="consumeForm.hasLeftovers && consumeForm.leftoverParts > 0" class="leftover-box mt-3 p-3">
                <div class="flex-row align-center gap-2 mb-2">
                  <span class="badge badge-warning font-bold text-xs">
                    Il reste {{ consumeForm.leftoverParts }} part{{ consumeForm.leftoverParts > 1 ? 's' : '' }}
                  </span>
                </div>

                <label class="checkbox-container export-item mb-2">
                  <input type="checkbox" v-model="consumeForm.hasLeftovers" />
                  <span class="checkmark"></span>
                  <span class="label-text font-bold text-sm">
                    Ajouter les {{ consumeForm.leftoverParts }} part(s) restante(s) au statut "Préparé"
                  </span>
                </label>

                <div v-if="consumeForm.hasLeftovers" class="leftover-details mt-2">
                  <div class="form-row">
                    <div class="form-group flex-1">
                      <label for="leftoverDate">Date du reste</label>
                      <input id="leftoverDate" v-model="consumeForm.leftoverDate" type="date" class="form-control" />
                    </div>
                    <div class="form-group flex-1 ml-3">
                      <label for="leftoverMoment">Moment</label>
                      <select id="leftoverMoment" v-model="consumeForm.leftoverMoment" class="form-control">
                        <option value="Midi">Midi</option>
                        <option value="Soir">Soir</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-group mt-2">
                    <label for="leftoverComment">Note pour les restes</label>
                    <input id="leftoverComment" v-model="consumeForm.leftoverComment" type="text" class="form-control" />
                  </div>
                  <p class="field-tip mt-1 text-xs text-sub">
                    💡 Le plat restant sera enregistré avec le statut <strong>Préparé</strong>. Les ingrédients bruts ne seront pas décomptés une seconde fois.
                  </p>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="showConsumeModal = false" class="btn btn-secondary">Annuler</button>
              <button @click="handleConfirmConsume" class="btn btn-primary">
                Valider la consommation
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Add / Edit Planning Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
          <div class="modal-card card glass fade-in">
            <div class="modal-header">
              <h2>{{ editingPlanningId ? 'Modifier le repas' : 'Planifier un repas' }}</h2>
              <button @click="showAddModal = false" class="btn-close-modal"><X /></button>
            </div>
            <div class="modal-body text-left">
              <div class="form-row">
                <div class="form-group flex-1">
                  <label for="planDate">Date du repas</label>
                  <input id="planDate" v-model="formDate" type="date" class="form-control" />
                </div>
                <div class="form-group flex-1 ml-3">
                  <label for="planMoment">Moment</label>
                  <select id="planMoment" v-model="formMoment" class="form-control">
                    <option value="Midi">Midi</option>
                    <option value="Soir">Soir</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              <div class="form-row mt-3">
                <div class="form-group flex-1">
                  <label for="planRepas">Choisir une recette</label>
                  <select id="planRepas" v-model="formRepasId" @change="onRepasChange" class="form-control">
                    <option value="" disabled>-- Sélectionner une recette --</option>
                    <option v-for="r in recipes" :key="r.id" :value="r.id">
                      {{ r.data.nom }}
                    </option>
                  </select>
                </div>
                <div class="form-group flex-1 ml-3 col-convives">
                  <label for="planConvives">Parts</label>
                  <input id="planConvives" v-model.number="formConvives" type="number" class="form-control" min="1" />
                </div>
              </div>

              <!-- Statut selector (Prévu, Préparé, Consommé) -->
              <div class="form-group mt-3">
                <label for="planStatut">Statut du repas</label>
                <select id="planStatut" v-model="formStatut" class="form-control">
                  <option value="Prévu">Prévu</option>
                  <option value="Préparé">Préparé (déjà cuisiné)</option>
                  <option value="Consommé">Consommé</option>
                </select>
                <p class="field-tip text-xs text-sub mt-1" v-if="formStatut === 'Préparé'">
                  Sélectionner "Préparé" décompte immédiatement les stocks d'ingrédients bruts.
                </p>
              </div>

              <!-- Custom Ingredients selector for this meal instance -->
              <div class="form-group mt-3" v-if="formRepasId && formStatut !== 'Consommé'">
                <label>Ingrédients consommés pour cette fois</label>
                <p class="field-tip">Ajuste la liste des ingrédients réellement utilisés pour ce repas spécifique.</p>
                <div class="ingredients-selection-list">
                  <label v-for="item in foodStockItems" :key="item.id" class="checkbox-container export-item">
                    <input type="checkbox" :value="item.id" v-model="formIngredients" />
                    <span class="checkmark"></span>
                    <span class="label-text">
                      {{ item.data.nom }} 
                      <span class="text-sub text-xs">
                        (Reste : {{ item.data.quantite || 0 }} {{ item.data.unite || 'unité' }})
                      </span>
                    </span>
                  </label>
                  <p v-if="foodStockItems.length === 0" class="field-tip error-text">Aucun ingrédient alimentaire en stock disponible.</p>
                </div>
              </div>

              <div class="form-group mt-3">
                <label for="planComment">Commentaire</label>
                <input id="planComment" v-model="formCommentaire" type="text" class="form-control" placeholder="Ex: Anniversaire, repas léger, etc." />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showAddModal = false" class="btn btn-secondary">Annuler</button>
              <button @click="handleSavePlanning" class="btn btn-primary">
                {{ editingPlanningId ? 'Enregistrer les modifications' : 'Ajouter au planning' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.planning-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.sub-tabs-row {
  display: flex;
  overflow-x: auto;
}

.sub-tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md, 8px);
  background: color-mix(in srgb, var(--color-border) 40%, transparent);
  border: 1px solid var(--color-border);
  font-size: 0.85rem;
  font-weight: 700;
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

.planning-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.planning-card {
  padding: 1.25rem;
}

.planning-card-header {
  display: grid;
  grid-template-columns: 130px 1fr auto auto;
  align-items: center;
  gap: 1.25rem;
  text-align: left;
}

.date-badge {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  
  .day-num {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  
  .moment-label {
    align-self: flex-start;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    border: 1px solid transparent;
    
    &.midi {
      background-color: color-mix(in srgb, var(--color-warning) 15%, transparent);
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 20%, transparent);
    }
    
    &.soir {
      background-color: color-mix(in srgb, var(--color-info) 15%, transparent);
      color: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 20%, transparent);
    }
    
    &.autre {
      background-color: color-mix(in srgb, var(--color-purple, #8a2be2) 15%, transparent);
      color: var(--color-purple, #8a2be2);
      border-color: color-mix(in srgb, var(--color-purple, #8a2be2) 20%, transparent);
    }
  }
}

.meal-info {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  
  h3 {
    font-size: 1.2rem;
    font-weight: 800;
    margin: 0;
    color: var(--text-primary);
  }
  
  .commentaire-text {
    font-size: 0.85rem;
    font-style: italic;
    color: var(--text-muted);
    margin: 0;
  }
}

.meal-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: var(--text-sub);
  
  .meta-icon {
    width: 14px;
    height: 14px;
    vertical-align: text-top;
  }
  
  .status-indicator {
    font-weight: 700;
    
    &.prévu {
      color: var(--text-sub);
    }
    
    &.consommé {
      color: var(--color-success);
    }
    
    &.préparé {
      color: var(--color-info);
    }
  }
}

.feasibility-section {
  display: flex;
  justify-content: center;
}

.feasibility-badge {
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  
  &.true {
    background-color: color-mix(in srgb, var(--color-success) 15%, transparent);
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 20%, transparent);
  }
  
  &.warning {
    background-color: color-mix(in srgb, var(--color-warning) 15%, transparent);
    color: var(--color-warning);
    border-color: color-mix(in srgb, var(--color-warning) 20%, transparent);
  }
  
  &.false {
    background-color: color-mix(in srgb, var(--color-danger) 15%, transparent);
    color: var(--color-danger);
    border-color: color-mix(in srgb, var(--color-danger) 20%, transparent);
  }
}

.col-convives {
  max-width: 130px;
}

.planning-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.ingredients-selection-list {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: color-mix(in srgb, var(--color-black, #000) 15%, transparent);
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.consume-summary-box {
  background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
  border-radius: var(--radius-sm, 6px);
  padding: 0.75rem 1rem;
}

.leftover-box {
  background-color: color-mix(in srgb, var(--color-warning) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-warning) 25%, transparent);
  border-radius: var(--radius-sm, 6px);
}

.missing-ingredients-box {
  background-color: color-mix(in srgb, var(--color-danger) 4%, transparent);
  border-radius: var(--radius-sm);
  padding: 0.6rem 0.85rem;
}

.missing-chips-flex {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.missing-ingredient-chip {
  font-size: 0.75rem;
  background-color: color-mix(in srgb, var(--color-danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
  color: var(--color-danger);
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.form-row {
  display: flex;
}
.flex-1 {
  flex: 1;
}
.ml-3 {
  margin-left: 0.75rem;
}

@media (max-width: 992px) {
  .planning-card-header {
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .feasibility-section {
    justify-content: flex-start;
  }
  .planning-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 576px) {
  .planning-card-header {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
