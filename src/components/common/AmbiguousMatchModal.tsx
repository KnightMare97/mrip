import { AlertTriangle, Ban, Check, Music2 } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { AmbiguousReviewRequest, MatchCandidate } from '../../types/export';

interface AmbiguousMatchModalProps {
  review: AmbiguousReviewRequest;
  onSelectCandidate: (candidate: MatchCandidate) => void;
  onExcludeTrack: () => void;
}

export const AmbiguousMatchModal: React.FC<AmbiguousMatchModalProps> = ({
  review,
  onSelectCandidate,
  onExcludeTrack
}) => {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string>(review.candidates[0]?.id || '');

  const chosenCandidate = review.candidates.find((c) => c.id === selectedId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ambiguous-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-zinc-900 p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="ambiguous-title" className="text-base font-bold text-zinc-100">
              {t.reviewMatchTitle}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              {t.reviewMatchDesc}
            </p>
          </div>
        </div>

        {/* Target track detail */}
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 font-mono">
            Target Track in Album Order
          </div>
          <div className="font-semibold text-zinc-100">
            Disc {review.discNumber}, Track {review.trackNumber}: {review.expectedTitle}
          </div>
          <div className="text-zinc-400 text-[11px] mt-0.5">{review.expectedArtist}</div>
        </div>

        {/* Candidate List */}
        <div className="space-y-2 mb-5 max-h-60 overflow-y-auto pr-1">
          {review.candidates.map((cand) => {
            const isChecked = selectedId === cand.id;
            return (
              <label
                key={cand.id}
                onClick={() => setSelectedId(cand.id)}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  isChecked
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-zinc-800 bg-zinc-950/30 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="candidateOption"
                  checked={isChecked}
                  onChange={() => setSelectedId(cand.id)}
                  className="mt-1 accent-amber-500 h-4 w-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-100 truncate">
                      {cand.title}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                      {cand.durationText}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                    <span>{cand.source}</span>
                    <span>·</span>
                    <span className="font-mono text-amber-400/90 font-medium">
                      {Math.round(cand.matchScore * 100)}% match
                    </span>
                  </div>

                  {cand.warningNote && (
                    <div className="mt-1.5 text-[10px] text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>{cand.warningNote}</span>
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onExcludeTrack}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-zinc-700/80 bg-zinc-800/80 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
          >
            <Ban className="h-3.5 w-3.5 text-zinc-400" />
            <span>{t.excludeTrack}</span>
          </button>

          <button
            type="button"
            disabled={!chosenCandidate}
            onClick={() => chosenCandidate && onSelectCandidate(chosenCandidate)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-amber-500 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 transition active:scale-95 shadow-md shadow-amber-500/10"
          >
            <Check className="h-4 w-4" />
            <span>{t.acceptCandidate}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
