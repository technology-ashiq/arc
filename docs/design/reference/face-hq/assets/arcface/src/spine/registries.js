// ─────────────────────────────────────────────────────────────
// REGISTRIES v0.6 — the folds behind the 19 rooms that were
// missing. Every function here is a PURE fold: repo-fact seeds
// (src/data/arcFacts.js, generated from the arc repo, read-only)
// plus the owner's persisted events (workspace.js log) in → rows
// out. Nothing mutates. Delete every view, replay the log, the
// state comes back — arc's A5, unchanged.
//
// Honesty rule: seed rows carry `seed: true` + `src`; owner rows
// carry `added` (iso). A row never invents a number — an absent
// value is null and the room says why.
// ─────────────────────────────────────────────────────────────
import { spine } from './store.js'
import { wsLog, wsDecisions } from './workspace.js'
import { FACTS } from '../data/arcFacts.js'
import { LANE_ROOM } from '../hq/roomRegistry.js'

const log = () => wsLog()
const decidedData = (subject) => wsDecisions(subject).map((d) => ({ approved: d.decided.approved, data: d.decided.data || {}, reason: d.decided.reason, id: d.id, iso: d.iso }))

// ═══════════════════════════════════════════════════════════════
// POLICY — "Deny by default. Every capability earns its level."
// two keys: ceiling (a reviewed repo edit) and cap (event-earned).
// effective = min(ceiling, cap). Owner may raise a CAP only by a
// stamped policy.changed citing trial-ledger evidence; a CEILING
// change is a repo edit and this app refuses to fake one.
// ═══════════════════════════════════════════════════════════════
export const LEVELS = ['L0', 'L1', 'L2', 'L3']
export const CAPABILITIES = ['read', 'write', 'shell', 'network', 'message', 'publish', 'deploy', 'spend']
const lv = (l) => Math.max(0, LEVELS.indexOf(l))
const minLevel = (a, b) => LEVELS[Math.min(lv(a), lv(b))]

export function policySubjects() {
  const rows = FACTS.policy.subjects.map((s) => ({
    subject: s.subject,
    ceilingNote: s.ceiling,
    notes: s.notes,
    e2: s.e2 || [],
    src: s.src,
    seed: true,
    caps: CAPABILITIES.map((c) => {
      const v = (s.capabilities || {})[c]
      const ceiling = v ? v.level : 'L0'
      return { cap: c, ceiling, capLevel: 'L1', effective: minLevel(ceiling, 'L1'), roots: v && v.roots, declared: !!v }
    }),
  }))
  const byId = new Map(rows.map((r) => [r.subject, r]))
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'lane.born' && p.subject && !byId.has(p.subject)) {
      const row = { subject: p.subject, ceilingNote: 'L1 (birth level)', notes: p.note || 'registered by you', e2: [], added: e.iso, caps: CAPABILITIES.map((c) => ({ cap: c, ceiling: c === 'read' ? 'L3' : 'L1', capLevel: 'L1', effective: 'L1', roots: null, declared: true })) }
      rows.push(row)
      byId.set(p.subject, row)
    }
    if (e.kind === 'policy.changed' && byId.has(p.subject)) {
      const c = byId.get(p.subject).caps.find((x) => x.cap === p.cap)
      if (c) {
        c.capLevel = p.to
        c.effective = minLevel(c.ceiling, p.to)
        c.changed = e.id
      }
    }
  }
  // stamped proposals fold in: approve → the cap rises; reject → nothing moved, the reason is the record
  for (const d of decidedData('policy.change')) {
    const row = byId.get(d.data.subject)
    const c = row && row.caps.find((x) => x.cap === d.data.cap)
    if (c && d.approved) {
      c.capLevel = d.data.to
      c.effective = minLevel(c.ceiling, d.data.to)
      c.changed = d.id
    }
    if (c) c.proposed = false
  }
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'policy.proposed' && byId.has(p.subject)) {
      const c = byId.get(p.subject).caps.find((x) => x.cap === p.cap)
      const decided = decidedData('policy.change').some((d) => d.data.proposalId === p.proposalId)
      if (c && !decided) c.proposed = p.to
    }
  }
  return rows
}
export const policyLadder = () => LEVELS.map((l) => ({ level: l, text: FACTS.policy.ladder[l] }))

