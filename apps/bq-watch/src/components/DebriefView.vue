<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { MovieRecord, TMDBMediaResult, ChatMessage } from '../types';
import { saveMovie, saveViewing, getSimilarReviewsForAIContext, deleteMovie, getMovies } from '../db/queries';
import { searchTMDB, getPosterUrl } from '../services/tmdb';
import { sendDebriefMessage, generateFinalReviewAndRating, getGeminiApiKey, getGeminiModel, getUserProfile } from '../services/gemini';
import { getExpressTags } from '../services/tags';
import { useToast } from '@bq/theme/useToast';
import { Sparkles, Send, Check, Search, Tag } from '@lucide/vue';

const props = defineProps<{
  initialMovie?: MovieRecord | null;
}>();

const emit = defineEmits(['data-updated', 'open-library']);
const toast = useToast();

const movieTitle = ref('');
const selectedType = ref<'Film' | 'Série' | 'Documentaire' | 'Autre'>('Film');
const selectedOrigin = ref<string>('Netflix');
const watchDate = ref<string>(new Date().toISOString().split('T')[0]);
const posterUrl = ref<string>('');
const tmdbId = ref<number | undefined>(undefined);
const movieGenres = ref<string[]>([]);

// Record IDs for updating/cleaning
const editingMovieId = ref<string | undefined>(undefined);
const watchlistSourceId = ref<string | undefined>(undefined);
const isRewatchExisting = ref(false);

// TMDB Autocomplete
const searchResults = ref<TMDBMediaResult[]>([]);
const isSearchingTMDB = ref(false);
const showDropdown = ref(false);

// Debrief Mode
const debriefMode = ref<'ai' | 'express'>('ai');

// AI Chat State
const chatMessages = ref<ChatMessage[]>([]);
const userInput = ref('');
const isAILoading = ref(false);
const isGeneratingReview = ref(false);

// Final Review & Rating Form
const generatedAvis = ref('');
const rating = ref<number>(7.5);
const selectedMention = ref('Aimé');

// Express Tags
const expressTags = ref<string[]>([]);
const selectedTags = ref<string[]>([]);

const mentionsList = [
  'Chef-d’œuvre',
  'Très fortement apprécié',
  'Aimé',
  'Apprécié',
  'Mitigé',
  'Peu apprécié'
];

const platformsList = [
  'Netflix',
  'Prime Video',
  'Cinéma',
  'Disney+',
  'Canal+',
  'Apple TV+',
  'Max',
  'DVD',
  'Autre'
];

onMounted(() => {
  expressTags.value = getExpressTags();

  if (props.initialMovie) {
    applyInitialMovie(props.initialMovie);
  }
});

watch(debriefMode, (newMode) => {
  if (newMode === 'express') {
    expressTags.value = getExpressTags();
  }
});

watch(() => props.initialMovie, (newM) => {
  if (newM) {
    applyInitialMovie(newM);
  }
});

function applyInitialMovie(movie: MovieRecord) {
  // If the movie has an ID and a "Vu" status (or existing review/rating), it's a rewatch.
  isRewatchExisting.value = !!movie.id && movie.statut === 'Vu';
  editingMovieId.value = isRewatchExisting.value ? movie.id : undefined;
  watchlistSourceId.value = movie.watchlist_source_id || (!isRewatchExisting.value && movie.id ? movie.id : undefined);

  movieTitle.value = movie.titre;
  selectedType.value = movie.type || 'Film';
  
  if (movie.origine && movie.origine.length > 0) {
    selectedOrigin.value = movie.origine[0];
  }
  if (movie.dernier_visionnage) {
    watchDate.value = movie.dernier_visionnage;
  } else {
    watchDate.value = new Date().toISOString().split('T')[0];
  }
  
  posterUrl.value = movie.poster_url || '';
  tmdbId.value = movie.tmdb_id;
  movieGenres.value = movie.genres ? [...movie.genres] : [];
  
  // Pre-fill review and rating for rewatches
  generatedAvis.value = movie.avis || '';
  if (movie.note !== undefined && movie.note !== null) {
    rating.value = movie.note;
  }

  startNewAIChat();
}

