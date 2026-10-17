# Music Rip — Personal Mobile-First Music Discovery & Album Export PWA

A refined, mobile-first music discovery and album export prototype built with React 19, TypeScript, and Tailwind CSS. Features typed fictional mock catalog data, bilingual English/Persian RTL layout support, a dual-status state-machine export simulation engine, and PWA offline app-shell capabilities.

---

## 1. Feature Breakdown: Implemented vs. Simulated vs. Deferred

### ✅ Implemented Features (Working Code & UI)
- **Search View**: Instant filter by artist name, Persian title, or genre. Zero-pill recent searches with history clearance.
- **Artist View**: Discography listing with cover art, release year (or unknown metadata indicator), edition labels, and interactive type filters (`All`, `Albums`, `EPs`, `Singles`, `Live`).
- **Release View**: Full ordered tracklists grouped strictly by Disc number (multi-disc support), edition badges, per-track artist credits, target encoding format (`Target format: MP3`), and duration indicators.
- **Bilingual English & Persian Support**: Global language switch (`EN` ↔ `فا`) with bidirectional mirroring (`dir="ltr"` / `dir="rtl"`), Vazirmatn Persian typography, and mixed-script titles.
- **PWA Capabilities**: Web App Manifest (`manifest.webmanifest`), SVG brand icons, in-app install prompt hook (`usePWAInstall`), iOS home-screen instructions, and offline detection.
- **Ergonomic Mobile Layout**: Thumb-zone navigation bar with safe-area spacing (`pb-safe`), and non-overlapping sticky bottom CTA bar.
- **Pluggable Architecture**: Decoupled `MusicCatalog` and `ExportService` TypeScript interfaces allowing zero-refactor backend adapter replacement.

### 🧪 Simulated Demo Features (Clearly Labeled as Demo)
- **Dual Lifecycle State Machine**:
  - Processing states: `queued` → `resolving` → `awaiting_review` → `downloading` → `tagging` → `packaging` → `completed` | `partial` | `failed`.
  - Artifact states: `not_created` → `available` → `expired`.
- **Honest Demo Behavior**:
  - **No Fake ZIP Downloads**: No fabricated browser downloads of empty bytes. Instead, an interactive **Simulated Archive Inspector** displays the virtual ZIP directory structure, file sizes, and ID3v2 tags.
  - **Strict Partial Accuracy**: A 10-track album with 9 successful tracks is classified as **Partial**, not Complete.
  - **No Silent Substitutions**: Ambiguous track matches pause the state machine and raise an **Ambiguous Match Review Modal** allowing user selection or track exclusion.
  - **Non-Destructive Retry**: Retrying a partial or failed export keeps previously completed tracks intact without duplicating them.
  - **Interrupted Recovery**: Reloading the page during a simulation safely marks the job as interrupted rather than hallucinating server-side persistence.
- **Developer Scenario Panel**: Collapsible panel to test:
  1. *Success*: 100% full export.
  2. *Missing Track*: Stream unretrievable, yielding partial status.
  3. *Ambiguous Match*: Pauses at track 2 to review live/cover candidates.
  4. *Server Error*: 503 Service Unavailable with retry recovery.
  5. *Expired Archive*: Completed processing with expired storage link.

### ⏳ Deferred Work (Out of Scope for Initial UI Phase)
- Real YouTube/audio stream scrapers or audio transcoding pipelines.
- User authentication and persistent cloud databases.
- Automatic cloud deployments or paid third-party APIs.
- Real MusicBrainz/Discogs live API calls.

---

## 2. Project Structure

