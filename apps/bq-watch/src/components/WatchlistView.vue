<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { MovieRecord, TMDBMediaResult, WatchProvidersResult } from '../types';
import { getMovies, saveMovie, deleteMovie } from '../db/queries';
import { searchTMDB, getWatchProviders, getPosterUrl } from '../services/tmdb';
import { useToast } from '@bq/theme/useToast';
import { 
  Search, Plus, Bookmark, Tv, Check, Trash2, Film
} from '@lucide/vue';

const emit = defineEmits(['data-updated', 'start-debrief']);
const toast = useToast();

const watchlist = ref<MovieRecord[]>([]);
const isLoading = ref(true);

// Search to add
const searchQuery = ref('');
const searchResults = ref<TMDBMediaResult[]>([]);
const isSearching = ref(false);

// Streaming providers cache { [tmdbId]: WatchProvidersResult }
const providersCache = ref<Record<number, WatchProvidersResult>>({});

// User selected provider IDs (from Settings)
const selectedProviderIds = ref<number[]>([8, 119, 337]);
const selectedFilter = ref<string | number>('all'); // 'all' | 'my-subs' | <provider_id>

const commonNamesMap: Record<number, string> = {
  8: 'Netflix',
  119: 'Prime Video',
  337: 'Disney+',
  381: 'Canal+',
  1899: 'Max',
  350: 'Apple TV+',
  531: 'Paramount+',
  2095: 'Max (Amazon)',
  1853: 'Paramount+ (Amazon)',
  2096: 'Universal+ (Amazon)',
  1825: 'Warner Pass'
};

async function loadWatchlist() {
  isLoading.value = true;
  try {
    watchlist.value = await getMovies('À voir');
    
    // Fetch streaming providers for movies that have a tmdb_id
    for (const item of watchlist.value) {
      if (item.tmdb_id && !providersCache.value[item.tmdb_id]) {
        fetchProviders(item.tmdb_id, item.type === 'Série' ? 'tv' : 'movie');
      }
    }
  } catch (err) {
    console.error('Erreur chargement watchlist:', err);
  } finally {
    isLoading.value = false;
  }
}

async function fetchProviders(tmdbId: number, mediaType: 'movie' | 'tv') {
  try {
    const res = await getWatchProviders(tmdbId, mediaType);
    if (res) {
      providersCache.value[tmdbId] = res;
    }
  } catch (err) {
    console.error(`Erreur providers pour ${tmdbId}:`, err);
  }
}

onMounted(() => {
  const savedIds = localStorage.getItem('bq_watch_selected_provider_ids');
  if (savedIds) {
    try {
      selectedProviderIds.value = JSON.parse(savedIds);
    } catch {
      selectedProviderIds.value = [8, 119, 337];
    }
  }
  loadWatchlist();
});

let searchTimeout: any = null;
function handleSearchInput() {
  clearTimeout(searchTimeout);
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  searchTimeout = setTimeout(async () => {
    isSearching.value = true;
    try {
      searchResults.value = await searchTMDB(searchQuery.value);
    } finally {
      isSearching.value = false;
    }
  }, 350);
}

async function addToWatchlistFromTMDB(item: TMDBMediaResult) {
  const isAlreadyIn = watchlist.value.some(m => m.tmdb_id === item.id || m.titre.toLowerCase() === item.title.toLowerCase());
  if (isAlreadyIn) {
    toast.info(`"${item.title}" est déjà dans ta Watchlist !`);
    searchQuery.value = '';
    searchResults.value = [];
    return;
  }

  const movie: MovieRecord = {
    titre: item.title,
    type: item.media_type === 'tv' ? 'Série' : 'Film',
    statut: 'À voir',
    poster_url: item.poster_path ? getPosterUrl(item.poster_path, 'w342') : undefined,
    tmdb_id: item.id,
    annee: (item.release_date || '').split('-')[0],
    genres: item.genres || [],
    synopsis: item.overview
  };

  try {
    await saveMovie(movie);
    toast.success(`Ajouté à la Watchlist : ${item.title}`);
    searchQuery.value = '';
    searchResults.value = [];
    await loadWatchlist();
    emit('data-updated');
  } catch (err) {
    console.error(err);
    toast.error("Erreur lors de l'ajout.");
  }
}

async function addManualTitle() {
  const title = searchQuery.value.trim();
  if (!title) return;

  const movie: MovieRecord = {
    titre: title,
    type: 'Film',
    statut: 'À voir'
  };

  try {
    await saveMovie(movie);
    toast.success(`Ajouté à la Watchlist : ${title}`);
    searchQuery.value = '';
    searchResults.value = [];
    await loadWatchlist();
    emit('data-updated');
  } catch (err) {
    console.error(err);
    toast.error("Erreur lors de l'ajout.");
  }
}

