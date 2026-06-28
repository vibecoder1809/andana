import type { Journey, Route, Stop } from '@/types'
import { LINE_COLORS } from './constants'
import { buildPolyline, clipPolyline, type Polyline } from './geometry'

// A drawable journey: one colored sub-path per leg, plus the endpoint coords so
// the map can fit bounds and mark the interchange stations.
export interface JourneyPath {
  legs: Array<{
    line: string
    color: string
    coords: [number, number][]   // [lng, lat] along the travelled line
  }>
  // Every boarding/alighting point in order (origin, each transfer, destination).
  stops: Array<{ name: string; lng: number; lat: number }>
}

// Resolve a planner station code to a coordinate using the live stops list.
// Stop ids look like `<CODE><n>` (e.g. `BV1`), so we match by code prefix and
// fall back to a case-insensitive name match.
function findCoord(
  code: string,
  name: string,
  stops: Stop[],
): [number, number] | null {
  const byCode = stops.find(s => s.stopId.replace(/\d+$/, '') === code)
  if (byCode) return [byCode.lng, byCode.lat]
  const byName = stops.find(s => s.name.toLowerCase() === name.toLowerCase())
  if (byName) return [byName.lng, byName.lat]
  return null
}

/**
 * Build the drawable path for a journey. For each leg we take that line's route
 * geometry and clip it to the portion between the leg's boarding and alighting
 * stations, so the drawn path follows the real track. If a leg's geometry is
 * missing we fall back to a straight segment between the two stations.
 */
export function buildJourneyPath(
  journey: Journey,
  routes: Route[],
  stops: Stop[],
  lineColors: Record<string, string>,
): JourneyPath {
  const plCache = new Map<string, Polyline | null>()
  const getPolyline = (line: string): Polyline | null => {
    if (plCache.has(line)) return plCache.get(line)!
    const route = routes.find(r => r.shortName === line)
    const pl = route?.geometry ? buildPolyline(route.geometry.coordinates) : null
    plCache.set(line, pl)
    return pl
  }

  const legs: JourneyPath['legs'] = []
  const pathStops: JourneyPath['stops'] = []

  journey.legs.forEach((leg, i) => {
    const from = findCoord(leg.fromCode, leg.fromName, stops)
    const to = findCoord(leg.toCode, leg.toName, stops)

    if (i === 0 && from) pathStops.push({ name: leg.fromName, lng: from[0], lat: from[1] })
    if (to) pathStops.push({ name: leg.toName, lng: to[0], lat: to[1] })

    const color = lineColors[leg.line] || LINE_COLORS[leg.line] || '#7a82a0'
    if (!from || !to) return

    const pl = getPolyline(leg.line)
    const coords = pl ? clipPolyline(pl, from, to) : [from, to]
    legs.push({ line: leg.line, color, coords })
  })

  return { legs, stops: pathStops }
}
