<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { type RecordEntry } from '../db/index';
import { 
  getVaccinsRecords, 
  getPrescRecords, 
  getPrisesRecords,
  getExamensRecords,
  getRdvsRecords,
  logPriseMedicament,
  formatToFrenchDate 
} from '../db/queries';
import { 
  askMedicationAdvice, 
  debriefMedicalDocument, 
  getGeminiApiKey 
} from '../services/gemini';
import { 
  ShieldAlert, Heart, Calendar, Check, AlertTriangle, Pill, 
  Clock, Package, Plus, Sparkles, FileText, Send, 
  X, Activity, CheckCircle2
} from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

const vaccins = ref<RecordEntry[]>([]);
const presc = ref<RecordEntry[]>([]);
const prises = ref<RecordEntry[]>([]);
const examens = ref<RecordEntry[]>([]);
const rdvs = ref<RecordEntry[]>([]);
const isLoading = ref(true);

// Profile Emergency ICE
const bloodType = ref(localStorage.getItem('bq-health-blood') || 'Inconnu');
const allergies = ref(localStorage.getItem('bq-health-allergies') || 'Aucune allergie connue.');
const emergencyContact = ref(localStorage.getItem('bq-health-ice') || 'Non renseigné');

// Quick Take Medication Modal State
const showPriseModal = ref(false);
const activeMedForPrise = ref<RecordEntry | null>(null);
const priseComment = ref('');
const priseQuantity = ref(1);
const priseTime = ref('');

// Gemini Assistant Modal State
const showGeminiModal = ref(false);
const geminiMode = ref<'advice' | 'document'>('advice');
const geminiQuery = ref('');
const geminiDocumentText = ref('');
const geminiLoading = ref(false);
const geminiResponse = ref('');

const loadData = async () => {
  isLoading.value = true;
  try {
    vaccins.value = await getVaccinsRecords();
    presc.value = await getPrescRecords();
    prises.value = await getPrisesRecords();
    examens.value = await getExamensRecords();
    rdvs.value = await getRdvsRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

const todayStr = computed(() => new Date().toISOString().split('T')[0]);

// Active medications (continuous or cure treatments in progress)
const activeTreatments = computed(() => {
  return presc.value.filter(p => (p.data.actif === true || p.data.actif === 1) && p.data.type_medicament !== 'Ponctuel' && p.data.type_medicament !== 'Automédication');
});

// Ponctual medications (pharmacy / as-needed medicines)
const ponctualMedications = computed(() => {
  return presc.value.filter(p => p.data.type_medicament === 'Ponctuel' || p.data.type_medicament === 'Automédication');
});

// Medication statistics (today count, last taken, stock)
const medicationTelemetry = computed(() => {
  const map: Record<string, {
    todayCount: number;
    targetPerDay: number;
    lastPrise: RecordEntry | null;
    stock: number | null;
  }> = {};

  const today = todayStr.value;
  const allMeds = [...activeTreatments.value, ...ponctualMedications.value];

  for (const t of allMeds) {
    const medId = t.id!;
    const medPrises = prises.value.filter(p => p.data.medicament_id === medId);
    
    const todayIntakes = medPrises.filter(p => p.data.date === today);
    const todayCount = todayIntakes.reduce((sum, p) => sum + (Number(p.data.quantite) || 1), 0);
    const targetPerDay = Number(t.data.posologie_par_jour) || 1;
    const lastPrise = medPrises.length > 0 ? medPrises[0] : null;
    const stock = t.data.stock_actuel !== undefined && t.data.stock_actuel !== null ? Number(t.data.stock_actuel) : null;

    map[medId] = {
      todayCount,
      targetPerDay,
      lastPrise,
      stock
    };
  }

  return map;
});

// Format last intake timestamp in human friendly French
const formatLastIntake = (lastPrise: RecordEntry | null): string => {
  if (!lastPrise) return 'Aucune prise enregistrée';
  const today = todayStr.value;
  const pDate = lastPrise.data.date;
  const pHeure = lastPrise.data.heure || '';

  if (pDate === today) {
    return `Aujourd'hui${pHeure ? ` à ${pHeure}` : ''}`;
  }
  return `Le ${formatToFrenchDate(pDate)}${pHeure ? ` à ${pHeure}` : ''}`;
};

// Open Quick Prise Modal
const openTakeMedicationModal = (t: RecordEntry) => {
  activeMedForPrise.value = t;
  priseComment.value = '';
  priseQuantity.value = 1;
  const now = new Date();
  priseTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  showPriseModal.value = true;
};

// Confirm Medication Intake
const handleConfirmPrise = async () => {
  if (!activeMedForPrise.value) return;

  try {
    const t = activeMedForPrise.value;
    await logPriseMedicament(
      t.id!,
      t.data.nom_medicament,
      priseQuantity.value,
      priseComment.value,
      todayStr.value,
      priseTime.value
    );

    toast.success(`Prise enregistrée : ${t.data.nom_medicament}`);
    showPriseModal.value = false;
    activeMedForPrise.value = null;
    emit('data-updated');
    await loadData();
  } catch (err) {
    console.error('Erreur enregistrement prise:', err);
    toast.error('Erreur lors de l\'enregistrement de la prise.');
  }
};

// Upcoming appointments
const nextUpcomingRdvs = computed(() => {
  const today = todayStr.value;
  return rdvs.value
    .filter(r => (r.data.date || '') >= today)
    .sort((a, b) => String(a.data.date).localeCompare(String(b.data.date)))
    .slice(0, 2);
});

// Recent medical follow-up
const recentExams = computed(() => {
  return [...examens.value]
    .sort((a, b) => String(b.data.date || '').localeCompare(String(a.data.date || '')))
    .slice(0, 2);
});

// Vaccine alerts
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
          desc: `Rappel à prévoir sous ${diffDays} jours (le ${formatToFrenchDate(v.data.prochain_rappel)}).`
        };
      }
      
      return null;
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
});

