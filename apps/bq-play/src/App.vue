<script setup lang="ts">
import { ref, onMounted } from 'vue';
import HomeView from './components/HomeView.vue';
import ScorecardView from './components/ScorecardView.vue';
import HistoriqueView from './components/HistoriqueView.vue';
import SettingsView from './components/SettingsView.vue';
import { initializeCollections } from './db/queries';
import { Gamepad2, Award, History, Settings } from '@lucide/vue';
import AppHeader from '@bq/theme/AppHeader.vue';
import AppBottomNav, { type NavItem } from '@bq/theme/AppBottomNav.vue';
import ToastsContainer from '@bq/theme/ToastsContainer.vue';
import './style.scss';

const activeTab = ref<'ludotheque' | 'scorecard' | 'historique' | 'settings'>(
  (localStorage.getItem('bq-play-active-tab') as any) || 'ludotheque'
);

const handleNavigate = (tab: any) => {
  activeTab.value = tab;
  localStorage.setItem('bq-play-active-tab', tab);
};

const navItems: NavItem[] = [
  { id: 'ludotheque', label: 'Ludothèque', icon: Gamepad2 },
  { id: 'scorecard', label: 'Scorecard', icon: Award },
  { id: 'historique', label: 'Historique', icon: History },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

const viewKey = ref(0);
const triggerDataUpdate = () => {
  viewKey.value++;
};

onMounted(async () => {
  try {
    await initializeCollections();
  } catch (err) {
    console.error('Error during bq-play boot:', err);
  }
});
</script>

<template>
  <div class="app-shell">
    <AppHeader appName="bq-play" appSubtitle="Ludothèque & Scores" />

    <main class="app-content">
      <HomeView v-if="activeTab === 'ludotheque'" :key="'ludo-' + viewKey" @data-updated="triggerDataUpdate" />
      <ScorecardView v-else-if="activeTab === 'scorecard'" :key="'score-' + viewKey" @data-updated="triggerDataUpdate" />
      <HistoriqueView v-else-if="activeTab === 'historique'" :key="'hist-' + viewKey" @data-updated="triggerDataUpdate" />
      <SettingsView v-else-if="activeTab === 'settings'" :key="'set-' + viewKey" @data-updated="triggerDataUpdate" />
    </main>

    <AppBottomNav :modelValue="activeTab" :items="navItems" @update:modelValue="handleNavigate" />

    <ToastsContainer />
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-content {
  flex: 1;
  padding: 1.5rem 1.5rem 80px 1.5rem;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}
@media (min-width: 768px) {
  .app-content {
    padding: 2rem 2rem 90px 2rem;
  }
}
</style>
