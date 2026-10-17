import {
  AmbiguousReviewRequest,
  ArtifactAvailability,
  ExportJob,
  ExportOptions,
  MatchCandidate,
  ProcessingStatus,
  SimulatedArchive,
  SimulatedArchiveEntry,
  TrackExportItem
} from '../../types/export';
import { Release, Track } from '../../types/music';
import { ExportService, JobSubscriber } from './ExportService';

const STORAGE_KEY = 'musicrip_export_jobs_v1';

export class SimulatedExportService implements ExportService {
  private jobs: Map<string, ExportJob> = new Map();
  private subscribers: Map<string, Set<JobSubscriber>> = new Map();
  private allSubscribers: Set<(jobs: ExportJob[]) => void> = new Set();
  private activeTimers: Map<string, number> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: ExportJob[] = JSON.parse(data);
        parsed.forEach((job) => {
          // If a job was mid-flight when browser closed or reloaded, mark as interrupted
          if (
            [
              'queued',
              'resolving',
              'downloading',
              'tagging',
              'packaging',
              'awaiting_review'
            ].includes(job.processingStatus)
          ) {
            job.isInterrupted = true;
            job.errorMessage =
              'Export was interrupted by page reload. In this frontend demo, state is simulated in-memory.';
            job.processingStatus = 'failed';
          }
          this.jobs.set(job.id, job);
        });
      }
    } catch {
      // LocalStorage error fallback
    }
  }

  private saveToStorage() {
    try {
      const list = Array.from(this.jobs.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Silent error fallback
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
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const allTracks: Track[] = release.discs.flatMap((d) => d.tracks);

    const trackItems: TrackExportItem[] = allTracks.map((t) => ({
      trackId: t.id,
      discNumber: t.discNumber,
      trackNumber: t.trackNumber,
      title: t.title,
      persianTitle: t.persianTitle,
      artistCredit: t.artistCredit || release.artistName,
      durationSeconds: t.durationSeconds,
      status: 'pending',
      progressPercent: 0
    }));

    const job: ExportJob = {
      id: jobId,
      releaseId: release.id,
      releaseTitle: release.title,
      artistName: release.artistName,
      editionLabel: release.editionLabel,
      year: release.year,
      targetFormat: options?.targetFormat || 'MP3',
      processingStatus: 'queued',
      artifactAvailability: 'not_created',
      tracks: trackItems,
      currentTrackIndex: 0,
      totalTracks: trackItems.length,
      successfulTracksCount: 0,
      failedTracksCount: 0,
      excludedTracksCount: 0,
      overallProgress: 5,
      createdAt: Date.now(),
      scenarioPreset: options?.scenarioPreset || 'default'
    };

    this.jobs.set(jobId, job);
    this.notify(job);

    this.runSimulation(jobId, release);
    return job;
  }

  async retryJob(jobId: string, options?: ExportOptions): Promise<ExportJob | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    // Clear existing timer if any
    const existingTimer = this.activeTimers.get(jobId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      this.activeTimers.delete(jobId);
    }

    // RULE: Retry must NOT duplicate successful tracks in the job model!
    // Keep already-completed tracks as completed.
    // Only reset pending, failed, or excluded tracks.
    job.tracks = job.tracks.map((t) => {
      if (t.status === 'completed') {
        return t;
      }
      return {
        ...t,
        status: 'pending',
        progressPercent: 0,
        failureReason: undefined
      };
    });

    job.processingStatus = 'queued';
    job.errorMessage = undefined;
    job.isInterrupted = false;
    job.ambiguousReview = undefined;
    if (options?.scenarioPreset) {
      job.scenarioPreset = options.scenarioPreset;
    }

    this.recalculateCounts(job);
    job.overallProgress = Math.max(5, Math.floor((job.successfulTracksCount / job.totalTracks) * 50));
    this.notify(job);

    // Resume from first non-completed track
    const releaseMock = {
      id: job.releaseId,
      providerId: 'prov',
      artistId: 'art',
      artistName: job.artistName,
      title: job.releaseTitle,
      year: job.year,
      type: 'album' as const,
      isLive: false,
      editionLabel: job.editionLabel,
      coverSeed: 'cover',
      discs: []
    };

    this.runSimulation(jobId, releaseMock);
    return job;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const timer = this.activeTimers.get(jobId);
    if (timer) {
      window.clearTimeout(timer);
      this.activeTimers.delete(jobId);
    }

    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.processingStatus = 'failed';
    job.errorMessage = 'Simulated export was canceled by user.';
    job.ambiguousReview = undefined;
    this.notify(job);
    return true;
  }

  async resolveAmbiguousMatch(
    jobId: string,
    trackId: string,
    candidate: MatchCandidate | null
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.processingStatus !== 'awaiting_review') return;

    const track = job.tracks.find((t) => t.trackId === trackId);
    if (!track) return;

    if (candidate) {
      // User approved a candidate
      track.selectedCandidate = candidate;
      track.status = 'downloading';
    } else {
      // User chose to exclude the track
      track.status = 'excluded';
      track.failureReason = 'Excluded by user during ambiguous match review';
      job.excludedTracksCount += 1;
    }

    job.ambiguousReview = undefined;
    job.processingStatus = 'downloading';
    this.notify(job);

    // Resume simulation
    this.stepDownloadTrack(jobId, job.currentTrackIndex);
  }

  simulateArtifactExpiry(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.artifactAvailability = 'expired';
    this.notify(job);
  }

  private recalculateCounts(job: ExportJob) {
    job.successfulTracksCount = job.tracks.filter((t) => t.status === 'completed').length;
    job.failedTracksCount = job.tracks.filter((t) => t.status === 'failed').length;
    job.excludedTracksCount = job.tracks.filter((t) => t.status === 'excluded').length;
  }

  private runSimulation(jobId: string, release: Partial<Release>) {
    // Stage 1: Queued -> Resolving
    const timer1 = window.setTimeout(() => {
      const job = this.jobs.get(jobId);
      if (!job || job.processingStatus === 'failed') return;

      job.processingStatus = 'resolving';
      job.overallProgress = 15;
      this.notify(job);

      // Check server error preset
      if (job.scenarioPreset === 'server_error') {
        const errorTimer = window.setTimeout(() => {
          job.processingStatus = 'failed';
          job.errorMessage =
            'Demo simulated network error: Source audio indexer unavailable (503 Service Unavailable). Retry is available.';
          this.notify(job);
        }, 1200);
        this.activeTimers.set(jobId, errorTimer);
        return;
      }

      // Transition to Track Processing
      const timer2 = window.setTimeout(() => {
        this.processTrackLoop(jobId, 0);
      }, 1200);
      this.activeTimers.set(jobId, timer2);
    }, 1500);

    this.activeTimers.set(jobId, timer1);
  }

  private processTrackLoop(jobId: string, index: number) {
    const job = this.jobs.get(jobId);
    if (!job || job.processingStatus === 'failed') return;

    if (index >= job.tracks.length) {
      // All tracks have been processed! Move to Tagging & Packaging
      this.stepTagging(jobId);
      return;
    }

    job.currentTrackIndex = index;
    const track = job.tracks[index];

    // If track was already completed in a prior run, skip to next track without altering
    if (track.status === 'completed') {
      this.processTrackLoop(jobId, index + 1);
      return;
    }

    // Check ambiguous match scenario on track index 1 (or 0 if single track)
    if (
      job.scenarioPreset === 'ambiguous_match' &&
      !track.selectedCandidate &&
      track.status !== 'excluded' &&
      index === Math.min(1, job.tracks.length - 1)
    ) {
      job.processingStatus = 'awaiting_review';
      track.status = 'resolving';

      const ambiguousRequest: AmbiguousReviewRequest = {
        trackId: track.trackId,
        discNumber: track.discNumber,
        trackNumber: track.trackNumber,
        expectedTitle: track.title,
        expectedArtist: track.artistCredit || job.artistName,
        candidates: [
          {
            id: 'cand-1',
            title: `${track.title} (Original Album Master)`,
            source: 'Verified Audio Stream',
            durationText: track.durationSeconds ? `${Math.floor(track.durationSeconds / 60)}:${(track.durationSeconds % 60).toString().padStart(2, '0')}` : '3:45',
            isLive: false,
            isCover: false,
            isRemix: false,
            matchScore: 0.98
          },
          {
            id: 'cand-2',
            title: `${track.title} (Live at Arena 2024)`,
            source: 'Alternative Concert Stream',
            durationText: '4:18',
            isLive: true,
            isCover: false,
            isRemix: false,
            matchScore: 0.72,
            warningNote: 'Live recording detected — not standard studio track.'
          },
          {
            id: 'cand-3',
            title: `${track.title} (Acoustic Cover / Re-interpretation)`,
            source: 'Tribute Audio Stream',
            durationText: '3:10',
            isLive: false,
            isCover: true,
            isRemix: false,
            matchScore: 0.58,
            warningNote: 'Cover version detected — different artist credit.'
          }
        ]
      };

      job.ambiguousReview = ambiguousRequest;
      this.notify(job);
      // Wait for user review action in UI modal
      return;
    }

    // Check missing track scenario on track index 2
    if (job.scenarioPreset === 'missing_track' && index === Math.min(2, job.tracks.length - 1)) {
      track.status = 'failed';
      track.failureReason = 'Source audio unavailable: Stream removed or geo-restricted (Demo scenario).';
      job.failedTracksCount += 1;
      this.notify(job);

      const nextTimer = window.setTimeout(() => {
        this.processTrackLoop(jobId, index + 1);
      }, 700);
      this.activeTimers.set(jobId, nextTimer);
      return;
    }

    // Normal track processing: start download simulation
    this.stepDownloadTrack(jobId, index);
  }

  private stepDownloadTrack(jobId: string, index: number) {
    const job = this.jobs.get(jobId);
    if (!job || job.processingStatus === 'failed') return;

    job.processingStatus = 'downloading';
    const track = job.tracks[index];
    track.status = 'downloading';
    track.progressPercent = 0;
    this.notify(job);

    // Simulate progress increments
    let step = 0;
    const progressInterval = window.setInterval(() => {
      step += 1;
      track.progressPercent = Math.min(100, step * 34);

      // Compute weighted overall progress (15% to 75%)
      const completedTracks = job.tracks.filter((t) => t.status === 'completed').length;
      const trackFraction = (completedTracks + track.progressPercent / 100) / job.totalTracks;
      job.overallProgress = Math.min(75, Math.floor(15 + trackFraction * 60));

      this.notify(job);

      if (track.progressPercent >= 100) {
        window.clearInterval(progressInterval);
        track.status = 'completed';
        this.recalculateCounts(job);
        this.notify(job);

        const nextTimer = window.setTimeout(() => {
          this.processTrackLoop(jobId, index + 1);
        }, 300);
        this.activeTimers.set(jobId, nextTimer);
      }
    }, 280);
  }

  private stepTagging(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.processingStatus === 'failed') return;

    job.processingStatus = 'tagging';
    job.overallProgress = 85;
    this.notify(job);

    const tagTimer = window.setTimeout(() => {
      this.stepPackaging(jobId);
    }, 1200);
    this.activeTimers.set(jobId, tagTimer);
  }

  private stepPackaging(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.processingStatus === 'failed') return;

    job.processingStatus = 'packaging';
    job.overallProgress = 94;
    this.notify(job);

    const packTimer = window.setTimeout(() => {
      this.finalizeJob(jobId);
    }, 1400);
    this.activeTimers.set(jobId, packTimer);
  }

  private finalizeJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.recalculateCounts(job);
    job.completedAt = Date.now();
    job.overallProgress = 100;

    // Build simulated archive details
    const cleanEdition = job.editionLabel ? ` [${job.editionLabel}]` : '';
    const cleanYear = job.year ? ` (${job.year})` : '';
    const zipName = `${job.artistName} - ${job.releaseTitle}${cleanYear}${cleanEdition}.zip`;

    const entries: SimulatedArchiveEntry[] = job.tracks
      .filter((t) => t.status === 'completed')
      .map((t) => {
        const discFolder = job.tracks.some((other) => other.discNumber > 1)
          ? `Disc ${t.discNumber.toString().padStart(2, '0')}/`
          : '';
        const trackNum = t.trackNumber.toString().padStart(2, '0');
        const filename = `${trackNum} - ${t.artistCredit || job.artistName} - ${t.title}.mp3`;
        // Simulated size ~9.2 MB per track
        const sizeBytes = 8500000 + Math.floor((t.durationSeconds || 240) * 16000);

        return {
          path: `${discFolder}${filename}`,
          sizeBytes,
          id3Tags: {
            artist: t.artistCredit || job.artistName,
            album: job.releaseTitle,
            title: t.title,
            track: `${t.trackNumber}/${job.tracks.filter((k) => k.discNumber === t.discNumber).length}`,
            disc: `${t.discNumber}`,
            year: job.year ? `${job.year}` : undefined
          }
        };
      });

    const totalBytes = entries.reduce((acc, curr) => acc + curr.sizeBytes, 0);

    const archive: SimulatedArchive = {
      filename: zipName,
      totalBytes,
      entries,
      simulatedExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    job.simulatedArchive = archive;

    // STRICT HONESTY RULE:
    // A 10-track album with only 9 successful tracks is partial, not complete.
    if (job.successfulTracksCount === job.totalTracks && job.failedTracksCount === 0 && job.excludedTracksCount === 0) {
      job.processingStatus = 'completed';
      job.artifactAvailability = 'available';
    } else {
      job.processingStatus = 'partial';
      job.artifactAvailability = 'available';
    }

    // Check expired archive scenario preset
    if (job.scenarioPreset === 'expired_archive') {
      job.artifactAvailability = 'expired';
    }

    this.notify(job);
  }
}

export const defaultExportService = new SimulatedExportService();
