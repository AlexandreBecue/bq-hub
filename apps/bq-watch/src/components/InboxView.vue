<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { InboxItem, MovieRecord } from '../types';
import { getInboxItems, addInboxItems, removeInboxItem, clearInbox, saveMovie, getMovies, saveViewing } from '../db/queries';
import { useToast } from '@bq/theme/useToast';
import { 
  Inbox, UploadCloud, FileText, Check, Trash2, Sparkles, CheckCheck
} from '@lucide/vue';

const emit = defineEmits(['data-updated', 'start-debrief']);
const toast = useToast();

const inboxItems = ref<InboxItem[]>([]);
const isLoading = ref(true);
const isDragging = ref(false);

async function loadInbox() {
  isLoading.value = true;
  try {
    inboxItems.value = await getInboxItems();
  } catch (err) {
    console.error('Erreur chargement inbox:', err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadInbox();
});

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    processFiles(Array.from(files));
  }
}

function handleFileInput(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    processFiles(Array.from(target.files));
    target.value = '';
  }
}

async function processFiles(files: File[]) {
  const newItems: Array<Omit<InboxItem, 'id'>> = [];

  for (const file of files) {
    const text = await file.text();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      parseCSV(text, fileName, newItems);
    } else if (fileName.endsWith('.json')) {
      parseJSON(text, fileName, newItems);
    }
  }

  if (newItems.length === 0) {
    toast.warning('Aucun nouveau visionnage détecté ou format de fichier non reconnu.');
    return;
  }

  try {
    const count = await addInboxItems(newItems);
    toast.success(`${count} nouveau(x) contenu(s) ajouté(s) à la boîte de réception !`);
    await loadInbox();
    emit('data-updated');
  } catch (err) {
    console.error(err);
    toast.error("Erreur lors de l'importation.");
  }
}

function parseCSV(content: string, fileName: string, targetList: Array<Omit<InboxItem, 'id'>>) {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return;

  const header = lines[0].toLowerCase();
  const isNetflix = header.includes('title') && header.includes('date');
  const isCinema = fileName.includes('cinema') || header.includes('film');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Split by comma outside quotes
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());

    if (isNetflix) {
      const rawTitle = parts[0];
      const rawDate = parts[1];
      if (rawTitle) {
        // If series format "Title: Season 1: Episode 1", extract main show title
        const cleanTitle = rawTitle.includes(':') ? rawTitle.split(':')[0].trim() : rawTitle;
        const isSeries = rawTitle.includes(':');
        targetList.push({
          titre: cleanTitle,
          type: isSeries ? 'Série' : 'Film',
          source: 'Netflix',
          date: formatDateString(rawDate)
        });
      }
    } else if (isCinema) {
      const date = parts[0];
      const film = parts[1] || parts[0];
      if (film) {
        targetList.push({
          titre: film,
          type: 'Film',
          source: 'Cinéma',
          date: formatDateString(date)
        });
      }
    }
  }
}

function parseJSON(content: string, fileName: string, targetList: Array<Omit<InboxItem, 'id'>>) {
  try {
    const data = JSON.parse(content);
    const list = Array.isArray(data) ? data : data.records || data.history || [];

    for (const item of list) {
      const title = item.Title || item.title || item.titre || item.name;
      const date = item.PlaybackDate || item.date || item.lastWatched;
      if (title) {
        const cleanTitle = String(title).includes(':') ? String(title).split(':')[0].trim() : String(title);
        targetList.push({
          titre: cleanTitle,
          type: 'Film',
          source: fileName.includes('prime') ? 'Prime Video' : 'Import JSON',
          date: formatDateString(date)
        });
      }
    }
  } catch (err) {
    console.error('Erreur parsing JSON:', err);
  }
}

function formatDateString(rawDate?: string): string {
  if (!rawDate) return '';
  // handles dd/mm/yy or dd/mm/yyyy
  if (rawDate.includes('/')) {
    const parts = rawDate.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }
  }
  // already ISO
  if (rawDate.includes('-')) {
    return rawDate.split('T')[0];
  }
  return rawDate;
}

async function handleMarkAsSeen(item: InboxItem) {
  const allMovies = await getMovies();
  const existing = allMovies.find(m => m.titre.toLowerCase() === item.titre.toLowerCase());

  try {
    let movieId = existing?.id;
    if (!existing) {
      const movie: MovieRecord = {
        titre: item.titre,
        type: item.type,
        origine: [item.source],
        dernier_visionnage: item.date || new Date().toISOString().split('T')[0],
        statut: 'Vu'
      };
      movieId = await saveMovie(movie);
    }

    if (movieId) {
      await saveViewing({
        movie_id: movieId,
        titre: item.titre,
        date: item.date || new Date().toISOString().split('T')[0],
        support: item.source,
        commentaire: ''
      });
    }

    await removeInboxItem(item.id);
    toast.success(existing ? `Visionnage ajouté à "${item.titre}" !` : `"${item.titre}" ajouté à la bibliothèque !`);
    await loadInbox();
    emit('data-updated');
  } catch (err) {
    console.error(err);
    toast.error("Erreur lors de l'enregistrement.");
  }
}

