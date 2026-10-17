import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface TaggingOptions {
  audioPath: string;
  outputPath: string;
  title: string;
  artist: string;
  albumArtist?: string;
  album: string;
  year?: number;
  trackNumber: number;
  totalTracks?: number;
  discNumber?: number;
  coverPath?: string;
}

export interface ProbeVerification {
  verified: boolean;
  hasAudio: boolean;
  codec?: string;
  duration?: number;
  tags?: Record<string, string>;
  hasArtwork?: boolean;
  error?: string;
}

/**
 * Downloads release cover artwork to a local temporary file
 */
export async function downloadCoverImage(
  url: string,
  destinationPath: string,
  timeoutMs = 6000
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return false;
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(destinationPath, Buffer.from(arrayBuffer));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Applies ID3v2 tags and embeds cover artwork using FFmpeg
 * Strictly avoids fabricating missing metadata or fallback years!
 */
export function tagAndTranscodeMp3(options: TaggingOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const hasCover = options.coverPath && fs.existsSync(options.coverPath);

    const args: string[] = ['-y'];

    // Input 0: audio
    args.push('-i', options.audioPath);

    // Input 1: cover art (if exists)
    if (hasCover) {
      args.push('-i', options.coverPath!);
      args.push('-map', '0:a', '-map', '1:0');
      args.push('-c:v', 'copy');
      args.push('-disposition:v:0', 'attached_pic');
      args.push('-metadata:s:v', 'title=Album cover');
      args.push('-metadata:s:v', 'comment=Cover (front)');
    } else {
      args.push('-map', '0:a');
    }

    // Audio encoding / copy
    // We re-encode to ensure consistent 192k MP3 ID3v2 structure
    args.push('-c:a', 'libmp3lame', '-b:a', '192k');
    args.push('-id3v2_version', '3');

    // Embed validated metadata
    if (options.title) args.push('-metadata', `title=${options.title}`);
    if (options.artist) args.push('-metadata', `artist=${options.artist}`);
    if (options.album) args.push('-metadata', `album=${options.album}`);
    if (options.albumArtist) args.push('-metadata', `album_artist=${options.albumArtist}`);

    // Track number (e.g. "1" or "1/10")
    if (options.trackNumber) {
      const trkStr = options.totalTracks
        ? `${options.trackNumber}/${options.totalTracks}`
        : `${options.trackNumber}`;
      args.push('-metadata', `track=${trkStr}`);
    }

    // Disc number (e.g. "1")
    if (typeof options.discNumber === 'number' && !isNaN(options.discNumber)) {
      args.push('-metadata', `disc=${options.discNumber}`);
    }

    // Release year (ONLY if genuinely known - do NOT fabricate fallback)
    if (options.year && !isNaN(options.year) && options.year > 0) {
      args.push('-metadata', `date=${options.year}`);
      args.push('-metadata', `year=${options.year}`);
    }

    args.push(options.outputPath);

    const proc = spawn('/usr/bin/ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(options.outputPath)) {
        resolve();
      } else {
        reject(new Error(`FFmpeg tagging failed (code ${code}): ${stderr.slice(-300)}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

/**
 * Generates a synthetic test tone MP3 with embedded tags.
 * RESTRICTED: Must only be reachable through explicit diagnostic tests.
 */
export function generateSyntheticTestTone(
  outputPath: string,
  title: string,
  artist: string,
  trackNumber: number,
  discNumber?: number,
  year?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=2',
      '-id3v2_version',
      '3',
      '-metadata',
      `title=${title}`,
      '-metadata',
      `artist=${artist}`,
      '-metadata',
      `album=Synthetic Pipeline Diagnostic`,
      '-metadata',
      `track=${trackNumber}`,
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '-y'
    ];

    if (discNumber) {
      args.push('-metadata', `disc=${discNumber}`);
    }
    if (year) {
      args.push('-metadata', `date=${year}`);
      args.push('-metadata', `year=${year}`);
    }

    args.push(outputPath);

    const proc = spawn('/usr/bin/ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve();
      } else {
        reject(new Error(`Synthetic tone generation failed (code ${code}): ${stderr.slice(-200)}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

/**
 * Verifies generated MP3 metadata and artwork using ffprobe
 */
export function verifyMp3WithProbe(filePath: string): Promise<ProbeVerification> {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve({
        verified: false,
        hasAudio: false,
        error: 'File does not exist'
      });
    }

    const args = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const proc = spawn('/usr/bin/ffprobe', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return resolve({
          verified: false,
          hasAudio: false,
          error: `ffprobe exited with code ${code}: ${stderr}`
        });
      }

      try {
        const data = JSON.parse(stdout);
        const audioStream = (data.streams || []).find((s: any) => s.codec_type === 'audio');
        const hasArtwork = (data.streams || []).some(
          (s: any) => s.codec_type === 'video' || s.disposition?.attached_pic === 1
        );

        if (!audioStream) {
          return resolve({
            verified: false,
            hasAudio: false,
            error: 'No valid audio stream detected in output MP3'
          });
        }

        const tags = data.format?.tags || {};
        const verified =
          audioStream.codec_name === 'mp3' &&
          (typeof tags.title === 'string' || typeof tags.TITLE === 'string');

        resolve({
          verified,
          hasAudio: true,
          codec: audioStream.codec_name,
          duration: parseFloat(data.format?.duration || '0'),
          tags,
          hasArtwork
        });
      } catch (err: any) {
        resolve({
          verified: false,
          hasAudio: false,
          error: `Failed to parse ffprobe json output: ${err.message}`
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        verified: false,
        hasAudio: false,
        error: err.message
      });
    });
  });
}
