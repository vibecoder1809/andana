import type { Stop, Route } from '@/types'
import { STATION_CODES, RENFE_STATION_CODES } from './constants'
import { buildPolyline, projectOntoPolyline, positionAtDistance, haversine } from './geometry'
import { normalizeSearchText } from './searchUtils'

/**
 * Normalizes line string representations into a canonical key.
 * e.g. "R-1" -> "R1", "R2 Nord" -> "R2N", "r 4" -> "R4".
 */
export function normalizeLineCode(line: string): string {
  if (!line) return ''
  const clean = line.trim().toUpperCase().replace(/[\s-_]+/g, '')
  if (clean === 'R2NORD' || clean === 'R2NORTH') return 'R2N'
  if (clean === 'R2SUD' || clean === 'R2SOUTH') return 'R2S'
  return clean
}

/**
 * Authoritative, ordered sequence of station codes along each rail line in Catalonia.
 * For FGC: base station codes (matching STATION_CODES).
 * For Rodalies/Renfe: official numeric station codes (matching RENFE_STATION_CODES).
 */
export const LINE_STATION_CODES: Record<string, string[]> = {
  // ── FGC: Línia Barcelona - Vallès ──
  S1: [
    'PC', 'PR', 'GR', 'MN', 'SR', 'PF', 'VL', 'LF', 'VD', 'SC',
    'MS', 'HG', 'RB', 'FN', 'TR', 'VP', 'EN', 'NA',
  ],
  S2: [
    'PC', 'PR', 'GR', 'MN', 'SR', 'PF', 'VL', 'LF', 'VD', 'SC',
    'VO', 'SJ', 'BT', 'UN', 'SQ', 'CF', 'PJ', 'CT', 'NO', 'PN',
  ],
  L6: [
    'PC', 'PR', 'GR', 'SG', 'MN', 'BN', 'TT', 'SR',
  ],
  L7: [
    'PC', 'PR', 'GR', 'PM', 'PD', 'EP', 'TB',
  ],
  L12: [
    'SR', 'RE',
  ],

  // ── FGC: Línia Llobregat - Anoia ──
  L8: [
    'PE', 'MG', 'IC', 'EU', 'GO', 'SP', 'LH', 'AL', 'CO', 'BO', 'ML',
  ],
  S3: [
    'PE', 'MG', 'IC', 'EU', 'GO', 'SP', 'LH', 'AL', 'CO', 'BO', 'ML',
    'CL', 'CG', 'CR',
  ],
  S4: [
    'PE', 'MG', 'IC', 'EU', 'GO', 'SP', 'LH', 'AL', 'CO', 'BO', 'ML',
    'CL', 'CG', 'CR', 'QC', 'PA', 'SA', 'PL', 'MV', 'MC', 'ME', 'AB', 'OL',
  ],
  S8: [
    'PE', 'MG', 'IC', 'EU', 'GO', 'SP', 'LH', 'AL', 'CO', 'BO', 'ML',
    'CL', 'CG', 'CR', 'QC', 'PA', 'SA', 'PL', 'MV', 'MC', 'ME',
  ],
  S9: [
    'PE', 'MG', 'IC', 'EU', 'GO', 'SP', 'LH', 'AL', 'CO', 'BO', 'ML',
    'CL', 'CG', 'CR', 'QC',
  ],
  R5: [
    'PE', 'MG', 'IC', 'EU', 'GO', 'SP', 'LH', 'AL', 'CO', 'BO', 'ML',
    'CL', 'CG', 'CR', 'QC', 'PA', 'SA', 'PL', 'MV', 'MC', 'ME', 'AB', 'OL',
    'AE', 'MO', 'SV', 'VI', 'MA', 'MB',
  ],
  R50: [
    'PE', 'IC', 'EU', 'GO', 'LH', 'BO', 'SA', 'MC', 'ME', 'AB', 'OL',
    'MO', 'SV', 'VI', 'MA', 'MB',
  ],
  R53: [
    'PE', 'MG', 'IC', 'EU', 'GO', 'SP', 'LH', 'AL', 'CO', 'BO', 'ML',
    'CL', 'CG', 'CR', 'QC', 'PA', 'SA', 'PL', 'MV', 'MC', 'ME', 'AB', 'OL',
    'AE', 'MO', 'SV', 'VI', 'MA', 'MB',
  ],
  R6: [
    'PE', 'MG', 'IC', 'EU', 'GO', 'SP', 'LH', 'AL', 'CO', 'BO', 'ML',
    'CL', 'CG', 'CR', 'QC', 'PA', 'SA', 'PL', 'MV', 'MC', 'ME', 'SE', 'BE',
    'CP', 'MQ', 'PI', 'VA', 'CA', 'PO', 'VN', 'IG',
  ],
  R60: [
    'PE', 'IC', 'EU', 'GO', 'LH', 'BO', 'SA', 'MC', 'ME', 'SE', 'BE',
    'CP', 'MQ', 'PI', 'VA', 'CA', 'PO', 'VN', 'IG',
  ],
  R63: [
    'PE', 'MG', 'IC', 'EU', 'GO', 'SP', 'LH', 'AL', 'CO', 'BO', 'ML',
    'CL', 'CG', 'CR', 'QC', 'PA', 'SA', 'PL', 'MV', 'MC', 'ME', 'SE', 'BE',
    'CP', 'MQ', 'PI', 'VA', 'CA', 'PO', 'VN', 'IG',
  ],

  // ── FGC: Funiculars & Cremallera ──
  FV: ['VR', 'VS'],
  MM: ['MO', 'MP', 'MM'],
  M1: ['MO', 'MP', 'MM'],
  M2: ['MO', 'MP', 'MM'],

  // ── FGC: Lleida - La Pobla ──
  RL1: ['LE', 'AT', 'VB', 'VF', 'BG'],
  RL2: [
    'LE', 'AT', 'VB', 'VF', 'BG', 'SM', 'LS', 'AR', 'LL', 'GT',
    'PT', 'TP', 'SD', 'PS',
  ],

  // ── Rodalies de Catalunya ──
  R1: [
    '72300', '72301', '72302', '72303', '72305', '71801', '78805', '78804', '79009',
    '79403', '79404', '79405', '79406', '79407', '79408', '79409', '79410', '79412',
    '79500', '79501', '79502', '79600', '79601', '79602', '79603', '79604', '79608',
    '79605', '79606', '79607', '79200',
  ],
  RG1: [
    '72305', '71801', '78805', '78804', '79009', '79403', '79404', '79405', '79406',
    '79407', '79408', '79409', '79410', '79412', '79500', '79501', '79502', '79600',
    '79601', '79602', '79603', '79604', '79608', '79605', '79606', '79607', '79200',
    '79202', '79203', '79204', '79205', '79300', '79301', '79302', '79303', '79304',
    '79305', '79306', '79308', '79309', '79311', '79312', '79314', '79315',
  ],
  R2: [
    '71705', '71706', '71709', '71707', '71708', '71801', '71802', '79009', '79004',
    '79005', '79011', '79006', '79007', '79100',
  ],
  R2N: [
    '72400', '71707', '71708', '71801', '71802', '79009', '79004', '79005', '79011',
    '79006', '79007', '79100', '79109', '79101', '79102', '79103', '79104', '79105',
    '79106', '79107', '79200',
  ],
  R2S: [
    '79400', '71802', '71801', '71708', '71707', '71709', '71706', '71705', '71704',
    '71703', '71701', '71700', '71604', '71603', '71602', '71601', '71600',
  ],
  R3: [
    '72305', '71801', '78805', '78804', '78806', '78802', '78801', '78800', '77002',
    '77003', '77004', '77005', '77006', '77100', '77102', '77103', '77104', '77105',
    '77106', '77107', '77109', '77110', '77111', '77112', '77113', '77114', '77200',
    '77301', '77303', '77304', '77305', '77306', '77307', '77309', '77310',
  ],
  R4: [
    '71600', '72201', '72202', '72203', '72204', '72205', '72206', '72207', '72208',
    '72209', '72210', '72211', '72300', '72301', '72302', '72303', '72305', '71801',
    '78805', '78804', '78806', '78802', '78801', '78800', '78708', '78707', '78706',
    '78705', '78703', '78704', '78709', '78710', '78700', '78610', '78609', '78607',
    '78606', '78605', '78604', '78600',
  ],
  R7: [
    '78802', '78801', '78800', '78708', '78707', '78706', '72503',
  ],
  R8: [
    '72209', '72210', '72501', '72502', '72503', '72508', '79006', '79007', '79100',
  ],

  // ── Regionals & Terres de l'Ebre / Girona / Tarragona / Ponent ──
  R11: [
    '71801', '71802', '79009', '79004', '79100', '79104', '79200', '79202', '79203',
    '79204', '79205', '79300', '79301', '79302', '79303', '79304', '79305', '79306',
    '79308', '79309', '79311', '79312', '79314', '79315', '79316',
  ],
  R12: [
    '72305', '71801', '78805', '78804', '78806', '78802', '78801', '78800', '78708',
    '78707', '78706', '78705', '78703', '78704', '78709', '78710', '78700', '78610',
    '78609', '78607', '78606', '78605', '78604', '78600', '78506', '78505', '78504',
    '78503', '78502', '78501', '78500', '78408', '78407', '78406', '78405', '78404',
    '78403', '78402', '78400',
  ],
  RL3: [
    '78400', '78402', '78403', '78404', '78405', '78406', '78407', '78408', '78500',
  ],
  RL4: [
    '78400', '78402', '78403', '78404', '78405', '78406', '78407', '78408', '78500',
    '78501', '78502', '78503', '78504', '78505', '78506', '78600',
  ],
  R13: [
    '79400', '71802', '71801', '71700', '71600', '72101', '72100', '76001', '76002',
    '76003', '76004', '73100', '73010', '73009', '73008', '73007', '73006', '73005',
    '73004', '73003', '73002', '73001', '78400',
  ],
  R14: [
    '79400', '71802', '71801', '71600', '71503', '71502', '71500', '71401', '71400',
    '73102', '73101', '73100', '73008', '73007', '73006', '73005', '73003', '73002',
    '78400',
  ],
  R15: [
    '79400', '71802', '71801', '71600', '71503', '71502', '71500', '71401', '71400',
    '71307', '71306', '71305', '71304', '71303', '71302', '71301', '71300', '71211',
    '71210', '71209',
  ],
  R16: [
    '79400', '71802', '71801', '71708', '71707', '71705', '71701', '71700', '71600',
    '71503', '71502', '71500', '71401', '65422', '65420', '65405', '65404', '65403',
    '65402', '65401', '65400', '65314',
  ],
  R17: [
    '79400', '71802', '71801', '71500', '65411',
  ],
  RT1: [
    '71500', '71401', '71400',
  ],
  RT2: [
    '72202', '72201', '71600', '71503', '71502', '71500', '65411',
  ],
}

