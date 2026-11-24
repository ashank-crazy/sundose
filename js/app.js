import { tr, lang, setLang, LANGS } from './i18n.js'
import {
  RULES, evaluate, readyAt, dayOutlook, planDay, focusDay, dayIndexAt, manualReadyAt, firewoodKg,
} from './engine.js'
import { getForecast, cachedForecast, searchPlaces, placeKey, pruneCache } from './weather.js'
import { sunChart } from './chart.js'
import { icons, logo, steps, weatherIcon } from './icons.js'

const HOUR = 3600e3
const TABS = ['today', 'bottles', 'guide', 'science']
const EXAMPLES = [
  { name: 'Kisumu', region: 'Kenya', lat: -0.1, lon: 34.76 },
  { name: 'Cochabamba', region: 'Bolivia', lat: -17.39, lon: -66.16 },
  { name: 'Lucknow', region: 'India', lat: 26.85, lon: 80.95 },
  { name: 'Ouagadougou', region: 'Burkina Faso', lat: 12.37, lon: -1.53 },
  { name: 'Dhaka', region: 'Bangladesh', lat: 23.81, lon: 90.41 },
]

// ---------- storage ----------
const store = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem('sundose:' + k)) ?? d
    } catch {
      return d
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('sundose:' + k, JSON.stringify(v))
    } catch {
      /* private mode */
    }
  },
}

const state = {
  place: store.get('place', null),
  batches: store.get('batches', []),
  wx: null,
  loading: false,
  error: null,
  tab: tabFromHash(),
  clarity: store.get('clarity', null),
  query: '',
  results: null,
  searching: false,
  placeMsg: null,
}
const wxByKey = new Map()

// ---------- helpers ----------
const $ = (sel, el = document) => el.querySelector(sel)
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone

function fmtTime(t, tz = deviceTz) {
  return new Intl.DateTimeFormat(lang(), { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(t)
}
function ymd(t, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t)
}
function dayDiff(t, now, tz) {
  return Math.round((Date.parse(ymd(t, tz)) - Date.parse(ymd(now, tz))) / 864e5)
}
function dayLabel(t, tz = deviceTz, short = false) {
  const d = dayDiff(t, Date.now(), tz)
  if (d === 0) return tr('day.today')
  if (d === 1) return tr('day.tomorrow')
  if (d === -1) return tr('day.yesterday')
  return new Intl.DateTimeFormat(lang(), { weekday: short ? 'short' : 'long', timeZone: tz }).format(t)
}
function dateLabel(t, tz = deviceTz) {
  return new Intl.DateTimeFormat(lang(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(t)
}
const when = (t, tz) => `${dayLabel(t, tz)}, ${fmtTime(t, tz)}`
const num = (v, d = 1) =>
  new Intl.NumberFormat(lang(), { maximumFractionDigits: d, minimumFractionDigits: d }).format(v)
const int = (v) => new Intl.NumberFormat(lang(), { maximumFractionDigits: 0 }).format(v)

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000)
  if (m < 1) return tr('ago.now')
  if (m < 60) return tr('ago.min', { n: m })
  const h = Math.round(m / 60)
  if (h < 48) return tr('ago.hour', { n: h })
  return tr('ago.day', { n: Math.round(h / 24) })
}

function tabFromHash() {
  const h = location.hash.replace('#', '')
  return TABS.includes(h) ? h : 'today'
}

function toast(msg) {
  const el = $('#toast')
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => el.classList.remove('show'), 2800)
}

const placeLabel = (p) => (p ? p.name : tr('place.set'))
const saveBatches = () => store.set('batches', state.batches)
const batchName = (b) => b.label || tr('batch.label', { n: b.n })
const litresOf = (b) => b.bottles * b.size

// ---------- forecast loading ----------
async function loadWx(force = false) {
  const place = state.place
  if (!place) return
  const key = placeKey(place)
  if (!state.wx) {
    const cached = wxByKey.get(key) || cachedForecast(place)
    if (cached) {
      state.wx = cached
      wxByKey.set(key, cached)
    }
  }
  state.loading = true
  state.error = null
  render()
  try {
    const wx = await getForecast(place, { force })
    wxByKey.set(key, wx)
    if (state.place && placeKey(state.place) === key) {
      state.wx = wx
      state.error = wx.error || null
    }
  } catch (e) {
    state.error = e
  }
  state.loading = false
  await loadBatchPlaces()
  pruneCache(neededKeys())
  render()
}

function neededKeys() {
  const keys = new Set()
  if (state.place) keys.add(placeKey(state.place))
  for (const b of state.batches) if (!b.finished && b.place) keys.add(placeKey(b.place))
  return keys
}

async function loadBatchPlaces() {
  for (const b of state.batches) {
    if (b.finished || b.mode !== 'forecast') continue
    const key = placeKey(b.place)
    const have = wxByKey.get(key)
    if (have && Date.now() - have.fetchedAt < HOUR) continue
    try {
      wxByKey.set(key, await getForecast(b.place))
    } catch {
      const c = cachedForecast(b.place)
      if (c) wxByKey.set(key, c)
    }
  }
}

