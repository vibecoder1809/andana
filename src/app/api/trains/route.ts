import { fetchTrains } from '@/lib/geotren'
import { fetchTripInfo } from '@/lib/gtfs'

export async function GET() {
  let trains
  try {
    trains = await fetchTrains()
  } catch (err) {
    console.error('Geotren API failed:', err)
    return Response.json({ error: 'Train position API unavailable' }, { status: 503 })
  }

  try {
    const info = await fetchTripInfo()
    for (const train of trains) {
      const tripInfo = info.get(train.id)
      if (tripInfo != null) {
        train.delayMinutes = tripInfo.delay
        if (tripInfo.nextStopEta != null) train.nextStopEta = tripInfo.nextStopEta
      }
    }
  } catch (err) {
    console.error('GTFS-RT enrichment failed:', err)
  }

  return Response.json(trains)
}
