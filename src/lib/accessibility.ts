import { fgcAllRecords } from './fgc'

// Step-free itinerary instructions for an origin→destination pair, sourced from
// the `accesibilidad-itinerarios` dataset. Keyed by station *names* (not codes),
// so matching needs accent/case normalisation.

interface RawItinerary {
  linea: string
  origen: string
  destino: string
  solucion_1: string | null
}

export interface AccessibleItinerary {
  line: string
  origin: string
  destination: string
  steps: string
}

// Normalise a station name for fuzzy matching: strip accents, collapse
// whitespace, uppercase. "Plaça Catalunya" -> "PLACA CATALUNYA".
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

let cache: Map<string, AccessibleItinerary> | null = null
let inflight: Promise<Map<string, AccessibleItinerary>> | null = null

function keyFor(origin: string, destination: string): string {
  return `${normalizeName(origin)}->${normalizeName(destination)}`
}

async function build(): Promise<Map<string, AccessibleItinerary>> {
  // Accessibility itineraries change rarely; cache for a day.
  const rows = await fgcAllRecords<RawItinerary>('accesibilidad-itinerarios', undefined, 86400)
  const map = new Map<string, AccessibleItinerary>()
  for (const r of rows) {
    if (!r.origen || !r.destino || !r.solucion_1) continue
    map.set(keyFor(r.origen, r.destino), {
      line: r.linea,
      origin: r.origen,
      destination: r.destino,
      steps: r.solucion_1,
    })
  }
  return map
}

async function getItineraries(): Promise<Map<string, AccessibleItinerary>> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = build()
    .then(m => { cache = m; inflight = null; return m })
    .catch(err => { inflight = null; throw err })
  return inflight
}

/**
 * Look up the step-free itinerary for a journey between two station names.
 * Returns null when the pair isn't covered (not every pair has guidance).
 */
export async function findAccessibleItinerary(
  originName: string,
  destName: string,
): Promise<AccessibleItinerary | null> {
  const map = await getItineraries()
  return map.get(keyFor(originName, destName)) ?? null
}