function setPlace(p) {
  state.place = { name: p.name, region: p.region || '', lat: p.lat, lon: p.lon }
  store.set('place', state.place)
  state.wx = null
  state.results = null
  state.query = ''
  state.placeMsg = null
  const dlg = $('#placeDialog')
  if (dlg.open) dlg.close()
  if (state.tab !== 'today') location.hash = '#today'
  loadWx()
}

// ---------- batch status ----------
function batchStatus(b, now = Date.now()) {
  if (b.mode === 'manual') {
    const eta = manualReadyAt(b.start, b.sky)
    const ready = eta != null && now >= eta
    const progress = eta == null ? 0 : Math.min(1, (now - b.start) / (eta - b.start))
    return { manual: true, ready, progress, eta, tz: deviceTz }
  }
  const wx = wxByKey.get(placeKey(b.place))
  if (!wx) return { pending: true, ready: false, progress: 0, tz: deviceTz }
  const s = wx.series
  const ev = evaluate(s, b.start, now)
  const eta = ev.ready ? readyAt(s, b.start) : readyAt(s, b.start, now)
  return { ...ev, eta, tz: s.tz, beyond: now > s.end }
}

function checkReadyAlerts() {
  let changed = false
  for (const b of state.batches) {
    if (b.finished || b.notified) continue
    const st = batchStatus(b)
    if (!st.ready) continue
    b.notified = true
    changed = true
    notify(tr('notify.title', { name: batchName(b) }), tr('notify.body'))
  }
  if (changed) saveBatches()
}

async function notify(title, body) {
  toast(title)
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' })
    else new Notification(title, { body, icon: 'icons/icon-192.png' })
  } catch {
    /* notifications unavailable */
  }
}

// ---------- shared pieces ----------
function placePicker(inDialog) {
  const res = state.results
  return `
    <div class="picker">
      <button class="btn primary wide" data-action="locate">${icons.locate}<span>${tr('place.use')}</span></button>
      <form class="search" data-form="search" role="search">
        <label class="sr" for="q-${inDialog ? 'd' : 'm'}">${tr('place.search')}</label>
        <input id="q-${inDialog ? 'd' : 'm'}" name="q" type="search" autocomplete="off" placeholder="${tr('place.search')}" value="${esc(state.query)}" required>
        <button class="btn" type="submit" aria-label="${tr('place.searchBtn')}">${icons.search}</button>
      </form>
      ${state.searching ? `<p class="muted">${tr('place.searching')}</p>` : ''}
      ${state.placeMsg ? `<p class="note warn">${esc(state.placeMsg)}</p>` : ''}
      ${res && res.length ? `<ul class="results">${res.map((r, i) => `<li><button data-action="pick" data-i="${i}">${icons.pin}<span><b>${esc(r.name)}</b><small>${esc(r.region)}</small></span></button></li>`).join('')}</ul>` : ''}
      ${res && !res.length ? `<p class="muted">${tr('place.none')}</p>` : ''}
      <p class="examples-label">${tr('place.examples')}</p>
      <div class="chips">${EXAMPLES.map((p, i) => `<button class="chip" data-action="example" data-i="${i}">${esc(p.name)}<small>${esc(p.region)}</small></button>`).join('')}</div>
    </div>`
}

function ring(progress, ready, size = 84) {
  const r = 34
  const c = 2 * Math.PI * r
  const pct = Math.round(progress * 100)
  return `<svg class="ring ${ready ? 'done' : ''}" viewBox="0 0 84 84" width="${size}" height="${size}" role="img" aria-label="${pct}%">
    <circle cx="42" cy="42" r="${r}" class="track"/>
    <circle cx="42" cy="42" r="${r}" class="fill" stroke-dasharray="${(progress * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)"/>
    ${ready ? `<path d="M29 43l9 9 17-18" class="tick"/>` : `<text x="42" y="47" text-anchor="middle">${pct}%</text>`}
  </svg>`
}

// Everything the Today screen and the share/print texts need about the coming day.
function todayModel() {
  const s = state.wx.series
  const now = Date.now()
  const tz = s.tz
  const fi = focusDay(s, now)
  const day = s.days[fi]
  const outlook = dayOutlook(s, day)
  const plan = planDay(s, day, now)
  const daytime = now >= day.sunrise && now < day.sunset
  return { s, now, tz, fi, day, outlook, plan, daytime }
}

function adviceTiles(m) {
  const { s, plan, day, fi, tz, daytime, outlook } = m
  const a = {
    label: daytime ? tr('tile.startNow') : tr('tile.startSunrise', { time: fmtTime(day.sunrise, tz) }),
    value: plan.readyIfStart ? when(plan.readyIfStart, tz) : tr('tile.never'),
  }
  let b = { label: tr('tile.latest'), value: plan.latest ? fmtTime(plan.latest, tz) : tr('tile.noSameDay') }
  const next = s.days[fi + 1]
  if (!plan.latest && daytime && outlook.verdict === 'one' && next) {
    // A sunny day, but the midday hours are already gone: point to tomorrow's deadline instead.
    const np = planDay(s, next, next.sunrise)
    b = {
      label: tr('tile.tooLate'),
      value: np.latest ? tr('tile.byTime', { day: dayLabel(next.noon, tz), time: fmtTime(np.latest, tz) }) : tr('tile.noSameDay'),
    }
  }
  return [a, b]
}

