<script setup lang="ts">
import { computed } from 'vue';
import { dbStatus } from '@bq/db-sync';

const props = withDefaults(defineProps<{
  appName: string;
  appSubtitle?: string;
  logoSrc?: string;
}>(), {
  logoSrc: '/favicon.svg'
});

const dbStatusText = computed(() => {
  switch (dbStatus.value) {
    case 'loading': return 'Chargement...';
    case 'saving': return 'Sauvegarde...';
    case 'error': return 'Erreur DB';
    default: return 'Hors-ligne';
  }
});
</script>

<template>
  <header class="app-header glass">
    <div class="logo">
      <div class="logo-emoji-wrapper">
        <img :src="props.logoSrc" :alt="props.appName" class="brand-icon" />
      </div>
      <h1>{{ props.appName }}</h1>
      <span v-if="props.appSubtitle" class="logo-sub">{{ props.appSubtitle }}</span>
    </div>

    <div class="header-status">
      <div class="offline-badge" :class="dbStatus">
        <span class="pulse-indicator"></span>
        <span>{{ dbStatusText }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between !important;
  width: 100%;
  height: 60px;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 4px 6px -1px color-mix(in srgb, var(--color-black) 10%, transparent);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.65rem;

  .logo-emoji-wrapper {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }

  h1 {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.5px;
  }

  .logo-sub {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-sub);
    background-color: color-mix(in srgb, var(--color-white) 4%, transparent);
    border: 1px solid var(--color-border);
    padding: 0.15rem 0.45rem;
    border-radius: var(--radius-sm);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
}

.header-status {
  display: flex;
  align-items: center;
  margin-left: auto;
}

@media (min-width: 768px) {
  .app-header {
    height: 64px;
  }
}
</style>