// ═══════════════════════════════════════════════════════════════
// MODEL POLICY — "Tiers are law, not taste." (ADR-0069)
// ═══════════════════════════════════════════════════════════════
export const TIERS = FACTS.modelPolicy.tiers
export function tierTable() {
  return TIERS.map((t) => {
    const m = FACTS.modelPolicy.models.find((x) => x.tier === t)
    const d = FACTS.modelPolicy.tierDefs.find((x) => x.tier === t)
    return { tier: t, model: m ? m.model : null, meaning: d ? d.meaning : null, src: m ? m.src : null, unmapped: !m ? FACTS.modelPolicy.unmapped && FACTS.modelPolicy.unmapped.text : null }
  })
}
export function processTiers() {
  const rows = FACTS.modelPolicy.classes.map((c) => ({ cls: c.cls, tier: c.tier, driver: c.driver, fallback: c.fallback, cap: c.cap, hosted: c.hosted, judge: c.judge, review_by: c.review_by, src: c.src, seed: true }))
  const byId = new Map(rows.map((r) => [r.cls, r]))
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'tier.changed' && byId.has(p.cls)) Object.assign(byId.get(p.cls), { tier: p.to, changed: e.id })
    if (e.kind === 'run.queued' && p.process && !byId.has(p.process)) {
      const row = { cls: p.process, tier: p.tier || FACTS.modelPolicy.default.tier, driver: p.driver || FACTS.modelPolicy.default.driver, fallback: [], added: e.iso, defaulted: true }
      rows.push(row)
      byId.set(p.process, row)
    }
  }
  for (const d of decidedData('tier.change')) {
    const row = byId.get(d.data.cls)
    if (row) {
      if (d.approved) Object.assign(row, { tier: d.data.to, changed: d.id })
      row.proposed = null
    }
  }
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'tier.proposed' && byId.has(p.cls) && !decidedData('tier.change').some((d) => d.data.proposalId === p.proposalId)) byId.get(p.cls).proposed = p.to
  }
  return rows
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULER — "Nothing runs because someone remembered."
// grammar closed to daily@HH:MM and weekdays@HH:MM (IST).
// ═══════════════════════════════════════════════════════════════
export const SCHEDULE_RE = /^(daily|weekdays)@([01]\d|2[0-3]):([0-5]\d)$/
export function jobs() {
  const rows = FACTS.scheduler.jobs.map((j) => ({ jobId: j.name, name: j.name, schedule: j.schedule, process: j.level, entry: j.entry, budgetMin: j.budgetMin, catchup: j.catchup || FACTS.scheduler.defaults || 'catchup: skip', enabled: j.enabled, notes: j.notes, src: j.src, seed: true, fires: [], lastOutcome: null, lastFired: null, paused: false }))
  const byId = new Map(rows.map((r) => [r.jobId, r]))
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'job.registered') {
      const row = { jobId: p.jobId, name: p.name, schedule: p.schedule, process: p.process, entry: p.entry || null, budgetMin: p.budgetMin || 2, catchup: p.catchup || 'skip', enabled: true, added: e.iso, fires: [], lastOutcome: null, lastFired: null, paused: false }
      rows.push(row)
      byId.set(p.jobId, row)
    } else if ((e.kind === 'job.fired' || e.kind === 'job.failed') && byId.has(p.jobId)) {
      const r = byId.get(p.jobId)
      r.fires.push({ id: e.id, iso: e.iso, day: e.day, t: e.t, outcome: p.outcome || (e.kind === 'job.failed' ? 'failed' : 'ok'), ms: p.ms, slot: p.slot })
      r.lastOutcome = p.outcome || (e.kind === 'job.failed' ? 'failed' : 'ok')
      r.lastFired = e.id
    } else if (e.kind === 'job.paused' && byId.has(p.jobId)) byId.get(p.jobId).paused = !!p.paused
  }
  return rows
}
export function nextFire(schedule, clockMin = spine.clock) {
  const m = SCHEDULE_RE.exec(schedule || '')
  if (!m) return null
  const at = parseInt(m[2], 10) * 60 + parseInt(m[3], 10)
  return { at, today: at > clockMin, label: (at > clockMin ? 'today ' : 'tomorrow ') + m[2] + ':' + m[3] + ' IST', weekdaysOnly: m[1] === 'weekdays' }
}
export function heartbeat() {
  const beats = log().filter((e) => e.kind === 'heartbeat.ok')
  const last = beats[beats.length - 1] || null
  return { count: beats.length, last, alive: !!last && spine.dayIndex - last.day <= 1 }
}

