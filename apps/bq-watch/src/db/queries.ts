import { db, generateId, type RecordEntry, type CollectionSchema } from './index';
import type { MovieRecord, MovieViewing, InboxItem } from '../types';

// Standard random Collection IDs matching bq-metrics standards
export const MOVIES_COL_ID = 'col-h8rl3suoy';
export const VIEWINGS_COL_ID = 'col-v3p8m1k9r';
export const INBOX_COL_ID = 'col-w7t1p9k4x';

/**
 * Ensures the Dexie collections exist. Does NOT insert any default data automatically.
 */
export async function initializeCollections() {
  const collectionsToEnsure: CollectionSchema[] = [
    {
      id: MOVIES_COL_ID,
      name: 'bq-watch - films & séries',
      description: 'Suivi des visionnages, ressentis et envies',
      fields: [
        { id: 'fld-htvkox0pr', name: 'Titre', key: 'titre', type: 'text', required: true },
        { id: 'fld-c7vj265cc', name: 'Type', key: 'type', type: 'select', required: false, options: ['Film', 'Série', 'Documentaire', 'Autre'] },
        { id: 'fld-wwqyw6ijv', name: 'Dernier visionnage', key: 'dernier_visionnage', type: 'date', required: false },
        { id: 'fld-a0atg996x', name: 'Origine', key: 'origine', type: 'tags', required: false },
        { id: 'fld-pz762hb8a', name: 'Avis & Ressentis', key: 'avis', type: 'text', required: false },
        { id: 'fld-n0t3sc0r8', name: 'Note /10', key: 'note', type: 'number', required: false },
        { id: 'fld-st4tutv1s', name: 'Statut', key: 'statut', type: 'select', required: false, options: ['Vu', 'À voir'] },
        { id: 'fld-p0st3rurl', name: 'Affiche', key: 'poster_url', type: 'text', required: false },
        { id: 'fld-tmdbr3f1d', name: 'TMDB ID', key: 'tmdb_id', type: 'number', required: false },
        { id: 'fld-g3nr3st4g', name: 'Genres', key: 'genres', type: 'tags', required: false },
        { id: 'fld-syn0ps1st', name: 'Synopsis', key: 'synopsis', type: 'text', required: false }
      ],
      primaryFieldKey: 'titre',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: VIEWINGS_COL_ID,
      name: 'bq-watch - visionnages',
      description: 'Historique des visionnages individuels par film et support',
      fields: [
        { id: 'fld-m0v1e1d9x', name: 'Movie ID', key: 'movie_id', type: 'text', required: true },
        { id: 'fld-t1tr3w4t8', name: 'Titre', key: 'titre', type: 'text', required: true },
        { id: 'fld-d4t3v1s9k', name: 'Date', key: 'date', type: 'date', required: true },
        { id: 'fld-supp0rt7k', name: 'Support', key: 'support', type: 'text', required: true },
        { id: 'fld-c0mm3nt4r', name: 'Commentaire', key: 'commentaire', type: 'text', required: false }
      ],
      primaryFieldKey: 'titre',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: INBOX_COL_ID,
      name: 'bq-watch - boîte de réception',
      description: 'Contenus importés en attente de débrief',
      fields: [
        { id: 'fld-1nb0xt1t7', name: 'Titre', key: 'titre', type: 'text', required: true },
        { id: 'fld-1nb0xs0u4', name: 'Source', key: 'source', type: 'text', required: true },
        { id: 'fld-1nb0xd4t9', name: 'Date', key: 'date', type: 'date', required: false },
        { id: 'fld-1nb0xtyp2', name: 'Type', key: 'type', type: 'select', options: ['Film', 'Série'], required: false }
      ],
      primaryFieldKey: 'titre',
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
}

/**
 * Returns movies filtered by status ('Vu' or 'À voir')
 */
export async function getMovies(statut?: 'Vu' | 'À voir'): Promise<MovieRecord[]> {
  const records = await db.records.where('collectionId').equals(MOVIES_COL_ID).toArray();
  const allViewings = await db.records.where('collectionId').equals(VIEWINGS_COL_ID).toArray();

  // Pre-calculate viewings count per movie ID
  const viewingsCountMap: Record<string, number> = {};
  for (const v of allViewings) {
    if (v.deletedAt) continue;
    const mId = v.data?.movie_id;
    if (mId) {
      viewingsCountMap[mId] = (viewingsCountMap[mId] || 0) + 1;
    }
  }

  const list: MovieRecord[] = [];

  for (const r of records) {
    if (r.deletedAt) continue;
    const d = r.data || {};
    const itemStatut = d.statut || (d.dernier_visionnage ? 'Vu' : 'À voir');

    if (statut && itemStatut !== statut) continue;

    const count = (r.id ? viewingsCountMap[r.id] : 0) || (d.dernier_visionnage ? 1 : 0);

    list.push({
      id: r.id,
      titre: d.titre || 'Sans titre',
      type: d.type || 'Film',
      dernier_visionnage: d.dernier_visionnage || '',
      origine: Array.isArray(d.origine) ? d.origine : d.origine ? [d.origine] : [],
      avis: d.avis || '',
      note: d.note !== undefined && d.note !== null ? Number(d.note) : undefined,
      statut: itemStatut,
      poster_url: d.poster_url || '',
      tmdb_id: d.tmdb_id ? Number(d.tmdb_id) : undefined,
      genres: Array.isArray(d.genres) ? d.genres : d.genres ? [d.genres] : [],
      synopsis: d.synopsis || '',
      visionnages_count: count
    });
  }

  return list.sort((a, b) => {
    if (statut === 'Vu') {
      const dateA = a.dernier_visionnage || '';
      const dateB = b.dernier_visionnage || '';
      if (dateA && dateB) return dateB.localeCompare(dateA);
      if (dateA) return -1;
      if (dateB) return 1;
    }
    return a.titre.localeCompare(b.titre);
  });
}

/**
 * Saves or updates a movie record in Dexie.
 */
export async function saveMovie(movie: MovieRecord): Promise<string> {
  const id = movie.id || `rec-${generateId()}`;
  const existing = await db.records.get(id);

  const cleanData: Record<string, any> = {
    titre: String(movie.titre || '').trim(),
    type: movie.type || 'Film',
    dernier_visionnage: movie.dernier_visionnage ? String(movie.dernier_visionnage) : '',
    origine: Array.isArray(movie.origine) ? movie.origine.map(String) : [],
    avis: movie.avis ? String(movie.avis) : '',
    note: movie.note !== undefined && movie.note !== null ? Number(movie.note) : null,
    statut: movie.statut || 'Vu',
    poster_url: movie.poster_url ? String(movie.poster_url) : '',
    tmdb_id: movie.tmdb_id ? Number(movie.tmdb_id) : null,
    genres: Array.isArray(movie.genres) ? movie.genres.map(String) : [],
    synopsis: movie.synopsis ? String(movie.synopsis) : ''
  };

  const record: RecordEntry = {
    id,
    collectionId: MOVIES_COL_ID,
    data: cleanData,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  // Convert to pure plain object so IndexedDB structuredClone never fails on Vue Proxies
  await db.records.put(JSON.parse(JSON.stringify(record)));
  return id;
}

/**
 * Deletes a movie record and all its associated viewings.
 */
export async function deleteMovie(id: string): Promise<void> {
  await db.records.delete(id);
  const viewings = await db.records.where('collectionId').equals(VIEWINGS_COL_ID).toArray();
  for (const v of viewings) {
    if (v.data?.movie_id === id && v.id) {
      await db.records.delete(v.id);
    }
  }
}

/**
 * Retrieves all individual viewings for a given movie ID.
 */
export async function getViewingsForMovie(movieId: string): Promise<MovieViewing[]> {
  const records = await db.records.where('collectionId').equals(VIEWINGS_COL_ID).toArray();
  const list: MovieViewing[] = [];

  for (const r of records) {
    if (r.deletedAt) continue;
    if (r.data?.movie_id === movieId) {
      list.push({
        id: r.id,
        movie_id: r.data.movie_id,
        titre: r.data.titre || '',
        date: r.data.date || '',
        support: r.data.support || 'Autre',
        commentaire: r.data.commentaire || ''
      });
    }
  }

  return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/**
 * Saves a new individual viewing for a movie and updates the parent movie's latest date & origin.
 */
export async function saveViewing(viewing: MovieViewing): Promise<string> {
  const id = viewing.id || `rec-${generateId()}`;
  const existing = await db.records.get(id);

  const cleanData: Record<string, any> = {
    movie_id: viewing.movie_id,
    titre: String(viewing.titre || '').trim(),
    date: viewing.date ? String(viewing.date) : new Date().toISOString().split('T')[0],
    support: viewing.support ? String(viewing.support) : 'Autre',
    commentaire: viewing.commentaire ? String(viewing.commentaire) : ''
  };

  const record: RecordEntry = {
    id,
    collectionId: VIEWINGS_COL_ID,
    data: cleanData,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  await db.records.put(JSON.parse(JSON.stringify(record)));

  // Synchronize parent movie's latest date & origin
  if (viewing.movie_id) {
    const parent = await db.records.get(viewing.movie_id);
    if (parent && !parent.deletedAt) {
      const allViewings = await getViewingsForMovie(viewing.movie_id);
      if (allViewings.length > 0) {
        parent.data.dernier_visionnage = allViewings[0].date;
        parent.data.statut = 'Vu';
        const currentOrigins: string[] = Array.isArray(parent.data.origine) ? parent.data.origine : [];
        if (viewing.support && !currentOrigins.includes(viewing.support)) {
          currentOrigins.push(viewing.support);
          parent.data.origine = currentOrigins;
        }
        parent.updatedAt = Date.now();
        await db.records.put(JSON.parse(JSON.stringify(parent)));
      }
    }
  }

  return id;
}

/**
 * Deletes a viewing and re-calculates the parent movie's latest viewing date.
 */
export async function deleteViewing(viewingId: string, movieId?: string): Promise<void> {
  await db.records.delete(viewingId);
  if (movieId) {
    const parent = await db.records.get(movieId);
    if (parent && !parent.deletedAt) {
      const allViewings = await getViewingsForMovie(movieId);
      if (allViewings.length > 0) {
        parent.data.dernier_visionnage = allViewings[0].date;
      }
      parent.updatedAt = Date.now();
      await db.records.put(JSON.parse(JSON.stringify(parent)));
    }
  }
}

/**
 * Returns pending Inbox items
 */
export async function getInboxItems(): Promise<InboxItem[]> {
  const records = await db.records.where('collectionId').equals(INBOX_COL_ID).toArray();
  const list: InboxItem[] = [];

  for (const r of records) {
    if (r.deletedAt) continue;
    const d = r.data || {};
    list.push({
      id: r.id || '',
      titre: d.titre || '',
      type: d.type || 'Film',
      source: d.source || 'Import',
      date: d.date || ''
    });
  }

  return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/**
 * Adds multiple inbox items, ignoring duplicates with existing inbox or movies.
 */
export async function addInboxItems(items: Array<Omit<InboxItem, 'id'>>): Promise<number> {
  const existingMovies = await getMovies();
  const existingInbox = await getInboxItems();

  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const existingTitles = new Set([
    ...existingMovies.map(m => normalize(m.titre)),
    ...existingInbox.map(i => normalize(i.titre))
  ]);

  let addedCount = 0;
  for (const item of items) {
    const norm = normalize(item.titre);
    if (!norm || existingTitles.has(norm)) continue;

    existingTitles.add(norm);
    const record: RecordEntry = {
      id: `rec-${generateId()}`,
      collectionId: INBOX_COL_ID,
      data: {
        titre: item.titre,
        type: item.type,
        source: item.source,
        date: item.date
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await db.records.put(JSON.parse(JSON.stringify(record)));
    addedCount++;
  }

  return addedCount;
}

/**
 * Deletes an inbox item
 */
export async function removeInboxItem(id: string): Promise<void> {
  await db.records.delete(id);
}

/**
 * Clears all inbox items
 */
export async function clearInbox(): Promise<void> {
  const records = await db.records.where('collectionId').equals(INBOX_COL_ID).toArray();
  for (const r of records) {
    if (r.id) await db.records.delete(r.id);
  }
}

/**
 * Generates generic sample demo data for evaluation and testing.
 * Only called explicitly when the user clicks the demo button in Settings.
 */
export async function generateDemoData() {
  await initializeCollections();

  const existingCount = await db.records.where('collectionId').equals(MOVIES_COL_ID).count();
  if (existingCount > 0) return;

  const now = Date.now();

  // Helper to create movie and its viewings
  const createDemoMovie = async (
    movieData: Omit<MovieRecord, 'id' | 'visionnages_count' | 'visionnages'>,
    viewingsList: Array<{ date: string; support: string; commentaire?: string }>
  ) => {
    const movieId = `rec-${generateId()}`;
    const movieRecord: RecordEntry = {
      id: movieId,
      collectionId: MOVIES_COL_ID,
      data: movieData,
      createdAt: now,
      updatedAt: now
    };
    await db.records.put(movieRecord);

    for (const v of viewingsList) {
      const viewingRecord: RecordEntry = {
        id: `rec-${generateId()}`,
        collectionId: VIEWINGS_COL_ID,
        data: {
          movie_id: movieId,
          titre: movieData.titre,
          date: v.date,
          support: v.support,
          commentaire: v.commentaire || ''
        },
        createdAt: now,
        updatedAt: now
      };
      await db.records.put(viewingRecord);
    }
  };

  // 1. Watched Movies & Series (~8 varied titles)
  await createDemoMovie(
    {
      titre: 'Inception',
      type: 'Film',
      dernier_visionnage: '2026-05-03',
      origine: ['Prime Video'],
      avis: 'Scénario brillant et mise en scène vertigineuse. La fin laisse une réflexion mémorable.',
      note: 9.5,
      statut: 'Vu',
      poster_url: 'https://image.tmdb.org/t/p/w342/aej3LRUga5rhgkmRP6XMFw3ejbl.jpg',
      tmdb_id: 27205,
      genres: ['Action', 'Science-Fiction', 'Aventure'],
      synopsis: 'Dom Cobb est un voleur expérimenté dans l’art de l’extraction de secrets enfouis dans les rêves…'
    },
    [{ date: '2026-05-03', support: 'Prime Video', commentaire: 'Soirée cinéma à la maison' }]
  );

  await createDemoMovie(
    {
      titre: 'La Ligne verte',
      type: 'Film',
      dernier_visionnage: '2026-02-02',
      origine: ['Netflix'],
      avis: 'Chef-d’œuvre bouleversant. Interprétations magistrales de Tom Hanks et Michael Clarke Duncan.',
      note: 9.0,
      statut: 'Vu',
      poster_url: 'https://image.tmdb.org/t/p/w342/cRBUYC02CPsVa1GqBq6rfHn5a8g.jpg',
      tmdb_id: 497,
      genres: ['Fantastique', 'Drame', 'Crime'],
      synopsis: 'Paul Edgecomb, gardien-chef d’un pénitencier en 1935, tisse un lien fort avec John Coffey, un colosse accusé à tort.'
    },
    [{ date: '2026-02-02', support: 'Netflix' }]
  );

  await createDemoMovie(
    {
      titre: 'Interstellar',
      type: 'Film',
      dernier_visionnage: '2025-11-20',
      origine: ['Netflix'],
      avis: 'Une odyssée spatiale grandiose doublée d’un voyage émotionnel père-fille inoubliable.',
      note: 9.5,
      statut: 'Vu',
      poster_url: 'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
      tmdb_id: 157336,
      genres: ['Aventure', 'Drame', 'Science-Fiction'],
      synopsis: 'Une équipe d’astronautes explore un trou de ver pour trouver un nouveau foyer pour l’humanité.'
    },
    [{ date: '2025-11-20', support: 'Netflix' }]
  );

  // Example of Multi-Viewing (Cinéma + Prime Video)
  await createDemoMovie(
    {
      titre: "Le Seigneur des Anneaux : La Communauté de l'Anneau",
      type: 'Film',
      dernier_visionnage: '2024-03-10',
      origine: ['Cinéma', 'Prime Video'],
      avis: 'Le début d’une trilogie intemporelle. Paysages sublimes et fidélité impressionnante à l’œuvre.',
      note: 9.5,
      statut: 'Vu',
      poster_url: 'https://image.tmdb.org/t/p/w342/9enjA87C3Hlq268yH0pM4qR086Z.jpg',
      tmdb_id: 120,
      genres: ['Aventure', 'Fantastique', 'Action'],
      synopsis: 'Frodon Sacquet hérite d’un anneau magique doté d’un pouvoir terrifiant et entreprend une quête épique.'
    },
    [
      { date: '2001-12-19', support: 'Cinéma', commentaire: 'Séance de sortie originale en salle' },
      { date: '2024-03-10', support: 'Prime Video', commentaire: 'Revisionnage version longue' }
    ]
  );

  await createDemoMovie(
    {
      titre: "Parasite",
      type: 'Film',
      dernier_visionnage: '2024-06-14',
      origine: ['Canal+'],
      avis: 'Un bijou de rythme et de satire sociale. Le retournement de situation au milieu est parfait.',
      note: 9.0,
      statut: 'Vu',
      poster_url: 'https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
      tmdb_id: 496243,
      genres: ['Comédie', 'Thriller', 'Drame'],
      synopsis: 'Toute la famille de Ki-taek est au chômage et s’intéresse au train de vie de la richissime famille Park.'
    },
    [{ date: '2024-06-14', support: 'Canal+' }]
  );

  await createDemoMovie(
    {
      titre: "Le Fabuleux Destin d'Amélie Poulain",
      type: 'Film',
      dernier_visionnage: '2023-10-05',
      origine: ['Cinéma'],
      avis: 'Une poésie visuelle réconfortante et une bande-son signée Yann Tiersen indémodable.',
      note: 8.5,
      statut: 'Vu',
      poster_url: 'https://image.tmdb.org/t/p/w342/wWlQp1nUeN9r62vQy1z8dE6r7fJ.jpg',
      tmdb_id: 194,
      genres: ['Comédie', 'Romance'],
      synopsis: 'Amélie, serveuse à Montmartre, décide un jour d’aider secrètement les gens qui l’entourent.'
    },
    [{ date: '2023-10-05', support: 'Cinéma' }]
  );

  await createDemoMovie(
    {
      titre: 'Spider-Man : New Generation',
      type: 'Film',
      dernier_visionnage: '2024-01-12',
      origine: ['Disney+'],
      avis: 'Une claque visuelle d’animation et un rythme palpitant. Miles Morales est super attachant.',
      note: 8.5,
      statut: 'Vu',
      poster_url: 'https://image.tmdb.org/t/p/w342/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg',
      tmdb_id: 324857,
      genres: ['Animation', 'Action', 'Aventure', 'Science-Fiction'],
      synopsis: 'Miles Morales, un adolescent de Brooklyn, découvre les possibilités illimitées du Spider-Verse.'
    },
    [{ date: '2024-01-12', support: 'Disney+' }]
  );

  await createDemoMovie(
    {
      titre: 'Breaking Bad',
      type: 'Série',
      dernier_visionnage: '2025-08-30',
      origine: ['Netflix'],
      avis: 'Écriture irréprochable de la première à la dernière minute. Une des plus grandes séries jamais créées.',
      note: 9.5,
      statut: 'Vu',
      poster_url: 'https://image.tmdb.org/t/p/w342/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
      tmdb_id: 1396,
      genres: ['Drame', 'Crime'],
      synopsis: 'Un professeur de chimie atteint d’un cancer en phase terminale s’associe à un ancien élève pour fabriquer de la méthamphétamine.'
    },
    [{ date: '2025-08-30', support: 'Netflix' }]
  );

  // 2. Watchlist Movies (~3 titles with statut: 'À voir')
  await createDemoMovie(
    {
      titre: 'Dune : Deuxième Partie',
      type: 'Film',
      dernier_visionnage: '',
      origine: ['Max'],
      avis: '',
      note: undefined,
      statut: 'À voir',
      poster_url: 'https://image.tmdb.org/t/p/w342/czembW0Rk1Ke7lCJGhkAi0ym92H.jpg',
      tmdb_id: 693134,
      genres: ['Science-Fiction', 'Aventure'],
      synopsis: 'Paul Atreides s’unit à Chani et aux Fremen tout en préparant sa revanche contre les conspirateurs.'
    },
    []
  );

  await createDemoMovie(
    {
      titre: 'Oppenheimer',
      type: 'Film',
      dernier_visionnage: '',
      origine: ['Prime Video'],
      avis: '',
      note: undefined,
      statut: 'À voir',
      poster_url: 'https://image.tmdb.org/t/p/w342/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
      tmdb_id: 872585,
      genres: ['Drame', 'Histoire'],
      synopsis: 'L’histoire du physicien J. Robert Oppenheimer et du projet Manhattan pendant la Seconde Guerre mondiale.'
    },
    []
  );

  await createDemoMovie(
    {
      titre: 'Past Lives',
      type: 'Film',
      dernier_visionnage: '',
      origine: ['Canal+'],
      avis: '',
      note: undefined,
      statut: 'À voir',
      poster_url: 'https://image.tmdb.org/t/p/w342/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg',
      tmdb_id: 666277,
      genres: ['Drame', 'Romance'],
      synopsis: 'Nora et Hae Sung, deux amis d’enfance en Corée du Sud, se retrouvent à New York vingt ans plus tard.'
    },
    []
  );

  // 3. Inbox Item (1 item in queue)
  const inboxRecord: RecordEntry = {
    id: `rec-${generateId()}`,
    collectionId: INBOX_COL_ID,
    data: {
      titre: 'Seven',
      type: 'Film',
      source: 'Netflix',
      date: new Date().toISOString().split('T')[0]
    },
    createdAt: now,
    updatedAt: now
  };
  await db.records.put(inboxRecord);
}

/**
 * Builds a rich textual representation of all watched movies and reviews
 * to provide complete context to the Gemini LLM.
 */
export async function getAllReviewsForAIContext(userName?: string): Promise<string> {
  const name = (userName || 'l’utilisateur').trim();
  const movies = await getMovies('Vu');
  const reviewsWithText = movies.filter(m => m.avis && m.avis.trim().length > 0);

  let context = `HISTORIQUE ET GOÛTS CINÉMATOGRAPHIQUES DE ${name.toUpperCase()} :\n\n`;
  context += `Films et séries visionnés avec avis rédigés (${reviewsWithText.length}) :\n`;

  for (const m of reviewsWithText) {
    const origin = (m.origine || []).join(', ');
    const note = m.note !== undefined ? ` [Note: ${m.note}/10]` : '';
    context += `- "${m.titre}" (${m.type}${m.dernier_visionnage ? ', vu le ' + m.dernier_visionnage : ''}${origin ? ' sur ' + origin : ''})${note} : "${m.avis}"\n`;
  }

  const otherWatched = movies.filter(m => !m.avis || m.avis.trim().length === 0);
  if (otherWatched.length > 0) {
    context += `\nAutres contenus vus sans avis détaillé :\n`;
    context += otherWatched.map(m => m.titre).slice(0, 50).join(', ') + '...\n';
  }

  return context;
}