// Gemini Assistant Actions
const openGeminiModal = (mode: 'advice' | 'document') => {
  geminiMode.value = mode;
  geminiQuery.value = '';
  geminiDocumentText.value = '';
  geminiResponse.value = '';
  showGeminiModal.value = true;
};

const handleRunGemini = async () => {
  if (!getGeminiApiKey()) {
    toast.warning("Veuillez renseigner votre clé API Gemini dans les Paramètres.");
    return;
  }

  geminiLoading.value = true;
  geminiResponse.value = '';

  try {
    if (geminiMode.value === 'advice') {
      if (!geminiQuery.value.trim()) {
        toast.warning("Veuillez poser votre question.");
        geminiLoading.value = false;
        return;
      }

      const advice = await askMedicationAdvice(geminiQuery.value, {
        activeTreatments: activeTreatments.value.map(t => ({
          nom: t.data.nom_medicament,
          posologie: t.data.posologie,
          type: t.data.type_medicament || 'Ordonnance'
        })),
        recentIntakes: prises.value.slice(0, 10).map(p => ({
          nom: p.data.nom_medicament,
          quantite: p.data.quantite || 1,
          date: p.data.date,
          heure: p.data.heure,
          motif: p.data.commentaire
        })),
        allergies: allergies.value,
        bloodType: bloodType.value
      });

      geminiResponse.value = advice;
    } else {
      if (!geminiDocumentText.value.trim()) {
        toast.warning("Veuillez copier le texte ou compte-rendu médical.");
        geminiLoading.value = false;
        return;
      }

      const debrief = await debriefMedicalDocument(geminiDocumentText.value);
      geminiResponse.value = debrief;
    }
  } catch (err: any) {
    console.error('Erreur Gemini Assistant:', err);
    toast.error(err.message || 'Erreur lors de l\'analyse par Gemini.');
  } finally {
    geminiLoading.value = false;
  }
};
</script>

