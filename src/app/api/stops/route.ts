import { fetchStops } from '@/lib/gtfs'

export const revalidate = 86400

export async function GET() {
  try {
    const stops = await fetchStops()
    return Response.json(stops)
  } catch (err) {
    console.error('Stops fetch failed:', err)
    return Response.json([])
  }
}
