// Checks for the service clock and the server-side memo cache. Both are
// infrastructure whose failures are silent: a wrong timezone shifts every
// departure by an hour without erroring, and a broken cache either serves stale
// data forever or stops collapsing load without anyone noticing.
//
//   node --experimental-strip-types scripts/test-infra.mts

import assert from 'node:assert/strict'
import { serviceDate, serviceSeconds, serviceMinutes, serviceDayType, serviceDatePlus } from '../src/lib/serviceTime.ts'
import { cached, clearCache } from '../src/lib/cache.ts'

let checks = 0
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); checks++ }

// ── service clock: pinned to Europe/Madrid, not the host ────────────────
// 12:00 UTC on 15 Jan is 13:00 CET (winter, UTC+1).
{
  const at = new Date('2026-01-15T12:00:00Z')
  ok(serviceDate(at) === '2026-01-15', 'winter date')
  ok(serviceSeconds(at) === 13 * 3600, 'winter time is UTC+1')
  ok(serviceMinutes(at) === 13 * 60, 'minutes agree with seconds')
}

// 12:00 UTC on 15 Jul is 14:00 CEST (summer, UTC+2) — DST must be handled.
{
  const at = new Date('2026-07-15T12:00:00Z')
  ok(serviceSeconds(at) === 14 * 3600, 'summer time is UTC+2')
}

// The case that actually breaks a UTC-hosted app: late evening in Barcelona is
// still the *previous* UTC day, so a naive server clock rolls the service date
// early and the timetable silently switches over.
{
  const at = new Date('2026-07-15T23:30:00Z') // 01:30 next day in Barcelona
  ok(serviceDate(at) === '2026-07-16', 'past local midnight rolls the service date')
  ok(serviceSeconds(at) === 1 * 3600 + 30 * 60, 'past midnight reads as 01:30 local')
}
{
  const at = new Date('2026-07-15T22:30:00Z') // 00:30 next day in Barcelona
  ok(serviceDate(at) === '2026-07-16', 'just past local midnight is the next service date')
  ok(serviceSeconds(at) === 30 * 60, 'local 00:30 is 1800s, not 81000s')
}

// Local midnight exactly — the boundary most likely to be off by a day.
{
  const at = new Date('2026-07-15T22:00:00Z') // 00:00:00 on the 16th, local
  ok(serviceDate(at) === '2026-07-16', 'local midnight belongs to the new date')
  ok(serviceSeconds(at) === 0, 'local midnight is 0 seconds, not 86400')
}

// ── day type follows the Barcelona weekday ──────────────────────────────
// 2026-07-04 is a Saturday. At 22:30 UTC on Friday the 3rd it is already
// Saturday in Barcelona, so the day type must flip before the server's does.
ok(serviceDayType(new Date('2026-07-03T22:30:00Z')) === 'weekend', 'late Friday UTC is already the weekend locally')
ok(serviceDayType(new Date('2026-07-03T12:00:00Z')) === 'weekday', 'Friday midday is a weekday')
ok(serviceDayType(new Date('2026-07-05T22:30:00Z')) === 'weekday', 'late Sunday UTC is already Monday locally')

// ── date arithmetic stays on local calendar days ────────────────────────
ok(serviceDatePlus(0, new Date('2026-07-15T12:00:00Z')) === '2026-07-15', '+0 is today')
ok(serviceDatePlus(7, new Date('2026-07-15T12:00:00Z')) === '2026-07-22', '+7 days')
ok(serviceDatePlus(1, new Date('2026-12-31T12:00:00Z')) === '2027-01-01', 'crosses the year boundary')
// Across the DST change (29 Mar 2026), +1 day must still be +1 calendar day.
ok(serviceDatePlus(1, new Date('2026-03-28T12:00:00Z')) === '2026-03-29', '+1 across the DST switch')
ok(serviceDatePlus(1, new Date('2026-03-29T12:00:00Z')) === '2026-03-30', '+1 after the DST switch')

// ── cache: single-flight ────────────────────────────────────────────────
{
  clearCache()
  let calls = 0
  const slow = async () => { calls++; await new Promise(r => setTimeout(r, 20)); return calls }
  const [a, b, c] = await Promise.all([
    cached('k', 1000, slow), cached('k', 1000, slow), cached('k', 1000, slow),
  ])
  ok(calls === 1, 'concurrent callers share one upstream call')
  ok(a === b && b === c, 'all callers get the same value')
}

// ── cache: TTL ──────────────────────────────────────────────────────────
{
  clearCache()
  let calls = 0
  const fn = async () => ++calls
  await cached('t', 30, fn)
  await cached('t', 30, fn)
  ok(calls === 1, 'within the TTL the value is reused')
  await new Promise(r => setTimeout(r, 45))
  await cached('t', 30, fn)
  ok(calls === 2, 'past the TTL it refetches')
}

// ── cache: keys are independent ─────────────────────────────────────────
{
  clearCache()
  let calls = 0
  const fn = async () => ++calls
  await cached('a', 1000, fn)
  await cached('b', 1000, fn)
  ok(calls === 2, 'different keys do not collide')
}

// ── cache: a failure is never memoised as data ──────────────────────────
{
  clearCache()
  let calls = 0
  const failing = async () => { calls++; throw new Error('upstream down') }
  await assert.rejects(() => cached('f', 1000, failing), /upstream down/)
  checks++
  await assert.rejects(() => cached('f', 1000, failing), /upstream down/)
  checks++
  ok(calls === 2, 'a failure is retried, not cached')
}

// ── cache: stale-on-error keeps the map populated through a blip ────────
{
  clearCache()
  let mode: 'ok' | 'fail' = 'ok'
  const flaky = async () => {
    if (mode === 'fail') throw new Error('blip')
    return 'good'
  }
  ok(await cached('s', 10, flaky) === 'good', 'first call succeeds')
  await new Promise(r => setTimeout(r, 20)) // let the TTL lapse
  mode = 'fail'
  ok(await cached('s', 10, flaky) === 'good', 'a blip serves the last good value')
  // ...but only within the stale window: with none, the error surfaces.
  await assert.rejects(() => cached('s', 10, flaky, -1), /blip/)
  checks++
}

console.log(`infra: ${checks} checks passed`)
