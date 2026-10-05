import { STATION_CODES } from './constants'
import { fgcExport, fgcGtfsFile, fgcAllRecords } from './fgc'
import { fetchStops } from './gtfs'
import { fetchRenfeStations } from './renfe'
import { loadRodaliesTimetable } from './renfeTimetable'
import { FOOTPATH_MAP } from './footpaths'
import { computeJourneyFare } from './fares'
import { serviceDate, isWithinPlanWindow } from './serviceTime'
import { finiteNum } from './validate'
import type { PlannerStation, JourneyLeg, Journey, Operator, Stop } from '@/types'

// Minimum time (seconds) needed to change between two trips at a station.
const TRANSFER_SECONDS = 120

interface RawTimetableRow {
  date: string
  route_short_name: string
  trip_headsign: string
  stop_name: string
  stop_id: string
  arrival_time: string
  departure_time: string
  stop_sequence: number
  shape_id: number
  parent_station: string | null
  exception_type: number | null
}

interface TripStop {
  parent: string      // parent station code (e.g. "PC")
  name: string
  seq: number
  arrival: number     // seconds since midnight
  departure: number   // seconds since midnight
}

export interface Trip {
  id: number
  line: string        // route_short_name
  headsign: string
  operator?: Operator
  stops: TripStop[]
}

// A single ride between two consecutive stops on a trip.
export interface Connection {
  depTime: number
  arrTime: number
  fromParent: string
  toParent: string
  fromName: string
  toName: string
  tripId: number
  line: string
  headsign: string
  operator?: Operator
}

export interface TimetableData {
  date: string                 // service date (YYYY-MM-DD) the data was built for
  connections: Connection[]    // sorted ascending by depTime
  tripConns: Map<number, Connection[]>  // tripId -> its connections, in stop order
  trips: Map<number, Trip>
  stationNames: Map<string, string>  // parent code -> display name
  stationLines: Map<string, string[]> // parent code -> sorted lines array
  stationOperators: Map<string, Operator> // parent code -> 'fgc' | 'renfe'
}

// ---- time helpers -------------------------------------------------------

function parseClock(t: string): number | null {
  // "HH:MM:SS" — GTFS times can exceed 24:00:00 for after-midnight services.
  const parts = t.split(':')
  if (parts.length !== 3) return null
  const h = Number(parts[0]), m = Number(parts[1]), s = Number(parts[2])
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return null
  return h * 3600 + m * 60 + s
}

