import { fetchAlerts } from '@/lib/gtfs'

export async function GET() {
  try {
    const alerts = await fetchAlerts()
    return Response.json(alerts)
  } catch (err) {
    console.error('Alerts fetch failed:', err)
    return Response.json([])
  }
}
