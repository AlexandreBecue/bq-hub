<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { db } from '../db/index';
import { syncEngine } from '../db/google-drive';
import { generateDemoData, initializeCollections } from '../db/queries';
import { 
  getGeminiApiKey, 
  setGeminiApiKey, 
  getUserProfile, 
  setUserProfile,
  getGeminiModel,
  setGeminiModel,
  getStoredAvailableModels,
  listAvailableGeminiModels
} from '../services/gemini';
import { getTmdbApiKey, setTmdbApiKey, getFrenchWatchProviders, type TMDBProviderItem } from '../services/tmdb';
import { getExpressTags, setExpressTags, DEFAULT_EXPRESS_TAGS } from '../services/tags';
import BaseSettings from '@bq/theme/BaseSettings.vue';
import { useToast } from '@bq/theme/useToast';
import { Key, Sparkles, Film, Plus, X, Tv, Search, Sliders, User, Clapperboard, RefreshCw } from '@lucide/vue';

const emit = defineEmits(['data-updated']);
const toast = useToast();

const isDbEmpty = ref(true);
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const userName = ref('');
const userPreferences = ref('');
const geminiKey = ref('');
const geminiModel = ref(getGeminiModel());
const availableModels = ref<Array<{ id: string; label: string }>>(getStoredAvailableModels());
const isLoadingModels = ref(false);
const tmdbKey = ref('');

// Dynamic TMDB Providers
const allProviders = ref<TMDBProviderItem[]>([]);
const providerSearch = ref('');
const isLoadingProviders = ref(false);