async function handleMarkAsWatched(item: MovieRecord) {
  const allMovies = await getMovies('Vu');
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const itemNorm = normalize(item.titre);

  // Match by tmdb_id if available, or normalized title
  const existingInLibrary = allMovies.find(m => 
    m.id !== item.id && 
    (m.statut === 'Vu' || m.avis || m.note) && 
    ((item.tmdb_id && m.tmdb_id === item.tmdb_id) || normalize(m.titre) === itemNorm)
  );

  let movieToDebrief: MovieRecord;

  if (existingInLibrary) {
    // Rewatch of existing movie: pass existing library movie with prefilled avis, note, etc.
    movieToDebrief = {
      ...existingInLibrary,
      dernier_visionnage: new Date().toISOString().split('T')[0],
      // Pass the watchlist item id so debrief can clean it up upon validation
      watchlist_source_id: item.id
    };
  } else {
    // First time watch: use the item from watchlist
    movieToDebrief = {
      ...item,
      statut: 'Vu',
      dernier_visionnage: new Date().toISOString().split('T')[0],
      watchlist_source_id: item.id
    };
  }

  // Do not save immediately. The Debrief form handles the save correctly to avoid duplicates
  emit('start-debrief', movieToDebrief);
}

async function handleRemove(id?: string) {
  if (!id) return;
  try {
    await deleteMovie(id);
    toast.success('Retiré de la Watchlist.');
    await loadWatchlist();
    emit('data-updated');
  } catch (err) {
    console.error(err);
    toast.error('Erreur lors du retrait.');
  }
}

function itemAvailableOnAnyUserSub(item: MovieRecord): boolean {
  if (!item.tmdb_id) return false;
  const flatrate = providersCache.value[item.tmdb_id]?.flatrate || [];
  return flatrate.some(prov => selectedProviderIds.value.includes(prov.provider_id));
}

function itemAvailableOnSpecificProvider(item: MovieRecord, providerId: number): boolean {
  if (!item.tmdb_id) return false;
  const flatrate = providersCache.value[item.tmdb_id]?.flatrate || [];
  return flatrate.some(prov => prov.provider_id === providerId);
}

const filterChips = computed(() => {
  const list: Array<{ id: string | number; label: string; count: number; isHighlight?: boolean }> = [
    { 
      id: 'all', 
      label: `Tous (${watchlist.value.length})`, 
      count: watchlist.value.length 
    },
    { 
      id: 'my-subs', 
      label: `Mes abonnements (${watchlist.value.filter(item => itemAvailableOnAnyUserSub(item)).length})`, 
      count: watchlist.value.filter(item => itemAvailableOnAnyUserSub(item)).length,
      isHighlight: true
    }
  ];

  for (const provId of selectedProviderIds.value) {
    const label = commonNamesMap[provId] || `Service ${provId}`;
    const count = watchlist.value.filter(item => itemAvailableOnSpecificProvider(item, provId)).length;
    list.push({ id: provId, label: `${label} (${count})`, count });
  }

  return list;
});

const displayList = computed(() => {
  if (selectedFilter.value === 'all') return watchlist.value;
  if (selectedFilter.value === 'my-subs') {
    return watchlist.value.filter(item => itemAvailableOnAnyUserSub(item));
  }
  const pid = Number(selectedFilter.value);
  if (!isNaN(pid)) {
    return watchlist.value.filter(item => itemAvailableOnSpecificProvider(item, pid));
  }
  return watchlist.value;
});
</script>

