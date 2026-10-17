import {
  BackupData,
  DataNamespace,
  FavoriteItem,
  RecentlyViewedItem,
  SearchHistoryItem,
  UserPreferences,
  WatchlistItem
} from '../../types/storage';

const DB_NAME = 'musicrip_db';
const DB_VERSION = 1;
const MAX_HISTORY_ITEMS = 50;

const DEFAULT_PREFERENCES: UserPreferences = {
  historySearchEnabled: true,
  historyViewEnabled: true,
  catalogSource: 'ytmusic',
  preferredFormat: 'MP3'
};

export class IndexedDBRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;
  public isAvailable: boolean = true;
  public storageError?: string;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDB();
    } else {
      this.isAvailable = false;
      this.storageError = 'IndexedDB is not supported in this browser environment.';
    }
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // 1. Favorites store
          if (!db.objectStoreNames.contains('favorites')) {
            const favStore = db.createObjectStore('favorites', { keyPath: 'id' });
            favStore.createIndex('by_namespace', 'namespace', { unique: false });
            favStore.createIndex('by_type', 'entityType', { unique: false });
            favStore.createIndex('by_added', 'addedAt', { unique: false });
          }

          // 2. Watchlist (Download Later)
          if (!db.objectStoreNames.contains('watchlist')) {
            const watchStore = db.createObjectStore('watchlist', { keyPath: 'id' });
            watchStore.createIndex('by_namespace', 'namespace', { unique: false });
            watchStore.createIndex('by_added', 'addedAt', { unique: false });
          }

          // 3. Search History
          if (!db.objectStoreNames.contains('search_history')) {
            const searchStore = db.createObjectStore('search_history', { keyPath: 'id' });
            searchStore.createIndex('by_timestamp', 'timestamp', { unique: false });
          }

          // 4. Recently Viewed
          if (!db.objectStoreNames.contains('recently_viewed')) {
            const viewStore = db.createObjectStore('recently_viewed', { keyPath: 'id' });
            viewStore.createIndex('by_visited', 'lastVisitedAt', { unique: false });
          }

          // 5. Preferences
          if (!db.objectStoreNames.contains('preferences')) {
            db.createObjectStore('preferences', { keyPath: 'key' });
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          this.isAvailable = false;
          this.storageError = request.error?.message || 'Failed to open IndexedDB database.';
          reject(new Error(this.storageError));
        };
      } catch (err: any) {
        this.isAvailable = false;
        this.storageError = err.message || 'IndexedDB initialization failed.';
        reject(err);
      }
    });

    return this.dbPromise;
  }

  // Generic transaction helper
  private async getStore(
    storeName: string,
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    const db = await this.initDB();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  /* ====================================================================
   * FAVORITES (Artists, Releases, Tracks)
   * ==================================================================== */

  async getAllFavorites(namespace?: DataNamespace): Promise<FavoriteItem[]> {
    try {
      const store = await this.getStore('favorites', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list: FavoriteItem[] = req.result || [];
          if (namespace) {
            resolve(list.filter((f) => f.namespace === namespace));
          } else {
            resolve(list);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async isFavorite(id: string): Promise<boolean> {
    try {
      const store = await this.getStore('favorites', 'readonly');
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(!!req.result);
        req.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  async saveFavorite(item: FavoriteItem): Promise<void> {
    const store = await this.getStore('favorites', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async removeFavorite(id: string): Promise<FavoriteItem | null> {
    const store = await this.getStore('favorites', 'readwrite');
    const existing = await new Promise<FavoriteItem | null>((resolve) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => resolve(null);
    });

    if (existing) {
      await new Promise<void>((resolve, reject) => {
        const delReq = store.delete(id);
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => reject(delReq.error);
      });
    }

    return existing;
  }

  /* ====================================================================
   * WATCHLIST ("Download Later")
   * ==================================================================== */

  async getWatchlist(namespace?: DataNamespace): Promise<WatchlistItem[]> {
    try {
      const store = await this.getStore('watchlist', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list: WatchlistItem[] = req.result || [];
          if (namespace) {
            resolve(list.filter((w) => w.namespace === namespace));
          } else {
            resolve(list);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async isWatchlisted(id: string): Promise<boolean> {
    try {
      const store = await this.getStore('watchlist', 'readonly');
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(!!req.result);
        req.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  async addToWatchlist(item: WatchlistItem): Promise<void> {
    const store = await this.getStore('watchlist', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async removeFromWatchlist(id: string): Promise<WatchlistItem | null> {
    const store = await this.getStore('watchlist', 'readwrite');
    const existing = await new Promise<WatchlistItem | null>((resolve) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => resolve(null);
    });

    if (existing) {
      await new Promise<void>((resolve, reject) => {
        const delReq = store.delete(id);
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => reject(delReq.error);
      });
    }

    return existing;
  }

  /* ====================================================================
   * SEARCH HISTORY
   * ==================================================================== */

  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    try {
      const store = await this.getStore('search_history', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list: SearchHistoryItem[] = req.result || [];
          resolve(list.sort((a, b) => b.timestamp - a.timestamp));
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async recordSearch(query: string): Promise<void> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    // Check if search history is enabled in preferences
    const prefs = await this.getPreferences();
    if (!prefs.historySearchEnabled) return;

    const id = cleanQuery.toLowerCase();
    const store = await this.getStore('search_history', 'readwrite');

    const existing: SearchHistoryItem | null = await new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    const item: SearchHistoryItem = {
      id,
      query: cleanQuery,
      timestamp: Date.now(),
      useCount: (existing?.useCount || 0) + 1
    };

    await new Promise<void>((resolve, reject) => {
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });

    // Enforce retention limit
    await this.enforceRetentionLimit('search_history', 'timestamp', MAX_HISTORY_ITEMS);
  }

  async deleteSearchHistoryItem(id: string): Promise<void> {
    const store = await this.getStore('search_history', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearSearchHistory(): Promise<void> {
    const store = await this.getStore('search_history', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /* ====================================================================
   * RECENTLY VIEWED (Artists & Releases)
   * ==================================================================== */

  async getRecentlyViewed(namespace?: DataNamespace): Promise<RecentlyViewedItem[]> {
    try {
      const store = await this.getStore('recently_viewed', 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          let list: RecentlyViewedItem[] = req.result || [];
          if (namespace) list = list.filter((v) => v.namespace === namespace);
          resolve(list.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt));
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async recordView(item: Omit<RecentlyViewedItem, 'lastVisitedAt' | 'visitCount'>): Promise<void> {
    const prefs = await this.getPreferences();
    if (!prefs.historyViewEnabled) return;

    const store = await this.getStore('recently_viewed', 'readwrite');
    const existing: RecentlyViewedItem | null = await new Promise((resolve) => {
      const req = store.get(item.id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    const toSave: RecentlyViewedItem = {
      ...item,
      lastVisitedAt: Date.now(),
      visitCount: (existing?.visitCount || 0) + 1
    };

    await new Promise<void>((resolve, reject) => {
      const putReq = store.put(toSave);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });

    // Enforce retention limit
    await this.enforceRetentionLimit('recently_viewed', 'lastVisitedAt', MAX_HISTORY_ITEMS);
  }

  async deleteRecentlyViewedItem(id: string): Promise<void> {
    const store = await this.getStore('recently_viewed', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearRecentlyViewed(): Promise<void> {
    const store = await this.getStore('recently_viewed', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async enforceRetentionLimit(
    storeName: string,
    sortField: string,
    limit: number
  ): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      const all: any[] = await new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      if (all.length > limit) {
        all.sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));
        const toDelete = all.slice(limit);
        for (const item of toDelete) {
          store.delete(item.id);
        }
      }
    } catch {
      // ignore
    }
  }

  /* ====================================================================
   * PREFERENCES
   * ==================================================================== */

  async getPreferences(): Promise<UserPreferences> {
    try {
      const store = await this.getStore('preferences', 'readonly');
      return new Promise((resolve) => {
        const req = store.get('user_prefs');
        req.onsuccess = () => resolve(req.result?.value || DEFAULT_PREFERENCES);
        req.onerror = () => resolve(DEFAULT_PREFERENCES);
      });
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  async savePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences();
    const updated = { ...current, ...prefs };
    const store = await this.getStore('preferences', 'readwrite');

    return new Promise((resolve, reject) => {
      const req = store.put({ key: 'user_prefs', value: updated });
      req.onsuccess = () => resolve(updated);
      req.onerror = () => reject(req.error);
    });
  }

  /* ====================================================================
   * BACKUP & RESTORE (Versioned JSON)
   * ==================================================================== */

  async generateBackup(): Promise<BackupData> {
    const [favorites, watchlist, searchHistory, recentlyViewed, preferences] =
      await Promise.all([
        this.getAllFavorites(),
        this.getWatchlist(),
        this.getSearchHistory(),
        this.getRecentlyViewed(),
        this.getPreferences()
      ]);

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      generator: 'Music Rip PWA v1.0',
      favorites,
      watchlist,
      searchHistory,
      recentlyViewed,
      preferences
    };
  }

  async restoreBackup(backup: any): Promise<{
    success: boolean;
    importedCounts: {
      favorites: number;
      watchlist: number;
      searchHistory: number;
      recentlyViewed: number;
    };
    error?: string;
  }> {
    // Validate schema
    if (!backup || typeof backup !== 'object') {
      return {
        success: false,
        importedCounts: { favorites: 0, watchlist: 0, searchHistory: 0, recentlyViewed: 0 },
        error: 'Invalid backup format: Must be a valid JSON object.'
      };
    }

    if (backup.schemaVersion !== 1) {
      return {
        success: false,
        importedCounts: { favorites: 0, watchlist: 0, searchHistory: 0, recentlyViewed: 0 },
        error: `Unsupported backup schema version: ${backup.schemaVersion}. Expected version 1.`
      };
    }

    let favCount = 0;
    let watchCount = 0;
    let searchCount = 0;
    let viewCount = 0;

    try {
      // 1. Merge Favorites
      if (Array.isArray(backup.favorites)) {
        const favStore = await this.getStore('favorites', 'readwrite');
        for (const item of backup.favorites) {
          if (item && item.id && item.entityType && item.title) {
            favStore.put(item);
            favCount++;
          }
        }
      }

      // 2. Merge Watchlist
      if (Array.isArray(backup.watchlist)) {
        const watchStore = await this.getStore('watchlist', 'readwrite');
        for (const item of backup.watchlist) {
          if (item && item.id && item.title && item.artistName) {
            watchStore.put(item);
            watchCount++;
          }
        }
      }

      // 3. Merge Search History
      if (Array.isArray(backup.searchHistory)) {
        const searchStore = await this.getStore('search_history', 'readwrite');
        for (const item of backup.searchHistory) {
          if (item && item.id && item.query) {
            searchStore.put(item);
            searchCount++;
          }
        }
      }

      // 4. Merge Recently Viewed
      if (Array.isArray(backup.recentlyViewed)) {
        const viewStore = await this.getStore('recently_viewed', 'readwrite');
        for (const item of backup.recentlyViewed) {
          if (item && item.id && item.title) {
            viewStore.put(item);
            viewCount++;
          }
        }
      }

      // 5. Restore preferences if present
      if (backup.preferences && typeof backup.preferences === 'object') {
        await this.savePreferences(backup.preferences);
      }

      return {
        success: true,
        importedCounts: {
          favorites: favCount,
          watchlist: watchCount,
          searchHistory: searchCount,
          recentlyViewed: viewCount
        }
      };
    } catch (err: any) {
      return {
        success: false,
        importedCounts: {
          favorites: favCount,
          watchlist: watchCount,
          searchHistory: searchCount,
          recentlyViewed: viewCount
        },
        error: err.message || 'Failed to merge backup data into IndexedDB.'
      };
    }
  }

  async clearAllData(): Promise<void> {
    const stores = ['favorites', 'watchlist', 'search_history', 'recently_viewed'];
    for (const name of stores) {
      try {
        const s = await this.getStore(name, 'readwrite');
        s.clear();
      } catch {
        // ignore
      }
    }
  }
}

export const defaultStorage = new IndexedDBRepository();
