<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import type { DayWorkout, Exercise, TimelineStep } from '../types';
import { exercisesMap, formatMMSS } from '../db/queries';
import WakeLock from './WakeLock.vue';
import { Play, Pause, SkipForward, X, Trophy, Target, Dumbbell, Save } from '@lucide/vue';

const props = defineProps<{
  workout: DayWorkout;
  dayName: string;
}>();

const emit = defineEmits<{
  (e: 'finish', durationSeconds: number): void;
  (e: 'cancel'): void;
}>();

const wakeLockRef = ref<InstanceType<typeof WakeLock> | null>(null);
const beep = new Audio('/beep.mp3');

// Unlocks Audio playback on user interaction
function unlockAudio() {
  beep.play().then(() => {
    beep.pause();
    beep.currentTime = 0;
  }).catch(() => {});
}

// Build Timeline
const timeline = ref<TimelineStep[]>([]);
let cumulativeSeconds = 0;

function pushStep(step: TimelineStep) {
  timeline.value.push({
    ...step,
    startSecond: cumulativeSeconds,
    endSecond: cumulativeSeconds + step.duration
  });
  cumulativeSeconds += step.duration;
}

const strength = props.workout.strength;
if (strength) {
  // Warmup
  if (strength.warmup && strength.warmup.workDuration > 0) {
    if (strength.warmup.restDuration > 0) {
      pushStep({ type: 'rest', duration: strength.warmup.restDuration });
    }
    pushStep({
      type: 'work',
      exerciseId: strength.warmup.exerciseId,
      duration: strength.warmup.workDuration
    });
  }

  // Circuit
  for (let set = 1; set <= strength.sets; set++) {
    for (const ex of strength.exercises) {
      if (ex.restDuration > 0) {
        pushStep({ type: 'rest', duration: ex.restDuration });
      }
      pushStep({
        type: 'work',
        exerciseId: ex.exerciseId,
        duration: ex.workDuration,
        index: set,
        total: strength.sets
      });
    }
  }

  // Finisher
  if (strength.finisher) {
    for (const ex of strength.finisher) {
      for (let set = 1; set <= ex.sets; set++) {
        if (ex.restDuration > 0) {
          pushStep({ type: 'rest', duration: ex.restDuration });
        }
        pushStep({
          type: 'work',
          exerciseId: ex.exerciseId,
          duration: ex.workDuration,
          index: set,
          total: ex.sets
        });
      }
    }
  }
}

const totalDuration = computed(() =>
  timeline.value.reduce((sum, step) => sum + (step.duration ?? 0), 0)
);

// Player State
const currentStepIndex = ref(0);
const currentStep = computed(() => timeline.value[currentStepIndex.value] || null);
const isResting = computed(() => currentStep.value?.type === 'rest');

const displayedExercise = computed<Exercise | null>(() => {
  if (!timeline.value.length) return null;
  if (isResting.value) {
    const next = timeline.value[currentStepIndex.value + 1];
    if (next?.exerciseId) return exercisesMap[next.exerciseId] || null;
  }
  const cur = currentStep.value;
  if (cur?.exerciseId) return exercisesMap[cur.exerciseId] || null;
  return null;
});

const totalTime = ref(0);
const localTime = ref(currentStep.value?.duration || 0);

type SessionStatus = 'running' | 'paused' | 'finished';
const sessionStatus = ref<SessionStatus>('running');

let timerInterval: number | null = null;
let globalStartTimestamp = 0;
let globalAccumulatedTime = 0;
const lastBeepedSecond = ref<number | null>(null);

function tick() {
  if (sessionStatus.value !== 'running') return;

  const now = Date.now();
  const elapsedGlobalMs = globalAccumulatedTime + (now - globalStartTimestamp);
  const currentGlobalSec = Math.floor(elapsedGlobalMs / 1000);
  totalTime.value = currentGlobalSec;

  const stepIndex = timeline.value.findIndex(
    step => currentGlobalSec >= (step.startSecond ?? 0) && currentGlobalSec < (step.endSecond ?? 0)
  );

  if (stepIndex !== -1) {
    if (currentStepIndex.value !== stepIndex) {
      currentStepIndex.value = stepIndex;
      if (navigator.vibrate) navigator.vibrate(500);
    }

    const activeStep = timeline.value[stepIndex];
    const remainingSec = (activeStep.endSecond ?? 0) - currentGlobalSec;
    localTime.value = remainingSec;

    // Beep on last 5 seconds
    if (remainingSec <= 5 && remainingSec > 0) {
      if (lastBeepedSecond.value !== remainingSec) {
        lastBeepedSecond.value = remainingSec;
        beep.play().catch(() => {});
      }
    }
  } else if (currentGlobalSec >= totalDuration.value) {
    finishSession();
  }
}

