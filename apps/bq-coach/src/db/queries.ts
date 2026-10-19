import { db, generateId, type RecordEntry, type CollectionSchema } from './index';
import { 
  DEFAULT_EXERCISES, 
  DEFAULT_WORKOUTS, 
  DEFAULT_TEMPLATES 
} from './defaultData';
import type { 
  DayWorkout, 
  Exercise, 
  CardioWorkout, 
  CircuitExercise, 
  FinisherExercise 
} from '../types';

export const COACH_PROGRAMME_COL_ID = 'col-p4k1m8v2s';
export const COACH_TEMPLATES_COL_ID = 'col-t7y3q9z1f';
export const COACH_SPORTS_COL_ID = 'col-s8d2m4k7v';
export const SPORT_SEANCES_COL_ID = 'col-ejieq9cvm';
export const SPORT_EXERCICES_COL_ID = 'col-g87w9bmlw';
export const SPORT_CARDIO_COL_ID = 'col-c686fcnxs';

export const DAYS_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const exercisesCatalogue: Exercise[] = DEFAULT_EXERCISES;
export const exercisesMap: Record<string, Exercise> = Object.fromEntries(
  exercisesCatalogue.map(e => [e.id, e])
);

/**
 * Ensures all required collections exist and initializes default schedule & templates if empty.
 */
