<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import WakeLock from "../components/WakeLock.vue";
  import { pushCompletedWorkout, isAuthenticated, getAuthUrl, markWorkoutAsCompletedToday } from '../utils/gdrive'

  const router = useRouter()
  const route = useRoute()
  const wakeLockRef = ref<InstanceType<typeof WakeLock> | null>(null)

  const intervalSeconds = ref<number | null>(30)
  const running = ref(false)
  const isFinished = ref(false)
  const elapsed = ref(0)
  let timer: number | null = null
  let startTimestamp = 0
  let lastVibrateSeconds = 0

  const isSaving = ref(false)
  const saveSuccess = ref(false)
  const saveError = ref('')
  const distanceKm = ref<number | null>(null)
  const targetDurationMinutes = ref<number | null>(null)
  const runningTitle = ref<string>('Séance libre')
  const exerciseId = ref<string>('')

  onMounted(() => {
    if (route.query.interval) {
      intervalSeconds.value = Number(route.query.interval)
    } else {
      intervalSeconds.value = null // No default vibration if not specified in query
    }
    if (route.query.distance) {
      distanceKm.value = Number(route.query.distance)
    }
    if (route.query.duration) {
      targetDurationMinutes.value = Number(route.query.duration)
    }
    if (route.query.title) {
      runningTitle.value = String(route.query.title)
    }
    if (route.query.exerciseId) {
      exerciseId.value = String(route.query.exerciseId)
    }
    if (route.query.autoStart === 'true') {
      startSession()
    }
  })

  function startSession() {
    wakeLockRef.value?.requestWakeLock()
    if (running.value) return
    running.value = true
    isFinished.value = false
    saveSuccess.value = false
    saveError.value = ''
    // Only reset distance if it wasn't pre-filled by query param
    if (!route.query.distance) {
      distanceKm.value = null
    }
    elapsed.value = 0
    lastVibrateSeconds = 0
    startTimestamp = Date.now()

    timer = window.setInterval(() => {
      const now = Date.now()
      const currentElapsedSeconds = Math.floor((now - startTimestamp) / 1000)
      elapsed.value = currentElapsedSeconds

      if (intervalSeconds.value && intervalSeconds.value > 0) {
        if (currentElapsedSeconds - lastVibrateSeconds >= intervalSeconds.value) {
          if (navigator.vibrate) navigator.vibrate(800)
          lastVibrateSeconds = currentElapsedSeconds
        }
      }
    }, 200)
  }

  function stopSession() {
    running.value = false
    isFinished.value = true
    if (timer) clearInterval(timer)
    timer = null
  }

  function resetSession() {
    isFinished.value = false
    elapsed.value = 0
    if (!route.query.distance) {
      distanceKm.value = null
    }
    saveSuccess.value = false
    saveError.value = ''
  }

  async function saveRunningToDrive() {
    isSaving.value = true
    saveError.value = ''
    try {
      const mockSessionDetails = {
        cardio: {
          exerciseId: exerciseId.value
        }
      }
      await pushCompletedWorkout(runningTitle.value, elapsed.value, true, distanceKm.value || 0, mockSessionDetails)
      markWorkoutAsCompletedToday(runningTitle.value)
      saveSuccess.value = true
    } catch (err: any) {
      console.error(err)
      saveError.value = err.message || "Erreur lors de l'enregistrement."
    } finally {
      isSaving.value = false
    }
  }

  function loginAndSavePendingUpload() {
    if (!runningTitle.value) return

    // Prompt the user for distance if they haven't filled it in yet
    if (distanceKm.value === null || distanceKm.value === undefined || distanceKm.value === 0) {
      const input = prompt("Quelle distance as-tu parcourue pour cette séance cardio (en km) ?", "0.0")
      if (input !== null) {
        const parsed = parseFloat(input.replace(',', '.'))
        if (!isNaN(parsed) && parsed > 0) {
          distanceKm.value = parsed
        }
      }
    }

    const pending = {
      title: runningTitle.value,
      duration: elapsed.value,
      isRunning: true,
      distanceKm: distanceKm.value || 0,
      sessionDetails: {
        cardio: {
          exerciseId: exerciseId.value
        }
      },
      date: new Date().toDateString()
    }
    localStorage.setItem('bq_coach_pending_upload', JSON.stringify(pending))
    try {
      window.location.href = getAuthUrl()
    } catch (err: any) {
      console.error(err)
      saveError.value = err.message || "Erreur de connexion Google Drive."
    }
  }

  function incrementInterval() {
    if (intervalSeconds.value === null) {
      intervalSeconds.value = 5
    } else if (intervalSeconds.value >= 60) {
      intervalSeconds.value += 60 // increment by 1 minute
    } else if (intervalSeconds.value >= 55) {
      intervalSeconds.value = 60 // snap to 1 minute
    } else {
      intervalSeconds.value += 5
    }
  }

  function decrementInterval() {
    if (intervalSeconds.value === null) {
      intervalSeconds.value = 5
    } else if (intervalSeconds.value > 5) {
      if (intervalSeconds.value >= 120) {
        intervalSeconds.value -= 60 // decrement by 1 minute
      } else if (intervalSeconds.value === 60) {
        intervalSeconds.value = 55 // snap to 55s
      } else {
        intervalSeconds.value -= 5
      }
    } else {
      intervalSeconds.value = null // disable vibration
    }
  }

  function format(sec: number) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  function backHome() {
    router.push({ name: 'Home' })
  }
