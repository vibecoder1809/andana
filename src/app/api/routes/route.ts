import { fetchRoutes } from '@/lib/gtfs'

export const revalidate = 86400

export async function GET() {
  try {
    const routes = await fetchRoutes()
    return Response.json(routes)
  } catch (err) {
    console.error('Routes fetch failed:', err)
    return Response.json([])
  }
}
