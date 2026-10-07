import { cached } from './cache.ts'
import { getStationCode } from './constants.ts'
import type { Train, Stop, Route, Departure, Alert } from '@/types'

const FLOTA_URL = 'https://tiempo-real.renfe.com/renfe-visor/flota.json'
const ESTACIONES_URL = 'https://tiempo-real.renfe.com/data/estaciones.geojson'
const LINEAS_URL = 'https://tiempo-real.renfe.com/renfe-visor/lineas.geojson'
const SALIDAS_URL = 'https://tiempo-real.renfe.com/renfe-json-cutter/write/salidas/estacion'
const INCIDENCIAS_RSS_URL = 'https://www.gencat.cat/rodalies/incidencies_rodalies_rss_ca_ES.xml'

// Rodalies de Catalunya is nucleus 50 in Renfe's internal systems.
const NUCLEO_CATALUNYA = 50

interface RawRenfeTrain {
  tripId: string
  codTren: string
  codLinea: string
  retrasoMin: string
  codEstAct: string
  codEstSig: string
  horaLlegadaSigEst?: string
  codEstDest: string
  codEstOrig: string
  porAvanc: string
  latitud: number
  longitud: number
  nucleo: string
  accesible: boolean | number
  via?: string
  nextVia?: string
}

interface RawRenfeStationFeature {
  type: 'Feature'
  properties: {
    CODIGO_ESTACION: number
    NOMBRE_ESTACION: string
    NUCLEO: number
    NOMBRE_NUCLEO: string
    LATITUD: number
    LONGITUD: number
    COLOR?: string
    ACCESIBILIDAD?: string | null
    LINEAS?: string | null
    MOSTRAR?: string
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
}

interface RawRenfeLineFeature {
  type: 'Feature'
  properties: {
    IDNUCLEO: number
    CODIGO: string
    NOMBRE: string
    COLOR?: string
    NUCLEO: string
  }
  geometry: {
    type: 'LineString' | 'MultiLineString'
    coordinates: number[][] | number[][][]
  }
}

interface RawRenfeSalida {
  trenId?: string
  tripId?: string
  destino?: string
  destinoNombre?: string
  horaSalida?: string
  horaSalidaReal?: string
  horaSalidaPlanificada?: string
  accesible?: number | boolean
  linea?: string
  via?: string
  locEstacion?: string
  position?: string
}

function parseMadridTimeToEpoch(dateTimeStr: string): number {
  if (!dateTimeStr) return 0
  const [d, t] = dateTimeStr.replace(' ', 'T').split('T')
  if (!t) return 0
  const [year, month, day] = d.split('-').map(Number)
  const [hour, minute, second] = t.split(':').map(Number)
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return 0

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0))
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(utcGuess)

  const mHour = Number(parts.find(p => p.type === 'hour')?.value ?? hour)
  const diff = (mHour - hour + 24) % 24
  const finalDate = new Date(utcGuess.getTime() - diff * 3600 * 1000)
  return Math.floor(finalDate.getTime() / 1000)
}

function parseClockSeconds(clockStr: string): number {
  if (!clockStr) return 0
  const parts = clockStr.split(':')
  if (parts.length < 2) return 0
  const h = Number(parts[0]) || 0
  const m = Number(parts[1]) || 0
  const s = Number(parts[2]) || 0
  return h * 3600 + m * 60 + s
}

// ── 1. Stations ─────────────────────────────────────────────────────────────

async function loadRenfeStations(): Promise<{ stops: Stop[]; map: Map<string, string> }> {
  const res = await fetch(ESTACIONES_URL, { next: { revalidate: 86400 } })
  if (!res.ok) throw new Error(`Renfe stations API ${res.status}`)
  const geojson = await res.json() as { features?: RawRenfeStationFeature[] }
  const features = (geojson.features ?? []).filter(f => f.properties?.NUCLEO === NUCLEO_CATALUNYA)

  const stops: Stop[] = []
  const map = new Map<string, string>()

  for (const f of features) {
    const p = f.properties
    const code = String(p.CODIGO_ESTACION)
    const name = p.NOMBRE_ESTACION.trim()
    map.set(code, name)

    const lines = p.LINEAS
      ? p.LINEAS.split(',').map(l => l.trim()).filter(Boolean)
      : []

    stops.push({
      stopId: code,
      name,
      code: getStationCode(code, name),
      lat: p.LATITUD,
      lng: p.LONGITUD,
      wheelchairBoarding: p.ACCESIBILIDAD === 'Accesible',
      operator: 'renfe',
      lines,
    })
  }

  return { stops, map }
}

export async function fetchRenfeStations(): Promise<Stop[]> {
  const data = await cached('renfe:stations', 86400 * 1000, loadRenfeStations)
  return data.stops
}

export async function fetchRenfeStationMap(): Promise<Map<string, string>> {
  const data = await cached('renfe:stations', 86400 * 1000, loadRenfeStations)
  return data.map
}

// ── 2. Routes (Lines) ────────────────────────────────────────────────────────

