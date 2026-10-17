import { Artist, Release } from '../../types/music';
import { MusicCatalog } from './MusicCatalog';

export const MOCK_ARTISTS: Artist[] = [
  {
    id: 'art-chroma-drift',
    providerId: 'mock-mb-001',
    name: 'Chroma Drift',
    genre: 'Atmospheric Post-Metal / Progressive',
    releasesCount: 4,
    avatarSeed: 'chroma-drift-cd'
  },
  {
    id: 'art-sorood-noor',
    providerId: 'mock-mb-002',
    name: 'Sorood-e-Noor',
    persianName: 'سرود نور',
    genre: 'Persian Ambient Metal / Folk Fusion',
    releasesCount: 4,
    avatarSeed: 'sorood-noor-sn'
  },
  {
    id: 'art-roya-echo',
    providerId: 'mock-mb-003',
    name: 'Roya & The Echo',
    persianName: 'رویا و پژواک',
    genre: 'Neo-Classical / Cinematic Post-Rock',
    releasesCount: 3,
    avatarSeed: 'roya-echo-re'
  },
  {
    id: 'art-shattered-horizon',
    providerId: 'mock-mb-004',
    name: 'Shattered Horizon',
    genre: 'Progressive Doom / Heavy Atmospheric',
    releasesCount: 2,
    avatarSeed: 'shattered-horizon-sh'
  },
  {
    id: 'art-kavir-frequency',
    providerId: 'mock-mb-005',
    name: 'Kavir Frequency',
    persianName: 'فرکانس کویر',
    genre: 'Modular Synthesizer / Heavy Drone',
    releasesCount: 2,
    avatarSeed: 'kavir-freq-kf'
  }
];

