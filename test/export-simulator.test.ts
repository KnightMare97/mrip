import assert from 'node:assert';
import test from 'node:test';
import { SimulatedExportService } from '../src/services/export/SimulatedExportService';
import { Release } from '../src/types/music';

// Test Release Fixture
const testRelease: Release = {
  id: 'rel-test-1',
  providerId: 'prov-1',
  artistId: 'art-1',
  artistName: 'Test Artist',
  title: 'Test Album',
  year: 2024,
  type: 'album',
  isLive: false,
  editionLabel: 'Standard',
  coverSeed: 'seed',
  discs: [
    {
      discNumber: 1,
      tracks: [
        { id: 't1', providerId: 'p1', discNumber: 1, trackNumber: 1, title: 'Track One', durationSeconds: 200 },
        { id: 't2', providerId: 'p2', discNumber: 1, trackNumber: 2, title: 'Track Two', durationSeconds: 220 },
        { id: 't3', providerId: 'p3', discNumber: 1, trackNumber: 3, title: 'Track Three', durationSeconds: 180 }
      ]
    }
  ]
};

test('Export Simulator - Excluded tracks remain excluded and process moves to next track', async () => {
  const service = new SimulatedExportService();
  service.stepDelayMultiplier = 0.05; // Fast execution for test

  const job = await service.startExport(testRelease, { scenarioPreset: 'ambiguous_match' });
  assert.strictEqual(job.processingStatus, 'queued');

  // Wait until job enters awaiting_review
  await new Promise<void>((resolve) => {
    const unsub = service.subscribe(job.id, (updated) => {
      if (updated.processingStatus === 'awaiting_review') {
        unsub();
        resolve();
      }
    });
  });

  const reviewingJob = service.getJob(job.id)!;
  assert.strictEqual(reviewingJob.processingStatus, 'awaiting_review');
  assert.ok(reviewingJob.ambiguousReview);

  const trackIdToExclude = reviewingJob.ambiguousReview.trackId;

  // User excludes the track (candidate = null)
  await service.resolveAmbiguousMatch(job.id, trackIdToExclude, null);

  const afterExclude = service.getJob(job.id)!;
  const excludedTrack = afterExclude.tracks.find((t) => t.trackId === trackIdToExclude)!;
  assert.strictEqual(excludedTrack.status, 'excluded');

  // Wait until export reaches terminal state
  await new Promise<void>((resolve) => {
    const unsub = service.subscribe(job.id, (updated) => {
      if (['completed', 'partial', 'failed'].includes(updated.processingStatus)) {
        unsub();
        resolve();
      }
    });
  });

  const finalJob = service.getJob(job.id)!;
  // A 3-track album with 1 excluded track must be PARTIAL, not completed
  assert.strictEqual(finalJob.processingStatus, 'partial');
  assert.strictEqual(finalJob.excludedTracksCount, 1);
  assert.strictEqual(finalJob.successfulTracksCount, 2);
  assert.strictEqual(finalJob.artifactAvailability, 'available');
});

test('Export Simulator - Cancellation disposes intervals and stops stale completion', async () => {
  const service = new SimulatedExportService();
  service.stepDelayMultiplier = 0.1;

  const job = await service.startExport(testRelease, { scenarioPreset: 'default' });
  assert.strictEqual(job.processingStatus, 'queued');

  // Cancel immediately
  const canceled = await service.cancelJob(job.id);
  assert.strictEqual(canceled, true);

  const canceledJob = service.getJob(job.id)!;
  assert.strictEqual(canceledJob.processingStatus, 'failed');
  assert.strictEqual(canceledJob.artifactAvailability, 'not_created');

  // Wait long enough for any timers to have fired if they were not cleared
  await new Promise((resolve) => setTimeout(resolve, 500));

  const afterWaitJob = service.getJob(job.id)!;
  // Must STILL be failed, must not have transitioned to completed or available
  assert.strictEqual(afterWaitJob.processingStatus, 'failed');
  assert.strictEqual(afterWaitJob.artifactAvailability, 'not_created');
  assert.strictEqual(afterWaitJob.simulatedArchive, undefined);
});

test('Export Simulator - Retry preserves successful tracks without duplicates and respects exclusions', async () => {
  const service = new SimulatedExportService();
  service.stepDelayMultiplier = 0.05;

  const job = await service.startExport(testRelease, { scenarioPreset: 'missing_track' });

  // Wait for partial completion
  await new Promise<void>((resolve) => {
    const unsub = service.subscribe(job.id, (updated) => {
      if (['completed', 'partial', 'failed'].includes(updated.processingStatus)) {
        unsub();
        resolve();
      }
    });
  });

  const partialJob = service.getJob(job.id)!;
  assert.strictEqual(partialJob.processingStatus, 'partial');
  assert.strictEqual(partialJob.failedTracksCount, 1);
  assert.strictEqual(partialJob.successfulTracksCount, 2);

  // Mark one track excluded manually to test exclusion retention on retry
  partialJob.tracks[0].status = 'excluded';

  // Now retry without the error preset so the remaining failed track can succeed
  await service.retryJob(job.id, { scenarioPreset: 'default' });

  const retryingJob = service.getJob(job.id)!;
  assert.strictEqual(retryingJob.processingStatus, 'queued');
  assert.strictEqual(retryingJob.artifactAvailability, 'not_created');
  // Check that track 0 is still excluded, not reinstated!
  assert.strictEqual(retryingJob.tracks[0].status, 'excluded');
  // Track 1 should still be completed (preserved without duplication)
  assert.strictEqual(retryingJob.tracks[1].status, 'completed');

  // Wait for finish
  await new Promise<void>((resolve) => {
    const unsub = service.subscribe(job.id, (updated) => {
      if (['completed', 'partial', 'failed'].includes(updated.processingStatus)) {
        unsub();
        resolve();
      }
    });
  });

  const finalJob = service.getJob(job.id)!;
  // Track 0 was excluded, tracks 1 & 2 succeeded => 2 successful, 1 excluded => partial
  assert.strictEqual(finalJob.processingStatus, 'partial');
  assert.strictEqual(finalJob.successfulTracksCount, 2);
  assert.strictEqual(finalJob.excludedTracksCount, 1);
  assert.strictEqual(finalJob.failedTracksCount, 0);
  assert.strictEqual(finalJob.tracks.length, 3); // No duplicates!
});

test('Export Simulator - Zero successful tracks marks job failed with no archive', async () => {
  const service = new SimulatedExportService();
  service.stepDelayMultiplier = 0.05;

  const singleTrackRelease: Release = {
    ...testRelease,
    discs: [
      {
        discNumber: 1,
        tracks: [{ id: 'solo-1', providerId: 'p-s1', discNumber: 1, trackNumber: 1, title: 'Solo Track' }]
      }
    ]
  };

  const job = await service.startExport(singleTrackRelease, { scenarioPreset: 'server_error' });

  await new Promise<void>((resolve) => {
    const unsub = service.subscribe(job.id, (updated) => {
      if (updated.processingStatus === 'failed') {
        unsub();
        resolve();
      }
    });
  });

  const failedJob = service.getJob(job.id)!;
  assert.strictEqual(failedJob.processingStatus, 'failed');
  assert.strictEqual(failedJob.artifactAvailability, 'not_created');
  assert.strictEqual(failedJob.simulatedArchive, undefined);
  assert.strictEqual(failedJob.successfulTracksCount, 0);
});
