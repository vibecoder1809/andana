'use client'

// Lightweight URL query-string state, so a selected train, an open station, or
// a planned journey survives a refresh and can be shared/bookmarked. We use
// history.replaceState (not Next routing) because this is a single-page client
// app with one route — we only want the querystring to mirror in-app state.
//
// Writers each own their own keys and patch via updateParams, which merges
// rather than replaces, so App (train/stop) and TripPlanner (from/to/at/date)
// never stomp on each other's params.

export function readParam(key: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(key)
}

export function updateParams(patch: Record<string, string | null | undefined>): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') params.delete(k)
    else params.set(k, v)
  }
  const qs = params.toString()
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
}

// A shared planner link carries both endpoints; roots open the Plan tab for it.
export function isPlannerLink(): boolean {
  return !!(readParam('from') && readParam('to'))
}