</script>

<template>
  <WakeLock ref="wakeLockRef" />
  <div class="running-header">
    <button
      class="back-button"
      :disabled="running"
      @click="backHome"
    >
      Retour
    </button>
  </div>
  <div class="running">
    <h1>🏃‍♂️ {{ runningTitle }}</h1>

    <div v-if="!running && !isFinished" class="setup-container">
      <span class="setup-label">Intervalle de Vibration</span>
      
      <div class="stepper">
        <button class="btn-step" @click="decrementInterval" :disabled="intervalSeconds === null">-</button>
        <span class="stepper-value">{{ intervalSeconds ? (intervalSeconds >= 60 ? (intervalSeconds / 60) + ' min' : intervalSeconds + 's') : 'N/A' }}</span>
        <button class="btn-step" @click="incrementInterval">+</button>
      </div>
      
      <button class="btn-start-run" @click="startSession">Démarrer</button>
    </div>

    <div v-else-if="running">
      <h2>⏱ Temps écoulé : {{ format(elapsed) }}</h2>
      
      <div v-if="targetDurationMinutes" class="running-target-box">
        <p class="target-title">⏱️ Objectif : <strong>{{ targetDurationMinutes }} minutes</strong></p>
        <p class="target-countdown">Reste : <strong class="time-countdown">{{ format(Math.max(0, targetDurationMinutes * 60 - elapsed)) }}</strong></p>
      </div>
      
      <p class="vibration-current-info">{{ intervalSeconds ? `Vibration toutes les ${intervalSeconds >= 60 ? (intervalSeconds / 60) + ' min' : intervalSeconds + 's'}` : 'Vibration désactivée' }}</p>
      <button class="btn-stop-run" @click="stopSession">Arrêter</button>
    </div>

    <div v-else class="finished-summary">
      <h2>🏆 Séance terminée ! 🏆</h2>
      <p class="final-duration">Temps total : {{ format(elapsed) }}</p>
      <p v-if="targetDurationMinutes" class="target-comparison">Objectif de durée : {{ targetDurationMinutes }} min</p>
      <p class="vibration-info">{{ intervalSeconds ? `Vibration : toutes les ${intervalSeconds >= 60 ? (intervalSeconds / 60) + ' min' : intervalSeconds + 's'}` : 'Vibration désactivée' }}</p>

      <div class="save-section">
        <div v-if="!saveSuccess" class="distance-input-container">
          <label for="distance-input">Distance (km) :</label>
          <input 
            id="distance-input" 
            type="number" 
            v-model.number="distanceKm" 
            min="0" 
            step="0.1" 
            placeholder="0.0" 
            class="distance-field"
          />
        </div>

        <div v-if="isAuthenticated()">
          <button 
            :disabled="isSaving || saveSuccess" 
            class="btn-save" 
            @click="saveRunningToDrive"
          >
            {{ isSaving ? 'Enregistrement...' : saveSuccess ? '✅ Enregistré dans bq-metrics' : '💾 Enregistrer dans bq-metrics' }}
          </button>
          <p v-if="saveError" class="error-msg">⚠️ {{ saveError }}</p>
        </div>
        <div v-else class="gdrive-reminder">
          <p class="reminder-text">💡 Enregistre ton entraînement sur ton historique bq-metrics :</p>
          <button class="btn-gdrive-login" @click="loginAndSavePendingUpload">
            Se connecter & enregistrer
          </button>
          <p v-if="saveError" class="error-msg">⚠️ {{ saveError }}</p>
        </div>
      </div>

      <button class="btn-reset" @click="resetSession">Nouvelle session</button>
    </div>
  </div>
</template>

