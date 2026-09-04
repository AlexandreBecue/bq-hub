<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { type RecordEntry } from '../db/index';
import { 
  getComptesRecords, 
  getFinancesRecords, 
  calculateAccountBalances 
} from '../db/queries';
import { Landmark, ShieldAlert } from '@lucide/vue';

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

// Filter active accounts
const activeComptes = computed(() => {
  return comptes.value.filter(c => c.data.is_active !== false);
});

// Sum of all active account balances
const totalPatrimoine = computed(() => {
  let sum = 0;
  activeComptes.value.forEach(acc => {
    sum += realBalances.value[acc.data.nom] || 0;
  });
  return sum;
});
</script>

<template>
  <div class="comptes-view">
    <div class="view-header">
      <div>
        <h2>🏦 Mes Comptes & Soldes</h2>
        <p class="text-secondary">Consulte les soldes réels de tes différents comptes bancaires calculés en temps réel d'après ton historique.</p>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-4">
      <div class="spinner"></div>
    </div>

    <div v-else-if="activeComptes.length === 0" class="card glass text-center py-4 text-muted">
      <ShieldAlert class="mx-auto mb-2 text-warning" :size="36" />
      <h3>Aucun compte bancaire actif</h3>
      <p class="text-secondary text-sm mt-2">Configure et active tes comptes bancaires dans l'onglet **Garage/Options** pour voir les soldes.</p>
    </div>

    <div v-else class="comptes-dashboard-layout">
      <!-- Total Patrimoine Card -->
      <div class="card glass total-patrimoine-card mb-4 text-center">
        <span class="lbl font-bold text-xs text-muted block uppercase mb-1">Patrimoine Financier Global</span>
        <h3 class="patrimoine-val font-black text-2xl" :class="totalPatrimoine >= 0 ? 'text-success' : 'text-danger'">
          {{ totalPatrimoine.toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} €
        </h3>
        <p class="text-secondary text-xs mt-2">Somme des soldes de tes {{ activeComptes.length }} comptes actifs.</p>
      </div>

      <!-- Accounts Grid -->
      <div class="comptes-grid">
        <div 
          v-for="acc in activeComptes" 
          :key="acc.id" 
          class="card glass hoverable compte-card"
        >
          <div class="compte-header flex-row">
            <div class="icon-wrapper">
              <Landmark :size="18" />
            </div>
            <h4 class="compte-title font-bold text-md">{{ acc.data.nom }}</h4>
          </div>

          <div class="compte-body mt-4">
            <span class="lbl text-xs text-muted font-bold uppercase block">Solde en temps réel</span>
            <span class="compte-solde font-black text-xl block mt-1" :class="(realBalances[acc.data.nom] || 0) >= 0 ? 'text-success' : 'text-danger'">
              {{ (realBalances[acc.data.nom] || 0).toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} €
            </span>
          </div>

          <div class="compte-footer border-top pt-2 mt-4 text-xs text-secondary flex-row justify-between">
            <span>Solde initial : {{ Number(acc.data.solde_initial).toFixed(2) }} €</span>
            <span class="badge badge-success text-xs">Actif</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.comptes-dashboard-layout {
  max-width: 800px;
  margin: 0 auto;
}

.total-patrimoine-card {
  border-color: rgba(16, 185, 129, 0.2);
  background-color: rgba(16, 185, 129, 0.02);
  padding: 1.5rem;
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
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--color-primary);
}

.border-top {
  border-top: 1px solid var(--border-color);
}

.pt-2 {
  padding-top: 0.5rem;
}

.text-success { color: #34d399 !important; }
.text-danger { color: #f87171 !important; }

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
