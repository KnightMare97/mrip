import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { classifyProcessError } from './diagnostics';
import {
  downloadCoverImage,
  generateSyntheticTestTone,
  tagAndTranscodeMp3,
  verifyMp3WithProbe
} from './metadata';
import { buildZipFilename, createExportZip } from './packaging';
import {
  ServerExportJob,
  ServerExportTrack,
  TrackDiagnostic
} from './types';

export const MAX_CONCURRENT_WORKERS = 1;
export const MAX_QUEUED_JOBS = 5;
export const MAX_TRACKS_PER_JOB = 50;
export const TRACK_TIMEOUT_MS = 120000; // 2 minutes
export const ARTIFACT_TTL_MS = 60 * 60 * 1000; // 1 hour

export class ExportPipelineManager {
  private jobs: Map<string, ServerExportJob> = new Map();
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private executionQueue: string[] = [];
  private activeWorkersCount = 0;
  private exportsDir: string;
  private ytdlpPath: string;

  constructor(exportsDir: string, ytdlpPath: string) {
    this.exportsDir = exportsDir;
    this.ytdlpPath = ytdlpPath;

    // Periodic sweep for expired jobs
    setInterval(() => {
      this.cleanupExpiredJobs();
    }, 10 * 60 * 1000).unref();
  }

