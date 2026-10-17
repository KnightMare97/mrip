import { ArrowLeft, Globe, Laptop, Music2, Share2, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, id?: string) => void;
  title?: string;
  canGoBack?: boolean;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  title,
  canGoBack,
  onBack
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const { isInstallable, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-800/80 bg-[#121214]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 gap-3">
        {/* Zone 1: Back Button or Brand Wordmark */}
        <div className="flex items-center gap-2 shrink-0">
          {canGoBack && onBack ? (
            <button
              onClick={onBack}
              aria-label="Go back"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
          ) : (
            <button
              onClick={() => onNavigate('search')}
              className="flex items-center gap-2 group text-left rtl:text-right"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700/60 text-amber-500 shadow-sm group-hover:border-amber-500/50 transition-colors">
                <Music2 className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-zinc-100 group-hover:text-amber-400 transition-colors whitespace-nowrap">
                  {t.appName}
                </span>
              </div>
            </button>
          )}

          {/* Quiet Unboxed Demo Indicator */}
          <span className="hidden sm:inline text-[11px] font-mono tracking-wider text-amber-500/90 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
            {t.demoBadge}
          </span>
        </div>

        {/* Center: Current view title if in deep view */}
        {title && (
          <div className="hidden md:block max-w-[280px] lg:max-w-md truncate text-xs text-zinc-400 font-medium text-center">
            {title}
          </div>
        )}

        {/* Zone 3: Actions (Language toggle + PWA Install) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Language / RTL Toggle */}
          <button
            onClick={toggleLanguage}
            title={language === 'en' ? 'تغییر به فارسی' : 'Switch to English'}
            className="flex h-9 items-center gap-1.5 px-2.5 rounded-lg border border-zinc-800 bg-zinc-900/80 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
          >
            <Globe className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-mono">{language === 'en' ? 'فا' : 'EN'}</span>
          </button>

          {/* In-App PWA Install Button */}
          {isInstallable && (
            <button
              onClick={install}
              className="flex h-9 items-center gap-1.5 px-3 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 shadow-sm active:scale-95 transition"
            >
              <Laptop className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">{t.installApp}</span>
            </button>
          )}

          {isIOS && (
            <button
              onClick={() => setShowIOSModal(true)}
              className="flex h-9 items-center gap-1.5 px-2.5 rounded-lg border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition"
            >
              <Share2 className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden xs:inline">{t.installOnIOS}</span>
            </button>
          )}
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 border border-zinc-800 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-100 mb-2">
              Install Music Rip on iOS
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              1. Tap the <strong className="text-zinc-200">Share</strong> icon in the Safari toolbar.
              <br />
              2. Scroll down and select <strong className="text-zinc-200">Add to Home Screen</strong>.
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