function forecastText() {
  const m = todayModel()
  const v = m.outlook.verdict
  const [a, b] = adviceTiles(m)
  const url = location.origin + location.pathname
  return [
    `☀ Sundose · ${state.place.name}`,
    `${dayLabel(m.day.noon, m.tz)}: ${tr(`verdict.${v}.title`)}. ${tr(`verdict.${v}.body`)}`,
    `${a.label} ${a.value}`,
    `${b.label}: ${b.value}`,
    url,
  ].join('\n')
}

// ---------- views ----------
function viewOnboarding() {
  return `
  <section class="hero intro">
    <div class="intro-art">${logo}</div>
    <h1>${tr('intro.title')}</h1>
    <p class="lead">${tr('intro.body')}</p>
  </section>
  <section class="card">
    <h2>${tr('place.title')}</h2>
    ${placePicker(false)}
  </section>
  <section class="card how3">
    <div><span class="num">1</span><p>${tr('intro.s1')}</p></div>
    <div><span class="num">2</span><p>${tr('intro.s2')}</p></div>
    <div><span class="num">3</span><p>${tr('intro.s3')}</p></div>
  </section>`
}

function viewToday() {
  if (!state.place) return viewOnboarding()
  if (!state.wx) {
    if (state.error) {
      return `<section class="card center">
        ${icons.wifiOff}<h2>${tr('wx.failTitle')}</h2><p>${tr('wx.failBody')}</p>
        <div class="row center"><button class="btn primary" data-action="retry">${icons.refresh}<span>${tr('wx.retry')}</span></button>
        <button class="btn" data-action="add">${tr('cta.start')}</button></div></section>`
    }
    return `<section class="card center loading"><div class="spinner"></div><p>${tr('wx.loading')}</p></section>`
  }
  const m = todayModel()
  const { s, tz, day, outlook, plan, now } = m
  if (now > s.end - 2 * HOUR) {
    return `<section class="card center">${icons.wifiOff}<h2>${tr('wx.oldTitle')}</h2><p>${tr('wx.oldBody')}</p>
      <div class="row center"><button class="btn primary" data-action="retry">${icons.refresh}<span>${tr('wx.retry')}</span></button></div></section>`
  }
  const v = outlook.verdict
  const [a, b] = adviceTiles(m)
  const todayIdx = dayIndexAt(s, now)
  const days = s.days.slice(todayIdx)
  const chart = sunChart(s, day, now, {
    fmtTime: (t) => new Intl.DateTimeFormat(lang(), { hour: 'numeric', timeZone: tz }).format(t),
    label: { strong: tr('chart.strong'), cloud: tr('chart.cloud'), aria: tr('chart.aria', { day: dayLabel(day.noon, tz) }) },
    markers: plan.latest && plan.latest > now ? [{ t: plan.latest, label: tr('chart.latest'), cls: 'latest' }] : [],
  })
  const active = state.batches.filter((x) => !x.finished)
  return `
  <section class="hero verdict v-${v}">
    <div class="hero-text">
      <p class="eyebrow">${esc(dayLabel(day.noon, tz))} · ${esc(dateLabel(day.noon, tz))}</p>
      <h1>${tr(`verdict.${v}.title`)}</h1>
      <p class="lead">${tr(`verdict.${v}.body`)}</p>
    </div>
    <div class="hero-icon">${weatherIcon(v)}</div>
    <div class="tiles">
      <div class="tile"><span>${esc(a.label)}</span><b>${esc(a.value)}</b></div>
      <div class="tile"><span>${esc(b.label)}</span><b>${esc(b.value)}</b></div>
    </div>
    <div class="row hero-actions">
      <button class="btn primary big" data-action="add">${icons.bottle}<span>${tr('cta.start')}</span></button>
      ${active.length ? `<a class="btn" href="#bottles">${tr('cta.myBottles', { n: active.length })}</a>` : ''}
    </div>
  </section>

  <section class="card">
    <div class="card-head"><h2>${tr('chart.title')} · ${esc(dayLabel(day.noon, tz))}</h2>
      <span class="muted small">${tr('chart.daily', { kwh: num(outlook.ghi) })}</span></div>
    ${chart}
    <ul class="legend">
      <li><i class="sw sun"></i>${tr('legend.sun')}</li>
      <li><i class="sw strong"></i>${tr('legend.strong')}</li>
      <li><i class="sw cloud"></i>${tr('legend.cloud')}</li>
      <li><i class="sw rain"></i>${tr('legend.rain')}</li>
    </ul>
  </section>

  <section class="card">
    <h2>${tr('outlook.title')}</h2>
    <ol class="outlook">
      ${days
        .map((d) => {
          const o = dayOutlook(s, d)
          return `<li class="v-${o.verdict} ${d === day ? 'focus' : ''}">
            <span class="dname">${esc(dayLabel(d.noon, tz, true))}</span>
            <span class="dicon">${weatherIcon(o.verdict)}</span>
            <span class="vchip">${tr(`chip.${o.verdict}`)}</span>
            <span class="dstat"><b>${num(o.ghi)}</b> kWh/m²</span>
            <span class="dstat">${o.meanCloud == null ? '–' : int(o.meanCloud)}% ${tr('outlook.cloud')}</span>
          </li>`
        })
        .join('')}
    </ol>
  </section>

  <section class="card share">
    <div>
      <h2>${tr('share.title')}</h2>
      <p class="muted">${tr('share.body')}</p>
    </div>
    <div class="row">
      <button class="btn" data-action="share">${icons.share}<span>${tr('cta.share')}</span></button>
      <button class="btn" data-action="whatsapp">${icons.chat}<span>${tr('cta.whatsapp')}</span></button>
      <button class="btn" data-action="print">${icons.print}<span>${tr('cta.print')}</span></button>
    </div>
  </section>
  ${freshness()}`
}

