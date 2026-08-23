// ─────────────────────────────────────────────────────────────
// The in-app spine — an append-only event store with a virtual
// clock. Every panel in HQ is a derived view over `events`; user
// actions APPEND events (decision.recorded, autonomy.changed…),
// they never mutate history. Exactly arc's ideology, running in
// the browser. Data source: the simulator (default, labeled
// SIMULATED) or the real spine via the dev API (read-only).
// ─────────────────────────────────────────────────────────────
import { makeDay, HISTORY_DAYS, DAY_START, DAY_END } from './sim.js'
import { fakeUlid } from './kinds.js'

const listeners = new Set()
let version = 0

export const spine = {
  source: 'sim', // 'sim' | 'real'
  dayIndex: HISTORY_DAYS, // today
  clock: DAY_START, // sim-minutes since 00:00
  speed: 10, // sim-minutes per real second (0 = paused)
  events: [], // revealed events, all days, append-only
  schedule: [], // today's not-yet-revealed beats
  pendingApprovals: [], // live queue
  ladderOverrides: {}, // capability -> level (autonomy.changed effects)
  realMeta: null, // when source==='real': {files, count, note}
  ulidSeed: 7001,
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function getVersion() {
  return version
}
function notify() {
  version++
  listeners.forEach((fn) => fn(version))
}

function reveal(ev) {
  spine.events.push(ev)
  if (ev.kind === 'approval.requested' && ev.approval) {
    spine.pendingApprovals.push({ ...ev.approval, eventId: ev.id, day: ev.day, t: ev.t })
  }
}

// ── boot: generate history + today's schedule ──
export function boot() {
  spine.events = []
  spine.pendingApprovals = []
  spine.ladderOverrides = {}
  for (let d = 0; d < HISTORY_DAYS; d++) {
    const { beats } = makeDay(d)
    beats.forEach((b) => {
      // history: approvals auto-resolved by "past Ashiq" so the queue is only today's
      if (b.kind === 'approval.requested' && b.approval) {
        spine.events.push(b)
        spine.events.push({
          id: fakeUlid(spine.ulidSeed++),
          day: d,
          t: Math.min(b.t + 37, DAY_END - 5),
          kind: 'decision.recorded',
          module: 'hq',
          level: 'human',
          text: `${b.approval.title} — approved · reason: evidence verified`,
          payload: { approved: true, ref: b.id },
        })
      } else {
        spine.events.push(b)
      }
    })
    spine.events.push({
      id: fakeUlid(spine.ulidSeed++),
      day: d,
      t: DAY_END,
      kind: 'day.closed',
      module: 'hq',
      level: 'auto',
      text: `day closed · ${beats.length + 1} receipts · file sha pinned`,
      payload: { events: beats.length + 1 },
    })
  }
  const today = makeDay(spine.dayIndex)
  spine.schedule = today.beats.slice()
  spine.clock = DAY_START
  // reveal anything scheduled before the opening clock
  drainDue()
  notify()
}

function drainDue() {
  while (spine.schedule.length && spine.schedule[0].t <= spine.clock) {
    reveal(spine.schedule.shift())
  }
}

// ── the clock ──
let timer = null
let lastClockNotify = 0
export function startClock() {
  if (timer) return
  let last = performance.now()
  timer = setInterval(() => {
    const now = performance.now()
    const dt = (now - last) / 1000
    last = now
    if (spine.speed <= 0 || spine.source === 'real') return
    const before = spine.events.length
    spine.clock = Math.min(spine.clock + dt * spine.speed, DAY_END + 1)
    drainDue()
    if (spine.clock > DAY_END) {
      // close the day, roll to the next simulated day
      reveal({
        id: fakeUlid(spine.ulidSeed++),
        day: spine.dayIndex,
        t: DAY_END,
        kind: 'day.closed',
        module: 'hq',
        level: 'auto',
        text: 'day closed · receipts sealed · replay-verified',
        payload: {},
      })
      spine.dayIndex++
      const next = makeDay(spine.dayIndex)
      spine.schedule = next.beats.slice()
      spine.clock = DAY_START
    }
    if (spine.events.length !== before) notify()
    else if (now - lastClockNotify > 2000) {
      lastClockNotify = now
      notify() // keep the clock label ticking without render churn
    }
  }, 300)
}

export function setSpeed(s) {
  spine.speed = s
  notify()
}

// ── user actions → events (the only way state changes) ──
export function recordDecision(approvalId, approved, reason, actionLabel) {
  const idx = spine.pendingApprovals.findIndex((a) => a.id === approvalId)
  if (idx === -1) return null
  const ap = spine.pendingApprovals[idx]
  spine.pendingApprovals.splice(idx, 1)
  const ev = {
    id: fakeUlid(spine.ulidSeed++),
    day: spine.dayIndex,
    t: spine.clock,
    kind: 'decision.recorded',
    module: 'hq',
    level: 'human',
    text: `${ap.title} — ${approved ? (actionLabel || 'approved') : 'rejected'} · reason: ${reason}`,
    payload: { approved, reason, ref: ap.eventId, action: actionLabel || null },
    decided: { ...ap, approved, reason, actionLabel },
  }
  reveal(ev)
  notify()
  return ev
}

export function changeAutonomy(capability, from, to, evidence) {
  spine.ladderOverrides[capability] = to
  const ev = {
    id: fakeUlid(spine.ulidSeed++),
    day: spine.dayIndex,
    t: spine.clock,
    kind: 'autonomy.changed',
    module: 'hq',
    level: 'human',
    text: `${capability} ${from}→${to} · ${evidence}`,
    payload: { capability, from, to, evidence },
  }
  reveal(ev)
  notify()
  return ev
}

export function logNote(text, module = 'hq') {
  const ev = {
    id: fakeUlid(spine.ulidSeed++),
    day: spine.dayIndex,
    t: spine.clock,
    kind: 'note.logged',
    module,
    level: 'auto',
    text,
    payload: {},
  }
  reveal(ev)
  notify()
  return ev
}

export function appendCouncilVerdict(question, verdict, confidence, dissent) {
  const ev = {
    id: fakeUlid(spine.ulidSeed++),
    day: spine.dayIndex,
    t: spine.clock,
    kind: 'council.verdict',
    module: 'council',
    level: 'L1',
    text: `“${question}” → ${verdict} (${confidence}) · dissent: ${dissent}`,
    payload: { question, verdict, confidence, dissent, session: 'live-demo' },
  }
  reveal(ev)
  notify()
  return ev
}

// ── real spine (dev API, read-only) ──
export async function tryConnectRealSpine() {
  try {
    const r = await fetch('/api/spine?days=14')
    if (!r.ok) return { ok: false, reason: 'api-unavailable' }
    const data = await r.json()
    if (!data.configured) return { ok: false, reason: 'not-configured' }
    // map real events into the render shape, best-effort + honest raw
    const mapped = (data.events || []).map((e, i) => {
      const d = new Date(e.ts || e.time || 0)
      return {
        id: e.id || e.ulid || 'real-' + i,
        day: 'real',
        t: d.getHours() * 60 + d.getMinutes(),
        dateLabel: isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10),
        kind: e.kind || 'note.logged',
        module: e.module || e.source || 'spine',
        level: e.level || '',
        text: e.summary || e.text || JSON.stringify(e.payload || e).slice(0, 140),
        payload: e.payload || e,
        real: true,
      }
    })
    spine.source = 'real'
    spine.realMeta = { files: data.files, count: mapped.length, dir: data.dir }
    spine.realEvents = mapped
    notify()
    return { ok: true, count: mapped.length }
  } catch {
    return { ok: false, reason: 'fetch-failed' }
  }
}

export function useSimSource() {
  spine.source = 'sim'
  notify()
}
