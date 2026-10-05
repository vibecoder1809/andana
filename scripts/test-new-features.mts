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

console.log('ALL NEW FEATURES VALIDATED SUCCESSFULLY!')
