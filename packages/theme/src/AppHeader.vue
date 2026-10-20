<script setup lang="ts">
const props = withDefaults(defineProps<{
  appName: string;
  appSubtitle?: string;
  logoSrc?: string;
}>(), {
  logoSrc: '/favicon.svg'
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
  </header>
</template>

<style scoped lang="scss">
.app-header {
  display: flex;
  align-items: center;
  width: 100%;
  height: 60px;
  padding: 0 1rem;
  position: sticky;
  top: 0;
  z-index: 1000;
  background: var(--color-bg-navbar, rgba(15, 23, 42, 0.95));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 4px 6px -1px color-mix(in srgb, var(--color-black) 10%, transparent);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  white-space: nowrap;
  min-width: 0;

  .logo-emoji-wrapper {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

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
    white-space: nowrap;
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
    white-space: nowrap;
  }
}

@media (min-width: 768px) {
  .app-header {
    height: 64px;
    padding: 0 1.5rem;
  }
}
</style>
