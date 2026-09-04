<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  TENUES_COL_ID, 
  getClothesRecords, 
  getTenuesRecords, 
  getTenuesTypesRecords,
  formatToFrenchDate
} from '../db/queries';
import { CloudSun, Calendar, RefreshCw, Check, AlertTriangle, Play, Sparkles, Thermometer } from '@lucide/vue';

const emit = defineEmits(['data-updated']);

const clothes = ref<RecordEntry[]>([]);
const tenues = ref<RecordEntry[]>([]);
const tenuesTypes = ref<RecordEntry[]>([]);
const isLoading = ref(true);

// Weather State
const currentCity = ref(localStorage.getItem('bq-clothes-city') || 'Paris');
const weatherData = ref<any>(null);
const weatherLoading = ref(false);
const weatherError = ref('');

// Context State
const contexts = ["Bureau", "Télétravail", "Sport", "Escalade", "Sortie", "Détente"];
const selectedContext = ref(localStorage.getItem('bq-clothes-active-context') || 'Bureau');

// Form/Selection State for Outfit Composition
const selectedGarments = ref<string[]>([]);
const dateSaisie = ref(new Date().toISOString().split('T')[0]);
const showPorterConfirmModal = ref(false);
const putInLaundryBasket = ref(false); // Option to immediately mark items as unavailable

// Dictionary of French cities coordinates
const CITIES: Record<string, { lat: number, lng: number }> = {
  'Paris': { lat: 48.8566, lng: 2.3522 },
  'Lyon': { lat: 45.7640, lng: 4.8357 },
  'Marseille': { lat: 43.2965, lng: 5.3698 },
  'Toulouse': { lat: 43.6047, lng: 1.4442 },
  'Bordeaux': { lat: 44.8378, lng: -0.5792 },
  'Nantes': { lat: 47.2184, lng: -1.5536 },
  'Strasbourg': { lat: 48.5734, lng: 7.7521 },
  'Lille': { lat: 50.6292, lng: 3.0573 },
  'Nice': { lat: 43.7102, lng: 7.2620 },
  'Montpellier': { lat: 43.6108, lng: 3.8767 }
};

