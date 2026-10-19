<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { seedDatabaseIfEmpty, db } from '../db';
import { syncEngine } from '../db/google-drive';
import BaseSettings from '@bq/theme/BaseSettings.vue';
import { 
  LayoutGrid, Euro, Car, Shirt, HeartPulse, Dice5, Brain, Flame, Utensils, Clapperboard
} from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const isDbEmpty = ref(true);

const HUB_APPS_LIST = [
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

const COLOR_MAP: Record<string, { bg: string, text: string }> = {
  blue: { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' },
  red: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444' },
  beige: { bg: 'rgba(197, 168, 128, 0.12)', text: '#c5a880' },
  orange: { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316' },
  yellow: { bg: 'rgba(234, 179, 8, 0.12)', text: '#eab308' },
  green: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981' },
  pink: { bg: 'rgba(244, 171, 186, 0.12)', text: '#f4abba' },
  purple: { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6' },
  rose: { bg: 'rgba(244, 63, 94, 0.12)', text: '#f43f5e' }
};

const pinnedAppIds = ref<string[]>([]);
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const loadPinnedApps = () => {
  const saved = localStorage.getItem('bq-graph-pinned-apps-v1');
  if (saved) {
    try {
      pinnedAppIds.value = JSON.parse(saved);
      return;
    } catch (e) {
      console.error(e);
    }
  }
  pinnedAppIds.value = ['bank', 'car', 'cloth', 'coach', 'cook', 'health', 'play', 'learn', 'watch'];
  savePinnedApps();
};

const savePinnedApps = () => {
  localStorage.setItem('bq-graph-pinned-apps-v1', JSON.stringify(pinnedAppIds.value));
  emit('data-updated');
};

const checkDbStatus = async () => {
  const rawCols = await db.collections.toArray();
  const activeCols = rawCols.filter(c => !c.deletedAt);
  isDbEmpty.value = activeCols.length === 0;
};

onMounted(async () => {
  loadPinnedApps();
  await checkDbStatus();
});

const handleSeed = async () => {
  await seedDatabaseIfEmpty();
  await checkDbStatus();
  emit('data-updated');
};

const handleDataUpdated = async () => {
  await checkDbStatus();
  emit('data-updated');
};

const handleClearDatabase = async () => {
  await checkDbStatus();
  emit('data-updated');
};
</script>

<template>
  <BaseSettings
    :db="db"
    :syncEngine="syncEngine"
    :clientId="clientId"
    :isDbEmpty="isDbEmpty"
    exportFileNamePrefix="bq-graph"
    @data-updated="handleDataUpdated"
    @clear-database="handleClearDatabase"
    @generate-demo="handleSeed"
  >
    <!-- Custom content slot: Dashboard Personalization -->
    <div class="custom-settings-content">
      <!-- Dashboard Personalization Card (Full Width) -->
      <div class="card glass hub-custom-card">
        <div class="card-header hub-custom-header">
          <div class="icon-wrapper info hub-icon-wrapper">
            <LayoutGrid :size="20" />
          </div>
          <h2>Personnalisation du hub</h2>
        </div>
        <p class="card-desc">
          Épingle tes applications personnelles préférées sur la page d'accueil (Tableau de bord). Les applications décochées seront masquées.
        </p>

        <div class="pinned-apps-form">
          <div v-for="app in HUB_APPS_LIST" :key="app.id" class="card glass app-pin-item">
            <div class="app-pin-left">
              <div 
                class="app-badge-box"
                :style="{ backgroundColor: COLOR_MAP[app.colorClass].bg, color: COLOR_MAP[app.colorClass].text }"
              >
                <component :is="app.icon" :size="16" />
              </div>
              <div class="app-label-col">
                <span class="font-bold text-sm app-title-text">{{ app.title }}</span>
                <span class="text-xs text-sub app-sub-text">{{ app.subtitle }}</span>
              </div>
            </div>
            <label class="switch app-switch-label">
              <input type="checkbox" :value="app.id" v-model="pinnedAppIds" @change="savePinnedApps" class="checkbox-input" />
              <span>{{ pinnedAppIds.includes(app.id) ? 'Épinglé' : 'Masqué' }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </BaseSettings>
</template>

<style scoped lang="scss">
.custom-settings-content {
  margin-top: 2rem;
}

.hub-custom-card {
  width: 100%;
  padding: 1.5rem;
  border-radius: var(--radius-md);
}

.hub-custom-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
  }
}

.hub-icon-wrapper {
  background-color: color-mix(in srgb, var(--color-info, #06b6d4) 12%, transparent);
  color: var(--color-info, #06b6d4);
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-desc {
  color: var(--text-sub);
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
  line-height: 1.4;
}

.pinned-apps-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.85rem;
  width: 100%;
}

.app-pin-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
  gap: 1rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
}

.app-pin-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.app-badge-box {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.app-label-col {
  display: flex;
  flex-direction: column;
}

.app-title-text {
  font-weight: 800;
  font-size: 0.95rem;
  font-family: monospace;
  color: var(--text-primary);
}

.app-sub-text {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.app-switch-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: bold;
  color: var(--text-sub);
}

.checkbox-input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
  cursor: pointer;
}
</style>