// ═══════════════════════════════════════════════════════════════
// MEMORY — "A correction made twice becomes a rule."
// a lesson logged twice (same normalized text) → promotion proposed
// ═══════════════════════════════════════════════════════════════
const normText = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
export function lessons() {
  const rows = FACTS.memory.retro.map((r, i) => ({ lessonId: 'retro-' + i, date: r.date, lane: (r.lane || '').replace(/^arc-/, ''), kind: r.kind, correction: r.correction, lesson: r.lesson, tags: r.tags, count: 1, promoted: r.promoted, ruleId: r.promoted ? 'R-retro-' + i : null, src: r.src, seed: true }))
  const byText = new Map(rows.map((r) => [normText(r.lesson), r]))
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'lesson.logged') {
      const k = normText(p.lesson)
      if (byText.has(k)) {
        const r = byText.get(k)
        r.count += 1
        r.lastSeen = e.iso
        if (!r.repeatId) r.repeatId = e.id
      } else {
        const r = { lessonId: p.lessonId, date: (e.iso || '').slice(0, 10), lane: p.lane || 'hq', kind: p.kind || 'correction', correction: p.correction || null, lesson: p.lesson, tags: p.tags || null, count: 1, promoted: false, ruleId: null, added: e.iso }
        rows.push(r)
        byText.set(k, r)
      }
    } else if (e.kind === 'rule.promoted') {
      const r = rows.find((x) => x.lessonId === p.lessonId) || byText.get(normText(p.lesson))
      if (r) Object.assign(r, { promoted: true, ruleId: p.ruleId, promotedId: e.id })
    }
  }
  for (const d of decidedData('memory.promote')) {
    const r = rows.find((x) => x.lessonId === d.data.lessonId)
    if (r && d.approved) Object.assign(r, { promoted: true, ruleId: d.data.ruleId, promotedId: d.id })
    if (r) r.proposed = false
  }
  // a proposal still sitting in the inbox marks the row — durable across reloads
  for (const ap of spine.pendingApprovals) {
    if (ap.subject !== 'memory.promote' || !ap.data) continue
    const r = rows.find((x) => x.lessonId === ap.data.lessonId)
    if (r && !r.promoted) r.proposed = true
  }
  return rows
}
export const trialLedger = () => FACTS.memory.trial.map((t, i) => ({ ...t, trialId: 'trial-' + i, seed: true }))
export function recalls() {
  return log().filter((e) => e.kind === 'recall.ran').map((e) => ({ id: e.id, iso: e.iso, q: e.payload.q, hits: e.payload.hits || [], cost: e.payload.cost || null }))
}
// the recall itself: a fold over lessons + trial ledger + receipts — no model, no key, no spend
export function recall(q) {
  const ws = new Set(normText(q).split(' ').filter((w) => w.length > 3))
  if (!ws.size) return []
  const score = (txt) => normText(txt).split(' ').filter((w) => ws.has(w)).length
  const out = []
  for (const l of lessons()) {
    const s = score(l.lesson + ' ' + (l.correction || '') + ' ' + (l.tags || '') + ' ' + l.lane)
    if (s) out.push({ type: 'lesson', score: s, ref: l.lessonId, text: l.lesson, src: l.src || null, lane: l.lane })
  }
  for (const t of trialLedger()) {
    const s = score(t.capability + ' ' + t.outcome + ' ' + (t.runRef || ''))
    if (s) out.push({ type: 'trial', score: s, ref: t.trialId, text: `${t.capability}: ${t.outcome}`, src: t.src, lane: null })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8)
}

