<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db } from '../db/index';
import { syncEngine } from '../db/google-drive';
import { seedDefaultVaccinesIfEmpty } from '../db/queries';
import { 
  getGeminiApiKey, 
  setGeminiApiKey, 
  getGeminiModel, 
  setGeminiModel, 
  listAvailableGeminiModels 
} from '../services/gemini';
import BaseSettings from '@bq/theme/BaseSettings.vue';
import { Heart, Sparkles, RefreshCw } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

// Emergency Profile State (localStorage)
const bloodType = ref(localStorage.getItem('bq-health-blood') || 'Inconnu');
const allergies = ref(localStorage.getItem('bq-health-allergies') || 'Aucune allergie connue.');
const emergencyContact = ref(localStorage.getItem('bq-health-ice') || 'Non renseigné');

// Gemini AI State
const geminiApiKey = ref(getGeminiApiKey());
const geminiModel = ref(getGeminiModel());
const availableModels = ref<Array<{ id: string; label: string }>>([
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommandé)' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
]);
const isFetchingModels = ref(false);

const isDbEmpty = ref(true);
const bloodTypes = ["Inconnu", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const checkDbStatus = async () => {
  const count = await db.records.count();
  isDbEmpty.value = count === 0;
};

onMounted(async () => {
  await checkDbStatus();
  if (geminiApiKey.value) {
    refreshModels();
  }
});

const refreshModels = async () => {
  if (!geminiApiKey.value.trim()) return;
  isFetchingModels.value = true;
  try {
    const models = await listAvailableGeminiModels(geminiApiKey.value.trim());
    if (models.length > 0) {
      availableModels.value = models;
      toast.success('Liste des modèles mise à jour !');
    }
  } catch (err: any) {
    console.error('Erreur récupération modèles:', err);
  } finally {
    isFetchingModels.value = false;
  }
};

const saveProfile = () => {
  localStorage.setItem('bq-health-blood', bloodType.value);
  localStorage.setItem('bq-health-allergies', allergies.value.trim());
  localStorage.setItem('bq-health-ice', emergencyContact.value.trim());
  toast.success('Informations médicales d\'urgence enregistrées !');
  emit('data-updated');
};

const saveGeminiConfig = () => {
  setGeminiApiKey(geminiApiKey.value.trim());
  setGeminiModel(geminiModel.value);
  toast.success('Configuration Gemini enregistrée !');
  emit('data-updated');
};

const handleDataUpdated = async () => {
  await checkDbStatus();
  emit('data-updated');
};

const handleClearDatabase = async () => {
  await checkDbStatus();
  emit('data-updated');
};

const handleGenerateDemo = async () => {
  await seedDefaultVaccinesIfEmpty();
  await checkDbStatus();
  emit('data-updated');
};
</script>

<template>
  <BaseSettings
    :db="db"
    :syncEngine="syncEngine"
    :clientId="clientId"
    :isDbEmpty="isDbEmpty"
    exportFileNamePrefix="bq-health"
    @data-updated="handleDataUpdated"
    @clear-database="handleClearDatabase"
    @generate-demo="handleGenerateDemo"
  >
    <div class="custom-settings-content">
      <div class="view-header">
        <h2>Configuration santé & IA</h2>
        <p class="text-sub">Édite tes données médicales d'urgence (ICE) et connecte ton assistant intelligent Gemini.</p>
      </div>

      <div class="settings-grid">
        <!-- Fiche de secours ICE -->
        <div class="card glass">
          <h3 class="font-bold mb-4 flex-row gap-2"><Heart :size="18" class="text-primary" /> Fiche de secours (ICE)</h3>
          
          <div class="form-group mb-3">
            <label class="text-xs font-bold text-sub mb-1">Groupe Sanguin</label>
            <select v-model="bloodType" class="select font-bold text-primary height-38">
              <option v-for="b in bloodTypes" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>

          <div class="form-group mb-3 mt-4">
            <label class="text-xs font-bold text-sub mb-1">Allergies & Intolérances</label>
            <textarea v-model="allergies" rows="3" placeholder="Ex: Pénicilline, Arachides, Aucune..." class="textarea"></textarea>
          </div>

          <div class="form-group mb-3 mt-4">
            <label class="text-xs font-bold text-sub mb-1">Personne à prévenir en cas d'urgence (ICE)</label>
            <input v-model="emergencyContact" type="text" placeholder="Ex: Sophie (Mère) - 06 12 34 56 78" class="input height-38" />
          </div>

          <button @click="saveProfile" class="btn btn-primary mt-4 w-100 height-38">Enregistrer ma fiche de secours</button>
        </div>

        <!-- Assistant IA Gemini -->
        <div class="card glass">
          <h3 class="font-bold mb-4 flex-row gap-2"><Sparkles :size="18" class="text-primary" /> Assistant Médical Gemini IA</h3>
          <p class="text-xs text-sub mb-3 leading-relaxed">
            Permet à l'assistant de vérifier les interactions médicamenteuses de l'automédication et d'expliquer les comptes-rendus médicaux.
          </p>

          <div class="form-group mb-3">
            <label class="text-xs font-bold text-sub mb-1 flex-row justify-between">
              <span>Clé d'API Google Gemini</span>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-primary text-xs underline">Obtenir une clé</a>
            </label>
            <input 
              v-model="geminiApiKey" 
              type="password" 
              placeholder="AIzaSy..." 
              class="input height-38" 
            />
          </div>

          <div class="form-group mb-3 mt-3">
            <div class="flex-row justify-between align-center mb-1">
              <label class="text-xs font-bold text-sub">Modèle d'IA</label>
              <button 
                type="button" 
                @click="refreshModels" 
                class="btn btn-secondary btn-sm text-xs flex-row gap-1"
                :disabled="isFetchingModels || !geminiApiKey"
              >
                <RefreshCw :size="12" :class="{ 'spin': isFetchingModels }" /> Actualiser
              </button>
            </div>
            <select v-model="geminiModel" class="select height-38">
              <option v-for="m in availableModels" :key="m.id" :value="m.id">{{ m.label }}</option>
            </select>
          </div>

          <button @click="saveGeminiConfig" class="btn btn-primary mt-4 w-100 height-38">
            Enregistrer la configuration Gemini
          </button>
        </div>
      </div>
    </div>
  </BaseSettings>
</template>

<style scoped lang="scss">
.custom-settings-content {
  margin-top: 3rem;
  width: 100%;
}

.view-header {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-white) 6%, transparent);
  padding-bottom: 1rem;
  width: 100%;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;

  @media (min-width: 800px) {
    grid-template-columns: 1fr 1fr;
  }
}

.height-38 {
  height: 38px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
  
  label {
    display: block;
    margin-bottom: 0.25rem;
  }
}

.select, .input, .textarea {
  width: 100%;
}

.mt-4 {
  margin-top: 1.5rem;
}

.w-100 {
  width: 100%;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
