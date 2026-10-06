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
### Session: 2026-10-06 (Fix DeparturesBoard Countdown Out-of-Bounds Overflow)
- **Context:** Multiple status badges (`🟢 Tren a l'estació`, `🌙 Últim servei`) combined on a single line squeezed the headsign and pushed countdowns (3, 5, 9 min) completely out of bounds.
- **Key Changes:** Restructured `DeparturesBoard.tsx` card rows into a 2-tier layout: top row for line badge and destination headsign, sub-row for badges (`track`, `matchingLive`, `lastService`, `delay`), and a dedicated right column (`flexShrink: 0, textAlign: 'right'`) for countdowns and scheduled departure times with `overflow: 'hidden'` protection.
### Session: 2026-10-06 (Remove Widget Feature per User Request)
- **Context:** The user requested the complete removal of the widget feature while keeping the notifications system intact.
- **Key Changes:** Deleted `/widget` page, `/api/widget-data`, W3C manifest shortcuts, header pop-out button, settings modal section, and HUD minimize widget mode.
- **Files Modified/Deleted:** `src/app/widget/page.tsx` (deleted), `src/app/api/widget-data/route.ts` (deleted), `manifest.ts`, `Header.tsx`, `MobileSettingsModal.tsx`, `LiveTripHud.tsx`, `i18n.tsx`, `project_memory.md`.
- **Verification:** `cmd /c npm test` (30 checks passed), `test-new-features.mts` (passed), `npx tsc --noEmit` (0 errors), `npm run build` (14/14 routes compiled).

### Session: 2026-10-06 (School Car Reservations & Night Silence Alert Filtering)
- **Context:** Automated 3 AM FGC feed batch notices ("cotxes reservats escolars" & Cremallera links) generated station notification spam and all-day banner clutter across the network.
- **Key Changes:**
  - Classified routine notices (`escolars / reservats`, `enllaç cremallera`) as `isInformational: true` & `isSchoolReservation: true` in `gtfs.ts` with dedicated friendly explanations.
  - Added night silence window (`isNightRestHours()`) in `useStationAlertNotifier.ts` to suppress push/sound alerts between 01:00–05:00, and excluded `isInformational` alerts from firing station alarms.
  - Scoped school reservation notices in `App.tsx` and `MobileLayout.tsx` using `isSchoolCommuteHours()` (Mon–Fri 07:30–09:00, 13:30–15:00), keeping main banners clear of school car notices during off-hours.
  - Polished `AlertModal.tsx` (`ℹ AVÍS` info badge) and `NetworkStatusModal.tsx` so informational notices never turn entire rail lines orange/red.
- **Files Modified:** `src/types/index.ts`, `src/lib/gtfs.ts`, `src/lib/serviceTime.ts`, `src/lib/useStationAlertNotifier.ts`, `src/components/App.tsx`, `src/components/MobileLayout.tsx`, `src/components/AlertModal.tsx`, `src/components/NetworkStatusModal.tsx`, `src/lib/i18n.tsx`, `scripts/test-new-features.mts`, `project_memory.md`.
- **Verification:** `npm test` (30 checks passed), `test-new-features.mts` (passed), `npx tsc --noEmit` (0 TS errors), `npm run build` (Turbopack, 14/14 routes compiled).

### Session: 2026-10-06 (Post-Midnight GTFS Service Day Planner & Departures Fix)
- **Context:** At 00:43 AM, the trip planner from Terrassa Rambla to Vallparadís showed the first morning train at 05:46 instead of the currently circulating late-night train (00:47).
- **Key Changes:**
  - Resolved GTFS service-day cutoff: public transit schedules post-midnight trains (00:00–04:00) with `depTime >= 86400` (e.g. `24:47:00`), whereas standard clocks reset to `00:xx` (`< 14400s`), skipping right-now trains and jumping to 05:46.
  - Updated `planJourneys` and `getDepartures` in `src/lib/planner.ts`: when `afterSeconds < 4 * 3600`, first query late-night departures (`depTime >= afterSeconds + 86400`), then fill subsequent slots with morning departures.
  - Normalized relative countdown math in `DeparturesBoard.tsx`, `TripPlanner.tsx`, and `LiveTripHud.tsx` when `target >= 86400 && now < 4 * 3600`.
