<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  PARTIES_COL_ID, 
  getLudothequeRecords 
} from '../db/queries';
import { Play, Trash2, ShieldAlert, Check, X, Award, RotateCcw } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const games = ref<RecordEntry[]>([]);
const isLoading = ref(true);

// State for New Game Setup
const selectedGameId = ref('');
const scoreLimit = ref<number | ''>('');
const newPlayerName = ref('');
const players = ref<string[]>(['Alex', 'Bob']); // Default starter players

// State for Active Game Session (Resilient in localStorage)
const isActiveGame = ref(false);
const activeGameDetails = ref({
  gameId: '',
  gameName: '',
  limit: null as number | null,
  players: [] as string[],
  manches: [] as Array<{ manche: number; scores: Record<string, number> }>
});

// Next Round Input State
const currentRoundScores = ref<Record<string, number>>({});

const loadData = async () => {
  isLoading.value = true;
  try {
    games.value = await getLudothequeRecords();
    
    // Select first game as default in setup if any
    const societyGames = games.value.filter(g => g.data.type_jeu === 'Jeux de société');
    if (societyGames.length > 0) {
      selectedGameId.value = societyGames[0].id!;
    } else if (games.value.length > 0) {
      selectedGameId.value = games.value[0].id!;
    }
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
  
  // Load active session from localStorage if exists
  const savedSession = localStorage.getItem('bq-play-active-session');
  if (savedSession) {
    try {
      activeGameDetails.value = JSON.parse(savedSession);
      isActiveGame.value = true;
      initializeRoundInput();
    } catch (e) {
      console.error('Failed to parse saved session:', e);
    }
  }
});

// Initialize round input with 0 for all players
const initializeRoundInput = () => {
  const scores: Record<string, number> = {};
  activeGameDetails.value.players.forEach(p => {
    scores[p] = 0;
  });
  currentRoundScores.value = scores;
};

// Save session to localStorage on any change to make it fully resilient
watch(activeGameDetails, (newDetails) => {
  if (isActiveGame.value) {
    localStorage.setItem('bq-play-active-session', JSON.stringify(newDetails));
  }
}, { deep: true });

// Setup Player Add/Remove
const addPlayer = () => {
  const name = newPlayerName.value.trim();
  if (!name) return;
  if (players.value.includes(name)) {
    alert('Ce joueur est déjà dans la partie.');
    return;
  }
  players.value.push(name);
  newPlayerName.value = '';
};

const removePlayer = (name: string) => {
  players.value = players.value.filter(p => p !== name);
};

// Start Game!
const startGame = () => {
  if (!selectedGameId.value) {
    alert('Veuillez sélectionner un jeu.');
    return;
  }
  if (players.value.length === 0) {
    alert('Veuillez ajouter au moins un joueur.');
    return;
  }

  const selectedGame = games.value.find(g => g.id === selectedGameId.value);
  activeGameDetails.value = {
    gameId: selectedGameId.value,
    gameName: selectedGame ? selectedGame.data.nom : 'Jeu inconnu',
    limit: scoreLimit.value ? Number(scoreLimit.value) : null,
    players: [...players.value],
    manches: []
  };

  isActiveGame.value = true;
  localStorage.setItem('bq-play-active-session', JSON.stringify(activeGameDetails.value));
  initializeRoundInput();
};

// Calculate Cumulative Total Scores
const playerTotals = computed(() => {
  const totals: Record<string, number> = {};
  activeGameDetails.value.players.forEach(p => {
    totals[p] = 0;
  });

  activeGameDetails.value.manches.forEach(m => {
    activeGameDetails.value.players.forEach(p => {
      totals[p] += Number(m.scores[p]) || 0;
    });
  });

  return totals;
});

// Check if any player reached/exceeded the score limit
const overLimitAlerts = computed(() => {
  const limit = activeGameDetails.value.limit;
  if (!limit) return [];

  const alerts: string[] = [];
  activeGameDetails.value.players.forEach(p => {
    const total = playerTotals.value[p] || 0;
    if (total >= limit) {
      alerts.push(`${p} a atteint la limite ! (${total} / ${limit} points)`);
    }
  });

  return alerts;
});

// Add Round scores
const addRound = () => {
  const scoresCopy: Record<string, number> = {};
  activeGameDetails.value.players.forEach(p => {
    scoresCopy[p] = Number(currentRoundScores.value[p]) || 0;
  });

  const nextMancheNum = activeGameDetails.value.manches.length + 1;
  activeGameDetails.value.manches.push({
    manche: nextMancheNum,
    scores: scoresCopy
  });

  // Reset input form
  initializeRoundInput();
};

// Delete Last Round (correction)
const deleteLastRound = () => {
  if (activeGameDetails.value.manches.length === 0) return;
  activeGameDetails.value.manches.pop();
};

