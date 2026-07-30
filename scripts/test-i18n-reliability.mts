// Checks that every reliability string exists in all three languages and
// interpolates without producing placeholder residue. The app hard-requires a
// key per visible string in ca/es/en (see AGENTS.md), and these are the only
// strings assembled from numbers at runtime, so a missing arg would ship as a
// literal "undefined" in the UI.
//
//   node --experimental-strip-types scripts/test-i18n-reliability.mts

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/lib/i18n.tsx', 'utf8')

const LANGS = ['ca', 'es', 'en'] as const

// Keys added for the reliability surface, with the args they're called with.
const CASES: { key: string; args: (string | number)[] }[] = [
  { key: 'usuallyLabel',       args: [] },
  { key: 'typicallyLate',      args: ['L6', '4.2', '08:00'] },
  { key: 'typicallyOnTime',    args: ['R5', '14:30'] },
  { key: 'typicalShortLate',   args: ['3'] },
  { key: 'typicalShortOnTime', args: [] },
  { key: 'worstCase',          args: ['11'] },
  { key: 'basedOnHistory',     args: [140] },
  { key: 'historyTitle',       args: [] },
  { key: 'noHistoryYet',       args: [] },
]

let checks = 0
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); checks++ }

// The dictionary lives in a 'use client' TSX module, so rather than importing
// it (which would drag in React), assert structurally against the source: every
// key must be present and carry all three language tags.
for (const { key } of CASES) {
  const at = src.indexOf(`\n  ${key}:`)
  ok(at > 0, `${key} is defined`)
  // The entry runs until the next top-level key or the dict's end.
  const rest = src.slice(at + 1)
  const end = rest.search(/\n  [a-zA-Z]+:\s|\n\} as const/)
  const entry = rest.slice(0, end > 0 ? end : rest.length)
  for (const lang of LANGS) {
    ok(new RegExp(`\\b${lang}:`).test(entry), `${key} has ${lang}`)
  }
}

// Now exercise the real runtime behaviour by evaluating each entry's three
// language values and calling them with the args the components pass.
for (const { key, args } of CASES) {
  for (const lang of LANGS) {
    const value = lookup(src, key, lang)
    const out: string = typeof value === 'function'
      ? (value as (...a: unknown[]) => string)(...args)
      : String(value)
    ok(typeof out === 'string' && out.length > 0, `${key}.${lang} renders`)
    ok(!out.includes('undefined'), `${key}.${lang} has no undefined arg`)
    ok(!out.includes('[object'), `${key}.${lang} has no stringified object`)
    for (const a of args) {
      ok(out.includes(String(a)), `${key}.${lang} interpolates ${a}`)
    }
  }
}

// Extract and evaluate a single `lang` value out of a dictionary entry.
function lookup(source: string, key: string, lang: string): unknown {
  const at = source.indexOf(`\n  ${key}:`)
  const rest = source.slice(at + 1)
  const end = rest.search(/\n  [a-zA-Z]+:\s|\n\} as const/)
  const entry = rest.slice(0, end > 0 ? end : rest.length)

  const start = entry.search(new RegExp(`\\b${lang}:\\s*`))
  assert.ok(start >= 0, `${key}.${lang} present`)
  let expr = entry.slice(start).replace(new RegExp(`^\\b${lang}:\\s*`), '')

  // Take the balanced expression up to the comma that ends this value.
  let depth = 0, quote: string | null = null, i = 0
  for (; i < expr.length; i++) {
    const c = expr[i]
    if (quote) {
      if (c === '\\') { i++; continue }
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) { if (depth === 0) break; depth-- }
    else if (c === ',' && depth === 0) break
  }
  expr = expr.slice(0, i).trim()

  // Strip the TS annotations so plain JS eval can handle the arrow functions.
  const js = expr
    .replace(/\(([^)]*)\)\s*=>/, (_m, params: string) => {
      const bare = params.split(',').map(p => p.split(':')[0].trim()).filter(Boolean).join(', ')
      return `(${bare}) =>`
    })
  return (0, eval)(`(${js})`)
}

console.log(`i18n reliability: ${checks} checks passed`)
