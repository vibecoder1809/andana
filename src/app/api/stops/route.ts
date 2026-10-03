import { fetchStops } from '@/lib/gtfs'
import { fetchRenfeStations } from '@/lib/renfe'
import type { Stop } from '@/types'

export const revalidate = 86400

export async function GET() {
  try {
    const [fgcStops, renfeStops] = await Promise.all([
      fetchStops().then(stops => {
        for (const s of stops) s.operator = 'fgc'
        return stops
      }).catch(err => {
        console.error('FGC stops fetch failed:', err)
        return [] as Stop[]
      }),
      fetchRenfeStations().catch(err => {
        console.error('Renfe stations fetch failed:', err)
        return [] as Stop[]
      }),
    ])
    return Response.json([...fgcStops, ...renfeStops])
  } catch (err) {
    console.error('Stops fetch failed:', err)
    return Response.json([])
  }
}
