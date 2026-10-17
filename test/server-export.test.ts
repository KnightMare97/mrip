import assert from 'node:assert';
import test from 'node:test';

const BASE_URL = 'http://localhost:3000';

test('Server API - Health check reports observed capabilities with bounded checks', async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');

  // Verify bounded observed environment tools
  assert.strictEqual(typeof data.environment.python.available, 'boolean');
  assert.strictEqual(typeof data.environment.ffmpeg.available, 'boolean');
  assert.strictEqual(typeof data.environment.ffprobe.available, 'boolean');
  assert.strictEqual(typeof data.environment.ytdlp.available, 'boolean');
  assert.strictEqual(data.environment.storage.writable, true);

  // Does not claim source access based only on executable existence!
  assert.strictEqual(data.capabilities.sourceStreamAccess, 'unverified');
  assert.strictEqual(data.capabilities.localAudioSynthesis, true);
  assert.strictEqual(data.capabilities.mediaArchiving, true);
});

test('Pipeline Verification A - Explicit Synthetic Diagnostic (Local processing & ZIP proof)', async () => {
  // Starts strictly labeled synthetic diagnostic job
  const startRes = await fetch(`${BASE_URL}/api/export/diagnostic-synthetic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Synthetic Pipeline Proof',
      artist: 'Audio Diagnostic Verifier',
      trackCount: 1
    })
  });

  assert.strictEqual(startRes.status, 200);
  const startData = await startRes.json();
  assert.ok(startData.job?.id);
  const jobId = startData.job.id;
  assert.strictEqual(startData.job.isRealPipeline, true);
  assert.strictEqual(startData.job.isSyntheticDiagnostic, true);

  // Poll job until completion
  let finalJob: any = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const pollRes = await fetch(`${BASE_URL}/api/export/job/${jobId}`);
    assert.strictEqual(pollRes.status, 200);
    const pollData = await pollRes.json();
    if (['completed', 'partial', 'failed'].includes(pollData.job.processingStatus)) {
      finalJob = pollData.job;
      break;
    }
  }

  assert.ok(finalJob, 'Diagnostic job should complete within polling window');
  assert.strictEqual(finalJob.processingStatus, 'completed');
  assert.strictEqual(finalJob.artifactAvailability, 'available');
  assert.strictEqual(finalJob.successfulTracksCount, 1);
  assert.ok(finalJob.zipSizeBytes > 0, 'Generated ZIP must have non-zero file size');

  // Verify genuine ZIP download
  const downloadRes = await fetch(`${BASE_URL}/api/export/download/${jobId}`);
  assert.strictEqual(downloadRes.status, 200);
  assert.strictEqual(downloadRes.headers.get('content-type'), 'application/zip');
  assert.ok(downloadRes.headers.get('content-disposition')?.includes('attachment; filename='));

  const arrayBuffer = await downloadRes.arrayBuffer();
  assert.strictEqual(arrayBuffer.byteLength, finalJob.zipSizeBytes);
  // First 4 bytes of a valid ZIP file are PK\x03\x04
  const uint8 = new Uint8Array(arrayBuffer.slice(0, 4));
  assert.strictEqual(uint8[0], 0x50); // P
  assert.strictEqual(uint8[1], 0x4b); // K
  assert.strictEqual(uint8[2], 0x03);
  assert.strictEqual(uint8[3], 0x04);
});

test('Pipeline Validation - Unknown or unsupported track IDs fail validation and never fabricate tone', async () => {
  const invalidSelection = {
    title: 'Tone Replacement Test',
    artistName: 'Invalid Audio Attempt',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-fake-unknown-id', title: 'Should Never Be Replaced With A Tone' }
        ]
      }
    ]
  };

  const startRes = await fetch(`${BASE_URL}/api/export/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ release: invalidSelection })
  });

  // Must reject with 400 Bad Request
  assert.strictEqual(startRes.status, 400);
  const errorData = await startRes.json();
  assert.ok(errorData.error.includes('Validation failure'));
  assert.ok(errorData.error.includes('invalid YouTube video ID'));
});

test('Pipeline Validation - Rejects empty track selection', async () => {
  const emptySelection = {
    title: 'Empty Album',
    artistName: 'No Tracks Band',
    discs: [{ discNumber: 1, tracks: [] }]
  };

  const startRes = await fetch(`${BASE_URL}/api/export/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ release: emptySelection })
  });

  assert.strictEqual(startRes.status, 400);
  const errorData = await startRes.json();
  assert.ok(errorData.error.includes('At least one track must be selected'));
});

test('Pipeline Verification B - Authorized source integration (Records actual outcome and diagnostic evidence)', async () => {
  // Test with a standard 11-char YouTube ID (e.g. jNQXAC9IVRw - YouTube's first video 'Me at the zoo')
  const authorizedSourceRelease = {
    id: 'ytm-rel-test-src',
    title: 'Authorized Stream Test',
    artistName: 'Test Uploader',
    discs: [
      {
        discNumber: 1,
        tracks: [
          {
            id: 'ytm-trk:jNQXAC9IVRw',
            discNumber: 1,
            trackNumber: 1,
            title: 'Sample Track'
          }
        ]
      }
    ]
  };

  const startRes = await fetch(`${BASE_URL}/api/export/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ release: authorizedSourceRelease })
  });

  assert.strictEqual(startRes.status, 200);
  const startData = await startRes.json();
  assert.ok(startData.job?.id);
  const jobId = startData.job.id;

  // Poll until complete or terminal failure
  let finalJob: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const pollRes = await fetch(`${BASE_URL}/api/export/job/${jobId}`);
    assert.strictEqual(pollRes.status, 200);
    const pollData = await pollRes.json();
    if (['completed', 'partial', 'failed'].includes(pollData.job.processingStatus)) {
      finalJob = pollData.job;
      break;
    }
  }

  assert.ok(finalJob, 'Job should terminate within polling duration');

  // Verify that the outcome is recorded accurately
  if (finalJob.processingStatus === 'completed') {
    assert.strictEqual(finalJob.successfulTracksCount, 1);
    assert.strictEqual(finalJob.artifactAvailability, 'available');
  } else if (finalJob.processingStatus === 'failed') {
    assert.strictEqual(finalJob.successfulTracksCount, 0);
    assert.strictEqual(finalJob.artifactAvailability, 'not_created');
    // Verify diagnostic was captured on the track
    const track = finalJob.tracks[0];
    assert.ok(track.diagnostic, 'Track must have diagnostic information attached');
    assert.ok(typeof track.diagnostic.category === 'string');
    assert.ok(typeof track.diagnostic.sanitizedMessage === 'string');
    // Verify neutral job summary (no hardcoded IP blocked assertion)
    assert.ok(!finalJob.errorMessage.includes('YouTube bot verification blocked download on this server IP.'));
    assert.ok(finalJob.errorMessage.includes('0 of 1 tracks downloaded successfully'));
  }
});
