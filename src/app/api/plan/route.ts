import { planJourneys, MAX_PLAN_DAYS_AHEAD } from '@/lib/planner'
import { fetchLineDelays } from '@/lib/gtfs'
import { serviceSeconds, serviceDate, serviceDatePlus } from '@/lib/serviceTime'

function parseAfter(raw: string | null): number {
  // Accepts "HH:MM"; defaults to current local time.
  if (raw) {
    const m = raw.match(/^(\d{1,2}):(\d{2})$/)
    if (m) {
      const h = Number(m[1]), min = Number(m[2])
      if (h < 24 && min < 60) return h * 3600 + min * 60
    }
  }
  return serviceSeconds()
}

// Validate a requested service date: must be YYYY-MM-DD within
// [today, today + MAX_PLAN_DAYS_AHEAD] **in Europe/Madrid**. Returns the ISO
// date, or null for today/invalid (planner treats undefined as today).
// Compared as plain date strings, which sort correctly in ISO form and keep
// the server's own timezone out of it entirely.
function parseDate(raw: string | null): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const today = serviceDate()
  if (raw < today || raw > serviceDatePlus(MAX_PLAN_DAYS_AHEAD)) return null
  return raw === today ? null : raw
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const after = parseAfter(url.searchParams.get('after'))
  const date = parseDate(url.searchParams.get('date'))
  const stepFree = url.searchParams.get('stepFree') === '1'

  // Machine-readable error codes, not prose: this API is consumed by a
  // trilingual client (see AGENTS.md) — the client maps `code` to a
  // translated string via i18n, so no UI-facing language decision is made
  // here on the server.
  if (!from || !to) {
    return Response.json({ error: 'missing_params' }, { status: 400 })
  }
  if (from === to) {
    return Response.json({ error: 'same_station' }, { status: 400 })
  }

  try {
    // Live delays only make sense for today's plan; skip the enrichment (and
    // its network cost) when planning a future date.
    const lineDelays = date ? undefined : await fetchLineDelays()
    const journeys = await planJourneys(from, to, after, 4, lineDelays, date ?? undefined, stepFree)
    return Response.json({ journeys })
  } catch (err) {
    console.error('Plan failed:', err)
    return Response.json({ error: 'plan_unavailable' }, { status: 503 })
  }
}
