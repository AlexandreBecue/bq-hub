<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'

  const isLocked = ref(false)
  const shouldBeLocked = ref(false)
  let wakeLock: WakeLockSentinel | null = null

  async function requestWakeLock() {
    shouldBeLocked.value = true
    if (isLocked.value) return

    try {
      wakeLock = await navigator.wakeLock.request('screen')
      isLocked.value = true

      wakeLock.addEventListener('release', () => {
        isLocked.value = false
      })
    } catch (err) {
      console.error('WakeLock error:', err)
    }
  }

  function releaseWakeLock() {
    shouldBeLocked.value = false
    if (wakeLock) {
      wakeLock.release()
      wakeLock = null
      isLocked.value = false
    }
  }

  async function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && shouldBeLocked.value) {
      try {
        wakeLock = await navigator.wakeLock.request('screen')
        isLocked.value = true
        wakeLock.addEventListener('release', () => {
          isLocked.value = false
        })
      } catch (err) {
        console.error('WakeLock re-acquisition error:', err)
      }
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    releaseWakeLock()
  })

  defineExpose({
    requestWakeLock,
    releaseWakeLock,
    isLocked
  })
</script>