export function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600) % 24
  const m = Math.floor(sec / 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parentOf(row: RawTimetableRow): string {
  const p = row.parent_station || row.stop_id.replace(/\d+$/, '')
  return p.replace(/bus\d*$/i, '')
}

function displayName(parent: string, fallback: string): string {
  const cleanParent = parent.replace(/bus\d*$/i, '')
  return STATION_CODES[parent] ?? STATION_CODES[cleanParent] ?? (fallback.replace(/bus\d*$/i, '').trim() || fallback)
}

// ---- build (cached per service date) ------------------------------------

let cache: TimetableData | null = null
let inflight: Promise<TimetableData> | null = null

function todayLocalISO(): string {
  // Pinned to Europe/Madrid, not the server clock — see lib/serviceTime.ts.
  return serviceDate()
}

async function buildTimetable(): Promise<TimetableData> {
  const rows = await fgcExport<RawTimetableRow>('viajes-de-hoy', 3600)

  // Group rows into trips by (line, headsign, shape_id), then reconstruct
  // individual runs by chaining stop_sequence continuity over time.
  const groups = new Map<string, RawTimetableRow[]>()
  for (const r of rows) {
    if (r.exception_type != null && r.exception_type === 2) continue
    const key = `${r.route_short_name}|${r.trip_headsign}|${r.shape_id}`
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
  }

  const trips = new Map<number, Trip>()
  const stationNames = new Map<string, string>()
  let tripId = 0

  for (const [, recs] of groups) {
    // Sort by departure time then sequence.
    const prepared = recs
      .map(r => {
        const dep = parseClock(r.departure_time)
        const arr = parseClock(r.arrival_time) ?? dep
        if (dep == null || arr == null) return null
        const parent = parentOf(r)
        if (!stationNames.has(parent)) {
          stationNames.set(parent, displayName(parent, r.stop_name))
        }
        return { r, dep, arr, parent, seq: r.stop_sequence }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.dep - b.dep || a.seq - b.seq)

    // Greedy chaining: attach each stop to the open trip whose last stop is
    // exactly one sequence earlier and not later in time. Trains don't
    // overtake on the same shape, so the closest-in-time match is correct.
    const open: Trip[] = []
    for (const p of prepared) {
      let best: Trip | null = null
      for (const t of open) {
        const last = t.stops[t.stops.length - 1]
        if (last.seq === p.seq - 1 && last.departure <= p.dep) {
          if (best === null || best.stops[best.stops.length - 1].departure < last.departure) {
            best = t
          }
        }
      }
      const stop: TripStop = {
        parent: p.parent,
        name: stationNames.get(p.parent)!,
        seq: p.seq,
        arrival: p.arr,
        departure: p.dep,
      }
      if (best) {
        best.stops.push(stop)
      } else {
        const t: Trip = { id: tripId, line: p.r.route_short_name, headsign: p.r.trip_headsign, stops: [stop] }
        trips.set(tripId, t)
        open.push(t)
        tripId++
      }
    }
  }

  return assembleTimetable(todayLocalISO(), trips, stationNames)
}

// Flatten built trips into the sorted connection list + per-trip connection
// index the planner consumes. Shared by the today (viajes-de-hoy) builder and
// the date-specific GTFS builder. Merges FGC and Rodalies networks.
function assembleTimetable(
  date: string,
  trips: Map<number, Trip>,
  stationNames: Map<string, string>,
): TimetableData {
  const connections: Connection[] = []
  const tripConns = new Map<number, Connection[]>()
  const stationLinesMap = new Map<string, Set<string>>()
  const stationOperators = new Map<string, Operator>()

  // 1. Process FGC trips
  for (const trip of trips.values()) {
    trip.operator = trip.operator ?? 'fgc'
    const own: Connection[] = []
    for (let i = 0; i < trip.stops.length - 1; i++) {
      const a = trip.stops[i]
      const b = trip.stops[i + 1]
      if (b.arrival < a.departure) continue // guard against bad rows
      const conn: Connection = {
        depTime: a.departure,
        arrTime: b.arrival,
        fromParent: a.parent,
        toParent: b.parent,
        fromName: a.name,
        toName: b.name,
        tripId: trip.id,
        line: trip.line,
        headsign: trip.headsign,
        operator: 'fgc',
      }
      connections.push(conn)
      own.push(conn)

      if (!stationLinesMap.has(a.parent)) stationLinesMap.set(a.parent, new Set())
      stationLinesMap.get(a.parent)!.add(trip.line)
      stationOperators.set(a.parent, 'fgc')
    }
    const lastStop = trip.stops[trip.stops.length - 1]
    if (lastStop) {
      if (!stationLinesMap.has(lastStop.parent)) stationLinesMap.set(lastStop.parent, new Set())
      stationLinesMap.get(lastStop.parent)!.add(trip.line)
      stationOperators.set(lastStop.parent, 'fgc')
    }
    if (own.length > 0) tripConns.set(trip.id, own)
  }

  // 2. Load and merge Rodalies timetable
  let maxTripId = 0
  for (const id of trips.keys()) {
    if (id > maxTripId) maxTripId = id
  }
  const rodalies = loadRodaliesTimetable(maxTripId + 1, date)

  for (const [tId, t] of rodalies.trips) {
    trips.set(tId, t)
  }
  for (const c of rodalies.connections) {
    connections.push(c)
    let own = tripConns.get(c.tripId)
    if (!own) {
      own = []
      tripConns.set(c.tripId, own)
    }
    own.push(c)
  }
  for (const [code, name] of rodalies.stationNames) {
    if (!stationNames.has(code)) {
      stationNames.set(code, name)
    }
    stationOperators.set(code, 'renfe')
  }
  for (const [code, lines] of rodalies.stationLines) {
    if (!stationLinesMap.has(code)) stationLinesMap.set(code, new Set())
    for (const l of lines) stationLinesMap.get(code)!.add(l)
  }

  connections.sort((x, y) => x.depTime - y.depTime)

  const stationLines = new Map<string, string[]>()
  for (const [code, lines] of stationLinesMap) {
    stationLines.set(code, Array.from(lines).sort())
  }

  return { date, connections, tripConns, trips, stationNames, stationLines, stationOperators }
}

// ---- date-specific build (full static GTFS) ----------------------------

// Maximum days ahead a journey may be planned for. The static GTFS feed covers
// further out, but we bound the work (and the cache) to a sensible window.
export const MAX_PLAN_DAYS_AHEAD = 7

// Parse a minimal CSV (no embedded newlines; quotes tolerated but FGC's GTFS
// files don't use them) into rows keyed by header. Lightweight on purpose —
// stop_times.txt is ~15MB, so we avoid per-cell allocation beyond the split.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n')
  const header = lines[0]?.replace(/\r$/, '').split(',') ?? []
  const out: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const cells = line.replace(/\r$/, '').split(',')
    const row: Record<string, string> = {}
    for (let j = 0; j < header.length; j++) row[header[j]] = cells[j] ?? ''
    out.push(row)
  }
  return out
}

