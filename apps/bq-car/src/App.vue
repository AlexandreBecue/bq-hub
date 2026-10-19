<script setup lang="ts">
import { ref, onMounted } from 'vue';
import HomeView from './components/HomeView.vue';
import EntretienView from './components/EntretienView.vue';
import SettingsView from './components/SettingsView.vue';
import { initializeCollections } from './db/queries';
import { Fuel, Wrench, Settings } from '@lucide/vue';
import AppHeader from '@bq/theme/AppHeader.vue';
import AppBottomNav, { type NavItem } from '@bq/theme/AppBottomNav.vue';
import ToastsContainer from '@bq/theme/ToastsContainer.vue';
import './style.scss';

const activeTab = ref<'carburant' | 'entretien' | 'settings'>(
  (localStorage.getItem('bq-car-active-tab') as any) || 'carburant'
);

const handleNavigate = (tab: any) => {
  activeTab.value = tab;
  localStorage.setItem('bq-car-active-tab', tab);
};

const navItems: NavItem[] = [
  { id: 'carburant', label: 'Carburant', icon: Fuel },
  { id: 'entretien', label: 'Entretien', icon: Wrench },
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
    console.error('Error during app boot:', err);
  }
});
</script>

<template>
  <div class="app-shell">
    <AppHeader appName="bq-car" appSubtitle="Suivi Automobile" />

    <main class="app-content">
      <HomeView v-if="activeTab === 'carburant'" :key="'carb-' + viewKey" @data-updated="triggerDataUpdate" />
      <EntretienView v-else-if="activeTab === 'entretien'" :key="'ent-' + viewKey" @data-updated="triggerDataUpdate" />
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
