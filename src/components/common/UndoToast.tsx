import { RotateCcw, X } from 'lucide-react';
import React from 'react';
import { useLibrary } from '../../context/LibraryContext';

export const UndoToast: React.FC = () => {
  const { undoToast, dismissUndo } = useLibrary();

  if (!undoToast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 left-4 right-4 z-50 mx-auto max-w-md flex items-center justify-between gap-3 rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <span className="text-xs text-zinc-200 font-medium truncate flex-1">
        {undoToast.message}
      </span>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={undoToast.onUndo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-xs font-semibold text-zinc-950 hover:bg-amber-400 active:scale-95 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Undo</span>
        </button>
        <button
          onClick={dismissUndo}
          aria-label="Dismiss undo message"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
