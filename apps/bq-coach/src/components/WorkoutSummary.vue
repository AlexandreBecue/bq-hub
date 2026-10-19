<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DayWorkout, Exercise } from '../types';
import { exercisesMap } from '../db/queries';
import { 
  BicepsFlexed, 
  HeartPulse, 
  Flame, 
  Repeat, 
  Zap, 
  Dumbbell, 
  Timer, 
  Info, 
  Moon 
} from '@lucide/vue';

const props = withDefaults(defineProps<{
  workout: DayWorkout | null;
  dayName: string;
  activeTab?: 'strength' | 'cardio';
}>(), {
  activeTab: 'strength'
});

const emit = defineEmits<{
  (e: 'update:activeTab', tab: 'strength' | 'cardio'): void;
}>();

const currentTab = ref<'strength' | 'cardio'>(props.activeTab);

watch(() => [props.activeTab, props.workout?.type], () => {
  if (props.workout?.type === 'cardio') {
    currentTab.value = 'cardio';
  } else if (props.workout?.type === 'strength') {
    currentTab.value = 'strength';
  } else {
    currentTab.value = props.activeTab || 'strength';
  }
}, { immediate: true });

function selectTab(tab: 'strength' | 'cardio') {
  currentTab.value = tab;
  emit('update:activeTab', tab);
}

const exerciseName = (id: string): string => {
  return exercisesMap[id]?.name || id;
};

const strengthData = computed(() => props.workout?.strength);
const cardioData = computed(() => props.workout?.cardio);

const requiredEquipment = computed(() => {
  if (!props.workout) return [];
  const equipment = new Set<string>();

  const addEquipment = (exerciseId: string) => {
    const ex: Exercise | undefined = exercisesMap[exerciseId];
    ex?.equipment?.forEach(e => equipment.add(e));
  };

  if (strengthData.value?.warmup) {
    addEquipment(strengthData.value.warmup.exerciseId);
  }

  strengthData.value?.exercises?.forEach((ex) => {
    addEquipment(ex.exerciseId);
  });

  strengthData.value?.finisher?.forEach((ex) => {
    addEquipment(ex.exerciseId);
  });

  if (cardioData.value?.exerciseId) {
    addEquipment(cardioData.value.exerciseId);
  }

  return Array.from(equipment);
});
</script>

