import type { Journey } from '@/types'

// ATM Barcelona official fares (2026)
export interface FarePrice {
  zones: number
  singleTicket: number // Bitllet senzill
  tCasual: number      // T-casual (10 viatges)
  tUsual: number      // T-usual (mensual bonificat)
}

export const ATM_FARES: Record<number, FarePrice> = {
  1: { zones: 1, singleTicket: 2.65, tCasual: 12.50, tUsual: 21.35 },
  2: { zones: 2, singleTicket: 3.65, tCasual: 24.75, tUsual: 28.40 },
  3: { zones: 3, singleTicket: 4.80, tCasual: 33.65, tUsual: 39.45 },
  4: { zones: 4, singleTicket: 6.10, tCasual: 43.15, tUsual: 47.80 },
  5: { zones: 5, singleTicket: 7.85, tCasual: 49.85, tUsual: 55.25 },
  6: { zones: 6, singleTicket: 9.35, tCasual: 53.40, tUsual: 60.70 },
}

// Station code / stopId -> ATM Barcelona tariff zone (1 to 6)
export const STATION_ATM_ZONES: Record<string, number> = {
  // ── Zona 1: Barcelona, L'Hospitalet, Cornellà, Sant Boi, Badalona ──
  // FGC Barcelona-Vallès (Zona 1)
  PC: 1, PR: 1, GR: 1, SG: 1, PD: 1, EP: 1, MN: 1, BN: 1, TT: 1, PM: 1, SR: 1, RE: 1, TB: 1, AV: 1,
  PF: 1, VR: 1, VS: 1, VL: 1,
  // FGC Llobregat-Anoia (Zona 1)
  PE: 1, MG: 1, IC: 1, GO: 1, SP: 1, LH: 1, AL: 1, CO: 1, BO: 1, SB: 1, MO: 1, EU: 1,
  // Rodalies Barcelona / L'Hospitalet / Baix Llobregat / Barcelonès (Zona 1)
  '71800': 1, // Sants
  '71801': 1, // Pl. Catalunya
  '71802': 1, // Passeig de Gràcia
  '71803': 1, // Arc de Triomf
  '71804': 1, // El Clot-Aragó
  '71805': 1, // Sant Andreu Comtal
  '71807': 1, // Sant Andreu Arenal / Fabra i Puig
  '71808': 1, // La Sagrera-Meridiana
  '78804': 1, // Torre Baró
  '72401': 1, // Bellvitge
  '71701': 1, // L'Hospitalet
  '72305': 1, // L'Hospitalet (R4)
  '72303': 1, // Cornellà
  '72302': 1, // Sant Joan Despí
  '72301': 1, // Sant Feliu de Llobregat
  '79400': 1, // Badalona
  '79402': 1, // Montgat
  '79403': 1, // Montgat Nord
  '78802': 1, // Santa Coloma

  // ── Zona 2: Vallès Occidental / Baix Llobregat / Maresme Sud / Garraf Nord ──
  // FGC Vallès (Zona 2)
  LF: 2, VD: 2, SC: 2, MS: 2, HG: 2, RB: 2, VO: 2, SJ: 2, BT: 2, UN: 2, UA: 2, SQ: 2,
  CF: 2, PJ: 2, CT: 2, NO: 2, PN: 2, SPF: 2, FN: 2, TR: 2, VP: 2, EN: 2, TE: 2, NA: 2, TN: 2,
  // FGC Llobregat (Zona 2)
  CG: 2, CR: 2, QC: 2, PA: 2, SA: 2, PL: 2, MV: 2, MC: 2, ME: 2,
  // Rodalies Zona 2
  '72300': 2, // Molins de Rei
  '72211': 2, // El Papiol
  '72210': 2, // Castellbisbal
  '72501': 2, // Rubí Can Vallhonrat
  '72502': 2, // Sant Cugat Coll Favà
  '72503': 2, // Cerdanyola Universitat
  '78706': 2, // Cerdanyola del Vallès
  '78705': 2, // Barberà del Vallès
  '78703': 2, // Sabadell Sud
  '78704': 2, // Sabadell Centre
  '78709': 2, // Sabadell Nord
  '78710': 2, // Terrassa Est
  '78700': 2, // Terrassa Estació del Nord
  '78800': 2, // Montcada Bifurcació
  '79005': 2, // Montcada i Reixac
  '78708': 2, // Montcada-Manresa
  '78707': 2, // Montcada-Santa Maria
  '77002': 2, // Montcada-Ripollet
  '77003': 2, // Santa Perpètua de Mogoda
  '72508': 2, // Santa Perpètua de Mogoda Riera de Caldes
  '77004': 2, // Mollet-Santa Rosa
  '79006': 2, // Mollet-Sant Fost
  '79007': 2, // Montmeló
  '79011': 2, // La Llagosta
  '79404': 2, // El Masnou
  '79405': 2, // Ocata
  '79406': 2, // Premià de Mar
  '79407': 2, // Vilassar de Mar
  '71704': 2, // El Prat de Llobregat
  '71705': 2, // Aeroport
  '71706': 2, // Viladecans
  '71707': 2, // Gavà
  '71708': 2, // Castelldefels
  '71709': 2, // Platja de Castelldefels

  // ── Zona 3: Maresme Central, Vallès Oriental, Alt Penedès, Garraf ──
  AB: 3, OL: 3, AM: 3,
  '79500': 3, // Mataró
  '79501': 3, // Sant Andreu de Llavaneres
  '79502': 3, // Caldes d'Estrac
  '79503': 3, // Arenys de Mar
  '79504': 3, // Canet de Mar
  '79100': 3, // Granollers Centre
  '77006': 3, // Granollers-Canovelles
  '79109': 3, // Les Franqueses-Granollers Nord
  '77100': 3, // Les Franqueses del Vallès
  '79101': 3, // Cardedeu
  '79102': 3, // Llinars del Vallès
  '77005': 3, // Parets del Vallès
  '71607': 3, // Sitges
  '71606': 3, // Garraf
  '72208': 3, // Gelida
  '72209': 3, // Martorell Central
  '72304': 3, // Martorell Central (Rodalies)
  '72212': 3, // Viladecavalls
  '72213': 3, // Sant Miquel de Gonteres
  '72214': 3, // Vacarisses
  '72215': 3, // Vacarisses-Torreblanca

  // ── Zona 4: Bages, Anoia, Maresme Nord, Alt Penedès / Garraf Sud ──
  MM: 4, CB: 4, VC: 4, MA: 4, MB: 4,
  '71605': 4, // Vilanova i la Geltrú
  '79505': 4, // Sant Pol de Mar
  '79506': 4, // Calella
  '79507': 4, // Pineda de Mar
  '79508': 4, // Santa Susanna
  '79509': 4, // Malgrat de Mar
  '79103': 4, // Palautordera
  '79104': 4, // Sant Celoni
  '79105': 4, // Gualba
  '79106': 4, // Riells i Viabrea-Breda
  '77104': 4, // Sant Martí de Centelles
  '77105': 4, // Centelles
  '77106': 4, // Balenyà-Els Hostalets
  '77107': 4, // Balenyà-Tona
  '77108': 4, // Vic
  '78605': 4, // Castellbell i el Vilar-Monistrol
  '78604': 4, // Sant Vicenç de Castellet
  '78600': 4, // Manresa
  '72204': 4, // Vilafranca del Penedès
  '72205': 4, // La Granada
  '72206': 4, // Lavern-Subirats
  '72203': 4, // Els Monjos

  // ── Zona 5: Baix Penedès, Osona Nord, Selva Sud ──
  '79201': 5, // Blanes
  '79200': 5, // Tordera
  '71604': 5, // Cubelles
  '71603': 5, // Cunit
  '71602': 5, // Segur de Calafell
  '71601': 5, // Calafell
  '71600': 5, // Sant Vicenç de Calders
  '72202': 5, // L'Arboç
  '72201': 5, // El Vendrell
  '77200': 5, // Manlleu
  '77201': 5, // Torelló
  '77202': 5, // Borgonyà
  '77203': 5, // Sant Quirze de Besora

  // ── Zona 6: Selva Central, Ripollès ──
  '79202': 6, // Maçanet-Massanes
  '77204': 6, // La Farga de Bebiè
  '77205': 6, // Ripoll
}

