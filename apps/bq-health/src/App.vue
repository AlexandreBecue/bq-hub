<script setup lang="ts">
import { ref, onMounted } from 'vue';
import HomeView from './components/HomeView.vue';
import RdvView from './components/RdvView.vue';
import TraitementsView from './components/TraitementsView.vue';
import MensurationsView from './components/MensurationsView.vue';
import VaccinsView from './components/VaccinsView.vue';
import SettingsView from './components/SettingsView.vue';
import { initializeCollections } from './db/queries';
import { Activity, Calendar, Heart, Ruler, ShieldCheck, Settings } from '@lucide/vue';
import AppHeader from '@bq/theme/AppHeader.vue';
import AppBottomNav, { type NavItem } from '@bq/theme/AppBottomNav.vue';
import ToastsContainer from '@bq/theme/ToastsContainer.vue';
import './style.scss';

const activeTab = ref<'home' | 'rdv' | 'traitements' | 'mensurations' | 'vaccins' | 'settings'>(
  (localStorage.getItem('bq-health-active-tab') as any) || 'home'
);

const handleNavigate = (tab: any) => {
  activeTab.value = tab;
  localStorage.setItem('bq-health-active-tab', tab);
};

const navItems: NavItem[] = [
  { id: 'home', label: 'Cockpit', icon: Activity },
  { id: 'rdv', label: 'RDVs', icon: Calendar },
  { id: 'traitements', label: 'Pilulier', icon: Heart },
  { id: 'mensurations', label: 'Mesures', icon: Ruler },
  { id: 'vaccins', label: 'Vaccins', icon: ShieldCheck },
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
    console.error('Error during bq-health boot:', err);
  }
});
</script>

<template>
  <div class="app-shell">
    <AppHeader appName="bq-health" appSubtitle="Carnet de Santé" />

    <main class="app-content">
      <HomeView v-if="activeTab === 'home'" :key="'home-' + viewKey" @data-updated="triggerDataUpdate" />
      <RdvView v-else-if="activeTab === 'rdv'" :key="'rdv-' + viewKey" @data-updated="triggerDataUpdate" />
      <TraitementsView v-else-if="activeTab === 'traitements'" :key="'trait-' + viewKey" @data-updated="triggerDataUpdate" />
      <MensurationsView v-else-if="activeTab === 'mensurations'" :key="'mens-' + viewKey" @data-updated="triggerDataUpdate" />
      <VaccinsView v-else-if="activeTab === 'vaccins'" :key="'vac-' + viewKey" @data-updated="triggerDataUpdate" />
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
