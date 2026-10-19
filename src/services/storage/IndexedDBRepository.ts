import type { BackupData, DataNamespace, FavoriteItem, RecentlyViewedItem, SearchHistoryItem, UserPreferences, WatchlistItem } from '../../types/storage';

const STORES = ['favorites', 'watchlist', 'search_history', 'recently_viewed', 'preferences'];
const DEFAULTS: UserPreferences = { historySearchEnabled: true, historyViewEnabled: true, catalogSource: 'ytmusic', preferredFormat: 'MP3' };
const isObject = (value: any) => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: any) => typeof value === 'string' && value.length > 0 && value.length <= 4096;
const number = (value: any) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function validateBackup(input: unknown): BackupData {
  const data = input as any;
  if (!isObject(data) || data.schemaVersion !== 1) throw new Error('Unsupported or invalid backup schema.');
  if (JSON.stringify(data).length > 8 * 1024 * 1024) throw new Error('Backup exceeds 8 MiB limit.');
  const clean = (item: any, requiredText: string[], requiredNumbers: string[], optional: string[]) => {
    if (!isObject(item)) throw new Error('Invalid backup record.');
    for (const key of requiredText) if (!text(item[key])) throw new Error(`Invalid field: ${key}`);
    for (const key of requiredNumbers) if (!number(item[key])) throw new Error(`Invalid field: ${key}`);
    const out: any = {};
    for (const key of [...requiredText, ...requiredNumbers, ...optional]) if (item[key] !== undefined) out[key] = item[key];
    for (const key of optional) {
      if (out[key] === undefined || key === 'metadata') continue;
      if (['year', 'discNumber', 'trackNumber', 'durationSeconds'].includes(key)) { if (!number(out[key])) throw new Error(`Invalid field: ${key}`); }
      else if (typeof out[key] !== 'string' || out[key].length > 4096) throw new Error(`Invalid field: ${key}`);
    }
    if (out.coverUrl !== undefined) {
      const url = new URL(out.coverUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe artwork URL.');
    }
    if (out.namespace !== undefined && !['demo', 'live'].includes(out.namespace)) throw new Error('Invalid namespace.');
    return out;
  };
  const list = (key: string, transform: (item: any) => any) => {
    if (!Array.isArray(data[key]) || data[key].length > 10000) throw new Error(`Invalid or excessive list: ${key}`);
    return [...new Map(data[key].map((item: any) => { const row = transform(item); return [row.id, row] as const; })).values()];
  };
  const favorites = list('favorites', (item) => {
    const row = clean(item, ['id', 'namespace', 'provider', 'entityType', 'stableProviderId', 'title'], ['addedAt'], ['persianTitle', 'subtitle', 'coverSeed', 'coverUrl']);
    if (!['artist', 'release', 'track'].includes(row.entityType)) throw new Error('Invalid favorite type.');
    if (item.metadata !== undefined) row.metadata = clean(item.metadata, [], [], ['artistId', 'artistName', 'releaseId', 'releaseTitle', 'editionLabel', 'year', 'discNumber', 'trackNumber', 'durationSeconds']);
    return row;
  });
  const watchlist = list('watchlist', (item) => clean(item, ['id', 'namespace', 'provider', 'releaseId', 'stableProviderId', 'title', 'artistName'], ['addedAt', 'trackCount'], ['persianTitle', 'coverSeed', 'coverUrl', 'editionLabel', 'year']));
  const searchHistory = list('searchHistory', (item) => clean(item, ['id', 'query'], ['timestamp', 'useCount'], []));
  const recentlyViewed = list('recentlyViewed', (item) => {
    const row = clean(item, ['id', 'type', 'targetId', 'stableProviderId', 'namespace', 'title'], ['lastVisitedAt', 'visitCount'], ['subtitle', 'coverSeed', 'coverUrl']);
    if (!['artist', 'release'].includes(row.type)) throw new Error('Invalid recently-viewed type.');
    return row;
  });
  const preferences = data.preferences;
  if (!isObject(preferences) || typeof preferences.historySearchEnabled !== 'boolean' || typeof preferences.historyViewEnabled !== 'boolean' || !['demo', 'ytmusic'].includes(preferences.catalogSource) || !text(preferences.preferredFormat)) throw new Error('Invalid preferences.');
  return { schemaVersion: 1, exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '', generator: 'Music Rip validated backup', favorites, watchlist, searchHistory, recentlyViewed, preferences: { historySearchEnabled: preferences.historySearchEnabled, historyViewEnabled: preferences.historyViewEnabled, catalogSource: preferences.catalogSource, preferredFormat: preferences.preferredFormat } };
}

export class IndexedDBRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;
  public isAvailable = typeof window !== 'undefined' && 'indexedDB' in window;
  public storageError?: string = this.isAvailable ? undefined : 'IndexedDB is unavailable.';
  private fail(error: any): Error {
    this.storageError = error?.message || 'Local storage operation failed.';
    return error instanceof Error ? error : new Error(this.storageError);
  }
  private open(): Promise<IDBDatabase> {
    if (!this.isAvailable) return Promise.reject(new Error(this.storageError));
    if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open('musicrip_db', 1);
      let blocked = false;
      request.onblocked = () => { blocked = true; this.dbPromise = null; reject(this.fail(new Error('Close other app tabs to finish opening local storage.'))); };
      request.onupgradeneeded = () => {
        for (const name of STORES) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: name === 'preferences' ? 'key' : 'id' });
      };
      request.onerror = () => { this.dbPromise = null; reject(this.fail(request.error)); };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        db.onversionchange = () => { db.close(); this.dbPromise = null; };
        this.storageError = undefined; resolve(db);
      };
    });
    return this.dbPromise;
  }
  private async transaction<T>(names: string[], mode: IDBTransactionMode, build: (tx: IDBTransaction, guard: (fn: () => void) => () => void) => () => T): Promise<T> {
    try {
      const db = await this.open();
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(names, mode);
        let failure: any; let result: () => T;
        const guard = (fn: () => void) => () => { try { fn(); } catch (error) { failure = error; tx.abort(); } };
        tx.oncomplete = () => { try { const value = result(); this.storageError = undefined; resolve(value); } catch (error) { reject(error); } };
        tx.onabort = () => reject(failure || tx.error || new Error('Local storage transaction aborted.'));
        tx.onerror = () => { failure = tx.error || failure; };
        try { result = build(tx, guard); } catch (error) { failure = error; tx.abort(); }
      });
    } catch (error) { throw this.fail(error); }
  }
  private async one<T>(name: string, mode: IDBTransactionMode, issue: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return this.transaction([name], mode, (tx) => { let value: T; const request = issue(tx.objectStore(name)); request.onsuccess = () => { value = request.result; }; return () => value; });
  }
  private all<T>(name: string): Promise<T[]> { return this.one(name, 'readonly', (store) => store.getAll()); }
  private async remove<T>(name: string, id: string): Promise<T | null> {
    return this.transaction([name], 'readwrite', (tx, guard) => { let value: T | null = null; const store = tx.objectStore(name); const request = store.get(id); request.onsuccess = guard(() => { value = request.result || null; if (value) store.delete(id); }); return () => value; });
  }
  async getAllFavorites(namespace?: DataNamespace): Promise<FavoriteItem[]> { const rows = await this.all<FavoriteItem>('favorites'); return rows.filter((row) => !namespace || row.namespace === namespace); }
  async isFavorite(id: string) { return !!await this.one('favorites', 'readonly', (store) => store.get(id)); }
  async saveFavorite(item: FavoriteItem) { await this.one('favorites', 'readwrite', (store) => store.put(item)); }
  removeFavorite(id: string) { return this.remove<FavoriteItem>('favorites', id); }
  async getWatchlist(namespace?: DataNamespace): Promise<WatchlistItem[]> { const rows = await this.all<WatchlistItem>('watchlist'); return rows.filter((row) => !namespace || row.namespace === namespace); }
  async isWatchlisted(id: string) { return !!await this.one('watchlist', 'readonly', (store) => store.get(id)); }
  async addToWatchlist(item: WatchlistItem) { await this.one('watchlist', 'readwrite', (store) => store.put(item)); }
  removeFromWatchlist(id: string) { return this.remove<WatchlistItem>('watchlist', id); }
  async getSearchHistory() { return (await this.all<SearchHistoryItem>('search_history')).sort((a, b) => b.timestamp - a.timestamp); }
  async getRecentlyViewed(namespace?: DataNamespace) { return (await this.all<RecentlyViewedItem>('recently_viewed')).filter((row) => !namespace || row.namespace === namespace).sort((a, b) => b.lastVisitedAt - a.lastVisitedAt); }
  private trim(store: IDBObjectStore, field: string, guard: (fn: () => void) => () => void) { const request = store.getAll(); request.onsuccess = guard(() => { request.result.sort((a, b) => b[field] - a[field]).slice(50).forEach((row) => store.delete(row.id)); }); }
  async recordSearch(query: string) {
    const value = query.trim(); if (!value || !(await this.getPreferences()).historySearchEnabled) return;
    await this.transaction(['search_history'], 'readwrite', (tx, guard) => { const store = tx.objectStore('search_history'); const request = store.get(value.toLowerCase()); request.onsuccess = guard(() => { store.put({ id: value.toLowerCase(), query: value, timestamp: Date.now(), useCount: (request.result?.useCount || 0) + 1 }); this.trim(store, 'timestamp', guard); }); return () => undefined; });
  }
  async recordView(item: Omit<RecentlyViewedItem, 'lastVisitedAt' | 'visitCount'>) {
    if (!(await this.getPreferences()).historyViewEnabled) return;
    await this.transaction(['recently_viewed'], 'readwrite', (tx, guard) => { const store = tx.objectStore('recently_viewed'); const request = store.get(item.id); request.onsuccess = guard(() => { store.put({ ...item, lastVisitedAt: Date.now(), visitCount: (request.result?.visitCount || 0) + 1 }); this.trim(store, 'lastVisitedAt', guard); }); return () => undefined; });
  }
  async deleteSearchHistoryItem(id: string) { await this.one('search_history', 'readwrite', (store) => store.delete(id)); }
  async clearSearchHistory() { await this.one('search_history', 'readwrite', (store) => store.clear()); }
  async deleteRecentlyViewedItem(id: string) { await this.one('recently_viewed', 'readwrite', (store) => store.delete(id)); }
  async clearRecentlyViewed() { await this.one('recently_viewed', 'readwrite', (store) => store.clear()); }
  async getPreferences(): Promise<UserPreferences> { const row: any = await this.one('preferences', 'readonly', (store) => store.get('user_prefs')); return { ...DEFAULTS, ...row?.value }; }
  async savePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    return this.transaction(['preferences'], 'readwrite', (tx, guard) => { let updated: UserPreferences; const store = tx.objectStore('preferences'); const request = store.get('user_prefs'); request.onsuccess = guard(() => { updated = { ...DEFAULTS, ...request.result?.value, ...prefs }; store.put({ key: 'user_prefs', value: updated }); }); return () => updated; });
  }
  async generateBackup(): Promise<BackupData> {
    return this.transaction(STORES, 'readonly', (tx) => { const result: any = { schemaVersion: 1, exportedAt: new Date().toISOString(), generator: 'Music Rip PWA' }; const fields: Record<string, string> = { favorites: 'favorites', watchlist: 'watchlist', search_history: 'searchHistory', recently_viewed: 'recentlyViewed' }; for (const [name, field] of Object.entries(fields)) { const request = tx.objectStore(name).getAll(); request.onsuccess = () => { result[field] = request.result; }; } const prefs = tx.objectStore('preferences').get('user_prefs'); prefs.onsuccess = () => { result.preferences = { ...DEFAULTS, ...prefs.result?.value }; }; return () => result as BackupData; });
  }
  async restoreBackup(input: unknown) {
    const empty = { favorites: 0, watchlist: 0, searchHistory: 0, recentlyViewed: 0 };
    try {
      const backup = validateBackup(input);
      const counts = await this.transaction(STORES, 'readwrite', (tx, guard) => {
        const entries: [string, any[]][] = [['favorites', backup.favorites], ['watchlist', backup.watchlist], ['search_history', backup.searchHistory], ['recently_viewed', backup.recentlyViewed]];
        for (const [name, rows] of entries) { const store = tx.objectStore(name); for (const row of rows) { const request = store.get(row.id); request.onsuccess = guard(() => { const previous = request.result; const field = name === 'search_history' ? 'timestamp' : name === 'recently_viewed' ? 'lastVisitedAt' : undefined; if (!previous || !field || row[field] >= previous[field]) store.put(row); }); } }
        tx.objectStore('preferences').put({ key: 'user_prefs', value: backup.preferences });
        return () => ({ favorites: backup.favorites.length, watchlist: backup.watchlist.length, searchHistory: backup.searchHistory.length, recentlyViewed: backup.recentlyViewed.length });
      });
      return { success: true, importedCounts: counts };
    } catch (error: any) { return { success: false, importedCounts: empty, error: error.message || 'Backup was not restored.' }; }
  }
  async clearAllData(): Promise<void> { await this.transaction(STORES, 'readwrite', (tx) => { for (const name of STORES) tx.objectStore(name).clear(); return () => undefined; }); }
}
export const defaultStorage = new IndexedDBRepository();
