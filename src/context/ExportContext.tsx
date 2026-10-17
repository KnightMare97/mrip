import React, { createContext, useContext, useEffect, useState } from 'react';
import { ExportService } from '../services/export/ExportService';
import { serverExportService } from '../services/export/ServerExportService';
import { defaultExportService } from '../services/export/SimulatedExportService';
import { ExportJob, ExportOptions, MatchCandidate } from '../types/export';
import { Release } from '../types/music';

interface ExportContextType {
  service: ExportService;
  jobs: ExportJob[];
  activeJob: ExportJob | null;
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;
  startExport: (release: Release, options?: ExportOptions) => Promise<ExportJob>;
  retryJob: (jobId: string, options?: ExportOptions) => Promise<ExportJob | null>;
  cancelJob: (jobId: string) => Promise<boolean>;
  resolveAmbiguousMatch: (jobId: string, trackId: string, candidate: MatchCandidate | null) => Promise<void>;
  simulateArtifactExpiry: (jobId: string) => void;
}

const ExportContext = createContext<ExportContextType | undefined>(undefined);

export const ExportProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [simJobs, setSimJobs] = useState<ExportJob[]>(() => defaultExportService.getAllJobs());
  const [srvJobs, setSrvJobs] = useState<ExportJob[]>(() => serverExportService.getAllJobs());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    const unsubSim = defaultExportService.subscribeAll((updatedJobs) => {
      setSimJobs([...updatedJobs]);
    });
    const unsubSrv = serverExportService.subscribeAll((updatedJobs) => {
      setSrvJobs([...updatedJobs]);
    });
    return () => {
      unsubSim();
      unsubSrv();
    };
  }, []);

  // Merge and deduplicate by job id
  const jobsMap = new Map<string, ExportJob>();
  simJobs.forEach((j) => jobsMap.set(j.id, j));
  srvJobs.forEach((j) => jobsMap.set(j.id, j));
  const jobs = Array.from(jobsMap.values()).sort((a, b) => b.createdAt - a.createdAt);

  const activeJob = jobs.find((j) => j.id === activeJobId) || null;

  const startExport = async (release: Release, options?: ExportOptions) => {
    const isLiveRelease = release.id.startsWith('ytm-rel:') || release.providerId.startsWith('ytmusic:');
    const shouldUseReal = options?.exportMode === 'real' || (options?.exportMode !== 'simulated' && isLiveRelease);

    let job: ExportJob;
    if (shouldUseReal) {
      job = await serverExportService.startExport(release, options);
    } else {
      job = await defaultExportService.startExport(release, options);
    }

    setActiveJobId(job.id);
    return job;
  };

  const retryJob = async (jobId: string, options?: ExportOptions) => {
    const existing = jobs.find((j) => j.id === jobId);
    let job: ExportJob | null = null;

    if (existing?.isRealPipeline) {
      job = await serverExportService.retryJob(jobId, options);
    } else {
      job = await defaultExportService.retryJob(jobId, options);
    }

    if (job) setActiveJobId(job.id);
    return job;
  };

  const cancelJob = async (jobId: string) => {
    const existing = jobs.find((j) => j.id === jobId);
    if (existing?.isRealPipeline) {
      return serverExportService.cancelJob(jobId);
    }
    return defaultExportService.cancelJob(jobId);
  };

  const resolveAmbiguousMatch = async (
    jobId: string,
    trackId: string,
    candidate: MatchCandidate | null
  ) => {
    return defaultExportService.resolveAmbiguousMatch(jobId, trackId, candidate);
  };

  const simulateArtifactExpiry = (jobId: string) => {
    defaultExportService.simulateArtifactExpiry(jobId);
    serverExportService.simulateArtifactExpiry(jobId);
  };

  return (
    <ExportContext.Provider
      value={{
        service: defaultExportService,
        jobs,
        activeJob,
        activeJobId,
        setActiveJobId,
        startExport,
        retryJob,
        cancelJob,
        resolveAmbiguousMatch,
        simulateArtifactExpiry
      }}
    >
      {children}
    </ExportContext.Provider>
  );
};

export function useExport() {
  const context = useContext(ExportContext);
  if (!context) {
    throw new Error('useExport must be used within an ExportProvider');
  }
  return context;
}