// ═══════════════════════════════════════════════════════════════
// EVOLVE — "Measured, or it did not improve."
// fixed-horizon, compute-once: a verdict exists only when BOTH arms
// are at or above the per-arm floor; then it is computed exactly once.
// ═══════════════════════════════════════════════════════════════
export function experiments() {
  const map = new Map()
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'experiment.opened') map.set(p.expId, { expId: p.expId, name: p.name, surface: p.surface, metric: p.metric, hypothesis: p.hypothesis, champion: p.champion, challenger: p.challenger, floor: p.floor, holdout: p.holdout, split: p.split || 50, samples: { a: 0, b: 0 }, hits: { a: 0, b: 0 }, status: 'open', verdict: null, added: e.iso, openedId: e.id })
    else if (!map.has(p.expId)) continue
    else if (e.kind === 'experiment.measured') {
      const x = map.get(p.expId)
      x.samples = { a: x.samples.a + (p.a || 0), b: x.samples.b + (p.b || 0) }
      x.hits = { a: x.hits.a + (p.hitsA || 0), b: x.hits.b + (p.hitsB || 0) }
      x.lastMeasured = e.id
    } else if (e.kind === 'experiment.concluded') Object.assign(map.get(p.expId), { status: 'concluded', verdict: p.verdict, winner: p.winner, diff: p.diff ?? null, lo: p.lo ?? null, hi: p.hi ?? null, concludedId: e.id })
  }
  for (const d of decidedData('evolve.conclude')) {
    const x = map.get(d.data.expId)
    if (x && d.approved) Object.assign(x, { status: 'landed', landed: d.id })
    if (x && !d.approved) Object.assign(x, { status: 'concluded', rolledBack: d.id })
  }
  return [...map.values()].reverse()
}
// newcombe-wilson-style difference of proportions — one pinned verdict formula, computed once
export function verdictFor(x) {
  const { a, b } = x.samples
  if (a < x.floor || b < x.floor) return { ready: false, reason: `below floor — champion ${a}/${x.floor}, challenger ${b}/${x.floor}` }
  const pa = x.hits.a / a
  const pb = x.hits.b / b
  const z = 1.96
  const w = (p, n) => {
    const d = 1 + (z * z) / n
    const c = p + (z * z) / (2 * n)
    const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
    return [(c - h) / d, (c + h) / d]
  }
  const [la, ua] = w(pa, a)
  const [lb, ub] = w(pb, b)
  const diff = pb - pa
  const lo = diff - Math.sqrt((pa - la) ** 2 + (ub - pb) ** 2)
  const hi = diff + Math.sqrt((ua - pa) ** 2 + (pb - lb) ** 2)
  const verdict = lo > 0 ? 'CHALLENGER' : hi < 0 ? 'CHAMPION' : 'NO PROPOSAL'
  return { ready: true, pa, pb, diff, lo, hi, verdict }
}

