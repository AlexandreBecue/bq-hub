<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db, type RecordEntry } from '../db/index';
import { 
  getPartiesRecords, 
  formatToFrenchDate 
} from '../db/queries';
import { Award, ShieldAlert, ChevronDown, ChevronUp, Trash2 } from '@lucide/vue';

const parties = ref<RecordEntry[]>([]);
const isLoading = ref(true);

// State for unfolded session details (ID -> boolean)
const unfoldedSessions = ref<Record<string, boolean>>({});

const loadData = async () => {
  isLoading.value = true;
  try {
    parties.value = await getPartiesRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

const toggleUnfold = (id: string) => {
  unfoldedSessions.value[id] = !unfoldedSessions.value[id];
};

const parseJson = (str: string, fallback: any = {}) => {
  try {
    return JSON.parse(str || '{}');
  } catch (e) {
    return fallback;
  }
};

const handleDeleteParty = async (id: string) => {
  if (!confirm('Supprimer cette partie de l\'historique ?')) return;
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    loadData();
  } catch (err) {
    console.error(err);
  }
};
</script>

<template>
  <div class="historique-view">
    <div class="view-header">
      <div>
        <h2>📊 Historique des Parties</h2>
        <p class="text-secondary">Passe en revue tes anciennes sessions de jeu, consulte les scores finaux et déplie les manches détaillées de chaque partie.</p>
      </div>
    </div>

    <!-- History list Display -->
    <div class="historique-container">
      <div v-if="isLoading" class="text-center py-4">
        <div class="spinner"></div>
      </div>

      <div v-else-if="parties.length === 0" class="card glass text-center py-4 text-muted text-sm">
        <ShieldAlert class="mx-auto mb-2 text-muted" :size="36" />
        <p>Aucune partie enregistrée dans l'historique.</p>
      </div>

      <div v-else class="parties-timeline-list">
        <div 
          v-for="p in parties" 
          :key="p.id" 
          class="card glass hoverable party-timeline-item"
          :class="{ 'expanded-item': unfoldedSessions[p.id!] }"
        >
          <div class="party-item-header flex-row justify-between flex-wrap gap-2">
            <div class="flex-row gap-3">
              <span class="winner-crown-wrapper flex-row">
                👑
              </span>
              <div>
                <h4 class="party-game-name font-black text-sm">{{ p.data.jeu }}</h4>
                <p class="party-date text-xs text-secondary mt-0.5">Le {{ formatToFrenchDate(p.data.date) }}</p>
              </div>
            </div>

            <div class="header-actions flex-row gap-2">
              <span class="badge badge-success flex-row text-xs font-bold">
                <Award :size="12" /> Vainqueur : {{ p.data.vainqueur }}
              </span>
              
              <button @click="toggleUnfold(p.id!)" class="icon-btn-toggle" :title="unfoldedSessions[p.id!] ? 'Replier' : 'Déplier'">
                <ChevronUp v-if="unfoldedSessions[p.id!]" :size="16" />
                <ChevronDown v-else :size="16" />
              </button>
            </div>
          </div>

          <!-- Quick recap of final scores always visible -->
          <div class="party-final-scores-bar mt-3 flex-row gap-2 flex-wrap" v-if="!unfoldedSessions[p.id!]">
            <span class="text-xs text-muted font-bold mr-1 uppercase">Scores finaux :</span>
            <span 
              v-for="(score, player) in parseJson(p.data.scores_finaux)" 
              :key="player"
              class="mini-score-pill"
              :class="{ 'winner-pill': player === p.data.vainqueur }"
            >
              {{ player }} : <strong>{{ score }}</strong>
            </span>
          </div>

          <!-- Unfolded ledger of rounds (MANCHES DETAILS) -->
          <div class="unfolded-ledger-drawer mt-4 border-top pt-3" v-if="unfoldedSessions[p.id!]">
            <h5 class="font-bold text-xs uppercase text-secondary mb-3 flex-row justify-between">
              <span>Détail manches par manches</span>
              <button @click="handleDeleteParty(p.id!)" class="delete-btn-link text-xs flex-row text-danger-icon"><Trash2 :size="12" /> Supprimer la partie</button>
            </h5>
            
            <div class="manches-ledger-table text-sm">
              <div class="table-header-row flex-row font-bold text-muted uppercase text-xs mb-2">
                <span class="th-num">Manche</span>
                <span v-for="plyr in p.data.participants" :key="plyr" class="th-score" :class="{ 'text-primary-winner': plyr === p.data.vainqueur }">{{ plyr }}</span>
              </div>

              <div 
                v-for="m in parseJson(p.data.manches_historique, [])" 
                :key="m.manche" 
                class="table-data-row flex-row mb-2 pb-2"
              >
                <span class="td-num font-bold">#{{ m.manche }}</span>
                <span v-for="plyr in p.data.participants" :key="plyr" class="td-score" :class="{ 'font-bold': plyr === p.data.vainqueur }">
                  {{ m.scores[plyr] }} pts
                </span>
              </div>

              <!-- Final Total row in table -->
              <div class="table-data-row flex-row mb-2 pb-2 border-top pt-2 font-bold bg-row-total">
                <span class="td-num uppercase font-black text-xs text-muted">TOTAL :</span>
                <span v-for="plyr in p.data.participants" :key="plyr" class="td-score font-black" :class="{ 'text-primary-winner text-lg font-black': plyr === p.data.vainqueur }">
                  {{ parseJson(p.data.scores_finaux)[plyr] }} pts
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.parties-timeline-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.winner-crown-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: rgba(245, 158, 11, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.15);
}

.icon-btn-toggle {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  transition: var(--transition);
  
  &:hover {
    color: var(--text-primary);
    background-color: var(--border-hover);
  }
}

.mini-score-pill {
  font-size: 0.75rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  
  &.winner-pill {
    background-color: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    font-weight: 700;
  }
}

.delete-btn-link {
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 700;
  
  &:hover {
    text-decoration: underline;
  }
}

.text-danger-icon {
  color: var(--color-danger);
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

.text-primary-winner {
  color: #a78bfa !important;
}

.bg-row-total {
  background-color: rgba(255, 255, 255, 0.01);
  border-bottom: none !important;
}

.border-top {
  border-top: 1px solid var(--border-color);
}

.pt-2 { padding-top: 0.5rem; }
.pt-3 { padding-top: 0.75rem; }
.mr-1 { margin-right: 0.25rem; }
.mt-3 { margin-top: 0.75rem; }
.mt-4 { margin-top: 1rem; }

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
