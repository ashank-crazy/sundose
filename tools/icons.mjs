// Render the SVG app icons to PNG with headless Chrome.
import { readFileSync } from 'node:fs'
import { launch } from './cdp.mjs'

const jobs = [
  ['icons/app-icon.svg', 'icons/icon-192.png', 192],
  ['icons/app-icon.svg', 'icons/icon-512.png', 512],
  ['icons/app-icon-maskable.svg', 'icons/icon-maskable-512.png', 512],
]
for (const [src, out, size] of jobs) {
  const page = await launch({ width: size, height: size })
  const svg = readFileSync(src, 'utf8')
  await page.goto(`data:text/html,${encodeURIComponent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`)}`)
  await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  await page.shot(out)
  await page.close()
  console.log('wrote', out)
}
