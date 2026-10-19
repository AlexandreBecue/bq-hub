<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { DayWorkout } from '../types';
import { 
  getWeeklyProgramme, 
  DAYS_NAMES, 
  logCompletedStrengthWorkout, 
  logCompletedCardio,
  generateCardioDetail,
  estimateCardioDistance,
  getCardioSports
} from '../db/queries';
import WorkoutSummary from './WorkoutSummary.vue';
import WorkoutPlayer from './WorkoutPlayer.vue';
import { useToast } from '@bq/theme/useToast';
import { Play, CheckCircle2, ChevronLeft, ChevronRight, HeartPulse, Save } from '@lucide/vue';

const toast = useToast();

const emit = defineEmits(['data-updated']);

// 0 = Dimanche, 1 = Lundi, etc.
const todayIndex = new Date().getDay();
const selectedDayId = ref<number>(todayIndex);

const weeklyProgramme = ref<Record<number, DayWorkout>>({});
const isLoading = ref(true);

// State for active player
const isPlayerActive = ref(false);

// State for manual cardio completion modal
const isCardioModalOpen = ref(false);
const cardioSports = ref<any[]>([]);
const manualCardioDistance = ref<number>(5.0);
const manualCardioMinutes = ref<number>(30);
const manualCardioSport = ref<string>('Course à pied');
const manualCardioComment = ref<string>('');

async function loadProgramme() {
  isLoading.value = true;
  try {
    weeklyProgramme.value = await getWeeklyProgramme();
    cardioSports.value = await getCardioSports();
  } catch (err) {
    console.error('Erreur chargement programme:', err);
  } finally {
    isLoading.value = false;
  }
}

const currentWorkout = computed<DayWorkout | null>(() => {
  return weeklyProgramme.value[selectedDayId.value] || null;
});

const selectedDayName = computed(() => {
  return DAYS_NAMES[selectedDayId.value];
});

const isToday = computed(() => {
  return selectedDayId.value === todayIndex;
});

function prevDay() {
  selectedDayId.value = (selectedDayId.value + 6) % 7;
}

function nextDay() {
  selectedDayId.value = (selectedDayId.value + 1) % 7;
}

function startStrengthSession() {
  if (!currentWorkout.value?.strength) return;
  isPlayerActive.value = true;
}

async function onPlayerFinish(durationSeconds: number) {
  isPlayerActive.value = false;
  try {
    const title = currentWorkout.value?.strength?.title || `Séance du ${selectedDayName.value}`;
    await logCompletedStrengthWorkout(title, durationSeconds, currentWorkout.value || undefined);
    toast.success('Séance de renforcement enregistrée avec succès !');
    emit('data-updated');
  } catch (err) {
    console.error('Erreur enregistrement séance:', err);
    toast.error("Erreur lors de l'enregistrement de la séance.");
  }
}

function onPlayerCancel() {
  isPlayerActive.value = false;
}

function openCardioModal() {
  const cardio = currentWorkout.value?.cardio;
  manualCardioSport.value = cardio?.exerciseId === 'cycling' ? 'Cyclisme' : 'Course à pied';
  manualCardioMinutes.value = cardio?.durationMinutes || 30;
  manualCardioDistance.value = estimateCardioDistance(cardio);
  manualCardioComment.value = generateCardioDetail(cardio);
  isCardioModalOpen.value = true;
}

async function saveManualCardio() {
  try {
    await logCompletedCardio(
      manualCardioSport.value,
      manualCardioDistance.value,
      manualCardioMinutes.value,
      manualCardioComment.value
    );
    isCardioModalOpen.value = false;
    toast.success('Séance cardio enregistrée avec succès !');
    emit('data-updated');
  } catch (err) {
    console.error('Erreur enregistrement cardio:', err);
    toast.error("Erreur lors de l'enregistrement du cardio.");
  }
}

onMounted(() => {
  loadProgramme();
});
</script>

