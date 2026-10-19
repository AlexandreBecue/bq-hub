<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { DayWorkout } from '../types';
import { 
  getWeeklyProgramme, 
  saveDayWorkout, 
  seedDefaultWeeklyProgramme, 
  getWorkoutTemplates,
  saveWorkoutTemplate,
  deleteWorkoutTemplate,
  generateCardioDetail,
  getCardioSports,
  DAYS_NAMES, 
  exercisesCatalogue, 
  exercisesMap 
} from '../db/queries';
import type { RecordEntry } from '../db/index';
import { useToast } from '@bq/theme/useToast';
import { Plus, Trash2, ArrowUp, ArrowDown, RotateCcw, Save, Edit2, Bookmark, Folder, X, Check, HeartPulse, Flame, Repeat, Zap, Moon, Timer } from '@lucide/vue';

const toast = useToast();
const emit = defineEmits(['data-updated']);

const weeklyProgramme = ref<Record<number, DayWorkout>>({});
const selectedDayId = ref<number>(1); // Lundi par défaut
const isLoading = ref(true);
const isSaving = ref(false);
const isEditing = ref(false);

// Local draft copy of current day's workout
const draftWorkout = ref<DayWorkout>({ type: 'rest' });

// Template library state
const templatesList = ref<RecordEntry[]>([]);
const cardioSports = ref<RecordEntry[]>([]);
const selectedTemplateId = ref<string>('');
const isTemplateManagerOpen = ref(false);
const isSaveTemplateModalOpen = ref(false);
const newTemplateName = ref('');
const newTemplateDesc = ref('');

const selectedDayName = computed(() => DAYS_NAMES[selectedDayId.value]);

async function loadTemplates() {
  try {
    templatesList.value = await getWorkoutTemplates();
  } catch (e) {
    console.error('Erreur chargement modèles:', e);
  }
}

function applyTemplateToCurrentDay() {
  if (!selectedTemplateId.value) return;
  const tmpl = templatesList.value.find(t => t.id === selectedTemplateId.value);
  if (tmpl && tmpl.data.details_json) {
    try {
      draftWorkout.value = JSON.parse(tmpl.data.details_json);
      toast.success(`Séance "${tmpl.data.nom}" appliquée au ${selectedDayName.value} !`);
    } catch (e) {
      console.error('Erreur parsing template:', e);
    }
  }
}

function applySpecificTemplate(tmpl: RecordEntry) {
  if (tmpl.data.details_json) {
    try {
      draftWorkout.value = JSON.parse(tmpl.data.details_json);
      isEditing.value = true;
      isTemplateManagerOpen.value = false;
      toast.success(`Séance "${tmpl.data.nom}" appliquée au ${selectedDayName.value} !`);
    } catch (e) {
      console.error('Erreur parsing template:', e);
    }
  }
}

function openSaveAsTemplateModal() {
  let defaultTitle = '';
  if (draftWorkout.value.strength?.title) defaultTitle = draftWorkout.value.strength.title;
  else if (draftWorkout.value.cardio?.title) defaultTitle = draftWorkout.value.cardio.title;
  else defaultTitle = `Séance du ${selectedDayName.value}`;

  newTemplateName.value = defaultTitle;
  newTemplateDesc.value = '';
  isSaveTemplateModalOpen.value = true;
}

async function handleSaveNewTemplate() {
  if (!newTemplateName.value.trim()) {
    toast.warning('Veuillez saisir un nom pour le modèle.');
    return;
  }

  let typeLabel = 'Repos';
  if (draftWorkout.value.type === 'strength') typeLabel = 'Musculation';
  else if (draftWorkout.value.type === 'cardio') typeLabel = 'Cardio';
  else if (draftWorkout.value.type === 'hybrid') typeLabel = 'Hybride';

  try {
    await saveWorkoutTemplate({
      nom: newTemplateName.value.trim(),
      type: typeLabel,
      description: newTemplateDesc.value.trim(),
      workout: JSON.parse(JSON.stringify(draftWorkout.value))
    });
    await loadTemplates();
    isSaveTemplateModalOpen.value = false;
    toast.success('Modèle enregistré avec succès dans la bibliothèque !');
  } catch (e) {
    console.error('Erreur enregistrement modèle:', e);
    toast.error('Erreur lors de la sauvegarde du modèle.');
  }
}

async function handleDeleteTemplate(id: string) {
  try {
    await deleteWorkoutTemplate(id);
    await loadTemplates();
    toast.success('Modèle supprimé de la bibliothèque.');
  } catch (e) {
    console.error('Erreur suppression modèle:', e);
    toast.error('Erreur lors de la suppression.');
  }
}

async function loadProgramme() {
  isLoading.value = true;
  try {
    weeklyProgramme.value = await getWeeklyProgramme();
    initDraft();
  } catch (err) {
    console.error('Erreur chargement planning:', err);
  } finally {
    isLoading.value = false;
  }
}

