import {
  AlertCircle,
  ArrowUpDown,
  Bookmark,
  Calendar,
  Clock,
  Download,
  FolderHeart,
  Heart,
  Music,
  Play,
  Plus,
  Search as SearchIcon,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useLibrary } from '../../context/LibraryContext';
import { FavoriteItem, FavoriteType, WatchlistItem } from '../../types/storage';
import { ArtworkPlaceholder } from '../common/ArtworkPlaceholder';

type LibraryTab = 'artists' | 'albums' | 'tracks' | 'later';
type SortOrder = 'date_desc' | 'name_asc';

interface LibraryViewProps {
  onSelectArtist: (artistId: string) => void;
  onSelectRelease: (releaseId: string) => void;
  onStartExportRelease: (releaseId: string) => void;
  onNavigateToSearch: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onSelectArtist,
  onSelectRelease,
  onStartExportRelease,
  onNavigateToSearch
}) => {
  const { t } = useLanguage();
  const {
    favorites,
    watchlist,
    removeFavorite,
    removeFromWatchlist,
    isStorageAvailable,
    storageError
  } = useLibrary();

  const [activeTab, setActiveTab] = useState<LibraryTab>('artists');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date_desc');
  const [namespaceFilter, setNamespaceFilter] = useState<'all' | 'live' | 'demo'>('all');

  // Filter and sort favorites
  const artistFavs = favorites.filter((f) => f.entityType === 'artist');
  const albumFavs = favorites.filter((f) => f.entityType === 'release');
  const trackFavs = favorites.filter((f) => f.entityType === 'track');

  const filterByNamespaceAndQuery = <T extends { namespace: string; title: string; subtitle?: string; artistName?: string }>(
    items: T[]
  ) => {
    let list = items;
    if (namespaceFilter !== 'all') {
      list = list.filter((i) => i.namespace === namespaceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.subtitle && i.subtitle.toLowerCase().includes(q)) ||
          (i.artistName && i.artistName.toLowerCase().includes(q))
      );
    }
    return list.sort((a: any, b: any) => {
      if (sortOrder === 'name_asc') {
        return a.title.localeCompare(b.title);
      }
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
  };

  const visibleArtists = filterByNamespaceAndQuery(artistFavs);
  const visibleAlbums = filterByNamespaceAndQuery(albumFavs);
  const visibleTracks = filterByNamespaceAndQuery(trackFavs);
  const visibleLater = filterByNamespaceAndQuery(watchlist);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <FolderHeart className="h-6 w-6 text-amber-500" />
            <span>Library & Favorites</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Persistent local storage on this device via IndexedDB
          </p>
        </div>

        {/* Namespace Badge Filter */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl text-[11px] font-mono">
          <button
            onClick={() => setNamespaceFilter('all')}
            className={`px-2 py-1 rounded-lg transition ${
              namespaceFilter === 'all'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setNamespaceFilter('live')}
            className={`px-2 py-1 rounded-lg transition ${
              namespaceFilter === 'live'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Live
          </button>
          <button
            onClick={() => setNamespaceFilter('demo')}
            className={`px-2 py-1 rounded-lg transition ${
              namespaceFilter === 'demo'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Demo
          </button>
        </div>
      </div>

      {/* Storage Error Warning if blocked */}
      {!isStorageAvailable && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Storage Warning: {storageError || 'IndexedDB is unavailable. Favorites will not persist across browser sessions.'}</span>
        </div>
      )}

      {/* Primary Tabs (Artists, Albums, Tracks, Later) */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800">
        <button
          onClick={() => setActiveTab('artists')}
          className={`flex-1 py-2 text-xs font-medium rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'artists'
              ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Artists</span>
          <span className="text-[10px] font-mono opacity-80">({artistFavs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('albums')}
          className={`flex-1 py-2 text-xs font-medium rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'albums'
              ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Albums</span>
          <span className="text-[10px] font-mono opacity-80">({albumFavs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tracks')}
          className={`flex-1 py-2 text-xs font-medium rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'tracks'
              ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Tracks</span>
          <span className="text-[10px] font-mono opacity-80">({trackFavs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('later')}
          className={`flex-1 py-2 text-xs font-medium rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'later'
              ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Later</span>
          <span className="text-[10px] font-mono opacity-80">({watchlist.length})</span>
        </button>
      </div>

      {/* Filter & Sort Controls within Library */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${activeTab} in library...`}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2 pl-9 pr-8 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort Button */}
        <button
          onClick={() => setSortOrder(sortOrder === 'date_desc' ? 'name_asc' : 'date_desc')}
          title="Toggle sort order"
          className="flex h-9 items-center gap-1.5 px-3 rounded-xl border border-zinc-800 bg-zinc-900/80 text-xs font-mono text-zinc-300 hover:border-zinc-700 transition shrink-0"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-amber-500" />
          <span className="hidden sm:inline">
            {sortOrder === 'date_desc' ? 'Recent' : 'A-Z'}
          </span>
        </button>
      </div>

      {/* Tab 1: Artists */}
      {activeTab === 'artists' && (
        <div className="space-y-3">
          {visibleArtists.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center space-y-3">
              <Heart className="h-10 w-10 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                No favorited artists yet. Tap the heart button on any artist to save them to your library.
              </p>
              <button
                onClick={onNavigateToSearch}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition"
              >
                <span>Find Artists</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleArtists.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between p-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 transition"
                >
                  <button
                    onClick={() => onSelectArtist(item.metadata?.artistId || item.stableProviderId)}
                    className="flex items-center gap-3 text-left rtl:text-right flex-1 min-w-0"
                  >
                    <ArtworkPlaceholder
                      seed={item.coverSeed || item.id}
                      title={item.title}
                      coverUrl={item.coverUrl}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-zinc-100 group-hover:text-amber-400 transition truncate">
                        {item.title}
                      </div>
                      {item.persianTitle && (
                        <div className="text-xs text-zinc-400 truncate" dir="rtl">
                          {item.persianTitle}
                        </div>
                      )}
                      <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        {item.namespace === 'demo' ? 'Fictional Demo' : 'YouTube Music'}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => removeFavorite(item.id)}
                    title="Remove from favorites"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-400/80 hover:bg-zinc-800 hover:text-rose-400 transition shrink-0 ml-2 rtl:mr-2 rtl:ml-0"
                  >
                    <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Albums */}
      {activeTab === 'albums' && (
        <div className="space-y-3">
          {visibleAlbums.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center space-y-3">
              <Music className="h-10 w-10 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                No favorited albums yet. Specific album editions can be saved by tapping the heart icon on any release page.
              </p>
              <button
                onClick={onNavigateToSearch}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition"
              >
                <span>Browse Releases</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleAlbums.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between p-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 transition"
                >
                  <button
                    onClick={() => onSelectRelease(item.metadata?.releaseId || item.stableProviderId)}
                    className="flex items-center gap-3 text-left rtl:text-right flex-1 min-w-0"
                  >
                    <ArtworkPlaceholder
                      seed={item.coverSeed || item.id}
                      title={item.title}
                      coverUrl={item.coverUrl}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-zinc-100 group-hover:text-amber-400 transition truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-0.5">
                        {item.subtitle || item.metadata?.artistName}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center gap-2">
                        <span>{item.metadata?.year || 'Unknown Year'}</span>
                        {item.metadata?.editionLabel && (
                          <>
                            <span>·</span>
                            <span>{item.metadata.editionLabel}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => removeFavorite(item.id)}
                    title="Remove album from favorites"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-400 hover:bg-zinc-800 transition shrink-0 ml-2 rtl:mr-2 rtl:ml-0"
                  >
                    <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Tracks */}
      {activeTab === 'tracks' && (
        <div className="space-y-3">
          {visibleTracks.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center space-y-3">
              <Music className="h-10 w-10 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                No favorited tracks yet. Tap the heart on individual track rows to bookmark specific songs.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 divide-y divide-zinc-800/60 overflow-hidden">
              {visibleTracks.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-900/80 transition text-xs"
                >
                  <button
                    onClick={() => item.metadata?.releaseId && onSelectRelease(item.metadata.releaseId)}
                    className="flex-1 min-w-0 text-left rtl:text-right"
                  >
                    <div className="font-medium text-zinc-200 truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {item.subtitle || item.metadata?.artistName}
                      {item.metadata?.releaseTitle ? ` · ${item.metadata.releaseTitle}` : ''}
                    </div>
                  </button>

                  <div className="flex items-center gap-3 shrink-0">
                    {item.metadata?.durationSeconds && (
                      <span className="font-mono text-zinc-500 text-[11px]">
                        {Math.floor(item.metadata.durationSeconds / 60)}:
                        {(item.metadata.durationSeconds % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                    <button
                      onClick={() => removeFavorite(item.id)}
                      title="Remove track from favorites"
                      className="text-rose-500 hover:text-rose-400"
                    >
                      <Heart className="h-4 w-4 fill-rose-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Later (Watchlist) */}
      {activeTab === 'later' && (
        <div className="space-y-3">
          {visibleLater.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center space-y-3">
              <Bookmark className="h-10 w-10 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                Your Later list is empty. Add releases you intend to export later via the bookmark button.
              </p>
              <button
                onClick={onNavigateToSearch}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition"
              >
                <span>Browse Releases</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleLater.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <button
                    onClick={() => onSelectRelease(item.releaseId)}
                    className="flex items-center gap-3.5 text-left rtl:text-right flex-1 min-w-0"
                  >
                    <ArtworkPlaceholder
                      seed={item.coverSeed || item.id}
                      title={item.title}
                      coverUrl={item.coverUrl}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-zinc-100 hover:text-amber-400 transition truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-0.5">
                        {item.artistName}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono mt-1 flex items-center gap-2">
                        <span>{item.year || 'Unknown Year'}</span>
                        <span>·</span>
                        <span>{item.trackCount} tracks</span>
                        {item.editionLabel && (
                          <>
                            <span>·</span>
                            <span>{item.editionLabel}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80">
                    <button
                      onClick={() => onStartExportRelease(item.releaseId)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400 active:scale-95 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Start Export</span>
                    </button>

                    <button
                      onClick={() => removeFromWatchlist(item.id)}
                      title="Remove from Later list"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-900/40 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
