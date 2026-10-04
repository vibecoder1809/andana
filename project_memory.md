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

## 5.1. Pending External Integrations & Loose Ends (Action Required Before Production)

All external integrations and loose-end handles are centralized in [`src/lib/externalLinks.ts`](src/lib/externalLinks.ts). Before publishing or launching Andana to the public, the owner must update these items with real accounts:

1. **Donation / Coffee Link (`EXTERNAL_HOOKS.donationUrl`):**
   - **Current placeholder:** `'https://ko-fi.com'`
   - **Location:** [`src/lib/externalLinks.ts`](src/lib/externalLinks.ts) (consumed by `DonationModal.tsx` and `Header.tsx`).
   - **Action needed:** Set to the real project/creator Ko-fi, Buy Me a Coffee, or Stripe page URL (e.g. `https://ko-fi.com/andana`).

2. **Bug Reports & Feature Requests (`EXTERNAL_HOOKS.feedbackEmail` & `feedbackWebhookUrl`):**
   - **Current placeholder:** `'feedback@andana.cat'` (and empty webhook).
   - **Location:** [`src/lib/externalLinks.ts`](src/lib/externalLinks.ts) (consumed by `FeedbackModal.tsx` inside `MobileSettingsModal.tsx`).
   - **Action needed:**
     - Replace `'feedback@andana.cat'` with the real inbox where support messages should be delivered.
     - *(Optional)* If real-time automated ingestion is desired, connect a webhook endpoint (Discord webhook, Formspree, Telegram, or Next.js `/api/feedback` route) to `feedbackWebhookUrl`.

3. **Source Repository & GitHub Issues (`EXTERNAL_HOOKS.githubIssuesUrl`):**
   - **Current placeholder:** `'https://github.com'`
   - **Action needed:** Set to the real GitHub repository issues page.

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
### Session: 2026-10-04 (Implementation of Features 1–6: ATM Fares, Timeline, Network Status, Line Focus, Metro/Tram Badges, Live HUD)
- **Features Implemented:**
  1. 🎫 **Zones tarifàries ATM i càlcul de preu (`src/lib/fares.ts`):**
     - Mapped all FGC and Rodalies Catalunya stations (parent codes and 5-digit station IDs) into official ATM Barcelona tariff crowns (Zones 1 to 6).
     - Built `computeJourneyFare(journey)` using official 2026 ATM prices (Bitllet Senzill, T-casual, T-usual). Integrated dynamic fare cards inside planned journeys in `TripPlanner.tsx`.
  2. 📋 **Detall desplegable del viatge (`src/components/TripPlanner.tsx`, `src/lib/planner.ts`):**
     - Extended CSA planner engine to record intermediate passing stations and scheduled arrival times per leg (`JourneyLegStop[]`).
     - Added an interactive "Detall de parades" accordion to `JourneyCard` with a vertical timeline, passing times, zone tags, and Metro/Tram connection chips for every stop.
  3. 🚦 **Estat de la xarxa d'un cop d'ull (`src/components/NetworkStatusModal.tsx`):**
     - Created a comprehensive real-time network health modal grouped by corridor (FGC Barcelona-Vallès, FGC Llobregat-Anoia, Rodalies de Catalunya, Regionals).
     - Aggregates active trains, line alerts, and health badges (Servei habitual / Afectacions / Incidència). Clicking any line triggers map focus.
     - Wired into desktop header (`Header.tsx`) and mobile floating bar (`MobileLayout.tsx`) with live alert count pill.
  4. 🔍 **Filtre de línia al mapa (`src/components/MapView.tsx`):**
     - Implemented `focusedLine` mode in MapLibre GL layer expressions: highlights geometry and trains of the selected line while dimming background routes and other trains.
     - Added a floating glassmorphic cancel pill with the line's official color to clear the filter.
  5. 🚇 **Enllaços amb Metro TMB i Tram (`src/lib/metroInterchanges.ts`):**
     - Mapped interchange stations to TMB Metro (L1–L11, FM) and Trambaix/Trambesòs (T1–T6) with official line badge styling and contrast text colors.
     - Displayed in station autocomplete, `StopPanel`, and the journey timeline.
  6. 🧭 **Mode «En ruta» (`src/components/LiveTripHud.tsx`):**
     - Created a live GPS/transit HUD activated from any journey card via "Seguir ruta".
     - Displays live progress bar, active leg indicator, next upcoming stop countdown, and step-by-step milestones.
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 infra checks passed.
  - `cmd /c npx next build`: Successful production Turbopack build (all 14 static and dynamic routes compiled cleanly).
  - STRICT ADHERENCE: Changes kept local; no `git push` performed.

