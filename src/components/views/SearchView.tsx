import { Clock, Music, Search as SearchIcon, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { useLanguage } from '../../context/LanguageContext';
import { Artist } from '../../types/music';
import { ArtworkPlaceholder } from '../common/ArtworkPlaceholder';

interface SearchViewProps {
  onSelectArtist: (artistId: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onSelectArtist }) => {
  const { t } = useLanguage();
  const { catalog } = useCatalog();
  const [query, setQuery] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('musicrip_recent_searches');
      return stored ? JSON.parse(stored) : ['Chroma Drift', 'سرود نور', 'Roya & The Echo'];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let isCancelled = false;
    catalog.searchArtists(query).then((results) => {
      if (!isCancelled) {
        setArtists(results);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [query, catalog]);

  const handleSelectArtist = (artist: Artist) => {
    // Add to recent searches if not already present
    const updated = [artist.name, ...recentSearches.filter((s) => s !== artist.name)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem('musicrip_recent_searches', JSON.stringify(updated));
    } catch {
      // ignore
    }
    onSelectArtist(artist.id);
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('musicrip_recent_searches');
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Prominent Search Field */}
      <div className="relative">
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
            placeholder={t.searchPlaceholder}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 py-3.5 pl-10 pr-10 rtl:pl-10 rtl:pr-10 text-sm text-zinc-100 placeholder-zinc-500 shadow-inner focus:border-amber-500/80 focus:outline-none focus:ring-1 focus:ring-amber-500/80 transition"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search input"
              className="absolute right-3 rtl:right-auto rtl:left-3 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Recent Searches (Unboxed zero-pill styling with subtle separator) */}
      {recentSearches.length > 0 && !query && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              {t.recentSearches}
            </span>
            <button
              onClick={handleClearRecent}
              className="hover:text-zinc-300 transition text-[11px]"
            >
              {t.clearHistory}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
            {recentSearches.map((item, idx) => (
              <React.Fragment key={item}>
                <button
                  onClick={() => setQuery(item)}
                  className="hover:text-amber-400 transition text-zinc-300 py-1"
                >
                  {item}
                </button>
                {idx < recentSearches.length - 1 && (
                  <span className="text-zinc-700" aria-hidden="true">
                    /
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Artist Search Results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>{t.artistsFound}</span>
          <span>{artists.length}</span>
        </div>

        {artists.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-8 text-center text-xs text-zinc-500">
            {t.noArtistsFound}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {artists.map((artist) => (
              <button
                key={artist.id}
                onClick={() => handleSelectArtist(artist)}
                className="group flex items-center gap-3.5 p-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700/80 transition-all text-left rtl:text-right min-h-[64px]"
              >
                <ArtworkPlaceholder
                  seed={artist.avatarSeed}
                  title={artist.name}
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
                  <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1 font-mono">
                    <Music className="h-3 w-3 text-amber-500" />
                    <span>{artist.releasesCount} {t.releases.toLowerCase()}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
