<script setup lang="ts">
import { useToast } from './useToast';
import { X } from '@lucide/vue';

const { toasts, removeToast } = useToast();
</script>

<template>
  <div class="toasts-container">
    <div v-for="toast in toasts" :key="toast.id" class="toast-item glass" :class="toast.type">
      <span class="toast-emoji">
        <span v-if="toast.type === 'success'">✔️</span>
        <span v-else-if="toast.type === 'error'">❌</span>
        <span v-else-if="toast.type === 'warning'">⚠️</span>
        <span v-else>ℹ️</span>
      </span>
      <span class="toast-message">{{ toast.message }}</span>
      <button class="toast-close" @click="removeToast(toast.id)" title="Fermer">
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.toasts-container {
  position: fixed;
  bottom: 80px; /* above the bottom navigation bar on mobile */
  right: 1.5rem;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 380px;
  width: calc(100% - 3rem);
  pointer-events: none;

  @media (min-width: 768px) {
    bottom: 1.5rem; /* higher up since bottom bar isn't a problem */
  }
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  animation: slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background-color: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--color-border);
  color: var(--color-text-main);
  font-size: 0.85rem;
  font-weight: 600;
}

.toast-item.success {
  border-color: rgba(16, 185, 129, 0.3);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
  .toast-emoji { color: #10b981; }
}

.toast-item.error {
  border-color: rgba(239, 68, 68, 0.3);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
  .toast-emoji { color: #ef4444; }
}

.toast-item.warning {
  border-color: rgba(245, 158, 11, 0.3);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.1);
  .toast-emoji { color: #f59e0b; }
}

.toast-item.info {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  .toast-emoji { color: #3b82f6; }
}

.toast-emoji {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1rem;
}

.toast-message {
  flex-grow: 1;
  line-height: 1.4;
}

.toast-close {
  background: transparent;
  border: none;
  font-size: 1.15rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  margin-left: auto;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
  
  &:hover {
    color: var(--color-text-main);
  }
}

@keyframes slide-in {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
