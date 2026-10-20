<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { db, generateId, type RecordEntry, type RecordTemplate } from '../db/index';
import { 
  FINANCES_COL_ID, 
  getFinancesRecords, 
  getComptesRecords, 
  getBudgetsRecords, 
  getSuggestionsRecords,
  getFinancesTemplates,
  formatToFrenchDate
} from '../db/queries';
import { Plus, X, Sparkles, ArrowUpRight, ArrowDownLeft, Calendar, Landmark, Trash2, Edit2, Copy, Bookmark, Check, Save } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

const finances = ref<RecordEntry[]>([]);
const comptes = ref<RecordEntry[]>([]);
const budgets = ref<RecordEntry[]>([]);
const suggestions = ref<RecordEntry[]>([]);
const templates = ref<RecordTemplate[]>([]);
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

// Editing State
const editingRecordId = ref<string | null>(null);

// Template Management States
const selectedTemplateId = ref<string>('');
const showSaveTemplateModal = ref(false);
const newTemplateName = ref('');
const isNewTemplateAutomated = ref(false);
const newTemplateRecurrence = ref<'monthly' | 'yearly'>('monthly');
const newTemplateRecurrenceDay = ref<number>(5);

// Scheduled templates alerts notification state
interface TemplateNotification {
  template: RecordTemplate;
  period: string;
  targetDate: Date;
  message: string;
}
const activeNotification = ref<TemplateNotification | null>(null);

const categoriesList = ["Dépense", "Revenu", "Cadeau", "Remboursement", "Prêt", "Vente", "Crédit", "Virement"];
const typesList = ["Sortie", "Entrée", "Interne"];

