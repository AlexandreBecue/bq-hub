<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { LUDOTHEQUE_COL_ID, getLudothequeRecords } from '../db/queries';
import { Search, Plus, Trash2, Edit2, ShieldAlert, X } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const games = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const searchQuery = ref('');
const typeFilter = ref(''); // all, société, vidéo
const progressFilter = ref(''); // all, Jamais joué, En cours, Terminé, 100%

const showAddModal = ref(false);
const showEditModal = ref(false);
const editingGame = ref<RecordEntry | null>(null);

// Form State
const formGame = ref({
  nom: '',
  type_jeu: 'Jeux de société', // "Jeux de société", "Jeux vidéo"
  min_players: 2,
  max_players: 4,
  playtime: '',
  progression: 'Jamais joué',
  plateforme: 'Steam',
  possede: true
});

const typesList = ["Jeux de société", "Jeux vidéo"];
const progressList = ["Jamais joué", "En cours", "Terminé", "100%"];
const platformsList = ["Nintendo Switch", "PS5", "PS4", "PS3", "Steam", "Epic Games", "Xbox", "Autre"];

const loadData = async () => {
  isLoading.value = true;
  try {
    games.value = await getLudothequeRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Filtered games
const filteredGames = computed(() => {
  return games.value.filter(g => {
    const nameMatch = String(g.data.nom || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                      String(g.data.plateforme || '').toLowerCase().includes(searchQuery.value.toLowerCase());
                      
    const typeMatch = !typeFilter.value || g.data.type_jeu === typeFilter.value;
    
    let progMatch = true;
    if (g.data.type_jeu === 'Jeux vidéo' && progressFilter.value) {
      progMatch = g.data.progression === progressFilter.value;
    }

    return nameMatch && typeMatch && progMatch;
  });
});

// Open Add Modal
const openAddModal = () => {
  formGame.value = {
    nom: '',
    type_jeu: 'Jeux de société',
    min_players: 2,
    max_players: 4,
    playtime: '',
    progression: 'Jamais joué',
    plateforme: 'Steam',
    possede: true
  };
  showAddModal.value = true;
};

// Add Game
const handleAddGame = async () => {
  if (!formGame.value.nom.trim()) return;

  try {
    const isVideo = formGame.value.type_jeu === 'Jeux vidéo';
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: LUDOTHEQUE_COL_ID,
      data: {
        nom: formGame.value.nom.trim(),
        type_jeu: formGame.value.type_jeu,
        min_players: isVideo ? 1 : Number(formGame.value.min_players) || null,
        max_players: isVideo ? 1 : Number(formGame.value.max_players) || null,
        playtime: Number(formGame.value.playtime) || null,
        progression: isVideo ? formGame.value.progression : null,
        plateforme: isVideo ? formGame.value.plateforme : null,
        possede: formGame.value.possede
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddModal.value = false;
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

// Open Edit Modal
const openEditModal = (item: RecordEntry) => {
  editingGame.value = item;
  formGame.value = {
    nom: item.data.nom || '',
    type_jeu: item.data.type_jeu || 'Jeux de société',
    min_players: Number(item.data.min_players) || 2,
    max_players: Number(item.data.max_players) || 4,
    playtime: item.data.playtime || '',
    progression: item.data.progression || 'Jamais joué',
    plateforme: item.data.plateforme || 'Steam',
    possede: item.data.possede !== false
  };
  showEditModal.value = true;
};

// Update Game
const handleUpdateGame = async () => {
  if (!editingGame.value || !formGame.value.nom.trim()) return;

  try {
    const isVideo = formGame.value.type_jeu === 'Jeux vidéo';
    await db.records.update(editingGame.value.id!, {
      data: {
        nom: formGame.value.nom.trim(),
        type_jeu: formGame.value.type_jeu,
        min_players: isVideo ? 1 : Number(formGame.value.min_players) || null,
        max_players: isVideo ? 1 : Number(formGame.value.max_players) || null,
        playtime: Number(formGame.value.playtime) || null,
        progression: isVideo ? formGame.value.progression : null,
        plateforme: isVideo ? formGame.value.plateforme : null,
        possede: formGame.value.possede
      },
      updatedAt: Date.now()
    });

    showEditModal.value = false;
    editingGame.value = null;
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

// Delete Game
const handleDeleteGame = async (id: string) => {
  if (!confirm('Supprimer définitivement ce jeu de ta ludothèque ? (Cela n\'effacera pas son historique de parties)')) return;
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};
</script>

<template>
  <div class="ludotheque-view">
    <div class="view-header">
      <div>
        <h2>🎮 Ma Ludothèque</h2>
        <p class="text-secondary">Explore ton inventaire fusionné de jeux de société et de jeux vidéo au même endroit.</p>
      </div>
      <div class="view-actions">
        <button @click="openAddModal" class="btn btn-primary">
          <Plus :size="18" /> Nouveau Jeu
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card glass filters-bar mb-4">
      <div class="filters-grid">
        <div class="search-box">
          <Search class="search-icon" :size="18" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Rechercher un jeu (Nom, plateforme...)" 
            class="input search-input" 
          />
        </div>
        
        <select v-model="typeFilter" class="select">
          <option value="">Tous les types</option>
          <option value="Jeux de société">Jeux de société 🎲</option>
          <option value="Jeux vidéo">Jeux vidéo 🎮</option>
        </select>
        
        <select v-model="progressFilter" class="select" :disabled="typeFilter === 'Jeux de société'">
          <option value="">Toutes progressions</option>
          <option v-for="p in progressList" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
    </div>

    <!-- Games Display -->
    <div v-if="isLoading" class="loading-state card glass">
      <div class="spinner"></div>
      <p class="mt-2 text-secondary text-center">Chargement de ta ludothèque...</p>
    </div>

    <div v-else-if="filteredGames.length === 0" class="empty-state card glass text-center">
      <ShieldAlert class="empty-icon text-muted" :size="48" />
      <h3>Ludothèque vide ou aucun filtre correspondant</h3>
      <button @click="openAddModal" class="btn btn-primary mt-4">
        <Plus :size="18" /> Ajouter un jeu
      </button>
    </div>

    <div v-else class="games-container">
      <div class="games-grid">
        <div 
          v-for="g in filteredGames" 
          :key="g.id" 
          class="card glass hoverable game-card"
        >
          <div class="game-card-header">
            <span class="badge" :class="g.data.type_jeu === 'Jeux de société' ? 'badge-primary' : 'badge-success'">
              {{ g.data.type_jeu }}
            </span>
            <div class="game-actions">
              <button @click="openEditModal(g)" class="icon-btn" title="Modifier">
                <Edit2 :size="14" />
              </button>
              <button @click="handleDeleteGame(g.id!)" class="icon-btn delete-btn" title="Supprimer">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>

          <div class="game-card-body mt-2">
            <h4 class="game-title font-bold text-md leading-tight">{{ g.data.nom }}</h4>
            
            <div class="game-metrics mt-3 text-xs text-secondary leading-relaxed">
              <!-- Board game metrics -->
              <div v-if="g.data.type_jeu === 'Jeux de société'">
                <p v-if="g.data.min_players">👥 Joueurs : <strong>{{ g.data.min_players }} - {{ g.data.max_players }}</strong></p>
                <p v-if="g.data.playtime">⏱️ Durée : <strong>{{ g.data.playtime }} min</strong></p>
              </div>
              
              <!-- Video game metrics -->
              <div v-else>
                <p v-if="g.data.plateforme">🖥️ Plateforme : <strong>{{ g.data.plateforme }}</strong></p>
                <p v-if="g.data.progression">🏆 Progression : <strong class="text-accent">{{ g.data.progression }}</strong></p>
              </div>
            </div>
          </div>

          <div class="game-card-footer border-top pt-2 mt-4 flex-row justify-between text-xs text-muted">
            <span>{{ g.data.possede !== false ? 'Dans ma collection' : 'Backlog / Souhait' }}</span>
            <span v-if="g.data.possede !== false">🟢 Possédé</span>
            <span v-else>⚪ Wishlist</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal : Add Game -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>➕ Ajouter un Jeu</h3>
          <button @click="showAddModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom du jeu *</label>
            <input v-model="formGame.nom" type="text" placeholder="Ex: 7 Wonders, Elden Ring" class="input" />
          </div>

          <div class="form-group">
            <label>Type de Jeu *</label>
            <select v-model="formGame.type_jeu" class="select">
              <option v-for="t in typesList" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <!-- Boardgame specific form fields -->
          <div class="boardgame-fields" v-if="formGame.type_jeu === 'Jeux de société'">
            <div class="form-grid">
              <div class="form-group">
                <label>Joueurs Min</label>
                <input v-model="formGame.min_players" type="number" class="input" />
              </div>
              <div class="form-group">
                <label>Joueurs Max</label>
                <input v-model="formGame.max_players" type="number" class="input" />
              </div>
            </div>
            <div class="form-group">
              <label>Durée Moyenne (minutes)</label>
              <input v-model="formGame.playtime" type="number" placeholder="Ex: 45" class="input" />
            </div>
          </div>

          <!-- Videogame specific form fields -->
          <div class="videogame-fields" v-else>
            <div class="form-grid">
              <div class="form-group">
                <label>Plateforme</label>
                <select v-model="formGame.plateforme" class="select">
                  <option v-for="p in platformsList" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Progression active</label>
                <select v-model="formGame.progression" class="select">
                  <option v-for="pr in progressList" :key="pr" :value="pr">{{ pr }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="form-group mt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="formGame.possede" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold text-sm">Possédé physiquement / Acheté</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddGame" class="btn btn-primary" :disabled="!formGame.nom.trim()">
            Ajouter
          </button>
        </div>
      </div>
    </div>

    <!-- Modal : Edit Game -->
    <div v-if="showEditModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>✏️ Modifier le Jeu</h3>
          <button @click="showEditModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom du jeu *</label>
            <input v-model="formGame.nom" type="text" placeholder="Ex: 7 Wonders, Elden Ring" class="input" />
          </div>

          <div class="form-group">
            <label>Type de Jeu *</label>
            <select v-model="formGame.type_jeu" class="select">
              <option v-for="t in typesList" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <!-- Boardgame fields -->
          <div class="boardgame-fields" v-if="formGame.type_jeu === 'Jeux de société'">
            <div class="form-grid">
              <div class="form-group">
                <label>Joueurs Min</label>
                <input v-model="formGame.min_players" type="number" class="input" />
              </div>
              <div class="form-group">
                <label>Joueurs Max</label>
                <input v-model="formGame.max_players" type="number" class="input" />
              </div>
            </div>
            <div class="form-group">
              <label>Durée Moyenne (minutes)</label>
              <input v-model="formGame.playtime" type="number" placeholder="Ex: 45" class="input" />
            </div>
          </div>

          <!-- Videogame fields -->
          <div class="videogame-fields" v-else>
            <div class="form-grid">
              <div class="form-group">
                <label>Plateforme</label>
                <select v-model="formGame.plateforme" class="select">
                  <option v-for="p in platformsList" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Progression active</label>
                <select v-model="formGame.progression" class="select">
                  <option v-for="pr in progressList" :key="pr" :value="pr">{{ pr }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="form-group mt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="formGame.possede" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold text-sm">Possédé physiquement / Acheté</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showEditModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleUpdateGame" class="btn btn-primary" :disabled="!formGame.nom.trim()">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.filters-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 1rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.search-box {
  position: relative;
  
  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
  }
  
  .search-input {
    padding-left: 2.25rem;
  }
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.game-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.game-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.game-actions {
  display: flex;
  gap: 0.25rem;
}

.icon-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 0.35rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    color: var(--text-primary);
    background-color: var(--border-hover);
  }
  
  &.delete-btn:hover {
    color: var(--color-danger);
    background-color: rgba(239, 68, 68, 0.1);
  }
}

.game-title {
  color: var(--text-primary);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.border-top {
  border-top: 1px solid var(--border-color);
}

.pt-2 {
  padding-top: 0.5rem;
}

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.font-bold { font-weight: 700; }
.text-center { text-align: center; }
.block { display: block; }
.mt-2 { margin-top: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }

.spinner {
  width: 32px;
  height: 32px;
  border: 4px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
