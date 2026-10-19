import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ExportPipelineManager, ARTIFACT_TTL_MS, type PipelineDependencies } from '../src/server/worker';
import type { ServerExportJob } from '../src/server/types';
import { runCommand } from '../src/server/process';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));
async function idle(manager: ExportPipelineManager) {
  for (let i = 0; i < 200; i++) { await tick(); const q = manager.getQueueStatus(); if (!q.activeWorkers && !q.queuedJobsCount) return; }
  throw new Error('Worker failed to settle');
}
function job(id: string): ServerExportJob {
  return { id, releaseId: 'release', releaseTitle: 'Album', artistName: 'Artist', processingStatus: 'queued', artifactAvailability: 'not_created', tracks: [1, 2].map((n) => ({ trackId: `ytm-trk:abcdefghij${n}`, discNumber: 1, trackNumber: n, title: `Track ${n}`, status: 'pending', progressPercent: 0 })), totalTracks: 2, successfulTracksCount: 0, failedTracksCount: 0, overallProgress: 0, createdAt: Date.now(), isRealPipeline: true };
}
function setup(overrides: PipelineDependencies = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mrip-regression-'));
  const manager = new ExportPipelineManager(directory, '/missing', {
    extract: async (_url, out) => { fs.writeFileSync(out, 'source'); },
    tag: async (options) => { fs.writeFileSync(options.outputPath, 'tagged'); },
    probe: async () => ({ verified: true, hasAudio: true }),
    zip: async (options) => { fs.writeFileSync(options.zipPath, 'mock archive'); return { totalFiles: options.tracks.filter((track) => track.status === 'completed').length, discMetadataKnown: true }; },
    ...overrides
  });
  return { manager, directory, close: () => { manager.dispose(); fs.rmSync(directory, { recursive: true, force: true }); } };
}

test('cancel during tagging never publishes an archive and blocks retry until settled', async () => {
  let release!: () => void; let started!: () => void;
  const began = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ctx = setup({ tag: async (options) => { started(); await gate; fs.writeFileSync(options.outputPath, 'late result'); } });
  try {
    const item = job('cancel-tag'); ctx.manager.enqueueJob(item); await began;
    assert.equal(ctx.manager.cancelJob(item.id), true);
    assert.equal(ctx.manager.retryJob(item.id).success, false);
    release(); await idle(ctx.manager);
    assert.equal(item.processingStatus, 'failed'); assert.equal(item.artifactAvailability, 'not_created');
    assert.equal(item.successfulTracksCount, 0); assert.equal(fs.existsSync(path.join(ctx.directory, `${item.id}.zip`)), false);
  } finally { release(); await idle(ctx.manager); ctx.close(); }
});

test('retry preserves successful files, resets counts, and cannot expire active work', async () => {
  let fail = true; const extracted: string[] = [];
  const ctx = setup({ extract: async (url, out) => { extracted.push(url); if (fail && url.endsWith('2')) throw new Error('temporary failure'); fs.writeFileSync(out, 'audio'); } });
  try {
    const item = job('retry-counts'); ctx.manager.enqueueJob(item); await idle(ctx.manager);
    assert.equal(item.processingStatus, 'partial'); assert.equal(item.failedTracksCount, 1);
    item.completedAt = Date.now() - ARTIFACT_TTL_MS - 1; fail = false;
    assert.equal(ctx.manager.retryJob(item.id).success, true);
    assert.equal(item.artifactAvailability, 'not_created'); assert.equal(item.completedAt, undefined);
    ctx.manager.cleanupExpiredJobs(); await idle(ctx.manager);
    assert.equal(item.processingStatus, 'completed'); assert.equal(item.successfulTracksCount, 2); assert.equal(item.failedTracksCount, 0);
    assert.equal(extracted.filter((url) => url.endsWith('1')).length, 1);
  } finally { await idle(ctx.manager); ctx.close(); }
});

test('cancel during packaging discards staged ZIP without overwriting cancellation', async () => {
  let release!: () => void; let started!: () => void;
  const began = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ctx = setup({ zip: async (options) => { started(); await gate; fs.writeFileSync(options.zipPath, 'late zip'); return { totalFiles: 2, discMetadataKnown: true }; } });
  try {
    const item = job('cancel-zip'); ctx.manager.enqueueJob(item); await began;
    ctx.manager.cancelJob(item.id); release(); await idle(ctx.manager);
    assert.equal(item.processingStatus, 'failed'); assert.equal(item.artifactAvailability, 'not_created');
    assert.equal(fs.existsSync(path.join(ctx.directory, `${item.id}.zip.part`)), false);
  } finally { release(); await idle(ctx.manager); ctx.close(); }
});

test('zero success does not package; packaging failures can be retried without downloading again', async () => {
  let extracts = 0; let archives = 0; let failPackaging = true;
  const ctx = setup({ extract: async (_url, out) => { extracts++; fs.writeFileSync(out, 'audio'); }, zip: async (options) => { archives++; if (failPackaging) throw new Error('disk error'); fs.writeFileSync(options.zipPath, 'zip'); return { totalFiles: 2, discMetadataKnown: true }; } });
  try {
    const item = job('repack'); ctx.manager.enqueueJob(item); await idle(ctx.manager); assert.equal(item.processingStatus, 'failed');
    failPackaging = false; assert.equal(ctx.manager.retryJob(item.id).success, true); await idle(ctx.manager);
    assert.equal(item.processingStatus, 'completed'); assert.equal(extracts, 2); assert.equal(archives, 2);
  } finally { await idle(ctx.manager); ctx.close(); }
  let packaged = false; const bad = setup({ extract: async () => { throw new Error('no source'); }, zip: async () => { packaged = true; throw new Error('must not run'); } });
  try { const item = job('zero'); bad.manager.enqueueJob(item); await idle(bad.manager); assert.equal(item.failedTracksCount, 2); assert.equal(packaged, false); assert.equal(item.artifactAvailability, 'not_created'); } finally { await idle(bad.manager); bad.close(); }
});

test('command runner handles success, missing tools, timeout, and cancellation without media dependencies', async () => {
  const result = await runCommand(process.execPath, ['-e', 'process.stdout.write("ok")']); assert.equal(result.stdout, 'ok');
  await assert.rejects(runCommand('/definitely-not-a-mrip-tool', []));
  await assert.rejects(runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], undefined, 20), /timed out/);
  const controller = new AbortController(); const pending = runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], controller.signal);
  controller.abort(); await assert.rejects(pending, /cancelled/);
});
