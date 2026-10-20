<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { RefreshCw, X } from '@lucide/vue';

const props = defineProps<{
  appName?: string;
}>();

const {
  offlineReady,
  needRefresh,
  updateServiceWorker,
} = useRegisterSW();

const close = () => {
  offlineReady.value = false;
  needRefresh.value = false;
};
</script>

<template>
  <Transition name="fade-slide">
    <div v-if="offlineReady || needRefresh" class="pwa-toast glass" role="alert">
      <div class="pwa-toast-content">
        <div class="pwa-toast-icon">
          <RefreshCw class="animate-spin-slow" :size="18" />
        </div>
        <div class="pwa-toast-message">
          <span v-if="offlineReady">Prêt pour une utilisation hors-ligne.</span>
          <span v-else>Une nouvelle version{{ props.appName ? ` de ${props.appName}` : '' }} est disponible !</span>
        </div>
      </div>
      <div class="pwa-toast-actions">
        <button v-if="needRefresh" class="btn btn-primary btn-sm btn-update" @click="updateServiceWorker(true)">
          Mettre à jour
        </button>
        <button class="btn-close" @click="close" aria-label="Fermer">
          <X :size="18" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.pwa-toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius-lg, 16px);
  background: var(--color-bg-navbar, rgba(15, 23, 42, 0.95));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--color-border);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  max-width: 440px;

  @media (max-width: 992px) {
    right: 16px;
    left: 16px;
    bottom: 80px; /* Au-dessus de la barre de navigation sur mobile */
    max-width: calc(100vw - 32px);
    gap: 0.75rem;
  }
}

.pwa-toast-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.pwa-toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
  flex-shrink: 0;
}

.animate-spin-slow {
  animation: spin 8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.pwa-toast-message {
  font-size: 0.875rem;
  color: var(--color-text-main, #f8fafc);
  font-weight: 600;
  line-height: 1.4;
}

.pwa-toast-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn-update {
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-sm, 6px);
  white-space: nowrap;
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  transition: var(--transition);

  &:hover {
    color: var(--color-text-main, #ffffff);
    background: color-mix(in srgb, var(--color-white) 10%, transparent);
  }
}

/* Animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}
</style>
