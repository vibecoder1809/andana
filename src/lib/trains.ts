import type { Train } from '@/types'
import { STATION_CODES } from './constants'
import { fgcAllRecords } from './fgc'
import { finiteNum } from './validate'
import { isNightRestHours } from './serviceTime'

interface TrainPositionRecord {
  id: string
  lin: string
  geo_point_2d: { lon: number; lat: number } | null
  dir: string
  origen: string
  desti: string
  en_hora: string
  ut: string
  properes_parades: string | null
  estacionat_a: string | null
  ocupacio_m1_percent: string | null
  ocupacio_m2_percent: string | null
  ocupacio_mi_percent: string | null
  ocupacio_ri_percent: string | null
}

function normalizeTrainRecord(raw: any): TrainPositionRecord | null {
  if (!raw) return null

  // Standard record where id and lin are properly populated
  if (typeof raw.id === 'string' && raw.id.trim() && typeof raw.lin === 'string' && raw.lin.trim()) {
    return raw as TrainPositionRecord
  }

  // Upstream FGC Open Data CSV column-shift recovery:
  // When upstream export misaligns columns, the fields are shifted:
  // - id is in raw.ocupacio_mi_percent (hash with '|')
  // - lin is in raw.ocupacio_mi_tram (e.g. 'S1', 'S2', 'R5')
  // - dir is in raw.ocupacio_ri_percent ('A' or 'D')
  // - origen is in raw.ocupacio_ri_tram
  // - desti is in raw.ocupacio_m1_tram
  // - properes_parades is in raw.ocupacio_m1_percent
  // - estacionat_a is in raw.ocupacio_m2_percent
  // - en_hora is in raw.ocupacio_m2_tram
  if (
    typeof raw.ocupacio_mi_percent === 'string' &&
    raw.ocupacio_mi_percent.includes('|') &&
    typeof raw.ocupacio_mi_tram === 'string' &&
    /^[A-Z0-9]+$/i.test(raw.ocupacio_mi_tram.trim())
  ) {
    return {
      id: raw.ocupacio_mi_percent.trim(),
      lin: raw.ocupacio_mi_tram.trim(),
      geo_point_2d: raw.geo_point_2d,
      dir: typeof raw.ocupacio_ri_percent === 'string' ? raw.ocupacio_ri_percent : '',
      origen: typeof raw.ocupacio_ri_tram === 'string' ? raw.ocupacio_ri_tram : '',
      desti: typeof raw.ocupacio_m1_tram === 'string' ? raw.ocupacio_m1_tram : '',
      en_hora: typeof raw.ocupacio_m2_tram === 'string' ? raw.ocupacio_m2_tram : '',
      ut: '',
      properes_parades: typeof raw.ocupacio_m1_percent === 'string' ? raw.ocupacio_m1_percent : null,
      estacionat_a: typeof raw.ocupacio_m2_percent === 'string' ? raw.ocupacio_m2_percent : null,
      ocupacio_m1_percent: null,
      ocupacio_m2_percent: null,
      ocupacio_mi_percent: null,
      ocupacio_ri_percent: null,
    }
  }

  return null
}

function parsePct(v: string | null): number | null {
  if (!v) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

export function resolveStop(code: string | null | undefined): string {
  if (!code) return ''
  const trimmed = code.trim()
  if (STATION_CODES[trimmed]) return STATION_CODES[trimmed]
  // Strip trailing platform numbers (e.g. PC2 -> PC) and bus suffixes (e.g. GRbus -> GR, GRbus1 -> GR)
  const base = trimmed.replace(/\d+$/, '').replace(/bus\d*$/i, '')
  return STATION_CODES[base] ?? trimmed.replace(/bus\d*$/i, '')
}

function parseUpcomingStops(raw: string | null): string[] {
  if (!raw) return []
  // Format: '{"parada": "SC"};{"parada": "MS"};...'
  return raw.split(';').map(s => {
    try {
      const obj = JSON.parse(s.trim()) as { parada: string }
      return resolveStop(obj.parada)
    } catch {
      return ''
    }
  }).filter(Boolean)
}

function isCremalleraOperatingHours(): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date())
    const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
    const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
    const minutes = h * 60 + m
    // Commercial service operates between ~08:20 and 20:15 in Catalonia time
    return minutes >= 8 * 60 + 20 && minutes <= 20 * 60 + 15
  } catch {
    return true
  }
}

