import { fetchTrains } from '@/lib/trains'
import { fetchTripInfo, fetchVehiclePositions } from '@/lib/gtfs'
import { fetchRenfeTrains } from '@/lib/renfe'
import { cached } from '@/lib/cache'
import type { Train } from '@/types'

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

// Upstream feeds refresh every ~10-20s; TTL collapses client polling.
const TTL_MS = 8_000

async function loadTrains(): Promise<Train[]> {
  const [fgcResult, renfeResult] = await Promise.allSettled([
    (async () => {
      const trains = await fetchTrains()
      for (const t of trains) t.operator = 'fgc'
      try {
        const [info, vehicles] = await Promise.all([
          fetchTripInfo().catch(() => new Map()),
          fetchVehiclePositions().catch(() => []),
        ])
        const occByTrip = new Map(
          vehicles.filter(v => v.occupancyStatus != null).map(v => [v.tripId, v.occupancyStatus as number]),
        )
        for (const train of trains) {
          const tripInfo = info.get(train.id)
          if (tripInfo != null) {
            train.delayMinutes = tripInfo.delay
            if (tripInfo.nextStopEta != null) train.nextStopEta = tripInfo.nextStopEta
          }
          if (train.occupancyPercent === 0 && train.wagons == null) {
            const status = occByTrip.get(train.id)
            if (status != null && OCCUPANCY_PERCENT[status] != null) {
              train.occupancyPercent = OCCUPANCY_PERCENT[status]
            }
          }
        }
      } catch (err) {
        console.error('FGC GTFS-RT enrichment failed:', err)
      }
      return trains
    })(),
    fetchRenfeTrains().catch(err => {
      console.error('Renfe trains fetch failed:', err)
      return [] as Train[]
    }),
  ])

  const fgcTrains = fgcResult.status === 'fulfilled' ? fgcResult.value : []
  const renfeTrains = renfeResult.status === 'fulfilled' ? renfeResult.value : []

  if (fgcTrains.length === 0 && renfeTrains.length === 0) {
    if (fgcResult.status === 'rejected') throw fgcResult.reason
  }

  return [...fgcTrains, ...renfeTrains]
}

export async function GET() {
  try {
    return Response.json(await cached('all_trains', TTL_MS, loadTrains))
  } catch (err) {
    console.error('Train positions API failed:', err)
    return Response.json({ error: 'trains_unavailable' }, { status: 503 })
  }
}