const loadData = async () => {
  isLoading.value = true;
  try {
    clothes.value = await getClothesRecords();
    tenues.value = await getTenuesRecords();
    tenuesTypes.value = await getTenuesTypesRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

const fetchWeather = async () => {
  weatherLoading.value = true;
  weatherError.value = '';
  try {
    const city = currentCity.value;
    const coords = CITIES[city] || CITIES['Paris'];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Erreur de chargement météo');
    const data = await response.json();
    weatherData.value = data.current;
  } catch (err: any) {
    console.error(err);
    weatherError.value = 'Météo indisponible';
  } finally {
    weatherLoading.value = false;
  }
};

onMounted(() => {
  loadData();
  fetchWeather();
});

watch(selectedContext, (newCtx) => {
  localStorage.setItem('bq-clothes-active-context', newCtx);
});

// Group categorization for exclusion logic
// Group key for each category
const getExclusionGroup = (category: string): string => {
  switch (category) {
    case 'T-shirt': return 'T-shirt';
    case 'Chemise': return 'Chemise';
    case 'Pull': return 'Pull';
    case 'Chino':
    case 'Jean':
    case 'Short': 
      return 'Bas'; // Only one bottom
    case 'Chaussures': 
      return 'Chaussures'; // Only one pair of shoes
    case 'Veste':
    case 'Manteau':
      return 'Veste'; // Usually only one outer jacket
    default:
      return 'Accessoire'; // Accessories have no exclusion
  }
};

// Check if a garment's group is already selected by another item
const isGroupAlreadySelected = (item: RecordEntry): boolean => {
  if (selectedGarments.value.includes(item.id!)) return false; // Already selected, don't exclude itself

  const itemGroup = getExclusionGroup(item.data.categorie);
  if (itemGroup === 'Accessoire') return false; // Accessories can be multiple

  // Check if any selected garment has the same exclusion group
  return selectedGarments.value.some(selId => {
    const selItem = clothes.value.find(c => c.id === selId);
    if (!selItem) return false;
    return getExclusionGroup(selItem.data.categorie) === itemGroup;
  });
};

// Group available clothes by category for display
const availableClothesByCategory = computed(() => {
  const result: Record<string, RecordEntry[]> = {};
  
  // Only show clothes that are marked as available
  const availableItems = clothes.value.filter(c => c.data.is_available !== false);

  availableItems.forEach(item => {
    const cat = item.data.categorie || 'Autre';
    if (!result[cat]) {
      result[cat] = [];
    }
    result[cat].push(item);
  });

  return result;
});

// Weather interpretation code
const getWeatherDetails = (code: number) => {
  if (code === 0) return { desc: 'Ensoleillé', emoji: '☀️' };
  if ([1, 2, 3].includes(code)) return { desc: 'Éclaircies', emoji: '🌤️' };
  if ([45, 48].includes(code)) return { desc: 'Brouillard', emoji: '🌫️' };
  if ([51, 53, 55, 56, 57].includes(code)) return { desc: 'Bruine', emoji: '🌧️' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { desc: 'Pluie', emoji: '🌧️🌧️' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { desc: 'Neige', emoji: '❄️' };
  if ([95, 96, 99].includes(code)) return { desc: 'Orage', emoji: '⛈️' };
  return { desc: 'Nuageux', emoji: '☁️' };
};

// Get the latest worn outfits in the current context (to prevent recent repeats)
const recentOutfitsInContext = computed(() => {
  const ctx = selectedContext.value;
  return tenues.value
    .filter(t => t.data.contexte === ctx)
    .slice(0, 3) // get the last 3 outfits worn in this context
    .map(t => {
      const vPortesIds: string[] = t.data.vetements_portes || [];
      const names = vPortesIds.map(id => {
        const item = clothes.value.find(c => c.id === id);
        return item ? item.data.nom : 'Vêtement inconnu';
      });
      return {
        id: t.id,
        date: t.data.date,
        names,
        garmentIds: vPortesIds
      };
    });
});

// Suggestions Engine
// Suggests Tenues Types based on:
// 1. Availability of all garments inside the tenue type
// 2. Weather matches (temperature)
// 3. Rotation rule (penalize/warn if worn recently in the same context)
const suggestedOutfits = computed(() => {
  const temp = weatherData.value ? weatherData.value.temperature_2m : 15;
  const ctx = selectedContext.value;

  return tenuesTypes.value
    .map(tt => {
      const gIds: string[] = tt.data.vetements_associes || [];
      // 1. Check if all garments in this template are available
      const allAvailable = gIds.every(id => {
        const garment = clothes.value.find(c => c.id === id);
        return garment && garment.data.is_available !== false;
      });

      if (!allAvailable) return null; // filter out if any item is in the wash

      // 2. Temperature match
      const idealTemp = tt.data.temperature_ideale !== undefined ? Number(tt.data.temperature_ideale) : 15;
      const tempDiff = Math.abs(temp - idealTemp);
      
      // Calculate matching score (lower tempDiff is better, ideal matching is < 5 degrees difference)
      let tempScore = Math.max(0, 10 - tempDiff);

      // Context matching
      let contextScore = 0;
      if (tt.data.contexte === ctx) {
        contextScore = 10;
      }

      // 3. Check rotation penalty
      // If this outfit has a huge overlap (>= 75% same garment IDs) with any of the recent 3 outfits worn in this context, penalize it heavily!
      let penalty = 0;
      let recentlyWornDate = '';
      recentOutfitsInContext.value.forEach(recent => {
        const intersection = gIds.filter(id => recent.garmentIds.includes(id));
        const overlapRatio = intersection.length / Math.max(gIds.length, recent.garmentIds.length);
        if (overlapRatio >= 0.7 && !recentlyWornDate) {
          penalty = 15; // heavy penalty for repeating
          recentlyWornDate = recent.date;
        }
      });

      const score = tempScore + contextScore - penalty;

      // Extract garment names
      const garmentNames = gIds.map(id => {
        const item = clothes.value.find(c => c.id === id);
        return item ? item.data.nom : 'Vêtement inconnu';
      });

      return {
        id: tt.id,
        nom: tt.data.nom,
        garmentIds: gIds,
        garmentNames,
        score,
        contexte: tt.data.contexte,
        idealTemp,
        isRecentlyWorn: penalty > 0,
        recentlyWornDate
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.score - a.score); // Sort by highest recommendation score
});

// Apply a suggested outfit to the manual selection
const applySuggestion = (garmentIds: string[]) => {
  selectedGarments.value = [...garmentIds];
};

// Toggle manual garment selection
const toggleGarmentSelection = (id: string) => {
  const idx = selectedGarments.value.indexOf(id);
  if (idx > -1) {
    selectedGarments.value.splice(idx, 1);
  } else {
    selectedGarments.value.push(id);
  }
};

// Check if a category group has any selected item
const isCategoryActive = (category: string): boolean => {
  return selectedGarments.value.some(selId => {
    const item = clothes.value.find(c => c.id === selId);
    return item && item.data.categorie === category;
  });
};

const getActiveItemNameForCategory = (category: string): string => {
  const selId = selectedGarments.value.find(selId => {
    const item = clothes.value.find(c => c.id === selId);
    return item && item.data.categorie === category;
  });
  if (!selId) return '';
  const item = clothes.value.find(c => c.id === selId);
  return item ? item.data.nom : '';
};

// Confirm Outfit wear
const openPorterModal = () => {
  if (selectedGarments.value.length === 0) return;
  showPorterConfirmModal.value = true;
};

const confirmWearOutfit = async () => {
  try {
    // 1. Record the outfit in History
    const newTenue: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: TENUES_COL_ID,
      data: {
        date: dateSaisie.value,
        vetements_portes: [...selectedGarments.value],
        contexte: selectedContext.value,
        entourage_croise: []
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.add(newTenue);

    // 2. If user opted to put them in laundry basket immediately
    if (putInLaundryBasket.value) {
      for (const id of selectedGarments.value) {
        await db.records.update(id, {
          'data.is_available': false,
          updatedAt: Date.now()
        });
      }
    }

    // Reset selection and close
    selectedGarments.value = [];
    showPorterConfirmModal.value = false;
    emit('data-updated');
    await loadData();
    alert('Tenue du jour enregistrée !');
  } catch (err) {
    console.error(err);
  }
};
</script>

<template>
  <div class="home-view">
    <!-- Top Dashboard Header with Weather and Context Selection -->
    <div class="dashboard-grid mb-4">
      <!-- Weather Widget Card -->
      <div class="card glass weather-card">
        <div class="weather-header">
          <div class="flex-row">
            <CloudSun class="text-primary" :size="24" />
            <h3 class="font-bold">Météo à {{ currentCity }}</h3>
          </div>
          <button @click="fetchWeather" class="refresh-btn" :disabled="weatherLoading" title="Rafraîchir la météo">
            <RefreshCw :size="14" :class="{ 'spin-icon': weatherLoading }" />
          </button>
        </div>
        
        <div v-if="weatherLoading" class="weather-body text-center py-2">
          <div class="mini-spinner"></div>
        </div>
        <div v-else-if="weatherError" class="weather-body text-muted">
          <p>{{ weatherError }}</p>
        </div>
        <div v-else-if="weatherData" class="weather-body">
          <div class="temp-row">
            <span class="temp-val">{{ Math.round(weatherData.temperature_2m) }}°C</span>
            <span class="weather-emoji">{{ getWeatherDetails(weatherData.weather_code).emoji }}</span>
          </div>
          <div class="weather-sub">
            <span>{{ getWeatherDetails(weatherData.weather_code).desc }}</span>
            <span class="bullet">•</span>
            <span>Ressenti {{ Math.round(weatherData.apparent_temperature) }}°C</span>
          </div>
        </div>
        <div v-else class="weather-body text-muted">
          <p>Météo non chargée.</p>
        </div>
      </div>

      <!-- Context Selection Card -->
      <div class="card glass context-card">
        <div class="flex-row mb-2">
          <Calendar class="text-purple" :size="20" />
          <h3 class="font-bold">Mon Contexte du Jour</h3>
        </div>
        <p class="text-secondary text-xs mb-2">Sélectionne ton activité pour adapter les suggestions de tenues.</p>
        <div class="contexts-grid">
          <button 
            v-for="ctx in contexts" 
            :key="ctx"
            @click="selectedContext = ctx"
            class="ctx-btn"
            :class="{ active: selectedContext === ctx }"
          >
            {{ ctx }}
          </button>
        </div>
      </div>
    </div>

    <!-- Rotation Rules Warn & Suggestions Area -->
    <div class="suggestion-area mb-4">
      <div class="card glass">
        <div class="flex-row mb-2">
          <Sparkles class="text-accent" :size="18" />
          <h3 class="font-bold">Suggestions de Tenues Types</h3>
        </div>
        <p class="text-secondary text-xs mb-4">Tenues recommandées pour aujourd'hui (basées sur la météo, le contexte, et l'exclusion des vêtements déjà portés récemment).</p>

        <div v-if="isLoading" class="text-center py-4">
          <div class="mini-spinner"></div>
        </div>
        <div v-else-if="suggestedOutfits.length === 0" class="text-muted text-center py-4">
          <p>Aucune suggestion disponible. Crée des "Tenues Types" dans les Préférences ou ajoute des vêtements propres pour voir des suggestions.</p>
        </div>
        <div v-else class="suggestions-list">
          <div 
            v-for="sug in suggestedOutfits.slice(0, 3)" 
            :key="sug.id"
            class="suggestion-item"
            :class="{ 'recently-worn-item': sug.isRecentlyWorn }"
          >
            <div class="sug-info">
              <div class="sug-title">
                <span class="sug-name">{{ sug.nom }}</span>
                <span v-if="sug.isRecentlyWorn" class="badge badge-warning flex-row text-xs ml-2">
                  <AlertTriangle :size="12" /> Déjà porté récemment ({{ formatToFrenchDate(sug.recentlyWornDate) }})
                </span>
                <span v-else class="badge badge-success text-xs ml-2">Recommandé</span>
              </div>
              <div class="sug-garments text-secondary mt-1">
                {{ sug.garmentNames.join(' + ') }}
              </div>
              <div class="sug-meta mt-1 text-xs text-muted flex-row">
                <Thermometer :size="12" /> Température idéale : {{ sug.idealTemp }}°C
                <span v-if="sug.contexte" class="ml-2">• Contexte : {{ sug.contexte }}</span>
              </div>
            </div>
            <button @click="applySuggestion(sug.garmentIds)" class="btn btn-purple btn-sm">
              <Play :size="12" /> Choisir
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Outfit Composer / Smart Selector -->
    <div class="card glass composer-card">
      <div class="composer-header">
        <h3 class="font-bold">Composer ma Tenue du Jour</h3>
        <div class="selected-summary flex-row" v-if="selectedGarments.length > 0">
          <span class="badge badge-primary">{{ selectedGarments.length }} pièces sélectionnées</span>
          <button @click="openPorterModal" class="btn btn-accent btn-sm">
            Porter cette tenue <Check :size="14" />
          </button>
        </div>
      </div>

      <div class="clothes-selector-container mt-4">
        <div v-if="isLoading" class="text-center py-4">
          <div class="mini-spinner"></div>
        </div>
        <div v-else-if="clothes.filter(c => c.data.is_available !== false).length === 0" class="text-center py-4 text-muted">
          <p>Tous tes vêtements sont marqués comme indisponibles / linge sale !</p>
          <p class="text-xs mt-2">Pense à enregistrer une Lessive ou à re-déclarer tes vêtements disponibles dans ton Dressing.</p>
        </div>
        <div v-else class="composer-category-columns">
          <div 
            v-for="(items, category) in availableClothesByCategory" 
            :key="category"
            class="composer-col"
            :class="{ 'category-completed': isCategoryActive(category) }"
          >
            <div class="category-header">
              <h4>{{ category }}</h4>
              <span v-if="isCategoryActive(category)" class="completed-check" :title="getActiveItemNameForCategory(category)">
                <Check :size="14" class="text-accent-icon" />
              </span>
            </div>

            <div class="category-items-list mt-2">
              <div 
                v-for="item in items" 
                :key="item.id"
                class="composer-item"
                :class="{ 
                  'selected': selectedGarments.includes(item.id!), 
                  'excluded': isGroupAlreadySelected(item) 
                }"
                @click="!isGroupAlreadySelected(item) && toggleGarmentSelection(item.id!)"
              >
                <div class="item-selection-box">
                  <span class="item-name">{{ item.data.nom }}</span>
                  <span class="item-desc" v-if="item.data.matiere || item.data.couleur">
                    {{ item.data.couleur }}<span v-if="item.data.couleur && item.data.matiere">, </span>{{ item.data.matiere }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm Wear Outfit Modal -->
    <div v-if="showPorterConfirmModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>Confirmé : Porter cette tenue</h3>
          <button @click="showPorterConfirmModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Date</label>
            <input v-model="dateSaisie" type="date" class="input" />
          </div>

          <div class="form-group mt-2">
            <label>Contexte de la tenue</label>
            <select v-model="selectedContext" class="select">
              <option v-for="ctx in contexts" :key="ctx" :value="ctx">{{ ctx }}</option>
            </select>
          </div>

          <div class="summary-box card glass mt-4">
            <h4 class="font-bold mb-2">Vêtements portés :</h4>
            <ul>
              <li v-for="selId in selectedGarments" :key="selId" class="text-secondary text-sm">
                • {{ clothes.find(c => c.id === selId)?.data.nom }}
              </li>
            </ul>
          </div>

          <div class="form-group mt-4">
            <div class="flex-row">
              <label class="switch">
                <input type="checkbox" v-model="putInLaundryBasket" />
                <span class="slider"></span>
              </label>
              <span class="text-secondary font-bold text-sm">Déposer directement ces habits au linge sale</span>
            </div>
            <p class="text-xs text-muted mt-1 ml-10">(Les marquera comme indisponibles dans l'armoire immédiatement)</p>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showPorterConfirmModal = false" class="btn btn-secondary">Annuler</button>
          <button @click="confirmWearOutfit" class="btn btn-accent">Confirmer & Porter</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.weather-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.refresh-btn {
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

.spin-icon {
  animation: spin 1s linear infinite;
}

.weather-body {
  margin-top: 0.5rem;
}

.temp-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  .temp-val {
    font-size: 2rem;
    font-weight: 900;
  }
  
  .weather-emoji {
    font-size: 2rem;
  }
}

.weather-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.bullet {
  color: var(--text-muted);
}

.contexts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.ctx-btn {
  background-color: rgba(15, 23, 42, 0.4);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.45rem 0.25rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    border-color: var(--border-hover);
    color: var(--text-primary);
  }
  
  &.active {
    background-color: var(--color-purple);
    border-color: var(--color-purple);
    color: #ffffff;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
  }
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.suggestion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  transition: var(--transition);
  
  &:hover {
    border-color: var(--border-hover);
    background-color: rgba(255, 255, 255, 0.04);
  }
  
  &.recently-worn-item {
    border-color: rgba(245, 158, 11, 0.15);
    background-color: rgba(245, 158, 11, 0.01);
  }
}

.sug-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  
  .sug-name {
    font-weight: 800;
    font-size: 0.95rem;
  }
}

.sug-garments {
  font-size: 0.85rem;
}

.composer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
}

.composer-category-columns {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  align-items: start;
}

.composer-col {
  background-color: rgba(15, 23, 42, 0.3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  transition: var(--transition);
  
  &.category-completed {
    border-color: rgba(16, 185, 129, 0.3);
    background-color: rgba(16, 185, 129, 0.01);
  }
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.35rem;
  margin-bottom: 0.5rem;
  
  h4 {
    font-size: 0.85rem;
    font-weight: 800;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
}

.text-accent-icon {
  color: var(--color-accent);
}

.category-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.composer-item {
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.65rem;
  cursor: pointer;
  transition: var(--transition);
  
  &:hover {
    background-color: var(--border-hover);
    border-color: var(--border-hover);
  }
  
  &.selected {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: #ffffff;
    
    .item-desc {
      color: rgba(255, 255, 255, 0.7);
    }
  }
  
  &.excluded {
    opacity: 0.35;
    cursor: not-allowed;
    background-color: transparent;
    border-color: transparent;
    
    &:hover {
      background-color: transparent;
      border-color: transparent;
    }
  }
}

.item-selection-box {
  display: flex;
  flex-direction: column;
  
  .item-name {
    font-size: 0.8rem;
    font-weight: 700;
  }
  
  .item-desc {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
}

.ml-10 {
  margin-left: 3rem;
}

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.py-4 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
.ml-2 { margin-left: 0.5rem; }

.summary-box {
  background-color: rgba(15, 23, 42, 0.4);
  padding: 1rem;
}

.mini-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0.5rem auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
