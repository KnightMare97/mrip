import {
  AlertCircle,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Disc3,
  Heart,
  Loader2,
  Radio,
  Sparkles
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { useLanguage } from '../../context/LanguageContext';
import { useLibrary } from '../../context/LibraryContext';
import { Artist, Release, ReleaseFilter } from '../../types/music';
import { ArtworkPlaceholder } from '../common/ArtworkPlaceholder';

interface ArtistViewProps {
  artistId: string;
  onSelectRelease: (releaseId: string) => void;
  onBack: () => void;
}

export const ArtistView: React.FC<ArtistViewProps> = ({
  artistId,
  onSelectRelease,
  onBack
}) => {
  const { t } = useLanguage();
  const { catalog, isLive } = useCatalog();
  const { isFavorite, toggleFavorite, isWatchlisted, toggleWatchlist, recordView } = useLibrary();

  const [artist, setArtist] = useState<Artist | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [filter, setFilter] = useState<ReleaseFilter>('all');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setErrorMessage(null);

    Promise.all([catalog.getArtist(artistId), catalog.getReleasesByArtist(artistId)])
      .then(([art, rels]) => {
        if (!isCancelled) {
          setArtist(art);
          setReleases(rels);
          setLoading(false);

          if (art) {
            recordView({
              id: `${isLive ? 'live' : 'demo'}:${art.providerId}`,
              type: 'artist',
              targetId: art.id,
              stableProviderId: art.providerId,
              namespace: isLive ? 'live' : 'demo',
              title: art.name,
              subtitle: art.genre,
              coverSeed: art.avatarSeed,
              coverUrl: art.coverUrl
            });
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setErrorMessage(err.message || 'Failed to load artist details.');
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [artistId, catalog, isLive]);

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
        <span className="text-xs text-zinc-400 font-mono">Loading artist and discography...</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4" />
          <span>Catalog Source Error</span>
        </div>
        <p>{errorMessage}</p>
        <button
          onClick={onBack}
          className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-medium"
        >
          ← Return to Search
        </button>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-xs text-zinc-500">
        Artist not found.
      </div>
    );
  }

  const artistFavId = `${isLive ? 'live' : 'demo'}:${artist.providerId}`;
  const isArtistFav = isFavorite(artistFavId);

  const handleToggleArtistFavorite = async () => {
    await toggleFavorite({
      id: artistFavId,
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

  const handleToggleReleaseFavorite = async (e: React.MouseEvent, release: Release) => {
    e.stopPropagation();
    const favId = `${isLive ? 'live' : 'demo'}:${release.providerId}`;
    await toggleFavorite({
      id: favId,
      namespace: isLive ? 'live' : 'demo',
      provider: isLive ? 'ytmusic' : 'fictional',
      entityType: 'release',
      stableProviderId: release.providerId,
      title: release.title,
      persianTitle: release.persianTitle,
      subtitle: release.artistName,
      coverSeed: release.coverSeed,
      coverUrl: release.coverUrl,
      addedAt: Date.now(),
      metadata: {
        artistId: release.artistId,
        artistName: release.artistName,
        releaseId: release.id,
        releaseTitle: release.title,
        editionLabel: release.editionLabel,
        year: release.year
      }
    });
  };

  const handleToggleWatchlist = async (e: React.MouseEvent, release: Release) => {
    e.stopPropagation();
    const watchId = `${isLive ? 'live' : 'demo'}:${release.providerId}`;
    const totalTracks = release.discs.reduce((acc, d) => acc + d.tracks.length, 0);

    await toggleWatchlist({
      id: watchId,
      namespace: isLive ? 'live' : 'demo',
      provider: isLive ? 'ytmusic' : 'fictional',
      releaseId: release.id,
      stableProviderId: release.providerId,
      title: release.title,
      artistName: release.artistName,
      persianTitle: release.persianTitle,
      coverSeed: release.coverSeed,
      coverUrl: release.coverUrl,
      editionLabel: release.editionLabel,
      year: release.year,
      trackCount: totalTracks,
      addedAt: Date.now()
    });
  };

  const filteredReleases = releases.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'live') return r.isLive;
    return r.type === filter;
  });

  const filterTabs: Array<{ id: ReleaseFilter; label: string }> = [
    { id: 'all', label: t.all },
    { id: 'album', label: t.albums },
    { id: 'ep', label: t.eps },
    { id: 'single', label: t.singles },
    { id: 'live', label: t.live }
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Artist Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 p-5 rounded-3xl border border-zinc-800/80 bg-zinc-900/40">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 flex-1 min-w-0 text-center sm:text-left sm:rtl:text-right">
          <ArtworkPlaceholder
            seed={artist.avatarSeed}
            title={artist.name}
            coverUrl={artist.coverUrl}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline justify-center sm:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
                {artist.name}
              </h1>
              {artist.persianName && (
                <span className="text-sm sm:text-base text-zinc-400 font-medium" dir="rtl">
                  ({artist.persianName})
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-400 mt-1">{artist.genre}</div>
            <div className="text-xs text-zinc-500 mt-2 font-mono flex items-center justify-center sm:justify-start gap-2">
              <span>{releases.length} releases available</span>
              <span>·</span>
              <span>{isLive ? 'Live YouTube Music' : 'Fictional Demo'}</span>
            </div>
          </div>
        </div>

        {/* Favorite Artist Button */}
        <button
          onClick={handleToggleArtistFavorite}
          aria-label={isArtistFav ? 'Remove artist from favorites' : 'Add artist to favorites'}
          className={`flex h-11 px-4 items-center gap-2 rounded-xl border transition shrink-0 ${
            isArtistFav
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 font-medium'
              : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-700'
          }`}
        >
          <Heart className={`h-4 w-4 ${isArtistFav ? 'fill-rose-500 text-rose-500' : ''}`} />
          <span className="text-xs">{isArtistFav ? 'Favorited' : 'Favorite Artist'}</span>
        </button>
      </div>

      {/* Optional Technical Details Toggle */}
      <div className="text-xs font-mono">
        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition"
        >
          <span>Technical identifiers</span>
          {showTechnicalDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showTechnicalDetails && (
          <div className="mt-2 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
            <div>Stable Provider ID: <span className="text-zinc-200">{artist.providerId}</span></div>
            <div>Internal Entity ID: <span className="text-zinc-200">{artist.id}</span></div>
          </div>
        )}
      </div>

      {/* Filter Segmented Controls */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 rounded-xl border border-zinc-800 overflow-x-auto">
        {filterTabs.map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors min-h-[36px] ${
                isActive
                  ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Releases Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>{t.releases}</span>
          <span>{filteredReleases.length}</span>
        </div>

        {filteredReleases.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-8 text-center text-xs text-zinc-500">
            No releases match the selected filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {filteredReleases.map((release) => {
              const relFavId = `${isLive ? 'live' : 'demo'}:${release.providerId}`;
              const isRelFav = isFavorite(relFavId);
              const isRelWatched = isWatchlisted(relFavId);
              const totalTracks = release.discs.reduce((acc, d) => acc + d.tracks.length, 0);

              return (
                <div
                  key={release.id}
                  onClick={() => onSelectRelease(release.id)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3 hover:bg-zinc-900 hover:border-zinc-700 transition shadow-sm cursor-pointer"
                >
                  <div>
                    <ArtworkPlaceholder
                      seed={release.coverSeed}
                      title={release.title}
                      coverUrl={release.coverUrl}
                      size="xl"
                      className="w-full aspect-square mb-2.5 rounded-xl"
                    />

                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1 text-left rtl:text-right">
                      {release.title}
                    </h3>
                    {release.persianTitle && (
                      <div className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5 text-left rtl:text-right" dir="rtl">
                        {release.persianTitle}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 mt-1 font-mono text-left rtl:text-right">
                      <span>{release.year || t.unknownMetadata}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{release.type}</span>
                      {release.isLive && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-500/90">{t.liveRecording}</span>
                        </>
                      )}
                    </div>

                    {release.editionLabel && (
                      <div className="text-[10px] text-zinc-400 mt-1 truncate text-left rtl:text-right">
                        {release.editionLabel}
                      </div>
                    )}
                  </div>

                  {/* Actions Row (Favorite & Later buttons) */}
                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-zinc-800/60">
                    <span className="text-[10px] font-mono text-zinc-500">
                      {totalTracks > 0 ? `${totalTracks} tracks` : 'Inspect tracks'}
                    </span>

                    <div className="flex items-center gap-1">
                      {/* Watchlist / Download Later */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleWatchlist(e, release)}
                        title={isRelWatched ? 'In Later list' : 'Add to Later'}
                        aria-label={isRelWatched ? 'Remove from Later list' : 'Add to Later'}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                          isRelWatched
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        <Bookmark className={`h-3.5 w-3.5 ${isRelWatched ? 'fill-amber-400' : ''}`} />
                      </button>

                      {/* Favorite Album */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleReleaseFavorite(e, release)}
                        title={isRelFav ? 'Favorited' : 'Favorite album'}
                        aria-label={isRelFav ? 'Remove album from favorites' : 'Favorite album'}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                          isRelFav
                            ? 'text-rose-500 bg-rose-500/10'
                            : 'text-zinc-500 hover:text-rose-400 hover:bg-zinc-800'
                        }`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${isRelFav ? 'fill-rose-500' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
