import { fetchStops } from '@/lib/gtfs'
import { fetchRenfeStations } from '@/lib/renfe'
import { getLinesForStation, normalizeLineCode } from '@/lib/lineStops'
import type { Stop } from '@/types'

export const revalidate = 86400

export async function GET() {
  try {
    const [fgcStops, renfeStops] = await Promise.all([
      fetchStops().then(stops => {
        for (const s of stops) {
          s.operator = 'fgc'
          s.lines = getLinesForStation(s.stopId)
        }
        return stops
      }).catch(err => {
        console.error('FGC stops fetch failed:', err)
        return [] as Stop[]
      }),
      fetchRenfeStations().then(stops => {
        for (const s of stops) {
          s.operator = 'renfe'
          const lines = getLinesForStation(s.stopId)
          if (lines.length > 0) {
            s.lines = lines
          } else if (s.lines) {
            s.lines = s.lines.map(normalizeLineCode).filter(Boolean)
          }
        }
        return stops
      }).catch(err => {
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
