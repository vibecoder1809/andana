export interface Train {
  id: string
  line: string
  lat: number
  lng: number
  destination: string
  origin: string
  delayMinutes: number
  occupancyPercent: number
  /** Per-car occupancy in composition order; null = car not reported (3-car
      units). Only present when the feed sent real per-car telemetry, not an
      aggregate copied into every field. */
  wagons?: (number | null)[]
  upcomingStops: string[]
  currentStop?: string
  nextStopEta?: number
}

export interface StopArrival {
  stopId: string
  name: string
  arrivalTime: number
  departureTime: number
}

export interface Stop {
  stopId: string
  name: string
  lat: number
  lng: number
  wheelchairBoarding: boolean
}

export interface Alert {
  id: string
  header: string
  description: string
  routes: string[]
}

export interface Route {
  routeId: string
  shortName: string
  longName: string
  color: string
  geometry: {
    type: 'MultiLineString'
    coordinates: number[][][]
  } | null
}

export interface StopDetail {
  stopId: string
  name: string
  air: {
    iqam: 'BO' | 'MODERAT' | 'DOLENT' | null
    no2: number | null
    o3: number | null
    pm10: number | null
    stationName: string | null
  } | null
  weather: {
    sky: string
    timeRange: string
  } | null
}

export type Theme = 'dark' | 'light'

// Journey-planning domain types. Defined here (not re-exported from
// lib/planner.ts) so this client-safe types barrel never depends on a
// server-only module that imports lib/fgc.ts — a stray value import there
// would otherwise pull the GTFS timetable parser into the client bundle.
export interface PlannerStation {
  code: string
  name: string
}

export interface JourneyLeg {
  line: string
  headsign: string
  fromCode: string
  fromName: string
  toCode: string
  toName: string
  depTime: number       // seconds since midnight (scheduled)
  arrTime: number
  intermediateStops: number
}

export interface Journey {
  legs: JourneyLeg[]
  depTime: number
  arrTime: number
  durationMin: number
  transfers: number
  /** Live delay (minutes) currently reported for the first leg's line, if any. */
  liveDelayMin?: number
  /** Set only when a step-free route was requested: true iff every interchange
      station on this journey has step-free access. False means it's the best
      available but still routes through an inaccessible change. */
  stepFree?: boolean
}
