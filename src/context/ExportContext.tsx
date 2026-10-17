import React, { createContext, useContext, useEffect, useState } from 'react';
import { ExportService } from '../services/export/ExportService';
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
  initialService?: ExportService;
}> = ({ children, initialService = defaultExportService }) => {
  const [service] = useState<ExportService>(initialService);
  const [jobs, setJobs] = useState<ExportJob[]>(() => initialService.getAllJobs());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = service.subscribeAll((updatedJobs) => {
      setJobs([...updatedJobs]);
    });
    return unsub;
  }, [service]);

  const activeJob = jobs.find((j) => j.id === activeJobId) || null;

  const startExport = async (release: Release, options?: ExportOptions) => {
    const job = await service.startExport(release, options);
    setActiveJobId(job.id);
    return job;
  };

  const retryJob = async (jobId: string, options?: ExportOptions) => {
    const job = await service.retryJob(jobId, options);
    if (job) setActiveJobId(job.id);
    return job;
  };

  const cancelJob = async (jobId: string) => {
    return service.cancelJob(jobId);
  };

  const resolveAmbiguousMatch = async (
    jobId: string,
    trackId: string,
    candidate: MatchCandidate | null
  ) => {
    return service.resolveAmbiguousMatch(jobId, trackId, candidate);
  };

  const simulateArtifactExpiry = (jobId: string) => {
    service.simulateArtifactExpiry(jobId);
  };

  return (
    <ExportContext.Provider
      value={{
        service,
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