### Session: 2026-10-04 (Client-Side User Engagement: Onboarding Tutorial & Delayed Donation Prompt)
- **Features Implemented:**
  1. 🛠️ **Engagement State Machine (`src/lib/userEngagement.ts`):**
     - Fully client-side using `localStorage` keys: `andana-tutorial-completed`, `andana-first-seen`, `andana-donation-snoozed-until`.
     - Automatically records `first-seen` on first launch.
     - Controls non-overlapping presentation (tutorial first; donation prompt only triggers if user has completed tutorial and after $\ge 48$ hours of first use).
     - Provides configurable snoozing (14 days default, 90 days on support, 10 years on "Don't show again").
  2. 📖 **First-Run Onboarding & Interactive Spotlight Tour (`src/components/OnboardingModal.tsx`):**
     - **Initial Pop-up:** Asks *"És la primera vegada que fas servir Andana?"* with *"✨ Sí, ensenya-m’ho"* vs *"No, ja me’n sé sortir"*.
     - **Interactive Spotlight Tour:** If requested, dims the screen with a spotlight cutout and directional pointer arrow focusing sequentially on:
       1. Commutador de Xarxa (`[data-tour="network-switch"]`).
       2. Pestanyes de Navegació (`[data-tour="tabs"]`).
       3. Estat de la Xarxa (`[data-tour="network-status"]`).
       4. A prop meu / GPS (`[data-tour="near-me"]`).
     - Dynamic viewport positioning (clamped coordinates, adaptive arrow orientation, resize/scroll listeners).
     - Once dismissed or finished, marks `andana-tutorial-completed` in `localStorage` and never reappears automatically.
  3. ☕ **Delayed Support/Donation Prompt (`src/components/DonationModal.tsx`):**
     - Polite, respectful modal prompting after 2 days of usage.
     - Options: "Convidar a un cafè ☕" (opens support link and snoozes for 90 days), "Recorda-m'ho més endavant" (snoozes 14 days), "No tornis a mostrar" (snoozes permanently).
  4. 📱 **Full Dual-Root & Settings Integration:**
     - Wired into desktop (`App.tsx`, `Header.tsx`) and mobile (`MobileLayout.tsx`, `MobileSettingsModal.tsx`).
     - Users can re-open the tutorial or support modal at any time from mobile settings or the desktop header.
  5. 🌐 **Trilingual Strings:**
     - All user-facing text translated in Catalan (`ca`), Spanish (`es`), and English (`en`) in `src/lib/i18n.tsx`.
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 checks passed.
  - `cmd /c npx next build`: 14/14 static & dynamic routes compiled successfully with Turbopack.
  - STRICT ADHERENCE: Local repository only; no `git push` executed.

### Session: 2026-10-05 (Mobile UI De-Cluttering, 2-Row Alerts, Floating NearMe & Desktop Settings Streamlining)
- **Mobile De-Cluttering & Spacious Top Bar (`MobileLayout.tsx`):**
  - Removed `NearMeButton` from the crowded mobile top bar. Top bar now comfortably accommodates Brand/NetworkSwitch on the left and only 3 utility buttons (`🚦`, `↻`, `⚙️`) on the right with zero overlap.
  - Repositioned `NearMeButton` to float above the bottom sheet on the map at the bottom right (`bottom: calc(${sheetHeight} + 12px)`). It smoothly fades out and disables pointer events when the sheet is swiped up past peek (`sheetRatio > 0.32`).
