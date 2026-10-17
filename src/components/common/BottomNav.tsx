import { Bookmark, Clock, History, Library, Music, Search, Sliders } from 'lucide-react';
import React from 'react';
import { useExport } from '../../context/ExportContext';
import { useLanguage } from '../../context/LanguageContext';
import { useLibrary } from '../../context/LibraryContext';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate }) => {
  const { t } = useLanguage();
  const { jobs } = useExport();
  const { favorites, watchlist } = useLibrary();

  const activeRunningCount = jobs.filter(
    (j) =>
      ['queued', 'resolving', 'downloading', 'tagging', 'packaging', 'awaiting_review'].includes(
        j.processingStatus
      )
  ).length;

  const libraryTotal = favorites.length + watchlist.length;

  const tabs = [
    { id: 'search', label: t.navSearch, icon: Search },
    {
      id: 'library',
      label: 'Library',
      icon: Library,
      badge: libraryTotal > 0 ? libraryTotal : null
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: History,
      badge: activeRunningCount > 0 ? activeRunningCount : null
    },
    { id: 'settings', label: t.navSettings, icon: Sliders }
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-[#121214]/95 backdrop-blur-md pb-safe"
    >
      <div className="mx-auto flex h-14 max-w-md items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            currentView === tab.id ||
            (tab.id === 'search' && (currentView === 'artist' || currentView === 'release')) ||
            (tab.id === 'activity' && currentView === 'export-detail');

          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
                isActive ? 'text-amber-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
                {tab.badge !== null && tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-zinc-950 font-mono">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