// End & Save Game session
const endAndSaveGame = async () => {
  if (activeGameDetails.value.manches.length === 0) {
    if (!confirm('Aucune manche n\'a été jouée. Voulez-vous simplement annuler la partie ?')) return;
    cancelGame();
    return;
  }

  // Auto-detect winner (highest score for board games, or lowest depending on user choice, but let's let them select, pre-selecting highest)
  let bestPlayer = activeGameDetails.value.players[0];
  let maxScore = playerTotals.value[bestPlayer];

  activeGameDetails.value.players.forEach(p => {
    if (playerTotals.value[p] > maxScore) {
      bestPlayer = p;
      maxScore = playerTotals.value[p];
    }
  });

  const winner = prompt('Qui est le vainqueur de cette partie ?', bestPlayer);
  if (winner === null) return; // cancelled

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: PARTIES_COL_ID,
      data: {
        date: new Date().toISOString().split('T')[0],
        jeu: activeGameDetails.value.gameName, // we store the name as a string or ID, storing gameName is standard in bq-metrics
        participants: [...activeGameDetails.value.players],
        score_limite: activeGameDetails.value.limit,
        vainqueur: winner.trim() || bestPlayer,
        scores_finaux: JSON.stringify(playerTotals.value),
        manches_historique: JSON.stringify(activeGameDetails.value.manches)
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);

    // Clear active session
    isActiveGame.value = false;
    localStorage.removeItem('bq-play-active-session');
    
    emit('data-updated');
    alert('La partie a été enregistrée avec succès ! 👑');
  } catch (err) {
    console.error(err);
  }
};

// Cancel active game
const cancelGame = () => {
  if (!confirm('Es-tu sûr de vouloir annuler la partie en cours ? Toutes les manches saisies seront perdues.')) return;
  isActiveGame.value = false;
  localStorage.removeItem('bq-play-active-session');
};
</script>

<template>
  <div class="scorecard-view">
    <div class="view-header">
      <div>
        <h2>🎲 Scorecard en Direct</h2>
        <p class="text-secondary">Saisis les scores de tes amis manche par manche, suis les totaux en temps réel et sois notifié dès que la limite est franchie.</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-4">
      <div class="mini-spinner"></div>
    </div>

    <!-- SCREEN 1: Game setup form (not active game) -->
    <div v-else-if="!isActiveGame" class="setup-game-screen card glass max-width-600">
      <h3 class="font-bold flex-row mb-4"><Play :size="18" class="text-primary" /> Lancer une partie</h3>
      
      <div class="form-group">
        <label>Sélectionner le Jeu</label>
        <select v-model="selectedGameId" class="select font-bold text-primary">
          <option v-if="games.length === 0" value="">Aucun jeu disponible</option>
          <option v-for="g in games" :key="g.id" :value="g.id">{{ g.data.nom }} ({{ g.data.type_jeu }})</option>
        </select>
        <p class="text-xs text-muted mt-1" v-if="games.length === 0">Pense à ajouter un jeu dans l'onglet **Ludothèque** avant de jouer.</p>
      </div>

      <div class="form-group">
        <label>Score Limite à atteindre (Optionnel)</label>
        <input v-model="scoreLimit" type="number" placeholder="Ex: 100, 500" class="input" />
        <p class="text-xs text-muted mt-1">L'application t'alertera dès qu'un joueur franchira ce score.</p>
      </div>

      <!-- Add Participants -->
      <div class="form-group mt-4">
        <label>Participants / Joueurs *</label>
        <div class="player-input-row flex-row mt-1 mb-3">
          <input 
            v-model="newPlayerName" 
            type="text" 
            placeholder="Nom du joueur..." 
            class="input" 
            @keyup.enter="addPlayer" 
          />
          <button @click="addPlayer" class="btn btn-primary">Ajouter</button>
        </div>

        <div class="players-chips-list">
          <span 
            v-for="p in players" 
            :key="p" 
            class="player-chip badge badge-primary"
          >
            {{ p }}
            <button @click="removePlayer(p)" class="remove-chip-btn"><X :size="10" /></button>
          </span>
          <span v-if="players.length === 0" class="text-xs text-muted italic">Aucun joueur ajouté.</span>
        </div>
      </div>

      <button @click="startGame" class="btn btn-primary w-100 mt-4" :disabled="players.length === 0 || games.length === 0">
        Démarrer la partie ! <Play :size="14" />
      </button>
    </div>

    <!-- SCREEN 2: Active Ledger Scorecard -->
    <div v-else class="active-scorecard-screen">
      <!-- Alerts Banner if score reached -->
      <div class="alerts-banner mb-4" v-if="overLimitAlerts.length > 0">
        <div v-for="alt in overLimitAlerts" :key="alt" class="card glass overdue-card flex-row gap-3">
          <ShieldAlert class="text-danger flex-shrink-0" :size="20" />
          <span class="font-bold text-sm text-danger">{{ alt }}</span>
        </div>
      </div>

      <div class="scorecard-active-grid">
        <!-- Totals Ledger Board -->
        <div class="card glass totals-card">
          <div class="flex-row justify-between mb-4">
            <h3 class="font-bold text-md flex-row"><Award :size="18" class="text-primary" /> Tableau des Scores : {{ activeGameDetails.gameName }}</h3>
            <span class="badge badge-warning text-xs font-bold" v-if="activeGameDetails.limit">Limite : {{ activeGameDetails.limit }} pts</span>
          </div>

          <!-- Players totals grid -->
          <div class="players-totals-grid">
            <div 
              v-for="p in activeGameDetails.players" 
              :key="p" 
              class="player-total-box"
              :class="{ 'leader': playerTotals[p] === Math.max(...Object.values(playerTotals)) && activeGameDetails.manches.length > 0 }"
            >
              <span class="p-name font-bold block text-sm">{{ p }}</span>
              <span class="p-score font-black text-2xl block mt-1">{{ playerTotals[p] }} pts</span>
            </div>
          </div>
        </div>

        <!-- Saisie points for Next Round -->
        <div class="card glass new-round-card">
          <h3 class="font-bold text-sm flex-row mb-3">🖊️ Saisie Manche {{ activeGameDetails.manches.length + 1 }}</h3>
          
          <div class="round-scores-inputs mt-2">
            <div 
              v-for="p in activeGameDetails.players" 
              :key="p" 
              class="round-input-group flex-row justify-between mb-2"
            >
              <span class="font-bold text-secondary text-sm">{{ p }} :</span>
              <input 
                v-model="currentRoundScores[p]" 
                type="number" 
                class="input round-num-input" 
              />
            </div>
          </div>

          <div class="flex-row gap-2 mt-4">
            <button @click="addRound" class="btn btn-primary flex-grow">
              Valider la manche
            </button>
            <button 
              @click="deleteLastRound" 
              class="btn btn-secondary btn-icon" 
              title="Annuler la dernière manche"
              :disabled="activeGameDetails.manches.length === 0"
            >
              <RotateCcw :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- History of rounds list -->
      <div class="card glass rounds-ledger-card mt-4">
        <h3 class="font-bold text-sm mb-3">📋 Historique des Manches</h3>
        
        <div v-if="activeGameDetails.manches.length === 0" class="text-center py-3 text-muted text-xs">
          <p>Aucune manche jouée pour le moment. Renseigne les scores ci-dessus.</p>
        </div>

        <div v-else class="manches-table text-sm">
          <div class="table-header-row flex-row font-bold text-muted uppercase text-xs mb-2">
            <span class="th-num">Manche</span>
            <span v-for="p in activeGameDetails.players" :key="p" class="th-score">{{ p }}</span>
          </div>

          <div 
            v-for="m in activeGameDetails.manches" 
            :key="m.manche" 
            class="table-data-row flex-row mb-2 pb-2"
          >
            <span class="td-num font-bold">#{{ m.manche }}</span>
            <span v-for="p in activeGameDetails.players" :key="p" class="td-score">
              {{ m.scores[p] }} pts
            </span>
          </div>
        </div>
      </div>

      <!-- Footer action controls -->
      <div class="active-footer-actions flex-row mt-4">
        <button @click="endAndSaveGame" class="btn btn-accent flex-grow font-black uppercase text-sm flex-row justify-center">
          <Check :size="16" /> Finir & Enregistrer la Partie
        </button>
        <button @click="cancelGame" class="btn btn-danger btn-sm">
          <Trash2 :size="16" /> Annuler
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.max-width-600 {
  max-width: 600px;
  margin: 0 auto;
}

