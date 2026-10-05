'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type Lang = 'ca' | 'es' | 'en'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'ca', label: 'Català' },
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
]

const STORAGE_KEY = 'andana-lang'
// Pre-rename key, read as a fallback so existing users keep their choice.
const LEGACY_STORAGE_KEY = 'geotren-lang'

// Translation dictionary. Keys are language-neutral; Catalan is the source language.
// Values may be plain strings or functions for interpolation/pluralisation.
const DICT = {
  // ── Header ──
  live:            { ca: 'En viu',     es: 'En vivo',     en: 'Live' },
  trains:          { ca: 'trens',      es: 'trenes',      en: 'trains' },
  lines:           { ca: 'línies',     es: 'líneas',      en: 'lines' },
  updatedShort:    { ca: 'Act.',       es: 'Act.',        en: 'Upd.' },
  theme:           { ca: 'Tema',       es: 'Tema',        en: 'Theme' },
  refresh:         { ca: 'Refresca',   es: 'Actualizar',  en: 'Refresh' },
  loading:         { ca: 'Carregant…', es: 'Cargando…',   en: 'Loading…' },
  language:        { ca: 'Idioma',     es: 'Idioma',      en: 'Language' },
  networkMode:     { ca: 'Xarxa',      es: 'Red',         en: 'Network' },
  networkFgc:      { ca: 'FGC',        es: 'FGC',         en: 'FGC' },
  networkRenfe:    { ca: 'Rodalies',   es: 'Rodalies',    en: 'Rodalies' },
  networkBoth:     { ca: 'Totes',      es: 'Ambas',       en: 'Both' },

  // ── Relative time ──
  justNow:         { ca: 'ara mateix',                     es: 'ahora mismo',                  en: 'just now' },
  secsAgo:         { ca: (s: number) => `fa ${s}s`,        es: (s: number) => `hace ${s}s`,    en: (s: number) => `${s}s ago` },
  minsAgo:         { ca: (m: number) => `fa ${m}m`,        es: (m: number) => `hace ${m}m`,    en: (m: number) => `${m}m ago` },

  // ── Near me (geolocation) ──
  nearMe:          { ca: 'A prop meu', es: 'Cerca de mí', en: 'Near me' },
  locating:        { ca: 'Localitzant…', es: 'Localizando…', en: 'Locating…' },
  locationDenied:  { ca: 'Permís d’ubicació denegat', es: 'Permiso de ubicación denegado', en: 'Location permission denied' },
  locationUnavailable: { ca: 'Ubicació no disponible', es: 'Ubicación no disponible', en: 'Location unavailable' },
  useMyLocation:   { ca: 'Usa la meva ubicació', es: 'Usar mi ubicación', en: 'Use my location' },

  // ── Tabs ──
  tabTrains:       { ca: 'Trens',      es: 'Trenes',      en: 'Trains' },
  tabStations:     { ca: 'Estacions',  es: 'Estaciones',  en: 'Stations' },
  tabPlan:         { ca: 'Anar a…',    es: 'Ir a…',       en: 'Go to…' },

  // ── Sidebar: line filter ──
  filterByLine:    { ca: 'Filtre per Línia', es: 'Filtro por Línea', en: 'Filter by Line' },
  all:             { ca: 'Tots',       es: 'Todos',       en: 'All' },
  groupUrban:      { ca: 'L — Barcelona urbà',           es: 'L — Barcelona urbano',           en: 'L — Barcelona urban' },
  groupValles:     { ca: 'S — Vallès',                   es: 'S — Vallès',                     en: 'S — Vallès' },
  groupRegional:   { ca: 'R — Llobregat-Anoia regional', es: 'R — Llobregat-Anoia regional',   en: 'R — Llobregat-Anoia regional' },
  groupCremallera: { ca: 'M — Cremallera de Montserrat', es: 'M — Cremallera de Montserrat', en: 'M — Montserrat Rack Railway' },
  groupOther:      { ca: 'Altres',     es: 'Otras',       en: 'Other' },
  groupUrbanShort: { ca: 'L — Urbà',   es: 'L — Urbano',  en: 'L — Urban' },
  groupVallesShort:{ ca: 'S — Vallès', es: 'S — Vallès',  en: 'S — Vallès' },
  groupRegionalShort:{ ca: 'R — Reg.', es: 'R — Reg.',    en: 'R — Reg.' },
  groupCremalleraShort: { ca: 'Cremallera', es: 'Cremallera', en: 'Rack Railway' },
  noActiveTrains:  { ca: 'Cap tren actiu.', es: 'Ningún tren activo.', en: 'No active trains.' },

  // ── Sidebar: stations ──
  searchStation:   { ca: 'Cerca Estació', es: 'Buscar Estación', en: 'Search Station' },
  searchStationPlaceholder: { ca: 'Ex: Sant Cugat, Provença…', es: 'Ej: Sant Cugat, Provença…', en: 'E.g. Sant Cugat, Provença…' },
  searchStationShort: { ca: 'Cerca estació…', es: 'Buscar estación…', en: 'Search station…' },
  passingNowSoon:  { ca: 'Trens passant ara o pròximament', es: 'Trenes pasando ahora o próximamente', en: 'Trains passing now or soon' },
  hereNow:         { ca: 'ARA AQUÍ',   es: 'AQUÍ AHORA',  en: 'HERE NOW' },
  stopsAway:       { ca: (n: number) => `${n} parada${n !== 1 ? 'es' : ''}`, es: (n: number) => `${n} parada${n !== 1 ? 's' : ''}`, en: (n: number) => `${n} stop${n !== 1 ? 's' : ''}` },
  towards:         { ca: 'cap a',      es: 'hacia',       en: 'to' },
  occupancyLabel:  { ca: 'ocupació',   es: 'ocupación',   en: 'occupancy' },
  noTrainHere:     { ca: 'Cap tren detectat passant per aquesta estació.', es: 'Ningún tren detectado pasando por esta estación.', en: 'No trains detected passing through this station.' },
  searchToSeeTrains: { ca: 'Cerca una estació per veure els trens.', es: 'Busca una estación para ver los trenes.', en: 'Search a station to see its trains.' },
  noStationFound:  { ca: 'Cap estació trobada.', es: 'Ninguna estación encontrada.', en: 'No station found.' },
  typeStationName: { ca: "Escriu el nom d'una estació.", es: 'Escribe el nombre de una estación.', en: 'Type a station name.' },

  // ── DetailPanel ──
  activeService:   { ca: 'SERVEI ACTIU FGC', es: 'SERVICIO ACTIVO FGC', en: 'ACTIVE FGC SERVICE' },
  line:            { ca: 'Línia',      es: 'Línea',       en: 'Line' },
  unit:            { ca: 'Unitat',     es: 'Unidad',      en: 'Unit' },
  finalDest:       { ca: 'Destinació final', es: 'Destino final', en: 'Final destination' },
  punctuality:     { ca: 'Puntualitat', es: 'Puntualidad', en: 'Punctuality' },
  onTime:          { ca: 'Puntual',    es: 'Puntual',     en: 'On time' },
  avgOccupancy:    { ca: 'Ocupació mitjana', es: 'Ocupación media', en: 'Avg. occupancy' },
  occupancyPerCar: { ca: 'Ocupació per cotxe', es: 'Ocupación por coche', en: 'Occupancy per car' },
  carsShort:       { ca: 'Cotxes', es: 'Coches', en: 'Cars' },
  upcomingStops:   { ca: 'Pròximes parades', es: 'Próximas paradas', en: 'Upcoming stops' },
  origin2:         { ca: 'origen',     es: 'origen',      en: 'origin' },
  terminal:        { ca: 'terminal',   es: 'terminal',    en: 'terminal' },
  inTransit:       { ca: 'En trànsit…', es: 'En tránsito…', en: 'In transit…' },
  hereNowLabel:    { ca: 'Ara aquí',   es: 'Aquí ahora',  en: 'Here now' },

  // ── TrainCard ──
  occupied:        { ca: 'ocupat',     es: 'ocupado',     en: 'occupied' },
  nowAt:           { ca: 'Ara a',      es: 'Ahora en',    en: 'Now at' },
  nextStop:        { ca: 'Pròxima parada', es: 'Próxima parada', en: 'Next stop' },
  etaNow:          { ca: 'ara',        es: 'ahora',       en: 'now' },
  etaIn:           { ca: (m: number) => m === 1 ? 'en 1 min' : `en ${m} min`, es: (m: number) => m === 1 ? 'en 1 min' : `en ${m} min`, en: (m: number) => m === 1 ? 'in 1 min' : `in ${m} min` },
  departsIn:       { ca: 'arriba en',  es: 'llega en',    en: 'arrives in' },
  departed:        { ca: 'sortit',     es: 'salido',      en: 'departed' },

  // ── Renfe / Rodalies telemetry ──
  approaching:     { ca: 'Aproximant-se', es: 'Aproximándose', en: 'Approaching' },
  stationed:       { ca: 'Estacionat',    es: 'Estacionado',  en: 'Stationed' },
  moving:          { ca: 'En marxa',      es: 'En marcha',    en: 'Moving' },
  departing:       { ca: 'Sortint',       es: 'Saliendo',     en: 'Departing' },
  depot:           { ca: '💤 Cotxeres / Fora de servei', es: '💤 Cocheras / Fuera de servicio', en: '💤 In depot / Out of service' },
  depotShort:      { ca: '💤 Cotxeres',   es: '💤 Cocheras',  en: '💤 Depot' },
  cremalleraService: { ca: 'CREMALLERA DE MONTSERRAT', es: 'CREMALLERA DE MONTSERRAT', en: 'MONTSERRAT RACK RAILWAY' },
  mountainLineNotice: {
    ca: 'Línia de muntanya (Cremallera): servei turístic diürn. La cobertura GPS pot ser intermitent en trams de túnels i engorjats.',
    es: 'Línea de montaña (Cremallera): servicio turístico diurno. La cobertura GPS puede ser intermitente en tramos de túneles y desfiladeros.',
    en: 'Mountain rack railway: daytime tourist service. GPS reception may be intermittent through tunnels and gorges.'
  },
  depotNotice: {
    ca: 'Aquest comboi està estacionat a cotxeres o vies d’apartador fora de l’horari de servei comercial del Cremallera.',
    es: 'Este convoy está estacionado en cocheras o vías de apartado fuera del horario comercial del Cremallera.',
    en: 'This train is parked at sidings/depot outside commercial operating hours.'
  },
  accessibleTrain: { ca: 'Tren accessible', es: 'Tren accesible', en: 'Accessible train' },
  inaccessibleTrain: { ca: 'Tren no accessible', es: 'Tren no accesible', en: 'Inaccessible train' },
  prevStopLabel:   { ca: 'Parada anterior', es: 'Parada anterior', en: 'Previous stop' },
  currentStopLabel:{ ca: 'Parada actual', es: 'Parada actual', en: 'Current stop' },
  nextStopLabel:   { ca: 'Pròxima parada', es: 'Próxima parada', en: 'Next stop' },
  trackLabel:      { ca: 'Vía',        es: 'Vía',         en: 'Track' },
  expectedArrival: { ca: 'Arribada prevista', es: 'Llegada prevista', en: 'Expected arrival' },
  cercanias:       { ca: 'Rodalies',   es: 'Cercanías',   en: 'Commuter' },
  variation:       { ca: 'Variació horària', es: 'Variación h', en: 'Time variation' },
  groupRodalies:   { ca: 'R — Rodalies', es: 'R — Rodalies', en: 'R — Rodalies' },
  groupRegionals:  { ca: 'RL / RT / RG — Regionals', es: 'RL / RT / RG — Regionales', en: 'RL / RT / RG — Regionals' },
  groupRodaliesShort: { ca: 'R — Rodalies', es: 'R — Rodalies', en: 'R — Rodalies' },
  groupRegionalsShort: { ca: 'Regionals', es: 'Regionales', en: 'Regionals' },

  // ── StopPanel & Sharing ──
  stationFgc:      { ca: 'ESTACIÓ FGC', es: 'ESTACIÓN FGC', en: 'FGC STATION' },
  stationRenfe:    { ca: 'ESTACIÓ RODALIES', es: 'ESTACIÓN RODALIES', en: 'RODALIES STATION' },
  shareStation:    { ca: "Comparteix l'estació", es: 'Compartir estación', en: 'Share station' },
  shareTrain:      { ca: 'Comparteix el tren', es: 'Compartir tren', en: 'Share train' },
  shareRoute:      { ca: 'Comparteix la ruta', es: 'Compartir ruta', en: 'Share route' },
  linkCopied:      { ca: 'Enllaç copiat!', es: '¡Enlace copiado!', en: 'Link copied!' },
  close:           { ca: 'Tanca', es: 'Cerrar', en: 'Close' },
  accessible:      { ca: 'Accessible', es: 'Accesible',   en: 'Accessible' },
  departures:      { ca: 'Pròximes sortides', es: 'Próximas salidas', en: 'Next departures' },
  noDepartures:    { ca: 'Sense sortides programades.', es: 'Sin salidas programadas.', en: 'No scheduled departures.' },
  minShort:        { ca: (m: number) => `${m} min`, es: (m: number) => `${m} min`, en: (m: number) => `${m} min` },
  loadingData:     { ca: 'Carregant dades…', es: 'Cargando datos…', en: 'Loading data…' },
  weatherLabel:    { ca: 'Meteorologia', es: 'Meteorología', en: 'Weather' },
  airQuality:      { ca: "Qualitat de l'aire", es: 'Calidad del aire', en: 'Air quality' },
  airQualityIndex: { ca: "Índex de qualitat de l'aire", es: 'Índice de calidad del aire', en: 'Air quality index' },
  noEnvData:       { ca: 'Sense dades ambientals per a aquesta estació.', es: 'Sin datos ambientales para esta estación.', en: 'No environmental data for this station.' },
  airGood:         { ca: 'Bo',         es: 'Bueno',       en: 'Good' },
  airModerate:     { ca: 'Moderat',    es: 'Moderado',    en: 'Moderate' },
  airBad:          { ca: 'Dolent',     es: 'Malo',        en: 'Poor' },

  // ── TripPlanner ──
  origin:          { ca: 'Origen',     es: 'Origen',      en: 'Origin' },
  destination:     { ca: 'Destinació', es: 'Destino',     en: 'Destination' },
  fromWhere:       { ca: "D'on surts?", es: '¿De dónde sales?', en: 'Where from?' },
  toWhere:         { ca: 'On vas?',    es: '¿A dónde vas?', en: 'Where to?' },
  swap:            { ca: 'Intercanviar', es: 'Intercambiar', en: 'Swap' },
  direct:          { ca: 'Directe',    es: 'Directo',     en: 'Direct' },
  transfers:       { ca: (n: number) => `${n} transbord${n > 1 ? 'aments' : 'ament'}`, es: (n: number) => `${n} transbordo${n > 1 ? 's' : ''}`, en: (n: number) => `${n} transfer${n > 1 ? 's' : ''}` },
  walkingTransfer: { ca: 'Enllaç a peu', es: 'Enlace a pie', en: 'Walking transfer' },
  delayLive:       { ca: (line: string, d: number) => `${line} circula amb +${d} min de retard ara mateix`, es: (line: string, d: number) => `${line} circula con +${d} min de retraso ahora mismo`, en: (line: string, d: number) => `${line} is running +${d} min late right now` },
  calcRoute:       { ca: 'Calculant ruta…', es: 'Calculando ruta…', en: 'Calculating route…' },
  sameOriginDest:  { ca: "L'origen i la destinació són iguals", es: 'El origen y el destino son iguales', en: 'Origin and destination are the same' },
  cannotConnect:   { ca: 'No es pot connectar', es: 'No se puede conectar', en: 'Cannot connect' },
  genericError:    { ca: 'Error',      es: 'Error',       en: 'Error' },
  noDirectRoute:   { ca: "No s'ha trobat cap ruta directa per avui amb aquestes estacions.", es: 'No se ha encontrado ninguna ruta directa para hoy con estas estaciones.', en: 'No direct route found for today with these stations.' },
  pickOriginDest:  { ca: "Tria origen i destinació per veure els pròxims trens i l'hora d'arribada.", es: 'Elige origen y destino para ver los próximos trenes y la hora de llegada.', en: 'Pick origin and destination to see upcoming trains and arrival time.' },
  showOnMap:       { ca: 'Mostra el recorregut al mapa', es: 'Mostrar el recorrido en el mapa', en: 'Show route on map' },
  leaveNow:        { ca: 'Sortir ara',  es: 'Salir ahora',  en: 'Leave now' },
  leaveLater:      { ca: 'Sortir més tard', es: 'Salir más tarde', en: 'Leave later' },
  timeLabel:       { ca: 'Hora',       es: 'Hora',        en: 'Time' },
  dateLabel:       { ca: 'Dia',        es: 'Día',         en: 'Date' },
  stepFreeRoute:   { ca: 'Itinerari accessible', es: 'Itinerario accesible', en: 'Step-free route' },
  showStepFree:    { ca: 'Veure itinerari sense escales', es: 'Ver itinerario sin escalones', en: 'Show step-free route' },
  hideStepFree:    { ca: 'Amagar itinerari', es: 'Ocultar itinerario', en: 'Hide route' },
  trackLive:       { ca: 'En ruta',    es: 'En ruta',     en: 'Track live' },
  showStops:       { ca: '▼ Veure parades', es: '▼ Ver paradas', en: '▼ View stops' },
  hideStops:       { ca: '▲ Amagar parades', es: '▲ Ocultar paradas', en: '▲ Hide stops' },
  preferStepFree:  { ca: 'Prioritza transbords accessibles', es: 'Priorizar transbordos accesibles', en: 'Prefer step-free transfers' },
  stepFreeNote:    { ca: 'Transbords en estacions amb accés sense escales quan és possible.', es: 'Transbordos en estaciones con acceso sin escalones cuando es posible.', en: 'Changes at step-free stations where possible.' },
  notFullyStepFree: { ca: '⚠ El millor trajecte encara té un transbord no accessible.', es: '⚠ El mejor trayecto aún tiene un transbordo no accesible.', en: '⚠ Best route still has a non-step-free transfer.' },

  // ── Saved & recent routes ──
  savedRoutes:     { ca: 'Trajectes desats', es: 'Trayectos guardados', en: 'Saved routes' },
  recentRoutes:    { ca: 'Recents',        es: 'Recientes',    en: 'Recent' },
  saveRoute:       { ca: 'Desa aquest trajecte', es: 'Guardar este trayecto', en: 'Save this route' },
  unsaveRoute:     { ca: 'Treu dels desats', es: 'Quitar de guardados', en: 'Remove from saved' },
  clearRecents:    { ca: 'Esborra', es: 'Borrar', en: 'Clear' },

  // ── Alerts ──
  alert:           { ca: 'ALERTA',     es: 'ALERTA',      en: 'ALERT' },
  alertDetails:    { ca: "Detalls de l'avís", es: 'Detalles del aviso', en: 'Alert details' },
  whatIsThisAlert: { ca: 'Què vol dir aquest avís?', es: '¿Qué significa este aviso?', en: 'What does this notice mean?' },
  affectedStations:{ ca: 'Estacions afectades', es: 'Estaciones afectadas', en: 'Affected stations' },
  affectedLines:   { ca: 'Línies afectades', es: 'Líneas afectadas', en: 'Affected lines' },
  officialSources: { ca: 'Canals oficials en temps real', es: 'Canales oficiales en tiempo real', en: 'Official real-time channels' },
  officialFgcAvisos:{ ca: "Avisos oficials d'FGC", es: 'Avisos oficiales de FGC', en: 'Official FGC service alerts' },
  officialFgcTwitter:{ ca: 'Estat del servei FGC a X (@FGC)', es: 'Estado del servicio FGC en X (@FGC)', en: 'FGC service status on X (@FGC)' },
  officialRodaliesAlteracions:{ ca: 'Alteracions del servei Rodalies', es: 'Alteraciones del servicio Rodalies', en: 'Rodalies service disruptions' },
  officialRodaliesTwitter:{ ca: 'Estat del servei Rodalies a X (@rodalies)', es: 'Estado del servicio Rodalies en X (@rodalies)', en: 'Rodalies service status on X (@rodalies)' },
  clickForDetails: { ca: 'Prem per a més detalls i canals oficials', es: 'Pulsa para más detalles y canales oficiales', en: 'Tap for details and official channels' },
  busReplacementNotice:{ ca: 'Servei alternatiu per carretera: els trens enllacen amb autobús per obres o incidències en el tram indicat.', es: 'Servicio alternativo por carretera: los trenes enlazan con autobús por obras o incidencias en el tramo indicado.', en: 'Bus replacement service: trains connect with buses due to maintenance or incidents on the indicated corridor.' },
  carsRestrictionNotice:{ ca: 'Embarcament exclusiu als primers 3 cotxes degut a la longitud reduïda de les andanes a les parades indicades.', es: 'Embarque exclusivo en los primeros 3 coches por la longitud reducida de los andenes en las paradas indicadas.', en: 'Boarding restricted to the first 3 cars due to short platform lengths at the indicated stops.' },
  generalImpact:   { ca: 'Afectació general al corredor', es: 'Afectación general al corredor', en: 'General corridor impact' },
  activeSchedule:  { ca: 'Vigència de l’avís', es: 'Vigencia del aviso', en: 'Notice validity' },
  viewMoreInfo:    { ca: 'Més informació', es: 'Más información', en: 'More info' },
  viewAllAlerts:   { ca: (n: number) => `Veure tots (${n}) ▼`, es: (n: number) => `Ver todos (${n}) ▼`, en: (n: number) => `View all (${n}) ▼` },
  collapseAlerts:  { ca: 'Plega ▲', es: 'Plegar ▲', en: 'Collapse ▲' },
  viewAlertsList:  { ca: (n: number) => `Tots (${n}) ▼`, es: (n: number) => `Todos (${n}) ▼`, en: (n: number) => `All (${n}) ▼` },
  allStationsAffected: { ca: (n: number) => `${n} estacions afectades`, es: (n: number) => `${n} estaciones afectadas`, en: (n: number) => `${n} affected stations` },
  alertIssuedAt:   { ca: 'Emès el:',   es: 'Emitido el:', en: 'Issued on:' },
  alertValidUntil: { ca: 'Vigent fins a:', es: 'Vigente hasta:', en: 'Valid until:' },
  todayAt:         { ca: (time: string | number) => `Avui a les ${time}`, es: (time: string | number) => `Hoy a las ${time}`, en: (time: string | number) => `Today at ${time}` },
  yesterdayAt:     { ca: (time: string | number) => `Ahir a les ${time}`, es: (time: string | number) => `Ayer a las ${time}`, en: (time: string | number) => `Yesterday at ${time}` },
  tomorrowAt:      { ca: (time: string | number) => `Demà a les ${time}`, es: (time: string | number) => `Mañana a las ${time}`, en: (time: string | number) => `Tomorrow at ${time}` },
  dateTimeAt:      { ca: (date: string | number, time: string | number) => `${date} a les ${time}`, es: (date: string | number, time: string | number) => `${date} a las ${time}`, en: (date: string | number, time: string | number) => `${date} at ${time}` },
  filterLine:      { ca: 'Filtre:',    es: 'Filtro:',     en: 'Filter:' },
  clearFilter:     { ca: 'Treure filtre', es: 'Quitar filtro', en: 'Clear filter' },
  activeFilter:    { ca: (line: string) => `Filtre actiu: ${line}`, es: (line: string) => `Filtro activo: ${line}`, en: (line: string) => `Active filter: ${line}` },
  weatherFrequencyAlertTitle: { ca: 'Freqüència alterada per meteorologia', es: 'Frecuencia alterada por meteorología', en: 'Frequency altered due to weather' },
  weatherFrequencyAlertDesc: { ca: 'A causa de condicions meteorològiques adverses, els trens poden circular fora del seu horari habitual. Consulteu els trens en circulació a dalt.', es: 'Debido a condiciones meteorológicas adversas, los trenes pueden circular fuera de su horario habitual. Consulte los trenes en circulación arriba.', en: 'Due to severe weather conditions, trains may run off their scheduled timetable. Check live circulating trains above.' },
  liveTrainApproaching: { ca: (dist: number) => `Tren a ${dist} ${dist === 1 ? 'parada' : 'parades'}`, es: (dist: number) => `Tren a ${dist} ${dist === 1 ? 'parada' : 'paradas'}`, en: (dist: number) => `Train ${dist} ${dist === 1 ? 'stop' : 'stops'} away` },
  liveTrainAtPlatform:  { ca: "Tren a l'estació", es: 'Tren en la estación', en: 'Train at station' },
  theoreticalScheduleNotice: { ca: 'Horaris teòrics: consulteu els trens en circulació a dalt per al pas en temps real.', es: 'Horarios teóricos: consulte los trenes en circulación arriba para el paso en tiempo real.', en: 'Scheduled timetable: check circulating trains above for real-time arrivals.' },

  // ── Mobile UX & Settings ──
  settings:        { ca: 'Configuració', es: 'Configuración', en: 'Settings' },
  majorHubs:       { ca: 'Estacions principals', es: 'Estaciones principales', en: 'Major hubs' },
  backToList:      { ca: 'Llista',     es: 'Lista',       en: 'List' },
  clearSearch:     { ca: 'Esborra cerca', es: 'Borrar búsqueda', en: 'Clear search' },
  aboutApp:        { ca: 'Sobre Andana', es: 'Sobre Andana', en: 'About Andana' },
  aboutDescription:{ ca: 'Informació en temps real, telemetria i horaris de la xarxa d’FGC i Rodalies de Catalunya.', es: 'Información en tiempo real, telemetría y horarios de la red de FGC y Rodalies de Catalunya.', en: 'Real-time information, telemetry, and schedules for FGC and Rodalies de Catalunya.' },
  networkStatus:   { ca: 'Estat del servei', es: 'Estado del servicio', en: 'Service status' },
  themeDark:       { ca: 'Fosc',       es: 'Oscuro',      en: 'Dark' },
  themeLight:      { ca: 'Clar',       es: 'Claro',       en: 'Light' },
  appearance:      { ca: 'Aparença',   es: 'Apariencia',  en: 'Appearance' },
  activeAlertsCount: { ca: (n: number) => `${n} ${n === 1 ? 'avís actiu' : 'avisos actius'}`, es: (n: number) => `${n} ${n === 1 ? 'aviso activo' : 'avisos activos'}`, en: (n: number) => `${n} active ${n === 1 ? 'alert' : 'alerts'}` },

  // ── Favorite Stations ──
  favoriteStations:     { ca: 'Estacions preferides', es: 'Estaciones favoritas', en: 'Favorite stations' },
  addFavorite:          { ca: 'Afegir a preferides', es: 'Añadir a favoritas', en: 'Add to favorites' },
  removeFavorite:       { ca: 'Treure de preferides', es: 'Quitar de favoritas', en: 'Remove from favorites' },
  noFavoritesYet:       { ca: 'Prem l’estrella ⭐️ a qualsevol estació per tenir-la sempre a mà.', es: 'Pulsa la estrella ⭐️ en cualquier estación para tenerla siempre a mano.', en: 'Tap the star ⭐️ on any station to keep it handy.' },

  // ── Departures filtering & status ──
  filterDepartures:     { ca: 'Filtra per línia', es: 'Filtrar por línea', en: 'Filter by line' },
  allLines:             { ca: 'Totes', es: 'Todas', en: 'All' },
  suspended:            { ca: 'Suspès', es: 'Suspendido', en: 'Suspended' },
  cancelled:            { ca: 'Cancel·lat', es: 'Cancelado', en: 'Cancelled' },
  serviceSuspendedNotice: { ca: 'Sense trens en circulació en aquesta línia en aquests moments', es: 'Sin trenes en circulación en esta línea en estos momentos', en: 'No trains currently circulating on this line at this time' },

  // ── PWA Installation ──
  installApp:           { ca: 'Instal·la Andana al mòbil', es: 'Instala Andana en el móvil', en: 'Install Andana on mobile' },
  installAppDesc:       { ca: 'Fes-la servir a pantalla completa com una app nativa, sense barra del navegador.', es: 'Úsala a pantalla completa como una app nativa, sin barra del navegador.', en: 'Use it full-screen like a native app, with no browser bar.' },
  installInstructionsIos:{ ca: "A Safari, prem Compartir (⬆) i després 'Afegeix a la pantalla d'inici'.", es: "En Safari, pulsa Compartir (⬆) y luego 'Añadir a pantalla de inicio'.", en: "In Safari, tap Share (⬆) and then 'Add to Home Screen'." },
  installInstructionsAndroid:{ ca: "A Chrome, prem el menú (⋮) i 'Instal·la l'aplicació'.", es: "En Chrome, pulsa el menú (⋮) e 'Instalar aplicación'.", en: "In Chrome, tap menu (⋮) and 'Install app'." },
  installButton:        { ca: 'Instal·lar ara', es: 'Instalar ahora', en: 'Install now' },

  // ── Onboarding / Interactive Tour ──
  welcomeToAndana:      { ca: 'Benvingut/da a Andana', es: 'Bienvenido/a a Andana', en: 'Welcome to Andana' },
  tourFirstTimePrompt:  { ca: 'És la primera vegada que fas servir Andana?', es: '¿Es la primera vez que usas Andana?', en: 'Is this your first time using Andana?' },
  tourFirstTimeDesc:    { ca: 'Vols fer una visita guiada ràpida per descobrir com moure’t per la xarxa, veure els trens en directe i planificar rutes?', es: '¿Quieres hacer una visita guiada rápida para descubrir cómo moverte por la red, ver trenes en directo y planificar rutas?', en: 'Would you like a quick interactive tour to discover how to explore the network, track trains live, and plan journeys?' },
  tourStart:            { ca: '✨ Sí, ensenya-m’ho', es: '✨ Sí, enséñamelo', en: '✨ Yes, show me' },
  tourSkip:             { ca: 'No, ja me’n sé sortir', es: 'No, ya me apaño', en: 'No, I know my way' },
  tourStepNetworkTitle: { ca: 'Commutador de Xarxa', es: 'Conmutador de Red', en: 'Network Switcher' },
  tourStepNetworkDesc:  { ca: 'Tria fàcilment si vols veure la xarxa d’FGC, Rodalies de Catalunya o ambdues integrades alhora.', es: 'Elige fácilmente si quieres ver la red de FGC, Rodalies de Catalunya o ambas integradas a la vez.', en: 'Easily choose whether to view FGC, Rodalies de Catalunya, or both networks unified together.' },
  tourStepTrainsTitle:   { ca: 'Trens en circulació', es: 'Trenes en circulación', en: 'Live circulating trains' },
  tourStepTrainsDesc:    { ca: 'Segueix tots els trens en directe pel mapa. Filtra per línia, consulta retards en temps real i, a FGC, mira l’ocupació per cotxe abans de pujar.', es: 'Sigue todos los trenes en directo por el mapa. Filtra por línea, consulta retrasos en tiempo real y, en FGC, comprueba la ocupación por coche antes de subir.', en: 'Track live trains in real time on the map. Filter by line, check live delays, and on FGC, view occupancy per car before boarding.' },
  tourStepStationsTitle: { ca: 'Estacions i sortides', es: 'Estaciones y salidas', en: 'Stations & departures' },
  tourStepStationsDesc:  { ca: 'Cerca qualsevol estació per veure les properes sortides amb compte enrere en directe, retards i vies. Guarda les teves estacions preferides amb l’estrella ⭐️.', es: 'Busca cualquier estación para ver las próximas salidas con cuenta atrás en directo, retrasos y vías. Guarda tus estaciones favoritas con la estrella ⭐️.', en: 'Search any station to view upcoming departures with live countdowns, delays, and platform tracks. Save your favorites with the ⭐️ star.' },
  tourStepPlanTitle:     { ca: 'Planificador de rutes', es: 'Planificador de rutas', en: 'Journey planner' },
  tourStepPlanDesc:      { ca: 'Calcula el millor trajecte entre dues estacions qualsevol combinant FGC i Rodalies. Consulta transbords a peu, zones tarifàries ATM i connexions de Metro.', es: 'Calcula el mejor trayecto entre dos estaciones cualesquiera combinando FGC y Rodalies. Consulta transbordos a pie, zonas tarifarias ATM y conexiones de Metro.', en: 'Calculate the best route between any two stations combining FGC and Rodalies. View walking transfers, ATM fare zones, and Metro connections.' },
  tourStepTabsTitle:    { ca: 'Pestanyes de Navegació', es: 'Pestañas de Navegación', en: 'Navigation Tabs' },
  tourStepTabsDesc:     { ca: 'Consulta combois en marxa i ocupació per cotxe (Trens), cerca estacions i guarda preferides (Estacions) o calcula rutes multimodals (Anar a…).', es: 'Consulta convoyes en marcha y ocupación por coche (Trenes), busca estaciones y guarda favoritas (Estaciones) o calcula rutas multimodales (Ir a…).', en: 'Check live trains and car occupancy (Trains), find stations and save favorites (Stations), or search multi-modal routes (Go to…).' },
  tourStepStatusTitle:  { ca: 'Estat de la Xarxa', es: 'Estado de la Red', en: 'Network Health' },
  tourStepStatusDesc:   { ca: 'Comprova les incidències del servei, retards en temps real i l’estat de salut de cada línia d’un sol cop d’ull.', es: 'Comprueba las incidencias del servicio, retrasos en tiempo real y el estado de cada línea de un solo vistazo.', en: 'Check real-time alerts, live delay metrics, and line health status at a glance.' },
  tourStepNearMeTitle:  { ca: 'A prop meu', es: 'Cerca de mí', en: 'Near me' },
  tourStepNearMeDesc:   { ca: 'Prem aquest botó per localitzar a l’instant l’estació més propera a la teva posició i consultar les pròximes sortides.', es: 'Pulsa este botón para localizar al instante la estación más cercana a tu posición y consultar las próximas salidas.', en: 'Tap this button to instantly locate your nearest station and view upcoming departures.' },
  tourStepSettingsTitle: { ca: 'Configuració i ajustos', es: 'Configuración y ajustes', en: 'Settings & preferences' },
  tourStepSettingsDesc:  { ca: 'Personalitza l’idioma (català, castellà o anglès), canvia entre tema fosc i clar, instal·la l’app al teu dispositiu o envia suggeriments i comentaris.', es: 'Personaliza el idioma (catalán, castellano o inglés), cambia entre tema oscuro y claro, instala la app en tu dispositivo o envía sugerencias y comentarios.', en: 'Customize the app language (Catalan, Spanish, English), toggle dark/light theme, install the app on your device, or send feedback.' },
  openSettingsNow:      { ca: 'Obrir configuració ⚙️', es: 'Abrir configuración ⚙️', en: 'Open settings ⚙️' },
  tourFinish:           { ca: 'Entesos! Finalitzar', es: '¡Entendido! Finalizar', en: 'Got it! Finish' },
  nextStep:             { ca: 'Següent', es: 'Siguiente', en: 'Next' },
  prevStep:             { ca: 'Enrere', es: 'Atrás', en: 'Back' },
  skipTutorial:         { ca: 'Omet', es: 'Saltar', en: 'Skip' },
  getStarted:           { ca: 'Comença a explorar', es: 'Comenzar a explorar', en: 'Get started' },
  viewTutorialAgain:    { ca: "Veure el tutorial de l'app", es: 'Ver el tutorial de la app', en: 'View app tutorial' },

  // ── Support / Donation ──
  supportAndana:        { ca: 'Donar suport a Andana', es: 'Apoyar a Andana', en: 'Support Andana' },
  enjoyingAndana:       { ca: "T'està sent útil Andana?", es: '¿Te está resultando útil Andana?', en: 'Are you enjoying Andana?' },
  donationDesc:         { ca: "Andana és un projecte independent i gratuït, sense anuncis ni rastrejadors. Si t'ajuda en els teus desplaçaments diaris, pots col·laborar a mantenir el servei convidant a un cafè.", es: 'Andana es un proyecto independiente y gratuito, sin anuncios ni rastreadores. Si te ayuda en tus desplazamientos diarios, puedes colaborar en mantener el servicio invitando a un café.', en: 'Andana is an independent, free project with no ads or tracking. If it helps your daily commutes, you can help keep the service running by buying a coffee.' },
  buyACoffee:           { ca: '☕ Convidar a un cafè', es: '☕ Invitar a un café', en: '☕ Buy a coffee' },
  remindMeLater:        { ca: 'Recorda-m’ho més endavant', es: 'Recuérdamelo más adelante', en: 'Remind me later' },
  dontShowAgain:        { ca: 'No tornis a mostrar', es: 'No volver a mostrar', en: "Don't show again" },

  // ── Feedback & Bug Reports ──
  feedbackOrBugReport:      { ca: "Informar d'un error o suggeriment", es: 'Informar de un error o sugerencia', en: 'Report a bug or suggest feature' },
  feedbackTitle:            { ca: 'Comentaris i Suggeriments', es: 'Comentarios y Sugerencias', en: 'Feedback & Bug Reports' },
  feedbackTypeBug:          { ca: 'Error / Bug', es: 'Error / Bug', en: 'Bug / Issue' },
  feedbackTypeFeature:      { ca: 'Suggeriment', es: 'Sugerencia', en: 'Feature idea' },
  feedbackTypeOther:        { ca: 'Altres', es: 'Otros', en: 'Other' },
  feedbackDescriptionLabel: { ca: 'Descripció del que has observat o de la teva idea', es: 'Descripción de lo que has observado o de tu idea', en: 'Description of what happened or your idea' },
  feedbackPlaceholder:      { ca: "Explica'ns què ha passat o quina funció t'agradaria veure a Andana...", es: 'Cuéntanos qué ha ocurrido o qué función te gustaría ver en Andana...', en: 'Tell us what happened or what feature you would like to see in Andana...' },
  feedbackEmailLabel:       { ca: 'El teu correu de contacte (opcional)', es: 'Tu correo de contacto (opcional)', en: 'Your contact email (optional)' },
  feedbackAttachDiagnostics:{ ca: 'Incloure informació tècnica del dispositiu (pantalla, xarxa, navegador)', es: 'Incluir información técnica del dispositivo (pantalla, red, navegador)', en: 'Include device diagnostics (screen size, network, browser)' },
  feedbackRecipientNote:    { ca: 'Els comentaris s’enviaran a', es: 'Los comentarios se enviarán a', en: 'Feedback will be sent to' },
  feedbackCopiedSuccess:    { ca: 'Missatge copiat al porta-retalls! Pots enviar-lo al nostre correu.', es: '¡Mensaje copiado al portapapeles! Puedes enviarlo a nuestro correo.', en: 'Message copied to clipboard! You can paste it into an email.' },
  feedbackClientOpened:     { ca: "S'ha obert el teu gestor de correu amb l'informe llest per enviar.", es: 'Se ha abierto tu cliente de correo con el informe listo para enviar.', en: 'Your email client has been opened with the pre-filled report.' },
  feedbackSendEmail:        { ca: 'Enviar per correu', es: 'Enviar por correo', en: 'Send via email' },
  feedbackCopy:             { ca: 'Copiar informe', es: 'Copiar informe', en: 'Copy report' },
  copied:                   { ca: 'Copiat!', es: '¡Copiado!', en: 'Copied!' },

  // ── Night rest & Last service ──
  nightRestTitle:           { ca: 'Xarxa en descans nocturn', es: 'Red en descanso nocturno', en: 'Network closed overnight' },
  nightRestDesc:            { ca: 'El servei comercial està tancat durant la nit. Les primeres sortides habituals comencen a partir de les 05:00 h.', es: 'El servicio comercial está cerrado durante la noche. Las primeras salidas habituales comienzan a partir de las 05:00 h.', en: 'Commercial service is closed overnight. Regular early morning departures begin from 05:00.' },
  lastService:              { ca: 'Últim servei del dia', es: 'Último servicio del día', en: 'Last service of the day' },
  lastServiceShort:         { ca: 'Últim servei', es: 'Último servicio', en: 'Last service' },

  // ── Recommended Metro connection ──
  recommendedMetroConnection: { ca: 'Connexió recomanada amb Metro', es: 'Conexión recomendada en Metro', en: 'Recommended Metro connection' },
  directMetroDesc:          {
    ca: (orig: string | number, dest: string | number) => `Sense enllaç ferroviari directe entre ${orig} i ${dest}. Pots connectar directament amb la xarxa de Metro TMB / Tram:`,
    es: (orig: string | number, dest: string | number) => `Sin enlace ferroviario directo entre ${orig} y ${dest}. Puedes conectar directamente con la red de Metro TMB / Tram:`,
    en: (orig: string | number, dest: string | number) => `No direct rail route between ${orig} and ${dest}. You can connect directly using TMB Metro / Tram:`
  },

  // ── App-level errors & Telemetry outages ──
  apiConnectError: { ca: "No es pot connectar amb l'API de trens", es: 'No se puede conectar con la API de trenes', en: 'Cannot connect to the trains API' },
  renfeOutageError: {
    ca: 'Posicions de Rodalies no disponibles temporalment (incidència al servidor de Renfe)',
    es: 'Posiciones de Rodalies no disponibles temporalmente (incidencia en el servidor de Renfe)',
    en: 'Rodalies live train positions temporarily unavailable (Renfe upstream outage)',
  },
  fgcOutageError: {
    ca: 'Posicions d’FGC no disponibles temporalment (incidència al servidor d’FGC)',
    es: 'Posiciones de FGC no disponibles temporalmente (incidencia en el servidor de FGC)',
    en: 'FGC live train positions temporarily unavailable (FGC upstream outage)',
  },
  noLiveTelemetry: {
    ca: 'Sense telemetria en directe',
    es: 'Sin telemetría en directo',
    en: 'No live telemetry',
  },
  telemetryUnavailableDesc: {
    ca: 'El servidor de telemetria en temps real no està emetent dades en aquests moments. Els horaris i sortides continuen funcionant.',
    es: 'El servidor de telemetría en tiempo real no está emitiendo datos en estos momentos. Los horarios y salidas siguen funcionando.',
    en: 'The upstream live telemetry server is not broadcasting data right now. Timetables and departures remain operational.',
  },
  telemetryOutageBadge: {
    ca: 'Telemetria no disponible',
    es: 'Telemetría no disponible',
    en: 'Telemetry unavailable',
  },
} as const

export type TransKey = keyof typeof DICT

type Entry = (typeof DICT)[TransKey]

interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  // Interpolation args are passed positionally to the matching dictionary
  // function. Per-key arg typing is intentionally loose so a `TransKey` union
  // (e.g. a line-group's labelKey) can be passed without widening the tuple.
  t: (key: TransKey, ...args: (string | number)[]) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ca')

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    const stored = typeof window !== 'undefined'
      ? window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
      : null
    if (stored === 'ca' || stored === 'es' || stored === 'en') setLangState(stored)
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { window.localStorage.setItem(STORAGE_KEY, l) } catch {}
    document.documentElement.setAttribute('lang', l)
  }, [])

  const t = useCallback<I18nContextValue['t']>((key, ...args) => {
    const entry = DICT[key] as Entry
    const value = entry[lang]
    if (typeof value === 'function') {
      return (value as (...a: (string | number)[]) => string)(...args)
    }
    return value
  }, [lang])

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}
