import { db, type RecordEntry, type CollectionSchema, type FieldType } from './index';

// Collection IDs (Abstract random IDs)
export const LUDOTHEQUE_COL_ID = 'col-v9p4k1m8s';  // Ludothèque Unifiée (Nouveau)
export const PARTIES_COL_ID = 'col-r8t5w2q3n';     // Sessions de Jeu (Nouveau)

// Legacy source IDs for auto-migration
export const LEGACY_VIDEOGAMES_COL_ID = 'col-03eraqmvo';
export const LEGACY_BOARDGAMES_COL_ID = 'col-h9eomlsdp';
export const LEGACY_BOARDGAMES_ALT_COL_ID = 'col-jeux-societe';

/**
 * Format YYYY-MM-DD to DD/MM/YYYY
 */
export function formatToFrenchDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Initialize Dexie collections and perform auto-migration
 */
export async function initializeCollections() {
  const existingCols = await db.collections.toArray();
  const colIds = existingCols.map(c => c.id);

  const newCols: CollectionSchema[] = [];

  // 1. Unified Ludothèque
  if (!colIds.includes(LUDOTHEQUE_COL_ID)) {
    newCols.push({
      id: LUDOTHEQUE_COL_ID,
      name: 'Ludothèque',
      description: 'Ma collection de jeux de société et jeux vidéo unifiée',
      createdAt: Date.now(),
      primaryFieldKey: 'nom',
      fields: [
        { id: 'f-gnom', name: 'Nom', key: 'nom', type: 'text' as FieldType, required: true },
        { id: 'f-gtype', name: 'Type de jeu', key: 'type_jeu', type: 'select' as FieldType, required: true, options: ["Jeux de société", "Jeux vidéo"] },
        { id: 'f-gminp', name: 'Joueurs Min', key: 'min_players', type: 'number' as FieldType, required: false },
        { id: 'f-gmaxp', name: 'Joueurs Max', key: 'max_players', type: 'number' as FieldType, required: false },
        { id: 'f-gplay', name: 'Durée (min)', key: 'playtime', type: 'number' as FieldType, required: false },
        { id: 'f-gprog', name: 'Progression', key: 'progression', type: 'select' as FieldType, required: false, options: ["Jamais joué", "En cours", "Terminé", "100%"] },
        { id: 'f-gplat', name: 'Plateforme', key: 'plateforme', type: 'select' as FieldType, required: false, options: ["PS5", "PS4", "PS3", "Steam", "Nintendo Switch", "Epic Games", "Xbox", "Autre"] },
        { id: 'f-gposs', name: 'Possédé', key: 'possede', type: 'boolean' as FieldType, required: false }
      ]
    });
  }

  // 2. Play Sessions (Scores & Rounds history)
  if (!colIds.includes(PARTIES_COL_ID)) {
    newCols.push({
      id: PARTIES_COL_ID,
      name: 'Sessions de Jeu',
      description: 'Historique des parties jouées et scores par manches',
      createdAt: Date.now() + 10,
      primaryFieldKey: 'date',
      fields: [
        { id: 'f-pdate', name: 'Date', key: 'date', type: 'date' as FieldType, required: true },
        { id: 'f-pgame', name: 'Jeu', key: 'jeu', type: 'relation' as FieldType, required: true, relatedCollectionId: LUDOTHEQUE_COL_ID },
        { id: 'f-pplay', name: 'Participants', key: 'participants', type: 'tags' as FieldType, required: true },
        { id: 'f-plimit', name: 'Score Limite', key: 'score_limite', type: 'number' as FieldType, required: false },
        { id: 'f-pwinner', name: 'Vainqueur', key: 'vainqueur', type: 'text' as FieldType, required: true },
        { id: 'f-pscores', name: 'Scores Finaux', key: 'scores_finaux', type: 'text' as FieldType, required: true }, // JSON format
        { id: 'f-phist', name: 'Historique Manches', key: 'manches_historique', type: 'text' as FieldType, required: true } // JSON format
      ]
    });
  }

  if (newCols.length > 0) {
    await db.collections.bulkAdd(newCols);
    console.log(`${newCols.length} collections initialisées.`);
  }

  // 3. Auto-migration
  await performGamesMigration();
}

/**
 * Automatically merges legacy boardgames and videogames tables into the unified Ludothèque
 */
