import { db, type RecordEntry, type CollectionSchema, type FieldType } from './index';

// Collection IDs (Abstract random IDs)
export const DECKS_COL_ID = 'col-b7k4m1q8t';  // bq-learn - decks
export const CARDS_COL_ID = 'col-f9p2v6x3z';  // bq-learn - flashcards

/**
 * Checks if a card is due for review based on its box and last exam timestamp.
 * Uses 20-hour day intervals (standard SRS practice) to avoid review times shifting later daily.
 */

export function isCardDue(card: RecordEntry): boolean {
  if (card.deletedAt) return false;
  
  const lastExam = Number(card.data.dernier_examen) || 0;
  if (!lastExam) return true; // Never reviewed = always due!

  const intervalDays = Number(card.data.interval) || 0;
  if (intervalDays === 0) return true;

  const now = Date.now();
  const oneDayMs = 20 * 3600 * 1000; // 20 hours Day standard
  
  return now - lastExam >= intervalDays * oneDayMs;
}

export function calculateSM2(q: number, repetitions: number, interval: number, easeFactor: number) {
  let nextRepetitions = repetitions;
  let nextInterval = interval;
  let nextEaseFactor = easeFactor;

  if (q >= 3) {
    if (repetitions === 0) {
      nextInterval = 1;
    } else if (repetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(interval * easeFactor);
    }
    nextRepetitions++;
  } else {
    nextRepetitions = 0;
    nextInterval = 1;
  }

  nextEaseFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (nextEaseFactor < 1.3) nextEaseFactor = 1.3;

  return { repetitions: nextRepetitions, interval: nextInterval, easeFactor: nextEaseFactor };
}


/**
 * Initialize Dexie collections and seed default cards
 */
export async function initializeCollections() {
  const existingCols = await db.collections.toArray();
  const colIds = existingCols.map(c => c.id);

  const newCols: CollectionSchema[] = [];

  // 1. Decks Collection
  if (!colIds.includes(DECKS_COL_ID)) {
    newCols.push({
      id: DECKS_COL_ID,
      name: 'bq-learn - decks',
      description: 'Paquets de cartes mémo par catégorie de connaissances',
      createdAt: Date.now(),
      primaryFieldKey: 'nom',
      fields: [
        { id: 'f-dnom', name: 'Nom', key: 'nom', type: 'text' as FieldType, required: true },
        { id: 'f-ddesc', name: 'Description', key: 'description', type: 'text' as FieldType, required: false }
      ]
    });
  }

  // 2. Flashcards Collection
  if (!colIds.includes(CARDS_COL_ID)) {
    newCols.push({
      id: CARDS_COL_ID,
      name: 'bq-learn - flashcards',
      description: 'Questions et réponses mémorisables par boîte Leitner',
      createdAt: Date.now() + 10,
      primaryFieldKey: 'question',
      fields: [
        { id: 'f-fdeck', name: 'Deck', key: 'deck_id', type: 'relation' as FieldType, required: true, relatedCollectionId: DECKS_COL_ID },
        { id: 'f-fquest', name: 'Question', key: 'question', type: 'text' as FieldType, required: true },
        { id: 'f-frepons', name: 'Réponse', key: 'reponse', type: 'text' as FieldType, required: true },
        { id: 'f-fbox', name: 'Boîte Leitner', key: 'box', type: 'number' as FieldType, required: true }, // 1 to 5
        { id: 'f-fexam', name: 'Dernière révision', key: 'dernier_examen', type: 'number' as FieldType, required: false },
        { id: 'f-ftry', name: 'Tentatives', key: 'nb_essais', type: 'number' as FieldType, required: false },
        { id: 'f-fok', name: 'Réussites', key: 'nb_reussites', type: 'number' as FieldType, required: false }
      ]
    });
  }

  if (newCols.length > 0) {
    await db.collections.bulkAdd(newCols);
    console.log(`${newCols.length} collections initialisées.`);
  }
}

/**
 * Seed a complete default quiz deck about general culture and geography to play immediately!
 */
export async function seedDefaultQuizIfEmpty() {
  try {
    const decksCount = await db.records.where('collectionId').equals(DECKS_COL_ID).count();
    if (decksCount > 0) return;

    // 1. Create Default Deck
    const defaultDeckId = `rec-${Math.random().toString(36).substring(2, 11)}`;
    const defaultDeck: RecordEntry = {
      id: defaultDeckId,
      collectionId: DECKS_COL_ID,
      data: {
        nom: 'Culture Générale',
        description: 'Questions d\'histoire, sciences, géographie et arts de base.'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await db.records.add(defaultDeck);

    // 2. Create Default Flashcards
    const defaultCards: RecordEntry[] = [
      {
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: CARDS_COL_ID,
        data: {
          deck_id: defaultDeckId,
          question: 'Quelle est la capitale de l\'Australie ?',
          reponse: 'Canberra (et non Sydney ou Melbourne !)',
          box: 1,
          dernier_examen: null,
          nb_essais: 0,
          nb_reussites: 0
        },
        createdAt: Date.now() + 10,
        updatedAt: Date.now() + 10
      },
      {
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: CARDS_COL_ID,
        data: {
          deck_id: defaultDeckId,
          question: 'Quel fleuve traverse l\'Égypte et se jette dans la mer Méditerranée ?',
          reponse: 'Le Nil',
          box: 1,
          dernier_examen: null,
          nb_essais: 0,
          nb_reussites: 0
        },
        createdAt: Date.now() + 20,
        updatedAt: Date.now() + 20
      },
      {
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: CARDS_COL_ID,
        data: {
          deck_id: defaultDeckId,
          question: 'Qui a écrit la tragédie "Roméo et Juliette" ?',
          reponse: 'William Shakespeare',
          box: 1,
          dernier_examen: null,
          nb_essais: 0,
          nb_reussites: 0
        },
        createdAt: Date.now() + 30,
        updatedAt: Date.now() + 30
      },
      {
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: CARDS_COL_ID,
        data: {
          deck_id: defaultDeckId,
          question: 'Combien de planètes composent notre système solaire ?',
          reponse: '8 planètes (Pluton est rétrogradée en planète naine depuis 2006)',
          box: 1,
          dernier_examen: null,
          nb_essais: 0,
          nb_reussites: 0
        },
        createdAt: Date.now() + 40,
        updatedAt: Date.now() + 40
      },
      {
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: CARDS_COL_ID,
        data: {
          deck_id: defaultDeckId,
          question: 'En quelle année a eu lieu la Révolution Française ?',
          reponse: 'En 1789',
          box: 1,
          dernier_examen: null,
          nb_essais: 0,
          nb_reussites: 0
        },
        createdAt: Date.now() + 50,
        updatedAt: Date.now() + 50
      }
    ];

    await db.records.bulkAdd(defaultCards);
    console.log('Seeded 1 quiz deck with 5 starting flashcards.');
  } catch (err) {
    console.error('Error seeding default quiz:', err);
  }
}

/**
 * Core record getters
 */
export async function getDecksRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(DECKS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const valA = String(a.data.nom || '').trim();
    const valB = String(b.data.nom || '').trim();
    return valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
  });
}

export async function getCardsRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(CARDS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const valA = String(a.data.question || '').trim();
    const valB = String(b.data.question || '').trim();
    return valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
  });
}
export function formatToFrenchDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}
