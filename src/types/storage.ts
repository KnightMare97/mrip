/**
 * Domain types for persistent client-side storage, Library, Favorites, Watchlist, and History.
 */

export type DataNamespace = 'demo' | 'live';

export type FavoriteType = 'artist' | 'release' | 'track';

export interface FavoriteItem {
  id: string; // Composite deduplication key: `${namespace}:${provider}:${entityType}:${stableProviderId}`
  namespace: DataNamespace;
  provider: string; // e.g., 'fictional', 'ytmusic'
  entityType: FavoriteType;
  stableProviderId: string;
  title: string;
  persianTitle?: string;
  subtitle?: string;
  coverSeed?: string;
  coverUrl?: string;
  addedAt: number;
  metadata?: {
    artistId?: string;
    artistName?: string;
    releaseId?: string;
    releaseTitle?: string;
    editionLabel?: string;
    year?: number;
    discNumber?: number;
    trackNumber?: number;
    durationSeconds?: number;
  };
}

export interface WatchlistItem {
  id: string; // Composite key: `${namespace}:${provider}:release:${stableProviderId}`
  namespace: DataNamespace;
  provider: string;
  releaseId: string;
  stableProviderId: string;
  title: string;
  artistName: string;
  persianTitle?: string;
  coverSeed?: string;
  coverUrl?: string;
  editionLabel?: string;
  year?: number;
  trackCount: number;
  addedAt: number;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  useCount: number;
}

export interface RecentlyViewedItem {
  id: string;
  type: 'artist' | 'release';
  targetId: string;
  stableProviderId: string;
  namespace: DataNamespace;
  title: string;
  subtitle?: string;
  coverSeed?: string;
  coverUrl?: string;
  lastVisitedAt: number;
  visitCount: number;
}

export interface UserPreferences {
  historySearchEnabled: boolean;
  historyViewEnabled: boolean;
  catalogSource: 'ytmusic' | 'demo';
  preferredFormat: string;
}

export interface BackupData {
  schemaVersion: 1;
  exportedAt: string;
  generator: string;
  favorites: FavoriteItem[];
  watchlist: WatchlistItem[];
  searchHistory: SearchHistoryItem[];
  recentlyViewed: RecentlyViewedItem[];
  preferences: UserPreferences;
}