function freshness() {
  const wx = state.wx
  if (!wx) return ''
  const offline = wx.stale || !navigator.onLine
  return `<p class="fresh ${offline ? 'offline' : ''}">
    ${offline ? icons.wifiOff : icons.refresh}
    <span>${offline ? tr('wx.offline', { ago: ago(wx.fetchedAt) }) : tr('wx.updated', { ago: ago(wx.fetchedAt) })}
    · <a href="https://open-meteo.com/" target="_blank" rel="noopener">${tr('wx.source')}</a></span>
    <button class="linkbtn" data-action="retry" ${state.loading ? 'disabled' : ''}>${state.loading ? tr('wx.refreshing') : tr('wx.refresh')}</button>
  </p>`
}

function viewBottles() {
  const now = Date.now()
  const active = state.batches.filter((b) => !b.finished).sort((a, b) => a.start - b.start)
  const done = state.batches.filter((b) => b.finished).sort((a, b) => b.finished - a.finished)
  const statuses = new Map(active.map((b) => [b, batchStatus(b, now)]))
  const treated = state.batches.filter((b) => b.finished || statuses.get(b)?.ready)
  const litres = treated.reduce((sum, b) => sum + litresOf(b), 0)
  const notifyBtn =
    'Notification' in window && Notification.permission === 'default' && active.length
      ? `<button class="btn small" data-action="notify">${icons.bell}<span>${tr('notify.enable')}</span></button>`
      : ''

  const cards = active
    .map((b) => {
      const st = statuses.get(b)
      const tz = st.tz
      let status
      if (st.pending) status = tr('batch.pending')
      else if (st.ready) status = tr('batch.ready')
      else if (st.eta) status = tr('batch.readyAt', { when: when(st.eta, tz) })
      else if (st.manual && b.sky === 'rain') status = tr('batch.rain')
      else status = tr('batch.notInForecast')
      const checks = st.manual
        ? `<li class="info">${tr('batch.manual', { rule: tr(`sky.rule.${b.sky}`) })}</li>`
        : st.pending
          ? ''
          : `
          <li class="${st.checks.dose ? 'ok' : ''}">${st.checks.dose ? icons.check : icons.dot}${tr('check.dose', { v: num(st.dose), t: num(RULES.doseTarget) })}</li>
          <li class="${st.checks.daylight ? 'ok' : ''}">${st.checks.daylight ? icons.check : icons.dot}${tr('check.daylight', { v: num(st.daylightH), t: int(RULES.minDaylightHours) })}</li>
          <li class="${st.checks.noon ? 'ok' : ''}">${st.checks.noon ? icons.check : icons.dot}${tr('check.noon', { v: Math.min(st.noons, st.needNoons), t: st.needNoons })}</li>
          ${st.meanCloud != null ? `<li class="info">${st.cloudy ? icons.cloud : icons.sun}${tr(st.cloudy ? 'check.cloudy' : 'check.clear', { n: int(st.meanCloud) })}</li>` : ''}
          ${st.rainHours >= 1 ? `<li class="info">${icons.drop}${tr('check.rain', { n: num(st.rainHours) })}</li>` : ''}`
      return `<article class="batch ${st.ready ? 'is-ready' : ''}">
        ${ring(st.progress, st.ready)}
        <div class="bmain">
          <h3>${esc(batchName(b))}</h3>
          <p class="meta">${tr('batch.meta', { bottles: b.bottles, litres: num(litresOf(b)) })} · ${esc(b.place?.name || '')}</p>
          <p class="meta">${tr('batch.started', { when: when(b.start, tz) })}</p>
          <p class="status">${status}</p>
          <ul class="checks">${checks}</ul>
          ${st.ready ? `<p class="drink">${icons.drop}<span>${tr('batch.drinkHint')}</span></p>` : ''}
        </div>
        <div class="row bactions">
          ${!st.ready && st.eta ? `<button class="btn small" data-action="ics" data-id="${b.id}">${icons.calendar}<span>${tr('batch.calendar')}</span></button>` : ''}
          <button class="btn small ${st.ready ? 'primary' : ''}" data-action="finish" data-id="${b.id}">${icons.check}<span>${tr('batch.finish')}</span></button>
          <button class="btn small ghost" data-action="remove" data-id="${b.id}" aria-label="${tr('batch.remove')}">${icons.trash}</button>
        </div>
      </article>`
    })
    .join('')

  return `
  <section class="page-head">
    <h1>${tr('bottles.title')}</h1>
    <div class="row">${notifyBtn}<button class="btn primary" data-action="add">${icons.plus}<span>${tr('bottles.add')}</span></button></div>
  </section>
  ${
    active.length
      ? `<div class="batches">${cards}</div>`
      : `<section class="card center empty">${steps[3]}<h2>${tr('bottles.empty')}</h2><p class="muted">${tr('bottles.emptyHint')}</p>
        <button class="btn primary" data-action="add">${icons.bottle}<span>${tr('cta.start')}</span></button></section>`
  }
  ${
    state.batches.length
      ? `<section class="card stats">
      <div><b>${num(litres)}</b><span>${tr('stats.litres')}</span></div>
      <div><b>${int(treated.length)}</b><span>${tr('stats.batches')}</span></div>
      <div><b>${num(firewoodKg(litres))}</b><span>${tr('stats.wood')}</span></div>
    </section>`
      : ''
  }
  ${
    done.length
      ? `<section class="card"><h2>${tr('history.title')}</h2><ul class="history">${done
          .slice(0, 12)
          .map(
            (b) => `<li><span class="hname">${icons.check}<span><b>${esc(batchName(b))}</b><small class="muted">${esc(dateLabel(b.finished))} · ${num(litresOf(b))} L</small></span></span>
            <button class="linkbtn" data-action="remove" data-id="${b.id}" aria-label="${tr('batch.remove')}">${icons.trash}</button></li>`,
          )
          .join('')}</ul></section>`
      : ''
  }`
}

