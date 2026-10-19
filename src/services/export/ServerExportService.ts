import type { ExportJob, ExportOptions, MatchCandidate, ProcessingStatus, TrackExportItem } from '../../types/export';
import type { Release } from '../../types/music';
import type { ExportService, JobSubscriber } from './ExportService';
import type { ServerExportJob } from '../../server/types';

const STORAGE_KEY = 'musicrip_live_jobs_v2';
const terminal = (status: string) => ['completed', 'partial', 'failed'].includes(status);
type Watch = { timer?: ReturnType<typeof setTimeout>; controller?: AbortController; failures: number };

export class ServerExportService implements ExportService {
  private jobs = new Map<string, ExportJob>();
  private subscribers = new Map<string, Set<JobSubscriber>>();
  private allSubscribers = new Set<(jobs: ExportJob[]) => void>();
  private watches = new Map<string, Watch>();
  constructor() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('musicrip_export_jobs_v1') ?? '[]';
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      for (const row of list.slice(0, 100)) if (row?.isRealPipeline === true && typeof row.id === 'string' && Array.isArray(row.tracks)) {
        this.jobs.set(row.id, { ...row, artifactAvailability: 'not_created', realDownloadUrl: undefined, errorMessage: 'Saved history: server state and file availability have not been verified.' });
      }
    } catch { /* Invalid local history is not live server evidence. */ }
  }
  private notify(job: ExportJob) {
    this.jobs.set(job.id, job);
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(this.getAllJobs().slice(0, 100).map((row) => ({ ...row, realDownloadUrl: undefined })))); } catch { console.warn('Live job history could not be saved locally.'); }
    this.subscribers.get(job.id)?.forEach((callback) => callback({ ...job }));
    this.allSubscribers.forEach((callback) => callback(this.getAllJobs()));
  }
  getJob(id: string): ExportJob | null { return this.jobs.get(id) || null; }
  getAllJobs(): ExportJob[] { return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt); }
  subscribe(id: string, callback: JobSubscriber): () => void {
    if (!this.subscribers.has(id)) this.subscribers.set(id, new Set());
    this.subscribers.get(id)!.add(callback); const job = this.jobs.get(id); if (job) { callback({ ...job }); this.watch(id); }
    return () => { this.subscribers.get(id)?.delete(callback); };
  }
  subscribeAll(callback: (jobs: ExportJob[]) => void): () => void {
    this.allSubscribers.add(callback); callback(this.getAllJobs());
    if (this.allSubscribers.size === 1) for (const job of this.getAllJobs().slice(0, 20)) this.watch(job.id);
    return () => { this.allSubscribers.delete(callback); if (!this.allSubscribers.size && ![...this.subscribers.values()].some((set) => set.size)) for (const id of [...this.watches.keys()]) this.stop(id); };
  }
  private async request(url: string, method = 'GET', body?: unknown, controller = new AbortController()): Promise<any> {
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || `Server request failed (${response.status}).`), { status: response.status });
      return data;
    } finally { clearTimeout(timeout); }
  }
  private receive(server: ServerExportJob, selective?: boolean): ExportJob {
    const previous = this.jobs.get(server.id);
    const tracks: TrackExportItem[] = server.tracks.map((track) => ({ trackId: track.trackId, discNumber: track.discNumber, trackNumber: track.trackNumber, title: track.title, artistCredit: track.artistCredit, status: track.status === 'converting' ? 'tagging' : track.status, progressPercent: track.progressPercent, failureReason: track.diagnostic?.sanitizedMessage || track.error, diagnostic: track.diagnostic }));
    let status: ProcessingStatus = server.processingStatus === 'processing' ? 'resolving' : server.processingStatus;
    if (server.processingStatus === 'processing') {
      if (tracks.some((track) => track.status === 'tagging')) status = 'tagging';
      else if (tracks.some((track) => track.status === 'downloading')) status = 'downloading';
      else if (tracks.length && tracks.every((track) => ['completed', 'failed'].includes(track.status))) status = 'packaging';
    }
    const available = server.artifactAvailability === 'available' && !!server.zipFilename;
    const job: ExportJob = { id: server.id, releaseId: server.releaseId, releaseTitle: server.releaseTitle, artistName: server.artistName, editionLabel: server.editionLabel, year: server.year, targetFormat: 'MP3', processingStatus: status, artifactAvailability: server.artifactAvailability, tracks, currentTrackIndex: Math.max(0, tracks.findIndex((track) => !['completed', 'failed'].includes(track.status))), totalTracks: server.totalTracks, successfulTracksCount: server.successfulTracksCount, failedTracksCount: server.failedTracksCount, excludedTracksCount: 0, overallProgress: server.overallProgress, createdAt: server.createdAt, completedAt: server.completedAt, errorMessage: server.errorMessage, isRealPipeline: true, isSelective: selective ?? previous?.isSelective, downloadRequested: previous?.downloadRequested, realDownloadUrl: available ? `/api/export/download/${encodeURIComponent(server.id)}` : undefined, realZipFilename: available ? server.zipFilename : undefined, realZipSizeBytes: available ? server.zipSizeBytes : undefined };
    this.notify(job); return job;
  }
  private stop(id: string) { const watch = this.watches.get(id); if (watch?.timer) clearTimeout(watch.timer); watch?.controller?.abort(); this.watches.delete(id); }
  private watch(id: string) {
    if (this.watches.has(id)) return;
    const state: Watch = { failures: 0 }; this.watches.set(id, state);
    const poll = async () => {
      if (this.watches.get(id) !== state) return;
      const controller = new AbortController(); state.controller = controller;
      try {
        const data = await this.request(`/api/export/job/${encodeURIComponent(id)}`, 'GET', undefined, controller);
        if (this.watches.get(id) !== state) return;
        state.failures = 0; this.receive(data.job);
        if (terminal(data.job.processingStatus)) { this.stop(id); return; }
      } catch (error: any) {
        if (this.watches.get(id) !== state) return;
        state.failures++; const job = this.jobs.get(id);
        if (job) {
          job.errorMessage = `Server status could not be refreshed: ${error.message}`;
          job.artifactAvailability = 'not_created'; job.realDownloadUrl = undefined;
          if (error.status === 404 && !terminal(job.processingStatus)) { job.processingStatus = 'failed'; job.isInterrupted = true; }
          this.notify(job);
        }
        if ([401, 403, 404, 503].includes(error.status) || state.failures >= 5) { this.stop(id); return; }
      }
      if (this.watches.get(id) === state) state.timer = setTimeout(() => void poll(), Math.min(30000, 1000 * 2 ** state.failures));
    };
    void poll();
  }
  async startExport(release: Release, options?: ExportOptions): Promise<ExportJob> {
    if (options?.selectedTrackIds && !options.selectedTrackIds.length) throw new Error('Select at least one track.');
    const data = await this.request('/api/export/start', 'POST', { release, selectedTrackIds: options?.selectedTrackIds });
    const job = this.receive(data.job, !!options?.selectedTrackIds && options.selectedTrackIds.length < (release.discs || []).flatMap((disc) => disc.tracks || []).length); this.watch(job.id); return job;
  }
  async retryJob(id: string, _options?: ExportOptions): Promise<ExportJob | null> {
    if (!this.jobs.has(id)) return null;
    this.stop(id);
    try { const data = await this.request(`/api/export/retry/${encodeURIComponent(id)}`, 'POST'); const job = this.receive(data.job); this.watch(id); return job; }
    catch (error: any) { const job = this.jobs.get(id)!; job.errorMessage = error.message; this.notify(job); this.watch(id); return null; }
  }
  async cancelJob(id: string): Promise<boolean> {
    if (!this.jobs.has(id)) return false;
    this.stop(id);
    try { const data = await this.request(`/api/export/cancel/${encodeURIComponent(id)}`, 'POST'); if (!data.success || !data.job) throw new Error('Server did not confirm cancellation.'); this.receive(data.job); return true; }
    catch (error: any) { const job = this.jobs.get(id)!; job.errorMessage = `Cancellation was not confirmed: ${error.message}`; this.notify(job); this.watch(id); return false; }
  }
  async resolveAmbiguousMatch(_id: string, _track: string, _candidate: MatchCandidate | null): Promise<void> { throw new Error('Live match review is not implemented.'); }
  simulateArtifactExpiry(_id: string): void { /* Real artifact availability is owned by the server. */ }
}
export const serverExportService = new ServerExportService();
