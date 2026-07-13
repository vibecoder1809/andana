# Andana

**The FGC app the official one isn't.** Live map, real trip planner, next departures with live delays, and per-car occupancy for the Ferrocarrils de la Generalitat de Catalunya network — all from FGC's public open data.

FGC's official [Geotren](https://geotren.fgc.cat/) shows you where the trains are. Andana starts there and answers the questions that actually matter on the platform: *when is my train, how full is it, and how do I get where I'm going?*

> An *andana* is a station platform in Catalan — the place you're standing when you open this app.

## What it does that the official map doesn't

- **Trip planner** — Connection Scan Algorithm over the full GTFS timetable, biased against pointless transfers, enriched with today's live per-line delays. Plan up to 7 days ahead.
- **Departures board** — next departures per station with a live countdown, adjusted by each line's current median delay.
- **Live ETAs** — per-train delay and next-stop arrival from the GTFS-RT feed, not just a dot on a map.
- **Smooth train movement** — positions are dead-reckoned along the route geometry between feed refreshes, so trains glide instead of teleporting every 30 seconds.
- **Per-car occupancy** — how full each individual car is (M1 / M2 / MI / RI), as a percentage, so you know where to stand.
- **Journey drawing** — your planned trip rendered on the map as color-coded per-line legs, transfers visible at a glance.
- **Station detail** — step-free accessibility itineraries, air quality (NO₂ / O₃ / PM10 / IQAM) and weather per stop.
- **Trilingual UI** — Catalan, Spanish, English. Dark and light themes. Saved favorite and recent routes.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript
- [MapLibre GL](https://maplibre.org) via `react-map-gl`, CARTO basemaps
- `gtfs-realtime-bindings` for decoding GTFS-RT protobuf feeds
- Data: [dadesobertes.fgc.cat](https://dadesobertes.fgc.cat) — FGC's open data portal (train positions, GTFS + GTFS-RT, alerts, accessibility, air quality, weather)

No API keys required — every data source is open.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## A note on the name

This project started as "Geotren" before realizing that's the name of FGC's own product. It's now **Andana** — an independent, unofficial companion app built on FGC's open data. Not affiliated with or endorsed by FGC.

## License

MIT
