import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { tagAndTranscodeMp3, verifyMp3WithProbe } from '../src/server/metadata';
import { runCommand } from '../src/server/process';

const TSX_CLI = path.resolve('node_modules/tsx/dist/cli.mjs');

/**
 * Helper to obtain an available ephemeral port
 */
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr !== 'object') {
        srv.close(() => reject(new Error('Failed to obtain server address')));
        return;
      }
      const port = addr.port;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on('error', reject);
  });
}

/**
 * Helper to wait for the test server to become responsive
 */
async function waitForServer(baseUrl: string, maxWaitMs = 12000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200) {
        return;
      }
    } catch {
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server at ${baseUrl} failed to respond within ${maxWaitMs}ms`);
}

/**
 * Gracefully stop a detached process group
 */
async function stopProcess(child: ReturnType<typeof spawn> | null): Promise<void> {
  if (!child || child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {}
  await new Promise((r) => setTimeout(r, 200));
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {}
}

test('Authenticated Pipeline & Synthetic Export Integration', async (t) => {
  // Pre-condition check for system tools
  const tools = ['/usr/bin/ffmpeg', '/usr/bin/ffprobe', '/usr/bin/unzip', '/usr/bin/zipinfo'];
  for (const bin of tools) {
    assert.ok(
      fs.existsSync(bin),
      `Required tool ${bin} is not available on system. Cannot run real binary integration test.`
    );
  }

  // Generate random test-only secret (never logged or committed)
  const testSecret = crypto.randomBytes(32).toString('hex');
  const testPort = await getFreePort();
  const testExportsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicrip-auth-export-'));
  const baseUrl = `http://127.0.0.1:${testPort}`;

  let serverProcess: ReturnType<typeof spawn> | null = null;

  try {
    // 1. Boot test server with isolated environment & detached process group
    serverProcess = spawn(process.execPath, [TSX_CLI, 'server.ts'], {
      env: {
        ...process.env,
        PORT: String(testPort),
        MUSICRIP_API_SECRET: testSecret,
        MUSICRIP_EXPORT_DIR: testExportsDir,
        NODE_ENV: 'test',
      },
      stdio: 'ignore',
      detached: true,
      cwd: process.cwd(),
    });

    await waitForServer(baseUrl);

    // 2. Authentication Enforcement Tests (Item 4)
    await t.test('HTTP Auth: Rejects missing credentials with 401', async () => {
      const res = await fetch(`${baseUrl}/api/export/job/dummy-job`);
      assert.strictEqual(res.status, 401);
      const authHeader = res.headers.get('www-authenticate') || '';
      assert.match(authHeader, /^Basic /);
      const data = await res.json();
      assert.match(data.error, /Personal access required/);
    });

    await t.test('HTTP Auth: Rejects invalid Bearer token with 401', async () => {
      const res = await fetch(`${baseUrl}/api/export/job/dummy-job`, {
        headers: { authorization: 'Bearer invalid-token-string' },
      });
      assert.strictEqual(res.status, 401);
    });

    await t.test('HTTP Auth: Rejects invalid Basic credentials with 401', async () => {
      const badBasic = Buffer.from('musicrip:wrong-password').toString('base64');
      const res = await fetch(`${baseUrl}/api/export/job/dummy-job`, {
        headers: { authorization: `Basic ${badBasic}` },
      });
      assert.strictEqual(res.status, 401);
    });

    await t.test('HTTP Auth: Authorizes valid Bearer credentials', async () => {
      // 404 indicates auth middleware succeeded and route handler ran (job not found)
      const res = await fetch(`${baseUrl}/api/export/job/non-existent-test-id`, {
        headers: { authorization: `Bearer ${testSecret}` },
      });
      assert.strictEqual(res.status, 404);
    });

    await t.test('HTTP Auth: Authorizes valid Basic credentials', async () => {
      const validBasic = Buffer.from(`musicrip:${testSecret}`).toString('base64');
      const res = await fetch(`${baseUrl}/api/export/job/non-existent-test-id`, {
        headers: { authorization: `Basic ${validBasic}` },
      });
      assert.strictEqual(res.status, 404);
    });

    await t.test('HTTP Auth: Authorizes valid x-musicrip-token header', async () => {
      const res = await fetch(`${baseUrl}/api/export/job/non-existent-test-id`, {
        headers: { 'x-musicrip-token': testSecret },
      });
      assert.strictEqual(res.status, 404);
    });

    // 3. Real Synthetic Diagnostic Export with 2 tracks (Item 5)
    let completedJobId = '';
    await t.test('Synthetic 2-Track Diagnostic: Executes and completes via real FFmpeg & Packaging', async () => {
      const startRes = await fetch(`${baseUrl}/api/export/diagnostic-synthetic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${testSecret}`,
        },
        body: JSON.stringify({
          title: 'Synthetic Test Release',
          artist: 'Audio Diagnostic Verifier',
          trackCount: 2,
        }),
      });

      assert.strictEqual(startRes.status, 200);
      const startData = await startRes.json();
      assert.ok(startData.job?.id);
      completedJobId = startData.job.id;
      assert.strictEqual(startData.job.isRealPipeline, true);
      assert.strictEqual(startData.job.isSyntheticDiagnostic, true);
      assert.strictEqual(startData.job.totalTracks, 2);

      // Poll until completion with bounded window
      let terminalJob: any = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 300));
        const pollRes = await fetch(`${baseUrl}/api/export/job/${completedJobId}`, {
          headers: { authorization: `Bearer ${testSecret}` },
        });
        assert.strictEqual(pollRes.status, 200);
        const pollData = await pollRes.json();
        if (['completed', 'partial', 'failed'].includes(pollData.job.processingStatus)) {
          terminalJob = pollData.job;
          break;
        }
      }

      assert.ok(terminalJob, 'Synthetic 2-track diagnostic job did not finish in time');
      assert.strictEqual(terminalJob.processingStatus, 'completed');
      assert.strictEqual(terminalJob.successfulTracksCount, 2);
      assert.strictEqual(terminalJob.failedTracksCount, 0);
      assert.strictEqual(terminalJob.artifactAvailability, 'available');
      assert.ok(typeof terminalJob.zipSizeBytes === 'number' && terminalJob.zipSizeBytes > 0);
      assert.strictEqual(terminalJob.tracks.length, 2);
      assert.strictEqual(terminalJob.tracks[0].status, 'completed');
      assert.strictEqual(terminalJob.tracks[1].status, 'completed');
    });

    // 4. Authenticated ZIP Download & Archive Verification (Item 6)
    await t.test('ZIP Download: Enforces authentication on download endpoint', async () => {
      const unauthRes = await fetch(`${baseUrl}/api/export/download/${completedJobId}`);
      assert.strictEqual(unauthRes.status, 401);
    });

    const extractionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicrip-extract-test-'));
    try {
      await t.test('ZIP Download & Extraction: Validates archive structure, safe paths, and MP3 integrity', async () => {
        const downloadRes = await fetch(`${baseUrl}/api/export/download/${completedJobId}`, {
          headers: { authorization: `Bearer ${testSecret}` },
        });

        assert.strictEqual(downloadRes.status, 200);
        const contentType = downloadRes.headers.get('content-type') || '';
        assert.ok(
          contentType.includes('application/zip') || contentType.includes('application/octet-stream'),
          `Unexpected content-type: ${contentType}`
        );

        const contentDisp = downloadRes.headers.get('content-disposition') || '';
        assert.match(contentDisp, /\.zip"/i);

        // Save downloaded archive
        const zipBuffer = Buffer.from(await downloadRes.arrayBuffer());
        assert.ok(zipBuffer.length > 0);
        const zipFile = path.join(extractionDir, 'downloaded.zip');
        fs.writeFileSync(zipFile, zipBuffer);

        // Verify ZIP integrity via real /usr/bin/unzip -t
        const testResult = await runCommand('/usr/bin/unzip', ['-t', zipFile]);
        assert.strictEqual(testResult.code, 0, 'ZIP integrity test failed');
        assert.ok(testResult.stdout.includes('No errors detected'));

        // Inspect entries via /usr/bin/zipinfo -1
        const listResult = await runCommand('/usr/bin/zipinfo', ['-1', zipFile]);
        assert.strictEqual(listResult.code, 0);
        const entries = listResult.stdout.trim().split('\n').map((e) => e.trim()).filter(Boolean);

        // Must have exactly 2 MP3 entries
        assert.strictEqual(entries.length, 2, `Expected exactly 2 entries in ZIP, got ${entries.length}`);

        // Verify safe paths (no directory traversal, no leading slashes)
        for (const entry of entries) {
          assert.ok(!entry.startsWith('/'), `Entry path must be relative: ${entry}`);
          assert.ok(!entry.includes('..'), `Entry path must not traverse: ${entry}`);
          assert.ok(entry.endsWith('.mp3'), `Entry must be an MP3 file: ${entry}`);
        }

        // Verify track ordering and filenames
        assert.strictEqual(
          entries[0],
          '01 - Audio Diagnostic Verifier - Synthetic Test Release #1.mp3'
        );
        assert.strictEqual(
          entries[1],
          '02 - Audio Diagnostic Verifier - Synthetic Test Release #2.mp3'
        );

        // Extract files to isolated directory
        const extractTarget = path.join(extractionDir, 'files');
        fs.mkdirSync(extractTarget, { recursive: true });
        const extractResult = await runCommand('/usr/bin/unzip', ['-q', zipFile, '-d', extractTarget]);
        assert.strictEqual(extractResult.code, 0, 'Unzip command failed');

        // Verify each extracted MP3 file via ffprobe
        for (let trackNum = 1; trackNum <= 2; trackNum++) {
          const entryName = entries[trackNum - 1];
          const extractedPath = path.join(extractTarget, entryName);
          assert.ok(fs.existsSync(extractedPath), `Extracted file missing: ${extractedPath}`);
          const stats = fs.statSync(extractedPath);
          assert.ok(stats.size > 1000, `Extracted file too small: ${stats.size} bytes`);

          // Run real ffprobe on the extracted file
          const probeResult = await runCommand('/usr/bin/ffprobe', [
            '-v', 'error',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            extractedPath,
          ]);
          assert.strictEqual(probeResult.code, 0);
          const meta = JSON.parse(probeResult.stdout);

          // Audio stream checks
          const audioStream = meta.streams?.find((s: any) => s.codec_type === 'audio');
          assert.ok(audioStream, `No audio stream found in ${entryName}`);
          assert.strictEqual(audioStream.codec_name, 'mp3');

          // Duration check (> 0)
          const duration = Number(meta.format?.duration);
          assert.ok(Number.isFinite(duration) && duration > 0, `Invalid duration: ${duration}`);

          // Metadata tags check
          const tags = Object.fromEntries(
            Object.entries(meta.format?.tags || {}).map(([k, v]) => [k.toLowerCase(), String(v)])
          );
          assert.strictEqual(tags.title, `Synthetic Test Release #${trackNum}`);
          assert.strictEqual(tags.artist, 'Audio Diagnostic Verifier');
          assert.strictEqual(tags.album, 'Synthetic Pipeline Diagnostic');
          assert.strictEqual(tags.track, String(trackNum));
        }
      });
    } finally {
      fs.rmSync(extractionDir, { recursive: true, force: true });
    }
  } finally {
    if (serverProcess) {
      await stopProcess(serverProcess);
    }
    fs.rmSync(testExportsDir, { recursive: true, force: true });
  }
});

