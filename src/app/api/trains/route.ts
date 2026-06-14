import { fetchTrains } from '@/lib/geotren'
import { fetchTripDelays } from '@/lib/gtfs'

export async function GET() {
  let trains
  try {
    trains = await fetchTrains()
  } catch (err) {
    console.error('Geotren API failed:', err)
    return Response.json({ error: 'Train position API unavailable' }, { status: 503 })
  }

  try {
    const delays = await fetchTripDelays()
    for (const train of trains) {
      const delay = delays.get(train.id)
      if (delay != null) train.delayMinutes = delay
    }
  } catch (err) {
    // GTFS-RT delay enrichment is best-effort; positions are still valid without it
    console.error('GTFS-RT delay fetch failed:', err)
  }

  return Response.json(trains)
}
