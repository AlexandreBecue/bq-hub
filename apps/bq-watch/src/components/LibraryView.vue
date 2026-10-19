<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { MovieRecord, MovieViewing, TMDBMediaResult } from '../types';
import { getMovies, saveMovie, deleteMovie, getViewingsForMovie, saveViewing, deleteViewing } from '../db/queries';
import { getPosterUrl, searchTMDB } from '../services/tmdb';
import { useToast } from '@bq/theme/useToast';
import { 
  Search, Film, Star, Calendar, Trash2, Edit3, Plus, X, Clapperboard, History
} from '@lucide/vue';

const emit = defineEmits(['data-updated']);
const toast = useToast();

const movies = ref<MovieRecord[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const selectedType = ref<string>('Tous');
const selectedOrigin = ref<string>('Tous');
const selectedGenre = ref<string>('Tous');
const sortBy = ref<'recent' | 'rating' | 'title'>('recent');

// Modal details & edit
const activeMovie = ref<MovieRecord | null>(null);
const isEditModalOpen = ref(false);
const editingMovie = ref<MovieRecord>({
  titre: '',
  type: 'Film',
  statut: 'Vu',
  origine: ['Netflix'],
  dernier_visionnage: new Date().toISOString().split('T')[0],
  avis: '',
  note: 7.0,
  genres: []
});

// Viewings state for active movie
const movieViewings = ref<MovieViewing[]>([]);
const showAddViewing = ref(false);
const newViewingDate = ref(new Date().toISOString().split('T')[0]);
const newViewingSupport = ref('Netflix');
const newViewingComment = ref('');

const platformsList = [
  'Netflix',
  'Prime Video',
  'Cinéma',
  'Disney+',
  'Canal+',
  'Apple TV+',
  'Max',
  'TV',
  'DVD / Blu-Ray',
  'Autre'
];

// TMDB Poster Picker state inside Edit Modal
const posterSearchQuery = ref('');
const posterSearchResults = ref<TMDBMediaResult[]>([]);
const isSearchingPosters = ref(false);

// Live TMDB Autocomplete for Title input in modal
const modalSearchResults = ref<TMDBMediaResult[]>([]);
const showModalDropdown = ref(false);
const newGenreInput = ref('');

let modalTitleTimeout: any = null;
function handleTitleModalInput() {
  clearTimeout(modalTitleTimeout);
  if (!editingMovie.value.titre.trim()) {
    modalSearchResults.value = [];
    showModalDropdown.value = false;
    return;
  }
  modalTitleTimeout = setTimeout(async () => {
    try {
      modalSearchResults.value = await searchTMDB(editingMovie.value.titre);
      showModalDropdown.value = modalSearchResults.value.length > 0;
    } catch {}
  }, 350);
}

function selectMovieFromModalAutocomplete(item: TMDBMediaResult) {
  editingMovie.value.titre = item.title;
  editingMovie.value.type = item.media_type === 'tv' ? 'Série' : 'Film';
  if (item.poster_path) {
    editingMovie.value.poster_url = getPosterUrl(item.poster_path, 'w342');
  }
  editingMovie.value.tmdb_id = item.id;
  editingMovie.value.annee = (item.release_date || item.first_air_date || '').split('-')[0];
  if (item.genres && item.genres.length > 0) {
    editingMovie.value.genres = [...item.genres];
  }
  if (item.overview) {
    editingMovie.value.synopsis = item.overview;
  }
  showModalDropdown.value = false;
  modalSearchResults.value = [];
  toast.success(`Données synchronisées pour : ${item.title} !`);
}

function addGenre() {
  const g = newGenreInput.value.trim();
  if (g) {
    if (!editingMovie.value.genres) editingMovie.value.genres = [];
    if (!editingMovie.value.genres.includes(g)) {
      editingMovie.value.genres.push(g);
    }
    newGenreInput.value = '';
  }
}

function removeGenre(g: string) {
  if (editingMovie.value.genres) {
    editingMovie.value.genres = editingMovie.value.genres.filter(item => item !== g);
  }
}

async function loadData() {
  isLoading.value = true;
  try {
    movies.value = await getMovies('Vu');
  } catch (err) {
    console.error('Erreur chargement films:', err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadData();
});

const availableOrigins = computed(() => {
  const set = new Set<string>();
  for (const m of movies.value) {
    if (m.origine) {
      m.origine.forEach(o => set.add(o));
    }
  }
  return Array.from(set).sort();
});

const availableGenres = computed(() => {
  const set = new Set<string>();
  for (const m of movies.value) {
    if (m.genres) {
      m.genres.forEach(g => set.add(g));
    }
  }
  return Array.from(set).sort();
});

const filteredMovies = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();

  return movies.value.filter(m => {
    // Type filter
    if (selectedType.value !== 'Tous' && m.type !== selectedType.value) {
      return false;
    }
    // Origin filter
    if (selectedOrigin.value !== 'Tous') {
      if (!m.origine || !m.origine.includes(selectedOrigin.value)) {
        return false;
      }
    }
    // Genre filter
    if (selectedGenre.value !== 'Tous') {
      if (!m.genres || !m.genres.includes(selectedGenre.value)) {
        return false;
      }
    }
    // Search query
    if (q) {
      const inTitle = m.titre.toLowerCase().includes(q);
      const inAvis = (m.avis || '').toLowerCase().includes(q);
      const inOrigin = (m.origine || []).some(o => o.toLowerCase().includes(q));
      const inGenre = (m.genres || []).some(g => g.toLowerCase().includes(q));
      if (!inTitle && !inAvis && !inOrigin && !inGenre) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy.value === 'rating') {
      const noteA = a.note ?? -1;
      const noteB = b.note ?? -1;
      return noteB - noteA;
    }
    if (sortBy.value === 'title') {
      return a.titre.localeCompare(b.titre);
    }
    // Default 'recent'
    const dateA = a.dernier_visionnage || '';
    const dateB = b.dernier_visionnage || '';
    if (dateA && dateB) return dateB.localeCompare(dateA);
    if (dateA) return -1;
    if (dateB) return 1;
    return a.titre.localeCompare(b.titre);
  });
});