// Inverted map: Station code -> Array of lines serving that station
const STATION_LINES_MAP: Record<string, string[]> = {}
for (const [line, codes] of Object.entries(LINE_STATION_CODES)) {
  for (const code of codes) {
    if (!STATION_LINES_MAP[code]) {
      STATION_LINES_MAP[code] = []
    }
    if (!STATION_LINES_MAP[code].includes(line)) {
      STATION_LINES_MAP[code].push(line)
    }
  }
}

/**
 * Returns all rail lines serving a station code or stop ID.
 */
export function getLinesForStation(codeOrStopId: string): string[] {
  if (!codeOrStopId) return []
  const clean = codeOrStopId.trim()
  if (STATION_LINES_MAP[clean]) {
    return STATION_LINES_MAP[clean]
  }
  // Try stripping platform number (e.g. "PC1" -> "PC")
  const base = clean.replace(/\d+$/, '').replace(/bus\d*$/i, '')
  if (STATION_LINES_MAP[base]) {
    return STATION_LINES_MAP[base]
  }
  return []
}

/**
 * Resolves the complete, ordered list of stations along a selected line.
 * Uses authoritative canonical corridor mappings first, with geometric track
 * projection as fallback for dynamic or uncatalogued routes.
 */
export function getOrderedStopsForLine(
  line: string,
  allStops: Stop[],
  routes: Route[] = [],
): Stop[] {
  if (!line) return []
  const clean = normalizeLineCode(line)

  // 1. Authoritative corridor station sequence
  const canonicalCodes = LINE_STATION_CODES[clean]
  if (canonicalCodes && canonicalCodes.length > 0) {
    const result: Stop[] = []
    const seenNames = new Set<string>()

    for (const code of canonicalCodes) {
      // Find matching stop in allStops
      let match: Stop | undefined

      if (/^\d+$/.test(code)) {
        // Numeric code (Rodalies)
        match = allStops.find(s => s.stopId === code || s.code === code)
      } else {
        // FGC base code
        match = allStops.find(s => {
          const sBase = s.stopId.replace(/\d+$/, '').replace(/bus\d*$/i, '')
          return sBase === code || s.code === code
        })
      }

      // Fallback matching by station name
      if (!match) {
        const expectedName = /^\d+$/.test(code)
          ? RENFE_STATION_CODES[code]
          : (STATION_CODES[code] ?? code)
        if (expectedName) {
          const normExp = normalizeSearchText(expectedName)
          match = allStops.find(s => {
            const sn = normalizeSearchText(s.name)
            return sn === normExp || sn.includes(normExp) || normExp.includes(sn)
          })
        }
      }

      if (match) {
        const normName = normalizeSearchText(match.name)
        if (!seenNames.has(normName)) {
          seenNames.add(normName)
          // Ensure the stop has its lines enriched
          const stationLines = match.lines && match.lines.length > 0
            ? match.lines
            : getLinesForStation(code)

          result.push({
            ...match,
            lines: stationLines.length > 0 ? stationLines : [clean],
          })
        }
      } else {
        // Fallback synthetic Stop object so the strip diagram is never broken or missing stations
        const fallbackName = /^\d+$/.test(code)
          ? (RENFE_STATION_CODES[code] ?? code)
          : (STATION_CODES[code] ?? code)
        const normName = normalizeSearchText(fallbackName)
        if (!seenNames.has(normName)) {
          seenNames.add(normName)
          result.push({
            stopId: code,
            name: fallbackName,
            code: /^\d+$/.test(code) ? RENFE_STATION_CODES[code] ?? code : code,
            lat: 41.3879, // Barcelona fallback center
            lng: 2.1699,
            wheelchairBoarding: true,
            operator: /^\d+$/.test(code) ? 'renfe' : 'fgc',
            lines: getLinesForStation(code),
          })
        }
      }
    }

    if (result.length > 0) {
      return result
    }
  }

  // 2. Geometric polyline projection fallback
  const route = routes.find(r => normalizeLineCode(r.shortName) === clean)
  if (route?.geometry?.coordinates) {
    const pl = buildPolyline(route.geometry.coordinates)
    if (pl) {
      // Find stops physically near this line's track
      const withDist: { stop: Stop; dist: number }[] = []

      for (const s of allStops) {
        // Tag filter check or geometric distance check
        const hasTag = s.lines?.some(l => normalizeLineCode(l) === clean)
        const dist = projectOntoPolyline([s.lng, s.lat], pl)
        const [projLng, projLat] = positionAtDistance(pl, dist)
        const crossTrackMeters = haversine([s.lng, s.lat], [projLng, projLat])

        if (hasTag || (crossTrackMeters < 650 && (!route.operator || s.operator === route.operator))) {
          withDist.push({ stop: s, dist })
        }
      }

      withDist.sort((a, b) => a.dist - b.dist)

      const deduped: Stop[] = []
      const seenNames = new Set<string>()
      for (const item of withDist) {
        const norm = normalizeSearchText(item.stop.name)
        if (!seenNames.has(norm)) {
          seenNames.add(norm)
          deduped.push(item.stop)
        }
      }

      if (deduped.length > 0) {
        return deduped
      }
    }
  }

  // 3. Simple filter fallback
  return allStops.filter(s => s.lines?.some(l => normalizeLineCode(l) === clean))
}
