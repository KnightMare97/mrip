import {
  AlertCircle,
  Clock,
  Globe,
  Heart,
  Loader2,
  Music,
  Radio,
  Search as SearchIcon,
  Sparkles,
  X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { useLanguage } from '../../context/LanguageContext';
import { useLibrary } from '../../context/LibraryContext';
import { Artist } from '../../types/music';
import { ArtworkPlaceholder } from '../common/ArtworkPlaceholder';

interface SearchViewProps {
  onSelectArtist: (artistId: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onSelectArtist }) => {
  const { t } = useLanguage();
  const { catalog, source, setSource, isLive } = useCatalog();
  const { isFavorite, toggleFavorite, searchHistory, recordSearch, recordView } = useLibrary();

  const [query, setQuery] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load results whenever query or source changes
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setErrorMessage(null);

    catalog
      .searchArtists(query)
      .then((results) => {
        if (!isCancelled) {
          setArtists(results);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setErrorMessage(err.message || 'Failed to search catalog.');
          setArtists([]);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [query, catalog, source]);

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      recordSearch(query);
    }
  };

  const handleSelectArtist = (artist: Artist) => {
    // Record submitted search
    if (query.trim()) {
      recordSearch(query);
    }
    // Record view in recently viewed history
    recordView({
      id: `${isLive ? 'live' : 'demo'}:${artist.providerId}`,
      type: 'artist',
      targetId: artist.id,
      stableProviderId: artist.providerId,
      namespace: isLive ? 'live' : 'demo',
      title: artist.name,
      subtitle: artist.genre,
      coverSeed: artist.avatarSeed,
      coverUrl: artist.coverUrl
    });

    onSelectArtist(artist.id);
  };

  const handleFavoriteClick = async (e: React.MouseEvent, artist: Artist) => {
    e.stopPropagation();
    const favId = `${isLive ? 'live' : 'demo'}:${artist.providerId}`;
    await toggleFavorite({
      id: favId,
      namespace: isLive ? 'live' : 'demo',
      provider: isLive ? 'ytmusic' : 'fictional',
      entityType: 'artist',
      stableProviderId: artist.providerId,
      title: artist.name,
      persianTitle: artist.persianName,
      subtitle: artist.genre,
      coverSeed: artist.avatarSeed,
      coverUrl: artist.coverUrl,
      addedAt: Date.now(),
      metadata: {
        artistId: artist.id,
        artistName: artist.name
      }
    });
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Source Toggle & Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium">Catalog Source:</span>
          <div className="inline-flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setSource('ytmusic')}
              className={`px-2.5 py-1 rounded-lg transition ${
                source === 'ytmusic'
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              YouTube Music (Live)
            </button>
            <button
              onClick={() => setSource('demo')}
              className={`px-2.5 py-1 rounded-lg transition ${
                source === 'demo'
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Fictional Demo
            </button>
          </div>
        </div>

        <span className="text-[11px] font-mono text-zinc-500">
          {isLive ? 'Live Open Source API' : '100% Mock Fixtures'}
        </span>
      </div>

      {/* Prominent Search Field with Form submission */}
      <form onSubmit={handleSubmitSearch} className="relative">
        <label htmlFor="artist-search-input" className="sr-only">
          {t.searchPlaceholder}
        </label>
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-3.5 rtl:left-auto rtl:right-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
          <input
            id="artist-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isLive
                ? 'Search any artist on YouTube Music (e.g. Radiohead, Kayhan Kalhor, Googoosh)...'
                : 'Search demo artists (Chroma Drift, سرود نور, Roya & The Echo)...'
            }
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 py-3.5 pl-10 pr-10 rtl:pl-10 rtl:pr-10 text-sm text-zinc-100 placeholder-zinc-500 shadow-inner focus:border-amber-500/80 focus:outline-none focus:ring-1 focus:ring-amber-500/80 transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search input"
              className="absolute right-3 rtl:right-auto rtl:left-3 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* Recent Searches from Library Context (Only recorded searches, unboxed) */}
      {searchHistory.length > 0 && !query && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <span>Recent Searches</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
            {searchHistory.slice(0, 5).map((item, idx) => (
              <React.Fragment key={item.id}>
                <button
                  onClick={() => setQuery(item.query)}
                  className="hover:text-amber-400 transition text-zinc-300 py-1"
                >
                  {item.query}
                </button>
                {idx < Math.min(searchHistory.length, 5) - 1 && (
                  <span className="text-zinc-700" aria-hidden="true">
                    /
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Error State if live source fails */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-semibold">Live Source Error:</strong>
            <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
            <p className="mt-1 text-[11px] text-zinc-400">
              Per strict rules, we never silently fall back to fictional data. You can switch to Fictional Demo above to continue testing UI features offline.
            </p>
          </div>
        </div>
      )}

      {/* Artist Search Results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>{loading ? 'Searching catalog...' : `${artists.length} Artists Found`}</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />}
        </div>

        {!loading && artists.length === 0 && !errorMessage && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-8 text-center text-xs text-zinc-500">
            {query
              ? `No artists found matching "${query}" on ${isLive ? 'YouTube Music' : 'Demo Catalog'}.`
              : 'Search for any artist above to inspect their discography.'}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {artists.map((artist) => {
            const favId = `${isLive ? 'live' : 'demo'}:${artist.providerId}`;
            const isFav = isFavorite(favId);

            return (
              <div
                key={artist.id}
                onClick={() => handleSelectArtist(artist)}
                className="group flex items-center justify-between p-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 transition cursor-pointer min-h-[68px]"
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0 text-left rtl:text-right">
                  <ArtworkPlaceholder
                    seed={artist.avatarSeed}
                    title={artist.name}
                    coverUrl={artist.coverUrl}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors truncate">
                        {artist.name}
                      </span>
                      {artist.persianName && (
                        <span className="text-xs text-zinc-400 font-medium truncate" dir="rtl">
                          ({artist.persianName})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 truncate mt-0.5">
                      {artist.genre}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-1 font-mono">
                      {isLive ? 'YouTube Music Verified' : `${artist.releasesCount} releases`}
                    </div>
                  </div>
                </div>

                {/* Favorite Action Button (stops propagation) */}
                <button
                  type="button"
                  onClick={(e) => handleFavoriteClick(e, artist)}
                  aria-label={isFav ? `Remove ${artist.name} from favorites` : `Add ${artist.name} to favorites`}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                    isFav
                      ? 'text-rose-500 hover:bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${isFav ? 'fill-rose-500' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
