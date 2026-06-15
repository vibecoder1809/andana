# Geotren

Live map of FGC (Ferrocarrils de la Generalitat de Catalunya) trains in real time.

Built with Next.js 15, Leaflet, and public open-data APIs.

## Features

- Real-time train positions pulled from the FGC API every 15 seconds
- GTFS-RT delay enrichment (punctuality in minutes)
- Per-wagon occupancy chart (M1 / M2 / MI / RI)
- Route geometry overlays on the map
- Air quality (NO₂ / O₃ / PM10 / IQAM) and weather per stop
- Day-session punctuality chart per line
- Dark / light theme
- Mobile-friendly bottom sheet with drag-snap gestures

## Stack

- [Next.js 15](https://nextjs.org) (App Router)
- [Leaflet](https://leafletjs.com) via `react-leaflet`
- [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) font
- Public APIs: [opendata.fgc.cat](https://opendata.fgc.cat), [api.meteo.cat](https://api.meteo.cat), [analisi.osm.cat](https://analisi.osm.cat)

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create `.env.local` (already gitignored):

```env
# GTFS-RT protobuf feed URL — get it from https://opendata.fgc.cat
# Leave empty to run without real-time delay data
FGC_GTFS_RT_URL=
```

No API keys are required — all data sources are open.

## License

MIT
