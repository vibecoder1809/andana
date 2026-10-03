import { fetchRoutes } from '@/lib/gtfs'
import { fetchRenfeRoutes } from '@/lib/renfe'
import type { Route } from '@/types'

export const revalidate = 86400

export async function GET() {
  try {
    const [fgcRoutes, renfeRoutes] = await Promise.all([
      fetchRoutes().then(routes => {
        for (const r of routes) r.operator = 'fgc'
        return routes
      }).catch(err => {
        console.error('FGC routes fetch failed:', err)
        return [] as Route[]
      }),
      fetchRenfeRoutes().catch(err => {
        console.error('Renfe routes fetch failed:', err)
        return [] as Route[]
      }),
    ])
    return Response.json([...fgcRoutes, ...renfeRoutes])
  } catch (err) {
    console.error('Routes fetch failed:', err)
    return Response.json([])
  }
}
