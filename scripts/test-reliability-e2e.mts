// End-to-end check of the reliability chain against a running server:
//   HTTP /api/reliability  →  bucket selection  →  the sentence shown to users.
//
// Requires the app on $BASE (default :3112). Point SUPABASE_URL at
// scripts/mock-supabase.mjs to exercise it without production credentials:
//
//   node scripts/mock-supabase.mjs &
//   SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY=test npx next start -p 3112
//   node --experimental-strip-types scripts/test-reliability-e2e.mts

import assert from 'node:assert/strict'
import { bucketFor, typicalFrom, type ReliabilityBucket } from '../src/lib/reliability.ts'

const BASE = process.env.BASE ?? 'http://localhost:3112'

let checks = 0
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); checks++ }

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`)
  return { status: res.status, body: await res.json() as Record<string, unknown> }
}

// ── contract ────────────────────────────────────────────────────────────
{
  const { status, body } = await get('/api/reliability')
  ok(status === 400, 'no line → 400')
  ok(typeof body.error === 'string', 'error message present')
}

{
  // Junk must not reach the PostgREST filter; it's dropped, leaving no lines.
  const { status } = await get('/api/reliability?lines=' + encodeURIComponent("L6');drop"))
  ok(status === 400, 'injection-shaped input is rejected, not forwarded')
}

{
  const { body } = await get('/api/reliability?lines=ZZZ9')
  const stats = body.stats as Record<string, ReliabilityBucket[]>
  ok(Array.isArray(stats.ZZZ9), 'unknown line still returns an array')
  ok(stats.ZZZ9.length === 0, 'unknown line has no history')
}

// ── real payload shape ──────────────────────────────────────────────────
const { body } = await get('/api/reliability?lines=L6,R5')
const stats = body.stats as Record<string, ReliabilityBucket[]>

ok(Object.keys(stats).sort().join(',') === 'L6,R5', 'every requested line is keyed')

const l6 = stats.L6
if (l6.length === 0) {
  console.log('e2e: no history served (Supabase unset?) — contract checks only')
  console.log(`reliability e2e: ${checks} checks passed`)
  process.exit(0)
}

for (const b of l6) {
  ok(typeof b.median_delay === 'number' && Number.isFinite(b.median_delay), 'median is a real number')
  ok(typeof b.p90_delay === 'number' && Number.isFinite(b.p90_delay), 'p90 is a real number')
  ok(typeof b.samples === 'number' && Number.isFinite(b.samples), 'samples is a real number')
  ok(b.day_type === 'weekday' || b.day_type === 'weekend', 'day_type is valid')
  ok(b.bucket_min % 30 === 0 && b.bucket_min >= 0 && b.bucket_min < 1440, 'bucket is a valid slot')
  ok(b.p90_delay >= b.median_delay, 'p90 is never below median')
}

// Buckets must be unique per (day_type, bucket_min) or lookups are ambiguous.
const seen = new Set(l6.map(b => `${b.day_type}@${b.bucket_min}`))
ok(seen.size === l6.length, 'no duplicate buckets for a line')

// ── the sentence a user actually sees ───────────────────────────────────
const at8 = typicalFrom(bucketFor(l6, 8 * 60 + 12, 'weekday'))
ok(at8 !== null, '08:12 weekday resolves to a bucket')
const phrase = at8!.onTime
  ? `L6 is usually on time around 08:00`
  : `L6 usually runs +${at8!.median} min late around 08:00`
ok(!phrase.includes('undefined') && !phrase.includes('NaN'), 'phrase is well formed')
console.log('  rendered:', phrase, `(n=${at8!.samples})`)

// A slot with too few observations must stay silent rather than guess.
const preDawn = bucketFor(l6, 5 * 60 + 10, 'weekday')
ok(preDawn === null || preDawn.samples >= 12, 'thin slots are suppressed')

console.log(`reliability e2e: ${checks} checks passed`)
