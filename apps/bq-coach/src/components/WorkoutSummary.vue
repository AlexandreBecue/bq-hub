<script setup lang="ts">
  import { computed, ref, watch } from "vue";

  const props = withDefaults(defineProps<{
    session: any
    exerciseMap: Record<string, { name: string; equipment?: string[] }>
    allowLaunchCardio?: boolean
    activeTab?: 'strength' | 'cardio'
  }>(), {
    allowLaunchCardio: false,
    activeTab: 'strength'
  })

  const emit = defineEmits<{
    (e: 'launch-cardio'): void
    (e: 'update:activeTab', tab: 'strength' | 'cardio'): void
  }>()

  const currentTab = ref<'strength' | 'cardio'>(props.activeTab)

  watch(() => props.activeTab, (newTab) => {
    currentTab.value = newTab
  }, { immediate: true })

  function selectTab(tab: 'strength' | 'cardio') {
    currentTab.value = tab
    emit('update:activeTab', tab)
  }

  const exerciseName = (id: string) => props.exerciseMap[id]?.name ?? id

  const strengthData = computed(() => props.session?.strength)

  const cardioExercise = computed(() => {
    const id = props.session?.cardio?.exerciseId
    return id ? props.exerciseMap[id] : null
  })

  const requiredEquipment = computed(() => {
    if (!props.session) return []
    const equipment = new Set<string>()

    const addEquipment = (exerciseId: string) => {
      const ex = props.exerciseMap[exerciseId]
      ex?.equipment?.forEach(e => equipment.add(e))
    }

    if (strengthData.value?.warmup) {
      addEquipment(strengthData.value.warmup.exerciseId)
    }

    strengthData.value?.exercises?.forEach((ex: any) => {
      addEquipment(ex.exerciseId)
    })

    strengthData.value?.finisher?.forEach((ex: any) => {
      addEquipment(ex.exerciseId)
    })

    if (props.session?.cardio?.exerciseId) {
      addEquipment(props.session.cardio.exerciseId)
    }

    return Array.from(equipment)
  })

  // Dynamic progressive duration helper for Saturday's Long Run
  const getDynamicLongRunDuration = () => {
    const baseDate = new Date('2026-06-22') // Resume training date: Monday June 22, 2026
    const today = new Date()
    const diffMs = today.getTime() - baseDate.getTime()
    const diffWeeks = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)))
    
    // Starts at 50 mins, adds 5 mins per week, caps at 150 mins (2h30)
    return Math.min(150, 50 + diffWeeks * 5)
  };

  const currentDuration = computed(() => {
    if (!props.session?.cardio) return 0
    if (props.session.cardio.title.includes('Sortie Longue') || props.session.cardio.title.includes('Séance longue')) {
      return getDynamicLongRunDuration()
    }
    return props.session.cardio.durationMinutes
  })
</script>

