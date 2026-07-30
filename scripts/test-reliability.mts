// Pure-logic checks for the reliability bucket math. Run with:
//   node --experimental-strip-types scripts/test-reliability.mts
//
// The repo has no test runner (see AGENTS.md), so this is a self-contained
// script: it exercises the bucketing/threshold rules over their whole input
// space rather than a handful of examples, since those rules decide whether the
// app asserts a delay pattern to the user or stays quiet.

import assert from 'node:assert/strict'
import {
  BUCKET_MINUTES, bucketFor, dayTypeOf, minutesOfDay, typicalFrom, typicalAt,
  type ReliabilityBucket,
} from '../src/lib/reliability.ts'

let checks = 0
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); checks++ }

// ── minutesOfDay / dayTypeOf ─────────────────────────────────────────────
ok(minutesOfDay(new Date(2026, 0, 1, 0, 0)) === 0, 'midnight → 0')
ok(minutesOfDay(new Date(2026, 0, 1, 23, 59)) === 1439, '23:59 → 1439')
ok(minutesOfDay(new Date(2026, 0, 1, 8, 15)) === 495, '08:15 → 495')

// 2026-07-27 is a Monday; walk one full week.
for (let i = 0; i < 7; i++) {
  const d = new Date(2026, 6, 27 + i)
  const expected = i >= 5 ? 'weekend' : 'weekday'
  ok(dayTypeOf(d) === expected, `${d.toDateString()} → ${expected}`)
}

// ── bucketFor: every minute of the day maps into its slot ────────────────
const dense: ReliabilityBucket[] = []
for (let m = 0; m < 1440; m += BUCKET_MINUTES) {
  dense.push({ day_type: 'weekday', bucket_min: m, median_delay: m / 60, p90_delay: m / 30, samples: 100 })
}

for (let m = 0; m < 1440; m++) {
  const hit = bucketFor(dense, m, 'weekday')
  const expected = Math.floor(m / BUCKET_MINUTES) * BUCKET_MINUTES
  ok(hit?.bucket_min === expected, `minute ${m} → bucket ${expected}`)
}

// Times past midnight (GTFS 25:30 style) wrap, matching how observations were
// bucketed by wall-clock time.
ok(bucketFor(dense, 1470, 'weekday')?.bucket_min === 30, '24:30 wraps to 00:30')
ok(bucketFor(dense, 1440, 'weekday')?.bucket_min === 0, '24:00 wraps to 00:00')
ok(bucketFor(dense, -30, 'weekday')?.bucket_min === 1410, 'negative wraps backwards')

// Day type must match — weekday data never answers a weekend question.
ok(bucketFor(dense, 480, 'weekend') === null, 'weekend query misses weekday data')

// ── bucketFor: thin samples stay quiet ───────────────────────────────────
const thin = (samples: number): ReliabilityBucket[] =>
  [{ day_type: 'weekday', bucket_min: 480, median_delay: 9, p90_delay: 20, samples }]

ok(bucketFor(thin(0), 480, 'weekday') === null, '0 samples → null')
ok(bucketFor(thin(11), 480, 'weekday') === null, 'below threshold → null')
ok(bucketFor(thin(12), 480, 'weekday') !== null, 'at threshold → shown')
ok(bucketFor(thin(500), 480, 'weekday') !== null, 'plenty → shown')

// Missing/empty history is never an error.
ok(bucketFor(undefined, 480, 'weekday') === null, 'undefined → null')
ok(bucketFor([], 480, 'weekday') === null, 'empty → null')
ok(typicalAt(undefined, 480, 'weekday') === null, 'typicalAt tolerates undefined')

// ── typicalFrom: noise floor and rounding ────────────────────────────────
const at = (median: number, p90 = median): ReliabilityBucket =>
  ({ day_type: 'weekday', bucket_min: 480, median_delay: median, p90_delay: p90, samples: 100 })

ok(typicalFrom(null) === null, 'null bucket → null')
ok(typicalFrom(at(0))!.onTime, '0 → on time')
ok(typicalFrom(at(0.4))!.onTime, '0.4 → on time (noise)')
ok(!typicalFrom(at(0.5))!.onTime, '0.5 → late')
ok(!typicalFrom(at(4))!.onTime, '4 → late')

// Early trains (negative medians) count as on time, never "-2 min late".
ok(typicalFrom(at(-3))!.onTime, 'negative median → on time')

// Rounding to one decimal, and never showing more precision than we have.
ok(typicalFrom(at(4.04))!.median === 4, '4.04 → 4')
ok(typicalFrom(at(4.06))!.median === 4.1, '4.06 → 4.1')
ok(typicalFrom(at(4, 11.94))!.p90 === 11.9, 'p90 rounds too')

// p90 is always at least the median in real data; the UI only shows the
// "bad days" line when it adds information.
const t = typicalFrom(at(4, 12))!
ok(t.p90 > t.median, 'p90 above median is renderable')
ok(typicalFrom(at(4, 4))!.p90 === typicalFrom(at(4, 4))!.median, 'equal p90 collapses')

console.log(`reliability: ${checks} checks passed`)