<template>
  <!-- Cas Jour de repos -->
  <div v-if="!workout || workout.type === 'rest'" class="card summary-card rest-card text-center py-5">
    <div class="rest-icon-wrapper mb-3">
      <Moon :size="32" class="text-muted" />
    </div>
    <h3 class="font-bold text-lg mb-1">Journée de repos</h3>
    <p class="rest-desc text-sub text-sm m-0">
      Récupération pour permettre au corps de se régénérer et d'assimiler les séances de la semaine.
    </p>
  </div>

  <!-- Cas Séance active (Musculation, Cardio ou Hybride) -->
  <div v-else class="card summary-card">
    <!-- Onglets permanents selon le type de séance -->
    <div class="tabs-header">
      <button 
        v-if="workout.type === 'strength' || workout.type === 'hybrid'"
        type="button"
        class="tab-btn flex-row justify-center align-center gap-2" 
        :class="{ 'tab-active': currentTab === 'strength' }" 
        @click="selectTab('strength')"
      >
        <BicepsFlexed :size="16" /> Renfo
      </button>
      <button 
        v-if="workout.type === 'cardio' || workout.type === 'hybrid'"
        type="button"
        class="tab-btn flex-row justify-center align-center gap-2" 
        :class="{ 'tab-active': currentTab === 'cardio' }" 
        @click="selectTab('cardio')"
      >
        <HeartPulse :size="16" /> Cardio
      </button>
    </div>

    <!-- En-tête : Titre et badge sport à côté -->
    <div class="objective-header flex-row align-center justify-between flex-wrap gap-2">
      <div class="flex-row align-center gap-2 flex-wrap">
        <h2 class="objective-title m-0">
          {{ currentTab === 'cardio' ? cardioData?.title : strengthData?.title }}
        </h2>
        <span v-if="currentTab === 'cardio' && cardioData" class="badge badge-secondary text-xs">
          {{ cardioData.exerciseId === 'cycling' ? 'Cyclisme' : 'Course à pied' }}
        </span>
      </div>
    </div>

    <!-- Contenu Renfo -->
    <template v-if="currentTab === 'strength' && strengthData">
      <!-- Matériel requis -->
      <div v-if="requiredEquipment.length" class="equipment-section">
        <span class="section-label flex-row align-center gap-1">
          <Dumbbell :size="14" /> Matériel Requis
        </span>
        <div class="equipment-chips">
          <span v-for="eq in requiredEquipment" :key="eq" class="chip">
            {{ eq }}
          </span>
        </div>
      </div>

      <!-- Échauffement -->
      <div v-if="strengthData.warmup" class="block-card">
        <div class="block-header flex-row justify-between align-center">
          <span class="block-title flex-row align-center gap-1">
            <Flame :size="15" /> Échauffement
          </span>
          <span class="badge badge-warning">{{ strengthData.warmup.workDuration }}s</span>
        </div>
        <div class="exercise-name">{{ exerciseName(strengthData.warmup.exerciseId) }}</div>
      </div>

      <!-- Circuit principal -->
      <div v-if="strengthData.exercises && strengthData.exercises.length" class="block-card">
        <div class="block-header flex-row justify-between align-center">
          <span class="block-title flex-row align-center gap-1">
            <Repeat :size="15" /> Circuit principal
          </span>
          <span class="badge badge-primary">{{ strengthData.sets }} tours</span>
        </div>
        <div class="exercise-list">
          <div v-for="(ex, index) in strengthData.exercises" :key="ex.exerciseId + index" class="exercise-row">
            <div class="exercise-info">
              <span class="exercise-index">{{ index + 1 }}</span>
              <span class="exercise-name">{{ exerciseName(ex.exerciseId) }}</span>
            </div>
            <span class="badge badge-primary">{{ ex.workDuration }}s</span>
          </div>
        </div>
      </div>

      <!-- Finisseur -->
      <div v-if="strengthData.finisher && strengthData.finisher.length" class="block-card block-finisher">
        <div class="block-header flex-row justify-between align-center">
          <span class="block-title flex-row align-center gap-1">
            <Zap :size="15" /> Finisseur
          </span>
        </div>
        <div class="exercise-list">
          <div v-for="(ex, index) in strengthData.finisher" :key="ex.exerciseId + index" class="exercise-row">
            <span class="exercise-name">{{ exerciseName(ex.exerciseId) }}</span>
            <span class="badge badge-danger">{{ ex.sets }} × {{ ex.workDuration }}s</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Contenu Cardio -->
    <template v-else-if="currentTab === 'cardio' && cardioData">
      <div class="cardio-stats-row">
        <div class="cardio-stat-item">
          <span class="stat-label flex-row align-center gap-1">
            <Timer :size="13" /> Durée prévue
          </span>
          <span class="stat-value">{{ cardioData.durationMinutes }} min</span>
        </div>
        <div v-if="cardioData.interval" class="cardio-stat-item">
          <span class="stat-label flex-row align-center gap-1">
            <Timer :size="13" /> Rythme suggéré
          </span>
          <span class="stat-value">Toutes les {{ Math.round(cardioData.interval / 60) }} min</span>
        </div>
      </div>

      <!-- Échauffement Cardio si configuré -->
      <div v-if="cardioData.warmup" class="block-card">
        <div class="block-header flex-row justify-between align-center">
          <span class="block-title flex-row align-center gap-1">
            <Flame :size="15" /> Échauffement Cardio
          </span>
          <span class="badge badge-warning">{{ cardioData.warmup.workDuration }}s</span>
        </div>
        <div class="exercise-name">{{ cardioData.exerciseId === 'cycling' ? 'Vélo allure progressive' : 'Trot progressif & éducatifs' }}</div>
      </div>

      <!-- Fractionné / Intervalles si configuré -->
      <div v-if="cardioData.exercises && cardioData.exercises.length" class="block-card">
        <div class="block-header flex-row justify-between align-center">
          <span class="block-title flex-row align-center gap-1">
            <Repeat :size="15" /> Fractionné / Intervalles
          </span>
          <span class="badge badge-primary">{{ cardioData.sets || 1 }} tours</span>
        </div>
        <div class="exercise-list">
          <div v-for="(ex, index) in cardioData.exercises" :key="ex.exerciseId + index" class="exercise-row">
            <div class="exercise-info">
              <span class="exercise-index">{{ index + 1 }}</span>
              <span class="exercise-name">{{ ex.exerciseId === 'cycling' ? 'Vélo effort vif' : 'Course allure rapide / VMA' }}</span>
            </div>
            <span class="badge badge-primary">{{ ex.workDuration }}s <template v-if="ex.restDuration">| ⏱ {{ ex.restDuration }}s</template></span>
          </div>
        </div>
      </div>

      <!-- Finisseur / Retour au calme si configuré -->
      <div v-if="cardioData.finisher && cardioData.finisher.length" class="block-card block-finisher">
        <div class="block-header flex-row justify-between align-center">
          <span class="block-title flex-row align-center gap-1">
            <Zap :size="15" /> Retour au calme
          </span>
        </div>
        <div class="exercise-list">
          <div v-for="(ex, index) in cardioData.finisher" :key="ex.exerciseId + index" class="exercise-row">
            <span class="exercise-name">{{ ex.exerciseId === 'cycling' ? 'Vélo moulinage récupération' : 'Trot très lent / marche' }}</span>
            <span class="badge badge-danger">{{ ex.workDuration }}s</span>
          </div>
        </div>
      </div>

      <div v-if="cardioData.notes" class="block-card mt-3">
        <div class="block-header">
          <span class="block-title flex-row align-center gap-1">
            <Info :size="15" /> Conseils & Allure
          </span>
        </div>
        <p class="notes-content">{{ cardioData.notes }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.summary-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  text-align: left;
}

