export const STATION_CODES: Record<string, string> = {
  // Barcelona city
  PC:  'Pl. Catalunya',
  PR:  'Provença',
  GR:  'Gràcia',
  SG:  'Sant Gervasi',
  PD:  'Pàdua',
  EP:  'El Putxet',
  MN:  'Muntaner',
  BN:  'La Bonanova',
  TT:  'Les Tres Torres',
  PM:  'Pl. Molina',
  SR:  'Sarrià',
  RE:  'Reina Elisenda',
  TB:  'Av. Tibidabo',
  AV:  'Av. Tibidabo',
  PE:  'Pl. Espanya',
  MG:  'Magòria La Campana',
  IC:  'Ildefons Cerdà',
  GO:  'Gornal',
  SP:  'Sant Josep',
  LH:  'L\'Hospitalet Av. Carrilet',
  EU:  'Europa | Fira',

  // Vallès line (S1/S2)
  PF:  'Peu del Funicular',
  VR:  'Vallvidrera Inferior',
  VS:  'Vallvidrera Superior',
  VL:  'Baixador de Vallvidrera',
  LF:  'La Floresta',
  VD:  'Valldoreix',
  SC:  'Sant Cugat',
  MS:  'Mira-Sol',
  VO:  'Volpelleres',
  SJ:  'Sant Joan',
  BT:  'Bellaterra',
  UN:  'Universitat Autònoma',
  UA:  'Universitat Autònoma',
  HG:  'Hospital General',
  RB:  'Rubí Centre',
  FN:  'Les Fonts',
  TR:  'Terrassa - Rambla',
  VP:  'Vallparadís Universitat',
  EN:  'Terrassa Estació del Nord',
  TE:  'Terrassa Est',
  NA:  'Terrassa Nacions Unides',
  TN:  'Terrassa Nacions Unides',
  CF:  'Can Feu - Gràcia',
  CT:  'La Creu Alta',
  PJ:  'Sabadell Plaça Major',
  NO:  'Sabadell Nord',
  PN:  'Sabadell Parc del Nord',
  SPF: 'Sabadell Parc del Nord',
  SQ:  'Sant Quirze',

  // Llobregat-Anoia (R5/R6/L8/S4/S8)
  AL:  'Almeda',
  CO:  'Cornellà Riera',
  BO:  'Sant Boi',
  SB:  'Sant Boi',
  CL:  'Santa Coloma de Cervelló',
  CG:  'Colònia Güell',
  CR:  'Can Ros',
  QC:  'Quatre Camins',
  PA:  'Pallejà',
  SA:  'Sant Andreu de la Barca',
  PL:  'El Palau',
  MV:  'Martorell Vila',
  MC:  'Martorell Central',
  ME:  'Martorell Enllaç',
  AB:  'Abrera',
  OL:  'Olesa de Montserrat',
  AE:  'Montserrat-Aeri',
  MO:  'Monistrol de Montserrat',
  MP:  'Monistrol-Vila',
  SV:  'Sant Vicenç-Castellgalí',
  VI:  'Manresa Viladordis',
  MA:  'Manresa-Alta',
  MB:  'Manresa-Baixador',
  MBI: 'Manresa Baixador',
  SE:  'Sant Esteve Sesrovires',
  BE:  'La Beguda',
  CP:  'Can Parellada',
  MQ:  'Masquefa',
  PI:  'Piera',
  VA:  'Vallbona d\'Anoia',
  CA:  'Capellades',
  PO:  'La Pobla de Claramunt',
  VN:  'Vilanova del Camí',
  IG:  'Igualada',
  ML:  'Molí Nou - Ciutat Cooperativa',
  MN1: 'Molí Nou - Ciutat Cooperativa',
  VH:  'Sant Vicenç dels Horts',
  VH1: 'Sant Vicenç dels Horts',

  // Cremallera / Funicular
  MM:  'Montserrat',
  FV:  'Funicular de Vallvidrera',

  // Lleida-La Pobla
  LE:  'Lleida',
  AT:  'Alcoletge',
  VB:  'Vilanova de la Barca',
  VF:  'Vallfogona de Balaguer',
  BG:  'Balaguer',
  SM:  'St. Llorenç de Montgai',
  LS:  'Vilanova de la Sal',
  AR:  'Àger',
  LL:  'Cellers-Llimiana',
  GT:  'Guardia de Tremp',
  PT:  'Palau de Noguera',
  TP:  'Tremp',
  SD:  'Salàs de Pallars',
  PS:  'La Pobla de Segur',

  // Núria
  NU:  'Núria',
  QUE: 'Queralbs',
  RR:  'Ribes-Enllaç',
}

