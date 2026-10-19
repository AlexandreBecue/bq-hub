<script setup lang="ts">
import { ref, onMounted } from 'vue';
import HomeView from './components/HomeView.vue';
import RevisionView from './components/RevisionView.vue';
import EditorView from './components/EditorView.vue';
import SettingsView from './components/SettingsView.vue';
import { initializeCollections } from './db/queries';
import { BookOpen, Settings, LayoutGrid } from '@lucide/vue';
import AppHeader from '@bq/theme/AppHeader.vue';
import AppBottomNav, { type NavItem } from '@bq/theme/AppBottomNav.vue';
import ToastsContainer from '@bq/theme/ToastsContainer.vue';
import './style.scss';

const activeTab = ref<'home' | 'revision' | 'editor' | 'settings'>(
  (localStorage.getItem('bq-learn-active-tab') as any) || 'home'
);

// Stores which deck is being studied, null means global mix
const activeSessionDeckId = ref<string | null>(null);

const handleNavigate = (tab: any) => {
  activeTab.value = tab;
  localStorage.setItem('bq-learn-active-tab', tab);
};

const navItems: NavItem[] = [
  { id: 'home', label: 'Révision', icon: LayoutGrid },
  { id: 'editor', label: 'Éditeur', icon: BookOpen },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

const startRevisionSession = (deckId: string | null) => {
  activeSessionDeckId.value = deckId;
  activeTab.value = 'revision';
};

const finishRevisionSession = () => {
  activeSessionDeckId.value = null;
  activeTab.value = 'home';
  triggerDataUpdate();
};

const viewKey = ref(0);
const triggerDataUpdate = () => {
  viewKey.value++;
};

onMounted(async () => {
  try {
    await initializeCollections();
  } catch (err) {
    console.error('Error during bq-learn boot:', err);
  }
});
</script>

<template>
  <div class="app-shell">
    <AppHeader appName="bq-learn" appSubtitle="Mémoire Leitner" />

    <main class="app-content">
      <HomeView 
        v-if="activeTab === 'home'" 
        :key="'home-' + viewKey" 
        @data-updated="triggerDataUpdate" 
        @start-revision="startRevisionSession"
      />
      <RevisionView 
        v-else-if="activeTab === 'revision'" 
        :key="'rev-' + viewKey" 
        :deckId="activeSessionDeckId"
        @finish-session="finishRevisionSession"
      />
      <EditorView 
        v-else-if="activeTab === 'editor'" 
        :key="'edit-' + viewKey" 
        @data-updated="triggerDataUpdate" 
      />
      <SettingsView 
        v-else-if="activeTab === 'settings'" 
        :key="'set-' + viewKey" 
        @data-updated="triggerDataUpdate" 
      />
    </main>

    <AppBottomNav 
      v-if="activeTab !== 'revision'" 
      :modelValue="activeTab" 
      :items="navItems" 
      @update:modelValue="handleNavigate" 
    />

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
