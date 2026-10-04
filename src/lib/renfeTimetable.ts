import timetableJson from '@/data/rodalies-timetable.json'
import type { Trip, Connection } from './planner'

interface RawRodaliesTrip {
  line: string
  headsign: string
  stops: [string, number, number][] // [stopId, depTime, arrTime]
}

interface RawRodaliesTimetable {
  stations: Record<string, string>
  services: {
    weekday: RawRodaliesTrip[]
    saturday: RawRodaliesTrip[]
    sunday: RawRodaliesTrip[]
  }
}

const data = timetableJson as unknown as RawRodaliesTimetable

// Rodalies station names dictionary (stopId -> display name)
export const RODALIES_STATION_NAMES = new Map<string, string>(
  Object.entries(data.stations)
)

export function getRodaliesDayType(dateStr?: string): 'weekday' | 'saturday' | 'sunday' {
  if (!dateStr) {
    const d = new Date()
    const day = d.getDay() // 0 = Sun, 6 = Sat
    if (day === 0) return 'sunday'
    if (day === 6) return 'saturday'
    return 'weekday'
  }
  const [y, m, d] = dateStr.split('-').map(Number)
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const day = dateObj.getUTCDay()
  if (day === 0) return 'sunday'
  if (day === 6) return 'saturday'
  return 'weekday'
}

export function loadRodaliesTimetable(
  baseTripId: number,
  dateStr?: string
): {
  trips: Map<number, Trip>
  connections: Connection[]
  stationNames: Map<string, string>
  stationLines: Map<string, Set<string>>
  nextTripId: number
} {
  const dayType = getRodaliesDayType(dateStr)
  const rawTrips = data.services[dayType] || data.services.weekday

  const trips = new Map<number, Trip>()
  const connections: Connection[] = []
  const stationNames = new Map<string, string>(RODALIES_STATION_NAMES)
  const stationLines = new Map<string, Set<string>>()

  let curTripId = baseTripId

  for (const raw of rawTrips) {
    if (!raw.stops || raw.stops.length < 2) continue

    const tripStops = raw.stops.map((s, idx) => {
      const stopId = s[0]
      const dep = s[1]
      const arr = s[2]
      const name = stationNames.get(stopId) || stopId

      if (!stationLines.has(stopId)) stationLines.set(stopId, new Set())
      stationLines.get(stopId)!.add(raw.line)

      return {
        parent: stopId,
        name,
        seq: idx + 1,
        arrival: arr,
        departure: dep,
      }
    })

    const trip: Trip = {
      id: curTripId,
      line: raw.line,
      headsign: raw.headsign || tripStops[tripStops.length - 1].name,
      operator: 'renfe',
      stops: tripStops,
    }

    trips.set(curTripId, trip)

    for (let i = 0; i < tripStops.length - 1; i++) {
      const from = tripStops[i]
      const to = tripStops[i + 1]
      connections.push({
        tripId: curTripId,
        line: raw.line,
        headsign: trip.headsign,
        operator: 'renfe',
        fromParent: from.parent,
        fromName: from.name,
        toParent: to.parent,
        toName: to.name,
        depTime: from.departure,
        arrTime: to.arrival,
      })
    }

    curTripId++
  }

  return {
    trips,
    connections,
    stationNames,
    stationLines,
    nextTripId: curTripId,
  }
}
