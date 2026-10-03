import { getDepartures } from '@/lib/planner'
import { fetchLineDelays } from '@/lib/gtfs'
import { fetchRenfeDepartures } from '@/lib/renfe'
import { serviceSeconds } from '@/lib/serviceTime'

// Seconds since local midnight in Europe/Madrid, matching the planner's
// depTime units. Never the server clock — see lib/serviceTime.ts.
const nowSeconds = serviceSeconds

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

    const [departures, lineDelays] = await Promise.all([
      getDepartures(station, nowSeconds(), 8),
      fetchLineDelays(),
    ])
    const enriched = departures.map(d => ({
      line: d.line,
      headsign: d.headsign,
      depTime: d.depTime,
      delayMin: lineDelays.get(d.line) ?? 0,
    }))
    return Response.json({ departures: enriched })
  } catch (err) {
    console.error('Departures failed:', err)
    return Response.json({ error: 'departures_unavailable' }, { status: 503 })
  }
}
