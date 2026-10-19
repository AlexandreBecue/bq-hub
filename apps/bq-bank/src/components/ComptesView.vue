<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { type RecordEntry } from '../db/index';
import { 
  getComptesRecords, 
  getFinancesRecords, 
  calculateAccountBalances 
} from '../db/queries';
import { ShieldAlert, CreditCard, PiggyBank, TrendingUp } from '@lucide/vue';

const comptes = ref<RecordEntry[]>([]);
const finances = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const loadData = async () => {
  isLoading.value = true;
  try {
    comptes.value = await getComptesRecords();
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

// Calculate real balances for all accounts
const realBalances = computed(() => {
  return calculateAccountBalances(comptes.value, finances.value);
});

// Filter and sort active accounts (Classique -> Épargne -> Investissement, then alphabetically by name)
const activeComptes = computed(() => {
  const getTypePriority = (type?: string) => {
    const t = type || 'Classique';
    if (t === 'Classique') return 1;
    if (t === 'Épargne') return 2;
    if (t === 'Investissement') return 3;
    return 4;
  };

  return [...comptes.value]
    .filter(c => c.data.is_active !== false)
    .sort((a, b) => {
      const priorityA = getTypePriority(a.data.type);
      const priorityB = getTypePriority(b.data.type);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      const nameA = a.data.nom || '';
      const nameB = b.data.nom || '';
      return nameA.localeCompare(nameB, 'fr');
    });
});

// Sum of all active account balances
const totalPatrimoine = computed(() => {
  let sum = 0;
  activeComptes.value.forEach(acc => {
    sum += realBalances.value[acc.data.nom] || 0;
  });
  return sum;
});

// Sum of balances by account type
const patrimoineParType = computed(() => {
  const totals: Record<string, number> = {
    'Classique': 0,
    'Épargne': 0,
    'Investissement': 0
  };
  
  const activeTypes = new Set<string>();
  
  activeComptes.value.forEach(acc => {
    const type = acc.data.type || 'Classique';
    activeTypes.add(type);
    const balance = realBalances.value[acc.data.nom] || 0;
    if (totals[type] !== undefined) {
      totals[type] += balance;
    } else {
      totals[type] = balance;
    }
  });
  
  const order = ['Classique', 'Épargne', 'Investissement'];
  return order
    .filter(type => activeTypes.has(type))
    .map(type => ({
      type,
      total: totals[type]
    }));
});
</script>

<template>
  <div class="comptes-view">
    <div class="view-header">
      <div>
        <h2>Soldes</h2>
        <p class="text-sub">Consulte les soldes réels de tes différents comptes bancaires calculés en temps réel d'après ton historique.</p>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-4">
      <div class="spinner"></div>
    </div>

    <div v-else-if="activeComptes.length === 0" class="card glass text-center py-4 text-muted">
      <ShieldAlert class="mx-auto mb-2 text-warning" :size="36" />
      <h3>Aucun compte bancaire actif</h3>
      <p class="text-sub text-sm mt-2">Configure et active tes comptes bancaires dans l'onglet <strong>Paramètres</strong> pour voir les soldes.</p>
    </div>

    <div v-else class="comptes-dashboard-layout">
      <!-- Total Patrimoine Card -->
      <div class="card glass total-patrimoine-card mb-4 text-center">
        <span class="lbl font-bold text-xs text-muted block uppercase mb-1">Patrimoine financier global</span>
        <div class="patrimoine-val font-black text-2xl" :class="totalPatrimoine >= 0 ? 'text-success' : 'text-danger'">
          {{ totalPatrimoine.toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} €
        </div>

        <!-- Détail par type de compte -->
        <div v-if="patrimoineParType.length > 0" class="patrimoine-breakdown">
          <div 
            v-for="item in patrimoineParType" 
            :key="item.type" 
            class="flex-col text-xs"
          >
            <span class="font-bold" :class="item.type">{{ item.type }} :</span>
            <span class="font-black text-sm" :class="totalPatrimoine >= 0 ? 'text-success' : 'text-danger'">
              {{ item.total.toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} €
            </span>
          </div>
        </div>
      </div>

      <!-- Accounts Grid -->
      <div class="comptes-grid">
        <div 
          v-for="acc in activeComptes" 
          :key="acc.id" 
          class="card glass hoverable compte-card"
          :class="acc.data.type || 'Classique'"
        >
          <div class="compte-header flex-row">
            <div class="icon-wrapper" :class="acc.data.type">
              <PiggyBank v-if="acc.data.type === 'Épargne'" :size="18" />
              <TrendingUp v-else-if="acc.data.type === 'Investissement'" :size="18" />
              <CreditCard v-else :size="18" />
            </div>
            <h4 class="compte-title font-bold text-md">{{ acc.data.nom }}</h4>
          </div>

          <div class="compte-body mt-4">
            <span class="lbl text-xs text-muted font-bold uppercase block">Solde en temps réel</span>
            <span class="compte-solde font-black text-xl block mt-1" :class="(realBalances[acc.data.nom] || 0) >= 0 ? 'text-success' : 'text-danger'">
              {{ (realBalances[acc.data.nom] || 0).toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} €
            </span>
          </div>

          <div class="compte-footer border-top pt-2 mt-4 text-xs text-sub flex-row justify-end">
            <span class="badge text-xs" :class="acc.data.type === 'Épargne' ? 'badge-yellow' : acc.data.type === 'Investissement' ? 'badge-purple' : 'badge-primary'">
              {{ acc.data.type || 'Classique' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.comptes-dashboard-layout {
  max-width: 1200px;
  margin: 0 auto;
}

.total-patrimoine-card {
  border-color: color-mix(in srgb, var(--color-success) 20%, transparent);
  background-color: color-mix(in srgb, var(--color-success) 2%, transparent);
  padding: 1.5rem;

  .patrimoine-breakdown {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }
}

.patrimoine-val {
  font-size: 2.25rem;
}

.comptes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.compte-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-width: 1px;
  border-style: solid;
  transition: var(--transition);

  &.Classique {
    border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
    &:hover {
      border-color: var(--color-primary);
      box-shadow: 0 0 16px color-mix(in srgb, var(--color-primary) 20%, transparent);
    }
  }

  &.Épargne {
    border-color: color-mix(in srgb, var(--color-yellow) 35%, transparent);
    &:hover {
      border-color: var(--color-yellow);
      box-shadow: 0 0 16px color-mix(in srgb, var(--color-yellow) 20%, transparent);
    }
  }

  &.Investissement {
    border-color: color-mix(in srgb, var(--color-purple) 35%, transparent);
    &:hover {
      border-color: var(--color-purple);
      box-shadow: 0 0 16px color-mix(in srgb, var(--color-purple) 20%, transparent);
    }
  }
}

.compte-header {
  gap: 0.75rem;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  
  &.Classique {
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
  &.Épargne {
    background-color: color-mix(in srgb, var(--color-yellow) 10%, transparent);
  }
  &.Investissement {
    background-color: color-mix(in srgb, var(--color-purple) 10%, transparent);
  }
}

.border-top {
  border-top: 1px solid var(--border-color);
}

.pt-2 {
  padding-top: 0.5rem;
}

.text-success { color: var(--color-success) !important; }
.text-danger { color: var(--color-danger) !important; }

.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.85rem; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }
.text-center { text-align: center; }
.block { display: block; }
.mt-4 { margin-top: 1rem; }
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
