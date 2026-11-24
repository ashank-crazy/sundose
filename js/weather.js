// Forecast fetching with an offline cache. Coordinates are rounded to 2 decimals (~1 km) before
// they leave the device; nothing else is sent anywhere.
import { normalize } from './engine.js'

const FRESH_MS = 60 * 60e3
const PREFIX = 'sundose:wx:'

const round = (x) => Math.round(x * 100) / 100
export const placeKey = (p) => `${round(p.lat).toFixed(2)},${round(p.lon).toFixed(2)}`

function forecastUrl(p) {
  const q = new URLSearchParams({
    latitude: round(p.lat),
    longitude: round(p.lon),
    minutely_15: 'shortwave_radiation',
    hourly: 'cloud_cover,precipitation',
    daily: 'sunrise,sunset,shortwave_radiation_sum,precipitation_hours',
    past_days: '2',
    forecast_days: '4',
    timezone: 'auto',
    timeformat: 'unixtime',
  })
  return `https://api.open-meteo.com/v1/forecast?${q}`
}

async function fetchJSON(url, ms = 15000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key))
  } catch {
    return null
  }
}

// Keep only the forecasts still needed (current place and places with bottles out).
export function pruneCache(keep) {
  const wanted = new Set([...keep].map((k) => PREFIX + k))
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX) && !wanted.has(k)) localStorage.removeItem(k)
  }
}

export function cachedForecast(place) {
  const c = readCache(placeKey(place))
  return c ? { series: normalize(c.raw), fetchedAt: c.fetchedAt, stale: true } : null
}

export async function getForecast(place, { force = false } = {}) {
  const key = placeKey(place)
  const cached = readCache(key)
  if (cached && !force && Date.now() - cached.fetchedAt < FRESH_MS) {
    return { series: normalize(cached.raw), fetchedAt: cached.fetchedAt, stale: false }
  }
  try {
    const raw = await fetchJSON(forecastUrl(place))
    const fetchedAt = Date.now()
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify({ raw, fetchedAt }))
    } catch {
      /* storage full: still usable this session */
    }
    return { series: normalize(raw), fetchedAt, stale: false }
  } catch (error) {
    if (cached) return { series: normalize(cached.raw), fetchedAt: cached.fetchedAt, stale: true, error }
    throw error
  }
}

export async function searchPlaces(query, lang) {
  const q = new URLSearchParams({ name: query, count: '6', language: lang, format: 'json' })
  const data = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?${q}`)
  return (data.results || []).map((r) => ({
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }))
}

// ---------- the past year (on demand, ~50 KB) ----------
const YEAR_PREFIX = 'sundose:year:'
const YEAR_FRESH_MS = 14 * 24 * 3600e3

const isoDay = (t) => new Date(t).toISOString().slice(0, 10)

function yearUrl(p) {
  // The reanalysis archive runs about 5 days behind, so end a week ago.
  const end = Date.now() - 7 * 864e5
  const q = new URLSearchParams({
    latitude: round(p.lat),
    longitude: round(p.lon),
    start_date: isoDay(end - 364 * 864e5),
    end_date: isoDay(end),
    hourly: 'shortwave_radiation,cloud_cover,precipitation',
    daily: 'sunrise,sunset',
    timezone: 'auto',
    timeformat: 'unixtime',
  })
  return `https://archive-api.open-meteo.com/v1/archive?${q}`
}

// Only the per-day verdicts are kept, as [month, day, verdict letter, kWh×10] (a few KB).
const V = { one: 'o', two: 't', rain: 'r' }
const VBACK = { o: 'one', t: 'two', r: 'rain' }

export function cachedYear(place) {
  try {
    const c = JSON.parse(localStorage.getItem(YEAR_PREFIX + placeKey(place)))
    if (!c || Date.now() - c.at > YEAR_FRESH_MS) return null
    return { at: c.at, days: c.days.map(([y, m, d, v, g]) => ({ y, m, d, v: VBACK[v], ghi: g / 10 })) }
  } catch {
    return null
  }
}

export async function getYear(place, compute) {
  const have = cachedYear(place)
  if (have) return have
  const raw = await fetchJSON(yearUrl(place), 30000)
  const days = compute(raw)
  const at = Date.now()
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith(YEAR_PREFIX)) localStorage.removeItem(k)
    }
    localStorage.setItem(
      YEAR_PREFIX + placeKey(place),
      JSON.stringify({ at, days: days.map((x) => [x.y, x.m, x.d, V[x.v], Math.round(x.ghi * 10)]) }),
    )
  } catch {
    /* storage full: still shown this session */
  }
  return { at, days }
}
