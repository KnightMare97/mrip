import React, { useState } from 'react';
import { BottomNav } from './components/common/BottomNav';
import { Header } from './components/common/Header';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { UndoToast } from './components/common/UndoToast';
import { ActivityView } from './components/views/ActivityView';
import { ArtistView } from './components/views/ArtistView';
import { ExportDetailView } from './components/views/ExportDetailView';
import { LibraryView } from './components/views/LibraryView';
import { ReleaseView } from './components/views/ReleaseView';
import { SearchView } from './components/views/SearchView';
import { SettingsView } from './components/views/SettingsView';
import { CatalogProvider } from './context/CatalogContext';
import { ExportProvider, useExport } from './context/ExportContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { LibraryProvider } from './context/LibraryContext';
import { ExportOptions } from './types/export';

type ViewMode = 'search' | 'library' | 'activity' | 'settings' | 'artist' | 'release' | 'export-detail';

function MainApp() {
  const { t } = useLanguage();
  const { setActiveJobId } = useExport();

  const [currentView, setCurrentView] = useState<ViewMode>('search');
  const [selectedArtistId, setSelectedArtistId] = useState<string>('art-chroma-drift');
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>('rel-vortex-monolith');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ExportOptions['scenarioPreset']>('default');

  const navigateTo = (view: ViewMode) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectArtist = (artistId: string) => {
    setSelectedArtistId(artistId);
    navigateTo('artist');
  };

  const handleSelectRelease = (releaseId: string) => {
    setSelectedReleaseId(releaseId);
    navigateTo('release');
  };

  const handleStartExport = (jobId: string) => {
    setSelectedJobId(jobId);
    setActiveJobId(jobId);
    navigateTo('export-detail');
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setActiveJobId(jobId);
    navigateTo('export-detail');
  };

  const handleOpenEntity = (type: 'artist' | 'release', id: string) => {
    if (type === 'artist') {
      handleSelectArtist(id);
    } else {
      handleSelectRelease(id);
    }
  };

  const handleBack = () => {
    if (currentView === 'release') {
      setCurrentView('artist');
    } else if (currentView === 'artist') {
      setCurrentView('search');
    } else if (currentView === 'export-detail') {
      setCurrentView('activity');
    } else {
      setCurrentView('search');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canGoBack =
    currentView === 'artist' || currentView === 'release' || currentView === 'export-detail';

  return (
    <div className="min-h-screen bg-[#121214] text-zinc-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-300">
      {/* Top Header */}
      <Header
        currentView={currentView}
        onNavigate={(v) => navigateTo(v as ViewMode)}
        canGoBack={canGoBack}
        onBack={handleBack}
      />

      {/* Network Offline Alert */}
      <OfflineIndicator />

      {/* Undo Notification Banner */}
      <UndoToast />

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-12">
        {currentView === 'search' && (
          <SearchView onSelectArtist={handleSelectArtist} />
        )}

        {currentView === 'library' && (
          <LibraryView
            onSelectArtist={handleSelectArtist}
            onSelectRelease={handleSelectRelease}
            onStartExportRelease={handleSelectRelease}
            onNavigateToSearch={() => navigateTo('search')}
          />
        )}

        {currentView === 'activity' && (
          <ActivityView
            onSelectJob={handleSelectJob}
            onReRunSearch={(q) => {
              navigateTo('search');
            }}
            onOpenEntity={handleOpenEntity}
          />
        )}

        {currentView === 'artist' && (
          <ArtistView
            artistId={selectedArtistId}
            onSelectRelease={handleSelectRelease}
            onBack={handleBack}
          />
        )}

        {currentView === 'release' && (
          <ReleaseView
            releaseId={selectedReleaseId}
            onStartExport={handleStartExport}
            onBack={handleBack}
            selectedPreset={selectedPreset}
          />
        )}

        {currentView === 'export-detail' && selectedJobId && (
          <ExportDetailView
            jobId={selectedJobId}
            onViewAllJobs={() => navigateTo('activity')}
            onBackToRelease={(relId) => {
              setSelectedReleaseId(relId);
              navigateTo('release');
            }}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            selectedPreset={selectedPreset}
            onSelectPreset={setSelectedPreset}
            onJobStarted={handleStartExport}
          />
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav
        currentView={currentView}
        onNavigate={(v) => navigateTo(v as ViewMode)}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <LibraryProvider>
        <CatalogProvider>
          <ExportProvider>
            <MainApp />
          </ExportProvider>
        </CatalogProvider>
      </LibraryProvider>
    </LanguageProvider>
  );
}
