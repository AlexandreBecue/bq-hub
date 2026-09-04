<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, type RecordEntry } from '../db/index';
import { 
  getDecksRecords, 
  getCardsRecords, 
  isCardDue 
} from '../db/queries';
import { Check, X, ArrowLeft, Award, RotateCcw, BookOpen } from '@lucide/vue';

const props = defineProps<{
  deckId: string | null; // null means global review
}>();

const emit = defineEmits(['finish-session']);

const decks = ref<RecordEntry[]>([]);
const allCards = ref<RecordEntry[]>([]);
const sessionCards = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const currentCardIndex = ref(0);
const isFlipped = ref(false);
const isFreeMode = ref(false); // Mode libre if no cards are due

// Session Stats
const successCount = ref(0);
const totalReviewed = ref(0);
const isSessionFinished = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    decks.value = await getDecksRecords();
    allCards.value = await getCardsRecords();
    
    startSession(false);
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

const startSession = (forceFreeMode = false) => {
  isSessionFinished.value = false;
  currentCardIndex.value = 0;
  isFlipped.value = false;
  successCount.value = 0;
  totalReviewed.value = 0;
  isFreeMode.value = forceFreeMode;

  // Filter deck cards
  let filtered = allCards.value;
  if (props.deckId) {
    filtered = allCards.value.filter(c => c.data.deck_id === props.deckId);
  }

  // Filter due cards (unless free mode is active)
  if (!forceFreeMode) {
    filtered = filtered.filter(c => isCardDue(c));
  }

  // Shuffle cards randomly for optimal spaced repetition !
  sessionCards.value = filtered.sort(() => Math.random() - 0.5);
};

onMounted(() => {
  loadData();
});

const activeDeckName = computed(() => {
  if (!props.deckId) return 'Révision Globale 🌐';
  const d = decks.value.find(deck => deck.id === props.deckId);
  return d ? d.data.nom : 'Deck inconnu';
});

const currentCard = computed(() => {
  if (sessionCards.value.length === 0 || currentCardIndex.value >= sessionCards.value.length) return null;
  return sessionCards.value[currentCardIndex.value];
});

// Flip card
const flipCard = () => {
  isFlipped.value = !isFlipped.value;
};

// Handle Leitner Verdict
const handleVerdict = async (knewIt: boolean) => {
  if (!currentCard.value) return;

  const cardId = currentCard.value.id!;
  const currentBox = Number(currentCard.value.data.box) || 1;
  const currentTries = Number(currentCard.value.data.nb_essais) || 0;
  const currentSuccesses = Number(currentCard.value.data.nb_reussites) || 0;

  // Leitner progression rule
  let nextBox = 1; // classic Leitner: demote back to Box 1 on mistake!
  if (knewIt) {
    nextBox = Math.min(currentBox + 1, 5); // promote up to Box 5
    successCount.value++;
  }

  totalReviewed.value++;

  try {
    // 1. Update in Dexie
    await db.records.update(cardId, {
      'data.box': nextBox,
      'data.dernier_examen': Date.now(),
      'data.nb_essais': currentTries + 1,
      'data.nb_reussites': knewIt ? currentSuccesses + 1 : currentSuccesses,
      updatedAt: Date.now()
    });

    // 2. Load next card with transition delay
    isFlipped.value = false;
    setTimeout(() => {
      if (currentCardIndex.value + 1 >= sessionCards.value.length) {
        isSessionFinished.value = true;
      } else {
        currentCardIndex.value++;
      }
    }, 250); // slight delay to allow card to flip back before changing content
  } catch (err) {
    console.error(err);
  }
};

const quitSession = () => {
  emit('finish-session');
};
</script>