  getJob(jobId: string): ServerExportJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): ServerExportJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getQueueStatus() {
    return {
      activeWorkers: this.activeWorkersCount,
      queuedJobsCount: this.executionQueue.length,
      maxWorkers: MAX_CONCURRENT_WORKERS,
      maxQueue: MAX_QUEUED_JOBS
    };
  }

  /**
   * Registers a validated job and enqueues execution
   */
  enqueueJob(job: ServerExportJob): { enqueued: boolean; error?: string } {
    if (this.executionQueue.length >= MAX_QUEUED_JOBS) {
      return {
        enqueued: false,
        error: `Export queue is full (${this.executionQueue.length}/${MAX_QUEUED_JOBS}). Please try again later.`
      };
    }

    this.jobs.set(job.id, job);
    this.executionQueue.push(job.id);
    this.drainQueue();
    return { enqueued: true };
  }

  /**
   * Drains the execution queue respecting MAX_CONCURRENT_WORKERS = 1
   */
  private async drainQueue() {
    if (this.activeWorkersCount >= MAX_CONCURRENT_WORKERS) {
      return;
    }

    const nextJobId = this.executionQueue.shift();
    if (!nextJobId) return;

    const job = this.jobs.get(nextJobId);
    if (!job || job.processingStatus === 'failed') {
      this.drainQueue();
      return;
    }

    this.activeWorkersCount++;
    try {
      if (job.isSyntheticDiagnostic) {
        await this.runSyntheticDiagnosticJob(job);
      } else {
        await this.runRealJob(job);
      }
    } catch (err: any) {
      console.error(`Unexpected worker exception on job ${job.id}:`, err);
      job.processingStatus = 'failed';
      job.errorMessage = `Unexpected pipeline worker error: ${err.message}`;
    } finally {
      this.activeWorkersCount--;
      this.drainQueue();
    }
  }

  /**
   * Cancels a running or queued job, terminating active subprocesses
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Remove from queue if not started
    const queueIdx = this.executionQueue.indexOf(jobId);
    if (queueIdx !== -1) {
      this.executionQueue.splice(queueIdx, 1);
    }

    // Abort controller
    const controller = this.abortControllers.get(jobId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(jobId);
    }

    // Kill active subprocess
    const proc = this.activeProcesses.get(jobId);
    if (proc) {
      try {
        proc.kill('SIGTERM');
        setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            // ignore
          }
        }, 800);
      } catch {
        // ignore
      }
      this.activeProcesses.delete(jobId);
    }

    job.processingStatus = 'failed';
    job.errorMessage = 'Export was cancelled by user.';
    job.artifactAvailability = 'not_created';
    job.tracks.forEach((t) => {
      if (t.status === 'downloading' || t.status === 'resolving' || t.status === 'pending') {
        t.status = 'failed';
        t.diagnostic = {
          category: 'timeout',
          stage: 'download',
          sanitizedMessage: 'Export cancelled by user.'
        };
      }
    });

    return true;
  }

  /**
   * Retries only failed tracks while preserving existing successful files
   */
  retryJob(jobId: string): { success: boolean; job?: ServerExportJob; error?: string } {
    const job = this.jobs.get(jobId);
    if (!job) return { success: false, error: 'Job not found' };

    if (this.executionQueue.includes(jobId) || job.processingStatus === 'processing') {
      return { success: false, error: 'Job is currently in progress or queued.' };
    }

    // Reset only failed/pending tracks; keep valid completed tracks and local paths intact
    let eligibleRetryCount = 0;
    job.tracks.forEach((t) => {
      if (t.status !== 'completed' || !t.localPath || !fs.existsSync(t.localPath)) {
        t.status = 'pending';
        t.progressPercent = 0;
        t.error = undefined;
        t.diagnostic = undefined;
        t.localPath = undefined;
        eligibleRetryCount++;
      }
    });

    if (eligibleRetryCount === 0 && job.successfulTracksCount === job.totalTracks) {
      return { success: false, error: 'All tracks already succeeded.' };
    }

    job.processingStatus = 'queued';
    job.errorMessage = undefined;
    job.overallProgress = Math.floor((job.successfulTracksCount / job.totalTracks) * 80);

    const enq = this.enqueueJob(job);
    return { success: enq.enqueued, job, error: enq.error };
  }

  /**
   * Executes genuine media extraction and processing for an export job
   */
  private async runRealJob(job: ServerExportJob) {
    job.processingStatus = 'processing';
    const abortCtrl = new AbortController();
    this.abortControllers.set(job.id, abortCtrl);

    const jobTempDir = path.join(this.exportsDir, job.id);
    fs.mkdirSync(jobTempDir, { recursive: true });

    // Download cover artwork if available
    let localCoverPath: string | undefined;
    if (job.coverUrl) {
      localCoverPath = path.join(jobTempDir, 'cover_art.jpg');
      const downloaded = await downloadCoverImage(job.coverUrl, localCoverPath);
      if (!downloaded) {
        localCoverPath = undefined;
      }
    }

    for (let i = 0; i < job.tracks.length; i++) {
      if (abortCtrl.signal.aborted) break;

      const track = job.tracks[i];
      // Skip tracks that previously succeeded during retry
      if (track.status === 'completed' && track.localPath && fs.existsSync(track.localPath)) {
        continue;
      }

      track.status = 'downloading';
      track.progressPercent = 10;
      this.updateOverallProgress(job);

      const rawVideoId = track.trackId
        .replace(/^ytm-trk:/, '')
        .replace(/^ytmusic:/, '')
        .trim();

      // Validate YouTube video ID format
      const validVideoIdRegex = /^[a-zA-Z0-9_-]{11}$/;
      if (!validVideoIdRegex.test(rawVideoId)) {
        track.status = 'failed';
        track.error = `Invalid YouTube video ID format: ${rawVideoId}`;
        track.diagnostic = {
          category: 'validation_error',
          stage: 'validation',
          sanitizedMessage: `Invalid YouTube video ID: "${rawVideoId}".`
        };
        job.failedTracksCount++;
        this.updateOverallProgress(job);
        continue;
      }

      const videoUrl = `https://www.youtube.com/watch?v=${rawVideoId}`;
      const rawAudioPath = path.join(jobTempDir, `raw_track_${i + 1}.mp3`);
      const taggedAudioPath = path.join(jobTempDir, `track_${i + 1}.mp3`);

      // 1. Stream Extraction via yt-dlp
      const extractResult = await this.executeYtDlp(job.id, videoUrl, rawAudioPath, abortCtrl.signal);

      if (!extractResult.success || !fs.existsSync(rawAudioPath)) {
        track.status = 'failed';
        track.error = extractResult.diagnostic?.sanitizedMessage || 'Stream download failed.';
        track.diagnostic = extractResult.diagnostic || {
          category: 'unknown',
          stage: 'download',
          sanitizedMessage: 'Stream download failed.'
        };
        job.failedTracksCount++;
        this.updateOverallProgress(job);
        continue;
      }

      // 2. Tagging & Artwork Embedding via FFmpeg
      track.status = 'tagging';
      track.progressPercent = 80;
      this.updateOverallProgress(job);

      try {
        await tagAndTranscodeMp3({
          audioPath: rawAudioPath,
          outputPath: taggedAudioPath,
          title: track.title,
          artist: track.artistCredit || job.artistName,
          albumArtist: job.albumArtist || job.artistName,
          album: job.releaseTitle,
          year: job.year,
          trackNumber: track.trackNumber,
          totalTracks: job.totalTracks,
          discNumber: track.discNumber,
          coverPath: localCoverPath
        });

        // 3. Output verification using ffprobe
        const probe = await verifyMp3WithProbe(taggedAudioPath);
        if (!probe.verified) {
          throw new Error(probe.error || 'MP3 audio verification failed after tagging.');
        }

        // Clean up raw temp audio to bound storage
        try {
          fs.unlinkSync(rawAudioPath);
        } catch {
          // ignore
        }

        track.status = 'completed';
        track.progressPercent = 100;
        track.localPath = taggedAudioPath;
        job.successfulTracksCount++;
      } catch (tagErr: any) {
        track.status = 'failed';
        track.error = tagErr.message || 'Tagging failed.';
        track.diagnostic = {
          category: 'conversion_failure',
          stage: 'tagging',
          sanitizedMessage: `Metadata embedding failed: ${tagErr.message}`
        };
        job.failedTracksCount++;
      }

      this.updateOverallProgress(job);
    }

    this.abortControllers.delete(job.id);
    this.activeProcesses.delete(job.id);

    // If all tracks failed, tagging/packaging are strictly skipped and neutral summary reported!
    if (job.successfulTracksCount === 0) {
      job.processingStatus = 'failed';
      job.artifactAvailability = 'not_created';

      // Build neutral diagnostic summary from distinct reasons
      const distinctReasons = Array.from(
        new Set(job.tracks.map((t) => t.diagnostic?.sanitizedMessage).filter(Boolean))
      );
      const summaryMsg =
        distinctReasons.length > 0
          ? `0 of ${job.totalTracks} tracks downloaded successfully. Cause: ${distinctReasons.join('; ')}`
          : `0 of ${job.totalTracks} tracks downloaded successfully.`;

      job.errorMessage = summaryMsg;
      job.overallProgress = 100;
      return;
    }

    // Packaging into ZIP archive
    try {
      const zipFilename = buildZipFilename(job.artistName, job.releaseTitle, job.year);
      const zipPath = path.join(this.exportsDir, `${job.id}.zip`);

      await createExportZip({
        tracks: job.tracks,
        zipPath,
        artistName: job.artistName,
        releaseTitle: job.releaseTitle,
        year: job.year
      });

      job.zipPath = zipPath;
      job.zipFilename = zipFilename;
      job.zipSizeBytes = fs.statSync(zipPath).size;
      job.artifactAvailability = 'available';
      job.completedAt = Date.now();
      job.overallProgress = 100;

      if (job.successfulTracksCount === job.totalTracks) {
        job.processingStatus = 'completed';
      } else {
        job.processingStatus = 'partial';
      }
    } catch (zipErr: any) {
      job.processingStatus = 'failed';
      job.artifactAvailability = 'not_created';
      job.errorMessage = `Archive packaging failed: ${zipErr.message}`;
    }
  }

  /**
   * Explicit Synthetic Diagnostic Test Runner
   * Only reachable through clearly labeled diagnostic tests.
   */
  private async runSyntheticDiagnosticJob(job: ServerExportJob) {
    job.processingStatus = 'processing';
    const jobTempDir = path.join(this.exportsDir, job.id);
    fs.mkdirSync(jobTempDir, { recursive: true });

    for (let i = 0; i < job.tracks.length; i++) {
      const track = job.tracks[i];
      track.status = 'converting';
      track.progressPercent = 50;
      this.updateOverallProgress(job);

      const tonePath = path.join(jobTempDir, `diagnostic_track_${i + 1}.mp3`);
      try {
        await generateSyntheticTestTone(
          tonePath,
          track.title,
          track.artistCredit || job.artistName,
          track.trackNumber,
          track.discNumber,
          job.year
        );

        // Verify with ffprobe
        const probe = await verifyMp3WithProbe(tonePath);
        if (!probe.verified) {
          throw new Error('Synthetic audio verification with ffprobe failed.');
        }

        track.status = 'completed';
        track.progressPercent = 100;
        track.localPath = tonePath;
        job.successfulTracksCount++;
      } catch (err: any) {
        track.status = 'failed';
        track.error = err.message;
        track.diagnostic = {
          category: 'conversion_failure',
          stage: 'conversion',
          sanitizedMessage: err.message
        };
        job.failedTracksCount++;
      }

      this.updateOverallProgress(job);
    }

    if (job.successfulTracksCount > 0) {
      try {
        const zipFilename = buildZipFilename(job.artistName, job.releaseTitle, job.year);
        const zipPath = path.join(this.exportsDir, `${job.id}.zip`);

        await createExportZip({
          tracks: job.tracks,
          zipPath,
          artistName: job.artistName,
          releaseTitle: job.releaseTitle,
          year: job.year
        });

        job.zipPath = zipPath;
        job.zipFilename = zipFilename;
        job.zipSizeBytes = fs.statSync(zipPath).size;
        job.artifactAvailability = 'available';
        job.completedAt = Date.now();
        job.overallProgress = 100;
        job.processingStatus = job.successfulTracksCount === job.totalTracks ? 'completed' : 'partial';
      } catch (err: any) {
        job.processingStatus = 'failed';
        job.artifactAvailability = 'not_created';
        job.errorMessage = `Synthetic ZIP packaging failed: ${err.message}`;
      }
    } else {
      job.processingStatus = 'failed';
      job.artifactAvailability = 'not_created';
      job.errorMessage = 'Zero synthetic tracks generated.';
    }
  }

  /**
   * Updates job overall progress strictly from track stages without arbitrary jumps
   */
  private updateOverallProgress(job: ServerExportJob) {
    if (job.totalTracks === 0) {
      job.overallProgress = 0;
      return;
    }

    let trackProgressSum = 0;
    job.tracks.forEach((t) => {
      if (t.status === 'completed') trackProgressSum += 100;
      else if (t.status === 'failed') trackProgressSum += 100;
      else if (t.status === 'tagging') trackProgressSum += 80;
      else if (t.status === 'downloading') trackProgressSum += t.progressPercent || 30;
      else trackProgressSum += 0;
    });

    const averageTrackProgress = trackProgressSum / job.totalTracks;
    // Scale average track progress to 90%, leaving 10% for final ZIP packaging
    job.overallProgress = Math.min(95, Math.floor(averageTrackProgress * 0.9));
  }

  /**
   * Spawns yt-dlp with bounded runtime, output limits, and process cancellation
   */
  private executeYtDlp(
    jobId: string,
    url: string,
    outputPath: string,
    abortSignal: AbortSignal
  ): Promise<{ success: boolean; diagnostic?: TrackDiagnostic }> {
    return new Promise((resolve) => {
      if (abortSignal.aborted) {
        return resolve({
          success: false,
          diagnostic: {
            category: 'timeout',
            stage: 'download',
            sanitizedMessage: 'Job was cancelled before stream download started.'
          }
        });
      }

      if (!fs.existsSync(this.ytdlpPath)) {
        return resolve({
          success: false,
          diagnostic: {
            category: 'missing_executable',
            stage: 'download',
            sanitizedMessage: `yt-dlp executable missing at ${this.ytdlpPath}`
          }
        });
      }

      const args = [
        '-x',
        '--audio-format',
        'mp3',
        '--no-playlist',
        '--no-warnings',
        '-o',
        outputPath,
        url
      ];

      let proc: ChildProcess;
      try {
        proc = spawn(this.ytdlpPath, args);
      } catch (spawnErr: any) {
        const diag = classifyProcessError('download', null, '', '', spawnErr.code || spawnErr.message);
        return resolve({ success: false, diagnostic: diag });
      }

      this.activeProcesses.set(jobId, proc);

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill('SIGTERM');
          setTimeout(() => {
            try {
              proc.kill('SIGKILL');
            } catch {
              // ignore
            }
          }, 500);
        } catch {
          // ignore
        }
      }, TRACK_TIMEOUT_MS);

      const abortHandler = () => {
        try {
          proc.kill('SIGTERM');
        } catch {
          // ignore
        }
      };
      abortSignal.addEventListener('abort', abortHandler);

      proc.stdout?.on('data', (d: Buffer) => {
        if (stdout.length < 2048) {
          stdout += d.toString().slice(0, 2048 - stdout.length);
        }
      });

      proc.stderr?.on('data', (d: Buffer) => {
        if (stderr.length < 2048) {
          stderr += d.toString().slice(0, 2048 - stderr.length);
        }
      });

      proc.on('error', (err: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        abortSignal.removeEventListener('abort', abortHandler);
        console.error(`[yt-dlp spawn error] job=${jobId}:`, err);
        const diag = classifyProcessError('download', null, stderr, stdout, err.code || err.message);
        resolve({ success: false, diagnostic: diag });
      });

      proc.on('close', (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        abortSignal.removeEventListener('abort', abortHandler);

        if (code === 0 && fs.existsSync(outputPath)) {
          resolve({ success: true });
        } else {
          // Log original error for server diagnostics
          console.error(`[yt-dlp failed] job=${jobId} code=${code} timedOut=${timedOut} stderr:`, stderr.trim());
          const diag = classifyProcessError('download', code, stderr, stdout, undefined, timedOut);
          resolve({ success: false, diagnostic: diag });
        }
      });
    });
  }

  /**
   * Sweeps expired export directories and marks jobs as expired
   */
  cleanupExpiredJobs() {
    const now = Date.now();
    for (const job of this.jobs.values()) {
      if (job.completedAt && now - job.completedAt > ARTIFACT_TTL_MS) {
        job.artifactAvailability = 'expired';
        const jobDir = path.join(this.exportsDir, job.id);
        const zipFile = job.zipPath;
        try {
          if (fs.existsSync(jobDir)) {
            fs.rmSync(jobDir, { recursive: true, force: true });
          }
          if (zipFile && fs.existsSync(zipFile)) {
            fs.unlinkSync(zipFile);
          }
        } catch (err) {
          console.error(`Error cleaning up expired job ${job.id}:`, err);
        }
      }
    }
  }
}
