<script setup lang="ts">
import { ref, onMounted } from 'vue';
import HomeView from './components/HomeView.vue';
import ComptesView from './components/ComptesView.vue';
import BudgetsView from './components/BudgetsView.vue';
import SettingsView from './components/SettingsView.vue';
import { initializeCollections } from './db/queries';
import { CreditCard, Landmark, PieChart, Settings } from '@lucide/vue';
import AppHeader from '@bq/theme/AppHeader.vue';
import AppBottomNav, { type NavItem } from '@bq/theme/AppBottomNav.vue';
import ToastsContainer from '@bq/theme/ToastsContainer.vue';
import ReloadPrompt from '@bq/theme/ReloadPrompt.vue';
import './style.scss';

const activeTab = ref<'saisie' | 'comptes' | 'budgets' | 'settings'>(
  (localStorage.getItem('bq-bank-active-tab') as any) || 'saisie'
);

const handleNavigate = (tab: any) => {
  activeTab.value = tab;
  localStorage.setItem('bq-bank-active-tab', tab);
};

const navItems: NavItem[] = [
  { id: 'saisie', label: 'Opérations', icon: CreditCard },
  { id: 'comptes', label: 'Soldes', icon: Landmark },
  { id: 'budgets', label: 'Budgets', icon: PieChart },
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
    console.error('Error during bq-bank boot:', err);
  }
});
</script>

<template>
  <div class="app-shell">
    <AppHeader appName="bq-bank" appSubtitle="Gestion Financière" />

    <main class="app-content">
      <HomeView v-if="activeTab === 'saisie'" :key="'saisie-' + viewKey" @data-updated="triggerDataUpdate" />
      <ComptesView v-else-if="activeTab === 'comptes'" :key="'comptes-' + viewKey" @data-updated="triggerDataUpdate" />
      <BudgetsView v-else-if="activeTab === 'budgets'" :key="'budgets-' + viewKey" @data-updated="triggerDataUpdate" />
      <SettingsView v-else-if="activeTab === 'settings'" :key="'settings-' + viewKey" @data-updated="triggerDataUpdate" />
    </main>

    <AppBottomNav :modelValue="activeTab" :items="navItems" @update:modelValue="handleNavigate" />

    <ToastsContainer />
    <ReloadPrompt appName="bq-bank" />
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
