import assert from 'node:assert';
import test from 'node:test';
import fs from 'fs';
import path from 'path';
import { classifyProcessError } from '../src/server/diagnostics';
import { buildZipFilename, createExportZip } from '../src/server/packaging';
import { ExportPipelineManager } from '../src/server/worker';
import { ServerExportJob } from '../src/server/types';

test('Diagnostics - Classifies missing executable (ENOENT)', () => {
  const diag = classifyProcessError('download', null, 'spawn yt-dlp ENOENT', '', 'ENOENT');
  assert.strictEqual(diag.category, 'missing_executable');
  assert.strictEqual(diag.stage, 'download');
  assert.ok(diag.sanitizedMessage.includes('not installed or missing'));
});

test('Diagnostics - Classifies permission denied (EACCES)', () => {
  const diag = classifyProcessError('download', 126, 'permission denied', '', 'EACCES');
  assert.strictEqual(diag.category, 'permission_error');
  assert.strictEqual(diag.stage, 'download');
  assert.ok(diag.sanitizedMessage.includes('Permission denied'));
});

test('Diagnostics - Classifies process timeout', () => {
  const diag = classifyProcessError('download', null, '', '', undefined, true);
  assert.strictEqual(diag.category, 'timeout');
  assert.strictEqual(diag.stage, 'download');
  assert.ok(diag.sanitizedMessage.includes('exceeded maximum duration limit'));
});

test('Diagnostics - Classifies non-bot extraction error (video unavailable/private)', () => {
  const stderr = 'ERROR: [youtube] dQw4w9WgXcQ: Video unavailable. This video is private';
  const diag = classifyProcessError('download', 1, stderr, '');
  assert.strictEqual(diag.category, 'extraction_failure');
  assert.ok(diag.sanitizedMessage.includes('unavailable or no compatible stream found'));
});

test('Diagnostics - Classifies source restriction (bot verification / sign-in requirement)', () => {
  const stderr = 'ERROR: [youtube] Sign in to confirm you’re not a bot. This helps protect our community.';
  const diag = classifyProcessError('download', 1, stderr, '');
  assert.strictEqual(diag.category, 'source_restriction');
  // Must NOT declare the server IP is blocked; reports specific challenge
  assert.ok(diag.sanitizedMessage.includes('interactive bot verification challenge'));
});

test('Diagnostics - Classifies geo-restriction', () => {
  const stderr = 'ERROR: The uploader has not made this video available in your country';
  const diag = classifyProcessError('download', 1, stderr, '');
  assert.strictEqual(diag.category, 'source_restriction');
  assert.ok(diag.sanitizedMessage.includes('geographically restricted'));
});

test('Diagnostics - Classifies conversion failure', () => {
  const stderr = 'Error while opening encoder for output stream: libmp3lame';
  const diag = classifyProcessError('conversion', 1, stderr, '');
  assert.strictEqual(diag.category, 'conversion_failure');
  assert.ok(diag.sanitizedMessage.includes('Audio transcoding or tag embedding failed'));
});

test('Diagnostics - Classifies packaging failure', () => {
  const stderr = 'EBUSY: resource busy or locked';
  const diag = classifyProcessError('packaging', 1, stderr, '');
  assert.strictEqual(diag.category, 'packaging_failure');
  assert.ok(diag.sanitizedMessage.includes('ZIP compression archive creation failed'));
});

test('Diagnostics - Uses unknown category when cause is not established', () => {
  const diag = classifyProcessError('download', 42, 'an unexpected exit occurred', '');
  assert.strictEqual(diag.category, 'unknown');
  assert.strictEqual(diag.exitCode, 42);
  assert.ok(diag.sanitizedMessage.includes('code 42'));
});

test('Packaging - Builds ZIP filename without fabricating a fallback year', () => {
  // With known year
  const nameWithYear = buildZipFilename('Radiohead', 'Kid A', 2000);
  assert.strictEqual(nameWithYear, 'Radiohead - Kid A (2000).zip');

  // Without year: must NOT fabricate '2024' or any fallback!
  const nameWithoutYear = buildZipFilename('Radiohead', 'Kid A', undefined);
  assert.strictEqual(nameWithoutYear, 'Radiohead - Kid A.zip');
});