interface CalendarDateRec { service_id: string; date: string; exception_type: number }

// Build the timetable for a specific service date from the static GTFS feed.
// Unlike the today builder (which chains a flat dataset), GTFS stop_times has a
// real trip_id per run, so trips are grouped directly — simpler and exact.
async function buildTimetableForDate(date: string): Promise<TimetableData> {
  // 1. Which services run on this date (exception_type 1 = added/runs).
  const calRows = await fgcAllRecords<CalendarDateRec>(
    'calendar_dates',
    { where: `date=date'${date}' AND exception_type=1`, select: 'service_id' },
    86400,
  )
  const runningServices = new Set(calRows.map(r => r.service_id))
  if (runningServices.size === 0) {
    return assembleTimetable(date, new Map(), new Map())
  }

  // 2. Pull the static GTFS member files in parallel.
  const [tripsTxt, stopTimesTxt, stopsTxt] = await Promise.all([
    fgcGtfsFile('trips.txt'),
    fgcGtfsFile('stop_times.txt'),
    fgcGtfsFile('stops.txt'),
  ])

  // stop_id -> { parent code, display name }
  const stopInfo = new Map<string, { parent: string; name: string }>()
  const stationNames = new Map<string, string>()
  for (const s of parseCsv(stopsTxt)) {
    const stopId = s.stop_id
    if (!stopId) continue
    const parent = s.parent_station || stopId.replace(/\d+$/, '')
    stopInfo.set(stopId, { parent, name: s.stop_name })
    if (!stationNames.has(parent)) {
      stationNames.set(parent, STATION_CODES[parent] ?? s.stop_name)
    }
  }

  // trip_id -> { line, headsign } for trips whose service runs today.
  const tripMeta = new Map<string, { line: string; headsign: string }>()
  for (const tr of parseCsv(tripsTxt)) {
    if (!runningServices.has(tr.service_id)) continue
    // route_id equals route_short_name in this feed (e.g. "R5", "L6").
    tripMeta.set(tr.trip_id, { line: tr.route_id, headsign: tr.trip_headsign })
  }

  // 3. Group stop_times rows by trip_id (only for running trips), building the
  // ordered stop list per trip.
  interface RawStopTime { seq: number; arr: number; dep: number; parent: string; name: string }
  const byTrip = new Map<string, RawStopTime[]>()
  for (const st of parseCsv(stopTimesTxt)) {
    const meta = tripMeta.get(st.trip_id)
    if (!meta) continue
    const info = stopInfo.get(st.stop_id)
    if (!info) continue
    const dep = parseClock(st.departure_time)
    const arr = parseClock(st.arrival_time) ?? dep
    if (dep == null || arr == null) continue
    const seq = finiteNum(st.stop_sequence)
    if (seq == null) continue
    const list = byTrip.get(st.trip_id)
    const row = { seq, arr, dep, parent: info.parent, name: info.name }
    if (list) list.push(row)
    else byTrip.set(st.trip_id, [row])
  }

  // 4. Materialise Trip objects with integer ids.
  const trips = new Map<number, Trip>()
  let id = 0
  for (const [tripId, rows] of byTrip) {
    const meta = tripMeta.get(tripId)!
    rows.sort((a, b) => a.seq - b.seq)
    const stops: TripStop[] = rows.map(r => ({
      parent: r.parent, name: r.name, seq: r.seq, arrival: r.arr, departure: r.dep,
    }))
    if (stops.length < 2) continue
    trips.set(id, { id, line: meta.line, headsign: meta.headsign, stops })
    id++
  }

  return assembleTimetable(date, trips, stationNames)
}

