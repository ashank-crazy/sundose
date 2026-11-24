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
