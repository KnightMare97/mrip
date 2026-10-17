# Music Rip — Personal Mobile-First Music Discovery & Album Export PWA

A refined, mobile-first music discovery and album export web application prototype with typed fictional mock data, replaceable catalog and export service adapters, state-machine driven export simulation with separated processing and artifact availability states, bilingual English/Persian RTL typography, and PWA offline app-shell capabilities.

## Architecture & Revisions Summary

- **Visual Direction**: Proposed warm amber gold accents (`#F59E0B`) on deep matte charcoal surfaces (`#121214`), built genre-agnostically with full light/contrast legibility, accessible touch targets, and reduced motion compliance.
- **Fictional Catalog**: 100% fictional artists, releases, and original SVG placeholder artwork across English, Persian, and mixed-script naming (e.g., *Chroma Drift*, *سرود نور / Sorood-e-Noor*, *Roya & The Echo / رویا و پژواک*, *Kavir Frequency*, *Shattered Horizon*). No fabricated data for real-world musicians.
- **Refined Domain Model**:
  - `ReleaseType`: `'album' | 'ep' | 'single' | 'unknown'`
  - `isLive`: Independent boolean flag (distinct from release type)
  - `editionLabel`: Optional free-text tag (e.g., "2024 Remaster", "Deluxe Edition")
  - `Target Format`: Clearly designated as "Target format: MP3" (no blanket 320kbps assumption).
  - Explicit per-track artist credits, optional album artist, and stable provider IDs.
  - Strict preservation of disc and track indices.
- **Dual Lifecycle State Machine**:
  - `ProcessingStatus`: `'queued' | 'resolving' | 'awaiting_review' | 'downloading' | 'tagging' | 'packaging' | 'completed' | 'partial' | 'failed'`
  - `ArtifactAvailability`: `'not_created' | 'available' | 'expired'`
  - A job can be `completed` while its artifact is `expired`.
  - Ambiguous matches explicitly enter `awaiting_review` until the user decides.
- **Demo Honesty & Non-Fabrication**:
  - All synthetic progress, track sizes, and transfer rates are explicitly labeled as **Demo Simulation**.
  - No fake ZIP download triggers; presents a **Simulated Archive Inspector**.
  - 9/10 tracks completed is strictly classified as `partial`.
  - Retries preserve existing successful tracks without duplicates.
  - Interrupted reloads are gracefully flagged rather than claiming background persistence.
- **Mobile Ergonomics**:
  - Fixed bottom navigation bar with safe-area spacing (`pb-safe`).
  - Sticky bottom CTA offsets properly above the nav bar to prevent overlaps.
  - Mixed LTR/RTL support for Persian titles, duration counters, and keyboard navigation.
- **Collapsible Dev Simulation Panel**:
  - Pinned or floating toggle allowing immediate triggering of success, missing track partial, ambiguous match modal, server failure, and artifact expiration.

---

## Technical Stack & Verification

- React 19 + TypeScript + Tailwind CSS v4 + Motion + Lucide React.
- Replaceable interfaces: `MusicCatalog` and `ExportService`.
- Build verification: `npm run build` / `npm run lint`.
