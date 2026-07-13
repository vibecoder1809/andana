// Polyline geometry helpers shared by the train interpolation animation and the
// trip-planner path drawing. All coordinates are [lng, lat] (GeoJSON order).

const DEG2RAD = Math.PI / 180
const EARTH_R = 6_371_000 // metres

export function haversine(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * DEG2RAD
  const dLng = (b[0] - a[0]) * DEG2RAD
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(a[1] * DEG2RAD) * Math.cos(b[1] * DEG2RAD) * sinLng * sinLng
  return 2 * EARTH_R * Math.asin(Math.sqrt(h))
}

// Nearest item to a lat/lng from a list of things carrying lat/lng. Generic so
// it works for Stops (or anything positional) without coupling geometry to app
// types. Straight-line (haversine) distance — fine at city scale.
export function nearestByLatLng<T extends { lat: number; lng: number }>(
  lat: number,
  lng: number,
  items: T[],
): T | null {
  let best: T | null = null
  let bestDist = Infinity
  for (const it of items) {
    const d = haversine([lng, lat], [it.lng, it.lat])
    if (d < bestDist) { bestDist = d; best = it }
  }
  return best
}

export interface Polyline {
  pts: [number, number][]   // [lng, lat]
  cumDist: number[]         // cumulative metres from pts[0], length === pts.length
  totalLen: number
}

export function buildPolyline(coords: number[][][]): Polyline | null {
  // Flatten MultiLineString segments into one continuous path.
  // Adjacent segments that don't share an endpoint get a straight join.
  if (!coords.length) return null
  const pts: [number, number][] = []

  for (const seg of coords) {
    if (!seg.length) continue
    const start = seg[0] as [number, number]
    // If pts is non-empty and the last point matches this segment's start, skip duplicate
    if (pts.length > 0) {
      const last = pts[pts.length - 1]
      if (Math.abs(last[0] - start[0]) > 1e-7 || Math.abs(last[1] - start[1]) > 1e-7) {
        pts.push(start)
      }
    } else {
      pts.push(start)
    }
    for (let i = 1; i < seg.length; i++) {
      pts.push(seg[i] as [number, number])
    }
  }

  if (pts.length < 2) return null

  const cumDist: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    cumDist.push(cumDist[i - 1] + haversine(pts[i - 1], pts[i]))
  }

  return { pts, cumDist, totalLen: cumDist[cumDist.length - 1] }
}

export function positionAtDistance(pl: Polyline, dist: number): [number, number] {
  const clamped = Math.max(0, Math.min(dist, pl.totalLen))
  // Binary search for the segment containing `clamped`
  let lo = 0, hi = pl.cumDist.length - 2
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (pl.cumDist[mid + 1] < clamped) lo = mid + 1
    else hi = mid
  }
  const segLen = pl.cumDist[lo + 1] - pl.cumDist[lo]
  const t = segLen > 0 ? (clamped - pl.cumDist[lo]) / segLen : 0
  const a = pl.pts[lo], b = pl.pts[lo + 1]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

// Project a point onto the polyline, return distance along it (metres).
export function projectOntoPolyline(pt: [number, number], pl: Polyline): number {
  let bestDist = Infinity
  let bestAlong = 0

  for (let i = 0; i < pl.pts.length - 1; i++) {
    const a = pl.pts[i], b = pl.pts[i + 1]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const lenSq = dx * dx + dy * dy
    let t = 0
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / lenSq))
    }
    const cx = a[0] + t * dx, cy = a[1] + t * dy
    const d2 = (pt[0] - cx) ** 2 + (pt[1] - cy) ** 2
    if (d2 < bestDist) {
      bestDist = d2
      bestAlong = pl.cumDist[i] + t * haversine(a, b)
    }
  }

  return bestAlong
}

// Return the sub-path of `pl` between two points projected onto it, as an
// ordered list of [lng, lat] coordinates including exact endpoints. Used to
// draw just the travelled portion of a line between two stations.
export function clipPolyline(
  pl: Polyline,
  from: [number, number],
  to: [number, number],
): [number, number][] {
  let dFrom = projectOntoPolyline(from, pl)
  let dTo = projectOntoPolyline(to, pl)
  if (dFrom > dTo) [dFrom, dTo] = [dTo, dFrom]

  const out: [number, number][] = [positionAtDistance(pl, dFrom)]
  // Include every original vertex strictly between the two cut points so the
  // clipped path keeps the line's real shape, not just a straight chord.
  for (let i = 0; i < pl.pts.length; i++) {
    if (pl.cumDist[i] > dFrom && pl.cumDist[i] < dTo) out.push(pl.pts[i])
  }
  out.push(positionAtDistance(pl, dTo))
  return out
}
