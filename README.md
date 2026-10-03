# Andana

> **The Catalan rail companion that answers what actually matters on the platform.**  
> Real-time train positions, station departures with live delay countdowns, corridor service alerts, and timetable journey planning for **FGC** (*Ferrocarrils de la Generalitat de Catalunya*) and **Rodalies de Catalunya** (*Renfe*).

Official transit maps often only show static schedules or raw dot markers on a map. **Andana** starts there and answers the questions commuters face on the platform every day: *where is my train, how late is it running, how crowded is it, and what's the fastest way to get to my destination?*

> An *andana* is a station platform in Catalan — the place you're standing when you open this app.

---

## Key Features

- **Dual-Network Coverage (FGC + Rodalies de Catalunya)**
  - Seamlessly switch between **FGC**, **Rodalies (Renfe)**, or **Both** concurrently on the map and departures board.
  - Covers Barcelona-Vallès (L6, L7, S1, S2), Llobregat-Anoia (L8, S3, S4, S8, S9, R5, R6), Rodalies commuter lines (R1, R2, R2 Nord, R2 Sud, R3, R4, R7, R8), and regional lines (R11–R17, RL, RG, RT).
- **Smooth 60fps Train Interpolation**
  - Upstream feeds report discrete fixes every 20–30s. Andana projects trains onto their route polylines and dead-reckons velocity based on distance to the upcoming stop and live ETA, ensuring trains glide smoothly instead of jumping.
- **Station Departures Board with Real-Time Delay Countdowns**
  - View upcoming departures per station with live countdown clocks that combine scheduled GTFS timetable times with each line's current median real-time delay.
- **Connection Scan Algorithm (CSA) Trip Planner**
  - Ultra-fast routing over full GTFS timetable feeds.
  - Applies boarding transfer penalties to avoid redundant train-hopping on parallel corridors.
  - Enriched with live per-line delays for same-day trips, step-free accessibility preferences, and calendar window lookahead.
- **Corridor-Deduplicated Service Alerts**
  - Alerts are grouped by transport corridor with publication timestamps, plain-language disruption details, and direct links to official operator advisories.
- **Per-Car Occupancy (FGC)**
  - Visual passenger load percentages for individual train cars (M1 / M2 / Mi / Ri) so passengers know where on the platform to board.
- **Station Amenity & Accessibility Details**
  - Step-free accessibility itineraries, local weather forecasts, and real-time environmental air quality (NO₂, O₃, PM10, IQAM) per station.
- **Overhauled Mobile UX & Installable PWA**
  - Velocity-aware bottom sheet with notch-aware ceiling clamping so handle controls never slip under the top navigation bar.
  - Installable Progressive Web App (PWA) with offline shell caching via Service Worker.
- **Trilingual & Themed**
  - Full native support for Catalan (`ca`, canonical), Spanish (`es`), and English (`en`).
  - Dark and light theme modes.

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript (strict)
- **Mapping**: [MapLibre GL](https://maplibre.org) via `react-map-gl/maplibre`, CARTO Positron and Dark Matter basemaps
- **Routing Engine**: Custom Connection Scan Algorithm (CSA) in TypeScript
- **Realtime Feeds**: `gtfs-realtime-bindings` for decoding GTFS-RT protobuf feeds
- **Styling**: Semantic CSS variables (`var(--bg)`, `var(--accent)`, `var(--muted)`) with theme toggling
- **Data Sources**:
  - [dadesobertes.fgc.cat](https://dadesobertes.fgc.cat) (FGC Open Data Portal: positions, GTFS schedules, GTFS-RT trip updates & occupancy, accessibility, air quality)
  - Official Rodalies de Catalunya / Renfe telemetry and schedule feeds

---

## Getting Started

### Prerequisites
- Node.js 20+ (Node 22 recommended)
- npm

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/vibecoder1809/andana.git
cd andana

# Install dependencies
npm install

# Start local dev server (Turbopack)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Verification & Testing

```bash
# Run unit and infrastructure validation checks
npm test

# Run TypeScript typechecker
npx tsc --noEmit

# Create optimized production build
npm run build
```

*(On Windows PowerShell, use `cmd /c npm ...` or `cmd /c npx ...` if execution policies restrict script runners).*

---

## Independent Project Note

This project began as "Geotren" before adopting **Andana** to differentiate from FGC's internal map brand. Andana is an independent, open-source companion project built on public open data. It is not affiliated with, sponsored by, or endorsed by Ferrocarrils de la Generalitat de Catalunya (FGC) or Renfe/Rodalies de Catalunya.

---

## License

[MIT](LICENSE)
