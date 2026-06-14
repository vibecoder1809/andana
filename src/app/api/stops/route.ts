import { fetchStops } from '@/lib/gtfs'

export const revalidate = 86400

export async function GET() {
  const stops = await fetchStops()
  return Response.json(stops)
}