- **Full-Width Legible Mobile Alert Banner (`MobileAlertBanner`):**
  - Refactored the single-line squeezed banner into a clean 2-row card:
    - Row 1: `⚠` badge, operator chip (`Rodalies` / `FGC`), compact timestamp, `+ info ↗` button, and `1/N ▼` count.
    - Row 2: Full-width alert headline text (up to 2 lines, `lineClamp: 2`, `wordBreak: break-word`), ensuring complete readability on 360–390px screens.
- **Onboarding Language Switcher (`OnboardingModal.tsx`):**
  - Added quick `CA | ES | EN` language selector pills to the top-right of the initial welcome prompt dialog so users can switch languages before starting the guided tour.
- **Desktop Header Streamlining (`Header.tsx`, `App.tsx`):**
  - Removed the eternal `📖` tutorial button from the desktop header.
  - Added a clean `⚙️` settings button in desktop `Header.tsx` wired to `MobileSettingsModal` (now fully responsive as a centered modal on $\ge 640px$ screens). Both tutorial and donation options are cleanly accessible through settings.
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 checks passed.
  - `cmd /c npx next build`: 14/14 routes compiled cleanly in 3.8s.
  - Local repository only; no `git push` executed.

### Session: 2026-10-05 (PC Header Button Modernization & Alert Panel Emoji Clean-up)
- **PC Header Button Restyling (`Header.tsx`, `App.tsx`):**
  - Revamped the plain, borders-only desktop header buttons (`LanguagePicker`, Theme toggle, Refresh, Settings, Support) into modern glassmorphic capsules matching the rest of the application.
  - **LanguagePicker:** Capsule button with inline SVG globe icon (`🌐`), bold active language label with no awkward newline wrapping, rotating SVG chevron, and a backdrop-blur dropdown with checkmark indicators.
  - **Theme Toggle:** Added dynamic inline SVG icons (`☀️` sun when light, `🌙` moon when dark) alongside the `{t('theme')}` label, styled with `var(--bg3)`, subtle border, and hover elevation.
  - **Refresh Button:** Added rotating SVG arrow icon with active CSS spin animation during re-fetching, clear loading state feedback, and responsive hover transitions.
  - **Settings Gear (`⚙️`):** Positioned at the far right of the desktop header, standardizing navigation and settings access.
  - Unified heights (34px), border-radius (10px), and subtle box-shadows across all desktop header action pills.
- **Alerts Panel Emoji Clean-up (`i18n.tsx`, `App.tsx`, `MobileLayout.tsx`, `AlertModal.tsx`):**
  - Removed duplicate `ℹ️` from `{t('viewMoreInfo')}` across all three languages (`ca: 'Més informació'`, `es: 'Más información'`, `en: 'More info'`).
  - Removed redundant leading `ℹ️ ` from the alert item button in `App.tsx` (eliminating the double `ℹ️` issue completely).
  - Removed `🕒 ` clock emojis from `AlertBanner` in `App.tsx` and `MobileLayout.tsx`, replacing them with clean typography and badges.
  - Replaced emojis in `AlertModal.tsx` publication/validity sections with crisp, theme-aware inline SVG clock and calendar icons.
- **Alert Banner Accordion & Explicit Expansion (Option 1 Implementation):**
  - **Natural Accordion Model:** Tapping/clicking anywhere on the alert banner bar now smoothly toggles the expanded list of all alerts when multiple disruptions are active (`count > 1`). When only 1 alert exists, it opens that alert's modal directly.
  - **Direct Details Action:** Retained the dedicated `+ info ↗` / `Més informació` button to open the previewed alert's detail modal immediately without expanding the drawer.
  - **Explicit Expansion Pills:** Replaced the cryptic `1/N ▼` counter button with explicit, localized toggle buttons:
    - Desktop: `Veure tots (N) ▼` / `Plega ▲` (`viewAllAlerts` / `collapseAlerts`).
    - Mobile: `Tots (N) ▼` / `Plega ▲` (`viewAlertsList` / `collapseAlerts`), fitting comfortably on compact screens alongside `+ info ↗`.
  - Added trilingual translations (`ca`, `es`, `en`) for all new alert drawer control strings.
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 unit tests passed.
  - STRICT ADHERENCE: Local repository only; no `git push` executed.