- **Files Modified:** `src/lib/planner.ts`, `src/components/DeparturesBoard.tsx`, `src/components/TripPlanner.tsx`, `src/components/LiveTripHud.tsx`, `scripts/test-new-features.mts`, `project_memory.md`.
### Session: 2026-10-06 (Mobile Keyboard Viewport Fix & FGC EMU Wagon Consist Visuals)
- **Context:** On mobile, opening the keyboard shifted the app off-screen and hid suggestions. Additionally, user requested EMU car composition order (M1-Mi-Ri-M2) and graphic indicators for train direction and car roles.
- **Key Changes:**
  - Fixed mobile keyboard displacement: dynamically adapt root viewport height to `window.visualViewport.height` in `MobileLayout.tsx`, lock `window.scrollY` to 0, clamp `TripPlanner.tsx` autocomplete `maxHeight` to `min(200px, 35vh)`, and auto-scroll inputs cleanly into view.
  - Corrected FGC 4-car EMU composition order to official formation `M1 - Mi - Ri - M2` in `constants.ts` and `trains.ts`.
  - Upgraded `DetailPanel.tsx` wagon visualization: added direction header `◀ Sentit de la marxa (cap a Destinació)`, aerodynamic front cab with headlights, rear cab with red taillights, gangway couplings, and car role badges (Capçalera / Motor / Remolc / Cua).
  - Added trilingual translations (`travelDirection`, `cabFront`, `cabRear`, `carMotor`, `carTrailer`) in `i18n.tsx`.
- **Files Modified:** `MobileLayout.tsx`, `TripPlanner.tsx`, `DetailPanel.tsx`, `constants.ts`, `trains.ts`, `i18n.tsx`, `project_memory.md`.
- **Verification:** `npm test` (30 checks passed), `test-new-features.mts` (passed), `npx tsc --noEmit` (0 errors), `npm run build` (Turbopack, 14/14 routes compiled).

### Session: 2026-10-06 (Fix FGC Upstream Shifted Records & Night Rest Ghost Train)
- **Context:** At 01:20 AM, a ghost train with no line, empty destination, and moving status appeared on the map at Terrassa.
- **Key Changes:**
  - Diagnosed upstream FGC Open Data CSV column shift where `id` shifted into `ocupacio_mi_percent` and `line` into `ocupacio_mi_tram`, leaving `id` & `lin` undefined.
  - Added `normalizeTrainRecord()` in `trains.ts` to detect and realign shifted columns, and strictly reject any record without a valid `id` or recognized `line`.
  - Filtered out inactive/sleeping units during `isNightRestHours()` (01:15–04:55 weeknights) when commercial service is closed, allowing `NightRestCard` to show properly.
  - Updated `isNightRestHours()` in `serviceTime.ts` to account for Saturday all-night service and Friday late-night schedules.
  - Guarded `feed.entity ?? []` across `gtfs.ts` to prevent empty-feed type errors during overnight hours.
- **Files Modified:** `src/lib/trains.ts`, `src/lib/serviceTime.ts`, `src/lib/gtfs.ts`, `project_memory.md`.
- **Verification:** `npm test` (passed), `test-new-features.mts` (passed), `npx tsc --noEmit` (0 errors), `npm run build` (Turbopack, 14/14 compiled). Verified live `/api/trains` returns 0 ghost trains during night rest.

### Session: 2026-10-06 (Notification Expansion, Favorite Lines, Alight Alarms & Departure Reminders)
- **Context:** Expanded notification system with master/granular config toggles, favorite line disruption alerts, departure reminders, and alight alarms.
- **Key Changes:**
  - Added full notification settings toggles in `MobileSettingsModal.tsx`: master switch, favorite stations, favorite lines with line pill selector chips, 5-min departure reminders, live trip incoming train alerts, alight/transfer wake-up alarms, and sound/vibration.
  - Implemented `useFavoriteLines.ts` and `useLineAlertNotifier.ts` to alert commuters when active disruptions affect subscribed lines.
  - Built `useDepartureReminders.ts` and added interactive 🔔 bell toggle to `DeparturesBoard.tsx` (and `StopPanel.tsx`) providing 5-minute pre-departure reminders.
  - Wired alight and transfer proximity alarms into `LiveTripHud.tsx` (`type: 'warning'`, audio chime & haptics).
  - Maintained 100% desktop/mobile dual-root parity by mounting hooks in both `App.tsx` and `MobileLayout.tsx`. Added full trilingual i18n copy in `DICT`.
