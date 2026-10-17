import assert from 'node:assert';
import test from 'node:test';

const BASE_URL = 'http://localhost:3000';

test('Server API - Health check reports environment capabilities', async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
  assert.strictEqual(typeof data.environment.hasPython, 'boolean');
  assert.strictEqual(typeof data.environment.hasFfmpeg, 'boolean');
  assert.strictEqual(typeof data.environment.hasYtDlp, 'boolean');
});

test('Server Export Pipeline - Creates genuine MP3 ZIP archive with 200 download response', async () => {
  const testRelease = {
    id: 'test-rel-srv-1',
    providerId: 'prov-srv-1',
    artistId: 'art-srv-1',
    artistName: 'Pipeline Proof Band',
    title: 'Tone Proof EP',
    year: 2024,
    type: 'album',
    isLive: false,
    editionLabel: 'Studio Master',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-tone-1', discNumber: 1, trackNumber: 1, title: 'Audio Verification Tone' }
        ]
      }
    ]
  };

  // 1. Start real export job
  const startRes = await fetch(`${BASE_URL}/api/export/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ release: testRelease })
  });

  assert.strictEqual(startRes.status, 200);
  const startData = await startRes.json();
  assert.ok(startData.job?.id);
  const jobId = startData.job.id;
  assert.strictEqual(startData.job.isRealPipeline, true);

  // 2. Poll job until completion
  let finalJob: any = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const pollRes = await fetch(`${BASE_URL}/api/export/job/${jobId}`);
    assert.strictEqual(pollRes.status, 200);
    const pollData = await pollRes.json();
    if (['completed', 'partial', 'failed'].includes(pollData.job.processingStatus)) {
      finalJob = pollData.job;
      break;
    }
  }

  assert.ok(finalJob, 'Job should complete within polling window');
  assert.strictEqual(finalJob.processingStatus, 'completed');
  assert.strictEqual(finalJob.artifactAvailability, 'available');
  assert.strictEqual(finalJob.successfulTracksCount, 1);
  assert.ok(finalJob.zipSizeBytes > 0, 'Generated ZIP must have non-zero file size');

  // 3. Test genuine ZIP download endpoint
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
