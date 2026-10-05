import { useEffect, useRef, useState } from 'react'
import type { Train, Route, Stop } from '@/types'
import {
  type Polyline,
  haversine,
  buildPolyline,
  positionAtDistance,
  projectOntoPolyline,
} from './geometry'

// --- Per-train interpolation state ---

interface TrainState {
  id:         string
  polyline:   Polyline
  distAlong:  number    // current animated position along polyline (metres)
  // The real (API) position along the polyline we're easing toward. The tick
  // loop nudges distAlong toward this so corrections glide instead of snapping.
  targetDist: number
  // If dwelling at a station, until when (performance.now() ms)
  dwellUntil: number
  // Name of the station currently being dwelled at
  stationedAt: string | null
  // Direction: +1 or -1 along the polyline
  direction:  1 | -1
  lat:        number
  lng:        number
  // Animation speed (m/s) for this train. Derived from the real distance to the
  // next stop and the real ETA when available (dead-reckoning), else SPEED_MS.
  speed:      number
  // Distances (m along polyline) of upcoming stops the train should pause at,
  // and the set already serviced this leg so we don't dwell twice.
  stopDists:  number[]
  servicedStops: Set<number>
}

// Typical FGC inter-city speed in m/s (~80 km/h for mainline, ~60 for urban)
const SPEED_MS = 19 // ~68 km/h — closer to FGC peak running speed
const INTERMEDIATE_DWELL_MS = 25_000 // 25 s intermediate stop dwell timeout before resuming motion if feed lags
const BETWEEN_POLLS_DWELL_MS = 6_000 // 6 s brief pause when reaching an upcoming station between polls
// How close (m) the animated train must get to a stop to trigger a dwell
const STOP_TRIGGER_M = 40
// Only teleport when the real position is absurdly far from our animation —
// e.g. the train re-appeared on a different part of the line. Below this we
// glide toward the real position instead of snapping (see CORRECTION_PER_S).
const SNAP_THRESHOLD_M = 2000
// When the animation drifts from the real API position, close the gap smoothly
// by adding this fraction of the remaining error per second on top of normal
// motion, instead of jumping. 0.5 ≈ halve the error each second.
const CORRECTION_PER_S = 0.5

// Match a stop name to its coordinate on the polyline
function findStopDist(stopName: string, stops: Stop[], pl: Polyline): number | null {
  const stop = stops.find(s => s.name === stopName)
  if (!stop) return null
  return projectOntoPolyline([stop.lng, stop.lat], pl)
}

// Distances along the polyline (sorted) of every stop this train still has to
// serve — its upcoming stops plus the final destination.
function upcomingStopDists(train: Train, stops: Stop[], pl: Polyline): number[] {
  const names = [...train.upcomingStops, train.destination]
  const dists: number[] = []
  for (const name of names) {
    const d = findStopDist(name, stops, pl)
    if (d != null) dists.push(d)
  }
  return dists.sort((a, b) => a - b)
}

// Dead-reckon the animation speed (m/s) from the real distance to the next
// upcoming stop and its real ETA. This makes the train cover the actual gap in
// the actual time the API predicts, rather than gliding at a fixed guess.
// Falls back to SPEED_MS when there's no usable ETA or it's already in the past.
function resolveSpeed(
  currentDistAlong: number,
  train: Train,
  stops: Stop[],
  pl: Polyline,
): number {
  if (train.nextStopEta == null || !train.upcomingStops.length) return SPEED_MS
  const secsLeft = train.nextStopEta - Date.now() / 1000
  if (secsLeft <= 1) return SPEED_MS  // arriving now / stale ETA — use default

  const nextStopD = findStopDist(train.upcomingStops[0], stops, pl)
  if (nextStopD == null) return SPEED_MS
  const gap = Math.abs(nextStopD - currentDistAlong)
  if (gap < STOP_TRIGGER_M) return SPEED_MS  // already essentially there

  const speed = gap / secsLeft
  // Commuter train running speeds are typically 10-35 m/s (36-126 km/h).
  // Speeds outside this range mean nextStopEta was for a distant corridor
  // checkpoint rather than upcomingStops[0], so fall back to normal cruising speed.
  if (!Number.isFinite(speed) || speed < 10 || speed > 35) return SPEED_MS
  return speed
}