// ═══════════════════════════════════════════════════════════════
// DEVELOP — "A phase closes on evidence, or it does not close."
// ═══════════════════════════════════════════════════════════════
export function devPhases() {
  const rows = (FACTS.develop.plan ? FACTS.develop.plan.phases : []).map((p) => ({ ...p, lane: 'develop', seed: true, refused: null }))
  const byKey = new Map(rows.map((r) => ['develop/' + r.phase, r]))
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'phase.closed' && p.lane && p.phase) {
      const k = p.lane + '/' + p.phase
      if (byKey.has(k)) Object.assign(byKey.get(k), { closed: true, status: 'closed by you · ' + (p.tests || 'tests green'), closedId: e.id })
      else {
        const r = { phase: p.phase, lane: p.lane, capability: p.capability || 'your phase', appetite: p.appetite || null, status: 'closed by you', closed: true, closedId: e.id, added: e.iso }
        rows.push(r)
        byKey.set(k, r)
      }
    } else if (e.kind === 'phase.refused' && p.lane && p.phase) {
      const k = p.lane + '/' + p.phase
      if (!byKey.has(k)) {
        const r = { phase: p.phase, lane: p.lane, capability: p.capability || 'your phase', appetite: null, status: 'open', closed: false, added: e.iso }
        rows.push(r)
        byKey.set(k, r)
      }
      Object.assign(byKey.get(k), { refused: p.missing, refusedId: e.id, status: 'refused — ' + (p.missing || []).join(', ') })
    } else if (e.kind === 'slice.opened' && p.lane && p.phase && !byKey.has(p.lane + '/' + p.phase)) {
      const r = { phase: p.phase, lane: p.lane, capability: p.name ? `opened with slice “${p.name}”` : 'your phase', appetite: null, status: 'open', closed: false, added: e.iso }
      rows.push(r)
      byKey.set(p.lane + '/' + p.phase, r)
    }
  }
  return rows
}
export function slices() {
  const map = new Map()
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'slice.opened') map.set(p.sliceId, { sliceId: p.sliceId, lane: p.lane, phase: p.phase, name: p.name, status: 'open', proof: null, added: e.iso, openedId: e.id })
    else if (e.kind === 'slice.proven' && map.has(p.sliceId)) Object.assign(map.get(p.sliceId), { status: 'proven', proof: { tests: p.tests, demo: p.demo, exit: p.exit }, provenId: e.id })
  }
  return [...map.values()].reverse()
}

// ═══════════════════════════════════════════════════════════════
// REVIEW · SHIP — "Every gate blocks by default."
// ═══════════════════════════════════════════════════════════════
export function profile() {
  let name = 'standard'
  let changed = null
  for (const e of log()) if (e.kind === 'profile.switched') {
    name = e.payload.to
    changed = e.id
  }
  const p = FACTS.reviewShip.profiles
  const table = p && p.table ? p.table : []
  return { name, changed, row: table.find((r) => r.profile === name) || null, valid: p && p.valid ? p.valid : ['starter', 'standard', 'strict'], table }
}
export function shipRuns() {
  const map = new Map()
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'review.completed' && p.sha) map.set(p.sha, { sha: p.sha, reviews: [p.review], verdict: p.verdict, summary: p.summary || null, gates: p.gates || null, shipped: false, ids: [e.id], added: e.iso })
    else if (e.kind === 'review.completed' && !p.sha) continue
    else if (map.has(p.sha)) {
      const r = map.get(p.sha)
      if (e.kind === 'ship.completed') Object.assign(r, { shipped: true, shipId: e.id, outcome: p.outcome })
      if (e.kind === 'qa.completed') r.qa = p.verdict
      r.ids.push(e.id)
    }
  }
  return [...map.values()].reverse()
}

// ═══════════════════════════════════════════════════════════════
// VENTURES — "The factory is not the product."
// ═══════════════════════════════════════════════════════════════
export function ventures() {
  const rows = FACTS.ventures.items.map((v) => ({ ventureId: v.id, name: v.name, repo: v.repo, stage: v.stage, money: v.money, mrr: v.mrr, kill: v.kill, notes: v.notes, status: 'live', src: v.src, seed: true }))
  const byId = new Map(rows.map((r) => [r.ventureId, r]))
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'venture.registered') {
      const row = { ventureId: p.ventureId, name: p.name, repo: p.repo || 'own repo (declared at kickoff)', stage: p.stage || 'kickoff', money: { absent: true, reason: 'money never lives in the venture row — it arrives as revenue.received / cost.recorded events' }, kill: (p.kill || []).map((k) => ({ ...k, measurable: true })), notes: [], status: 'candidate', added: e.iso }
      rows.push(row)
      byId.set(p.ventureId, row)
    } else if (e.kind === 'venture.staged' && byId.has(p.ventureId)) Object.assign(byId.get(p.ventureId), { stage: p.stage, status: p.stage === 'live' ? 'live' : byId.get(p.ventureId).status, stagedId: e.id })
    else if (e.kind === 'venture.killed' && byId.has(p.ventureId)) Object.assign(byId.get(p.ventureId), { status: 'attic', killedId: e.id, retro: p.retro })
  }
  for (const d of decidedData('venture.kill')) {
    const r = byId.get(d.data.ventureId)
    if (r) {
      if (d.approved) Object.assign(r, { status: 'attic', killedId: d.id, retro: d.reason })
      r.killProposed = false
    }
  }
  // real money per venture is a fold over receipts — usually ₹0, and it says so
  for (const r of rows) {
    const rev = spine.events.filter((e) => e.kind === 'revenue.received' && (e.payload.venture === r.ventureId || (!e.payload.venture && r.ventureId === 'lexos'))).reduce((s, e) => s + (e.payload.amount || 0), 0)
    r.realRevenue = rev
    const days = spine.dayIndex - 0 // sim days observed
    r.daysWithoutRevenue = rev > 0 ? 0 : days
  }
  return rows
}

