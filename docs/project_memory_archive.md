# Project Memory Archive — Andana (October 3–4, 2026)

This archive preserves earlier session history to keep [`project_memory.md`](../project_memory.md) ultra-lean and token-efficient.

### Session: 2026-10-03 (Scrapping Historical Reliability & Adding Project Memory)
- **Context:** Scrapped legacy Supabase delay database and GitHub Actions cron in favor of direct live feeds.
- **Key Changes:** Removed `.github/workflows/capture-delays.yml`, `supabase/`, `api/reliability/`, `reliability.ts`, and test scripts. Updated `npm test` to run `test-infra.mts`. Created `project_memory.md`.
- **Files Modified:** `package.json`, `DeparturesBoard.tsx`, `DetailPanel.tsx`, `TripPlanner.tsx`, `i18n.tsx`.
- **Verification:** `npm test` passed (30/30 checks).

### Session: 2026-10-03 (Integrating Renfe / Rodalies Infrastructure & Multi-Network Switch)
- **Context:** Integrated Rodalies de Catalunya real-time fleet, routes, stations, and departures alongside FGC.
- **Key Changes:** Created `src/lib/renfe.ts` (API client for `tiempo-real.renfe.com`). Added 3-way `NetworkSwitch` (`FGC` | `Rodalies` | `Both`). Added 2-letter map abbreviations (`RENFE_STATION_CODES` in `constants.ts`). Enriched `TrainCard`, `DetailPanel`, and `DeparturesBoard` with platform track numbers and Rodalies operational status.
- **Files Modified:** `renfe.ts`, `constants.ts`, `types/index.ts`, `api/trains`, `api/stops`, `api/routes`, `api/departures`, `App.tsx`, `MobileLayout.tsx`, `MapView.tsx`, `TrainCard.tsx`, `DetailPanel.tsx`, `DeparturesBoard.tsx`.
- **Verification:** `npm test` passed, `scripts/test-renfe.mts` passed, `npx tsc --noEmit` (0 errors), `npm run build` passed.

### Session: 2026-10-03 (Service Alerts Deduplication, Explanations & Mobile UI Overhaul)
- **Context:** FGC published redundant per-stop alert entries, and mobile top bar had cramped touch targets.
- **Key Changes:** Deduplicated alerts in `gtfs.ts` by normalized header; generated plain-language explanations. Created `AlertModal.tsx` with official verification channels. Overhauled mobile top bar into 2 clusters, moved settings into `MobileSettingsModal.tsx`, unified mobile bottom sheet into a single-container flow with sticky navigation, and added major transit hubs. Fixed floating R15 train by syncing `displayed` state immediately in `interpolate.ts`.
- **Files Modified:** `gtfs.ts`, `renfe.ts`, `interpolate.ts`, `AlertModal.tsx`, `MobileSettingsModal.tsx`, `MobileLayout.tsx`, `App.tsx`.
- **Verification:** `npm test` passed, `npx tsc --noEmit` passed, `next build` succeeded.

### Session: 2026-10-04 (Favorite Stations, Departures Line Filtering & Rodalies RSS Alerts)
- **Context:** User requested favorite stations, line filtering on departures board, and Rodalies service incidents.
- **Key Changes:** Created `useFavoriteStations` hook (`savedStations.ts`) with localStorage persistence and cross-tab sync. Added line filter pills to `DeparturesBoard.tsx`. Integrated official Rodalies XML RSS feed (`incidencies_rodalies_rss_ca_ES.xml`) in `renfe.ts` and unified in `/api/alerts`. Updated PWA install guidance in `MobileSettingsModal.tsx`.
- **Files Modified:** `savedStations.ts`, `DeparturesBoard.tsx`, `renfe.ts`, `api/alerts`, `App.tsx`, `MobileLayout.tsx`, `StopPanel.tsx`, `i18n.tsx`.
- **Verification:** `npm test` passed, `test-renfe.mts` passed, `npx tsc --noEmit` (0 errors), `next build` passed.

### Session: 2026-10-04 (Truthful Departures & Universal Multi-Modal Journey Planner)
- **Context:** Weather disruptions caused phantom countdowns when lines were halted; journey planner only supported FGC.
- **Key Changes:** Added live line suspension and cancellation cross-checks in `/api/departures`. Created persistent alert registry in `gtfs.ts`. Integrated Renfe GTFS timetable (`rodalies-timetable.json`, `renfeTimetable.ts`) into CSA planner (`planner.ts`). Added physical walking footpaths (`footpaths.ts`) connecting FGC and Rodalies hubs (Catalunya, Terrassa, Sabadell, Martorell, Gornal, Provença, L'Hospitalet). Updated `journeyPath.ts` and `TripPlanner.tsx` with walking legs and operator pills.
- **Files Modified:** `planner.ts`, `footpaths.ts`, `renfeTimetable.ts`, `api/departures`, `DeparturesBoard.tsx`, `journeyPath.ts`, `TripPlanner.tsx`.
- **Verification:** `npm test` passed, `npx tsc --noEmit` passed, `next build` succeeded.

### Session: 2026-10-04 (ATM Fares, Route Stops Timeline, Network Status & Live Trip HUD)
- **Context:** User requested fare zones, intermediate stop accordion, line focus, and live journey tracking.
- **Key Changes:** Created `src/lib/fares.ts` (ATM Barcelona Zones 1–6 pricing). Added expandable vertical stop timeline (`JourneyLegStop[]`) to `TripPlanner.tsx`. Created `NetworkStatusModal.tsx` (corridor health overview). Added `focusedLine` highlighting in `MapView.tsx`. Added Metro/Tram transfer chips (`metroInterchanges.ts`). Created `LiveTripHud.tsx` (GPS/transit live progress bar). Created client-side onboarding tour and delayed donation modal (`userEngagement.ts`, `OnboardingModal.tsx`, `DonationModal.tsx`).
- **Files Modified:** `fares.ts`, `planner.ts`, `TripPlanner.tsx`, `NetworkStatusModal.tsx`, `MapView.tsx`, `metroInterchanges.ts`, `LiveTripHud.tsx`, `userEngagement.ts`, `OnboardingModal.tsx`, `DonationModal.tsx`.
- **Verification:** `npm test` passed, `npx tsc --noEmit` (0 errors), `next build` passed.
