import { spawn } from 'child_process';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const require = createRequire(import.meta.url);
const archiver = require('archiver');
const YTMusic = require('ytmusic-api');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const EXPORTS_DIR = path.join('/tmp', 'musicrip_exports');

// Ensure writable export directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

app.use(express.json());

// Initialize YouTube Music API client singleton
let ytmusic: any = null;
let ytmusicInitPromise: Promise<any> | null = null;

async function getYTMusic(): Promise<any> {
  if (ytmusic) return ytmusic;
  if (!ytmusicInitPromise) {
    ytmusicInitPromise = (async () => {
      const client = new (YTMusic as any)();
      await client.initialize();
      ytmusic = client;
      return client;
    })();
  }
  return ytmusicInitPromise;
}

// In-memory server jobs store
interface ServerExportTrack {
  trackId: string;
  discNumber: number;
  trackNumber: number;
  title: string;
  artistCredit?: string;
  status: 'pending' | 'resolving' | 'downloading' | 'converting' | 'completed' | 'failed';
  progressPercent: number;
  error?: string;
  localPath?: string;
}

interface ServerExportJob {
  id: string;
  releaseId: string;
  releaseTitle: string;
  artistName: string;
  editionLabel?: string;
  year?: number;
  processingStatus: 'queued' | 'processing' | 'completed' | 'partial' | 'failed';
  artifactAvailability: 'not_created' | 'available' | 'expired';
  tracks: ServerExportTrack[];
  totalTracks: number;
  successfulTracksCount: number;
  failedTracksCount: number;
  overallProgress: number;
  zipPath?: string;
  zipFilename?: string;
  zipSizeBytes?: number;
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
  isRealPipeline: true;
}

const serverJobs: Map<string, ServerExportJob> = new Map();

/* ====================================================================
 * 1. SERVER ENVIRONMENT & HEALTH CHECK
 * ==================================================================== */
app.get('/api/health', async (_req: Request, res: Response) => {
  const ytdlpPath = path.join(__dirname, 'bin', 'yt-dlp');
  const hasYtDlp = fs.existsSync(ytdlpPath);
  const hasFfmpeg = fs.existsSync('/usr/bin/ffmpeg');
  const hasPython = fs.existsSync('/usr/bin/python3');
  const writableTmp = fs.existsSync(EXPORTS_DIR);

  res.json({
    status: 'ok',
    environment: {
      hasPython,
      hasFfmpeg,
      hasYtDlp,
      ytdlpPath,
      writableTmpDir: EXPORTS_DIR,
      writableTmp
    },
    note: 'YouTube Music metadata browsing works natively. YouTube audio streaming encounters data-center bot verification on cloud IPs.'
  });
});

/* ====================================================================
 * 2. REAL YOUTUBE MUSIC CATALOG ROUTES
 * ==================================================================== */

// Search Artists
app.get('/api/catalog/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim();
  if (!query) {
    return res.json({ artists: [] });
  }

  try {
    const client = await getYTMusic();
    const results = await client.searchArtists(query);

    const artists = results.map((a: any) => {
      // Find highest resolution avatar thumbnail
      const thumbnail = a.thumbnails && a.thumbnails.length > 0
        ? a.thumbnails[a.thumbnails.length - 1].url
        : undefined;

      return {
        id: `ytm-art:${a.artistId}`,
        providerId: `ytmusic:${a.artistId}`,
        name: a.name,
        genre: 'YouTube Music Verified Artist',
        releasesCount: 0,
        avatarSeed: `ytm-${a.artistId}`,
        coverUrl: thumbnail
      };
    });

    res.json({ artists });
  } catch (err: any) {
    console.error('YouTube Music search error:', err);
    res.status(502).json({
      error: 'Failed to search YouTube Music API.',
      details: err.message
    });
  }
});

// Get Artist Details
app.get('/api/catalog/artist/:id', async (req: Request, res: Response) => {
  const rawId = req.params.id.replace('ytm-art:', '').replace('ytmusic:', '');
  try {
    const client = await getYTMusic();
    const artist = await client.getArtist(rawId);

    const thumbnail = artist.thumbnails && artist.thumbnails.length > 0
      ? artist.thumbnails[artist.thumbnails.length - 1].url
      : undefined;

    res.json({
      artist: {
        id: `ytm-art:${artist.artistId}`,
        providerId: `ytmusic:${artist.artistId}`,
        name: artist.name,
        genre: 'YouTube Music Artist',
        releasesCount: artist.topAlbums?.length || 0,
        avatarSeed: `ytm-${artist.artistId}`,
        coverUrl: thumbnail
      }
    });
  } catch (err: any) {
    console.error('YouTube Music artist details error:', err);
    res.status(502).json({
      error: 'Failed to fetch artist details from YouTube Music API.',
      details: err.message
    });
  }
});

