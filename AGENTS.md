<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Geotren

Real-time map and trip planner for **FGC** (Ferrocarrils de la Generalitat de Catalunya) trains. A single-page Next.js app that shows live train positions on a MapLibre map, station info, service alerts, and a journey planner — all sourced from FGC's public open-data portal. UI is trilingual (Catalan / Spanish / English), Catalan being the source language.

## Stack

- **Next.js 16.2.9** (App Router, Turbopack) — see the Next.js rule block above; this version diverges from older docs.
- **React 19**, **TypeScript** (strict), path alias `@/*` → `src/*`.
- **MapLibre GL** via **react-map-gl/maplibre** (`react-map-gl/maplibre`, not the Mapbox entry). Basemaps are CARTO styles (dark-matter / positron).
- **Tailwind v4** (`@tailwindcss/postcss`) is installed, but components are styled almost entirely with **inline `style={{}}` objects** and CSS variables (`var(--bg)`, `var(--accent)`, `var(--muted)`, etc.) defined in `globals.css` and switched by `data-theme`. Match that convention — don't introduce Tailwind class soup.
- **gtfs-realtime-bindings** for decoding GTFS-RT protobuf feeds.

Scripts: `npm run dev` (Turbopack dev), `npm run build`, `npm start`, `npm run lint` (eslint). There is **no test suite** — verify changes by building (`npx tsc --noEmit` / `next build`) and running the app.

## Data source: the FGC Open Data portal

All data comes from `dadesobertes.fgc.cat` (Opendatasoft v2.1). **Never call the portal directly** — go through the thin client in [src/lib/fgc.ts](src/lib/fgc.ts), which centralises URL building, paging (100-row cap), the Next.js cache policy, and GTFS-RT protobuf decoding:

- `fgcRecords(dataset, params, revalidate)` — one page of records.
- `fgcAllRecords(dataset, params, revalidate)` — all pages, parallelised.
- `fgcExport(dataset, revalidate)` — full JSON export (`limit=-1`), for large timetable pulls.
- `fgcGtfsFile(filename, revalidate)` — a member file of the `gtfs_zip` dataset as raw CSV text.
- `fgcFeed(dataset)` — decode a GTFS-Realtime `.pb` feed; **always uncached**. Note: int64 fields decode as protobufjs `Long`s, so the feed is re-materialised with `{ longs: Number }` (a Long left as-is makes `time * 1000` → `NaN`).

`revalidate` is seconds; pass `0` for always-fresh (`cache: 'no-store'`). Realtime feeds and live train positions use `0`; static/timetable data uses long values (`3600`, `86400`).

Datasets in use (by string id):
- `posicionament-dels-trens` — **live train positions** (the primary feed; fetched fresh every poll).
- `trip-updates-gtfs_realtime`, `vehicle-positions-gtfs_realtime`, `alerts-gtfs_realtime` — GTFS-RT feeds (delays/ETA, occupancy cross-check, service alerts).
- `gtfs_stops`, `gtfs_routes`, `lineas-red-fgc` — stops, route geometry (`MultiLineString`), line metadata/colors.
- `gtfs_zip` (`stop_times.txt` etc.) — full timetable for the planner.
- `accesibilidad-itinerarios` — step-free itineraries (keyed by station *name*).
- air-quality and `prediccion-meteorologica-del-dia-por-paradas` — station detail enrichment.

## Architecture

```
src/
  app/
    page.tsx              → <App/>
    layout.tsx            fonts, metadata
    api/                  route handlers (server) — each wraps a lib fetcher
      trains/   plan/   plan-stations/   stops/   routes/
      alerts/   accessibility/   stop-info/   departures/
  components/             all 'use client'
    App.tsx               desktop root: state owner, 10s train poll, layout grid
    MobileLayout.tsx      mobile root (≤767px): own state + bottom-sheet UI
    MapView.tsx           MapLibre map (dynamic import, ssr:false)
    Sidebar.tsx           desktop tabs: Trains / Stations / Plan
    TripPlanner.tsx       journey search UI (lives in the Plan tab); reads/writes saved routes
    DeparturesBoard.tsx   next-departures list for a station (used inside StopPanel)
    DetailPanel / StopPanel / TrainCard / Header
  lib/
    fgc.ts                FGC portal client (see above)
    geotren.ts            fetchTrains() — parses posicionament feed → Train[]
    gtfs.ts               GTFS + GTFS-RT fetchers (stops, routes, delays, ETA, occupancy, alerts, weather, air)
    planner.ts            Connection Scan Algorithm trip planner over the GTFS timetable; also getDepartures()
    accessibility.ts      step-free itinerary lookup (name-normalised matching)
    geometry.ts           shared polyline math (haversine, build/project/clip)
    interpolate.ts        useInterpolatedTrains — smooth train animation between polls
    journeyPath.ts        buildJourneyPath — a Journey → colored per-leg map path
    savedRoutes.ts        useSavedRoutes — localStorage-backed favorite/recent planner routes
    i18n.tsx              I18nProvider + useI18n; DICT holds all strings
    constants.ts          STATION_CODES (code→name), LINE_COLORS fallbacks
  types/index.ts          shared types; re-exports planner's Journey/JourneyLeg/PlannerStation
```

**Server vs client.** Everything under `app/api/*` is server-side and is the only thing that talks to `lib/fgc.ts`. Components are all `'use client'` and reach data via `fetch('/api/...')`. Don't import `lib/fgc.ts` (or other server fetchers) into a client component.

