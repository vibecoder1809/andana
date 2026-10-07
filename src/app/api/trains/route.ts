import { fetchTrains } from '@/lib/trains'
import { fetchTripInfo } from '@/lib/gtfs'
import { fetchRenfeTrains } from '@/lib/renfe'
import { cached } from '@/lib/cache'
import { isNightRestHours } from '@/lib/serviceTime'
import type { Train, OutageStatus } from '@/types'

// Upstream feeds refresh every ~10-20s; TTL collapses client polling.
const TTL_MS = 8_000

export interface TrainsFeedPayload {
  trains: Train[]
  outages: OutageStatus
}

async function loadTrains(): Promise<TrainsFeedPayload> {
  const [fgcResult, renfeResult] = await Promise.allSettled([
    (async () => {
      const trains = await fetchTrains()
      for (const t of trains) t.operator = 'fgc'
      try {
        const info = await fetchTripInfo().catch(() => new Map())
        for (const train of trains) {
          const tripInfo = info.get(train.id)
          if (tripInfo != null) {
            train.delayMinutes = tripInfo.delay
            if (tripInfo.nextStopEta != null) train.nextStopEta = tripInfo.nextStopEta
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

  const isNight = isNightRestHours()
  // An outage is only detected when service should normally be running,
  // preventing false positives during overnight commercial rest (01:15 - 04:55).
  const fgcOutage = !isNight && (fgcResult.status === 'rejected' || fgcTrains.length === 0)
  const renfeOutage = !isNight && (renfeResult.status === 'rejected' || renfeTrains.length === 0)

  if (fgcTrains.length === 0 && renfeTrains.length === 0 && fgcResult.status === 'rejected' && renfeResult.status === 'rejected') {
    throw fgcResult.reason
  }

  return {
    trains: [...fgcTrains, ...renfeTrains],
    outages: {
      renfe: renfeOutage,
      fgc: fgcOutage,
    },
  }
}

export async function GET() {
  try {
    const data = await cached<TrainsFeedPayload>('all_trains', TTL_MS, loadTrains)
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=8, stale-while-revalidate=15',
        'x-andana-renfe-outage': data.outages.renfe ? '1' : '0',
        'x-andana-fgc-outage': data.outages.fgc ? '1' : '0',
      },
    })
  } catch (err) {
    console.error('Train positions API failed:', err)
    return Response.json(
      {
        error: 'trains_unavailable',
        trains: [],
        outages: { renfe: true, fgc: true },
      },
      { status: 503 },
    )
  }
}
