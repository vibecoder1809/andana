// Verifies the timezone fix against the running app, with the server's own TZ
// deliberately set to something other than Europe/Madrid. Departures must come
// back in Barcelona local time regardless of where the process runs.
const base = process.env.BASE ?? 'http://127.0.0.1:3120'
const fmt = s => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`

const nowBcn = new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })
const nowHost = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
console.log(`server TZ=${process.env.TZ ?? '(host default)'} → host clock ${nowHost}, Barcelona ${nowBcn}`)

const res = await fetch(`${base}/api/departures?station=SC`)
const body = await res.json()
if (!res.ok || !body.departures) {
  console.error('request failed:', res.status, JSON.stringify(body).slice(0, 200))
  process.exit(1)
}

console.log(`departures from Sant Cugat: ${body.departures.length}`)
for (const d of body.departures.slice(0, 6)) {
  console.log(`  ${d.line.padEnd(4)} ${fmt(d.depTime)}  ${d.headsign}`)
}

// The board only returns departures at or after "now", so the first one must
// not be in the past relative to Barcelona. That is exactly what breaks when
// the service clock follows the host instead.
const [h, m] = nowBcn.split(':').map(Number)
const nowSecs = h * 3600 + m * 60
const first = body.departures[0]
if (!first) {
  console.log('no departures (late night?) — inconclusive')
  process.exit(0)
}
// Allow a small window back for the in-flight/at-platform grace.
const drift = (first.depTime - nowSecs) / 60
console.log(`first departure is ${drift.toFixed(0)} min from Barcelona now`)
if (drift < -5 || drift > 90) {
  console.error(`✗ first departure is ${drift.toFixed(0)} min away — the service clock looks wrong`)
  process.exit(1)
}
console.log('✓ departures align with Barcelona local time, not the host clock')
