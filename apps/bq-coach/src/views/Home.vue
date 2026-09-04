<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import workoutsData from '../assets/workouts.json'
  import { 
    getAuthUrl, 
    checkAuthCallback, 
    isAuthenticated, 
    logout, 
    saveWorkoutsToLocalCache,
    getSyncTimestamp,
    getSavedWorkouts,
    pushCompletedWorkout,
    syncWorkoutsFlow,
    saveWorkoutsToDrive,
    markWorkoutAsCompletedToday
  } from '../utils/gdrive'

  const router = useRouter()
  const isUserLoggedIn = ref(false)
  const syncStatus = ref('')
  const syncError = ref('')
  const lastSyncTime = ref<string | null>(null)
  const isUsingSyncedData = ref(false)

  function goTo(path: string) {
    router.push({ name: path })
  }

  function loginGoogle() {
    try {
      window.location.href = getAuthUrl()
    } catch (err: any) {
      console.error(err)
      syncError.value = err.message || "Erreur lors de la redirection de connexion."
    }
  }

  function handleLogout() {
    logout()
    isUserLoggedIn.value = false
    syncStatus.value = 'Déconnecté.'
    // Update synced status (keeps local cache but reflects latest state)
    isUsingSyncedData.value = getSavedWorkouts() !== null
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  async function triggerSync() {
    syncStatus.value = 'Recherche du planning...'
    syncError.value = ''
    try {
      syncStatus.value = 'Téléchargement...'
      const workouts = await syncWorkoutsFlow()
      
      if (workouts) {
        saveWorkoutsToLocalCache(workouts)
        isUsingSyncedData.value = true
        syncStatus.value = 'Planning synchronisé !'
        const ts = getSyncTimestamp()
        if (ts) lastSyncTime.value = formatDate(ts)
      } else {
        // No file found on Drive, initialize with default workoutsData
        syncStatus.value = 'Création du planning sur Google Drive...'
        await saveWorkoutsToDrive(workoutsData)
        saveWorkoutsToLocalCache(workoutsData)
        isUsingSyncedData.value = true
        syncStatus.value = 'Planning synchronisé !'
        const ts = getSyncTimestamp()
        if (ts) lastSyncTime.value = formatDate(ts)
      }
    } catch (err: any) {
      console.error(err)
      syncError.value = err.message || 'Erreur lors de la synchronisation.'
      syncStatus.value = ''
    }
  }

  onMounted(async () => {
    // Check if returning from Google login redirect
    const token = checkAuthCallback()
    
    isUserLoggedIn.value = isAuthenticated()

    const ts = getSyncTimestamp()
    if (ts) lastSyncTime.value = formatDate(ts)

    isUsingSyncedData.value = getSavedWorkouts() !== null

    // Check if there is a pending completed workout to upload (coming from end screen Google login redirection)
    const pending = localStorage.getItem('bq_coach_pending_upload')
    if (pending && isAuthenticated()) {
      try {
        const data = JSON.parse(pending)
        syncStatus.value = `Enregistrement automatique de ta séance...`
        await pushCompletedWorkout(
          data.title,
          data.duration,
          !!data.isRunning,
          data.distanceKm,
          data.sessionDetails
        )
        markWorkoutAsCompletedToday(data.title)
        syncStatus.value = `✅ Séance "${data.title}" enregistrée automatiquement dans bq-metrics !`
        localStorage.removeItem('bq_coach_pending_upload')
      } catch (err: any) {
        console.error(err)
        syncError.value = "Erreur lors de l'enregistrement automatique."
        syncStatus.value = ''
      }
    } else {
      // Trigger auto-sync if we just logged in
      if (token) {
        triggerSync()
      }
    }
  })
</script>

<template>
  <div class="home-container">
    <!-- Header Hero Section -->
    <div class="hero-section">
      <div class="logo-wrapper">
        <img src="/icon.png" class="app-logo" alt="bq coach"/>
      </div>
      <h1 class="app-title">BQ COACH</h1>
      <p class="app-tagline">Mon assistant sportif quotidien</p>
      
      <!-- Source Badge -->
      <div class="source-badge" :class="isUserLoggedIn ? 'source-synced' : isUsingSyncedData ? 'source-local' : 'source-default'">
        <span class="source-dot"></span>
        {{ isUserLoggedIn ? 'Programme synchronisé (Google Drive)' : isUsingSyncedData ? 'Programme local' : 'Programme par défaut' }}
      </div>
    </div>
    
    <!-- Dashboard Menu Grid -->
    <div class="dashboard-menu">
      <div class="menu-card" @click="goTo('Session')">
        <div class="card-icon icon-today">🏋️‍♂️</div>
        <div class="card-info">
          <h2 class="card-title">Séance du jour</h2>
          <p class="card-desc">Lancer l'entraînement du jour</p>
        </div>
        <div class="card-arrow">→</div>
      </div>

      <div class="menu-card" @click="goTo('Planning')">
        <div class="card-icon icon-plan">📅</div>
        <div class="card-info">
          <h2 class="card-title">Planning</h2>
          <p class="card-desc">Consulter le programme hebdomadaire</p>
        </div>
        <div class="card-arrow">→</div>
      </div>

      <div class="menu-card" @click="goTo('Running')">
        <div class="card-icon icon-run">⏱️</div>
        <div class="card-info">
          <h2 class="card-title">Séance libre</h2>
          <p class="card-desc">Chronomètre & vibrations à intervalle libre</p>
        </div>
        <div class="card-arrow">→</div>
      </div>
    </div>

    <!-- Sync Panel -->
    <div class="sync-panel">
      <div class="sync-header">
        <span class="cloud-icon">☁️</span>
        <h3>Synchronisation Google Drive</h3>
      </div>
      
      <div v-if="!isUserLoggedIn" class="sync-logged-out">
        <div v-if="lastSyncTime" class="sync-meta" style="margin-bottom: 0.8rem;">
          <span class="status-disconnected">❌ Déconnecté</span>
          <span class="last-sync">Synchro : {{ lastSyncTime }}</span>
        </div>
        <button class="btn-gdrive" @click="loginGoogle">
          Se connecter à Google Drive
        </button>
      </div>

      <div v-else class="sync-controls">
        <div class="sync-meta">
          <span class="status-logged">✅ Connecté</span>
          <span v-if="lastSyncTime" class="last-sync">Synchro : {{ lastSyncTime }}</span>
        </div>
        
        <div class="button-group">
          <button class="btn-sync" @click="triggerSync">Actualiser</button>
          <button class="btn-logout" @click="handleLogout">Déconnexion</button>
        </div>
      </div>

      <p v-if="syncStatus" class="status-message">{{ syncStatus }}</p>
      <p v-if="syncError" class="error-message">⚠️ {{ syncError }}</p>
    </div>
  </div>
</template>

<style scoped>
  .home-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    width: 100%;
    max-width: 370px;
    margin: 0 auto;
    padding-bottom: 2rem;
    box-sizing: border-box;
  }

  /* Hero Section */
  .hero-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-top: 0.5rem;
  }

  .logo-wrapper {
    position: relative;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    margin-bottom: 0.8rem;
  }

  .app-logo {
    width: 70px;
    height: 70px;
    object-fit: contain;
  }

  .app-title {
    font-size: 2rem;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.01em;
    background: linear-gradient(135deg, #ffffff 0%, #bbbbbb 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .app-tagline {
    font-size: 0.85rem;
    font-weight: 500;
    opacity: 0.6;
    margin: 0.2rem 0 0.5rem 0;
    letter-spacing: 0.02em;
  }

  /* Source Badge Styling */
  .source-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.75rem;
    border-radius: 1.5rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    margin-top: 0.6rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .source-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    display: inline-block;
  }

  .source-synced {
    background-color: rgba(76, 175, 80, 0.1);
    color: #4caf50;
    border: 1px solid rgba(76, 175, 80, 0.15);
  }

  .source-synced .source-dot {
    background-color: #4caf50;
    box-shadow: 0 0 6px #4caf50;
  }

  .source-local {
    background-color: rgba(33, 150, 243, 0.1);
    color: #2196f3;
    border: 1px solid rgba(33, 150, 243, 0.15);
  }

  .source-local .source-dot {
    background-color: #2196f3;
    box-shadow: 0 0 6px #2196f3;
  }

  .source-default {
    background-color: rgba(255, 152, 0, 0.1);
    color: #ff9800;
    border: 1px solid rgba(255, 152, 0, 0.15);
  }

  .source-default .source-dot {
    background-color: #ff9800;
    box-shadow: 0 0 6px #ff9800;
  }

  /* Dashboard Grid */
  .dashboard-menu {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    width: 100%;
  }

  .menu-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    text-align: left;
    width: 100%;
    box-sizing: border-box;
  }

  .menu-card:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }

  .menu-card:hover .card-arrow {
    transform: translateX(3px);
    opacity: 1;
  }

  .card-icon {
    font-size: 1.8rem;
    width: 45px;
    height: 45px;
    border-radius: 0.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .icon-today {
    background: rgba(234, 67, 53, 0.08);
    border-color: rgba(234, 67, 53, 0.15);
  }

  .icon-plan {
    background: rgba(255, 193, 7, 0.08);
    border-color: rgba(255, 193, 7, 0.15);
  }

  .icon-run {
    background: rgba(66, 133, 244, 0.08);
    border-color: rgba(66, 133, 244, 0.15);
  }

  .card-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .card-title {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
    color: #ffffff;
  }

  .card-desc {
    font-size: 0.8rem;
    opacity: 0.55;
    margin: 0;
  }

  .card-arrow {
    font-size: 1.1rem;
    opacity: 0.4;
    transition: all 0.2s ease;
    font-weight: 700;
  }

  /* Sync Panel */
  .sync-panel {
    margin-top: 0.5rem;
    padding: 1.2rem;
    border-radius: 1rem;
    background-color: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    width: 100%;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .sync-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    padding-bottom: 0.5rem;
  }

  .cloud-icon {
    font-size: 1.1rem;
  }

  .sync-panel h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    opacity: 0.85;
  }

  .btn-gdrive {
    font-size: 0.95rem;
    font-weight: 700;
    padding: 0.6rem 1.2rem;
    border-radius: 2rem;
    border: none;
    cursor: pointer;
    background-color: #4285F4;
    color: white;
    width: 100%;
    transition: background-color 0.2s;
    box-shadow: 0 4px 12px rgba(66, 133, 244, 0.2);
  }

  .btn-gdrive:hover {
    background-color: #357ae8;
  }

  .sync-controls {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 100%;
  }

  .sync-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .status-logged {
    font-size: 0.85rem;
    font-weight: 700;
    color: #4caf50;
  }

  .status-disconnected {
    font-size: 0.85rem;
    font-weight: 700;
    color: #ea4335;
  }

  .last-sync {
    font-size: 0.75rem;
    opacity: 0.55;
  }

  .button-group {
    display: flex;
    gap: 0.4rem;
    width: 100%;
  }

  .btn-sync, .btn-logout {
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.5rem 1rem;
    border-radius: 1.5rem;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s;
    flex: 1;
  }

  .btn-sync {
    background-color: rgba(76, 175, 80, 0.15);
    color: #4caf50;
    border: 1px solid rgba(76, 175, 80, 0.25);
  }

  .btn-sync:hover {
    background-color: #4caf50;
    color: white;
  }

  .btn-logout {
    background-color: rgba(234, 67, 53, 0.15);
    color: #ea4335;
    border: 1px solid rgba(234, 67, 53, 0.25);
  }

  .btn-logout:hover {
    background-color: #ea4335;
    color: white;
  }

  .status-message {
    font-size: 0.8rem;
    margin: 0;
    opacity: 0.8;
    text-align: center;
  }

  .error-message {
    font-size: 0.8rem;
    color: #f44336;
    margin: 0;
    text-align: center;
  }

  /* Support for light color scheme if enabled */
  @media (prefers-color-scheme: light) {
    .app-title {
      background: linear-gradient(135deg, #111111 0%, #333333 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .logo-wrapper {
      background: rgba(0, 0, 0, 0.015);
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    .menu-card, .sync-panel {
      background: rgba(0, 0, 0, 0.015);
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    .card-title {
      color: #111111;
    }
    .card-icon {
      background: rgba(0, 0, 0, 0.01);
      border: 1px solid rgba(0, 0, 0, 0.04);
    }
  }
</style>
