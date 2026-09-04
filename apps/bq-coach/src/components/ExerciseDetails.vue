<script setup lang="ts">
  import type { Exercise } from '../utils/types'

  defineProps<{
    exercise: Exercise | null
  }>()
</script>

<template>
  <div v-if="exercise" class="exercise-card">
    <h2 class="exercise-title">{{ exercise.name }}</h2>
    
    <div v-if="exercise.notes" class="exercise-notes-box">
      <span class="quote-mark">“</span>
      <p class="notes-content">{{ exercise.notes }}</p>
    </div>

    <div class="exercise-grid">
      <div v-if="exercise.primaryMuscle" class="grid-item">
        <span class="grid-label">🎯 FOCUS</span>
        <span class="grid-value">{{ exercise.primaryMuscle }}</span>
        <div v-if="exercise.secondaryMuscles.length" class="chips-container">
          <span v-for="m in exercise.secondaryMuscles" :key="m" class="chip secondary-chip">
            {{ m }}
          </span>
        </div>
      </div>

      <div v-if="exercise.equipment.length" class="grid-item">
        <span class="grid-label">🛠️ MATÉRIEL</span>
        <div class="chips-container">
          <span v-for="eq in exercise.equipment" :key="eq" class="chip secondary-chip">
            {{ eq }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .exercise-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1.2rem;
    padding: 1.2rem;
    width: 92%;
    max-width: 360px;
    margin: 0.1rem auto 0 auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
  }

  .exercise-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, #ffffff 0%, #bbbbbb 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-align: center;
  }

  .exercise-notes-box {
    position: relative;
    background: rgba(255, 193, 7, 0.04);
    border-left: 3px solid #ffc107;
    padding: 0.5rem 0.8rem;
    border-radius: 0 0.6rem 0.8rem 0;
    text-align: left;
  }

  .quote-mark {
    position: absolute;
    top: -0.2rem;
    left: 0.4rem;
    font-size: 2rem;
    color: rgba(255, 193, 7, 0.15);
    font-family: serif;
    line-height: 1;
  }

  .notes-content {
    margin: 0;
    font-size: 0.85rem;
    font-style: italic;
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.4;
  }

  .exercise-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }

  /* Two-column layout if both items exist */
  @media (min-width: 360px) {
    .exercise-grid {
      grid-template-columns: repeat(v-bind("exercise ? (exercise.primaryMuscle && exercise.equipment.length ? 2 : 1) : 1"), minmax(0, 1fr));
    }
  }

  .grid-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 0.8rem;
    padding: 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    align-items: flex-start;
    text-align: left;
  }

  .grid-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.4);
  }

  .grid-value {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .chips-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    width: 100%;
    margin-top: 0.2rem;
  }

  .chip {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.4rem;
    border-radius: 1rem;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .secondary-chip {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Support for light color scheme if enabled */
  @media (prefers-color-scheme: light) {
    .exercise-title {
      background: linear-gradient(135deg, #111111 0%, #333333 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .exercise-card {
      background: rgba(0, 0, 0, 0.015);
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    .notes-content {
      color: rgba(0, 0, 0, 0.85);
    }
    .grid-item {
      background: rgba(0, 0, 0, 0.01);
      border: 1px solid rgba(0, 0, 0, 0.04);
    }
    .grid-label {
      color: rgba(0, 0, 0, 0.45);
    }
    .secondary-chip {
      background: rgba(0, 0, 0, 0.04);
      color: rgba(0, 0, 0, 0.65);
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
  }
</style>
