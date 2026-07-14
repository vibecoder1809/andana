#!/usr/bin/env node
// Andana · reliability capture
//
// Snapshots the current median delay per line and appends it to Supabase.
// Runs on a schedule (see .github/workflows/capture-delays.yml). Self-contained
// — no app imports — so it works in a bare `node` on a CI runner.
//
// It re-derives the same join the app's fetchLineDelays() does: posicionament
// records (record id -> line) joined to the trip-updates GTFS-RT feed
// (tripId -> delay), median per line. Unlike the app, it keeps ALL lines with
// running trains, including on-time ones (median 0) — "usually on time" is
// signal worth recording.

import Gtfs from 'gtfs-realtime-bindings'

const BASE = 'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// fetch with a few retries — the FGC portal returns the odd transient 4xx/5xx,
// and a best-effort snapshot shouldn't fail over one blip.
async function fetchRetry(url, label, attempts = 3) {
  let last
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
      last = new Error(`${label} HTTP ${res.status}`)
    } catch (e) { last = e }
    if (i < attempts) await new Promise(r => setTimeout(r, i * 1500))
  }
  throw last
}

// record id -> line, paging the portal's 100-row cap.
async function fetchPositions() {
  const byId = new Map()
  for (let offset = 0; ; offset += 100) {
    const res = await fetchRetry(`${BASE}/posicionament-dels-trens/records?select=id,lin&limit=100&offset=${offset}`, 'positions')
    const { results, total_count } = await res.json()
    for (const r of results) if (r.id && r.lin) byId.set(r.id, r.lin)
    if (results.length === 0 || offset + 100 >= total_count) break
  }
  return byId
}

// tripId -> delay minutes, from the trip-updates GTFS-RT protobuf feed.
async function fetchDelays() {
  const rec = await fetchRetry(`${BASE}/trip-updates-gtfs_realtime/records?limit=1`, 'trip-updates record')
  const pbUrl = (await rec.json()).results?.[0]?.file?.url
  if (!pbUrl) { console.warn('trip-updates feed has no .pb file; no delays this cycle'); return new Map() }
  const pb = await fetchRetry(pbUrl, 'trip-updates .pb')

  const { transit_realtime } = Gtfs
  const msg = transit_realtime.FeedMessage.decode(new Uint8Array(await pb.arrayBuffer()))
  // int64 `delay`/`time` fields decode as Longs; coerce to plain numbers.
  const feed = transit_realtime.FeedMessage.toObject(msg, { longs: Number })

  const byTrip = new Map()
  for (const e of feed.entity) {
    const tu = e.tripUpdate
    const tripId = tu?.trip?.tripId
    if (!tripId) continue
    let delay = 0
    for (const stu of tu.stopTimeUpdate ?? []) {
      const d = stu.arrival?.delay ?? stu.departure?.delay
      if (d != null && d !== 0) { delay = Math.round(d / 60); break }
    }
    byTrip.set(tripId, delay)
  }
  return byTrip
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function main() {
  let positions, delays
  try {
    [positions, delays] = await Promise.all([fetchPositions(), fetchDelays()])
  } catch (err) {
    // The FGC feed is a flaky external dependency and a missed 10-min snapshot
    // is harmless. Skip this cycle as a success rather than failing the job
    // (and emailing) — only real problems, like a bad insert below, stay loud.
    console.warn('skipping cycle — FGC feed unavailable:', err.message)
    return
  }

  const byLine = new Map()
  for (const [id, line] of positions) {
    const d = delays.get(id)
    if (d == null) continue
    const list = byLine.get(line)
    if (list) list.push(d)
    else byLine.set(line, [d])
  }

  const rows = []
  for (const [line, list] of byLine) {
    if (list.length > 0) rows.push({ line, delay_min: median(list), sample_count: list.length })
  }
  console.log(`captured ${rows.length} lines from ${positions.size} trains`)
  if (rows.length === 0) return

  const res = await fetch(`${SUPABASE_URL}/rest/v1/delay_observations`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    console.error('insert failed', res.status, await res.text())
    process.exit(1)
  }
  console.log(`inserted ${rows.length} observations`)
}

main().catch(err => { console.error(err); process.exit(1) })