```
├── public/
│   ├── icon.svg                 # Brand vector icon for PWA
│   ├── manifest.webmanifest     # Standalone PWA installation manifest
│   └── sw.js                    # App shell service worker (media excluded)
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── AmbiguousMatchModal.tsx     # Review dialog for uncertain matches
│   │   │   ├── ArtworkPlaceholder.tsx      # Generative geometric SVG album art
│   │   │   ├── BottomNav.tsx               # Ergonomic mobile thumb-zone navigation
│   │   │   ├── DevScenarioPanel.tsx        # Collapsible scenario test triggers
│   │   │   ├── Header.tsx                  # 3-zone top bar with RTL & PWA triggers
│   │   │   ├── OfflineIndicator.tsx        # Network status warning banner
│   │   │   └── SimulatedArchiveModal.tsx   # Virtual ZIP hierarchy & ID3 tags
│   │   └── views/
│   │       ├── ArtistView.tsx              # Discography and release filters
│   │       ├── ExportDetailView.tsx        # State machine progress & track statuses
│   │       ├── RecentJobsView.tsx          # Export history & retry actions
│   │       ├── ReleaseView.tsx             # Ordered disc tracklists & export CTA
│   │       ├── SearchView.tsx              # Artist discovery and recent searches
│   │       └── SettingsView.tsx            # Scenario picker & language toggles
│   ├── context/
│   │   ├── CatalogContext.tsx              # MusicCatalog provider
│   │   ├── ExportContext.tsx               # ExportService provider
│   │   └── LanguageContext.tsx             # English LTR / Persian RTL strings
│   ├── hooks/
│   │   ├── useOnlineStatus.ts              # Connectivity listener
│   │   └── usePWAInstall.ts                # In-app PWA install prompt handler
│   ├── services/
│   │   ├── catalog/
│   │   │   ├── MockMusicCatalog.ts         # 100% fictional artists and releases
│   │   │   └── MusicCatalog.ts             # Replaceable catalog interface
│   │   └── export/
│   │       ├── ExportService.ts            # Replaceable export interface
│   │       └── SimulatedExportService.ts   # State-machine simulation engine
│   ├── types/
│   │   ├── export.ts                       # Dual status, match candidate, and job types
│   │   └── music.ts                        # Artist, Release, Disc, and Track types
│   ├── App.tsx                             # Top-level view router and state wiring
│   ├── index.css                           # Tailwind CSS v4, fonts, and safe areas
│   └── main.tsx                            # React root entry point
├── metadata.json                           # AI Studio metadata
├── package.json                            # Scripts & dependencies
└── tsconfig.json                           # TypeScript configuration
```

---

## 3. Short Backend Integration Checklist

When ready to implement real backend ingestion and audio packaging, follow this checklist:

1. **Catalog Service Integration**:
   - [ ] Implement `MusicCatalog` adapter pointing to MusicBrainz, Discogs, or custom metadata API.
   - [ ] Preserve release edition labels, multi-disc indices, and per-track artist credits.
2. **Audio Resolution & Match Verification**:
   - [ ] Implement stream resolver with fingerprint or audio duration matching.
   - [ ] Check duration threshold ($\pm 3$ seconds) and title normalization.
   - [ ] When confidence is $< 0.85$, trigger the existing `awaiting_review` state with candidate matches rather than guessing.
3. **Queue & Worker Architecture**:
   - [ ] Replace `SimulatedExportService` with an HTTP/WebSocket client connecting to a backend task runner (e.g. BullMQ / Celery / Cloud Tasks).
   - [ ] Keep `processingStatus` and `artifactAvailability` distinct in the database schema.
4. **Packaging & Tagging**:
   - [ ] Encode to target MP3 with LAME (`id3v2.4` standard tags: Artist, Album, Title, Track No, Disc No, Year).
   - [ ] Assemble ZIP file with subdirectories for multi-disc sets (`Disc 01/`, `Disc 02/`).
   - [ ] Generate signed temporary download URL and set `artifactAvailability: 'available'` with TTL expiration.
5. **Storage Retention**:
   - [ ] Set object storage lifecycle policy to delete temporary ZIP files after 24 hours.
   - [ ] Transition `artifactAvailability` to `'expired'` in job record without deleting the export history record.
