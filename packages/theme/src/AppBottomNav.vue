<script setup lang="ts">
export interface NavItem {
  id: string;
  label: string;
  icon: any;
}

const props = defineProps<{
  modelValue: string;
  items: NavItem[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();
</script>

<template>
  <nav class="bottom-nav glass">
    <button 
      v-for="item in props.items" 
      :key="item.id"
      type="button"
      @click="emit('update:modelValue', item.id)" 
      :class="['nav-item', props.modelValue === item.id ? 'active' : '']"
    >
      <component :is="item.icon" class="nav-icon" />
      <span class="nav-label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 0.5rem;
  z-index: 1000;
  background: var(--color-bg-navbar, rgba(15, 23, 42, 0.95));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -4px 10px color-mix(in srgb, var(--color-black) 30%, transparent);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.5rem 0;
  transition: var(--transition);
  border-radius: var(--radius-sm);
  outline: none;
  flex: 1;
  max-width: 90px;

  &:hover {
    color: var(--color-text-sub);
  }

  &.active {
    color: var(--color-primary);

    .nav-icon {
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--color-primary) 40%, transparent));
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
}
</style>
