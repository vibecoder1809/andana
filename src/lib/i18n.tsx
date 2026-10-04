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
  groupOther:      { ca: 'Altres',     es: 'Otras',       en: 'Other' },
  groupUrbanShort: { ca: 'L — Urbà',   es: 'L — Urbano',  en: 'L — Urban' },
  groupVallesShort:{ ca: 'S — Vallès', es: 'S — Vallès',  en: 'S — Vallès' },
  groupRegionalShort:{ ca: 'R — Reg.', es: 'R — Reg.',    en: 'R — Reg.' },
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

  // ── StopPanel ──
  stationFgc:      { ca: 'ESTACIÓ FGC', es: 'ESTACIÓN FGC', en: 'FGC STATION' },
  stationRenfe:    { ca: 'ESTACIÓ RODALIES', es: 'ESTACIÓN RODALIES', en: 'RODALIES STATION' },
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
  viewMoreInfo:    { ca: 'Més informació ℹ️', es: 'Más información ℹ️', en: 'More info ℹ️' },
  allStationsAffected: { ca: (n: number) => `${n} estacions afectades`, es: (n: number) => `${n} estaciones afectadas`, en: (n: number) => `${n} affected stations` },
  alertIssuedAt:   { ca: 'Emès el:',   es: 'Emitido el:', en: 'Issued on:' },
  alertValidUntil: { ca: 'Vigent fins a:', es: 'Vigente hasta:', en: 'Valid until:' },
  todayAt:         { ca: (time: string | number) => `Avui a les ${time}`, es: (time: string | number) => `Hoy a las ${time}`, en: (time: string | number) => `Today at ${time}` },
  yesterdayAt:     { ca: (time: string | number) => `Ahir a les ${time}`, es: (time: string | number) => `Ayer a las ${time}`, en: (time: string | number) => `Yesterday at ${time}` },
  tomorrowAt:      { ca: (time: string | number) => `Demà a les ${time}`, es: (time: string | number) => `Mañana a las ${time}`, en: (time: string | number) => `Tomorrow at ${time}` },
  dateTimeAt:      { ca: (date: string | number, time: string | number) => `${date} a les ${time}`, es: (date: string | number, time: string | number) => `${date} a las ${time}`, en: (date: string | number, time: string | number) => `${date} at ${time}` },

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

  // ── App-level errors ──
  apiConnectError: { ca: "No es pot connectar amb l'API de trens", es: 'No se puede conectar con la API de trenes', en: 'Cannot connect to the trains API' },
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
