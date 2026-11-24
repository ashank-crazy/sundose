// Minimal Chrome DevTools Protocol driver used for icons, screenshots and smoke tests.
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export async function launch({ width = 1280, height = 800, scale = 1, mobile = false, port = 9337 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sundose-chrome-'))
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${width},${height}`,
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb', '--lang=en-US',
  ], { stdio: 'ignore' })
  for (let i = 0; i < 100; i++) {
    try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break } catch { await new Promise((r) => setTimeout(r, 100)) }
  }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  let id = 0
  const pending = new Map()
  const listeners = []
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? rej(new Error(m.error.message)) : res(m.result)
    } else if (m.method) listeners.forEach((f) => f(m))
  })
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
  const logs = []
  listeners.push((m) => {
    if (m.method === 'Runtime.consoleAPICalled') logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`)
    if (m.method === 'Runtime.exceptionThrown') logs.push(`exception: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`)
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile })
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const page = {
    send, logs,
    async goto(url) {
      const loaded = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(f), 1); r() } }; listeners.push(f) })
      await send('Page.navigate', { url })
      await loaded
    },
    async reload() {
      const loaded = new Promise((r) => { const f = (m) => { if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(f), 1); r() } }; listeners.push(f) })
      await send('Page.reload', { ignoreCache: true })
      await loaded
    },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
      return r.result.value
    },
    async shot(path, { fullPage = false, clip } = {}) {
      const { writeFileSync } = await import('node:fs')
      const params = { format: 'png', captureBeyondViewport: fullPage }
      if (fullPage) {
        const h = await page.eval('document.documentElement.scrollHeight')
        params.clip = { x: 0, y: 0, width, height: h, scale: 1 }
      }
      if (clip) params.clip = { ...clip, scale: 1 }
      const { data } = await send('Page.captureScreenshot', params)
      writeFileSync(path, Buffer.from(data, 'base64'))
    },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    async close() { try { ws.close() } catch {} proc.kill() },
  }
  return page
}
