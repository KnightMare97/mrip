import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderArchive,
  History,
  Loader2,
  RotateCcw,
  Trash2
} from 'lucide-react';
import React from 'react';
import { useExport } from '../../context/ExportContext';
import { useLanguage } from '../../context/LanguageContext';

interface RecentJobsViewProps {
  onSelectJob: (jobId: string) => void;
  onNavigateToSearch: () => void;
}

export const RecentJobsView: React.FC<RecentJobsViewProps> = ({
  onSelectJob,
  onNavigateToSearch
}) => {
  const { t } = useLanguage();
  const { jobs, retryJob, simulateArtifactExpiry } = useExport();

  const handleClearHistory = () => {
    localStorage.removeItem('musicrip_export_jobs_v1');
    window.location.reload();
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            <span>{t.recentJobs}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Status-machine records with separate artifact availability
          </p>
        </div>

        {jobs.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-rose-400 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t.clearHistory}</span>
          </button>
        )}
      </div>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center space-y-3">
          <FolderArchive className="h-10 w-10 text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
            {t.noJobsYet}
          </p>
          <button
            onClick={onNavigateToSearch}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition"
          >
            <span>{t.navSearch}</span>
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const isCompleted = job.processingStatus === 'completed';
            const isPartial = job.processingStatus === 'partial';
            const isFailed = job.processingStatus === 'failed';
            const isRunning = !isCompleted && !isPartial && !isFailed;

            return (
              <div
                key={job.id}
                className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(job.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {job.scenarioPreset && job.scenarioPreset !== 'default' && (
                        <span className="text-[9px] font-mono text-amber-500/90 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                          {job.scenarioPreset}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onSelectJob(job.id)}
                      className="text-left rtl:text-right font-semibold text-sm text-zinc-100 hover:text-amber-400 transition truncate block w-full"
                    >
                      {job.releaseTitle}
                    </button>
                    <div className="text-xs text-zinc-400 truncate mt-0.5">
                      {job.artistName} {job.editionLabel ? `· ${job.editionLabel}` : ''}
                    </div>
                  </div>

                  {/* Processing Status Badge */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold flex items-center gap-1 shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : isPartial
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : isFailed
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-zinc-800 text-amber-400 border border-zinc-700'
                    }`}
                  >
                    {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                    {isPartial && <AlertTriangle className="h-3 w-3" />}
                    {isFailed && <AlertCircle className="h-3 w-3" />}
                    {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>{job.processingStatus}</span>
                  </span>
                </div>

                {/* Progress / Track Count & Artifact Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono pt-1 border-t border-zinc-800/60 text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span>
                      {job.successfulTracksCount}/{job.totalTracks} tracks
                    </span>
                    <span>·</span>
                    <span
                      className={
                        job.artifactAvailability === 'available'
                          ? 'text-zinc-300'
                          : job.artifactAvailability === 'expired'
                          ? 'text-purple-400'
                          : 'text-zinc-500'
                      }
                    >
                      Archive: {job.artifactAvailability}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Simulated Expiry Toggle for testing */}
                    {job.artifactAvailability === 'available' && (
                      <button
                        onClick={() => simulateArtifactExpiry(job.id)}
                        className="text-[10px] text-zinc-500 hover:text-purple-400 transition"
                        title="Simulate archive link expiration"
                      >
                        [Expire Link]
                      </button>
                    )}

                    {(isPartial || isFailed) && (
                      <button
                        onClick={() => retryJob(job.id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{t.retry}</span>
                      </button>
                    )}

                    <button
                      onClick={() => onSelectJob(job.id)}
                      className="text-[11px] text-zinc-300 hover:text-white font-medium transition"
                    >
                      Inspect →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