async function handleStartDebrief(item: InboxItem) {
  const movie: MovieRecord = {
    titre: item.titre,
    type: item.type,
    origine: [item.source],
    dernier_visionnage: item.date || new Date().toISOString().split('T')[0],
    statut: 'Vu'
  };
  await removeInboxItem(item.id);
  await loadInbox();
  emit('start-debrief', movie);
}

async function handleIgnore(id: string) {
  try {
    await removeInboxItem(id);
    await loadInbox();
    toast.info('Élément retiré de la boîte de réception.');
  } catch (err) {
    console.error(err);
  }
}

async function handleMarkAllAsSeen() {

  const allMovies = await getMovies();

  for (const item of inboxItems.value) {
    const existing = allMovies.find(m => m.titre.toLowerCase() === item.titre.toLowerCase());
    let movieId = existing?.id;
    if (!existing) {
      movieId = await saveMovie({
        titre: item.titre,
        type: item.type,
        origine: [item.source],
        dernier_visionnage: item.date || new Date().toISOString().split('T')[0],
        statut: 'Vu'
      });
    }
    if (movieId) {
      await saveViewing({
        movie_id: movieId,
        titre: item.titre,
        date: item.date || new Date().toISOString().split('T')[0],
        support: item.source,
        commentaire: ''
      });
    }
  }
  await clearInbox();
  toast.success('Tous les visionnages ont été enregistrés !');
  await loadInbox();
  emit('data-updated');
}
</script>

<template>
  <div class="inbox-container">
    <!-- Drag and Drop Import Card -->
    <div 
      class="dropzone-card card" 
      :class="{ dragging: isDragging }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <UploadCloud class="upload-icon" />
      <div class="dropzone-text">
        <h3>Glisse tes exports de visionnages ici</h3>
        <p>Prend en charge les historiques Netflix (.csv) et Prime Video (.json).</p>
      </div>

      <label class="btn btn-primary btn-sm btn-browse">
        <FileText class="btn-icon" /> Parcourir un fichier
        <input type="file" multiple accept=".csv,.json" class="hidden-file-input" @change="handleFileInput" />
      </label>
    </div>

    <!-- Inbox Header & Batch Actions -->
    <div v-if="inboxItems.length > 0" class="inbox-header-row">
      <h4>Contenus en attente ({{ inboxItems.length }})</h4>
      <div class="batch-buttons">
        <button class="btn btn-secondary btn-sm" @click="handleMarkAllAsSeen">
          <CheckCheck class="btn-icon" /> Tout marquer comme vu
        </button>
      </div>
    </div>

    <!-- Items List -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement de la boîte de réception...</p>
    </div>

    <div v-else-if="inboxItems.length === 0" class="empty-state card">
      <Inbox class="empty-icon" />
      <h3>Boîte de réception vide</h3>
      <p>Glisse un export ci-dessus pour détecter tes derniers visionnages à débriefer.</p>
    </div>

    <div v-else class="inbox-list">
      <div v-for="item in inboxItems" :key="item.id" class="inbox-card card">
        <div class="inbox-meta">
          <h4 class="inbox-title">{{ item.titre }}</h4>
          <div class="inbox-badges">
            <span class="badge badge-primary">{{ item.type }}</span>
            <span class="badge">{{ item.source }}</span>
            <span v-if="item.date" class="date-badge">Vu le {{ item.date }}</span>
          </div>
        </div>

        <div class="inbox-actions">
          <button class="btn btn-primary btn-sm" @click="handleStartDebrief(item)" title="Lancer le débriefing avec Gemini">
            <Sparkles class="btn-icon" /> Débriefer
          </button>
          <button class="btn btn-secondary btn-sm" @click="handleMarkAsSeen(item)" title="Marquer comme vu sans débrief">
            <Check class="btn-icon" /> Vu
          </button>
          <button class="btn-icon-danger" @click="handleIgnore(item.id)" title="Ignorer">
            <Trash2 class="small-icon" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.inbox-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dropzone-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  padding: 2rem 1.5rem;
  border: 2px dashed var(--border-color);
  text-align: center;
  transition: var(--transition);

  &.dragging {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
  }
}

.upload-icon {
  width: 44px;
  height: 44px;
  color: var(--color-primary);
}

.dropzone-text {
  h3 {
    font-size: 1.1rem;
    font-weight: 800;
    margin-bottom: 0.25rem;
  }
  p {
    font-size: 0.85rem;
    color: var(--text-sub);
    margin: 0;
  }
}

.hidden-file-input {
  display: none;
}

.inbox-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h4 {
    font-size: 1rem;
    font-weight: 800;
  }
}

.inbox-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.inbox-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  gap: 1rem;
}

.inbox-meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.inbox-title {
  font-size: 1rem;
  font-weight: 800;
  margin: 0;
}

.inbox-badges {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.date-badge {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.inbox-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.small-icon {
  width: 16px;
  height: 16px;
}

.btn-icon-danger {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.4rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  }
}

.empty-state {
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
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
