import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { personalAuthMiddleware } from './src/server/auth';
import { inspectEnvironment } from './src/server/diagnostics';
import {
  ExportPipelineManager,
  MAX_TRACKS_PER_JOB
} from './src/server/worker';
import { ServerExportJob, ServerExportTrack } from './src/server/types';

dotenv.config();

const require = createRequire(import.meta.url);
const YTMusic = require('ytmusic-api');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const EXPORTS_DIR = process.env.MUSICRIP_EXPORT_DIR || path.join('/tmp', 'musicrip_exports');
const YTDLP_BIN = path.join(__dirname, 'bin', 'yt-dlp');

// Ensure writable export directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

app.use(express.json());

// Initialize Pipeline Manager singleton
const pipelineManager = new ExportPipelineManager(EXPORTS_DIR, YTDLP_BIN);

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

/* ====================================================================
 * 1. SERVER ENVIRONMENT & HEALTH CHECK
 * Reports observed capabilities with bounded checks.
 * Does NOT assume source access or claim unconditional cloud IP blocks.
 * ==================================================================== */
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const report = await inspectEnvironment(YTDLP_BIN, EXPORTS_DIR);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({
      status: 'degraded',
      error: `Health inspection failed: ${err.message}`
    });
  }
});

/* ====================================================================
 * 2. REAL YOUTUBE MUSIC CATALOG ROUTES
 * ==================================================================== */