<template>
  <!-- Pure Cardio Workout Summary -->
  <div v-if="session && session.type === 'cardio'" class="summary-card running-summary-card">
    <div class="objective-header bg-running">
      <span class="objective-badge badge-running">
        {{ session?.cardio?.exerciseId === 'cycling' ? '🚲' : '🏃' }} {{ cardioExercise?.name?.toUpperCase() || 'CARDIO' }}
      </span>
      <h1 class="objective-title">{{ session.cardio.title }}</h1>
    </div>

    <!-- Objectifs section -->
    <div class="summary-section block-card">
      <div class="block-header">
        <h2 class="block-title">📊 Objectif de la séance</h2>
      </div>
      <div class="running-stats-grid">
        <div class="running-stat-item">
          <span class="stat-label">⏱️ Durée</span>
          <span class="stat-value">{{ currentDuration }} min</span>
        </div>
        <div v-if="session.cardio && session.cardio.interval" class="running-stat-item">
          <span class="stat-label">⏱️ Vibration</span>
          <span class="stat-value">Toutes les {{ session.cardio.interval / 60 }} min</span>
        </div>
      </div>
    </div>

    <!-- Notes/Conseils section -->
    <div v-if="session.cardio && session.cardio.notes" class="summary-section block-card">
      <div class="block-header">
        <h2 class="block-title">💡 Conseils de séance</h2>
      </div>
      <div class="block-content">
        <p class="running-notes">{{ session.cardio.notes }}</p>
      </div>
    </div>
  </div>

  <!-- Standard Strength / Hybrid Workout Summary -->
  <div v-else-if="session && session.type !== 'rest'" class="summary-card">
    <!-- Tabs Header for Hybrid Workouts -->
    <div v-if="session.type === 'hybrid'" class="tabs-header">
      <button 
        type="button"
        class="tab-btn" 
        :class="{ 'tab-active': currentTab === 'strength' }" 
        @click="selectTab('strength')"
      >
        💪 Renforcement
      </button>
      <button 
        type="button"
        class="tab-btn" 
        :class="{ 'tab-active': currentTab === 'cardio' }" 
        @click="selectTab('cardio')"
      >
        🏃‍♂️ Cardio
      </button>
    </div>

    <div class="objective-header">
      <span class="objective-badge">🎯 OBJECTIF DU JOUR</span>
      <h1 class="objective-title">
        {{ currentTab === 'cardio' ? session.cardio?.title : strengthData?.title }}
      </h1>
    </div>

    <!-- Matériel section -->
    <div v-if="currentTab === 'strength' && requiredEquipment.length" class="summary-section equipment-section">
      <h2 class="section-title">🛠️ Matériel Requis</h2>
      <div class="equipment-chips">
        <span v-for="eq in requiredEquipment" :key="eq" class="chip equipment-chip">
          {{ eq }}
        </span>
      </div>
    </div>

    <template v-if="currentTab === 'strength'">
      <!-- Échauffement section -->
      <div v-if="strengthData?.warmup" class="summary-section block-card">
        <div class="block-header">
          <h2 class="block-title">🔥 Échauffement</h2>
          <span class="time-pill pill-warmup">{{ strengthData.warmup.workDuration }}s</span>
        </div>
        <div class="block-content">
          <p class="exercise-name">{{ exerciseName(strengthData.warmup.exerciseId) }}</p>
        </div>
      </div>

      <!-- Circuit section -->
      <div v-if="strengthData" class="summary-section block-card">
        <div class="block-header">
          <h2 class="block-title">🔁 Circuit principal</h2>
          <span class="sets-badge">{{ strengthData.sets }} tours</span>
        </div>
        <div class="block-content exercise-list">
          <div v-for="(ex, index) in strengthData.exercises" :key="ex.exerciseId" class="exercise-row">
            <div class="exercise-info">
              <span class="exercise-index">{{ Number(index) + 1 }}</span>
              <p class="exercise-name">{{ exerciseName(ex.exerciseId) }}</p>
            </div>
            <span class="time-pill pill-work">{{ ex.workDuration }}s</span>
          </div>
        </div>
      </div>

      <!-- Finisher section -->
      <div v-if="strengthData?.finisher" class="summary-section block-card block-finisher">
        <div class="block-header">
          <h2 class="block-title">💀 Finisher</h2>
        </div>
        <div class="block-content exercise-list">
          <div v-for="ex in strengthData.finisher" :key="ex.exerciseId" class="exercise-row">
            <p class="exercise-name">{{ exerciseName(ex.exerciseId) }}</p>
            <span class="time-pill pill-finisher">{{ ex.sets }} × {{ ex.workDuration }}s</span>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="currentTab === 'cardio' && session.cardio">
      <!-- Cardio section for hybrid workouts -->
      <div class="summary-section block-card block-hybrid-running">
        <div class="block-header">
          <h2 class="block-title">
            {{ session?.cardio?.exerciseId === 'cycling' ? '🚲' : '🏃‍♂️' }} {{ cardioExercise?.name || 'Cardio' }}
          </h2>
          <span class="time-pill pill-work" style="background: rgba(234, 67, 53, 0.15); color: #ea4335; border: 1px solid rgba(234, 67, 53, 0.2);">{{ currentDuration }} min</span>
        </div>
        <div class="block-content">
          <h3 class="hybrid-running-title" style="margin-top: 0;">{{ session.cardio.title }}</h3>
          <p class="running-notes" style="margin-bottom: 0.5rem;">{{ session.cardio.notes }}</p>
          <button v-if="allowLaunchCardio" class="btn-launch-cardio" @click="$emit('launch-cardio')">
            Lancer cette séance
          </button>
        </div>
      </div>
    </template>
  </div>

  <!-- Rest Day Summary -->
  <div v-else-if="session" class="summary-card rest-summary-card">
    <div class="objective-header bg-rest">
      <span class="objective-badge badge-rest">💤 REPOS</span>
      <h1 class="objective-title">{{ 'Repos complet' }}</h1>
    </div>
    <div class="summary-section block-card">
      <div class="block-content">
        <p class="running-notes">Journée de récupération bien méritée pour permettre à votre corps de se régénérer et d'assimiler les séances de la semaine. Profitez-en pour vous détendre en famille !</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
  * {
    box-sizing: border-box;
  }

  .summary-card {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    width: 100%;
    max-width: 400px;
    box-sizing: border-box;
    text-align: left;
    margin: 0 auto;
    padding-bottom: 1rem;
  }

  .running-summary-card {
    border: 1px solid rgba(234, 67, 53, 0.15);
    background: rgba(234, 67, 53, 0.02);
    border-radius: 1.5rem;
    padding: 1.2rem;
  }

  .rest-summary-card {
    border: 1px solid rgba(76, 175, 80, 0.15);
    background: rgba(76, 175, 80, 0.02);
    border-radius: 1.5rem;
    padding: 1.2rem;
  }

  .bg-running {
    background: rgba(234, 67, 53, 0.08) !important;
    border: 1px solid rgba(234, 67, 53, 0.2) !important;
  }

  .bg-rest {
    background: rgba(76, 175, 80, 0.08) !important;
    border: 1px solid rgba(76, 175, 80, 0.2) !important;
  }

  .badge-running {
    background: #ea4335 !important;
    color: white !important;
  }

  .badge-rest {
    background: #4caf50 !important;
    color: white !important;
  }

  .running-stats-grid {
    display: flex;
    gap: 1rem;
    width: 100%;
    margin-top: 0.5rem;
  }

  .running-stat-item {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.8rem;
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }

  .running-stat-item .stat-label {
    font-size: 0.8rem;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .running-stat-item .stat-value {
    font-size: 1.15rem;
    font-weight: bold;
    color: #ea4335;
  }

  .running-notes {
    font-size: 0.95rem;
    line-height: 1.4rem;
    opacity: 0.9;
    white-space: pre-line;
    margin: 0;
  }

  /* Tabs Styling */
  .tabs-header {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 2rem;
    padding: 0.25rem;
    box-sizing: border-box;
    margin-bottom: 0.5rem;
  }

  .tab-btn {
    flex: 1;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.5rem 1rem;
    border-radius: 1.8rem;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.4rem;
  }

  .tab-btn:hover {
    color: #ffffff;
  }

  .tab-active {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .objective-header {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    box-sizing: border-box;
  }

  .objective-badge {
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    background: #3f51b5;
    color: #ffffff;
    align-self: flex-start;
    padding: 0.2rem 0.5rem;
    border-radius: 0.3rem;
  }

  .objective-title {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0;
    line-height: 1.35;
    color: #ffffff;
  }

  .summary-section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 100%;
    box-sizing: border-box;
  }

  .section-title {
    font-size: 0.85rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    opacity: 0.6;
    margin: 0;
    text-transform: uppercase;
  }

  .equipment-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    width: 100%;
  }

  .chip {
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.3rem 0.6rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .block-card {
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 1rem;
    padding: 1rem;
    width: 100%;
    box-sizing: border-box;
  }

  .block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding-bottom: 0.4rem;
    box-sizing: border-box;
  }

  .block-title {
    font-size: 0.95rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .time-pill {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 0.3rem;
  }

  .pill-warmup {
    background: rgba(255, 152, 0, 0.15);
    color: #ff9800;
  }

  .pill-work {
    background: rgba(244, 67, 54, 0.15);
    color: #f44336;
  }

  .pill-finisher {
    background: rgba(156, 39, 176, 0.15);
    color: #9c27b0;
  }

  .sets-badge {
    font-size: 0.75rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.05);
    padding: 0.15rem 0.4rem;
    border-radius: 0.3rem;
    color: #ffffff;
  }

  .exercise-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 100%;
    box-sizing: border-box;
  }

  .exercise-name {
    font-size: 0.95rem;
    font-weight: 500;
    margin: 0;
    color: rgba(255, 255, 255, 0.9);
  }

  .exercise-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
    padding-bottom: 0.3rem;
    width: 100%;
    box-sizing: border-box;
  }

  .exercise-row:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    padding-bottom: 0.6rem;
  }

  .exercise-info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    flex: 1;
  }

  .exercise-index {
    font-size: 0.75rem;
    font-weight: 700;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .block-finisher {
    border: 1px solid rgba(156, 39, 176, 0.15);
  }

  .block-hybrid-running {
    border: 1px solid rgba(234, 67, 53, 0.15);
  }

  .hybrid-running-title {
    margin: 0 0 0.4rem 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: #ffffff;
  }

  .btn-launch-cardio {
    width: 100%;
    font-size: 0.9rem;
    font-weight: 700;
    padding: 0.5rem 1rem;
    border-radius: 1.5rem;
    border: 1px solid rgba(234, 67, 53, 0.3);
    background: rgba(234, 67, 53, 0.15);
    color: #ea4335;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 0.8rem;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .btn-launch-cardio:hover {
    background: #ea4335;
    color: white;
  }

  /* Support for light color scheme if enabled */
  @media (prefers-color-scheme: light) {
    .tabs-header {
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    .tab-btn {
      color: rgba(0, 0, 0, 0.6);
    }
    .tab-btn:hover {
      color: #111111;
    }
    .tab-active {
      background: rgba(0, 0, 0, 0.05);
      color: #111111;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
    }
    .objective-header {
      background: rgba(0, 0, 0, 0.015);
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    .objective-title {
      color: #111111;
    }
    .block-card {
      background: rgba(0, 0, 0, 0.015);
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    .block-title {
      color: #222222;
    }
    .exercise-name {
      color: #333333;
    }
    .exercise-index {
      background: rgba(0, 0, 0, 0.04);
      color: rgba(0, 0, 0, 0.45);
    }
    .sets-badge {
      background: rgba(0, 0, 0, 0.04);
      color: #222222;
    }
    .hybrid-running-title {
      color: #111111;
    }
    .running-stat-item {
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    .running-summary-card {
      border: 1px solid rgba(234, 67, 53, 0.15);
      background: rgba(234, 67, 53, 0.01);
    }
    .bg-running {
      background: rgba(234, 67, 53, 0.04) !important;
      border: 1px solid rgba(234, 67, 53, 0.1) !important;
    }
    .rest-summary-card {
      border: 1px solid rgba(76, 175, 80, 0.15);
      background: rgba(76, 175, 80, 0.01);
    }
    .bg-rest {
      background: rgba(76, 175, 80, 0.04) !important;
      border: 1px solid rgba(76, 175, 80, 0.1) !important;
    }
  }
</style>
