// Aggregated line reliability — median & p90 delay by weekday/weekend and
// 30-minute local-time bucket, read from the Supabase `delay_stats` view.
//
// Server-side only: the service-role key never reaches the client. Degrades to
// an empty result (not an error) when Supabase isn't configured yet or the
// history hasn't accrued, so the UI can call it unconditionally.
//
// Accepts either `?line=L6` (single) or `?lines=L6,S1,R5` (batch). A journey
// touches several lines and the map shows many at once, so the batch form
// exists to keep that one round trip instead of N.

import type { ReliabilityBucket } from '@/lib/reliability'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Bound the batch so a crafted query can't ask for an unbounded IN list.
const MAX_LINES = 25

type Row = ReliabilityBucket & { line: string }

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const raw = params.get('lines') ?? params.get('line') ?? ''
  const lines = [...new Set(
    raw.split(',')
      .map(s => s.trim())
      // Line names are short alphanumerics (L6, S1, R5, RL...); reject anything
      // else rather than interpolating it into the PostgREST filter.
      .filter(s => /^[A-Za-z0-9]{1,6}$/.test(s)),
  )].slice(0, MAX_LINES)

  if (lines.length === 0) {
    return Response.json({ error: 'missing_params' }, { status: 400 })
  }

  const empty: Record<string, ReliabilityBucket[]> = Object.fromEntries(lines.map(l => [l, []]))

  // Not wired up yet → behave as "no history", so callers need no special case.
  // `configured` lets an operator tell "Supabase isn't connected" apart from
  // "connected, but no history for this line yet". Both look identical to the UI
  // by design, which would otherwise make a missing env var invisible.
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Response.json({ stats: empty, configured: false })
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/delay_stats`
      + `?line=in.(${lines.join(',')})`
      + `&select=line,day_type,bucket_min,median_delay,p90_delay,samples`
      + `&order=bucket_min.asc`
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      // Reliability shifts slowly; a short cache spares Supabase on hot lines.
      next: { revalidate: 900 },
    })
    if (!res.ok) throw new Error(`supabase ${res.status}`)
    const rows = (await res.json()) as Row[]

    const stats = { ...empty }
    for (const r of rows) {
      // Postgres returns numeric as a string over PostgREST; coerce so the
      // client can do arithmetic on these without re-checking types.
      stats[r.line]?.push({
        day_type: r.day_type,
        bucket_min: Number(r.bucket_min),
        median_delay: Number(r.median_delay),
        p90_delay: Number(r.p90_delay),
        samples: Number(r.samples),
      })
    }
    return Response.json({ stats, configured: true })
  } catch (err) {
    console.error('Reliability lookup failed:', err)
    return Response.json({ stats: empty, configured: true })
  }
}
