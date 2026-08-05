import { getDepartures } from '@/lib/planner'
import { fetchLineDelays } from '@/lib/gtfs'
import { serviceSeconds } from '@/lib/serviceTime'

// Seconds since local midnight in Europe/Madrid, matching the planner's
// depTime units. Never the server clock — see lib/serviceTime.ts.
const nowSeconds = serviceSeconds

// Next scheduled departures from a station (by parent code, e.g. "SC"),
// enriched with the current median live delay for each line.
export async function GET(req: Request) {
  const station = new URL(req.url).searchParams.get('station')
  if (!station) {
    return Response.json({ error: 'missing_params' }, { status: 400 })
  }

  try {
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
