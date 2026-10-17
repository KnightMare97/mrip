import { Disc3, Radio, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { useLanguage } from '../../context/LanguageContext';
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
  const { catalog } = useCatalog();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [filter, setFilter] = useState<ReleaseFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    Promise.all([catalog.getArtist(artistId), catalog.getReleasesByArtist(artistId)])
      .then(([art, rels]) => {
        if (!isCancelled) {
          setArtist(art);
          setReleases(rels);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [artistId, catalog]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
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

  // Filter releases
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
      <div className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40">
        <ArtworkPlaceholder
          seed={artist.avatarSeed}
          title={artist.name}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
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
          <div className="text-xs text-zinc-500 mt-2 font-mono flex items-center gap-2">
            <span>{releases.length} {t.releases.toLowerCase()}</span>
            <span>·</span>
            <span>Provider ID: {artist.providerId}</span>
          </div>
        </div>
      </div>

      {/* Filter Segmented Controls (Functional buttons with active background) */}
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
            No releases match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {filteredReleases.map((release) => {
              const totalTracks = release.discs.reduce((acc, d) => acc + d.tracks.length, 0);

              return (
                <button
                  key={release.id}
                  onClick={() => onSelectRelease(release.id)}
                  className="group flex flex-col text-left rtl:text-right rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3 hover:bg-zinc-900 hover:border-zinc-700 transition shadow-sm"
                >
                  <ArtworkPlaceholder
                    seed={release.coverSeed}
                    title={release.title}
                    size="xl"
                    className="w-full aspect-square mb-2.5"
                  />

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                      {release.title}
                    </h3>
                    {release.persianTitle && (
                      <div className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5" dir="rtl">
                        {release.persianTitle}
                      </div>
                    )}

                    {/* Unboxed Metadata (Zero-pill discipline) */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 mt-1 font-mono">
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
                      <div className="text-[10px] text-zinc-400 mt-1 truncate">
                        {release.editionLabel}
                      </div>
                    )}

                    <div className="text-[10px] text-zinc-500 mt-1">
                      {totalTracks} {t.tracks} {release.discs.length > 1 ? `(${release.discs.length} Discs)` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