// Get Artist Releases
app.get('/api/catalog/artist/:id/releases', async (req: Request, res: Response) => {
  const rawId = req.params.id.replace('ytm-art:', '').replace('ytmusic:', '');
  try {
    const client = await getYTMusic();
    const artist = await client.getArtist(rawId);

    // Prefer albums with valid browse albumIds from topAlbums and topSingles
    let rawAlbums: any[] = [];
    if (artist && (artist.topAlbums?.length || artist.topSingles?.length)) {
      rawAlbums = [
        ...(artist.topAlbums || []),
        ...(artist.topSingles || [])
      ];
    }

    // If few albums, supplement with searchAlbums by artist name
    if (rawAlbums.length < 3 && artist?.name) {
      try {
        const searched = await client.searchAlbums(artist.name);
        const seen = new Set(rawAlbums.map((a) => a.albumId || a.name));
        searched.forEach((s: any) => {
          if (!seen.has(s.albumId) && !seen.has(s.name)) {
            rawAlbums.push(s);
            seen.add(s.albumId || s.name);
          }
        });
      } catch {
        // ignore supplemental search errors
      }
    }

    // Deduplicate by albumId or name
    const uniqueAlbums: any[] = [];
    const seenIds = new Set<string>();
    for (const alb of rawAlbums) {
      const albId = alb.albumId || alb.playlistId;
      if (albId && !seenIds.has(albId)) {
        seenIds.add(albId);
        uniqueAlbums.push(alb);
      }
    }

    const releases = uniqueAlbums.map((album: any) => {
      const thumbnail = album.thumbnails && album.thumbnails.length > 0
        ? album.thumbnails[album.thumbnails.length - 1].url
        : undefined;

      const isLive = album.name.toLowerCase().includes('live');
      const isEP = album.name.toLowerCase().includes('ep');
      const isSingle = album.name.toLowerCase().includes('single');
      const type = isSingle ? 'single' : isEP ? 'ep' : 'album';
      const actualId = album.albumId || album.playlistId;

      return {
        id: `ytm-rel:${actualId}`,
        providerId: `ytmusic:${actualId}`,
        artistId: `ytm-art:${album.artist?.artistId || rawId}`,
        artistName: album.artist?.name || artist?.name || 'Unknown Artist',
        title: album.name,
        year: album.year || undefined,
        type,
        isLive,
        coverSeed: `ytm-cov-${actualId}`,
        coverUrl: thumbnail,
        discs: [
          {
            discNumber: 1,
            tracks: []
          }
        ],
        targetFormat: 'MP3'
      };
    });

    res.json({ releases });
  } catch (err: any) {
    console.error('YouTube Music releases error:', err);
    res.status(502).json({
      error: 'Failed to fetch releases from YouTube Music API.',
      details: err.message
    });
  }
});

// Get Release Details and Ordered Tracks
app.get('/api/catalog/release/:id', async (req: Request, res: Response) => {
  const rawId = req.params.id.replace('ytm-rel:', '').replace('ytmusic:', '');
  try {
    const client = await getYTMusic();
    let album: any = null;

    try {
      album = await client.getAlbum(rawId);
    } catch (e: any) {
      // If direct getAlbum failed, try getPlaylist
      try {
        album = await client.getPlaylist(rawId);
      } catch {
        album = null;
      }
    }

    if (!album) {
      return res.status(404).json({ error: 'Release not found on YouTube Music.' });
    }

    const rawSongs = album.songs || album.content || [];
    const thumbnail = album.thumbnails && album.thumbnails.length > 0
      ? album.thumbnails[album.thumbnails.length - 1].url
      : undefined;

    const tracks = rawSongs.map((song: any, idx: number) => {
      // Parse duration if present
      let durationSeconds: number | undefined = undefined;
      if (typeof song.duration === 'number') {
        durationSeconds = song.duration;
      } else if (typeof song.duration === 'string') {
        const parts = song.duration.split(':').map(Number);
        if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
        if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }

      const songTitle = song.name || song.title || `Track ${idx + 1}`;
      const isLive = songTitle.toLowerCase().includes('live');

      return {
        id: `ytm-trk:${song.videoId || idx}`,
        providerId: `ytmusic:${song.videoId || idx}`,
        discNumber: 1,
        trackNumber: idx + 1,
        title: songTitle,
        artistCredit: song.artist?.name || album.artist?.name,
        durationSeconds,
        isLive
      };
    });

    const albumTitle = album.name || album.title || 'Untitled Release';
    const isLive = albumTitle.toLowerCase().includes('live');
    const isSingle = albumTitle.toLowerCase().includes('single');
    const isEP = albumTitle.toLowerCase().includes('ep');
    const type = isSingle ? 'single' : isEP ? 'ep' : 'album';

    const release = {
      id: `ytm-rel:${rawId}`,
      providerId: `ytmusic:${rawId}`,
      artistId: `ytm-art:${album.artist?.artistId || ''}`,
      artistName: album.artist?.name || 'Unknown Artist',
      title: albumTitle,
      year: album.year || undefined,
      type,
      isLive,
      coverSeed: `ytm-cov-${rawId}`,
      coverUrl: thumbnail,
      discs: [
        {
          discNumber: 1,
          tracks
        }
      ],
      targetFormat: 'MP3'
    };

    res.json({ release });
  } catch (err: any) {
    console.error('YouTube Music album details error:', err);
    res.status(502).json({
      error: 'Failed to fetch release details from YouTube Music API.',
      details: err.message
    });
  }
});

