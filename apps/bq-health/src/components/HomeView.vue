<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { type RecordEntry } from '../db/index';
import { 
  getVaccinsRecords, 
  getPrescRecords, 
  formatToFrenchDate 
} from '../db/queries';
import { ShieldAlert, Heart, Calendar, Check, AlertTriangle } from '@lucide/vue';

const vaccins = ref<RecordEntry[]>([]);
const presc = ref<RecordEntry[]>([]);
const isLoading = ref(true);

// Profile Emergency ICE localstorage states
const bloodType = ref(localStorage.getItem('bq-health-blood') || 'Inconnu');
const allergies = ref(localStorage.getItem('bq-health-allergies') || 'Aucune allergie connue.');
const emergencyContact = ref(localStorage.getItem('bq-health-ice') || 'Non renseigné');

const loadData = async () => {
  isLoading.value = true;
  try {
    vaccins.value = await getVaccinsRecords();
    presc.value = await getPrescRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Calculate active medications (currently taken)
const activeTreatments = computed(() => {
  return presc.value.filter(p => p.data.actif === true || p.data.actif === 1);
});

// Calculate overdue or upcoming vaccine booster alerts
const vaccineAlerts = computed(() => {
  const now = Date.now();
  
  return vaccins.value
    .filter(v => v.data.statut === 'À faire / Rappel' || (v.data.prochain_rappel && v.data.statut === 'Fait'))
    .map(v => {
      if (v.data.statut === 'À faire / Rappel') {
        return {
          id: v.id,
          type: v.data.type,
          vaccin: v.data.vaccin,
          isUrgent: true,
          desc: "Vaccin déclaré comme 'À faire' dans ton carnet."
        };
      }
      
      const rappelTime = new Date(v.data.prochain_rappel).getTime();
      const diffMs = rappelTime - now;
      const diffDays = Math.ceil(diffMs / (24 * 3600 * 1000));

      if (diffDays < 0) {
        return {
          id: v.id,
          type: v.data.type,
          vaccin: v.data.vaccin,
          isUrgent: true,
          desc: `Rappel en retard de ${Math.abs(diffDays)} jours (échéance le ${formatToFrenchDate(v.data.prochain_rappel)}).`
        };
      } else if (diffDays <= 60) {
        return {
          id: v.id,
          type: v.data.type,
          vaccin: v.data.vaccin,
          isUrgent: false,
          desc: `Rappel à prévoir bientôt, sous ${diffDays} jours (le ${formatToFrenchDate(v.data.prochain_rappel)}).`
        };
      }
      
      return null;
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
});
</script>

<template>
  <div class="home-view">
    <div class="view-header">
      <div>
        <h2>🩺 Cockpit Santé & Urgences</h2>
        <p class="text-secondary">Tes informations vitales d'urgence, ton pilulier actif et l'état de tes rappels de vaccins.</p>
      </div>
    </div>

    <!-- Dashboard layout Grid -->
    <div class="health-dashboard-grid">
      <!-- Left Column: ICE Emergency Card & Medical Profile -->
      <div class="profile-col-sec">
        <!-- Emergency ICE Card -->
        <div class="card glass emergency-card mb-4">
          <div class="card-header flex-row mb-3">
            <ShieldAlert class="text-primary icon-alert-pulse" :size="24" />
            <h3 class="font-bold text-lg text-primary uppercase tracking-wide">Fiche de Secours (ICE)</h3>
          </div>
          
          <div class="emergency-blood-box text-center py-2 mb-3">
            <span class="blood-lbl block text-xs text-muted font-bold uppercase">GROUPE SANGUIN</span>
            <span class="blood-val font-black text-2xl text-primary">{{ bloodType }}</span>
          </div>

          <div class="emergency-info-row mb-3">
            <span class="info-lbl text-xs text-muted font-bold block uppercase mb-1">Allergies & Intolérances</span>
            <p class="info-val text-sm" :class="{ 'text-danger font-bold': allergies !== 'Aucune allergie connue.' }">
              {{ allergies }}
            </p>
          </div>

          <div class="emergency-info-row border-top pt-3">
            <span class="info-lbl text-xs text-muted font-bold block uppercase mb-1">Contact d'urgence (ICE)</span>
            <p class="info-val font-bold text-sm text-secondary">
              {{ emergencyContact }}
            </p>
          </div>

          <p class="text-xs text-muted mt-3 italic text-center">
            Configure ces informations d'urgence dans l'onglet **Options / Paramètres** pour les modifier.
          </p>
        </div>
      </div>

      <!-- Right Column: Pilulier & Vaccines Alerts -->
      <div class="medical-alerts-col">
        <!-- Pilulier / Active Treatments Card -->
        <div class="card glass mb-4">
          <h3 class="font-bold flex-row mb-3"><Heart class="text-primary" :size="18" /> Mon Pilulier du Jour</h3>
          
          <div v-if="isLoading" class="text-center py-3">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="activeTreatments.length === 0" class="text-center py-4 text-muted text-sm">
            <p>Aucun traitement ou ordonnance actif en cours.</p>
            <p class="text-xs mt-1">Saisis tes traitements dans l'onglet **Traitements** pour planifier tes posologies.</p>
          </div>

          <div v-else class="treatments-pillbox-list">
            <div v-for="t in activeTreatments" :key="t.id" class="treatment-pillbox-item flex-row gap-3">
              <span class="pill-indicator-dot"></span>
              <div class="pill-details">
                <h4 class="pill-name font-bold text-sm">{{ t.data.nom_medicament }}</h4>
                <p class="pill-poso text-xs text-accent font-bold mt-0.5">{{ t.data.posologie }}</p>
                <p class="pill-doctor text-xs text-muted" v-if="t.data.medecin_prescripteur">Prescrit par : {{ t.data.medecin_prescripteur }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Vaccination reminders -->
        <div class="card glass">
          <h3 class="font-bold flex-row mb-3"><Calendar class="text-accent" :size="18" /> Alertes de Vaccination</h3>
          
          <div v-if="isLoading" class="text-center py-3">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="vaccineAlerts.length === 0" class="text-center py-4 text-muted text-sm">
            <p class="flex-row justify-center"><Check class="text-success" :size="16" /> Tous tes vaccins et rappels sont à jour.</p>
          </div>

          <div v-else class="vaccines-alerts-stack">
            <div 
              v-for="alert in vaccineAlerts" 
              :key="alert.id" 
              class="vaccine-alert-item flex-row gap-3"
              :class="alert.isUrgent ? 'urgent' : 'warning'"
            >
              <AlertTriangle class="alert-icon flex-shrink-0" :size="18" />
              <div>
                <h4 class="alert-title font-bold text-xs uppercase">{{ alert.type }} <span class="normal-case text-muted" v-if="alert.vaccin">({{ alert.vaccin }})</span></h4>
                <p class="alert-desc text-xs mt-0.5 text-secondary">{{ alert.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.health-dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.emergency-card {
  border-color: rgba(244, 63, 94, 0.3) !important;
  background-color: rgba(244, 63, 94, 0.01) !important;
}

.icon-alert-pulse {
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); filter: drop-shadow(0 0 4px rgba(244, 63, 94, 0.4)); }
  100% { transform: scale(1); }
}

.emergency-blood-box {
  background-color: rgba(244, 63, 94, 0.08);
  border: 1px solid rgba(244, 63, 94, 0.15);
  border-radius: var(--radius-sm);
}

.treatments-pillbox-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.treatment-pillbox-item {
  background-color: rgba(255, 255, 255, 0.01);
  border: 1px solid var(--border-color);
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm);
}

.pill-indicator-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--color-primary);
  box-shadow: 0 0 8px var(--color-primary);
  flex-shrink: 0;
  align-self: center;
}

.vaccines-alerts-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.vaccine-alert-item {
  border: 1px solid var(--border-color);
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm);
  
  &.urgent {
    border-color: rgba(239, 68, 68, 0.25);
    background-color: rgba(239, 68, 68, 0.02);
    
    .alert-icon { color: var(--color-danger); }
  }
  &.warning {
    border-color: rgba(245, 158, 11, 0.25);
    background-color: rgba(245, 158, 11, 0.02);
    
    .alert-icon { color: var(--color-warning); }
  }
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
.block { display: block; }
.mt-0\.5 { margin-top: 0.15rem; }
.mt-2 { margin-top: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }

.mini-spinner {
  width: 24px;
  height: 24px;
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
