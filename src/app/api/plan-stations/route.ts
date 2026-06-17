import { getStations } from '@/lib/planner'

export async function GET() {
  try {
    const stations = await getStations()
    return Response.json(stations)
  } catch (err) {
    console.error('Planner stations failed:', err)
    return Response.json({ error: 'Timetable unavailable' }, { status: 503 })
  }
}