/* ====================================================================
 * 3. REAL EXPORT PROOF-OF-CONCEPT ROUTES (End-to-End Pipeline)
 * ==================================================================== */

// Start a real server-side export job
app.post('/api/export/start', async (req: Request, res: Response) => {
  const { release, selectedTrackIds } = req.body;
  if (!release || !release.title) {
    return res.status(400).json({ error: 'Missing release details in request body.' });
  }

  const jobId = `srv-job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const allTracks = release.discs.flatMap((d: any) => d.tracks);
  const targetTracks = selectedTrackIds && selectedTrackIds.length > 0
    ? allTracks.filter((t: any) => selectedTrackIds.includes(t.id))
    : allTracks;

  const serverTracks: ServerExportTrack[] = targetTracks.map((t: any) => ({
    trackId: t.id,
    discNumber: t.discNumber,
    trackNumber: t.trackNumber,
    title: t.title,
    artistCredit: t.artistCredit || release.artistName,
    status: 'pending',
    progressPercent: 0
  }));

  const job: ServerExportJob = {
    id: jobId,
    releaseId: release.id,
    releaseTitle: release.title,
    artistName: release.artistName,
    editionLabel: release.editionLabel,
    year: release.year,
    processingStatus: 'queued',
    artifactAvailability: 'not_created',
    tracks: serverTracks,
    totalTracks: serverTracks.length,
    successfulTracksCount: 0,
    failedTracksCount: 0,
    overallProgress: 5,
    createdAt: Date.now(),
    isRealPipeline: true
  };

  serverJobs.set(jobId, job);
  res.json({ job });

  // Run backend job in background
  executeServerExport(jobId, release).catch((err) => {
    console.error(`Error in server export job ${jobId}:`, err);
  });
});

// Get Server Job Status
app.get('/api/export/job/:id', (req: Request, res: Response) => {
  const job = serverJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ job });
});

// Download Real Generated ZIP
app.get('/api/export/download/:id', (req: Request, res: Response) => {
  const job = serverJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.artifactAvailability !== 'available' || !job.zipPath || !fs.existsSync(job.zipPath)) {
    return res.status(410).json({ error: 'Artifact is not available or has expired.' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(job.zipFilename || 'album.zip')}"`
  );

  const fileStream = fs.createReadStream(job.zipPath);
  fileStream.pipe(res);
});

