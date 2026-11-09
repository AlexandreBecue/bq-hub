<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, type RecordEntry } from '../db/index';
import { syncEngine } from '../db/google-drive';
import { generateDemoData, initializeCollections, getCardioSports, addCardioSport, deleteCardioSport } from '../db/queries';
import BaseSettings from '@bq/theme/BaseSettings.vue';
import { Activity, Plus, Trash2 } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

const isDbEmpty = ref(true);
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Sports State
const sports = ref<RecordEntry[]>([]);
const newSportName = ref('');
const newSportUnit = ref<'km' | 'm'>('km');

const loadSports = async () => {
  sports.value = await getCardioSports();
};

const checkDbStatus = async () => {
  const count = await db.records.count();
  isDbEmpty.value = count === 0;
};

onMounted(async () => {
  await checkDbStatus();
  await loadSports();
});

const handleDataUpdated = async () => {
  await checkDbStatus();
  await loadSports();
  emit('data-updated');
};

const handleClearDatabase = async () => {
  await initializeCollections();
  await checkDbStatus();
  await loadSports();
  emit('data-updated');
};

const handleGenerateDemo = async () => {
  await generateDemoData();
  await checkDbStatus();
  await loadSports();
  emit('data-updated');
};

const handleAddSport = async () => {
  const name = newSportName.value.trim();
  if (!name) return;

  try {
    await addCardioSport(name, newSportUnit.value);
    newSportName.value = '';
    await loadSports();
    toast.success(`Sport "${name}" ajouté !`);
    emit('data-updated');
  } catch (err) {
    console.error('Erreur ajout sport:', err);
    toast.error("Erreur lors de l'ajout du sport.");
  }
};

const handleDeleteSport = async (id: string, name: string) => {
  try {
    await deleteCardioSport(id);
    await loadSports();
    toast.success(`Sport "${name}" supprimé.`);
    emit('data-updated');
  } catch (err) {
    console.error('Erreur suppression sport:', err);
    toast.error("Erreur lors de la suppression du sport.");
  }
};
</script>

<template>
  <BaseSettings
    :db="db"
    :syncEngine="syncEngine"
    :clientId="clientId"
    :isDbEmpty="isDbEmpty"
    exportFileNamePrefix="bq-coach"
    @data-updated="handleDataUpdated"
    @clear-database="handleClearDatabase"
    @generate-demo="handleGenerateDemo"
  >
    <!-- Sports Management Custom Slot -->
    <div class="custom-settings-content">
      <div class="card glass sports-card">
        <div class="card-header">
          <div class="icon-wrapper primary">
            <Activity class="icon" />
          </div>
          <h2>Sports cardio personnalisés</h2>
        </div>
        <p class="card-desc">
          Configure les disciplines sportives proposées lors de l'enregistrement de tes séances cardio.
        </p>

        <!-- Form Add Sport -->
        <div class="sports-form-row">
          <input 
            v-model="newSportName" 
            type="text" 
            placeholder="Ex: Rameur, Natation, Escalade..." 
            class="input sport-name-input"
            @keyup.enter="handleAddSport"
          />
          <select v-model="newSportUnit" class="select sport-unit-select">
            <option value="km">km</option>
            <option value="m">m</option>
          </select>
          <button 
            @click="handleAddSport" 
            class="btn btn-primary add-sport-btn"
            title="Ajouter ce sport"
            :disabled="!newSportName.trim()"
          >
            <Plus :size="16" />
          </button>
        </div>

        <!-- Sports List -->
        <div v-if="sports.length === 0" class="text-muted text-center py-3 text-sm">
          Aucun sport enregistré. Ajoute tes disciplines favorites.
        </div>

        <div v-else class="sports-list flex-col gap-2">
          <div 
            v-for="s in sports" 
            :key="s.id" 
            class="card glass p-3 flex-row justify-between align-center sport-item"
          >
            <div class="flex-row align-center gap-2">
              <span class="font-bold text-sm">{{ s.data.nom }}</span>
              <span class="badge badge-neutral text-xs">{{ s.data.unite_distance || 'km' }}</span>
            </div>
            <button 
              @click="handleDeleteSport(s.id!, s.data.nom)" 
              class="action-btn delete" 
              title="Supprimer ce sport"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </BaseSettings>
</template>

<style scoped lang="scss">
.custom-settings-content {
  margin-top: 2.5rem;
  width: 100%;
}

.sports-card {
  padding: 1.5rem;
  max-width: 520px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;

  h2 {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0;
    line-height: 1.2;
    display: flex;
    align-items: center;
  }
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm, 6px);
  flex-shrink: 0;

  &.primary {
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
  }

  .icon {
    width: 20px;
    height: 20px;
  }
}

.card-desc {
  color: var(--color-text-sub);
  font-size: 0.85rem;
  line-height: 1.5;
  margin-top: 0;
  margin-bottom: 1.5rem;
}

.sports-form-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  width: 100%;
}

.sport-name-input {
  flex: 1;
  min-width: 0;
}

.sport-unit-select {
  width: 75px !important;
  flex: 0 0 75px;
  padding: 0.65rem 0.5rem 0.65rem 0.75rem !important;
}

.add-sport-btn {
  width: 38px;
  height: 38px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sports-list {
  width: 100%;
}

.sport-item {
  transition: var(--transition);
}
</style>
