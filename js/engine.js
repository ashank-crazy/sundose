// Sundose engine: decides when sunlight has treated a batch of SODIS bottles.
// Pure functions only (no DOM, no network) so the same code runs in the app and in tests.
//
// A batch is ready when all three hold for the time it has spent outside:
//   1. Sun dose      ≥ 3.0 kWh/m² of global sunlight (≈ 500 W/m² sustained for 6 hours, the
//                      classic SODIS intensity rule of thumb)
//   2. Daylight      ≥ 6 hours (Eawag SODIS manual: "at least 6 hours including noon hours")
//   3. Noon hours    the exposure covers at least 2 h of the 4 h midday window around solar noon;
//                      if the sky was more than 50 % cloudy on average, two days' noon hours are
//                      needed (Eawag: two consecutive days when the sky is more than half clouded)

export const RULES = Object.freeze({
  doseTarget: 3.0, // kWh/m²
  minDaylightHours: 6,
  cloudyAbove: 50, // % mean cloud during exposure → two-day rule
  rainyDayHours: 6, // hours of rain in a day → not a SODIS day
  strongSun: 500, // W/m² reference line
  noonHalfWindow: 2 * 3600e3, // solar noon ± 2 h is "noon hours"
  noonMinOverlap: 2 * 3600e3, // need 2 of those 4 hours
  step: 15 * 60e3,
})

const HOUR = 3600e3

