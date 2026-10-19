<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db } from '../db';
import { 
  Activity, Database, ShieldAlert,
  Euro, Car, Shirt, HeartPulse, Dice5, Brain,
  Flame, Utensils, Clapperboard
} from '@lucide/vue';

const emit = defineEmits(['navigate']);

const collections = ref<any[]>([]);
const totalRecordsCount = ref(0);
const pinnedAppIds = ref<string[]>([]);

// Core bq-* Hub apps templates with their default Netlify production domains
const HUB_APPS = [
  { id: 'bank', name: 'bq-bank', title: 'bq-bank', subtitle: 'Finances & budgets', icon: Euro, colorClass: 'blue', url: 'https://bq-bank.netlify.app' },
  { id: 'car', name: 'bq-car', title: 'bq-car', subtitle: 'Consommation & entretien', icon: Car, colorClass: 'red', url: 'https://bq-car.netlify.app' },
  { id: 'cloth', name: 'bq-cloth', title: 'bq-cloth', subtitle: 'Tenues & lessives', icon: Shirt, colorClass: 'beige', url: 'https://bq-cloth.netlify.app' },
  { id: 'coach', name: 'bq-coach', title: 'bq-coach', subtitle: 'Séances de sport', icon: Flame, colorClass: 'orange', url: 'https://bq-coach.netlify.app' },
  { id: 'cook', name: 'bq-cook', title: 'bq-cook', subtitle: 'Recettes & courses', icon: Utensils, colorClass: 'yellow', url: 'https://bq-cook.netlify.app' },
  { id: 'health', name: 'bq-health', title: 'bq-health', subtitle: 'Carnet de santé', icon: HeartPulse, colorClass: 'green', url: 'https://bq-health.netlify.app' },
  { id: 'learn', name: 'bq-learn', title: 'bq-learn', subtitle: 'Quiz & révisions', icon: Brain, colorClass: 'pink', url: 'https://bq-learn.netlify.app' },
  { id: 'play', name: 'bq-play', title: 'bq-play', subtitle: 'Ludothèque & scores', icon: Dice5, colorClass: 'purple', url: 'https://bq-play.netlify.app' },
  { id: 'watch', name: 'bq-watch', title: 'bq-watch', subtitle: 'Films & débrief IA', icon: Clapperboard, colorClass: 'rose', url: 'https://bq-watch.netlify.app' }
];

// Load which apps are pinned from local storage
const loadPinnedApps = () => {
  const saved = localStorage.getItem('bq-graph-pinned-apps-v1');
  if (saved) {
    try {
      pinnedAppIds.value = JSON.parse(saved);
      return;
    } catch (e) {
      console.error('Failed to parse pinned apps:', e);
    }
  }
  // Default to all 9 apps being pinned on first launch
  pinnedAppIds.value = ['bank', 'car', 'cloth', 'coach', 'cook', 'health', 'play', 'learn', 'watch'];
};

// Filter full details for pinned apps only
const pinnedAppsList = computed(() => {
  return HUB_APPS.filter(app => pinnedAppIds.value.includes(app.id));
});

const handleLaunchApp = (url: string) => {
  window.open(url, '_blank');
};

const navigateTo = (tab: string) => {
  emit('navigate', tab);
};

const loadDashboardData = async () => {
  const rawCols = await db.collections.toArray();
  collections.value = rawCols.filter(c => !c.deletedAt);
  
  const rawRecords = await db.records.toArray();
  totalRecordsCount.value = rawRecords.filter(r => !r.deletedAt).length;
};

onMounted(() => {
  loadPinnedApps();
  loadDashboardData();
});
</script>