test('Packaging - Preserves multi-disc structure in ZIP paths', async () => {
  const testDir = path.join('/tmp', `zip_disc_test_${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });

  const f1 = path.join(testDir, 'track1.mp3');
  const f2 = path.join(testDir, 'track2.mp3');
  fs.writeFileSync(f1, 'dummy_audio_bytes_1');
  fs.writeFileSync(f2, 'dummy_audio_bytes_2');

  const zipPath = path.join(testDir, 'test.zip');
  const result = await createExportZip({
    tracks: [
      {
        trackId: 't1',
        discNumber: 1,
        trackNumber: 1,
        title: 'Disc One Track',
        artistCredit: 'Band',
        status: 'completed',
        progressPercent: 100,
        localPath: f1
      },
      {
        trackId: 't2',
        discNumber: 2,
        trackNumber: 1,
        title: 'Disc Two Track',
        artistCredit: 'Band',
        status: 'completed',
        progressPercent: 100,
        localPath: f2
      }
    ],
    zipPath,
    artistName: 'Band',
    releaseTitle: 'Double Album'
  });

  assert.strictEqual(result.totalFiles, 2);
  assert.strictEqual(result.discMetadataKnown, true);
  assert.ok(fs.existsSync(zipPath));
  assert.ok(fs.statSync(zipPath).size > 0);

  // Clean up
  fs.rmSync(testDir, { recursive: true, force: true });
});

test('Pipeline Manager - Cancellation terminates job and marks failed with not_created archive', () => {
  const manager = new ExportPipelineManager('/tmp/test_mgr', '/bin/non_existent');
  const testJob: ServerExportJob = {
    id: `cancel-test-${Date.now()}`,
    releaseId: 'rel-cancel',
    releaseTitle: 'Cancel Release',
    artistName: 'Cancel Band',
    processingStatus: 'queued',
    artifactAvailability: 'not_created',
    tracks: [
      {
        trackId: 'trk-1',
        discNumber: 1,
        trackNumber: 1,
        title: 'Pending Track',
        status: 'pending',
        progressPercent: 0
      }
    ],
    totalTracks: 1,
    successfulTracksCount: 0,
    failedTracksCount: 0,
    overallProgress: 0,
    createdAt: Date.now(),
    isRealPipeline: true
  };

  manager.enqueueJob(testJob);
  const cancelled = manager.cancelJob(testJob.id);
  assert.strictEqual(cancelled, true);

  const job = manager.getJob(testJob.id);
  assert.ok(job);
  assert.strictEqual(job.processingStatus, 'failed');
  assert.strictEqual(job.artifactAvailability, 'not_created');
  assert.strictEqual(job.errorMessage, 'Export was cancelled by user.');
});

test('Pipeline Manager - Retry preserves valid successful tracks without re-downloading', async () => {
  const testDir = path.join('/tmp', `retry_test_${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  const validPath = path.join(testDir, 'already_good.mp3');
  fs.writeFileSync(validPath, 'already_downloaded_data');

  const manager = new ExportPipelineManager(testDir, '/bin/non_existent');
  const testJob: ServerExportJob = {
    id: `retry-test-${Date.now()}`,
    releaseId: 'rel-retry',
    releaseTitle: 'Retry Release',
    artistName: 'Retry Band',
    processingStatus: 'partial',
    artifactAvailability: 'not_created',
    tracks: [
      {
        trackId: 'trk-good',
        discNumber: 1,
        trackNumber: 1,
        title: 'Good Track',
        status: 'completed',
        progressPercent: 100,
        localPath: validPath
      },
      {
        trackId: 'trk-bad',
        discNumber: 1,
        trackNumber: 2,
        title: 'Failed Track',
        status: 'failed',
        progressPercent: 0,
        error: 'Prior error'
      }
    ],
    totalTracks: 2,
    successfulTracksCount: 1,
    failedTracksCount: 1,
    overallProgress: 50,
    createdAt: Date.now(),
    isRealPipeline: true
  };

  (manager as any).jobs.set(testJob.id, testJob);
  const retryResult = manager.retryJob(testJob.id);
  assert.strictEqual(retryResult.success, true);

  const retriedJob = manager.getJob(testJob.id);
  assert.ok(retriedJob);
  // Track 1 must still be completed with valid localPath
  assert.strictEqual(retriedJob.tracks[0].status, 'completed');
  // Cancel job and wait for worker to settle before directory cleanup
  manager.cancelJob(testJob.id);
  await new Promise((r) => setTimeout(r, 200));
  fs.rmSync(testDir, { recursive: true, force: true });
});