function viewGuide() {
  const keys = ['s1', 's2', 's3', 's4', 's5', 's6']
  return `
  <section class="page-head"><div><h1>${tr('guide.title')}</h1><p class="lead">${tr('guide.intro')}</p></div></section>
  <ol class="steps">
    ${keys
      .map(
        (k, i) => `<li class="step" id="step-${i + 1}">
        <div class="art">${steps[i]}</div>
        <div>
          <h2><span class="num">${i + 1}</span>${tr(`guide.${k}.t`)}</h2>
          <p>${tr(`guide.${k}.b`)}</p>
          ${
            k === 's2'
              ? `<div class="clarity" id="clarity">
              <p class="q">${tr('guide.s2.q')}</p>
              <div class="row">
                <button class="btn ${state.clarity === 'yes' ? 'on-yes' : ''}" data-action="clarity" data-v="yes">${icons.check}<span>${tr('yes')}</span></button>
                <button class="btn ${state.clarity === 'no' ? 'on-no' : ''}" data-action="clarity" data-v="no">${icons.x}<span>${tr('no')}</span></button>
              </div>
              ${state.clarity ? `<p class="answer ${state.clarity}">${tr(`guide.s2.${state.clarity}`)}</p>` : ''}
              <p class="muted small">${tr('guide.s2.card')}</p>
            </div>`
              : ''
          }
          ${k === 's5' ? `<button class="btn primary" data-action="add">${icons.bottle}<span>${tr('cta.start')}</span></button>` : ''}
        </div>
      </li>`,
      )
      .join('')}
  </ol>
  <section class="card limits">
    <h2>${tr('limits.title')}</h2>
    <ul>
      <li>${tr('limits.chem')}</li>
      <li>${tr('limits.turbid')}</li>
      <li>${tr('limits.rain')}</li>
      <li>${tr('limits.bottles')}</li>
    </ul>
    <p>${tr('limits.alt')}</p>
  </section>`
}

