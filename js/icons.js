// Hand-drawn inline SVG icons: no icon font or image downloads, so the app stays tiny on 2G.
const s = (body, extra = '') =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`

const rays =
  '<path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.35 5.35l1.55 1.55M17.1 17.1l1.55 1.55M5.35 18.65l1.55-1.55M17.1 6.9l1.55-1.55"/>'
const cloudPath = 'M7.4 19h9.7a3.6 3.6 0 0 0 .5-7.17 5.2 5.2 0 0 0-10-.9A3.9 3.9 0 0 0 7.4 19z'

export const icons = {
  sun: s(`<circle cx="12" cy="12" r="4.3"/>${rays}`),
  cloudSun: s(
    `<path d="M9 3.2v1.6M3.2 9h1.6M4.9 4.9l1.1 1.1M13.1 4.9 12 6"/><path d="M5.6 11.4A3.8 3.8 0 0 1 12.4 7"/><path d="M9.2 20h8.6a3.3 3.3 0 0 0 .4-6.55 4.7 4.7 0 0 0-9-.8A3.6 3.6 0 0 0 9.2 20z"/>`,
  ),
  cloud: s(`<path d="${cloudPath}"/>`),
  rain: s(
    `<path d="M7.4 15h9.7a3.6 3.6 0 0 0 .5-7.17 5.2 5.2 0 0 0-10-.9A3.9 3.9 0 0 0 7.4 15z"/><path d="M8.5 18l-1 2.4M12.5 18l-1 2.4M16.5 18l-1 2.4"/>`,
  ),
  bottle: s(
    `<path d="M10.2 2.6h3.6M10.6 2.6v3.1L8.4 8.4a2 2 0 0 0-.45 1.27V20a1.4 1.4 0 0 0 1.4 1.4h5.3a1.4 1.4 0 0 0 1.4-1.4V9.67a2 2 0 0 0-.45-1.27L13.4 5.7V2.6"/><path d="M8 13.2c1.3-.7 2.7-.7 4 0s2.7.7 4 0"/>`,
  ),
  book: s(
    `<path d="M12 6.2C10.4 4.9 8 4.4 4 4.6v13.6c4-.2 6.4.3 8 1.6 1.6-1.3 4-1.8 8-1.6V4.6c-4-.2-6.4.3-8 1.6z"/><path d="M12 6.2v13.6"/>`,
  ),
  gauge: s(`<path d="M3.8 17a8.2 8.2 0 1 1 16.4 0"/><path d="M12 17l3.6-5"/><circle cx="12" cy="17" r="1.2"/>`),
  pin: s(`<path d="M12 21.2s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0c0 5.4-6.6 11.1-6.6 11.1z"/><circle cx="12" cy="10" r="2.4"/>`),
  locate: s(`<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>`),
  search: s(`<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.4 15.4l5.2 5.2"/>`),
  share: s(`<circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="M8.2 10.9l7.1-3.7M8.2 13.1l7.1 3.7"/>`),
  chat: s(`<path d="M4.5 19.5l1.2-3.6A7.8 7.8 0 1 1 8.6 18.6z"/><path d="M9 10.5h6M9 13.5h4"/>`),
  print: s(`<path d="M7 9V3.6h10V9"/><rect x="3.6" y="9" width="16.8" height="7.6" rx="1.6"/><path d="M7 14h10v6.4H7z"/>`),
  calendar: s(`<rect x="3.6" y="5" width="16.8" height="15.4" rx="2"/><path d="M3.6 9.6h16.8M8 3v4M16 3v4"/><path d="M9.2 14.6l2 1.9 3.8-3.8"/>`),
  check: s(`<path d="M5 12.6l4.4 4.4L19 7.4"/>`),
  dot: s(`<circle cx="12" cy="12" r="4.2"/>`),
  x: s(`<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`),
  plus: s(`<path d="M12 5v14M5 12h14"/>`),
  minus: s(`<path d="M5 12h14"/>`),
  trash: s(`<path d="M4.5 6.8h15M9.6 6.8V4.4h4.8v2.4M6.6 6.8l.9 12.8a1.4 1.4 0 0 0 1.4 1.3h6.2a1.4 1.4 0 0 0 1.4-1.3l.9-12.8"/>`),
  bell: s(`<path d="M6.4 16.6V11a5.6 5.6 0 0 1 11.2 0v5.6l1.6 1.8H4.8z"/><path d="M10 20.6a2.2 2.2 0 0 0 4 0"/>`),
  refresh: s(`<path d="M19.4 12a7.4 7.4 0 1 1-2.2-5.2"/><path d="M19.6 4.4v4.2h-4.2"/>`),
  globe: s(`<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.4 2.4 3.4 5.3 3.4 8.6s-1 6.2-3.4 8.6c-2.4-2.4-3.4-5.3-3.4-8.6s1-6.2 3.4-8.6z"/>`),
  drop: s(`<path d="M12 3.2s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/>`),
  wifiOff: s(`<path d="M3.5 3.5l17 17M8.6 13.4a5 5 0 0 1 6.1-.5M5.3 10.2a9.6 9.6 0 0 1 4-2.1M18.7 10.2a9.6 9.6 0 0 0-5.3-2.5M12 18.6h.01"/>`),
}