async function loadRenfeRoutes(): Promise<Route[]> {
  const res = await fetch(LINEAS_URL, { next: { revalidate: 86400 } })
  if (!res.ok) throw new Error(`Renfe lines API ${res.status}`)
  const geojson = await res.json() as { features?: RawRenfeLineFeature[] }
  const features = (geojson.features ?? []).filter(f => f.properties?.IDNUCLEO === NUCLEO_CATALUNYA)

  return features.map(f => {
    const geom = f.geometry
    const coordinates = geom.type === 'MultiLineString'
      ? (geom.coordinates as number[][][])
      : [geom.coordinates as number[][]]

    return {
      routeId: f.properties.CODIGO,
      shortName: f.properties.CODIGO,
      longName: f.properties.NOMBRE || f.properties.CODIGO,
      color: f.properties.COLOR || '#FAB400',
      operator: 'renfe',
      geometry: {
        type: 'MultiLineString',
        coordinates,
      },
    }
  })
}

export async function fetchRenfeRoutes(): Promise<Route[]> {
  return cached('renfe:routes', 86400 * 1000, loadRenfeRoutes)
}

// ── 3. Real-Time Train Positions ─────────────────────────────────────────────

async function loadRenfeTrains(): Promise<Train[]> {
  const [stationMap, res] = await Promise.all([
    fetchRenfeStationMap(),
    fetch(`${FLOTA_URL}?v=${Date.now()}`, { cache: 'no-store' }),
  ])
  if (!res.ok) throw new Error(`Renfe flota API ${res.status}`)

  const data = await res.json() as { trenes?: RawRenfeTrain[] }
  const rawList = (data.trenes ?? []).filter(t =>
    (String(t.nucleo) === String(NUCLEO_CATALUNYA) || String(t.nucleo) === '51' || /^(R|RT|RG|RL)\d/i.test(t.codLinea)) &&
    typeof t.latitud === 'number' &&
    typeof t.longitud === 'number' &&
    !isNaN(t.latitud) &&
    !isNaN(t.longitud) &&
    t.latitud >= 40.0 && t.latitud <= 43.5 &&
    t.longitud >= 0.0 && t.longitud <= 4.0
  )

  return rawList.map(t => {
    const orig = stationMap.get(t.codEstOrig) || t.codEstOrig
    const dest = stationMap.get(t.codEstDest) || t.codEstDest
    const prev = stationMap.get(t.codEstAct) || t.codEstAct
    const next = stationMap.get(t.codEstSig) || t.codEstSig

    const statusLetter = t.porAvanc?.toUpperCase()
    const operationalStatus: Train['operationalStatus'] =
      statusLetter === 'A' ? 'approaching'
      : statusLetter === 'E' ? 'stationed'
      : statusLetter === 'S' ? 'departing'
      : 'moving'

    const eta = t.horaLlegadaSigEst ? parseMadridTimeToEpoch(t.horaLlegadaSigEst) : undefined

    // Renfe live telemetry only provides the next stop and terminal destination;
    // we never synthesize fake intermediate stops.
    const upcomingStops: string[] = next
      ? (dest && dest !== next ? [next, dest] : [next])
      : (dest ? [dest] : [])

    return {
      id: t.tripId || `renfe-${t.codTren}`,
      line: t.codLinea,
      lat: t.latitud,
      lng: t.longitud,
      destination: dest,
      origin: orig,
      delayMinutes: Number(t.retrasoMin) || 0,
      occupancyPercent: 0,
      upcomingStops,
      currentStop: operationalStatus === 'stationed' ? prev : undefined,
      nextStopEta: eta,
      operator: 'renfe',
      trainNumber: t.codTren,
      prevStop: prev,
      prevTrack: t.via || undefined,
      nextStop: next,
      nextTrack: t.nextVia || undefined,
      operationalStatus,
      accessible: t.accesible === true || t.accesible === 1,
    }
  })
}

export async function fetchRenfeTrains(): Promise<Train[]> {
  // Memoized for 10s to match Renfe's 20s tick while sharing upstream across users
  return cached('renfe:trains', 10_000, loadRenfeTrains)
}

// ── 4. Real-Time Station Departures ──────────────────────────────────────────

async function loadRenfeDepartures(stationCode: string): Promise<Departure[]> {
  const res = await fetch(`${SALIDAS_URL}/${stationCode}.json?v=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Renfe salidas API ${res.status}`)
  }

  const json = await res.json() as { estacion?: { salidas?: RawRenfeSalida[] } }
  const salidas = json.estacion?.salidas ?? []

  return salidas.map(s => {
    // Dates formatted as "DD-MM-YYYY HH:MM:SS"
    const planClock = (s.horaSalidaPlanificada || s.horaSalida || '').split(' ')[1] || '00:00:00'
    const depTime = parseClockSeconds(planClock)

    let delayMin = 0
    if (s.horaSalidaPlanificada && (s.horaSalidaReal || s.horaSalida)) {
      const realClock = (s.horaSalidaReal || s.horaSalida || '').split(' ')[1] || planClock
      delayMin = Math.round((parseClockSeconds(realClock) - depTime) / 60)
    }

    return {
      line: s.linea || '',
      headsign: s.destinoNombre || s.destino || '',
      depTime,
      delayMin,
      track: s.via || undefined,
      accessible: s.accesible === 1 || s.accesible === true,
    }
  })
}

