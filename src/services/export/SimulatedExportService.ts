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
  // Store all active timer/interval IDs per job to ensure complete cancellation
  private activeTimers: Map<string, Set<any>> = new Map();
  // Speed multiplier for tests vs normal runtime
  public stepDelayMultiplier: number = 1;

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
      // Fallback if localStorage unavailable
    }
  }

  private saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      const list = Array.from(this.jobs.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Silent error fallback
    }
  }

  private clearAllJobTimers(jobId: string) {
    const timers = this.activeTimers.get(jobId);
    if (timers) {
      timers.forEach((t) => {
        clearTimeout(t);
        clearInterval(t);
      });
      timers.clear();
      this.activeTimers.delete(jobId);
    }
  }

  private registerTimer(jobId: string, timerId: any) {
    if (!this.activeTimers.has(jobId)) {
      this.activeTimers.set(jobId, new Set());
    }
    this.activeTimers.get(jobId)!.add(timerId);
  }

  private unregisterTimer(jobId: string, timerId: any) {
    const timers = this.activeTimers.get(jobId);
    if (timers) {
      timers.delete(timerId);
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
    const allTracks: Track[] = (release.discs || []).flatMap((d) => d.tracks || []);

    // Support selective export
    const selectedTrackIds = options?.selectedTrackIds;
    const isSelective = !!selectedTrackIds && selectedTrackIds.length < allTracks.length;
    const targetTracks = selectedTrackIds && selectedTrackIds.length > 0
      ? allTracks.filter((t) => selectedTrackIds.includes(t.id))
      : allTracks;

    const trackItems: TrackExportItem[] = targetTracks.map((t) => ({
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
      runId: 1, // Initial execution run ID
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
      scenarioPreset: options?.scenarioPreset || 'default',
      isSelective
    };

    this.jobs.set(jobId, job);
    this.notify(job);

    this.runSimulation(jobId, job.runId!);
    return job;
  }

  async retryJob(jobId: string, options?: ExportOptions): Promise<ExportJob | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    // Clear all existing timers/intervals and increment runId for stale-run guard
    this.clearAllJobTimers(jobId);
    const newRunId = (job.runId || 0) + 1;
    job.runId = newRunId;

    // BUG C FIX:
    // 1. Preserve successful tracks without duplication.
    // 2. Do NOT automatically reinstate tracks deliberately excluded by the user!
    // 3. Reset failed/interrupted or pending tracks.
    // 4. Do not show old artifact as the result of a new running attempt!
    job.tracks = job.tracks.map((t) => {
      if (t.status === 'completed' || t.status === 'excluded') {
        return t; // Keep completed and excluded intact
      }
      return {
        ...t,
        status: 'pending',
        progressPercent: 0,
        failureReason: undefined
      };
    });

    job.processingStatus = 'queued';
    job.artifactAvailability = 'not_created';
    job.simulatedArchive = undefined;
    job.errorMessage = undefined;
    job.isInterrupted = false;
    job.ambiguousReview = undefined;

    if (options?.scenarioPreset) {
      job.scenarioPreset = options.scenarioPreset;
    }

    this.recalculateCounts(job);
    job.overallProgress = Math.max(5, Math.floor((job.successfulTracksCount / job.totalTracks) * 50));
    this.notify(job);

    this.runSimulation(jobId, newRunId);
    return job;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // BUG B FIX: Invalidate runId and cancel ALL active timers and intervals
    job.runId = (job.runId || 0) + 1;
    this.clearAllJobTimers(jobId);

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

    const trackIndex = job.tracks.findIndex((t) => t.trackId === trackId);
    if (trackIndex === -1) return;
    const track = job.tracks[trackIndex];

    const currentRunId = job.runId || 1;

    if (candidate) {
      // User approved a candidate
      track.selectedCandidate = candidate;
      track.status = 'downloading';
      job.ambiguousReview = undefined;
      job.processingStatus = 'downloading';
      this.notify(job);

      // Start downloading this approved track
      this.stepDownloadTrack(jobId, trackIndex, currentRunId);
    } else {
      // BUG A FIX: User chose to exclude the track.
      // Must remain excluded and processing must move to the NEXT eligible track,
      // NOT call stepDownloadTrack on this excluded track!
      track.status = 'excluded';
      track.failureReason = 'Excluded by user during ambiguous match review';
      this.recalculateCounts(job);
      job.ambiguousReview = undefined;
      job.processingStatus = 'downloading';
      this.notify(job);

      // Advance to the next track in the list
      this.processTrackLoop(jobId, trackIndex + 1, currentRunId);
    }
  }

  simulateArtifactExpiry(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.artifactAvailability = 'expired';
    this.notify(job);
  }

  /**
   * Separate rebuilding an expired archive from retrying failed tracks.
   * If all needed tracks are already successful, rebuilds the simulated ZIP directly.
   */
  async rebuildArchive(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.artifactAvailability !== 'expired') return false;

    // Check if we have successful tracks to package
    if (job.successfulTracksCount === 0) return false;

    job.processingStatus = 'packaging';
    this.notify(job);

    const timer = setTimeout(() => {
      this.finalizeJob(jobId, job.runId || 1);
    }, 1000 * this.stepDelayMultiplier);
    this.registerTimer(jobId, timer);
    return true;
  }

  private recalculateCounts(job: ExportJob) {
    job.successfulTracksCount = job.tracks.filter((t) => t.status === 'completed').length;
    job.failedTracksCount = job.tracks.filter((t) => t.status === 'failed').length;
    job.excludedTracksCount = job.tracks.filter((t) => t.status === 'excluded').length;
  }

  private runSimulation(jobId: string, runId: number) {
    const delay = 1500 * this.stepDelayMultiplier;
    const timer1 = setTimeout(() => {
      this.unregisterTimer(jobId, timer1);
      const job = this.jobs.get(jobId);
      // Stale-run guard
      if (!job || job.runId !== runId || job.processingStatus === 'failed') return;

      job.processingStatus = 'resolving';
      job.overallProgress = 15;
      this.notify(job);

      // Check server error preset
      if (job.scenarioPreset === 'server_error') {
        const errorTimer = setTimeout(() => {
          this.unregisterTimer(jobId, errorTimer);
          const currentJob = this.jobs.get(jobId);
          if (!currentJob || currentJob.runId !== runId) return;

          currentJob.processingStatus = 'failed';
          currentJob.errorMessage =
            'Demo simulated network error: Source audio indexer unavailable (503 Service Unavailable). Retry is available.';
          this.notify(currentJob);
        }, 1200 * this.stepDelayMultiplier);
        this.registerTimer(jobId, errorTimer);
        return;
      }

      // Transition to Track Processing
      const timer2 = setTimeout(() => {
        this.unregisterTimer(jobId, timer2);
        this.processTrackLoop(jobId, 0, runId);
      }, 1200 * this.stepDelayMultiplier);
      this.registerTimer(jobId, timer2);
    }, delay);

    this.registerTimer(jobId, timer1);
  }

  private processTrackLoop(jobId: string, index: number, runId: number) {
    const job = this.jobs.get(jobId);
    // Stale-run guard
    if (!job || job.runId !== runId || job.processingStatus === 'failed') return;

    if (index >= job.tracks.length) {
      // All tracks processed!
      this.stepTagging(jobId, runId);
      return;
    }

    job.currentTrackIndex = index;
    const track = job.tracks[index];

    // If track is already completed or excluded, advance to next track
    if (track.status === 'completed' || track.status === 'excluded') {
      this.processTrackLoop(jobId, index + 1, runId);
      return;
    }

    // Check ambiguous match scenario on track index 1
    if (
      job.scenarioPreset === 'ambiguous_match' &&
      !track.selectedCandidate &&
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
            durationText: track.durationSeconds
              ? `${Math.floor(track.durationSeconds / 60)}:${(track.durationSeconds % 60).toString().padStart(2, '0')}`
              : '3:45',
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
      return;
    }

    // Check missing track scenario on track index 2
    if (job.scenarioPreset === 'missing_track' && index === Math.min(2, job.tracks.length - 1)) {
      track.status = 'failed';
      track.failureReason = 'Source audio unavailable: Stream removed or geo-restricted (Demo scenario).';
      this.recalculateCounts(job);
      this.notify(job);

      const nextTimer = setTimeout(() => {
        this.unregisterTimer(jobId, nextTimer);
        this.processTrackLoop(jobId, index + 1, runId);
      }, 700 * this.stepDelayMultiplier);
      this.registerTimer(jobId, nextTimer);
      return;
    }

    // Normal track processing
    this.stepDownloadTrack(jobId, index, runId);
  }

  private stepDownloadTrack(jobId: string, index: number, runId: number) {
    const job = this.jobs.get(jobId);
    if (!job || job.runId !== runId || job.processingStatus === 'failed') return;

    job.processingStatus = 'downloading';
    const track = job.tracks[index];
    track.status = 'downloading';
    track.progressPercent = 0;
    this.notify(job);

    let step = 0;
    const intervalTime = 250 * this.stepDelayMultiplier;
    const progressInterval = setInterval(() => {
      const currentJob = this.jobs.get(jobId);
      // BUG B FIX: Check runId inside interval to prevent stale execution
      if (!currentJob || currentJob.runId !== runId || currentJob.processingStatus === 'failed') {
        clearInterval(progressInterval);
        this.unregisterTimer(jobId, progressInterval);
        return;
      }

      step += 1;
      track.progressPercent = Math.min(100, step * 34);

      const completedTracks = currentJob.tracks.filter((t) => t.status === 'completed').length;
      const trackFraction = (completedTracks + track.progressPercent / 100) / currentJob.totalTracks;
      currentJob.overallProgress = Math.min(75, Math.floor(15 + trackFraction * 60));

      this.notify(currentJob);

      if (track.progressPercent >= 100) {
        clearInterval(progressInterval);
        this.unregisterTimer(jobId, progressInterval);
        track.status = 'completed';
        this.recalculateCounts(currentJob);
        this.notify(currentJob);

        const nextTimer = setTimeout(() => {
          this.unregisterTimer(jobId, nextTimer);
          this.processTrackLoop(jobId, index + 1, runId);
        }, 300 * this.stepDelayMultiplier);
        this.registerTimer(jobId, nextTimer);
      }
    }, intervalTime);

    // Register interval in activeTimers so cancelJob clears it immediately
    this.registerTimer(jobId, progressInterval);
  }

  private stepTagging(jobId: string, runId: number) {
    const job = this.jobs.get(jobId);
    if (!job || job.runId !== runId || job.processingStatus === 'failed') return;

    job.processingStatus = 'tagging';
    job.overallProgress = 85;
    this.notify(job);

    const tagTimer = setTimeout(() => {
      this.unregisterTimer(jobId, tagTimer);
      this.stepPackaging(jobId, runId);
    }, 1200 * this.stepDelayMultiplier);
    this.registerTimer(jobId, tagTimer);
  }

  private stepPackaging(jobId: string, runId: number) {
    const job = this.jobs.get(jobId);
    if (!job || job.runId !== runId || job.processingStatus === 'failed') return;

    job.processingStatus = 'packaging';
    job.overallProgress = 94;
    this.notify(job);

    const packTimer = setTimeout(() => {
      this.unregisterTimer(jobId, packTimer);
      this.finalizeJob(jobId, runId);
    }, 1400 * this.stepDelayMultiplier);
    this.registerTimer(jobId, packTimer);
  }

  private finalizeJob(jobId: string, runId: number) {
    const job = this.jobs.get(jobId);
    // BUG B FIX: Stale run guard
    if (!job || job.runId !== runId || job.processingStatus === 'failed') return;

    this.recalculateCounts(job);
    job.completedAt = Date.now();
    job.overallProgress = 100;

    // BUG D FIX:
    // If zero selected tracks succeed, the job is failed and NO archive is available!
    if (job.successfulTracksCount === 0) {
      job.processingStatus = 'failed';
      job.artifactAvailability = 'not_created';
      job.errorMessage = 'Zero tracks were successfully retrieved. Export failed.';
      job.simulatedArchive = undefined;
      this.notify(job);
      return;
    }

    // Build simulated archive details
    const cleanEdition = job.editionLabel ? ` [${job.editionLabel}]` : '';
    const cleanYear = job.year ? ` (${job.year})` : '';
    const cleanSuffix = job.isSelective ? ` [Selected ${job.successfulTracksCount} Tracks]` : '';
    const zipName = `${job.artistName} - ${job.releaseTitle}${cleanYear}${cleanEdition}${cleanSuffix}.zip`;

    const entries: SimulatedArchiveEntry[] = job.tracks
      .filter((t) => t.status === 'completed')
      .map((t) => {
        const discFolder = job.tracks.some((other) => other.discNumber > 1)
          ? `Disc ${t.discNumber.toString().padStart(2, '0')}/`
          : '';
        const trackNum = t.trackNumber.toString().padStart(2, '0');
        const filename = `${trackNum} - ${t.artistCredit || job.artistName} - ${t.title}.mp3`;
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

    // BUG D FIX:
    // A partial album is NEVER complete.
    // If successfulTracksCount === totalTracks and 0 failed and 0 excluded -> completed.
    // Otherwise -> partial.
    if (
      job.successfulTracksCount === job.totalTracks &&
      job.failedTracksCount === 0 &&
      job.excludedTracksCount === 0
    ) {
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