// Worker function executing the real pipeline
async function executeServerExport(jobId: string, release: any) {
  const job = serverJobs.get(jobId);
  if (!job) return;

  job.processingStatus = 'processing';
  job.overallProgress = 15;

  const ytdlpBin = path.join(__dirname, 'bin', 'yt-dlp');
  const jobTempDir = path.join(EXPORTS_DIR, jobId);
  fs.mkdirSync(jobTempDir, { recursive: true });

  for (let i = 0; i < job.tracks.length; i++) {
    const track = job.tracks[i];
    track.status = 'downloading';
    track.progressPercent = 20;

    // Determine stream source:
    // If it's a real YouTube track (ytm-trk:videoId)
    const videoId = track.trackId.replace('ytm-trk:', '').replace('ytmusic:', '');
    const isYouTubeTrack = track.trackId.startsWith('ytm-trk:');

    if (isYouTubeTrack && videoId) {
      // Attempt extraction via yt-dlp
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const audioOutPath = path.join(jobTempDir, `track_${i + 1}.mp3`);

      try {
        const result = await runYtDlpDownload(ytdlpBin, videoUrl, audioOutPath);
        if (result.success && fs.existsSync(audioOutPath)) {
          track.status = 'completed';
          track.progressPercent = 100;
          track.localPath = audioOutPath;
          job.successfulTracksCount++;
        } else {
          track.status = 'failed';
          track.error = result.error || 'YouTube bot verification challenge encountered.';
          job.failedTracksCount++;
        }
      } catch (err: any) {
        track.status = 'failed';
        track.error = err.message || 'Stream extraction failed.';
        job.failedTracksCount++;
      }
    } else {
      // Direct / Demo audio proof-of-concept synthesis using FFmpeg
      // Generates a short audio tone for end-to-end real MP3 ZIP testing
      const audioOutPath = path.join(jobTempDir, `track_${i + 1}.mp3`);
      try {
        await generateToneMp3(audioOutPath, track.title, track.artistCredit || job.artistName, i + 1);
        track.status = 'completed';
        track.progressPercent = 100;
        track.localPath = audioOutPath;
        job.successfulTracksCount++;
      } catch (err: any) {
        track.status = 'failed';
        track.error = err.message || 'MP3 encoding failed.';
        job.failedTracksCount++;
      }
    }

    job.overallProgress = Math.min(85, Math.floor(15 + ((i + 1) / job.totalTracks) * 70));
  }

  // Packaging into real ZIP archive
  if (job.successfulTracksCount > 0) {
    const zipName = `${job.artistName} - ${job.releaseTitle} (${job.year || '2024'}).zip`.replace(
      /[/\\?%*:|"<>]/g,
      '-'
    );
    const zipPath = path.join(EXPORTS_DIR, `${jobId}.zip`);

    try {
      await createZipArchive(job.tracks.filter((t) => t.status === 'completed'), zipPath);
      job.zipPath = zipPath;
      job.zipFilename = zipName;
      job.zipSizeBytes = fs.statSync(zipPath).size;
      job.artifactAvailability = 'available';
      job.completedAt = Date.now();
      job.overallProgress = 100;

      if (job.successfulTracksCount === job.totalTracks) {
        job.processingStatus = 'completed';
      } else {
        job.processingStatus = 'partial';
      }
    } catch (err: any) {
      job.processingStatus = 'failed';
      job.errorMessage = `ZIP creation failed: ${err.message}`;
    }
  } else {
    // 0 tracks succeeded
    job.processingStatus = 'failed';
    job.artifactAvailability = 'not_created';
    job.errorMessage =
      'Zero tracks succeeded. YouTube bot verification blocked download on this server IP.';
  }
}

// Helper: Run yt-dlp with audio extraction
function runYtDlpDownload(
  ytdlpPath: string,
  url: string,
  outputPath: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const args = [
      '-x',
      '--audio-format',
      'mp3',
      '--no-playlist',
      '--no-warnings',
      '-o',
      outputPath,
      url
    ];

    const proc = spawn(ytdlpPath, args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ success: true });
      } else {
        const isBotBlocked =
          stderr.includes('Sign in to confirm you’re not a bot') ||
          stderr.includes('bot') ||
          stderr.includes('cookies');

        const errorMsg = isBotBlocked
          ? 'YouTube anti-bot challenge: Data-center IP blocked by YouTube.'
          : stderr.trim() || 'yt-dlp exited with non-zero status.';
        resolve({ success: false, error: errorMsg });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

// Helper: Generate a real MP3 file using FFmpeg with embedded ID3 tags
function generateToneMp3(
  outputPath: string,
  title: string,
  artist: string,
  trackNumber: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Generates 2 seconds of clean audible tone using ffmpeg lavfi
    const args = [
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=2',
      '-metadata',
      `title=${title}`,
      '-metadata',
      `artist=${artist}`,
      '-metadata',
      `track=${trackNumber}`,
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      '-y',
      outputPath
    ];

    const proc = spawn('/usr/bin/ffmpeg', args);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed with code ${code}`));
    });
    proc.on('error', (err) => reject(err));
  });
}

// Helper: Create real ZIP archive
function createZipArchive(tracks: ServerExportTrack[], zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err: any) => reject(err));

    archive.pipe(output);

    tracks.forEach((t) => {
      if (t.localPath && fs.existsSync(t.localPath)) {
        const cleanTrackNum = t.trackNumber.toString().padStart(2, '0');
        const filename = `${cleanTrackNum} - ${t.artistCredit} - ${t.title}.mp3`.replace(
          /[/\\?%*:|"<>]/g,
          '-'
        );
        archive.file(t.localPath, { name: filename });
      }
    });

    archive.finalize();
  });
}

/* ====================================================================
 * 4. ATTACH VITE IN DEV OR SERVE STATIC IN PROD
 * ==================================================================== */
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`Music Rip server running on http://localhost:${PORT}`);
  });
}

startServer();
