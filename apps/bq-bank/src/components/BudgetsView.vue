<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { type RecordEntry } from '../db/index';
import { 
  getBudgetsRecords, 
  getFinancesRecords 
} from '../db/queries';
import { Calendar, ChevronLeft, ArrowUpRight, ArrowDownLeft, ChevronRight, TrendingUp } from '@lucide/vue';

const budgets = ref<RecordEntry[]>([]);
const finances = ref<RecordEntry[]>([]);
const isLoading = ref(true);

// Selected month/year state (Defaults to current month)
const currentDate = new Date();
const selectedYear = ref(currentDate.getFullYear());
const selectedMonth = ref(currentDate.getMonth()); // 0-indexed

const monthsNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const loadData = async () => {
  isLoading.value = true;
  try {
    budgets.value = await getBudgetsRecords();
    finances.value = await getFinancesRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Navigate months
const prevMonth = () => {
  if (selectedMonth.value === 0) {
    selectedMonth.value = 11;
    selectedYear.value--;
  } else {
    selectedMonth.value--;
  }
};

const nextMonth = () => {
  if (selectedMonth.value === 11) {
    selectedMonth.value = 0;
    selectedYear.value++;
  } else {
    selectedMonth.value++;
  }
};

// Filtered finances for the selected month-year
const selectedMonthFinances = computed(() => {
  const targetYearStr = String(selectedYear.value);
  // Pad month to 2 digits (e.g. 0 -> '01')
  const targetMonthStr = String(selectedMonth.value + 1).padStart(2, '0');
  const prefix = `${targetYearStr}-${targetMonthStr}`;

  return finances.value.filter(f => String(f.data.date).startsWith(prefix));
});

// Monthly global totals
const monthlyTotals = computed(() => {
  let entries = 0;
  let sorties = 0;

  selectedMonthFinances.value.forEach(f => {
    const type = f.data.type;
    const amount = Number(f.data.montant) || 0;
    if (type === 'Entrée') {
      entries += amount;
    } else if (type === 'Sortie') {
      sorties += amount;
    }
  });

  return {
    revenus: entries,
    depenses: sorties,
    net: entries - sorties
  };
});

// Calculate spent amounts for each budget envelope in the selected month
const budgetProgressList = computed(() => {
  return budgets.value.map(b => {
    const bName = b.data.nom;
    const limit = Number(b.data.plafond_mensuel) || 0;

    // Sum all Sorties with this budget tag in selected month
    let totalSpent = 0;
    selectedMonthFinances.value.forEach(f => {
      if (f.data.type === 'Sortie' && String(f.data.budget).trim() === bName.trim()) {
        totalSpent += Number(f.data.montant) || 0;
      }
    });

    const percent = limit > 0 ? (totalSpent / limit) * 100 : 0;

    let barColorClass = 'bg-success';
    if (percent > 100) {
      barColorClass = 'bg-danger';
    } else if (percent > 75) {
      barColorClass = 'bg-warning';
    }

    return {
      id: b.id!,
      nom: bName,
      limit,
      spent: totalSpent,
      percent,
      barColorClass
    };
  });
});
</script>

<template>
  <div class="budgets-view">
    <div class="view-header">
      <div>
        <h2>📊 Suivi des Budgets</h2>
        <p class="text-secondary">Visualise tes enveloppes budgétaires sous forme de jauges et surveille tes dépenses mensuelles.</p>
      </div>
    </div>

    <!-- Month Selector Banner -->
    <div class="card glass month-selector-card mb-4">
      <div class="flex-row justify-between">
        <button @click="prevMonth" class="nav-arrow-btn">
          <ChevronLeft :size="20" />
        </button>
        
        <div class="selected-month-label text-center">
          <span class="m-label font-black text-lg">{{ monthsNames[selectedMonth] }} {{ selectedYear }}</span>
        </div>
        
        <button @click="nextMonth" class="nav-arrow-btn">
          <ChevronRight :size="20" />
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-4">
      <div class="spinner"></div>
    </div>

    <div v-else class="budgets-dashboard-grid">
      <!-- Left Column: Global Monthly Balance Card -->
      <div class="global-balance-col">
        <div class="card glass mb-4">
          <h3 class="font-bold flex-row mb-4"><TrendingUp :size="18" class="text-primary" /> Synthèse Mensuelle</h3>
          
          <div class="monthly-metrics-stack">
            <div class="m-metric flex-row justify-between">
              <div class="flex-row gap-2">
                <span class="icon-indicator success"><ArrowUpRight :size="16" /></span>
                <span class="lbl font-bold text-sm text-secondary">Revenus (Entrées)</span>
              </div>
              <span class="val font-black text-md text-success">+{{ monthlyTotals.revenus.toFixed(2) }} €</span>
            </div>

            <div class="m-metric flex-row justify-between">
              <div class="flex-row gap-2">
                <span class="icon-indicator danger"><ArrowDownLeft :size="16" /></span>
                <span class="lbl font-bold text-sm text-secondary">Dépenses (Sorties)</span>
              </div>
              <span class="val font-black text-md text-danger">-{{ monthlyTotals.depenses.toFixed(2) }} €</span>
            </div>

            <div class="m-metric flex-row justify-between border-top pt-3 mt-3">
              <span class="lbl font-black text-sm uppercase">Solde du mois</span>
              <span class="val font-black text-lg" :class="monthlyTotals.net >= 0 ? 'text-success' : 'text-danger'">
                {{ monthlyTotals.net >= 0 ? '+' : '' }}{{ monthlyTotals.net.toFixed(2) }} €
              </span>
            </div>
          </div>
        </div>

        <div class="card glass info-budget-box">
          <h4 class="font-bold mb-2 text-xs uppercase text-primary">Comment gérer tes enveloppes ?</h4>
          <p class="text-secondary text-sm leading-relaxed">
            Pour ajuster tes limites budgétaires, vas dans l'onglet <strong>Garage/Options</strong>. Tu pourras y définir des plafonds mensuels réalistes adaptés à tes besoins !
          </p>
        </div>
      </div>

      <!-- Right Column: Budget Envelopes Progress Gauges -->
      <div class="envelopes-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Calendar :size="18" class="text-accent" /> Enveloppes de Dépenses</h3>
          
          <div v-if="budgetProgressList.length === 0" class="text-center py-4 text-muted text-sm">
            <p>Aucune enveloppe budgétaire configurée.</p>
          </div>

          <div v-else class="envelopes-stack">
            <div v-for="b in budgetProgressList" :key="b.id" class="envelope-item">
              <div class="envelope-label-row flex-row justify-between font-bold text-sm mb-1">
                <span class="env-name text-secondary">{{ b.nom }}</span>
                <span class="env-amounts">
                  <span :class="b.spent > b.limit ? 'text-danger' : 'text-primary'">{{ b.spent.toFixed(2) }} €</span>
                  <span class="text-muted"> / {{ b.limit.toFixed(2) }} €</span>
                </span>
              </div>

              <!-- Gorgeous progress bar -->
              <div class="progress-bar-container">
                <div 
                  class="progress-bar-fill" 
                  :class="b.barColorClass" 
                  :style="{ width: Math.min(b.percent, 100) + '%' }"
                ></div>
              </div>

              <span class="env-percentage text-xs text-muted mt-1 block text-right font-bold">
                {{ b.percent.toFixed(0) }}% consommé
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.month-selector-card {
  border-color: rgba(59, 130, 246, 0.15);
  background-color: rgba(59, 130, 246, 0.01);
  padding: 0.75rem 1.25rem !important;
}

.nav-arrow-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.35rem;
  border-radius: var(--radius-sm);
  transition: var(--transition);
  
  &:hover {
    color: var(--text-primary);
    background-color: var(--border-hover);
  }
}

.m-label {
  color: #60a5fa;
}

.budgets-dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.monthly-metrics-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.m-metric {
  background-color: rgba(255, 255, 255, 0.01);
  border: 1px solid var(--border-color);
  padding: 0.6rem 0.85rem;
  border-radius: var(--radius-sm);
}

.icon-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  &.success {
    background-color: rgba(16, 185, 129, 0.1);
    color: #34d399;
  }
  &.danger {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }
}

.info-budget-box {
  border-color: rgba(59, 130, 246, 0.15);
  background-color: rgba(59, 130, 246, 0.01);
}

.envelopes-stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.envelope-item {
  display: flex;
  flex-direction: column;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &.bg-success { background-color: var(--color-primary); }
  &.bg-warning { background-color: var(--color-warning); }
  &.bg-danger { background-color: var(--color-danger); }
}

.border-top {
  border-top: 1px solid var(--border-color);
}

.pt-3 {
  padding-top: 0.75rem;
}

.text-success { color: #34d399 !important; }
.text-danger { color: #f87171 !important; }

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.text-lg { font-size: 1.15rem; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.block { display: block; }
.mt-1 { margin-top: 0.25rem; }
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
