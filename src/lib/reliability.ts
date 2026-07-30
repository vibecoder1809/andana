'use client'

// Historical reliability — "L6 usually runs +4 min around 08:00 on weekdays."
//
// The data comes from `delay_observations` (a 10-minute cron snapshot of each
// line's median live delay), aggregated by the `delay_stats` Postgres view into
// median/p90 per line × weekday|weekend × 30-minute local bucket over a rolling
// 8 weeks. See docs/reliability.md.
//
// This module owns the client side of that: fetching (batched + deduped),
// picking the bucket matching a given moment, and deciding when the sample is
// thin enough that we should stay quiet rather than assert a pattern.

import { useEffect, useSyncExternalStore } from 'react'

export interface ReliabilityBucket {
  day_type: 'weekday' | 'weekend'
  bucket_min: number   // minutes since local midnight, start of the 30-min slot
  median_delay: number
  p90_delay: number
  samples: number
}

export type ReliabilityStats = Record<string, ReliabilityBucket[]>

/** Width of one aggregation bucket, in minutes. Must match `delay_stats`. */
export const BUCKET_MINUTES = 30

// Below this many snapshots in a bucket, one bad afternoon dominates the
// median, so we show nothing rather than a number the user would over-trust.
// At a 10-min cadence that's ~2 hours of accumulated observations for the slot.
const MIN_SAMPLES = 12

// Delays under this (in minutes) are indistinguishable from noise in a median
// of medians; treat the line as "usually on time" instead of "+0.4 min".
const NOISE_FLOOR = 0.5

/** Minutes since local midnight for a Date (the units `bucket_min` uses). */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** Day type used by `delay_stats` (weekend = Saturday/Sunday). */
export function dayTypeOf(d: Date): 'weekday' | 'weekend' {
  const dow = d.getDay()
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday'
}

/**
 * The bucket covering `minuteOfDay` on a `dayType` day, or null when there's no
 * trustworthy history for that slot. Times past 24:00 (GTFS after-midnight
 * services) wrap, matching how the observations were bucketed.
 */
export function bucketFor(
  buckets: ReliabilityBucket[] | undefined,
  minuteOfDay: number,
  dayType: 'weekday' | 'weekend',
): ReliabilityBucket | null {
  if (!buckets?.length) return null
  const wrapped = ((minuteOfDay % 1440) + 1440) % 1440
  const slot = Math.floor(wrapped / BUCKET_MINUTES) * BUCKET_MINUTES
  const hit = buckets.find(b => b.day_type === dayType && b.bucket_min === slot)
  if (!hit || hit.samples < MIN_SAMPLES) return null
  return hit
}

/**
 * How to phrase a bucket: `null` when there's nothing worth saying, otherwise
 * a rounded typical delay and whether it counts as "usually on time".
 */
export interface Typical {
  /** Median delay in minutes, rounded to one decimal. */
  median: number
  /** 90th-percentile delay — the "bad day" figure. */
  p90: number
  /** True when the median is within noise, i.e. the line is usually punctual. */
  onTime: boolean
  samples: number
}

export function typicalFrom(bucket: ReliabilityBucket | null): Typical | null {
  if (!bucket) return null
  const median = Math.round(bucket.median_delay * 10) / 10
  return {
    median,
    p90: Math.round(bucket.p90_delay * 10) / 10,
    onTime: median < NOISE_FLOOR,
    samples: bucket.samples,
  }
}

/** Convenience: look up and phrase in one step. */
export function typicalAt(
  buckets: ReliabilityBucket[] | undefined,
  minuteOfDay: number,
  dayType: 'weekday' | 'weekend',
): Typical | null {
  return typicalFrom(bucketFor(buckets, minuteOfDay, dayType))
}

// ── fetching ─────────────────────────────────────────────────────────────

// Reliability is a rolling 8-week aggregate behind a 15-minute server cache, so
// it barely moves within a session. It's therefore modelled as an external
// store: cached per line for the page's lifetime, with concurrent requests
// deduped, so mounting ten cards costs one round trip and a cache hit renders
// synchronously with no extra commit.
const cache = new Map<string, ReliabilityBucket[]>()
const inflight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

// Bumped on every cache fill so subscribers know to re-read.
let version = 0

// Cached per key so getSnapshot returns a referentially stable object while
// the underlying data is unchanged (useSyncExternalStore requires that).
const snapshots = new Map<string, { version: number; value: ReliabilityStats }>()

const EMPTY: ReliabilityStats = {}

function emit() {
  version++
  snapshots.clear()
  for (const l of listeners) l()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

function snapshotFor(key: string): ReliabilityStats {
  if (!key) return EMPTY
  const memo = snapshots.get(key)
  if (memo && memo.version === version) return memo.value
  const value = Object.fromEntries(key.split(',').map(l => [l, cache.get(l) ?? []]))
  snapshots.set(key, { version, value })
  return value
}

async function loadLines(lines: string[]): Promise<void> {
  const missing = lines.filter(l => !cache.has(l) && !inflight.has(l))
  const waits: Promise<void>[] = lines
    .map(l => inflight.get(l))
    .filter((p): p is Promise<void> => !!p)

  if (missing.length > 0) {
    const req = fetch(`/api/reliability?lines=${encodeURIComponent(missing.join(','))}`)
      .then(r => r.json())
      .then((d: { stats?: ReliabilityStats }) => {
        // Cache the empty result too: "no history yet" is a real answer and
        // shouldn't be re-requested by every card on the page.
        for (const l of missing) cache.set(l, d.stats?.[l] ?? [])
      })
      .catch(() => { for (const l of missing) cache.set(l, []) })
      .finally(() => {
        for (const l of missing) inflight.delete(l)
        emit()
      })
    for (const l of missing) inflight.set(l, req)
    waits.push(req)
  }

  await Promise.all(waits)
}

/**
 * Reliability history for the given lines. Every line resolves to an array,
 * empty both while loading and when no history exists yet — callers render
 * nothing in both cases, so the feature stays invisible until data is there.
 */
export function useReliability(lines: string[]): ReliabilityStats {
  // Stable key so a fresh array of the same lines doesn't re-run the effect.
  const key = [...new Set(lines)].sort().join(',')

  useEffect(() => {
    if (key) loadLines(key.split(','))
  }, [key])

  return useSyncExternalStore(
    subscribe,
    () => snapshotFor(key),
    // Server render: no cache, no history — same as "nothing to show".
    () => snapshotFor(''),
  )
}
