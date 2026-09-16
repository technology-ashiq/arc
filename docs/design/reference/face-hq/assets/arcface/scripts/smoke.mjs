// smoke.mjs — headless Chrome over raw CDP (Node 24 built-in WebSocket).
// 1) opens every room via #hq/<room>, collects exceptions + console errors, screenshots
// 2) runs write-path flows per room by clicking real buttons and typing into real inputs
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://127.0.0.1:4173/'
// usage: node scripts/smoke.mjs            (needs `npx vite preview --port 4173` running; Chrome at CHROME)
//        FLOWS=flows.mjs node scripts/smoke.mjs   → flows only, from a clean workspace log
const OUT = path.join(process.cwd(), '.shots')
fs.mkdirSync(OUT, { recursive: true })
const PROFILE = path.join(OUT, 'profile')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9337

const chrome = spawn(CHROME, [`--headless=new`, `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1440,1000', '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' })
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
  const { FLOWS } = await import(process.env.FLOWS ? './' + process.env.FLOWS : './flows.mjs')
  const SKIP_RENDER = !!process.env.FLOWS
  await waitPort()
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  const cdp = new CDP(ws)
  const errors = []
  cdp.on('Runtime.exceptionThrown', (p) => errors.push({ room: current, type: 'exception', text: (p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text }))
  cdp.on('Runtime.consoleAPICalled', (p) => { const txt = p.args.map((a) => a.value || a.description || '').join(' '); if ((p.type === 'error' || p.type === 'warning') && !/THREE\.Clock/.test(txt)) errors.push({ room: current, type: 'console.' + p.type, text: p.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300) }) })
  cdp.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') errors.push({ room: current, type: 'log', text: p.entry.text.slice(0, 300) }) })
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  let current = 'boot'
  let loaded
  cdp.on('Page.loadEventFired', () => loaded && loaded())

  const evalJs = async (expr) => { const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
  const go = async (room, i) => {
    current = room
    const p = new Promise((r) => (loaded = r))
    await cdp.send('Page.navigate', { url: `${BASE}?r=${i}#hq/${room}` })
    await Promise.race([p, sleep(8000)])
    await sleep(900)
  }
  const shot = async (name) => { const r = await cdp.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64')) }

  // helpers injected into the page for the flows
  const HELPERS = `
    window.$$btn = (t) => [...document.querySelectorAll('.room-enter button')].find(b => b.textContent.trim().toLowerCase().includes(t.toLowerCase()));
    window.$$btns = (t) => [...document.querySelectorAll('.room-enter button')].filter(b => b.textContent.trim().toLowerCase().includes(t.toLowerCase()));
    window.$$input = (ph) => [...document.querySelectorAll('.room-enter input, .room-enter textarea')].find(i => (i.placeholder||'').toLowerCase().includes(ph.toLowerCase()));
    window.$$type = (el, v) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    window.$$click = (t) => { const b = window.$$btn(t); if (!b) throw new Error('no button: ' + t); b.click(); return true };
    window.$$text = () => document.body.innerText;
    window.$$has = (t) => document.body.innerText.toLowerCase().includes(t.toLowerCase());
    window.$$wait = (ms) => new Promise(r => setTimeout(r, ms));
    window.$$ws = () => JSON.parse(localStorage.getItem('arcface.ws.v1') || '[]');
    true`

  const ROOMS = ['overview','inbox','map','spine','board','ask-arc','engine','model-policy','policy','scheduler','memory','evolve','bench','absorb','council','develop','review-ship','design-studio','toolbelt','factory','executor','agents','money','growth','leads','legal','ventures','ops','trader','discover','law','learn','strategy','org','concepts','story']
  const SENTENCE = { inbox: 'Only you may decide it', map: 'not on this map', board: 'what it is burning', 'ask-arc': 'carries its receipt', 'model-policy': 'Tiers are law', policy: 'Deny by default', scheduler: 'someone remembered', memory: 'made twice becomes a rule', evolve: 'Measured, or it did not improve', develop: 'closes on evidence', 'review-ship': 'Every gate blocks', toolbelt: 'one place to look', ventures: 'factory is not the product', ops: 'Two live ventures away', trader: 'Paper only', discover: 'chosen, not stumbled', strategy: 'One plan is live', org: 'Sixteen lanes', concepts: 'Every word arc uses' }

  const report = { rooms: [], flows: [], errors }
  // pass 1 — render every room
  for (let i = 0; i < ROOMS.length && !SKIP_RENDER; i++) {
    const room = ROOMS[i]
    const before = errors.length
    await go(room, i)
    const h1 = await evalJs(`(document.querySelector('main h1')||{}).textContent || ''`)
    const len = await evalJs(`document.body.innerText.length`)
    const ok = SENTENCE[room] ? h1.toLowerCase().includes(SENTENCE[room].toLowerCase()) : h1.length > 0
    report.rooms.push({ room, h1: h1.slice(0, 70), textLen: len, sentenceOk: ok, newErrors: errors.length - before })
    await shot('room-' + room)
    process.stdout.write(`${ok && errors.length === before ? 'ok ' : 'XX '} ${room.padEnd(14)} ${String(len).padStart(6)}  ${h1.slice(0, 60)}\n`)
  }

  // pass 2 — write-path flows (each runs inside the room, returns a check) — from a clean workspace log
  await go('overview', 99); await evalJs(`localStorage.removeItem('arcface.ws.v1'); true`)
  for (let i = 0; i < FLOWS.length; i++) {
    const [room, body] = FLOWS[i]
    const before = errors.length
    await go(room, 100 + i)
    await evalJs(HELPERS)
    let result
    if (process.env.PROBE) { result = await evalJs(`({ inputs: [...document.querySelectorAll('.room-enter input, .room-enter textarea')].map(i => i.placeholder || i.type), buttons: [...new Set([...document.querySelectorAll('.room-enter button')].map(b => b.textContent.trim().slice(0,28)))].slice(0,60) })`); report.flows.push({ room, result }); process.stdout.write(['PROBE ' + room, '  inputs: ' + JSON.stringify(result.inputs), '  buttons: ' + JSON.stringify(result.buttons), ''].join(String.fromCharCode(10))); continue }
    try { result = await evalJs(`(async () => { ${body} })()`) } catch (e) { result = { error: String(e.message).slice(0, 200) } }
    await sleep(200)
    await shot('flow-' + room)
    report.flows.push({ room, result, newErrors: errors.length - before })
    process.stdout.write(`flow ${room.padEnd(14)} ${JSON.stringify(result)}${errors.length - before ? '  ERRORS ' + (errors.length - before) : ''}\n`)
  }
  // reload persistence: counts survive
  await go('spine', 999)
  const persisted = await evalJs(`JSON.parse(localStorage.getItem('arcface.ws.v1')||'[]').length`)
  report.persisted = persisted
  process.stdout.write(`persisted ws events after reload: ${persisted}\n`)
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1))
  process.stdout.write(`errors: ${errors.length}\n` + errors.slice(0, 20).map((e) => `  [${e.room}] ${e.type}: ${e.text}`).join('\n') + '\n')
  ws.close()
  chrome.kill()
}
main().catch((e) => { console.error('smoke failed:', e); chrome.kill(); process.exit(1) })
