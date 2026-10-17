import { Artist, Release } from '../../types/music';
import { MusicCatalog } from './MusicCatalog';

/**
 * Real YouTube Music Catalog Adapter
 * Connects to server-side YouTube Music endpoints (/api/catalog/*).
 * Never mixes fictional demo entities into real results.
 * If network or source fails, throws a clean source error rather than falling back to demo.
 */
export class YouTubeMusicCatalog implements MusicCatalog {
  async searchArtists(query: string): Promise<Artist[]> {
    const q = query.trim();
    if (!q) {
      return this.getFeaturedArtists();
    }

    const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `YouTube Music search failed (${response.status})`);
    }

    const data = await response.json();
    return data.artists || [];
  }

  async getArtist(artistId: string): Promise<Artist | null> {
    const response = await fetch(`/api/catalog/artist/${encodeURIComponent(artistId)}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch artist details (${response.status})`);
    }

    const data = await response.json();
    return data.artist || null;
  }

  async getReleasesByArtist(artistId: string): Promise<Release[]> {
    const response = await fetch(`/api/catalog/artist/${encodeURIComponent(artistId)}/releases`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch artist releases (${response.status})`);
    }

    const data = await response.json();
    return data.releases || [];
  }

  async getRelease(releaseId: string): Promise<Release | null> {
    const response = await fetch(`/api/catalog/release/${encodeURIComponent(releaseId)}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch release details (${response.status})`);
    }

    const data = await response.json();
    return data.release || null;
  }

  async getFeaturedArtists(): Promise<Artist[]> {
    // Default featured artists when search query is empty in live mode
    const defaultQueries = ['Radiohead', 'Kayhan Kalhor', 'Daft Punk', 'Pink Floyd', 'Googoosh'];
    try {
      const results = await Promise.all(
        defaultQueries.map(async (name) => {
          const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(name)}`);
          if (!res.ok) return null;
          const data = await res.json();
          return data.artists?.[0] || null;
        })
      );
      return results.filter(Boolean) as Artist[];
    } catch {
      return [];
    }
  }
}

export const youtubeMusicCatalog = new YouTubeMusicCatalog();