// Cache built timetables per service date (today via the fast viajes-de-hoy
// path, other dates via the static GTFS builder). Dates are validated against
// the planning window on every call, and dateCache/dateInflight are pruned to
// that window each time getTimetable runs — so the cache holds at most
// MAX_PLAN_DAYS_AHEAD + 1 entries even on a long-lived warm instance, without
// needing a separate eviction timer.
const dateCache = new Map<string, TimetableData>()
const dateInflight = new Map<string, Promise<TimetableData>>()

async function getTimetable(date?: string): Promise<TimetableData> {
  const today = todayLocalISO()
  const requested = date ?? today
  // Defense in depth: the /api/plan route already clamps the date, but don't
  // trust callers — anything outside the plan window collapses to today
  // rather than growing the cache with a date we'll never validly serve again.
  const target = isWithinPlanWindow(requested, today, MAX_PLAN_DAYS_AHEAD) ? requested : today

  if (target === today) {
    if (cache && cache.date === today) return cache
    if (inflight) return inflight
    inflight = buildTimetable()
      .then(data => { cache = data; inflight = null; return data })
      .catch(err => { inflight = null; throw err })
    return inflight
  }

  // Opportunistically prune entries that have rolled out of the window (e.g.
  // "yesterday" once the service date advances) before adding a new one —
  // bounds the map without a separate timer.
  for (const key of dateCache.keys()) {
    if (!isWithinPlanWindow(key, today, MAX_PLAN_DAYS_AHEAD)) dateCache.delete(key)
  }
  for (const key of dateInflight.keys()) {
    if (!isWithinPlanWindow(key, today, MAX_PLAN_DAYS_AHEAD)) dateInflight.delete(key)
  }

  const cached = dateCache.get(target)
  if (cached) return cached
  const pending = dateInflight.get(target)
  if (pending) return pending
  const build = buildTimetableForDate(target)
    .then(data => { dateCache.set(target, data); dateInflight.delete(target); return data })
    .catch(err => { dateInflight.delete(target); throw err })
  dateInflight.set(target, build)
  return build
}

// ---- accessible (step-free) stations ------------------------------------

// Parent-station codes with step-free boarding (gtfs_stops wheelchair_boarding
// == 1). Independent of service date, so built once and cached. Used to bias
// the planner toward accessible interchanges when a step-free route is asked
// for. Keyed by parent code to match the planner's station keying.
let accessibleCache: Set<string> | null = null
let accessibleInflight: Promise<Set<string>> | null = null

async function getAccessibleStations(): Promise<Set<string>> {
  if (accessibleCache) return accessibleCache
  if (accessibleInflight) return accessibleInflight
  accessibleInflight = Promise.all([
    fetchStops().catch(() => [] as Stop[]),
    fetchRenfeStations().catch(() => [] as Stop[]),
  ])
    .then(([fgcStops, renfeStops]) => {
      const set = new Set<string>()
      for (const s of fgcStops) {
        if (s.wheelchairBoarding) set.add(s.stopId.replace(/\d+$/, ''))
      }
      for (const s of renfeStops) {
        if (s.wheelchairBoarding) set.add(s.stopId)
      }
      accessibleCache = set
      accessibleInflight = null
      return set
    })
    .catch(err => { accessibleInflight = null; throw err })
  return accessibleInflight
}

// ---- public: station list ----------------------------------------------