async function openDetails(movie: MovieRecord) {
  activeMovie.value = movie;
  showAddViewing.value = false;
  newViewingDate.value = new Date().toISOString().split('T')[0];
  newViewingSupport.value = (movie.origine && movie.origine.length > 0) ? movie.origine[0] : 'Netflix';
  newViewingComment.value = '';
  if (movie.id) {
    movieViewings.value = await getViewingsForMovie(movie.id);
  } else {
    movieViewings.value = [];
  }
}

async function handleAddViewing() {
  if (!activeMovie.value?.id) return;
  try {
    await saveViewing({
      movie_id: activeMovie.value.id,
      titre: activeMovie.value.titre,
      date: newViewingDate.value,
      support: newViewingSupport.value,
      commentaire: newViewingComment.value.trim()
    });
    toast.success('Nouveau visionnage enregistré !');
    movieViewings.value = await getViewingsForMovie(activeMovie.value.id);
    showAddViewing.value = false;
    newViewingComment.value = '';
    await loadData();
    emit('data-updated');
  } catch (err) {
    console.error(err);
    toast.error("Erreur lors de l'enregistrement du visionnage.");
  }
}

async function handleDeleteViewing(viewingId?: string) {
  if (!viewingId || !activeMovie.value?.id) return;
  try {
    await deleteViewing(viewingId, activeMovie.value.id);
    toast.success('Visionnage supprimé.');
    movieViewings.value = await getViewingsForMovie(activeMovie.value.id);
    await loadData();
    emit('data-updated');
  } catch (err) {
    console.error(err);
    toast.error('Erreur lors de la suppression.');
  }
}

function openAddModal() {
  editingMovie.value = {
    titre: '',
    type: 'Film',
    statut: 'Vu',
    origine: ['Netflix'],
    dernier_visionnage: new Date().toISOString().split('T')[0],
    avis: '',
    note: 7.0,
    genres: []
  };
  posterSearchQuery.value = '';
  posterSearchResults.value = [];
  modalSearchResults.value = [];
  showModalDropdown.value = false;
  isEditModalOpen.value = true;
}

function openEditCurrent() {
  if (!activeMovie.value) return;
  editingMovie.value = { ...activeMovie.value };
  posterSearchQuery.value = activeMovie.value.titre;
  posterSearchResults.value = [];
  modalSearchResults.value = [];
  showModalDropdown.value = false;
  activeMovie.value = null;
  isEditModalOpen.value = true;
}

