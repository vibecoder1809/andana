import type { Stop, Alert, Route, StopArrival, StopDetail } from '@/types'

const BASE = 'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets'

type RawStop = {
  stop_id: string
  stop_name: string
  stop_coordinates: { lat: number; lon: number }
  wheelchair_boarding: number
}

async function fetchStopsPage(offset: number): Promise<{ total: number; results: RawStop[] }> {
  const res = await fetch(
    `${BASE}/gtfs_stops/records?limit=100&offset=${offset}`,
    { next: { revalidate: 86400 } },
  )
  if (!res.ok) throw new Error(`gtfs_stops API ${res.status}`)
  const data: { total_count: number; results: RawStop[] } = await res.json()
  return { total: data.total_count, results: data.results }
}

export async function fetchStops(): Promise<Stop[]> {
  const first = await fetchStopsPage(0)
  const remaining = Math.ceil((first.total - first.results.length) / 100)
  const pages = await Promise.all(
    Array.from({ length: remaining }, (_, i) => fetchStopsPage((i + 1) * 100)),
  )
  const all = [first, ...pages].flatMap(p => p.results)

  return all.map(r => ({
    stopId: r.stop_id,
    name: r.stop_name,
    lat: r.stop_coordinates.lat,
    lng: r.stop_coordinates.lon,
    wheelchairBoarding: r.wheelchair_boarding === 1,
  }))
}

async function fetchPbBuffer(dataset: string): Promise<Uint8Array> {
  const recRes = await fetch(`${BASE}/${dataset}/records?limit=1`, { cache: 'no-store' })
  if (!recRes.ok) throw new Error(`${dataset} records API ${recRes.status}`)
  const rec: { results: [{ file: { url: string } }] } = await recRes.json()
  const pbUrl = rec.results[0].file.url

  const pbRes = await fetch(pbUrl, { cache: 'no-store' })
  if (!pbRes.ok) throw new Error(`${dataset} .pb fetch ${pbRes.status}`)
  return new Uint8Array(await pbRes.arrayBuffer())
}

function pickText(
  ts: { translation?: Array<{ text: string; language?: string | null }> | null } | null | undefined,
): string {
  const list = ts?.translation
  if (!list?.length) return ''
  return (
    list.find(t => t.language === 'ca') ??
    list.find(t => t.language === 'es') ??
    list[0]
  ).text
}

export async function fetchRoutes(): Promise<Route[]> {
  const [routesRes, shapesRes] = await Promise.all([
    fetch(`${BASE}/lineas-red-fgc/records?limit=100`, { next: { revalidate: 86400 } }),
    fetch(`${BASE}/gtfs_routes/records?limit=50`, { next: { revalidate: 86400 } }),
  ])
  if (!routesRes.ok) throw new Error(`lineas-red-fgc API ${routesRes.status}`)

  const routesData: {
    results: Array<{
      route_id: string
      route_short_name: string
      route_long_name: string
      route_color: string
    }>
  } = await routesRes.json()

  // Build shape map from gtfs_routes (has geometry); lineas-red-fgc does not
  const shapeMap = new Map<string, { type: 'MultiLineString'; coordinates: number[][][] }>()
  if (shapesRes.ok) {
    const shapesData: {
      results: Array<{
        route_id: string
        route_short_name: string
        shape: { type: 'Feature'; geometry: { type: 'MultiLineString'; coordinates: number[][][] } } | null
      }>
    } = await shapesRes.json()
    for (const r of shapesData.results) {
      if (r.shape) shapeMap.set(r.route_short_name, r.shape.geometry)
    }
  }

  return routesData.results.map(r => ({
    routeId:   r.route_id,
    shortName: r.route_short_name,
    longName:  r.route_long_name,
    color:     `#${r.route_color}`,
    geometry:  shapeMap.get(r.route_short_name) ?? null,
  }))
}

// Returns a map of posicionament record id -> delay in minutes (from GTFS-RT arrival.delay)
export async function fetchTripDelays(): Promise<Map<string, number>> {
  const buffer = await fetchPbBuffer('trip-updates-gtfs_realtime')
  const { transit_realtime } = await import('gtfs-realtime-bindings')
  const feed = transit_realtime.FeedMessage.decode(buffer)

  const delays = new Map<string, number>()
  for (const entity of feed.entity) {
    if (!entity.tripUpdate) continue
    const tu = entity.tripUpdate
    // Take the delay from the first stop_time_update that has one
    for (const stu of tu.stopTimeUpdate ?? []) {
      const delaySec = (stu.arrival?.delay ?? stu.departure?.delay) as number | null | undefined
      if (delaySec != null && delaySec !== 0) {
        delays.set(entity.id, Math.round(delaySec / 60))
        break
      }
    }
    if (!delays.has(entity.id)) {
      delays.set(entity.id, 0)
    }
  }
  return delays
}

