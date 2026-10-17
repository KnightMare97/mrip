import {
  Check,
  Cpu,
  Database,
  Globe,
  Info,
  Layers,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Trash2
} from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ExportOptions } from '../../types/export';
import { DevScenarioPanel } from '../common/DevScenarioPanel';

interface SettingsViewProps {
  selectedPreset: ExportOptions['scenarioPreset'];
  onSelectPreset: (preset: ExportOptions['scenarioPreset']) => void;
  onJobStarted: (jobId: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  selectedPreset,
  onSelectPreset,
  onJobStarted
}) => {
  const { language, setLanguage, t } = useLanguage();

  const handleResetAllData = () => {
    localStorage.removeItem('musicrip_export_jobs_v1');
    localStorage.removeItem('musicrip_recent_searches');
    window.location.reload();
  };

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
          <Sliders className="h-5 w-5 text-amber-500" />
          <span>{t.navSettings}</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Simulation scenarios, interface language, and prototype adapters
        </p>
      </div>

      {/* Developer Scenario Controls */}
      <DevScenarioPanel
        selectedPreset={selectedPreset}
        onSelectPreset={onSelectPreset}
        onJobStarted={onJobStarted}
      />

      {/* Language & Layout Direction */}
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
          <Globe className="h-4 w-4 text-amber-500" />
          <span>Language & Layout Direction</span>
        </h2>
        <p className="text-xs text-zinc-400">
          Music Rip supports English (LTR) and Persian (RTL) with mixed-script typography.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => setLanguage('en')}
            className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
              language === 'en'
                ? 'border-amber-500 bg-amber-500/10 text-amber-300 font-semibold'
                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>English (LTR)</span>
            {language === 'en' && <Check className="h-4 w-4 text-amber-400" />}
          </button>

          <button
            onClick={() => setLanguage('fa')}
            className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
              language === 'fa'
                ? 'border-amber-500 bg-amber-500/10 text-amber-300 font-semibold'
                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span dir="rtl">فارسی (RTL)</span>
            {language === 'fa' && <Check className="h-4 w-4 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* Pluggable Service Layer Status */}
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-500" />
          <span>Replaceable Service Architecture</span>
        </h2>
        <div className="space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/80">
            <span className="text-zinc-400">MusicCatalog Adapter:</span>
            <span className="text-amber-400 font-semibold">MockMusicCatalog (Active)</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/80">
            <span className="text-zinc-400">ExportService Adapter:</span>
            <span className="text-amber-400 font-semibold">SimulatedExportService (Active)</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/80">
            <span className="text-zinc-400">PWA App Shell Caching:</span>
            <span className="text-emerald-400 font-semibold">Static Only (sw.js)</span>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Both interfaces are decoupled via TypeScript definitions and React Context. In future backend phases, real MusicBrainz/Discogs or backend task queues drop into the same interfaces without changing any UI views.
        </p>
      </div>

      {/* Prototype Reset */}
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-200">Reset Prototype Data</div>
          <div className="text-[11px] text-zinc-500">Clears simulated jobs and recent searches</div>
        </div>
        <button
          onClick={handleResetAllData}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-rose-400 hover:border-rose-900/50 transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Reset All</span>
        </button>
      </div>
    </div>
  );
};
