import { useEffect, useRef, useState } from 'react'
import type { Train, Route, Stop } from '@/types'
import {
  type Polyline,
  haversine,
  buildPolyline,
  positionAtDistance,
  projectOntoPolyline,
} from './geometry'
import { normalizeSearchText } from './searchUtils'

// --- Per-train interpolation state ---

export interface StopTarget {
  name: string
  dist: number
}

interface TrainState {
  id:           string
  polyline:     Polyline
  distAlong:    number          // current animated position along polyline (metres)
  targetDist:   number          // real API position to ease toward (metres)
  direction:    1 | -1          // +1 or -1 along polyline
  lat:          number
  lng:          number
  lastRawLng:   number          // last received raw GPS lng
  lastRawLat:   number          // last received raw GPS lat
  currentSpeed: number          // current actual velocity (m/s)
  baseSpeed:    number          // cruising speed (m/s) ~19 m/s (~68 km/h)
  dwellUntil:   number          // timestamp (performance.now() ms) until when train dwells
  stationedAt:  string | null   // station name currently dwelling at
  stops:        StopTarget[]    // ordered sequence of upcoming stops
  servicedStops: Set<string>    // stop names already serviced this run
}

// Typical FGC / Rodalies cruising speed (~68 km/h)
const SPEED_MS = 19
// Intermediate station dwell: 20 seconds base with ±3s natural variation (17s-23s)
const BASE_DWELL_MS = 20_000
// Distance (m) before stop to initiate smooth deceleration
const DECEL_DIST_M = 150
// Acceleration and deceleration rates (m/s^2)
const ACCEL_MS2 = 1.1
const DECEL_MS2 = 1.0
// Distance (m) threshold to snap into station platform
const STOP_SNAP_M = 8

// Only teleport when the real position is absurdly far from our animation (e.g. trip re-routed)
const SNAP_THRESHOLD_M = 2000
// Gentle drift correction coefficient (exponential glide for remaining error)
const CORRECTION_PER_S = 0.25

// Stable pseudo-random variation based on train ID and stop name (±3 seconds)
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// Normalized station matching to reliably project stops onto polylines
const stopDistCache = new Map<string, number | null>()

function findStopDist(
  stopName: string,
  stops: Stop[],
  pl: Polyline,
  lineKey: string,
): number | null {
  if (!stopName) return null
  const cacheKey = `${lineKey}::${stopName}`
  if (stopDistCache.has(cacheKey)) return stopDistCache.get(cacheKey)!

  const q = normalizeSearchText(stopName)
  // 1. Exact normalized match
  let stop = stops.find(s => normalizeSearchText(s.name) === q)
  // 2. Substring match (e.g. "placa catalunya" in "barcelona placa catalunya")
  if (!stop) {
    stop = stops.find(s => {
      const c = normalizeSearchText(s.name)
      return c.includes(q) || q.includes(c)
    })
  }

  const dist = stop && stop.lat != null && stop.lng != null
    ? projectOntoPolyline([stop.lng, stop.lat], pl)
    : null

  stopDistCache.set(cacheKey, dist)
  return dist
}

// Ordered sequence of stops along the polyline that the train will visit
function resolveUpcomingStops(
  train: Train,
  stops: Stop[],
  pl: Polyline,
): StopTarget[] {
  const names = [...train.upcomingStops]
  if (train.destination && !names.includes(train.destination)) {
    names.push(train.destination)
  }
  const targets: StopTarget[] = []
  for (const name of names) {
    const dist = findStopDist(name, stops, pl, train.line)
    if (dist != null) {
      targets.push({ name, dist })
    }
  }
  return targets
}

// Determine travel direction along polyline (+1 increasing, -1 decreasing distance)
function resolveDirection(
  currentDistAlong: number,
  train: Train,
  stops: Stop[],
  pl: Polyline,
): 1 | -1 {
  for (const stopName of train.upcomingStops) {
    const d = findStopDist(stopName, stops, pl, train.line)
    if (d == null) continue
    const diff = d - currentDistAlong
    if (Math.abs(diff) > 80) return diff > 0 ? 1 : -1
  }
  const destD = findStopDist(train.destination, stops, pl, train.line)
  if (destD != null) {
    const diff = destD - currentDistAlong
    if (Math.abs(diff) > 80) return diff > 0 ? 1 : -1
  }
  return 1
}

