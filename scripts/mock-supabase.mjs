// Local stand-in for Supabase PostgREST, used to verify the reliability chain
// end to end without the production service-role key. Serves `delay_stats`-
// shaped rows (including numerics-as-strings, which PostgREST really does) so
// the API route's parsing and the UI's thresholds are exercised for real.
//
//   node scripts/mock-supabase.mjs            # listens on :54321
//   SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY=test npm start

import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? 54321)

// Lines the capture job has actually seen. Anything else returns no rows, as
// the real view does — "no history for this line" is a case the UI must handle.
const KNOWN = { L6: 4.2, S1: 3.1, R5: 1.4, L7: 2.2, S2: 2.8 }

// A plausible commuter shape: fine off-peak, degrading through the morning
// peak, worse on L6/S1 than the regional R5. Weekend is calmer.
function rowsFor(line) {
  const peak = KNOWN[line]
  if (peak === undefined) return []
  const out = []
  for (let m = 5 * 60; m < 24 * 60; m += 30) {
    const h = m / 60
    // Morning (7-9:30) and evening (17-19:30) humps.
    const hump = Math.max(
      Math.exp(-((h - 8.2) ** 2) / 1.2),
      Math.exp(-((h - 18.2) ** 2) / 1.5) * 0.85,
    )
    for (const day_type of ['weekday', 'weekend']) {
      const scale = day_type === 'weekend' ? 0.3 : 1
      const median = Math.round(peak * hump * scale * 10) / 10
      out.push({
        line,
        day_type,
        bucket_min: m,
        // PostgREST returns numeric columns as JSON strings; mirror that so the
        // route's Number() coercion is actually under test.
        median_delay: median.toFixed(1),
        p90_delay: (median * 2.4 + 1).toFixed(1),
        // Thin out the earliest slots so the MIN_SAMPLES cutoff is exercised.
        samples: String(m < 6 * 60 ? 4 : 140),
      })
    }
  }
  return out
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (!url.pathname.startsWith('/rest/v1/delay_stats')) {
    res.writeHead(404).end('[]')
    return
  }
  // Parse the PostgREST `line=in.(A,B)` filter the route builds.
  const filter = url.searchParams.get('line') ?? ''
  const m = filter.match(/^in\.\(([^)]*)\)$/)
  const lines = m ? m[1].split(',').filter(Boolean) : []
  const body = JSON.stringify(lines.flatMap(rowsFor))
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(body)
}).listen(PORT, () => console.log(`mock supabase on http://localhost:${PORT}`))