function initDraft() {
  const current = weeklyProgramme.value[selectedDayId.value];
  if (current) {
    draftWorkout.value = JSON.parse(JSON.stringify(current));
  } else {
    draftWorkout.value = { type: 'rest' };
  }
}

function selectDay(dayId: number) {
  selectedDayId.value = dayId;
  isEditing.value = false;
  initDraft();
}

function handleTypeChange() {
  if (draftWorkout.value.type === 'strength') {
    if (!draftWorkout.value.strength) {
      draftWorkout.value.strength = {
        title: 'Séance de musculation',
        sequence: 'alternated',
        sets: 4,
        warmup: null,
        exercises: [],
        finisher: null
      };
    }
  } else if (draftWorkout.value.type === 'cardio') {
    if (!draftWorkout.value.cardio) {
      draftWorkout.value.cardio = {
        title: 'Séance cardio',
        exerciseId: 'running',
        durationMinutes: 30,
        interval: null,
        notes: ''
      };
    }
  } else if (draftWorkout.value.type === 'hybrid') {
    if (!draftWorkout.value.strength) {
      draftWorkout.value.strength = {
        title: 'Renforcement musculaire',
        sequence: 'alternated',
        sets: 4,
        warmup: null,
        exercises: [],
        finisher: null
      };
    }
    if (!draftWorkout.value.cardio) {
      draftWorkout.value.cardio = {
        title: 'Cardio complémentaire',
        exerciseId: 'running',
        durationMinutes: 20,
        interval: null,
        notes: ''
      };
    }
  }
}

// Circuit helpers
const newCircuitExerciseId = ref('');
function addExerciseToCircuit() {
  if (!newCircuitExerciseId.value || !draftWorkout.value.strength) return;
  draftWorkout.value.strength.exercises.push({
    exerciseId: newCircuitExerciseId.value,
    workDuration: 30,
    restDuration: 20
  });
  newCircuitExerciseId.value = '';
}

function removeCircuitExercise(index: number) {
  draftWorkout.value.strength?.exercises.splice(index, 1);
}

function moveCircuitExercise(index: number, delta: number) {
  const list = draftWorkout.value.strength?.exercises;
  if (!list) return;
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  const temp = list[index];
  list[index] = list[target];
  list[target] = temp;
}

// Warmup toggle
function toggleWarmup() {
  if (!draftWorkout.value.strength) return;
  if (draftWorkout.value.strength.warmup) {
    draftWorkout.value.strength.warmup = null;
  } else {
    draftWorkout.value.strength.warmup = {
      exerciseId: exercisesCatalogue[0]?.id || 'calf_raise',
      workDuration: 120,
      restDuration: 10
    };
  }
}

// Finisher helpers
const newFinisherExerciseId = ref('');
function toggleFinisher() {
  if (!draftWorkout.value.strength) return;
  if (draftWorkout.value.strength.finisher) {
    draftWorkout.value.strength.finisher = null;
  } else {
    draftWorkout.value.strength.finisher = [];
  }
}

function addFinisherExercise() {
  if (!newFinisherExerciseId.value || !draftWorkout.value.strength) return;
  if (!draftWorkout.value.strength.finisher) draftWorkout.value.strength.finisher = [];
  draftWorkout.value.strength.finisher.push({
    exerciseId: newFinisherExerciseId.value,
    sets: 2,
    workDuration: 20,
    restDuration: 20
  });
  newFinisherExerciseId.value = '';
}

function removeFinisherExercise(index: number) {
  draftWorkout.value.strength?.finisher?.splice(index, 1);
}

// Cardio Warmup toggle
function toggleCardioWarmup() {
  if (!draftWorkout.value.cardio) return;
  if (draftWorkout.value.cardio.warmup) {
    draftWorkout.value.cardio.warmup = null;
  } else {
    draftWorkout.value.cardio.warmup = {
      exerciseId: draftWorkout.value.cardio.exerciseId || 'running',
      workDuration: 600,
      restDuration: 60
    };
  }
}

// Cardio Circuit helpers
const newCardioCircuitExerciseId = ref('');
function addExerciseToCardioCircuit() {
  if (!draftWorkout.value.cardio) return;
  if (!draftWorkout.value.cardio.exercises) draftWorkout.value.cardio.exercises = [];
  draftWorkout.value.cardio.exercises.push({
    exerciseId: newCardioCircuitExerciseId.value || draftWorkout.value.cardio.exerciseId || 'running',
    workDuration: 30,
    restDuration: 30
  });
  newCardioCircuitExerciseId.value = '';
}

function removeCardioCircuitExercise(index: number) {
  draftWorkout.value.cardio?.exercises?.splice(index, 1);
}

