import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileArchive,
  FolderArchive,
  History,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import { useExport } from '../../context/ExportContext';
import { useLanguage } from '../../context/LanguageContext';
import { useLibrary } from '../../context/LibraryContext';
import { ExportJob } from '../../types/export';

type ActivityTab = 'exports' | 'searches' | 'viewed';

interface ActivityViewProps {
  onSelectJob: (jobId: string) => void;
  onReRunSearch: (query: string) => void;
  onOpenEntity: (type: 'artist' | 'release', id: string) => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  onSelectJob,
  onReRunSearch,
  onOpenEntity
}) => {
  const { t } = useLanguage();
  const { jobs, retryJob, simulateArtifactExpiry } = useExport();
  const {
    searchHistory,
    deleteSearchHistoryItem,
    clearSearchHistory,
    recentlyViewed,
    deleteRecentlyViewedItem,
    clearRecentlyViewed,
    preferences,
    updatePreferences
  } = useLibrary();

  const [activeTab, setActiveTab] = useState<ActivityTab>('exports');

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <History className="h-6 w-6 text-amber-500" />
            <span>Activity & History</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Local export jobs, submitted searches, and recently viewed releases
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800">
        <button
          onClick={() => setActiveTab('exports')}
          className={`flex-1 py-2 text-xs font-medium rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'exports'
              ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FolderArchive className="h-3.5 w-3.5" />
          <span>Export Jobs ({jobs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('searches')}
          className={`flex-1 py-2 text-xs font-medium rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'searches'
              ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Searches ({searchHistory.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('viewed')}
          className={`flex-1 py-2 text-xs font-medium rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'viewed'
              ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Viewed ({recentlyViewed.length})</span>
        </button>
      </div>

      {/* Tab 1: Export Activity */}
      {activeTab === 'exports' && (
        <div className="space-y-4">
          <div className="text-[11px] text-zinc-400 font-mono bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/80 leading-relaxed">
            <strong>Honest State Notice:</strong> Completed processing and expired files are independent states. Local job records do not imply that server-side archives still exist after TTL expiration.
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center space-y-3">
              <FolderArchive className="h-10 w-10 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                No export activity yet. Select an album to simulate or process an archive export.
              </p>
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
                            {new Date(job.createdAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {job.isRealPipeline ? (
                            <span className="text-[9px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                              Real Pipeline
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono text-amber-500/90 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                              Demo
                            </span>
                          )}
                          {job.isSelective && (
                            <span className="text-[9px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                              Selective ({job.totalTracks} tracks)
                            </span>
                          )}
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

                      {/* Status Badges */}
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold flex items-center gap-1.5 shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isPartial
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : isFailed
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-zinc-800 text-amber-400 border border-zinc-700'
                        }`}
                      >
                        {isCompleted && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {isPartial && <AlertTriangle className="h-3.5 w-3.5" />}
                        {isFailed && <AlertCircle className="h-3.5 w-3.5" />}
                        {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        <span>{job.processingStatus}</span>
                      </span>
                    </div>

                    {/* Bottom Status Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono pt-2 border-t border-zinc-800/60 text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span>
                          {job.successfulTracksCount}/{job.totalTracks} successful
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
                        {job.downloadRequested && (
                          <>
                            <span>·</span>
                            <span className="text-sky-400">Downloaded</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {job.isRealPipeline && job.artifactAvailability === 'available' && job.realDownloadUrl && (
                          <a
                            href={job.realDownloadUrl}
                            download={job.realZipFilename || 'album.zip'}
                            className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition"
                            title="Download real ZIP archive"
                          >
                            <Download className="h-3 w-3" />
                            <span>Download ZIP</span>
                          </a>
                        )}

                        {!job.isRealPipeline && job.artifactAvailability === 'available' && (
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
                          Inspect Job →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Search History */}
      {activeTab === 'searches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800">
            <div className="text-xs text-zinc-300">
              <span className="font-semibold">Record search queries:</span>
              <span className="text-zinc-500 ml-1.5">Only submitted searches are saved (max 50).</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.historySearchEnabled}
              onChange={(e) => updatePreferences({ historySearchEnabled: e.target.checked })}
              className="accent-amber-500 h-4 w-4 cursor-pointer"
            />
          </div>

          {searchHistory.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={clearSearchHistory}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-rose-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Search History</span>
              </button>
            </div>
          )}

          {searchHistory.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-8 text-center text-xs text-zinc-500">
              No search history recorded.
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 divide-y divide-zinc-800/60 overflow-hidden">
              {searchHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 text-xs hover:bg-zinc-900/80 transition"
                >
                  <button
                    onClick={() => onReRunSearch(item.query)}
                    className="flex items-center gap-2.5 text-left rtl:text-right flex-1 min-w-0"
                  >
                    <Search className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="font-medium text-zinc-200 truncate">{item.query}</span>
                    <span className="text-[10px] font-mono text-zinc-500">({item.useCount}x)</span>
                  </button>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-zinc-500">
                      {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <button
                      onClick={() => deleteSearchHistoryItem(item.id)}
                      className="text-zinc-500 hover:text-rose-400 transition"
                      title="Delete search record"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Recently Viewed */}
      {activeTab === 'viewed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800">
            <div className="text-xs text-zinc-300">
              <span className="font-semibold">Record viewed artists & releases:</span>
              <span className="text-zinc-500 ml-1.5">Max 50 items.</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.historyViewEnabled}
              onChange={(e) => updatePreferences({ historyViewEnabled: e.target.checked })}
              className="accent-amber-500 h-4 w-4 cursor-pointer"
            />
          </div>

          {recentlyViewed.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={clearRecentlyViewed}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-rose-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Viewing History</span>
              </button>
            </div>
          )}

          {recentlyViewed.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-8 text-center text-xs text-zinc-500">
              No recently viewed items recorded.
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 divide-y divide-zinc-800/60 overflow-hidden">
              {recentlyViewed.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 text-xs hover:bg-zinc-900/80 transition"
                >
                  <button
                    onClick={() => onOpenEntity(item.type, item.targetId)}
                    className="flex items-center gap-2.5 text-left rtl:text-right flex-1 min-w-0"
                  >
                    <Eye className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-zinc-200 truncate block">{item.title}</span>
                      {item.subtitle && <span className="text-[10px] text-zinc-400 truncate block">{item.subtitle}</span>}
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase px-1.5 py-0.5 rounded bg-zinc-800">
                      {item.type}
                    </span>
                  </button>

                  <div className="flex items-center gap-3 shrink-0 ml-2 rtl:mr-2 rtl:ml-0">
                    <span className="text-[10px] font-mono text-zinc-500">
                      {item.visitCount} visits
                    </span>
                    <button
                      onClick={() => deleteRecentlyViewedItem(item.id)}
                      className="text-zinc-500 hover:text-rose-400 transition"
                      title="Delete record"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