<template>
  <div class="revision-view">
    <div class="view-header">
      <button @click="quitSession" class="btn btn-secondary btn-sm flex-row">
        <ArrowLeft :size="16" /> Retour
      </button>
      <h2>🧠 {{ activeDeckName }}</h2>
    </div>

    <div v-if="isLoading" class="text-center py-4">
      <div class="mini-spinner"></div>
    </div>

    <!-- SCREEN 1: Empty due queue alert -->
    <div v-else-if="sessionCards.length === 0 && !isSessionFinished" class="empty-due-screen text-center card glass max-width-600">
      <ShieldCheck class="mx-auto mb-2 text-primary icon-bounce" :size="48" />
      <h3>Aucune carte due aujourd'hui !</h3>
      <p class="text-secondary mt-2">
        Félicitations, ta mémoire est en ordre pour cette catégorie ! Tu peux revenir demain ou lancer une session d'entraînement libre.
      </p>
      
      <div class="flex-row justify-center gap-3 mt-4">
        <button @click="startSession(true)" class="btn btn-accent flex-row">
          <BookOpen :size="14" /> Entraînement libre
        </button>
        <button @click="quitSession" class="btn btn-secondary">
          Retour aux decks
        </button>
      </div>
    </div>

    <!-- SCREEN 2: Session active (Interactive 3D CSS Flashcard) -->
    <div v-else-if="!isSessionFinished && currentCard" class="active-revision-container">
      <!-- Progression Bar -->
      <div class="progress-container mb-4 text-center">
        <span class="text-xs text-muted font-bold block mb-1 uppercase">
          Carte {{ currentCardIndex + 1 }} / {{ sessionCards.length }}
        </span>
        <div class="progress-bar-track">
          <div 
            class="progress-bar-fill" 
            :style="{ width: ((currentCardIndex + 1) / sessionCards.length) * 100 + '%' }"
          ></div>
        </div>
      </div>

      <!-- 3D FLIP CARD INTERFACE -->
      <div class="flashcard-3d-wrapper" @click="flipCard">
        <div class="flashcard-inner" :class="{ 'flipped': isFlipped }">
          <!-- Recto (Front): Question -->
          <div class="card glass flashcard-face flashcard-front">
            <span class="face-badge font-bold text-xs uppercase text-primary mb-4 block">Question</span>
            <div class="card-text-content">
              {{ currentCard.data.question }}
            </div>
            <p class="tap-to-flip text-xs text-muted italic mt-4 block text-center">Tapote la carte pour la retourner...</p>
          </div>

          <!-- Verso (Back): Answer -->
          <div class="card glass flashcard-face flashcard-back">
            <span class="face-badge font-bold text-xs uppercase text-accent mb-4 block">Réponse</span>
            <div class="card-text-content">
              {{ currentCard.data.reponse }}
            </div>
            <p class="tap-to-flip text-xs text-muted italic mt-4 block text-center">Tapote pour revoir la question...</p>
          </div>
        </div>
      </div>

      <!-- Verdict Actions buttons (Visible only when answer is flipped/seen) -->
      <div class="verdict-actions-container mt-4" v-if="isFlipped">
        <button @click.stop="handleVerdict(false)" class="btn btn-danger btn-verdict flex-row justify-center">
          <X :size="18" /> Je me suis trompé (Boîte 1)
        </button>
        <button @click.stop="handleVerdict(true)" class="btn btn-primary btn-verdict flex-row justify-center">
          <Check :size="18" /> Je savais ! (Boîte +1)
        </button>
      </div>
      <div class="verdict-actions-container mt-4 justify-center" v-else>
        <button @click="flipCard" class="btn btn-accent flex-row font-bold justify-center px-8 py-3">
          Retourner la carte <RotateCcw :size="16" />
        </button>
      </div>
    </div>

    <!-- SCREEN 3: Trophy Victory Session Complete -->
    <div v-else-if="isSessionFinished" class="session-complete-screen text-center card glass max-width-600">
      <Award class="mx-auto mb-2 text-warning icon-award-bounce" :size="54" />
      <h3 class="font-black text-xl text-warning">Session Terminée ! 🎉</h3>
      <p class="text-secondary text-sm mt-1">Excellent travail d'ancrage mémoriel.</p>

      <div class="session-stats-card card glass mt-4">
        <div class="stats-row flex-row justify-between mb-2">
          <span class="lbl text-secondary">Cartes révisées :</span>
          <span class="val font-black">{{ totalReviewed }}</span>
        </div>
        <div class="stats-row flex-row justify-between mb-2">
          <span class="lbl text-secondary">Bonnes réponses :</span>
          <span class="val font-black text-success">{{ successCount }}</span>
        </div>
        <div class="stats-row flex-row justify-between">
          <span class="lbl text-secondary">Taux de réussite :</span>
          <span class="val font-black text-accent">{{ totalReviewed > 0 ? Math.round((successCount / totalReviewed) * 100) : 0 }} %</span>
        </div>
      </div>

      <div class="flex-row justify-center gap-3 mt-4">
        <button @click="startSession(isFreeMode)" class="btn btn-accent flex-row">
          <RotateCcw :size="14" /> Recommencer
        </button>
        <button @click="quitSession" class="btn btn-secondary">
          Retour
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

.progress-bar-track {
  width: 100%;
  height: 6px;
  background-color: var(--bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: var(--color-primary);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 3D FLASHCARD STYLES */
.flashcard-3d-wrapper {
  perspective: 1000px;
  width: 100%;
  max-width: 480px;
  height: 280px;
  margin: 0 auto;
  cursor: pointer;
}

.flashcard-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
  
  &.flipped {
    transform: rotateY(180deg);
  }
}

.flashcard-face {
  position: absolute;
  width: 100%;
  height: 100%;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
}

.flashcard-front {
  background-color: #1e293b;
}

.flashcard-back {
  background-color: #111827;
  transform: rotateY(180deg);
  border-color: rgba(167, 139, 250, 0.2);
}

.card-text-content {
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1.4;
  color: var(--text-primary);
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.verdict-actions-container {
  display: flex;
  gap: 1rem;
  max-width: 480px;
  margin: 0 auto;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
}

.btn-verdict {
  flex-grow: 1;
  padding: 0.85rem;
  font-weight: 800;
}

.session-stats-card {
  background-color: rgba(15, 23, 42, 0.4);
  max-width: 320px;
  margin: 0 auto;
  border: 1px solid var(--border-color);
}

.icon-bounce {
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.icon-award-bounce {
  animation: awardBounce 1.5s ease-out infinite alternate;
}

@keyframes awardBounce {
  0% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.1)); }
  100% { transform: scale(1.1); filter: drop-shadow(0 0 15px rgba(245, 158, 11, 0.4)); }
}

.block { display: block; }
.text-success { color: #34d399 !important; }
.text-danger { color: #f87171 !important; }

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
