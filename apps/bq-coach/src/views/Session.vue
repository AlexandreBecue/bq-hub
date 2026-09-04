<script setup lang="ts">
  import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import exercisesData from '../assets/exercises.json'
  import workoutsData from '../assets/workouts.json'
  import { 
    getSavedWorkouts, 
    pushCompletedWorkout, 
    isAuthenticated, 
    getAuthUrl,
    markWorkoutAsCompletedToday,
    isWorkoutCompletedToday 
  } from '../utils/gdrive'
  import Breadcrumb from "../components/Breadcrumb.vue"
  import ExerciseDetails from "../components/ExerciseDetails.vue"
  import WakeLock from '../components/WakeLock.vue'
  import WorkoutSummary from "../components/WorkoutSummary.vue"
  import type { Exercise, Step } from '../utils/types'

  const router = useRouter()
  const wakeLockRef = ref<InstanceType<typeof WakeLock> | null>(null)
  const beep = new Audio('/beep.mp3')

  const exercises = exercisesData as Array<Exercise>
  const exerciseMap = Object.fromEntries(exercises.map(e => [e.id, e]))

  const workouts = (getSavedWorkouts() ?? workoutsData) as Record<number, any>
  const today = new Date().getDay() as 0|1|2|3|4|5|6
  const session = workouts[today] ?? null

  const sessionTitle = computed(() => {
    return session?.strength?.title || session?.cardio?.title || session?.title || ''
  })

  const getDynamicLongRunDuration = () => {
    const baseDate = new Date('2026-06-22') // Resume training date: Monday June 22, 2026
    const today = new Date()
    const diffMs = today.getTime() - baseDate.getTime()
    const diffWeeks = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)))
    return Math.min(150, 50 + diffWeeks * 5)
  }

  const sessionCardioDuration = computed(() => {
    if (!session?.cardio) return null
    const checkTitle = session.cardio?.title || sessionTitle.value
    if (checkTitle.includes('Sortie Longue') || checkTitle.includes('Séance longue')) {
      return getDynamicLongRunDuration()
    }
    return session.cardio.durationMinutes
  })

  interface BoundedStep extends Step {
    startSecond: number
    endSecond: number
  }

  const timeline: BoundedStep[] = []
  let cumulativeSeconds = 0

  function pushToTimeline(step: Step) {
    timeline.push({
      ...step,
      startSecond: cumulativeSeconds,
      endSecond: cumulativeSeconds + step.duration
    })
    cumulativeSeconds += step.duration
  }

  const strengthData = session?.strength ?? null

  if (session && strengthData) {
    if (strengthData.warmup) {
      if (strengthData.warmup.restDuration > 0) {
        pushToTimeline({ type: 'rest', duration: strengthData.warmup.restDuration })
      }
      pushToTimeline({
        type: 'work',
        exerciseId: strengthData.warmup.exerciseId,
        duration: strengthData.warmup.workDuration
      })
    }

    for (let set = 1; set <= strengthData.sets; set++) {
      for (const ex of strengthData.exercises) {
        if (ex.restDuration > 0) {
          pushToTimeline({ type: 'rest', duration: ex.restDuration })
        }
        pushToTimeline({
          type: 'work',
          exerciseId: ex.exerciseId,
          duration: ex.workDuration,
          index: set,
          total: strengthData.sets
        })
      }
    }

    if (strengthData.finisher) {
      for (const ex of strengthData.finisher) {
        for (let set = 1; set <= ex.sets; set++) {
          if (ex.restDuration > 0) {
            pushToTimeline({ type: 'rest', duration: ex.restDuration })
          }
          pushToTimeline({
            type: 'work',
            exerciseId: ex.exerciseId,
            duration: ex.workDuration,
            index: set,
            total: ex.sets
          })
        }
      }
    }
  }

  const currentStepIndex = ref(0)
  const currentStep = computed(() => timeline[currentStepIndex.value] ?? null)
  const isResting = computed(() => timeline[currentStepIndex.value]?.type === 'rest')

  const displayedExercise = computed(() => {
    if (!timeline.length) return null
    if (isResting.value) {
      const next = timeline[currentStepIndex.value + 1]
      if (next?.exerciseId) {
        return exerciseMap[next.exerciseId]
      }
    }
    const current = timeline[currentStepIndex.value]
    if (current?.exerciseId) {
      return exerciseMap[current.exerciseId]
    }
    return null
  })

  const totalDuration = computed(() =>
    timeline.reduce((sum, step) => sum + (step.duration ?? 0), 0)
  )

  const activeTab = ref<'strength' | 'cardio'>('strength')

  const displayedDuration = computed(() => {
    if (session?.type === 'hybrid' && activeTab.value === 'cardio') {
      return (sessionCardioDuration.value ?? 0) * 60
    }
    return totalDuration.value
  })

  const totalTime = ref(0)
  const localTime = ref(currentStep.value?.duration ?? 0)

  let timerInterval: number | null = null

  // Timestamps for ultra-accurate clock-based tracking (drift-free, single-source-of-truth)
  let globalStartTimestamp = 0
  let globalAccumulatedTime = 0
  let actualStartTime = 0
  const extraPauseSeconds = ref(0)
  const lastBeepedSecond = ref<number | null>(null)

  type SessionStatus = 'idle' | 'running' | 'paused' | 'finished'
  const sessionStatus = ref<SessionStatus>('idle')

  // Unlocks Web Audio API playback capability early (to prevent lag/blocks on mobile)
  function unlockAudio() {
    beep.play().then(() => {
      beep.pause()
      beep.currentTime = 0
    }).catch(() => {})
  }

  function start() {
    if (!timeline.length) return

    wakeLockRef.value?.requestWakeLock()
    unlockAudio()

    sessionStatus.value = 'running'

    const now = Date.now()
    globalStartTimestamp = now
    globalAccumulatedTime = 0
    actualStartTime = now
    lastBeepedSecond.value = null

    totalTime.value = 0
    currentStepIndex.value = 0
    localTime.value = timeline[0].duration

    startTimerLoop()
  }

  function startTimerLoop() {
    if (!timerInterval) {
      timerInterval = window.setInterval(tick, 100)
    }
  }

  const hasSavedSession = ref(false)

  function saveSessionState() {
    if (sessionStatus.value === 'finished' || sessionStatus.value === 'idle') {
      return
    }

    const state = {
      title: session?.title,
      date: new Date().toDateString(),
      currentStepIndex: currentStepIndex.value,
      localTime: localTime.value,
      totalTime: totalTime.value,
      globalAccumulatedTime,
      actualStartTime
    }
    localStorage.setItem('bq_coach_active_session', JSON.stringify(state))
  }

  function checkSavedSession() {
    const saved = localStorage.getItem('bq_coach_active_session')
    if (!saved) {
      hasSavedSession.value = false
      return
    }

    try {
      const state = JSON.parse(saved)
      const isSameWorkout = state.title === session?.title
      const isToday = state.date === new Date().toDateString()
      
      hasSavedSession.value = isSameWorkout && isToday
    } catch {
      hasSavedSession.value = false
    }
  }

  function resumeSavedSession() {
    const saved = localStorage.getItem('bq_coach_active_session')
    if (!saved) return

    try {
      const state = JSON.parse(saved)
      currentStepIndex.value = state.currentStepIndex
      localTime.value = state.localTime
      totalTime.value = state.totalTime
      globalAccumulatedTime = state.globalAccumulatedTime
      actualStartTime = state.actualStartTime || Date.now()

      sessionStatus.value = 'paused'
      hasSavedSession.value = false
    } catch (err) {
      console.error("Erreur lors de la reprise de la séance :", err)
    }
  }

  function clearSavedSession() {
    localStorage.removeItem('bq_coach_active_session')
    hasSavedSession.value = false
  }

  function startFreshSession() {
    clearSavedSession()
    start()
  }

  function loginAndSavePendingUpload() {
    if (!sessionTitle.value) return
    const pending = {
      title: sessionTitle.value,
      duration: totalTime.value,
      isRunning: false,
      sessionDetails: session,
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

  function tick() {
    if (sessionStatus.value !== 'running') return

    const now = Date.now()

    // 1. Calculate precise total elapsed time in seconds
    const elapsedGlobalMs = globalAccumulatedTime + (now - globalStartTimestamp)
    const currentGlobalSec = Math.floor(elapsedGlobalMs / 1000)
    totalTime.value = currentGlobalSec

    // 2. Map global seconds to active step bounds
    const stepIndex = timeline.findIndex(
      step => currentGlobalSec >= step.startSecond && currentGlobalSec < step.endSecond
    )

    if (stepIndex !== -1) {
      // Trigger haptic feedback on step transition
      if (currentStepIndex.value !== stepIndex) {
        currentStepIndex.value = stepIndex
        if (navigator.vibrate) navigator.vibrate(500)
      }

      const activeStep = timeline[stepIndex]
      const remainingSec = activeStep.endSecond - currentGlobalSec
      
      const oldLocalTime = localTime.value
      localTime.value = remainingSec

      if (oldLocalTime !== remainingSec) {
        saveSessionState()
      }

      // 3. Audio countdown trigger (beeps exactly once per second)
      if (remainingSec <= 5 && remainingSec > 0) {
        if (lastBeepedSecond.value !== remainingSec) {
          lastBeepedSecond.value = remainingSec
          beep.play().catch(() => {})
        }
      }
    } else if (currentGlobalSec >= totalDuration.value) {
      // 4. Session finished!
      sessionStatus.value = 'finished'
      const actualEndTime = Date.now()
      const wallClockMs = actualEndTime - actualStartTime
      const activeMs = totalTime.value * 1000
      extraPauseSeconds.value = Math.max(0, Math.floor((wallClockMs - activeMs) / 1000))

      if (sessionTitle.value) {
        markWorkoutAsCompletedToday(sessionTitle.value)
        hasCompletedSessionToday.value = true
      }

      clearTimerLoop()
      clearSavedSession()
      if (navigator.vibrate) navigator.vibrate(500)
    }
  }

  function pause() {
    sessionStatus.value = 'paused'
    clearTimerLoop()

    const now = Date.now()
    globalAccumulatedTime += now - globalStartTimestamp

    saveSessionState()
  }

  function resume() {
    sessionStatus.value = 'running'
    unlockAudio()

    globalStartTimestamp = Date.now()
    startTimerLoop()
  }

  function clearTimerLoop() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  onBeforeUnmount(clearTimerLoop)

  onMounted(() => {
    checkSavedSession()
  })

  function format(sec: number) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const mainButtonLabel = computed(() => {
    if (sessionStatus.value === 'running') return 'Pause'
    if (sessionStatus.value === 'paused') return 'Reprendre'
    return 'C’est parti !'
  })

  function handleMainButton() {
    if (sessionStatus.value === 'running') pause()
    else if (sessionStatus.value === 'paused') resume()
    else start()
  }

  function backHome() {
    router.push({ name: 'Home' })
  }

  const isSaving = ref(false)
  const saveSuccess = ref(false)
  const saveError = ref('')
  const hasCompletedSessionToday = ref(false)
  const hasCompletedCardioToday = ref(false)

  const sessionClass = computed(() => {
    if (sessionStatus.value === 'idle') return 'state-idle'
    if (sessionStatus.value === 'finished') return 'state-finished'
    return isResting.value ? 'state-resting' : 'state-working'
  })

  const strokeDasharray = 534
  const strokeDashoffset = computed(() => {
    const duration = currentStep.value?.duration ?? 0
    if (duration <= 0) return 0
    const ratio = localTime.value / duration
    return strokeDasharray * (1 - ratio)
  })

  async function saveSessionToDrive() {
    if (!sessionTitle.value) return
    isSaving.value = true
    saveError.value = ''
    try {
      await pushCompletedWorkout(sessionTitle.value, totalTime.value, false, undefined, session)
      saveSuccess.value = true
      markWorkoutAsCompletedToday(sessionTitle.value)
      hasCompletedSessionToday.value = true
    } catch (err: any) {
      console.error(err)
      saveError.value = err.message || "Erreur lors de l'enregistrement."
    } finally {
      isSaving.value = false
    }
  }

  function launchCardio() {
    if (!session?.cardio) return
    router.push({
      name: 'Running',
      query: {
        duration: sessionCardioDuration.value,
        interval: session.cardio.interval,
        title: session.cardio.title,
        exerciseId: session.cardio.exerciseId,
        autoStart: 'true'
      }
    })
  }

  onMounted(() => {
    if (sessionTitle.value) {
      hasCompletedSessionToday.value = isWorkoutCompletedToday(sessionTitle.value)
      if (hasCompletedSessionToday.value && session?.type === 'hybrid') {
        activeTab.value = 'cardio'
      }
    }
    if (session?.cardio) {
      const cardioTitle = session.cardio.title || sessionTitle.value
      hasCompletedCardioToday.value = isWorkoutCompletedToday(cardioTitle)
    }
  })
</script>

<template>
  <WakeLock ref="wakeLockRef" />
  <div class="session-header">
    <button
      class="back-button"
      :disabled="sessionStatus === 'running'"
      @click="backHome"
    >
      Retour
    </button>
    <button
      class="global-time"
      :disabled="sessionStatus === 'running'"
    >
      {{ format(sessionStatus === 'running' ? totalTime : displayedDuration) }}
    </button>
  </div>

  <div class="session" :class="sessionClass">
    <div v-if="session && session.type === 'cardio'">
      <WorkoutSummary :session="session" :exerciseMap="exerciseMap"/>
      <div class="start-actions" style="margin-top: 1.5rem;">
        <button class="btn-start" @click="router.push({ name: 'Running', query: { duration: sessionCardioDuration, interval: session.cardio?.interval, title: session.cardio?.title || sessionTitle, exerciseId: session.cardio?.exerciseId, autoStart: 'true' } })">
          Démarrer la séance
        </button>
      </div>
    </div>

    <div v-else-if="!timeline.length">
      <h1>Journée de repos !</h1>
    </div>

    <div v-else>
      <div v-if="sessionStatus === 'idle'">
        <WorkoutSummary 
          :session="session" 
          :exerciseMap="exerciseMap"
          :allow-launch-cardio="false"
          v-model:active-tab="activeTab"
          @launch-cardio="launchCardio"
        />
        
        <div class="start-actions">
          <!-- Alerte si la séance de renforcement a déjà été complétée aujourd'hui -->
          <div v-if="activeTab === 'strength' && hasCompletedSessionToday && !hasSavedSession" class="completed-box">
            <p class="completed-text">🎉 Tu as déjà complété cette séance aujourd'hui !</p>
          </div>

          <!-- Alerte si la séance de cardio a déjà été complétée aujourd'hui -->
          <div v-if="activeTab === 'cardio' && hasCompletedCardioToday" class="completed-box" style="background-color: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.2);">
            <p class="completed-text" style="color: #4caf50;">🎉 Tu as déjà complété ta séance de cardio aujourd'hui !</p>
          </div>

          <!-- Affichage du bouton de démarrage/reprise ou lancement cardio -->
          <div class="start-actions-content" style="width: 100%;">
            <!-- Cas 1 : Onglet Cardio actif (Hybride) -->
            <template v-if="session.type === 'hybrid' && activeTab === 'cardio'">
              <button class="btn-start" @click="launchCardio">
                Démarrer la séance
              </button>
            </template>

            <!-- Cas 2 : Onglet Renforcement actif (ou session standard) -->
            <template v-else>
              <!-- S'il y a une sauvegarde renfo, on affiche la boîte de reprise -->
              <div v-if="hasSavedSession" class="resume-box" style="margin-top: 0; width: 100%;">
                <p class="resume-text">💡 Une séance interrompue a été détectée pour aujourd'hui.</p>
                <div class="resume-buttons">
                  <button class="btn-resume" @click="resumeSavedSession">Reprendre la séance</button>
                  <button class="btn-clear-save" @click="startFreshSession">Recommencer à zéro</button>
                </div>
              </div>
              
              <!-- Sinon, on affiche le bouton Démarrer la séance standard -->
              <button 
                v-else 
                class="btn-start" 
                @click="start"
              >
                Démarrer la séance
              </button>
            </template>
          </div>
        </div>
      </div>

      <div v-else>
        <div v-if="sessionStatus !== 'finished' && currentStep" class="active-step-container">
          
          <div class="timer-container">
            <svg class="timer-ring" width="200" height="200">
              <circle
                class="timer-ring-bg"
                stroke="rgba(255, 255, 255, 0.1)"
                stroke-width="10"
                fill="transparent"
                r="85"
                cx="100"
                cy="100"
              />
              <circle
                class="timer-ring-bar"
                :stroke="isResting ? '#4caf50' : '#ea4335'"
                stroke-width="10"
                fill="transparent"
                r="85"
                cx="100"
                cy="100"
                :stroke-dasharray="strokeDasharray"
                :stroke-dashoffset="strokeDashoffset"
                stroke-linecap="round"
              />
            </svg>
            <div class="timer-text">
              <div class="local-time">{{ format(localTime) }}</div>
              <span class="step-type-label">{{ isResting ? 'REPOS' : 'EFFORT' }}</span>
            </div>
          </div>

          <button class="btn-action" @click="handleMainButton">
            {{ mainButtonLabel }}
          </button>

          <Breadcrumb
            :timeline="timeline"
            :currentIndex="currentStepIndex"
            :isResting="isResting"
            :sessionStatus="sessionStatus"
            :exerciseMap="exerciseMap"
          />

          <ExerciseDetails :exercise="displayedExercise" />
        </div>

        <div v-else class="finished-summary">
          <div class="trophy-icon">🏆</div>
          <h1 class="congrats-title">Séance terminée !</h1>
          <p class="congrats-text">Félicitations pour ton effort aujourd'hui !</p>

          <!-- Advanced Stats Card -->
          <div class="stats-card">
            <div class="stat-row">
              <span class="stat-label">⏸️ TEMPS DE PAUSE</span>
              <span class="stat-value" :class="extraPauseSeconds > 0 ? 'paused-value' : 'perfect-value'">
                {{ extraPauseSeconds > 0 ? format(extraPauseSeconds) : '00:00' }}
              </span>
            </div>
          </div>

          <div class="save-section">
            <div v-if="isAuthenticated()">
              <button 
                :disabled="isSaving || saveSuccess" 
                class="btn-save" 
                @click="saveSessionToDrive"
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
            </div>
          </div>

          <!-- Invitation à lancer la partie Cardio si session hybride -->
          <div v-if="session.cardio" class="hybrid-running-invitation" style="margin-top: 1.5rem; width: 100%; max-width: 320px; text-align: center;">
            <p style="font-size: 0.95rem; font-weight: 600; color: #ea4335; margin: 0 0 0.8rem 0;">🏃‍♂️ La partie Renforcement est terminée !</p>
            <button class="btn-start-assoc" style="width: 100%; margin-top: 0; align-self: center;" @click="router.push({ name: 'Running', query: { duration: sessionCardioDuration, interval: session.cardio?.interval, title: session.cardio?.title || sessionTitle.value, exerciseId: session.cardio?.exerciseId, autoStart: 'true' } })">
              Lancer la partie Cardio
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .session-header {
    display: flex;
    justify-content: space-between;
    width: 100%;
    max-width: 370px;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
    margin-bottom: 0.5rem;
  }

  .back-button, .global-time {
    font-size: 0.95rem;
    padding: 0.4rem 0.8rem;
  }

  .session {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 1rem 0;
    gap: 0.8rem;
    min-height: 65vh;
    border-radius: 1.5rem;
    transition: background-color 0.5s ease, box-shadow 0.5s ease;
    width: 100%;
    max-width: 370px;
    margin: 1rem auto;
    box-sizing: border-box;
  }

  /* Force all nested wrapper levels inside session to span full width & center their children */
  .session > div, 
  .session > div > div, 
  .active-step-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.2rem;
    box-sizing: border-box;
  }

  /* Glowing background states */
  .state-idle {
  }

  .state-resting {
    background-color: rgba(76, 175, 80, 0.06);
    border: 1px solid rgba(76, 175, 80, 0.2);
    box-shadow: 0 0 40px rgba(76, 175, 80, 0.08);
  }

  .state-working {
    background-color: rgba(234, 67, 53, 0.06);
    border: 1px solid rgba(234, 67, 53, 0.2);
    box-shadow: 0 0 40px rgba(234, 67, 53, 0.08);
  }

  .state-finished {
    background-color: rgba(66, 133, 244, 0.06);
    border: 1px solid rgba(66, 133, 244, 0.2);
    box-shadow: 0 0 40px rgba(66, 133, 244, 0.08);
  }

  /* Circular Ring Timer Styling */
  .timer-container {
    position: relative;
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0.2rem auto;
  }

  .timer-ring {
    transform: rotate(-90deg);
    transform-origin: center;
  }

  .timer-ring-bar {
    transition: stroke-dashoffset 0.15s linear;
  }

  .timer-text {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .local-time {
    font-size: 3.2rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .step-type-label {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    opacity: 0.6;
    margin-top: 0.2rem;
  }

  h1 {
    font-size: 1.8rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0;
  }

  /* Dynamic Action Button */
  .btn-action {
    margin-top: 0.2rem;
    margin-bottom: 0.6rem;
    font-size: 1.1rem;
    font-weight: 700;
    padding: 0.75rem 2rem;
    border-radius: 2rem;
    cursor: pointer;
    background: v-bind("isResting ? 'rgba(76, 175, 80, 0.15)' : 'rgba(234, 67, 53, 0.15)'");
    color: v-bind("isResting ? '#4caf50' : '#ea4335'");
    border: 1px solid v-bind("isResting ? 'rgba(76, 175, 80, 0.3)' : 'rgba(234, 67, 53, 0.3)'");
    transition: all 0.2s ease;
    width: 100%;
    max-width: 250px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  }

  .btn-action:hover {
    transform: translateY(-2px);
    background: v-bind("isResting ? '#4caf50' : '#ea4335'");
    color: white;
    box-shadow: 0 6px 20px v-bind("isResting ? 'rgba(76, 175, 80, 0.3)' : 'rgba(234, 67, 53, 0.3)'");
  }

  .btn-action:active {
    transform: translateY(0);
  }

  .finished-summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
    padding: 1.5rem 1rem;
    width: 100%;
    box-sizing: border-box;
  }

  .trophy-icon {
    font-size: 3.5rem;
    margin-bottom: 0.5rem;
    animation: bounce 2s infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .congrats-title {
    font-size: 1.6rem;
    font-weight: 800;
    margin: 0;
    color: #ffc107;
  }

  .congrats-text {
    font-size: 0.9rem;
    opacity: 0.7;
    margin: 0 0 0.8rem 0;
  }

  /* Stats Card styling */
  .stats-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1rem;
    width: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    box-sizing: border-box;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
  }

  .stat-row:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    padding-bottom: 0.6rem;
  }

  .stat-label {
    font-weight: 700;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .paused-value {
    color: #ffc107;
  }

  .perfect-value {
    color: #4caf50;
  }

  .save-section {
    margin-top: 1rem;
    width: 100%;
    max-width: 320px;
    box-sizing: border-box;
  }

  .btn-save {
    background-color: #4285f4;
    color: white;
    font-size: 0.95rem;
    font-weight: 700;
    padding: 0.7rem 1.5rem;
    border-radius: 2rem;
    border: none;
    cursor: pointer;
    width: 100%;
    transition: background-color 0.2s, transform 0.1s;
    box-shadow: 0 4px 12px rgba(66, 133, 244, 0.2);
  }

  .btn-save:hover:not(:disabled) {
    background-color: #357ae8;
    transform: translateY(-1px);
  }

  .btn-save:active {
    transform: translateY(0);
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .error-msg {
    color: #f44336;
    font-size: 0.85rem;
    margin-top: 0.5rem;
    text-align: center;
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

  /* Resume workout styling */
  .start-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    width: 100%;
    margin-top: 1rem;
  }

  .btn-start {
    font-size: 1.1rem;
    padding: 0.7rem 1.5rem;
    background-color: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-start:hover {
    background-color: #2b2b2b;
  }

  .resume-box {
    padding: 1.2rem;
    border-radius: 0.8rem;
    background-color: rgba(255, 193, 7, 0.05);
    border: 1px solid rgba(255, 193, 7, 0.2);
    box-sizing: border-box;
  }

  .resume-text {
    font-size: 0.85rem;
    color: #ffc107;
    margin: 0 0 1rem 0;
    line-height: 1.4;
  }

  .resume-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .btn-resume {
    font-size: 0.95rem;
    padding: 0.5rem 1rem;
    background-color: #ffc107;
    color: #111;
    border: none;
    font-weight: 600;
  }

  .btn-resume:hover {
    background-color: #e0a800;
  }

  .btn-clear-save {
    font-size: 0.85rem;
    padding: 0.4rem 1rem;
    background-color: transparent;
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .btn-clear-save:hover {
    background-color: rgba(255, 255, 255, 0.05);
    color: white;
  }

  /* Completed workout today alert styling */
  .completed-box {
    padding: 1rem 1.2rem;
    border-radius: 0.8rem;
    background-color: rgba(76, 175, 80, 0.05);
    border: 1px solid rgba(76, 175, 80, 0.2);
    max-width: 320px;
    box-sizing: border-box;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.05);
  }

  .completed-text {
    font-size: 0.85rem;
    font-weight: 600;
    color: #4caf50;
    margin: 0;
    line-height: 1.4;
  }

  .btn-start-assoc {
    font-size: 0.9rem;
    font-weight: 700;
    padding: 0.5rem 1rem;
    border-radius: 1.5rem;
    border: 1px solid rgba(234, 67, 53, 0.3);
    background: rgba(234, 67, 53, 0.15);
    color: #ea4335;
    cursor: pointer;
    transition: all 0.2s ease;
    align-self: flex-start;
    margin-top: 0.4rem;
  }

  .btn-start-assoc:hover {
    background: #ea4335;
    color: white;
  }
</style>