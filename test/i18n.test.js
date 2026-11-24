import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { _strings, LANGS } from '../js/i18n.js'

const en = _strings.en
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

test('every language translates every English string with the same placeholders', () => {
  for (const [code] of LANGS) {
    const dict = _strings[code]
    for (const key of Object.keys(en)) {
      assert.ok(dict[key], `${code} is missing ${key}`)
      assert.equal(placeholders(dict[key]), placeholders(en[key]), `${code}.${key} placeholders differ`)
    }
    for (const key of Object.keys(dict)) assert.ok(key in en, `${code} has stray key ${key}`)
  }
})

test('every key the app asks for exists', () => {
  const src = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8')
  const used = new Set([...src.matchAll(/tr\('([\w.]+)'/g)].map((m) => m[1]))
  for (const v of ['one', 'two', 'rain']) {
    used.add(`verdict.${v}.title`).add(`verdict.${v}.body`).add(`chip.${v}`)
  }
  for (const k of ['sunny', 'cloudy', 'rain']) used.add(`sky.${k}`).add(`sky.rule.${k}`)
  for (const k of ['today', 'bottles', 'guide', 'science']) used.add(`nav.${k}`)
  for (let i = 1; i <= 6; i++) used.add(`guide.s${i}.t`).add(`guide.s${i}.b`)
  used.add('guide.s2.yes').add('guide.s2.no')
  for (const key of used) assert.ok(key in en, `app.js uses missing key ${key}`)
})