export async function performGamesMigration() {
  try {
    const unifiedCount = await db.records.where('collectionId').equals(LUDOTHEQUE_COL_ID).count();
    if (unifiedCount > 0) return; // Already migrated/populated

    const legacyVideoGames = await db.records.where('collectionId').equals(LEGACY_VIDEOGAMES_COL_ID).toArray();
    const legacyBoardGames1 = await db.records.where('collectionId').equals(LEGACY_BOARDGAMES_COL_ID).toArray();
    const legacyBoardGames2 = await db.records.where('collectionId').equals(LEGACY_BOARDGAMES_ALT_COL_ID).toArray();

    const mergedRecords: RecordEntry[] = [];
    let idx = 0;

    // Migrate videogames
    legacyVideoGames.forEach(g => {
      if (g.deletedAt) return;
      mergedRecords.push({
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: LUDOTHEQUE_COL_ID,
        data: {
          nom: g.data.nom || g.data.title || 'Jeu vidéo inconnu',
          type_jeu: 'Jeux vidéo',
          min_players: 1,
          max_players: 4,
          playtime: null,
          progression: g.data.progression || 'Jamais joué',
          plateforme: g.data.plateforme || 'Steam',
          possede: g.data.possede !== false
        },
        createdAt: Date.now() + idx * 10,
        updatedAt: Date.now() + idx * 10
      });
      idx++;
    });

    // Migrate boardgames (source 1)
    legacyBoardGames1.forEach(g => {
      if (g.deletedAt) return;
      mergedRecords.push({
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: LUDOTHEQUE_COL_ID,
        data: {
          nom: g.data.nom || g.data.title || 'Jeu de société inconnu',
          type_jeu: 'Jeux de société',
          min_players: Number(g.data.joueurs_min) || Number(g.data.min_players) || 2,
          max_players: Number(g.data.joueurs_max) || Number(g.data.max_players) || 4,
          playtime: Number(g.data.duree) || Number(g.data.playtime) || null,
          progression: null,
          plateforme: null,
          possede: g.data.possede !== false
        },
        createdAt: Date.now() + idx * 10,
        updatedAt: Date.now() + idx * 10
      });
      idx++;
    });

    // Migrate boardgames (source 2)
    legacyBoardGames2.forEach(g => {
      if (g.deletedAt) return;
      // Prevent duplicate if already migrated
      if (mergedRecords.some(mr => mr.data.nom.toLowerCase() === String(g.data.nom || g.data.title || '').toLowerCase())) return;

      mergedRecords.push({
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: LUDOTHEQUE_COL_ID,
        data: {
          nom: g.data.nom || g.data.title || 'Jeu de société inconnu',
          type_jeu: 'Jeux de société',
          min_players: Number(g.data.joueurs_min) || Number(g.data.min_players) || 2,
          max_players: Number(g.data.joueurs_max) || Number(g.data.max_players) || 4,
          playtime: Number(g.data.duree) || Number(g.data.playtime) || null,
          progression: null,
          plateforme: null,
          possede: g.data.possede !== false
        },
        createdAt: Date.now() + idx * 10,
        updatedAt: Date.now() + idx * 10
      });
      idx++;
    });

    if (mergedRecords.length > 0) {
      await db.records.bulkAdd(mergedRecords);
      console.log(`Auto-migration: ${mergedRecords.length} jeux importés dans la Ludothèque.`);
    } else {
      // Seed default games if database is completely empty
      const defaultGames: RecordEntry[] = [
        {
          id: `rec-${Math.random().toString(36).substring(2, 11)}`,
          collectionId: LUDOTHEQUE_COL_ID,
          data: { nom: 'Zelda: Breath of the Wild', type_jeu: 'Jeux vidéo', min_players: 1, max_players: 1, playtime: null, progression: 'En cours', plateforme: 'Nintendo Switch', possede: true },
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: `rec-${Math.random().toString(36).substring(2, 11)}`,
          collectionId: LUDOTHEQUE_COL_ID,
          data: { nom: '7 Wonders', type_jeu: 'Jeux de société', min_players: 2, max_players: 7, playtime: 45, progression: null, plateforme: null, possede: true },
          createdAt: Date.now() + 10,
          updatedAt: Date.now() + 10
        }
      ];
      await db.records.bulkAdd(defaultGames);
      console.log('Ludothèque vide: seeding de jeux par défaut fait.');
    }

  } catch (err) {
    console.error('Error during games auto-migration:', err);
  }
}

/**
 * Fetch getters
 */
export async function getLudothequeRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(LUDOTHEQUE_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const valA = String(a.data.nom || '').trim();
    const valB = String(b.data.nom || '').trim();
    return valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
  });
}

export async function getPartiesRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(PARTIES_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
}
