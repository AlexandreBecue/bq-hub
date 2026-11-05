<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, generateId, type RecordEntry } from '../db/index';
import { 
  RDVS_COL_ID, 
  EXAMENS_COL_ID,
  SUGGESTIONS_COL_ID,
  getRdvsRecords, 
  getExamensRecords,
  formatToFrenchDate 
} from '../db/queries';
import { getGoogleCalendarUrl, downloadIcsFile } from '../services/calendar';
import { 
  Plus, Calendar, ShieldCheck, X, Clock, Edit2, Trash2, 
  Activity, Download
} from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const emit = defineEmits(['data-updated']);
const toast = useToast();

const activeSubTab = ref<'rdvs' | 'suivi'>('rdvs');

// RDVS State
const rdvs = ref<RecordEntry[]>([]);
const examens = ref<RecordEntry[]>([]);
const isLoading = ref(true);

const showAddRdvModal = ref(false);
const editingRdvId = ref<string | null>(null);

const formRdv = ref({
  date: new Date().toISOString().split('T')[0],
  heure: '',
  praticien: '',
  specialite: 'Généraliste',
  motif: '',
  prix: '',
  notes: ''
});

const specialitiesList = [
  "Généraliste", "Dentiste", "Ophtalmologue", "Dermatologue", 
  "Kinesithérapeute", "Ostéopathe", "Cardiologue", "Gynécologue", 
  "ORL", "Pédiatre", "Psychiatre / Psychologue", "Autre Spécialiste"
];

// EXAMENS State
const showAddExamenModal = ref(false);
const editingExamenId = ref<string | null>(null);

const examTypesList = [
  "Bilan sanguin", "Scanner", "IRM", "Radiographie", 
  "Échographie", "Opération chirurgicale", "Examen gynécologique", 
  "Mammographie", "Dentaire", "Coloscopie / Endoscopie", "Autre examen"
];

const formExamen = ref({
  date: new Date().toISOString().split('T')[0],
  type_examen: 'Bilan sanguin',
  intitule: '',
  etablissement: '',
  medecin: '',
  resultat_synthese: 'Normal',
  commentaire: ''
});

