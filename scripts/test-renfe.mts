import assert from 'node:assert/strict'
import {
  fetchRenfeStations,
  fetchRenfeRoutes,
  fetchRenfeTrains,
  fetchRenfeDepartures,
  fetchRenfeAlerts,
} from '../src/lib/renfe.ts'

async function run() {
  console.log('Testing Renfe live client...')

  const stations = await fetchRenfeStations()
  console.log(`✓ Stations fetched: ${stations.length}`)
  assert.ok(stations.length > 50, 'Should fetch more than 50 Rodalies stations')
  const arc = stations.find(s => s.stopId === '78804')
  assert.ok(arc, 'Should contain Arc de Triomf (78804)')
  console.log(`  Sample station: ${arc.name} (${arc.stopId}) [${arc.lines?.join(', ')}]`)

  const routes = await fetchRenfeRoutes()
  console.log(`✓ Routes fetched: ${routes.length}`)
  assert.ok(routes.length > 5, 'Should fetch Rodalies routes')
  const r4 = routes.find(r => r.shortName === 'R4')
  assert.ok(r4, 'Should contain R4')
  console.log(`  Sample route: ${r4.shortName} color=${r4.color} legs=${r4.geometry?.coordinates.length}`)

  const trains = await fetchRenfeTrains()
  console.log(`✓ Live trains fetched: ${trains.length}`)
  if (trains.length > 0) {
    const t = trains[0]
    console.log(`  Sample live train: ${t.line} #${t.trainNumber} [${t.origin} -> ${t.destination}] status=${t.operationalStatus} delay=${t.delayMinutes}m coords=(${t.lat}, ${t.lng})`)
  }

  const departures = await fetchRenfeDepartures('78804')
  console.log(`✓ Departures for Arc de Triomf: ${departures.length}`)
  if (departures.length > 0) {
    const d = departures[0]
    console.log(`  Sample departure: ${d.line} -> ${d.headsign} depTime=${d.depTime}s delay=${d.delayMin}m track=${d.track}`)
  }

  const alerts = await fetchRenfeAlerts()
  console.log(`✓ Real-time alerts fetched: ${alerts.length}`)
  if (alerts.length > 0) {
    const a = alerts[0]
    console.log(`  Sample alert: [${a.operator}] ${a.header} (lines: ${a.routes.join(', ')})`)
    assert.equal(a.operator, 'renfe')
  }

  console.log('ALL RENFE CLIENT CHECKS PASSED!')
}

run().catch(err => {
  console.error('Renfe client test failed:', err)
  process.exit(1)
})
