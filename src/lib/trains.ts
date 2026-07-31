import type { Train } from '@/types'
import { STATION_CODES } from './constants'
import { fgcAllRecords } from './fgc'
import { finiteNum } from './validate'

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

function parsePct(v: string | null): number | null {
  if (!v) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function resolveStop(code: string | null | undefined): string {
  if (!code) return ''
  const base = code.replace(/\d+$/, '')
  return STATION_CODES[code] ?? STATION_CODES[base] ?? code
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

export async function fetchTrains(): Promise<Train[]> {
  // Page the feed rather than taking one 100-row page: FGC runs well over 100
  // trains at peak, and a capped fetch silently drops them from the map (and
  // skews the per-line delay medians computed from this list).
  const results = await fgcAllRecords<TrainPositionRecord>('posicionament-dels-trens', undefined, 0)

  return results
    .flatMap(r => {
      // A malformed/missing coordinate must not become NaN in the map's
      // animation math — drop the record instead of rendering a broken train.
      const lat = r.geo_point_2d && finiteNum(r.geo_point_2d.lat)
      const lng = r.geo_point_2d && finiteNum(r.geo_point_2d.lon)
      if (lat == null || lng == null) return []

      // Feed-field order is the physical composition order of FGC units:
      // M1 (cab motor) + M2 (its inseparable pair), then the intermediates.
      // (Keep in sync with WAGON_LABELS in constants.ts.)
      const wagons = [
        parsePct(r.ocupacio_m1_percent),
        parsePct(r.ocupacio_m2_percent),
        parsePct(r.ocupacio_mi_percent),
        parsePct(r.ocupacio_ri_percent),
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
      }]
    })
}