async function handleSearchPosters() {
  const query = posterSearchQuery.value.trim() || editingMovie.value.titre.trim();
  if (!query) return;
  isSearchingPosters.value = true;
  try {
    posterSearchResults.value = await searchTMDB(query);
    if (posterSearchResults.value.length === 0) {
      toast.warning('Aucune affiche trouvée sur TMDB pour cette recherche.');
    }
  } catch (err) {
    console.error(err);
    toast.error('Erreur lors de la recherche TMDB.');
  } finally {
    isSearchingPosters.value = false;
  }
}

function applySelectedPoster(item: TMDBMediaResult) {
  editingMovie.value.titre = item.title;
  editingMovie.value.type = item.media_type === 'tv' ? 'Série' : 'Film';
  if (item.poster_path) {
    editingMovie.value.poster_url = getPosterUrl(item.poster_path, 'w342');
  }
  editingMovie.value.tmdb_id = item.id;
  editingMovie.value.annee = (item.release_date || item.first_air_date || '').split('-')[0];
  if (item.genres && item.genres.length > 0) {
    editingMovie.value.genres = [...item.genres];
  }
  if (item.overview) {
    editingMovie.value.synopsis = item.overview;
  }
  posterSearchResults.value = [];
  toast.success(`Données synchronisées : ${item.title} (${editingMovie.value.annee || 'N/A'})`);
}

async function handleSaveMovie() {
  if (!editingMovie.value.titre.trim()) {
    toast.warning('Le titre est obligatoire.');
    return;
  }
  try {
    await saveMovie(editingMovie.value);
    toast.success('Visionnage enregistré avec succès !');
    isEditModalOpen.value = false;
    await loadData();
    emit('data-updated');
  } catch (err) {
    console.error(err);
    toast.error("Erreur lors de l'enregistrement.");
  }
}

async function handleDeleteMovie(id?: string) {
  if (!id) return;
  try {
    await deleteMovie(id);
    toast.success('Contenu supprimé.');
    activeMovie.value = null;
    await loadData();
    emit('data-updated');
  } catch (err) {
    console.error(err);
    toast.error('Erreur lors de la suppression.');
  }
}

function getRatingBadgeClass(note?: number) {
  if (note === undefined || note === null) return '';
  if (note >= 8.5) return 'badge-success';
  if (note >= 7) return 'badge-primary';
  if (note >= 5) return 'badge-warning';
  return 'badge-danger';
}
</script>

