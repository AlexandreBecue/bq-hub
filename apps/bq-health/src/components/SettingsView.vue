<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db } from '../db/index';
import { syncEngine } from '../db/google-drive';
import { seedDefaultVaccinesIfEmpty } from '../db/queries';
import BaseSettings from '@bq/theme/BaseSettings.vue';
import { Heart } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

// Emergency Profil State (localStorage)
const bloodType = ref(localStorage.getItem('bq-health-blood') || 'Inconnu');
const allergies = ref(localStorage.getItem('bq-health-allergies') || 'Aucune allergie connue.');
const emergencyContact = ref(localStorage.getItem('bq-health-ice') || 'Non renseigné');

const isDbEmpty = ref(true);
const bloodTypes = ["Inconnu", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const checkDbStatus = async () => {
  const count = await db.records.count();
  isDbEmpty.value = count === 0;
};

onMounted(async () => {
  await checkDbStatus();
});

const saveProfile = () => {
  localStorage.setItem('bq-health-blood', bloodType.value);
  localStorage.setItem('bq-health-allergies', allergies.value.trim());
  localStorage.setItem('bq-health-ice', emergencyContact.value.trim());
  toast.success('Informations médicales d\'urgence enregistrées !');
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
        <h2>Configuration</h2>
        <p class="text-sub">Édite tes données médicales d'urgence (ICE) stockées localement.</p>
      </div>

      <div class="card glass">
        <h3 class="font-bold mb-4"><Heart :size="18" /> Fiche de secours</h3>
        
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
</style>