function moveCardioCircuitExercise(index: number, delta: number) {
  const list = draftWorkout.value.cardio?.exercises;
  if (!list) return;
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  const temp = list[index];
  list[index] = list[target];
  list[target] = temp;
}

// Cardio Finisher helpers
const newCardioFinisherExerciseId = ref('');
function toggleCardioFinisher() {
  if (!draftWorkout.value.cardio) return;
  if (draftWorkout.value.cardio.finisher) {
    draftWorkout.value.cardio.finisher = null;
  } else {
    draftWorkout.value.cardio.finisher = [];
  }
}

function addCardioFinisherExercise() {
  if (!draftWorkout.value.cardio) return;
  if (!draftWorkout.value.cardio.finisher) draftWorkout.value.cardio.finisher = [];
  draftWorkout.value.cardio.finisher.push({
    exerciseId: newCardioFinisherExerciseId.value || draftWorkout.value.cardio.exerciseId || 'running',
    sets: 1,
    workDuration: 300,
    restDuration: 0
  });
  newCardioFinisherExerciseId.value = '';
}

function removeCardioFinisherExercise(index: number) {
  draftWorkout.value.cardio?.finisher?.splice(index, 1);
}

async function saveCurrentDay() {
  isSaving.value = true;
  try {
    await saveDayWorkout(selectedDayId.value, draftWorkout.value);
    weeklyProgramme.value[selectedDayId.value] = JSON.parse(JSON.stringify(draftWorkout.value));
    toast.success(`Séance de ${selectedDayName.value} enregistrée !`);
    emit('data-updated');
    isEditing.value = false;
  } catch (err) {
    console.error('Erreur sauvegarde:', err);
    toast.error("Erreur lors de l'enregistrement.");
  } finally {
    isSaving.value = false;
  }
}

async function resetWeek() {
  isLoading.value = true;
  try {
    await seedDefaultWeeklyProgramme();
    await loadProgramme();
    toast.success('Semaine réinitialisée aux valeurs par défaut !');
    emit('data-updated');
    isEditing.value = false;
  } catch (err) {
    console.error('Erreur réinitialisation:', err);
    toast.error('Erreur lors de la réinitialisation.');
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  loadProgramme();
  loadTemplates();
  try {
    cardioSports.value = await getCardioSports();
  } catch (e) {
    console.error('Erreur chargement sports:', e);
  }
});
</script>