<template>
  <div class="watchlist-container">
    <!-- Search / Add to Watchlist -->
    <div class="card add-card">
      <div class="search-input-box">
        <Search class="search-icon" />
        <input 
          type="text" 
          v-model="searchQuery" 
          @input="handleSearchInput"
          placeholder="Rechercher un film ou une série à ajouter (TMDB)..." 
          class="input search-input"
        />
        <button 
          v-if="searchQuery && searchResults.length === 0 && !isSearching" 
          class="btn btn-secondary btn-sm btn-manual-add" 
          @click="addManualTitle"
        >
          <Plus class="inline-icon" /> Ajouter manuellement
        </button>
      </div>

      <!-- Autocomplete Dropdown -->
      <div v-if="searchResults.length > 0" class="search-dropdown">
        <div 
          v-for="item in searchResults.slice(0, 5)" 
          :key="item.id" 
          class="search-result-item"
          :title="item.title"
          @click="addToWatchlistFromTMDB(item)"
        >
          <img 
            v-if="item.poster_path" 
            :src="getPosterUrl(item.poster_path, 'w185')" 
            :alt="item.title" 
            class="mini-poster"
          />
          <div v-else class="mini-placeholder">
            <Film class="film-icon" />
          </div>

          <div class="result-details">
            <span class="result-title" :title="item.title">{{ item.title }}</span>
            <span class="result-meta">
              {{ item.media_type === 'tv' ? 'Série' : 'Film' }} 
              {{ item.release_date ? '• ' + item.release_date.split('-')[0] : '' }}
            </span>
          </div>

          <button class="btn btn-primary btn-sm btn-add-icon">
            <Plus class="inline-icon" />
          </button>
        </div>
      </div>
    </div>

    <!-- Platform Subscriptions Filter Bar -->
    <div class="filter-bar">
      <div class="chips-scroll">
        <button 
          v-for="chip in filterChips" 
          :key="chip.id"
          class="filter-chip"
          :class="{ 
            active: selectedFilter === chip.id, 
            highlight: chip.isHighlight 
          }"
          @click="selectedFilter = chip.id"
        >
          <Tv v-if="chip.isHighlight" class="inline-icon" />
          <span>{{ chip.label }}</span>
        </button>
      </div>
    </div>

    <!-- Watchlist Grid -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement de ta Watchlist...</p>
    </div>

    <div v-else-if="displayList.length === 0" class="empty-state card">
      <Bookmark class="empty-icon" />
      <h3>
        {{ selectedFilter !== 'all' ? 'Aucun film trouvé pour ce filtre streaming' : 'Ta Watchlist est vide' }}
      </h3>
      <p>
        {{ selectedFilter !== 'all' 
          ? 'Choisis le filtre "Tous" pour voir l’ensemble de tes envies ou vérifie tes abonnements dans les Paramètres.' 
          : 'Recherche des films ou séries ci-dessus pour les ajouter à ta liste.' 
        }}
      </p>
    </div>

    <div v-else class="watchlist-grid">
      <div v-for="item in displayList" :key="item.id" class="watchlist-card card">
        <div class="card-poster">
          <img 
            v-if="item.poster_url" 
            :src="getPosterUrl(item.poster_url, 'w342')" 
            :alt="item.titre" 
            loading="lazy"
          />
          <div v-else class="poster-placeholder">
            <Film class="film-icon" />
          </div>
        </div>

        <div class="card-content">
          <div class="title-row">
            <h4 class="card-title" :title="item.titre">{{ item.titre }}</h4>
            <span class="badge badge-primary">{{ item.type }}</span>
          </div>

          <!-- Streaming Availability Badges via JustWatch/TMDB -->
          <div class="providers-section">
            <div 
              v-if="item.tmdb_id && providersCache[item.tmdb_id]?.flatrate?.length" 
              class="providers-list"
            >
              <span class="providers-label">En streaming sur :</span>
              <div class="logos-row">
                <span 
                  v-for="p in providersCache[item.tmdb_id]?.flatrate" 
                  :key="p.provider_id"
                  class="provider-badge"
                  :title="p.provider_name"
                >
                  <img :src="`https://image.tmdb.org/t/p/w92${p.logo_path}`" :alt="p.provider_name" />
                </span>
              </div>
            </div>

            <div 
              v-else-if="item.tmdb_id && providersCache[item.tmdb_id]" 
              class="no-streaming"
            >
              <span class="muted-text">Pas de SVOD en France (VOD / Achat seul)</span>
            </div>

            <div v-else-if="item.tmdb_id" class="loading-providers">
              <span class="muted-text">Recherche des plateformes...</span>
            </div>
          </div>

          <p v-if="item.synopsis" class="synopsis-snippet">
            {{ item.synopsis }}
          </p>

          <div class="card-actions">
            <button class="btn btn-primary btn-sm" @click="handleMarkAsWatched(item)">
              <Check class="inline-icon" /> Je l'ai vu !
            </button>
            <button class="btn btn-secondary btn-sm" @click="handleRemove(item.id)">
              <Trash2 class="inline-icon" /> Retirer
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.watchlist-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.add-card {
  position: relative;
  padding: 0.85rem;
}

.search-input-box {
  position: relative;
  display: flex;
  align-items: center;
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

.search-input {
  padding-left: 2.5rem;
}

.btn-manual-add {
  position: absolute;
  right: 0.5rem;
}

.search-dropdown {
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

.search-result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);

  &:hover {
    background: var(--bg-tertiary);
  }
}

.mini-poster {
  width: 32px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
}

.mini-placeholder {
  width: 32px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border-radius: 4px;

  .film-icon {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
  }
}

.result-details {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.result-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-primary);
}

.result-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.btn-add-icon {
  padding: 0.35rem 0.6rem;
}

.filter-bar {
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.chips-scroll {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  padding: 0.45rem 0.85rem;
  border-radius: var(--radius-sm);
  font-size: 0.825rem;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;

  &:hover {
    border-color: var(--border-hover);
    color: var(--text-primary);
  }

  &.active {
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &.highlight.active {
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    border-color: var(--color-success);
    color: var(--color-success);
  }
}

.watchlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.watchlist-card {
  display: flex;
  gap: 1rem;
  padding: 0.85rem;
}

.card-poster {
  width: 85px;
  flex-shrink: 0;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-tertiary);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);

  .film-icon {
    width: 28px;
    height: 28px;
  }
}

.card-content {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 0.45rem;
  min-width: 0;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 800;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.providers-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.providers-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.providers-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-success);
}

.logos-row {
  display: flex;
  gap: 0.35rem;
}

.provider-badge {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  overflow: hidden;
  display: inline-block;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.muted-text {
  font-size: 0.725rem;
  color: var(--text-muted);
}

.synopsis-snippet {
  font-size: 0.75rem;
  color: var(--text-sub);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.4rem;
}

.inline-icon {
  width: 14px;
  height: 14px;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 3rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;

  .empty-icon {
    width: 48px;
    height: 48px;
    color: var(--text-muted);
  }

  p {
    color: var(--text-sub);
    font-size: 0.875rem;
  }
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
