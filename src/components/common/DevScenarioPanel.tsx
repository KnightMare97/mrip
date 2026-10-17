import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FlaskConical,
  RotateCcw,
  ServerOff
} from 'lucide-react';
import React, { useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { useExport } from '../../context/ExportContext';
import { useLanguage } from '../../context/LanguageContext';
import { ExportOptions } from '../../types/export';

interface DevScenarioPanelProps {
  onJobStarted?: (jobId: string) => void;
  selectedPreset: ExportOptions['scenarioPreset'];
  onSelectPreset: (preset: ExportOptions['scenarioPreset']) => void;
}

export const DevScenarioPanel: React.FC<DevScenarioPanelProps> = ({
  onJobStarted,
  selectedPreset = 'default',
  onSelectPreset
}) => {
  const { t } = useLanguage();
  const { startExport } = useExport();
  const { catalog } = useCatalog();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const scenarios: Array<{
    id: ExportOptions['scenarioPreset'];
    label: string;
    desc: string;
    icon: React.ElementType;
    color: string;
  }> = [
    {
      id: 'default',
      label: t.testSuccess,
      desc: 'All tracks resolve, download, tag, and package normally into completed ZIP.',
      icon: CheckCircle2,
      color: 'text-emerald-400'
    },
    {
      id: 'missing_track',
      label: t.testMissingTrack,
      desc: 'Track 3 source stream is unretrievable. Honest result: marked Partial, not Complete.',
      icon: AlertCircle,
      color: 'text-amber-400'
    },
    {
      id: 'ambiguous_match',
      label: t.testAmbiguousMatch,
      desc: 'Halts at track 2 to present review modal: pick verified studio or exclude live/cover.',
      icon: AlertTriangle,
      color: 'text-sky-400'
    },
    {
      id: 'server_error',
      label: t.testServerError,
      desc: 'Simulates 503 Service Unavailable during source indexing with retry recovery.',
      icon: ServerOff,
      color: 'text-rose-400'
    },
    {
      id: 'expired_archive',
      label: t.testExpiredArchive,
      desc: 'Job completes processing, but storage link availability is marked Expired.',
      icon: Clock,
      color: 'text-purple-400'
    }
  ];

  const handleQuickTrigger = async (preset: ExportOptions['scenarioPreset']) => {
    try {
      setIsTriggering(true);
      const artists = await catalog.getFeaturedArtists();
      const releases = await catalog.getReleasesByArtist(artists[0].id);
      const releaseToExport = releases[0];

      const job = await startExport(releaseToExport, { scenarioPreset: preset });
      if (onJobStarted) onJobStarted(job.id);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-all shadow-md">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left rtl:text-right"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
              {t.devPanelTitle}
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                Preset: {selectedPreset || 'default'}
              </span>
            </h3>
            <p className="text-[11px] text-zinc-500">{t.devPanelSubtitle}</p>
          </div>
        </div>
        <div className="text-zinc-400">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded Scenario Buttons */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-2">
          <div className="text-[11px] text-zinc-400 mb-2">
            Select an active preset for your next export, or trigger a test run immediately:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {scenarios.map((sc) => {
              const Icon = sc.icon;
              const isSelected = selectedPreset === sc.id;

              return (
                <div
                  key={sc.id}
                  className={`p-3 rounded-xl border transition text-left rtl:text-right flex flex-col justify-between ${
                    isSelected
                      ? 'border-amber-500/60 bg-amber-500/5'
                      : 'border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-4 w-4 ${sc.color}`} />
                        <span className="text-xs font-medium text-zinc-200">{sc.label}</span>
                      </div>
                      <input
                        type="radio"
                        name="devPreset"
                        checked={isSelected}
                        onChange={() => onSelectPreset(sc.id)}
                        className="accent-amber-500 h-3.5 w-3.5 cursor-pointer"
                        aria-label={`Select ${sc.label} preset`}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">{sc.desc}</p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-zinc-800/50 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onSelectPreset(sc.id)}
                      className="text-[10px] text-zinc-400 hover:text-amber-400 transition"
                    >
                      {isSelected ? '✓ Active' : 'Set as default'}
                    </button>
                    <button
                      type="button"
                      disabled={isTriggering}
                      onClick={() => handleQuickTrigger(sc.id)}
                      className="text-[10px] font-medium px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition active:scale-95"
                    >
                      Run Test
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-zinc-500 mt-2 font-mono">
            {t.archiveNotice}
          </p>
        </div>
      )}
    </div>
  );
};
