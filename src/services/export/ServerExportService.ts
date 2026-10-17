import {
  ArtifactAvailability,
  ExportJob,
  ExportOptions,
  MatchCandidate,
  ProcessingStatus,
  TrackExportItem
} from '../../types/export';
import { Release, Track } from '../../types/music';
import { ExportService, JobSubscriber } from './ExportService';

const STORAGE_KEY = 'musicrip_export_jobs_v1';

export class ServerExportService implements ExportService {
  private jobs: Map<string, ExportJob> = new Map();
  private subscribers: Map<string, Set<JobSubscriber>> = new Map();
  private allSubscribers: Set<(jobs: ExportJob[]) => void> = new Set();
  private pollingTimers: Map<string, any> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: ExportJob[] = JSON.parse(data);
        parsed.forEach((job) => {
          this.jobs.set(job.id, job);
        });
      }
    } catch {
      // Fallback
    }
  }

  private saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      const list = Array.from(this.jobs.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Fallback
    }
  }

  private notify(job: ExportJob) {
    this.jobs.set(job.id, { ...job });
    this.saveToStorage();

    const subs = this.subscribers.get(job.id);
    if (subs) {
      subs.forEach((cb) => cb({ ...job }));
    }
    const allList = this.getAllJobs();
    this.allSubscribers.forEach((cb) => cb(allList));
  }

  getJob(jobId: string): ExportJob | null {
    return this.jobs.get(jobId) || null;
  }

  getAllJobs(): ExportJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }

  subscribe(jobId: string, subscriber: JobSubscriber): () => void {
    if (!this.subscribers.has(jobId)) {
      this.subscribers.set(jobId, new Set());
    }
    this.subscribers.get(jobId)!.add(subscriber);

    const current = this.getJob(jobId);
    if (current) subscriber({ ...current });

    return () => {
      this.subscribers.get(jobId)?.delete(subscriber);
    };
  }

  subscribeAll(subscriber: (jobs: ExportJob[]) => void): () => void {
    this.allSubscribers.add(subscriber);
    subscriber(this.getAllJobs());
    return () => {
      this.allSubscribers.delete(subscriber);
    };
  }

  async startExport(release: Release, options?: ExportOptions): Promise<ExportJob> {
    const allTracks: Track[] = release.discs.flatMap((d) => d.tracks);
    const selectedTrackIds = options?.selectedTrackIds;
    const isSelective = !!selectedTrackIds && selectedTrackIds.length < allTracks.length;

    const res = await fetch('/api/export/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        release,
        selectedTrackIds: options?.selectedTrackIds
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to start server export (${res.status})`);
    }

    const data = await res.json();
    const serverJob = data.job;

    const tracks: TrackExportItem[] = (serverJob.tracks || []).map((t: any) => ({
      trackId: t.trackId,
      discNumber: t.discNumber || 1,
      trackNumber: t.trackNumber,
      title: t.title,
      artistCredit: t.artistCredit,
      status: t.status === 'converting' ? 'tagging' : t.status,
      progressPercent: t.progressPercent || 0,
      failureReason: t.error
    }));

    const clientJob: ExportJob = {
      id: serverJob.id,
      releaseId: release.id,
      releaseTitle: release.title,
      artistName: release.artistName,
      editionLabel: release.editionLabel,
      year: release.year,
      targetFormat: release.targetFormat || 'MP3',
      processingStatus: serverJob.processingStatus || 'queued',
      artifactAvailability: serverJob.artifactAvailability || 'not_created',
      tracks,
      currentTrackIndex: 0,
      totalTracks: serverJob.totalTracks || tracks.length,
      successfulTracksCount: serverJob.successfulTracksCount || 0,
      failedTracksCount: serverJob.failedTracksCount || 0,
      excludedTracksCount: 0,
      overallProgress: serverJob.overallProgress || 5,
      createdAt: serverJob.createdAt || Date.now(),
      isSelective,
      isRealPipeline: true
    };

    this.jobs.set(clientJob.id, clientJob);
    this.notify(clientJob);

    // Start background polling
    this.pollJob(clientJob.id);

    return clientJob;
  }

  private pollJob(jobId: string) {
    if (this.pollingTimers.has(jobId)) {
      clearInterval(this.pollingTimers.get(jobId));
    }

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/export/job/${encodeURIComponent(jobId)}`);
        if (!res.ok) {
          clearInterval(timer);
          this.pollingTimers.delete(jobId);
          return;
        }

        const data = await res.json();
        const serverJob = data.job;
        const currentJob = this.jobs.get(jobId);
        if (!currentJob) {
          clearInterval(timer);
          this.pollingTimers.delete(jobId);
          return;
        }

        // Map updated tracks with diagnostics
        currentJob.tracks = (serverJob.tracks || []).map((t: any) => ({
          trackId: t.trackId,
          discNumber: t.discNumber || 1,
          trackNumber: t.trackNumber,
          title: t.title,
          artistCredit: t.artistCredit,
          status: t.status === 'converting' ? 'tagging' : t.status,
          progressPercent: t.progressPercent || 0,
          failureReason: t.diagnostic?.sanitizedMessage || t.error,
          diagnostic: t.diagnostic
        }));

        currentJob.processingStatus = serverJob.processingStatus;
        currentJob.artifactAvailability = serverJob.artifactAvailability;
        currentJob.successfulTracksCount = serverJob.successfulTracksCount || 0;
        currentJob.failedTracksCount = serverJob.failedTracksCount || 0;
        currentJob.overallProgress = serverJob.overallProgress || 0;
        currentJob.errorMessage = serverJob.errorMessage;
        currentJob.completedAt = serverJob.completedAt;

        if (serverJob.zipFilename) {
          currentJob.realZipFilename = serverJob.zipFilename;
          currentJob.realZipSizeBytes = serverJob.zipSizeBytes;
          currentJob.realDownloadUrl = `/api/export/download/${encodeURIComponent(jobId)}`;
        }

        this.notify(currentJob);

        // Check if finished
        if (['completed', 'partial', 'failed'].includes(serverJob.processingStatus)) {
          clearInterval(timer);
          this.pollingTimers.delete(jobId);
        }
      } catch (err) {
        console.error('Error polling server job:', err);
      }
    }, 800);

    this.pollingTimers.set(jobId, timer);
  }

  async retryJob(jobId: string, _options?: ExportOptions): Promise<ExportJob | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    if (this.pollingTimers.has(jobId)) {
      clearInterval(this.pollingTimers.get(jobId));
      this.pollingTimers.delete(jobId);
    }

    try {
      const res = await fetch(`/api/export/retry/${encodeURIComponent(jobId)}`, {
        method: 'POST'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Retry failed with status ${res.status}`);
      }
      const data = await res.json();
      const updatedJob = this.jobs.get(jobId) || job;
      updatedJob.processingStatus = data.job.processingStatus;
      updatedJob.errorMessage = undefined;
      this.notify(updatedJob);
      this.pollJob(jobId);
      return updatedJob;
    } catch (err: any) {
      console.error('Failed to retry server job:', err);
      return null;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const timer = this.pollingTimers.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(jobId);
    }

    try {
      await fetch(`/api/export/cancel/${encodeURIComponent(jobId)}`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to call server cancel endpoint:', err);
    }

    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.processingStatus = 'failed';
    job.errorMessage = 'Export cancelled by user.';
    job.artifactAvailability = 'not_created';
    this.notify(job);
    return true;
  }

  async resolveAmbiguousMatch(
    jobId: string,
    trackId: string,
    candidate: MatchCandidate | null
  ): Promise<void> {
    // Real server jobs resolve tracks through backend resolver
    return;
  }

  simulateArtifactExpiry(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.artifactAvailability = 'expired';
    this.notify(job);
  }
}

export const serverExportService = new ServerExportService();
