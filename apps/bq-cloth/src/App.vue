<script setup lang="ts">
import { ref, onMounted } from 'vue';
import HomeView from './components/HomeView.vue';
import DressingView from './components/DressingView.vue';
import LessivesView from './components/LessivesView.vue';
import SettingsView from './components/SettingsView.vue';
import { initializeCollections, checkAutomatedDryingAvailability } from './db/queries';
import { CloudSun, Sparkles, Settings, Bookmark } from '@lucide/vue';
import AppHeader from '@bq/theme/AppHeader.vue';
import AppBottomNav, { type NavItem } from '@bq/theme/AppBottomNav.vue';
import ToastsContainer from '@bq/theme/ToastsContainer.vue';
import './style.scss';

const activeTab = ref<'home' | 'dressing' | 'lessives' | 'settings'>(
  (localStorage.getItem('bq-cloth-active-tab') as any) || 'home'
);

const handleNavigate = (tab: any) => {
  activeTab.value = tab;
  localStorage.setItem('bq-cloth-active-tab', tab);
};

const navItems: NavItem[] = [
  { id: 'home', label: 'Suggestions', icon: CloudSun },
  { id: 'dressing', label: 'Dressing', icon: Bookmark },
  { id: 'lessives', label: 'Lessives', icon: Sparkles },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

const viewKey = ref(0);
const triggerDataUpdate = () => {
  viewKey.value++;
  checkAutomatedDryingAvailability();
};

onMounted(async () => {
  try {
    await initializeCollections();
    await checkAutomatedDryingAvailability();
    setInterval(async () => {
      await checkAutomatedDryingAvailability();
    }, 2 * 60 * 1000);
  } catch (err) {
    console.error('Error during app boot:', err);
  }
});
</script>

<template>
  <div class="app-shell">
    <AppHeader appName="bq-cloth" appSubtitle="Garde-robe connectée" />

    <main class="app-content">
      <HomeView v-if="activeTab === 'home'" :key="'home-' + viewKey" @data-updated="triggerDataUpdate" />
      <DressingView v-else-if="activeTab === 'dressing'" :key="'dress-' + viewKey" @data-updated="triggerDataUpdate" />
      <LessivesView v-else-if="activeTab === 'lessives'" :key="'less-' + viewKey" @data-updated="triggerDataUpdate" />
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
