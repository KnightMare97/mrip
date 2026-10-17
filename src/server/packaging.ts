import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { ServerExportTrack } from './types';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

export interface ZipOptions {
  tracks: ServerExportTrack[];
  zipPath: string;
  artistName: string;
  releaseTitle: string;
  year?: number;
}

/**
 * Creates genuine ZIP archive preserving disc structure when multiple discs exist
 * Strictly avoids fabricating fallback years or missing metadata
 */
export function createExportZip(options: ZipOptions): Promise<{ totalFiles: number; discMetadataKnown: boolean }> {
  return new Promise((resolve, reject) => {
    const { tracks, zipPath, artistName, releaseTitle } = options;
    const output = fs.createWriteStream(zipPath);
    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => {
      resolve({ totalFiles: eligibleTracks.length, discMetadataKnown });
    });
    archive.on('error', (err: any) => reject(err));

    archive.pipe(output);

    const eligibleTracks = tracks.filter((t) => t.status === 'completed' && t.localPath && fs.existsSync(t.localPath));

    if (eligibleTracks.length === 0) {
      archive.abort();
      return reject(new Error('No completed track files available for packaging.'));
    }

    // Determine if multi-disc release
    const distinctDiscs = new Set(eligibleTracks.map((t) => t.discNumber).filter(Boolean));
    const isMultiDisc = distinctDiscs.size > 1 || eligibleTracks.some((t) => t.discNumber > 1);
    const discMetadataKnown = eligibleTracks.every((t) => typeof t.discNumber === 'number' && t.discNumber > 0);

    eligibleTracks.forEach((t) => {
      const cleanTrackNum = (t.trackNumber || 1).toString().padStart(2, '0');
      const cleanArtist = (t.artistCredit || artistName).replace(/[/\\?%*:|"<>]/g, '-').trim();
      const cleanTitle = (t.title || 'Untitled Track').replace(/[/\\?%*:|"<>]/g, '-').trim();
      const baseFilename = `${cleanTrackNum} - ${cleanArtist} - ${cleanTitle}.mp3`;

      let archiveEntryName: string;
      if (isMultiDisc) {
        const discFolder = t.discNumber ? `Disc ${t.discNumber}` : 'Disc Unknown';
        archiveEntryName = `${discFolder}/${baseFilename}`;
      } else {
        archiveEntryName = baseFilename;
      }

      archive.file(t.localPath!, { name: archiveEntryName });
    });

    archive.finalize();
  });
}

/**
 * Builds standard album zip filename without fabricating a year
 */
export function buildZipFilename(artistName: string, releaseTitle: string, year?: number): string {
  const cleanArtist = artistName.replace(/[/\\?%*:|"<>]/g, '-').trim();
  const cleanTitle = releaseTitle.replace(/[/\\?%*:|"<>]/g, '-').trim();
  if (year && !isNaN(year) && year > 0) {
    return `${cleanArtist} - ${cleanTitle} (${year}).zip`;
  }
  return `${cleanArtist} - ${cleanTitle}.zip`;
}
