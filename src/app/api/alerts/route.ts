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

    const allAlerts = [...fgcAlerts, ...renfeAlerts].sort((a, b) => {
      const diff = (b.start ?? 0) - (a.start ?? 0)
      if (diff !== 0) return diff
      return a.id.localeCompare(b.id)
    })

    return Response.json(allAlerts)
  } catch (err) {
    console.error('Alerts fetch failed:', err)
    return Response.json([])
  }
}