// ═══════════════════════════════════════════════════════════════
// STRATEGY — "One plan is live per lane. The rest are history."
// ═══════════════════════════════════════════════════════════════
export function plans() {
  const rows = FACTS.strategy.plans.map((p, i) => {
    const m = /^(PLAN|BRIEF)-(.+?)\.md$/.exec(p.file)
    const laneGuess = m ? m[2].replace(/-v\d.*$/, '').replace(/^cycle\d-/, '') : p.file
    return { planId: 'plan-' + i, file: p.file, title: p.h1, lane: laneGuess, kind: m ? m[1].toLowerCase() : 'plan', status: 'history', seed: true }
  })
  // the live plan per lane = the born lane's own PLAN.md (initiatives/<lane>/PLAN.md)
  for (const l of FACTS.lanes) rows.push({ planId: 'live-' + l.id, file: `initiatives/${l.id}/PLAN.md`, title: l.plan || `${l.id} plan`, lane: l.id, kind: 'plan', status: 'live', seed: true, src: l.src })
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'plan.adopted') {
      for (const r of rows) if (r.lane === p.lane && r.status === 'live') r.status = 'history'
      rows.push({ planId: p.planId, file: null, title: p.title, lane: p.lane, kind: 'plan', status: 'live', added: e.iso, adoptedId: e.id, appetite: p.appetite || null })
    }
  }
  for (const d of decidedData('strategy.adopt')) {
    if (!d.approved) continue
    for (const r of rows) if (r.lane === d.data.lane && r.status === 'live' && r.planId !== d.data.planId) r.status = 'history'
    const r = rows.find((x) => x.planId === d.data.planId)
    if (r) Object.assign(r, { status: 'live', adoptedId: d.id })
  }
  return rows
}
export function adrs() {
  const seed = (FACTS.strategy.adrs && FACTS.strategy.adrs.recent ? FACTS.strategy.adrs.recent : []).map((a) => ({ adrId: String(a.n), n: a.n, title: a.title, seed: true }))
  const yours = log().filter((e) => e.kind === 'adr.recorded').map((e) => ({ adrId: e.payload.adrId, n: e.payload.n, title: e.payload.title, reversibility: e.payload.reversibility, lane: e.payload.lane, added: e.iso, id: e.id }))
  return { count: FACTS.strategy.adrs ? FACTS.strategy.adrs.count : null, highest: FACTS.strategy.adrs ? FACTS.strategy.adrs.highest : null, recent: seed, yours: yours.reverse() }
}