export const weatherIcon = (verdict) => (verdict === 'rain' ? icons.rain : verdict === 'two' ? icons.cloudSun : icons.sun)

// Brand mark: a bottle holding the sun.
export const logo = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M27 4.5h10a1.5 1.5 0 0 1 1.5 1.5v4.5H25.5V6A1.5 1.5 0 0 1 27 4.5z" fill="var(--ink)"/>
  <path d="M26.5 10.5h11v4.2l6.9 7.6a6 6 0 0 1 1.6 4.05V55a5 5 0 0 1-5 5H23a5 5 0 0 1-5-5V26.35a6 6 0 0 1 1.6-4.05l6.9-7.6z" fill="var(--water-soft)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>
  <path d="M19.5 40c4.2-2.4 8.4-2.4 12.5 0s8.3 2.4 12.5 0V55a3.5 3.5 0 0 1-3.5 3.5H23a3.5 3.5 0 0 1-3.5-3.5z" fill="var(--water)"/>
  <circle cx="32" cy="31" r="7" fill="var(--sun)"/>
</svg>`

// Larger colour illustrations for the six steps of the guide.
const B = 'var(--ink)'
const bottleSide = (x, y, fill = 'var(--water-soft)', level = 0.75, rot = 0) => {
  const h = 54
  const top = y + h * (1 - level)
  return `<g transform="rotate(${rot} ${x + 11} ${y + 27})">
    <rect x="${x + 7}" y="${y - 10}" width="8" height="5" rx="1.2" fill="${B}"/>
    <path d="M${x + 7.5} ${y - 5}h7v4l5 5.5a4 4 0 0 1 1 2.6V${y + h}a3 3 0 0 1-3 3H${x + 3.5}a3 3 0 0 1-3-3V${y + 7.1}a4 4 0 0 1 1-2.6l5-5.5z" fill="${fill}" stroke="${B}" stroke-width="2.4" stroke-linejoin="round"/>
    ${level > 0 ? `<path d="M${x + 1.8} ${top}h18.4V${y + h - 0.5}a2 2 0 0 1-2 2H${x + 3.8}a2 2 0 0 1-2-2z" fill="var(--water)" opacity=".85"/>` : ''}
  </g>`
}

// A full bottle lying on its side, neck to the right.
const bottleFlat = (x, y, len = 30, h = 11) => `<g>
    <path d="M${x + 3} ${y}h${len - 13}l5 ${h / 2 - 2.6}h3v5.2h-3l-5 ${h / 2 - 2.6}H${x + 3}a3 3 0 0 1-3-3v-${h - 6}a3 3 0 0 1 3-3z" fill="var(--water)" stroke="${B}" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="${x + len - 5}" y="${y + h / 2 - 3.4}" width="4" height="6.8" rx="1" fill="${B}"/>
    <path d="M${x + 4} ${y + 2.6}h${len - 18}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
  </g>`

export const steps = [
  // 1. clear PET bottle
  `<svg viewBox="0 0 120 90" aria-hidden="true">
    <circle cx="60" cy="47" r="36" fill="var(--sun-soft)"/>
    ${bottleSide(49, 22, '#fff', 0)}
    <circle cx="86" cy="64" r="12" fill="var(--ok)"/><path d="M80.5 64.3l3.8 3.8 7.2-7.6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  // 2. headline test
  `<svg viewBox="0 0 120 90" aria-hidden="true">
    <rect x="18" y="56" width="84" height="28" rx="3" fill="#fff" stroke="${B}" stroke-width="2.4"/>
    <path d="M27 64h30M27 71h24M27 77h28M66 64h26M66 71h20M66 77h24" stroke="${B}" stroke-width="2.4" stroke-linecap="round" opacity=".35"/>
    <text x="60" y="66" text-anchor="middle" font-size="9" font-weight="800" fill="${B}" font-family="system-ui">NEWS</text>
    <ellipse cx="60" cy="18" rx="12" ry="7" fill="#fff" stroke="${B}" stroke-width="2.4"/><circle cx="60" cy="18" r="3.4" fill="${B}"/>
    <path d="M60 28v22" stroke="var(--sun-deep)" stroke-width="2.4" stroke-dasharray="3 4" stroke-linecap="round"/>
    <path d="M55 45l5 6 5-6" fill="none" stroke="var(--sun-deep)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  // 3. fill three-quarters and shake
  `<svg viewBox="0 0 120 90" aria-hidden="true">
    <circle cx="60" cy="47" r="36" fill="var(--water-soft)"/>
    ${bottleSide(49, 24, '#fff', 0.72, -14)}
    <path d="M26 30c-5 8-5 22 0 30M33 36c-3 5-3 13 0 18M94 30c5 8 5 22 0 30M87 36c3 5 3 13 0 18" fill="none" stroke="var(--water)" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`,
  // 4. bottles on a metal roof in the sun
  `<svg viewBox="0 0 120 90" aria-hidden="true">
    <circle cx="94" cy="20" r="11" fill="var(--sun)"/>
    <path d="M94 2v4M94 34v4M76 20h4M108 20h4M81.3 7.3l2.8 2.8M103.9 29.9l2.8 2.8M81.3 32.7l2.8-2.8M103.9 10.1l2.8-2.8" stroke="var(--sun-deep)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M4 80l16-36h88l-10 36z" fill="#cfd6df" stroke="${B}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M30 44l-15 36M46 44l-13 36M62 44l-11 36M78 44l-9 36M94 44l-7 36" stroke="${B}" stroke-width="1.6" opacity=".3"/>
    ${bottleFlat(24, 48)}${bottleFlat(62, 48)}${bottleFlat(17, 64)}${bottleFlat(55, 64)}
  </svg>`,
  // 5. Sundose tracks the dose
  `<svg viewBox="0 0 120 90" aria-hidden="true">
    <circle cx="60" cy="47" r="30" fill="none" stroke="var(--line)" stroke-width="9"/>
    <circle cx="60" cy="47" r="30" fill="none" stroke="var(--sun)" stroke-width="9" stroke-linecap="round" stroke-dasharray="141 189" transform="rotate(-90 60 47)"/>
    <circle cx="60" cy="47" r="10" fill="var(--sun)"/>
    <path d="M60 30v-3M60 67v-3M43 47h-3M80 47h-3" stroke="var(--sun-deep)" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`,
  // 6. drink from the bottle
  `<svg viewBox="0 0 120 90" aria-hidden="true">
    <circle cx="60" cy="47" r="36" fill="var(--ok-soft)"/>
    ${bottleSide(30, 18, '#fff', 0.6, 38)}
    <path d="M70 52h28l-3.5 26a3 3 0 0 1-3 2.6H76.5a3 3 0 0 1-3-2.6z" fill="#fff" stroke="${B}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M72.2 62h25.6l-2.4 16H74.6z" fill="var(--water)" opacity=".85"/>
    <path d="M64 44c3 3 6 7 8 13" stroke="var(--water)" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`,
]
