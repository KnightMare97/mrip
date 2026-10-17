import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  DiagnosticCategory,
  DiagnosticStage,
  EnvironmentReport,
  EnvironmentToolCheck,
  TrackDiagnostic
} from './types';

const DIAGNOSTIC_TIMEOUT_MS = 2500;
const MAX_OUTPUT_CAPTURE_BYTES = 2048;

/**
 * Executes a binary with bounded runtime and output capture
 */
export function runBoundedCommand(
  executable: string,
  args: string[],
  timeoutMs: number = DIAGNOSTIC_TIMEOUT_MS
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean; error?: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    let proc: any;
    try {
      proc = spawn(executable, args);
    } catch (err: any) {
      return resolve({
        exitCode: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        error: err.code || err.message
      });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, timeoutMs);

    proc.stdout?.on('data', (data: Buffer) => {
      if (stdout.length < MAX_OUTPUT_CAPTURE_BYTES) {
        stdout += data.toString().slice(0, MAX_OUTPUT_CAPTURE_BYTES - stdout.length);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      if (stderr.length < MAX_OUTPUT_CAPTURE_BYTES) {
        stderr += data.toString().slice(0, MAX_OUTPUT_CAPTURE_BYTES - stderr.length);
      }
    });

    proc.on('error', (err: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: null,
        stdout,
        stderr,
        timedOut: false,
        error: err.code || err.message
      });
    });

    proc.on('close', (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut,
        error: timedOut ? 'TIMEOUT' : undefined
      });
    });
  });
}

/**
 * Checks environment capabilities with bounded executions
 */