// Determine which direction along the polyline the train is heading.
// We use the next upcoming stop: it should be further along than the current position.
function resolveDirection(
  currentDistAlong: number,
  train: Train,
  stops: Stop[],
  pl: Polyline,
): 1 | -1 {
  for (const stopName of train.upcomingStops) {
    const d = findStopDist(stopName, stops, pl)
    if (d == null) continue
    const diff = d - currentDistAlong
    if (Math.abs(diff) > 100) return diff > 0 ? 1 : -1
  }
  // Fall back: destination end of polyline
  const destD = findStopDist(train.destination, stops, pl)
  if (destD != null) {
    const diff = destD - currentDistAlong
    if (Math.abs(diff) > 100) return diff > 0 ? 1 : -1
  }
  return 1
}

// --- The hook ---

export function useInterpolatedTrains(
  apiTrains: Train[],
  routes: Route[],
  stops: Stop[],
): Train[] {
  const stateMap    = useRef<Map<string, TrainState>>(new Map())
  const rafRef      = useRef<number | null>(null)
  const lastTick    = useRef<number>(0)
  const lastRender  = useRef<number>(0)
  const RENDER_INTERVAL = 100  // ms — cap React re-renders at ~10fps

  const [displayed, setDisplayed] = useState<Train[]>(apiTrains)

  const polylineCache = useRef<Map<string, Polyline>>(new Map())

  // Sync API snapshot → stateMap
  useEffect(() => {
    const now = performance.now()

    function getPolyline(lineName: string): Polyline | null {
      if (polylineCache.current.has(lineName)) return polylineCache.current.get(lineName)!
      const route = routes.find(r => r.shortName === lineName)
      if (!route?.geometry) return null
      const pl = buildPolyline(route.geometry.coordinates)
      if (pl) polylineCache.current.set(lineName, pl)
      return pl
    }

    for (const train of apiTrains) {
      const pl = getPolyline(train.line)
      if (!pl) continue

      const realPt: [number, number] = [train.lng, train.lat]
      const realDist = projectOntoPolyline(realPt, pl)

      const existing = stateMap.current.get(train.id)

      const isStationed = train.operationalStatus === 'stationed' || Boolean(train.currentStop)
      const currentStopName = train.currentStop || (isStationed ? (train.upcomingStops[0] ?? 'station') : null)
      const isTerminus = Boolean(
        train.currentStop && (
          train.currentStop === train.destination ||
          train.upcomingStops.length === 0
        )
      )
      const freshStopDists = upcomingStopDists(train, stops, pl)

      if (!existing) {
        // New train — seed from real position
        const dir = resolveDirection(realDist, train, stops, pl)
        stateMap.current.set(train.id, {
          id: train.id,
          polyline: pl,
          distAlong: realDist,
          targetDist: realDist,
          dwellUntil: isTerminus
            ? Number.POSITIVE_INFINITY
            : isStationed
              ? now + INTERMEDIATE_DWELL_MS
              : 0,
          stationedAt: isStationed ? currentStopName : null,
          direction: dir,
          lat: train.lat,
          lng: train.lng,
          speed: resolveSpeed(realDist, train, stops, pl),
          stopDists: freshStopDists,
          servicedStops: new Set(),
        })
      } else {
        // Update polyline if route data changed
        existing.polyline = pl

        // Steer toward the fresh real position. For ordinary drift we just set
        // the target and let the tick loop glide there; only an absurd jump
        // (train reappeared elsewhere) gets a hard teleport.
        existing.targetDist = realDist
        const drift = haversine(realPt, [existing.lng, existing.lat])
        if (drift > SNAP_THRESHOLD_M) {
          existing.distAlong = realDist
          existing.lat = train.lat
          existing.lng = train.lng
        }

        // Update direction from fresh upcoming-stops data
        existing.direction = resolveDirection(existing.distAlong, train, stops, pl)

        // Re-derive speed from the fresh ETA so each leg animates at the rate
        // the API actually predicts.
        existing.speed = resolveSpeed(existing.distAlong, train, stops, pl)

        // Refresh the upcoming-stop distances from the new snapshot, and prune
        // serviced stops that are no longer upcoming (never clear actively visited stops).
        existing.stopDists = freshStopDists
        const freshSet = new Set(freshStopDists)
        for (const sd of existing.servicedStops) {
          if (!freshSet.has(sd)) existing.servicedStops.delete(sd)
        }

        // If the train is reported stationed by upstream telemetry:
        // - At a terminus, hold indefinitely until dispatched.
        // - At an intermediate station, dwell up to INTERMEDIATE_DWELL_MS (25s).
        //   If upstream feed lags without updating, the timer expires and the train
        //   smoothly departs toward the next stop instead of staying frozen for 2+ mins.
        if (isStationed) {
          if (isTerminus) {
            existing.dwellUntil = Number.POSITIVE_INFINITY
            existing.stationedAt = currentStopName
          } else if (existing.stationedAt !== currentStopName) {
            existing.stationedAt = currentStopName
            existing.dwellUntil = now + INTERMEDIATE_DWELL_MS
          }
          // If already dwelling at the same intermediate station, let existing countdown continue
        } else {
          // Upstream reports train is moving: release any station hold immediately
          existing.stationedAt = null
          if (existing.dwellUntil === Number.POSITIVE_INFINITY || existing.dwellUntil > now + BETWEEN_POLLS_DWELL_MS) {
            existing.dwellUntil = 0
          }
        }
      }
    }

    // Remove trains that disappeared from the API
    const apiIds = new Set(apiTrains.map(t => t.id))
    for (const id of stateMap.current.keys()) {
      if (!apiIds.has(id)) stateMap.current.delete(id)
    }

    // Immediately reflect the updated/filtered train list in React state so
    // trains removed by network mode or line filters disappear without delay.
    setDisplayed(
      apiTrains.map(t => {
        const st = stateMap.current.get(t.id)
        if (!st) return t
        return { ...t, lat: st.lat, lng: st.lng }
      })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiTrains, routes, stops])

  // Animation loop
  useEffect(() => {
    function tick(now: number) {
      const dt = (now - lastTick.current) / 1000  // seconds
      lastTick.current = now

      let anyMoved = false

      for (const state of stateMap.current.values()) {
        if (now < state.dwellUntil) continue   // dwelling at station or stationed
        const move = state.speed * dt * state.direction
        // Smoothly close any gap to the real position on top of normal motion.
        // Only correct toward a target that's *ahead* of us in our travel
        // direction: if our dead-reckoning has run past the last known position
        // and no fresh data has arrived, keep coasting rather than yanking the
        // train backward to a stale point (which looked like a snap-back).
        const error = state.targetDist - state.distAlong
        const targetIsAhead = error * state.direction > 0
        const correction = targetIsAhead ? error * Math.min(1, CORRECTION_PER_S * dt) : 0
        const next = state.distAlong + move + correction

        // Clamp to polyline ends
        const clamped = Math.max(0, Math.min(next, state.polyline.totalLen))
        if (clamped === state.distAlong) continue

        // Pause at any station we just reached/passed this frame that we
        // haven't already serviced — mimics the real station dwell.
        const lo = Math.min(state.distAlong, clamped)
        const hi = Math.max(state.distAlong, clamped)
        let dwellHit: number | null = null
        for (const sd of state.stopDists) {
          if (state.servicedStops.has(sd)) continue
          // crossed it, or ended this frame within trigger range of it
          if ((sd >= lo - STOP_TRIGGER_M && sd <= hi + STOP_TRIGGER_M)) {
            if (dwellHit == null || Math.abs(sd - state.distAlong) < Math.abs(dwellHit - state.distAlong)) {
              dwellHit = sd
            }
          }
        }
        if (dwellHit != null) {
          // Snap to the stop, mark serviced, and dwell.
          state.distAlong = dwellHit
          state.servicedStops.add(dwellHit)
          state.dwellUntil = now + BETWEEN_POLLS_DWELL_MS
          const [lng, lat] = positionAtDistance(state.polyline, dwellHit)
          state.lat = lat
          state.lng = lng
          anyMoved = true
          continue
        }

        state.distAlong = clamped
        const [lng, lat] = positionAtDistance(state.polyline, clamped)
        if (Math.abs(state.lat - lat) > 1e-8 || Math.abs(state.lng - lng) > 1e-8) {
          state.lat = lat
          state.lng = lng
          anyMoved = true
        }
      }

      if (anyMoved && now - lastRender.current >= RENDER_INTERVAL) {
        lastRender.current = now
        setDisplayed(
          apiTrains.map(t => {
            const st = stateMap.current.get(t.id)
            if (!st) return t
            return { ...t, lat: st.lat, lng: st.lng }
          })
        )
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    lastTick.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiTrains])

  // If no routes yet (first load), just show raw API data
  if (routes.length === 0) return apiTrains

  return displayed
}
