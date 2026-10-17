import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  FolderArchive,
  Loader2,
  Music2,
  Package,
  RotateCcw,
  Sparkles,
  StopCircle,
  Tag
} from 'lucide-react';
import React, { useState } from 'react';
import { useExport } from '../../context/ExportContext';
import { useLanguage } from '../../context/LanguageContext';
import { MatchCandidate, ProcessingStatus } from '../../types/export';
import { AmbiguousMatchModal } from '../common/AmbiguousMatchModal';
import { SimulatedArchiveModal } from '../common/SimulatedArchiveModal';

interface ExportDetailViewProps {
  jobId: string;
  onBackToRelease?: (releaseId: string) => void;
  onViewAllJobs: () => void;
}

export const ExportDetailView: React.FC<ExportDetailViewProps> = ({
  jobId,
  onBackToRelease,
  onViewAllJobs
}) => {
  const { t } = useLanguage();
  const { jobs, retryJob, cancelJob, resolveAmbiguousMatch } = useExport();
  const [showArchiveInspector, setShowArchiveInspector] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const job = jobs.find((j) => j.id === jobId);

  if (!job) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-xs text-zinc-500">
        Export job not found or removed.
      </div>
    );
  }

  const steps: Array<{ key: ProcessingStatus; label: string; icon: React.ElementType }> = [
    { key: 'queued', label: t.statusQueued, icon: Clock },
    { key: 'resolving', label: t.statusResolving, icon: Loader2 },
    { key: 'downloading', label: t.statusDownloading, icon: Download },
    { key: 'tagging', label: t.statusTagging, icon: Tag },
    { key: 'packaging', label: t.statusPackaging, icon: Package }
  ];

  // Accurate stage resolution: Only completed stages appear successful
  // If retrieval fails for all tracks, tagging and packaging are strictly skipped
  const getStageStatus = (key: ProcessingStatus): 'passed' | 'active' | 'failed' | 'skipped' => {
    if (job.processingStatus === 'completed') {
      return 'passed';
    }

    if (key === 'queued') {
      if (job.processingStatus === 'queued') return 'active';
      return 'passed';
    }

    if (key === 'resolving') {
      if (job.processingStatus === 'queued') return 'skipped';
      if (job.processingStatus === 'resolving' || job.processingStatus === 'awaiting_review') return 'active';
      return 'passed';
    }

    if (key === 'downloading') {
      if (['queued', 'resolving', 'awaiting_review'].includes(job.processingStatus)) return 'skipped';
      if (job.processingStatus === 'downloading') return 'active';
      if (job.processingStatus === 'failed' && job.successfulTracksCount === 0) return 'failed';
      if (job.successfulTracksCount > 0) return 'passed';
      return 'failed';
    }

    if (key === 'tagging') {
      if (job.processingStatus === 'failed' && job.successfulTracksCount === 0) return 'skipped';
      if (['queued', 'resolving', 'awaiting_review', 'downloading'].includes(job.processingStatus)) return 'skipped';
      if (job.processingStatus === 'tagging') return 'active';
      if (['packaging', 'completed', 'partial'].includes(job.processingStatus)) return 'passed';
      if (job.processingStatus === 'failed') return 'failed';
      return 'skipped';
    }

    if (key === 'packaging') {
      if (job.artifactAvailability === 'available') return 'passed';
      if (job.processingStatus === 'packaging') return 'active';
      if (['failed', 'queued', 'resolving', 'awaiting_review', 'downloading', 'tagging'].includes(job.processingStatus)) {
        return 'skipped';
      }
      return 'skipped';
    }

    return 'skipped';
  };

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await retryJob(job.id);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancel = async () => {
    await cancelJob(job.id);
  };

  const handleSelectCandidate = (candidate: MatchCandidate) => {
    if (!job.ambiguousReview) return;
    resolveAmbiguousMatch(job.id, job.ambiguousReview.trackId, candidate);
  };

  const handleExcludeTrack = () => {
    if (!job.ambiguousReview) return;
    resolveAmbiguousMatch(job.id, job.ambiguousReview.trackId, null);
  };

  const isTerminal = ['completed', 'partial', 'failed'].includes(job.processingStatus);

  return (
    <div className="space-y-6 pb-24">
      {/* Job Summary Card */}
      <div className="p-5 rounded-3xl border border-zinc-800 bg-zinc-900/50 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-mono mb-1">
              {job.isRealPipeline ? (
                <span className="font-semibold text-sky-400">Real Audio Pipeline</span>
              ) : (
                <span className="font-semibold text-amber-500">{t.demoBadge}</span>
              )}
              <span>·</span>
              <span className="text-zinc-500">ID: {job.id}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-100 truncate">
              {job.releaseTitle}
            </h1>
            <div className="text-xs text-zinc-400 mt-0.5">
              {job.artistName} {job.editionLabel ? `· ${job.editionLabel}` : ''}
            </div>
          </div>

          {/* Dual Status Badges */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {/* Processing Status Badge */}
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold font-mono flex items-center gap-1.5 ${
                job.processingStatus === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : job.processingStatus === 'partial'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : job.processingStatus === 'failed'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : job.processingStatus === 'awaiting_review'
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse'
                  : 'bg-zinc-800 text-amber-400 border border-zinc-700'
              }`}
            >
              {job.processingStatus === 'completed' && <CheckCircle2 className="h-3.5 w-3.5" />}
              {job.processingStatus === 'partial' && <AlertTriangle className="h-3.5 w-3.5" />}
              {job.processingStatus === 'failed' && <AlertCircle className="h-3.5 w-3.5" />}
              {!isTerminal && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>
                {job.processingStatus === 'completed' && t.statusCompleted}
                {job.processingStatus === 'partial' && t.statusPartial}
                {job.processingStatus === 'failed' && t.statusFailed}
                {job.processingStatus === 'queued' && t.statusQueued}
                {job.processingStatus === 'resolving' && t.statusResolving}
                {job.processingStatus === 'awaiting_review' && t.statusAwaitingReview}
                {job.processingStatus === 'downloading' && t.statusDownloading}
                {job.processingStatus === 'tagging' && t.statusTagging}
                {job.processingStatus === 'packaging' && t.statusPackaging}
              </span>
            </span>

            {/* Separate Artifact Availability Status */}
            <span className="text-[10px] font-mono text-zinc-400">
              {job.artifactAvailability === 'available' && `Archive: ${t.artifactAvailable}`}
              {job.artifactAvailability === 'expired' && `Archive: ${t.artifactExpired}`}
              {job.artifactAvailability === 'not_created' && `Archive: ${t.artifactNotCreated}`}
            </span>
          </div>
        </div>

        {/* Interrupted Warning Banner */}
        {job.isInterrupted && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t.interruptedBanner}</span>
          </div>
        )}

        {/* Neutral Diagnostic Summary */}
        {job.errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{job.isRealPipeline ? 'Job Outcome' : 'Export Error'}</span>
            </div>
            <p className="leading-relaxed">{job.errorMessage}</p>
          </div>
        )}

        {/* Overall Progress Bar - accurately labeled, supports indeterminate */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
            <span>{job.isRealPipeline ? 'Export Progress' : 'Progress (Simulated)'}</span>
            <span>
              {job.overallProgress > 0 || isTerminal ? `${job.overallProgress}%` : 'Processing...'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800 relative">
            {job.overallProgress <= 0 && !isTerminal ? (
              <div className="h-full w-1/3 bg-amber-400 rounded-full animate-pulse" />
            ) : (
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  job.processingStatus === 'completed'
                    ? 'bg-emerald-500'
                    : job.processingStatus === 'partial'
                    ? 'bg-amber-500'
                    : job.processingStatus === 'failed'
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
                style={{ width: `${job.overallProgress}%` }}
              />
            )}
          </div>
        </div>

        {/* State Machine Step Pipeline Indicator */}
        <div className="grid grid-cols-5 gap-1 pt-1">
          {steps.map((st) => {
            const Icon = st.icon;
            const stageStatus = getStageStatus(st.key);

            let styleClasses = 'border-zinc-800/80 bg-zinc-950/20 text-zinc-600';
            if (stageStatus === 'passed') {
              styleClasses = 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400';
            } else if (stageStatus === 'active') {
              styleClasses = 'border-amber-500 bg-amber-500/10 text-amber-300';
            } else if (stageStatus === 'failed') {
              styleClasses = 'border-rose-500/30 bg-rose-500/10 text-rose-400';
            }

            return (
              <div
                key={st.key}
                className={`flex flex-col items-center py-2 px-1 rounded-xl text-center border transition ${styleClasses}`}
              >
                <Icon
                  className={`h-4 w-4 mb-1 ${
                    stageStatus === 'active' && st.key !== 'queued' ? 'animate-spin' : ''
                  }`}
                />
                <span className="text-[10px] font-medium leading-tight truncate w-full">
                  {st.label}
                </span>
                {stageStatus === 'skipped' && isTerminal && (
                  <span className="text-[8px] font-mono opacity-60">skipped</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Primary Job Actions (Real Download, Inspector, Retry, Cancel) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800">
          {job.isRealPipeline && job.artifactAvailability === 'available' && job.realDownloadUrl && (
            <a
              href={job.realDownloadUrl}
              download={job.realZipFilename || 'album.zip'}
              className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/10 transition active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>
                Download Real ZIP ({job.realZipSizeBytes ? `${(job.realZipSizeBytes / (1024 * 1024)).toFixed(1)} MB` : 'MP3 ZIP'})
              </span>
            </a>
          )}

          {!job.isRealPipeline && job.simulatedArchive && job.artifactAvailability === 'available' && (
            <button
              onClick={() => setShowArchiveInspector(true)}
              className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/10 transition active:scale-95"
            >
              <FolderArchive className="h-4 w-4" />
              <span>{t.simulatedArchiveDetails}</span>
            </button>
          )}

          {job.artifactAvailability === 'expired' && (
            <div className="text-xs text-zinc-400 flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-400" />
              <span>{t.artifactExpired}</span>
            </div>
          )}

          {(job.processingStatus === 'partial' || job.processingStatus === 'failed') && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{t.retry}</span>
            </button>
          )}

          {!isTerminal && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-rose-400 hover:border-rose-900/50 transition"
            >
              <StopCircle className="h-4 w-4" />
              <span>{t.cancel}</span>
            </button>
          )}

          <button
            onClick={onViewAllJobs}
            className="py-2.5 px-3 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            {t.recentJobs}
          </button>
        </div>
      </div>

      {/* Track By Track Status Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>Tracks ({job.successfulTracksCount}/{job.totalTracks} Succeeded)</span>
          {job.failedTracksCount > 0 && (
            <span className="text-rose-400 font-semibold">{job.failedTracksCount} Failed</span>
          )}
          {job.excludedTracksCount > 0 && (
            <span className="text-zinc-400">{job.excludedTracksCount} Excluded</span>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 divide-y divide-zinc-800/60 overflow-hidden">
          {job.tracks.map((track) => (
            <div
              key={track.trackId}
              className="flex items-center gap-3 px-4 py-3 text-xs min-h-[52px]"
            >
              {/* Disc & Track Number */}
              <span className="w-10 shrink-0 font-mono text-zinc-500 tabular-nums">
                {track.discNumber > 1 ? `${track.discNumber}-` : ''}
                {track.trackNumber.toString().padStart(2, '0')}
              </span>

              {/* Title & Status */}
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
                </div>

                {track.failureReason && (
                  <div className="text-[11px] text-rose-400 mt-0.5 leading-snug">
                    {track.diagnostic?.category && (
                      <span className="inline-block px-1.5 py-0.2 rounded bg-rose-500/10 border border-rose-500/20 text-[9px] uppercase font-mono mr-1.5">
                        {track.diagnostic.category.replace('_', ' ')}
                      </span>
                    )}
                    <span>{track.failureReason}</span>
                  </div>
                )}

                {track.selectedCandidate && (
                  <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                    Matched: {track.selectedCandidate.title}
                  </div>
                )}
              </div>

              {/* Individual Track Status */}
              <div className="shrink-0 text-right font-mono text-[11px]">
                {track.status === 'completed' && (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Ready</span>
                  </span>
                )}
                {track.status === 'downloading' && (
                  <span className="text-amber-400 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>{track.progressPercent}%</span>
                  </span>
                )}
                {track.status === 'resolving' && (
                  <span className="text-sky-400">Resolving...</span>
                )}
                {track.status === 'tagging' && (
                  <span className="text-amber-400 flex items-center gap-1">
                    <Tag className="h-3 w-3 animate-spin" />
                    <span>Tagging</span>
                  </span>
                )}
                {track.status === 'pending' && (
                  <span className="text-zinc-600">Pending</span>
                )}
                {track.status === 'failed' && (
                  <span className="text-rose-400 font-semibold">
                    {track.diagnostic?.category === 'source_restriction'
                      ? 'Restricted'
                      : track.diagnostic?.category === 'timeout'
                      ? 'Timed Out'
                      : track.diagnostic?.category === 'extraction_failure'
                      ? 'Unavailable'
                      : track.diagnostic?.category === 'validation_error'
                      ? 'Invalid ID'
                      : 'Failed'}
                  </span>
                )}
                {track.status === 'excluded' && (
                  <span className="text-zinc-500">Excluded</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ambiguous Review Modal */}
      {job.ambiguousReview && job.processingStatus === 'awaiting_review' && (
        <AmbiguousMatchModal
          review={job.ambiguousReview}
          onSelectCandidate={handleSelectCandidate}
          onExcludeTrack={handleExcludeTrack}
        />
      )}

      {/* Simulated Archive Inspector Modal */}
      {showArchiveInspector && job.simulatedArchive && (
        <SimulatedArchiveModal
          archive={job.simulatedArchive}
          onClose={() => setShowArchiveInspector(false)}
        />
      )}
    </div>
  );
};