// Default common French providers if API not yet configured
const fallbackProviders: TMDBProviderItem[] = [
  { provider_id: 8, provider_name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
  { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/pvsZWWZZU074h5fGfZz9uV9kG1K.jpg' },
  { provider_id: 337, provider_name: 'Disney Plus', logo_path: '/7rwgQIaxWh2A61t18zJsdp1h4t4.jpg' },
  { provider_id: 381, provider_name: 'Canal+', logo_path: '/bzoL3eD1T2d9jQ76l032k2tY45r.jpg' },
  { provider_id: 1899, provider_name: 'Max', logo_path: '/6uhRppL6j3x3fTjGkL2f3l1fT.jpg' },
  { provider_id: 350, provider_name: 'Apple TV Plus', logo_path: '/6uhRppL6j3x3fTjGkL2f3l1fT.jpg' },
  { provider_id: 531, provider_name: 'Paramount Plus', logo_path: '/fi83B1oztoS47xxcemFdPMKVUXB.jpg' },
  { provider_id: 2095, provider_name: 'Max Amazon Channel', logo_path: '/pvsZWWZZU074h5fGfZz9uV9kG1K.jpg' },
  { provider_id: 1853, provider_name: 'Paramount+ Amazon Channel', logo_path: '/pvsZWWZZU074h5fGfZz9uV9kG1K.jpg' },
  { provider_id: 2096, provider_name: 'Universal+ Amazon Channel', logo_path: '/pvsZWWZZU074h5fGfZz9uV9kG1K.jpg' },
  { provider_id: 1825, provider_name: 'Warner Pass Amazon Channel', logo_path: '/pvsZWWZZU074h5fGfZz9uV9kG1K.jpg' }
];

const selectedProviderIds = ref<number[]>([8, 119, 337]);

const customTags = ref<string[]>(getExpressTags());
const newTagInput = ref('');

const checkDbStatus = async () => {
  const count = await db.records.count();
  isDbEmpty.value = count === 0;
};

onMounted(async () => {
  await checkDbStatus();
  geminiKey.value = getGeminiApiKey();
  geminiModel.value = getGeminiModel();
  tmdbKey.value = getTmdbApiKey();

  const profile = getUserProfile();
  userName.value = profile.name;
  userPreferences.value = profile.preferences;

  // Load saved selected provider IDs
  const savedIds = localStorage.getItem('bq_watch_selected_provider_ids');
  if (savedIds) {
    try {
      selectedProviderIds.value = JSON.parse(savedIds);
    } catch {
      selectedProviderIds.value = [8, 119, 337];
    }
  }

  // Fetch real providers list from TMDB
  isLoadingProviders.value = true;
  try {
    const list = await getFrenchWatchProviders();
    if (list && list.length > 0) {
      allProviders.value = list;
    } else {
      allProviders.value = fallbackProviders;
    }
  } catch {
    allProviders.value = fallbackProviders;
  } finally {
    isLoadingProviders.value = false;
  }

  // Load tags using the shared service
  customTags.value = getExpressTags();
});

const filteredProviders = computed(() => {
  const q = providerSearch.value.toLowerCase().trim();
  const list = allProviders.value.length > 0 ? allProviders.value : fallbackProviders;

  if (!q) {
    return [...list].sort((a, b) => {
      const aSel = selectedProviderIds.value.includes(a.provider_id);
      const bSel = selectedProviderIds.value.includes(b.provider_id);
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return a.provider_name.localeCompare(b.provider_name);
    });
  }

  return list.filter(p => p.provider_name.toLowerCase().includes(q));
});

const toggleProvider = (id: number) => {
  if (selectedProviderIds.value.includes(id)) {
    selectedProviderIds.value = selectedProviderIds.value.filter(item => item !== id);
  } else {
    selectedProviderIds.value.push(id);
  }
  localStorage.setItem('bq_watch_selected_provider_ids', JSON.stringify(selectedProviderIds.value));
  toast.success('Plateforme mise à jour !');
  emit('data-updated');
};

const onModelChange = () => {
  setGeminiModel(geminiModel.value);
  toast.success(`Modèle sélectionné : ${geminiModel.value}`);
};

const fetchModelsFromApi = async () => {
  if (!geminiKey.value.trim()) {
    toast.warning('Renseigne d\'abord une clé API Gemini pour détecter les modèles.');
    return;
  }
  isLoadingModels.value = true;
  try {
    const apiModels = await listAvailableGeminiModels(geminiKey.value.trim());
    if (apiModels.length > 0) {
      availableModels.value = apiModels;
      if (!geminiModel.value || !apiModels.some(m => m.id === geminiModel.value)) {
        const preferred = apiModels.find(m => m.id.includes('flash')) || apiModels[0];
        geminiModel.value = preferred.id;
      }
      setGeminiModel(geminiModel.value);
      toast.success(`${apiModels.length} modèles Gemini détectés pour ta clé !`);
    } else {
      toast.warning('Aucun modèle supporté trouvé pour cette clé.');
    }
  } catch (err: any) {
    toast.error(err.message || 'Erreur lors de la récupération des modèles.');
  } finally {
    isLoadingModels.value = false;
  }
};

const saveAiAndApiSettings = async () => {
  setUserProfile({
    name: userName.value,
    preferences: userPreferences.value
  });
  setGeminiApiKey(geminiKey.value);
  setGeminiModel(geminiModel.value);
  setTmdbApiKey(tmdbKey.value);
  toast.success('Profil, modèle et clés API enregistrés avec succès !');

  // Reload providers with the new key
  try {
    const list = await getFrenchWatchProviders();
    if (list && list.length > 0) {
      allProviders.value = list;
    }
  } catch {}
};

const addTag = () => {
  const t = newTagInput.value.trim();
  if (t && !customTags.value.includes(t)) {
    customTags.value.push(t);
    setExpressTags(customTags.value);
    newTagInput.value = '';
    toast.success('Tag ajouté !');
  }
};

const removeTag = (tag: string) => {
  customTags.value = customTags.value.filter(t => t !== tag);
  setExpressTags(customTags.value);
};

const resetTags = () => {
  customTags.value = [...DEFAULT_EXPRESS_TAGS];
  setExpressTags(customTags.value);
  toast.info('Tags réinitialisés par défaut.');
};

const handleDataUpdated = async () => {
  await checkDbStatus();
  emit('data-updated');
};

const handleClearDatabase = async () => {
  await initializeCollections();
  await checkDbStatus();
  emit('data-updated');
};

const handleGenerateDemo = async () => {
  await generateDemoData();
  await checkDbStatus();
  emit('data-updated');
};
</script>

<template>
  <div class="settings-wrapper">
    <!-- 1. Base Unified Settings (Google Drive Sync & Backup first) -->
    <BaseSettings
      :db="db"
      :syncEngine="syncEngine"
      :clientId="clientId"
      :isDbEmpty="isDbEmpty"
      exportFileNamePrefix="bq-watch"
      @data-updated="handleDataUpdated"
      @clear-database="handleClearDatabase"
      @generate-demo="handleGenerateDemo"
    />

    <!-- 2. Specific Watch Settings Section Below -->
    <div class="watch-settings-container">
      <!-- Subscriptions Selection Card (Full Width) -->
      <div class="card subscriptions-card">
        <div class="card-title-row">
          <Tv class="icon-accent" />
          <h3>Mes abonnements</h3>
        </div>
        <p class="section-desc">
          Coche tes abonnements et chaînes spécifiques. Le filtre de ta Watchlist se basera exactement sur cette sélection.
        </p>

        <div class="search-provider-box">
          <Search class="search-mini-icon" />
          <input 
            type="text" 
            v-model="providerSearch" 
            placeholder="Rechercher une plateforme ou chaîne"
            class="input provider-search-input"
          />
        </div>

        <div class="subs-grid">
          <label 
            v-for="sub in filteredProviders.slice(0, 48)" 
            :key="sub.provider_id" 
            class="sub-item"
            :class="{ checked: selectedProviderIds.includes(sub.provider_id) }"
          >
            <input 
              type="checkbox" 
              :checked="selectedProviderIds.includes(sub.provider_id)" 
              @change="toggleProvider(sub.provider_id)" 
            />
            <div class="sub-logo-box" v-if="sub.logo_path">
              <img :src="`https://image.tmdb.org/t/p/w92${sub.logo_path}`" :alt="sub.provider_name" />
            </div>
            <div class="sub-info">
              <span class="sub-name">{{ sub.provider_name }}</span>
            </div>
          </label>
        </div>

        <small class="subs-count-hint">
          {{ selectedProviderIds.length }} service(s) activé(s) pour le filtrage de la Watchlist.
        </small>
      </div>

      <!-- Two-Column Desktop Grid for Tags and API Keys -->
      <div class="settings-two-cols">
        <!-- Column 1: Quick Tags Configuration Card -->
        <div class="card tags-card">
          <div class="card-title-row">
            <Sliders :size="18" class="icon-accent" />
            <h3>Tags du débrief express</h3>
          </div>
          <p class="section-desc">
            Personnalise les étiquettes de ressenti rapide utilisées pour classer un visionnage en quelques secondes.
          </p>

          <div class="tags-list">
            <span v-for="tag in customTags" :key="tag" class="tag-chip">
              {{ tag }}
              <button class="btn-remove-tag" @click="removeTag(tag)" title="Supprimer">
                <X class="x-icon" />
              </button>
            </span>
          </div>

          <div class="add-tag-row">
            <input 
              v-model="newTagInput" 
              class="input" 
              placeholder="Ajouter un nouveau tag (ex: Scénario prenant...)" 
              @keyup.enter="addTag"
            />
            <button class="btn btn-secondary btn-sm" @click="addTag" :disabled="!newTagInput.trim()">
              <Plus class="inline-icon" /> Ajouter
            </button>
          </div>

          <div class="reset-tags-row">
            <button class="btn-link" @click="resetTags">
              Réinitialiser les tags par défaut
            </button>
          </div>
        </div>

        <!-- Column 2: Extra API Keys & User Profile Configuration Card -->
        <div class="card api-keys-card">
          <div class="card-title-row">
            <Sparkles class="icon-accent" />
            <h3>Assistant</h3>
          </div>
          <p class="section-desc">
            Personnalise ton identité et tes sensibilités cinématographiques pour que l'IA adapte son ton, comprenne tes références et calibre ses analyses.
          </p>

          <div class="form-group">
            <label for="user-name" class="flex-row align-center gap-1">
              <User :size="14" /> Ton prénom ou pseudo
            </label>
            <input 
              id="user-name"
              type="text" 
              v-model="userName" 
              class="input" 
              placeholder="Pseudo"
            />
          </div>

          <div class="form-group">
            <label for="user-prefs" class="flex-row align-center gap-1">
              <Clapperboard :size="14" /> Tes goûts, références & sensibilités (pour l'IA)
            </label>
            <textarea 
              id="user-prefs"
              v-model="userPreferences" 
              class="textarea user-prefs-textarea" 
              rows="5"
              placeholder="Ex: Références absolues, réalisateurs préférés, styles détestés..."
            ></textarea>
            <small class="help-text">Transmis en consigne de fond à Gemini pour guider le débriefing.</small>
          </div>

          <div class="form-group">
            <label for="gemini-key">
              <Key class="inline-icon" /> Clé API Google Gemini (Google AI Studio)
            </label>
            <input 
              id="gemini-key"
              type="password" 
              v-model="geminiKey" 
              class="input" 
              placeholder="AIzaSy..." 
            />
            <small class="help-text">Obtiens une clé 100% gratuite sur aistudio.google.com</small>
          </div>

          <div class="form-group">
            <div class="flex-row justify-between align-center mb-1">
              <label for="gemini-model" style="margin-bottom: 0;">
                <Sparkles class="inline-icon" /> Modèle Gemini
              </label>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                :disabled="isLoadingModels || !geminiKey" 
                @click="fetchModelsFromApi"
              >
                <RefreshCw :size="12" :class="{ 'spin': isLoadingModels }" />
                {{ isLoadingModels ? 'Détection...' : 'Détecter les modèles' }}
              </button>
            </div>
            <select 
              id="gemini-model" 
              v-model="geminiModel" 
              class="select"
              @change="onModelChange"
            >
              <option v-if="availableModels.length === 0" value="" disabled>
                Aucun modèle détecté — clique sur "Détecter les modèles"
              </option>
              <option v-for="m in availableModels" :key="m.id" :value="m.id">
                {{ m.label }}
              </option>
            </select>
            <small class="help-text" v-if="availableModels.length === 0">
              Clique sur "Détecter les modèles" pour interroger l'API avec ta clé et charger la liste.
            </small>
            <small class="help-text" v-else>
              Modèle actif : <strong>{{ geminiModel || 'Aucun' }}</strong>. Sélection enregistrée.
            </small>
          </div>

          <div class="form-group">
            <label for="tmdb-key">
              <Film class="inline-icon" /> Clé API TMDB (The Movie Database)
            </label>
            <input 
              id="tmdb-key"
              type="password" 
              v-model="tmdbKey" 
              class="input" 
              placeholder="Clé API v3 ou Jeton v4..." 
            />
            <small class="help-text">Crée un compte gratuit sur themoviedb.org ➔ Paramètres ➔ API ➔ Créer Développeur.</small>
          </div>

          <button class="btn btn-primary" @click="saveAiAndApiSettings">
            Enregistrer les paramètres
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.watch-settings-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.subscriptions-card {
  width: 100%;
}

.settings-two-cols {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;

  @media (min-width: 900px) {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;

  h3 {
    font-size: 1.1rem;
    font-weight: 700;
  }
}

.section-desc {
  font-size: 0.85rem;
  color: var(--text-sub);
  margin-bottom: 1.25rem;
  line-height: 1.4;
}

.search-provider-box {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.search-mini-icon {
  position: absolute;
  left: 0.75rem;
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

.provider-search-input {
  padding-left: 2.25rem;
  font-size: 0.85rem;
}

.icon-accent {
  width: 20px;
  height: 20px;
  color: var(--color-primary);
}

.icon-tag {
  font-size: 1.2rem;
}

.inline-icon {
  width: 14px;
  height: 14px;
  display: inline;
  vertical-align: middle;
  margin-right: 0.25rem;
}

.help-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.subs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.65rem;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.sub-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: var(--transition);

  input {
    width: 16px;
    height: 16px;
    accent-color: var(--color-primary);
    flex-shrink: 0;
  }

  &.checked {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
}

.sub-logo-box {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.sub-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sub-name {
  font-size: 0.825rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.25;
  word-break: break-word;
}

.subs-count-hint {
  display: block;
  margin-top: 0.75rem;
  font-size: 0.775rem;
  color: var(--text-muted);
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-remove-tag {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;

  &:hover {
    color: var(--color-danger);
  }
}

.x-icon {
  width: 14px;
  height: 14px;
}

.add-tag-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.reset-tags-row {
  margin-top: 0.75rem;
}

.btn-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  text-decoration: underline;

  &:hover {
    color: var(--text-sub);
  }
}

.user-prefs-textarea {
  width: 100%;
  resize: vertical;
  min-height: 90px;
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.4;
}
</style>