test('HTTP Auth: Server without MUSICRIP_API_SECRET returns 503 fails-closed', async () => {
  const testPort = await getFreePort();
  const testExportsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicrip-unconfig-export-'));
  const baseUrl = `http://127.0.0.1:${testPort}`;

  let serverProcess: ReturnType<typeof spawn> | null = null;
  try {
    const envWithoutSecret = { ...process.env };
    delete envWithoutSecret.MUSICRIP_API_SECRET;
    serverProcess = spawn(process.execPath, [TSX_CLI, 'server.ts'], {
      env: {
        ...envWithoutSecret,
        PORT: String(testPort),
        MUSICRIP_EXPORT_DIR: testExportsDir,
        NODE_ENV: 'test',
      },
      stdio: 'ignore',
      detached: true,
      cwd: process.cwd(),
    });

    await waitForServer(baseUrl);

    // Protected endpoint must respond 503 when secret is unconfigured
    const res = await fetch(`${baseUrl}/api/export/job/test-job`, {
      headers: { authorization: 'Bearer test' },
    });
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.match(body.error, /Personal access is not configured/);
  } finally {
    if (serverProcess) {
      await stopProcess(serverProcess);
    }
    fs.rmSync(testExportsDir, { recursive: true, force: true });
  }
});

test('Metadata & Artwork: Persian metadata, non-first disc/track, and embedded local artwork verification', async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicrip-meta-test-'));
  try {
    const rawAudio = path.join(workDir, 'raw-source.mp3');
    const localCover = path.join(workDir, 'local-artwork.jpg');
    const taggedMp3 = path.join(workDir, 'tagged-output.mp3');

    // 1. Generate local test cover image using FFmpeg lavfi (no internet)
    const coverGenResult = await runCommand('/usr/bin/ffmpeg', [
      '-nostdin', '-y',
      '-f', 'lavfi',
      '-i', 'color=c=0x0f2027:s=300x300:d=1',
      '-vframes', '1',
      localCover,
    ]);
    assert.strictEqual(coverGenResult.code, 0, 'Failed to generate local test artwork');
    assert.ok(fs.existsSync(localCover) && fs.statSync(localCover).size > 0);

    // 2. Generate raw synthetic test audio
    const audioGenResult = await runCommand('/usr/bin/ffmpeg', [
      '-nostdin', '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=520:duration=2',
      '-c:a', 'libmp3lame',
      '-b:a', '192k',
      rawAudio,
    ]);
    assert.strictEqual(audioGenResult.code, 0, 'Failed to generate synthetic source audio');
    assert.ok(fs.existsSync(rawAudio));

    // 3. Apply Persian metadata with non-first disc/track via real tagAndTranscodeMp3
    const taggingOptions = {
      audioPath: rawAudio,
      outputPath: taggedMp3,
      title: 'نوای شبانه (Night Melody)',
      artist: 'کیهان کلهر (Kayhan Kalhor)',
      album: 'سفر به دیار ناشناخته (Journey Beyond)',
      albumArtist: 'کیهان کلهر',
      year: 2024,
      trackNumber: 3, // Non-first track
      totalTracks: 8,
      discNumber: 2,  // Non-first disc
      coverPath: localCover,
    };

    await tagAndTranscodeMp3(taggingOptions);
    assert.ok(fs.existsSync(taggedMp3), 'Tagged MP3 file was not produced');

    // 4. Verify via verifyMp3WithProbe
    const probe = await verifyMp3WithProbe(taggedMp3, taggingOptions);
    assert.strictEqual(probe.verified, true, `verifyMp3WithProbe failed: ${probe.error}`);
    assert.strictEqual(probe.hasArtwork, true, 'verifyMp3WithProbe reported missing artwork');
    assert.strictEqual(probe.hasAudio, true, 'verifyMp3WithProbe reported missing audio');
    assert.strictEqual(probe.codec, 'mp3');
    assert.ok(typeof probe.duration === 'number' && probe.duration > 0);

    // 5. Verify directly via ffprobe for precise stream disposition & ID3 tags
    const ffprobeResult = await runCommand('/usr/bin/ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      taggedMp3,
    ]);
    assert.strictEqual(ffprobeResult.code, 0);
    const parsed = JSON.parse(ffprobeResult.stdout);

    // Verify embedded artwork video stream disposition
    const videoStream = parsed.streams?.find((s: any) => s.codec_type === 'video');
    assert.ok(videoStream, 'Embedded artwork video stream is missing');
    assert.strictEqual(videoStream.disposition?.attached_pic, 1, 'Stream disposition attached_pic must be 1');
    assert.strictEqual(videoStream.codec_name, 'mjpeg');

    // Verify audio stream
    const audioStream = parsed.streams?.find((s: any) => s.codec_type === 'audio');
    assert.ok(audioStream, 'Audio stream is missing');
    assert.strictEqual(audioStream.codec_name, 'mp3');

    // Verify ID3v2 tags (case-insensitive keys)
    const tags = Object.fromEntries(
      Object.entries(parsed.format?.tags || {}).map(([k, v]) => [k.toLowerCase(), String(v)])
    );

    assert.strictEqual(tags.title, 'نوای شبانه (Night Melody)');
    assert.strictEqual(tags.artist, 'کیهان کلهر (Kayhan Kalhor)');
    assert.strictEqual(tags.album, 'سفر به دیار ناشناخته (Journey Beyond)');
    assert.strictEqual(tags.album_artist, 'کیهان کلهر');
    assert.strictEqual(tags.track, '3/8');
    assert.strictEqual(tags.disc, '2');
    assert.strictEqual(tags.date, '2024');
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});