### Session: 2026-10-05 (Light Theme Legibility Overhaul, Bug Reports & External Hooks Centralization)
- **Light Theme Legibility & High-Contrast Overhaul (`globals.css`, `TrainCard.tsx`):**
  - **High-contrast semantic status tokens:** Defined dedicated, WCAG AA compliant colors for `[data-theme="light"]`:
    - `--green: #15803d` (deep emerald, replacing neon `#22c55e` for 5:1 contrast).
    - `--yellow: #b45309` (rich warm amber, replacing blinding `#eab308` for 5:1 contrast).
    - `--red: #dc2626` (crisp crimson, replacing pale coral `#ef4444`).
  - **Crisp typography & defined boundaries:**
    - Darkened primary text `--text` to `#0f172a` (Slate 900) for sharp readability.
    - Darkened muted text `--muted` to `#475569` (Slate 600) so secondary timestamps, tracks, and station subtitles stay crisp even with opacity.
    - Strengthened borders (`--border: rgba(15, 23, 42, 0.09)`, `--border2: rgba(15, 23, 42, 0.16)`) and distinct background surfaces (`--bg: #f0f3f8`, `--bg3: #e4e9f2`).
  - **Preserved Dark Mode 100% Intact:** All original `:root` dark-mode tokens and exact pastel shades (`#4ade80`, `#fbbf24`, `#f87171`) were mapped directly to `--status-*` variables in `:root` so dark mode has zero visual changes.
  - **Fixed TrainCard status contrast in Light Mode:** Used dynamic `--status-*` tokens in `TrainCard.tsx` so dark mode stays soft and familiar while light mode automatically gains sharp, deep, readable status colors.
- **Bug Reports & Feature Requests (`FeedbackModal.tsx`, `MobileSettingsModal.tsx`):**
  - Added dedicated `FeedbackModal` accessible from Settings on both desktop and mobile.
  - Supports Bug Report (`🐛`), Feature Request (`💡`), and General Feedback (`❓`).
  - Includes message input, optional reply email, device diagnostic collector, "Enviar per correu" (`mailto:`), and "Copiar informe" clipboard fallback.
- **Centralized Integration Hooks & Loose Ends (`src/lib/externalLinks.ts`, `Section 5.1`):**
  - Created `src/lib/externalLinks.ts` centralizing all placeholder accounts and endpoints (`donationUrl`, `feedbackEmail`, `feedbackWebhookUrl`, `githubIssuesUrl`).
  - Documented requirements in `project_memory.md` under Section 5.1 so future contributors and the owner know what needs to be configured before production launch.
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 unit tests passed.
  - STRICT ADHERENCE: Local repository only; no `git push` executed.

### Session: 2026-10-05 (Sharing Infrastructure & StopPanel 3-Circle Header Alignment)
- **StopPanel Header & Button Overlap Fix (`StopPanel.tsx`):**
  - Resolved ugly collision/overlap between the absolute positioned close button (`✕`) and the favorite button (`⭐`/`☆`) next to the station title.
  - Implemented unified, top-right flex row of **3 circular buttons** matching the close button format (`28px` diameter, `borderRadius: '50%'`, `var(--bg3)`, border, hover transitions):
    1. **Compartir / Share (`📤` / SVG arrow):** Triggers `navigator.share` (if available on mobile/supported desktop) or copies direct link `?stop=<stopId>` to clipboard with temporary `✓` / `Enllaç copiat!` feedback.
    2. **Estrella / Favorite (`⭐` / `☆` / SVG star):** Toggles favorite station in `useFavoriteStations` with sleek gold fill when active.
    3. **Creu / Close (`✕`):** Neatly closes the station drawer (`onClose()`), rendered on desktop and where close action is enabled.
- **Universal Deep-Link Sharing Across the App:**
  - **Train Deep-Link Sharing (`DetailPanel.tsx`):** Added a matching circular share button in the top-right of `DetailPanel`, sharing `?train=<trainId>`.
  - **Planned Route Sharing (`TripPlanner.tsx`):** Added a circular share button in the search divider between origin and destination when a route is selected, sharing `?from=<originCode>&to=<destCode>`.