/**
 * Returns the ATM tariff zone for a station code or stop ID (defaults to 1 if unknown).
 */
export function getStationZone(stationCode: string): number {
  if (STATION_ATM_ZONES[stationCode]) return STATION_ATM_ZONES[stationCode]
  const stripped = stationCode.replace(/\d+$/, '')
  if (STATION_ATM_ZONES[stripped]) return STATION_ATM_ZONES[stripped]
  return 1
}

/**
 * Computes the number of ATM zones and prices for a planned journey.
 * Uses the official ATM crown rule: counts the span between the minimum and maximum
 * zone traversed along the route.
 */
export function computeJourneyFare(journey: Journey): FarePrice {
  const zonesTraversed = new Set<number>()

  for (const leg of journey.legs) {
    zonesTraversed.add(getStationZone(leg.fromCode))
    zonesTraversed.add(getStationZone(leg.toCode))
    if (leg.stops) {
      for (const s of leg.stops) {
        zonesTraversed.add(getStationZone(s.code))
      }
    }
  }

  const zoneList = Array.from(zonesTraversed).filter(z => z >= 1 && z <= 6)
  if (zoneList.length === 0) return ATM_FARES[1]

  const minZone = Math.min(...zoneList)
  const maxZone = Math.max(...zoneList)

  // Number of tariff zones crossed
  const count = Math.min(6, Math.max(1, maxZone - minZone + 1))
  return ATM_FARES[count] || ATM_FARES[1]
}
