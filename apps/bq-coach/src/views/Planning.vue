<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import exercisesData from "../assets/exercises.json"
  import workoutsData from '../assets/workouts.json'
  import { 
    getSavedWorkouts, 
    saveWorkoutsToLocalCache, 
    saveWorkoutsToDrive, 
    isAuthenticated 
  } from '../utils/gdrive'
  import WorkoutSummary from "../components/WorkoutSummary.vue"
  import type { Exercise } from "../utils/types.ts"

  const router = useRouter()

  const exercises = exercisesData as Array<Exercise>
  const exerciseMap = Object.fromEntries(exercises.map(e => [e.id, e]))
  const cardioExercises = computed(() => exercises.filter(ex => ex.category === 'cardio' || ex.type === 'cardio'))

  const workouts = ref<Record<number, any>>({ ...(getSavedWorkouts() ?? workoutsData) })
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const selectedDay = ref(0)
  const isOpen = ref(false)

  const session = computed(() => {
    const i = selectedDay.value+1 as 1|2|3|4|5|6|7
    const dayKey = i === 7 ? 0 : i
    return workouts.value[dayKey] ?? null
  })

  async function selectDay(index: number) {
    if (isEditing.value) {
      if (confirm("Voulez-vous enregistrer vos modifications de la séance de " + days[selectedDay.value] + " avant de changer de jour ?")) {
        await saveEditedSession()
      } else {
        isEditing.value = false
      }
    }
    selectedDay.value = index
    isOpen.value = false
  }

  function backHome() {
    router.push({ name: 'Home' })
  }

  // Editing state
  const isEditing = ref(false)
  const editedSession = ref<any>(null)
  
  // Exercise adding helpers
  const newCircuitExerciseId = ref('')
  const newFinisherExerciseId = ref('')

  const exerciseName = (id: string) => exerciseMap[id]?.name ?? id

  function startEditing() {
    const i = selectedDay.value+1 as 1|2|3|4|5|6|7
    const dayKey = i === 7 ? 0 : i
    
    // Deep copy current session or create a blank one
    const currentSession = workouts.value[dayKey]
    const hasSessionTitle = currentSession && (currentSession.strength?.title || currentSession.cardio?.title)
    if (hasSessionTitle) {
      const copy = JSON.parse(JSON.stringify(currentSession))
      
      // Ensure type is set
      if (!copy.type) {
        if (copy.strength && copy.cardio) copy.type = 'hybrid'
        else if (copy.strength) copy.type = 'strength'
        else if (copy.cardio) copy.type = 'cardio'
        else copy.type = 'rest'
      }

      // Flat-map strength fields to the root of editedSession for easy template binding
      if (copy.strength) {
        copy.title = copy.strength.title
        copy.sequence = copy.strength.sequence
        copy.sets = copy.strength.sets
        copy.warmup = copy.strength.warmup
        copy.exercises = copy.strength.exercises
        copy.finisher = copy.strength.finisher
      } else {
        // Initialize strength defaults in case they switch types later
        copy.title = ''
        copy.sequence = 'alternated'
        copy.sets = 4
        copy.warmup = null
        copy.exercises = []
        copy.finisher = null
      }
      
      // Ensure cardio object is fully initialized if present or placeholder
      if (copy.cardio) {
        copy.cardio.title = copy.cardio.title ?? 'Séance cardio'
        copy.cardio.exerciseId = copy.cardio.exerciseId ?? 'running'
        copy.cardio.durationMinutes = copy.cardio.durationMinutes ?? 30
        copy.cardio.interval = copy.cardio.interval ?? null
        copy.cardio.notes = copy.cardio.notes ?? ''
      } else {
        copy.cardio = {
          title: 'Séance cardio',
          exerciseId: 'running',
          durationMinutes: 30,
          interval: null,
          notes: ''
        }
      }
      editedSession.value = copy
    } else {
      editedSession.value = {
        type: 'strength',
        title: 'Nouvelle séance',
        sequence: 'alternated',
        sets: 4,
        warmup: null,
        exercises: [],
        finisher: null,
        cardio: {
          title: 'Séance cardio',
          exerciseId: 'running',
          durationMinutes: 30,
          interval: null,
          notes: ''
        }
      }
    }
    
    newCircuitExerciseId.value = ''
    newFinisherExerciseId.value = ''
    isEditing.value = true
  }

  function handleTypeChange() {
    if (editedSession.value.type === 'strength') {
      if (!editedSession.value.title && editedSession.value.cardio?.title) {
        editedSession.value.title = editedSession.value.cardio.title
      }
      editedSession.value.title = editedSession.value.title || 'Nouvelle séance'
      editedSession.value.sequence = editedSession.value.sequence || 'alternated'
      editedSession.value.sets = editedSession.value.sets || 4
      editedSession.value.exercises = editedSession.value.exercises || []
    } else if (editedSession.value.type === 'cardio') {
      if (!editedSession.value.cardio) {
        editedSession.value.cardio = {
          title: editedSession.value.title || 'Séance cardio',
          exerciseId: 'running',
          durationMinutes: 30,
          interval: null,
          notes: ''
        }
      } else if (editedSession.value.title) {
        editedSession.value.cardio.title = editedSession.value.title
      }
    } else if (editedSession.value.type === 'hybrid') {
      if (!editedSession.value.title) {
        editedSession.value.title = 'Majeur...'
      }
      editedSession.value.sequence = editedSession.value.sequence || 'alternated'
      editedSession.value.sets = editedSession.value.sets || 4
      editedSession.value.exercises = editedSession.value.exercises || []
      
      if (!editedSession.value.cardio) {
        editedSession.value.cardio = {
          title: 'Séance cardio',
          exerciseId: 'running',
          durationMinutes: 30,
          interval: null,
          notes: ''
        }
      }
    }
  }

  function toggleWarmup() {
    if (editedSession.value.warmup) {
      editedSession.value.warmup = null
    } else {
      editedSession.value.warmup = {
        exerciseId: exercises[0]?.id || '',
        workDuration: 120,
        restDuration: 10
      }
    }
  }

  function addExerciseToCircuit() {
    if (!newCircuitExerciseId.value) return
    editedSession.value.exercises.push({
      exerciseId: newCircuitExerciseId.value,
      workDuration: 30,
      restDuration: 30
    })
    newCircuitExerciseId.value = ''
  }

  function moveExercise(index: number, direction: number) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= editedSession.value.exercises.length) return
    const temp = editedSession.value.exercises[index]
    editedSession.value.exercises[index] = editedSession.value.exercises[targetIndex]
    editedSession.value.exercises[targetIndex] = temp
  }

  function removeExercise(index: number) {
    editedSession.value.exercises.splice(index, 1)
  }

  function toggleFinisher() {
    if (editedSession.value.finisher) {
      editedSession.value.finisher = null
    } else {
      editedSession.value.finisher = []
    }
  }

  function addExerciseToFinisher() {
    if (!newFinisherExerciseId.value) return
    if (!editedSession.value.finisher) {
      editedSession.value.finisher = []
    }
    editedSession.value.finisher.push({
      exerciseId: newFinisherExerciseId.value,
      sets: 3,
      workDuration: 20,
      restDuration: 20
    })
    newFinisherExerciseId.value = ''
  }

  function moveFinisher(index: number, direction: number) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= editedSession.value.finisher.length) return
    const temp = editedSession.value.finisher[index]
    editedSession.value.finisher[index] = editedSession.value.finisher[targetIndex]
    editedSession.value.finisher[targetIndex] = temp
  }

  function removeFinisher(index: number) {
    editedSession.value.finisher.splice(index, 1)
  }

  const isSaving = ref(false)
  const saveError = ref('')

  async function saveEditedSession() {
    const i = selectedDay.value+1 as 1|2|3|4|5|6|7
    const dayKey = i === 7 ? 0 : i

    isSaving.value = true
    saveError.value = ''

    try {
      const finalSession = JSON.parse(JSON.stringify(editedSession.value))
      
      if (finalSession.type === 'strength') {
        finalSession.strength = {
          title: finalSession.title ?? 'Majeur...',
          sequence: finalSession.sequence ?? 'alternated',
          sets: finalSession.sets ?? 4,
          warmup: finalSession.warmup ?? null,
          exercises: finalSession.exercises ?? [],
          finisher: finalSession.finisher ?? null
        }
        delete finalSession.cardio
        // Remove root-level copies to keep clean schema
        delete finalSession.title
        delete finalSession.sequence
        delete finalSession.sets
        delete finalSession.warmup
        delete finalSession.exercises
        delete finalSession.finisher
      } else if (finalSession.type === 'cardio') {
        if (!finalSession.cardio) {
          finalSession.cardio = {
            title: finalSession.title ?? 'Séance cardio',
            exerciseId: 'running',
            durationMinutes: 30,
            interval: null,
            notes: ''
          }
        } else if (finalSession.title && !finalSession.cardio.title) {
          finalSession.cardio.title = finalSession.title
        }
        
        // Ensure numbers are properly parsed
        finalSession.cardio.durationMinutes = Number(finalSession.cardio.durationMinutes) || 30
        if (finalSession.cardio.interval !== undefined && finalSession.cardio.interval !== null) {
          const val = Number(finalSession.cardio.interval)
          finalSession.cardio.interval = isNaN(val) || val <= 0 ? null : val
        }

        delete finalSession.strength
        // Remove root-level copies to keep clean schema
        delete finalSession.title
        delete finalSession.sequence
        delete finalSession.sets
        delete finalSession.warmup
        delete finalSession.exercises
        delete finalSession.finisher
      } else if (finalSession.type === 'hybrid') {
        finalSession.strength = {
          title: finalSession.title ?? 'Majeur...',
          sequence: finalSession.sequence ?? 'alternated',
          sets: finalSession.sets ?? 4,
          warmup: finalSession.warmup ?? null,
          exercises: finalSession.exercises ?? [],
          finisher: finalSession.finisher ?? null
        }
        
        if (!finalSession.cardio) {
          finalSession.cardio = {
            title: 'Séance cardio',
            exerciseId: 'running',
            durationMinutes: 30,
            interval: null,
            notes: ''
          }
        }
        
        // Ensure numbers are properly parsed
        finalSession.cardio.durationMinutes = Number(finalSession.cardio.durationMinutes) || 30
        if (finalSession.cardio.interval !== undefined && finalSession.cardio.interval !== null) {
          const val = Number(finalSession.cardio.interval)
          finalSession.cardio.interval = isNaN(val) || val <= 0 ? null : val
        }

        // Remove root-level copies to keep clean schema
        delete finalSession.title
        delete finalSession.sequence
        delete finalSession.sets
        delete finalSession.warmup
        delete finalSession.exercises
        delete finalSession.finisher
      } else if (finalSession.type === 'rest') {
        delete finalSession.strength
        delete finalSession.cardio
        // Remove root-level copies to keep clean schema
        delete finalSession.title
        delete finalSession.sequence
        delete finalSession.sets
        delete finalSession.warmup
        delete finalSession.exercises
        delete finalSession.finisher
      }

      // Update local state
      workouts.value[dayKey] = finalSession
      
      // Save locally
      saveWorkoutsToLocalCache(workouts.value)
      
      // Save to Google Drive if authenticated
      if (isAuthenticated()) {
        await saveWorkoutsToDrive(workouts.value)
      }
      
      isEditing.value = false
    } catch (err: any) {
      console.error(err)
      saveError.value = err.message || "Erreur lors de la sauvegarde."
    } finally {
      isSaving.value = false
    }
  }

  function cancelEditing() {
    isEditing.value = false
    saveError.value = ''
  }

  async function resetAllToDefault() {
    if (confirm("Voulez-vous vraiment réinitialiser toutes les séances de la semaine aux valeurs par défaut ? Vos modifications locales seront perdues.")) {
      isSaving.value = true
      try {
        workouts.value = { ...workoutsData }
        saveWorkoutsToLocalCache(workoutsData)
        if (isAuthenticated()) {
          await saveWorkoutsToDrive(workoutsData)
        }
      } catch (err: any) {
        alert("Erreur lors de la mise à jour sur Google Drive : " + err.message)
      } finally {
        isSaving.value = false
      }
    }
  }
