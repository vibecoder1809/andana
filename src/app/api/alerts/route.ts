import { fetchAlerts } from '@/lib/gtfs'
import { fetchRenfeAlerts } from '@/lib/renfe'

export async function GET() {
  try {
    const [fgcResult, renfeResult] = await Promise.allSettled([
      fetchAlerts(),
      fetchRenfeAlerts(),
    ])

    const fgcAlerts = fgcResult.status === 'fulfilled' ? fgcResult.value : []
    const renfeAlerts = renfeResult.status === 'fulfilled' ? renfeResult.value : []

    if (fgcResult.status === 'rejected') {
      console.error('FGC alerts fetch failed:', fgcResult.reason)
    }
    if (renfeResult.status === 'rejected') {
      console.error('Renfe alerts fetch failed:', renfeResult.reason)
    }

    return Response.json([...fgcAlerts, ...renfeAlerts])
  } catch (err) {
    console.error('Alerts fetch failed:', err)
    return Response.json([])
  }
}
