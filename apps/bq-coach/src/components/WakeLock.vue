<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isLocked = ref(false);
const shouldBeLocked = ref(false);
let wakeLock: any = null;

async function requestWakeLock() {
  shouldBeLocked.value = true;
  if (isLocked.value) return;

  try {
    if ('wakeLock' in navigator) {
      wakeLock = await (navigator as any).wakeLock.request('screen');
      isLocked.value = true;

      wakeLock.addEventListener('release', () => {
        isLocked.value = false;
      });
    }
  } catch (err) {
    console.warn('WakeLock non disponible ou refusé:', err);
  }
}

function releaseWakeLock() {
  shouldBeLocked.value = false;
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
    isLocked.value = false;
  }
}

async function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && shouldBeLocked.value) {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await (navigator as any).wakeLock.request('screen');
        isLocked.value = true;
        wakeLock.addEventListener('release', () => {
          isLocked.value = false;
        });
      }
    } catch (err) {
      console.warn('WakeLock ré-acquisition échouée:', err);
    }
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  releaseWakeLock();
});

defineExpose({
  requestWakeLock,
  releaseWakeLock,
  isLocked
});
</script>

<template>
  <!-- Non-visual helper component -->
</template>