<template>
  <div class="library-container">
    <!-- Header Controls -->
    <div class="controls-card card">
      <div class="search-row">
        <div class="search-input-wrapper">
          <Search class="search-icon" />
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Rechercher un film, une série, un genre ou un avis..." 
            class="input search-input"
          />
          <button v-if="searchQuery" class="btn-clear-search" @click="searchQuery = ''">
            <X class="clear-icon" />
          </button>
        </div>
        <button class="btn btn-primary" @click="openAddModal">
          <Plus class="btn-icon" /> Ajouter
        </button>
      </div>

      <!-- Filters Row -->
      <div class="filters-row">
        <div class="filter-group">
          <label>Type :</label>
          <select v-model="selectedType" class="select filter-select">
            <option value="Tous">Tous ({{ movies.length }})</option>
            <option value="Film">Films</option>
            <option value="Série">Séries</option>
            <option value="Documentaire">Documentaires</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Plateforme :</label>
          <select v-model="selectedOrigin" class="select filter-select">
            <option value="Tous">Toutes</option>
            <option v-for="org in availableOrigins" :key="org" :value="org">{{ org }}</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Genre :</label>
          <select v-model="selectedGenre" class="select filter-select">
            <option value="Tous">Tous</option>
            <option v-for="g in availableGenres" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Tri :</label>
          <select v-model="sortBy" class="select filter-select">
            <option value="recent">Plus récents</option>
            <option value="rating">Meilleures notes</option>
            <option value="title">Titre A-Z</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Movies Grid -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement de ta cinémathèque...</p>
    </div>

    <div v-else-if="filteredMovies.length === 0" class="empty-state card">
      <Clapperboard class="empty-icon" />
      <h3>Aucun film ou série trouvé</h3>
      <p>Modifie tes filtres de recherche ou ajoute un nouveau visionnage.</p>
    </div>

    <div v-else class="movies-grid">
      <div 
        v-for="movie in filteredMovies" 
        :key="movie.id" 
        class="movie-card card" 
        @click="openDetails(movie)"
      >
        <div class="poster-wrapper">
          <img 
            v-if="movie.poster_url" 
            :src="getPosterUrl(movie.poster_url, 'w342')" 
            :alt="movie.titre" 
            class="poster-img"
            loading="lazy"
          />
          <div v-else class="poster-placeholder">
            <Film class="film-icon" />
            <span class="placeholder-title">{{ movie.titre }}</span>
          </div>

          <div v-if="movie.note !== undefined && movie.note !== null" class="rating-badge" :class="getRatingBadgeClass(movie.note)">
            <Star class="star-icon" />
            <span>{{ movie.note.toFixed(1) }}</span>
          </div>
        </div>

        <div class="movie-info">
          <h4 class="movie-title" :title="movie.titre">{{ movie.titre }}</h4>
          
          <div class="tags-row">
            <span class="badge badge-primary">{{ movie.type }}</span>
            <span v-for="org in movie.origine" :key="org" class="badge">
              {{ org }}
            </span>
          </div>

          <!-- Genres row -->
          <div v-if="movie.genres && movie.genres.length > 0" class="tags-row genres-preview-row">
            <span v-for="g in movie.genres.slice(0, 2)" :key="g" class="badge badge-genre">
              {{ g }}
            </span>
          </div>

          <div v-if="movie.dernier_visionnage" class="date-row">
            <Calendar class="small-icon" />
            <span>{{ movie.dernier_visionnage }}</span>
            <span v-if="movie.visionnages_count && movie.visionnages_count > 1" class="viewing-count-chip">
              vu {{ movie.visionnages_count }}x
            </span>
          </div>

          <p v-if="movie.avis" class="review-snippet" :title="movie.avis">
            {{ movie.avis }}
          </p>
        </div>
      </div>
    </div>

    <!-- Modal Movie Details -->
    <div v-if="activeMovie" class="modal-overlay" @click.self="activeMovie = null">
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ activeMovie.titre }}</h3>
          <button class="modal-close" @click="activeMovie = null">✕</button>
        </div>

        <div class="modal-body details-body">
          <div class="details-top">
            <div class="details-poster">
              <img 
                v-if="activeMovie.poster_url" 
                :src="getPosterUrl(activeMovie.poster_url, 'w342')" 
                :alt="activeMovie.titre" 
              />
              <div v-else class="poster-placeholder">
                <Film class="film-icon" />
              </div>
            </div>

            <div class="details-meta">
              <div class="meta-item">
                <span class="meta-label">Type :</span>
                <span class="badge badge-primary">{{ activeMovie.type }}</span>
              </div>

              <div class="meta-item">
                <span class="meta-label">Vu le :</span>
                <span>{{ activeMovie.dernier_visionnage || 'Date non précisée' }}</span>
              </div>

              <div class="meta-item">
                <span class="meta-label">Origine :</span>
                <div class="tags-row">
                  <span v-for="org in activeMovie.origine" :key="org" class="badge">
                    {{ org }}
                  </span>
                </div>
              </div>

              <div v-if="activeMovie.genres && activeMovie.genres.length > 0" class="meta-item">
                <span class="meta-label">Genres :</span>
                <div class="tags-row">
                  <span v-for="g in activeMovie.genres" :key="g" class="badge badge-genre">
                    {{ g }}
                  </span>
                </div>
              </div>

              <div v-if="activeMovie.note !== undefined && activeMovie.note !== null" class="meta-item">
                <span class="meta-label">Note :</span>
                <span class="rating-display" :class="getRatingBadgeClass(activeMovie.note)">
                  ⭐ {{ activeMovie.note }} / 10
                </span>
              </div>
            </div>
          </div>

          <div v-if="activeMovie.avis" class="details-review-box">
            <h4>Avis & Ressentis :</h4>
            <p>{{ activeMovie.avis }}</p>
          </div>

          <!-- Visionnages History Section -->
          <div class="details-viewings-section">
            <div class="viewings-section-header">
              <h4 class="flex-row align-center gap-1"><History :size="16" /> Historique des visionnages ({{ movieViewings.length || (activeMovie.dernier_visionnage ? 1 : 0) }} fois)</h4>
              <button class="btn btn-secondary btn-sm" @click="showAddViewing = !showAddViewing">
                <Plus class="inline-icon" /> {{ showAddViewing ? 'Annuler' : 'Ajouter un visionnage' }}
              </button>
            </div>

            <!-- Inline Add Viewing Form -->
            <div v-if="showAddViewing" class="add-viewing-card card">
              <div class="form-row">
                <div class="form-group">
                  <label>Date du visionnage</label>
                  <input type="date" v-model="newViewingDate" class="input input-sm" />
                </div>
                <div class="form-group">
                  <label>Support</label>
                  <select v-model="newViewingSupport" class="select select-sm">
                    <option v-for="p in platformsList" :key="p" :value="p">{{ p }}</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>Commentaire (optionnel)</label>
                <input 
                  type="text" 
                  v-model="newViewingComment" 
                  class="input input-sm" 
                  placeholder="Ex: Séance cinéma en famille, revu en VO..." 
                  @keyup.enter="handleAddViewing"
                />
              </div>
              <button class="btn btn-primary btn-sm" @click="handleAddViewing">
                Valider ce visionnage
              </button>
            </div>

            <!-- Viewings List -->
            <div class="viewings-list" v-if="movieViewings.length > 0">
              <div v-for="v in movieViewings" :key="v.id" class="viewing-item">
                <div class="viewing-left">
                  <Calendar class="small-icon" />
                  <span class="viewing-date">{{ v.date }}</span>
                  <span class="badge">{{ v.support }}</span>
                  <span v-if="v.commentaire" class="viewing-comment">« {{ v.commentaire }} »</span>
                </div>
                <button 
                  v-if="movieViewings.length > 1" 
                  class="btn-delete-viewing" 
                  @click="handleDeleteViewing(v.id)" 
                  title="Supprimer ce visionnage"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-danger btn-sm" @click="handleDeleteMovie(activeMovie?.id)">
            <Trash2 class="btn-icon" /> Supprimer
          </button>
          <button class="btn btn-secondary btn-sm" @click="openEditCurrent">
            <Edit3 class="btn-icon" /> Modifier
          </button>
          <button class="btn btn-primary btn-sm" @click="activeMovie = null">
            Fermer
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Add / Edit Movie with TMDB Poster Picker -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click.self="isEditModalOpen = false">
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ editingMovie.id ? 'Modifier le visionnage' : 'Ajouter un visionnage' }}</h3>
          <button class="modal-close" @click="isEditModalOpen = false">✕</button>
        </div>

        <div class="modal-body">
          <!-- Title with live TMDB autocomplete -->
          <div class="form-group modal-title-autocomplete-group">
            <label>Titre de l'œuvre *</label>
            <div class="modal-title-input-wrapper">
              <Search class="search-mini-icon" />
              <input 
                type="text" 
                v-model="editingMovie.titre" 
                @input="handleTitleModalInput"
                class="input modal-title-input" 
                placeholder="Taper un titre pour autocompléter (TMDB)..." 
                required 
              />
            </div>

            <!-- Autocomplete Dropdown in Modal -->
            <div v-if="showModalDropdown && modalSearchResults.length > 0" class="modal-autocomplete-dropdown">
              <div 
                v-for="item in modalSearchResults.slice(0, 5)" 
                :key="item.id" 
                class="modal-autocomplete-item"
                @click="selectMovieFromModalAutocomplete(item)"
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

                <div class="modal-result-details">
                  <span class="modal-result-title">{{ item.title }}</span>
                  <span class="modal-result-meta">
                    {{ item.media_type === 'tv' ? 'Série' : 'Film' }} 
                    {{ item.release_date ? '• ' + item.release_date.split('-')[0] : '' }}
                    {{ item.genres?.length ? '• ' + item.genres.slice(0, 2).join(', ') : '' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- TMDB Poster Picker Section -->
          <div class="form-group poster-picker-group">
            <label>Affiche & Précision TMDB</label>

            <div class="current-poster-preview" v-if="editingMovie.poster_url">
              <img :src="getPosterUrl(editingMovie.poster_url, 'w185')" :alt="editingMovie.titre" class="edit-poster-thumb" />
              <div class="poster-actions">
                <span class="poster-status">Affiche active</span>
                <button type="button" class="btn btn-secondary btn-sm" @click="editingMovie.poster_url = ''">
                  Retirer l'affiche
                </button>
              </div>
            </div>

            <div class="poster-search-bar">
              <input 
                type="text" 
                v-model="posterSearchQuery" 
                class="input input-sm" 
                placeholder="Titre + année, ou ID TMDB..."
                @keyup.enter="handleSearchPosters"
              />
              <button type="button" class="btn btn-secondary btn-sm" @click="handleSearchPosters" :disabled="isSearchingPosters">
                <Search class="small-icon" /> {{ isSearchingPosters ? 'Recherche...' : 'Chercher' }}
              </button>
            </div>

            <!-- Matching TMDB Posters Carousel -->
            <div v-if="posterSearchResults.length > 0" class="tmdb-posters-carousel">
              <div 
                v-for="item in posterSearchResults" 
                :key="item.id" 
                class="tmdb-poster-option"
                :class="{ selected: editingMovie.tmdb_id === item.id }"
                @click="applySelectedPoster(item)"
              >
                <img v-if="item.poster_path" :src="getPosterUrl(item.poster_path, 'w185')" :alt="item.title" />
                <div v-else class="empty-poster-thumb">Sans affiche</div>
                <span class="poster-opt-title">{{ item.title }}</span>
                <span class="poster-opt-year">{{ (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A' }}</span>
              </div>
            </div>
          </div>

          <!-- Genres in edit modal -->
          <div class="form-group">
            <label>Genres associés</label>
            <div class="tags-row" v-if="editingMovie.genres && editingMovie.genres.length > 0">
              <span v-for="g in editingMovie.genres" :key="g" class="badge badge-genre">
                {{ g }}
                <button type="button" class="btn-remove-tag-mini" @click="removeGenre(g)" title="Retirer">✕</button>
              </span>
            </div>
            <div v-else class="empty-genre-hint">Aucun genre associé. Sélectionne un film TMDB ou ajoute un genre manuellement.</div>
            <div class="add-genre-row">
              <input 
                type="text" 
                v-model="newGenreInput" 
                class="input input-sm" 
                placeholder="Ajouter un genre (ex: Action, Romance...)" 
                @keyup.enter="addGenre"
              />
              <button type="button" class="btn btn-secondary btn-sm" @click="addGenre" :disabled="!newGenreInput.trim()">
                <Plus class="inline-icon" /> Ajouter
              </button>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Type</label>
              <select v-model="editingMovie.type" class="select">
                <option value="Film">Film</option>
                <option value="Série">Série</option>
                <option value="Documentaire">Documentaire</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            <div class="form-group">
              <label>Dernier visionnage</label>
              <input type="date" v-model="editingMovie.dernier_visionnage" class="input" />
            </div>
          </div>

          <div class="form-group">
            <label>Note (/10)</label>
            <div class="rating-slider-row">
              <input 
                type="range" 
                min="0" 
                max="10" 
                step="0.5" 
                v-model.number="editingMovie.note" 
                class="range-slider"
              />
              <span class="rating-val">{{ editingMovie.note ?? 7.0 }} / 10</span>
            </div>
          </div>

          <div class="form-group">
            <label>Avis & Ressentis</label>
            <textarea 
              v-model="editingMovie.avis" 
              class="textarea" 
              rows="4" 
              placeholder="Tes ressentis, éléments marquants, dénouement, réserves..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="isEditModalOpen = false">Annuler</button>
          <button class="btn btn-primary" @click="handleSaveMovie">Enregistrer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.library-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.controls-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.search-input-wrapper {
  position: relative;
  flex-grow: 1;
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

.btn-clear-search {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;

  &:hover {
    color: var(--text-primary);
  }
}

.clear-icon {
  width: 16px;
  height: 16px;
}

.filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-sub);
  }
}

.filter-select {
  padding: 0.4rem 0.65rem;
  font-size: 0.825rem;
  width: auto;
}

.movies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.25rem;
}

.movie-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;

  &:hover {
    transform: translateY(-3px);
  }
}

.poster-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  background: var(--bg-tertiary);
}

.poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  text-align: center;
  color: var(--text-muted);

  .film-icon {
    width: 36px;
    height: 36px;
  }

  .placeholder-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-sub);
  }
}

.rating-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: color-mix(in srgb, var(--color-black) 80%, transparent);
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.45rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 800;

  .star-icon {
    width: 12px;
    height: 12px;
    color: var(--color-warning);
    fill: var(--color-warning);
  }
}

.movie-info {
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex-grow: 1;
}

.movie-title {
  font-size: 0.95rem;
  font-weight: 800;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.badge-genre {
  background: color-mix(in srgb, var(--color-secondary) 15%, transparent);
  border-color: color-mix(in srgb, var(--color-secondary) 30%, transparent);
  color: var(--color-secondary);
}

.date-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.725rem;
  color: var(--text-muted);
}

.small-icon {
  width: 12px;
  height: 12px;
}

.review-snippet {
  font-size: 0.75rem;
  color: var(--text-sub);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 0.25rem;
}

.details-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.details-top {
  display: flex;
  gap: 1.25rem;
}

.details-poster {
  width: 120px;
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

.details-meta {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  flex-grow: 1;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.meta-label {
  font-weight: 700;
  color: var(--text-muted);
}

.rating-display {
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--color-warning);
}

.details-review-box {
  background: color-mix(in srgb, var(--color-white) 3%, transparent);
  border: 1px solid var(--border-color);
  padding: 1rem;
  border-radius: var(--radius-sm);

  h4 {
    font-size: 0.9rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    color: var(--color-primary);
  }

  p {
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--text-primary);
    white-space: pre-wrap;
  }
}