- **Localization (`i18n.tsx`):**
  - Added trilingual translations (`shareStation`, `shareTrain`, `shareRoute`, `linkCopied`, `close`) in Catalan (`ca`), Spanish (`es`), and English (`en`).
- **Live Trip HUD Wiring Fix (`TripPlanner.tsx`):**
  - Identified that `onStartLiveTrip` was properly passed down through `App.tsx`, `Sidebar.tsx`, and `MobileLayout.tsx`, but was not destructured in `TripPlanner`'s parameters and was not forwarded into `<JourneyCard />`.
  - Destructured `onStartLiveTrip` in `TripPlanner` and passed it down to `JourneyCard`, ensuring the `🧭 En ruta` / `🧭 Track live` button renders reliably on all journey cards.
  - Replaced inline ternaries with centralized `t('trackLive')`, `t('showStops')`, `t('hideStops')` dictionary keys and optimized high-contrast button styling (`color: '#fff'`).
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 unit tests passed.
  - `cmd /c npx next build`: Turbopack production build succeeded.
  - STRICT ADHERENCE: Local repository only; no `git push` executed.

### Session: 2026-10-05 (Station Favorites Bug Fix & Mobile Static Scrolling Space Reduction)
- **Station Favorites Star Bug Fix (`src/lib/savedStations.ts`, `StopPanel.tsx`, `Sidebar.tsx`, `MobileLayout.tsx`):**
  - **Identified Root Causes:**
    1. *Re-entrant sync event dispatch:* Calling `window.dispatchEvent(new Event(SYNC_EVENT))` synchronously inside `setFavorites(prev => { ... write(next) ... })` fired the `SYNC_EVENT` listener immediately in the middle of React's state transition, invoking `setFavorites(read())` re-entrantly.
    2. *Platform ID vs Station ID mismatch:* FGC stations frequently use platform-specific stop IDs (`VD1`, `PC2`, etc.) in live feeds, while station directories use base codes (`VD`, `PC`) or normalized names. The simple equality `f.stopId === stopId` failed to match, leading to desynced star icons and unexpected un-favoriting.
  - **Resolution:**
    - Added `getBaseStationCode()` and `normalizeStationName()` helper logic to `src/lib/savedStations.ts`.
    - Added robust polymorphic matching `matchStation(fav, candidate)` that checks base codes, stop IDs, and normalized station names.
    - Updated `isFavorite()` to accept polymorphic inputs: `Stop`, `SavedStation`, or string ID/name.
    - Deferred `window.dispatchEvent` via `setTimeout(..., 0)` so cross-component synchronization never collides with ongoing React render phases.
    - Updated `StopPanel`, `Sidebar`, and `MobileLayout` to pass station objects directly into `isFavorite(station)`.
- **Mobile Static Scrolling Space Optimization (`MobileLayout.tsx`, `TripPlanner.tsx`):**
  - **Problem:**
    - On mobile in `Trens` and `Anar a…` tabs, the static UI pinned above the scrolling content consumed a disproportionate amount of screen space (often >60% of the half-sheet height), leaving tiny visible viewports for trains and trip results.
    - In `Trens`, the line filter chips and segmented tabs were statically pinned above the sheet content.
    - In `TripPlanner` (`Anar a…`), the form was locked (`flexShrink: 0` in an `overflow: hidden` container) while only the results container had `overflowY: auto`.
  - **Fixes Applied:**
    - **Unified Scroll in `TripPlanner`:** Set `overflowY: 'auto'` on the main container with compact padding (`12px 14px`, gap `9px`), allowing the search form and results to scroll together smoothly. As soon as the user scrolls through results, the search inputs scroll away naturally.
    - **Compacted Sheet Header:** Reduced bottom sheet handle padding (`7px 0 5px`) and segmented tabs control (`margin: '0 10px 6px'`, button `padding: '6px 0'`).
    - **Moved Filter Chips into Scrollable Trains View:** Moved line filter chips from the static sheet wrapper into the top of the scrollable `activeTab === 'trains'` view. When browsing trains, the filters scroll away naturally with the list. Removed the chips from `stations` where they were unnecessary.
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 unit tests passed.
  - `cmd /c npx next build`: Turbopack production build succeeded.
  - STRICT ADHERENCE: Local repository only; no `git push` executed.

