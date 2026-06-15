export interface Train {
  id: string
  line: string
  lat: number
  lng: number
  destination: string
  origin: string
  delayMinutes: number
  occupancyPercent: number
  wagons?: number[]
  upcomingStops: string[]
  currentStop?: string
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