function viewScience() {
  return `
  <section class="page-head"><div><h1>${tr('sci.title')}</h1><p class="lead">${tr('sci.intro')}</p></div></section>
  <section class="rules">
    <div class="rule">${icons.sun}<h2>${tr('sci.r1.t')}</h2><p>${tr('sci.r1.b')}</p><code>Σ GHI·Δt ≥ ${num(RULES.doseTarget)} kWh/m²</code></div>
    <div class="rule">${icons.gauge}<h2>${tr('sci.r2.t')}</h2><p>${tr('sci.r2.b')}</p><code>daylight ≥ ${RULES.minDaylightHours} h</code></div>
    <div class="rule">${icons.cloudSun}<h2>${tr('sci.r3.t')}</h2><p>${tr('sci.r3.b')}</p><code>middays ≥ 1, or 2 if cloud &gt; 50%</code></div>
  </section>
  <section class="card"><h2>${tr('sci.data.t')}</h2><p>${tr('sci.data.b')}</p></section>
  <section class="card why"><h2>${tr('sci.why.t')}</h2><p>${tr('sci.why.b')}</p>
    <p class="sdgs"><span class="sdg sdg6">SDG 6.1</span><span class="sdg sdg3">SDG 3.9</span><span class="sdg sdg13">SDG 13</span></p>
    <p class="muted small">${tr('sci.sdg')}</p></section>
  <section class="card"><h2>${tr('sci.limits.t')}</h2><p>${tr('sci.limits.b')}</p></section>
  <section class="card"><h2>${tr('sci.privacy.t')}</h2><p>${tr('sci.privacy.b')}</p></section>
  <section class="card sources"><h2>${tr('sci.sources')}</h2>
    <ul>
      <li><a href="https://www.eawag.ch/en/department/sandec/projects/swp/solar-water-disinfection-sodis" target="_blank" rel="noopener">Eawag / Sandec — SODIS manual (2016)</a></li>
      <li><a href="https://www.frontiersin.org/journals/water/articles/10.3389/frwa.2025.1679793/full" target="_blank" rel="noopener">Frontiers in Water (2025) — SODIS irradiance and dose review</a></li>
      <li><a href="https://washdata.org/" target="_blank" rel="noopener">WHO/UNICEF Joint Monitoring Programme (JMP)</a></li>
      <li><a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo — free weather API (CC BY 4.0)</a></li>
      <li><a href="https://en.wikipedia.org/wiki/Solar_water_disinfection" target="_blank" rel="noopener">Wikipedia — Solar water disinfection</a></li>
    </ul>
  </section>
  <p class="credit">${tr('credit')}</p>`
}

// ---------- dialogs ----------
function openPlaceDialog() {
  state.results = null
  state.placeMsg = null
  renderPlaceDialog()
  $('#placeDialog').showModal()
}

function renderPlaceDialog() {
  $('#placeDialog').innerHTML = `<div class="sheet">
    <header><h2>${tr('place.title')}</h2><button class="iconbtn" data-action="close-dialog" aria-label="${tr('close')}">${icons.x}</button></header>
    ${placePicker(true)}
  </div>`
}

function openAddDialog() {
  const wx = state.wx
  const manual = !state.place || !wx || Date.now() > wx.series.end - 2 * HOUR
  const last = state.batches[state.batches.length - 1]
  const earlier = new Date(Date.now() - HOUR)
  const hhmm = `${String(earlier.getHours()).padStart(2, '0')}:${String(earlier.getMinutes()).padStart(2, '0')}`
  const sizes = [0.5, 1, 1.5, 2]
  const size = last?.size ?? 1.5
  $('#addDialog').innerHTML = `<form class="sheet" data-form="add" novalidate>
    <header><h2>${tr('add.title')}</h2><button type="button" class="iconbtn" data-action="close-dialog" aria-label="${tr('close')}">${icons.x}</button></header>
    ${state.place ? `<p class="muted small">${icons.pin}${esc(state.place.name)}${manual ? ` · ${tr('add.manualNote')}` : ''}</p>` : ''}
    <label class="field"><span>${tr('add.label')}</span><input name="label" maxlength="40" placeholder="${tr('add.labelPh')}"></label>
    <div class="field-row">
      <div class="field"><span id="lbl-count">${tr('add.count')}</span>
        <div class="stepper" role="group" aria-labelledby="lbl-count">
          <button type="button" data-action="step" data-d="-1" aria-label="−">${icons.minus}</button>
          <input name="bottles" type="number" min="1" max="99" value="${last?.bottles ?? 4}" inputmode="numeric" aria-labelledby="lbl-count">
          <button type="button" data-action="step" data-d="1" aria-label="+">${icons.plus}</button>
        </div></div>
      <label class="field"><span>${tr('add.size')}</span>
        <select name="size">${sizes.map((v) => `<option value="${v}" ${v === size ? 'selected' : ''}>${num(v)} L</option>`).join('')}</select></label>
    </div>
    <fieldset class="field"><legend>${tr('add.when')}</legend>
      <label class="radio"><input type="radio" name="when" value="now" checked><span>${tr('add.now')}</span></label>
      <label class="radio"><input type="radio" name="when" value="earlier"><span>${tr('add.earlier')}</span><input type="time" name="time" value="${hhmm}" aria-label="${tr('add.earlier')}"></label>
    </fieldset>
    ${
      manual
        ? `<fieldset class="field"><legend>${tr('add.sky')}</legend>
      ${['sunny', 'cloudy', 'rain'].map((k, i) => `<label class="radio"><input type="radio" name="sky" value="${k}" ${i === 0 ? 'checked' : ''}><span>${tr(`sky.${k}`)}</span></label>`).join('')}
    </fieldset>`
        : ''
    }
    <label class="check"><input type="checkbox" name="clear" ${state.clarity === 'yes' ? 'checked' : ''}><span>${tr('add.clear')} <a href="#guide" data-action="goto-clarity">${tr('add.clearLink')}</a></span></label>
    <p class="formerr" role="alert" hidden></p>
    <footer><button type="button" class="btn ghost" data-action="close-dialog">${tr('add.cancel')}</button>
      <button class="btn primary" type="submit">${icons.sun}<span>${tr('add.save')}</span></button></footer>
  </form>`
  $('#addDialog').showModal()
}

