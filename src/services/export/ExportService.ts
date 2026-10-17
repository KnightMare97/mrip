import { ExportJob, ExportOptions, MatchCandidate } from '../../types/export';
import { Release } from '../../types/music';

export type JobSubscriber = (job: ExportJob) => void;

/**
 * Replaceable Export Service Interface
 * Can be implemented by a local simulation engine, an Express backend worker, or a WebSocket queue.
 */
export interface ExportService {
  getJob(jobId: string): ExportJob | null;
  getAllJobs(): ExportJob[];
  startExport(release: Release, options?: ExportOptions): Promise<ExportJob>;
  retryJob(jobId: string, options?: ExportOptions): Promise<ExportJob | null>;
  cancelJob(jobId: string): Promise<boolean>;
  resolveAmbiguousMatch(jobId: string, trackId: string, candidate: MatchCandidate | null): Promise<void>;
  simulateArtifactExpiry(jobId: string): void;
  subscribe(jobId: string, subscriber: JobSubscriber): () => void;
  subscribeAll(subscriber: (jobs: ExportJob[]) => void): () => void;
}
