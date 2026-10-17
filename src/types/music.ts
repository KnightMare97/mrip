/**
 * Domain types for Music Catalog & Releases
 * Genre-agnostic, with strict fidelity to edition, discs, and track order.
 */

export type ReleaseType = 'album' | 'ep' | 'single' | 'unknown';

export interface Artist {
  id: string;
  providerId: string; // Stable provider identifier for real adapters
  name: string;
  persianName?: string; // Optional Persian name for RTL / mixed script
  genre: string;
  releasesCount: number;
  avatarSeed: string; // Deterministic seed for original placeholder artwork
  coverUrl?: string; // High-res image URL from live providers (e.g., YouTube Music)
}

export interface Track {
  id: string;
  providerId: string;
  discNumber: number;
  trackNumber: number;
  title: string;
  persianTitle?: string;
  artistCredit?: string; // Per-track artist credit if different from album artist
  durationSeconds?: number; // Optional: unknown if provider doesn't supply it
  isLive?: boolean; // Independent boolean flag
  isBonus?: boolean;
  sourceQuality?: string;
}

export interface Disc {
  discNumber: number;
  title?: string;
  tracks: Track[];
}

export interface Release {
  id: string;
  providerId: string;
  artistId: string;
  artistName: string;
  albumArtist?: string; // Optional explicit album artist
  persianArtistName?: string;
  title: string;
  persianTitle?: string;
  year?: number; // Optional if release year is unknown
  type: ReleaseType;
  isLive: boolean; // Independent boolean
  editionLabel?: string; // Optional free text (e.g., "2024 Remaster", "Deluxe 2-CD Edition")
  coverSeed: string; // Seed for generative geometric cover artwork
  coverUrl?: string; // High-res artwork from live provider
  discs: Disc[];
  targetFormat?: string; // e.g., "MP3"
  label?: string;
}

export type ReleaseFilter = 'all' | 'album' | 'ep' | 'single' | 'live';
