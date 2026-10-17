import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Disc,
  Download,
  FolderArchive,
  Heart,
  Layers,
  Loader2,
  Music2,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { useExport } from '../../context/ExportContext';
import { useLanguage } from '../../context/LanguageContext';
import { useLibrary } from '../../context/LibraryContext';
import { ExportOptions } from '../../types/export';
import { Release, Track } from '../../types/music';
import { ArtworkPlaceholder } from '../common/ArtworkPlaceholder';

interface ReleaseViewProps {
  releaseId: string;
  onStartExport: (jobId: string) => void;
  onBack: () => void;
  selectedPreset?: ExportOptions['scenarioPreset'];
}

export const ReleaseView: React.FC<ReleaseViewProps> = ({
  releaseId,
  onStartExport,
  onBack,
  selectedPreset = 'default'
}) => {
  const { t } = useLanguage();
  const { catalog, isLive } = useCatalog();
  const { startExport, jobs } = useExport();
  const {
    isFavorite,
    toggleFavorite,
    isWatchlisted,
    toggleWatchlist,
    recordView
  } = useLibrary();

  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [exportMode, setExportMode] = useState<'real' | 'simulated'>(isLive ? 'real' : 'simulated');

  // Selective track export state
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setErrorMessage(null);

    catalog
      .getRelease(releaseId)
      .then((rel) => {
        if (!isCancelled) {
          setRelease(rel);
          setLoading(false);

          if (rel) {
            // Default all tracks selected
            const allIds = rel.discs.flatMap((d) => d.tracks.map((t) => t.id));
            setSelectedTrackIds(new Set(allIds));

            // Record viewed item
            recordView({
              id: `${isLive ? 'live' : 'demo'}:${rel.providerId}`,
              type: 'release',
              targetId: rel.id,
              stableProviderId: rel.providerId,
              namespace: isLive ? 'live' : 'demo',
              title: rel.title,
              subtitle: rel.artistName,
              coverSeed: rel.coverSeed,
              coverUrl: rel.coverUrl
            });
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setErrorMessage(err.message || 'Failed to load release details.');
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [releaseId, catalog, isLive]);

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
        <span className="text-xs text-zinc-400 font-mono">Loading release and tracks...</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4" />
          <span>Release Load Error</span>
        </div>
        <p>{errorMessage}</p>
        <button
          onClick={onBack}
          className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-medium"
        >
          ← Return to Artist
        </button>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-xs text-zinc-500">
        Release not found.
      </div>
    );
  }

  const allTracks = release.discs.flatMap((d) => d.tracks);
  const totalTracks = allTracks.length;
  const selectedCount = selectedTrackIds.size;
  const isAllSelected = selectedCount === totalTracks && totalTracks > 0;
  const isNoneSelected = selectedCount === 0;

  const totalSeconds = release.discs.reduce(
    (acc, d) =>
      acc +
      d.tracks.reduce((s, trk) => {
        return selectedTrackIds.has(trk.id) ? s + (trk.durationSeconds || 0) : s;
      }, 0),
    0
  );

  const formatDuration = (seconds?: number) => {
    if (!seconds) return t.unknownMetadata;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if an existing active or completed export job exists for this release
  const existingJob = jobs.find(
    (j) =>
      j.releaseId === release.id &&
      (j.processingStatus === 'completed' ||
        ['queued', 'resolving', 'downloading', 'tagging', 'packaging'].includes(
          j.processingStatus
        ))
  );

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(allTracks.map((t) => t.id)));
    }
  };

  const handleToggleTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  const relFavId = `${isLive ? 'live' : 'demo'}:${release.providerId}`;
  const isRelFav = isFavorite(relFavId);
  const isRelWatched = isWatchlisted(relFavId);

  const handleToggleReleaseFavorite = async () => {
    await toggleFavorite({
      id: relFavId,
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

  const handleToggleWatchlist = async () => {
    await toggleWatchlist({
      id: relFavId,
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

  const handleToggleTrackFavorite = async (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    const trackFavId = `${isLive ? 'live' : 'demo'}:${track.providerId}`;
    await toggleFavorite({
      id: trackFavId,
      namespace: isLive ? 'live' : 'demo',
      provider: isLive ? 'ytmusic' : 'fictional',
      entityType: 'track',
      stableProviderId: track.providerId,
      title: track.title,
      persianTitle: track.persianTitle,
      subtitle: track.artistCredit || release.artistName,
      coverSeed: release.coverSeed,
      coverUrl: release.coverUrl,
      addedAt: Date.now(),
      metadata: {
        artistId: release.artistId,
        artistName: release.artistName,
        releaseId: release.id,
        releaseTitle: release.title,
        discNumber: track.discNumber,
        trackNumber: track.trackNumber,
        durationSeconds: track.durationSeconds
      }
    });
  };

  const handleExportClick = async () => {
    if (isStarting || isNoneSelected) return;
    setIsStarting(true);
    try {
      const selectedList = Array.from(selectedTrackIds);
      const job = await startExport(release, {
        exportMode,
        scenarioPreset: selectedPreset,
        selectedTrackIds: selectedList
      });
      onStartExport(job.id);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-6 pb-40">
      {/* Release Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 rounded-3xl border border-zinc-800/80 bg-zinc-900/50 shadow-sm">
        <ArtworkPlaceholder
          seed={release.coverSeed}
          title={release.title}
          coverUrl={release.coverUrl}
          size="xl"
          className="shadow-2xl rounded-2xl"
        />

        <div className="flex-1 min-w-0 text-center sm:text-left sm:rtl:text-right">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-500 font-semibold">
              {release.type}
            </span>
            {release.isLive && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {t.liveRecording}
                </span>
              </>
            )}
            {release.editionLabel && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-[11px] font-mono text-zinc-300">
                  {release.editionLabel}
                </span>
              </>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 mb-1">
            {release.title}
          </h1>
          {release.persianTitle && (
            <div className="text-sm sm:text-base text-zinc-400 font-medium mb-2" dir="rtl">
              {release.persianTitle}
            </div>
          )}

          <div className="text-sm font-semibold text-zinc-300 mb-3">
            {release.artistName}
            {release.persianArtistName && (
              <span className="text-zinc-400 font-normal mr-1.5 ml-1.5" dir="rtl">
                ({release.persianArtistName})
              </span>
            )}
          </div>

          {/* Metadata Specs (Zero-Pill discipline) */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 text-xs text-zinc-500 font-mono">
            <span>{release.year ? `Year ${release.year}` : `Year ${t.unknownMetadata}`}</span>
            <span aria-hidden="true">·</span>
            <span>{totalTracks} {t.tracks}</span>
            <span aria-hidden="true">·</span>
            <span className="text-zinc-300 font-semibold">
              {t.targetFormat}: {release.targetFormat || 'MP3'}
            </span>
          </div>

          {/* Action Row: Favorite Album & Watchlist Later */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-3 mt-3 border-t border-zinc-800/80">
            <button
              onClick={handleToggleReleaseFavorite}
              aria-label={isRelFav ? 'Remove album from favorites' : 'Favorite album'}
              className={`flex h-9 px-3 items-center gap-1.5 rounded-xl border text-xs font-medium transition ${
                isRelFav
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${isRelFav ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{isRelFav ? 'Favorited' : 'Favorite'}</span>
            </button>

            <button
              onClick={handleToggleWatchlist}
              aria-label={isRelWatched ? 'Remove from Later list' : 'Download Later'}
              className={`flex h-9 px-3 items-center gap-1.5 rounded-xl border text-xs font-medium transition ${
                isRelWatched
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${isRelWatched ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>{isRelWatched ? 'In Later List' : 'Download Later'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate / Existing Export Warning */}
      {existingJob && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Existing Export Record Detected:</span>
            <span className="text-zinc-300">
              An export for this release was previously processed (Status: {existingJob.processingStatus}, Archive: {existingJob.artifactAvailability}).
              You can start a fresh attempt below with your selected tracks.
            </span>
          </div>
        </div>
      )}

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
            <div>Stable Provider ID: <span className="text-zinc-200">{release.providerId}</span></div>
            <div>Internal Entity ID: <span className="text-zinc-200">{release.id}</span></div>
          </div>
        )}
      </div>

      {/* Export Mode Selector: Real Pipeline vs State Machine Demo */}
      <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-amber-500" />
            <span>Export Mode:</span>
          </span>
          <span className="text-[11px] font-mono text-amber-400">
            {exportMode === 'real' ? 'Real Audio Pipeline (Server)' : 'State-Machine Demo (Client)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setExportMode('real')}
            className={`p-2.5 rounded-xl border text-left rtl:text-right transition ${
              exportMode === 'real'
                ? 'border-amber-500 bg-amber-500/10 text-amber-300 font-semibold'
                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white'
            }`}
          >
            <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
              <span>Real Audio Pipeline</span>
              {exportMode === 'real' && <Check className="h-3.5 w-3.5 text-amber-400" />}
            </div>
            <div className="text-[11px] text-zinc-400 font-normal mt-0.5">
              {isLive
                ? 'Downloads audio via server yt-dlp & packages real MP3 ZIP'
                : 'Synthesizes clean audio tones via FFmpeg & packages real MP3 ZIP'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setExportMode('simulated')}
            className={`p-2.5 rounded-xl border text-left rtl:text-right transition ${
              exportMode === 'simulated'
                ? 'border-amber-500 bg-amber-500/10 text-amber-300 font-semibold'
                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white'
            }`}
          >
            <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
              <span>Simulated Demo</span>
              {exportMode === 'simulated' && <Check className="h-3.5 w-3.5 text-amber-400" />}
            </div>
            <div className="text-[11px] text-zinc-400 font-normal mt-0.5">
              State-machine simulation with presets and virtual archive inspector
            </div>
          </button>
        </div>
      </div>

      {/* Selective Track Export Controls */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-200">
            Select Tracks for Export:
          </span>
          <span className="text-xs font-mono text-amber-400">
            {selectedCount} of {totalTracks} selected
          </span>
        </div>

        <button
          onClick={handleToggleSelectAll}
          className="text-xs font-medium text-amber-400 hover:text-amber-300 transition py-1 px-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900"
        >
          {isAllSelected ? 'Clear Selection' : 'Select All'}
        </button>
      </div>

      {/* Ordered Tracklist Grouped by Disc */}
      <div className="space-y-6">
        {release.discs.map((disc) => (
          <div key={disc.discNumber} className="space-y-2">
            {/* Disc Header if multi-disc */}
            {release.discs.length > 1 && (
              <div className="flex items-center gap-2 px-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                <Disc className="h-4 w-4 text-amber-500" />
                <span>
                  {t.disc} {disc.discNumber}
                  {disc.title ? ` — ${disc.title}` : ''}
                </span>
                <span className="text-zinc-600">({disc.tracks.length} tracks)</span>
              </div>
            )}

            {/* Track Rows with Selection Checkboxes */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 divide-y divide-zinc-800/60 overflow-hidden">
              {disc.tracks.map((track) => {
                const isSelected = selectedTrackIds.has(track.id);
                const trackFavId = `${isLive ? 'live' : 'demo'}:${track.providerId}`;
                const isTrkFav = isFavorite(trackFavId);

                return (
                  <div
                    key={track.id}
                    onClick={() => handleToggleTrack(track.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition text-xs min-h-[52px] select-none ${
                      isSelected
                        ? 'bg-zinc-900/90'
                        : 'opacity-50 hover:opacity-80 bg-zinc-950/20'
                    }`}
                  >
                    {/* Accessible Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleTrack(track.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select track ${track.trackNumber}: ${track.title}`}
                      className="accent-amber-500 h-4 w-4 rounded cursor-pointer shrink-0"
                    />

                    {/* Track Number */}
                    <span className="w-6 shrink-0 text-center font-mono text-zinc-500 tabular-nums font-medium">
                      {track.trackNumber.toString().padStart(2, '0')}
                    </span>

                    {/* Title & Artist Credit */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`font-medium truncate ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>
                          {track.title}
                        </span>
                        {track.persianTitle && (
                          <span className="text-[11px] text-zinc-400 truncate" dir="rtl">
                            ({track.persianTitle})
                          </span>
                        )}
                        {track.isBonus && (
                          <span className="text-[10px] font-mono text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                            {t.bonusTrack}
                          </span>
                        )}
                      </div>

                      {track.artistCredit && track.artistCredit !== release.artistName && (
                        <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {track.artistCredit}
                        </div>
                      )}
                    </div>

                    {/* Duration */}
                    <span className="font-mono text-zinc-400 tabular-nums shrink-0 text-[11px]">
                      {formatDuration(track.durationSeconds)}
                    </span>

                    {/* Track Favorite Toggle */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleTrackFavorite(e, track)}
                      title={isTrkFav ? 'Favorited' : 'Favorite track'}
                      aria-label={isTrkFav ? 'Remove track from favorites' : 'Favorite track'}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-rose-400 transition shrink-0"
                    >
                      <Heart className={`h-3.5 w-3.5 ${isTrkFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky Bottom Primary Action (Safely offset above bottom navigation bar) */}
      <div className="fixed bottom-14 left-0 right-0 z-30 border-t border-zinc-800 bg-[#121214]/95 backdrop-blur-md p-3">
        <div className="mx-auto max-w-md flex items-center gap-3">
          <div className="flex-1 min-w-0 hidden xs:block">
            <div className="text-xs font-semibold text-zinc-200 truncate">{release.title}</div>
            <div className="text-[10px] text-amber-500 font-mono">
              {selectedCount} of {totalTracks} tracks selected · {isAllSelected ? 'Full Album' : 'Selective'}
            </div>
          </div>

          <button
            onClick={handleExportClick}
            disabled={isStarting || isNoneSelected}
            className="flex-1 xs:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-amber-500/20 active:scale-[0.98] transition min-h-[44px]"
          >
            <Download className="h-4 w-4" />
            <span>
              {isStarting
                ? t.exporting
                : exportMode === 'real'
                ? isAllSelected
                  ? 'Export Album (Real ZIP)'
                  : `Export Selected (${selectedCount}) (Real ZIP)`
                : isAllSelected
                ? t.exportAlbum
                : `Simulate Export (${selectedCount}) (Demo)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
