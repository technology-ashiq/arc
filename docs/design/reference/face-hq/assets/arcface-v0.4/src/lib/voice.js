// ─────────────────────────────────────────────────────────────
// arc voice engine — ears (SpeechRecognition) and mouth
// (speechSynthesis) with streaming support. The mind lives in
// src/brain/ (LLM when an engine key is set, offline matcher
// otherwise). The particle face subscribes to `bus` to animate
// its mouth from live speech energy.
// ─────────────────────────────────────────────────────────────
import { answer } from '../brain/brain.js'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const TTS = typeof window !== 'undefined' ? window.speechSynthesis : null

export const bus = {
  state: 'idle', // idle | listening | thinking | speaking
  level: 0, // 0..1 — live speech energy, drives the mouth particles
  transcript: '',
  reply: '',
  engine: 'offline', // offline | llm | error — which brain answered last
  started: false,
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

// ── mouth energy while speaking ──────────────────────────────
let levelTimer = null
function startLevelLoop() {
  stopLevelLoop()
  levelTimer = setInterval(() => {
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

// ── streaming speech: sentences queue as they complete ───────
let pendingUtterances = 0
let streamOpen = false

function utter(text) {
  if (!text.trim()) return
  if (!TTS) {
    // no TTS — fake the cadence so the face still talks
    setState('speaking')
    startLevelLoop()
    const ms = Math.min(9000, 260 * text.split(/\s+/).length)
    pendingUtterances++
    const kick = setInterval(() => (bus.level = Math.min(1, bus.level + 0.7 + 0.3 * Math.random())), 190)
    setTimeout(() => {
      clearInterval(kick)
      pendingUtterances--
      maybeIdle()
    }, ms)
    return
  }
  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice()
  if (v) u.voice = v
  u.rate = 1.02
  u.pitch = 1.0
  u.volume = 1.0
  pendingUtterances++
  u.onstart = () => {
    if (bus.state !== 'speaking') setState('speaking')
    bus.level = 1
    startLevelLoop()
  }
  u.onboundary = () => {
    bus.level = Math.min(1, bus.level + 0.85)
  }
  const done = () => {
    pendingUtterances--
    maybeIdle()
  }
  u.onend = done
  u.onerror = done
  TTS.speak(u)
}

function maybeIdle() {
  if (!streamOpen && pendingUtterances <= 0 && bus.state === 'speaking') {
    setState('idle')
    stopLevelLoop()
  }
}

export function speak(text) {
  // one-shot speech (offline brain, greetings)
  if (TTS) TTS.cancel()
  pendingUtterances = 0
  streamOpen = false
  bus.reply = text
  emit()
  utter(text)
  // if utter produced nothing (empty), settle back
  if (!text.trim()) setState('idle')
}

export function stopSpeaking() {
  if (TTS) TTS.cancel()
  pendingUtterances = 0
  streamOpen = false
  if (bus.state === 'speaking') setState('idle')
  stopLevelLoop()
}

// ── ask: transcript → brain (streaming) → spoken reply ──────
let sentenceBuf = ''
function pushDelta(delta) {
  bus.reply += delta
  emit()
  sentenceBuf += delta
  // speak every completed sentence as it lands
  const parts = sentenceBuf.split(/(?<=[.!?…])\s+/)
  while (parts.length > 1) {
    utter(parts.shift())
  }
  sentenceBuf = parts[0] || ''
}

export async function ask(text) {
  const clean = (text || '').trim()
  if (!clean) return
  if (TTS) TTS.cancel()
  pendingUtterances = 0
  bus.started = true
  bus.transcript = clean
  bus.reply = ''
  sentenceBuf = ''
  streamOpen = true
  setState('thinking')
  let streamed = false
  const res = await answer(clean, {
    onDelta: (d) => {
      streamed = true
      if (bus.state === 'thinking') setState('speaking')
      pushDelta(d)
    },
  })
  bus.engine = res.engine
  streamOpen = false
  if (!streamed) {
    // offline / error path — classic one-shot
    speak(res.say)
  } else {
    if (sentenceBuf.trim()) utter(sentenceBuf)
    sentenceBuf = ''
    bus.reply = res.say // final clean text (actions stripped)
    emit()
    maybeIdle()
  }
}

// ── microphone ───────────────────────────────────────────────
let rec = null
export function listen() {
  if (bus.state === 'listening') {
    try { rec && rec.stop() } catch { /* noop */ }
    return
  }
  stopSpeaking()
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