export async function inspectEnvironment(
  ytdlpPath: string,
  exportsDir: string
): Promise<EnvironmentReport> {
  const [pyResult, ffResult, probeResult, ytResult] = await Promise.all([
    runBoundedCommand('/usr/bin/python3', ['--version']),
    runBoundedCommand('/usr/bin/ffmpeg', ['-version']),
    runBoundedCommand('/usr/bin/ffprobe', ['-version']),
    fs.existsSync(ytdlpPath)
      ? runBoundedCommand(ytdlpPath, ['--version'])
      : Promise.resolve({ exitCode: null, stdout: '', stderr: '', timedOut: false, error: 'ENOENT' })
  ]);

  const pythonCheck: EnvironmentToolCheck = {
    available: pyResult.exitCode === 0,
    version: pyResult.stdout.split('\n')[0] || undefined,
    path: '/usr/bin/python3',
    error: pyResult.error || (pyResult.exitCode !== 0 ? pyResult.stderr : undefined)
  };

  const ffmpegCheck: EnvironmentToolCheck = {
    available: ffResult.exitCode === 0,
    version: ffResult.stdout.split('\n')[0]?.split('Copyright')[0]?.trim() || undefined,
    path: '/usr/bin/ffmpeg',
    error: ffResult.error || (ffResult.exitCode !== 0 ? ffResult.stderr : undefined)
  };

  const ffprobeCheck: EnvironmentToolCheck = {
    available: probeResult.exitCode === 0,
    version: probeResult.stdout.split('\n')[0]?.split('Copyright')[0]?.trim() || undefined,
    path: '/usr/bin/ffprobe',
    error: probeResult.error || (probeResult.exitCode !== 0 ? probeResult.stderr : undefined)
  };

  const ytdlpCheck: EnvironmentToolCheck = {
    available: ytResult.exitCode === 0,
    version: ytResult.stdout.split('\n')[0] || undefined,
    path: ytdlpPath,
    error: ytResult.error || (ytResult.exitCode !== 0 ? ytResult.stderr : undefined)
  };

  // Test temporary directory writability
  let storageWritable = false;
  let storageError: string | undefined;
  const probeFile = path.join(exportsDir, `.write_probe_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  try {
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    fs.writeFileSync(probeFile, 'musicrip_probe_bytes');
    const read = fs.readFileSync(probeFile, 'utf8');
    if (read === 'musicrip_probe_bytes') {
      storageWritable = true;
    }
    fs.unlinkSync(probeFile);
  } catch (err: any) {
    storageWritable = false;
    storageError = err.message || 'Storage write failed';
  }

  const isDegraded =
    !pythonCheck.available ||
    !ffmpegCheck.available ||
    !ffprobeCheck.available ||
    !storageWritable;

  return {
    status: isDegraded ? 'degraded' : 'ok',
    environment: {
      python: pythonCheck,
      ffmpeg: ffmpegCheck,
      ffprobe: ffprobeCheck,
      ytdlp: ytdlpCheck,
      storage: {
        path: exportsDir,
        writable: storageWritable,
        error: storageError
      }
    },
    capabilities: {
      localAudioSynthesis: ffmpegCheck.available,
      metadataExtraction: ffprobeCheck.available,
      mediaArchiving: storageWritable,
      // We do not assume source access based only on executable existence!
      sourceStreamAccess: 'unverified'
    }
  };
}

/**
 * Classifies process failure into precise diagnostic categories
 * Distinguishes: missing executable, permission error, timeout, extraction failure,
 * source restriction, conversion failure, packaging failure, and unknown.
 */
export function classifyProcessError(
  stage: DiagnosticStage,
  exitCode: number | null,
  stderr: string,
  stdout: string,
  spawnError?: string,
  timedOut?: boolean
): TrackDiagnostic {
  const combined = `${stderr}\n${stdout}\n${spawnError || ''}`.toLowerCase();

  // 1. Missing executable
  if (spawnError === 'ENOENT' || combined.includes('no such file or directory') || combined.includes('not found')) {
    return {
      category: 'missing_executable',
      stage,
      exitCode,
      sanitizedMessage: 'Required processing executable is not installed or missing at path.',
      rawSummary: (stderr || spawnError || '').slice(0, 300)
    };
  }

  // 2. Permission error
  if (spawnError === 'EACCES' || combined.includes('permission denied')) {
    return {
      category: 'permission_error',
      stage,
      exitCode,
      sanitizedMessage: 'Permission denied for execution of binary or working directory.',
      rawSummary: (stderr || spawnError || '').slice(0, 300)
    };
  }

  // 3. Timeout
  if (timedOut || spawnError === 'TIMEOUT' || combined.includes('operation timed out')) {
    return {
      category: 'timeout',
      stage,
      exitCode,
      sanitizedMessage: 'Processing exceeded maximum duration limit and was terminated.',
      rawSummary: 'Process execution timeout reached.'
    };
  }

  // 4. Source restriction (bot challenge, sign-in, geo-block, age-gate)
  // Note: We do NOT declare that the server IP is blocked; we report the specific source requirement!
  if (
    combined.includes('sign in to confirm you’re not a bot') ||
    combined.includes('confirm you’re not a bot') ||
    combined.includes('bot verification')
  ) {
    return {
      category: 'source_restriction',
      stage,
      exitCode,
      sanitizedMessage: 'YouTube requested interactive bot verification challenge for this stream.',
      rawSummary: stderr.slice(-300)
    };
  }

  if (
    combined.includes('sign in to view this video') ||
    combined.includes('requires authentication') ||
    combined.includes('login required')
  ) {
    return {
      category: 'source_restriction',
      stage,
      exitCode,
      sanitizedMessage: 'Source stream requires account sign-in or authorization.',
      rawSummary: stderr.slice(-300)
    };
  }

  if (
    combined.includes('available in your country') ||
    combined.includes('not available in your country') ||
    combined.includes('georestricted') ||
    combined.includes('blocked in your country') ||
    combined.includes('country')
  ) {
    return {
      category: 'source_restriction',
      stage,
      exitCode,
      sanitizedMessage: 'Source media is geographically restricted.',
      rawSummary: stderr.slice(-300)
    };
  }

  if (combined.includes('age-restricted') || combined.includes('confirm your age')) {
    return {
      category: 'source_restriction',
      stage,
      exitCode,
      sanitizedMessage: 'Source stream is age-restricted and requires account verification.',
      rawSummary: stderr.slice(-300)
    };
  }

  // 5. Extraction failure (video removed, deleted, private, invalid id)
  if (
    combined.includes('video unavailable') ||
    combined.includes('this video is unavailable') ||
    combined.includes('private video') ||
    combined.includes('does not exist') ||
    combined.includes('incomplete youtube id')
  ) {
    return {
      category: 'extraction_failure',
      stage,
      exitCode,
      sanitizedMessage: 'Stream extraction failed: video is unavailable or no compatible stream found.',
      rawSummary: stderr.slice(-300)
    };
  }

  // 6. Conversion failure (ffmpeg / lame transcoding)
  if (stage === 'conversion' || stage === 'tagging' || combined.includes('ffmpeg') || combined.includes('libmp3lame')) {
    return {
      category: 'conversion_failure',
      stage,
      exitCode,
      sanitizedMessage: 'Audio transcoding or tag embedding failed.',
      rawSummary: stderr.slice(-300)
    };
  }

  // 7. Packaging failure
  if (stage === 'packaging') {
    return {
      category: 'packaging_failure',
      stage,
      exitCode,
      sanitizedMessage: 'ZIP compression archive creation failed.',
      rawSummary: stderr.slice(-300)
    };
  }

  // 8. Unknown
  return {
    category: 'unknown',
    stage,
    exitCode,
    sanitizedMessage: stderr ? `Process exited with code ${exitCode}: ${stderr.slice(0, 160)}` : `Process exited with code ${exitCode || 'abnormal'}.`,
    rawSummary: stderr.slice(-300)
  };
}