<template>
  <div class="dashboard-view fade-in">
    <!-- Onboarding Sparkle Banner -->
    <div class="onboarding-banner card glass">
      <div class="banner-body">
        <div class="banner-text">
          <h2>Console analytique</h2>
          <p>Visualise tes graphiques, gère tes structures de données et lance tes applications du Hub.</p>
        </div>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div class="stats-row">
      <div class="stat-card card glass hoverable" @click="navigateTo('collections')">
        <div class="stat-main">
          <p class="stat-title">Tables de données actives</p>
          <p class="stat-value">{{ collections.length }}</p>
        </div>
        <div class="stat-icon-wrapper blue">
          <Database class="stat-icon" />
        </div>
      </div>

      <div class="stat-card card glass hoverable" @click="navigateTo('explorer')">
        <div class="stat-main">
          <p class="stat-title">Enregistrements génériques</p>
          <p class="stat-value">{{ totalRecordsCount }}</p>
        </div>
        <div class="stat-icon-wrapper purple">
          <Activity class="stat-icon" />
        </div>
      </div>
    </div>

    <!-- Hub bq-* Apps Grid section -->
    <div class="hub-section">
      <div class="section-header mb-4">
        <h3>Applications</h3>
        <p class="section-desc">Accède rapidement à tes applications de vie spécialisées. Personnalise tes applications épinglées depuis l'onglet <strong>Paramètres</strong> de l'application.</p>
      </div>

      <!-- Empty state if no apps pinned -->
      <div v-if="pinnedAppsList.length === 0" class="card glass text-center py-4 text-muted">
        <ShieldAlert class="mx-auto mb-2 text-warning" :size="36" />
        <h3>Aucune application épinglée</h3>
        <p class="text-sub text-sm mt-2">Rends-toi dans l'onglet <strong>Paramètres</strong> pour épingler tes applications préférées sur ton tableau de bord.</p>
        <button @click="navigateTo('settings')" class="btn btn-primary btn-sm mt-3">
          Aller aux Paramètres
        </button>
      </div>

      <div v-else class="hub-grid">
        <div 
          v-for="app in pinnedAppsList" 
          :key="app.id" 
          class="app-card card glass hoverable"
          @click="handleLaunchApp(app.url)"
        >
          <div class="app-card-header">
            <div class="app-icon-wrapper" :class="app.colorClass">
              <component :is="app.icon" :size="24" />
            </div>
            <div class="app-title-box">
              <h4>{{ app.title }}</h4>
              <span class="app-subtitle text-sub text-xs font-semibold">{{ app.subtitle }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-view {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Banner */
.onboarding-banner {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%);
  border-color: rgba(59, 130, 246, 0.15);
  padding: 1.75rem;
  
  .banner-body {
    display: flex;
    gap: 1.25rem;
    align-items: center;
  }
  
  .banner-icon-container {
    background-color: rgba(168, 85, 247, 0.15);
    color: var(--color-accent);
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .banner-sparkle {
    width: 24px;
    height: 24px;
    animation: pulse 2s infinite ease-in-out;
  }
  
  .banner-text {
    h2 {
      font-size: 1.5rem;
      font-weight: 800;
      margin-bottom: 0.25rem;
    }
    p {
      color: var(--text-sub);
      font-size: 0.95rem;
      line-height: 1.5;
    }
  }
}

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  
  .stat-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-sub);
    margin-bottom: 0.25rem;
  }
  .stat-value {
    font-size: 2rem;
    font-weight: 800;
  }
  
  .stat-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border-radius: var(--radius-md);
    
    &.blue {
      background-color: rgba(59, 130, 246, 0.1);
      color: var(--color-primary);
    }
    &.purple {
      background-color: rgba(168, 85, 247, 0.1);
      color: var(--color-accent);
    }
  }
  
  .stat-icon {
    width: 22px;
    height: 22px;
  }
}

/* Hub Section */
.hub-section {
  .section-desc {
    color: var(--text-muted);
    font-size: 0.85rem;
  }
}

.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  margin-top: 1.25rem;
}

.app-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.25rem !important;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
  
  &:hover {
    transform: translateY(-4px);
    border-color: var(--color-primary);
    
    .launch-btn {
      background-color: var(--color-primary);
      border-color: var(--color-primary);
      color: #ffffff;
    }
  }
}

.app-card-header {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.app-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  &.blue { background-color: rgba(59, 130, 246, 0.12); color: #3b82f6; }
  &.red { background-color: rgba(239, 68, 68, 0.12); color: #ef4444; }
  &.beige { background-color: rgba(197, 168, 128, 0.12); color: #c5a880; }
  &.orange { background-color: rgba(249, 115, 22, 0.12); color: #f97316; }
  &.yellow { background-color: rgba(234, 179, 8, 0.12); color: #eab308; }
  &.green { background-color: rgba(16, 185, 129, 0.12); color: #10b981; }
  &.pink { background-color: rgba(244, 171, 186, 0.12); color: #f4abba; }
  &.purple { background-color: rgba(139, 92, 246, 0.12); color: #8b5cf6; }
  &.rose { background-color: rgba(244, 63, 94, 0.12); color: #f43f5e; }
}

.app-title-box {
  display: flex;
  flex-direction: column;
  
  h4 {
    font-size: 1.15rem;
    font-weight: 800;
    margin: 0;
    color: var(--text-primary);
    font-family: monospace; /* Coding theme look */
  }
}

.launch-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.08); opacity: 1; }
}
</style>