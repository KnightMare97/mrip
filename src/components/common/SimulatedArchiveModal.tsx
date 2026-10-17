import { Archive, Check, Copy, FileText, FolderArchive, X } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { SimulatedArchive } from '../../types/export';

interface SimulatedArchiveModalProps {
  archive: SimulatedArchive;
  onClose: () => void;
}

export const SimulatedArchiveModal: React.FC<SimulatedArchiveModalProps> = ({
  archive,
  onClose
}) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(0);

  const formatBytes = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleCopyManifest = () => {
    const manifestText = [
      `Archive: ${archive.filename}`,
      `Total Size: ${formatBytes(archive.totalBytes)} (Simulated)`,
      `Files:`,
      ...archive.entries.map((e) => `  - ${e.path} (${formatBytes(e.sizeBytes)})`)
    ].join('\n');

    navigator.clipboard.writeText(manifestText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const currentEntry = archive.entries[selectedEntryIndex] || archive.entries[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-inspector-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <FolderArchive className="h-4 w-4" />
            </div>
            <div>
              <h2 id="archive-inspector-title" className="text-sm font-bold text-zinc-100">
                {t.simulatedArchiveDetails}
              </h2>
              <p className="text-[11px] text-zinc-500 font-mono">
                {archive.filename} · {formatBytes(archive.totalBytes)} (Simulated)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close inspector"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Demo Notice Banner */}
        <div className="my-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 leading-relaxed">
          <strong>{t.demoBadge}:</strong> {t.archiveNotice} This inspector shows the precise archive hierarchy, track paths, and embedded ID3v2 tags prepared by the state machine.
        </div>

        {/* Content Columns: File List & ID3 Tag Details */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0 py-1">
          {/* File list */}
          <div className="flex flex-col border border-zinc-800/80 rounded-xl bg-zinc-950/40 p-2 overflow-hidden">
            <div className="text-[11px] font-semibold text-zinc-400 px-2 py-1 uppercase tracking-wider font-mono">
              {t.fileHierarchy} ({archive.entries.length})
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {archive.entries.map((entry, idx) => {
                const isSelected = selectedEntryIndex === idx;
                return (
                  <button
                    key={entry.path}
                    onClick={() => setSelectedEntryIndex(idx)}
                    className={`w-full text-left rtl:text-right px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-500/15 text-amber-300 font-medium border border-amber-500/30'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <span className="truncate">{entry.path}</span>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                      {formatBytes(entry.sizeBytes)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ID3 Tag Inspector */}
          {currentEntry && (
            <div className="flex flex-col border border-zinc-800/80 rounded-xl bg-zinc-950/40 p-3 overflow-y-auto text-xs">
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono mb-2">
                {t.id3Tags}
              </div>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Path:</span>
                  <span className="text-zinc-300 truncate max-w-[160px]">{currentEntry.path}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Title:</span>
                  <span className="text-amber-400 font-semibold">{currentEntry.id3Tags.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Artist:</span>
                  <span className="text-zinc-200">{currentEntry.id3Tags.artist}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Album:</span>
                  <span className="text-zinc-200">{currentEntry.id3Tags.album}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Track #:</span>
                  <span className="text-zinc-200">{currentEntry.id3Tags.track}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Disc #:</span>
                  <span className="text-zinc-200">{currentEntry.id3Tags.disc}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500">Year:</span>
                  <span className="text-zinc-200">{currentEntry.id3Tags.year || 'Unknown'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">Target Enc:</span>
                  <span className="text-zinc-200">MP3 / LAME ID3v2.4</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-800">
          <button
            onClick={handleCopyManifest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied Manifest' : 'Copy File Manifest'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
