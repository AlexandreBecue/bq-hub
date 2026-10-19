import type { TMDBMediaResult, WatchProvidersResult } from '../types';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export function getTmdbApiKey(): string {
  return localStorage.getItem('bq_watch_tmdb_api_key') || '';
}

export function setTmdbApiKey(key: string) {
  localStorage.setItem('bq_watch_tmdb_api_key', key.trim());
}

export function getPosterUrl(path?: string, size: 'w185' | 'w342' | 'w500' | 'original' = 'w342'): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${IMAGE_BASE_URL}/${size}${path}`;
}

export interface TMDBProviderItem {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export const TMDB_GENRES_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Aventure',
  16: 'Animation',
  35: 'Comédie',
  80: 'Crime',
  99: 'Documentaire',
  18: 'Drame',
  10751: 'Familial',
  14: 'Fantastique',
  36: 'Histoire',
  27: 'Horreur',
  10402: 'Musique',
  9648: 'Mystère',
  10749: 'Romance',
  878: 'Science-Fiction',
  10770: 'Téléfilm',
  53: 'Thriller',
  10752: 'Guerre',
  37: 'Western',
  10759: 'Action & Aventure',
  10762: 'Enfants',
  10763: 'Actualités',
  10764: 'Télé-réalité',
  10765: 'Science-Fiction & Fantastique',
  10766: 'Feuilleton',
  10767: 'Talk',
  10768: 'Guerre & Politique'
};

export function resolveGenreNames(genreIds?: number[], directGenres?: Array<{ id: number; name: string }>): string[] {
  if (directGenres && directGenres.length > 0) {
    return directGenres.map(g => g.name);
  }
  if (!genreIds || genreIds.length === 0) return [];
  return genreIds.map(id => TMDB_GENRES_MAP[id]).filter(Boolean);
}

/**
 * Universal TMDB fetcher supporting both v3 API keys and v4 Read Access Tokens.
 */
async function fetchTMDB(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const apiKey = getTmdbApiKey();
  if (!apiKey) return null;

  const url = new URL(`${TMDB_API_BASE}${endpoint}`);
  url.searchParams.set('language', 'fr-FR');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {
    'accept': 'application/json'
  };

  // v4 JWT / Read Access Token is longer (> 40 chars)
  if (apiKey.length > 40) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set('api_key', apiKey);
  }

  try {
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      console.warn(`TMDB API Error [${res.status}]:`, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Erreur appel réseau TMDB:', err);
    return null;
  }
}

/**
 * Searches movies and TV shows matching a search query, an ID, or a URL.
 */
export async function searchTMDB(query: string): Promise<TMDBMediaResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  // 1. Direct ID or TMDB URL detection (e.g. "417678", "id:417678", or full TMDB URL)
  const urlMatch = clean.match(/(?:movie|tv)\/(\d+)/i);
  const pureNumMatch = clean.match(/^(\d+)$/);
  const idPrefixMatch = clean.match(/^(?:id:)?\s*(\d+)$/i);

  const directId = urlMatch ? Number(urlMatch[1]) : pureNumMatch ? Number(pureNumMatch[1]) : idPrefixMatch ? Number(idPrefixMatch[1]) : null;

  if (directId) {
    const isTv = clean.includes('/tv/');
    const details = await getMediaDetails(directId, isTv ? 'tv' : 'movie') || (!isTv ? await getMediaDetails(directId, 'tv') : null);
    if (details) {
      return [{
        id: details.id,
        title: details.title || details.name || '',
        name: details.name,
        media_type: details.name ? 'tv' : 'movie',
        release_date: details.release_date || details.first_air_date || '',
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        overview: details.overview || '',
        vote_average: details.vote_average,
        genres: resolveGenreNames(undefined, details.genres)
      }];
    }
  }

  // 2. Extract optional 4-digit release year from query
  const yearMatch = clean.match(/^(.*?)\s+(19\d{2}|20\d{2})$/);
  let yearSpecificResults: any[] = [];
  if (yearMatch) {
    const titleOnly = yearMatch[1].trim();
    const year = yearMatch[2];
    const yearMovieData = await fetchTMDB('/search/movie', {
      query: titleOnly,
      primary_release_year: year,
      page: '1',
      include_adult: 'false'
    });
    if (yearMovieData?.results?.length) {
      yearSpecificResults = yearMovieData.results.map((r: any) => ({ ...r, media_type: 'movie' }));
    }
  }

  // 3. Multi-search across all movies and TV shows
  const data = await fetchTMDB('/search/multi', {
    query: clean,
    page: '1',
    include_adult: 'false'
  });

  const rawResults = (data?.results || []) as any[];
  const combined = [
    ...yearSpecificResults,
    ...rawResults.filter(item => item.media_type === 'movie' || item.media_type === 'tv')
  ];

  // Deduplicate results by ID
  const seen = new Set<number>();
  const results: TMDBMediaResult[] = [];

  for (const item of combined) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    results.push({
      id: item.id,
      title: item.title || item.name || '',
      name: item.name,
      media_type: item.media_type || (item.name ? 'tv' : 'movie'),
      release_date: item.release_date || item.first_air_date || '',
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      overview: item.overview || '',
      vote_average: item.vote_average,
      genre_ids: item.genre_ids,
      genres: resolveGenreNames(item.genre_ids, item.genres)
    });
  }

  return results;
}

/**
 * Fetches France streaming availability (watch/providers) for a movie or show.
 */
export async function getWatchProviders(tmdbId: number, mediaType: 'movie' | 'tv' = 'movie'): Promise<WatchProvidersResult | null> {
  if (!tmdbId) return null;

  const data = await fetchTMDB(`/${mediaType}/${tmdbId}/watch/providers`);
  if (!data || !data.results) return null;

  const fr = data.results.FR;
  if (!fr) return null;

  return {
    flatrate: fr.flatrate || [],
    rent: fr.rent || [],
    buy: fr.buy || [],
    link: fr.link
  };
}

/**
 * Fetches full details for a media
 */
export async function getMediaDetails(tmdbId: number, mediaType: 'movie' | 'tv' = 'movie'): Promise<any> {
  if (!tmdbId) return null;
  return await fetchTMDB(`/${mediaType}/${tmdbId}`);
}

/**
 * Fetches the official list of streaming providers available in France from TMDB.
 */
export async function getFrenchWatchProviders(): Promise<TMDBProviderItem[]> {
  const data = await fetchTMDB('/watch/providers/movie', {
    watch_region: 'FR'
  });
  if (!data || !data.results) return [];
  return (data.results as any[]).map(p => ({
    provider_id: p.provider_id,
    provider_name: p.provider_name,
    logo_path: p.logo_path
  }));
}
