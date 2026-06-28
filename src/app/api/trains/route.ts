import { fetchTrains } from '@/lib/geotren'
import { fetchTripInfo, fetchVehiclePositions } from '@/lib/gtfs'

// GTFS occupancy_status (0–8) → rough percentage, for trains whose
// posicionament feed reports no per-wagon occupancy.
const OCCUPANCY_PERCENT: Record<number, number> = {
  0: 10,  // EMPTY
  1: 25,  // MANY_SEATS_AVAILABLE
  2: 45,  // FEW_SEATS_AVAILABLE
  3: 65,  // STANDING_ROOM_ONLY
  4: 85,  // CRUSHED_STANDING_ROOM_ONLY
  5: 100, // FULL
}

export async function GET() {
  let trains
  try {
    trains = await fetchTrains()
  } catch (err) {
    console.error('Geotren API failed:', err)
    return Response.json({ error: 'Train position API unavailable' }, { status: 503 })
  }

  try {
    const [info, vehicles] = await Promise.all([fetchTripInfo(), fetchVehiclePositions().catch(() => [])])
    const occByTrip = new Map(
      vehicles.filter(v => v.occupancyStatus != null).map(v => [v.tripId, v.occupancyStatus as number]),
    )
    for (const train of trains) {
      const tripInfo = info.get(train.id)
      if (tripInfo != null) {
        train.delayMinutes = tripInfo.delay
        if (tripInfo.nextStopEta != null) train.nextStopEta = tripInfo.nextStopEta
      }
      // Fall back to official GTFS-RT occupancy when posicionament has none.
      if (train.occupancyPercent === 0 && train.wagons == null) {
        const status = occByTrip.get(train.id)
        if (status != null && OCCUPANCY_PERCENT[status] != null) {
          train.occupancyPercent = OCCUPANCY_PERCENT[status]
        }
      }
    }
  } catch (err) {
    console.error('GTFS-RT enrichment failed:', err)
  }

  return Response.json(trains)
}
