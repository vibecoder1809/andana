import { planJourneys } from '@/lib/planner'
import { fetchTrains } from '@/lib/geotren'
import { fetchTripDelays } from '@/lib/gtfs'

function parseAfter(raw: string | null): number {
  // Accepts "HH:MM"; defaults to current local time.
  if (raw) {
    const m = raw.match(/^(\d{1,2}):(\d{2})$/)
    if (m) {
      const h = Number(m[1]), min = Number(m[2])
      if (h < 24 && min < 60) return h * 3600 + min * 60
    }
  }
  const now = new Date()
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
}

// Median live delay (minutes) per line, from current train positions.
async function liveLineDelays(): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  try {
    const [trains, delays] = await Promise.all([fetchTrains(), fetchTripDelays()])
    const byLine = new Map<string, number[]>()
    for (const t of trains) {
      const d = delays.get(t.id)
      if (d == null) continue
      const list = byLine.get(t.line)
      if (list) list.push(d)
      else byLine.set(t.line, [d])
    }
    for (const [line, list] of byLine) {
      list.sort((a, b) => a - b)
      const mid = list[Math.floor(list.length / 2)]
      if (mid > 0) result.set(line, mid)
    }
  } catch (err) {
    console.error('Live delay enrichment failed:', err)
  }
  return result
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const after = parseAfter(url.searchParams.get('after'))

  if (!from || !to) {
    return Response.json({ error: 'Missing from/to' }, { status: 400 })
  }
  if (from === to) {
    return Response.json({ error: "L'origen i la destinació són iguals" }, { status: 400 })
  }

  try {
    const lineDelays = await liveLineDelays()
    const journeys = await planJourneys(from, to, after, 4, lineDelays)
    return Response.json({ journeys })
  } catch (err) {
    console.error('Plan failed:', err)
    return Response.json({ error: 'No es pot calcular la ruta' }, { status: 503 })
  }
}
