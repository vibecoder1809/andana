import assert from 'node:assert/strict'
import { normalizeSearchText, matchesSearch, startsWithSearch } from '../src/lib/searchUtils.ts'
import { findDirectMetroConnections } from '../src/lib/metroInterchanges.ts'
import { isNightRestHours } from '../src/lib/serviceTime.ts'

console.log('Testing search normalization and accent insensitivity...')
assert.equal(normalizeSearchText('Rubí'), 'rubi')
assert.equal(normalizeSearchText('rubi'), 'rubi')
assert.equal(matchesSearch('Rubí', 'rubi'), true)
assert.equal(matchesSearch('Sarrià', 'sarria'), true)
assert.equal(matchesSearch('Plaça de Catalunya', 'placa'), true)
assert.equal(matchesSearch('Gràcia', 'gracia'), true)
assert.equal(startsWithSearch('Rubí', 'rub'), true)
console.log('✓ All searchUtils checks passed')

console.log('Testing direct metro connections between hubs...')
const santsEspanya = findDirectMetroConnections('PE', '71801')
assert.ok(santsEspanya.some(m => m.line === 'L3'), 'PE and Sants 71801 must share L3')
console.log('✓ Sants and Espanya share L3:', santsEspanya.map(m => m.line))

const catalunyaEspanya = findDirectMetroConnections('PE', 'PC')
assert.ok(catalunyaEspanya.some(m => m.line === 'L1'), 'PE and PC share L1')
assert.ok(catalunyaEspanya.some(m => m.line === 'L3'), 'PE and PC share L3')
console.log('✓ Catalunya and Espanya share L1 & L3:', catalunyaEspanya.map(m => m.line))

console.log('Testing night rest hours...')
// 03:00 local time
const nightTime = new Date('2026-10-05T03:00:00+02:00')
assert.equal(isNightRestHours(nightTime), true, '03:00 is night rest')

// 12:00 local time
const dayTime = new Date('2026-10-05T12:00:00+02:00')
assert.equal(isNightRestHours(dayTime), false, '12:00 is not night rest')
console.log('✓ Night rest hours logic passed')

console.log('Testing favorite station alert matching...')
import { matchStation, getBaseStationCode } from '../src/lib/savedStations.ts'
const favStation = { stopId: 'PC', name: 'Pl. Catalunya', code: 'PC', operator: 'fgc', lines: ['L6', 'L7', 'S1', 'S2'] }
assert.equal(matchStation(favStation, 'PC'), true, 'PC matches stopId PC')
assert.equal(matchStation(favStation, 'Plaça Catalunya'), true, 'Name matches normalized')
assert.equal(getBaseStationCode('PC1', 'fgc'), 'PC', 'Base station code strips trailing digits')
assert.equal(getBaseStationCode('71801', 'renfe'), '71801', 'Renfe code preserves numeric id')
console.log('✓ Favorite station matching tests passed')

console.log('Testing school commute hours...')
import { isSchoolCommuteHours } from '../src/lib/serviceTime.ts'
// Monday 2026-10-05 08:15 (in morning commute 07:30 - 09:00)
assert.equal(isSchoolCommuteHours(new Date('2026-10-05T08:15:00+02:00')), true, 'Mon 08:15 is school commute hours')
// Monday 2026-10-05 14:15 (in afternoon commute 13:30 - 15:00)
assert.equal(isSchoolCommuteHours(new Date('2026-10-05T14:15:00+02:00')), true, 'Mon 14:15 is school commute hours')
// Monday 2026-10-05 03:00 (night rest)
assert.equal(isSchoolCommuteHours(new Date('2026-10-05T03:00:00+02:00')), false, 'Mon 03:00 is not school hours')
// Monday 2026-10-05 11:30 (midday)
assert.equal(isSchoolCommuteHours(new Date('2026-10-05T11:30:00+02:00')), false, 'Mon 11:30 is not school hours')
// Saturday 2026-10-10 08:15 (weekend)
assert.equal(isSchoolCommuteHours(new Date('2026-10-10T08:15:00+02:00')), false, 'Sat 08:15 is not school hours (weekend)')
// Sunday 2026-10-11 14:15 (weekend)
assert.equal(isSchoolCommuteHours(new Date('2026-10-11T14:15:00+02:00')), false, 'Sun 14:15 is not school hours (weekend)')
console.log('Testing post-midnight planner and departures...')
import { planJourneys, getDepartures, formatClock } from '../src/lib/planner.ts'
// Query post-midnight at 00:43 (2580 seconds). In GTFS, late trains have depTime >= 86400.
const nightJourneys = await planJourneys('TR', 'VP', 2580, 4)
assert.ok(nightJourneys.length >= 1, 'Should find at least 1 journey post-midnight')
// The first journey should be the late-night train at 00:47 (89220s)
assert.equal(formatClock(nightJourneys[0].depTime), '00:47', 'First departure should be 00:47')
assert.equal(nightJourneys[0].isLastService, true, '00:47 departure should be flagged as isLastService')

const nightDepartures = await getDepartures('TR', 2580, 4)
assert.ok(nightDepartures.length >= 1, 'Should find departures post-midnight')
assert.equal(formatClock(nightDepartures[0].depTime), '00:47', 'First departure from TR should be 00:47')
assert.equal(nightDepartures[0].isLastService, true, '00:47 departure should be last service')
console.log('✓ Post-midnight timetable planning passed')

console.log('ALL NEW FEATURES VALIDATED SUCCESSFULLY!')