function submitAdd(form) {
  const fd = new FormData(form)
  const err = form.querySelector('.formerr')
  const fail = (msg) => {
    err.textContent = msg
    err.hidden = false
  }
  if (!fd.get('clear')) return fail(tr('add.needClear'))
  let start = Date.now()
  if (fd.get('when') === 'earlier') {
    const [h, mi] = String(fd.get('time') || '').split(':').map(Number)
    if (Number.isNaN(h)) return fail(tr('add.badTime'))
    const d = new Date()
    d.setHours(h, mi || 0, 0, 0)
    if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1)
    start = d.getTime()
  }
  const bottles = Math.max(1, Math.min(99, parseInt(fd.get('bottles'), 10) || 1))
  const sky = fd.get('sky')
  const n = state.batches.reduce((m, b) => Math.max(m, b.n || 0), 0) + 1
  state.batches.push({
    id: Math.random().toString(36).slice(2, 10),
    n,
    label: String(fd.get('label') || '').trim().slice(0, 40),
    bottles,
    size: Number(fd.get('size')) || 1.5,
    start,
    place: state.place ? { ...state.place } : { name: '', lat: 0, lon: 0 },
    mode: sky ? 'manual' : 'forecast',
    sky: sky || undefined,
  })
  saveBatches()
  $('#addDialog').close()
  toast(tr('add.done'))
  if (state.tab !== 'bottles') location.hash = '#bottles'
  else render()
}

// ---------- actions ----------
function downloadIcs(b) {
  const st = batchStatus(b)
  if (!st.eta) return
  const z = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const text = (v) => String(v).replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sundose//SODIS//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${b.id}@sundose`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(st.eta)}`, `DTEND:${z(st.eta + 15 * 60e3)}`,
    `SUMMARY:${text(tr('ics.summary', { name: batchName(b) }))}`,
    `DESCRIPTION:${text(tr('batch.drinkHint'))}`,
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${text(tr('ics.summary', { name: batchName(b) }))}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `sundose-${b.n}.ics` })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// On paper, "tomorrow" goes stale: print the time alone for the same day, or the date and time.
function paperTime(t, day, tz) {
  return ymd(t, tz) === ymd(day.noon, tz) ? fmtTime(t, tz) : `${dateLabel(t, tz)}, ${fmtTime(t, tz)}`
}

function printSheet() {
  const m = todayModel()
  const { s, tz, now } = m
  const rows = s.days.slice(dayIndexAt(s, now)).map((d) => {
    const o = dayOutlook(s, d)
    const p = planDay(s, d, Math.max(now, d.sunrise))
    return `<tr><th>${esc(dateLabel(d.noon, tz))}</th><td>${tr(`chip.${o.verdict}`)}</td><td>${num(o.ghi)} kWh/m²</td>
      <td>${p.latest ? fmtTime(p.latest, tz) : '—'}</td><td>${p.readyIfStart ? paperTime(p.readyIfStart, d, tz) : '—'}</td></tr>`
  })
  $('#print').innerHTML = `
    <header>${logo}<div><h1>${tr('print.title', { place: esc(state.place.name) })}</h1><p>${tr('print.printed', { date: esc(dateLabel(now, tz)) })}</p></div></header>
    <table><thead><tr><th></th><th>${tr('print.kind')}</th><th>${tr('print.sun')}</th><th>${tr('print.latest')}</th><th>${tr('print.ready')}</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table>
    <ol class="psteps">${['s1', 's2', 's3', 's4', 's5', 's6'].map((k) => `<li><b>${tr(`guide.${k}.t`)}</b> ${tr(`guide.${k}.b`)}</li>`).join('')}</ol>
    <div class="testcard"><span>${tr('print.testLabel')}</span><b>CLEAN WATER · SAFE WATER</b></div>
    <p class="pfoot">${tr('limits.chem')} ${tr('limits.alt')}</p>
    <p class="pfoot">Sundose · ${esc(location.origin + location.pathname)}</p>`
  window.print()
}

