export type DiagnosticCategory =
  | 'missing_executable'
  | 'permission_error'
  | 'timeout'
  | 'extraction_failure'
  | 'source_restriction'
  | 'conversion_failure'
  | 'packaging_failure'
  | 'validation_error'
  | 'unknown';

export type DiagnosticStage =
  | 'validation'
  | 'extraction'
  | 'download'
  | 'conversion'
  | 'tagging'
  | 'packaging';

export interface TrackDiagnostic {
  category: DiagnosticCategory;
  stage: DiagnosticStage;
  exitCode?: number | null;
  sanitizedMessage: string;
  rawSummary?: string;
}

export type ServerTrackStatus =
  | 'pending'
  | 'resolving'
  | 'downloading'
  | 'converting'
  | 'tagging'
  | 'completed'
  | 'failed';

export interface ServerExportTrack {
  trackId: string;
  discNumber: number;
  trackNumber: number;
  title: string;
  artistCredit?: string;
  status: ServerTrackStatus;
  progressPercent: number;
  diagnostic?: TrackDiagnostic;
  error?: string;
  localPath?: string;
}

export interface ServerExportJob {
  id: string;
  releaseId: string;
  releaseTitle: string;
  artistName: string;
  albumArtist?: string;
  editionLabel?: string;
  year?: number;
  coverUrl?: string;
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
  isRealPipeline: boolean;
  isSyntheticDiagnostic?: boolean;
}

export interface EnvironmentToolCheck {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export interface EnvironmentReport {
  status: 'ok' | 'degraded';
  environment: {
    python: EnvironmentToolCheck;
    ffmpeg: EnvironmentToolCheck;
    ffprobe: EnvironmentToolCheck;
    ytdlp: EnvironmentToolCheck;
    storage: {
      path: string;
      writable: boolean;
      error?: string;
    };
  };
  capabilities: {
    localAudioSynthesis: boolean;
    metadataExtraction: boolean;
    mediaArchiving: boolean;
    sourceStreamAccess: 'unverified' | 'available' | 'restricted';
  };
}
