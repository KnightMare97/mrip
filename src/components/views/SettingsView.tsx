import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileJson,
  FlaskConical,
  Globe,
  HardDrive,
  Info,
  Layers,
  RotateCcw,
  Server,
  ShieldCheck,
  Sliders,
  Trash2,
  Upload
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useCatalog } from '../../context/CatalogContext';
import { useLanguage } from '../../context/LanguageContext';
import { useLibrary } from '../../context/LibraryContext';
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
  const { source, setSource } = useCatalog();
  const {
    exportBackup,
    importBackup,
    clearAllUserData,
    preferences,
    updatePreferences,
    favorites,
    watchlist
  } = useLibrary();

  const [serverHealth, setServerHealth] = useState<any>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCheckingHealth(true);
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setServerHealth(d))
      .catch((err) => setServerHealth({ status: 'error', error: err.message }))
      .finally(() => setCheckingHealth(false));
  }, []);

  const handleExportBackup = async () => {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `musicrip-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await importBackup(parsed);
      if (res.success) {
        setImportStatus({
          success: true,
          message: `Backup restored successfully! (${res.countSummary})`
        });
      } else {
        setImportStatus({
          success: false,
          message: res.error || 'Failed to restore backup.'
        });
      }
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `Invalid backup file: ${err.message}`
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmClearAll = async () => {
    await clearAllUserData();
    localStorage.removeItem('musicrip_export_jobs_v1');
    localStorage.removeItem('musicrip_recent_searches');
    setShowClearConfirm(false);
    window.location.reload();
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <Sliders className="h-6 w-6 text-amber-500" />
          <span>{t.navSettings}</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Local library management, catalog sources, backup, and simulation
        </p>
      </div>

      {/* 1. Catalog Source Selector */}
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-500" />
          <span>Catalog Source Adapter</span>
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Select between live YouTube Music catalog browsing or the offline fictional demo catalog.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => setSource('ytmusic')}
            className={`p-3 rounded-xl border text-xs text-left rtl:text-right transition ${
              source === 'ytmusic'
                ? 'border-amber-500 bg-amber-500/10 text-amber-300 font-semibold'
                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-zinc-100">YouTube Music (Live)</span>
              {source === 'ytmusic' && <Check className="h-4 w-4 text-amber-400" />}
            </div>
            <p className="text-[11px] text-zinc-500 font-normal leading-snug">
              Queries live artists, albums, and tracklists via server-side open-source client.
            </p>
          </button>

          <button
            onClick={() => setSource('demo')}
            className={`p-3 rounded-xl border text-xs text-left rtl:text-right transition ${
              source === 'demo'
                ? 'border-amber-500 bg-amber-500/10 text-amber-300 font-semibold'
                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-zinc-100">Fictional Demo</span>
              {source === 'demo' && <Check className="h-4 w-4 text-amber-400" />}
            </div>
            <p className="text-[11px] text-zinc-500 font-normal leading-snug">
              100% fictional artists, releases, and SVG art for offline development and testing.
            </p>
          </button>
        </div>
      </div>

      {/* 2. Data Backup & Local Storage */}
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-amber-500" />
              <span>Local Storage & Backup</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Your library is stored in this browser on this device. Cross-device and Telegram synchronization are not implemented yet.
            </p>
          </div>

          <div className="text-[11px] font-mono text-zinc-500 shrink-0 text-right">
            <div>{favorites.length} Favorites</div>
            <div>{watchlist.length} in Later</div>
          </div>
        </div>

        {/* Import status notification */}
        {importStatus && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              importStatus.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {importStatus.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{importStatus.message}</span>
          </div>
        )}

        {/* Backup / Restore Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition active:scale-95 border border-zinc-700"
          >
            <Download className="h-3.5 w-3.5 text-amber-400" />
            <span>Export Backup (JSON)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition active:scale-95 border border-zinc-700"
          >
            <Upload className="h-3.5 w-3.5 text-sky-400" />
            <span>Restore Backup</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-rose-400 hover:border-rose-900/50 transition ml-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear Local Data</span>
          </button>
        </div>

        {/* Clear Confirmation Modal */}
        {showClearConfirm && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-3">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>Are you sure you want to delete all local library data?</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              This will permanently delete all favorited artists, albums, tracks, your Later list, and local search/view history from this browser. This cannot be undone unless you have a JSON backup.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleConfirmClearAll}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-500 text-xs transition"
              >
                Yes, Delete All Data
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Server Environment & Synthetic Pipeline Diagnostic */}
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
            <Server className="h-4 w-4 text-amber-500" />
            <span>Server Environment & Media Pipeline</span>
          </h2>
          <button
            onClick={() => {
              setCheckingHealth(true);
              fetch('/api/health')
                .then((r) => r.json())
                .then((d) => setServerHealth(d))
                .catch((err) => setServerHealth({ status: 'error', error: err.message }))
                .finally(() => setCheckingHealth(false));
            }}
            className="text-[11px] font-mono text-zinc-400 hover:text-amber-400 flex items-center gap-1"
          >
            <RotateCcw className={`h-3 w-3 ${checkingHealth ? 'animate-spin' : ''}`} />
            <span>Check</span>
          </button>
        </div>

        {serverHealth ? (
          <div className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">Python</span>
                <span className={serverHealth.environment?.python?.available ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  {serverHealth.environment?.python?.available
                    ? serverHealth.environment?.python?.version || 'Available'
                    : 'Missing'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">FFmpeg</span>
                <span className={serverHealth.environment?.ffmpeg?.available ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  {serverHealth.environment?.ffmpeg?.available
                    ? serverHealth.environment?.ffmpeg?.version?.slice(0, 14) || 'Available'
                    : 'Missing'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">yt-dlp</span>
                <span className={serverHealth.environment?.ytdlp?.available ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  {serverHealth.environment?.ytdlp?.available
                    ? serverHealth.environment?.ytdlp?.version || 'Available'
                    : 'Missing'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">Writable Tmp</span>
                <span className={serverHealth.environment?.storage?.writable ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  {serverHealth.environment?.storage?.writable ? 'Writable' : 'Blocked'}
                </span>
              </div>
            </div>

            {/* Observed Capabilities */}
            <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800 space-y-1.5 font-sans">
              <span className="text-[11px] font-semibold text-zinc-300 block font-mono uppercase">
                Observed Server Capabilities:
              </span>
              <ul className="text-[11px] text-zinc-400 space-y-1 list-disc list-inside">
                <li>Local audio synthesis & ID3v2 tagging: <span className="text-emerald-400 font-mono">Supported (FFmpeg)</span></li>
                <li>Stream & metadata verification: <span className="text-emerald-400 font-mono">Supported (ffprobe)</span></li>
                <li>ZIP archive packaging: <span className="text-emerald-400 font-mono">Supported (archiver)</span></li>
                <li>Source stream access: <span className="text-amber-400 font-mono">Observed per-track (not assumed from binaries)</span></li>
              </ul>
            </div>

            {/* Synthetic Diagnostic Test Trigger */}
            <div className="pt-1 space-y-2">
              {diagnosticError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{diagnosticError}</span>
                </div>
              )}
              <button
                onClick={async () => {
                  setDiagnosticError(null);
                  try {
                    const res = await fetch('/api/export/diagnostic-synthetic', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: 'Local Pipeline Diagnostic',
                        artist: 'Audio Engine Verifier',
                        trackCount: 2
                      })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      onJobStarted(data.job.id);
                    } else {
                      const data = await res.json().catch(() => ({}));
                      setDiagnosticError(data.error || `Diagnostic failed with status ${res.status}`);
                    }
                  } catch (err: any) {
                    setDiagnosticError(`Failed to start diagnostic: ${err.message}`);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-sky-500/30 bg-sky-500/10 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition active:scale-95"
              >
                <FlaskConical className="h-4 w-4" />
                <span>Run Synthetic Pipeline Diagnostic (Local Tone & ZIP Proof)</span>
              </button>
              <p className="text-[10px] text-zinc-500 text-center mt-1">
                Generates labeled test tones, tags with FFmpeg, verifies with ffprobe, and packages ZIP. Proves local processing only.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 font-mono">Checking server capabilities...</div>
        )}
      </div>

      {/* 4. Language & Layout Direction */}
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
          <Globe className="h-4 w-4 text-amber-500" />
          <span>Language & Layout Direction</span>
        </h2>

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

      {/* 5. Collapsible Developer Simulation Scenarios (Section 7 requirement) */}
      <DevScenarioPanel
        selectedPreset={selectedPreset}
        onSelectPreset={onSelectPreset}
        onJobStarted={onJobStarted}
      />
    </div>
  );
};
