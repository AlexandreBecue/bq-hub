<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, generateId, type RecordEntry } from '../db';
import { PLANNING_COL_ID, getPlanningRecords, getRecipeRecords, getStockRecords, runStockAutomations, formatToFrenchDate } from '../db/queries';
import { Plus, Trash2, Calendar, User, X, Play, Edit2, AlertTriangle, Check } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const toast = useToast();

const planningList = ref<RecordEntry[]>([]);
const recipes = ref<RecordEntry[]>([]);
const stockItems = ref<RecordEntry[]>([]);
const showAddModal = ref(false);
const editingPlanningId = ref<string | null>(null);

interface MissingIngredient {
  id: string;
  nom: string;
  disponible: number;
  requis: number;
  unite: string;
}

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

// Form States
const formDate = ref(new Date().toISOString().split('T')[0]);
const formMoment = ref<'Midi' | 'Soir' | 'Autre'>('Midi');
const formRepasId = ref('');
const formConvives = ref(1);
const formIngredients = ref<string[]>([]);
const formCommentaire = ref('');

const loadData = async () => {
  planningList.value = await getPlanningRecords();
  recipes.value = await getRecipeRecords();
  stockItems.value = await getStockRecords();
};

onMounted(() => {
  loadData();
});

const onRepasChange = () => {
  if (!formRepasId.value) {
    formIngredients.value = [];
    return;
  }
  const selectedRecipe = recipes.value.find(r => r.id === formRepasId.value);
  if (selectedRecipe && selectedRecipe.data.ingredients) {
    // Automatically prefill actual ingredients from the default recipe ingredients!
    formIngredients.value = [...selectedRecipe.data.ingredients];
  } else {
    formIngredients.value = [];
  }
};

const openAddModal = () => {
  editingPlanningId.value = null;
  formDate.value = new Date().toISOString().split('T')[0];
  formMoment.value = 'Midi';
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
  formRepasId.value = rec.data.repas || '';
  formConvives.value = Number(rec.data.convives) || 1;
  formCommentaire.value = rec.data.commentaire || '';
  formIngredients.value = [...(rec.data.ingredients_consommes || [])];
  showAddModal.value = true;
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
        'data.repas': formRepasId.value,
        'data.convives': formConvives.value || 1,
        'data.ingredients_consommes': [...formIngredients.value],
        'data.commentaire': formCommentaire.value.trim(),
        updatedAt: Date.now()
      });
      toast.success('Repas modifié avec succès !');
    } else {
      const record: RecordEntry = {
        id: `rec-${generateId()}`,
        collectionId: PLANNING_COL_ID,
        data: {
          date: formDate.value,
          moment: formMoment.value,
          repas: formRepasId.value,
          convives: formConvives.value || 1,
          ingredients_consommes: [...formIngredients.value],
          statut: 'Prévu',
          stock_decremente: false,
          commentaire: formCommentaire.value.trim()
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.records.add(record);
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
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
    }
};

const handleMarkAsConsumed = async (rec: RecordEntry) => {
  try {
    // Update record to 'Consommé' and let the automation handle stock deduction!
    await db.records.update(rec.id!, {
      'data.statut': 'Consommé',
      updatedAt: Date.now()
    });
    
    // Fetch refreshed record
    const updatedRec = await db.records.get(rec.id!);
    if (updatedRec) {
      await runStockAutomations(updatedRec, false);
    }
    
    await loadData();
    toast.success('Repas consommé ! Les stocks correspondants ont été déduits.');
  } catch (err) {
    console.error('Erreur lors du décompte de stock:', err);
  }
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
        <p class="desc">Planifie tes repas et suis la faisabilité de tes stocks</p>
      </div>
      <button @click="openAddModal" class="btn btn-primary btn-sm">
        <Plus class="btn-icon" /> Planifier un repas
      </button>
    </div>

    <!-- Planning Timeline List -->
    <div class="planning-list">
      <div v-if="planningList.length === 0" class="empty-state text-center card glass">
        <Calendar class="empty-icon" />
        <p>Rien de prévu dans ton planning. Programme tes repas de la semaine !</p>
      </div>

      <div 
        v-else 
        v-for="rec in planningList" 
        :key="rec.id" 
        class="card glass planning-card"
      >
        <div class="planning-card-header">
          <div class="date-badge">
            <span class="day-num">{{ formatToFrenchDate(rec.data.date) }}</span>
            <span class="moment-label" :class="rec.data.moment?.toLowerCase()">{{ rec.data.moment }}</span>
          </div>

          <div class="meal-info">
            <h3>{{ recipes.find(r => r.id === rec.data.repas)?.data.nom || 'Repas inconnu' }}</h3>
            <p v-if="rec.data.commentaire" class="commentaire-text">"{{ rec.data.commentaire }}"</p>
            <div class="meal-meta">
              <span><User class="meta-icon" /> {{ rec.data.convives || 1 }} pers</span>
              <span>•</span>
              <span class="status-indicator" :class="rec.data.statut?.toLowerCase()">{{ rec.data.statut }}</span>
            </div>
          </div>

          <!-- Feasibility Badge -->
          <div class="feasibility-section">
            <span v-if="getMealFeasibility(rec) === 'disponible'" class="feasibility-badge true flex-row align-center gap-1">
              <Check :size="12" /> Stock Suffisant
            </span>
          </div>

          <!-- Actions -->
          <div class="planning-actions flex-row align-center gap-1">
            <button 
              v-if="rec.data.statut === 'Prévu'" 
              @click="handleMarkAsConsumed(rec)" 
              class="btn btn-secondary btn-xs flex-row align-center gap-1"
              title="Marquer comme consommé et déduire du stock"
            >
              <Play :size="12" /> Consommer
            </button>
            <button 
              v-if="rec.data.statut === 'Prévu'" 
              @click="openEditModal(rec)" 
              class="action-btn edit"
              title="Modifier le repas"
            >
              <Edit2 :size="14" />
            </button>
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

    <!-- Add Planning Modal -->
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
                    <option value="Autre">Autre (En-cas, Brunch)</option>
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
                  <label for="planConvives">Convives</label>
                  <input id="planConvives" v-model.number="formConvives" type="number" class="form-control" min="1" />
                </div>
              </div>

              <!-- Custom Ingredients selector for this meal instance -->
              <div class="form-group mt-3" v-if="formRepasId">
                <label>Ingrédients consommés pour cette fois</label>
                <p class="field-tip">Ajuste la liste des ingrédients réellement utilisés pour ce repas spécifique.</p>
                <div class="ingredients-selection-list">
                  <label v-for="item in stockItems" :key="item.id" class="checkbox-container export-item">
                    <input type="checkbox" :value="item.id" v-model="formIngredients" />
                    <span class="checkmark"></span>
                    <span class="label-text">
                      {{ item.data.nom }} 
                      <span class="text-sub text-xs">
                        (Reste : {{ item.data.quantite || 0 }} {{ item.data.unite || 'unité' }})
                      </span>
                    </span>
                  </label>
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
      background-color: color-mix(in srgb, var(--color-purple) 15%, transparent);
      color: var(--color-purple);
      border-color: color-mix(in srgb, var(--color-purple) 20%, transparent);
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
  background-color: color-mix(in srgb, var(--color-black) 15%, transparent);
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.btn-danger-link {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  transition: var(--transition);
  
  &:hover {
    color: var(--color-danger);
    background-color: color-mix(in srgb, var(--color-danger) 10%, transparent);
  }
  
  .trash-icon {
    width: 13px;
    height: 13px;
  }
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
