<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  FINANCES_COL_ID, 
  getFinancesRecords, 
  getComptesRecords, 
  getBudgetsRecords, 
  getSuggestionsRecords,
  formatToFrenchDate
} from '../db/queries';
import { Plus, X, Sparkles, ArrowUpRight, ArrowDownLeft, Calendar, Landmark } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const finances = ref<RecordEntry[]>([]);
const comptes = ref<RecordEntry[]>([]);
const budgets = ref<RecordEntry[]>([]);
const suggestions = ref<RecordEntry[]>([]);
const isLoading = ref(true);

// Saisie Form State
const formOp = ref({
  date: new Date().toISOString().split('T')[0],
  type: 'Sortie', // Entrée, Sortie, Interne
  montant: '',
  compte: '',
  categorie: 'Dépense', // Revenu, Dépense, Cadeau, Remboursement, Prêt, Vente, Crédit, Virement
  budget: '',
  partenaire: '',
  commentaire: ''
});

const categoriesList = ["Dépense", "Revenu", "Cadeau", "Remboursement", "Prêt", "Vente", "Crédit", "Virement"];
const typesList = ["Sortie", "Entrée", "Interne"];

const loadData = async () => {
  isLoading.value = true;
  try {
    finances.value = await getFinancesRecords();
    comptes.value = await getComptesRecords();
    budgets.value = await getBudgetsRecords();
    suggestions.value = await getSuggestionsRecords();

    // Default account selection
    const activeComptes = comptes.value.filter(c => c.data.is_active !== false);
    if (activeComptes.length > 0 && !formOp.value.compte) {
      const courant = activeComptes.find(c => c.data.nom.toLowerCase().includes('courant'));
      formOp.value.compte = courant ? courant.data.nom : activeComptes[0].data.nom;
    }
    
    // Default budget envelope selection
    if (budgets.value.length > 0 && !formOp.value.budget) {
      formOp.value.budget = budgets.value[0].data.nom;
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

// Auto-adjust categories when type changes
watch(() => formOp.value.type, (newType) => {
  if (newType === 'Entrée') {
    formOp.value.categorie = 'Revenu';
  } else if (newType === 'Sortie') {
    formOp.value.categorie = 'Dépense';
  } else if (newType === 'Interne') {
    formOp.value.categorie = 'Virement';
  }
});

// Parse the payload of suggestions
const parsedSuggestions = computed(() => {
  return suggestions.value.map(s => {
    try {
      const payload = JSON.parse(s.data.payload || '{}');
      return {
        id: s.id!,
        source: s.data.source_app || 'App',
        action: s.data.action || 'Action',
        date: payload.date || '',
        montant: Number(payload.montant) || 0,
        partenaire: payload.partenaire || '',
        commentaire: payload.commentaire || '',
        budget: payload.budget || ''
      };
    } catch (e) {
      return null;
    }
  }).filter((s): s is NonNullable<typeof s> => s !== null);
});

// Handle applying suggestion to form
const applySuggestion = (sug: any) => {
  formOp.value = {
    date: sug.date || new Date().toISOString().split('T')[0],
    type: 'Sortie',
    montant: String(sug.montant),
    compte: formOp.value.compte, // keep selected account
    categorie: 'Dépense',
    budget: budgets.value.some(b => b.data.nom === sug.budget) ? sug.budget : (budgets.value[0]?.data.nom || ''),
    partenaire: sug.partenaire,
    commentaire: sug.commentaire
  };
  // Pre-select budget if matching
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Accept suggestion (pre-fills form + marks suggestion as accepted)
const acceptSuggestion = async (sugId: string, sugData: any) => {
  applySuggestion(sugData);
  try {
    // Mark suggestion as accepted so it disappears from inbox
    await db.records.update(sugId, {
      'data.status': 'accepted',
      updatedAt: Date.now()
    });
    suggestions.value = await getSuggestionsRecords();
  } catch (err) {
    console.error(err);
  }
};

// Reject suggestion (marks suggestion as rejected)
const rejectSuggestion = async (sugId: string) => {
  if (!confirm('Rejeter cette suggestion de dépense ?')) return;
  try {
    await db.records.update(sugId, {
      'data.status': 'rejected',
      updatedAt: Date.now()
    });
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

// Saisie Form Validation & Submission
const handleAddFinance = async () => {
  const m = Number(formOp.value.montant) || 0;
  if (m <= 0 || !formOp.value.compte) {
    alert('Veuillez saisir un montant supérieur à 0 et sélectionner un compte.');
    return;
  }

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: FINANCES_COL_ID,
      data: {
        date: formOp.value.date,
        type: formOp.value.type,
        montant: m,
        compte: formOp.value.compte,
        categorie: formOp.value.categorie,
        budget: formOp.value.type === 'Sortie' ? formOp.value.budget : '', // budgets only apply to expenses
        partenaire: formOp.value.partenaire.trim(),
        commentaire: formOp.value.commentaire.trim()
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    
    // Reset form amount and comment
    formOp.value.montant = '';
    formOp.value.commentaire = '';
    formOp.value.partenaire = '';
    
    emit('data-updated');
    loadData();
    alert('Opération financière enregistrée !');
  } catch (err) {
    console.error(err);
  }
};

// Delete record
const handleDeleteFinance = async (id: string) => {
  if (!confirm('Supprimer cette opération financière ?')) return;
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
  <div class="home-view">
    <div class="view-header">
      <div>
        <h2>💸 Saisie & Opérations</h2>
        <p class="text-secondary">Enregistre tes dépenses et revenus, et traite les suggestions automatiques envoyées par tes autres applications.</p>
      </div>
    </div>

    <!-- Inbox / Suggestions Area -->
    <div v-if="parsedSuggestions.length > 0" class="inbox-suggestions-container mb-4">
      <div class="card glass inbox-card">
        <h3 class="font-bold flex-row mb-3">
          <Sparkles class="text-primary" :size="18" /> Boîte de réception (Inbox)
          <span class="badge badge-primary text-xs">{{ parsedSuggestions.length }}</span>
        </h3>
        <p class="text-secondary text-xs mb-3">Saisies intelligentes suggérées par tes autres applications du hub (clique pour pré-remplir le formulaire).</p>
        
        <div class="suggestions-list">
          <div v-for="sug in parsedSuggestions" :key="sug.id" class="suggestion-item">
            <div class="sug-info">
              <div class="sug-badge-row flex-row">
                <span class="badge badge-primary text-xs">🚗 {{ sug.source }}</span>
                <span class="badge badge-warning text-xs font-bold">{{ sug.montant.toFixed(2) }} €</span>
              </div>
              <p class="sug-title font-bold mt-1 text-sm">{{ sug.partenaire }}</p>
              <p class="sug-desc text-xs text-muted" v-if="sug.commentaire">{{ sug.commentaire }}</p>
              <p class="sug-meta text-xs text-secondary mt-1">Suggéré le : {{ formatToFrenchDate(sug.date) }}</p>
            </div>
            
            <div class="sug-actions flex-row">
              <button @click="acceptSuggestion(sug.id, sug)" class="btn btn-primary btn-sm">
                Importer
              </button>
              <button @click="rejectSuggestion(sug.id)" class="btn btn-secondary btn-sm delete-btn" title="Rejeter">
                <X :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Layout -->
    <div class="saisie-grid">
      <!-- Left Column: Form -->
      <div class="saisie-form-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Plus :size="18" class="text-primary" /> Nouvelle Opération</h3>
          
          <div class="form-group">
            <label>Date de l'opération</label>
            <input v-model="formOp.date" type="date" class="input" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Type de Flux</label>
              <select v-model="formOp.type" class="select select-type">
                <option v-for="t in typesList" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Montant (€) *</label>
              <input v-model="formOp.montant" type="number" step="0.01" min="0" placeholder="Ex: 14.50" class="input montant-input font-bold" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Compte Bancaire *</label>
              <select v-model="formOp.compte" class="select">
                <option v-if="comptes.length === 0" value="">Aucun compte actif</option>
                <option v-for="c in comptes.filter(comp => comp.data.is_active !== false)" :key="c.id" :value="c.data.nom">
                  {{ c.data.nom }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Catégorie</label>
              <select v-model="formOp.categorie" class="select">
                <option v-for="cat in categoriesList" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
          </div>

          <!-- Enveloppe Budgétaire is only relevant for Sorties/Expenses -->
          <div class="form-group" v-if="formOp.type === 'Sortie'">
            <label>Enveloppe Budgétaire (Optionnelle)</label>
            <select v-model="formOp.budget" class="select">
              <option value="">Aucun budget</option>
              <option v-for="b in budgets" :key="b.id" :value="b.data.nom">{{ b.data.nom }}</option>
            </select>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Partenaire / Tiers</label>
              <input v-model="formOp.partenaire" type="text" placeholder="Ex: Auchan, EDF, Mamie" class="input" />
            </div>
            <div class="form-group">
              <label>Commentaire / Notes</label>
              <input v-model="formOp.commentaire" type="text" placeholder="Ex: Courses de la semaine" class="input" />
            </div>
          </div>

          <button @click="handleAddFinance" class="btn btn-primary w-100 mt-4" :disabled="!formOp.montant">
            Enregistrer l'opération
          </button>
        </div>
      </div>

      <!-- Right Column: Recent Operations List -->
      <div class="recent-ops-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Calendar :size="18" class="text-accent" /> Opérations Récentes</h3>

          <div v-if="isLoading" class="text-center py-4">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="finances.length === 0" class="text-center py-4 text-muted text-sm">
            <p>Aucune transaction financière enregistrée.</p>
          </div>

          <div v-else class="ops-list">
            <div v-for="op in finances.slice(0, 8)" :key="op.id" class="op-item">
              <div class="op-main-row flex-row justify-between">
                <div class="flex-row">
                  <!-- Type Icon indicator -->
                  <span class="type-indicator-icon flex-row" :class="op.data.type">
                    <ArrowUpRight v-if="op.data.type === 'Entrée'" :size="14" />
                    <ArrowDownLeft v-else-if="op.data.type === 'Sortie'" :size="14" />
                    <Landmark v-else :size="14" />
                  </span>
                  <div>
                    <h4 class="op-partner font-bold text-sm">{{ op.data.partenaire || 'Opération sans tiers' }}</h4>
                    <p class="op-details text-xs text-muted">
                      {{ formatToFrenchDate(op.data.date) }} • {{ op.data.compte }} <span v-if="op.data.budget">• {{ op.data.budget }}</span>
                    </p>
                  </div>
                </div>
                
                <span class="op-amount font-black text-sm" :class="op.data.type">
                  {{ op.data.type === 'Sortie' ? '-' : op.data.type === 'Entrée' ? '+' : '' }}{{ Number(op.data.montant).toFixed(2) }} €
                </span>
              </div>
              
              <div class="op-comment-row mt-2 flex-row justify-between border-top pt-2">
                <span class="text-xs text-muted italic">{{ op.data.commentaire || 'Pas de note.' }}</span>
                <button @click="handleDeleteFinance(op.id!)" class="delete-link text-xs">Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.inbox-card {
  border-color: rgba(16, 185, 129, 0.2);
  background-color: rgba(16, 185, 129, 0.01);
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.suggestion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  transition: var(--transition);
  
  &:hover {
    border-color: var(--border-hover);
    background-color: rgba(255, 255, 255, 0.04);
  }
}

.sug-badge-row {
  gap: 0.35rem;
}

.saisie-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.montant-input {
  font-size: 1.15rem;
  color: #34d399 !important;
  
  &::placeholder {
    color: var(--text-muted);
  }
}

.w-100 {
  width: 100%;
}

.ops-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.op-item {
  border: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.01);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
}

.type-indicator-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  &.Entrée {
    background-color: rgba(16, 185, 129, 0.1);
    color: #34d399;
  }
  &.Sortie {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }
  &.Interne {
    background-color: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
  }
}

.op-amount {
  &.Entrée { color: #34d399; }
  &.Sortie { color: #f87171; }
  &.Interne { color: #60a5fa; }
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
.font-black { font-weight: 900; }
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