// ═══════════════════════════════════════════════════════════════
// ORG — "Sixteen lanes. Who is awake, who is idle, who is blocked."
// ═══════════════════════════════════════════════════════════════
export function lanesRoster() {
  const rows = FACTS.lanes.map((l) => ({ lane: l.id, ring: l.ring, room: LANE_ROOM[l.id] || l.room, status: l.status, waitingOn: l.waitingOn, dependsOn: l.dependsOn, cycle: l.cycle, phase: l.currentPhase, phasesTotal: l.phasesTotal, phasesClosed: l.phasesClosed, appetite: l.appetite, plan: l.plan, goal: l.goal, next: l.next, phases: l.phases, src: l.src, seed: true, receiptsToday: 0 }))
  const byId = new Map(rows.map((r) => [r.lane, r]))
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'lane.born' && p.lane && !byId.has(p.lane)) {
      const row = { lane: p.lane, ring: p.ring || 'money', room: p.room || p.lane, status: 'awake', waitingOn: p.waitingOn || null, cycle: 'born by you', phase: '00 · steel thread', phasesTotal: 1, phasesClosed: 0, appetite: p.appetite ? { value: p.appetite, burn: '0d' } : null, plan: p.plan || null, phases: [], added: e.iso, bornId: e.id, receiptsToday: 0 }
      rows.push(row)
      byId.set(p.lane, row)
    } else if (e.kind === 'lane.status' && byId.has(p.lane)) Object.assign(byId.get(p.lane), { status: p.status, waitingOn: p.waitingOn || null, statusId: e.id })
  }
  // liveness from receipts: a lane whose room fired today is awake whatever the file says
  const today = spine.events.filter((e) => e.day === spine.dayIndex)
  for (const r of rows) r.receiptsToday = today.filter((e) => e.module === r.room || e.module === r.lane).length
  return rows
}
export const orgCounts = () => lanesRoster().reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), { awake: 0, idle: 0, blocked: 0 })

// ═══════════════════════════════════════════════════════════════
// CONCEPTS — "Every word arc uses, and the room it lives in."
// ═══════════════════════════════════════════════════════════════
const ROOM_RENAME = { today: 'overview', 'engine-room': 'engine', 'council-chamber': 'council', lane: 'org', ledger: 'money' }
export function concepts() {
  const rows = FACTS.concepts.items.map((c) => ({ term: c.term, room: ROOM_RENAME[c.room] || c.room, station: c.station, seed: true }))
  for (const e of log()) if (e.kind === 'concept.defined') rows.push({ term: e.payload.term, room: e.payload.room, station: e.payload.station || null, def: e.payload.def || null, added: e.iso, id: e.id })
  return rows
}
export function searchConcepts(q) {
  const s = (q || '').toLowerCase().trim()
  if (!s) return []
  return concepts().filter((c) => c.term.toLowerCase().includes(s)).slice(0, 8)
}

// ═══════════════════════════════════════════════════════════════
// OPS (planned) — incidents · support · the weekly report. REHEARSAL.
// ═══════════════════════════════════════════════════════════════
export function incidents() {
  const map = new Map()
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'incident.raised') map.set(p.incId, { incId: p.incId, title: p.title, severity: p.severity || 'S3', source: p.source || 'manual', status: 'raised', raisedAt: e.iso, raisedId: e.id, t: e.t })
    else if (e.kind === 'incident.acked' && map.has(p.incId)) Object.assign(map.get(p.incId), { status: 'acked', ackedId: e.id, ackedAt: e.iso })
    else if (e.kind === 'incident.resolved' && map.has(p.incId)) Object.assign(map.get(p.incId), { status: 'resolved', resolvedId: e.id, resolvedAt: e.iso, resolution: p.resolution })
  }
  return [...map.values()].reverse()
}
export function tickets() {
  const map = new Map()
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'support.dropped') map.set(p.ticketId, { ticketId: p.ticketId, text: p.text, from: p.from || 'file-drop', cls: p.cls || 'unclassified', status: 'dropped', added: e.iso })
    else if (e.kind === 'support.triaged' && map.has(p.ticketId)) Object.assign(map.get(p.ticketId), { cls: p.cls, draft: p.draft, status: 'drafted' })
  }
  for (const d of decidedData('ops.reply')) {
    const t = map.get(d.data.ticketId)
    if (t) t.status = d.approved ? 'sealed — you send it' : 'draft rejected'
  }
  return [...map.values()].reverse()
}