const actions = {
  add: () => openAddDialog(),
  place: () => openPlaceDialog(),
  'close-dialog': (el) => el.closest('dialog')?.close(),
  retry: () => loadWx(true),
  locate: () => {
    if (!navigator.geolocation) {
      state.placeMsg = tr('place.denied')
      return rerenderPicker()
    }
    state.placeMsg = tr('place.locating')
    rerenderPicker()
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords
        setPlace({ name: tr('place.mine'), region: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat, lon })
      },
      () => {
        state.placeMsg = tr('place.denied')
        rerenderPicker()
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: HOUR },
    )
  },
  pick: (el) => setPlace(state.results[Number(el.dataset.i)]),
  example: (el) => setPlace(EXAMPLES[Number(el.dataset.i)]),
  step: (el) => {
    const input = el.parentElement.querySelector('input')
    input.value = Math.max(1, Math.min(99, (parseInt(input.value, 10) || 1) + Number(el.dataset.d)))
  },
  clarity: (el) => {
    state.clarity = el.dataset.v
    store.set('clarity', state.clarity)
    render()
  },
  'goto-clarity': (el, e) => {
    e.preventDefault()
    el.closest('dialog')?.close()
    location.hash = '#guide'
    requestAnimationFrame(() => $('#clarity')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  },
  finish: (el) => {
    const b = state.batches.find((x) => x.id === el.dataset.id)
    if (!b) return
    b.finished = Date.now()
    saveBatches()
    toast(tr('batch.finished'))
    render()
  },
  remove: (el) => {
    if (!confirm(tr('batch.confirmRemove'))) return
    state.batches = state.batches.filter((x) => x.id !== el.dataset.id)
    saveBatches()
    render()
  },
  ics: (el) => {
    const b = state.batches.find((x) => x.id === el.dataset.id)
    if (b) downloadIcs(b)
  },
  notify: async () => {
    if (!('Notification' in window)) return
    const p = await Notification.requestPermission()
    toast(p === 'granted' ? tr('notify.on') : tr('notify.off'))
    render()
  },
  share: async () => {
    const text = forecastText()
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Sundose', text })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      toast(tr('share.copied'))
    } catch {
      prompt('', text)
    }
  },
  whatsapp: () => window.open(`https://wa.me/?text=${encodeURIComponent(forecastText())}`, '_blank', 'noopener'),
  print: () => printSheet(),
}

function rerenderPicker() {
  if ($('#placeDialog').open) renderPlaceDialog()
  else render()
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]')
  if (!el || !actions[el.dataset.action]) return
  if (el.tagName === 'A' && el.dataset.action !== 'goto-clarity') e.preventDefault()
  actions[el.dataset.action](el, e)
})

document.addEventListener('submit', async (e) => {
  const form = e.target
  if (form.dataset.form === 'add') {
    e.preventDefault()
    submitAdd(form)
  } else if (form.dataset.form === 'search') {
    e.preventDefault()
    const q = new FormData(form).get('q').trim()
    if (!q) return
    state.query = q
    state.searching = true
    state.placeMsg = null
    rerenderPicker()
    try {
      state.results = await searchPlaces(q, lang())
    } catch {
      state.results = null
      state.placeMsg = tr('place.offline')
    }
    state.searching = false
    rerenderPicker()
  }
})

// Close dialogs when the backdrop is clicked.
for (const id of ['placeDialog', 'addDialog']) {
  document.getElementById(id).addEventListener('click', (e) => {
    if (e.target.tagName === 'DIALOG') e.target.close()
  })
}

// ---------- shell ----------
function renderShell() {
  document.documentElement.lang = lang()
  document.title = `Sundose — ${tr('tagline')}`
  $('#brand').innerHTML = `${logo}<span>Sundose</span>`
  $('#placeBtn').innerHTML = `${icons.pin}<span>${esc(placeLabel(state.place))}</span>`
  $('#placeBtn').setAttribute('aria-label', tr('place.change'))
  $('#langSel').innerHTML = LANGS.map(([code, name]) => `<option value="${code}" ${code === lang() ? 'selected' : ''}>${name}</option>`).join('')
  $('#langSel').setAttribute('aria-label', tr('language'))
  const navIcons = { today: icons.sun, bottles: icons.bottle, guide: icons.book, science: icons.gauge }
  const active = state.batches.filter((b) => !b.finished).length
  $('#tabs').innerHTML = TABS.map(
    (k) => `<a href="#${k}" class="${state.tab === k ? 'on' : ''}" ${state.tab === k ? 'aria-current="page"' : ''}>${navIcons[k]}<span>${tr(`nav.${k}`)}</span>${k === 'bottles' && active ? `<i class="badge">${active}</i>` : ''}</a>`,
  ).join('')
  $('#footer').innerHTML = `${tr('credit')} · <a href="#science">${tr('nav.science')}</a>`
}

function render() {
  renderShell()
  const view = { today: viewToday, bottles: viewBottles, guide: viewGuide, science: viewScience }[state.tab]
  $('#view').innerHTML = view()
}

window.addEventListener('hashchange', () => {
  state.tab = tabFromHash()
  render()
  window.scrollTo({ top: 0 })
})
$('#placeBtn').addEventListener('click', () => openPlaceDialog())
$('#langSel').addEventListener('change', (e) => {
  setLang(e.target.value)
  render()
  if ($('#placeDialog').open) renderPlaceDialog()
})
window.addEventListener('online', () => loadWx())
window.addEventListener('offline', () => render())

// Live updates: progress rings and "now" line move every 30 s; forecast refreshes hourly.
setInterval(() => {
  checkReadyAlerts()
  const typing = document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)
  if (!typing && ['today', 'bottles'].includes(state.tab)) render()
  if (state.wx && Date.now() - state.wx.fetchedAt > HOUR && navigator.onLine && !state.loading) loadWx()
}, 30e3)

render()
if (state.place) loadWx()
else loadBatchPlaces().then(render)
checkReadyAlerts()

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
