import fs from 'node:fs';
import path from 'node:path';
import { classifyProcessError } from './diagnostics';
import { downloadCoverImage, generateSyntheticTestTone, tagAndTranscodeMp3, verifyMp3WithProbe } from './metadata';
import { buildZipFilename, createExportZip } from './packaging';
import { CommandError, runCommand } from './process';
import type { ServerExportJob, ServerExportTrack, TrackDiagnostic } from './types';

export const MAX_CONCURRENT_WORKERS = 1;
export const MAX_QUEUED_JOBS = 5;
export const MAX_TRACKS_PER_JOB = 50;
export const TRACK_TIMEOUT_MS = 120000;
export const ARTIFACT_TTL_MS = 60 * 60 * 1000;
const defaults = { cover: downloadCoverImage, tag: tagAndTranscodeMp3, probe: verifyMp3WithProbe, tone: generateSyntheticTestTone, zip: createExportZip };
export type PipelineDependencies = Partial<typeof defaults> & { extract?: (url: string, output: string, signal: AbortSignal) => Promise<void> };

function isSuccessfulOutcome(job: ServerExportJob): boolean {
  return job.processingStatus === 'completed' || job.processingStatus === 'partial';
}

export class ExportPipelineManager {
  private jobs = new Map<string, ServerExportJob>();
  private controllers = new Map<string, AbortController>();
  private finishedAt = new Map<string, number>();
  private executionQueue: string[] = [];
  private running = new Set<string>();
  private sweep: ReturnType<typeof setInterval>;
  private io: typeof defaults;
  constructor(private exportsDir: string, private ytdlpPath: string, private dependencies: PipelineDependencies = {}) {
    fs.mkdirSync(exportsDir, { recursive: true });
    this.io = { ...defaults, ...dependencies };
    this.sweep = setInterval(() => this.cleanupExpiredJobs(), 600000);
    this.sweep.unref();
  }
  dispose() { clearInterval(this.sweep); for (const id of this.running) this.cancelJob(id); }
  getJob(id: string) { return this.jobs.get(id); }
  getAllJobs() { return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt); }
  getQueueStatus() { return { activeWorkers: this.running.size, queuedJobsCount: this.executionQueue.length, maxWorkers: MAX_CONCURRENT_WORKERS, maxQueue: MAX_QUEUED_JOBS }; }
  private recount(job: ServerExportJob) {
    job.successfulTracksCount = job.tracks.filter((track) => track.status === 'completed').length;
    job.failedTracksCount = job.tracks.filter((track) => track.status === 'failed').length;
    job.overallProgress = Math.floor((job.successfulTracksCount + job.failedTracksCount) / job.totalTracks * 90);
  }
  enqueueJob(job: ServerExportJob): { enqueued: boolean; error?: string } {
    if (!/^[A-Za-z0-9_-]+$/.test(job.id) || !job.tracks.length || job.tracks.length > MAX_TRACKS_PER_JOB) return { enqueued: false, error: 'Invalid job or track count.' };
    if (this.jobs.has(job.id)) return { enqueued: false, error: 'Duplicate job ID.' };
    if (this.executionQueue.length >= MAX_QUEUED_JOBS) return { enqueued: false, error: 'Export queue is full.' };
    job.totalTracks = job.tracks.length;
    this.recount(job);
    this.jobs.set(job.id, job);
    this.executionQueue.push(job.id);
    queueMicrotask(() => void this.drainQueue());
    return { enqueued: true };
  }
  private async drainQueue() {
    if (this.running.size >= MAX_CONCURRENT_WORKERS) return;
    const id = this.executionQueue.shift();
    if (!id) return;
    const job = this.jobs.get(id);
    if (!job) { void this.drainQueue(); return; }
    const controller = new AbortController();
    this.running.add(id);
    this.controllers.set(id, controller);
    job.processingStatus = 'processing';
    try { await this.run(job, controller.signal); }
    catch (error: any) {
      if (!controller.signal.aborted) { job.processingStatus = 'failed'; job.artifactAvailability = 'not_created'; job.errorMessage = `Pipeline failed: ${error.message}`; }
    } finally {
      this.controllers.delete(id);
      this.running.delete(id);
      this.finishedAt.set(id, Date.now());
      this.recount(job);
      if (isSuccessfulOutcome(job)) job.overallProgress = 100;
      void this.drainQueue();
    }
  }
  cancelJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || !['queued', 'processing'].includes(job.processingStatus)) return false;
    this.executionQueue = this.executionQueue.filter((queued) => queued !== id);
    this.controllers.get(id)?.abort();
    job.processingStatus = 'failed';
    job.artifactAvailability = 'not_created';
    job.errorMessage = 'Export was cancelled by user.';
    for (const track of job.tracks) if (track.status !== 'completed') { track.status = 'failed'; track.error = 'Cancelled by user.'; }
    this.recount(job);
    this.finishedAt.set(id, Date.now());
    return true;
  }
  retryJob(id: string): { success: boolean; job?: ServerExportJob; error?: string } {
    const job = this.jobs.get(id);
    if (!job) return { success: false, error: 'Job not found' };
    if (this.running.has(id) || this.executionQueue.includes(id)) return { success: false, error: 'Previous attempt is still settling or queued.' };
    if (this.executionQueue.length >= MAX_QUEUED_JOBS) return { success: false, error: 'Export queue is full.' };
    const valid = (track: ServerExportTrack) => track.status === 'completed' && !!track.localPath && fs.existsSync(track.localPath) && fs.statSync(track.localPath).size > 0;
    if (job.tracks.every(valid) && job.artifactAvailability === 'available' && job.zipPath && fs.existsSync(job.zipPath)) return { success: false, error: 'All tracks and archive are already available.' };
    for (const track of job.tracks) if (!valid(track)) { track.status = 'pending'; track.progressPercent = 0; track.localPath = undefined; track.error = undefined; track.diagnostic = undefined; }
    if (job.zipPath) fs.rmSync(job.zipPath, { force: true });
    job.zipPath = undefined; job.zipFilename = undefined; job.zipSizeBytes = undefined;
    job.artifactAvailability = 'not_created'; job.completedAt = undefined; job.errorMessage = undefined; job.processingStatus = 'queued';
    this.finishedAt.delete(id);
    this.recount(job);
    this.executionQueue.push(id);
    queueMicrotask(() => void this.drainQueue());
    return { success: true, job };
  }
  private async extract(url: string, output: string, signal: AbortSignal) {
    if (this.dependencies.extract) return this.dependencies.extract(url, output, signal);
    await runCommand(this.ytdlpPath, ['--no-playlist', '--no-warnings', '--no-progress', '--no-part', '--max-filesize', '100M', '-f', 'bestaudio/best', '-o', output, '--', url], signal, TRACK_TIMEOUT_MS);
  }
  private async run(job: ServerExportJob, signal: AbortSignal) {
    const directory = path.join(this.exportsDir, job.id);
    fs.mkdirSync(directory, { recursive: true });
    let coverPath: string | undefined;
    if (!job.isSyntheticDiagnostic && job.coverUrl) {
      const candidate = path.join(directory, 'cover.jpg');
      if (await this.io.cover(job.coverUrl, candidate, 6000, signal)) coverPath = candidate;
    }
    if (signal.aborted) return;
    for (const [index, track] of job.tracks.entries()) {
      if (signal.aborted) return;
      if (track.status === 'completed' && track.localPath && fs.existsSync(track.localPath)) continue;
      const raw = path.join(directory, `source_${index + 1}.media`);
      const output = path.join(directory, `track_${index + 1}.mp3`);
      let stage: 'download' | 'tagging' = 'download';
      try {
        fs.rmSync(raw, { force: true }); fs.rmSync(output, { force: true });
        if (job.isSyntheticDiagnostic) {
          track.status = 'converting';
          await this.io.tone(output, track.title, track.artistCredit || job.artistName, track.trackNumber, track.discNumber, job.year, signal);
        } else {
          const videoId = track.trackId.replace(/^(ytm-trk:|ytmusic:)/, '');
          if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error('Invalid YouTube video ID.');
          track.status = 'downloading'; track.progressPercent = 0;
          await this.extract(`https://www.youtube.com/watch?v=${videoId}`, raw, signal);
          if (signal.aborted) return;
          stage = 'tagging'; track.status = 'tagging';
          await this.io.tag({ audioPath: raw, outputPath: output, title: track.title, artist: track.artistCredit || job.artistName, albumArtist: job.albumArtist || job.artistName, album: job.releaseTitle, year: job.year, trackNumber: track.trackNumber, discNumber: track.discNumber, coverPath, signal });
        }
        if (signal.aborted) return;
        const expected = job.isSyntheticDiagnostic ? undefined : { audioPath: raw, outputPath: output, title: track.title, artist: track.artistCredit || job.artistName, albumArtist: job.albumArtist || job.artistName, album: job.releaseTitle, year: job.year, trackNumber: track.trackNumber, discNumber: track.discNumber, coverPath };
        const probe = await this.io.probe(output, expected, signal);
        if (signal.aborted) return;
        if (!probe.verified || !fs.existsSync(output) || fs.statSync(output).size === 0) throw new Error(probe.error || 'Output verification failed.');
        track.status = 'completed'; track.progressPercent = 100; track.localPath = output; track.error = undefined; track.diagnostic = undefined;
      } catch (error: any) {
        if (signal.aborted) return;
        track.status = 'failed'; track.error = error.message;
        let diagnostic: TrackDiagnostic = { category: stage === 'tagging' ? 'conversion_failure' : 'unknown', stage, sanitizedMessage: String(error.message).slice(0, 500) };
        if (error instanceof CommandError) { const r = error.result; diagnostic = classifyProcessError(stage, r.code, r.stderr, r.stdout, r.spawnCode, r.timedOut); }
        track.diagnostic = diagnostic;
      } finally {
        fs.rmSync(raw, { force: true });
        if (track.status !== 'completed') fs.rmSync(output, { force: true });
      }
      this.recount(job);
    }
    if (signal.aborted) return;
    this.recount(job);
    if (!job.successfulTracksCount) {
      job.processingStatus = 'failed'; job.artifactAvailability = 'not_created';
      const causes = [...new Set(job.tracks.map((track) => track.diagnostic?.sanitizedMessage || track.error).filter(Boolean))];
      job.errorMessage = `0 of ${job.totalTracks} tracks downloaded successfully. ${causes.join('; ')}`;
      return;
    }
    const staging = path.join(this.exportsDir, `${job.id}.zip.part`);
    const destination = path.join(this.exportsDir, `${job.id}.zip`);
    try {
      await this.io.zip({ tracks: job.tracks, zipPath: staging, artistName: job.artistName, releaseTitle: job.releaseTitle, year: job.year });
      if (signal.aborted) return;
      fs.renameSync(staging, destination);
      job.zipPath = destination;
      job.zipFilename = buildZipFilename(job.artistName, job.releaseTitle + (job.editionLabel ? ` [${job.editionLabel}]` : ''), job.year);
      job.zipSizeBytes = fs.statSync(destination).size;
      job.artifactAvailability = 'available'; job.completedAt = Date.now();
      job.processingStatus = job.successfulTracksCount === job.totalTracks ? 'completed' : 'partial';
    } finally { fs.rmSync(staging, { force: true }); }
  }
  cleanupExpiredJobs() {
    for (const job of this.jobs.values()) {
      if (this.running.has(job.id) || this.executionQueue.includes(job.id)) continue;
      const finished = this.finishedAt.get(job.id) ?? job.completedAt;
      if (!finished || Date.now() - finished <= ARTIFACT_TTL_MS) continue;
      try {
        fs.rmSync(path.join(this.exportsDir, job.id), { recursive: true, force: true });
        fs.rmSync(path.join(this.exportsDir, `${job.id}.zip`), { force: true });
        fs.rmSync(path.join(this.exportsDir, `${job.id}.zip.part`), { force: true });
        if (job.artifactAvailability === 'available') job.artifactAvailability = 'expired';
      } catch (error) { console.error('Export cleanup failed', job.id, error); }
    }
  }
}