<template>
  <div class="planning-view">
    <!-- Onglets de sélection du jour -->
    <div class="days-selector-bar glass">
      <button 
        v-for="d in [1, 2, 3, 4, 5, 6, 0]" 
        :key="d"
        class="day-tab-btn"
        :class="{ 'day-tab-active': selectedDayId === d }"
        @click="selectDay(d)"
      >
        {{ DAYS_NAMES[d] }}
      </button>
    </div>

    
    <!-- Affichage ou Édition du jour sélectionné -->
    <div class="card editor-card">
      <div class="editor-header flex-row justify-between align-center mb-4">
        <h2>Programme du jour : {{ selectedDayName }}</h2>
        <div class="flex-row gap-2 align-center">
          <button @click="isTemplateManagerOpen = true" class="btn btn-neutral btn-sm" title="Ouvrir la bibliothèque de séances types">
            <Folder :size="14" /> Modèles ({{ templatesList.length }})
          </button>
          <button v-if="!isEditing" @click="isEditing = true" class="action-btn edit" title="Modifier le programme du jour">
            <Edit2 :size="18" />
          </button>
        </div>
      </div>

      <!-- MODE LECTURE -->
      <div v-if="!isEditing" class="read-mode">
        <div v-if="draftWorkout.type === 'rest'" class="card glass text-center py-5">
          <div class="rest-icon-wrapper mb-3">
            <Moon :size="32" class="text-muted" />
          </div>
          <h3 class="font-bold text-lg mb-1">Jour de repos</h3>
          <p class="text-sub text-sm m-0">Récupération et régénération musculaire.</p>
        </div>
        <div v-else-if="draftWorkout.type === 'cardio'" class="cardio-planning-card card glass p-4">
          <div class="flex-row justify-between align-center mb-3 flex-wrap gap-2">
            <div class="flex-row align-center gap-2">
              <div class="cardio-icon-badge">
                <HeartPulse :size="20" />
              </div>
              <h3 class="font-bold text-lg m-0">
                {{ draftWorkout.cardio?.title || 'Session Cardio' }}
              </h3>
            </div>
            <div class="flex-row gap-2 align-center">
              <span class="badge badge-secondary text-xs">
                {{ draftWorkout.cardio?.exerciseId === 'cycling' ? 'Cyclisme' : 'Course à pied' }}
              </span>
              <span class="badge badge-neutral text-xs">
                <Timer :size="12" class="mr-1" /> {{ draftWorkout.cardio?.durationMinutes || 30 }} min
              </span>
            </div>
          </div>
          <div v-if="draftWorkout.cardio?.notes" class="cardio-instructions mt-3 p-3 card glass text-sub text-sm">
            <p class="m-0 italic">{{ draftWorkout.cardio.notes }}</p>
          </div>
        </div>
        <div v-else>
          <div v-if="draftWorkout.strength?.exercises && draftWorkout.strength?.exercises.length > 0">
            <div v-for="(exo, idx) in draftWorkout.strength?.exercises" :key="idx" class="flex-row justify-between align-center p-3 mb-2 bg-secondary rounded">
              <div class="flex-row align-center gap-3">
                <span class="text-lg font-bold text-muted">{{ idx + 1 }}.</span>
                <span class="font-bold">{{ exercisesMap[exo.exerciseId]?.name || 'Exercice inconnu' }}</span>
              </div>
              <span class="badge badge-primary">{{ draftWorkout.strength?.sets }}x {{ exo.workDuration }}s <template v-if="exo.restDuration">| ⏱ {{ exo.restDuration }}s</template></span>
            </div>
          </div>
          <p v-else class="text-center text-muted py-4">Aucun exercice prévu pour cette séance.</p>
        </div>
      </div>

      <!-- MODE EDITION -->
      <div v-else class="edit-mode">
        <!-- Barre de chargement de modèle -->
        <div class="template-selector-box card glass p-3 mb-4 flex-row justify-between align-center flex-wrap gap-2">
          <div class="flex-row align-center gap-2 flex-grow-1">
            <label class="text-xs font-bold text-muted uppercase m-0">Modèle</label>
            <select v-model="selectedTemplateId" @change="applyTemplateToCurrentDay" class="select select-sm flex-grow-1">
              <option value="">-- Choisir un modèle de séance --</option>
              <option v-for="t in templatesList" :key="t.id" :value="t.id">
                {{ t.data.nom }} ({{ t.data.type }})
              </option>
            </select>
          </div>
          <button @click="openSaveAsTemplateModal" class="btn btn-secondary btn-sm flex-row" title="Enregistrer la séance actuelle comme modèle réutilisable">
            <Bookmark :size="14" /> Sauvegarder en modèle
          </button>
        </div>

        <!-- Type de Séance -->

      <div class="form-group">
        <label>Type de séance</label>
        <select v-model="draftWorkout.type" class="select" @change="handleTypeChange">
          <option value="strength">Renfo</option>
          <option value="cardio">Cardio</option>
          <option value="hybrid">Hybride (Renfo + Cardio)</option>
          <option value="rest">Repos</option>
        </select>
      </div>

      <!-- Cas Repos -->
      <div v-if="draftWorkout.type === 'rest'" class="rest-hint">
        Cette journée est configurée comme repos complet.
      </div>

      <!-- Configuration Renfo / Hybride -->
      <template v-if="draftWorkout.type === 'strength' || draftWorkout.type === 'hybrid'">
        <div v-if="draftWorkout.strength" class="sub-section">
          <div class="form-group">
            <label>Titre de la séance de renfo</label>
            <input type="text" v-model="draftWorkout.strength.title" class="input" placeholder="Ex: Majeur pectoraux..." />
          </div>

          <div class="form-group">
            <label>Nombre de séries (tours du circuit)</label>
            <input type="number" min="1" max="10" v-model.number="draftWorkout.strength.sets" class="input" />
          </div>

          <!-- Échauffement -->
          <div class="card section-card">
            <div class="section-card-header flex-row justify-between align-center">
              <h3 class="flex-row align-center gap-1"><Flame :size="16" /> Échauffement</h3>
              <button 
                class="btn btn-sm flex-row" 
                :class="draftWorkout.strength.warmup ? 'btn-danger' : 'btn-secondary'"
                @click="toggleWarmup"
              >
                <Trash2 v-if="draftWorkout.strength.warmup" :size="14" />
                <Plus v-else :size="14" />
                {{ draftWorkout.strength.warmup ? 'Supprimer' : 'Ajouter' }}
              </button>
            </div>

            <div v-if="draftWorkout.strength.warmup" class="sub-form-grid">
              <div class="form-group">
                <label>Exercice</label>
                <select v-model="draftWorkout.strength.warmup.exerciseId" class="select">
                  <option v-for="ex in exercisesCatalogue" :key="ex.id" :value="ex.id">{{ ex.name }}</option>
                </select>
              </div>
              <div class="grid-2-col">
                <div class="form-group">
                  <label>Durée travail (s)</label>
                  <input type="number" v-model.number="draftWorkout.strength.warmup.workDuration" class="input" />
                </div>
                <div class="form-group">
                  <label>Durée repos (s)</label>
                  <input type="number" v-model.number="draftWorkout.strength.warmup.restDuration" class="input" />
                </div>
              </div>
            </div>
          </div>

          <!-- Circuit Principal -->
          <div class="card section-card">
            <div class="section-card-header flex-row justify-between align-center">
              <h3 class="flex-row align-center gap-1"><Repeat :size="16" /> Circuit principal</h3>
              <span class="badge">{{ draftWorkout.strength.exercises.length }} exos</span>
            </div>

            <div class="exercises-edit-list">
              <div v-for="(ex, index) in draftWorkout.strength.exercises" :key="index" class="exercise-edit-row">
                <div class="row-header">
                  <span class="ex-num">{{ index + 1 }}</span>
                  <span class="ex-name">{{ exercisesMap[ex.exerciseId]?.name || ex.exerciseId }}</span>
                  <div class="row-actions flex-row gap-1">
                    <button class="action-btn" @click="moveCircuitExercise(index, -1)" :disabled="index === 0" title="Monter">
                      <ArrowUp :size="14" />
                    </button>
                    <button class="action-btn" @click="moveCircuitExercise(index, 1)" :disabled="index === draftWorkout.strength.exercises.length - 1" title="Descendre">
                      <ArrowDown :size="14" />
                    </button>
                    <button class="action-btn delete" @click="removeCircuitExercise(index)" title="Supprimer cet exercice">
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>

                <div class="grid-2-col">
                  <div class="form-group">
                    <label>Travail (s)</label>
                    <input type="number" v-model.number="ex.workDuration" class="input" />
                  </div>
                  <div class="form-group">
                    <label>Repos (s)</label>
                    <input type="number" v-model.number="ex.restDuration" class="input" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Ajout d'exercice au circuit -->
            <div class="add-control-box">
              <select v-model="newCircuitExerciseId" class="select">
                <option value="">-- Choisir un exercice à ajouter --</option>
                <option v-for="ex in exercisesCatalogue" :key="ex.id" :value="ex.id">{{ ex.name }}</option>
              </select>
              <button class="btn btn-primary" :disabled="!newCircuitExerciseId" @click="addExerciseToCircuit">
                <Plus class="icon-sm" /> Ajouter
              </button>
            </div>
          </div>

          <!-- Finisseur -->
          <div class="card section-card">
            <div class="section-card-header flex-row justify-between align-center">
              <h3 class="flex-row align-center gap-1"><Zap :size="16" /> Finisseur</h3>
              <button 
                class="btn btn-sm flex-row" 
                :class="draftWorkout.strength.finisher ? 'btn-danger' : 'btn-secondary'"
                @click="toggleFinisher"
              >
                <Trash2 v-if="draftWorkout.strength.finisher" :size="14" />
                <Plus v-else :size="14" />
                {{ draftWorkout.strength.finisher ? 'Supprimer' : 'Ajouter' }}
              </button>
            </div>

            <div v-if="draftWorkout.strength.finisher" class="exercises-edit-list">
              <div v-for="(ex, index) in draftWorkout.strength.finisher" :key="index" class="exercise-edit-row">
                <div class="row-header flex-row justify-between align-center">
                  <span class="ex-name font-bold">{{ exercisesMap[ex.exerciseId]?.name || ex.exerciseId }}</span>
                  <button class="action-btn delete" @click="removeFinisherExercise(index)" title="Supprimer cet exercice">
                    <Trash2 :size="14" />
                  </button>
                </div>
                <div class="grid-3-col">
                  <div class="form-group">
                    <label>Séries</label>
                    <input type="number" v-model.number="ex.sets" class="input" />
                  </div>
                  <div class="form-group">
                    <label>Travail (s)</label>
                    <input type="number" v-model.number="ex.workDuration" class="input" />
                  </div>
                  <div class="form-group">
                    <label>Repos (s)</label>
                    <input type="number" v-model.number="ex.restDuration" class="input" />
                  </div>
                </div>
              </div>

              <!-- Ajout finisseur -->
              <div class="add-control-box">
                <select v-model="newFinisherExerciseId" class="select">
                  <option value="">-- Exercice finisseur --</option>
                  <option v-for="ex in exercisesCatalogue" :key="ex.id" :value="ex.id">{{ ex.name }}</option>
                </select>
                <button class="btn btn-primary" :disabled="!newFinisherExerciseId" @click="addFinisherExercise">
                  <Plus class="icon-sm" /> Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Configuration Cardio / Hybride -->
      <template v-if="draftWorkout.type === 'cardio' || draftWorkout.type === 'hybrid'">
        <div v-if="draftWorkout.cardio" class="sub-section mt-4">
          <div class="card section-card">
            <div class="section-card-header flex-row justify-between align-center">
              <h3 class="flex-row align-center gap-1"><HeartPulse :size="16" /> Paramètres Cardio</h3>
            </div>

            <div class="form-group">
              <label>Titre de la sortie</label>
              <input type="text" v-model="draftWorkout.cardio.title" class="input" placeholder="Ex: Fractionné 30/30 ou Sortie longue..." />
            </div>

            <div class="grid-3-col">
              <div class="form-group">
                <label>Sport</label>
                <select v-model="draftWorkout.cardio.exerciseId" class="select">
                  <option v-for="s in (cardioSports.length ? cardioSports : [{ id: 'running', data: { nom: 'Course à pied', icone: 'running' } }, { id: 'cycling', data: { nom: 'Cyclisme', icone: 'cycling' } }])" :key="s.id" :value="s.data.icone || s.id">
                    {{ s.data.nom }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label>Durée estimée (min)</label>
                <input type="number" v-model.number="draftWorkout.cardio.durationMinutes" class="input" />
              </div>

              <div class="form-group">
                <label>Distance estimée (km)</label>
                <input type="number" step="0.1" v-model.number="draftWorkout.cardio.distanceKm" class="input" placeholder="Ex: 8.5" />
              </div>
            </div>

            <div class="form-group">
              <div class="flex-row justify-between align-center mb-1">
                <label class="m-0">Détail du commentaire (historique)</label>
                <button type="button" @click="draftWorkout.cardio.detail = generateCardioDetail(draftWorkout.cardio)" class="btn btn-neutral btn-xs flex-row" title="Régénérer d'après les blocs">
                  <RotateCcw :size="12" /> Auto-générer
                </button>
              </div>
              <input type="text" v-model="draftWorkout.cardio.detail" class="input" :placeholder="generateCardioDetail(draftWorkout.cardio) || 'Ex: 30\' à 5:40 + 4x500m à 4:00 + 10\' à 6:00'" />
            </div>

            <div class="form-group">
              <label>Conseils / Instructions (allure, EF, etc.)</label>
              <textarea v-model="draftWorkout.cardio.notes" class="textarea" rows="2" placeholder="Ex: Échauffement très calme, fractionné dynamique..."></textarea>
            </div>
          </div>

          <!-- Échauffement Cardio -->
          <div class="card section-card mt-3">
            <div class="section-card-header flex-row justify-between align-center">
              <h3 class="flex-row align-center gap-1"><Flame :size="16" /> Échauffement Cardio</h3>
              <button 
                class="btn btn-sm flex-row" 
                :class="draftWorkout.cardio.warmup ? 'btn-danger' : 'btn-secondary'"
                @click="toggleCardioWarmup"
              >
                <Trash2 v-if="draftWorkout.cardio.warmup" :size="14" />
                <Plus v-else :size="14" />
                {{ draftWorkout.cardio.warmup ? 'Supprimer' : 'Ajouter' }}
              </button>
            </div>

            <div v-if="draftWorkout.cardio.warmup" class="grid-3-col">
              <div class="form-group">
                <label>Durée travail / trot (s)</label>
                <input type="number" v-model.number="draftWorkout.cardio.warmup.workDuration" class="input" />
              </div>
              <div class="form-group">
                <label>Distance (m, optionnel)</label>
                <input type="number" v-model.number="draftWorkout.cardio.warmup.distanceM" class="input" placeholder="Ex: 3000" />
              </div>
              <div class="form-group">
                <label>Allure cible</label>
                <input type="text" v-model="draftWorkout.cardio.warmup.allure" class="input" placeholder="Ex: 5:40" />
              </div>
            </div>
          </div>

          <!-- Fractionné / Circuit Cardio -->
          <div class="card section-card mt-3">
            <div class="section-card-header flex-row justify-between align-center">
              <h3 class="flex-row align-center gap-1"><Repeat :size="16" /> Fractionné / Intervalles</h3>
              <span class="badge">{{ draftWorkout.cardio.exercises?.length || 0 }} blocs</span>
            </div>

            <div class="form-group">
              <label>Nombre de répétitions / tours de fractionné</label>
              <input type="number" min="1" max="50" v-model.number="draftWorkout.cardio.sets" class="input" />
            </div>

            <div v-if="draftWorkout.cardio.exercises && draftWorkout.cardio.exercises.length > 0" class="exercises-edit-list">
              <div v-for="(ex, index) in draftWorkout.cardio.exercises" :key="index" class="exercise-edit-row">
                <div class="row-header">
                  <span class="ex-num">{{ index + 1 }}</span>
                  <span class="ex-name">{{ ex.exerciseId === 'cycling' ? 'Vélo (effort rapide)' : 'Course (vitesse / VMA)' }}</span>
                  <div class="row-actions flex-row gap-1">
                    <button class="action-btn" @click="moveCardioCircuitExercise(index, -1)" :disabled="index === 0" title="Monter">
                      <ArrowUp :size="14" />
                    </button>
                    <button class="action-btn" @click="moveCardioCircuitExercise(index, 1)" :disabled="index === draftWorkout.cardio.exercises.length - 1" title="Descendre">
                      <ArrowDown :size="14" />
                    </button>
                    <button class="action-btn delete" @click="removeCardioCircuitExercise(index)" title="Supprimer cet intervalle">
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>

                <div class="grid-3-col">
                  <div class="form-group">
                    <label>Effort vif (s)</label>
                    <input type="number" v-model.number="ex.workDuration" class="input" />
                  </div>
                  <div class="form-group">
                    <label>Distance (m, optionnel)</label>
                    <input type="number" v-model.number="ex.distanceM" class="input" placeholder="Ex: 500" />
                  </div>
                  <div class="form-group">
                    <label>Allure cible</label>
                    <input type="text" v-model="ex.allure" class="input" placeholder="Ex: 4:00" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Ajout d'intervalle au circuit cardio -->
            <div class="add-control-box">
              <select v-model="newCardioCircuitExerciseId" class="select">
                <option value="running">Course à pied (accélération)</option>
                <option value="cycling">Cyclisme (tempo / sprint)</option>
              </select>
              <button class="btn btn-primary" @click="addExerciseToCardioCircuit">
                <Plus class="icon-sm" /> Ajouter un intervalle
              </button>
            </div>
          </div>

          <!-- Finisseur / Retour au calme Cardio -->
          <div class="card section-card mt-3">
            <div class="section-card-header flex-row justify-between align-center">
              <h3 class="flex-row align-center gap-1"><Zap :size="16" /> Finisseur / Retour au calme</h3>
              <button 
                class="btn btn-sm flex-row" 
                :class="draftWorkout.cardio.finisher ? 'btn-danger' : 'btn-secondary'"
                @click="toggleCardioFinisher"
              >
                <Trash2 v-if="draftWorkout.cardio.finisher" :size="14" />
                <Plus v-else :size="14" />
                {{ draftWorkout.cardio.finisher ? 'Supprimer' : 'Ajouter' }}
              </button>
            </div>

            <div v-if="draftWorkout.cardio.finisher" class="exercises-edit-list">
              <div v-for="(ex, index) in draftWorkout.cardio.finisher" :key="index" class="exercise-edit-row">
                <div class="row-header flex-row justify-between align-center">
                  <span class="ex-name font-bold">{{ ex.exerciseId === 'cycling' ? 'Vélo récupération' : 'Trot de récupération' }}</span>
                  <button class="action-btn delete" @click="removeCardioFinisherExercise(index)" title="Supprimer">
                    <Trash2 :size="14" />
                  </button>
                </div>
                <div class="grid-3-col">
                  <div class="form-group">
                    <label>Durée (s)</label>
                    <input type="number" v-model.number="ex.workDuration" class="input" />
                  </div>
                  <div class="form-group">
                    <label>Distance (m, optionnel)</label>
                    <input type="number" v-model.number="ex.distanceM" class="input" placeholder="Ex: 1500" />
                  </div>
                  <div class="form-group">
                    <label>Allure cible</label>
                    <input type="text" v-model="ex.allure" class="input" placeholder="Ex: 6:00" />
                  </div>
                </div>
              </div>

              <!-- Ajout finisseur cardio -->
              <div class="add-control-box">
                <select v-model="newCardioFinisherExerciseId" class="select">
                  <option value="running">Course à pied (récupération)</option>
                  <option value="cycling">Cyclisme (moulinage)</option>
                </select>
                <button class="btn btn-primary" @click="addCardioFinisherExercise">
                  <Plus class="icon-sm" /> Ajouter un bloc final
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Boutons d'Action Enregistrement -->
      <div class="editor-actions">
        <button class="btn btn-primary btn-save" :disabled="isSaving" @click="saveCurrentDay">
          <Save class="icon-sm" /> {{ isSaving ? 'Enregistrement...' : 'Enregistrer la séance' }}
        </button>
      </div>
      </div>
    </div>

    <!-- Actions Globales -->
    <div class="global-footer-actions">
      <button class="btn btn-danger" @click="resetWeek">
        <RotateCcw class="icon-sm" /> Réinitialiser toute la semaine
      </button>
    </div>

    <!-- Modal: Sauvegarder en modèle -->
    <Teleport to="body">
      <div v-if="isSaveTemplateModalOpen" class="modal-overlay" @click.self="isSaveTemplateModalOpen = false">
        <div class="modal-card card glass">
          <div class="modal-header">
            <h3>Sauvegarder dans la bibliothèque</h3>
            <button @click="isSaveTemplateModalOpen = false" class="action-btn"><X :size="18" /></button>
          </div>
          <div class="modal-body p-4 flex-col gap-3">
            <div class="form-group">
              <label>Nom du modèle *</label>
              <input v-model="newTemplateName" type="text" class="input" placeholder="Ex: Séance Pecs & Bras" />
            </div>
            <div class="form-group">
              <label>Description / Objectif</label>
              <input v-model="newTemplateDesc" type="text" class="input" placeholder="Ex: Focus haut du corps et endurance" />
            </div>
          </div>
          <div class="modal-footer flex-row justify-end gap-2 p-3 border-top">
            <button @click="isSaveTemplateModalOpen = false" class="btn btn-secondary">Annuler</button>
            <button @click="handleSaveNewTemplate" class="btn btn-primary" :disabled="!newTemplateName.trim()">
              <Check :size="16" /> Enregistrer le modèle
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal: Gestionnaire de bibliothèque de séances -->
    <Teleport to="body">
      <div v-if="isTemplateManagerOpen" class="modal-overlay" @click.self="isTemplateManagerOpen = false">
        <div class="modal-card card glass template-manager-modal">
          <div class="modal-header">
            <h3><Folder :size="18" /> Bibliothèque de séances ({{ templatesList.length }})</h3>
            <button @click="isTemplateManagerOpen = false" class="action-btn"><X :size="18" /></button>
          </div>
          <div class="modal-body p-4 flex-col gap-3 overflow-y-auto max-h-70vh">
            <div v-if="templatesList.length === 0" class="text-center py-4 text-muted">
              Aucun modèle enregistré. Vous pouvez en créer un à partir d'une séance.
            </div>
            <div v-for="tmpl in templatesList" :key="tmpl.id" class="template-item-card card glass p-3 flex-row justify-between align-center gap-3">
              <div class="template-info flex-col gap-1 flex-grow-1">
                <div class="flex-row align-center gap-2">
                  <h4 class="font-bold text-sm m-0">{{ tmpl.data.nom }}</h4>
                  <span class="badge text-xs" :class="tmpl.data.type === 'Musculation' ? 'badge-primary' : tmpl.data.type === 'Cardio' ? 'badge-secondary' : tmpl.data.type === 'Hybride' ? 'badge-warning' : 'badge-neutral'">
                    {{ tmpl.data.type }}
                  </span>
                </div>
                <p v-if="tmpl.data.description" class="text-xs text-muted m-0">{{ tmpl.data.description }}</p>
              </div>
              <div class="template-actions flex-row align-center gap-2">
                <button @click="applySpecificTemplate(tmpl)" class="btn btn-primary btn-sm flex-row" title="Appliquer au jour actuel">
                  <Check :size="14" /> Appliquer
                </button>
                <button @click="handleDeleteTemplate(tmpl.id!)" class="action-btn delete" title="Supprimer ce modèle">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
          <div class="modal-footer flex-row justify-end p-3 border-top">
            <button @click="isTemplateManagerOpen = false" class="btn btn-secondary">Fermer</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.planning-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}

