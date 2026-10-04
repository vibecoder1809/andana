# Project Memory & Agent Workflow Guide — Andana

> **CRITICAL INSTRUCTION FOR ALL AI AGENTS:**
> 1. **READ THIS FILE FIRST** at the start of every session before modifying or analyzing any code.
> 2. **RECORD EVERY CHANGE**: Whenever you modify, add, or remove features, update the **[Change History & Session Log](#change-history--session-log)** section at the bottom of this file before completing your task.
> 3. **RESPECT ARCHITECTURAL BOUNDARIES**: Adhere to the rules and workflow patterns documented below without exception.

---

## 1. Project Overview

**Andana** (formerly *Geotren*) is an unofficial real-time map, departures board, and trip planner for **FGC** (*Ferrocarrils de la Generalitat de Catalunya*) trains in Catalonia.
- **Stack:** Next.js 16.2.9 (App Router, Turbopack), React 19, TypeScript (strict), MapLibre GL (`react-map-gl/maplibre`), Tailwind v4 (installed, but inline styles + CSS variables are strictly used).
- **Languages:** Catalan (`ca`, canonical source language), Spanish (`es`), and English (`en`).
- **Data Source:** FGC Open Data Portal (`dadesobertes.fgc.cat`, Opendatasoft v2.1).

---

## 2. Core Architecture & Workflow Rules

### A. Strict Server vs. Client Boundary
- **Server fetcher layer:** All network calls to `dadesobertes.fgc.cat` live under `src/lib/fgc.ts` (cached endpoints, GTFS-RT protobuf decoders, full timetable exports).
- **Route handlers (`src/app/api/*`):** Server-side route handlers wrap `src/lib/*` fetchers. Client components **NEVER** import from `src/lib/fgc.ts` or server-only helpers.
- **Type barrel (`src/types/index.ts`):** All shared entity and journey-planning domain types (`Train`, `Stop`, `Route`, `Alert`, `StopDetail`, `PlannerStation`, `JourneyLeg`, `Journey`) MUST live directly in `src/types/index.ts`. Never re-export domain types through server-side modules (like `planner.ts`) into client files.

### B. Dual-Root Mobile & Desktop Parity
- **Desktop root:** [`src/components/App.tsx`](src/components/App.tsx) (desktop layout grid: Header + Sidebar + MapView + Detail/Stop Panels).
- **Mobile root:** [`src/components/MobileLayout.tsx`](src/components/MobileLayout.tsx) (custom velocity-aware bottom-sheet interface + MapView).
- **Rule:** Any user-facing feature, control, or modal MUST be wired into both roots unless it is strictly desktop- or mobile-specific (e.g. bottom-sheet gesture controls). Leaf components (`MapView`, `TripPlanner`, `DeparturesBoard`, `DetailPanel`, `StopPanel`) are shared across roots.

### C. Styling Conventions
- **No Tailwind class soup:** Components use inline `style={{ ... }}` objects paired with semantic CSS variables defined in [`src/app/globals.css`](src/app/globals.css) (`var(--bg)`, `var(--bg2)`, `var(--bg3)`, `var(--accent)`, `var(--muted)`, `var(--text)`, `var(--yellow)`, `var(--red)`, `var(--green)`).
- **Theme support:** Switched via `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`.
- **Fonts:** System fonts + `var(--font-space-grotesk)`.

### D. Trilingual i18n
- All UI strings live in `DICT` in [`src/lib/i18n.tsx`](src/lib/i18n.tsx).
- Source language is **Catalan (`ca`)**, with required counterparts in **Spanish (`es`)** and **English (`en`)**.
- **Rule:** NEVER hardcode user-facing strings in JSX or API handlers. Use `const { t } = useI18n()` and `t('key')`. API routes return machine-readable error codes (e.g., `same_station`, `missing_params`), and the client maps them to translated strings.

### E. Zero Fake Dynamics (No Smoke & Mirrors)
- **STRICT RULE:** Never build features that are a "smoke screen", fake mockups pretending to be real, or UI elements that appear to be dynamic/interactive but are secretly hardcoded.
- All live stats, countdowns, platform track assignments, delay minutes, train positions, filters, and telemetry MUST connect to authentic upstream data feeds and genuine business logic.
- If upstream data is unavailable, unroutable, or missing for an entity, render an honest, clean "no data available" or graceful fallback state rather than inventing deceptive fake metrics.

---

## 3. Subsystem Workflows

### 1. Live Train Pipeline & Dead-Reckoned Interpolation
- **Polling:** The client polls `/api/trains` every 10 seconds.
- **Data assembly:** `/api/trains` fetches real-time positions (`posicionament-dels-trens`), GTFS-RT delays & ETAs (`trip-updates-gtfs_realtime`), and vehicle composition occupancy (`vehicle-positions-gtfs_realtime`). Join key is `tripId` (the posicionament record `id`).
- **Smooth Animation (`src/lib/interpolate.ts`):** 
  - Upstream feeds update every ~20–30s. To prevent trains jumping, `useInterpolatedTrains` runs a `requestAnimationFrame` loop.
  - Trains are projected onto their route geometry (`src/lib/geometry.ts`).
  - Speed is dead-reckoned from the distance to the upcoming stop divided by `nextStopEta`.
  - Drift corrections glide toward the real position instead of teleporting, with a 2,000m snap threshold for genuine re-routings.

### 2. Timetable CSA Journey Planner (`src/lib/planner.ts`)
- Uses the **Connection Scan Algorithm (CSA)** over full GTFS timetable data.
- **Transfer penalty:** Applies a penalty to discourage rapid train-hopping on parallel corridors (e.g. between Pl. Catalunya and Sarrià).
- **Date bounds:** Uses `isWithinPlanWindow` anchored to `todayLocalISO()` in Europe/Madrid (`src/lib/serviceTime.ts`) with a max 7-day lookahead window (`MAX_PLAN_DAYS_AHEAD`).
- **Live enrichment:** When planning for the current day, median line delays are merged into departure countdowns.

### 3. Map & Journey Drawing (`src/lib/journeyPath.ts`, `src/components/MapView.tsx`)
- Selected journey itineraries are parsed into distinct color-coded route segments per leg.
- Polyline segments are clipped (`clipPolyline`) to span from the boarding station to the alighting station.
- MapLibre automatically centers and frames the full journey using `fitBounds` with device-appropriate padding.

### 4. Station Departures Board (`src/components/DeparturesBoard.tsx`)
- Fetched via `/api/departures?station=<parentCode>`.
- Refreshes every 60s and maintains a local per-second countdown.
- Departure time accounts for GTFS scheduled departure + real-time line delay.

### 5. Saved & Recent Routes (`src/lib/savedRoutes.ts`)
- Uses `localStorage` (`andana-fav-routes` and `andana-recent-routes`, with legacy `geotren-*` fallback).
- Hydrated on mount inside `TripPlanner` to avoid SSR/client mismatch.

---

## 4. Verification & Testing Workflow

Before committing any changes or concluding a session, verify:

1. **Unit & Infrastructure Checks:**
   ```bash
   npm test
   ```
   *(Runs standalone Node check scripts under `scripts/test-infra.mts` covering the Europe/Madrid service clock, cache TTL/in-flight behavior, and plan date math).*

2. **TypeScript Strict Typechecking:**
   ```bash
   npx tsc --noEmit
   ```
   *(Ensure 0 errors across the entire codebase).*

3. **Production Build:**
   ```bash
   npm run build
   ```
   *(Ensure Next.js Turbopack build and route static/dynamic generation succeeds).*

> **Windows PowerShell Note:** If PowerShell execution policy blocks `npm.ps1`, invoke commands with `cmd /c npm <script>` or `cmd /c npx <cmd>`.
> **Lint Note:** Pre-existing `react-hooks/set-state-in-effect` and `exhaustive-deps` warnings exist in client effects and do not block `next build`. Do not churn unrelated code solely to satisfy these unless specifically asked.
> **Git Push Rule:** NEVER run `git push` automatically. Only push changes to remote when the user explicitly asks for it.

---

## 5. Architectural Log & Major Decisions

- **Removal of Historical Reliability & GitHub Action Cron (Oct 2026):**
  - The historical punctuality recording pipeline (Supabase database, GitHub Actions 10-minute cron, `delay_stats` Postgres view, `useReliability` hook, `ReliabilityNote`, `ReliabilityCard`) was **scrapped and completely deleted**.
  - No database or external cron is used. Real-time delays from GTFS-RT are directly used for departures, live trains, and trip planning.
- **Client-Safe Types Barrel (Aug 2026):**
  - Planner domain types (`PlannerStation`, `JourneyLeg`, `Journey`) were moved directly into `src/types/index.ts` so that client components never transitively bundle server-only FGC fetchers.
- **Service Clock Pinned to Europe/Madrid:**
  - All date and time calculations are explicitly pinned to `Europe/Madrid` via `src/lib/serviceTime.ts` to ensure correct service day turnover and DST compliance when hosted on UTC servers (e.g. Vercel).

---

## 6. Change History & Session Log

<!-- ALL FUTURE AGENTS: APPEND YOUR SESSION UPDATES HERE -->

### Session: 2026-10-03 (Scrapping Historical Reliability & Adding Project Memory)
- **Scrapped Historical Reliability Subsystem:**
  - Removed GitHub Actions cron workflow `.github/workflows/capture-delays.yml` and `.github/` folder.
  - Removed Supabase database schema `supabase/schema.sql` and `supabase/` folder.
  - Removed server API route `src/app/api/reliability/route.ts`.
  - Removed client library `src/lib/reliability.ts` and component `src/components/ReliabilityNote.tsx`.
  - Removed capture and test scripts: `capture-delays.mjs`, `check-reliability-health.mjs`, `mock-supabase.mjs`, `test-reliability.mts`, `test-reliability-e2e.mts`, `test-i18n-reliability.mts`.
  - Cleaned up consumers in `DeparturesBoard.tsx`, `DetailPanel.tsx`, `TripPlanner.tsx`, and `serviceTime.ts`.
  - Removed reliability localization keys from `src/lib/i18n.tsx`.
  - Updated `package.json` test script to run `scripts/test-infra.mts`.
- **Created Project Memory:**
  - Added `project_memory.md` to serve as the single source of truth for workflows, architectural rules, and session changelogs for future agents.

### Session: 2026-10-03 (Integrating Renfe / Rodalies Infrastructure & Multi-Network Switch)
- **Official Renfe Real-Time API Integration:**
  - Researched Renfe official live map APIs (`tiempo-real.renfe.com`) filtered for Catalonia nucleus (`nucleo: 50`).
  - Created `src/lib/renfe.ts` providing cached fetchers:
    - `fetchRenfeStations()`: 200+ Rodalies stations with coordinates, accessibility, and passing lines.
    - `fetchRenfeRoutes()`: 19 Rodalies lines (R1-R8, regional R11-R17, RL/RT/RG) with official colors and `MultiLineString` route geometry.
    - `fetchRenfeTrains()`: live train fleet positions, train numbers, origins, destinations, delays, operational status (`approaching`, `stationed`, `moving`, `departing`), platform track assignments (`via` / `nextVia`), upcoming stop ETAs, and accessibility.
    - `fetchRenfeDepartures(stationCode)`: live station departure boards with track numbers, delays, and headsigns.
  - Created test script `scripts/test-renfe.mts` validating the live client against upstream Renfe endpoints.
- **Unified Route Handlers (`src/app/api/*`):**
  - Updated `/api/trains` to fetch and merge live trains from both FGC and Renfe.
  - Updated `/api/stops` and `/api/routes` to merge stations and line geometries with `1d` cache revalidation.
  - Updated `/api/departures` to route numeric station IDs (e.g. `78804` Arc de Triomf) to Renfe's live departures and alphanumeric codes to FGC's timetable engine.
- **Top-Level Network Switch & Filter:**
  - Added `<NetworkSwitch mode={networkMode} onChange={setNetworkMode} />` supporting `FGC`, `Rodalies`, and `Both` modes.
  - Added in `Header.tsx` (desktop header) and `MobileLayout.tsx` (mobile top bar pill) with instant filtering of trains, stops, routes, and lines.
  - Persisted mode selection to `localStorage` (`andana-network-mode`).
- **Telemetry UI Matching Renfe's Official App:**
  - Updated `TrainCard.tsx` with line badge, train number (`#77428`), operational status pill (`Aproximant-se`, `Estacionat`, `En marxa`, `Sortint`), accessibility icon, previous station (`Vía: X`), and next station (`Vía: Y`) with countdown/ETA.
  - Updated `DetailPanel.tsx` with dedicated Renfe telemetry view: commuter header, origin ➔ destination route banner, status badges, accessibility badges, previous and next stations with track assignments, live countdown arrival (`56s (14:56)`), and time variation (`Variació h: +X min` / `Puntual`).
  - Updated `DeparturesBoard.tsx` to display platform tracks (`Vía: X`) and accessibility.
  - Updated `StopPanel.tsx` with operator badge (`ESTACIÓ RODALIES` vs `ESTACIÓ FGC`), passing line tags, and correct numeric station code resolution.
  - Updated `Sidebar.tsx` and `MobileLayout.tsx` line group selectors with dedicated groups for FGC regional, Rodalies Barcelona (`R1-R8`), and Rodalies Regionals (`R11-R17`, `RL/RT/RG`).
- **Station View Alignment & Contradiction Fix:**
  - Derived full upcoming route stops for Renfe trains (`loadRenfeTrains()`) by indexing line stations and projecting from `nextStop` to `destination`, so trains approaching a station are properly detected in `passingTrains`.
  - Resolved repetitive "Pròximes sortides" / departures board: removed duplicate `<DeparturesBoard />` from `Sidebar.tsx`. In desktop view, `Sidebar.tsx`'s `ESTACIONS` tab now serves purely as a searchable station directory (matching `TRENS` for trains), while the single floating right-hand drawer `<StopPanel />` houses the live departures board, track assignments, and environmental telemetry.
  - Removed misleading/contradictory "Cap tren detectat passant per aquesta estació" message when no train is currently at the platform; only render `passingNowSoon` when trains are actively passing/approaching, letting `DeparturesBoard` display all upcoming departures.
  - Connected `trains={filteredTrains}` and `onSelectTrain={handleSelectTrain}` into desktop `<StopPanel />` for full parity with mobile.
- **2-Letter Abbreviations for All Renfe/Rodalies Stations on Map:**
  - Added `RENFE_STATION_CODES` and helper `getStationCode(stopId, name)` to `src/lib/constants.ts` covering all 202 Rodalies stations in Catalonia with intuitive 2-letter abbreviations (e.g. `ST` for Sants, `PG` for Passeig de Gràcia, `AT` for Arc de Triomf, `EF` for França, `CL` for Clot, `AE` for Aeroport, `SI` for Sitges, `VG` for Vilanova, `MT` for Mataró, `GI` for Girona, `TG` for Tarragona, `VI` for Vic, etc.).
  - Added optional `code?: string` field to `Stop` model in `src/types/index.ts`.
  - Populated `code` in `src/lib/renfe.ts` during station ingestion.
  - Updated `src/components/MapView.tsx`'s `stopsGeoJson` layer to use `s.code ?? getStationCode(s.stopId, s.name)` so the 2-letter abbreviation renders in every station dot on the map.
- **Localization & Verification:**
  - Added translations for all Renfe telemetry concepts in Catalan (`ca`), Spanish (`es`), and English (`en`) in `src/lib/i18n.tsx`.
  - Verified with `npm test` (30/30 checks passed), `scripts/test-renfe.mts` (passed), `npx tsc --noEmit` (0 errors), and `npm run build` (Next.js Turbopack build succeeded).

### Session: 2026-10-03 (Service Alerts Deduplication, Contextual Explanations & Official Channels Modal)
- **Root Cause of Duplicate Warnings:**
  - In FGC's `alerts-gtfs_realtime` feed, FGC publishes a separate alert entity for each individual stop along an affected line rather than a single corridor-wide alert (e.g., 22 identical entries of "Enllaç amb autobús Manresa" for 22 different stations).
- **Alert Deduplication & Stop Aggregation (`src/lib/gtfs.ts`):**
  - Updated `fetchAlerts()` to group raw GTFS-RT entities by normalized header text (`header.replace(/\s+/g, ' ').trim().toLowerCase()`).
  - Aggregated all affected `stopId`s and mapped them to station names via `STATION_CODES`.
  - Inferred affected lines from stop corridors (e.g. `R5`, `R6`, `S4`, `S8` for Llobregat-Anoia stations).
- **Plain-Language Explanations:**
  - Built contextual clarification generators for common cryptic FGC notices:
    - Bus substitution notices (e.g. "Enllaç amb autobús Manresa"): explained that train service is interrupted and replaced by dedicated shuttle buses connecting the affected corridor.
    - 3-car train boarding restrictions: explained that due to short platforms, passengers must board the first 3 cars to alight at specific stations.
- **Interactive Alerts Modal (`src/components/AlertModal.tsx`):**
  - Users can now click any alert in the banner or mobile drawer to open a dedicated detail modal featuring:
    - Alert title & operator badge (`FGC` or `Rodalies`).
    - "Què vol dir aquest avís?" (plain-language explanation of what is happening).
    - Affected line badges.
    - Affected station chips list (showing full station names).
    - "Canals oficials en temps real" with direct outbound links:
      - 🌐 Official FGC avisos (`https://www.fgc.cat/avisos/`)
      - 🔴 FGC live status (`https://www.fgc.cat/estat-del-servei/`)
      - 🐦 FGC Twitter/X (`@FGC` - `https://twitter.com/FGC`)
      - 🚆 Rodalies alteracions (`https://rodalies.gencat.cat/ca/alteracions_del_servei/`)
      - 🐦 Rodalies Twitter/X (`@rodalies` - `https://twitter.com/rodalies`)
- **Desktop & Mobile Parity:**
  - Desktop `AlertBanner` in `App.tsx` now supports clicking to inspect an alert and shows affected station count badges.
  - Mobile `MobileAlertBanner` in `MobileLayout.tsx` similarly supports clicking and displays the modal.
- **Alert Publication Date and Time Display:**
  - Enhanced `fetchAlerts()` in `src/lib/gtfs.ts` to capture the earliest `start` timestamp (and fallback to feed header timestamp) and validity `end` timestamp for every alert.
  - Created `src/lib/alertTime.ts` with `formatAlertDateTime()` helper supporting relative formatting ("Avui a les 03:01", "Ahir a les 22:15", "Demà a les 03:00", or formatted calendar date/time) and compact ticker time strings.
  - Added dictionary keys (`alertIssuedAt`, `alertValidUntil`, `todayAt`, `yesterdayAt`, `tomorrowAt`, `dateTimeAt`) in Catalan, Spanish, and English in `src/lib/i18n.tsx`.
  - Displayed timestamp chips:
    - In `AlertModal`: Dedicated metadata card showing `🕒 Emès el: Avui a les 03:01` and `📅 Vigent fins a: ...`.
    - In desktop `AlertBanner`: Compact `🕒 03:01` pill in the rotating ticker, and full `🕒 Avui a les 03:01` in the expanded dropdown list.
    - In mobile `MobileAlertBanner`: Compact `🕒 03:01` in the top ticker bar, and full timestamp in the mobile dropdown list.
- **Verification:**
  - Verified with `cmd /c npx tsc --noEmit` (0 errors), `cmd /c npm test` (30/30 checks passed), and `cmd /c npm run build` (Next.js Turbopack build succeeded).

### Session: 2026-10-03 (Complete Mobile UI/UX Overhaul & Unified Sheet Architecture)
- **Top Bar Streamlining & Decluttering:**
  - Replaced cramped, overlapping 5-item top bar with a clean, breathable 2-cluster layout:
    - Left: Brand icon + compact `NetworkSwitch` (`FGC` | `Rodalies` | `Totes`).
    - Right: 3 square touch targets: `NearMeButton` (`📍`), `RefreshButton` (`↻`), and `SettingsButton` (`⚙️`).
  - Created `src/components/MobileSettingsModal.tsx`:
    - Moved secondary preferences (Language selection, Dark/Light theme, Service telemetry stats, and About Andana open data) into a dedicated bottom sheet modal.
    - Frees up horizontal space, preventing any overflow or touch target collision across all smartphone widths (320px–430px).
- **Unified Bottom Sheet Architecture (One-Sheet Flow):**
  - Eliminated the awkward dual-sheet overlay (`DetailSheet` over the main bottom sheet).
  - The bottom sheet now functions as a unified native container:
    - In **Browse Mode**: Displays the 3 segmented tabs (`Trens`, `Estacions`, `Anar a…`) with line filter chips.
    - In **Detail Mode** (Train or Station selected):
      - Smoothly transforms with a sticky navigation bar: `← [Trens / Estacions]` back button, line/station badge, item title, and `✕` close button.
      - Body mounts `<DetailPanel mobile>` or `<StopPanel mobile>` with direct view of live platform tracks, countdowns, and delays.
      - Selecting an item snaps to `SNAP_HALF` (0.48), letting commuters view the map on the top half and the live departures/telemetry on the bottom half without requiring immediate scrolling.
      - Swiping up reaches `SNAP_FULL` for deep telemetry (wagon occupancy, weather, air quality, full upcoming stops).
      - Tapping back `←` or clicking the empty map smoothly returns to the browse list.
- **Instant Major Hubs in Estacions Tab:**
  - In `MobileLayout.tsx`, when `stationQuery` is empty, dynamically displays curated metropolitan interchange hubs tailored to the active `networkMode` (e.g. Sants, Catalunya, Provença, Passeig de Gràcia, Arc de Triomf, Sarrià, Sant Cugat).
  - Added clear button (`✕`) inside the station search input.
- **Sleek Floating Alert Pill:**
  - Redesigned `MobileAlertBanner` into a floating capsule (`rgba(234,179,8,0.96)`) with `⚠`, truncated notice title, `🕒` compact timestamp, station count chip, and quick `ℹ️` trigger for `<AlertModal />`.
- **Localization:**
  - Added translations for all mobile settings, hubs, and navigation keys across Catalan, Spanish, and English in `src/lib/i18n.tsx`.
- **Verification:**
  - Verified with `cmd /c npx tsc --noEmit` (0 errors), `cmd /c npm test` (30/30 checks passed), and `cmd /c npm run build` (Next.js Turbopack build succeeded).

### Session: 2026-10-03 (Fixing Floating Rodalies R15 Train & Network Switch State Synchronization)
- **Root Cause Diagnosis:**
  1. *Stale `displayed` state in `useInterpolatedTrains` (`src/lib/interpolate.ts`):*
     - `displayed` state was initialized via `useState<Train[]>(apiTrains)`.
     - When `apiTrains` changed (e.g. switching `networkMode` to `fgc`), `stateMap.current` removed the deleted trains, but `setDisplayed` was NOT invoked immediately.
     - `setDisplayed` was solely invoked inside `requestAnimationFrame` when `anyMoved === true` and `now - lastRender.current >= RENDER_INTERVAL` (100ms).
     - When FGC trains were stationary, dwelling, or absent, or during the delay, `displayed` kept returning the previous train list containing all Rodalies trains.
  2. *Appearance of "Floating" on the Map:*
     - When switching network mode to `fgc`, `visibleRoutes` and `visibleStops` immediately filtered out all Rodalies routes and stations.
     - Because `displayed` still held the Rodalies trains, train `#15014 R15` remained rendered on the map.
     - Because R15 travels along the southern corridor (Tarragona, Vila-seca, Reus, Riba-roja d'Ebre) where no FGC tracks or stations exist, the train appeared to float in an empty void without tracks beneath it.
  3. *Stale closure in `setNetworkMode` (`src/components/App.tsx`):*
     - `setNetworkMode` captured `selectedTrain` and `selectedStop` directly in its closure. If called from child components or when the memoized reference lagged, `setSelectedTrain(null)` could fail to clear the active train.
- **Implemented Fixes:**
  - **Immediate `displayed` Synchronization in `useInterpolatedTrains`:**
    - Updated `useEffect([apiTrains, routes, stops])` to immediately call `setDisplayed(apiTrains.map(...))` on the exact same frame `apiTrains` changes.
    - Trains removed by network mode or line filters disappear instantly from the map and list without waiting for a rAF motion tick.
  - **Functional State Updaters & Filter Reset in `setNetworkMode`:**
    - Updated `setNetworkMode` in `App.tsx` to use functional state updaters:
      - `setSelectedTrain(curr => curr?.operator === 'renfe' ? null : curr)`
      - `setSelectedStop(curr => curr?.operator === 'renfe' || (curr && /^\d+$/.test(curr.stopId)) ? null : curr)`
    - Added `setActiveLines(new Set(['ALL']))` on network switch to clear orphaned line filter selections.
  - **GPS Bounds & Telemetry Validation (`src/lib/renfe.ts`):**
    - Added strict boundary checks to `loadRenfeTrains()` ensuring latitude `[40.0, 43.5]` and longitude `[0.0, 4.0]` to discard invalid coordinates from upstream GPS glitches.
- **Verification:**
  - Unit/Infra tests: `scripts/test-infra.mts` passed (30/30 checks).
  - Renfe integration: `scripts/test-renfe.mts` passed.
  - TypeScript: `npx tsc --noEmit` passed with 0 errors.
  - Production build: `next build` succeeded with all static and dynamic routes generated.

### Session: 2026-10-03 (Mobile Top Bar Network Switch Curvature Harmonization)
- **Visual Harmonization:**
  - In `src/components/Header.tsx`, updated `<NetworkSwitch />` when `compact` is active:
    - Set switch container `borderRadius: compact ? 16 : 8` (concentric with the outer container's `borderRadius: 20` and 3px padding).
    - Set option buttons `borderRadius: compact ? 13 : 6` (concentric with the switch's 16px radius and 2px padding).
  - Eliminates the visual disharmony between the outer capsule and the inner switch, ensuring identical curvature across the top bar.
- **Verification:**
  - `cmd /c npm test`: 30/30 checks passed.
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm run build`: build succeeded.

### Session: 2026-10-03 (Branch Unification & PWA/Sheet Ceiling Merges)
- **Branch Merges & Resolution:**
  - Merged `origin/claude/andana-distribution-strategy-1rl1mi`:
    - Updated `next.config.ts`: Changed `Permissions-Policy` from `geolocation=()` to `geolocation=(self)` to prevent browser blocking user geolocation requests.
    - Updated `src/components/ServiceWorkerRegister.tsx`: Handles hydration occurring after the `window.load` event via `document.readyState === 'complete'`.
  - Merged and harmonized `origin/claude/mobile-menu-scroll-knob-stuck-tzb9wr`:
    - Resolved conflict in `src/components/MobileLayout.tsx` by integrating `useSheetCeiling` and `topBarRef` into the unified one-sheet architecture (preventing sheet grab handle from slipping underneath floating top bar pills at full screen expansion on notched mobile devices).
    - Preserved `MobileSettingsModal` and `AlertModal` while removing obsolete `DetailSheet` structures.
- **Verification:**
  - `cmd /c npm test`: 30/30 checks passed.
  - `cmd /c npx tsc --noEmit`: 0 errors across entire repository.
  - `cmd /c npm run build`: Next.js Turbopack production build succeeded cleanly.

### Session: 2026-10-03 (AI/LLM Discovery, SEO Schema.org, & README Overhaul)
- **AI & Modern SEO Optimization:**
  - Added `public/llms.txt` following the [llmstxt.org](https://llmstxt.org) standard: concise, high-density summary of capabilities, covered FGC/Rodalies lines, architecture, and common FAQs for AI search engines (Perplexity, ChatGPT Search, Gemini).
  - Added `src/app/robots.ts` with Next.js App Router metadata route.
  - Updated `src/app/layout.tsx`:
    - Updated `<title>` and `<meta name="description">` to accurately reflect multi-network coverage (FGC + Rodalies de Catalunya).
    - Added OpenGraph and Twitter card metadata.
    - Injected Schema.org `WebApplication` structured data (`JSON-LD`) for authoritative search engine & AI extraction.
- **Documentation:**
  - Completely updated `README.md` to reflect the current state of the application: dual-network intelligence, 60fps interpolation, CSA timetable routing, departures board with delay countdowns, corridor service alerts, and installable PWA.
### Session: 2026-10-04 (Favorite Stations, Departures Line Filtering & PWA Installation)
- **Favorite Stations Subsystem (`src/lib/savedStations.ts`):**
  - Created `useFavoriteStations()` hook persisting favorite stations in `localStorage` (`andana-fav-stations`, fallback to `geotren-fav-stations`).
  - Added cross-component and cross-tab reactive synchronization via `andana:fav-stations-change` window events.
  - Added star toggle buttons (`⭐` / `☆`) to `StopPanel.tsx` (next to station title), desktop `Sidebar.tsx` station directory, and mobile `MobileLayout.tsx` search results and major hubs.
  - Dedicated "⭐️ Estacions preferides" section rendered at the top of station directory in both `Sidebar.tsx` and `MobileLayout.tsx` when query is empty.
- **Departures Board Line Filtering (`src/components/DeparturesBoard.tsx`):**
  - Added dynamic line filter pill chips (`[Totes]`, `[Line 1]`, `[Line 2]`, ...) at the top of the departures board.
  - Automatically derived from current departures; tapping a line filters departures to only that line, enabling commuters at busy interchange hubs (Sants, Catalunya, Sarrià, etc.) to immediately isolate their upcoming train.
- **PWA Experience & Direct Installation:**
  - Updated `src/app/manifest.ts` metadata to reflect dual-network coverage (FGC & Rodalies de Catalunya).
  - Added dedicated PWA installation card in `src/components/MobileSettingsModal.tsx` with:
    - Native step-by-step guidance for iOS Safari (Share ⬆ -> "Afegeix a la pantalla d'inici") and Android Chrome (Menu ⋮ -> "Instal·la l'aplicació").
    - Standalone mode detection (`isStandalone`).
    - Direct 1-tap `beforeinstallprompt` installation button ("Instal·lar ara") when supported by browser.
- **Localization:**
  - Added trilingual entries (`favoriteStations`, `addFavorite`, `removeFavorite`, `noFavoritesYet`, `filterDepartures`, `allLines`, `installApp`, `installAppDesc`, `installInstructionsIos`, `installInstructionsAndroid`, `installButton`) in Catalan, Spanish, and English in `src/lib/i18n.tsx`.
- **Verification:**
  - `cmd /c npm test`: 30/30 checks passed.
  - `cmd /c node --experimental-strip-types --no-warnings scripts/test-renfe.mts`: passed.
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm run build`: Next.js Turbopack production build succeeded cleanly.

### Session: 2026-10-04 (Rodalies Real-Time Service Alerts & Network Mode Filtering Parity)
- **Official Rodalies Incidents RSS Integration (`src/lib/renfe.ts`):**
  - Integrated official Generalitat de Catalunya Rodalies live incident feed (`https://www.gencat.cat/rodalies/incidencies_rodalies_rss_ca_ES.xml`).
  - Added `loadRenfeAlerts()` and cached fetcher `fetchRenfeAlerts()` with 60-second TTL.
  - Cleanly parses XML without external heavyweight libraries:
    - Extracts affected Rodalies lines (e.g. `R1`, `R3`, `R4`, `RL4`, `R2N`, `R2S`).
    - Solves upstream 140-char title truncation by extracting untruncated first sentence from `<description>`.
    - Parses publication timestamp (`<pubDate>`).
    - Cross-references station database to detect and tag affected station names (e.g. Lleida-Pirineus, Manresa, etc.).
    - Generates plain-language explanations for common disruptions (alternative bus/road transport, Inuncat/weather warnings, service normalization).
  - Updated `scripts/test-renfe.mts` to validate Rodalies alert fetching and parsing.
- **Unified Alerts API (`src/app/api/alerts/route.ts`):**
  - Updated `/api/alerts` to query both `fetchAlerts()` (FGC) and `fetchRenfeAlerts()` (Rodalies) concurrently using `Promise.allSettled`.
- **Network Mode Filtering Parity (`App.tsx` & `MobileLayout.tsx`):**
  - Wired `visibleAlerts` filtered by active `networkMode`:
    - In `fgc` mode: only FGC corridor alerts.
    - In `renfe` mode: only Rodalies de Catalunya alerts.
    - In `both` mode: all alerts merged across both operators.
  - In `AlertBanner` (desktop) and `MobileAlertBanner` (mobile):
    - Added operator badge (`[RODALIES]` vs `[FGC]`) when `networkMode === 'both'` in both the ticker capsule and expanded dropdown items.
- **Operator-Aware Context in `AlertModal.tsx`:**
  - Updated official real-time verification channels in `<AlertModal />` to display relevant links based on the alert operator (Rodalies alteracions web + `@rodalies` Twitter when `operator === 'renfe'`; FGC avisos web + `@FGC` Twitter when `operator === 'fgc'`).
- **Verification:**
  - `cmd /c npm test`: 30/30 checks passed.
  - `cmd /c node --experimental-strip-types --no-warnings scripts/test-renfe.mts`: all Renfe client and alerts checks passed.
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm run build`: Next.js Turbopack production build succeeded cleanly.

### Session: 2026-10-04 (Zero-Fake Departures: Live Line Suspension & Canceled Trip Protection + Alert Persistence)
- **Problem Diagnosed (Rubí Centre S1 Phantom Countdown & Disappearing Alerts):**
  - During weather disruptions (e.g. Inuncat emergency shutdown of Barcelona-Vallès lines S1, S2, L6, L7), the station departures board (`DeparturesBoard.tsx`) previously relied on static GTFS timetable scanning (`viajes-de-hoy` / `stop_times.txt`) with live delay offsetting. When all trains were halted by civil protection, it still displayed countdowns ("S1 8 min", "S1 18 min", etc.) because it never cross-checked whether trains were actually circulating.
  - Furthermore, FGC's open data feed (`alerts-gtfs_realtime`) periodically drops network-wide alerts prematurely when operational shifts swap bulletins for local bus notes or when `activePeriod.end` expires prematurely.
- **Departures Board Live Line Suspension & Cancellation Checks (`src/app/api/departures/route.ts`):**
  - Updated `/api/departures`:
    - Evaluates live circulating trains from `fetchTrains()`.
    - **False-alarm prevention guards:**
      - Only evaluates suspension during daytime operating hours (`06:30` to `23:30`), preventing night closures from being flagged as disruptions.
      - Imminent lookahead window: only evaluates departures within `35 minutes`. If a train departs in 1–2 hours, it is left on normal schedule since the train simply hasn't left the depot yet.
      - Restricted to high-frequency trunk lines (`S1`, `S2`, `L6`, `L7`) where multiple trains circulate constantly. Low-frequency or branched lines (e.g. `R8`, `S4`, `R5`, `R6`) are NEVER falsely flagged as suspended during routine service intervals.
      - Network sanity check: requires the overall FGC network to be actively reporting fleet (`fgcLiveTrains.length >= 6`) to distinguish genuine line halts from total feed outages.
    - Cross-references GTFS-RT `trip-updates` entities reporting `scheduleRelationship: 3` (CANCELED) and flags departures as `isCancelled: true`.
- **Truthful Departures UI (`src/components/DeparturesBoard.tsx`):**
  - Added `isSuspended?: boolean` and `isCancelled?: boolean` to `Departure` interface in `src/types/index.ts`.
  - In `DeparturesBoard.tsx`:
    - When any upcoming departure for a station is suspended, renders a prominent warning banner: `⚠️ Sense trens en circulació en aquesta línia en aquests moments`.
    - For individual suspended or cancelled departures, replaces the countdown time with a bold red status chip (`SUSPÈS` / `CANCEL·LAT`) and strikes through the destination. Never renders a fake countdown.
- **Alert Persistence Registry (`src/lib/gtfs.ts`):**
  - Added an in-memory persistent alert registry (`persistentAlerts`) in `fetchAlerts()`.
  - Preserves legitimate alerts until their specified `activePeriod.end` timestamp expires (with a 1-hour grace period if unspecified), preventing valid emergency notices from vanishing when FGC's momentary feed is cleared.
- **Localization:**
  - Added `suspended`, `cancelled`, and `serviceSuspendedNotice` across Catalan, Spanish, and English in `src/lib/i18n.tsx`.
- **Git Push Policy Respected:**
  - All changes tested and verified locally. No `git push` executed.
- **Verification:**
  - `cmd /c npm test`: 30/30 checks passed.
  - `cmd /c node --experimental-strip-types --no-warnings scripts/test-renfe.mts`: passed.
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm run build`: Next.js Turbopack production build succeeded cleanly.

### Session: 2026-10-04 (Car Composition Alert Normalization & Short-Platform Explanation)
- **Problem Diagnosed ("Els tres primers cotxe." Alert at Pl. Espanya):**
  - FGC open data published a cryptic, truncated alert with header `"Els tres primers cotxe."` for Pl. Espanya tied to trip `7e2dc0e207` (13:09 R6 to Igualada).
  - In FGC's raw GTFS-RT protobuf, the string was literally cut off at `cotxe.` without a description, caused by character limits or manual operator cut-off in FGC's platform dispatch console.
  - In `src/lib/gtfs.ts`, the matching condition was missing the plural/singular variant `primers cotxe`, leaving explanation empty and route unassigned.
- **Fix & Clarification Engine (`src/lib/gtfs.ts`):**
  - Updated matching keyword detection to `lower.includes('primer') && lower.includes('cotxe')`.
  - Automatically heals the truncated title from `"Els tres primers cotxe."` to `"Els tres primers cotxes."`.
  - Automatically associates affected lines (`R5`, `R6`) when missing in the GTFS-RT feed.
  - Generates clear, plain-language explanation: *"Embarcament als tres primers cotxes: en combois de doble composició a la línia Llobregat-Anoia, cal viatjar als cotxes davanters perquè algunes estacions del trajecte tenen andanes curtes on els cotxes posteriors no obren portes o la segona unitat no admet passatge."*
- **Verification:**
  - Tested `/api/alerts` endpoint directly; confirmed alert returns healed title and rich explanation.
  - `cmd /c npm test`: 30/30 checks passed.
  - No `git push` performed.

### Session: 2026-10-04 (Eliminating Triplicated Rodalies Alert Text in AlertModal)
- **Problem Diagnosed (Triplicate Alert Content in Rodalies RSS):**
  - In Gencat's Rodalies RSS (`incidencies_rodalies_rss_ca_ES.xml`), every item's `<description>` literally begins by re-quoting the `<title>`.
  - When parsed into `header` (first sentence) and `description` (full description), `AlertModal.tsx` rendered the header, then rendered the description (repeating the header), and furthermore fell back to `alert.description` when `alert.explanation` was undefined under *"Què vol dir aquest avís?"*, resulting in the user reading the same sentence three times in a row.
- **Fix & Deduplication Architecture:**
  - **In `src/lib/renfe.ts`:** Strip leading `header` or first sentence from `desc` so that `description` contains strictly the additional body content or instructions. If the alert is a single sentence, `description` becomes `undefined` rather than a duplicate echo.
  - **In `src/lib/gtfs.ts`:** Prevented `explanation` from initializing as `g.description`.
  - **In `src/components/AlertModal.tsx`:** Removed the fallback `explanation = ... || alert.description`. Only render the *"Què vol dir aquest avís?"* section when `explanation` exists and is distinct from both `description` and `header`.
- **Verification:**
  - Tested live Rodalies R7 and RL3 alerts; verified title displays headline, subtitle displays remaining instruction without repetition, and no redundant explanation card appears.
  - `cmd /c npm test`: 30/30 checks passed.
  - `node --experimental-strip-types --no-warnings scripts/test-renfe.mts`: passed.
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - No `git push` performed.

### Session: 2026-10-04 (Alert Banner 10s Full Rotation, Count Indicator & Compact Dropdown with Enhanced Mobile Affordance)
- **10-Second Rotation Across All Active Alerts:**
  - Removed the arbitrary `PREVIEW_COUNT = 5` slice cap from both `App.tsx` (desktop) and `MobileLayout.tsx` (mobile).
  - Configured `ROTATION_MS = 10_000` (10 seconds per rotation) to cycle smoothly across all active alerts (`alerts.length`).
  - Updated counter badge to show real current position over total active count: `${(idx % count) + 1}/${count}` (e.g. `1/9`, `2/9`, etc.).
- **Ultra-Compact Expanded Dropdown Rows:**
  - Eliminated the bulky multi-line `explanation` and `stops` listings that caused the expanded list to take over the screen.
  - Each item in the expanded dropdown now renders as a sleek, single-line/compact row (~32px):
    - Left/Center: Operator badge (`[Rodalies]` / `[FGC]` in `both` mode) + Route tag + Headline Title (with clean ellipsis) + Compact Timestamp (`🕒 HH:MM`).
    - Far Right: Dedicated, styled `+ info ↗` button.
    - Clicking anywhere on the row or button launches the full detail modal (`AlertModal`).
- **Mobile Affordance & Touch Intuition Overhaul (`MobileLayout.tsx`):**
  - Added a distinct, clearly tappable `+ info ↗` button directly into the mobile ticker pill with subtle contrasted border and background (`rgba(0,0,0,0.18)`), making clickability instantly obvious without relying on desktop `:hover`.
  - Tapping the banner text or the `+ info` button directly opens `<AlertModal />` for the current alert.
  - Tapping the counter pill `[1/9 ▾]` toggles the compact dropdown list of all active alerts.
- **Verification:**
  - `cmd /c npm test`: 30/30 checks passed.
  - `node --experimental-strip-types --no-warnings scripts/test-renfe.mts`: passed.
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - No `git push` performed.

### Session: 2026-10-04 (Universal Multi-Modal Journey Planner: FGC + Rodalies Integration)
- **Goal:**
  - Unify the "Anar a…" (Trip Planner) tab so users can plan journeys across both FGC and Rodalies networks seamlessly, including real inter-operator walking transfers (footpaths) at key transit hubs in Catalonia.
- **Architectural Implementation:**
  1. **Timetable Data Layer (`src/data/rodalies-timetable.json` & `src/lib/renfeTimetable.ts`):**
     - Sourced and parsed official Renfe Cercanías GTFS (`fomento_transit.zip`, nucleus 51 / Catalonia).
     - Compressed all 210 stations and ~1,480 daily trips into an optimized timetable JSON (weekday, Saturday, and Sunday service patterns).
     - Built `loadRodaliesTimetable(baseTripId, date)` which resolves service calendar and exports `Trip[]`, `Connection[]`, `stationNames`, and `stationLines`.
  2. **Interchange Footpaths Engine (`src/lib/footpaths.ts`):**
     - Mapped exact physical pedestrian links between FGC parent codes and Rodalies 5-digit stop IDs:
       - Pl. Catalunya: `PC` ↔ `71801` (4 min / 240s underground passage).
       - Terrassa Estació del Nord: `EN` ↔ `72207` (1.5 min / 90s unified station hub).
       - Sabadell Nord: `NO` ↔ `72205` (1.5 min / 90s unified station hub).
       - Martorell Central: `MC` ↔ `72304` (2 min / 120s multimodal forecourt).
       - Gornal / Bellvitge: `GO` ↔ `72401` (2 min / 120s pedestrian walkway).
       - Provença / Passeig de Gràcia: `PR` ↔ `71802` (6 min / 360s urban connection).
       - Av. Carrilet / L'Hospitalet: `LH` ↔ `71701` (5 min / 300s Rambla Marina link).
  3. **CSA Planner Unification (`src/lib/planner.ts`):**
     - In `assembleTimetable()`: dynamically merges FGC trips with Rodalies trips into a unified connection timeline, indexed by `tripConns` and sorted by `depTime`. Populates `stationLines` and `stationOperators`.
     - In `planJourney()`:
       - Initial relaxation: checks and relaxes direct footpaths from origin stop.
       - Connection scan: relaxes adjacent footpaths upon connection arrival at `c.toParent`.
       - Boarding buffer: set to 0 when boarding after a walking transfer (as walking duration already includes platform access) or at origin; 120s for train-to-train transfers.
       - Backward reconstruction: supports `WalkStep` along with train connections.
       - Just-in-time walk departure: aligns initial walk leg's departure time so passengers don't wait unnecessarily on the platform.
       - Transfers calculation: correctly counts train boardings (`Math.max(0, trainLegs.length - 1)`).
     - In `getStations()`: returns all ~260 stations across both networks with operator tag and serving lines.
     - In `getAccessibleStations()`: loads wheelchair accessibility flags from both FGC and Renfe station feeds.
  4. **Map Path Visualization (`src/lib/journeyPath.ts` & `src/lib/constants.ts`):**
     - Updated `findCoord()` to support exact stop IDs (preventing numeric Rodalies codes from being stripped).
     - Added official line colors for all Rodalies lines (R1–R4, R7, R8, R11–R17, RG1, RT1, RT2) and `WALK` (`#f59e0b`) in `LINE_COLORS`.
     - Clipped route geometry for both FGC and Renfe lines, with straight chord connections for walk legs.
  5. **UI & Mobile Experience (`src/components/TripPlanner.tsx` & `src/lib/i18n.tsx`):**
     - Station autocomplete dropdown now shows distinct `[FGC]` and `[Rodalies]` operator chips and serving lines preview `(S1, S2...)` / `(R1, R4...)`.
     - Journey leg chain displays `🚶 X min` (with footpath tooltip) for walking legs, and line pills with Rodalies tags for commuter trains.
     - `locateOrigin` GPS button supports numeric Rodalies stop IDs.
     - Added `walkingTransfer` i18n key in Catalan, Spanish, and English.
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 checks passed.
  - Next.js production build (`next build`) verified clean (Turbopack, App Router, SSR, static page collection).
  - STRICT ADHERENCE: No `git push` executed.