export function overlap(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

// Turn an Open-Meteo response (timeformat=unixtime) into interval lists.
export function normalize(raw) {
  const m = raw.minutely_15
  const h = raw.hourly
  const d = raw.daily
  const slots = []
  for (let i = 0; i < m.time.length; i++) {
    const end = m.time[i] * 1000
    const ghi = m.shortwave_radiation[i]
    if (ghi == null) continue
    slots.push({ start: end - RULES.step, end, ghi })
  }
  const hours = []
  for (let i = 0; i < h.time.length; i++) {
    const t = h.time[i] * 1000
    hours.push({ start: t - HOUR / 2, end: t + HOUR / 2, cloud: h.cloud_cover[i], precip: h.precipitation[i] ?? 0 })
  }
  const days = d.time.map((t, i) => {
    const sunrise = d.sunrise[i] * 1000
    const sunset = d.sunset[i] * 1000
    return {
      date: t * 1000,
      sunrise,
      sunset,
      noon: (sunrise + sunset) / 2,
      ghiSum: d.shortwave_radiation_sum[i] == null ? null : d.shortwave_radiation_sum[i] / 3.6, // MJ → kWh
      rainHours: d.precipitation_hours[i] ?? 0,
    }
  })
  return {
    tz: raw.timezone,
    lat: raw.latitude,
    lon: raw.longitude,
    slots,
    hours,
    days,
    start: slots.length ? slots[0].start : 0,
    end: slots.length ? slots[slots.length - 1].end : 0,
  }
}

// Lower-bound binary search: first index whose interval ends after t.
function firstEndingAfter(list, t) {
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (list[mid].end <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function sunDose(series, t0, t1) {
  let wh = 0
  for (let i = firstEndingAfter(series.slots, t0); i < series.slots.length; i++) {
    const s = series.slots[i]
    if (s.start >= t1) break
    wh += (s.ghi * overlap(s.start, s.end, t0, t1)) / HOUR
  }
  return wh / 1000
}

export function daylightMs(series, t0, t1) {
  let ms = 0
  for (const d of series.days) ms += overlap(d.sunrise, d.sunset, t0, t1)
  return ms
}

export function noonsCovered(series, t0, t1) {
  let n = 0
  for (const d of series.days) {
    const w = overlap(d.noon - RULES.noonHalfWindow, d.noon + RULES.noonHalfWindow, t0, t1)
    if (w >= RULES.noonMinOverlap - 1) n++
  }
  return n
}

// Daylight-weighted mean cloud cover and rainy daylight hours during [t0, t1].
export function skyDuring(series, t0, t1) {
  let weight = 0
  let cloud = 0
  let rainMs = 0
  for (let i = firstEndingAfter(series.hours, t0); i < series.hours.length; i++) {
    const h = series.hours[i]
    if (h.start >= t1) break
    for (const d of series.days) {
      const a = Math.max(h.start, t0, d.sunrise)
      const b = Math.min(h.end, t1, d.sunset)
      if (b <= a) continue
      if (h.cloud != null) {
        weight += b - a
        cloud += h.cloud * (b - a)
      }
      if (h.precip >= 0.2) rainMs += b - a
    }
  }
  return { meanCloud: weight ? cloud / weight : null, rainHours: rainMs / HOUR }
}

export function evaluate(series, t0, t1) {
  const end = Math.min(t1, series.end)
  const dose = end > t0 ? sunDose(series, t0, end) : 0
  const daylightH = end > t0 ? daylightMs(series, t0, end) / HOUR : 0
  const noons = end > t0 ? noonsCovered(series, t0, end) : 0
  const { meanCloud, rainHours } = end > t0 ? skyDuring(series, t0, end) : { meanCloud: null, rainHours: 0 }
  const cloudy = meanCloud != null && meanCloud > RULES.cloudyAbove
  const needNoons = cloudy ? 2 : 1
  const checks = {
    dose: dose >= RULES.doseTarget,
    daylight: daylightH >= RULES.minDaylightHours,
    noon: noons >= needNoons,
  }
  const ready = checks.dose && checks.daylight && checks.noon
  const partial = Math.min(dose / RULES.doseTarget, daylightH / RULES.minDaylightHours, 1)
  const progress = ready ? 1 : Math.min(partial, checks.dose && checks.daylight ? 0.95 : 0.99)
  return { dose, daylightH, noons, needNoons, meanCloud, cloudy, rainHours, checks, ready, progress }
}

// First moment (on the 15-minute grid) at which a batch started at t0 becomes ready, or null if the
// forecast runs out first.
export function readyAt(series, t0, from = t0) {
  const step = RULES.step
  let t = Math.max(from, t0)
  t = Math.ceil(t / step) * step
  for (; t <= series.end; t += step) {
    if (evaluate(series, t0, t).ready) return t
  }
  return null
}

// What kind of SODIS day is it? Decided with the same rules as a batch, so the label never
// contradicts the advice next to it:
//   'one'  — bottles put out at sunrise would be ready by sunset
//   'two'  — they would not (cloud or weak sun): leave bottles two days
//   'rain' — 6+ hours of rain while the sun is up: SODIS is unreliable, use rainwater or boil
export function dayOutlook(series, day) {
  // Only rain while the sun is up matters: a night-time shower doesn't stop SODIS.
  const { meanCloud, rainHours } = skyDuring(series, day.sunrise, day.sunset)
  const ghi = day.ghiSum ?? sunDose(series, day.date, day.date + 24 * HOUR)
  const sameDay = readyAt(series, day.sunrise)
  let verdict = 'two'
  if (rainHours >= RULES.rainyDayHours) verdict = 'rain'
  else if (sameDay != null && sameDay <= day.sunset) verdict = 'one'
  return { ...day, meanCloud, daylightRainHours: rainHours, ghi, verdict }
}

// Advice for a given day: the latest time bottles can go out and still be ready before sunset,
// and when they will be ready if they go out at `start`.
export function planDay(series, day, now) {
  const step = RULES.step
  const first = Math.ceil(Math.max(now, day.sunrise) / step) * step
  let latest = null
  let latestReady = null
  for (let s = first; s < day.sunset; s += step) {
    const r = readyAt(series, s)
    if (r != null && r <= day.sunset) {
      latest = s
      latestReady = r
    } else if (latest != null) break
  }
  const start = Math.max(now, day.sunrise)
  return { latest, latestReady, start, readyIfStart: readyAt(series, start) }
}

// Which day the advice should be about: today until an hour before sunset, then tomorrow.
export function focusDay(series, now) {
  const days = series.days
  for (let i = 0; i < days.length; i++) {
    if (now < days[i].sunset - HOUR) return i
  }
  return days.length - 1
}

export function dayIndexAt(series, t) {
  const days = series.days
  for (let i = days.length - 1; i >= 0; i--) if (t >= days[i].date) return i
  return 0
}

// Offline fallback, straight from the Eawag schedule: 6 hours if sunny, two days if cloudy.
export function manualReadyAt(start, sky) {
  if (sky === 'rain') return null
  return start + (sky === 'cloudy' ? 48 : 6) * HOUR
}

// Very rough firewood saved by not boiling: heat 1 L from 25 °C to 100 °C (0.087 kWh) on an
// open fire at ~15 % efficiency, with dry wood at ~4.4 kWh/kg.
export function firewoodKg(litres) {
  const kWhPerLitre = (4.186 * 75) / 3600
  return (litres * kWhPerLitre) / 0.15 / 4.4
}

// ---------- household planning ----------
// Eawag advises at least two sets of bottles: one in the sun while the other is drunk. On cloudy
// days a set stays out for two days, so a third set keeps drinking water flowing.
export function familyPlan({ people, litres, size }) {
  const daily = people * litres
  const perDay = Math.ceil(daily / size - 1e-9)
  return { daily, perDay, own: perDay * 3, monthLitres: daily * 30, monthWoodKg: firewoodKg(daily * 30) }
}

// ---------- the past year ----------
// Open-Meteo's archive (ERA5 reanalysis) gives hourly sunlight as the mean of the preceding hour.
export function normalizeHourly(raw) {
  const h = raw.hourly
  const d = raw.daily
  const slots = []
  const hours = []
  for (let i = 0; i < h.time.length; i++) {
    const end = h.time[i] * 1000
    const ghi = h.shortwave_radiation[i]
    if (ghi != null) slots.push({ start: end - HOUR, end, ghi })
    hours.push({ start: end - HOUR / 2, end: end + HOUR / 2, cloud: h.cloud_cover[i], precip: h.precipitation[i] ?? 0 })
  }
  const days = []
  for (let i = 0; i < d.time.length; i++) {
    if (d.sunrise[i] == null || d.sunset[i] == null) continue
    const sunrise = d.sunrise[i] * 1000
    const sunset = d.sunset[i] * 1000
    days.push({ date: d.time[i] * 1000, sunrise, sunset, noon: (sunrise + sunset) / 2, ghiSum: null, rainHours: 0 })
  }
  return { tz: raw.timezone, slots, hours, days, start: slots[0]?.start ?? 0, end: slots.at(-1)?.end ?? 0 }
}

function within(list, t0, t1) {
  const out = []
  for (let i = firstEndingAfter(list, t0); i < list.length && list[i].start < t1; i++) out.push(list[i])
  return out
}

// Run the day verdict on every past day. Each day is judged on its own (bottles out at sunrise,
// ready by sunset?), exactly like the forecast days. Days with missing sunlight data are skipped.
export function yearOutlook(raw) {
  const s = normalizeHourly(raw)
  const offset = (raw.utc_offset_seconds ?? 0) * 1000
  const out = []
  for (const day of s.days) {
    const slots = within(s.slots, day.sunrise, day.sunset)
    if (slots.length < (day.sunset - day.sunrise) / HOUR - 1) continue
    const sub = {
      tz: s.tz,
      slots: within(s.slots, day.sunrise - HOUR, day.sunset + HOUR),
      hours: within(s.hours, day.sunrise - HOUR, day.sunset + HOUR),
      days: [day],
      start: day.sunrise - HOUR,
      end: day.sunset,
    }
    const o = dayOutlook(sub, day)
    const local = new Date(day.noon + offset)
    out.push({ y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate(), v: o.verdict, ghi: o.ghi })
  }
  return out
}

// Group a year of day verdicts by calendar month: the fastest months (most one-day days), slower
// months (mostly two-day days, so more bottles are needed) and rainy months (SODIS often fails).
export function yearSummary(days) {
  const months = Array.from({ length: 12 }, (_, m) => ({ m, n: 0, one: 0, two: 0, rain: 0, ghi: 0 }))
  const total = { n: 0, one: 0, two: 0, rain: 0 }
  for (const x of days) {
    const mo = months[x.m]
    mo.n++
    mo[x.v]++
    mo.ghi += x.ghi
    total.n++
    total[x.v]++
  }
  const seen = months.filter((mo) => mo.n)
  const share = (mo, k) => mo[k] / mo.n
  const pick = (k, min, dir = -1) =>
    seen
      .filter((mo) => share(mo, k) >= min)
      .sort((a, b) => dir * (share(a, k) - share(b, k)) || b.ghi / b.n - a.ghi / a.n)
      .slice(0, 3)
  return {
    months,
    total,
    fast: pick('one', 0.5).sort((a, b) => a.m - b.m),
    slow: pick('two', 0.5).sort((a, b) => a.m - b.m),
    wet: pick('rain', 0.15).sort((a, b) => a.m - b.m),
  }
}
