import { Artist, Release } from '../../types/music';

/**
 * Replaceable Music Catalog Interface
 * Can be implemented by Mock data, MusicBrainz, Discogs, Spotify Web API, etc.
 */
export interface MusicCatalog {
  searchArtists(query: string): Promise<Artist[]>;
  getArtist(artistId: string): Promise<Artist | null>;
  getReleasesByArtist(artistId: string): Promise<Release[]>;
  getRelease(releaseId: string): Promise<Release | null>;
  getFeaturedArtists(): Promise<Artist[]>;
}
