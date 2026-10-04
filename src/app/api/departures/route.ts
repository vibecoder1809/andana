import { getDepartures } from '@/lib/planner'
import { fetchLineDelays, fetchCanceledTrips } from '@/lib/gtfs'
import { fetchTrains } from '@/lib/trains'
import { fetchRenfeDepartures } from '@/lib/renfe'
import { serviceSeconds } from '@/lib/serviceTime'
import type { Departure } from '@/types'

// Seconds since local midnight in Europe/Madrid, matching the planner's
// depTime units. Never the server clock — see lib/serviceTime.ts.
const nowSeconds = serviceSeconds

// High-frequency trunk lines that run every 5-15 min all day long.
// During daytime operating hours, having 0 circulating trains across the whole
// corridor means the service has been halted or suspended. Low-frequency or
// branched lines (e.g. S4, R5, R8) are excluded to prevent false positives.
const HIGH_FREQ_TRUNK_LINES = new Set(['S1', 'S2', 'L6', 'L7'])

// Operating hours window in Europe/Madrid seconds since midnight (06:30 to 23:30)
const SERVICE_DAY_START_S = 6.5 * 3600  // 06:30
const SERVICE_DAY_END_S = 23.5 * 3600   // 23:30
// Lookahead threshold: only flag a departure as suspended if it was supposed
// to depart soon (within 35 minutes) and no train is anywhere on the line.
const SUSPENSION_LOOKAHEAD_S = 35 * 60

// Next scheduled departures from a station.
// Dispatches to Renfe live salidas API for numeric station codes (e.g. 78804)
// or FGC timetable CSA + live delays for FGC stations (e.g. "SC").
export async function GET(req: Request) {
  const url = new URL(req.url)
  const station = url.searchParams.get('station')
  const operator = url.searchParams.get('operator')
  if (!station) {
    return Response.json({ error: 'missing_params' }, { status: 400 })
  }

  const isRenfe = operator === 'renfe' || /^\d+$/.test(station)

  try {
    if (isRenfe) {
      const departures = await fetchRenfeDepartures(station)
      return Response.json({ departures })
    }

    const nowSec = nowSeconds()
    const [departures, lineDelays, liveTrains, canceledTrips] = await Promise.all([
      getDepartures(station, nowSec, 8),
      fetchLineDelays(),
      fetchTrains().catch(() => []),
      fetchCanceledTrips().catch(() => new Set<string>()),
    ])

    const fgcLiveTrains = liveTrains.filter(t => !t.operator || t.operator === 'fgc')
    const runningLines = new Set(fgcLiveTrains.map(t => t.line))
    const isNetworkActive = fgcLiveTrains.length >= 3 // Network is active and reporting fleet
    const isDaytime = nowSec >= SERVICE_DAY_START_S && nowSec <= SERVICE_DAY_END_S

    const enriched: Departure[] = departures.map(d => {
      // Lookahead check: only evaluate suspension for imminent departures (within 35 min)
      const isImminentOrSoon = (d.depTime - nowSec) <= SUSPENSION_LOOKAHEAD_S && (d.depTime - nowSec) >= -300

      // A line is ONLY flagged as suspended if:
      // 1. We are within normal daytime operating hours (never at night).
      // 2. The departure is imminent or approaching (within 35 min).
      // 3. The line is a high-frequency trunk line (S1, S2, L6, L7) where trains circulate constantly.
      // 4. The rest of the network is actively reporting trains, but this line has 0.
      const isSuspended = isDaytime && isImminentOrSoon && isNetworkActive && HIGH_FREQ_TRUNK_LINES.has(d.line) && !runningLines.has(d.line)
      
      // Explicit cancellation comes directly from official GTFS-RT feed (scheduleRelationship === 3)
      const isCancelled = canceledTrips.has(String(d.tripId))

      return {
        line: d.line,
        headsign: d.headsign,
        depTime: d.depTime,
        delayMin: lineDelays.get(d.line) ?? 0,
        isSuspended,
        isCancelled,
      }
    })
    return Response.json({ departures: enriched })
  } catch (err) {
    console.error('Departures failed:', err)
    return Response.json({ error: 'departures_unavailable' }, { status: 503 })
  }
}