<template>
  <div class="home-view">
    <div class="view-header flex-row justify-between align-center flex-wrap gap-3">
      <div>
        <h2>Cockpit santé</h2>
        <p class="text-sub">Fiche d'urgence, pilulier actif, prises de médicaments et suivi de santé au quotidien.</p>
      </div>

      <!-- Quick AI Assistant Action Buttons -->
      <div class="view-actions flex-row gap-2">
        <button @click="openGeminiModal('advice')" class="btn btn-secondary flex-row gap-2">
          <Sparkles class="text-primary" :size="16" /> Conseil Automédication IA
        </button>
        <button @click="openGeminiModal('document')" class="btn btn-secondary flex-row gap-2">
          <FileText class="text-primary" :size="16" /> Débriefer un document IA
        </button>
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
            <h3 class="font-bold text-lg text-primary uppercase tracking-wide">Fiche de secours (ICE)</h3>
          </div>
          
          <div class="emergency-blood-box text-center py-2 mb-3">
            <span class="blood-lbl block text-xs text-muted font-bold uppercase">GROUPE SANGUIN</span>
            <span class="blood-val font-black text-2xl text-primary">{{ bloodType }}</span>
          </div>

          <div class="emergency-info-row mb-3">
            <span class="info-lbl text-xs text-muted font-bold block uppercase mb-1">Allergies & intolérances</span>
            <p class="info-val text-sm" :class="{ 'text-danger font-bold': allergies !== 'Aucune allergie connue.' }">
              {{ allergies }}
            </p>
          </div>

          <div class="emergency-info-row border-top pt-3">
            <span class="info-lbl text-xs text-muted font-bold block uppercase mb-1">Contact d'urgence (ICE)</span>
            <p class="info-val font-bold text-sm text-sub">
              {{ emergencyContact }}
            </p>
          </div>

          <p class="text-xs text-muted mt-3 italic text-center">
            Informations synchronisées sur ton Google Drive.
          </p>
        </div>

        <!-- Prochains rendez-vous & Consultations -->
        <div class="card glass mb-4" v-if="nextUpcomingRdvs.length > 0">
          <h3 class="font-bold flex-row mb-3"><Calendar :size="18" class="text-primary" /> Prochaines consultations</h3>
          <div class="flex-col gap-2">
            <div v-for="r in nextUpcomingRdvs" :key="r.id" class="p-2 card glass flex-row justify-between align-center">
              <div>
                <h4 class="font-bold text-sm">Dr {{ r.data.praticien }} ({{ r.data.specialite }})</h4>
                <p class="text-xs text-sub mt-0.5" v-if="r.data.motif">{{ r.data.motif }}</p>
              </div>
              <span class="badge badge-success text-xs font-bold">
                Le {{ formatToFrenchDate(r.data.date) }} <span v-if="r.data.heure">à {{ r.data.heure }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Derniers examens de suivi médical -->
        <div class="card glass mb-4" v-if="recentExams.length > 0">
          <h3 class="font-bold flex-row mb-3"><Activity :size="18" class="text-primary" /> Suivi médical récent</h3>
          <div class="flex-col gap-2">
            <div v-for="ex in recentExams" :key="ex.id" class="p-2 card glass">
              <div class="flex-row justify-between align-center">
                <h4 class="font-bold text-sm">{{ ex.data.intitule }}</h4>
                <span class="badge badge-primary text-xs">{{ ex.data.type_examen }}</span>
              </div>
              <p class="text-xs text-muted mt-1">Le {{ formatToFrenchDate(ex.data.date) }} <span v-if="ex.data.resultat_synthese">• {{ ex.data.resultat_synthese }}</span></p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Pilulier du jour avec saisie rapide de prises et décompte de stock -->
      <div class="medical-alerts-col">
        <!-- Pilulier / Active Treatments Card -->
        <div class="card glass mb-4">
          <div class="flex-row justify-between align-center mb-3">
            <h3 class="font-bold flex-row"><Heart :size="18" class="text-primary" /> Mon pilulier du jour</h3>
            <span class="text-xs text-muted">{{ activeTreatments.length }} médication(s) en cours</span>
          </div>
          
          <div v-if="isLoading" class="text-center py-3">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="activeTreatments.length === 0" class="text-center py-4 text-muted text-sm">
            <p>Aucun traitement ou médication actif.</p>
            <p class="text-xs mt-1">Ajoute tes ordonnances et médicaments dans l'onglet <strong>Pilulier</strong>.</p>
          </div>

          <div v-else class="treatments-pillbox-list flex-col gap-3">
            <div 
              v-for="t in activeTreatments" 
              :key="t.id" 
              class="treatment-pillbox-card card glass p-3 flex-row justify-between align-center flex-wrap gap-3"
            >
              <div class="pill-info flex-1">
                <div class="flex-row align-center gap-2">
                  <h4 class="pill-name font-bold text-sm">{{ t.data.nom_medicament }}</h4>
                  <span 
                    class="badge text-xs"
                    :class="t.data.type_medicament === 'Automédication' ? 'badge-secondary' : 'badge-primary'"
                  >
                    {{ t.data.type_medicament || 'Ordonnance' }}
                  </span>
                  <!-- Stock indicator -->
                  <span 
                    v-if="medicationTelemetry[t.id!]?.stock !== null" 
                    class="badge text-xs flex-row gap-1"
                    :class="(medicationTelemetry[t.id!]?.stock || 0) <= 3 ? 'badge-danger font-bold' : 'badge-neutral'"
                  >
                    <Package :size="11" /> Stock: {{ medicationTelemetry[t.id!]?.stock }}
                  </span>
                </div>

                <p class="pill-poso text-xs text-sub font-bold mt-1">{{ t.data.posologie }}</p>
                
                <!-- Last taken date -->
                <p class="pill-last-intake text-xs text-muted mt-1 flex-row align-center gap-1">
                  <Clock :size="11" /> Dernière prise : 
                  <strong class="text-sub">{{ formatLastIntake(medicationTelemetry[t.id!]?.lastPrise) }}</strong>
                </p>
              </div>

              <!-- Action button: Toggle or Counter depending on posology per day -->
              <div class="pill-intake-control flex-row align-center gap-2">
                <!-- If posologie > 1 / day: Show counter and + button -->
                <div v-if="(medicationTelemetry[t.id!]?.targetPerDay || 1) > 1" class="flex-row align-center gap-2">
                  <div class="intake-counter-box text-center p-1 rounded card glass">
                    <span class="text-xs font-bold block" :class="medicationTelemetry[t.id!]?.todayCount >= medicationTelemetry[t.id!]?.targetPerDay ? 'text-success' : 'text-primary'">
                      {{ medicationTelemetry[t.id!]?.todayCount }} / {{ medicationTelemetry[t.id!]?.targetPerDay }}
                    </span>
                    <span class="text-xxs text-muted">prises auj.</span>
                  </div>
                  
                  <button 
                    @click="openTakeMedicationModal(t)" 
                    class="btn btn-primary btn-sm flex-row gap-1"
                    title="Enregistrer une prise avec motif"
                  >
                    <Plus :size="14" /> 1 prise
                  </button>
                </div>

                <!-- If posologie === 1 / day: Simple toggle/button -->
                <div v-else class="flex-row align-center gap-2">
                  <button 
                    v-if="medicationTelemetry[t.id!]?.todayCount >= 1" 
                    @click="openTakeMedicationModal(t)"
                    class="btn btn-success btn-sm flex-row gap-1"
                    title="Déjà pris aujourd'hui (clique pour ajouter une autre prise)"
                  >
                    <CheckCircle2 :size="14" /> Pris aujourd'hui
                  </button>
                  <button 
                    v-else 
                    @click="openTakeMedicationModal(t)" 
                    class="btn btn-primary btn-sm flex-row gap-1"
                  >
                    <Check :size="14" /> Médicament pris
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section Prises ponctuelles / Pharmacie -->
        <div v-if="ponctualMedications.length > 0" class="card glass mb-4">
          <div class="flex-row justify-between align-center mb-3">
            <h3 class="font-bold flex-row"><Pill :size="18" class="text-secondary" /> Prises ponctuelles (Pharmacie)</h3>
            <span class="text-xs text-muted">{{ ponctualMedications.length }} produit(s)</span>
          </div>

          <div class="treatments-pillbox-list flex-col gap-2">
            <div 
              v-for="t in ponctualMedications" 
              :key="t.id" 
              class="treatment-pillbox-card card glass p-3 flex-row justify-between align-center flex-wrap gap-2"
            >
              <div class="pill-info flex-1">
                <div class="flex-row align-center gap-2">
                  <h4 class="pill-name font-bold text-sm">{{ t.data.nom_medicament }}</h4>
                  <span 
                    v-if="medicationTelemetry[t.id!]?.stock !== null" 
                    class="badge text-xs flex-row gap-1"
                    :class="(medicationTelemetry[t.id!]?.stock || 0) <= 3 ? 'badge-danger font-bold' : 'badge-neutral'"
                  >
                    <Package :size="11" /> Stock: {{ medicationTelemetry[t.id!]?.stock }}
                  </span>
                </div>
                <p class="pill-poso text-xs text-sub mt-1">{{ t.data.posologie }}</p>
                <p v-if="medicationTelemetry[t.id!]?.lastPrise" class="pill-last-intake text-xs text-muted mt-1 flex-row align-center gap-1">
                  <Clock :size="11" /> Dernière prise : <strong class="text-sub">{{ formatLastIntake(medicationTelemetry[t.id!]?.lastPrise) }}</strong>
                </p>
              </div>
              <button 
                @click="openTakeMedicationModal(t)" 
                class="btn btn-secondary btn-sm flex-row align-center gap-1"
                title="Enregistrer une prise ponctuelle"
              >
                <Plus :size="14" /> Enregistrer une prise
              </button>
            </div>
          </div>
        </div>

        <!-- Vaccination reminders -->
        <div class="card glass">
          <h3 class="font-bold flex-row mb-3"><Calendar class="text-sub" :size="18" /> Alertes de vaccination</h3>
          
          <div v-if="isLoading" class="text-center py-3">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="vaccineAlerts.length === 0" class="text-center py-4 text-muted text-sm">
            <p class="flex-row justify-center"><Check class="text-success" :size="16" /> Tous tes vaccins et rappels sont à jour.</p>
          </div>

          <div v-else class="vaccines-alerts-stack flex-col gap-2">
            <div 
              v-for="alert in vaccineAlerts" 
              :key="alert.id" 
              class="vaccine-alert-item card glass p-3 flex-row gap-3"
              :class="alert.isUrgent ? 'border-danger' : 'border-warning'"
            >
              <AlertTriangle class="alert-icon flex-shrink-0 text-warning" :size="18" />
              <div>
                <h4 class="alert-title font-bold text-xs uppercase">{{ alert.type }} <span class="normal-case text-muted" v-if="alert.vaccin">({{ alert.vaccin }})</span></h4>
                <p class="alert-desc text-xs mt-0.5 text-sub">{{ alert.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Take Medication Modal (Commentaire & Prise) -->
    <div v-if="showPriseModal && activeMedForPrise" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3 class="flex-row gap-2">
            <Pill class="text-primary" />
            Enregistrer une prise : {{ activeMedForPrise.data.nom_medicament }}
          </h3>
          <button @click="showPriseModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <p class="text-sub text-sm mb-3">
            Posologie recommandée : <strong>{{ activeMedForPrise.data.posologie }}</strong>
          </p>

          <div class="form-grid">
            <div class="form-group">
              <label>Heure de la prise</label>
              <input v-model="priseTime" type="time" class="input" />
            </div>
            <div class="form-group">
              <label>Quantité / Dose prise</label>
              <input v-model.number="priseQuantity" type="number" min="1" max="10" class="input font-bold" />
            </div>
          </div>

          <div class="form-group mt-3">
            <label>Raison / Cause de la prise (optionnel)</label>
            <input 
              v-model="priseComment" 
              type="text" 
              placeholder="Ex: Maux de tête violents, douleur dos, poussée de fièvre..." 
              class="input" 
            />
            <span class="text-xs text-muted">Ce commentaire permettra d'analyser vos symptômes et d'éclairer les conseils de l'assistant IA.</span>
          </div>
        </div>
        <div class="modal-footer flex-row justify-end gap-2 border-top pt-3 mt-4">
          <button @click="showPriseModal = false" class="btn btn-neutral">Annuler</button>
          <button @click="handleConfirmPrise" class="btn btn-primary">Valider la prise</button>
        </div>
      </div>
    </div>

    <!-- Gemini Assistant Modal -->
    <div v-if="showGeminiModal" class="modal-overlay">
      <div class="modal-container gemini-modal">
        <div class="modal-header">
          <h3 class="flex-row gap-2">
            <Sparkles class="text-primary" />
            {{ geminiMode === 'advice' ? 'Conseil Pharmacologique & Automédication IA' : 'Débrief de Document Médical IA' }}
          </h3>
          <button @click="showGeminiModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <!-- Advice Mode -->
          <div v-if="geminiMode === 'advice'">
            <p class="text-sub text-sm mb-3">
              Pose ta question sur l'automédication (ex: "Puis-je prendre du Doliprane 1000mg avec mon traitement actuel ?"). L'assistant analyse automatiquement tes ordonnances en cours et tes dernières prises enregistrées.
            </p>
            <div class="form-group">
              <label>Ta question ou ton symptôme :</label>
              <div class="flex-row gap-2">
                <input 
                  v-model="geminiQuery" 
                  type="text" 
                  placeholder="Ex: J'ai un gros mal de tête, quel dosage puis-je prendre ?" 
                  class="input flex-1"
                  @keyup.enter="handleRunGemini"
                />
                <button @click="handleRunGemini" class="btn btn-primary flex-row gap-1" :disabled="geminiLoading">
                  <Send :size="15" /> Analyser
                </button>
              </div>
            </div>
          </div>

          <!-- Document Mode -->
          <div v-else>
            <p class="text-sub text-sm mb-3">
              Copie-colle le texte d'un compte-rendu médical (ordonnance, prise de sang, scanner, IRM) pour que Gemini t'explique les conclusions en langage clair.
            </p>
            <div class="form-group">
              <label>Texte du document médical :</label>
              <textarea 
                v-model="geminiDocumentText" 
                rows="6" 
                placeholder="Ex: Conclusion IRM : discopathie L4-L5 avec protrusion sans conflit radiculaire..." 
                class="input"
              ></textarea>
              <button @click="handleRunGemini" class="btn btn-primary mt-2 flex-row gap-1" :disabled="geminiLoading">
                <FileText :size="15" /> Décrypter ce document
              </button>
            </div>
          </div>

          <!-- Spinner during API call -->
          <div v-if="geminiLoading" class="text-center py-4">
            <div class="mini-spinner mx-auto mb-2"></div>
            <p class="text-xs text-sub">Analyse médicale en cours avec Gemini...</p>
          </div>

          <!-- Gemini Result Box -->
          <div v-if="geminiResponse" class="gemini-response-box mt-4 p-3 rounded card glass">
            <h4 class="font-bold text-xs uppercase text-primary mb-2 flex-row gap-1">
              <Sparkles :size="13" /> Analyse & Recommandations
            </h4>
            <div class="gemini-markdown-output text-sm leading-relaxed whitespace-pre-line">
              {{ geminiResponse }}
            </div>
          </div>
        </div>
        <div class="modal-footer flex-row justify-end border-top pt-3 mt-4">
          <button @click="showGeminiModal = false" class="btn btn-neutral">Fermer</button>
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
  border-color: color-mix(in srgb, var(--color-accent) 30%, transparent) !important;
  background-color: color-mix(in srgb, var(--color-accent) 1%, transparent) !important;
}

.icon-alert-pulse {
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); filter: drop-shadow(0 0 4px color-mix(in srgb, var(--color-accent) 40%, transparent)); }
  100% { transform: scale(1); }
}

.emergency-blood-box {
  background-color: color-mix(in srgb, var(--color-accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent) 15%, transparent);
  border-radius: var(--radius-sm);
}

.text-xxs {
  font-size: 0.65rem;
}

.intake-counter-box {
  min-width: 65px;
  border: 1px solid var(--color-border);
}

.gemini-modal {
  max-width: 650px;
}

.gemini-response-box {
  border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
  background: color-mix(in srgb, var(--color-primary) 5%, transparent);
}
</style>
