import type { Train } from '@/types'
import { STATION_CODES } from './constants'
import { fgcRecords } from './fgc'

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

function resolveStop(code: string): string {
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
  const data = await fgcRecords<TrainPositionRecord>('posicionament-dels-trens', { limit: 100 }, 0)

  return data.results
    .filter(r => r.geo_point_2d !== null)
    .map(r => {
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

      return {
        id:               r.id,
        line:             r.lin,
        lat:              r.geo_point_2d!.lat,
        lng:              r.geo_point_2d!.lon,
        destination:      resolveStop(r.desti),
        origin:           resolveStop(r.origen),
        delayMinutes:     0,
        occupancyPercent,
        wagons:           perCarReal ? wagons : undefined,
        upcomingStops:    parseUpcomingStops(r.properes_parades),
        currentStop:      r.estacionat_a ? resolveStop(r.estacionat_a) : undefined,
      }
    })
}