.poster-picker-group {
  background: color-mix(in srgb, var(--color-white) 2%, transparent);
  border: 1px solid var(--border-color);
  padding: 0.85rem;
  border-radius: var(--radius-sm);
}

.current-poster-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.edit-poster-thumb {
  width: 50px;
  height: 75px;
  object-fit: cover;
  border-radius: 4px;
}

.poster-actions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.poster-status {
  font-size: 0.75rem;
  color: var(--color-success);
  font-weight: 700;
}

.poster-search-bar {
  display: flex;
  gap: 0.5rem;
}

.tmdb-posters-carousel {
  display: flex;
  gap: 0.65rem;
  overflow-x: auto;
  padding: 0.75rem 0 0.25rem 0;
}

.tmdb-poster-option {
  width: 70px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  transition: var(--transition);

  img {
    width: 100%;
    height: 100px;
    object-fit: cover;
    border-radius: 4px;
  }

  .empty-poster-thumb {
    width: 100%;
    height: 100px;
    background: var(--bg-tertiary);
    font-size: 0.65rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    border-radius: 4px;
  }

  .poster-opt-title {
    font-size: 0.65rem;
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    margin-top: 0.25rem;
  }

  .poster-opt-year {
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  &:hover {
    border-color: var(--border-hover);
    transform: scale(1.05);
  }

  &.selected {
    border-color: var(--color-primary);
  }
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.rating-slider-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.range-slider {
  flex-grow: 1;
}

.rating-val {
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--color-warning);
  width: 70px;
  text-align: right;
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

.modal-title-autocomplete-group {
  position: relative;
}

.modal-title-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;

  .search-mini-icon {
    position: absolute;
    left: 0.85rem;
    width: 16px;
    height: 16px;
    color: var(--text-muted);
  }

  .modal-title-input {
    padding-left: 2.35rem;
    font-weight: 700;
  }
}

.modal-autocomplete-dropdown {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 16px 32px color-mix(in srgb, var(--color-black) 90%, transparent);
}

.modal-autocomplete-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);

  &:hover {
    background: var(--bg-tertiary);
  }
}

.modal-result-details {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.modal-result-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-result-meta {
  font-size: 0.725rem;
  color: var(--text-muted);
}

.empty-genre-hint {
  font-size: 0.775rem;
  color: var(--text-muted);
  font-style: italic;
  margin-bottom: 0.35rem;
}

.add-genre-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn-remove-tag-mini {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
  padding: 0 0.15rem;

  &:hover {
    color: var(--color-danger);
  }
}

.viewing-count-chip {
  font-size: 0.675rem;
  font-weight: 800;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  padding: 0.05rem 0.35rem;
  border-radius: var(--radius-sm);
}

.details-viewings-section {
  background: color-mix(in srgb, var(--color-white) 2%, transparent);
  border: 1px solid var(--border-color);
  padding: 1rem;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.viewings-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h4 {
    font-size: 0.9rem;
    font-weight: 800;
    color: var(--color-primary);
    margin: 0;
  }
}

.add-viewing-card {
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.viewings-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.viewing-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  font-size: 0.8rem;
}

.viewing-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.viewing-date {
  font-weight: 700;
}

.viewing-comment {
  font-style: italic;
  color: var(--text-sub);
}

.btn-delete-viewing {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.2rem 0.4rem;

  &:hover {
    color: var(--color-danger);
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
