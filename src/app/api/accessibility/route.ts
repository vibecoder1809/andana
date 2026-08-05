import { findAccessibleItinerary } from '@/lib/accessibility'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  if (!from || !to) {
    return Response.json({ error: 'missing_params' }, { status: 400 })
  }

  try {
    const itinerary = await findAccessibleItinerary(from, to)
    return Response.json({ itinerary })
  } catch (err) {
    console.error('Accessibility lookup failed:', err)
    return Response.json({ error: 'accessibility_unavailable' }, { status: 503 })
  }
}
