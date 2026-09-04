<script setup lang="ts">
import { ref, onMounted } from 'vue';
import HomeView from './components/HomeView.vue';
import EntretienView from './components/EntretienView.vue';
import SettingsView from './components/SettingsView.vue';
import { initializeCollections } from './db/queries';
import { Fuel, Wrench, Settings } from '@lucide/vue';
import './style.scss';

const activeTab = ref<'carburant' | 'entretien' | 'settings'>(
  (localStorage.getItem('bq-car-active-tab') as any) || 'carburant'
);

const handleNavigate = (tab: 'carburant' | 'entretien' | 'settings') => {
  activeTab.value = tab;
  localStorage.setItem('bq-car-active-tab', tab);
};

// State key to trigger reactivity updates across views
const viewKey = ref(0);
const triggerDataUpdate = () => {
  viewKey.value++;
};

onMounted(async () => {
  try {
    // Initialise collections and run migrations
    await initializeCollections();
  } catch (err) {
    console.error('Error during app boot:', err);
  }
});
</script>

<template>
  <div class="app-shell">
    <!-- Main Header -->
    <header class="app-header glass">
      <div class="logo">
        <span class="logo-emoji">🚗</span>
        <h1>bq-car</h1>
        <span class="logo-sub">Suivi Automobile</span>
      </div>
    </header>

    <!-- Main Scrollable App Container -->
    <main class="app-content">
      <HomeView v-if="activeTab === 'carburant'" :key="'carb-' + viewKey" @data-updated="triggerDataUpdate" />
      <EntretienView v-else-if="activeTab === 'entretien'" :key="'ent-' + viewKey" @data-updated="triggerDataUpdate" />
      <SettingsView v-else-if="activeTab === 'settings'" :key="'set-' + viewKey" @data-updated="triggerDataUpdate" />
    </main>

    <!-- Mobile Bottom Navigation Bar -->
    <nav class="bottom-nav glass">
      <button 
        @click="handleNavigate('carburant')" 
        :class="['nav-item', activeTab === 'carburant' ? 'active' : '']"
      >
        <Fuel class="nav-icon" />
        <span class="nav-label">Carburant</span>
      </button>
      
      <button 
        @click="handleNavigate('entretien')" 
        :class="['nav-item', activeTab === 'entretien' ? 'active' : '']"
      >
        <Wrench class="nav-icon" />
        <span class="nav-label">Entretien</span>
      </button>
      
      <button 
        @click="handleNavigate('settings')" 
        :class="['nav-item', activeTab === 'settings' ? 'active' : '']"
      >
        <Settings class="nav-icon" />
        <span class="nav-label">Garage</span>
      </button>
    </nav>
  </div>
</template>

<style lang="scss">
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.app-header {
  position: sticky;
  top: 0;
  width: 100%;
  height: 60px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  z-index: 1000;
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  .logo-emoji {
    font-size: 1.5rem;
  }
  
  h1 {
    font-size: 1.35rem;
    font-weight: 900;
    letter-spacing: -0.025em;
    background: linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  .logo-sub {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background-color: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-color);
    padding: 0.15rem 0.45rem;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
  }
}

.app-content {
  flex-grow: 1;
  padding: 1.5rem 1.5rem 80px 1.5rem; /* bottom padding to clear the Bottom Bar */
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

/* Bottom Bar mobile navigation */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  z-index: 1000;
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.3);
  padding: 0 0.5rem;
}

.nav-item {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-muted);
  width: 18%;
  padding: 0.5rem 0;
  border-radius: var(--radius-sm);
  transition: var(--transition);
  outline: none;
  
  &:hover {
    color: var(--text-secondary);
  }
  
  &.active {
    color: var(--color-primary);
    
    .nav-icon {
      filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.4));
    }
  }
}

.nav-icon {
  width: 22px;
  height: 22px;
  transition: var(--transition);
}

.nav-label {
  font-size: 0.725rem;
  font-weight: 700;
  letter-spacing: 0.015em;
}

@media (min-width: 768px) {
  .app-header {
    height: 64px;
  }
  .app-content {
    padding: 2rem 2rem 90px 2rem;
  }
}
</style>
