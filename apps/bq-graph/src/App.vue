<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import DashboardView from './components/DashboardView.vue';
import DataExplorerView from './components/DataExplorerView.vue';
import CollectionChartsView from './components/CollectionChartsView.vue';
import CollectionsManagerView from './components/CollectionsManagerView.vue';
import SettingsView from './components/SettingsView.vue';
import ReloadPrompt from './components/ReloadPrompt.vue';
import AppHeader from '@bq/theme/AppHeader.vue';
import AppBottomNav, { type NavItem } from '@bq/theme/AppBottomNav.vue';
import ToastsContainer from '@bq/theme/ToastsContainer.vue';
import { 
  LayoutDashboard, TableProperties, Database, Settings, BarChart3
} from '@lucide/vue';
import { 
  checkSavedConnectionState 
} from './db/google-drive';

// Navigation State (5 standard tabs)
const activeTab = ref<string>('dashboard');

// Reactive update key to force re-render views on change
const dashboardKey = ref(0);
const explorerKey = ref(0);
const collectionsKey = ref(0);

// Template refs
const explorerRef = ref<any>(null);
const chartsRef = ref<any>(null);

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'explorer', label: 'Données', icon: TableProperties },
  { id: 'charts', label: 'Graphiques', icon: BarChart3 },
  { id: 'collections', label: 'Modèles', icon: Database },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

onMounted(async () => {
  checkSavedConnectionState();
  handleDataUpdated();
});

const handleDataUpdated = () => {
  dashboardKey.value++;
  explorerKey.value++;
  collectionsKey.value++;
};

const handleNavigate = async (tab: string, colId?: string) => {
  activeTab.value = tab;
  if (tab === 'explorer' && colId) {
    await nextTick();
    if (explorerRef.value) {
      explorerRef.value.selectCollection(colId);
    }
  }
};

const handleAddRecordExpress = async (colId: string) => {
  activeTab.value = 'explorer';
  await nextTick();
  if (explorerRef.value) {
    explorerRef.value.selectCollection(colId);
    explorerRef.value.openAddModal();
  }
};

const handleOpenCharts = async (colId: string) => {
  activeTab.value = 'charts';
  await nextTick();
  if (chartsRef.value) {
    chartsRef.value.openChartsFor(colId);
  }
};
</script>

<template>
  <div class="app-shell">
    <AppHeader appName="bq-graph" appSubtitle="Console Analytique" />

    <!-- Main Content Area -->
    <main class="app-content">
      <DashboardView 
        v-if="activeTab === 'dashboard'" 
        :key="'dash-' + dashboardKey"
        @navigate="handleNavigate"
        @add-record="handleAddRecordExpress"
        @open-charts="handleOpenCharts"
      />
      
      <DataExplorerView 
        v-else-if="activeTab === 'explorer'" 
        ref="explorerRef"
        :key="'exp-' + explorerKey"
        @data-updated="handleDataUpdated"
        @open-charts="handleOpenCharts"
      />

      <CollectionChartsView 
        v-else-if="activeTab === 'charts'" 
        ref="chartsRef"
        :key="'charts-' + collectionsKey"
        @navigate="handleNavigate"
      />
      
      <CollectionsManagerView 
        v-else-if="activeTab === 'collections'" 
        :key="'col-' + collectionsKey"
        @data-updated="handleDataUpdated"
      />
      
      <SettingsView 
        v-else-if="activeTab === 'settings'" 
        @data-updated="handleDataUpdated"
      />
    </main>

    <AppBottomNav :modelValue="activeTab" :items="navItems" @update:modelValue="handleNavigate" />

    <ReloadPrompt />
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
  box-sizing: border-box;
  flex-grow: 1;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 85px 1.5rem;
}
@media (min-width: 768px) {
  .app-content {
    padding: 2rem 2rem 90px 2rem;
  }
}
</style>