.days-selector-bar {
  display: flex;
  gap: 0.35rem;
  overflow-x: auto;
  padding: 0.5rem;
  border-radius: var(--radius-md);

  .day-tab-btn {
    flex: 1;
    min-width: 90px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.6rem 0.5rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: var(--transition);
    text-align: center;

    &:hover {
      color: var(--text-primary);
      background-color: var(--border-hover);
    }

    &.day-tab-active {
      background-color: var(--color-primary);
      color: #ffffff;
      box-shadow: 0 0 10px color-mix(in srgb, var(--color-primary) 30%, transparent);
    }
  }
}

.editor-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  text-align: left;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0;
  }
}

.rest-hint {
  padding: 1.5rem;
  text-align: center;
  color: var(--text-sub);
  background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
}

.sub-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem;
  background-color: color-mix(in srgb, var(--color-white) 2%, transparent);

  .section-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      font-size: 1rem;
      font-weight: 800;
      margin: 0;
    }
  }
}

.exercises-edit-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .exercise-edit-row {
    background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    .row-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .ex-num {
        font-size: 0.75rem;
        font-weight: 800;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: var(--border-color);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .ex-name {
        font-size: 0.9rem;
        font-weight: 700;
        flex: 1;
        margin-left: 0.5rem;
      }

      .row-actions {
        display: flex;
        gap: 0.25rem;
      }
    }
  }
}

.grid-2-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.grid-3-col {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
}

.add-control-box {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;

  select {
    flex: 1;
  }
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;

  .btn-save {
    padding: 0.75rem 1.5rem;
    font-size: 0.95rem;
  }
}

.global-footer-actions {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.btn-sm {
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
}

.icon-xs {
  width: 14px;
  height: 14px;
}

.icon-sm {
  width: 18px;
  height: 18px;
}

.template-selector-box {
  border-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.template-manager-modal {
  width: 600px;
  max-width: 95vw;
}

.template-item-card {
  border-color: var(--color-border);
  transition: var(--transition);

  &:hover {
    border-color: var(--color-border-hover);
  }
}

.max-h-70vh {
  max-height: 70vh;
}
</style>