export async function fetchRenfeDepartures(stationCode: string): Promise<Departure[]> {
  return cached(`renfe:salidas:${stationCode}`, 30_000, () => loadRenfeDepartures(stationCode))
}

// ── 5. Real-Time Service Alerts (Gencat RSS) ────────────────────────────────

async function loadRenfeAlerts(): Promise<Alert[]> {
  try {
    const [stations, res] = await Promise.all([
      fetchRenfeStations().catch(() => []),
      fetch(INCIDENCIAS_RSS_URL, {
        headers: { 'User-Agent': 'Andana/1.0 (https://andana.cat)' },
        cache: 'no-store',
      }),
    ])

    if (!res.ok) {
      console.error(`Rodalies RSS fetch returned ${res.status}`)
      return []
    }

    const xml = await res.text()
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    const alerts: Alert[] = []
    let match: RegExpExecArray | null

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1]
      const rawTitle = (itemContent.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''
      const rawDesc = (itemContent.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || ''
      const rawDate = (itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''

      const title = rawTitle.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
      const desc = rawDesc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
      if (!desc && !title) continue

      // 1. Line routes extraction
      const lineMatch = title.match(/^Líni[ea]s?\s+([^.]+)\./i)
      let routes: string[] = []
      if (lineMatch) {
        routes = lineMatch[1]
          .split(/[,\s/]+/)
          .map(s => s.trim().replace('R2_NORD', 'R2N').replace('R2_SUD', 'R2S'))
          .filter(Boolean)
      } else {
        const lineMatches = (title + ' ' + desc).match(/\b(R[1-8]|R1[1-7]|RL[34]|RT[12]|RG1|R2N|R2S)\b/g)
        if (lineMatches) routes = Array.from(new Set(lineMatches))
      }

      // 2. Publication date
      let startEpoch: number | undefined
      if (rawDate) {
        const parsed = Date.parse(rawDate)
        if (!isNaN(parsed)) startEpoch = Math.floor(parsed / 1000)
      }

      // 3. Header & description
      // Gencat often truncates <title> at 140 chars; <description> has full text
      const firstSentence = desc.split(/\.\s+/)[0]?.trim()
      let header = firstSentence && firstSentence.length > 20
        ? firstSentence + (firstSentence.endsWith('.') ? '' : '.')
        : title.replace(/^Líni[ea]s?\s+[^.]+\.\s*/i, '').trim() || desc

      if (header.length > 140) {
        header = header.slice(0, 137).trim() + '…'
      }

      // Strip redundant leading header or first sentence from description so it doesn't repeat
      let cleanDesc = desc.trim()
      const headerPrefix = header.replace(/[.…]+$/, '').trim()
      if (cleanDesc.toLowerCase().startsWith(headerPrefix.toLowerCase())) {
        cleanDesc = cleanDesc.slice(headerPrefix.length).replace(/^[.,;: ]+/, '').trim()
      }

      // 4. Affected stations
      const matchedStops: string[] = []
      const lowerDesc = desc.toLowerCase()
      for (const s of stations) {
        if (s.name.length >= 4 && lowerDesc.includes(s.name.toLowerCase())) {
          matchedStops.push(s.name)
        }
      }

      // 5. Plain language contextual explanation
      let explanation: string | undefined
      if (lowerDesc.includes('carretera') || lowerDesc.includes('autobús') || lowerDesc.includes('autobus') || lowerDesc.includes('transport alternatiu')) {
        explanation = 'Servei alternatiu per carretera en el tram indicat degut a incidències o obres.'
      } else if (lowerDesc.includes('inuncat') || lowerDesc.includes('meteorol') || lowerDesc.includes('pluges') || lowerDesc.includes('vent')) {
        explanation = "Afectació derivada de condicions meteorològiques adverses i alertes de Protecció Civil."
      } else if (lowerDesc.includes('restableix') || lowerDesc.includes('restablert')) {
        explanation = 'Servei en procés de normalització o restabliment gradual.'
      }

      alerts.push({
        id: `renfe-alert-${startEpoch || Date.now()}-${routes.slice(0, 3).join('-') || alerts.length}`,
        header,
        description: cleanDesc || undefined,
        explanation,
        routes,
        stops: matchedStops.length > 0 ? matchedStops : undefined,
        start: startEpoch,
        operator: 'renfe',
        url: 'https://rodalies.gencat.cat/ca/alteracions_del_servei/',
      })
    }

    return alerts
  } catch (err) {
    console.error('Rodalies alerts RSS failed:', err)
    return []
  }
}

export async function fetchRenfeAlerts(): Promise<Alert[]> {
  return cached('renfe:alerts', 60_000, loadRenfeAlerts)
}