<style scoped>
  .running-header {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    max-width: 370px;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
  }

  .back-button {
    font-size: 0.95rem;
    padding: 0.4rem 0.8rem;
  }

  .running {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem 0;
    text-align: center;
    width: 100%;
    max-width: 370px;
    margin: 0 auto;
    box-sizing: border-box;
  }

  input {
    font-size: 1rem;
    font-weight: 600;
    padding: 0.5rem 0.8rem;
    margin: 0.5rem;
    border-radius: 0.6rem;
    width: 80px;
    text-align: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    outline: none;
    transition: all 0.2s ease;
  }

  input:focus {
    border-color: #ffc107;
    box-shadow: 0 0 10px rgba(255, 193, 7, 0.2);
  }

  @media (prefers-color-scheme: light) {
    input {
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.1);
      color: #222222;
    }
  }

  button {
    font-size: 1rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  /* Tactile Stepper Styling */
  .setup-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
    width: 100%;
    max-width: 250px;
    margin-top: 1rem;
  }

  .setup-label {
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
  }

  .stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.2rem;
    width: 100%;
    margin-bottom: 0.5rem;
  }

  .btn-step {
    width: 45px;
    height: 45px;
    border-radius: 50% !important;
    font-size: 1.5rem !important;
    font-weight: 700;
    padding: 0 !important;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: white;
    transition: all 0.2s ease;
  }

  .btn-step:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn-step:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .stepper-value {
    font-size: 2rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    width: 80px;
    text-align: center;
  }

  .btn-start-run {
    font-size: 1.1rem !important;
    font-weight: 700;
    padding: 0.7rem 2rem !important;
    border-radius: 2rem !important;
    border: none;
    background-color: #ffc107;
    color: #111;
    width: 100%;
    transition: background-color 0.2s;
    box-shadow: 0 4px 12px rgba(255, 193, 7, 0.2);
  }

  .btn-start-run:hover {
    background-color: #e0a800;
  }

  @media (prefers-color-scheme: light) {
    .setup-label {
      color: rgba(0, 0, 0, 0.45);
    }
    .btn-step {
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.1);
      color: #222222;
    }
    .btn-step:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.05);
    }
  }

  h1 {
    font-size: 2rem;
  }

  .finished-summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
  }

  .final-duration {
    font-size: 1.5rem;
    font-weight: 600;
    opacity: 0.9;
    margin: 0;
  }

  .vibration-info {
    font-size: 0.95rem;
    opacity: 0.7;
    margin: 0;
  }

  .save-section {
    margin-top: 1rem;
    margin-bottom: 1rem;
    max-width: 280px;
  }

  .btn-save {
    background-color: #4285f4;
    color: white;
    font-size: 1rem;
    padding: 0.6rem 1.2rem;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    width: 100%;
    transition: background-color 0.25s;
  }

  .btn-save:hover:not(:disabled) {
    background-color: #357ae8;
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-msg {
    color: #f44336;
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }

  .gdrive-reminder {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 100%;
    align-items: center;
  }

  .reminder-text {
    font-size: 0.85rem;
    opacity: 0.75;
    margin: 0;
    line-height: 1.4;
    text-align: center;
  }

  .btn-gdrive-login {
    font-size: 0.9rem;
    font-weight: 700;
    padding: 0.6rem 1.2rem;
    border-radius: 2rem;
    border: none;
    cursor: pointer;
    background-color: #ff9800;
    color: white;
    width: 100%;
    transition: background-color 0.2s;
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.2);
  }

  .btn-gdrive-login:hover {
    background-color: #e68a00;
  }

  .btn-reset {
    margin-top: 1rem;
    background-color: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .btn-reset:hover {
    background-color: #2b2b2b;
  }

  .distance-input-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.95rem;
  }

  /* Running Target Box styles */
  .running-target-box {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1rem;
    margin: 1rem 0;
    width: 100%;
    max-width: 320px;
    box-sizing: border-box;
  }

  .target-title {
    font-size: 1rem;
    margin: 0 0 0.5rem 0;
    opacity: 0.85;
  }

  .target-countdown {
    font-size: 1.1rem;
    margin: 0;
    opacity: 0.9;
  }

  .time-countdown {
    font-size: 1.8rem;
    font-weight: bold;
    color: #ea4335;
    display: block;
    margin-top: 0.3rem;
  }

  .vibration-current-info {
    font-size: 0.9rem;
    opacity: 0.7;
    margin-top: 0.5rem;
  }

  .target-comparison {
    font-size: 1.05rem;
    font-weight: 500;
    color: #ea4335;
    margin: 0.2rem 0;
  }

  .btn-stop-run {
    margin-top: 1rem;
    font-size: 1.1rem;
    padding: 0.6rem 1.5rem;
    background-color: rgba(234, 67, 53, 0.15);
    color: #ea4335;
    border: 1px solid rgba(234, 67, 53, 0.3);
    border-radius: 2rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-stop-run:hover {
    background-color: #ea4335;
    color: white;
  }

  @media (prefers-color-scheme: light) {
    .running-target-box {
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
  }
</style>
