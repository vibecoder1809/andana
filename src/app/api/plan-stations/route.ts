import { getStations } from '@/lib/planner'

export const revalidate = 86400

export async function GET() {
  try {
    const stations = await getStations()
    return Response.json(stations, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('Planner stations failed:', err)
    return Response.json({ error: 'timetable_unavailable' }, { status: 503 })
  }
}