export const MOCK_RELEASES: Release[] = [
  // 1. Chroma Drift - Vortex of the Monolith (2-Disc Expanded)
  {
    id: 'rel-vortex-monolith',
    providerId: 'rel-prov-101',
    artistId: 'art-chroma-drift',
    artistName: 'Chroma Drift',
    title: 'Vortex of the Monolith',
    year: 2023,
    type: 'album',
    isLive: false,
    editionLabel: 'Expanded 2-CD Edition',
    coverSeed: 'vortex-monolith-cov',
    targetFormat: 'MP3',
    label: 'Apex Echo Records',
    discs: [
      {
        discNumber: 1,
        title: 'Act I: The Ascent',
        tracks: [
          { id: 'trk-101', providerId: 'p-101', discNumber: 1, trackNumber: 1, title: 'Threshold of Obsidian', durationSeconds: 384, sourceQuality: 'Lossless 44.1kHz' },
          { id: 'trk-102', providerId: 'p-102', discNumber: 1, trackNumber: 2, title: 'Prism Overcast', durationSeconds: 442, sourceQuality: 'Lossless 44.1kHz' },
          { id: 'trk-103', providerId: 'p-103', discNumber: 1, trackNumber: 3, title: 'Aether Drift', durationSeconds: 310, sourceQuality: 'Lossless 44.1kHz' },
          { id: 'trk-104', providerId: 'p-104', discNumber: 1, trackNumber: 4, title: 'Cold Geometry', durationSeconds: 521, sourceQuality: 'Lossless 44.1kHz' },
          { id: 'trk-105', providerId: 'p-105', discNumber: 1, trackNumber: 5, title: 'Equinox Pulse', durationSeconds: 295, sourceQuality: 'Lossless 44.1kHz' }
        ]
      },
      {
        discNumber: 2,
        title: 'Act II: The Descent & Bonus',
        tracks: [
          { id: 'trk-106', providerId: 'p-106', discNumber: 2, trackNumber: 1, title: 'Basalt Horizon', durationSeconds: 418, sourceQuality: 'Lossless 44.1kHz' },
          { id: 'trk-107', providerId: 'p-107', discNumber: 2, trackNumber: 2, title: 'Iron Resonance', durationSeconds: 367, sourceQuality: 'Lossless 44.1kHz' },
          { id: 'trk-108', providerId: 'p-108', discNumber: 2, trackNumber: 3, title: 'Fractured Monolith', durationSeconds: 489, sourceQuality: 'Lossless 44.1kHz' },
          { id: 'trk-109', providerId: 'p-109', discNumber: 2, trackNumber: 4, title: 'Vortex Dissolution', durationSeconds: 274, sourceQuality: 'Lossless 44.1kHz' },
          { id: 'trk-110', providerId: 'p-110', discNumber: 2, trackNumber: 5, title: 'Aether Drift (Acoustic Reprise)', durationSeconds: 248, isBonus: true, sourceQuality: 'Lossless 44.1kHz' }
        ]
      }
    ]
  },
  {
    id: 'rel-signal-dunes',
    providerId: 'rel-prov-102',
    artistId: 'art-chroma-drift',
    artistName: 'Chroma Drift',
    title: 'Signal From The Dunes',
    year: 2022,
    type: 'ep',
    isLive: false,
    editionLabel: 'Standard EP',
    coverSeed: 'signal-dunes-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-121', providerId: 'p-121', discNumber: 1, trackNumber: 1, title: 'Sand and Silt', durationSeconds: 260 },
          { id: 'trk-122', providerId: 'p-122', discNumber: 1, trackNumber: 2, title: 'Mirage Frequencies', durationSeconds: 315 },
          { id: 'trk-123', providerId: 'p-123', discNumber: 1, trackNumber: 3, title: 'Sirocco', durationSeconds: 410 },
          { id: 'trk-124', providerId: 'p-124', discNumber: 1, trackNumber: 4, title: 'Distant Oasis', durationSeconds: 198 }
        ]
      }
    ]
  },
  {
    id: 'rel-live-zenith',
    providerId: 'rel-prov-103',
    artistId: 'art-chroma-drift',
    artistName: 'Chroma Drift',
    title: 'Live at Zenith Hall',
    year: 2021,
    type: 'album',
    isLive: true,
    editionLabel: 'Soundboard Recording',
    coverSeed: 'live-zenith-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-131', providerId: 'p-131', discNumber: 1, trackNumber: 1, title: 'Threshold of Obsidian (Live)', durationSeconds: 412, isLive: true },
          { id: 'trk-132', providerId: 'p-132', discNumber: 1, trackNumber: 2, title: 'Prism Overcast (Live)', durationSeconds: 468, isLive: true },
          { id: 'trk-133', providerId: 'p-133', discNumber: 1, trackNumber: 3, title: 'Cold Geometry (Live Extended)', durationSeconds: 610, isLive: true },
          { id: 'trk-134', providerId: 'p-134', discNumber: 1, trackNumber: 4, title: 'Iron Resonance (Live)', durationSeconds: 388, isLive: true }
        ]
      }
    ]
  },
  {
    id: 'rel-tide-embers',
    providerId: 'rel-prov-104',
    artistId: 'art-chroma-drift',
    artistName: 'Chroma Drift',
    title: 'Tide of Embers',
    year: 2024,
    type: 'single',
    isLive: false,
    coverSeed: 'tide-embers-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-141', providerId: 'p-141', discNumber: 1, trackNumber: 1, title: 'Tide of Embers', durationSeconds: 345 },
          { id: 'trk-142', providerId: 'p-142', discNumber: 1, trackNumber: 2, title: 'Tide of Embers (Instrumental)', durationSeconds: 345 }
        ]
      }
    ]
  },

  // 2. Sorood-e-Noor (سرود نور) - Mixed Persian / English Fixtures
  {
    id: 'rel-elegy-wind',
    providerId: 'rel-prov-201',
    artistId: 'art-sorood-noor',
    artistName: 'Sorood-e-Noor',
    persianArtistName: 'سرود نور',
    title: 'Elegy of the Wind',
    persianTitle: 'مرثیه باد',
    year: 2022,
    type: 'album',
    isLive: false,
    editionLabel: 'Original Studio Cut',
    coverSeed: 'elegy-wind-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-201', providerId: 'p-201', discNumber: 1, trackNumber: 1, title: 'Dawn over Damavand', persianTitle: 'طلوع بر دماوند', durationSeconds: 374 },
          { id: 'trk-202', providerId: 'p-202', discNumber: 1, trackNumber: 2, title: 'Whispering Reed', persianTitle: 'نجوای نی', durationSeconds: 298 },
          { id: 'trk-203', providerId: 'p-203', discNumber: 1, trackNumber: 3, title: 'Caravan of Shadows', persianTitle: 'کاروان سایه‌ها', durationSeconds: 456 },
          { id: 'trk-204', providerId: 'p-204', discNumber: 1, trackNumber: 4, title: 'Stone and String', persianTitle: 'سنگ و سیم', durationSeconds: 340 },
          { id: 'trk-205', providerId: 'p-205', discNumber: 1, trackNumber: 5, title: 'Elegy of the Wind', persianTitle: 'مرثیه باد', durationSeconds: 512 },
          { id: 'trk-206', providerId: 'p-206', discNumber: 1, trackNumber: 6, title: 'Nightfall Mirage', persianTitle: 'سراب شبانه', durationSeconds: 388 },
          { id: 'trk-207', providerId: 'p-207', discNumber: 1, trackNumber: 7, title: 'The Silent Sitar', persianTitle: 'سه‌تار خاموش', durationSeconds: 280, artistCredit: 'سرود نور feat. کیهان سهرابی' },
          { id: 'trk-208', providerId: 'p-208', discNumber: 1, trackNumber: 8, title: 'Eternal Dusk', persianTitle: 'غروب ابدی', durationSeconds: 420 }
        ]
      }
    ]
  },
  {
    id: 'rel-silent-kavir',
    providerId: 'rel-prov-202',
    artistId: 'art-sorood-noor',
    artistName: 'Sorood-e-Noor',
    persianArtistName: 'سرود نور',
    title: 'Silent Kavir',
    persianTitle: 'کویر خاموش',
    year: 2020,
    type: 'ep',
    isLive: false,
    coverSeed: 'silent-kavir-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-211', providerId: 'p-211', discNumber: 1, trackNumber: 1, title: 'Salt Flat Shimmer', persianTitle: 'درخشش کویر نمک', durationSeconds: 310 },
          { id: 'trk-212', providerId: 'p-212', discNumber: 1, trackNumber: 2, title: 'Nocturne in Lut', persianTitle: 'شبانه در لوت', durationSeconds: 380 },
          { id: 'trk-213', providerId: 'p-213', discNumber: 1, trackNumber: 3, title: 'Star Navigation', persianTitle: 'جهت‌یابی با ستارگان', durationSeconds: 275 }
        ]
      }
    ]
  },
  {
    id: 'rel-resonance-fire',
    providerId: 'rel-prov-203',
    artistId: 'art-sorood-noor',
    artistName: 'Sorood-e-Noor',
    persianArtistName: 'سرود نور',
    title: 'Resonance of Fire',
    persianTitle: 'طنين آتش',
    year: 2024,
    type: 'single',
    isLive: false,
    editionLabel: 'Single Release',
    coverSeed: 'resonance-fire-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-221', providerId: 'p-221', discNumber: 1, trackNumber: 1, title: 'Resonance of Fire', persianTitle: 'طنين آتش', durationSeconds: 365, artistCredit: 'سرود نور feat. نیما سرمدی / Nima Sarmadi' }
        ]
      }
    ]
  },
  {
    id: 'rel-live-shiraz',
    providerId: 'rel-prov-204',
    artistId: 'art-sorood-noor',
    artistName: 'Sorood-e-Noor',
    persianArtistName: 'سرود نور',
    title: 'Live in Shiraz',
    persianTitle: 'اجرای زنده در شیراز',
    year: 2023,
    type: 'single',
    isLive: true,
    coverSeed: 'live-shiraz-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-231', providerId: 'p-231', discNumber: 1, trackNumber: 1, title: 'Elegy of the Wind (Live in Shiraz)', persianTitle: 'مرثیه باد (اجرای زنده)', durationSeconds: 560, isLive: true }
        ]
      }
    ]
  },

  // 3. Roya & The Echo (رویا و پژواک)
  {
    id: 'rel-reflections-glass',
    providerId: 'rel-prov-301',
    artistId: 'art-roya-echo',
    artistName: 'Roya & The Echo',
    persianArtistName: 'رویا و پژواک',
    title: 'Reflections on Glass',
    persianTitle: 'بازتاب بر شیشه',
    year: 2024,
    type: 'album',
    isLive: false,
    editionLabel: '2024 High-Res Master',
    coverSeed: 'reflections-glass-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-301', providerId: 'p-301', discNumber: 1, trackNumber: 1, title: 'Lucid Surface', persianTitle: 'سطح شفاف', durationSeconds: 245 },
          { id: 'trk-302', providerId: 'p-302', discNumber: 1, trackNumber: 2, title: 'Cello in Rain', persianTitle: 'ویولنسل در باران', durationSeconds: 312 },
          { id: 'trk-303', providerId: 'p-303', discNumber: 1, trackNumber: 3, title: 'Fractured Geometry', persianTitle: 'هندسه شکسته', durationSeconds: 289 },
          { id: 'trk-304', providerId: 'p-304', discNumber: 1, trackNumber: 4, title: 'Echo Chamber', persianTitle: 'اتاق پژواک', durationSeconds: 350 },
          { id: 'trk-305', providerId: 'p-305', discNumber: 1, trackNumber: 5, title: 'Vitreous Humor', persianTitle: 'زجاجیه', durationSeconds: 402 },
          { id: 'trk-306', providerId: 'p-306', discNumber: 1, trackNumber: 6, title: 'Luminescence', persianTitle: 'تابش سرد', durationSeconds: 278 }
        ]
      }
    ]
  },
  {
    id: 'rel-journey-mist',
    providerId: 'rel-prov-302',
    artistId: 'art-roya-echo',
    artistName: 'Roya & The Echo',
    persianArtistName: 'رویا و پژواک',
    title: 'Journey in Mist',
    persianTitle: 'سفر در مه',
    year: 2019,
    type: 'album',
    isLive: false,
    coverSeed: 'journey-mist-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-311', providerId: 'p-311', discNumber: 1, trackNumber: 1, title: 'Valley of Fog', persianTitle: 'دره مه‌آلود', durationSeconds: 330 },
          { id: 'trk-312', providerId: 'p-312', discNumber: 1, trackNumber: 2, title: 'Footsteps on Moss', persianTitle: 'ردپا بر خزه', durationSeconds: 290 },
          { id: 'trk-313', providerId: 'p-313', discNumber: 1, trackNumber: 3, title: 'Ancient Pine', persianTitle: 'کاج کهنسال', durationSeconds: 375 }
        ]
      }
    ]
  },
  {
    id: 'rel-ephemeral-single',
    providerId: 'rel-prov-303',
    artistId: 'art-roya-echo',
    artistName: 'Roya & The Echo',
    title: 'Ephemeral',
    year: 2025,
    type: 'single',
    isLive: false,
    coverSeed: 'ephemeral-single-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-321', providerId: 'p-321', discNumber: 1, trackNumber: 1, title: 'Ephemeral', durationSeconds: 220 }
        ]
      }
    ]
  },

  // 4. Shattered Horizon (Heavy Atmospheric / Doom)
  {
    id: 'rel-beneath-iron',
    providerId: 'rel-prov-401',
    artistId: 'art-shattered-horizon',
    artistName: 'Shattered Horizon',
    title: 'Beneath The Iron Veil',
    year: 2021,
    type: 'album',
    isLive: false,
    editionLabel: 'Collector’s Remaster',
    coverSeed: 'beneath-iron-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-401', providerId: 'p-401', discNumber: 1, trackNumber: 1, title: 'Slag and Bone', durationSeconds: 430 },
          { id: 'trk-402', providerId: 'p-402', discNumber: 1, trackNumber: 2, title: 'Veil of Ash', durationSeconds: 512 },
          { id: 'trk-403', providerId: 'p-403', discNumber: 1, trackNumber: 3, title: 'Sulfur Bloom', durationSeconds: 388 },
          { id: 'trk-404', providerId: 'p-404', discNumber: 1, trackNumber: 4, title: 'Decay Constant', durationSeconds: 460 },
          { id: 'trk-405', providerId: 'p-405', discNumber: 1, trackNumber: 5, title: 'The Crushed Pillar', durationSeconds: 540 }
        ]
      }
    ]
  },
  {
    id: 'rel-hollow-sun',
    providerId: 'rel-prov-402',
    artistId: 'art-shattered-horizon',
    artistName: 'Shattered Horizon',
    title: 'Hollow Sun',
    year: 2023,
    type: 'single',
    isLive: false,
    coverSeed: 'hollow-sun-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          // Notice: durationSeconds omitted to demonstrate honest handling of missing metadata
          { id: 'trk-411', providerId: 'p-411', discNumber: 1, trackNumber: 1, title: 'Hollow Sun' }
        ]
      }
    ]
  },

  // 5. Kavir Frequency (فرکانس کویر) - Unknown type fixture & tape transfer
  {
    id: 'rel-dark-sands',
    providerId: 'rel-prov-501',
    artistId: 'art-kavir-frequency',
    artistName: 'Kavir Frequency',
    persianArtistName: 'فرکانس کویر',
    title: 'Dark Sands',
    persianTitle: 'شن‌های تیره',
    year: 2023,
    type: 'album',
    isLive: false,
    coverSeed: 'dark-sands-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-501', providerId: 'p-501', discNumber: 1, trackNumber: 1, title: 'Sub-harmonic Dune', persianTitle: 'تپه زیرصوتی', durationSeconds: 420 },
          { id: 'trk-502', providerId: 'p-502', discNumber: 1, trackNumber: 2, title: 'Thermal Inversion', persianTitle: 'وارونگی دمایی', durationSeconds: 360 },
          { id: 'trk-503', providerId: 'p-503', discNumber: 1, trackNumber: 3, title: 'Static in the Dust', persianTitle: 'پارازیت در غبار', durationSeconds: 480 }
        ]
      }
    ]
  },
  {
    id: 'rel-archival-sessions',
    providerId: 'rel-prov-502',
    artistId: 'art-kavir-frequency',
    artistName: 'Kavir Frequency',
    persianArtistName: 'فرکانس کویر',
    title: 'Archival Tape Sessions Vol. 1',
    // Notice: year is undefined (unknown metadata)
    type: 'unknown',
    isLive: false,
    editionLabel: 'Archival Tape Transfer (Uncataloged)',
    coverSeed: 'archival-sessions-cov',
    targetFormat: 'MP3',
    discs: [
      {
        discNumber: 1,
        tracks: [
          { id: 'trk-511', providerId: 'p-511', discNumber: 1, trackNumber: 1, title: 'Reel A - 432Hz Calibration', durationSeconds: 180 },
          { id: 'trk-512', providerId: 'p-512', discNumber: 1, trackNumber: 2, title: 'Reel B - Desert Pulse 09', durationSeconds: 340 }
        ]
      }
    ]
  }
];

export class MockMusicCatalog implements MusicCatalog {
  async searchArtists(query: string): Promise<Artist[]> {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_ARTISTS;
    return MOCK_ARTISTS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.persianName && a.persianName.includes(q)) ||
        a.genre.toLowerCase().includes(q)
    );
  }

  async getArtist(artistId: string): Promise<Artist | null> {
    const artist = MOCK_ARTISTS.find((a) => a.id === artistId);
    return artist || null;
  }

  async getReleasesByArtist(artistId: string): Promise<Release[]> {
    return MOCK_RELEASES.filter((r) => r.artistId === artistId);
  }

  async getRelease(releaseId: string): Promise<Release | null> {
    const rel = MOCK_RELEASES.find((r) => r.id === releaseId);
    return rel || null;
  }

  async getFeaturedArtists(): Promise<Artist[]> {
    return MOCK_ARTISTS;
  }
}

export const defaultCatalog = new MockMusicCatalog();
