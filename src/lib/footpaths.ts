export interface InterchangeFootpath {
  from: string
  to: string
  durationSec: number
  description: {
    ca: string
    es: string
    en: string
  }
}

export const INTERCHANGE_FOOTPATHS: InterchangeFootpath[] = [
  // Barcelona - Plaça Catalunya (indoor underground passage)
  {
    from: 'PC',
    to: '71801',
    durationSec: 240,
    description: {
      ca: 'Passadís subterrani de Pl. Catalunya',
      es: 'Pasillo subterráneo de Pl. Catalunya',
      en: 'Underground passage at Pl. Catalunya',
    },
  },
  {
    from: '71801',
    to: 'PC',
    durationSec: 240,
    description: {
      ca: 'Passadís subterrani de Pl. Catalunya',
      es: 'Pasillo subterráneo de Pl. Catalunya',
      en: 'Underground passage at Pl. Catalunya',
    },
  },

  // Terrassa Estació del Nord (unified multimodal station building)
  {
    from: 'EN',
    to: '72207',
    durationSec: 90,
    description: {
      ca: 'Intercanviador Terrassa Estació del Nord',
      es: 'Intercambiador Terrassa Estació del Nord',
      en: 'Terrassa Estació del Nord interchange',
    },
  },
  {
    from: '72207',
    to: 'EN',
    durationSec: 90,
    description: {
      ca: 'Intercanviador Terrassa Estació del Nord',
      es: 'Intercambiador Terrassa Estació del Nord',
      en: 'Terrassa Estació del Nord interchange',
    },
  },

  // Sabadell Nord (unified multimodal station building)
  {
    from: 'NO',
    to: '72205',
    durationSec: 90,
    description: {
      ca: 'Intercanviador Sabadell Nord',
      es: 'Intercambiador Sabadell Nord',
      en: 'Sabadell Nord interchange',
    },
  },
  {
    from: '72205',
    to: 'NO',
    durationSec: 90,
    description: {
      ca: 'Intercanviador Sabadell Nord',
      es: 'Intercambiador Sabadell Nord',
      en: 'Sabadell Nord interchange',
    },
  },

  // Martorell Central (shared multimodal forecourt)
  {
    from: 'MC',
    to: '72304',
    durationSec: 120,
    description: {
      ca: 'Intercanviador Martorell Central',
      es: 'Intercambiador Martorell Central',
      en: 'Martorell Central interchange',
    },
  },
  {
    from: '72304',
    to: 'MC',
    durationSec: 120,
    description: {
      ca: 'Intercanviador Martorell Central',
      es: 'Intercambiador Martorell Central',
      en: 'Martorell Central interchange',
    },
  },

  // Gornal (FGC) ↔ Bellvitge (Rodalies) (direct pedestrian walkway)
  {
    from: 'GO',
    to: '72401',
    durationSec: 120,
    description: {
      ca: 'Passarel·la per a vianants Gornal – Bellvitge',
      es: 'Pasarela peatonal Gornal – Bellvitge',
      en: 'Pedestrian walkway Gornal – Bellvitge',
    },
  },
  {
    from: '72401',
    to: 'GO',
    durationSec: 120,
    description: {
      ca: 'Passarel·la per a vianants Bellvitge – Gornal',
      es: 'Pasarela peatonal Bellvitge – Gornal',
      en: 'Pedestrian walkway Bellvitge – Gornal',
    },
  },

  // Provença (FGC) ↔ Passeig de Gràcia (Rodalies)
  {
    from: 'PR',
    to: '71802',
    durationSec: 360,
    description: {
      ca: 'Enllaç urbà Provença – Passeig de Gràcia',
      es: 'Enlace urbano Provença – Passeig de Gràcia',
      en: 'Urban connection Provença – Passeig de Gràcia',
    },
  },
  {
    from: '71802',
    to: 'PR',
    durationSec: 360,
    description: {
      ca: 'Enllaç urbà Passeig de Gràcia – Provença',
      es: 'Enlace urbano Passeig de Gràcia – Provença',
      en: 'Urban connection Passeig de Gràcia – Provença',
    },
  },

  // L'Hospitalet Av. Carrilet (FGC) ↔ L'Hospitalet (Rodalies)
  {
    from: 'LH',
    to: '71701',
    durationSec: 300,
    description: {
      ca: "Enllaç Rambla Marina Av. Carrilet – L'Hospitalet",
      es: "Enlace Rambla Marina Av. Carrilet – L'Hospitalet",
      en: "Rambla Marina connection Av. Carrilet – L'Hospitalet",
    },
  },
  {
    from: '71701',
    to: 'LH',
    durationSec: 300,
    description: {
      ca: "Enllaç Rambla Marina L'Hospitalet – Av. Carrilet",
      es: "Enlace Rambla Marina L'Hospitalet – Av. Carrilet",
      en: "Rambla Marina connection L'Hospitalet – Av. Carrilet",
    },
  },
]

export const FOOTPATH_MAP = new Map<string, InterchangeFootpath[]>()
for (const fp of INTERCHANGE_FOOTPATHS) {
  if (!FOOTPATH_MAP.has(fp.from)) FOOTPATH_MAP.set(fp.from, [])
  FOOTPATH_MAP.get(fp.from)!.push(fp)
}