### Session: 2026-10-05 (Fix MapView "Cannot add layer before non-existing layer stops-circles")
- **Root Cause:**
  - In `src/components/MapView.tsx`, `<Source id="journey">` and its child layers (`journey-casing`, `journey-line`) had `beforeId="stops-circles"`.
  - In the JSX element tree, `<Source id="journey">` was declared physically before `<Source id="stops">`.
  - When `MapView` mounted with an active journey (e.g. via deep-link parameters, theme switch, or initial render), `react-map-gl` processed `<Source id="journey">` first and called `map.addLayer("journey-casing", "stops-circles")`. Because `stops-circles` was further down in the JSX tree, it had not yet been added to the MapLibre style layer order (`_order`), causing MapLibre to fire:
    `Cannot add layer "journey-casing" before non-existing layer "stops-circles"` and `Cannot add layer "journey-line" before non-existing layer "stops-circles"`.
- **Fix:**
  - Reordered the JSX tree in `MapView.tsx`: placed `<Source id="stops">` (and layers `stops-circles`, `stops-labels`) immediately before `<Source id="journey">`.
  - Now, when `journey-casing` and `journey-line` are mounted with `beforeId="stops-circles"`, `stops-circles` is already registered in the map style layer order, inserting the journey path directly beneath the station circles as intended without any console errors.
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 unit tests passed.
  - `cmd /c npx next build`: Turbopack production build succeeded.
  - STRICT ADHERENCE: Local repository only; no `git push` executed.

### Session: 2026-10-05 (Cremallera de Montserrat M1/M2 Telemetry & Depot Detection Overhaul)
- **Problem:**
  - FGC's public feed keeps M1 and M2 (Cremallera de Montserrat) units published 24/7 even when parked overnight at sidings/depots in Monistrol-Vila, Monistrol d'Enllaç, or Montserrat with `estacionat_a`.
  - M1 and M2 were classified under generic "Altres" (`Other`) rather than their own identity.
  - Due to steep rocky gorges and tunnels (Foradada, Àngel), GPS positioning is often only refreshed at open-air stations, confusing users about why trains appear stationary.
- **Improvements Implemented:**
  1. **Dedicated `⛰️ Cremallera` Line Group:**
     - Added `{ key: 'M-cremallera', labelKey: 'groupCremallera', prefix: /^(M\d?|MM)$/ }` to `Sidebar.tsx` and `MobileLayout.tsx`.
     - Added official mountain green colors for `M1` (`#008542`), `M2` (`#006837`), and `MM` (`#008542`) in `constants.ts`.
     - Line chips show `⛰️ Cremallera` with quick filtering, distinct from generic lines.
  2. **Intelligent Operating Hours & Depot Detection (`src/lib/trains.ts`):**
     - Added `isCremalleraOperatingHours()` checking current local time in Catalonia (commercial tourist hours: 08:20 to 20:15).
     - When outside operating hours, M1/M2 units are automatically tagged with `operationalStatus: 'depot'` and `isDepot: true`.
     - During operating hours, trains with `estacionat_a` are marked as `'stationed'`, and circulating units as `'moving'`.
  3. **Visual Feedback on Cards, Lists & Map:**
     - **TrainCard:** Parked units render with `opacity: 0.68`, muted left accent bar, and a `💤 Cotxeres` status badge.
     - **Train List Prioritization:** Both desktop `Sidebar.tsx` and `MobileLayout.tsx` now sort trains so active/moving trains appear at the top, and depot units are placed at the bottom.
     - **Map Marker:** On `MapView.tsx`, depot units render with a dashed outline `2px dashed rgba(255,255,255,0.7)`, lower opacity (`0.6`), and `(💤 Cotxeres)` in the title.
  4. **Contextual Mountain Line & Depot Notes (`DetailPanel.tsx`):**
     - Header displays `CREMALLERA DE MONTSERRAT`.
     - If parked at depot/sidings, displays a card explaining: *"Aquest comboi està estacionat a cotxeres o vies d’apartador fora de l’horari de servei comercial del Cremallera."*
     - Displays an informational mountain line notice: *"Línia de muntanya (Cremallera): servei turístic diürn. La cobertura GPS pot ser intermitent en trams de túnels i engorjats."*
  5. **Localization (`i18n.tsx`):**
     - Added `groupCremallera`, `groupCremalleraShort`, `cremalleraService`, `depot`, `depotShort`, `mountainLineNotice`, `depotNotice` in Catalan (`ca`), Spanish (`es`), and English (`en`).
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 unit tests passed.
  - `cmd /c npx next build`: Turbopack production build succeeded.
  - STRICT ADHERENCE: Local repository only; no `git push` executed.

