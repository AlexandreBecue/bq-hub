<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { DECKS_COL_ID, CARDS_COL_ID, getDecksRecords, getCardsRecords } from '../db/queries';
import { Plus, Trash2, Edit2, ShieldAlert, BookOpen } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const decks = ref<RecordEntry[]>([]);
const cards = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const selectedDeckId = ref('');

// Deck form state
const showAddDeckModal = ref(false);
const formDeck = ref({
  nom: '',
  description: ''
});

// Card form state
const showAddCardModal = ref(false);
const showEditCardModal = ref(false);
const editingCard = ref<RecordEntry | null>(null);
const formCard = ref({
  question: '',
  reponse: '',
  box: 1
});

const loadData = async () => {
  isLoading.value = true;
  try {
    decks.value = await getDecksRecords();
    cards.value = await getCardsRecords();

    if (decks.value.length > 0 && !selectedDeckId.value) {
      selectedDeckId.value = decks.value[0].id!;
    }
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Cards filtered by selected deck
const activeDeckCards = computed(() => {
  if (!selectedDeckId.value) return [];
  return cards.value.filter(c => c.data.deck_id === selectedDeckId.value);
});

// Add New Deck Category
const handleAddDeck = async () => {
  const name = formDeck.value.nom.trim();
  if (!name) return;

  try {
    const newId = `rec-${generateId()}`;
    const newRecord: RecordEntry = {
      id: newId,
      collectionId: DECKS_COL_ID,
      data: {
        nom: name,
        description: formDeck.value.description.trim()
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddDeckModal.value = false;
    formDeck.value = { nom: '', description: '' };
    selectedDeckId.value = newId;
    emit('data-updated');
    await loadData();
    alert('Nouveau paquet de quiz créé !');
  } catch (err) {
    console.error(err);
  }
};

// Delete Deck Category
const handleDeleteDeck = async () => {
  if (!selectedDeckId.value) return;
  const d = decks.value.find(deck => deck.id === selectedDeckId.value);
  if (!d) return;

  if (!confirm(`Es-tu sûr de vouloir supprimer définitivement le paquet "${d.data.nom}" et TOUTES ses flashcards associées ?`)) return;

  try {
    // 1. Delete all cards in this deck
    const deckCards = cards.value.filter(c => c.data.deck_id === selectedDeckId.value);
    for (const card of deckCards) {
      await db.records.update(card.id!, {
        deletedAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    // 2. Delete the deck record itself
    await db.records.update(selectedDeckId.value, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });

    selectedDeckId.value = '';
    emit('data-updated');
    await loadData();
    alert('Paquet supprimé.');
  } catch (err) {
    console.error(err);
  }
};

// Open Add Card modal
const openAddCardModal = () => {
  formCard.value = {
    question: '',
    reponse: '',
    box: 1
  };
  showAddCardModal.value = true;
};

// Add New Flashcard
const handleAddCard = async () => {
  if (!formCard.value.question.trim() || !formCard.value.reponse.trim() || !selectedDeckId.value) {
    alert('Veuillez renseigner à la fois la question et la réponse.');
    return;
  }

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: CARDS_COL_ID,
      data: {
        deck_id: selectedDeckId.value,
        question: formCard.value.question.trim(),
        reponse: formCard.value.reponse.trim(),
        box: Number(formCard.value.box) || 1,
        dernier_examen: null,
        nb_essais: 0,
        nb_reussites: 0
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newRecord);
    showAddCardModal.value = false;
    emit('data-updated');
    await loadData();
    alert('Flashcard ajoutée !');
  } catch (err) {
    console.error(err);
  }
};

// Open Edit Card modal
const openEditCardModal = (item: RecordEntry) => {
  editingCard.value = item;
  formCard.value = {
    question: item.data.question || '',
    reponse: item.data.reponse || '',
    box: Number(item.data.box) || 1
  };
  showEditCardModal.value = true;
};

// Update Flashcard
const handleUpdateCard = async () => {
  if (!editingCard.value || !formCard.value.question.trim() || !formCard.value.reponse.trim()) return;

  try {
    await db.records.update(editingCard.value.id!, {
      'data.question': formCard.value.question.trim(),
      'data.reponse': formCard.value.reponse.trim(),
      'data.box': Number(formCard.value.box) || 1,
      updatedAt: Date.now()
    });

    showEditCardModal.value = false;
    editingCard.value = null;
    emit('data-updated');
    await loadData();
  } catch (err) {
    console.error(err);
  }
};

// Delete Flashcard
const handleDeleteCard = async (id: string) => {
  if (!confirm('Supprimer cette flashcard ?')) return;
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    emit('data-updated');
    await loadData();
  } catch (err) {
    console.error(err);
  }
};
</script>

<template>
  <div class="editor-view">
    <div class="view-header">
      <div>
        <h2>✍️ Éditeur de Quiz</h2>
        <p class="text-secondary">Crée de nouveaux paquets d'apprentissage, et ajoute ou modifie tes fiches de révision à la volée.</p>
      </div>
      <div class="view-actions">
        <button @click="showAddDeckModal = true" class="btn btn-accent btn-sm">
          <Plus :size="14" /> Nouveau Paquet
        </button>
        <button @click="openAddCardModal" class="btn btn-primary btn-sm" :disabled="decks.length === 0">
          <Plus :size="14" /> Nouvelle Carte
        </button>
      </div>
    </div>

    <!-- Active Deck Select Row -->
    <div class="card glass select-deck-card mb-4">
      <div class="flex-row justify-between flex-wrap gap-4">
        <div class="form-group mb-0 select-box-container">
          <label>PAQUET ACTIF</label>
          <select v-model="selectedDeckId" class="select select-deck font-bold">
            <option v-if="decks.length === 0" value="">Aucun paquet de cartes</option>
            <option v-for="d in decks" :key="d.id" :value="d.id">
              {{ d.data.nom }}
            </option>
          </select>
        </div>

        <button 
          v-if="selectedDeckId" 
          @click="handleDeleteDeck" 
          class="btn btn-danger btn-sm"
          title="Supprimer la catégorie active et toutes ses cartes"
        >
          <Trash2 :size="14" /> Supprimer ce paquet
        </button>
      </div>
    </div>

    <!-- Empty Decks alert -->
    <div v-if="decks.length === 0" class="card glass text-center py-4 text-muted">
      <ShieldAlert class="mx-auto mb-2 text-warning" :size="36" />
      <h3>Ludothèque de quiz vide</h3>
      <p class="text-secondary text-sm mt-2">Commence par créer un paquet (catégorie) de cartes pour pouvoir saisir tes fiches mémo.</p>
    </div>

    <!-- Cards ledger table inside active deck -->
    <div v-else class="cards-table-container">
      <div class="card glass">
        <h3 class="font-bold flex-row mb-4">
          <BookOpen :size="18" class="text-primary" /> Fiches mémo du paquet ({{ activeDeckCards.length }} cartes)
        </h3>

        <div v-if="isLoading" class="text-center py-4">
          <div class="spinner"></div>
        </div>

        <div v-else-if="activeDeckCards.length === 0" class="text-center py-4 text-muted text-sm">
          <p>Aucune carte mémorisable dans ce paquet.</p>
          <button @click="openAddCardModal" class="btn btn-primary btn-sm mt-3">Saisir ma première flashcard</button>
        </div>

        <div v-else class="cards-timeline-list">
          <div v-for="c in activeDeckCards" :key="c.id" class="card glass hoverable card-item-ledger flex-row justify-between gap-4">
            <div class="card-text-side">
              <p class="q-text font-black text-sm">Q : {{ c.data.question }}</p>
              <p class="a-text text-xs text-secondary mt-1">R : {{ c.data.reponse }}</p>
            </div>

            <div class="card-meta-side flex-row gap-3">
              <span class="badge font-bold text-xs" :class="'badge-level-' + c.data.box">
                Boîte {{ c.data.box }}
              </span>
              
              <button @click="openEditCardModal(c)" class="icon-btn" title="Modifier">
                <Edit2 :size="14" />
              </button>
              <button @click="handleDeleteCard(c.id!)" class="icon-btn delete-btn" title="Supprimer">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal : Add Deck -->
    <div v-if="showAddDeckModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>➕ Nouveau Paquet de Cartes</h3>
          <button @click="showAddDeckModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom de la catégorie *</label>
            <input v-model="formDeck.nom" type="text" placeholder="Ex: Vocabulaire Anglais, Capitales, JavaScript" class="input font-bold" />
          </div>

          <div class="form-group">
            <label>Description (Optionnelle)</label>
            <input v-model="formDeck.description" type="text" placeholder="Ex: Cartes mémo pour préparer l'oral" class="input" />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddDeckModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddDeck" class="btn btn-primary" :disabled="!formDeck.nom.trim()">
            Créer
          </button>
        </div>
      </div>
    </div>

    <!-- Modal : Add Card -->
    <div v-if="showAddCardModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>➕ Ajouter une Flashcard</h3>
          <button @click="showAddCardModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Question / Recto de la carte *</label>
            <textarea v-model="formCard.question" rows="3" placeholder="Ex: Quelle est la formule de l'eau ?" class="textarea font-bold"></textarea>
          </div>

          <div class="form-group">
            <label>Réponse / Verso de la carte *</label>
            <textarea v-model="formCard.reponse" rows="3" placeholder="Ex: H2O" class="textarea text-secondary"></textarea>
          </div>

          <div class="form-group mt-2">
            <label>Boîte Leitner initiale</label>
            <select v-model="formCard.box" class="select font-bold text-accent">
              <option :value="1">Boîte 1 (Révision quotidienne - Par défaut)</option>
              <option :value="2">Boîte 2 (Tous les 2 jours)</option>
              <option :value="3">Boîte 3 (Tous les 4 jours)</option>
              <option :value="4">Boîte 4 (Tous les 7 jours)</option>
              <option :value="5">Boîte 5 (Tous les 14 jours - Maîtrisé)</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddCardModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddCard" class="btn btn-primary" :disabled="!formCard.question.trim() || !formCard.reponse.trim()">
            Ajouter la carte
          </button>
        </div>
      </div>
    </div>

    <!-- Modal : Edit Card -->
    <div v-if="showEditCardModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>✏️ Modifier la Flashcard</h3>
          <button @click="showEditCardModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Question / Recto de la carte *</label>
            <textarea v-model="formCard.question" rows="3" placeholder="Ex: Quelle est la formule de l'eau ?" class="textarea font-bold"></textarea>
          </div>

          <div class="form-group">
            <label>Réponse / Verso de la carte *</label>
            <textarea v-model="formCard.reponse" rows="3" placeholder="Ex: H2O" class="textarea text-secondary"></textarea>
          </div>

          <div class="form-group mt-2">
            <label>Boîte Leitner actuelle</label>
            <select v-model="formCard.box" class="select font-bold text-accent">
              <option :value="1">Boîte 1 (Révision quotidienne)</option>
              <option :value="2">Boîte 2 (Tous les 2 jours)</option>
              <option :value="3">Boîte 3 (Tous les 4 jours)</option>
              <option :value="4">Boîte 4 (Tous les 7 jours)</option>
              <option :value="5">Boîte 5 (Tous les 14 jours - Maîtrisé)</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showEditCardModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleUpdateCard" class="btn btn-primary" :disabled="!formCard.question.trim() || !formCard.reponse.trim()">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.select-deck-card {
  border-color: rgba(236, 72, 153, 0.2);
  background-color: rgba(236, 72, 153, 0.01);
}

.select-box-container {
  width: 250px;
  @media (max-width: 768px) {
    width: 100%;
  }
}

.select-deck {
  color: var(--color-primary);
  border-color: rgba(236, 72, 153, 0.25);
  
  &:focus {
    border-color: var(--color-primary);
  }
}

.cards-timeline-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-item-ledger {
  border: 1px solid var(--border-color);
  background-color: rgba(255, 255, 255, 0.01);
  padding: 0.75rem 1rem !important;
  align-items: center;
}

.card-text-side {
  flex-grow: 1;
}

.badge-level-1 { background-color: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
.badge-level-2 { background-color: rgba(249, 115, 22, 0.1); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.2); }
.badge-level-3 { background-color: rgba(245, 158, 11, 0.1); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2); }
.badge-level-4 { background-color: rgba(132, 204, 22, 0.1); color: #a3e635; border: 1px solid rgba(132, 204, 22, 0.2); }
.badge-level-5 { background-color: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }

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

.border-top {
  border-top: 1px solid var(--border-color);
}

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.font-bold { font-weight: 700; }
.text-center { text-align: center; }

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