export async function getStations(): Promise<PlannerStation[]> {
  const data = await getTimetable()
  return [...data.stationNames.entries()]
    .map(([code, name]) => ({
      code,
      name,
      operator: data.stationOperators.get(code) ?? 'fgc',
      lines: data.stationLines.get(code) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ca'))
}

// ---- public: station departures board -----------------------------------

export interface Departure {
  line: string
  headsign: string   // trip destination shown on the board
  depTime: number    // scheduled seconds since midnight
  tripId: number
  isLastService?: boolean
}

// The next scheduled departures leaving `stationCode` at or after
// `afterSeconds`. A trip departs a station via exactly one connection whose
// `fromParent` is that station, and the connection list is already sorted by
// departure time, so we just take the first `count` such connections.
export async function getDepartures(
  stationCode: string,
  afterSeconds: number,
  count = 8,
  date?: string,
): Promise<Departure[]> {
  const data = await getTimetable(date)
  if (!data.stationNames.has(stationCode)) return []

  const out: Departure[] = []

  // 1. If after midnight (00:00 to 04:00), first collect remaining late-night departures (depTime >= 86400)
  if (afterSeconds < 4 * 3600) {
    const lateAfter = afterSeconds + 86400
    for (const c of data.connections) {
      if (c.depTime < lateAfter) continue
      if (c.fromParent !== stationCode) continue
      out.push({ line: c.line, headsign: c.headsign, depTime: c.depTime, tripId: c.tripId })
      if (out.length >= count) break
    }
  }

  // 2. Fill remaining slots with regular/morning departures
  const startAfter = afterSeconds < 4 * 3600 && out.length > 0 ? 0 : afterSeconds
  for (const c of data.connections) {
    if (out.length >= count) break
    if (afterSeconds < 4 * 3600 && c.depTime >= 86400) continue
    if (c.depTime < startAfter) continue
    if (c.fromParent !== stationCode) continue
    out.push({ line: c.line, headsign: c.headsign, depTime: c.depTime, tripId: c.tripId })
  }

  // Check if any late departure is the last one of the day for its line & destination
  for (const d of out) {
    if (d.depTime >= 86400) {
      const hasLater = data.connections.some(
        c => c.fromParent === stationCode && c.line === d.line && c.headsign === d.headsign && c.depTime > d.depTime && c.depTime >= 86400
      )
      if (!hasLater) {
        d.isLastService = true
      }
    } else if (d.depTime >= 21 * 3600) {
      const hasLater = data.connections.some(
        c => c.fromParent === stationCode && c.line === d.line && c.headsign === d.headsign && c.depTime > d.depTime
      )
      if (!hasLater) {
        d.isLastService = true
      }
    }
  }

  return out
}

// ---- public: journey planning (CSA) -------------------------------------

// Penalty (seconds) added per boarding so the search prefers staying on one
// train over hopping between parallel services on the same corridor. A change
// only "wins" if it saves more than this much time. Set high (20 min) because
// FGC corridors run several parallel lines; without a strong bias the
// earliest-arrival scan produces absurd "hop every other stop" itineraries.
const TRANSFER_PENALTY = 1200

// Extra ranking cost (seconds-equivalent) charged for changing trains at a
// station that isn't step-free, when a step-free route was requested. Large
// enough to reroute through an accessible interchange when a reasonable one
// exists, but finite so a route is still returned when every interchange on
// the corridor is inaccessible (better a plan with a warning than none).
const INACCESSIBLE_INTERCHANGE_PENALTY = 3600

interface Label {
  arr: number               // best known real arrival time at this stop
  cost: number              // arr + TRANSFER_PENALTY*transfers + stepFree extra
  transfers: number         // number of boardings used to reach this stop
  extra: number             // accumulated inaccessible-interchange penalty
  conn: Connection | null   // last connection ridden to reach it (null = origin or walk)
  boardStop: string | null  // stop where the trip behind `conn` was boarded
  walkFrom?: string | null  // stop we walked from to reach this stop
  walkDuration?: number     // footpath duration in seconds
  walkDescription?: { ca: string; es: string; en: string }
}

interface WalkStep {
  walk: true
  fromParent: string
  toParent: string
  durationSec: number
  description?: { ca: string; es: string; en: string }
}

type PathStep = Connection | WalkStep

function isWalkStep(step: PathStep): step is WalkStep {
  return 'walk' in step && step.walk === true
}

// Reconstruct the connection path by walking transfers backward. Each label
// records the stop where its trip was boarded, so we slice the trip's
// connections between board and alight, then jump to the board stop's label
// (a transfer) and repeat. Footpath steps are recorded as WalkStep.
function reconstruct(
  origin: string,
  dest: string,
  labels: Map<string, Label>,
  tripConns: Map<number, Connection[]>,
): PathStep[] | null {
  const path: PathStep[] = []
  let cur = dest
  const guard = new Set<string>()
  while (cur !== origin) {
    const label = labels.get(cur)
    if (!label) return null
    if (guard.has(cur)) return null // cycle safety — should never happen
    guard.add(cur)

    if (label.walkFrom) {
      path.push({
        walk: true,
        fromParent: label.walkFrom,
        toParent: cur,
        durationSec: label.walkDuration ?? 120,
        description: label.walkDescription,
      })
      cur = label.walkFrom
      continue
    }

    if (!label.conn || label.boardStop == null) return null
    const conns = tripConns.get(label.conn.tripId)
    if (!conns) return null
    // Take the slice of this trip from boardStop up to the alight stop (cur).
    const boardStop = label.boardStop
    const startIdx = conns.findIndex(x => x.fromParent === boardStop)
    const endIdx = conns.findIndex(x => x.toParent === cur)
    if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return null
    for (let i = endIdx; i >= startIdx; i--) path.push(conns[i])
    cur = boardStop
  }
  path.reverse()
  return path
}

// Gap (seconds) below which two consecutive same-line legs are treated as one
// ride. Trip reconstruction sometimes splits a single physical train into
// several phantom trips; those splits show up as second-level gaps. Genuine
// same-line transfers (waiting for a later train) have multi-minute gaps.
const PHANTOM_GAP = 150

function legsFromPath(
  path: PathStep[],
  stationNames: Map<string, string>,
  searchAfterSeconds: number,
): JourneyLeg[] {
  const rawLegs: JourneyLeg[] = []
  let prevArr = searchAfterSeconds

  for (const step of path) {
    if (isWalkStep(step)) {
      const depTime = prevArr
      const arrTime = depTime + step.durationSec
      prevArr = arrTime
      rawLegs.push({
        line: 'WALK',
        headsign: step.description?.ca ?? 'Enllaç a peu',
        fromCode: step.fromParent,
        fromName: stationNames.get(step.fromParent) ?? step.fromParent,
        toCode: step.toParent,
        toName: stationNames.get(step.toParent) ?? step.toParent,
        depTime,
        arrTime,
        intermediateStops: 0,
        operator: 'walk',
        stops: [
          { code: step.fromParent, name: stationNames.get(step.fromParent) ?? step.fromParent, depTime, arrTime: depTime },
          { code: step.toParent, name: stationNames.get(step.toParent) ?? step.toParent, depTime: arrTime, arrTime },
        ],
      })
      continue
    }

    const c = step
    const last = rawLegs[rawLegs.length - 1]
    if (
      last &&
      last.operator !== 'walk' &&
      last.toCode === c.fromParent &&
      last.line === c.line &&
      last.headsign === c.headsign
    ) {
      // same trip continuing — extend the leg
      last.toCode = c.toParent
      last.toName = c.toName
      last.arrTime = c.arrTime
      last.intermediateStops++
      if (last.stops) {
        last.stops.push({
          code: c.toParent,
          name: c.toName,
          depTime: c.arrTime,
          arrTime: c.arrTime,
        })
      }
      prevArr = c.arrTime
    } else {
      rawLegs.push({
        line: c.line,
        headsign: c.headsign,
        fromCode: c.fromParent,
        fromName: c.fromName,
        toCode: c.toParent,
        toName: c.toName,
        depTime: c.depTime,
        arrTime: c.arrTime,
        intermediateStops: 0,
        operator: c.operator ?? 'fgc',
        stops: [
          { code: c.fromParent, name: c.fromName, depTime: c.depTime, arrTime: c.depTime },
          { code: c.toParent, name: c.toName, depTime: c.arrTime, arrTime: c.arrTime },
        ],
      })
      prevArr = c.arrTime
    }
  }

  // Collapse phantom splits: consecutive same-line legs separated by only a
  // few seconds are really one ride that got split during reconstruction.
  const merged: JourneyLeg[] = []
  for (const leg of rawLegs) {
    const prev = merged[merged.length - 1]
    if (
      prev &&
      prev.operator !== 'walk' &&
      leg.operator !== 'walk' &&
      prev.line === leg.line &&
      leg.depTime - prev.arrTime <= PHANTOM_GAP
    ) {
      prev.toCode = leg.toCode
      prev.toName = leg.toName
      prev.arrTime = leg.arrTime
      prev.intermediateStops += leg.intermediateStops + 1
      if (prev.stops && leg.stops) {
        prev.stops.push(...leg.stops.slice(1))
      }
    } else {
      merged.push(leg)
    }
  }

  // If the initial leg is a walk and the second is a train, align the walk departure just-in-time
  if (merged.length >= 2 && merged[0].operator === 'walk' && merged[1].operator !== 'walk') {
    const walkDur = merged[0].arrTime - merged[0].depTime
    merged[0].arrTime = merged[1].depTime
    merged[0].depTime = Math.max(searchAfterSeconds, merged[1].depTime - walkDur)
    if (merged[0].stops && merged[0].stops.length >= 2) {
      merged[0].stops[0].depTime = merged[0].depTime
      merged[0].stops[0].arrTime = merged[0].depTime
      merged[0].stops[1].depTime = merged[0].arrTime
      merged[0].stops[1].arrTime = merged[0].arrTime
    }
  }

  return merged
}

/**
 * Plan the earliest-arrival journey from origin to dest departing at or after
 * `afterSeconds` (seconds since midnight). Uses the Connection Scan Algorithm
 * with a fixed transfer buffer so it doesn't hop between parallel trains.
 */
export async function planJourney(
  originCode: string,
  destCode: string,
  afterSeconds: number,
  lineDelays?: Map<string, number>,
  date?: string,
  stepFree = false,
): Promise<Journey | null> {
  const data = await getTimetable(date)
  if (originCode === destCode) return null
  if (!data.stationNames.has(originCode) || !data.stationNames.has(destCode)) return null

  // Only load the accessible-station set when a step-free route is requested.
  const accessible = stepFree ? await getAccessibleStations() : null

  const labels = new Map<string, Label>()
  labels.set(originCode, {
    arr: afterSeconds,
    cost: afterSeconds,
    transfers: 0,
    extra: 0,
    conn: null,
    boardStop: null,
  })

  // Relax direct footpaths from origin
  const originFootpaths = FOOTPATH_MAP.get(originCode)
  if (originFootpaths) {
    for (const fp of originFootpaths) {
      const arr = afterSeconds + fp.durationSec
      labels.set(fp.to, {
        arr,
        cost: arr,
        transfers: 0,
        extra: 0,
        conn: null,
        boardStop: null,
        walkFrom: originCode,
        walkDuration: fp.durationSec,
        walkDescription: fp.description,
      })
    }
  }

  // Per-trip carried state: the cheapest way found to be riding this trip —
  // the boarding label's transfer count, the stop where we boarded, and the
  // step-free penalty accumulated on the way to that boarding.
  const tripState = new Map<number, { transfers: number; boardStop: string; extra: number }>()

  const labelAt = (s: string) => labels.get(s)
  const costAt = (s: string) => labels.get(s)?.cost ?? Infinity
  // Latest departure worth scanning: once a connection departs after the best
  // destination arrival, it can never be part of an earlier-arriving journey.
  let bestDestArr = Infinity
  let bestDestCost = Infinity

  for (const c of data.connections) {
    if (c.depTime < afterSeconds) continue
    if (c.depTime > bestDestArr) break // nothing later can reach the dest sooner

    const fromLabel = labelAt(c.fromParent)
    let riding = tripState.get(c.tripId)

    // Can we board this connection by transferring here?
    if (fromLabel) {
      const needBuffer = (c.fromParent === originCode || fromLabel.walkFrom != null) ? 0 : TRANSFER_SECONDS
      if (fromLabel.arr + needBuffer <= c.depTime) {
        const boardTransfers = fromLabel.transfers + 1
        // Charge the step-free penalty when this boarding is a genuine
        // interchange (not the origin) at a station without step-free access.
        const interchangePenalty =
          accessible && c.fromParent !== originCode && !accessible.has(c.fromParent)
            ? INACCESSIBLE_INTERCHANGE_PENALTY : 0
        const boardExtra = fromLabel.extra + interchangePenalty
        if (!riding || boardTransfers < riding.transfers ||
            (boardTransfers === riding.transfers && boardExtra < riding.extra)) {
          riding = { transfers: boardTransfers, boardStop: c.fromParent, extra: boardExtra }
          tripState.set(c.tripId, riding)
        }
      }
    }

    if (!riding) continue // not on this trip yet

    const arr = c.arrTime
    const cost = arr + TRANSFER_PENALTY * riding.transfers + riding.extra
    if (cost < costAt(c.toParent)) {
      labels.set(c.toParent, {
        arr,
        cost,
        transfers: riding.transfers,
        extra: riding.extra,
        conn: c,
        boardStop: riding.boardStop,
      })
      if (c.toParent === destCode) {
        if (cost < bestDestCost) bestDestCost = cost
        if (arr < bestDestArr) bestDestArr = arr
      }

      // Relax footpaths from c.toParent
      const outFootpaths = FOOTPATH_MAP.get(c.toParent)
      if (outFootpaths) {
        for (const fp of outFootpaths) {
          const fpArr = arr + fp.durationSec
          const fpCost = fpArr + TRANSFER_PENALTY * riding.transfers + riding.extra
          if (fpCost < costAt(fp.to)) {
            labels.set(fp.to, {
              arr: fpArr,
              cost: fpCost,
              transfers: riding.transfers,
              extra: riding.extra,
              conn: null,
              boardStop: null,
              walkFrom: c.toParent,
              walkDuration: fp.durationSec,
              walkDescription: fp.description,
            })
            if (fp.to === destCode) {
              if (fpCost < bestDestCost) bestDestCost = fpCost
              if (fpArr < bestDestArr) bestDestArr = fpArr
            }
          }
        }
      }
    }
  }

  const path = reconstruct(originCode, destCode, labels, data.tripConns)
  if (!path || path.length === 0) return null

  const legs = legsFromPath(path, data.stationNames, afterSeconds)
  if (legs.length === 0) return null

  const depTime = legs[0].depTime
  const arrTime = legs[legs.length - 1].arrTime
  const firstTrainLeg = legs.find(l => l.operator !== 'walk')
  const liveDelayMin = firstTrainLeg ? lineDelays?.get(firstTrainLeg.line) : undefined
  const trainLegs = legs.filter(l => l.operator !== 'walk')
  const transfers = Math.max(0, trainLegs.length - 1)

  // When step-free was requested, report whether every interchange (each leg
  // after the first boards at its `fromCode`) is actually step-free.
  const stepFreeOk = accessible
    ? legs.slice(1).every(l => accessible.has(l.fromCode))
    : undefined
  const journey: Journey = {
    legs,
    depTime,
    arrTime,
    durationMin: Math.round((arrTime - depTime) / 60),
    transfers,
    ...(liveDelayMin ? { liveDelayMin } : {}),
    ...(stepFreeOk !== undefined ? { stepFree: stepFreeOk } : {}),
  }
  journey.fare = computeJourneyFare(journey)
  return journey
}

/**
 * Plan the next `count` departures (each leaving after the previous one's
 * first departure) from origin to dest at or after `afterSeconds`.
 */
export async function planJourneys(
  originCode: string,
  destCode: string,
  afterSeconds: number,
  count = 4,
  lineDelays?: Map<string, number>,
  date?: string,
  stepFree = false,
): Promise<Journey[]> {
  const journeys: Journey[] = []

  // In GTFS timetables (both FGC and Rodalies), service days run past midnight
  // until ~03:00, with post-midnight departures scheduled at depTime >= 86400 (e.g. 24:47:00).
  // When planning after midnight (00:00 to 04:00), first scan for remaining late-night departures (depTime >= 86400).
  if (afterSeconds < 4 * 3600) {
    let lateAfter = afterSeconds + 86400
    while (journeys.length < count) {
      const j = await planJourney(originCode, destCode, lateAfter, lineDelays, date, stepFree)
      if (!j) break
      journeys.push(j)
      const firstTrain = j.legs.find(l => l.operator !== 'walk')
      lateAfter = (firstTrain ? firstTrain.depTime : j.depTime) + 1
    }
  }

  // Scan remaining slots (or daytime requests) from the regular schedule
  let after = journeys.length > 0 ? 0 : afterSeconds
  while (journeys.length < count) {
    const j = await planJourney(originCode, destCode, after, lineDelays, date, stepFree)
    if (!j) break
    journeys.push(j)
    const firstTrain = j.legs.find(l => l.operator !== 'walk')
    after = (firstTrain ? firstTrain.depTime : j.depTime) + 1
  }

  // Detect if any journey is the last service of the service day
  for (let i = 0; i < journeys.length; i++) {
    const j = journeys[i]
    if (j.depTime >= 86400) {
      // Late night departure: last service if the next journey is in the morning (< 86400) or nonexistent
      const nextJ = journeys[i + 1]
      if (!nextJ || nextJ.depTime < 86400) {
        j.isLastService = true
      }
    } else if (j.depTime >= 20.5 * 3600 && i === journeys.length - 1) {
      const firstTrain = j.legs.find(l => l.operator !== 'walk')
      const nextAfter = (firstTrain ? firstTrain.depTime : j.depTime) + 1
      const later = await planJourney(originCode, destCode, nextAfter, lineDelays, date, stepFree)
      if (!later || later.depTime < j.depTime) {
        j.isLastService = true
      }
    }
  }

  return journeys
}