// Resolve cruising speed, guarded against bad or checkpoint-only ETAs
function resolveBaseSpeed(
  currentDistAlong: number,
  train: Train,
  stops: Stop[],
  pl: Polyline,
): number {
  if (train.nextStopEta == null || !train.upcomingStops.length) return SPEED_MS
  const secsLeft = train.nextStopEta - Date.now() / 1000
  if (secsLeft <= 1) return SPEED_MS

  const nextStopD = findStopDist(train.upcomingStops[0], stops, pl, train.line)
  if (nextStopD == null) return SPEED_MS
  const gap = Math.abs(nextStopD - currentDistAlong)
  if (gap < STOP_SNAP_M) return SPEED_MS

  const speed = gap / secsLeft
  // Commuter rail speeds range from 10 to 35 m/s (~36 to ~126 km/h).
  // Outside this range indicates nextStopEta is for a distant timetable checkpoint.
  if (!Number.isFinite(speed) || speed < 10 || speed > 35) return SPEED_MS
  return speed
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
      const upcomingTargets = resolveUpcomingStops(train, stops, pl)

      if (!existing) {
        // New train — seed from real position
        const dir = resolveDirection(realDist, train, stops, pl)
        const baseSpeed = resolveBaseSpeed(realDist, train, stops, pl)
        const variation = ((hashString(train.id + (currentStopName ?? '')) % 7) - 3) * 1000

        stateMap.current.set(train.id, {
          id: train.id,
          polyline: pl,
          distAlong: realDist,
          targetDist: realDist,
          direction: dir,
          lat: train.lat,
          lng: train.lng,
          lastRawLng: train.lng,
          lastRawLat: train.lat,
          currentSpeed: isStationed ? 0 : baseSpeed,
          baseSpeed,
          dwellUntil: isTerminus
            ? Number.POSITIVE_INFINITY
            : isStationed
              ? now + BASE_DWELL_MS + variation
              : 0,
          stationedAt: isStationed ? currentStopName : null,
          stops: upcomingTargets,
          servicedStops: new Set(),
        })
      } else {
        existing.polyline = pl

        const isNewTelemetry =
          Math.abs(train.lng - existing.lastRawLng) > 1e-5 ||
          Math.abs(train.lat - existing.lastRawLat) > 1e-5

        if (isNewTelemetry) {
          existing.lastRawLng = train.lng
          existing.lastRawLat = train.lat
          existing.targetDist = realDist

          // Only snap if genuinely NEW telemetry moved > SNAP_THRESHOLD_M
          // (e.g. line switch / transponder re-initialisation), never on stale repeated GPS!
          const drift = haversine(realPt, [existing.lng, existing.lat])
          if (drift > SNAP_THRESHOLD_M) {
            existing.distAlong = realDist
            existing.lat = train.lat
            existing.lng = train.lng
            existing.currentSpeed = isStationed ? 0 : existing.baseSpeed
          }
        }

        existing.direction = resolveDirection(existing.distAlong, train, stops, pl)
        existing.baseSpeed = resolveBaseSpeed(existing.distAlong, train, stops, pl)
        existing.stops = upcomingTargets

        // Prune serviced stops that are no longer part of this train's sequence
        const validNames = new Set(upcomingTargets.map(t => t.name))
        for (const name of existing.servicedStops) {
          if (!validNames.has(name)) existing.servicedStops.delete(name)
        }

        // Upstream telemetry stationing sync:
        // If reported stationed, hold at platform. If intermediate station and feed is slow,
        // intermediate dwell allows train to depart after realistic boarding time.
        if (isStationed) {
          if (isTerminus) {
            existing.dwellUntil = Number.POSITIVE_INFINITY
            existing.stationedAt = currentStopName
            existing.currentSpeed = 0
          } else if (existing.stationedAt !== currentStopName) {
            existing.stationedAt = currentStopName
            const variation = ((hashString(train.id + (currentStopName ?? '')) % 7) - 3) * 1000
            existing.dwellUntil = now + BASE_DWELL_MS + variation
            existing.currentSpeed = 0
          }
          // If already dwelling at same intermediate station, let countdown continue smoothly
        } else {
          // Train is moving in the feed: immediately release station hold
          existing.stationedAt = null
          if (existing.dwellUntil === Number.POSITIVE_INFINITY || existing.dwellUntil > now) {
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

    // Immediately reflect the updated train list in React state
    setDisplayed(
      apiTrains.map(t => {
        const st = stateMap.current.get(t.id)
        if (!st) return t
        return { ...t, lat: st.lat, lng: st.lng }
      })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiTrains, routes, stops])

  // 60fps Animation Loop with Realistic Transit Physics
  useEffect(() => {
    function tick(now: number) {
      const dt = (now - lastTick.current) / 1000  // seconds
      lastTick.current = now

      let anyMoved = false

      for (const state of stateMap.current.values()) {
        // 1. Station dwell phase
        if (now < state.dwellUntil) {
          state.currentSpeed = 0
          continue
        }

        // 2. Identify the immediate next upcoming station
        const nextStop = state.stops.find(s => !state.servicedStops.has(s.name))
        const distToStop = nextStop
          ? (nextStop.dist - state.distAlong) * state.direction
          : Number.POSITIVE_INFINITY

        // 3. Station Arrival: trigger realistic dwell when reaching platform
        if (nextStop && distToStop <= STOP_SNAP_M && distToStop >= -35) {
          state.distAlong = nextStop.dist
          state.currentSpeed = 0
          state.servicedStops.add(nextStop.name)
          state.stationedAt = nextStop.name

          const isTerminus = nextStop.name === state.stops[state.stops.length - 1]?.name
          if (isTerminus) {
            state.dwellUntil = Number.POSITIVE_INFINITY
          } else {
            const variation = ((hashString(state.id + nextStop.name) % 7) - 3) * 1000
            state.dwellUntil = now + BASE_DWELL_MS + variation
          }

          const [lng, lat] = positionAtDistance(state.polyline, nextStop.dist)
          state.lat = lat
          state.lng = lng
          anyMoved = true
          continue
        }

        // 4. Approach Deceleration: smoothly slow down pulling into station
        let desiredSpeed = state.baseSpeed

        if (nextStop && distToStop > 0 && distToStop < DECEL_DIST_M) {
          const brakeSpeed = Math.max(2.5, Math.sqrt(2 * DECEL_MS2 * distToStop))
          desiredSpeed = Math.min(desiredSpeed, brakeSpeed)
        }

        // 5. Soft Drift Rectification: gently adjust speed to close gaps with real API telemetry
        // Never jump! Just run ~15-20% faster or slower along the rails until synchronized.
        const error = (state.targetDist - state.distAlong) * state.direction
        if (Math.abs(error) > 15 && Math.abs(error) < SNAP_THRESHOLD_M) {
          const speedMod = Math.max(-0.25, Math.min(0.25, error / 200)) * state.baseSpeed
          desiredSpeed = Math.max(3, desiredSpeed + speedMod)
        }

        // 6. Acceleration / Deceleration smoothing
        if (state.currentSpeed < desiredSpeed) {
          state.currentSpeed = Math.min(desiredSpeed, state.currentSpeed + ACCEL_MS2 * dt)
        } else if (state.currentSpeed > desiredSpeed) {
          state.currentSpeed = Math.max(desiredSpeed, state.currentSpeed - DECEL_MS2 * dt)
        }

        // 7. Advance position along polyline
        const move = state.currentSpeed * dt * state.direction
        const targetIsAhead = error > 0
        const correction = targetIsAhead ? (state.targetDist - state.distAlong) * Math.min(1, CORRECTION_PER_S * dt) : 0
        const next = state.distAlong + move + correction

        // Clamp to polyline limits
        const clamped = Math.max(0, Math.min(next, state.polyline.totalLen))
        if (clamped === state.distAlong) continue

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
