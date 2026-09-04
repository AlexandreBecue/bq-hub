<script setup lang="ts">
  import { computed } from 'vue'
  import type { BreadcrumbItem, Exercise, Step } from '../utils/types'

  const props = defineProps<{
    timeline: Step[]
    currentIndex: number
    isResting: boolean
    sessionStatus: 'idle' | 'running' | 'paused' | 'finished'
    exerciseMap: Record<string, Exercise>
  }>()

  const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = []
    const seen = new Set<string>()

    props.timeline.forEach((step, index) => {
      if (step.type === 'rest') return

      if (seen.has(step.exerciseId!)) return

      seen.add(step.exerciseId!)

      items.push({
        exerciseId: step.exerciseId!,
        label: props.exerciseMap[step.exerciseId!]?.shortName ?? step.exerciseId!,
        firstStepIndex: index
      })
    })

    return items
  })

  const isCurrent = (item: BreadcrumbItem) => {
    return props.timeline[props.currentIndex]?.exerciseId === item.exerciseId
  }

  const isUpcoming = (item: BreadcrumbItem) => {
    if (!props.isResting) return false
    return props.timeline[props.currentIndex + 1]?.exerciseId === item.exerciseId
  }

  const referenceStep = computed(() => {
    if (props.isResting) {
      return props.timeline[props.currentIndex + 1]
    }
    return props.timeline[props.currentIndex]
  })

  const showSetsCounter = computed(() => {
    return (
      props.sessionStatus === 'running' &&
      !!referenceStep.value &&
      referenceStep.value.type === 'work' &&
      !!referenceStep.value.total &&
      referenceStep.value.total > 1
    )
  })

  const currentSet = computed(() => {
    return referenceStep.value?.index ?? 1
  })

  const totalSets = computed(() => {
    return referenceStep.value?.total ?? 1
  })
</script>

<template>
  <div class="timeline-wrapper">
    <div class="sets-counter" :style="{ visibility: showSetsCounter ? 'visible' : 'hidden' }">
      Tour {{ currentSet }} / {{ totalSets }}
    </div>

    <div class="timeline">
      <div
        v-for="item in breadcrumbItems"
        :key="item.exerciseId"
        class="timeline-step"
        :class="{
          current: isCurrent(item),
          upcoming: isUpcoming(item)
        }"
      >
        {{ item.label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
  .timeline-wrapper {
    width: 92%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.3rem;
    padding: 0;
    box-sizing: border-box;
  }

  .sets-counter {
    font-size: 0.9rem;
    opacity: 0.7;
    margin-bottom: 0.3rem;
  }

  .timeline {
    max-width: 100%;
    display: flex;
    gap: 0.6rem;
    overflow-x: auto;
  }

  .timeline-step {
    opacity: 0.3;
    white-space: nowrap;
  }

  .timeline-step.current {
    opacity: 1;
    font-weight: 600;
  }

  .timeline-step.upcoming {
    opacity: 0.6;
  }
</style>