### Session: 2026-10-05 (Remove Cremallera Emoji & Drop Inactive Overnight Trains from Feed)
- **Drop Sleeping/Inactive Trains Outside Service Hours (`src/lib/trains.ts`):**
  - Updated `fetchTrains()`: when outside Cremallera commercial operating hours (`!inCremalleraHours`), M1/M2/MM trains left with transponders on at sidings/depots are dropped completely (`return []`).
  - Ensures no inactive ghost trains appear as live/online trains in the app when the service is closed overnight.
- **Clean Styling (Remove Emoji):**
  - Removed `⛰️` emoji from `groupCremallera` ("M — Cremallera de Montserrat") and `groupCremalleraShort` ("Cremallera") in `src/lib/i18n.tsx`.
  - Replaced emoji with clean `ℹ` indicator in `DetailPanel.tsx`.
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 unit tests passed.
  - `cmd /c npx next build`: Turbopack production build succeeded.
  - STRICT ADHERENCE: Local repository only; no `git push` executed.

### Session: 2026-10-05 (Fix Fatal Renfe Interchange Station IDs in Footpaths)
- **Critical Footpath Bug Found by User:**
  - User noticed that planning a route from Pl. Catalunya to Sants showed a walk of only `4 min`, whereas walking between them takes ~35-45 min (3.5 km).
- **Root Cause Analysis:**
  - In `src/lib/footpaths.ts`, the transfer for Pl. Catalunya was erroneously mapped to Renfe code `71801` (`from: 'PC', to: '71801', durationSec: 240`).
  - According to official Renfe GTFS/GeoJSON (`estaciones.geojson`) and `src/lib/constants.ts`:
    - `71801` is **Barcelona-Sants**!
    - `78805` is **Barcelona-Plaça de Catalunya**!
  - As a result, the trip planner connected FGC Pl. Catalunya directly to Barcelona-Sants as a 4-minute underground passage!
  - Further auditing revealed other misassigned Renfe codes in `footpaths.ts`:
    - Terrassa Estació del Nord had `72207` (which is Sant Sadurní d'Anoia) instead of `78700` (Terrassa Estació del Nord).
    - Sabadell Nord had `72205` (which is La Granada) instead of `78709` (Sabadell Nord).
    - Martorell Central had `72304` instead of `72209`.
    - Gornal had `72401` instead of `71708` (Bellvitge | Gornal).
    - L'Hospitalet Av. Carrilet had `71701` (which is Sitges!) instead of `72305` (L'Hospitalet de Llobregat).
- **Fix:**
  - Corrected all interchange mappings in `src/lib/footpaths.ts` to their verified Renfe station IDs:
    - Pl. Catalunya: `PC` ↔ `78805` (240s)
    - Terrassa Estació del Nord: `EN` ↔ `78700` (90s)
    - Sabadell Nord: `NO` ↔ `78709` (90s)
    - Martorell Central: `MC` ↔ `72209` (120s)
    - Gornal ↔ Bellvitge: `GO` ↔ `71708` (120s)
    - Provença ↔ Passeig de Gràcia: `PR` ↔ `71802` (360s)
    - L'Hospitalet Av. Carrilet ↔ L'Hospitalet: `LH` ↔ `72305` (300s)
