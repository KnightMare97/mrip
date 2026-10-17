/**
 * Domain types for Export Service & Jobs
 * Separates processing status from artifact availability.
 */

export type ProcessingStatus =
  | 'queued'
  | 'resolving'
  | 'awaiting_review'
  | 'downloading'
  | 'tagging'
  | 'packaging'
  | 'completed'
  | 'partial'
  | 'failed';

export type ArtifactAvailability = 'not_created' | 'available' | 'expired';

export type TrackExportStatus =
  | 'pending'
  | 'resolving'
  | 'downloading'
  | 'tagging'
  | 'completed'
  | 'failed'
  | 'excluded';

export interface TrackExportItem {
  trackId: string;
  discNumber: number;
  trackNumber: number;
  title: string;
  persianTitle?: string;
  artistCredit?: string;
  durationSeconds?: number;
  status: TrackExportStatus;
  progressPercent: number; // 0 - 100 for simulated download
  failureReason?: string;
  selectedCandidate?: MatchCandidate;
}

export interface MatchCandidate {
  id: string;
  title: string;
  source: string;
  durationText: string;
  isLive: boolean;
  isCover: boolean;
  isRemix: boolean;
  matchScore: number; // 0 - 1
  warningNote?: string;
}

export interface AmbiguousReviewRequest {
  trackId: string;
  discNumber: number;
  trackNumber: number;
  expectedTitle: string;
  expectedArtist: string;
  candidates: MatchCandidate[];
}

export interface SimulatedArchiveEntry {
  path: string;
  sizeBytes: number;
  id3Tags: {
    artist: string;
    album: string;
    title: string;
    track: string;
    disc: string;
    year?: string;
  };
}

export interface SimulatedArchive {
  filename: string;
  totalBytes: number;
  entries: SimulatedArchiveEntry[];
  simulatedExpiresAt?: string;
}

export interface ExportJob {
  id: string;
  releaseId: string;
  releaseTitle: string;
  artistName: string;
  editionLabel?: string;
  year?: number;
  targetFormat: string; // e.g. "MP3 (VBR / 256-320 kbps target)"
  processingStatus: ProcessingStatus;
  artifactAvailability: ArtifactAvailability;
  tracks: TrackExportItem[];
  currentTrackIndex: number;
  totalTracks: number;
  successfulTracksCount: number;
  failedTracksCount: number;
  excludedTracksCount: number;
  overallProgress: number; // 0 - 100
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
  ambiguousReview?: AmbiguousReviewRequest;
  simulatedArchive?: SimulatedArchive;
  isInterrupted?: boolean; // Flagged when reloaded during an incomplete simulation
  scenarioPreset?: 'default' | 'missing_track' | 'ambiguous_match' | 'server_error' | 'expired_archive';
  runId?: number; // Execution / run identifier for stale-run guard
  isSelective?: boolean; // True if exporting a subset of release tracks
  downloadRequested?: boolean; // True when user clicked to download/inspect the generated archive
  isRealPipeline?: boolean; // True when job is processed by real server backend
  realDownloadUrl?: string; // Direct URL to download genuine generated ZIP
  realZipFilename?: string; // Actual archive filename
  realZipSizeBytes?: number; // Actual ZIP size in bytes
}

export interface ExportOptions {
  scenarioPreset?: 'default' | 'missing_track' | 'ambiguous_match' | 'server_error' | 'expired_archive';
  targetFormat?: string;
  selectedTrackIds?: string[]; // Specific track IDs to export (selective export)
  exportMode?: 'real' | 'simulated'; // Choice between real audio pipeline and state machine demo
}