const loadData = async () => {
  isLoading.value = true;
  try {
    rdvs.value = await getRdvsRecords();
    examens.value = await getExamensRecords();
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Separate upcoming appointments and past consultations
const sortedAppointments = computed(() => {
  const nowStr = new Date().toISOString().split('T')[0];
  
  const upcoming = rdvs.value
    .filter(r => (r.data.date || '') >= nowStr)
    .sort((a, b) => String(a.data.date).localeCompare(String(b.data.date)));
    
  const past = rdvs.value
    .filter(r => (r.data.date || '') < nowStr);
    
  return {
    upcoming,
    past
  };
});

// Sorted exams (most recent first)
const sortedExamens = computed(() => {
  return [...examens.value].sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
});

/* RDV Handlers */
const openAddRdvModal = () => {
  editingRdvId.value = null;
  formRdv.value = {
    date: new Date().toISOString().split('T')[0],
    heure: '',
    praticien: '',
    specialite: 'Généraliste',
    motif: '',
    prix: '',
    notes: ''
  };
  showAddRdvModal.value = true;
};

const openEditRdv = (r: RecordEntry) => {
  editingRdvId.value = r.id || null;
  formRdv.value = {
    date: r.data.date || new Date().toISOString().split('T')[0],
    heure: r.data.heure || '',
    praticien: r.data.praticien || '',
    specialite: r.data.specialite || 'Généraliste',
    motif: r.data.motif || '',
    prix: r.data.prix ? String(r.data.prix) : '',
    notes: r.data.notes || ''
  };
  showAddRdvModal.value = true;
};

const handleSaveRdv = async () => {
  const doc = formRdv.value.praticien.trim();
  if (!doc) {
    toast.warning('Veuillez saisir le nom du praticien.');
    return;
  }

  try {
    const p = Number(formRdv.value.prix) || 0;
    const dataPayload = {
      date: formRdv.value.date,
      heure: formRdv.value.heure.trim(),
      praticien: doc,
      specialite: formRdv.value.specialite,
      motif: formRdv.value.motif.trim(),
      prix: p || null,
      notes: formRdv.value.notes.trim()
    };

    if (editingRdvId.value) {
      await db.records.update(editingRdvId.value, {
        data: dataPayload,
        updatedAt: Date.now()
      });
      toast.success('Rendez-vous modifié avec succès !');
    } else {
      const newRecord: RecordEntry = {
        id: `rec-${generateId()}`,
        collectionId: RDVS_COL_ID,
        data: dataPayload,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.records.add(newRecord);
      toast.success('Rendez-vous enregistré !');

      if (p > 0) {
        try {
          const sugRecord: RecordEntry = {
            id: `rec-${generateId()}`,
            collectionId: SUGGESTIONS_COL_ID,
            data: {
              source_app: 'bq-health',
              action: 'Nouvelle Dépense',
              payload: JSON.stringify({
                date: formRdv.value.date,
                montant: p,
                partenaire: `Docteur ${doc} (${formRdv.value.specialite})`,
                commentaire: `Consultation médicale : ${formRdv.value.motif.trim() || formRdv.value.specialite}`,
                budget: 'Santé'
              }),
              status: 'pending'
            },
            createdAt: Date.now() + 5,
            updatedAt: Date.now() + 5
          };
          await db.records.add(sugRecord);
        } catch (errSug) {
          console.error('Failed to write suggestion to bq-bank:', errSug);
        }
      }
    }

    showAddRdvModal.value = false;
    editingRdvId.value = null;
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

const handleDeleteRdv = async (id: string) => {
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    emit('data-updated');
    loadData();
    toast.success('Rendez-vous supprimé.');
  } catch (err) {
    console.error(err);
  }
};

const handleAddRdvToGoogleCalendar = (r: RecordEntry) => {
  const url = getGoogleCalendarUrl({
    title: `RDV Dr ${r.data.praticien} (${r.data.specialite})`,
    startDate: r.data.date,
    startTime: r.data.heure || '09:00',
    durationMinutes: 45,
    details: `${r.data.motif ? `Motif : ${r.data.motif}\n` : ''}${r.data.notes ? `Notes : ${r.data.notes}` : ''}`,
    location: `Cabinet Dr ${r.data.praticien}`
  });
  window.open(url, '_blank');
};

const handleDownloadRdvIcs = (r: RecordEntry) => {
  downloadIcsFile({
    title: `RDV Dr ${r.data.praticien} (${r.data.specialite})`,
    startDate: r.data.date,
    startTime: r.data.heure || '09:00',
    durationMinutes: 45,
    details: `${r.data.motif ? `Motif : ${r.data.motif}\n` : ''}${r.data.notes ? `Notes : ${r.data.notes}` : ''}`
  }, `rdv-${r.data.praticien.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
};

/* EXAMENS Handlers */
const openAddExamenModal = () => {
  editingExamenId.value = null;
  formExamen.value = {
    date: new Date().toISOString().split('T')[0],
    type_examen: 'Bilan sanguin',
    intitule: '',
    etablissement: '',
    medecin: '',
    resultat_synthese: 'Normal',
    commentaire: ''
  };
  showAddExamenModal.value = true;
};

const openEditExamen = (ex: RecordEntry) => {
  editingExamenId.value = ex.id || null;
  formExamen.value = {
    date: ex.data.date || new Date().toISOString().split('T')[0],
    type_examen: ex.data.type_examen || 'Bilan sanguin',
    intitule: ex.data.intitule || '',
    etablissement: ex.data.etablissement || '',
    medecin: ex.data.medecin || '',
    resultat_synthese: ex.data.resultat_synthese || 'Normal',
    commentaire: ex.data.commentaire || ''
  };
  showAddExamenModal.value = true;
};

const handleSaveExamen = async () => {
  if (!formExamen.value.intitule.trim()) {
    toast.warning('Veuillez renseigner un intitulé pour cet examen ou cette intervention.');
    return;
  }

  try {
    const dataPayload = {
      date: formExamen.value.date,
      type_examen: formExamen.value.type_examen,
      intitule: formExamen.value.intitule.trim(),
      etablissement: formExamen.value.etablissement.trim(),
      medecin: formExamen.value.medecin.trim(),
      resultat_synthese: formExamen.value.resultat_synthese,
      commentaire: formExamen.value.commentaire.trim()
    };

    if (editingExamenId.value) {
      await db.records.update(editingExamenId.value, {
        data: dataPayload,
        updatedAt: Date.now()
      });
      toast.success('Examen médical modifié avec succès !');
    } else {
      const newRecord: RecordEntry = {
        id: `rec-${generateId()}`,
        collectionId: EXAMENS_COL_ID,
        data: dataPayload,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.records.add(newRecord);
      toast.success('Examen ajouté à votre suivi médical !');
    }

    showAddExamenModal.value = false;
    editingExamenId.value = null;
    emit('data-updated');
    loadData();
  } catch (err) {
    console.error(err);
  }
};

const handleDeleteExamen = async (id: string) => {
  try {
    await db.records.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now()
    });
    emit('data-updated');
    loadData();
    toast.success('Examen supprimé du suivi.');
  } catch (err) {
    console.error(err);
  }
};

const handleAddExamenToCalendar = (ex: RecordEntry) => {
  const url = getGoogleCalendarUrl({
    title: `Examen : ${ex.data.intitule} (${ex.data.type_examen})`,
    startDate: ex.data.date,
    startTime: '08:30',
    durationMinutes: 60,
    details: `${ex.data.etablissement ? `Établissement : ${ex.data.etablissement}\n` : ''}${ex.data.medecin ? `Médecin : ${ex.data.medecin}\n` : ''}${ex.data.commentaire ? `Commentaire : ${ex.data.commentaire}` : ''}`,
    location: ex.data.etablissement || ''
  });
  window.open(url, '_blank');
};
</script>

<template>
  <div class="rdv-view">
    <div class="view-header flex-row justify-between align-center flex-wrap gap-3">
      <div>
        <h2>Consultations & examens</h2>
        <p class="text-sub">Planifie tes rendez-vous médicaux et conserve un suivi exhaustif de tes bilans, opérations, scanners et imageries.</p>
      </div>
      <div class="view-actions flex-row gap-2">
        <button v-if="activeSubTab === 'rdvs'" @click="openAddRdvModal" class="btn btn-primary">
          <Plus :size="18" /> Nouveau RDV
        </button>
        <button v-else @click="openAddExamenModal" class="btn btn-primary">
          <Plus :size="18" /> Nouvel examen / opération
        </button>
      </div>
    </div>

    <!-- Navigation Sub-Tabs -->
    <div class="sub-tabs-row flex-row gap-2 mb-4">
      <button 
        class="sub-tab-btn" 
        :class="{ active: activeSubTab === 'rdvs' }"
        @click="activeSubTab = 'rdvs'"
      >
        <Calendar :size="15" />
        Agenda des consultations ({{ rdvs.length }})
      </button>
      <button 
        class="sub-tab-btn" 
        :class="{ active: activeSubTab === 'suivi' }"
        @click="activeSubTab = 'suivi'"
      >
        <Activity :size="15" />
        Suivi médical & examens ({{ examens.length }})
      </button>
    </div>

    <!-- TAB 1: RDVS & CONSULTATIONS -->
    <div v-if="activeSubTab === 'rdvs'" class="rdvs-dashboard-grid">
      <!-- Left Column: Upcoming Appointments -->
      <div class="upcoming-rdvs-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><Clock :size="18" class="text-primary" /> Rendez-vous à venir</h3>

          <div v-if="isLoading" class="text-center py-4">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="sortedAppointments.upcoming.length === 0" class="text-center py-4 text-muted text-sm">
            <p>Aucun rendez-vous futur planifié.</p>
            <button @click="openAddRdvModal" class="btn btn-primary btn-sm mt-3">+ Prendre un RDV</button>
          </div>

          <div v-else class="rdv-list-stack">
            <div v-for="r in sortedAppointments.upcoming" :key="r.id" class="rdv-card-item card glass hoverable">
              <div class="rdv-card-header flex-row justify-between align-start">
                <div>
                  <h4 class="font-bold text-sm">Dr {{ r.data.praticien }}</h4>
                  <span class="badge badge-primary text-xs mt-1">{{ r.data.specialite }}</span>
                </div>
                <span class="badge badge-success text-xs font-bold flex-row gap-1">
                  <Calendar :size="12" /> {{ formatToFrenchDate(r.data.date) }} 
                  <span v-if="r.data.heure">à {{ r.data.heure }}</span>
                </span>
              </div>

              <div class="rdv-card-body text-sm text-sub mt-3">
                <p v-if="r.data.motif"><strong>Motif :</strong> {{ r.data.motif }}</p>
                <p class="italic text-xs text-muted mt-2" v-if="r.data.notes">{{ r.data.notes }}</p>
              </div>

              <div class="rdv-card-footer flex-row justify-between align-center border-top pt-2 mt-3 flex-wrap gap-2">
                <div class="flex-row align-center gap-2">
                  <span class="text-warning text-xs font-bold" v-if="r.data.prix">{{ r.data.prix }} €</span>
                  <span class="text-xs text-muted" v-else>Tarif non renseigné</span>
                </div>
                
                <div class="flex-row gap-1">
                  <!-- Google Calendar & ICS Buttons -->
                  <button @click="handleAddRdvToGoogleCalendar(r)" class="action-btn" title="Ajouter à Google Agenda">
                    <Calendar :size="14" />
                  </button>
                  <button @click="handleDownloadRdvIcs(r)" class="action-btn" title="Télécharger fichier .ics">
                    <Download :size="14" />
                  </button>
                  <button @click="openEditRdv(r)" class="action-btn edit" title="Modifier">
                    <Edit2 :size="14" />
                  </button>
                  <button @click="handleDeleteRdv(r.id!)" class="action-btn delete" title="Supprimer">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Past consultations -->
      <div class="past-rdvs-col">
        <div class="card glass">
          <h3 class="font-bold flex-row mb-4"><ShieldCheck :size="18" class="text-sub" /> Consultations passées</h3>
          
          <div v-if="isLoading" class="text-center py-4">
            <div class="mini-spinner"></div>
          </div>

          <div v-else-if="sortedAppointments.past.length === 0" class="text-center py-4 text-muted text-sm">
            <p>Aucun historique de consultations passées.</p>
          </div>

          <div v-else class="rdv-list-stack">
            <div v-for="r in sortedAppointments.past" :key="r.id" class="rdv-card-item card glass hoverable past-item">
              <div class="rdv-card-header flex-row justify-between">
                <div>
                  <h4 class="font-bold text-sm">Dr {{ r.data.praticien }}</h4>
                  <span class="badge badge-neutral text-xs mt-1">{{ r.data.specialite }}</span>
                </div>
                <span class="badge badge-neutral text-xs flex-row gap-1">
                  <Calendar :size="12" /> Le {{ formatToFrenchDate(r.data.date) }}
                </span>
              </div>
              
              <div class="rdv-card-body text-sm text-sub mt-3">
                <p v-if="r.data.motif"><strong>Motif :</strong> {{ r.data.motif }}</p>
                <p class="italic text-xs text-muted mt-2" v-if="r.data.notes">{{ r.data.notes }}</p>
              </div>

              <div class="rdv-card-footer flex-row justify-between border-top pt-2 mt-3">
                <span class="text-warning text-xs font-bold" v-if="r.data.prix">{{ r.data.prix }} €</span>
                <span class="text-xs text-muted" v-else>Gratuit / Remboursé</span>
                <div class="flex-row gap-1">
                  <button @click="openEditRdv(r)" class="action-btn edit" title="Modifier">
                    <Edit2 :size="13" />
                  </button>
                  <button @click="handleDeleteRdv(r.id!)" class="action-btn delete" title="Supprimer">
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: SUIVI MÉDICAL & EXAMENS (Bilans, Opérations, IRM, Scanners...) -->
    <div v-else class="suivi-medical-container">
      <div class="card glass mb-4">
        <div class="flex-row justify-between align-center mb-4 flex-wrap gap-2">
          <h3 class="font-bold flex-row"><Activity :size="18" class="text-primary" /> Dossier de suivi médical & examens</h3>
          <button @click="openAddExamenModal" class="btn btn-primary btn-sm">+ Ajouter un examen</button>
        </div>

        <div v-if="isLoading" class="text-center py-4">
          <div class="mini-spinner"></div>
        </div>

        <div v-else-if="sortedExamens.length === 0" class="text-center py-4 text-muted text-sm">
          <p>Aucun examen, bilan sanguin, scanner ou opération enregistré pour le moment.</p>
          <button @click="openAddExamenModal" class="btn btn-primary btn-sm mt-3">Enregistrer mon premier examen</button>
        </div>

        <div v-else class="examens-grid">
          <div v-for="ex in sortedExamens" :key="ex.id" class="card glass hoverable examen-card">
            <div class="ex-header flex-row justify-between align-start gap-2">
              <div>
                <span class="badge badge-primary text-xs font-bold">{{ ex.data.type_examen }}</span>
                <h4 class="font-black text-md mt-1">{{ ex.data.intitule }}</h4>
                <p class="text-xs text-muted mt-0.5">
                  Le {{ formatToFrenchDate(ex.data.date) }}
                  <span v-if="ex.data.etablissement"> • {{ ex.data.etablissement }}</span>
                  <span v-if="ex.data.medecin"> • Dr {{ ex.data.medecin }}</span>
                </p>
              </div>

              <div class="flex-row gap-1">
                <button @click="handleAddExamenToCalendar(ex)" class="action-btn" title="Ajouter à Google Agenda">
                  <Calendar :size="14" />
                </button>
                <button @click="openEditExamen(ex)" class="action-btn edit" title="Modifier">
                  <Edit2 :size="14" />
                </button>
                <button @click="handleDeleteExamen(ex.id!)" class="action-btn delete" title="Supprimer">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <div class="ex-body mt-3">
              <div v-if="ex.data.resultat_synthese" class="mb-2">
                <span class="text-xs text-muted uppercase font-bold mr-1">Résultat :</span>
                <span class="badge" :class="ex.data.resultat_synthese === 'Normal' ? 'badge-success' : 'badge-warning'">
                  {{ ex.data.resultat_synthese }}
                </span>
              </div>

              <div v-if="ex.data.commentaire" class="ex-comment text-sm text-sub p-2 rounded card glass">
                <p class="text-xs leading-relaxed">{{ ex.data.commentaire }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Saisie RDV Modal -->
    <div v-if="showAddRdvModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ editingRdvId ? 'Modifier la consultation médicale' : 'Planifier un rendez-vous médical' }}</h3>
          <button @click="showAddRdvModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Date du RDV *</label>
              <input v-model="formRdv.date" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>Heure du RDV</label>
              <input v-model="formRdv.heure" type="time" class="input" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Nom du Médecin / Praticien *</label>
              <input v-model="formRdv.praticien" type="text" placeholder="Ex: Martin, Dupont..." class="input" />
            </div>
            <div class="form-group">
              <label>Spécialité *</label>
              <select v-model="formRdv.specialite" class="select">
                <option v-for="s in specialitiesList" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Motif de la consultation</label>
              <input v-model="formRdv.motif" type="text" placeholder="Ex: Contrôle annuel, douleur genou..." class="input" />
            </div>
            <div class="form-group">
              <label>Tarif estimé (€)</label>
              <input v-model="formRdv.prix" type="number" step="0.5" placeholder="Ex: 26.50" class="input" />
            </div>
          </div>

          <div class="form-group">
            <label>Notes & recommandations</label>
            <textarea v-model="formRdv.notes" rows="3" placeholder="Ex: Apporter les derniers résultats d'analyse..." class="input"></textarea>
          </div>
        </div>
        <div class="modal-footer flex-row justify-end gap-2 border-top pt-3 mt-4">
          <button @click="showAddRdvModal = false" class="btn btn-neutral">Annuler</button>
          <button @click="handleSaveRdv" class="btn btn-primary">
            {{ editingRdvId ? 'Enregistrer les modifications' : 'Enregistrer le RDV' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Saisie / Modification EXAMEN Modal -->
    <div v-if="showAddExamenModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3 class="flex-row gap-2">
            <Activity class="text-primary" />
            {{ editingExamenId ? 'Modifier l\'examen ou l\'intervention' : 'Ajouter un suivi médical (Examen / Opération)' }}
          </h3>
          <button @click="showAddExamenModal = false" class="modal-close"><X :size="20" /></button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Date de l'examen *</label>
              <input v-model="formExamen.date" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>Type d'examen / intervention *</label>
              <select v-model="formExamen.type_examen" class="select">
                <option v-for="exType in examTypesList" :key="exType" :value="exType">{{ exType }}</option>
              </select>
            </div>
          </div>

          <div class="form-group mb-3">
            <label>Intitulé de l'examen *</label>
            <input v-model="formExamen.intitule" type="text" placeholder="Ex: IRM cérébrale, Mammographie de dépistage, Bilan sanguin lipidique..." class="input font-bold" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Centre / Établissement médical</label>
              <input v-model="formExamen.etablissement" type="text" placeholder="Ex: Centre d'imagerie Pasteur, Hôpital Nord..." class="input" />
            </div>
            <div class="form-group">
              <label>Médecin / Radiologue référent</label>
              <input v-model="formExamen.medecin" type="text" placeholder="Ex: Dr Bernard" class="input" />
            </div>
          </div>

          <div class="form-group mb-3">
            <label>Synthèse / Résultat global</label>
            <select v-model="formExamen.resultat_synthese" class="select">
              <option value="Normal">Normal / Rassurant</option>
              <option value="Favorable">Favorable / Amélioration</option>
              <option value="À surveiller">À surveiller / Contrôle recommandé</option>
              <option value="Anormal">Anomalie constatée</option>
              <option value="En attente des résultats">En attente des résultats</option>
            </select>
          </div>

          <div class="form-group">
            <label>Commentaire & Compte-rendu détaillé (optionnel)</label>
            <textarea v-model="formExamen.commentaire" rows="4" placeholder="Ex: Absence de lésion visible. Prochain contrôle dans 2 ans si symptômes..." class="input"></textarea>
          </div>
        </div>
        <div class="modal-footer flex-row justify-end gap-2 border-top pt-3 mt-4">
          <button @click="showAddExamenModal = false" class="btn btn-neutral">Annuler</button>
          <button @click="handleSaveExamen" class="btn btn-primary">
            {{ editingExamenId ? 'Enregistrer les modifications' : 'Enregistrer dans mon dossier' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sub-tabs-row {
  display: flex;
  overflow-x: auto;
}

.sub-tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md, 8px);
  background: color-mix(in srgb, var(--color-border) 40%, transparent);
  border: 1px solid var(--color-border);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    color: var(--text-primary);
  }

  &.active {
    background: var(--color-primary);
    color: var(--color-primary-contrast, #fff);
    border-color: var(--color-primary);
  }
}

.rdvs-dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 900px) {
  .rdvs-dashboard-grid {
    grid-template-columns: 1.2fr 1fr;
  }
}

.rdv-list-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rdv-card-item {
  padding: 1.25rem;
  &.past-item {
    opacity: 0.85;
  }
}

.examens-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.examen-card {
  padding: 1.25rem;
}
</style>