</script>

<template>
  <div class="planning-header">
    <button
      class="back-button"
      @click="backHome"
      :disabled="isSaving"
    >
      Retour
    </button>
  </div>
  <div class="planning">
    <h1>📅 Planning</h1>

    <span class="choose-label">Choisir un jour :</span>
    
    <div class="custom-select">
      <button class="select-trigger" @click="isOpen = !isOpen" :class="{ 'trigger-active': isOpen }">
        <span>{{ days[selectedDay] }}</span>
        <span class="arrow" :class="{ 'arrow-rotate': isOpen }">▼</span>
      </button>
      
      <div v-if="isOpen" class="select-options-box">
        <div 
          v-for="(day, index) in days" 
          :key="index" 
          class="select-option-item"
          :class="{ 'item-selected': selectedDay === index }"
          @click="selectDay(index)"
        >
          {{ day }}
          <span v-if="selectedDay === index" class="selected-checkmark">✓</span>
        </div>
      </div>
    </div>

    <div v-if="!isEditing" style="width:100%">
      <div v-if="session && (session.strength?.title || session.cardio?.title)">
        <WorkoutSummary :session="session" :exerciseMap="exerciseMap"/>
        
        <div class="planning-actions">
          <button class="btn-edit" @click="startEditing">
            ✏️ Éditer la séance
          </button>
        </div>
      </div>
      <div v-else class="rest-day-card">
        <p class="rest-text">🍃 Journée de repos</p>
        <button class="btn-edit btn-create" @click="startEditing">
          ➕ Créer une séance pour ce jour
        </button>
      </div>

      <div class="global-actions">
        <button class="btn-reset" @click="resetAllToDefault" :disabled="isSaving">
          🔄 Réinitialiser la semaine
        </button>
      </div>
    </div>

    <!-- Workout Editor Form -->
    <div v-else class="workout-editor">
      <div class="editor-header">
        <h2>✏️ Éditeur de Séance</h2>
        <span class="editor-day-badge">{{ days[selectedDay] }}</span>
      </div>

      <!-- Type de Séance -->
      <div class="editor-section">
        <div class="form-group">
          <label class="form-label">Type de séance</label>
          <select v-model="editedSession.type" class="form-select" @change="handleTypeChange">
            <option value="strength">🏋️‍♂️ Musculation</option>
            <option value="cardio">🏃‍♂️ Cardio</option>
            <option value="hybrid">⚡ Hybride (Muscu + Cardio)</option>
            <option value="rest">🍃 Repos</option>
          </select>
        </div>
      </div>

      <!-- Message pour repos -->
      <div v-if="editedSession.type === 'rest'" class="editor-section-card" style="padding: 1.5rem; text-align: center;">
        <p style="opacity: 0.8; margin: 0; font-size: 0.95rem;">🍃 Cette journée sera configurée comme une journée de repos.</p>
      </div>

      <!-- Title & Sets -->
      <div v-if="editedSession.type === 'strength' || editedSession.type === 'hybrid' || editedSession.type === 'cardio'" class="editor-section">
        <div class="form-group">
          <label class="form-label">
            {{ editedSession.type === 'hybrid' ? 'Titre de la musculation' : 'Titre de la séance' }}
          </label>
          <input type="text" v-model="editedSession.title" class="form-input" placeholder="Ex: Majeur pectoraux..." required />
        </div>
        <div v-if="editedSession.type === 'strength' || editedSession.type === 'hybrid'" class="form-group">
          <label class="form-label">Nombre de séries (Circuit principal)</label>
          <div class="numeric-input-wrapper">
            <button type="button" class="btn-num-adjust" @click="editedSession.sets = Math.max(1, editedSession.sets - 1)">-</button>
            <input type="number" v-model.number="editedSession.sets" class="form-input text-center" min="1" max="10" />
            <button type="button" class="btn-num-adjust" @click="editedSession.sets = Math.min(10, editedSession.sets + 1)">+</button>
          </div>
        </div>
      </div>

      <!-- Warmup -->
      <div v-if="editedSession.type === 'strength' || editedSession.type === 'hybrid'" class="editor-section-card">
        <div class="card-section-header">
          <h3>🔥 Échauffement</h3>
          <button type="button" class="btn-toggle" @click="toggleWarmup" :class="editedSession.warmup ? 'btn-toggle-remove' : 'btn-toggle-add'">
            {{ editedSession.warmup ? '✕ Supprimer' : '➕ Ajouter' }}
          </button>
        </div>

        <div v-if="editedSession.warmup" class="card-section-body">
          <div class="form-group">
            <label class="form-label">Exercice</label>
            <select v-model="editedSession.warmup.exerciseId" class="form-select">
              <option v-for="ex in exercises" :key="ex.id" :value="ex.id">{{ ex.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Repos (s)</label>
              <input type="number" v-model.number="editedSession.warmup.restDuration" class="form-input" min="0" />
            </div>
            <div class="form-group">
              <label class="form-label">Travail (s)</label>
              <input type="number" v-model.number="editedSession.warmup.workDuration" class="form-input" min="1" />
            </div>
          </div>
        </div>
      </div>

      <!-- Circuit principal -->
      <div v-if="editedSession.type === 'strength' || editedSession.type === 'hybrid'" class="editor-section-card">
        <div class="card-section-header">
          <h3>🔁 Circuit principal</h3>
          <span class="exercise-count-badge">{{ editedSession.exercises.length }} exos</span>
        </div>

        <div class="card-section-body">
          <div v-if="editedSession.exercises.length === 0" class="empty-list-text">
            Aucun exercice dans le circuit. Ajoutez-en un ci-dessous !
          </div>
          <div v-else class="exercise-edit-list">
            <div v-for="(ex, index) in editedSession.exercises" :key="index" class="exercise-edit-row">
              <div class="exercise-row-header">
                <div class="exercise-row-title">
                  <span class="exercise-row-index">{{ Number(index) + 1 }}</span>
                  <span class="exercise-row-name">{{ exerciseName(ex.exerciseId) }}</span>
                </div>
                <div class="exercise-row-actions">
                  <button type="button" class="btn-row-action" @click="moveExercise(Number(index), -1)" :disabled="Number(index) === 0">▲</button>
                  <button type="button" class="btn-row-action" @click="moveExercise(Number(index), 1)" :disabled="Number(index) === editedSession.exercises.length - 1">▼</button>
                  <button type="button" class="btn-row-action btn-row-danger" @click="removeExercise(Number(index))">✕</button>
                </div>
              </div>
              
              <div class="form-group row-inline-select">
                <label class="form-label">Modifier l'exercice</label>
                <select v-model="ex.exerciseId" class="form-select select-sm">
                  <option v-for="item in exercises" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Repos (s)</label>
                  <input type="number" v-model.number="ex.restDuration" class="form-input input-sm" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Travail (s)</label>
                  <input type="number" v-model.number="ex.workDuration" class="form-input input-sm" min="1" />
                </div>
              </div>
            </div>
          </div>

          <!-- Add to circuit -->
          <div class="add-exercise-box">
            <h4 class="add-sub-title">➕ Ajouter un exercice</h4>
            <div class="add-controls">
              <select v-model="newCircuitExerciseId" class="form-select select-add">
                <option value="">-- Choisir un exercice --</option>
                <option v-for="ex in exercises" :key="ex.id" :value="ex.id">{{ ex.name }}</option>
              </select>
              <button type="button" class="btn-add-action" @click="addExerciseToCircuit" :disabled="!newCircuitExerciseId">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Finisher -->
      <div v-if="editedSession.type === 'strength' || editedSession.type === 'hybrid'" class="editor-section-card">
        <div class="card-section-header">
          <h3>💀 Finisseur</h3>
          <button type="button" class="btn-toggle" @click="toggleFinisher" :class="editedSession.finisher ? 'btn-toggle-remove' : 'btn-toggle-add'">
            {{ editedSession.finisher ? '✕ Supprimer' : '➕ Ajouter' }}
          </button>
        </div>

        <div v-if="editedSession.finisher" class="card-section-body">
          <div v-if="editedSession.finisher.length === 0" class="empty-list-text">
            Aucun exercice dans le finisseur. Ajoutez-en un ci-dessous !
          </div>
          <div v-else class="exercise-edit-list">
            <div v-for="(ex, index) in editedSession.finisher" :key="index" class="exercise-edit-row">
              <div class="exercise-row-header">
                <div class="exercise-row-title">
                  <span class="exercise-row-index index-finisher">F{{ Number(index) + 1 }}</span>
                  <span class="exercise-row-name">{{ exerciseName(ex.exerciseId) }}</span>
                </div>
                <div class="exercise-row-actions">
                  <button type="button" class="btn-row-action" @click="moveFinisher(Number(index), -1)" :disabled="Number(index) === 0">▲</button>
                  <button type="button" class="btn-row-action" @click="moveFinisher(Number(index), 1)" :disabled="Number(index) === editedSession.finisher.length - 1">▼</button>
                  <button type="button" class="btn-row-action btn-row-danger" @click="removeFinisher(Number(index))">✕</button>
                </div>
              </div>

              <div class="form-group row-inline-select">
                <label class="form-label">Modifier l'exercice</label>
                <select v-model="ex.exerciseId" class="form-select select-sm">
                  <option v-for="item in exercises" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </div>

              <div class="form-row form-row-three">
                <div class="form-group">
                  <label class="form-label">Séries</label>
                  <input type="number" v-model.number="ex.sets" class="form-input input-sm" min="1" />
                </div>
                <div class="form-group">
                  <label class="form-label">Repos (s)</label>
                  <input type="number" v-model.number="ex.restDuration" class="form-input input-sm" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Travail (s)</label>
                  <input type="number" v-model.number="ex.workDuration" class="form-input input-sm" min="1" />
                </div>
              </div>
            </div>
          </div>

          <!-- Add to finisher -->
          <div class="add-exercise-box">
            <h4 class="add-sub-title">➕ Ajouter un exercice finisseur</h4>
            <div class="add-controls">
              <select v-model="newFinisherExerciseId" class="form-select select-add">
                <option value="">-- Choisir un exercice --</option>
                <option v-for="ex in exercises" :key="ex.id" :value="ex.id">{{ ex.name }}</option>
              </select>
              <button type="button" class="btn-add-action" @click="addExerciseToFinisher" :disabled="!newFinisherExerciseId">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cardio Parameters Card -->
      <div v-if="editedSession.type === 'cardio' || editedSession.type === 'hybrid'" class="editor-section-card">
        <div class="card-section-header">
          <h3>🏃‍♂️ Paramètres Cardio</h3>
        </div>

        <div v-if="editedSession.cardio" class="card-section-body">
          <div class="form-group">
            <label class="form-label">Titre de l'activité cardio</label>
            <input type="text" v-model="editedSession.cardio.title" class="form-input" placeholder="Ex: Course à pied, Endurance..." required />
          </div>

          <div class="form-group" style="margin-top: 0.6rem;">
            <label class="form-label">Activité</label>
            <select v-model="editedSession.cardio.exerciseId" class="form-select">
              <option v-for="ex in cardioExercises" :key="ex.id" :value="ex.id">{{ ex.name }}</option>
            </select>
          </div>

          <div class="form-row" style="margin-top: 0.6rem;">
            <div class="form-group">
              <label class="form-label">Durée (minutes)</label>
              <input type="number" v-model.number="editedSession.cardio.durationMinutes" class="form-input" min="1" />
            </div>
            <div class="form-group">
              <label class="form-label">Intervalle vibration (s) — facultatif</label>
              <input type="number" v-model.number="editedSession.cardio.interval" class="form-input" placeholder="Ex: 600 pour 10min" min="0" />
            </div>
          </div>

          <div class="form-group" style="margin-top: 0.8rem;">
            <label class="form-label">Notes / Instructions cardio</label>
            <textarea v-model="editedSession.cardio.notes" class="form-textarea" placeholder="Instructions pour la séance cardio..."></textarea>
          </div>
        </div>
      </div>

      <!-- Save & Cancel -->
      <div class="editor-global-actions">
        <p v-if="saveError" class="save-error-msg">⚠️ {{ saveError }}</p>
        <button type="button" class="btn-save-workout" @click="saveEditedSession" :disabled="isSaving">
          {{ isSaving ? 'Sauvegarde...' : '💾 Enregistrer la séance' }}
        </button>
        <button type="button" class="btn-cancel-workout" @click="cancelEditing" :disabled="isSaving">
          Annuler
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .planning-header {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    max-width: 370px;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
  }

  .back-button {
    font-size: 0.95rem;
    padding: 0.4rem 0.8rem;
  }

  .planning {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem 0;
    text-align: center;
    width: 100%;
    max-width: 370px;
    margin: 0 auto;
    box-sizing: border-box;
  }

  h1 {
    font-size: 2rem;
  }

  .choose-label {
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    margin-top: 0.4rem;
  }

  /* Custom Dropdown Styling */
  .custom-select {
    position: relative;
    width: 200px;
    margin-bottom: 0.5rem;
    user-select: none;
  }

  .select-trigger {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    font-size: 1rem;
    font-weight: 600;
    padding: 0.6rem 1.2rem;
    border-radius: 0.6rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: white;
    cursor: pointer;
    transition: all 0.25s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }

  .select-trigger:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .trigger-active {
    border-color: #ffc107;
    box-shadow: 0 0 10px rgba(255, 193, 7, 0.15);
  }

  .arrow {
    font-size: 0.7rem;
    opacity: 0.6;
    transition: transform 0.25s ease;
  }

  .arrow-rotate {
    transform: rotate(180deg);
    opacity: 1;
    color: #ffc107;
  }

  .select-options-box {
    position: absolute;
    top: calc(100% + 0.4rem);
    left: 0;
    width: 100%;
    background: #1e1e1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.6rem;
    padding: 0.3rem;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    max-height: 250px;
    overflow-y: auto;
  }

  .select-option-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.8rem;
    font-size: 0.95rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    border-radius: 0.4rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .select-option-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }

  .item-selected {
    background: rgba(255, 193, 7, 0.1) !important;
    color: #ffc107 !important;
    font-weight: 600;
  }

  .selected-checkmark {
    font-size: 0.8rem;
    font-weight: 800;
  }

  /* Support for light color scheme if enabled */
  @media (prefers-color-scheme: light) {
    .choose-label {
      color: rgba(0, 0, 0, 0.45);
    }
    .select-trigger {
      background: rgba(0, 0, 0, 0.015);
      border: 1px solid rgba(0, 0, 0, 0.06);
      color: #222222;
    }
    .select-trigger:hover {
      background: rgba(0, 0, 0, 0.03);
    }
    .select-options-box {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
    }
    .select-option-item {
      color: #333333;
    }
    .select-option-item:hover {
      background: rgba(0, 0, 0, 0.02);
    }
    .item-selected {
      background: rgba(255, 193, 7, 0.08) !important;
    }
  }

  /* Workout Editor & Actions Styling */
  .planning-actions, .global-actions, .editor-global-actions {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    width: 100%;
    max-width: 400px;
    margin: 1.5rem auto 0 auto;
  }

  .global-actions {
    margin-top: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 1.5rem;
  }

  .btn-edit, .btn-reset, .btn-save-workout, .btn-cancel-workout, .btn-add-action, .btn-num-adjust {
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    padding: 0.7rem 1.2rem;
    border-radius: 0.6rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .btn-edit {
    background: #ffc107;
    color: #121212;
    box-shadow: 0 4px 15px rgba(255, 193, 7, 0.2);
  }

  .btn-edit:hover {
    background: #ffca2c;
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(255, 193, 7, 0.3);
  }

  .btn-create {
    background: #28a745;
    color: white;
    box-shadow: 0 4px 15px rgba(40, 167, 69, 0.2);
  }

  .btn-create:hover {
    background: #218838;
    box-shadow: 0 6px 18px rgba(40, 167, 69, 0.3);
  }

  .btn-reset {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
  }

  .btn-reset:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  .rest-day-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 1rem;
    padding: 2rem 1.5rem;
    max-width: 400px;
    width: 100%;
    margin: 1rem auto;
    text-align: center;
  }

  .rest-text {
    font-size: 1.1rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 1.5rem;
  }

  /* Workout Editor */
  .workout-editor {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
    text-align: left;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 0.8rem;
    margin-bottom: 0.5rem;
  }

  .editor-header h2 {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
  }

  .editor-day-badge {
    background: rgba(255, 193, 7, 0.15);
    color: #ffc107;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.3rem 0.8rem;
    border-radius: 10rem;
    text-transform: uppercase;
  }

  .editor-section, .editor-section-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 1rem;
    padding: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-sizing: border-box;
  }

  .card-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 0.6rem;
    margin-bottom: 0.2rem;
  }

  .card-section-header h3 {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
    color: #ffffff;
  }

  .card-section-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
  }

  .form-label {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
  }

  .form-input, .form-select, .form-textarea {
    font-family: inherit;
    font-size: 0.95rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: white;
    padding: 0.6rem 0.8rem;
    border-radius: 0.5rem;
    width: 100%;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  /* Prevent white-on-white text in standard select option elements */
  .form-select option, select option {
    background-color: #1e1e1e;
    color: #ffffff;
  }

  .form-input:focus, .form-select:focus, .form-textarea:focus {
    border-color: #ffc107;
    outline: none;
    box-shadow: 0 0 8px rgba(255, 193, 7, 0.15);
  }

  .form-row {
    display: flex;
    gap: 0.8rem;
    width: 100%;
  }

  .form-row-three {
    display: flex;
    gap: 0.5rem;
    width: 100%;
  }

  .numeric-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-num-adjust {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: white;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
  }

  .btn-num-adjust:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .text-center {
    text-align: center;
  }

  .btn-toggle {
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.3rem 0.6rem;
    border-radius: 0.4rem;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-toggle-add {
    background: rgba(40, 167, 69, 0.15);
    color: #28a745;
  }

  .btn-toggle-add:hover {
    background: rgba(40, 167, 69, 0.25);
  }

  .btn-toggle-remove {
    background: rgba(220, 53, 69, 0.15);
    color: #dc3545;
  }

  .btn-toggle-remove:hover {
    background: rgba(220, 53, 69, 0.25);
  }

  /* Exercise list rows editing */
  .exercise-edit-list {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .exercise-edit-row {
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 0.8rem;
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .exercise-row-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    padding-bottom: 0.4rem;
  }

  .exercise-row-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
  }

  .exercise-row-index {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    font-weight: 700;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 10rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .index-finisher {
    background: rgba(220, 53, 69, 0.1);
    color: #dc3545;
  }

  .exercise-row-name {
    font-size: 0.95rem;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    color: #ffffff;
  }

  .exercise-row-actions {
    display: flex;
    gap: 0.3rem;
  }

  .btn-row-action {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    width: 1.8rem;
    height: 1.8rem;
    padding: 0;
    border-radius: 0.3rem;
    font-size: 0.75rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .btn-row-action:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .btn-row-action:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .btn-row-danger {
    background: rgba(220, 53, 69, 0.1) !important;
    border-color: rgba(220, 53, 69, 0.15) !important;
    color: #dc3545 !important;
  }

  .btn-row-danger:hover {
    background: #dc3545 !important;
    color: white !important;
  }

  .row-inline-select {
    gap: 0.2rem;
  }

  .select-sm, .input-sm {
    font-size: 0.85rem;
    padding: 0.4rem 0.6rem;
    border-radius: 0.4rem;
  }

  .exercise-count-badge {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 0.3rem;
  }

  .empty-list-text {
    text-align: center;
    padding: 1.5rem;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.35);
    background: rgba(0, 0, 0, 0.1);
    border-radius: 0.6rem;
    border: 1px dashed rgba(255, 255, 255, 0.05);
  }

  /* Add exercise block */
  .add-exercise-box {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding-top: 1rem;
    margin-top: 0.5rem;
  }

  .add-sub-title {
    font-size: 0.85rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: rgba(255, 255, 255, 0.5);
  }

  .add-controls {
    display: flex;
    gap: 0.6rem;
    width: 100%;
  }

  .select-add {
    flex-grow: 1;
  }

  .btn-add-action {
    background: #007bff;
    color: white;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    box-shadow: 0 3px 10px rgba(0, 123, 255, 0.2);
  }

  .btn-add-action:hover:not(:disabled) {
    background: #0069d9;
    box-shadow: 0 5px 12px rgba(0, 123, 255, 0.3);
  }

  .btn-add-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* Editor Save/Cancel */
  .btn-save-workout {
    background: #ffc107;
    color: #121212;
    font-size: 1.05rem;
    padding: 0.8rem;
    box-shadow: 0 4px 15px rgba(255, 193, 7, 0.2);
  }

  .btn-save-workout:hover:not(:disabled) {
    background: #ffca2c;
    box-shadow: 0 6px 18px rgba(255, 193, 7, 0.3);
  }

  .btn-save-workout:disabled, .btn-cancel-workout:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-cancel-workout {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    padding: 0.8rem;
  }

  .btn-cancel-workout:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  .save-error-msg {
    color: #dc3545;
    font-size: 0.9rem;
    font-weight: 600;
    text-align: center;
    margin: 0;
  }

  /* Light preferences support */
  @media (prefers-color-scheme: light) {
    .btn-reset {
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.06);
      color: rgba(0, 0, 0, 0.6);
    }
    .btn-reset:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.05);
      color: #121212;
    }
    .rest-day-card {
      background: rgba(0, 0, 0, 0.01);
      border: 1px solid rgba(0, 0, 0, 0.04);
    }
    .rest-text {
      color: rgba(0, 0, 0, 0.7);
    }
    .editor-header {
      border-bottom-color: rgba(0, 0, 0, 0.08);
    }
    .editor-day-badge {
      background: rgba(255, 193, 7, 0.1);
    }
    .editor-section, .editor-section-card {
      background: #ffffff;
      border-color: rgba(0, 0, 0, 0.06);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
    }
    .card-section-header {
      border-bottom-color: rgba(0, 0, 0, 0.05);
    }
    .card-section-header h3 {
      color: #222222;
    }
    .form-label {
      color: rgba(0, 0, 0, 0.45);
    }
    .form-input, .form-select, .form-textarea {
      background: rgba(0, 0, 0, 0.015);
      border-color: rgba(0, 0, 0, 0.08);
      color: #222222;
    }
    .form-select option, select option {
      background-color: #ffffff;
      color: #222222;
    }
    .btn-num-adjust {
      background: rgba(0, 0, 0, 0.02);
      border-color: rgba(0, 0, 0, 0.06);
      color: #222222;
    }
    .btn-num-adjust:hover {
      background: rgba(0, 0, 0, 0.05);
    }
    .exercise-edit-row {
      background: rgba(0, 0, 0, 0.008);
      border-color: rgba(0, 0, 0, 0.04);
    }
    .exercise-row-header {
      border-bottom-color: rgba(0, 0, 0, 0.03);
    }
    .exercise-row-index {
      background: rgba(0, 0, 0, 0.05);
      color: rgba(0, 0, 0, 0.5);
    }
    .exercise-row-name {
      color: #222222;
    }
    .btn-row-action {
      background: rgba(0, 0, 0, 0.02);
      border-color: rgba(0, 0, 0, 0.04);
      color: rgba(0, 0, 0, 0.6);
    }
    .btn-row-action:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.05);
      color: #121212;
    }
    .exercise-count-badge {
      background: rgba(0, 0, 0, 0.03);
      color: rgba(0, 0, 0, 0.5);
    }
    .empty-list-text {
      color: rgba(0, 0, 0, 0.4);
      background: rgba(0, 0, 0, 0.005);
      border-color: rgba(0, 0, 0, 0.04);
    }
    .add-exercise-box {
      border-top-color: rgba(0, 0, 0, 0.05);
    }
    .add-sub-title {
      color: rgba(0, 0, 0, 0.45);
    }
    .btn-cancel-workout {
      background: rgba(0, 0, 0, 0.02);
      border-color: rgba(0, 0, 0, 0.06);
      color: rgba(0, 0, 0, 0.7);
    }
    .btn-cancel-workout:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.05);
      color: #121212;
    }
  }
</style>