let tmdbTimeout: any = null;
function onTitleInput() {
  clearTimeout(tmdbTimeout);
  if (!movieTitle.value.trim()) {
    searchResults.value = [];
    showDropdown.value = false;
    return;
  }
  tmdbTimeout = setTimeout(async () => {
    isSearchingTMDB.value = true;
    try {
      searchResults.value = await searchTMDB(movieTitle.value);
      showDropdown.value = searchResults.value.length > 0;
    } finally {
      isSearchingTMDB.value = false;
    }
  }, 350);
}

async function selectTMDBResult(item: TMDBMediaResult) {
  movieTitle.value = item.title;
  selectedType.value = item.media_type === 'tv' ? 'Série' : 'Film';
  tmdbId.value = item.id;
  if (item.poster_path) {
    posterUrl.value = getPosterUrl(item.poster_path, 'w342');
  }
  if (item.genres && item.genres.length > 0) {
    movieGenres.value = [...item.genres];
  }
  searchResults.value = [];
  showDropdown.value = false;

  // Check if it already exists in the library
  const allMovies = await getMovies('Vu');
  const existing = allMovies.find(m => m.tmdb_id === item.id);
  
  if (existing) {
    isRewatchExisting.value = true;
    editingMovieId.value = existing.id;
    generatedAvis.value = existing.avis || '';
    if (existing.note !== undefined && existing.note !== null) {
      rating.value = existing.note;
    }
    toast.info('Ce film est déjà dans ta bibliothèque. Ton débrief enregistrera un nouveau visionnage et mettra à jour la fiche.', 6000);
  } else {
    isRewatchExisting.value = false;
    editingMovieId.value = undefined;
    generatedAvis.value = '';
    rating.value = 7.5;
  }

  startNewAIChat();
}

function startNewAIChat() {
  const profile = getUserProfile();
  const greeting = profile.name && profile.name !== 'Cinéphile' ? `Salut ${profile.name} !` : 'Salut !';
  chatMessages.value = [
    {
      id: 'msg-0',
      sender: 'assistant',
      text: `${greeting} C'est parti pour le débrief de "${movieTitle.value || 'ce contenu'}". Qu'en as-tu pensé globalement ?`,
      timestamp: Date.now()
    }
  ];
}

async function handleSendMessage() {
  const text = userInput.value.trim();
  if (!text || isAILoading.value) return;

  if (!getGeminiApiKey()) {
    toast.warning('Configure ta clé API Gemini dans les Paramètres.');
    return;
  }
  if (!getGeminiModel()) {
    toast.warning('Sélectionne un modèle Gemini dans les Paramètres (clique sur "Détecter les modèles").');
    return;
  }

  chatMessages.value.push({
    id: `msg-${Date.now()}`,
    sender: 'user',
    text,
    timestamp: Date.now()
  });
  userInput.value = '';
  isAILoading.value = true;

  try {
    const profile = getUserProfile();
    const history = chatMessages.value
      .filter(m => m.id !== 'msg-0')
      .map(m => ({ role: m.sender === 'user' ? 'user' as const : 'model' as const, text: m.text }));

    const userContext = await getSimilarReviewsForAIContext(
      { titre: movieTitle.value || 'Film', type: selectedType.value, genres: movieGenres.value },
      profile.name
    );
    const reply = await sendDebriefMessage(history, movieTitle.value || 'Film', userContext);

    chatMessages.value.push({
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: reply,
      timestamp: Date.now()
    });
  } catch (err: any) {
    console.error('Erreur technique Gemini (Débrief) :', err);
    if (err.message && (err.message.includes('503') || err.message.includes('high demand') || err.message.includes('UNAVAILABLE'))) {
      toast.error('Les serveurs Google Gemini sont temporairement saturés (503). Réessaie dans quelques instants.');
    } else {
      toast.error('Impossible de contacter l\'IA. Vérifie dans les Paramètres que ta clé API est active et redétecte les modèles.');
    }
  } finally {
    isAILoading.value = false;
  }
}

