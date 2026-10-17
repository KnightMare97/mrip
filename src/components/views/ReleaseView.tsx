import { Disc, Download, FileAudio, Music2, Sparkles, Tag } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { useExport } from '../../context/ExportContext';
import { useLanguage } from '../../context/LanguageContext';
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
  const { catalog } = useCatalog();
  const { startExport } = useExport();
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    catalog.getRelease(releaseId).then((rel) => {
      if (!isCancelled) {
        setRelease(rel);
        setLoading(false);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [releaseId, catalog]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return t.unknownMetadata;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalTracks = release.discs.reduce((acc, d) => acc + d.tracks.length, 0);
  const totalSeconds = release.discs.reduce(
    (acc, d) => acc + d.tracks.reduce((s, trk) => s + (trk.durationSeconds || 0), 0),
    0
  );

  const handleExportClick = async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const job = await startExport(release, { scenarioPreset: selectedPreset });
      onStartExport(job.id);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-6 pb-36">
      {/* Release Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 rounded-3xl border border-zinc-800/80 bg-zinc-900/50">
        <ArtworkPlaceholder
          seed={release.coverSeed}
          title={release.title}
          size="xl"
          className="shadow-2xl"
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
            <span className="tabular-nums">{Math.floor(totalSeconds / 60)} min</span>
            <span aria-hidden="true">·</span>
            <span className="text-zinc-300 font-semibold">
              {t.targetFormat}: {release.targetFormat || 'MP3'}
            </span>
          </div>

          <div className="mt-3 text-[11px] text-zinc-500 font-mono">
            Provider ID: {release.providerId}
            {release.label && ` · Label: ${release.label}`}
          </div>
        </div>
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

            {/* Track Rows */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 divide-y divide-zinc-800/60 overflow-hidden">
              {disc.tracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/80 transition text-xs min-h-[52px]"
                >
                  {/* Track Number */}
                  <span className="w-6 shrink-0 text-center font-mono text-zinc-500 tabular-nums font-medium">
                    {track.trackNumber.toString().padStart(2, '0')}
                  </span>

                  {/* Title & Artist Credit */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-zinc-200 truncate">
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

                  {/* Source Quality if available */}
                  {track.sourceQuality && (
                    <span className="hidden sm:inline text-[10px] font-mono text-zinc-500 shrink-0">
                      {track.sourceQuality}
                    </span>
                  )}

                  {/* Duration */}
                  <span className="font-mono text-zinc-400 tabular-nums shrink-0 text-[11px]">
                    {formatDuration(track.durationSeconds)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky Bottom Primary Action (Safely offset above fixed bottom navigation bar) */}
      <div className="fixed bottom-14 left-0 right-0 z-30 border-t border-zinc-800 bg-[#121214]/95 backdrop-blur-md p-3">
        <div className="mx-auto max-w-md flex items-center gap-3">
          <div className="flex-1 min-w-0 hidden xs:block">
            <div className="text-xs font-semibold text-zinc-200 truncate">{release.title}</div>
            <div className="text-[10px] text-amber-500 font-mono">
              {t.targetFormat}: MP3 · {totalTracks} tracks
            </div>
          </div>

          <button
            onClick={handleExportClick}
            disabled={isStarting}
            className="flex-1 xs:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition min-h-[44px]"
          >
            <Download className="h-4 w-4" />
            <span>{isStarting ? t.exporting : t.exportAlbum}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