- **Verification:**
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm test`: 30/30 unit tests passed.
  - `scripts/test-renfe.mts`: all checks passed.
  - `cmd /c npx next build`: Turbopack production build succeeded.
### Session: 2026-10-05 (Accent-Insensitive Search, Night Rest Card, Last Train of the Day, and Direct Metro Connection Recommendations)
- **Universal Accent- & Diacritic-Insensitive Search (`src/lib/searchUtils.ts`):**
  - Built `normalizeSearchText(str)` decomposing Unicode accents (`\u0300-\u036f`), stripping cedillas/accents (`ç` -> `c`, `à/á` -> `a`, `è/é` -> `e`, `í/ï` -> `i`, `ò/ó` -> `o`, `ú/ü` -> `u`, `ñ` -> `n`), removing punctuation/punt volat, and expanding abbreviations (`pl.`, `st.`, `av.`).
  - Added `matchesSearch()` and `startsWithSearch()` used across:
    - Desktop `Sidebar.tsx` station directory search.
    - Mobile `MobileLayout.tsx` station search and `majorHubs` lookup.
    - `TripPlanner.tsx` origin/destination autocomplete input (`StationInput`).
    - `savedStations.ts` station name normalization.
  - Now searches like "rubi", "sarria", "gracia", "placa catalunya", or "sant cugat" match seamlessly without requiring manual accent marks.
- **Friendly Contextual Night Rest Status Card (`NightRestCard.tsx`, `serviceTime.ts`):**
  - Replaced the cold "Cap tren actiu." message during nighttime service closure (01:15 to 04:55 local time) with `<NightRestCard />`:
    - Clean moon icon (`🌙`), bold title (`Xarxa en descans nocturn`), and clear guidance: *"El servei comercial està tancat durant la nit. Les primeres sortides habituals comencen a partir de les 05:00 h."*
    - Fully wired into both desktop `Sidebar.tsx` and mobile `MobileLayout.tsx`.
- **Last Train of the Day Detection («Últim servei») (`planner.ts`, `route.ts`, `TripPlanner.tsx`, `DeparturesBoard.tsx`):**
  - Added `isLastService?: boolean` to `Journey` and `Departure` types.
  - **In `planner.ts` (`planJourneys`):** Evaluates if the last trip of the search (departing $\ge 20:30$) has any viable later service before morning. If no later train exists, flags `journey.isLastService = true`.
  - **In `TripPlanner.tsx` (`JourneyCard`):** Displays a `🌙 Últim servei del dia` amber badge next to departure/arrival times.
  - **In `DeparturesBoard.tsx` & `/api/departures`:** Evaluates late-evening departures ($\ge 21:00$) against the timetable; flags the last departure of the day for that line/destination and renders `🌙 Últim servei` badge.
- **Direct Metro/Tram Connection Suggestions & Renfe Codes Correction (`metroInterchanges.ts`, `TripPlanner.tsx`):**
  - Audited and corrected official Renfe codes in `src/lib/metroInterchanges.ts` (Sants `71801`, Catalunya `78805`, Arc de Triomf `78804`, Clot `79009`, Sagrera `78806`, Sant Andreu `79004`, Aeroport `72400`, Bellvitge `71708`, L'Hospitalet `72305`, Badalona `79404`).
  - Added `findDirectMetroConnections(originCode, destCode)` computing shared direct Metro/Tram lines between any two stations.
  - When a journey search has no direct rail connection (e.g. Sants ↔ Pl. Espanya), `TripPlanner` displays an actionable recommendation card:
    - *"Connexió recomanada amb Metro: Sense enllaç ferroviari directe entre Barcelona-Sants i Pl. Espanya. Pots connectar directament amb la xarxa de Metro TMB / Tram: [Metro L3]"*.
- **Verification:**
  - `cmd /c node --experimental-strip-types --no-warnings scripts/test-new-features.mts`: all checks passed.
  - `cmd /c npm test`: 30/30 unit tests passed.
  - `cmd /c npx tsc --noEmit`: 0 errors.
  - `cmd /c npm run build`: 14/14 static & dynamic routes compiled cleanly with Turbopack.
  - STRICT ADHERENCE: Local repository only; no `git push` executed.
