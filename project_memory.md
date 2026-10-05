# Project Memory & Agent Workflow Guide — Andana

> **CRITICAL INSTRUCTIONS FOR AI AGENTS:**
> 1. **Read this file first** at the start of each session before modifying code.
> 2. **Record every change** in [Section 6 (#change-history--session-log)](#6-change-history--session-log) before concluding. Follow the **Compact Session Template** (max 10-15 lines per session). Do not write multi-page essays.
> 3. **Respect architectural boundaries**: dual-root parity, server/client boundary, CSS variables + inline styles, zero fake dynamics.
> 4. **Git Push Rule:** NEVER run `git push` automatically. Only push when explicitly instructed by the user.

---

## 1. Project Overview

**Andana** is a real-time train tracker, departures board, and trip planner for **FGC** and **Rodalies de Catalunya (Renfe)**.
- **Stack:** Next.js 16.2.9 (App Router, Turbopack), React 19, TypeScript (strict), MapLibre GL (`react-map-gl/maplibre`), Tailwind v4 (installed, but inline styles + CSS variables strictly used).
- **Languages:** Catalan (`ca`, canonical source), Spanish (`es`), and English (`en`).
- **Data Sources:** FGC Open Data (`dadesobertes.fgc.cat`), Renfe live map API (`tiempo-real.renfe.com`), Rodalies RSS incidents feed, official GTFS timetables.

---

## 2. Core Architecture & Workflow Rules

### A. Strict Server vs. Client Boundary
- **Server layer:** All network calls to external APIs live under `src/lib/` (`fgc.ts`, `renfe.ts`).
- **Route handlers (`src/app/api/*`):** Server-side route handlers wrap `src/lib/*` fetchers. Client components **NEVER** import `fgc.ts`, `renfe.ts`, or server fetchers.
- **Type barrel (`src/types/index.ts`):** All shared entity types (`Train`, `Stop`, `Route`, `Alert`, `StopDetail`, `Departure`, `PlannerStation`, `JourneyLeg`, `Journey`, `JourneyFare`) MUST live in `src/types/index.ts`. Never import domain types through server modules into client components.

### B. Dual-Root Mobile & Desktop Parity
- **Desktop root:** `src/components/App.tsx` (Header + Sidebar + MapView + floating Stop/Detail Panels).
- **Mobile root (≤767px):** `src/components/MobileLayout.tsx` (Velocity-aware unified bottom-sheet + MapView).
- **Rule:** Every user-facing feature, filter, modal, or telemetry card must be wired into **both** roots. Shared components (`MapView`, `TripPlanner`, `DeparturesBoard`, `DetailPanel`, `StopPanel`, `NetworkStatusModal`, `NightRestCard`) are mounted by both.

### C. Styling Conventions
- **No Tailwind class soup:** Use inline `style={{ ... }}` paired with semantic CSS variables from `src/app/globals.css` (`var(--bg)`, `var(--bg2)`, `var(--bg3)`, `var(--text)`, `var(--muted)`, `var(--border)`, `var(--accent)`, `var(--green)`, `var(--yellow)`, `var(--red)`).
- **Theme support:** Switched via `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`. Dark mode tokens in `:root` must remain identical to original. Light mode tokens use high-contrast WCAG AA slate/emerald/amber/crimson.

### D. Trilingual i18n
- All UI strings live in `DICT` in `src/lib/i18n.tsx` with `{ ca, es, en }`.
- **Rule:** Never hardcode user-facing strings in JSX or API handlers. Use `const { t } = useI18n()` and `t('key', ...args)`.

### E. Zero Fake Dynamics (No Smoke & Mirrors)
- **STRICT RULE:** Never build fake metrics, mock countdowns, or deceptive hardcoded platform tracks.
- All telemetry, delay minutes, and live train positions must derive from authentic upstream GTFS-RT or Renfe feeds. Missing data renders clean fallback/empty states.

---

## 3. Subsystem Workflows

1. **Live Train Pipeline & Dead-Reckoned Interpolation:**
   - Client polls `/api/trains` every 10s. Merges FGC live trains (`posicionament-dels-trens` + `trip-updates-gtfs_realtime`) and Renfe fleet (`loadRenfeTrains()`).
   - Smooth 60fps rAF interpolation in `src/lib/interpolate.ts` snaps trains to route polylines (`src/lib/geometry.ts`) with dead-reckoned speeds and drift correction.
2. **Timetable CSA Journey Planner (`src/lib/planner.ts`):**
   - Merges FGC timetable and Rodalies GTFS into a unified Connection Scan Algorithm timeline.
   - Includes real walking transfers (footpaths) at interchange hubs in `src/lib/footpaths.ts`.
   - Dynamic transfer penalties prevent rapid train-hopping on parallel corridors.
   - Computes ATM tariff zones (1 to 6) and fares via `src/lib/fares.ts`.
   - Suggests direct TMB Metro/Tram lines when no direct rail route exists via `src/lib/metroInterchanges.ts`.
   - Flags last train of the day (`isLastService: true`) for late-evening trips ($\ge 20:30$).
3. **Station Departures Board (`DeparturesBoard.tsx`, `/api/departures`):**
   - Refreshes every 60s with local 1s countdowns. Shows platform track numbers, delays, line filters, suspended line notices, and `🌙 Últim servei` badges.
4. **Universal Accent-Insensitive Search (`src/lib/searchUtils.ts`):**
   - `normalizeSearchText()` strips diacritics/accents (`ç`->`c`, `à`->`a`), normalizes prefixes (`pl.`, `av.`, `st.`), and enables seamless matching across desktop/mobile station search and planner autocomplete.
5. **Nighttime Rest Status (`NightRestCard.tsx`, `serviceTime.ts`):**
   - Between 01:15 and 04:55 local time (`isNightRestHours()`), empty train lists render a friendly contextual notice instead of a cold error.
6. **Corridor Service Alerts (`AlertModal.tsx`, `src/lib/gtfs.ts`, `src/lib/renfe.ts`):**
   - Deduplicates identical GTFS-RT per-stop alerts, heals truncated messages, parses Rodalies RSS incidents, and presents official verification links.
7. **Client Preferences & State Machine:**
   - LocalStorage keys: `andana-fav-routes`, `andana-recent-routes`, `andana-fav-stations`, `andana-network-mode`, `andana-tutorial-completed`, `andana-donation-snoozed-until`, `andana-theme`, `andana-lang`.

---

## 4. Verification & Testing Workflow

Before concluding any session, run:
1. `npm test` — Standalone Node check scripts (`scripts/test-infra.mts`).
2. `node --experimental-strip-types --no-warnings scripts/test-new-features.mts` — Search, night rest, and metro connection checks.
3. `npx tsc --noEmit` — 0 TypeScript errors required across the entire codebase.
4. `npm run build` — Next.js Turbopack production build verification.
*(Windows: if execution policy blocks scripts, run `cmd /c npm <cmd>` or `cmd /c npx <cmd>`)*.

---

## 5. Architectural Log & Major Decisions

- **Scrapped Historical Reliability & External Cron (Oct 2026):** Supabase database, GitHub Actions 10-minute cron, and historical reliability hooks were deleted. All delays derive directly in real-time from GTFS-RT / Renfe feeds.
- **Client-Safe Types Barrel (Aug 2026):** Domain types live directly in `src/types/index.ts` so client bundles never import server fetchers.
- **Service Clock Pinned to Europe/Madrid (`src/lib/serviceTime.ts`):** Explicitly handles Catalonia timezone and DST compliance on UTC servers.

---

## 5.1. Pending External Integrations & Handles

Centralized in [`src/lib/externalLinks.ts`](src/lib/externalLinks.ts). Update before public production release:
1. `donationUrl`: Placeholder `'https://ko-fi.com'` → Set to real Ko-fi / Buy Me a Coffee page.
2. `feedbackEmail` & `feedbackWebhookUrl`: Placeholder `'feedback@andana.cat'` → Set to real support inbox or webhook endpoint.
3. `githubIssuesUrl`: Placeholder `'https://github.com'` → Set to repository issue tracker.

---

## 6. Change History & Session Log

> **MANDATORY LOGGING TEMPLATE FOR ALL AGENTS:**
> Keep entries compact (max 10-15 lines per session). Do not write multi-page essays.
> Format:
> ```markdown
> ### Session: YYYY-MM-DD (Feature / Fix Title)
> - **Context / Goal:** 1-2 sentence problem statement.
> - **Key Changes:** Concise bullet points of technical decisions and changes.
> - **Files Modified/Added:** Comma-separated file list.
> - **Verification:** Test/build commands executed and results.
> ```

📁 **Historical Archive:** Sessions from October 3–4, 2026 are archived in [`docs/project_memory_archive.md`](docs/project_memory_archive.md).

### Session: 2026-10-05 (Light Theme Contrast, Bug Reports & Mobile De-Cluttering)
- **Context:** Light theme status badges had low contrast; mobile alert banner truncated text.
- **Key Changes:** Redefined light theme `--status-*` tokens in `globals.css` (WCAG AA compliant slate/emerald/amber/crimson); dark mode tokens kept 100% intact. Added `FeedbackModal.tsx` in Settings. Centralized external hooks in `src/lib/externalLinks.ts`. Refactored mobile alert banner into a 2-row card with expandable drawer. Positioned floating `NearMeButton` above sheet. Modernized desktop header pills in `Header.tsx`. Added 3-circle header buttons (Share, Favorite, Close) in `StopPanel.tsx`, `DetailPanel.tsx`, and `TripPlanner.tsx`.
- **Files Modified:** `globals.css`, `TrainCard.tsx`, `FeedbackModal.tsx`, `externalLinks.ts`, `Header.tsx`, `MobileLayout.tsx`, `StopPanel.tsx`, `DetailPanel.tsx`, `TripPlanner.tsx`.
- **Verification:** `npm test` passed, `npx tsc --noEmit` (0 errors), `next build` passed.

### Session: 2026-10-05 (Footpath Code Fixes, Cremallera Night Filtering, Favorites & Sheet Scroll)
- **Context:** Walking Pl. Catalunya ↔ Sants showed 4 min due to swapped Renfe codes; M1/M2 Cremallera trains showed as active while parked at night; station favorites desynced on click; mobile static UI consumed >60% sheet height.
- **Key Changes:**
  - Corrected Renfe station codes in `footpaths.ts` (Pl. Catalunya `78805`, Terrassa `78700`, Sabadell `78709`, Martorell `72209`, Bellvitge `71708`, L'Hospitalet `72305`).
  - Filtered inactive M1/M2 Cremallera units outside operating hours (08:20–20:15) in `trains.ts` and removed `⛰️` emoji.
  - Reordered MapView JSX tree so `stops-circles` renders before `journey-line` (`beforeId`).
  - Fixed station favorites bug in `savedStations.ts` with polymorphic `matchStation` and deferred `setTimeout(..., 0)` event dispatch.
  - Compacted mobile sheet header, moved line filter chips into scrollable train list, and unified `TripPlanner` into a single scroll container.
- **Files Modified:** `footpaths.ts`, `trains.ts`, `constants.ts`, `i18n.tsx`, `DetailPanel.tsx`, `MapView.tsx`, `savedStations.ts`, `MobileLayout.tsx`, `TripPlanner.tsx`.
- **Verification:** `npm test` passed, `npx tsc --noEmit` (0 errors), `next build` passed.

### Session: 2026-10-05 (Alert Sorting, Mobile Line Filter Exit & Weather Frequency Sync)
- **Context:** Alerts were unsorted; mobile users could not exit line filter mode entered via Estat del Servei; weather disruption notices lacked route links and caused departures/passing desync.
- **Key Changes:**
  - Sorted alerts by emission time descending in `/api/alerts` and client `visibleAlerts`.
  - Added full line filter exit controls on mobile: safe `filterPillTop` placement below headers/alerts, enlarged touch target for `✕`, clear button in `NetworkStatusModal` with active outline, toggle-off on re-click, clear on map background click, and an active filter chip in the sheet's train tab.
  - Linked weather/frequency alteration GTFS alerts to affected corridors (S1, S2, etc.) and added contextual explanations.
  - Enhanced station matching in `StopPanel` with accent-insensitive search normalization; added contextual weather frequency warning and correlated live circulating trains with timetable departures.
- **Files Modified:** `api/alerts/route.ts`, `gtfs.ts`, `i18n.tsx`, `NetworkStatusModal.tsx`, `MapView.tsx`, `MobileLayout.tsx`, `App.tsx`, `StopPanel.tsx`, `DeparturesBoard.tsx`, `project_memory.md`.
- **Verification:** `npm test` (30/30 passed), `scripts/test-new-features.mts` passed, `npx tsc --noEmit` (0 errors), `npm run build` (14/14 routes compiled).

### Session: 2026-10-05 (Upstream Telemetry Outage Detection & All-Line Network Status Parity)
- **Context:** Renfe upstream fleet feed experienced an outage (broadcasting trains in Spain except Nucleo 50 Catalonia); users saw 0 trains with no error message; `NetworkStatusModal` on mobile received filtered alerts/trains and clicking opposite-operator lines showed blank maps.
- **Key Changes:**
  - Implemented daytime-aware telemetry outage detection in `/api/trains` using `!isNightRestHours()` to prevent false positives during overnight commercial rest (01:15–04:55).
  - Emitted `outages: { renfe, fgc }` and response headers; added outage banner in `App.tsx` and `MobileLayout.tsx`, and friendly explanations in empty train lists.
  - Ensured `NetworkStatusModal` receives unfiltered `allAlerts` and `allTrains` across mobile and desktop, showing all lines unconditionally with `Sense telemetria` and warning badges during feed outages.
  - Auto-switched `networkMode` to `'both'` when selecting any line from the modal belonging to an inactive operator.
- **Files Modified:** `api/trains/route.ts`, `types/index.ts`, `i18n.tsx`, `renfe.ts`, `NetworkStatusModal.tsx`, `App.tsx`, `MobileLayout.tsx`, `Sidebar.tsx`, `project_memory.md`.
- **Verification:** `npm test` (30 checks passed), `test-new-features.mts` passed, `npx tsc --noEmit` (0 TS errors), `npm run build` (14/14 routes compiled).

### Session: 2026-10-05 (Fix Alert Banner Stretching & Desktop Viewport Layout)
- **Context:** When the Rodalies telemetry "AVÍS" banner was displayed alongside service alerts, the collapsed alert banner stretched to fill half the screen and pushed the sidebar/map out of the viewport.
- **Key Changes:**
  - Diagnosed CSS Grid track collision: `App.tsx` had `gridTemplateRows: '56px auto 1fr'`. Rendering both the AVÍS banner and AlertBanner placed the AlertBanner into the `1fr` row, stretching it vertically over the viewport.
  - Refactored `App.tsx` root layout to a vertical flex container (`display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden'`) where banners naturally take their compact height with `flexShrink: 0`, and the nested main container (`Sidebar` + `MapView`) takes `flex: 1, minHeight: 0`.
  - Set explicit `height: 56, flexShrink: 0` on `Header.tsx`.
  - Dynamically adjusted `filterPillTop` in `MobileLayout.tsx` to prevent line filter pill collisions when both the AVÍS card and alert banner are active.
- **Files Modified:** `src/components/App.tsx`, `src/components/Header.tsx`, `src/components/MobileLayout.tsx`, `project_memory.md`.
- **Verification:** `npx tsc --noEmit` (0 TS errors), `npm test` (30 checks passed), `test-new-features.mts` passed, `npm run build` (14/14 routes compiled).

### Session: 2026-10-05 (Tutorial 3-Click Navigation Tabs & Settings Walk-through)
- **Context:** The onboarding tour lumped all three tabs (Trens, Estacions, Planificador) into a single step and lacked coverage of app settings/preferences.
- **Key Changes:**
  - Split the tabs tour into 3 distinct sequential steps: `tab-trains` (live tracking, delay, occupancy), `tab-stations` (departures board, countdowns, track numbers, favorites), and `tab-plan` (CSA multimodal route planner, transfers, ATM zones).
  - Added a dedicated 7th tour step for `settings` (`[data-tour="settings"]`) highlighting the configuration button on both desktop (`Header.tsx`) and mobile (`MobileLayout.tsx`), with a direct "Obrir configuració ⚙️" shortcut.
  - Implemented reactive `andana-tour-step` event synchronization: automatically switches active tabs and snaps the mobile bottom sheet (`SNAP_HALF` for tabs, `SNAP_PEEK` for map/header buttons) so the spotlight target is perfectly centered and visible.
  - Added trilingual i18n copy (`ca`, `es`, `en`) in `DICT` for all new steps.
- **Files Modified:** `i18n.tsx`, `OnboardingModal.tsx`, `Sidebar.tsx`, `Header.tsx`, `MobileLayout.tsx`, `App.tsx`, `project_memory.md`.
- **Verification:** `npx tsc --noEmit` (0 TS errors), `npm test` (30 checks passed), `test-new-features.mts` passed, `npm run build` (14/14 routes compiled).

### Session: 2026-10-05 (Fix Train Interpolation Perpetual Dwell, Feed Stale Lag & Walking Speed)
- **Context:** Trains appeared stopped most of the time due to perpetual dwell loops and ETA mismatches; feed latency (up to 2 mins) risked freezing trains at platforms.
- **Key Changes:**
  - Diagnosed infinite dwell loop: `DWELL_MS = 20s` with `servicedStops.clear()` on every 10s poll caused trains to repeatedly re-trigger station dwells at the same station.
  - Added intermediate dwell timeout (`INTERMEDIATE_DWELL_MS = 25s`): holds trains at intermediate platforms while tracking `stationedAt`. If FGC/Renfe feed lags without updating, the timer expires and the train automatically resumes rolling toward the next stop at line speed rather than staying stuck for 2+ minutes. Terminus stations hold indefinitely.
  - Released station dwell immediately whenever upstream telemetry reports departure (`!isStationed`).
  - Reduced between-poll arrival pause to 6s (`BETWEEN_POLLS_DWELL_MS = 6_000`) and pruned `servicedStops` strictly by upcoming stops instead of wiping on poll.
  - Fixed `resolveSpeed()` fallback: guarded against ETA checkpoint mismatches that yielded walking speeds (< 10 m/s or > 35 m/s) by defaulting to line speed (`19 m/s`).
- **Files Modified:** `src/lib/interpolate.ts`, `project_memory.md`.
### Session: 2026-10-05 (Performance & Usability: Decouple 10fps Ticks, GeoJSON Memoization, Shared Timers & Planner Suggestions)
- **Context:** Decoupled 10fps animation ticks from UI lists, eliminated GeoJSON WebGL buffer thrashing, consolidated per-card timers, and enhanced planner UX.
- **Key Changes:**
  - Memoized `routesGeoJson`, `stopsGeoJson`, and `journeyGeoJson` in `MapView.tsx` (wrapped in `React.memo`), eliminating redundant WebGL source re-indexing on every animation frame.
  - Decoupled 10fps interpolation from DOM lists: `App.tsx` and `MobileLayout.tsx` now pass stable polled `displayTrains` to the desktop Sidebar and mobile bottom sheet, while passing `mapTrains` strictly to `MapView`.
  - Replaced per-card `setInterval` in `TrainCard.tsx` with a singleton `useSharedNow(15_000)` hook (`src/lib/timeHooks.ts`) and wrapped `TrainCard` with `React.memo`.
  - Added instant suggestions dropdown in `TripPlanner.tsx` (favorite stations & major hubs on empty focus), plus 1-tap clear button and tactile swap rotation animation.
  - Added global `Escape` keyboard shortcuts on both desktop and mobile roots to cleanly dismiss modals, panels, and line filters; precomputed `allUniqueStops` in `Sidebar.tsx` for lag-free typing.
  - Memoized `availableLines` and added animated skeleton loader in `DeparturesBoard.tsx`; added `prefers-reduced-motion` and tactile `:active` styles in `globals.css`; cached `/api/plan-stations`.
- **Files Modified:** `MapView.tsx`, `App.tsx`, `MobileLayout.tsx`, `TrainCard.tsx`, `timeHooks.ts`, `TripPlanner.tsx`, `DeparturesBoard.tsx`, `Sidebar.tsx`, `globals.css`, `api/plan-stations/route.ts`, `project_memory.md`.
- **Verification:** `npm test` (30 checks passed), `test-new-features.mts` passed, `npx tsc --noEmit` (0 TS errors), `npm run build` (14/14 routes compiled).

### Session: 2026-10-05 (Physics-Based Train Simulation: Smooth Deceleration, Station Dwells & Jump-Free Rectification)
- **Context:** Trains were flying over stations without stopping due to exact station string matching failures, and lacked realistic station physics and soft telemetry synchronization.
- **Key Changes:**
  - Integrated `normalizeSearchText` into `findStopDist` with per-line distance caching, resolving 100% of FGC and Rodalies stations (handling prefixes, diacritics, and naming variants).
  - Modeled real-world transit physics in `useInterpolatedTrains`: smooth deceleration on station approach ($150\text{ m}$ braking curve via $v = \sqrt{2ad}$), realistic platform dwell ($17\text{–}23\text{ s}$ intermediate with organic $\pm 3\text{ s}$ variation, indefinite terminus), and smooth acceleration on departure ($1.1\text{ m/s}^2$).
  - Implemented soft drift rectification: upstream GPS updates gently modulate cruising speed by $\pm 10\text{–}25\%$ over track distance, eliminating teleportation/jumping while keeping the simulation self-sufficient during 2-minute feed lags.
- **Files Modified:** `src/lib/interpolate.ts`, `project_memory.md`.
- **Verification:** `npm test` (30 checks passed), `test-new-features.mts` passed, `npx tsc --noEmit` (0 TS errors), `npm run build` (14/14 routes compiled).

### Session: 2026-10-05 (Fix Backwards Dot Flying & Stale Telemetry Snapbacks)
- **Context:** Trains were observed flying backwards and snapping back when GPS coordinates lagged or loops flipped.
- **Key Changes:**
  - Resolved 2-way folded loop in `buildPolyline` (`geometry.ts`): FGC lines had 2 segments forming outbound + inbound tracks, doubling track length and flipping projections across the line. Filtered round-trip return segments (`loopDist < 500m`) to maintain single monotonic paths.
  - Added `lastRawLng`/`lastRawLat` in `interpolate.ts`: ignored stale repeated GPS points from upstream 2-minute lags, preventing trains from snapping backward after advancing along rails.
  - Enforced forward travel (`move = Math.max(0, currentSpeed * dt)`) and soft speed modulation during drift corrections.
- **Files Modified:** `src/lib/geometry.ts`, `src/lib/interpolate.ts`, `project_memory.md`.
- **Verification:** `npm test` (30 checks passed), `test-new-features.mts` passed, `npx tsc --noEmit` (0 TS errors), `npm run build` (14/14 routes compiled).

### Session: 2026-10-05 (Resolve GRbus & Comprehensive Interpolation Engine Polish)
- **Context:** Gràcia surfaced as raw operational code "GRbus"; audited interpolation for edge-case traps, jitter, and dwell drops.
- **Key Changes:**
  - Mapped bus codes (`GRbus`, `SGbus`, etc.) in `STATION_CODES` (`constants.ts`) and enhanced `resolveStop` (`trains.ts`) to strip `/bus\d*$/i`. Filtered street bus substitution pins from `fetchStops` (`gtfs.ts`) and cleaned `planner.ts`, `StopPanel.tsx`, and `api/stop-info`.
  - Fixed "Perpetual Next Stop Trap" in `interpolate.ts`: stops behind train ($< -35\text{m}$) are automatically marked serviced, preventing trains from getting locked on passed stations.
  - Fixed direction inversion near termini: multi-stop vector progression (`last - first`) and fallback preservation prevent flipping to `+1` within 80m of arrival.
  - Added track plausibility filter in `findStopDist` ($< 1200\text{m}$) preventing homonyms from projecting onto distant lines; protected active platform dwell from premature cancellation during stale feed polls.
- **Files Modified:** `constants.ts`, `trains.ts`, `gtfs.ts`, `planner.ts`, `StopPanel.tsx`, `api/stop-info/route.ts`, `interpolate.ts`, `project_memory.md`.
- **Verification:** `npm test` passed, `test-new-features.mts` passed, `npx tsc --noEmit` (0 errors), `npm run build` (14/14 routes compiled).

### Session: 2026-10-05 (Live HUD Incoming Train Notifications, Favorite Station Warnings & Standalone Widget)
- **Context:** Added real-time notifications for incoming trains in Live HUD, alerts when favorite stations have active warnings, and widget support.
- **Key Changes:**
  - Built `src/lib/notifications.ts`: Web Notifications API, Service Worker background notifications, Web Audio synthesized chimes (train & warning chords), and haptic feedback.
  - Added `NotificationToast.tsx` in-app floating banner and `useStationAlertNotifier.ts` hook for immediate notifications on favorite station incidents with 100% desktop/mobile dual-root parity.
  - Enhanced `LiveTripHud.tsx` with incoming train arrival alerts, transfer & destination approach notifications, milestone deduplication, and mini-HUD floating widget mode (🗕).
  - Created standalone `/widget` route, `/api/widget-data`, W3C PWA widget shortcuts in `manifest.ts`, and floating window pop-out in `Header.tsx` and `MobileSettingsModal.tsx`.
- **Files Modified:** `notifications.ts`, `useStationAlertNotifier.ts`, `NotificationToast.tsx`, `LiveTripHud.tsx`, `App.tsx`, `MobileLayout.tsx`, `MobileSettingsModal.tsx`, `Header.tsx`, `i18n.tsx`, `manifest.ts`, `widget/page.tsx`, `api/widget-data/route.ts`, `sw.js`, `savedStations.ts`, `test-new-features.mts`, `project_memory.md`.
- **Verification:** `cmd /c npm test` (30 checks passed), `test-new-features.mts` (all checks passed), `npx tsc --noEmit` (0 errors), `npm run build` (15/15 routes compiled).

