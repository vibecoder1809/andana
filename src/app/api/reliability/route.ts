// Aggregated line reliability — median & p90 delay by weekday/weekend and
// 30-minute local-time bucket, read from the Supabase `delay_stats` view.
//
// Server-side only: the service-role key never reaches the client. Degrades to
// an empty result (not an error) when Supabase isn't configured yet or the
// history hasn't accrued, so the UI can call it unconditionally.

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export interface ReliabilityBucket {
  day_type: 'weekday' | 'weekend'
  bucket_min: number   // minutes since local midnight, start of the 30-min slot
  median_delay: number
  p90_delay: number
  samples: number
}

export async function GET(req: Request) {
  const line = new URL(req.url).searchParams.get('line')
  if (!line) return Response.json({ error: 'Missing line' }, { status: 400 })

  // Not wired up yet → behave as "no history", so callers need no special case.
  if (!SUPABASE_URL || !SUPABASE_KEY) return Response.json({ line, buckets: [] })

  try {
    const url = `${SUPABASE_URL}/rest/v1/delay_stats`
      + `?line=eq.${encodeURIComponent(line)}`
      + `&select=day_type,bucket_min,median_delay,p90_delay,samples`
      + `&order=bucket_min.asc`
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      // Reliability shifts slowly; a short cache spares Supabase on hot lines.
      next: { revalidate: 900 },
    })
    if (!res.ok) throw new Error(`supabase ${res.status}`)
    const buckets = (await res.json()) as ReliabilityBucket[]
    return Response.json({ line, buckets })
  } catch (err) {
    console.error('Reliability lookup failed:', err)
    return Response.json({ line, buckets: [] })
  }
}
