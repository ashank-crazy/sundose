import test from 'node:test'
import assert from 'node:assert/strict'
import { familyPlan, yearOutlook, yearSummary } from '../js/engine.js'
import { qrMatrix } from '../js/qr.js'

const H = 3600e3
const DAY = 24 * H
const T0 = Date.UTC(2026, 0, 1)

// An archive-shaped (hourly) response: sunrise 06:00, sunset 18:00 UTC.
function archive(days) {
  const raw = {
    timezone: 'UTC',
    utc_offset_seconds: 0,
    hourly: { time: [], shortwave_radiation: [], cloud_cover: [], precipitation: [] },
    daily: { time: [], sunrise: [], sunset: [] },
  }
  days.forEach((d, i) => {
    const base = T0 + i * DAY
    for (let h = 0; h < 24; h++) {
      const mid = base + (h - 0.5) * H // hourly sunlight is the mean of the preceding hour
      const x = (mid - base - 6 * H) / (12 * H)
      raw.hourly.time.push((base + h * H) / 1000)
      raw.hourly.shortwave_radiation.push(d.missing ? null : x > 0 && x < 1 ? d.peak * Math.sin(Math.PI * x) : 0)
      raw.hourly.cloud_cover.push(d.cloud)
      raw.hourly.precipitation.push(d.rain && h >= 7 && h <= 17 ? 1 : 0)
    }
    raw.daily.time.push(base / 1000)
    raw.daily.sunrise.push((base + 6 * H) / 1000)
    raw.daily.sunset.push((base + 18 * H) / 1000)
  })
  return raw
}

test('household plan: 5 people × 2 L in 1.5 L bottles', () => {
  const p = familyPlan({ people: 5, litres: 2, size: 1.5 })
  assert.equal(p.daily, 10)
  assert.equal(p.perDay, 7)
  assert.equal(p.own, 21)
  assert.equal(p.monthLitres, 300)
  assert.ok(p.monthWoodKg > 30 && p.monthWoodKg < 50, `wood ${p.monthWoodKg}`)
  assert.equal(familyPlan({ people: 3, litres: 2, size: 2 }).perDay, 3)
})

test('past year: each day gets the same verdict as a forecast day would', () => {
  const days = yearOutlook(
    archive([
      { peak: 1000, cloud: 10 },
      { peak: 450, cloud: 80 },
      { peak: 150, cloud: 100, rain: true },
      { peak: 1000, cloud: 10, missing: true },
    ]),
  )
  assert.deepEqual(
    days.map((d) => [d.m, d.d, d.v]),
    [
      [0, 1, 'one'],
      [0, 2, 'two'],
      [0, 3, 'rain'],
    ],
  )
  assert.ok(Math.abs(days[0].ghi - 7.6) < 0.2, `ghi ${days[0].ghi}`)
})

test('year summary picks fast, slow and rainy months', () => {
  const mk = (m, v, n) => Array.from({ length: n }, (_, i) => ({ y: 2026, m, d: i + 1, v, ghi: 5 }))
  const days = [
    ...mk(0, 'one', 30),
    ...mk(1, 'two', 20),
    ...mk(1, 'one', 8),
    ...mk(2, 'rain', 10),
    ...mk(2, 'two', 21),
  ]
  const s = yearSummary(days)
  assert.equal(s.total.n, 89)
  assert.deepEqual(s.fast.map((m) => m.m), [0])
  assert.deepEqual(s.slow.map((m) => m.m), [1, 2])
  assert.deepEqual(s.wet.map((m) => m.m), [2])
})

test('QR codes have the right size and finder patterns', () => {
  const url = 'https://ashank-crazy.github.io/sundose/?p=-0.10%2C34.76%2CKisumu'
  const m = qrMatrix(url)
  assert.equal(m.length, 37) // version 5 at level M
  const finder = (x0, y0) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3))
        assert.equal(m[y0 + y][x0 + x], ring !== 2, `finder at ${x0},${y0}`)
      }
  }
  finder(0, 0)
  finder(30, 0)
  finder(0, 30)
  for (let i = 8; i < 29; i++) assert.equal(m[6][i], i % 2 === 0, 'timing pattern')
  assert.equal(qrMatrix('A').length, 21)
  assert.throws(() => qrMatrix('x'.repeat(400)))
})
