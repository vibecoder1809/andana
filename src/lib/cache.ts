// Single-flight + short-TTL cache for hot server-side fetches.
//
// Every connected client polls /api/trains on its own 10s timer, and each poll
// hits three upstream endpoints (positions + two GTFS-RT protobuf feeds). With
// N clients that is N× identical traffic to dadesobertes.fgc.cat for data that
// changes at most every ~20-30s. This collapses it: concurrent callers share
// one in-flight request, and the result is reused for a short TTL.
//
// Deliberately not Next's `fetch` cache: this memoises the *derived* value
// (parsed, joined, enriched), so the protobuf decode and the join are shared
// too, not just the network round trip.

interface Entry<T> {
  value?: T
  expires: number
  inflight?: Promise<T>
}

const entries = new Map<string, Entry<unknown>>()

/**
 * Run `fn` at most once per `ttlMs` per `key`, sharing concurrent calls.
 *
 * On refresh failure the previous value is served if it's still within
 * `staleMs` of expiry — a blip in a flaky upstream shouldn't blank the map when
 * slightly stale positions are far more useful than an error.
 */
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>, staleMs = 60_000): Promise<T> {
  const now = Date.now()
  const entry = entries.get(key) as Entry<T> | undefined

  if (entry) {
    // Join the in-flight refresh rather than starting a second one.
    if (entry.inflight) return entry.inflight
    if (entry.value !== undefined && now < entry.expires) return Promise.resolve(entry.value)
  }

  // Keep the previous value visible while refreshing, so a failure can fall
  // back to it and a late arrival isn't served an empty entry.
  const prevValue = entry?.value
  const prevExpires = entry?.expires ?? 0

  const inflight: Promise<T> = fn()
    .then(value => {
      entries.set(key, { value, expires: Date.now() + ttlMs })
      return value
    })
    .catch((err: unknown) => {
      // Serve stale rather than fail: a blip in a flaky upstream shouldn't blank
      // the map when slightly-old positions are far more useful than an error.
      // The expiry is not extended, so the next call retries.
      if (prevValue !== undefined && Date.now() < prevExpires + staleMs) {
        entries.set(key, { value: prevValue, expires: prevExpires })
        return prevValue
      }
      entries.delete(key)
      throw err
    })

  entries.set(key, { value: prevValue, expires: prevExpires, inflight } as Entry<unknown>)
  return inflight
}

/** Test/debug helper: drop all memoised values. */
export function clearCache(): void {
  entries.clear()
}
