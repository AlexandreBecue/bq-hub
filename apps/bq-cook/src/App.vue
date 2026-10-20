<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { initializeCollections } from './db/queries';
import PlanningView from './components/PlanningView.vue';
import RecipesView from './components/RecipesView.vue';
import StocksView from './components/StocksView.vue';
import CoursesView from './components/CoursesView.vue';
import SettingsView from './components/SettingsView.vue';
import { Calendar, BookOpen, Layers, ShoppingCart, Settings } from '@lucide/vue';
import AppHeader from '@bq/theme/AppHeader.vue';
import AppBottomNav, { type NavItem } from '@bq/theme/AppBottomNav.vue';
import ToastsContainer from '@bq/theme/ToastsContainer.vue';
import ReloadPrompt from '@bq/theme/ReloadPrompt.vue';
import './style.scss';

onMounted(async () => {
  await initializeCollections();
});

const activeTab = ref<'planning' | 'recipes' | 'stocks' | 'courses' | 'settings'>(
  (localStorage.getItem('bq-cook-active-tab') as any) || 'planning'
);

const handleNavigate = (tab: any) => {
  activeTab.value = tab;
  localStorage.setItem('bq-cook-active-tab', tab);
};

const navItems: NavItem[] = [
  { id: 'planning', label: 'Planning', icon: Calendar },
  { id: 'recipes', label: 'Recettes', icon: BookOpen },
  { id: 'stocks', label: 'Stocks', icon: Layers },
  { id: 'courses', label: 'Courses', icon: ShoppingCart },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

const viewKey = ref(0);
const triggerDataUpdate = () => {
  viewKey.value++;
};
</script>

<template>
  <div class="app-shell">
    <AppHeader appName="bq-cook" appSubtitle="Assistant Culinaire" />

    <main class="app-content">
      <PlanningView v-if="activeTab === 'planning'" :key="'plan-' + viewKey" @data-updated="triggerDataUpdate" />
      <RecipesView v-else-if="activeTab === 'recipes'" :key="'rec-' + viewKey" @data-updated="triggerDataUpdate" />
      <StocksView v-else-if="activeTab === 'stocks'" :key="'stock-' + viewKey" @data-updated="triggerDataUpdate" />
      <CoursesView v-else-if="activeTab === 'courses'" :key="'course-' + viewKey" @data-updated="triggerDataUpdate" />
      <SettingsView v-else-if="activeTab === 'settings'" :key="'set-' + viewKey" @data-updated="triggerDataUpdate" />
    </main>

    <AppBottomNav :modelValue="activeTab" :items="navItems" @update:modelValue="handleNavigate" />

    <ToastsContainer />
    <ReloadPrompt appName="bq-cook" />
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