async function handleGenerateReview() {
  if (!getGeminiApiKey()) {
    toast.warning('Configure ta clé API Gemini dans les Paramètres pour générer la synthèse.');
    return;
  }
  if (!getGeminiModel()) {
    toast.warning('Sélectionne un modèle Gemini dans les Paramètres pour générer la synthèse.');
    return;
  }

  isGeneratingReview.value = true;
  try {
    const profile = getUserProfile();
    const history = chatMessages.value.map(m => ({
      role: m.sender === 'user' ? 'user' as const : 'model' as const,
      text: m.text
    }));
    const userContext = await getSimilarReviewsForAIContext(
      { titre: movieTitle.value || 'Film', type: selectedType.value, genres: movieGenres.value },
      profile.name
    );
    const res = await generateFinalReviewAndRating(history, movieTitle.value || 'Film', userContext);

    generatedAvis.value = res.avis;
    rating.value = res.note;
    selectedMention.value = res.mention;
    toast.success('Synthèse et note suggérées avec succès ! ✨');
  } catch (err: any) {
    console.error('Erreur technique Gemini (Synthèse) :', err);
    if (err.message && (err.message.includes('503') || err.message.includes('high demand') || err.message.includes('UNAVAILABLE'))) {
      toast.error('Les serveurs Google Gemini sont temporairement saturés (503). Réessaie dans quelques instants.');
    } else {
      toast.error('Impossible de générer la synthèse. Vérifie dans les Paramètres que ta clé API est active et redétecte les modèles.');
    }
  } finally {
    isGeneratingReview.value = false;
  }
}

function toggleExpressTag(tag: string) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter(t => t !== tag);
  } else {
    selectedTags.value.push(tag);
  }
  rebuildExpressAvis();
}

function rebuildExpressAvis() {
  const parts: string[] = [];
  parts.push(`${selectedMention.value}.`);
  if (selectedTags.value.length > 0) {
    parts.push(`Ressentis : ${selectedTags.value.join(', ')}.`);
  }
  generatedAvis.value = parts.join(' ');
}

watch(selectedMention, () => {
  if (debriefMode.value === 'express') {
    rebuildExpressAvis();
  }
});

async function handleSaveToLibrary() {
  if (!movieTitle.value.trim()) {
    toast.warning('Veuillez renseigner un titre.');
    return;
  }

  const record: MovieRecord = {
    id: editingMovieId.value,
    titre: movieTitle.value.trim(),
    type: selectedType.value,
    origine: [selectedOrigin.value], // will be appended automatically if existing movie via saveViewing
    dernier_visionnage: watchDate.value,
    avis: generatedAvis.value.trim(),
    note: rating.value,
    statut: 'Vu',
    poster_url: posterUrl.value || undefined,
    tmdb_id: tmdbId.value,
    genres: movieGenres.value.length > 0 ? movieGenres.value : undefined
  };

  try {
    const movieId = await saveMovie(record);
    
    // Create the viewing history entry
    await saveViewing({
      movie_id: movieId,
      titre: record.titre,
      date: watchDate.value,
      support: selectedOrigin.value,
      commentaire: ''
    });

    // Cleanup Watchlist if it was a distinct record
    if (watchlistSourceId.value && watchlistSourceId.value !== movieId) {
      await deleteMovie(watchlistSourceId.value);
    }

    toast.success(isRewatchExisting.value ? `Nouveau visionnage enregistré pour "${movieTitle.value}" !` : `"${movieTitle.value}" a été ajouté à ta bibliothèque !`);
    emit('data-updated');
    emit('open-library');
  } catch (err) {
    console.error(err);
    toast.error("Erreur lors de l'enregistrement.");
  }
}
</script>