<template>
  <div class="session-view">
    <!-- Vue Active Player -->
    <template v-if="isPlayerActive && currentWorkout">
      <WorkoutPlayer 
        :workout="currentWorkout" 
        :day-name="selectedDayName"
        @finish="onPlayerFinish"
        @cancel="onPlayerCancel"
      />
    </template>

    <!-- Vue Normale : Choix du Jour & Résumé de la Séance -->
    <template v-else>
      <!-- Sélecteur de jour de la semaine -->
      <div class="day-selector-card glass">
        <button class="nav-day-btn" @click="prevDay" title="Jour précédent">
          <ChevronLeft class="icon-md" />
        </button>

        <div class="day-center-info">
          <span v-if="isToday" class="today-tag">Aujourd'hui</span>
          <h2 class="day-name">{{ selectedDayName }}</h2>
          <span class="day-type-subtitle">
            {{ currentWorkout?.type === 'rest' ? 'Repos' : currentWorkout?.type === 'strength' ? 'Renfo' : currentWorkout?.type === 'cardio' ? 'Cardio' : 'Hybride' }}
          </span>
        </div>

        <button class="nav-day-btn" @click="nextDay" title="Jour suivant">
          <ChevronRight class="icon-md" />
        </button>
      </div>

      <!-- Sélecteur rapide (Lundi à Dimanche) -->
      <div class="quick-days-selector">
        <button 
          v-for="d in [1, 2, 3, 4, 5, 6, 0]" 
          :key="d"
          class="day-btn" 
          :class="{ 'active': selectedDayId === d, 'today': todayIndex === d }"
          @click="selectedDayId = d"
        >
          {{ DAYS_NAMES[d].substring(0, 3) }}
        </button>
      </div>

      <!-- Résumé du Workout -->
      <div v-if="!isLoading" class="summary-wrapper">
        <WorkoutSummary 
          :workout="currentWorkout" 
          :day-name="selectedDayName" 
        />

        <!-- Boutons d'Action selon le type de séance -->
        <div class="action-footer">
          <!-- Si renforcement présent : bouton pour lancer le chronomètre -->
          <button 
            v-if="currentWorkout && (currentWorkout.type === 'strength' || currentWorkout.type === 'hybrid')" 
            class="btn btn-primary btn-start-session"
            @click="startStrengthSession"
          >
            <Play class="icon-sm" /> Démarrer la séance ({{ selectedDayName }})
          </button>

          <!-- Si cardio présent : bouton pour archiver la sortie sans chrono -->
          <button 
            v-if="currentWorkout && (currentWorkout.type === 'cardio' || currentWorkout.type === 'hybrid')" 
            class="btn btn-secondary btn-log-cardio"
            @click="openCardioModal"
          >
            <CheckCircle2 class="icon-sm" /> Enregistrer la sortie cardio
          </button>
        </div>
      </div>
    </template>

    <!-- Modale d'enregistrement manuel du Cardio -->
    <div v-if="isCardioModalOpen" class="modal-overlay" @click.self="isCardioModalOpen = false">
      <div class="modal-container">
        <div class="modal-header">
          <h3 class="flex-row align-center gap-2"><HeartPulse :size="18" class="text-secondary" /> Enregistrer la sortie cardio</h3>
          <button class="modal-close" @click="isCardioModalOpen = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Sport</label>
            <select v-model="manualCardioSport" class="select">
              <option v-for="s in (cardioSports.length ? cardioSports : [{ id: '1', data: { nom: 'Course à pied' } }, { id: '2', data: { nom: 'Cyclisme' } }, { id: '3', data: { nom: 'Natation' } }])" :key="s.id" :value="s.data.nom">
                {{ s.data.nom }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Distance (km)</label>
            <input type="number" step="0.1" v-model.number="manualCardioDistance" class="input" />
          </div>
          <div class="form-group">
            <label>Durée réelle (minutes)</label>
            <input type="number" v-model.number="manualCardioMinutes" class="input" />
          </div>
          <div class="form-group">
            <label>Commentaire</label>
            <input type="text" v-model="manualCardioComment" class="input" placeholder="Ex: Sortie en endurance..." />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="isCardioModalOpen = false">Annuler</button>
          <button class="btn btn-primary flex-row align-center gap-1" @click="saveManualCardio"><Save :size="16" /> Enregistrer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.session-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
}

.day-selector-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);

  .nav-day-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    transition: var(--transition);

    &:hover {
      color: var(--text-primary);
      background-color: var(--border-hover);
    }
  }

  .day-center-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;

    .day-name {
      font-size: 1.35rem;
      font-weight: 900;
      margin: 0;
      color: var(--text-primary);
      text-align: center;
      line-height: 1.2;
    }

    .today-tag {
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background-color: color-mix(in srgb, var(--color-primary) 15%, transparent);
      color: var(--color-primary);
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
      margin-bottom: 0.15rem;
    }

    .day-type-subtitle {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }
}

.quick-days-selector {
  display: flex;
  justify-content: space-between;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;

  .day-btn {
    flex: 1;
    background-color: color-mix(in srgb, var(--color-white) 3%, transparent);
    border: 1px solid var(--border-color);
    color: var(--text-sub);
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.5rem 0.2rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: var(--transition);
    text-align: center;
    text-transform: capitalize;

    &:hover {
      background-color: color-mix(in srgb, var(--color-white) 6%, transparent);
      color: var(--text-primary);
    }

    &.active {
      background-color: var(--color-primary);
      color: var(--color-primary-contrast);
      border-color: var(--color-primary);
      box-shadow: 0 0 10px color-mix(in srgb, var(--color-primary) 30%, transparent);
    }

    &.today:not(.active) {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
  }
}

.summary-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.action-footer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;

  .btn-start-session, .btn-log-cardio {
    width: 100%;
    padding: 0.85rem;
    font-size: 1rem;
    font-weight: 800;
    border-radius: var(--radius-md);
  }
}

.icon-sm {
  width: 18px;
  height: 18px;
}

.icon-md {
  width: 22px;
  height: 22px;
}
</style>
