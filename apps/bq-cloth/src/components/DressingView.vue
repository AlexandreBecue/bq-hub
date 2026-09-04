<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { CLOTHES_COL_ID, getClothesRecords, getTenuesRecords, getLessivesRecords, calculateGarmentStats } from '../db/queries';
import { Search, Plus, Edit2, Trash2, ShieldAlert, Sparkles, X } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const clothes = ref<RecordEntry[]>([]);
const tenues = ref<RecordEntry[]>([]);
const lessives = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const searchQuery = ref('');
const categoryFilter = ref('');
const availabilityFilter = ref('all'); // all, available, unavailable

const showAddModal = ref(false);
const showEditModal = ref(false);
const editingGarment = ref<RecordEntry | null>(null);

// New/Edit Garment Form State
const formState = ref({
  nom: '',
  categorie: 'T-shirt',
  couleur: '',
  marque: '',
  taille: '',
  matiere: '',
  is_available: true,
  saison: [] as string[]
});

const categories = ["T-shirt", "Chemise", "Pull", "Chino", "Jean", "Short", "Veste", "Manteau", "Chaussures", "Accessoire"];
const seasonsList = ["Hiver", "Été", "Mi-saison"];

const loadData = async () => {
  isLoading.value = true;
  try {
    clothes.value = await getClothesRecords();
    tenues.value = await getTenuesRecords();
    lessives.value = await getLessivesRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Calculate statistics for garments
const processedClothes = computed(() => {
  return clothes.value.map(item => {
    const stats = calculateGarmentStats(item.id!, tenues.value, lessives.value);
    return {
      ...item,
      wearsCount: stats.wearsCount,
      lastWornDate: stats.lastWornDate,
      lastWashDate: stats.lastWashDate
    };
  });
});

// Filtered garments
const filteredClothes = computed(() => {
  return processedClothes.value.filter(item => {
    const nameMatch = String(item.data.nom || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                      String(item.data.marque || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                      String(item.data.matiere || '').toLowerCase().includes(searchQuery.value.toLowerCase());
    
    const categoryMatch = !categoryFilter.value || item.data.categorie === categoryFilter.value;
    
    const isAvail = item.data.is_available !== false; // defaults to true
    let availMatch = true;
    if (availabilityFilter.value === 'available') {
      availMatch = isAvail;
    } else if (availabilityFilter.value === 'unavailable') {
      availMatch = !isAvail;
    }

    return nameMatch && categoryMatch && availMatch;
  });
});

// Toggle availability switch
const toggleAvailability = async (item: RecordEntry) => {
  try {
    const currentVal = item.data.is_available !== false;
    await db.records.update(item.id!, {
      'data.is_available': !currentVal,
      updatedAt: Date.now()
    });
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

// Open Add Modal
const openAddModal = () => {
  formState.value = {
    nom: '',
    categorie: 'T-shirt',
    couleur: '',
    marque: '',
    taille: '',
    matiere: '',
    is_available: true,
    saison: []
  };
  showAddModal.value = true;
};

// Handle Save New Garment
const handleAddGarment = async () => {
  if (!formState.value.nom.trim()) return;

  try {
    const newRecord: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: CLOTHES_COL_ID,
      data: {
        nom: formState.value.nom.trim(),
        categorie: formState.value.categorie,
        couleur: formState.value.couleur.trim(),
        marque: formState.value.marque.trim(),
        taille: formState.value.taille.trim(),
        matiere: formState.value.matiere.trim(),
        is_available: formState.value.is_available,
        saison: formState.value.saison
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
  editingGarment.value = item;
  formState.value = {
    nom: item.data.nom || '',
    categorie: item.data.categorie || 'T-shirt',
    couleur: item.data.couleur || '',
    marque: item.data.marque || '',
    taille: item.data.taille || '',
    matiere: item.data.matiere || '',
    is_available: item.data.is_available !== false,
    saison: Array.isArray(item.data.saison) ? item.data.saison : []
  };
  showEditModal.value = true;
};

// Handle Update Garment
const handleUpdateGarment = async () => {
  if (!editingGarment.value || !formState.value.nom.trim()) return;

  try {
    await db.records.update(editingGarment.value.id!, {
      data: {
        nom: formState.value.nom.trim(),
        categorie: formState.value.categorie,
        couleur: formState.value.couleur.trim(),
        marque: formState.value.marque.trim(),
        taille: formState.value.taille.trim(),
        matiere: formState.value.matiere.trim(),
        is_available: formState.value.is_available,
        saison: formState.value.saison
      },
      updatedAt: Date.now()
    });

    showEditModal.value = false;
    editingGarment.value = null;
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

// Handle Delete Garment
const handleDeleteGarment = async (id: string) => {
  if (!confirm('Es-tu sûr de vouloir supprimer ce vêtement ?')) return;
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

const toggleSeasonInForm = (season: string) => {
  const index = formState.value.saison.indexOf(season);
  if (index > -1) {
    formState.value.saison.splice(index, 1);
  } else {
    formState.value.saison.push(season);
  }
};
</script>

<template>
  <div class="dressing-view">
    <div class="view-header">
      <div>
        <h2>👗 Mon Dressing</h2>
        <p class="text-secondary">Gère ta garde-robe, vérifie la disponibilité de tes pièces et consulte tes statistiques de ports.</p>
      </div>
      <div class="view-actions">
        <button @click="openAddModal" class="btn btn-primary">
          <Plus :size="18" /> Nouveau Vêtement
        </button>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="card glass filters-bar mb-4">
      <div class="filters-grid">
        <div class="search-box">
          <Search class="search-icon" :size="18" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Rechercher (Nom, marque, matière...)" 
            class="input search-input" 
          />
        </div>
        
        <select v-model="categoryFilter" class="select">
          <option value="">Toutes catégories</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        
        <select v-model="availabilityFilter" class="select">
          <option value="all">Tous les états</option>
          <option value="available">Disponibles uniquement</option>
          <option value="unavailable">Indisponibles / Linge sale</option>
        </select>
      </div>
    </div>

    <!-- Clothes List / Table -->
    <div v-if="isLoading" class="loading-state card glass">
      <div class="spinner"></div>
      <p class="mt-2 text-secondary">Chargement de ta garde-robe...</p>
    </div>

    <div v-else-if="filteredClothes.length === 0" class="empty-state card glass text-center">
      <ShieldAlert class="empty-icon text-muted" :size="48" />
      <h3>Aucun vêtement trouvé</h3>
      <p class="text-secondary mt-2">Modifie tes filtres ou ajoute une nouvelle pièce pour commencer !</p>
      <button @click="openAddModal" class="btn btn-primary mt-4">
        <Plus :size="18" /> Ajouter un vêtement
      </button>
    </div>

    <div v-else class="clothes-container">
      <div class="clothes-grid">
        <div 
          v-for="item in filteredClothes" 
          :key="item.id" 
          class="card glass hoverable garment-card"
          :class="{ 'unavailable-card': item.data.is_available === false }"
        >
          <div class="garment-card-header">
            <span class="badge badge-primary">{{ item.data.categorie }}</span>
            <div class="garment-actions">
              <button @click="openEditModal(item)" class="icon-btn" title="Modifier">
                <Edit2 :size="14" />
              </button>
              <button @click="handleDeleteGarment(item.id!)" class="icon-btn delete-btn" title="Supprimer">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>

          <div class="garment-card-body">
            <h4 class="garment-name">{{ item.data.nom }}</h4>
            <div class="garment-info-row mt-2" v-if="item.data.marque">
              <span class="label">Marque :</span>
              <span class="val">{{ item.data.marque }}</span>
            </div>
            <div class="garment-info-row" v-if="item.data.matiere">
              <span class="label">Matière :</span>
              <span class="val highlighted-val">{{ item.data.matiere }}</span>
            </div>
            <div class="garment-info-row" v-if="item.data.couleur || item.data.taille">
              <span class="label">Détails :</span>
              <span class="val">
                <span v-if="item.data.couleur">{{ item.data.couleur }}</span>
                <span v-if="item.data.couleur && item.data.taille">, </span>
                <span v-if="item.data.taille">Taille {{ item.data.taille }}</span>
              </span>
            </div>
            <div class="garment-info-row" v-if="item.data.saison && item.data.saison.length">
              <span class="label">Saison :</span>
              <span class="val seasons-tags">
                <span v-for="s in item.data.saison" :key="s" class="mini-tag">{{ s }}</span>
              </span>
            </div>
          </div>

          <div class="garment-card-footer mt-4">
            <!-- Availability Toggle Switch -->
            <div class="availability-box">
              <label class="switch">
                <input 
                  type="checkbox" 
                  :checked="item.data.is_available !== false" 
                  @change="toggleAvailability(item)" 
                />
                <span class="slider"></span>
              </label>
              <span class="avail-label" :class="{ 'text-success': item.data.is_available !== false, 'text-danger': item.data.is_available === false }">
                {{ item.data.is_available !== false ? 'Disponible' : 'Linge Sale / Indispo' }}
              </span>
            </div>

            <!-- Wear Counter -->
            <div class="wears-count-badge" :class="item.wearsCount > 3 ? 'warn-badge' : 'info-badge'">
              <Sparkles :size="12" class="sparkle-icon" />
              <span>Porté {{ item.wearsCount }} {{ item.wearsCount > 1 ? 'fois' : 'fois' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals: Add / Edit -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>➕ Ajouter un vêtement</h3>
          <button @click="showAddModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom du vêtement *</label>
            <input v-model="formState.nom" type="text" placeholder="Ex: Chemise en lin blanc" class="input" />
          </div>
          
          <div class="form-group">
            <label>Catégorie *</label>
            <select v-model="formState.categorie" class="select">
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Matière</label>
              <input v-model="formState.matiere" type="text" placeholder="Ex: Coton, Lin, Laine" class="input" />
            </div>
            <div class="form-group">
              <label>Couleur</label>
              <input v-model="formState.couleur" type="text" placeholder="Ex: Blanc, Bleu Marine" class="input" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Marque</label>
              <input v-model="formState.marque" type="text" placeholder="Ex: Octobre Editions" class="input" />
            </div>
            <div class="form-group">
              <label>Taille</label>
              <input v-model="formState.taille" type="text" placeholder="Ex: M, 40" class="input" />
            </div>
          </div>

          <div class="form-group mt-2">
            <label>Saisons recommandées</label>
            <div class="seasons-selector flex-row mt-2">
              <button 
                v-for="s in seasonsList" 
                :key="s"
                @click="toggleSeasonInForm(s)"
                class="btn btn-sm btn-season"
                :class="{ 'active-season': formState.saison.includes(s) }"
              >
                {{ s }}
              </button>
            </div>
          </div>

          <div class="form-group mt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="formState.is_available" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold">Disponible immédiatement dans l'armoire</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleAddGarment" class="btn btn-primary" :disabled="!formState.nom.trim()">Ajouter</button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>✏️ Modifier le vêtement</h3>
          <button @click="showEditModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nom du vêtement *</label>
            <input v-model="formState.nom" type="text" placeholder="Ex: Chemise en lin blanc" class="input" />
          </div>
          
          <div class="form-group">
            <label>Catégorie *</label>
            <select v-model="formState.categorie" class="select">
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Matière</label>
              <input v-model="formState.matiere" type="text" placeholder="Ex: Coton, Lin, Laine" class="input" />
            </div>
            <div class="form-group">
              <label>Couleur</label>
              <input v-model="formState.couleur" type="text" placeholder="Ex: Blanc, Bleu Marine" class="input" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Marque</label>
              <input v-model="formState.marque" type="text" placeholder="Ex: Octobre Editions" class="input" />
            </div>
            <div class="form-group">
              <label>Taille</label>
              <input v-model="formState.taille" type="text" placeholder="Ex: M, 40" class="input" />
            </div>
          </div>

          <div class="form-group mt-2">
            <label>Saisons recommandées</label>
            <div class="seasons-selector flex-row mt-2">
              <button 
                v-for="s in seasonsList" 
                :key="s"
                @click="toggleSeasonInForm(s)"
                class="btn btn-sm btn-season"
                :class="{ 'active-season': formState.saison.includes(s) }"
              >
                {{ s }}
              </button>
            </div>
          </div>

          <div class="form-group mt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="formState.is_available" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold">Disponible immédiatement dans l'armoire</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showEditModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="handleUpdateGarment" class="btn btn-primary" :disabled="!formState.nom.trim()">Enregistrer</button>
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

.clothes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.garment-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  
  &.unavailable-card {
    border-color: rgba(239, 68, 68, 0.2);
    background-color: rgba(30, 41, 59, 0.4);
    opacity: 0.8;
  }
}

.garment-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.garment-actions {
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

.garment-name {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.garment-info-row {
  display: flex;
  font-size: 0.825rem;
  margin-top: 0.25rem;
  
  .label {
    width: 65px;
    color: var(--text-muted);
    font-weight: 700;
    flex-shrink: 0;
  }
  
  .val {
    color: var(--text-secondary);
  }
  
  .highlighted-val {
    color: #e2e8f0;
    font-weight: 700;
    background-color: rgba(255, 255, 255, 0.05);
    padding: 0.05rem 0.35rem;
    border-radius: var(--radius-sm);
  }
}

.seasons-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.mini-tag {
  font-size: 0.7rem;
  font-weight: 700;
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  padding: 0.05rem 0.25rem;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

.garment-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border-color);
  padding-top: 0.75rem;
  font-size: 0.8rem;
}

.availability-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  .avail-label {
    font-weight: 700;
  }
}

.wears-count-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.75rem;
  
  &.info-badge {
    background-color: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.15);
  }
  
  &.warn-badge {
    background-color: rgba(245, 158, 11, 0.1);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.15);
  }
  
  .sparkle-icon {
    flex-shrink: 0;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.btn-season {
  flex-grow: 1;
  background-color: rgba(15, 23, 42, 0.4);
  color: var(--text-secondary);
  border-color: var(--border-color);
  
  &.active-season {
    background-color: var(--color-purple);
    color: #ffffff;
    border-color: var(--color-purple);
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.2);
  }
}

.text-success { color: var(--color-accent) !important; }
.text-danger { color: var(--color-danger) !important; }

.font-bold { font-weight: 700; }
.text-center { text-align: center; }

.empty-state {
  padding: 3rem 1.5rem;
  
  .empty-icon {
    margin: 0 auto 1rem auto;
  }
}

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
