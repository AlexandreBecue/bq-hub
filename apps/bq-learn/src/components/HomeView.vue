<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { type RecordEntry } from '../db/index';
import { 
  getDecksRecords, 
  getCardsRecords, 
  isCardDue 
} from '../db/queries';
import { BookOpen, Brain, ArrowRight } from '@lucide/vue';

const emit = defineEmits(['start-session']);

const decks = ref<RecordEntry[]>([]);
const cards = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const loadData = async () => {
  isLoading.value = true;
  try {
    decks.value = await getDecksRecords();
    cards.value = await getCardsRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Calculate statistics for each deck
const decksWithStats = computed(() => {
  return decks.value.map(d => {
    const deckCards = cards.value.filter(c => c.data.deck_id === d.id);
    const dueCards = deckCards.filter(c => isCardDue(c));
    
    // Count per box
    const boxCounts = [0, 0, 0, 0, 0]; // Box 1 to 5
    deckCards.forEach(c => {
      const b = Number(c.data.box) || 1;
      if (b >= 1 && b <= 5) {
        boxCounts[b - 1]++;
      }
    });

    return {
      id: d.id!,
      nom: d.data.nom,
      description: d.data.description,
      totalCount: deckCards.length,
      dueCount: dueCards.length,
      boxCounts
    };
  });
});

// Total due cards across all decks
const totalDueCount = computed(() => {
  return cards.value.filter(c => isCardDue(c)).length;
});

// Start revision
const startRevision = (deckId: string | null) => {
  emit('start-session', deckId);
};
</script>

<template>
  <div class="home-view">
    <div class="view-header">
      <div>
        <h2>🧠 Mes Decks & Apprentissage</h2>
        <p class="text-secondary">Entraîne ton cerveau avec la répétition espacée. Saisis tes fiches mémo et révise-les au bon moment pour ancrer tes connaissances.</p>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-4">
      <div class="spinner"></div>
    </div>

    <div v-else class="decks-dashboard-layout">
      <!-- Global Due / Review Banner -->
      <div class="card glass global-review-banner mb-4">
        <div class="flex-row justify-between flex-wrap gap-4">
          <div class="banner-info">
            <span class="lbl font-bold text-xs text-muted block uppercase mb-1">Mémorisation Leitner active</span>
            <h3 class="banner-title font-black text-xl flex-row gap-2">
              <Brain class="text-primary" :size="24" /> 
              {{ totalDueCount }} {{ totalDueCount > 1 ? 'cartes sont' : 'carte est' }} prête à être révisée !
            </h3>
            <p class="text-secondary text-xs mt-1">Mélange toutes les catégories dues pour un entraînement global.</p>
          </div>
          <button 
            @click="startRevision(null)" 
            class="btn btn-primary font-black uppercase text-sm"
            :disabled="totalDueCount === 0"
          >
            Révision Globale <ArrowRight :size="16" />
          </button>
        </div>
      </div>

      <!-- Decks Grid -->
      <h3 class="font-bold flex-row mb-3"><BookOpen :size="18" class="text-accent" /> Mes Paquets de Cartes</h3>
      
      <div v-if="decksWithStats.length === 0" class="text-center py-4 text-muted text-sm">
        <p>Aucun deck de quiz configuré. Crée un paquet dans l'onglet Éditeur.</p>
      </div>

      <div v-else class="decks-grid">
        <div 
          v-for="d in decksWithStats" 
          :key="d.id"
          class="card glass hoverable deck-card flex-row justify-between"
        >
          <div class="deck-main-info">
            <div class="deck-title-row flex-row mb-1">
              <h4 class="deck-name font-black text-md leading-snug">{{ d.nom }}</h4>
              <span class="badge badge-warning text-xs font-bold" v-if="d.dueCount > 0">
                🔥 {{ d.dueCount }} dues
              </span>
            </div>
            <p class="deck-desc text-xs text-muted leading-relaxed" v-if="d.description">{{ d.description }}</p>
            <p class="deck-total-cards text-xs text-secondary mt-2"><strong>{{ d.totalCount }}</strong> cartes au total</p>

            <!-- Box progression indicators -->
            <div class="box-progression-ledger mt-3 flex-row gap-1">
              <div 
                v-for="idx in [1, 2, 3, 4, 5]" 
                :key="idx" 
                class="box-mini-gauge"
                :title="'Boîte ' + idx + ' : ' + d.boxCounts[idx - 1] + ' cartes'"
                :class="'box-level-' + idx"
                :style="{ flexGrow: d.boxCounts[idx - 1] + 1 }"
              >
                <span class="box-num">{{ idx }}</span>
              </div>
            </div>
          </div>

          <button @click="startRevision(d.id)" class="btn btn-accent btn-sm flex-row font-bold">
            Révise <ArrowRight :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.decks-dashboard-layout {
  max-width: 800px;
  margin: 0 auto;
}

.global-review-banner {
  border-color: rgba(236, 72, 153, 0.25);
  background-color: rgba(236, 72, 153, 0.01);
  padding: 1.5rem !important;
}

.decks-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.deck-card {
  align-items: center;
  gap: 1rem;
}

.deck-main-info {
  flex-grow: 1;
}

.deck-title-row {
  gap: 0.5rem;
  flex-wrap: wrap;
}

.box-progression-ledger {
  width: 100%;
  max-width: 250px;
  height: 14px;
  display: flex;
}

.box-mini-gauge {
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.55rem;
  font-weight: 900;
  color: #ffffff;
  transition: var(--transition);
  
  &.box-level-1 { background-color: #ef4444; } /* Red (least mastered) */
  &.box-level-2 { background-color: #f97316; } /* Orange */
  &.box-level-3 { background-color: #f59e0b; } /* Yellow */
  &.box-level-4 { background-color: #84cc16; } /* Lime */
  &.box-level-5 { background-color: #10b981; } /* Emerald (Mastered!) */
}

.box-num {
  transform: translateY(-0.5px);
}

.text-success { color: #34d399 !important; }
.text-danger { color: #f87171 !important; }

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.text-md { font-size: 1rem; }
.text-xl { font-size: 1.25rem; }
.text-2xl { font-size: 1.75rem; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }
.text-center { text-align: center; }
.block { display: block; }
.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 0.75rem; }
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