export async function fetchTrains(): Promise<Train[]> {
  // Page the feed rather than taking one 100-row page: FGC runs well over 100
  // trains at peak, and a capped fetch silently drops them from the map (and
  // skews the per-line delay medians computed from this list).
  const results = await fgcAllRecords<any>('posicionament-dels-trens', undefined, 0)
  const inCremalleraHours = isCremalleraOperatingHours()
  const isNight = isNightRestHours()

  return results
    .flatMap(raw => {
      const r = normalizeTrainRecord(raw)
      // Drop malformed/ghost records missing a valid id or line code
      if (!r || !r.id || !r.lin) return []

      // A malformed/missing coordinate must not become NaN in the map's
      // animation math — drop the record instead of rendering a broken train.
      const lat = r.geo_point_2d && finiteNum(r.geo_point_2d.lat)
      const lng = r.geo_point_2d && finiteNum(r.geo_point_2d.lon)
      if (lat == null || lng == null) return []

      const isCremallera = r.lin === 'M1' || r.lin === 'M2' || r.lin === 'MM'
      // Outside commercial operating hours, Cremallera units left with transponders on at
      // sidings are 100% sleeping/inactive. Drop them completely so they are not shown as online trains.
      if (isCremallera && !inCremalleraHours) {
        return []
      }

      // During night rest hours (01:15 to 04:55), regular commercial passenger service
      // is suspended. Transponders left active on parked units overnight or stale
      // completed runs must not be shown as ghost trains.
      if (isNight && !isCremallera) {
        return []
      }

      // Feed-field order is the physical composition order of FGC units:
      // M1 (cab motor) — Mi (intermediate motor) — Ri (intermediate trailer) — M2 (cab motor).
      // (Keep in sync with WAGON_LABELS in constants.ts.)
      const wagons = [
        parsePct(r.ocupacio_m1_percent),
        parsePct(r.ocupacio_mi_percent),
        parsePct(r.ocupacio_ri_percent),
        parsePct(r.ocupacio_m2_percent),
      ]
      const valid = wagons.filter((v): v is number => v !== null)
      const occupancyPercent =
        valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0

      // The onboard system often copies one aggregate figure into every car
      // field (e.g. 32/32/32/32) instead of real per-car counts — a
      // "breakdown" that's just the average repeated. Suppress those (the
      // mean still shows) and pass through only distinct, real telemetry.
      // Nulls stay positional so a 3-car unit renders 3 correctly-named cars.
      const perCarReal = valid.length >= 2 && new Set(valid).size > 1

      let operationalStatus: Train['operationalStatus'] = undefined
      let isDepot = false

      if (isCremallera) {
        if (r.estacionat_a) {
          operationalStatus = 'stationed'
        } else {
          operationalStatus = 'moving'
        }
      } else if (r.estacionat_a) {
        operationalStatus = 'stationed'
      } else {
        operationalStatus = 'moving'
      }

      return [{
        id:               r.id,
        line:             r.lin,
        lat,
        lng,
        destination:      resolveStop(r.desti),
        origin:           resolveStop(r.origen),
        delayMinutes:     0,
        occupancyPercent,
        wagons:           perCarReal ? wagons : undefined,
        upcomingStops:    parseUpcomingStops(r.properes_parades),
        currentStop:      r.estacionat_a ? resolveStop(r.estacionat_a) : undefined,
        operator:         'fgc',
        operationalStatus,
        isDepot:          isDepot || undefined,
      }]
    })
}
