import fs from 'node:fs';
import { runCommand } from './process';

export interface TaggingOptions {
  audioPath: string; outputPath: string; title: string; artist: string; albumArtist?: string;
  album: string; year?: number; trackNumber: number; totalTracks?: number; discNumber?: number; coverPath?: string; signal?: AbortSignal;
}
export interface ProbeVerification { verified: boolean; hasAudio: boolean; codec?: string; duration?: number; tags?: Record<string, string>; hasArtwork?: boolean; error?: string }

export async function downloadCoverImage(url: string, destinationPath: string, timeoutMs = 6000, signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const parsed = new URL(url);
    const allowed = ['ytimg.com', 'googleusercontent.com', 'ggpht.com'].some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password || !allowed) return false;
    const response = await fetch(parsed, { signal: controller.signal, redirect: 'error' });
    if (!response.ok || !/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get('content-type') || '') || !response.body) return false;
    const max = 5 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > max) { await response.body.cancel(); return false; }
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > max) { await reader.cancel(); return false; }
      chunks.push(Buffer.from(item.value));
    }
    if (!size || controller.signal.aborted) return false;
    fs.writeFileSync(destinationPath, Buffer.concat(chunks));
    return true;
  } catch { return false; } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export async function tagAndTranscodeMp3(options: TaggingOptions): Promise<void> {
  const args = ['-nostdin', '-y', '-i', options.audioPath];
  const cover = !!options.coverPath && fs.existsSync(options.coverPath);
  if (cover) args.push('-i', options.coverPath!, '-map', '0:a:0', '-map', '1:0', '-c:v', 'mjpeg', '-disposition:v:0', 'attached_pic', '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)');
  else args.push('-map', '0:a:0');
  args.push('-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '192k', '-id3v2_version', '3');
  const tags: Record<string, string | undefined> = { title: options.title, artist: options.artist, album: options.album, album_artist: options.albumArtist, track: options.totalTracks ? `${options.trackNumber}/${options.totalTracks}` : String(options.trackNumber), disc: options.discNumber ? String(options.discNumber) : undefined, date: options.year ? String(options.year) : undefined };
  for (const [key, value] of Object.entries(tags)) if (value !== undefined) args.push('-metadata', `${key}=${value}`);
  args.push(options.outputPath);
  await runCommand(process.env.FFMPEG_PATH || '/usr/bin/ffmpeg', args, options.signal);
  if (!fs.existsSync(options.outputPath)) throw new Error('FFmpeg produced no output file.');
}

export async function generateSyntheticTestTone(outputPath: string, title: string, artist: string, trackNumber: number, discNumber?: number, year?: number, signal?: AbortSignal): Promise<void> {
  const args = ['-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'libmp3lame', '-b:a', '192k', '-id3v2_version', '3', '-metadata', `title=${title}`, '-metadata', `artist=${artist}`, '-metadata', 'album=Synthetic Pipeline Diagnostic', '-metadata', `track=${trackNumber}`];
  if (discNumber) args.push('-metadata', `disc=${discNumber}`);
  if (year) args.push('-metadata', `date=${year}`);
  args.push(outputPath);
  await runCommand(process.env.FFMPEG_PATH || '/usr/bin/ffmpeg', args, signal);
}

export async function verifyMp3WithProbe(filePath: string, expected?: TaggingOptions, signal?: AbortSignal): Promise<ProbeVerification> {
  try {
    const result = await runCommand(process.env.FFPROBE_PATH || '/usr/bin/ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath], signal, 15000);
    const data = JSON.parse(result.stdout);
    const streams = data.streams || [];
    const audio = streams.find((stream: any) => stream.codec_type === 'audio');
    const artwork = streams.some((stream: any) => stream.codec_type === 'video' && stream.disposition?.attached_pic === 1);
    const tags: Record<string, string> = Object.fromEntries(Object.entries(data.format?.tags || {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
    const duration = Number(data.format?.duration);
    let error: string | undefined;
    if (audio?.codec_name !== 'mp3' || !Number.isFinite(duration) || duration <= 0 || !tags.title) error = 'Invalid MP3 stream, duration, or title tag.';
    if (expected) {
      const checks: Record<string, string | undefined> = { title: expected.title, artist: expected.artist, album: expected.album, album_artist: expected.albumArtist, track: expected.totalTracks ? `${expected.trackNumber}/${expected.totalTracks}` : String(expected.trackNumber), disc: expected.discNumber ? String(expected.discNumber) : undefined };
      for (const [key, value] of Object.entries(checks)) if (value !== undefined && tags[key] !== value) error = `Output metadata mismatch: ${key}.`;
      if (expected.year && String(tags.date || tags.year || '').slice(0, 4) !== String(expected.year)) error = 'Output year mismatch.';
      if (expected.coverPath && !artwork) error = 'Expected embedded artwork is missing.';
    }
    return { verified: !error, hasAudio: !!audio, codec: audio?.codec_name, duration, tags, hasArtwork: artwork, error };
  } catch (error: any) { return { verified: false, hasAudio: false, error: error.message }; }
}