// Returns upcoming stop arrivals for a given trip entity ID
export async function fetchStopArrivals(
  entityId: string,
  stopNameMap: Map<string, string>,
): Promise<StopArrival[]> {
  const buffer = await fetchPbBuffer('trip-updates-gtfs_realtime')
  const { transit_realtime } = await import('gtfs-realtime-bindings')
  const feed = transit_realtime.FeedMessage.decode(buffer)

  const entity = feed.entity.find(e => e.id === entityId)
  if (!entity?.tripUpdate) return []

  const now = Date.now() / 1000
  return (entity.tripUpdate.stopTimeUpdate ?? [])
    .filter(stu => {
      const t = (stu.departure?.time ?? stu.arrival?.time) as number | null | undefined
      return t != null && (t as number) > now
    })
    .map(stu => {
      const stopId = stu.stopId ?? ''
      const baseCode = stopId.replace(/\d+$/, '')
      return {
        stopId,
        name: stopNameMap.get(stopId) ?? stopNameMap.get(baseCode) ?? stopId,
        arrivalTime: (stu.arrival?.time as number) ?? 0,
        departureTime: (stu.departure?.time as number) ?? 0,
      }
    })
}

export async function fetchAlerts(): Promise<Alert[]> {
  const buffer = await fetchPbBuffer('alerts-gtfs_realtime')
  const { transit_realtime } = await import('gtfs-realtime-bindings')
  const feed = transit_realtime.FeedMessage.decode(buffer)

  return feed.entity
    .filter(e => e.alert)
    .map(e => {
      const a = e.alert!
      return {
        id: e.id,
        header: pickText(a.headerText),
        description: pickText(a.descriptionText),
        routes: (a.informedEntity ?? [])
          .map(ie => ie.routeId)
          .filter((r): r is string => !!r),
      }
    })
    .filter(a => a.header)
}

// Air quality keyed by base stop code (no digit suffix), e.g. "PC", "SR"
export async function fetchAirQuality(): Promise<Map<string, StopDetail['air']>> {
  const res = await fetch(`${BASE}/calidad-del-aire-por-paradas0/records?limit=100`, {
    next: { revalidate: 1800 },
  })
  if (!res.ok) throw new Error(`Air quality API ${res.status}`)

  const data: {
    results: Array<{
      id: string
      iqam: string | null
      data_no2: number | null
      data_o3: number | null
      data_pm10: string | null
      nom_estaci: string | null
    }>
  } = await res.json()

  const map = new Map<string, StopDetail['air']>()
  for (const r of data.results) {
    map.set(r.id, {
      iqam: (r.iqam as 'BO' | 'MODERAT' | 'DOLENT' | null) ?? null,
      no2: r.data_no2,
      o3: r.data_o3,
      pm10: r.data_pm10 != null ? Number(r.data_pm10) : null,
      stationName: r.nom_estaci,
    })
  }
  return map
}

// Current time-range weather keyed by base stop code
export async function fetchWeather(): Promise<Map<string, StopDetail['weather']>> {
  const res = await fetch(
    `${BASE}/prediccion-meteorologica-del-dia-por-paradas/records?limit=200`,
    { next: { revalidate: 3600 } },
  )
  if (!res.ok) throw new Error(`Weather API ${res.status}`)

  const data: {
    results: Array<{
      stop_id: string
      estat_del_cel: string
      rang_horari: string
    }>
  } = await res.json()

  // Prefer the current time range; pick by closest to now
  const hour = new Date().getHours()
  const currentRange = hour < 12 ? 'Matí' : hour < 20 ? 'Tarda' : 'Nit'

  const map = new Map<string, StopDetail['weather']>()
  for (const r of data.results) {
    const baseCode = r.stop_id.replace(/\d+$/, '')
    // Prefer current range, but accept any if not found
    if (!map.has(baseCode) || r.rang_horari === currentRange) {
      map.set(baseCode, { sky: r.estat_del_cel, timeRange: r.rang_horari })
    }
  }
  return map
}

