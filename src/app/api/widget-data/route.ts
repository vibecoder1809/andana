import { fetchTrains } from '@/lib/trains'
import { fetchAlerts } from '@/lib/gtfs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [trains, alerts] = await Promise.all([
      fetchTrains().catch(() => []),
      fetchAlerts().catch(() => []),
    ])

    const fgcCount = trains.filter(t => t.operator !== 'renfe').length
    const renfeCount = trains.filter(t => t.operator === 'renfe').length

    return Response.json({
      timestamp: new Date().toISOString(),
      trains: {
        total: trains.length,
        fgc: fgcCount,
        renfe: renfeCount,
      },
      alertsCount: alerts.length,
      alerts: alerts.slice(0, 5).map(a => ({
        id: a.id,
        header: a.header,
        routes: a.routes,
        operator: a.operator,
      })),
    })
  } catch (err: unknown) {
    return Response.json(
      { error: 'failed_to_fetch_widget_data', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
