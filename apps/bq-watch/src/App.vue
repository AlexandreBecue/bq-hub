<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { MovieRecord } from './types';
import LibraryView from './components/LibraryView.vue';
import DebriefView from './components/DebriefView.vue';
import InboxView from './components/InboxView.vue';
import WatchlistView from './components/WatchlistView.vue';
import SettingsView from './components/SettingsView.vue';
import { initializeCollections } from './db/queries';
import { Film, Sparkles, Inbox, Bookmark, Settings } from '@lucide/vue';
import AppHeader from '@bq/theme/AppHeader.vue';
import AppBottomNav, { type NavItem } from '@bq/theme/AppBottomNav.vue';
import ToastsContainer from '@bq/theme/ToastsContainer.vue';
import './style.scss';

const activeTab = ref<'library' | 'debrief' | 'inbox' | 'watchlist' | 'settings'>(
  (localStorage.getItem('bq-watch-active-tab') as any) || 'library'
);

const debriefInitialMovie = ref<MovieRecord | null>(null);

const handleNavigate = (tab: any) => {
  activeTab.value = tab;
  localStorage.setItem('bq-watch-active-tab', tab);
};

const handleStartDebriefFromOtherView = (movie: MovieRecord) => {
  debriefInitialMovie.value = movie;
  handleNavigate('debrief');
};

const navItems: NavItem[] = [
  { id: 'library', label: 'Bibliothèque', icon: Film },
  { id: 'debrief', label: 'Débrief', icon: Sparkles },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'watchlist', label: 'À voir', icon: Bookmark },
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
    console.error('Erreur initialisation bq-watch:', err);
  }
});
</script>

<template>
  <div class="app-shell">
    <AppHeader appName="bq-watch" appSubtitle="Cinémathèque" />

    <main class="app-content">
      <LibraryView 
        v-if="activeTab === 'library'" 
        :key="'lib-' + viewKey" 
        @data-updated="triggerDataUpdate" 
        @start-debrief="handleStartDebriefFromOtherView"
      />
      <DebriefView 
        v-else-if="activeTab === 'debrief'" 
        :key="'deb-' + viewKey" 
        :initialMovie="debriefInitialMovie"
        @data-updated="triggerDataUpdate" 
      />
      <InboxView 
        v-else-if="activeTab === 'inbox'" 
        :key="'inbox-' + viewKey" 
        @data-updated="triggerDataUpdate" 
      />
      <WatchlistView 
        v-else-if="activeTab === 'watchlist'" 
        :key="'watch-' + viewKey" 
        @data-updated="triggerDataUpdate" 
        @start-debrief="handleStartDebriefFromOtherView"
      />
      <SettingsView 
        v-else-if="activeTab === 'settings'" 
        :key="'set-' + viewKey" 
        @data-updated="triggerDataUpdate" 
      />
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