/**
 * Sensible 2-letter uppercase abbreviations for all Rodalies / Renfe stations in Catalonia.
 * Displayed inside the station circles on the map.
 */
export const RENFE_STATION_CODES: Record<string, string> = {
  // Barcelona core & urban area
  '71801': 'ST', // Barcelona-Sants
  '71802': 'PG', // Barcelona-Passeig de Gràcia
  '78804': 'AT', // Barcelona-Arc de Triomf
  '78805': 'PC', // Barcelona-Plaça de Catalunya
  '79400': 'EF', // Barcelona-Estació de França
  '79009': 'CL', // Barcelona-El Clot
  '78806': 'SG', // Barcelona-La Sagrera-Meridiana
  '78802': 'FP', // Barcelona-Fabra i Puig
  '78801': 'TB', // Barcelona-Torre Baró | Vallbona
  '79004': 'SA', // Barcelona-Sant Andreu
  '72400': 'AE', // Aeroport

  // Baix Llobregat, Garraf & Costa Daurada
  '71708': 'BV', // Bellvitge | Gornal
  '71707': 'PR', // El Prat de Llobregat
  '71709': 'VD', // Viladecans
  '71706': 'GV', // Gavà
  '71705': 'CF', // Castelldefels
  '71704': 'PF', // Platja de Castelldefels
  '71703': 'GF', // Garraf
  '71701': 'SI', // Sitges
  '71700': 'VG', // Vilanova i la Geltrú
  '71604': 'CU', // Cubelles
  '71603': 'CN', // Cunit
  '71602': 'SC', // Segur de Calafell
  '71601': 'CA', // Calafell
  '71600': 'SV', // Sant Vicenç de Calders

  // Llobregat & Alt Penedès (R4)
  '72305': 'LH', // L'Hospitalet de Llobregat
  '72303': 'CO', // Cornellà
  '72302': 'SJ', // Sant Joan Despí
  '72301': 'SF', // Sant Feliu de Llobregat
  '72300': 'MR', // Molins de Rei
  '72211': 'PA', // El Papiol
  '72210': 'CB', // Castellbisbal
  '72209': 'MC', // Martorell Central
  '72208': 'GE', // Gelida
  '72207': 'SS', // Sant Sadurní d'Anoia
  '72206': 'LS', // Lavern-Subirats
  '72205': 'LG', // La Granada
  '72204': 'VF', // Vilafranca del Penedès
  '72203': 'EM', // Els Monjos
  '72202': 'AR', // L'Arboç
  '72201': 'EV', // El Vendrell

  // Vallès Occidental & Oriental (R4, R7, R8)
  '78800': 'MB', // Montcada Bifurcació
  '79005': 'MR', // Montcada i Reixac
  '78707': 'MS', // Montcada i Reixac-Santa Maria
  '78708': 'MM', // Montcada i Reixac-Manresa
  '77002': 'MO', // Montcada Ripollet
  '78706': 'CV', // Cerdanyola del Vallès
  '72503': 'CU', // Cerdanyola-Universitat
  '72502': 'SC', // Sant Cugat Coll Favà
  '72501': 'RB', // Rubí Can Vallhonrat
  '72508': 'SR', // Santa Perpètua de Mogoda Riera de Caldes
  '77003': 'SP', // Santa Perpètua de Mogoda
  '77004': 'MR', // Mollet-Santa Rosa
  '79006': 'MS', // Mollet-Sant Fost
  '79007': 'ML', // Montmeló
  '79011': 'LL', // La Llagosta
  '77005': 'PV', // Parets del Vallès
  '77006': 'GN', // Granollers-Canovelles
  '79100': 'GC', // Granollers Centre
  '79109': 'FN', // Les Franqueses-Granollers Nord
  '77100': 'FV', // Les Franqueses del Vallès
  '79101': 'CD', // Cardedeu
  '79102': 'LV', // Llinars del Vallès
  '79103': 'PT', // Palautordera
  '79104': 'SC', // Sant Celoni
  '79105': 'GL', // Gualba
  '79106': 'RB', // Riells i Viabrea-Breda
  '79107': 'HR', // Hostalric
  '78705': 'BV', // Barberà del Vallès
  '78703': 'SS', // Sabadell Sud
  '78704': 'SC', // Sabadell Centre
  '78709': 'SN', // Sabadell Nord
  '78710': 'TE', // Terrassa Est
  '78700': 'TN', // Terrassa Estació del Nord
  '78610': 'MG', // Sant Miquel de Gonteres-Viladecavalls
  '78609': 'VV', // Viladecavalls
  '78607': 'VT', // Vacarisses-Torreblanca
  '78606': 'VA', // Vacarisses
  '78605': 'CV', // Castellbell i el Vilar-Monistrol de Mont
  '78604': 'VC', // Sant Vicenç de Castellet
  '78600': 'MN', // Manresa

  // Maresme (R1 / RG1)
  '79403': 'SA', // Sant Adrià de Besòs
  '79404': 'BD', // Badalona
  '79405': 'MG', // Montgat
  '79406': 'MN', // Montgat Nord
  '79407': 'MA', // El Masnou
  '79408': 'OC', // Ocata
  '79409': 'PM', // Premià de Mar
  '79410': 'VM', // Vilassar de Mar
  '79412': 'CM', // Cabrera de Mar-Vilassar de Mar
  '79500': 'MT', // Mataró
  '79501': 'SL', // Sant Andreu de Llavaneres
  '79502': 'CE', // Caldes d'Estrac
  '79600': 'AM', // Arenys de Mar
  '79601': 'CT', // Canet de Mar
  '79602': 'SP', // Sant Pol de Mar
  '79603': 'CL', // Calella
  '79604': 'PD', // Pineda de Mar
  '79605': 'MD', // Malgrat de Mar
  '79606': 'BL', // Blanes
  '79607': 'TD', // Tordera
  '79608': 'SZ', // Santa Susanna

  // Girona / Empordà / Costa Brava (R11 / RG1)
  '79200': 'MM', // Maçanet-Massanes
  '79202': 'SI', // Sils
  '79203': 'CM', // Caldes de Malavella
  '79204': 'RI', // Riudellots
  '79205': 'FS', // Fornells de la Selva
  '79300': 'GI', // Girona
  '79301': 'CR', // Celrà
  '79302': 'BJ', // Bordils-Juià
  '79303': 'FL', // Flaçà
  '79304': 'JD', // Sant Jordi Desvalls
  '79305': 'CM', // Camallera
  '79306': 'MF', // Sant Miquel de Fluvià
  '79308': 'VM', // Vilamalla
  '79309': 'FG', // Figueres
  '79311': 'VJ', // Vilajuïga
  '79312': 'LL', // Llançà
  '79314': 'CO', // Colera
  '79315': 'PB', // Portbou
  '79316': 'CB', // Cerbère

  // Osona, Ripollès & Pyrenees (R3)
  '77102': 'LG', // La Garriga
  '77103': 'FG', // Figaró
  '77104': 'MC', // Sant Martí de Centelles
  '77105': 'CT', // Centelles
  '77106': 'BH', // Balenyà-Els Hostalets
  '77107': 'BT', // Balenyà-Tona-Seva
  '77109': 'VI', // Vic
  '77110': 'ML', // Manlleu
  '77111': 'TO', // Torelló
  '77112': 'BG', // Borgonyà
  '77113': 'SQ', // Sant Quirze de Besora
  '77114': 'FB', // La Farga de Bebié
  '77200': 'RP', // Ripoll
  '77301': 'CD', // Campdevànol
  '77303': 'RF', // Ribes de Freser
  '77304': 'PL', // Planoles
  '77305': 'TS', // Toses
  '77306': 'LM', // La Molina
  '77307': 'UA', // Urtx-Alp
  '77309': 'PZ', // Puigcerdà
  '77310': 'TQ', // La Tor de Querol-Enveig

  // Lleida, Pla d'Urgell, Segarra & Anoia (R12 / RL3 / RL4)
  '78400': 'LP', // Lleida-Pirineus
  '78402': 'BU', // Bell-lloc d'Urgell
  '78403': 'MO', // Molerussa
  '78404': 'GO', // Golmés
  '78405': 'CS', // Castellnou de Seana
  '78406': 'BP', // Bellpuig
  '78407': 'AG', // Anglesola
  '78408': 'TG', // Tàrrega
  '78500': 'CV', // Cervera
  '78501': 'SG', // Sant Guim de Freixenet
  '78502': 'SM', // Sant Martí de Sesgueioles
  '78503': 'CF', // Calaf
  '78504': 'SS', // Seguers- Sant Pere Sallavinera
  '78505': 'AS', // Aguilar de Segarra
  '78506': 'RJ', // Rajadell

  // Camp de Tarragona, Terres de l'Ebre & Priorat (R13-R17 / RT1 / RT2)
  '71500': 'TG', // Tarragona
  '71502': 'AT', // Altafulla-Tamarit
  '71503': 'TD', // Torredembarra
  '71400': 'RE', // Reus
  '71401': 'VS', // Vila-seca
  '65411': 'PA', // Salou - Port Aventura
  '65422': 'CS', // Cambrils-Salou
  '65420': 'HI', // L'Hospitalet de l'Infant - Vandellòs
  '65405': 'AM', // L'Ametlla de Mar
  '65404': 'AP', // L'Ampolla-Perelló-Deltebre
  '65403': 'CD', // Camarles-Deltebre
  '65402': 'AA', // L'Aldea-Amposta
  '65401': 'CR', // Camp-redó
  '65400': 'TT', // Tortosa
  '65314': 'UL', // Ulldecona-Alcanar-La Sénia
  '71209': 'RE', // Riba-roja d'Ebre
  '71210': 'FX', // Flix
  '71211': 'AS', // Ascó
  '71300': 'MN', // Móra la Nova
  '71301': 'EG', // Els Guiamets
  '71302': 'CP', // Capçanes
  '71303': 'MF', // Marçà-Falset
  '71304': 'PD', // Pradell
  '71305': 'DA', // Duesaigües-L'Argentera
  '71306': 'RC', // Riudecanyes-Botarell
  '71307': 'BC', // Les Borges del Camp
  '73102': 'SC', // La Selva del Camp
  '73101': 'AC', // Alcover
  '73100': 'PX', // La Plana-Picamoixons
  '76004': 'VA', // Valls
  '76003': 'NB', // Nulles-Bràfim
  '76002': 'VB', // Vilabella
  '76001': 'SL', // Salomó
  '72100': 'RB', // Roda de Barà
  '72101': 'RM', // Roda de Mar
  '73010': 'RI', // La Riba
  '73009': 'VV', // Vilaverd
  '73008': 'MB', // Montblanc
  '73007': 'EF', // L'Espluga de Francolí
  '73006': 'VP', // Vimbodí i Poblet
  '73005': 'VN', // Vinaixa
  '73004': 'LF', // La Floresta
  '73003': 'BB', // Les Borges Blanques
  '73002': 'JU', // Juneda
  '73001': 'PL', // Puigverd de Lleida-Artesa de Lleida
}