<template>
  <div class="debrief-container">
    <!-- Header Movie Selection -->
    <div class="card selector-card">
      <div class="form-row-top">
        <div class="title-search-wrapper">
          <label>Titre de l'œuvre *</label>
          <div class="input-with-icon">
            <Search class="search-icon" />
            <input 
              type="text" 
              v-model="movieTitle" 
              @input="onTitleInput"
              placeholder="Ex: Inception, Oppenheimer, Severance..." 
              class="input title-input"
            />
          </div>

          <!-- TMDB Suggestions Dropdown -->
          <div v-if="showDropdown && searchResults.length > 0" class="suggestions-dropdown">
            <div 
              v-for="item in searchResults.slice(0, 4)" 
              :key="item.id" 
              class="suggestion-row"
              @click="selectTMDBResult(item)"
            >
              <img 
                v-if="item.poster_path" 
                :src="getPosterUrl(item.poster_path, 'w185')" 
                :alt="item.title" 
                class="suggest-img"
              />
              <div class="suggest-info">
                <strong>{{ item.title }}</strong>
                <span>{{ item.media_type === 'tv' ? 'Série' : 'Film' }} {{ item.release_date ? '• ' + item.release_date.split('-')[0] : '' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="meta-inputs">
          <div class="field-item">
            <label>Type</label>
            <select v-model="selectedType" class="select">
              <option value="Film">Film</option>
              <option value="Série">Série</option>
              <option value="Documentaire">Documentaire</option>
              <option value="Autre">Autre</option>
            </select>
          </div>

          <div class="field-item">
            <label>Plateforme</label>
            <select v-model="selectedOrigin" class="select">
              <option v-for="p in platformsList" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>

          <div class="field-item">
            <label>Date</label>
            <input type="date" v-model="watchDate" class="input" />
          </div>
        </div>
      </div>

      <!-- Banner if rewatching existing library movie -->
      <div v-if="isRewatchExisting" class="rewatch-banner">
        <Sparkles class="inline-icon" /> 
        Ce film est déjà dans ta bibliothèque. Ce débrief va enregistrer un nouveau visionnage et mettra à jour ton avis global si tu le modifies.
      </div>
    </div>

    <!-- Mode Selector Tabs -->
    <div class="mode-tabs">
      <button 
        class="tab-btn" 
        :class="{ active: debriefMode === 'ai' }" 
        @click="debriefMode = 'ai'"
      >
        <Sparkles class="tab-icon" /> Studio de débrief
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: debriefMode === 'express' }" 
        @click="debriefMode = 'express'"
      >
        <Tag class="tab-icon" /> Débrief express
      </button>
    </div>

    <!-- Mode 1: AI Chat Studio -->
    <div v-if="debriefMode === 'ai'" class="ai-studio-grid">
      <!-- Chat Box -->
      <div class="card chat-card">
        <div class="chat-header">
          <div class="chat-header-title">
            <Sparkles class="icon-sparkle" />
            <span>Discussion avec ton assistant IA</span>
          </div>
          <small class="context-hint">Nourri de tes autres avis historiques</small>
        </div>

        <div class="chat-messages-area">
          <div 
            v-for="msg in chatMessages" 
            :key="msg.id" 
            :class="['chat-bubble', msg.sender === 'user' ? 'bubble-user' : 'bubble-ai']"
          >
            <p>{{ msg.text }}</p>
          </div>
          <div v-if="isAILoading" class="chat-bubble bubble-ai typing">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </div>
        </div>

        <div class="chat-input-row">
          <input 
            type="text" 
            v-model="userInput" 
            placeholder="Partage tes impressions, un moment marquant..." 
            class="input chat-input"
            @keyup.enter="handleSendMessage"
            :disabled="isAILoading"
          />
          <button class="btn btn-primary" @click="handleSendMessage" :disabled="isAILoading || !userInput.trim()">
            <Send class="inline-icon" />
          </button>
        </div>

        <div class="chat-action-bar">
          <button 
            class="btn btn-secondary btn-generate" 
            @click="handleGenerateReview" 
            :disabled="isGeneratingReview || chatMessages.length < 2"
          >
            <Sparkles class="inline-icon" /> 
            {{ isGeneratingReview ? 'Génération en cours...' : 'Générer la synthèse et la note' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Mode 2: Express Tags -->
    <div v-else class="card express-card">
      <h3>Sélectionne tes ressentis en quelques clics :</h3>
      
      <div class="express-mentions-row">
        <label>Mention globale :</label>
        <div class="mentions-chips">
          <button 
            v-for="m in mentionsList" 
            :key="m" 
            class="mention-chip"
            :class="{ active: selectedMention === m }"
            @click="selectedMention = m"
          >
            {{ m }}
          </button>
        </div>
      </div>

      <div class="express-tags-list">
        <button 
          v-for="tag in expressTags" 
          :key="tag" 
          class="tag-toggle-btn"
          :class="{ active: selectedTags.includes(tag) }"
          @click="toggleExpressTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- Final Synthesis & Rating Validation Card -->
    <div class="card result-card">
      <div class="result-header">
        <h3>Fiche de visionnage finale</h3>
        <span class="badge badge-primary">{{ selectedMention }}</span>
      </div>

      <div class="rating-picker-row">
        <label>Note suggérée / ajustée :</label>
        <div class="slider-wrapper">
          <input 
            type="range" 
            min="0" 
            max="10" 
            step="0.5" 
            v-model.number="rating" 
            class="range-slider"
          />
          <span class="rating-display-large">⭐ {{ rating }} / 10</span>
        </div>
      </div>

      <div class="form-group">
        <label>Avis rédigé (modifiable à volonté) :</label>
        <textarea 
          v-model="generatedAvis" 
          class="textarea review-textarea" 
          rows="4" 
          placeholder="La synthèse rédigée par l'IA ou tes tags s'affichera ici..."
        ></textarea>
      </div>

      <div class="result-actions">
        <button class="btn btn-primary btn-save-full" @click="handleSaveToLibrary">
          <Check class="inline-icon" /> Enregistrer dans ma cinémathèque
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.debrief-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.selector-card {
  padding: 1.25rem;
}

.form-row-top {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
}

.title-search-wrapper {
  position: relative;
  flex: 2;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-sub);
  }
}

.input-with-icon {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--text-muted);
}

