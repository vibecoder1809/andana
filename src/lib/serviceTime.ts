// The FGC service clock.
//
// Timetables, departure boards and "leave now" plans are all expressed in local
// Barcelona time. Deriving that from the server's own clock (`new Date()`
// .getHours()) is wrong the moment the app runs anywhere but Europe/Madrid —
// on a UTC host (Vercel's default) every departure shifts by 1-2 hours and the
// service day rolls over at the wrong instant. So the zone is pinned explicitly
// rather than assumed.

const ZONE = 'Europe/Madrid'

// Intl formatting is not cheap and these run per request; one formatter is
// reused rather than constructed each call.
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
})

interface ZonedParts {
  year: number; month: number; day: number
  hour: number; minute: number; second: number
}

function zoned(at: Date): ZonedParts {
  const out: Record<string, number> = {}
  for (const p of parts.formatToParts(at)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  // `hour12: false` renders midnight as 24 in some ICU versions; normalise.
  if (out.hour === 24) out.hour = 0
  return out as unknown as ZonedParts
}

/** Current FGC service date as `YYYY-MM-DD` in Europe/Madrid. */
export function serviceDate(at: Date = new Date()): string {
  const { year, month, day } = zoned(at)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Seconds since local midnight in Europe/Madrid — the units the planner's
 * `depTime`/`arrTime` use.
 */
export function serviceSeconds(at: Date = new Date()): number {
  const { hour, minute, second } = zoned(at)
  return hour * 3600 + minute * 60 + second
}

/** Minutes since local midnight in Europe/Madrid. */
export function serviceMinutes(at: Date = new Date()): number {
  const { hour, minute } = zoned(at)
  return hour * 60 + minute
}

/**
 * Day type used by the reliability aggregation (weekend = Sat/Sun **in
 * Barcelona**, which can differ from the server's own weekday near midnight).
 */
export function serviceDayType(at: Date = new Date()): 'weekday' | 'weekend' {
  const { year, month, day } = zoned(at)
  // Reconstruct the local calendar date as UTC so getUTCDay() reads the
  // Barcelona weekday regardless of where this runs.
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday'
}

/** `YYYY-MM-DD` for `offset` days from today, in Europe/Madrid. */
export function serviceDatePlus(offset: number, at: Date = new Date()): string {
  const { year, month, day } = zoned(at)
  const d = new Date(Date.UTC(year, month - 1, day + offset))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * `YYYY-MM-DD` for `offset` days from a given service-date string. Pure date
 * arithmetic anchored on the string itself (no timezone lookup, no dependency
 * on the real clock) — used to bound a cache window relative to an already-
 * resolved "today", not to derive "today" itself.
 */
export function addServiceDays(date: string, offset: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day + offset))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** True if `date` falls within `[today, today + maxDaysAhead]`. */
export function isWithinPlanWindow(date: string, today: string, maxDaysAhead: number): boolean {
  return date >= today && date <= addServiceDays(today, maxDaysAhead)
}
