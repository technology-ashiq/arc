// ─────────────────────────────────────────────────────────────
// Arc voice engine — listen (SpeechRecognition), think (local
// knowledge base), reply (speechSynthesis). No backend needed.
// The particle face subscribes to `bus` to animate its mouth.
// ─────────────────────────────────────────────────────────────
import { ARC } from '../data/arcKnowledge.js'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const TTS = typeof window !== 'undefined' ? window.speechSynthesis : null

export const bus = {
  state: 'idle', // idle | listening | thinking | speaking
  level: 0, // 0..1 — live speech energy, drives the mouth particles
  transcript: '',
  reply: '',
  started: false, // becomes true after the first interaction
  supported: { stt: !!SR, tts: !!TTS },
}

const listeners = new Set()
export function subscribe(fn) {
  listeners.add(fn)
  fn({ ...bus })
  return () => listeners.delete(fn)
}
function emit() {
  const snap = { ...bus }
  listeners.forEach((fn) => fn(snap))
}
function setState(state) {
  bus.state = state
  emit()
}

// ── the brain: keyword matching over the knowledge base ──────
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const FALLBACKS = [
  `Hmm, that one is not in my receipts yet. Ask me about Arc's products, the twenty-two commands, the twenty-three agents, the council, the gates, or where this is all heading.`,
  `I keep receipts, not guesses — and I don't have one for that. Try asking what Arc is, how the council votes, or what happens when a phase closes.`,
  `That's outside my ledger for now. But I can walk you through the pipeline, the autonomy ladder, or any command — just say its name.`,
]
let fallbackIdx = 0

function findCommand(q) {
  // match "/arc-review", "arc review"... longest names first so
  // "/arc-ship" wins over "/arc", with word boundaries around matches.
  const sorted = [...ARC.commands].sort((a, b) => b.name.length - a.name.length)
  for (const c of sorted) {
    const bare = c.name.replace('/', '')
    const spaced = bare.replace(/-/g, ' ')
    const hitBare = new RegExp(`(^|[^a-z-])${bare}($|[^a-z-])`).test(q)
    const hitSpaced = spaced !== bare && new RegExp(`(^|[^a-z-])${spaced}($|[^a-z-])`).test(q)
    if (hitBare || hitSpaced) {
      // plain "arc" is the product name, not the /arc command — only treat it
      // as the dashboard command when asked with the slash or as a command
      if (bare === 'arc' && !/\/arc|command|dashboard|status/.test(q)) continue
      return c
    }
  }
  return null
}
function findAgent(q) {
  for (const a of ARC.agents) {
    const spaced = a.name.replace(/-/g, ' ')
    if (q.includes(a.name) || q.includes(spaced)) return a
  }
  return null
}
function findProduct(q) {
  for (const p of ARC.products) {
    if (q.includes(` ${p.id}`) || q.startsWith(p.id) || q.includes(`${p.id} product`) || q.includes(`product ${p.id}`)) return p
  }
  return null
}

export function think(raw) {
  const q = ' ' + norm(raw) + ' '

  // 1. exact entity lookups first — every command & agent is addressable
  const cmd = findCommand(q)
  if (cmd && /command|panra|pannum|enna|what|does|do|explain|how|use|sollu|about|\//.test(q)) {
    return `${cmd.name} — ${cmd.short}. ${cmd.detail}`
  }
  const agent = findAgent(q)
  if (agent) {
    return `${agent.name} is one of my ${ARC.agents.length} agents, from the ${agent.group} side. ${agent.role}`
  }

  // 2. counts
  if (/how many|count|evlo|ethana/.test(q)) {
    if (/product/.test(q)) return `Six products: ${ARC.products.map((p) => p.id).join(', ')}. Each one installs on its own — core is the only must-have.`
    if (/command/.test(q)) return `Twenty-two slash commands, all starting with arc. The daily drivers are /arc-kickoff, /arc-review, /arc-qa, /arc-ship and /arc-retro.`
    if (/agent/.test(q)) return `Twenty-three specialist agents. Twelve sit on the council alone — advocate, skeptic, verifier and their colleagues.`
  }

  // 3. product deep-dive
  const prod = findProduct(q)
  if (prod && /product|pathi|about|what|enna|explain|tell/.test(q)) {
    return `The ${prod.id} product — ${prod.purpose}`
  }

  // 4. scored keyword match over the QA bank
  let best = null
  let bestScore = 0
  for (const item of ARC.qa) {
    let score = 0
    for (const k of item.keywords) {
      if (q.includes(' ' + k + ' ') || q.includes(k)) score += k.length + 2
    }
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }
  if (best && bestScore >= 5) return best.answer

  // 5. fallback
  const f = FALLBACKS[fallbackIdx % FALLBACKS.length]
  fallbackIdx++
  return f
}