function startTimer() {
  if (!timerInterval) {
    timerInterval = window.setInterval(tick, 100);
  }
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function pauseSession() {
  sessionStatus.value = 'paused';
  clearTimer();
  globalAccumulatedTime += Date.now() - globalStartTimestamp;
}

function resumeSession() {
  sessionStatus.value = 'running';
  unlockAudio();
  globalStartTimestamp = Date.now();
  startTimer();
}

function skipStep() {
  if (sessionStatus.value === 'finished') return;
  const cur = currentStep.value;
  if (!cur) return;
  const targetSec = cur.endSecond ?? 0;
  globalAccumulatedTime = targetSec * 1000;
  globalStartTimestamp = Date.now();
  tick();
}

function finishSession() {
  sessionStatus.value = 'finished';
  clearTimer();
  if (navigator.vibrate) navigator.vibrate(500);
}

function confirmCancel() {
    clearTimer();
    emit('cancel');
  }

function saveAndClose() {
  emit('finish', totalTime.value);
}

// Circular progress calculation
const strokeDasharray = 534;
const strokeDashoffset = computed(() => {
  const duration = currentStep.value?.duration ?? 0;
  if (duration <= 0) return 0;
  const ratio = localTime.value / duration;
  return strokeDasharray * (1 - ratio);
});

onMounted(() => {
  wakeLockRef.value?.requestWakeLock();
  unlockAudio();
  globalStartTimestamp = Date.now();
  globalAccumulatedTime = 0;
  startTimer();
});

onBeforeUnmount(() => {
  clearTimer();
  wakeLockRef.value?.releaseWakeLock();
});
</script>

<template>
  <WakeLock ref="wakeLockRef" />

  <div class="player-container">
    <!-- En cours de séance -->
    <template v-if="sessionStatus !== 'finished'">
      <!-- En-tête du Player -->
      <div class="player-header">
        <button class="btn-icon-cancel" @click="confirmCancel" title="Quitter la séance">
          <X class="icon-sm" />
        </button>
        <div class="session-timer-badge">
          Chrono : {{ formatMMSS(totalTime) }} / {{ formatMMSS(totalDuration) }}
        </div>
        <button class="btn-icon-skip" @click="skipStep" title="Passer l'étape">
          <SkipForward class="icon-sm" />
        </button>
      </div>

      <!-- Tour indicator -->
      <div v-if="currentStep?.total && currentStep.total > 1" class="tour-indicator">
        Tour {{ currentStep.index }} / {{ currentStep.total }}
      </div>

      <!-- Anneau Chronomètre SVG -->
      <div class="timer-ring-container">
        <svg class="timer-ring" width="220" height="220">
          <circle
            class="timer-ring-bg"
            stroke="color-mix(in srgb, var(--color-white) 8%, transparent)"
            stroke-width="12"
            fill="transparent"
            r="85"
            cx="110"
            cy="110"
          />
          <circle
            class="timer-ring-bar"
            :class="isResting ? 'bar-resting' : 'bar-working'"
            stroke-width="12"
            fill="transparent"
            r="85"
            cx="110"
            cy="110"
            :stroke-dasharray="strokeDasharray"
            :stroke-dashoffset="strokeDashoffset"
            stroke-linecap="round"
          />
        </svg>

        <div class="timer-inner-content">
          <div class="timer-seconds">{{ localTime }}</div>
          <span class="timer-phase-badge" :class="isResting ? 'badge-rest' : 'badge-work'">
            {{ isResting ? 'REPOS' : 'EFFORT' }}
          </span>
        </div>
      </div>

      <!-- Contrôle Play/Pause -->
      <div class="controls-row">
        <button 
          v-if="sessionStatus === 'running'" 
          class="btn-pause-action" 
          @click="pauseSession"
        >
          <Pause class="icon-md" /> Pause
        </button>
        <button 
          v-else 
          class="btn-resume-action" 
          @click="resumeSession"
        >
          <Play class="icon-md" /> Reprendre
        </button>
      </div>

      <!-- Détail de l'exercice -->
      <div v-if="displayedExercise" class="card exercise-focus-card">
        <div class="exercise-focus-header">
          <span class="next-label">{{ isResting ? 'PROCHAIN EXERCICE :' : 'EXERCICE EN COURS :' }}</span>
          <h3 class="exercise-title">{{ displayedExercise.name }}</h3>
        </div>

        <p v-if="displayedExercise.notes" class="exercise-notes">
          “{{ displayedExercise.notes }}”
        </p>

        <div class="exercise-meta-chips">
          <span v-if="displayedExercise.primaryMuscle" class="chip chip-muscle flex-row align-center gap-1">
            <Target :size="12" /> {{ displayedExercise.primaryMuscle }}
          </span>
          <span v-for="eq in displayedExercise.equipment" :key="eq" class="chip chip-eq flex-row align-center gap-1">
            <Dumbbell :size="12" /> {{ eq }}
          </span>
        </div>
      </div>
    </template>

    <!-- Écran de Fin de Séance -->
    <template v-else>
      <div class="card finish-summary-card">
        <div class="trophy-wrapper">
          <Trophy class="trophy-icon" />
        </div>
        <h2>Séance terminée !</h2>
        <p class="finish-subtitle">Bravo pour ton effort aujourd'hui !</p>

        <div class="finish-stats-box">
          <div class="stat-row">
            <span class="stat-label">TEMPS TOTAL DE LA SÉANCE</span>
            <span class="stat-val">{{ formatMMSS(totalTime) }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">SÉANCE</span>
            <span class="stat-val">{{ workout.strength?.title || 'Renforcement musculaire' }}</span>
          </div>
        </div>

        <button class="btn btn-primary btn-save-finish flex-row align-center justify-center gap-2" @click="saveAndClose">
          <Save :size="16" /> Enregistrer & Terminer
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.player-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0 0.5rem;

  .btn-icon-cancel, .btn-icon-skip {
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

  .session-timer-badge {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-sub);
    background-color: color-mix(in srgb, var(--color-white) 4%, transparent);
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
  }
}

.tour-indicator {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.timer-ring-container {
  position: relative;
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;

  .timer-ring {
    transform: rotate(-90deg);
    transform-origin: center;
  }

  .timer-ring-bar {
    transition: stroke-dashoffset 0.1s linear;

    &.bar-working {
      stroke: var(--color-primary);
    }

    &.bar-resting {
      stroke: var(--color-success);
    }
  }

  .timer-inner-content {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .timer-seconds {
      font-size: 3.8rem;
      font-weight: 900;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .timer-phase-badge {
      font-size: 0.75rem;
      font-weight: 900;
      letter-spacing: 0.1em;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      margin-top: 0.25rem;

      &.badge-work {
        background-color: color-mix(in srgb, var(--color-primary) 15%, transparent);
        color: var(--color-primary);
        border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
      }

      &.badge-rest {
        background-color: color-mix(in srgb, var(--color-success) 15%, transparent);
        color: var(--color-success);
        border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
      }
    }
  }
}

.controls-row {
  display: flex;
  gap: 1rem;
  width: 100%;
  max-width: 260px;

  .btn-pause-action, .btn-resume-action {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 800;
    padding: 0.75rem 1.5rem;
    border-radius: 2rem;
    border: none;
    cursor: pointer;
    transition: var(--transition);
  }

  .btn-pause-action {
    background-color: color-mix(in srgb, var(--color-warning) 15%, transparent);
    color: var(--color-warning);
    border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);

    &:hover {
      background-color: var(--color-warning);
      color: #000;
    }
  }

  .btn-resume-action {
    background-color: var(--color-primary);
    color: #fff;

    &:hover {
      background-color: var(--color-primary-hover);
    }
  }
}

.exercise-focus-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
  border-color: color-mix(in srgb, var(--color-primary) 20%, transparent);

  .next-label {
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .exercise-title {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0.2rem 0 0 0;
    color: var(--text-primary);
  }

  .exercise-notes {
    font-size: 0.85rem;
    color: var(--text-sub);
    font-style: italic;
    margin: 0;
    line-height: 1.4;
  }

  .exercise-meta-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;

    .chip {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
      background-color: color-mix(in srgb, var(--color-white) 4%, transparent);
      color: var(--text-sub);
    }
  }
}

.finish-summary-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
  padding: 2.5rem 1.5rem;
  text-align: center;

  .trophy-wrapper {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background-color: color-mix(in srgb, var(--color-warning) 15%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;

    .trophy-icon {
      width: 40px;
      height: 40px;
      color: var(--color-warning);
    }
  }

  h2 {
    font-size: 1.6rem;
    font-weight: 900;
    margin: 0;
  }

  .finish-subtitle {
    font-size: 0.95rem;
    color: var(--text-sub);
    margin: -0.5rem 0 0 0;
  }

  .finish-stats-box {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 350px;
    background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 1rem;

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;

      &:not(:last-child) {
        border-bottom: 1px solid color-mix(in srgb, var(--color-white) 4%, transparent);
        padding-bottom: 0.5rem;
      }

      .stat-label {
        font-weight: 700;
        color: var(--text-muted);
        font-size: 0.75rem;
      }

      .stat-val {
        font-weight: 800;
        color: var(--color-primary);
      }
    }
  }

  .btn-save-finish {
    width: 100%;
    max-width: 350px;
    padding: 0.85rem;
    font-size: 1rem;
    font-weight: 800;
    border-radius: 2rem;
  }
}

.icon-sm {
  width: 18px;
  height: 18px;
}

.icon-md {
  width: 20px;
  height: 20px;
}
</style>