- **Files Modified:** `notifications.ts`, `MobileSettingsModal.tsx`, `savedLines.ts`, `useLineAlertNotifier.ts`, `departureReminders.ts`, `DeparturesBoard.tsx`, `StopPanel.tsx`, `LiveTripHud.tsx`, `App.tsx`, `MobileLayout.tsx`, `i18n.tsx`, `test-new-features.mts`, `project_memory.md`.
- **Verification:** `npm test` passed (30/30), `test-new-features.mts` passed, `npx tsc --noEmit` (0 errors), `npm run build` (Turbopack, 14/14 routes compiled).

### Session: 2026-10-06 (Notification Toggle Switches, Compact Lines Selector, Remove Reminders & Fix Font Scaling)
- **Context:** Notification settings used raw checkboxes instead of iOS toggle switches; sub-settings were visible when master toggle was off; line selector consumed excessive space; user requested complete removal of departure reminders; font size setting didn't scale pixel-styled UI.
- **Key Changes:**
  - Redesigned notifications configuration with iOS-style toggle switches; sub-settings are completely hidden when master switch is off.
  - Implemented collapsible compact line alerts selector grouped by network (FGC Vallès, Llobregat, Rodalies, Regionals) showing active count when collapsed.
  - Removed departure reminders feature completely: deleted `src/lib/departureReminders.ts`, removed reminder bells from `DeparturesBoard.tsx`, unmounted hooks in `App.tsx` & `MobileLayout.tsx`, cleaned settings and `i18n.tsx`.
  - Fixed font size scaling by adding proportional zoom levels (`zoom: 0.88`, `zoom: 1`, `zoom: 1.12`) to `data-font` attributes in `globals.css`, and injected immediate script in `layout.tsx` `<head>` for instant font restoration without flash.
- **Files Modified:** `MobileSettingsModal.tsx`, `DeparturesBoard.tsx`, `notifications.ts`, `i18n.tsx`, `App.tsx`, `MobileLayout.tsx`, `globals.css`, `layout.tsx`, `project_memory.md`.
- **Verification:** `npm test` (30 checks passed), `test-new-features.mts` (passed), `npx tsc --noEmit` (0 errors), `npm run build` (Turbopack, 14/14 compiled).

### Session: 2026-10-06 (Mode En Marxa, Glowing Minimized Bar, Line Alerts Fallback & Universal Font Scaling)
- **Context:** User requested renaming Live HUD to Mode «En marxa», changing trip button to start journey clearly, fixing broken minimize glyph with a discrete glowing bottom bar showing live station abbreviation countdown, setting line alerts to none when empty, and fixing font size scaling across all browsers.
- **Key Changes:**
  - Renamed "Live HUD" to native Catalan "Mode «En marxa»" across `i18n.tsx`, `LiveTripHud.tsx`, and notification settings; updated planner action button to `▶ Comença el viatge` in `TripPlanner.tsx`.
  - Upgraded `LiveTripHud.tsx`: replaced broken minimize icon with clean cross-platform SVG chevron, and implemented a sleek glowing bottom bar when minimized: `Viatge actual: PC → VP   5 min` (showing minutes to departure while waiting, then minutes to destination arrival once rolling; tap expands). Added `hudGlow` keyframe animation in `globals.css`.
  - Fixed line alert subscription fallback in `MobileSettingsModal.tsx`: displays `⚪ Cap línia seleccionada` when `favoriteLines.length === 0` (preventing false "all lines" implication).
  - Resolved font size scaling across iOS WebKit & Blink: mapped all 24 inline pixel font sizes to scaled values via `html[data-font="small|large"] [style*="font-size: ..."] !important` rules in `globals.css`, eliminating Safari `zoom` root ignoring and fixed viewport clipping.
  - Added `suppressHydrationWarning` to `<html>` and `<body>` in `src/app/layout.tsx` to eliminate React hydration mismatch warnings caused by pre-hydration font size and theme bootstrap attributes.
- **Files Modified:** `src/lib/i18n.tsx`, `src/components/TripPlanner.tsx`, `src/components/LiveTripHud.tsx`, `src/components/MobileSettingsModal.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `project_memory.md`.
- **Verification:** `npm test` (30 checks passed), `test-new-features.mts` (all passed), `npx tsc --noEmit` (0 errors), `npm run build` (Turbopack, 14/14 compiled cleanly).



