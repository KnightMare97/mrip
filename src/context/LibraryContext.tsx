import React, { createContext, useContext, useEffect, useState } from 'react';
import { defaultStorage, IndexedDBRepository } from '../services/storage/IndexedDBRepository';
import {
  BackupData,
  DataNamespace,
  FavoriteItem,
  RecentlyViewedItem,
  SearchHistoryItem,
  UserPreferences,
  WatchlistItem
} from '../types/storage';

interface UndoToast {
  message: string;
  onUndo: () => Promise<void>;
}

interface LibraryContextType {
  storage: IndexedDBRepository;
  favorites: FavoriteItem[];
  watchlist: WatchlistItem[];
  searchHistory: SearchHistoryItem[];
  recentlyViewed: RecentlyViewedItem[];
  preferences: UserPreferences;
  isStorageAvailable: boolean;
  storageError?: string;
  undoToast: UndoToast | null;
  dismissUndo: () => void;
  // Favorites methods
  isFavorite: (id: string) => boolean;
  addFavorite: (item: FavoriteItem) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  toggleFavorite: (item: FavoriteItem) => Promise<boolean>;
  // Watchlist methods
  isWatchlisted: (id: string) => boolean;
  addToWatchlist: (item: WatchlistItem) => Promise<void>;
  removeFromWatchlist: (id: string) => Promise<void>;
  toggleWatchlist: (item: WatchlistItem) => Promise<boolean>;
  // History methods
  recordSearch: (query: string) => Promise<void>;
  deleteSearchHistoryItem: (id: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
  recordView: (item: Omit<RecentlyViewedItem, 'lastVisitedAt' | 'visitCount'>) => Promise<void>;
  deleteRecentlyViewedItem: (id: string) => Promise<void>;
  clearRecentlyViewed: () => Promise<void>;
  // Preferences
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  // Backup / Restore
  exportBackup: () => Promise<BackupData>;
  importBackup: (backup: any) => Promise<{ success: boolean; error?: string; countSummary: string }>;
  clearAllUserData: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{
  children: React.ReactNode;
  storageInstance?: IndexedDBRepository;
}> = ({ children, storageInstance = defaultStorage }) => {
  const [storage] = useState<IndexedDBRepository>(storageInstance);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    historySearchEnabled: true,
    historyViewEnabled: true,
    catalogSource: 'ytmusic',
    preferredFormat: 'MP3'
  });
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);

  // Initial load
  useEffect(() => {
    let isMounted = true;

    const loadAll = async () => {
      try {
        const [favs, watch, sHist, rView, prefs] = await Promise.all([
          storage.getAllFavorites(),
          storage.getWatchlist(),
          storage.getSearchHistory(),
          storage.getRecentlyViewed(),
          storage.getPreferences()
        ]);

        if (isMounted) {
          setFavorites(favs);
          setWatchlist(watch);
          setSearchHistory(sHist);
          setRecentlyViewed(rView);
          setPreferences(prefs);
        }
      } catch (err) {
        console.error('Error initializing storage data:', err);
      }
    };

    loadAll();
    return () => {
      isMounted = false;
    };
  }, [storage]);

  const showUndo = (message: string, onUndo: () => Promise<void>) => {
    setUndoToast({ message, onUndo });
    setTimeout(() => {
      setUndoToast((curr) => (curr?.message === message ? null : curr));
    }, 5000);
  };

  const dismissUndo = () => setUndoToast(null);

  // Favorites
  const isFavorite = (id: string) => favorites.some((f) => f.id === id);

  const addFavorite = async (item: FavoriteItem) => {
    await storage.saveFavorite(item);
    setFavorites((prev) => [item, ...prev.filter((f) => f.id !== item.id)]);
  };

  const removeFavorite = async (id: string) => {
    const removed = await storage.removeFavorite(id);
    if (removed) {
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      showUndo(`Removed "${removed.title}" from Favorites`, async () => {
        await storage.saveFavorite(removed);
        setFavorites((prev) => [removed, ...prev]);
        dismissUndo();
      });
    }
  };

  const toggleFavorite = async (item: FavoriteItem): Promise<boolean> => {
    if (isFavorite(item.id)) {
      await removeFavorite(item.id);
      return false;
    } else {
      await addFavorite(item);
      return true;
    }
  };

  // Watchlist
  const isWatchlisted = (id: string) => watchlist.some((w) => w.id === id);

  const addToWatchlist = async (item: WatchlistItem) => {
    await storage.addToWatchlist(item);
    setWatchlist((prev) => [item, ...prev.filter((w) => w.id !== item.id)]);
  };

  const removeFromWatchlist = async (id: string) => {
    const removed = await storage.removeFromWatchlist(id);
    if (removed) {
      setWatchlist((prev) => prev.filter((w) => w.id !== id));
      showUndo(`Removed "${removed.title}" from Later`, async () => {
        await storage.addToWatchlist(removed);
        setWatchlist((prev) => [removed, ...prev]);
        dismissUndo();
      });
    }
  };

  const toggleWatchlist = async (item: WatchlistItem): Promise<boolean> => {
    if (isWatchlisted(item.id)) {
      await removeFromWatchlist(item.id);
      return false;
    } else {
      await addToWatchlist(item);
      return true;
    }
  };

  // Search History
  const recordSearch = async (query: string) => {
    await storage.recordSearch(query);
    const updated = await storage.getSearchHistory();
    setSearchHistory(updated);
  };

  const deleteSearchHistoryItem = async (id: string) => {
    await storage.deleteSearchHistoryItem(id);
    setSearchHistory((prev) => prev.filter((s) => s.id !== id));
  };

  const clearSearchHistory = async () => {
    await storage.clearSearchHistory();
    setSearchHistory([]);
  };

  // Recently Viewed
  const recordView = async (item: Omit<RecentlyViewedItem, 'lastVisitedAt' | 'visitCount'>) => {
    await storage.recordView(item);
    const updated = await storage.getRecentlyViewed();
    setRecentlyViewed(updated);
  };

  const deleteRecentlyViewedItem = async (id: string) => {
    await storage.deleteRecentlyViewedItem(id);
    setRecentlyViewed((prev) => prev.filter((v) => v.id !== id));
  };

  const clearRecentlyViewed = async () => {
    await storage.clearRecentlyViewed();
    setRecentlyViewed([]);
  };

  // Preferences
  const updatePreferences = async (partial: Partial<UserPreferences>) => {
    const updated = await storage.savePreferences(partial);
    setPreferences(updated);
  };

  // Backup / Restore
  const exportBackup = async () => {
    return storage.generateBackup();
  };

  const importBackup = async (backup: any) => {
    const result = await storage.restoreBackup(backup);
    if (result.success) {
      // Reload states from store
      const [favs, watch, sHist, rView, prefs] = await Promise.all([
        storage.getAllFavorites(),
        storage.getWatchlist(),
        storage.getSearchHistory(),
        storage.getRecentlyViewed(),
        storage.getPreferences()
      ]);
      setFavorites(favs);
      setWatchlist(watch);
      setSearchHistory(sHist);
      setRecentlyViewed(rView);
      setPreferences(prefs);

      const summary = `${result.importedCounts.favorites} favorites, ${result.importedCounts.watchlist} watchlist items, ${result.importedCounts.searchHistory} searches, ${result.importedCounts.recentlyViewed} recently viewed`;
      return { success: true, countSummary: summary };
    }
    return { success: false, error: result.error, countSummary: '' };
  };

  const clearAllUserData = async () => {
    await storage.clearAllData();
    setFavorites([]);
    setWatchlist([]);
    setSearchHistory([]);
    setRecentlyViewed([]);
  };

  return (
    <LibraryContext.Provider
      value={{
        storage,
        favorites,
        watchlist,
        searchHistory,
        recentlyViewed,
        preferences,
        isStorageAvailable: storage.isAvailable,
        storageError: storage.storageError,
        undoToast,
        dismissUndo,
        isFavorite,
        addFavorite,
        removeFavorite,
        toggleFavorite,
        isWatchlisted,
        addToWatchlist,
        removeFromWatchlist,
        toggleWatchlist,
        recordSearch,
        deleteSearchHistoryItem,
        clearSearchHistory,
        recordView,
        deleteRecentlyViewedItem,
        clearRecentlyViewed,
        updatePreferences,
        exportBackup,
        importBackup,
        clearAllUserData
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
}
