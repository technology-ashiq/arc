// shots.mjs — screenshot a few rooms in BOTH moods (dark + light) at desktop
// and phone widths. Raw CDP, no puppeteer. Needs `npx vite preview --port 4173`.
//   node scripts/shots.mjs                      → overview inbox board money
//   ROOMS=council,org node scripts/shots.mjs     → your pick
//   THEMES=light node scripts/shots.mjs          → one mood only
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173/'
const OUT = path.join(process.cwd(), '.shots')
fs.mkdirSync(OUT, { recursive: true })
const PROFILE = path.join(OUT, 'profile-shots-' + process.pid) // fresh per run: a lingering Chrome on a shared profile would answer instead of ours
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9338
const ROOMS = (process.env.ROOMS || 'overview,inbox,board,money').split(',')
const THEMES = (process.env.THEMES || 'dark,light').split(',')
const SIZES = (process.env.SIZES || 'desktop').split(',')
const DIM = { desktop: [1440, 1000], phone: [400, 860], laptop: [1280, 800] }

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1440,1000', '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitPort() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return await r.json() } catch { /* not yet */ }
    await sleep(250)
  }
  throw new Error('chrome did not open the debugging port')
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map(); ws.onmessage = (m) => this.onMsg(JSON.parse(m.data)) }
  onMsg(m) {
    if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result) }
    else if (m.method && this.handlers.has(m.method)) for (const h of this.handlers.get(m.method)) h(m.params)
  }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.pending.set(id, { res, rej })) }
  on(method, h) { if (!this.handlers.has(method)) this.handlers.set(method, []); this.handlers.get(method).push(h) }
}

async function main() {
  await waitPort()
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  const cdp = new CDP(ws)
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
  let loaded
  cdp.on('Page.loadEventFired', () => loaded && loaded())
  const evalJs = async (expr) => { const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
  let n = 0
  for (const size of SIZES) {
    const [w, h] = DIM[size] || DIM.desktop
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: size === 'phone' })
    for (const theme of THEMES) {
      // the mood is read on mount, so it is written before any page script runs
      const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('arc-hq-theme', '${theme}') } catch (e) {}` })
      for (const room of ROOMS) {
        const p = new Promise((r) => (loaded = r))
        // 'landing' shoots the front door; anything else is a room
        await cdp.send('Page.navigate', { url: room === 'landing' ? `${BASE}?s=${++n}` : `${BASE}?s=${++n}#hq/${room}` })
        await p
        await sleep(process.env.WAIT ? Number(process.env.WAIT) : 900)
        const mood = await evalJs(`document.documentElement.classList.contains('hq-light') ? 'light' : 'dark'`)
        if (mood !== theme) process.stdout.write(`  (warning: page is ${mood}, wanted ${theme})\n`)
        // PLAY=<ms> presses play and lets the day run; OPEN=palette opens ⌘K before
        // the shot; OPEN=receipt opens the first receipt drawer (after PLAY, so there is one)
        if (process.env.PLAY) { await evalJs(`(async()=>{const b=[...document.querySelectorAll('button')].find(b=>/Play the day/.test(b.textContent));b&&b.click();await new Promise(r=>setTimeout(r,${process.env.PLAY}));})()`) }
        if (process.env.OPEN === 'palette') { await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); true`); await sleep(250) }
        if (process.env.OPEN === 'receipt') { await evalJs(`[...document.querySelectorAll('button')].find(b => /^⌗/.test(b.textContent.trim()))?.click(); true`); await sleep(350) }
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
        const file = path.join(OUT, `${size === 'desktop' ? '' : size + '-'}${theme}-${room}.png`)
        fs.writeFileSync(file, Buffer.from(data, 'base64'))
        process.stdout.write(`shot ${path.basename(file)}\n`)
      }
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
    }
  }
  ws.close()
  chrome.kill()
  setTimeout(() => { try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch { /* fine */ } }, 800)
}
main().catch((e) => { console.error('shots failed:', e); chrome.kill(); process.exit(1) })