.rest-card {
  text-align: center;
  align-items: center;
  padding: 3rem 1.5rem;

  .rest-icon-wrapper {
    background-color: color-mix(in srgb, var(--color-white) 4%, transparent);
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
    border: 1px solid var(--border-color);
  }

  h3 {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0;
  }

  .rest-desc {
    font-size: 0.9rem;
    color: var(--text-sub);
    line-height: 1.5;
    max-width: 400px;
    margin-top: 0.5rem;
  }
}

.objective-header {
  .objective-title {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0;
    color: var(--text-primary);
    line-height: 1.3;
  }
}

.tabs-header {
  display: flex;
  gap: 0.5rem;
  background-color: color-mix(in srgb, var(--color-white) 3%, transparent);
  border: 1px solid var(--border-color);
  border-radius: 2rem;
  padding: 0.25rem;
  width: 100%;

  .tab-btn {
    flex: 1;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.5rem 1rem;
    border-radius: 1.8rem;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: var(--transition);

    &:hover {
      color: var(--text-primary);
    }

    &.tab-active {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
    }
  }
}

.equipment-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  .section-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .equipment-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;

    .chip {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.55rem;
      border-radius: var(--radius-sm);
      background-color: color-mix(in srgb, var(--color-white) 4%, transparent);
      border: 1px solid var(--border-color);
      color: var(--text-sub);
    }
  }
}

.block-card {
  background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .block-title {
      font-size: 0.85rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }

  .exercise-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
  }
}

.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  .exercise-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
    border: 1px solid var(--border-color);
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);

    .exercise-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .exercise-index {
        font-size: 0.8rem;
        font-weight: 800;
        color: var(--text-muted);
        width: 1.2rem;
      }

      .exercise-name {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text-primary);
      }
    }
  }
}

.cardio-stats-row {
  display: flex;
  gap: 1rem;

  .cardio-stat-item {
    flex: 1;
    background-color: color-mix(in srgb, var(--color-white) 3%, transparent);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;

    .stat-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-value {
      font-size: 1.15rem;
      font-weight: 900;
      color: var(--color-secondary);
    }
  }
}

.notes-content {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-sub);
  white-space: pre-line;
  margin: 0;
}
</style>
