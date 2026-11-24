import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  RULES, normalize, evaluate, readyAt, dayOutlook, planDay, focusDay, sunDose, manualReadyAt, firewoodKg,
} from '../js/engine.js'

const H = 3600e3
const DAY = 24 * H
const T0 = Date.UTC(2026, 10, 24) // midnight UTC

// Build an Open-Meteo-shaped response: sunrise 06:00, sunset 18:00 UTC, sine-shaped sunshine.
function fake(days) {
  const raw = {
    timezone: 'UTC', latitude: 0, longitude: 0,
    minutely_15: { time: [], shortwave_radiation: [] },
    hourly: { time: [], cloud_cover: [], precipitation: [] },
    daily: { time: [], sunrise: [], sunset: [], shortwave_radiation_sum: [], precipitation_hours: [] },
  }
  days.forEach((d, i) => {
    const base = T0 + i * DAY
    let mj = 0
    for (let q = 1; q <= 96; q++) {
      const t = base + q * 15 * 60e3
      const mid = t - 7.5 * 60e3
      const x = (mid - base - 6 * H) / (12 * H)
      const ghi = x > 0 && x < 1 ? d.peak * Math.sin(Math.PI * x) : 0
      raw.minutely_15.time.push(t / 1000)
      raw.minutely_15.shortwave_radiation.push(ghi)
      mj += (ghi * 900) / 1e6
    }
    for (let h = 0; h < 24; h++) {
      raw.hourly.time.push((base + h * H) / 1000)
      raw.hourly.cloud_cover.push(d.cloud)
      const wet = (d.rain && h >= 7 && h <= 18) || (d.nightRain && (h <= 5 || h >= 20))
      raw.hourly.precipitation.push(wet ? 1 : 0)
    }
    raw.daily.time.push(base / 1000)
    raw.daily.sunrise.push((base + 6 * H) / 1000)
    raw.daily.sunset.push((base + 18 * H) / 1000)
    raw.daily.shortwave_radiation_sum.push(mj)
    raw.daily.precipitation_hours.push(d.rain || d.nightRain ? 10 : 0)
  })
  return normalize(raw)
}

const sunny = { peak: 1000, cloud: 10 }
const cloudy = { peak: 400, cloud: 80 }
const rainy = { peak: 150, cloud: 100, rain: true }

test('a clear day delivers roughly 7.6 kWh/m²', () => {
  const s = fake([sunny])
  const dose = sunDose(s, T0, T0 + DAY)
  assert.ok(Math.abs(dose - 7.64) < 0.05, `dose ${dose}`)
})

test('bottles out at sunrise on a clear day are ready at noon', () => {
  const s = fake([sunny, sunny])
  const start = T0 + 6 * H
  assert.equal(readyAt(s, start), T0 + 12 * H)
  const ev = evaluate(s, start, T0 + 12 * H)
  assert.ok(ev.ready && ev.checks.dose && ev.checks.daylight && ev.checks.noon)
  assert.equal(evaluate(s, start, T0 + 11.75 * H).ready, false)
})

test('bottles out after the noon hours wait for the next midday', () => {
  const s = fake([sunny, sunny])
  const start = T0 + 13 * H
  const ev = evaluate(s, start, T0 + 18 * H)
  assert.equal(ev.ready, false)
  assert.equal(ev.checks.noon, false)
  assert.ok(ev.dose < RULES.doseTarget)
  assert.equal(readyAt(s, start), T0 + DAY + 12 * H)
})

test('a cloudy sky triggers the two-day rule', () => {
  const s = fake([cloudy, cloudy, cloudy])
  const start = T0 + 6 * H
  const day1 = evaluate(s, start, T0 + 18 * H)
  assert.equal(day1.cloudy, true)
  assert.equal(day1.needNoons, 2)
  assert.equal(day1.ready, false)
  assert.ok(day1.progress < 1)
  assert.equal(readyAt(s, start), T0 + DAY + 12 * H)
})

test('readiness never comes before the data supports it', () => {
  const s = fake([rainy])
  assert.equal(readyAt(s, T0 + 6 * H), null)
})

test('day outlook classifies sunny, cloudy and rainy days', () => {
  const s = fake([sunny, cloudy, rainy])
  assert.deepEqual(s.days.map((d) => dayOutlook(s, d).verdict), ['one', 'two', 'rain'])
})

test('rain that falls only at night does not spoil a sunny day', () => {
  const s = fake([{ ...sunny, nightRain: true }])
  const o = dayOutlook(s, s.days[0])
  assert.equal(o.verdict, 'one')
  assert.equal(o.daylightRainHours, 0)
})

test('a morning-sun, cloudy-afternoon day is a one-day day when the morning suffices', () => {
  // Clear until about 12:30, then overcast: the whole-day mean cloud is over 50 %, but bottles out at
  // sunrise get their dose and midday hours under a clear sky, so one day is enough.
  const s = fake([sunny, sunny])
  for (const h of s.hours) if (h.start >= T0 + 12 * H && h.start < T0 + 24 * H) h.cloud = 100
  const o = dayOutlook(s, s.days[0])
  assert.ok(o.meanCloud > 50)
  assert.equal(o.verdict, 'one')
  assert.equal(planDay(s, s.days[0], T0 + 6 * H).readyIfStart, T0 + 12 * H)
})

test('plan finds the latest start that still finishes before sunset', () => {
  const s = fake([sunny, sunny])
  const plan = planDay(s, s.days[0], T0 + 7 * H)
  assert.equal(plan.latest, T0 + 12 * H)
  assert.ok(plan.latestReady <= s.days[0].sunset)
  assert.equal(plan.readyIfStart, T0 + 13 * H)
})

test('advice switches to tomorrow an hour before sunset', () => {
  const s = fake([sunny, sunny])
  assert.equal(focusDay(s, T0 + 16.5 * H), 0)
  assert.equal(focusDay(s, T0 + 17.5 * H), 1)
})

test('offline fallback follows the Eawag schedule', () => {
  assert.equal(manualReadyAt(0, 'sunny'), 6 * H)
  assert.equal(manualReadyAt(0, 'cloudy'), 48 * H)
  assert.equal(manualReadyAt(0, 'rain'), null)
})

test('firewood estimate is in a plausible range', () => {
  const kg = firewoodKg(1)
  assert.ok(kg > 0.1 && kg < 0.2, `kg ${kg}`)
})

test('real Open-Meteo response for Kisumu normalizes and plans', () => {
  const raw = JSON.parse(readFileSync(new URL('./kisumu.json', import.meta.url)))
  const s = normalize(raw)
  assert.equal(s.tz, 'Africa/Nairobi')
  assert.equal(s.slots.length, 576)
  assert.equal(s.days.length, 6)
  for (const d of s.days) assert.ok(d.sunset - d.sunrise > 11 * H && d.sunset - d.sunrise < 13 * H)
  const now = s.days[2].sunrise + H
  const plan = planDay(s, s.days[2], now)
  assert.ok(plan.readyIfStart > now)
  const t0 = performance.now()
  for (const d of s.days) planDay(s, d, d.sunrise)
  assert.ok(performance.now() - t0 < 1500, 'planning all days is fast enough for a phone')
})
