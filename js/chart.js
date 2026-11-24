// Sunlight chart for one day: irradiance area, the 500 W/m² line, cloud strip, rain marks, now line.
import { RULES } from './engine.js'

const W = 640
const H = 230
const M = { l: 48, r: 12, t: 34, b: 28 }
const HOUR = 3600e3

export function sunChart(series, day, now, { fmtTime, label, markers = [] }) {
  const x0 = day.sunrise - HOUR
  const x1 = day.sunset + HOUR
  const pts = series.slots.filter((s) => s.end > x0 && s.start < x1)
  const peak = Math.max(1000, ...pts.map((p) => p.ghi))
  const yMax = Math.ceil(peak / 250) * 250
  const X = (t) => M.l + ((t - x0) / (x1 - x0)) * (W - M.l - M.r)
  const Y = (v) => H - M.b - (v / yMax) * (H - M.t - M.b)
  const base = Y(0)

  let line = ''
  for (const p of pts) {
    const t = (p.start + p.end) / 2
    line += `${line ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(p.ghi).toFixed(1)}`
  }
  const first = pts[0]
  const last = pts[pts.length - 1]
  const area = pts.length
    ? `${line}L${X((last.start + last.end) / 2).toFixed(1)} ${base}L${X((first.start + first.end) / 2).toFixed(1)} ${base}Z`
    : ''

  // Past part of the day drawn solid, the forecast part lighter.
  const nowX = now > x0 && now < x1 ? X(now) : null

  const grid = []
  for (let v = 0; v <= yMax; v += 250) {
    grid.push(`<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>`)
    grid.push(`<text x="${M.l - 6}" y="${Y(v) + 4}" class="tick" text-anchor="end">${v}</text>`)
  }

  const ticks = []
  const firstTick = Math.ceil(x0 / (3 * HOUR)) * 3 * HOUR
  for (let t = firstTick; t <= x1; t += 3 * HOUR) {
    ticks.push(`<text x="${X(t)}" y="${H - 8}" class="tick" text-anchor="middle">${fmtTime(t)}</text>`)
  }

  const clouds = []
  const rain = []
  for (const h of series.hours) {
    if (h.end <= x0 || h.start >= x1 || h.cloud == null) continue
    const a = X(Math.max(h.start, x0))
    const b = X(Math.min(h.end, x1))
    clouds.push(`<rect x="${a.toFixed(1)}" y="${M.t - 26}" width="${(b - a + 0.6).toFixed(1)}" height="10" class="cloudcell" style="opacity:${(0.08 + 0.85 * (h.cloud / 100)).toFixed(2)}"><title>${Math.round(h.cloud)}%</title></rect>`)
    if (h.precip >= 0.2) {
      const cx = (a + b) / 2
      rain.push(`<path d="M${cx} ${M.t - 13}c-2.4 3-3.2 4.4-3.2 5.6a3.2 3.2 0 0 0 6.4 0c0-1.2-.8-2.6-3.2-5.6z" class="raindrop"><title>${h.precip} mm</title></path>`)
    }
  }

  const strong = Y(RULES.strongSun)
  const marks = markers
    .filter((m) => m.t > x0 && m.t < x1)
    .map((m) => `<g class="marker ${m.cls || ''}"><line x1="${X(m.t)}" x2="${X(m.t)}" y1="${M.t}" y2="${base}"/><text x="${X(m.t) + 5}" y="${M.t + 12}">${m.label}</text></g>`)

  return `<svg class="sunchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label.aria}">
    <defs>
      <linearGradient id="gsun" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--sun)" stop-opacity=".95"/>
        <stop offset="1" stop-color="var(--sun)" stop-opacity=".18"/>
      </linearGradient>
      <clipPath id="past"><rect x="0" y="0" width="${nowX ?? (now >= x1 ? W : 0)}" height="${H}"/></clipPath>
    </defs>
    ${grid.join('')}
    ${ticks.join('')}
    ${clouds.join('')}${rain.join('')}
    <path d="${area}" class="area future"/>
    <path d="${area}" class="area" clip-path="url(#past)"/>
    <path d="${line}" class="sunline"/>
    <line x1="${M.l}" x2="${W - M.r}" y1="${strong}" y2="${strong}" class="strong"/>
    <text x="${W - M.r - 4}" y="${strong - 6}" class="strongtext" text-anchor="end">${label.strong}</text>
    ${marks.join('')}
    ${nowX != null ? `<g class="now"><line x1="${nowX}" x2="${nowX}" y1="${M.t - 2}" y2="${base}"/><circle cx="${nowX}" cy="${M.t - 2}" r="3.5"/></g>` : ''}
    <text x="${M.l - 6}" y="${M.t - 18}" class="tick unit" text-anchor="end">${label.cloud}</text>
    <text x="8" y="${(M.t + base) / 2}" class="tick unit" transform="rotate(-90 8 ${(M.t + base) / 2})" text-anchor="middle">W/m²</text>
  </svg>`
}