const loadData = async () => {
  isLoading.value = true;
  try {
    finances.value = await getFinancesRecords();
    comptes.value = await getComptesRecords();
    budgets.value = await getBudgetsRecords();
    suggestions.value = await getSuggestionsRecords();
    templates.value = await getFinancesTemplates();

    // Check scheduled templates for automated reminders
    checkAutomatedTemplates();

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

// --- Templates & Saisie Helpers ---

const checkAutomatedTemplates = () => {
  activeNotification.value = null;
  if (templates.value.length === 0) return;

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  for (const t of templates.value) {
    if (!t.isAutomated) continue;

    const candidates: { targetDate: Date; period: string }[] = [];

    if (t.recurrence === 'monthly' && t.recurrenceDay) {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const day = Math.min(t.recurrenceDay, 28);

      for (let offset = -1; offset <= 1; offset++) {
        let y = currentYear;
        let m = currentMonth + offset;
        if (m < 0) {
          m = 11;
          y -= 1;
        } else if (m > 11) {
          m = 0;
          y += 1;
        }
        const targetDate = new Date(y, m, day);
        const mm = String(m + 1).padStart(2, '0');
        const period = `${y}-${mm}`;
        candidates.push({ targetDate, period });
      }
    } else if (t.recurrence === 'yearly' && t.recurrenceDay && t.recurrenceMonth) {
      const currentYear = today.getFullYear();
      for (let offset = -1; offset <= 1; offset++) {
        const y = currentYear + offset;
        const targetDate = new Date(y, t.recurrenceMonth - 1, t.recurrenceDay);
        const period = `${y}`;
        candidates.push({ targetDate, period });
      }
    }

    for (const cand of candidates) {
      if (t.lastGeneratedPeriod && t.lastGeneratedPeriod >= cand.period) continue;

      const targetMidnight = new Date(cand.targetDate.getFullYear(), cand.targetDate.getMonth(), cand.targetDate.getDate());
      const diffTime = targetMidnight.getTime() - todayMidnight.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      // Suggérer si l'échéance est dans 10 jours max ou jusqu'à 30 jours après
      if (diffDays <= 10 && diffDays >= -30) {
        const targetDay = cand.targetDate.getDate();
        const targetMonth = cand.targetDate.getMonth();
        const targetYear = cand.targetDate.getFullYear();
        const periodName = `le ${targetDay} ${monthNames[targetMonth].toLowerCase()} ${targetYear}`;

        activeNotification.value = {
          template: t,
          period: cand.period,
          targetDate: cand.targetDate,
          message: `Rappel automatique : Ton modèle de saisie "${t.name}" est à valider pour ${periodName}.`
        };
        return; // Une seule suggestion à la fois
      }
    }
  }
};

const generatingTemplateNotification = ref<TemplateNotification | null>(null);

const triggerAutomatedTemplate = (notif: TemplateNotification) => {
  generatingTemplateNotification.value = notif;
  const t = notif.template;
  
  const d = notif.targetDate;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  formOp.value = {
    date: `${yyyy}-${mm}-${dd}`,
    type: t.data.type || 'Sortie',
    montant: String(t.data.montant || ''),
    compte: comptes.value.some(c => c.data.nom === t.data.compte) ? t.data.compte : (formOp.value.compte || ''),
    categorie: t.data.categorie || 'Dépense',
    budget: budgets.value.some(b => b.data.nom === t.data.budget) ? t.data.budget : '',
    partenaire: t.data.partenaire || '',
    commentaire: t.data.commentaire || ''
  };
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const handleApplyTemplate = () => {
  if (!selectedTemplateId.value) return;
  const t = templates.value.find(temp => temp.id === selectedTemplateId.value);
  if (!t) return;

  formOp.value = {
    date: new Date().toISOString().split('T')[0],
    type: t.data.type || 'Sortie',
    montant: String(t.data.montant || ''),
    compte: comptes.value.some(c => c.data.nom === t.data.compte) ? t.data.compte : (formOp.value.compte || ''),
    categorie: t.data.categorie || 'Dépense',
    budget: budgets.value.some(b => b.data.nom === t.data.budget) ? t.data.budget : '',
    partenaire: t.data.partenaire || '',
    commentaire: t.data.commentaire || ''
  };
  selectedTemplateId.value = ''; // Reset
};

const handleDeleteTemplate = async (templateId: string) => {
  const t = templates.value.find(temp => temp.id === templateId);
  if (!t) return;

  try {
    await db.templates.update(t.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    loadData();
  } catch (err) {
    console.error(err);
  }
};

const handleOpenSaveTemplate = () => {
  const m = Number(formOp.value.montant) || 0;
  if (m <= 0) {
    toast.warning('Veuillez saisir un montant supérieur à 0 avant de sauvegarder ce modèle.');
    return;
  }
  newTemplateName.value = formOp.value.partenaire || 'Mon modèle';
  isNewTemplateAutomated.value = false;
  newTemplateRecurrence.value = 'monthly';
  newTemplateRecurrenceDay.value = new Date().getDate();
  showSaveTemplateModal.value = true;
};

const handleCreateTemplate = async () => {
  const name = newTemplateName.value.trim();
  if (!name) {
    toast.warning('Veuillez donner un nom à votre modèle.');
    return;
  }

  try {
    const template: RecordTemplate = {
      id: `temp-${generateId()}`,
      collectionId: FINANCES_COL_ID,
      name,
      data: {
        type: formOp.value.type,
        montant: Number(formOp.value.montant) || 0,
        compte: formOp.value.compte,
        categorie: formOp.value.categorie,
        budget: formOp.value.type === 'Sortie' ? formOp.value.budget : '',
        partenaire: formOp.value.partenaire.trim(),
        commentaire: formOp.value.commentaire.trim()
      },
      isAutomated: isNewTemplateAutomated.value,
      recurrence: isNewTemplateAutomated.value ? newTemplateRecurrence.value : undefined,
      recurrenceDay: isNewTemplateAutomated.value ? newTemplateRecurrenceDay.value : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.templates.add(template);
    showSaveTemplateModal.value = false;
    loadData();
    toast.success('Modèle de saisie enregistré avec succès !');
  } catch (err) {
    console.error(err);
  }
};

// Start editing existing record
const startEditing = (record: RecordEntry) => {
  editingRecordId.value = record.id!;
  formOp.value = {
    date: record.data.date,
    type: record.data.type || 'Sortie',
    montant: String(record.data.montant || ''),
    compte: record.data.compte || '',
    categorie: record.data.categorie || 'Dépense',
    budget: record.data.budget || '',
    partenaire: record.data.partenaire || '',
    commentaire: record.data.commentaire || ''
  };
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Duplicate record as a prefilled form for new entry
const duplicateRecord = (record: RecordEntry) => {
  editingRecordId.value = null; // Ensure creation mode
  formOp.value = {
    date: new Date().toISOString().split('T')[0], // Today
    type: record.data.type || 'Sortie',
    montant: String(record.data.montant || ''),
    compte: record.data.compte || '',
    categorie: record.data.categorie || 'Dépense',
    budget: record.data.budget || '',
    partenaire: record.data.partenaire || '',
    commentaire: record.data.commentaire || ''
  };
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast.info('Opération dupliquée ! Modifie les valeurs de pré-saisie avant d\'enregistrer.');
};

const cancelEditing = () => {
  editingRecordId.value = null;
  formOp.value.montant = '';
  formOp.value.commentaire = '';
  formOp.value.partenaire = '';
};

// Saisie Form Validation & Submission (Supports both Create and Edit modes)
const handleAddFinance = async () => {
  const m = Number(formOp.value.montant) || 0;
  if (m <= 0 || !formOp.value.compte) {
    toast.warning('Veuillez saisir un montant supérieur à 0 et sélectionner un compte.');
    return;
  }

  try {
    if (editingRecordId.value !== null) {
      // Edit mode: update existing record
      await db.records.update(editingRecordId.value, {
        'data.date': formOp.value.date,
        'data.type': formOp.value.type,
        'data.montant': m,
        'data.compte': formOp.value.compte,
        'data.categorie': formOp.value.categorie,
        'data.budget': formOp.value.type === 'Sortie' ? formOp.value.budget : '',
        'data.partenaire': formOp.value.partenaire.trim(),
        'data.commentaire': formOp.value.commentaire.trim(),
        updatedAt: Date.now()
      });
      editingRecordId.value = null;
      toast.success('Opération financière modifiée !');
    } else {
      // Create mode: add new record
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

      // If this was generated from an automated template suggestion, advance its period
      if (generatingTemplateNotification.value) {
        await db.templates.update(generatingTemplateNotification.value.template.id, {
          lastGeneratedPeriod: generatingTemplateNotification.value.period,
          updatedAt: Date.now()
        });
        generatingTemplateNotification.value = null;
      }
      
      toast.success('Opération financière enregistrée !');
    }
    
    // Reset form amount and comment
    formOp.value.montant = '';
    formOp.value.commentaire = '';
    formOp.value.partenaire = '';
    
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

// Delete record
const handleDeleteFinance = async (id: string) => {
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
    <!-- Scheduled Template Reminder Notification -->
    <div v-if="activeNotification" class="card glass mb-4 scheduled-template-banner">
      <div class="banner-content">
        <div class="banner-icon">
          <Bookmark :size="20" class="bookmark-icon" />
        </div>
        <div class="banner-text">
          <h4 class="font-bold text-sm">Rappel récurrent</h4>
          <p class="text-xs text-sub mt-1">{{ activeNotification.message }}</p>
        </div>
      </div>
      <div class="banner-actions">
        <button @click="triggerAutomatedTemplate(activeNotification!)" class="btn btn-primary btn-sm flex-row banner-btn-main">
          Saisir l'opération
        </button>
        <button @click="activeNotification = null" class="btn btn-secondary btn-sm banner-btn-close" title="Ignorer pour le moment">
          <X :size="14" />
        </button>
      </div>
    </div>

    <div class="view-header">
      <div>
        <h2>Opérations</h2>
        <p class="text-sub">Enregistre tes dépenses et revenus, et traite les suggestions automatiques envoyées par tes autres applications.</p>
      </div>
    </div>

    <!-- Inbox / Suggestions Area -->
    <div v-if="parsedSuggestions.length > 0" class="inbox-suggestions-container mb-4">
      <div class="card glass inbox-card">
        <h3 class="font-bold flex-row mb-3">
          <Sparkles class="text-primary" :size="18" /> Boîte de réception
          <span class="badge badge-primary text-xs">{{ parsedSuggestions.length }}</span>
        </h3>
        <p class="text-sub text-xs mb-3">Saisies intelligentes suggérées par tes autres applications du hub (clique pour pré-remplir le formulaire).</p>
        
        <div class="suggestions-list">
          <div v-for="sug in parsedSuggestions" :key="sug.id" class="suggestion-item">
            <div class="sug-info">
              <div class="sug-badge-row flex-row">
                <span class="badge badge-primary text-xs">{{ sug.source }}</span>
                <span class="badge badge-warning text-xs font-bold">{{ sug.montant.toFixed(2) }} €</span>
              </div>
              <p class="sug-title font-bold mt-1 text-sm">{{ sug.partenaire }}</p>
              <p class="sug-desc text-xs text-muted" v-if="sug.commentaire">{{ sug.commentaire }}</p>
              <p class="sug-meta text-xs text-sub mt-1">Suggéré le : {{ formatToFrenchDate(sug.date) }}</p>
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
          <h3 class="font-bold flex-row mb-4">
            <Plus v-if="!editingRecordId" :size="18" />
            <Edit2 v-else :size="18" />
            <span>{{ editingRecordId ? 'Modifier l\'opération' : 'Nouvelle opération' }}</span>
          </h3>

          <!-- Templates Selection Dropdown (Only show if templates exist and not in edit mode!) -->
          <div class="form-group templates-section" v-if="templates.length > 0 && !editingRecordId">
            <label class="text-xs font-bold text-sub mb-1">Appliquer un modèle pré-enregistré</label>
            <div class="templates-row">
              <select v-model="selectedTemplateId" @change="handleApplyTemplate" class="select">
                <option value="">-- Choisir un modèle --</option>
                <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }} {{ t.isAutomated ? '(auto)' : '' }}</option>
              </select>
              <button v-if="selectedTemplateId" @click="handleDeleteTemplate(selectedTemplateId)" class="btn delete-template-btn" title="Supprimer ce modèle">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
          
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
              <label>Partenaire</label>
              <input v-model="formOp.partenaire" type="text" placeholder="Ex: Auchan, EDF, Employeur" class="input" />
            </div>
            <div class="form-group">
              <label>Commentaire</label>
              <input v-model="formOp.commentaire" type="text" placeholder="Ex: Courses de la semaine" class="input" />
            </div>
          </div>

          <div class="form-actions">
            <button @click="handleAddFinance" class="btn btn-primary w-100 flex-row justify-center form-submit-btn" :disabled="!formOp.montant">
              <Check v-if="editingRecordId" :size="16" />
              <span>{{ editingRecordId ? 'Enregistrer les modifications' : 'Enregistrer l\'opération' }}</span>
            </button>
            
            <div class="form-actions-row" v-if="editingRecordId || (!editingRecordId && Number(formOp.montant) > 0)">
              <button v-if="editingRecordId" @click="cancelEditing" class="btn btn-secondary flex-1">
                Annuler la modification
              </button>
              <button v-if="!editingRecordId && Number(formOp.montant) > 0" @click="handleOpenSaveTemplate" class="btn btn-secondary flex-row justify-center align-center flex-1 save-template-btn">
                <Bookmark :size="14" /> <span>Créer un modèle</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Recent Operations List -->
      <div class="recent-ops-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Calendar :size="18" /> Opérations récentes</h3>

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
                      {{ formatToFrenchDate(op.data.date) }}
                    </p>
                    <p class="op-details text-xs text-muted">
                      {{ op.data.compte }} <span v-if="op.data.budget">• {{ op.data.budget }}</span>
                    </p>
                  </div>
                </div>
                
                <div class="op-amount-col">
                  <span class="op-amount font-black text-sm" :class="op.data.type">
                    {{ op.data.type === 'Sortie' ? '-' : op.data.type === 'Entrée' ? '+' : '' }}{{ Number(op.data.montant).toFixed(2) }} €
                  </span>
                </div>
              </div>

              <!-- Vertical Stack of Action Buttons (Absolute Positioned on the Right) -->
              <div class="op-actions-sidebar">
                <button @click="startEditing(op)" class="action-btn edit" title="Modifier">
                  <Edit2 :size="14" />
                </button>
                <button @click="duplicateRecord(op)" class="action-btn duplicate" title="Dupliquer">
                  <Copy :size="14" />
                </button>
                <button @click="handleDeleteFinance(op.id!)" class="action-btn delete" title="Supprimer">
                  <Trash2 :size="14" />
                </button>
              </div>
              
              <div v-if="op.data.commentaire" class="op-comment-row mt-2 border-top pt-2">
                <span class="text-xs text-muted italic">{{ op.data.commentaire }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: Sauvegarder comme Modèle de Saisie -->
  <div v-if="showSaveTemplateModal" class="modal-overlay" @click.self="showSaveTemplateModal = false">
    <div class="modal-container card glass fade-in modal-save-template">
      <div class="modal-header">
        <h3 class="font-bold text-md modal-title flex-row align-center gap-1"><Save :size="16" /> Enregistrer comme modèle</h3>
        <button @click="showSaveTemplateModal = false" class="modal-close"><X :size="20" /></button>
      </div>
      <div class="modal-body">
        <p class="text-sub text-xs modal-explanation">Enregistre cette saisie pour la recharger en un clic plus tard, ou configure un rappel de planification mensuel/annuel automatique.</p>
        
        <div class="form-group mb-3">
          <label class="text-xs font-bold text-sub mb-1">Nom du modèle *</label>
          <input v-model="newTemplateName" type="text" class="input" placeholder="Ex: Loyer, Électricité, Courses Leclerc" />
        </div>

        <div class="form-group mb-3">
          <label class="checkbox-container text-xs font-bold text-sub cursor-pointer checkbox-label">
            <input type="checkbox" v-model="isNewTemplateAutomated" class="checkbox-input" />
            <span>Rappel récurrent planifié (Loyer, Salaire, etc.)</span>
          </label>
        </div>

        <div v-if="isNewTemplateAutomated" class="form-grid">
          <div class="form-group">
            <label class="text-xs font-bold text-sub mb-1">Périodicité</label>
            <select v-model="newTemplateRecurrence" class="select">
              <option value="monthly">Mensuelle</option>
              <option value="yearly">Annuelle</option>
            </select>
          </div>
          <div class="form-group">
            <label class="text-xs font-bold text-sub mb-1">Jour du prélèvement (1-28)</label>
            <input v-model="newTemplateRecurrenceDay" type="number" min="1" max="28" class="input" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="showSaveTemplateModal = false" class="btn btn-secondary btn-sm">Annuler</button>
        <button @click="handleCreateTemplate" class="btn btn-primary btn-sm flex-row">
          <Check :size="14" /> Enregistrer le modèle
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.inbox-card {
  border-color: color-mix(in srgb, var(--color-success) 20%, transparent);
  background-color: color-mix(in srgb, var(--color-success) 1%, transparent);
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
  background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  transition: var(--transition);
  
  &:hover {
    border-color: var(--border-hover);
    background-color: color-mix(in srgb, var(--color-white) 4%, transparent);
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
  color: var(--color-success) !important;
  
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
  background-color: color-mix(in srgb, var(--color-white) 1%, transparent);
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
    background-color: color-mix(in srgb, var(--color-success) 10%, transparent);
    color: var(--color-success);
  }
  &.Sortie {
    background-color: color-mix(in srgb, var(--color-danger) 10%, transparent);
    color: var(--color-danger);
  }
  &.Interne {
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
  }
}

.op-amount {
  &.Entrée { color: var(--color-success); }
  &.Sortie { color: var(--color-danger); }
  &.Interne { color: var(--color-primary); }
}

.delete-btn-icon {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  transition: var(--transition);
  
  &:hover {
    color: var(--color-danger);
    background-color: color-mix(in srgb, var(--color-danger) 10%, transparent);
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

.scheduled-template-banner {
  background: linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.12) 100%);
  border-color: rgba(139,92,246,0.25);
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-radius: var(--radius-md);
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.25rem;
  }
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  
  @media (max-width: 768px) {
    align-items: flex-start;
  }
}

.banner-icon {
  background-color: rgba(139,92,246,0.15);
  color: var(--color-primary);
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.banner-text {
  h4 {
    color: var(--text-primary);
    margin: 0;
  }
  p {
    margin: 4px 0 0 0;
    color: var(--text-muted);
  }
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  @media (max-width: 768px) {
    width: 100%;
    justify-content: flex-end;
    
    .banner-btn-main {
      flex-grow: 1;
      justify-content: center;
    }
  }
}

.banner-btn-main {
  white-space: nowrap;
  height: 32px;
  font-size: 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.banner-btn-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
  border-color: color-mix(in srgb, var(--color-white) 6%, transparent);
}

/* Centralized & Refactored style classes (replacing inline styles) */
.templates-section {
  margin-bottom: 1.25rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-white) 6%, transparent);
  padding-bottom: 1.25rem;
  
  label {
    color: var(--text-muted);
  }
}

.templates-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  
  .select {
    flex: 1;
    font-size: 0.85rem;
  }
}

.delete-template-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  background-color: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  
  &:hover {
    background-color: rgba(239, 68, 68, 0.15);
  }
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
  width: 100%;
}

.form-actions-row {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.form-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.save-template-btn {
  font-size: 0.85rem;
  padding: 0 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.flex-1 {
  flex: 1;
}

.op-item {
  position: relative;
  padding-right: 2.25rem;
}

.op-amount-col {
  display: flex;
  align-items: center;
  padding-right: 0.25rem;
}

.op-amount {
  margin-right: 0.5rem;
  white-space: nowrap;
}

.op-actions-sidebar {
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  align-items: center;
  justify-content: center;
}

.bookmark-icon {
  color: var(--color-secondary);
}

.modal-save-template {
  max-width: 420px;
  padding: 0;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.modal-explanation {
  color: var(--text-muted);
  line-height: 1.4;
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}
</style>
