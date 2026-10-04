export interface MetroInterchange {
  type: 'metro' | 'tram'
  line: string
  color: string
}

export const METRO_COLORS: Record<string, string> = {
  L1: '#E11A27',
  L2: '#942477',
  L3: '#289736',
  L4: '#F3BE00',
  L5: '#007AC2',
  L8: '#E274AA',
  L9: '#EB6909',
  L9S: '#EB6909',
  L9N: '#EB6909',
  L10: '#00A3A6',
  L10S: '#00A3A6',
  L10N: '#00A3A6',
  L11: '#97BE0D',
  T1: '#009640',
  T2: '#009640',
  T3: '#009640',
  T4: '#009640',
  T5: '#009640',
  T6: '#009640',
}

// Station code / stop ID -> Metro & Tram interchange lines
export const METRO_INTERCHANGES: Record<string, MetroInterchange[]> = {
  // Pl. Catalunya (FGC: PC, Rodalies: 78805)
  PC: [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
    { type: 'metro', line: 'L3', color: METRO_COLORS.L3 },
  ],
  '78805': [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
    { type: 'metro', line: 'L3', color: METRO_COLORS.L3 },
  ],

  // Provença (PR) / Passeig de Gràcia (71802)
  PR: [
    { type: 'metro', line: 'L3', color: METRO_COLORS.L3 },
    { type: 'metro', line: 'L5', color: METRO_COLORS.L5 },
  ],
  '71802': [
    { type: 'metro', line: 'L2', color: METRO_COLORS.L2 },
    { type: 'metro', line: 'L3', color: METRO_COLORS.L3 },
    { type: 'metro', line: 'L4', color: METRO_COLORS.L4 },
  ],

  // Pl. Espanya (FGC: PE)
  PE: [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
    { type: 'metro', line: 'L3', color: METRO_COLORS.L3 },
    { type: 'metro', line: 'L8', color: METRO_COLORS.L8 },
  ],

  // Barcelona-Sants (Rodalies: 71801)
  '71801': [
    { type: 'metro', line: 'L3', color: METRO_COLORS.L3 },
    { type: 'metro', line: 'L5', color: METRO_COLORS.L5 },
  ],

  // Arc de Triomf (Rodalies: 78804)
  '78804': [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
  ],

  // El Clot (Rodalies: 79009)
  '79009': [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
    { type: 'metro', line: 'L2', color: METRO_COLORS.L2 },
  ],

  // La Sagrera - Meridiana (Rodalies: 78806)
  '78806': [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
    { type: 'metro', line: 'L5', color: METRO_COLORS.L5 },
    { type: 'metro', line: 'L9N', color: METRO_COLORS.L9N },
    { type: 'metro', line: 'L10N', color: METRO_COLORS.L10N },
  ],

  // Fabra i Puig (Rodalies: 78802)
  '78802': [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
  ],

  // Torre Baró (Rodalies: 78801)
  '78801': [
    { type: 'metro', line: 'L11', color: METRO_COLORS.L11 },
  ],

  // Sant Andreu (Rodalies: 79004)
  '79004': [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
  ],

  // Estació de França (Rodalies: 79400) - Barceloneta a prop
  '79400': [
    { type: 'metro', line: 'L4', color: METRO_COLORS.L4 },
  ],

  // Ildefons Cerdà (FGC: IC) - Ciutat de la Justícia
  IC: [
    { type: 'metro', line: 'L10S', color: METRO_COLORS.L10S },
  ],

  // Europa | Fira (FGC: EU)
  EU: [
    { type: 'metro', line: 'L9S', color: METRO_COLORS.L9S },
  ],

  // L'Hospitalet Av. Carrilet (FGC: LH) / L'Hospitalet (Rodalies: 72305)
  LH: [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
    { type: 'metro', line: 'L8', color: METRO_COLORS.L8 },
  ],
  '72305': [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
  ],

  // Gornal (FGC: GO) / Bellvitge (Rodalies: 71708)
  GO: [
    { type: 'metro', line: 'L8', color: METRO_COLORS.L8 },
  ],
  '71708': [
    { type: 'metro', line: 'L1', color: METRO_COLORS.L1 },
  ],

  // Cornellà Riera (FGC: CR) / Cornellà (Rodalies: 72303)
  CR: [
    { type: 'tram', line: 'T1', color: METRO_COLORS.T1 },
    { type: 'tram', line: 'T2', color: METRO_COLORS.T2 },
  ],
  '72303': [
    { type: 'metro', line: 'L5', color: METRO_COLORS.L5 },
    { type: 'tram', line: 'T1', color: METRO_COLORS.T1 },
    { type: 'tram', line: 'T2', color: METRO_COLORS.T2 },
  ],

  // Sant Feliu de Llobregat (Rodalies: 72301)
  '72301': [
    { type: 'tram', line: 'T3', color: METRO_COLORS.T3 },
  ],

  // Sant Adrià de Besòs (Rodalies: 79403)
  '79403': [
    { type: 'tram', line: 'T4', color: METRO_COLORS.T4 },
    { type: 'tram', line: 'T6', color: METRO_COLORS.T6 },
  ],

  // Badalona (Rodalies: 79404)
  '79404': [
    { type: 'metro', line: 'L2', color: METRO_COLORS.L2 },
  ],

  // El Prat de Llobregat (Rodalies: 71707)
  '71707': [
    { type: 'metro', line: 'L9S', color: METRO_COLORS.L9S },
  ],

  // Aeroport (Rodalies: 72400)
  '72400': [
    { type: 'metro', line: 'L9S', color: METRO_COLORS.L9S },
  ],
}

export function getMetroInterchanges(code?: string): MetroInterchange[] {
  if (!code) return []
  if (METRO_INTERCHANGES[code]) return METRO_INTERCHANGES[code]
  const stripped = code.replace(/\d+$/, '')
  return METRO_INTERCHANGES[stripped] ?? []
}

/**
 * Returns any direct Metro or Tram lines shared between origin and dest stations.
 */
export function findDirectMetroConnections(originCode?: string, destCode?: string): MetroInterchange[] {
  if (!originCode || !destCode || originCode === destCode) return []
  const origInterchanges = getMetroInterchanges(originCode)
  const destInterchanges = getMetroInterchanges(destCode)
  if (origInterchanges.length === 0 || destInterchanges.length === 0) return []

  const destLineMap = new Map(destInterchanges.map(m => [m.line, m]))
  const shared: MetroInterchange[] = []
  for (const m of origInterchanges) {
    if (destLineMap.has(m.line) && !shared.some(s => s.line === m.line)) {
      shared.push(m)
    }
  }
  return shared
}