export async function initializeCollections() {
  const collectionsToEnsure: CollectionSchema[] = [
    {
      id: COACH_PROGRAMME_COL_ID,
      name: 'bq-coach - programme',
      description: 'Programme hebdomadaire des entraînements (Lundi à Dimanche)',
      fields: [
        { id: 'f_jour_id', name: 'Jour ID', key: 'jour_id', type: 'number', required: true },
        { id: 'f_jour_nom', name: 'Jour', key: 'jour_nom', type: 'text', required: true },
        { id: 'f_type', name: 'Type', key: 'type', type: 'select', required: true, options: ['Renfo', 'Cardio', 'Hybride', 'Repos'] },
        { id: 'f_titre', name: 'Titre', key: 'titre', type: 'text', required: false },
        { id: 'f_details', name: 'Détails JSON', key: 'details_json', type: 'text', required: true }
      ],
      primaryFieldKey: 'jour_id',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: COACH_TEMPLATES_COL_ID,
      name: 'bq-coach - templates',
      description: 'Modèles de séances réutilisables (Renfo, Cardio, Hybride, Repos)',
      fields: [
        { id: 'f_tmpl_nom', name: 'Nom de la séance', key: 'nom', type: 'text', required: true },
        { id: 'f_tmpl_type', name: 'Type', key: 'type', type: 'select', required: true, options: ['Renfo', 'Cardio', 'Hybride', 'Repos'] },
        { id: 'f_tmpl_desc', name: 'Description', key: 'description', type: 'text', required: false },
        { id: 'f_tmpl_details', name: 'Détails JSON', key: 'details_json', type: 'text', required: true }
      ],
      primaryFieldKey: 'nom',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: COACH_SPORTS_COL_ID,
      name: 'bq-coach - sports',
      description: 'Sports personnalisables pour le suivi cardio',
      fields: [
        { id: 'fld-spnom', name: 'Nom du sport', key: 'nom', type: 'text', required: true },
        { id: 'fld-spicon', name: 'Icône', key: 'icone', type: 'text', required: false },
        { id: 'fld-spdist', name: 'Unité par défaut', key: 'unite_distance', type: 'select', required: true, options: ['km', 'm'] },
        { id: 'fld-spact', name: 'Actif', key: 'actif', type: 'boolean', required: true }
      ],
      primaryFieldKey: 'nom',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: SPORT_SEANCES_COL_ID,
      name: 'bq-coach - séances renfo',
      description: 'Suivi global des séances de renforcement',
      fields: [
        { id: 'x9mes1tnp', name: 'Date', key: 'date', type: 'date', required: true },
        { id: 'tvephep5a', name: 'Nom', key: 'nom', type: 'text', required: true },
        { id: 'hru8yerca', name: 'Durée', key: 'duree', type: 'text', required: true },
        { id: '1pprvlksy', name: 'Programme', key: 'programme', type: 'text', required: false }
      ],
      primaryFieldKey: 'date',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: SPORT_EXERCICES_COL_ID,
      name: 'bq-coach - exercices renfo',
      description: 'Télémétrie et performance de chaque exercice',
      fields: [
        { id: '2d07nqp8k', name: 'Date', key: 'date', type: 'date', required: true },
        { id: '9q0iup0f9', name: 'Exercice', key: 'exercice', type: 'text', required: true },
        { id: 's25ugscd9', name: 'Phase', key: 'phase', type: 'select', required: true, options: ['Échauffement', 'Circuit', 'Finisseur'] },
        { id: 'szf7nj7co', name: 'Séries', key: 'series', type: 'number', required: true },
        { id: 'ctfe4fb5b', name: 'Travail', key: 'travail', type: 'number', required: true, unit: 's' },
        { id: '93azd5ih4', name: 'Repos', key: 'repos', type: 'number', required: true, unit: 's' }
      ],
      primaryFieldKey: 'date',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: SPORT_CARDIO_COL_ID,
      name: 'bq-coach - séances cardio',
      description: 'Course à pied - Cyclisme - Natation',
      fields: [
        { id: 'zdjcw2yvg', name: 'Date', key: 'date', type: 'date', required: true },
        { id: '8dfdrlp2n', name: 'Sport', key: 'sport', type: 'select', required: true, options: ['Course à pied', 'Cyclisme', 'Natation'] },
        { id: 'rxuakmgz7', name: 'Distance', key: 'distance', type: 'number', required: true, unit: 'km' },
        { id: '4goqyrci2', name: 'Temps', key: 'temps', type: 'text', required: true },
        { id: 'f_comm', name: 'Commentaire', key: 'commentaire', type: 'text', required: false }
      ],
      primaryFieldKey: 'date',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  for (const col of collectionsToEnsure) {
    const existing = await db.collections.get(col.id);
    if (!existing) {
      await db.collections.put(col);
    }
  }

  // Seed default sports if collection is empty
  const sportsCount = await db.records.where('collectionId').equals(COACH_SPORTS_COL_ID).count();
  if (sportsCount === 0) {
    await db.records.bulkAdd([
      {
        id: `rec-${generateId()}`,
        collectionId: COACH_SPORTS_COL_ID,
        data: { nom: 'Course à pied', icone: 'running', unite_distance: 'km', actif: true },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: `rec-${generateId()}`,
        collectionId: COACH_SPORTS_COL_ID,
        data: { nom: 'Cyclisme', icone: 'cycling', unite_distance: 'km', actif: true },
        createdAt: Date.now() + 1,
        updatedAt: Date.now() + 1
      },
      {
        id: `rec-${generateId()}`,
        collectionId: COACH_SPORTS_COL_ID,
        data: { nom: 'Natation', icone: 'swimming', unite_distance: 'm', actif: true },
        createdAt: Date.now() + 2,
        updatedAt: Date.now() + 2
      }
    ]);
  }
}

/**
 * Returns available sports from bq-coach - sports collection
 */
export async function getCardioSports(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(COACH_SPORTS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt && r.data.actif !== false);
}

/**
 * Seeds default workout templates into the library.
 */
export async function seedDefaultTemplates() {
  const records: RecordEntry[] = DEFAULT_TEMPLATES.map(t => ({
    id: t.id,
    collectionId: COACH_TEMPLATES_COL_ID,
    data: {
      nom: t.nom,
      type: t.type,
      description: t.description,
      details_json: JSON.stringify(t.workout)
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  }));

  await db.records.bulkPut(records);
}

/**
 * Returns all workout templates from the library.
 */
export async function getWorkoutTemplates(): Promise<RecordEntry[]> {
  const records = await db.records.where('collectionId').equals(COACH_TEMPLATES_COL_ID).toArray();
  return records.filter(r => !r.deletedAt);
}

/**
 * Saves (create or update) a workout template in the library.
 */
export async function saveWorkoutTemplate(template: {
  id?: string;
  nom: string;
  type: string;
  description?: string;
  workout: DayWorkout;
}): Promise<RecordEntry> {
  const recordId = template.id || `tmpl-${generateId()}`;
  const record: RecordEntry = {
    id: recordId,
    collectionId: COACH_TEMPLATES_COL_ID,
    data: {
      nom: template.nom,
      type: template.type,
      description: template.description || '',
      details_json: JSON.stringify(template.workout)
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await db.records.put(record);
  return record;
}

/**
 * Soft deletes a workout template.
 */
export async function deleteWorkoutTemplate(templateId: string): Promise<void> {
  await db.records.update(templateId, {
    deletedAt: Date.now(),
    updatedAt: Date.now()
  });
}

/**
 * Populates the default 7-day schedule from DEFAULT_WORKOUTS
 */
export async function seedDefaultWeeklyProgramme() {
  const daysOrder = [1, 2, 3, 4, 5, 6, 0]; // Lundi to Dimanche
  const rawWorkouts = DEFAULT_WORKOUTS;

  for (const dayId of daysOrder) {
    const workoutData = rawWorkouts[String(dayId)] || { type: 'rest' };
    const dayName = DAYS_NAMES[dayId];
    let title = '';
    if (workoutData.strength?.title) title = workoutData.strength.title;
    else if (workoutData.cardio?.title) title = workoutData.cardio.title;

    let typeLabel = 'Repos';
    if (workoutData.type === 'strength') typeLabel = 'Renfo';
    else if (workoutData.type === 'cardio') typeLabel = 'Cardio';
    else if (workoutData.type === 'hybrid') typeLabel = 'Hybride';

    const record: RecordEntry = {
      id: `coach-day-${dayId}`,
      collectionId: COACH_PROGRAMME_COL_ID,
      data: {
        jour_id: dayId,
        jour_nom: dayName,
        type: typeLabel,
        titre: title,
        details_json: JSON.stringify(workoutData)
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.records.put(record);
  }
}

/**
 * Returns the 7-day programme mapped by day ID (0 to 6).
 */
export async function getWeeklyProgramme(): Promise<Record<number, DayWorkout>> {
  const records = await db.records.where('collectionId').equals(COACH_PROGRAMME_COL_ID).toArray();
  const programme: Record<number, DayWorkout> = {};

  // Initialize with rest defaults
  for (let i = 0; i <= 6; i++) {
    programme[i] = { type: 'rest' };
  }

  for (const rec of records) {
    if (rec.deletedAt) continue;
    const dayId = Number(rec.data.jour_id);
    if (!isNaN(dayId) && rec.data.details_json) {
      try {
        programme[dayId] = JSON.parse(rec.data.details_json) as DayWorkout;
      } catch (e) {
        console.error(`Erreur de parsing JSON pour le jour ${dayId}:`, e);
      }
    }
  }

  return programme;
}

/**
 * Saves a day's workout configuration.
 */
export async function saveDayWorkout(dayId: number, workout: DayWorkout) {
  let title = '';
  if (workout.strength?.title) title = workout.strength.title;
  else if (workout.cardio?.title) title = workout.cardio.title;

  let typeLabel = 'Repos';
  if (workout.type === 'strength') typeLabel = 'Renfo';
  else if (workout.type === 'cardio') typeLabel = 'Cardio';
  else if (workout.type === 'hybrid') typeLabel = 'Hybride';

  const dayName = DAYS_NAMES[dayId];
  const recordId = `coach-day-${dayId}`;

  const record: RecordEntry = {
    id: recordId,
    collectionId: COACH_PROGRAMME_COL_ID,
    data: {
      jour_id: dayId,
      jour_nom: dayName,
      type: typeLabel,
      titre: title,
      details_json: JSON.stringify(workout)
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await db.records.put(record);
}

/**
 * Formats seconds into HH:MM:SS
 */
export function formatHHMMSS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Formats seconds into MM:SS
 */
export function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Logs a completed strength session into bq-metrics collections:
 * 1. Sport - Renforcement musculaire - Séances (overview)
 * 2. Sport - Renforcement musculaire - Exercices (telemetry per exercise)
 */
export async function logCompletedStrengthWorkout(
  workoutTitle: string,
  durationSeconds: number,
  sessionDetails?: DayWorkout
) {
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Overview Record
  const sessionRecord: RecordEntry = {
    id: `rec-${generateId()}`,
    collectionId: SPORT_SEANCES_COL_ID,
    data: {
      date: todayStr,
      nom: workoutTitle,
      duree: formatHHMMSS(durationSeconds),
      programme: sessionDetails ? JSON.stringify(sessionDetails) : ''
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await db.records.add(sessionRecord);

  // 2. Exercise Granular Telemetry Records
  if (sessionDetails?.strength) {
    const strength = sessionDetails.strength;
    const telemetryRecords: RecordEntry[] = [];

    // Warmup
    if (strength.warmup?.exerciseId) {
      const exName = exercisesMap[strength.warmup.exerciseId]?.name || strength.warmup.exerciseId;
      telemetryRecords.push({
        id: `rec-${generateId()}`,
        collectionId: SPORT_EXERCICES_COL_ID,
        data: {
          date: todayStr,
          exercice: exName,
          phase: 'Échauffement',
          series: 1,
          travail: strength.warmup.workDuration,
          repos: strength.warmup.restDuration
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    // Circuit
    if (strength.exercises) {
      for (const ex of strength.exercises) {
        const exName = exercisesMap[ex.exerciseId]?.name || ex.exerciseId;
        telemetryRecords.push({
          id: `rec-${generateId()}`,
          collectionId: SPORT_EXERCICES_COL_ID,
          data: {
            date: todayStr,
            exercice: exName,
            phase: 'Circuit',
            series: strength.sets || 1,
            travail: ex.workDuration,
            repos: ex.restDuration
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    }

    // Finisher
    if (strength.finisher) {
      for (const ex of strength.finisher) {
        const exName = exercisesMap[ex.exerciseId]?.name || ex.exerciseId;
        telemetryRecords.push({
          id: `rec-${generateId()}`,
          collectionId: SPORT_EXERCICES_COL_ID,
          data: {
            date: todayStr,
            exercice: exName,
            phase: 'Finisseur',
            series: ex.sets || 1,
            travail: ex.workDuration,
            repos: ex.restDuration
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    }

    if (telemetryRecords.length > 0) {
      await db.records.bulkAdd(telemetryRecords);
    }
  }
}

/**
 * Generates an automatic readable description of a cardio session based on its blocks,
 * e.g., "30' à 5:40 + 4x500m à 4:00 + 10' à 6:00"
 */
export function generateCardioDetail(cardio?: CardioWorkout | null): string {
  if (!cardio) return '';
  if (cardio.detail && cardio.detail.trim()) return cardio.detail.trim();

  const parts: string[] = [];

  // 1. Échauffement
  if (cardio.warmup) {
    const wSec = cardio.warmup.workDuration || 0;
    const wMin = Math.round(wSec / 60);
    const timeStr = wMin >= 1 ? `${wMin}'` : `${wSec}"`;
    const distStr = cardio.warmup.distanceM ? `${cardio.warmup.distanceM}m` : '';
    const label = distStr || timeStr;
    const allureStr = cardio.warmup.allure ? ` à ${cardio.warmup.allure}` : '';
    parts.push(`${label}${allureStr}`);
  }

  // 2. Intervalles / Circuit principal
  if (cardio.exercises && cardio.exercises.length > 0) {
    const sets = cardio.sets || 1;
    const exParts = cardio.exercises.map((ex: CircuitExercise) => {
      const distStr = ex.distanceM ? `${ex.distanceM}m` : '';
      const workMin = ex.workDuration >= 60 ? `${Math.round(ex.workDuration / 60)}'` : `${ex.workDuration}"`;
      const target = distStr || workMin;
      const allureStr = ex.allure ? ` à ${ex.allure}` : '';
      const restStr = ex.restDuration ? ` (r:${ex.restDuration}")` : '';
      return `${target}${allureStr}${restStr}`;
    }).join(' + ');

    if (sets > 1) {
      parts.push(`${sets}x(${exParts})`);
    } else {
      parts.push(exParts);
    }
  }

  // 3. Finisseur / Retour au calme
  if (cardio.finisher && cardio.finisher.length > 0) {
    const finParts = cardio.finisher.map((f: FinisherExercise) => {
      const fSec = f.workDuration || 0;
      const fMin = Math.round(fSec / 60);
      const timeStr = fMin >= 1 ? `${fMin}'` : `${fSec}"`;
      const distStr = f.distanceM ? `${f.distanceM}m` : '';
      const label = distStr || timeStr;
      const allureStr = f.allure ? ` à ${f.allure}` : '';
      return `${label}${allureStr}`;
    }).join(' + ');
    parts.push(finParts);
  }

  if (parts.length > 0) {
    return parts.join(' + ');
  }

  // Fallback sur le titre ou les notes
  return cardio.title || 'Séance cardio';
}

/**
 * Estimates or returns the target distance in km for a cardio session.
 */
export function estimateCardioDistance(cardio?: CardioWorkout | null): number {
  if (!cardio) return 5.0;
  if (cardio.distanceKm && cardio.distanceKm > 0) {
    return Number(cardio.distanceKm);
  }

  // Si des distances métriques sont indiquées dans les blocs
  let totalMeters = 0;
  if (cardio.warmup?.distanceM) totalMeters += cardio.warmup.distanceM;
  if (cardio.exercises) {
    const sets = cardio.sets || 1;
    for (const ex of cardio.exercises) {
      if (ex.distanceM) totalMeters += ex.distanceM * sets;
    }
  }
  if (cardio.finisher) {
    for (const fin of cardio.finisher) {
      if (fin.distanceM) totalMeters += fin.distanceM * (fin.sets || 1);
    }
  }
  if (totalMeters > 0) {
    return Number((totalMeters / 1000).toFixed(2));
  }

  // Estimation standard basée sur la durée et le sport
  const minutes = cardio.durationMinutes || 30;
  if (cardio.exerciseId === 'cycling') {
    return Number((minutes * (22 / 60)).toFixed(1)); // ~22 km/h
  } else {
    return Number((minutes * (10 / 60)).toFixed(1)); // ~10 km/h
  }
}

/**
 * Logs a manual cardio session into Sport - Cardio
 */
export async function logCompletedCardio(
  sport: string,
  distanceKm: number,
  durationMinutes: number,
  comment: string
) {
  const todayStr = new Date().toISOString().split('T')[0];
  const durationSec = durationMinutes * 60;

  const record: RecordEntry = {
    id: `rec-${generateId()}`,
    collectionId: SPORT_CARDIO_COL_ID,
    data: {
      date: todayStr,
      sport: sport,
      distance: distanceKm,
      temps: formatHHMMSS(durationSec),
      commentaire: comment
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await db.records.add(record);
}

/**
 * Returns recent completed workouts from Séances and Cardio.
 */
export async function getRecentWorkouts(): Promise<Array<{
  id: string;
  date: string;
  type: 'renfo' | 'cardio';
  titre: string;
  details: string;
}>> {
  const renfoRecs = await db.records.where('collectionId').equals(SPORT_SEANCES_COL_ID).toArray();
  const cardioRecs = await db.records.where('collectionId').equals(SPORT_CARDIO_COL_ID).toArray();

  const list: Array<{
    id: string;
    date: string;
    type: 'renfo' | 'cardio';
    titre: string;
    details: string;
  }> = [];

  for (const r of renfoRecs) {
    if (r.deletedAt) continue;
    list.push({
      id: r.id || '',
      date: String(r.data.date || ''),
      type: 'renfo',
      titre: String(r.data.nom || 'Séance de renforcement'),
      details: `Durée : ${r.data.duree || 'N/A'}`
    });
  }

  for (const r of cardioRecs) {
    if (r.deletedAt) continue;
    list.push({
      id: r.id || '',
      date: String(r.data.date || ''),
      type: 'cardio',
      titre: `${r.data.sport || 'Cardio'} - ${r.data.commentaire || 'Séance'}`,
      details: `${r.data.distance || 0} km en ${r.data.temps || 'N/A'}`
    });
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Generates initial demo / default schedule data
 */
export async function generateDemoData() {
  await initializeCollections();
  await seedDefaultTemplates();
  await seedDefaultWeeklyProgramme();
}
