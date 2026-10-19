export interface MovieViewing {
  id?: string;
  movie_id: string;
  titre: string;
  date: string;
  support: string;
  commentaire?: string;
}

export interface MovieRecord {
  id?: string;
  titre: string;
  type: 'Film' | 'Série' | 'Documentaire' | 'Autre';
  dernier_visionnage?: string;
  origine?: string[];
  avis?: string;
  note?: number;
  statut?: 'Vu' | 'À voir';
  poster_url?: string;
  tmdb_id?: number;
  annee?: string;
  genres?: string[];
  synopsis?: string;
  visionnages_count?: number;
  visionnages?: MovieViewing[];
  watchlist_source_id?: string;
}

export interface InboxItem {
  id: string;
  titre: string;
  type: 'Film' | 'Série';
  source: string;
  date: string;
  matchedRecordId?: string;
}

export interface TMDBMediaResult {
  id: number;
  title: string;
  name?: string;
  media_type: 'movie' | 'tv';
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview: string;
  vote_average?: number;
  genre_ids?: number[];
  genres?: string[];
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface WatchProvidersResult {
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  link?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
}