/**
 * Derives a clean 2-letter uppercase abbreviation for any station (FGC or Renfe).
 */
export function getStationCode(stopId: string, name?: string): string {
  if (/^\d+$/.test(stopId)) {
    if (RENFE_STATION_CODES[stopId]) return RENFE_STATION_CODES[stopId]
    if (name) {
      const clean = name.replace(/^Barcelona[- ]/i, '').replace(/\|.*/, '').replace(/^(L'|L’|El |La |Les |Els )/i, '').trim()
      const words = clean.split(/[\s-]+/).filter(w => !/^(de|del|d'|d’|la|les|el|els|i|en)$/i.test(w) && w.length > 0)
      if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
      if (words.length === 1 && words[0].length >= 2) return words[0].slice(0, 2).toUpperCase()
      return clean.slice(0, 2).toUpperCase()
    }
    return stopId.slice(0, 2)
  }
  return stopId.replace(/\d+$/, '')
}

export const LINE_COLORS: Record<string, string> = {
  L6:  '#797FBC',
  L7:  '#B2600B',
  L8:  '#E274AA',
  L12: '#b2aed3',
  S1:  '#EF7900',
  S2:  '#88BB0B',
  S3:  '#4F868E',
  S4:  '#A78600',
  S8:  '#49C0DE',
  S9:  '#DF4661',
  R5:  '#3dbfc3',
  R6:  '#b3b3b3',
  R50: '#00738a',
  R53: '#3dbfc3',
  R60: '#5b5b5b',
  R63: '#b3b3b3',
  RL1: '#FF8000',
  RL2: '#FF8000',
  FV:  '#0A57A3',
  MM:  '#000000',
  L1:  '#000000',
}

// Car codes of an FGC 4-car unit in physical composition order — M1 (cab
// motor), M2 (its inseparable pair), then the intermediates — matching the
// order fetchTrains() emits Train.wagons.
export const WAGON_LABELS = ['M1', 'M2', 'Mi', 'Ri']