.title-input {
  padding-left: 2.5rem;
  font-weight: 700;
}

.suggestions-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.65rem;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 16px 32px color-mix(in srgb, var(--color-black) 90%, transparent);
}

.suggestion-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem;
  border-radius: var(--radius-sm);
  cursor: pointer;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.suggest-img {
  width: 28px;
  height: 42px;
  object-fit: cover;
  border-radius: 4px;
}

.suggest-info {
  display: flex;
  flex-direction: column;
  span {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
}

.meta-inputs {
  display: flex;
  flex: 3;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-width: 120px;

  label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-sub);
  }
}

.mode-tabs {
  display: flex;
  gap: 0.5rem;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  transition: var(--transition);

  &:hover {
    color: var(--text-primary);
  }

  &.active {
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

.tab-icon {
  width: 16px;
  height: 16px;
}

.chat-card {
  display: flex;
  flex-direction: column;
  height: 420px;
  padding: 1rem;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
  margin-bottom: 0.75rem;
}

.chat-header-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 800;
  font-size: 0.9rem;
}

.icon-sparkle {
  width: 16px;
  height: 16px;
  color: var(--color-primary);
}

.context-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.chat-messages-area {
  flex-grow: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-right: 0.5rem;
}

.chat-bubble {
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  line-height: 1.45;

  p {
    margin: 0;
  }
}

.bubble-user {
  align-self: flex-end;
  background: var(--color-primary);
  color: #ffffff;
  border-bottom-right-radius: 2px;
}

.bubble-ai {
  align-self: flex-start;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-bottom-left-radius: 2px;
}

.typing {
  display: flex;
  gap: 0.35rem;
  padding: 0.85rem 1.2rem;
  .dot {
    width: 6px;
    height: 6px;
    background: var(--text-muted);
    border-radius: 50%;
    animation: pulse 1.4s infinite ease-in-out;
  }
}

.chat-input-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.chat-input {
  flex-grow: 1;
}

.chat-action-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-generate {
  width: 100%;
}

.express-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  h3 {
    font-size: 1rem;
    font-weight: 800;
  }
}

.express-mentions-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-sub);
  }
}

.mentions-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.mention-chip {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;

  &.active {
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

.express-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-toggle-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);

  &.active {
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    border-color: var(--color-success);
    color: var(--color-success);
  }
}

.result-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    font-size: 1.05rem;
    font-weight: 800;
  }
}

.rating-picker-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-sub);
  }
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.range-slider {
  flex-grow: 1;
}

.rating-display-large {
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--color-warning);
  width: 100px;
  text-align: right;
}

.review-textarea {
  line-height: 1.5;
}

.btn-save-full {
  width: 100%;
  padding: 0.85rem;
  font-size: 1rem;
}

.inline-icon {
  width: 16px;
  height: 16px;
}

.rewatch-banner {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--color-info) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-info) 25%, transparent);
  border-radius: var(--radius-sm);
  color: var(--color-info);
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

@keyframes pulse {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