// Search Artists
app.get('/api/catalog/search', async (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').trim();
  if (!query) {
    return res.json({ artists: [] });
  }

  try {
    const client = await getYTMusic();
    const results = await client.searchArtists(query);

    const artists = results.map((a: any) => {
      const thumbnail =
        a.thumbnails && a.thumbnails.length > 0
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

    const thumbnail =
      artist.thumbnails && artist.thumbnails.length > 0
        ? artist.thumbnails[artist.thumbnails.length - 1].url
        : undefined;

    res.json({
      artist: {
        id: `ytm-art:${rawId}`,
        providerId: `ytmusic:${rawId}`,
        name: artist.name,
        bio: artist.description || undefined,
        genre: 'Artist',
        coverUrl: thumbnail,
        avatarSeed: `ytm-${rawId}`
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

    const rawReleases: any[] = [];
    if (artist.topAlbums && Array.isArray(artist.topAlbums)) {
      rawReleases.push(...artist.topAlbums);
    }
    if (artist.topSingles && Array.isArray(artist.topSingles)) {
      rawReleases.push(...artist.topSingles);
    }

    // Fallback to searchAlbums if artist top arrays are empty
    if (rawReleases.length === 0 && artist.name) {
      try {
        const searched = await client.searchAlbums(artist.name);
        if (Array.isArray(searched)) {
          rawReleases.push(...searched.slice(0, 15));
        }
      } catch {
        // ignore
      }
    }

    const seenIds = new Set<string>();
    const releases = rawReleases
      .filter((r) => {
        const id = r.albumId || r.playlistId;
        if (!id || seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      })
      .map((r: any) => {
        const id = r.albumId || r.playlistId;
        const thumbnail =
          r.thumbnails && r.thumbnails.length > 0
            ? r.thumbnails[r.thumbnails.length - 1].url
            : undefined;

        const isSingle =
          r.type === 'single' ||
          (r.name && (r.name.includes(' - Single') || r.name.includes(' (Single)')));

        return {
          id: `ytm-rel:${id}`,
          providerId: `ytmusic:${id}`,
          artistId: `ytm-art:${rawId}`,
          artistName: artist.name || (r.artist && r.artist.name) || 'Unknown Artist',
          title: r.name,
          year: r.year || undefined,
          type: isSingle ? 'single' : 'album',
          isLive: r.name?.toLowerCase().includes('live') || false,
          coverSeed: `ytm-cov-${id}`,
          coverUrl: thumbnail,
          discs: [],
          targetFormat: 'MP3'
        };
      });

    res.json({ releases });
  } catch (err: any) {
    console.error('YouTube Music artist releases error:', err);
    res.status(502).json({
      error: 'Failed to fetch artist releases from YouTube Music API.',
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
    } catch {
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
    const tracks = rawSongs.map((song: any, idx: number) => {
      let durationSec = 180;
      if (typeof song.duration === 'number') {
        durationSec = song.duration;
      } else if (typeof song.duration === 'string') {
        const parts = song.duration.split(':').map((p: string) => parseInt(p, 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          durationSec = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      }

      return {
        id: `ytm-trk:${song.videoId || `track_${idx + 1}`}`,
        providerId: `ytmusic:${song.videoId || idx + 1}`,
        discNumber: 1,
        trackNumber: idx + 1,
        title: song.name || `Track ${idx + 1}`,
        durationSeconds: durationSec,
        artistCredit:
          (song.artist && song.artist.name) ||
          (album.artist && album.artist.name) ||
          undefined
      };
    });

    const thumbnail =
      album.thumbnails && album.thumbnails.length > 0
        ? album.thumbnails[album.thumbnails.length - 1].url
        : undefined;

    const albumTitle = album.name || album.title || 'Untitled Release';
    const isSingle =
      album.type === 'single' ||
      tracks.length === 1 ||
      albumTitle.includes(' - Single');
    const isLive = albumTitle.toLowerCase().includes('live');
    const artistName =
      (album.artist && album.artist.name) ||
      (album.artists && album.artists[0]?.name) ||
      'Unknown Artist';

    const release = {
      id: `ytm-rel:${rawId}`,
      providerId: `ytmusic:${rawId}`,
      artistId: album.artist?.artistId ? `ytm-art:${album.artist.artistId}` : 'unknown',
      artistName,
      title: albumTitle,
      year: album.year ? parseInt(album.year, 10) : undefined,
      type: isSingle ? 'single' : 'album',
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
 * 3. REAL EXPORT PIPELINE ROUTES (Execution Controls & Auth Protected)
 * ==================================================================== */

// Start a real server-side export job
app.post('/api/export/start', personalAuthMiddleware, async (req: Request, res: Response) => {
  const { release, selectedTrackIds } = req.body;

  // 1. Validate release object
  if (!release || typeof release.title !== 'string' || !release.title.trim()) {
    return res.status(400).json({ error: 'Invalid or missing release title in request body.' });
  }
  if (typeof release.artistName !== 'string' || !release.artistName.trim()) {
    return res.status(400).json({ error: 'Invalid or missing release artist name in request body.' });
  }
  if (!release.discs || !Array.isArray(release.discs) || release.discs.length === 0) {
    return res.status(400).json({ error: 'Release must contain at least one disc structure.' });
  }

  // 2. Resolve tracks and validate selection
  const allTracks = release.discs.flatMap((d: any) => d.tracks || []);
  const targetTracks =
    selectedTrackIds && Array.isArray(selectedTrackIds) && selectedTrackIds.length > 0
      ? allTracks.filter((t: any) => selectedTrackIds.includes(t.id))
      : allTracks;

  // Reject empty track selection
  if (targetTracks.length === 0) {
    return res.status(400).json({ error: 'At least one track must be selected for export.' });
  }

  // Reject excessive batch size
  if (targetTracks.length > MAX_TRACKS_PER_JOB) {
    return res.status(400).json({
      error: `Selection exceeds maximum permitted batch limit of ${MAX_TRACKS_PER_JOB} tracks.`
    });
  }

  // 3. Server-side validation of YouTube video IDs
  const validVideoIdRegex = /^[a-zA-Z0-9_-]{11}$/;
  for (const trk of targetTracks) {
    const rawId = (trk.id || '')
      .replace(/^ytm-trk:/, '')
      .replace(/^ytmusic:/, '')
      .trim();

    if (!validVideoIdRegex.test(rawId)) {
      return res.status(400).json({
        error: `Validation failure: Track "${trk.title}" has an invalid YouTube video ID ("${rawId}"). Real music exports cannot fabricate audio for invalid IDs.`
      });
    }
  }

  const jobId = `srv-job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const serverTracks: ServerExportTrack[] = targetTracks.map((t: any) => ({
    trackId: t.id,
    discNumber: typeof t.discNumber === 'number' ? t.discNumber : 1,
    trackNumber: typeof t.trackNumber === 'number' ? t.trackNumber : 1,
    title: t.title || 'Untitled Track',
    artistCredit: t.artistCredit || release.artistName,
    status: 'pending',
    progressPercent: 0
  }));

  const job: ServerExportJob = {
    id: jobId,
    releaseId: release.id,
    releaseTitle: release.title.trim(),
    artistName: release.artistName.trim(),
    albumArtist: release.albumArtist || release.artistName.trim(),
    editionLabel: release.editionLabel,
    year: typeof release.year === 'number' && !isNaN(release.year) ? release.year : undefined,
    coverUrl: release.coverUrl,
    processingStatus: 'queued',
    artifactAvailability: 'not_created',
    tracks: serverTracks,
    totalTracks: serverTracks.length,
    successfulTracksCount: 0,
    failedTracksCount: 0,
    overallProgress: 0,
    createdAt: Date.now(),
    isRealPipeline: true
  };

  const enqueueResult = pipelineManager.enqueueJob(job);
  if (!enqueueResult.enqueued) {
    return res.status(429).json({ error: enqueueResult.error });
  }

  res.json({ job });
});

// Explicit Synthetic Diagnostic Test Endpoint
// Strictly isolated from normal music exports
app.post('/api/export/diagnostic-synthetic', personalAuthMiddleware, async (req: Request, res: Response) => {
  const { title, artist, trackCount = 1 } = req.body;
  const count = Math.min(Math.max(1, Number(trackCount) || 1), 5);
  const jobId = `diag-synth-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const serverTracks: ServerExportTrack[] = [];
  for (let i = 1; i <= count; i++) {
    serverTracks.push({
      trackId: `diag-trk-${i}`,
      discNumber: 1,
      trackNumber: i,
      title: `${title || 'Diagnostic Test Tone'} #${i}`,
      artistCredit: artist || 'Local Pipeline Verifier',
      status: 'pending',
      progressPercent: 0
    });
  }

  const job: ServerExportJob = {
    id: jobId,
    releaseId: 'diagnostic-release',
    releaseTitle: title || 'Synthetic Diagnostic Suite',
    artistName: artist || 'Local Audio Engine',
    year: new Date().getFullYear(),
    processingStatus: 'queued',
    artifactAvailability: 'not_created',
    tracks: serverTracks,
    totalTracks: serverTracks.length,
    successfulTracksCount: 0,
    failedTracksCount: 0,
    overallProgress: 0,
    createdAt: Date.now(),
    isRealPipeline: true,
    isSyntheticDiagnostic: true
  };

  const enqueueResult = pipelineManager.enqueueJob(job);
  if (!enqueueResult.enqueued) {
    return res.status(429).json({ error: enqueueResult.error });
  }

  res.json({ job });
});

// Get Server Job Status and Diagnostics
app.get('/api/export/job/:id', personalAuthMiddleware, (req: Request, res: Response) => {
  const job = pipelineManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ job, queueStatus: pipelineManager.getQueueStatus() });
});

// Cancel Job
app.post('/api/export/cancel/:id', personalAuthMiddleware, (req: Request, res: Response) => {
  const cancelled = pipelineManager.cancelJob(req.params.id);
  if (!cancelled) {
    return res.status(404).json({ error: 'Job not found or already finished' });
  }
  const job = pipelineManager.getJob(req.params.id);
  res.json({ success: true, job });
});

// Retry Job (only failed tracks)
app.post('/api/export/retry/:id', personalAuthMiddleware, (req: Request, res: Response) => {
  const result = pipelineManager.retryJob(req.params.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, job: result.job });
});

// Download Real Generated ZIP
app.get('/api/export/download/:id', personalAuthMiddleware, (req: Request, res: Response) => {
  const job = pipelineManager.getJob(req.params.id);
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

// Manual cleanup endpoint
app.post('/api/export/cleanup', personalAuthMiddleware, (_req: Request, res: Response) => {
  pipelineManager.cleanupExpiredJobs();
  res.json({ success: true, message: 'Expired artifacts swept.' });
});

/* ====================================================================
 * 4. ATTACH VITE IN DEV OR SERVE STATIC IN PROD
 * ==================================================================== */
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else if (process.env.NODE_ENV !== 'test') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, () => {
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
    console.log(`Music Rip server running on http://localhost:${actualPort}`);
  });

  const shutdown = () => {
    pipelineManager.dispose();
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