.player-input-row {
  display: flex;
  gap: 0.5rem;
}

.players-chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.player-chip {
  padding: 0.35rem 0.65rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  
  .remove-chip-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    
    &:hover {
      color: #ffffff;
    }
  }
}

.w-100 {
  width: 100%;
}

.overdue-card {
  border-color: rgba(239, 68, 68, 0.25) !important;
  background-color: rgba(239, 68, 68, 0.02) !important;
  padding: 0.75rem 1rem !important;
}

.scorecard-active-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.players-totals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.75rem;
}

.player-total-box {
  background-color: rgba(255, 255, 255, 0.01);
  border: 1px solid var(--border-color);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  text-align: center;
  
  &.leader {
    border-color: rgba(139, 92, 246, 0.3);
    background-color: rgba(139, 92, 246, 0.05);
    
    .p-name { color: #a78bfa; }
  }
}

.round-num-input {
  width: 80px;
  text-align: center;
  padding: 0.35rem;
  font-weight: 700;
}

.table-header-row, .table-data-row {
  display: grid;
  grid-template-columns: 80px repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.5rem;
  align-items: center;
}

.table-data-row {
  border-bottom: 1px solid var(--border-color);
}

.th-score, .td-score {
  text-align: center;
}

.active-footer-actions {
  gap: 0.75rem;
}

.flex-grow {
  flex-grow: 1;
}

.btn-icon {
  padding: 0.5rem;
}

.text-success { color: #34d399 !important; }
.text-danger { color: #f87171 !important; }

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.text-lg { font-size: 1.15rem; }
.text-2xl { font-size: 1.5rem; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }
.block { display: block; }
.mt-1 { margin-top: 0.25rem; }
.mt-3 { margin-top: 0.75rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }

.mini-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 1rem auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
