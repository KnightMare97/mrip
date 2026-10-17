import React, { useState } from 'react';
import { BottomNav } from './components/common/BottomNav';
import { Header } from './components/common/Header';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { ArtistView } from './components/views/ArtistView';
import { ExportDetailView } from './components/views/ExportDetailView';
import { RecentJobsView } from './components/views/RecentJobsView';
import { ReleaseView } from './components/views/ReleaseView';
import { SearchView } from './components/views/SearchView';
import { SettingsView } from './components/views/SettingsView';
import { CatalogProvider } from './context/CatalogContext';
import { ExportProvider, useExport } from './context/ExportContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ExportOptions } from './types/export';

type ViewMode = 'search' | 'artists' | 'artist' | 'release' | 'export-detail' | 'jobs' | 'settings';

function MainApp() {
  const { t } = useLanguage();
  const { setActiveJobId } = useExport();

  const [currentView, setCurrentView] = useState<ViewMode>('search');
  const [selectedArtistId, setSelectedArtistId] = useState<string>('art-chroma-drift');
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>('rel-vortex-monolith');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [viewHistory, setViewHistory] = useState<ViewMode[]>(['search']);
  const [selectedPreset, setSelectedPreset] = useState<ExportOptions['scenarioPreset']>('default');

  const navigateTo = (view: ViewMode) => {
    setCurrentView(view);
    setViewHistory((prev) => [...prev, view]);
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

  const handleBack = () => {
    if (currentView === 'release') {
      setCurrentView('artist');
    } else if (currentView === 'artist') {
      setCurrentView('search');
    } else if (currentView === 'export-detail') {
      setCurrentView('jobs');
    } else {
      setCurrentView('search');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canGoBack = currentView === 'artist' || currentView === 'release' || currentView === 'export-detail';

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

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-12">
        {currentView === 'search' && (
          <SearchView onSelectArtist={handleSelectArtist} />
        )}

        {currentView === 'artists' && (
          <SearchView onSelectArtist={handleSelectArtist} />
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
            onViewAllJobs={() => navigateTo('jobs')}
            onBackToRelease={(relId) => {
              setSelectedReleaseId(relId);
              navigateTo('release');
            }}
          />
        )}

        {currentView === 'jobs' && (
          <RecentJobsView
            onSelectJob={handleSelectJob}
            onNavigateToSearch={() => navigateTo('search')}
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

      {/* Ergonomic Bottom Navigation Bar */}
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
      <CatalogProvider>
        <ExportProvider>
          <MainApp />
        </ExportProvider>
      </CatalogProvider>
    </LanguageProvider>
  );
}