**Two roots, one feature set.** `App.tsx` (desktop) and `MobileLayout.tsx` (mobile, ≤767px via matchMedia) are separate trees that each own their own state. **A feature usually has to be wired into both.** Shared leaf components (`MapView`, `TripPlanner`, `DetailPanel`, …) take props from whichever root mounts them.

**Station codes.** FGC uses short codes (`PC`, `SC`, …); stop ids look like `<CODE><n>` (e.g. `SC1`). `resolveStop`/`STATION_CODES` map codes→display names; strip a trailing `\d+$` to get the base code. The planner keys on parent-station codes.

## Key subsystems

### Live train pipeline
`/api/trains` → `fetchTrains()` (positions) enriched with `fetchTripInfo()` (delay + next-stop ETA) and `fetchVehiclePositions()` (GTFS-RT occupancy fallback). The join key is the trip id: the posicionament record `id` equals the GTFS-RT `trip.tripId` (**not** the feed `entity.id`, which is prefixed `S|<date>|<tripId>`). The client (`App`) polls `/api/trains` every **10s**.

### Train interpolation ([interpolate.ts](src/lib/interpolate.ts))
FGC's feed only refreshes every ~20–30s and reports discrete positions, so `useInterpolatedTrains` animates trains smoothly between polls with `requestAnimationFrame`:
- Each train is snapped/projected onto its **route polyline** and moves along it.
- Per-train **speed is dead-reckoned** from real distance-to-next-stop ÷ real `nextStopEta`, falling back to a constant when ETA is missing/stale.
- Drift from the real position is corrected by **easing toward a `targetDist`**, not teleporting — and the correction only pulls *toward* a target ahead in the travel direction, so a train that coasts past a stale fix keeps coasting instead of snapping backward. Only absurd drift (>2 km) hard-snaps.

When touching this, reason about the rAF tick math directly and simulate the "feed went quiet" case; the bugs here are sign/threshold issues, not data issues.

### Trip planner ([planner.ts](src/lib/planner.ts))
Connection Scan Algorithm over the GTFS timetable (parsed from `gtfs_zip`). A per-boarding transfer penalty (and `TRANSFER_SECONDS` min change time) biases toward staying on one train, because FGC corridors run several parallel lines and a naive earliest-arrival scan produces absurd "hop every other stop" itineraries. `planJourneys(from, to, after, n, lineDelays?, date?)` returns up to `n` `Journey`s; live median per-line delays enrich today's plans only. Plans are limited to `MAX_PLAN_DAYS_AHEAD` (7) — keep the client date picker bound in sync.

### Journey path drawing ([journeyPath.ts](src/lib/journeyPath.ts) + MapView)
`buildJourneyPath(journey, routes, stops, lineColors)` turns a `Journey` into one **clipped, line-colored polyline per leg**: each leg takes its line's route geometry and `clipPolyline`s it to the segment between the leg's boarding and alighting stations (so transfers show as the drawn path changing color), falling back to a straight chord if geometry is missing. `MapView` draws it (casing + colored line + endpoint/transfer markers) and `fitBounds` to frame the whole trip. State for the selected journey lives in the root (`App`/`MobileLayout`) and is threaded down through `Sidebar`/`TripPlanner`.

### Station departures board ([DeparturesBoard.tsx](src/components/DeparturesBoard.tsx))
`/api/departures?station=<parentCode>` calls `getDepartures()` (in `planner.ts`, reusing the same parsed GTFS timetable as the trip planner) for the next scheduled departures, enriched server-side with each line's current median live delay from `fetchLineDelays()`. The client re-fetches every 60s and ticks a per-second countdown locally between fetches; effective time = scheduled `depTime` + live delay.

### Saved / recent planner routes ([savedRoutes.ts](src/lib/savedRoutes.ts))
`useSavedRoutes()` persists favorite and recent origin→destination pairs to `localStorage` (`geotren-fav-routes` / `geotren-recent-routes`), hydrated post-mount to avoid an SSR mismatch (same pattern as the i18n provider). Because the hook owns its own state, `TripPlanner` gets favorites/recents "for free" on both roots — this is the one case where a feature **doesn't** need separate wiring in `App.tsx`/`MobileLayout.tsx`.

### i18n ([i18n.tsx](src/lib/i18n.tsx))
All user-facing strings go in the `DICT` object as `{ ca, es, en }` (Catalan is canonical); values can be functions for interpolation/pluralisation. Use `const { t } = useI18n()` and `t('key', ...args)`. **Add a key for any new visible string in all three languages — never hardcode UI text.**

## Conventions

- **Styling:** inline style objects + CSS variables; theme via `data-theme="dark|light"`. No new global CSS frameworks.
- **Comments:** the codebase favors a short explanatory comment above non-obvious logic (why, not what), often noting a data-source gotcha. Match that density and tone.
- **New shared geometry/util math** belongs in `lib/`, imported by both consumers — don't duplicate (e.g. the polyline math was extracted to `geometry.ts` so `interpolate.ts` and `journeyPath.ts` share it).
- **Caching is deliberate:** pick `revalidate` by how often the upstream data really changes; realtime → `0`, timetable/static → `3600`/`86400`.
- **Lint note:** the repo has pre-existing `react-hooks/set-state-in-effect` and `exhaustive-deps` lint findings in effects; these don't block `next build`. Don't churn unrelated files to "fix" them.
- **Mobile parity:** when adding a user-facing feature, wire it into both `App.tsx` and `MobileLayout.tsx`.
