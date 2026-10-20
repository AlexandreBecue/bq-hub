<script setup lang="ts">
import { ref, onMounted } from 'vue';
import SessionView from './components/SessionView.vue';
import PlanningView from './components/PlanningView.vue';
import SettingsView from './components/SettingsView.vue';
import { initializeCollections } from './db/queries';
import { Dumbbell, Calendar, Settings } from '@lucide/vue';
import AppHeader from '@bq/theme/AppHeader.vue';
import AppBottomNav, { type NavItem } from '@bq/theme/AppBottomNav.vue';
import ToastsContainer from '@bq/theme/ToastsContainer.vue';
import ReloadPrompt from '@bq/theme/ReloadPrompt.vue';
import './style.scss';

const activeTab = ref<'session' | 'planning' | 'settings'>(
  (localStorage.getItem('bq-coach-active-tab') as any) || 'session'
);

const handleNavigate = (tab: any) => {
  activeTab.value = tab;
  localStorage.setItem('bq-coach-active-tab', tab);
};

const navItems: NavItem[] = [
  { id: 'session', label: 'Séance', icon: Dumbbell },
  { id: 'planning', label: 'Planning', icon: Calendar },
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
    console.error('Erreur initialisation base bq-coach:', err);
  }
});
</script>

<template>
  <div class="app-shell">
    <AppHeader appName="bq-coach" appSubtitle="Séances de sport" />

    <main class="app-content">
      <SessionView v-if="activeTab === 'session'" :key="'session-' + viewKey" @data-updated="triggerDataUpdate" />
      <PlanningView v-else-if="activeTab === 'planning'" :key="'plan-' + viewKey" @data-updated="triggerDataUpdate" />
      <SettingsView v-else-if="activeTab === 'settings'" :key="'set-' + viewKey" @data-updated="triggerDataUpdate" />
    </main>

    <AppBottomNav :modelValue="activeTab" :items="navItems" @update:modelValue="handleNavigate" />

    <ToastsContainer />
    <ReloadPrompt appName="bq-coach" />
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