// ── mouth energy while speaking ──────────────────────────────
let levelTimer = null
function startLevelLoop() {
  stopLevelLoop()
  levelTimer = setInterval(() => {
    // natural decay + tiny idle jitter while speaking
    bus.level = Math.max(0, bus.level * 0.82 + (bus.state === 'speaking' ? 0.06 * Math.random() : 0))
    if (bus.state !== 'speaking' && bus.level < 0.01) stopLevelLoop()
  }, 50)
}
function stopLevelLoop() {
  if (levelTimer) clearInterval(levelTimer)
  levelTimer = null
  if (bus.state !== 'speaking') bus.level = 0
}

function pickVoice() {
  if (!TTS) return null
  const voices = TTS.getVoices()
  const prefer = [
    (v) => /en-IN/i.test(v.lang) && /female|neural|natural/i.test(v.name),
    (v) => /en-IN/i.test(v.lang),
    (v) => /Google UK English Female/i.test(v.name),
    (v) => /en-GB/i.test(v.lang),
    (v) => /en/i.test(v.lang),
  ]
  for (const rule of prefer) {
    const v = voices.find(rule)
    if (v) return v
  }
  return voices[0] || null
}

export function speak(text) {
  bus.reply = text
  if (!TTS) {
    // no TTS — simulate the cadence so the face still talks
    setState('speaking')
    startLevelLoop()
    const ms = Math.min(9000, 260 * text.split(/\s+/).length)
    const kick = setInterval(() => (bus.level = Math.min(1, bus.level + 0.7 + 0.3 * Math.random())), 190)
    setTimeout(() => {
      clearInterval(kick)
      setState('idle')
      stopLevelLoop()
    }, ms)
    return
  }
  TTS.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice()
  if (v) u.voice = v
  u.rate = 1.02
  u.pitch = 1.0
  u.volume = 1.0
  u.onstart = () => {
    setState('speaking')
    bus.level = 1
    startLevelLoop()
  }
  u.onboundary = () => {
    bus.level = Math.min(1, bus.level + 0.85)
  }
  const done = () => {
    setState('idle')
    stopLevelLoop()
  }
  u.onend = done
  u.onerror = done
  TTS.speak(u)
}

export function ask(text) {
  const clean = (text || '').trim()
  if (!clean) return
  bus.started = true
  bus.transcript = clean
  bus.reply = ''
  setState('thinking')
  setTimeout(() => {
    const answer = think(clean)
    speak(answer)
    emit()
  }, 420)
}

// ── microphone ───────────────────────────────────────────────
let rec = null
export function listen() {
  if (bus.state === 'listening') {
    try { rec && rec.stop() } catch { /* noop */ }
    return
  }
  if (TTS) TTS.cancel()
  stopLevelLoop()
  if (!SR) {
    bus.started = true
    bus.reply = 'This browser has no speech recognition — type your question below instead, I can still talk back.'
    setState('idle')
    speak(bus.reply)
    return
  }
  rec = new SR()
  rec.lang = 'en-IN'
  rec.interimResults = true
  rec.continuous = false
  bus.started = true
  bus.transcript = ''
  bus.reply = ''
  setState('listening')
  let finalText = ''
  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) finalText += t
      else interim += t
    }
    bus.transcript = (finalText || interim).trim()
    emit()
  }
  rec.onerror = () => {
    setState('idle')
    if (!finalText) {
      bus.reply = 'I could not hear you — check the mic permission, or just type the question.'
      emit()
    }
  }
  rec.onend = () => {
    if (finalText.trim()) ask(finalText)
    else if (bus.state === 'listening') setState('idle')
  }
  try {
    rec.start()
  } catch {
    setState('idle')
  }
}

export function greet() {
  if (bus.started) return
  ask('hello')
}
