// Minimal runtime guards for upstream (FGC portal) data. A TS generic cast at
// the fetch boundary doesn't survive a real schema drift — a renamed or
// missing field just becomes `undefined`/NaN and propagates silently into the
// map or the CSA planner. The couple of fields that would otherwise do that
// get checked here instead.

export function finiteNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
