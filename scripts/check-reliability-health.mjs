// Health check for the reliability feature against any deployment:
//
//   node scripts/check-reliability-health.mjs https://andana.vercel.app
//
// Answers the one question that is otherwise invisible from the UI: the app
// deliberately renders nothing when there's no history, so "Supabase isn't
// connected" and "no data for this line yet" look identical to a user. This
// tells them apart and says what to do about it.

const base = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

// A spread of lines across the three FGC groups, so a per-line gap doesn't read
// as a system-wide outage.
const LINES = ['L6', 'L7', 'S1', 'S2', 'R5', 'R6']

const res = await fetch(`${base}/api/reliability?lines=${LINES.join(',')}`)
if (!res.ok) {
  console.error(`✗ ${base}/api/reliability returned HTTP ${res.status}`)
  process.exit(1)
}

const { stats, configured } = await res.json()

if (configured === false) {
  console.error(`✗ ${base} has no Supabase credentials.`)
  console.error('')
  console.error('  The capture cron and the app read the same database but are')
  console.error('  configured separately: GitHub Actions secrets drive the cron,')
  console.error('  and the hosting env drives the app. Setting only the former')
  console.error('  collects data that the app can never read.')
  console.error('')
  console.error('  Fix: add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the')
  console.error('  deployment environment (Vercel → Settings → Environment')
  console.error('  Variables), then redeploy.')
  process.exit(1)
}

const withData = Object.entries(stats)
  .filter(([, buckets]) => buckets.length > 0)

if (withData.length === 0) {
  // `configured` was added alongside this script; an older deployment omits it,
  // in which case we can't distinguish the two causes from out here.
  const known = configured === true
  console.error(`✗ ${base} returned no history for any line.`)
  console.error('')
  if (known) {
    console.error('  Supabase credentials ARE set, so the database itself is empty:')
    console.error('  either the capture cron has never run, or its inserts are failing.')
    console.error('  Check: GitHub → Actions → Capture FGC delays → latest run log.')
  } else {
    console.error('  Most likely cause: the deployment has no Supabase credentials.')
    console.error('')
    console.error('  The cron and the app read the same database but are configured')
    console.error('  separately — GitHub Actions secrets drive the cron, the hosting')
    console.error('  env drives the app. Setting only the former collects data that')
    console.error('  the app can never read, and the UI hides that by design.')
    console.error('')
    console.error('  Fix: add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel →')
    console.error('  Settings → Environment Variables, then redeploy. Re-run this')
    console.error('  script afterwards; it will then report which cause applies.')
  }
  process.exit(1)
}

console.log(`✓ ${base} — reliability history is live`)
for (const [line, buckets] of withData) {
  const total = buckets.reduce((n, b) => n + b.samples, 0)
  console.log(`  ${line.padEnd(4)} ${String(buckets.length).padStart(3)} buckets, ${total} observations`)
}
const missing = LINES.filter(l => !withData.some(([line]) => line === l))
if (missing.length > 0) console.log(`  (no history yet for ${missing.join(', ')})`)
