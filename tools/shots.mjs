// Capture submission screenshots from a running local server (default http://127.0.0.1:4173).
// Each shot starts from a clean Chrome profile seeded with demo data in localStorage.
import { mkdirSync } from 'node:fs'
import { launch } from './cdp.mjs'

const BASE = process.env.BASE || 'http://127.0.0.1:4173/'
const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })

const PLACES = {
  kisumu: { name: 'Kisumu', region: 'Kenya', lat: -0.1, lon: 34.76, utc: 3 },
  cochabamba: { name: 'Cochabamba', region: 'Bolivia', lat: -17.39, lon: -66.16, utc: -4 },
  arusha: { name: 'Arusha', region: 'Arusha, Tanzania', lat: -3.37, lon: 36.68, utc: 3 },
}
// Local clock time at a place, `days` from today, as epoch ms.
function localAt(place, h, m = 0, days = 0) {
  const d = new Date()
  d.setUTCHours(h - place.utc, m, 0, 0)
  d.setUTCDate(d.getUTCDate() + days)
  return d.getTime()
}
const { name, region, lat, lon } = PLACES.kisumu
const kisumu = { name, region, lat, lon }
const demoBatches = () => [
  { id: 'a1', n: 1, label: 'School kitchen', bottles: 8, size: 1.5, start: localAt(PLACES.kisumu, 8, 0, -1), place: kisumu, mode: 'forecast', notified: true },
  { id: 'a2', n: 2, label: 'Roof, morning', bottles: 6, size: 2, start: localAt(PLACES.kisumu, 9, 45), place: kisumu, mode: 'forecast' },
  { id: 'a3', n: 3, label: '', bottles: 4, size: 1, start: localAt(PLACES.kisumu, 13, 0), place: kisumu, mode: 'forecast' },
  { id: 'a0', n: 0, label: 'Clinic water', bottles: 10, size: 1.5, start: localAt(PLACES.kisumu, 7, 30, -3), finished: localAt(PLACES.kisumu, 15, 0, -3), place: kisumu, mode: 'forecast', notified: true },
]

async function shot(file, { place, lang = 'en', hash = 'today', batches = [], width = 1440, height = 1000, mobile = false, scale = 1, before, fullPage = false, clarity = null, family = null }) {
  const page = await launch({ width, height, mobile, scale })
  // No service worker here: its precache burst makes python's http.server drop module requests.
  await page.send('Network.enable')
  await page.send('Network.setBlockedURLs', { urls: ['*sw.js'] })
  await page.goto(BASE + '#' + hash)
  const p = PLACES[place]
  const seed = {
    'sundose:place': JSON.stringify({ name: p.name, region: p.region, lat: p.lat, lon: p.lon }),
    'sundose:lang': lang,
    'sundose:batches': JSON.stringify(batches),
    ...(clarity ? { 'sundose:clarity': JSON.stringify(clarity) } : {}),
    ...(family ? { 'sundose:family': JSON.stringify(family) } : {}),
  }
  await page.eval(`localStorage.clear(); Object.entries(${JSON.stringify(seed)}).forEach(([k, v]) => localStorage.setItem(k, v)); true`)
  await page.reload()
  // Wait until the forecast (and every batch's forecast) has loaded.
  for (let i = 0; i < 60; i++) {
    const ok = await page.eval(`!!document.querySelector('#view > section, #view > .batches') && !document.querySelector('.spinner') && !/Getting the|Obteniendo|ला रहे हैं|Inapata utabiri/.test(document.body.innerText)`)
    if (ok) break
    await page.wait(250)
  }
  await page.wait(600)
  if (before) await before(page)
  await page.shot(`${OUT}/${file}`, { fullPage })
  const errors = page.logs.filter((l) => /error|exception/i.test(l))
  if (errors.length) console.warn(file, errors)
  await page.close()
  console.log('wrote', file)
}

const only = process.argv[2]
const run = (name, fn) => (!only || name.includes(only) ? fn() : null)

const household = { people: 5, litres: 2, size: 1.5 }
// Load the past year on the Plan tab and wait for the calendar to draw.
const loadYear = async (page) => {
  await page.eval(`document.querySelector('[data-action=year]')?.click(); true`)
  for (let i = 0; i < 80 && !(await page.eval(`!!document.querySelector('.ygrid')`)); i++) await page.wait(250)
  await page.eval(`document.getElementById('view').classList.remove('enter'); true`)
  await page.wait(400)
}

await run('01', () => shot('01-today.png', { place: 'cochabamba', family: household }))
await run('02', () => shot('02-bottles.png', { place: 'kisumu', hash: 'bottles', batches: demoBatches() }))
await run('03', () => shot('03-guide.png', { place: 'kisumu', hash: 'guide', clarity: 'no' }))
await run('04', () => shot('04-science.png', { place: 'kisumu', hash: 'science' }))
await run('05', () => shot('05-add.png', {
  place: 'kisumu', hash: 'today', batches: [],
  before: async (page) => {
    await page.eval(`document.querySelector('[data-action=add]').click(); const f = document.querySelector('form[data-form=add]'); f.label.value = 'Roof, morning'; f.bottles.value = 6; f.size.value = '2'; f.clear.checked = true; true`)
    await page.wait(300)
  },
}))
await run('m1', () => shot('m1-today-sw.png', { place: 'arusha', lang: 'sw', width: 390, height: 844, mobile: true, scale: 2 }))
await run('m2', () => shot('m2-bottles-hi.png', { place: 'kisumu', lang: 'hi', hash: 'bottles', batches: demoBatches(), width: 390, height: 844, mobile: true, scale: 2 }))
await run('m3', () => shot('m3-guide-es.png', { place: 'cochabamba', lang: 'es', hash: 'guide', width: 390, height: 844, mobile: true, scale: 2 }))
await run('06', () => shot('06-print.png', {
  place: 'kisumu', width: 820, height: 1160,
  before: async (page) => {
    await page.eval(`window.print = () => {}; document.querySelector('[data-action=print]').click(); true`)
    await page.send('Emulation.setEmulatedMedia', { media: 'print' })
    await page.wait(300)
  },
}))
await run('08', () => shot('08-plan.png', { place: 'kisumu', hash: 'plan', family: household, height: 1640, before: loadYear }))
await run('09', () => shot('09-qr.png', {
  place: 'kisumu', family: household,
  before: async (page) => {
    await page.eval(`document.querySelector('[data-action=qr]').click(); true`)
    await page.wait(300)
  },
}))
await run('m4', () => shot('m4-plan-fr.png', { place: 'kisumu', lang: 'fr', hash: 'plan', family: household, width: 390, height: 844, mobile: true, scale: 2, before: async (page) => {
  await loadYear(page)
  await page.eval(`document.querySelector('.year').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); true`)
  await page.wait(300)
} }))