// ═══════════════════════════════════════════════════════════════
// TRADER (planned) — paper only. The lock is display-only here:
// there is no control in this app that can unlock real money.
// ═══════════════════════════════════════════════════════════════
export const TRADER_LOCK = { level: 'L0', cooldownHours: 72, unlock: 'a written rule change (constitution amendment) + 72h cooldown — never a toggle', src: 'planned-rooms.json · room trader · seals' }
export function strategies() {
  const map = new Map()
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'strategy.registered') map.set(p.stratId, { stratId: p.stratId, name: p.name, market: p.market, rule: p.rule, status: 'registered', question: p.question || null, backtest: null, honesty: null, verdict: null, paperDays: 0, added: e.iso })
    else if (!map.has(p.stratId)) continue
    else if (e.kind === 'backtest.completed') Object.assign(map.get(p.stratId), { status: 'backtested', backtest: { trades: p.trades, winRate: p.winRate, maxDrawdown: p.maxDrawdown, sharpe: p.sharpe, window: p.window, snapshot: p.snapshot }, honesty: p.honesty })
    else if (e.kind === 'trade.verdict') Object.assign(map.get(p.stratId), { status: p.verdict === 'PAPER-LIVE' ? 'paper-live' : p.verdict === 'CONTINUE' ? 'continue' : 'dormant', verdict: p.verdict })
    else if (e.kind === 'trade.paper') map.get(p.stratId).paperDays += 1
  }
  return [...map.values()].reverse()
}
export const traderQuestions = () => log().filter((e) => e.kind === 'question.opened').map((e) => ({ id: e.id, q: e.payload.q, iso: e.iso })).reverse()

// ═══════════════════════════════════════════════════════════════
// DISCOVER (planned) — hunt → normalize → dedupe → score → top-2 →
// council → your stamp → one-pager → separate venture kickoff.
// ═══════════════════════════════════════════════════════════════
export function ideas() {
  const map = new Map()
  for (const e of log()) {
    const p = e.payload || {}
    if (e.kind === 'idea.captured' && p.ideaId) map.set(p.ideaId, { ideaId: p.ideaId, text: p.text, source: p.source || 'manual', pain: p.pain || null, status: 'captured', score: null, added: e.iso, capturedId: e.id })
    else if (!map.has(p.ideaId)) continue
    else if (e.kind === 'idea.scored') Object.assign(map.get(p.ideaId), { status: 'scored', score: { market: p.market, moat: p.moat, distribution: p.distribution, total: p.total }, scoredId: e.id })
    else if (e.kind === 'idea.shortlisted') Object.assign(map.get(p.ideaId), { status: 'shortlisted', shortId: e.id })
    else if (e.kind === 'council.verdict' && p.ideaId) Object.assign(map.get(p.ideaId), { status: 'council', verdict: p.verdict })
  }
  for (const d of decidedData('discover.kickoff')) {
    const i = map.get(d.data.ideaId)
    if (i) i.status = d.approved ? 'kickoff' : 'parked'
  }
  return [...map.values()].reverse()
}
// the distribution hard-flag rule (R-114): <6 on distribution never recovered post-launch
export const scoreIdea = (text) => {
  const h = [...(text || '')].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 17)
  const market = 4 + (h % 6)
  const moat = 3 + ((h >> 3) % 6)
  const distribution = 3 + ((h >> 6) % 7)
  return { market, moat, distribution, total: market + moat + distribution, flag: distribution < 6 ? 'distribution < 6 — hard-flagged (R-114)' : null }
}

// ═══════════════════════════════════════════════════════════════
// BOARD — every lane, its phase, and what it is burning
// ═══════════════════════════════════════════════════════════════
const days = (s) => {
  const m = /([\d.]+)\s*d/.exec(s || '')
  return m ? parseFloat(m[1]) : null
}
export function boardRows() {
  return lanesRoster().map((r) => {
    const bought = r.appetite ? days(r.appetite.value) : null
    const spent = r.appetite ? days(r.appetite.burn) : null
    const burn = bought && spent != null ? spent / bought : null
    return { ...r, bought, spent, burn, killDistance: burn == null ? null : Math.max(0, 1 - burn) }
  })
}

// summary for the brief / overview
export function v06Summary() {
  const j = jobs()
  const l = lessons()
  const x = experiments()
  const o = orgCounts()
  return { jobs: j.length, fires: j.reduce((s, r) => s + r.fires.length, 0), lessons: l.filter((r) => !r.seed).length, rules: l.filter((r) => r.promoted).length, experiments: x.length, awake: o.awake, blocked: o.blocked, incidents: incidents().filter((i) => i.status !== 'resolved').length, ideas: ideas().length }
}
