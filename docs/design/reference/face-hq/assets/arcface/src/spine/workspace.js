// ─────────────────────────────────────────────────────────────
// The WORKSPACE layer — the part of the spine that is YOURS.
// Every add/hire/absorb/convene the owner performs in the UI
// appends a real event here (append-only, exactly like the sim),
// and — unlike the sim — it PERSISTS in localStorage, so the
// company you build survives a reload. Every panel over this
// data is still a derived view: delete the views, replay the
// log, the state comes back. arc's A5, running for real.
//
// Honesty rule (E3): sim events say SIMULATED, these say YOURS.
// ─────────────────────────────────────────────────────────────
import { spine, poke } from './store.js'
import { DAY_START, DAY_END } from './sim.js'
import { ARC } from '../data/arcKnowledge.js'

const KEY = 'arcface.ws.v1'

// module-level copy of the persisted log (the registry source)
let wsEvents = []

// ── ids: real ULID-ish (time-ordered, random tail — honest: these are real) ──
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function wsId() {
  let t = Date.now()
  let s = ''
  for (let i = 0; i < 8; i++) {
    s = B32[t % 32] + s
    t = Math.floor(t / 32)
  }
  for (let i = 0; i < 6; i++) s += B32[Math.floor(Math.random() * 32)]
  return s
}
export const newRef = (prefix) => prefix + '-' + wsId().slice(-6).toLowerCase()

function persistAll() {
  try {
    localStorage.setItem(KEY, JSON.stringify(wsEvents))
  } catch {
    /* storage full/blocked — the session still works, it just won't survive reload */
  }
}

// called by store.recordDecision (via spine.persistHook) for ws approvals
export function persistEvent(ev) {
  ev.ws = true
  wsEvents.push(ev)
  persistAll()
}
spine.persistHook = persistEvent

// ── the one write path for workspace events ──
export function wsAppend(kind, module, text, payload = {}, extra = {}) {
  const ev = {
    id: wsId(),
    day: spine.dayIndex,
    t: Math.min(Math.max(spine.clock, DAY_START), DAY_END),
    kind,
    module,
    level: 'human',
    text,
    payload,
    ws: true,
    iso: new Date().toISOString(),
    ...extra,
  }
  wsEvents.push(ev)
  spine.events.push(ev)
  if (ev.kind === 'approval.requested' && ev.approval) {
    spine.pendingApprovals.push({ ...ev.approval, eventId: ev.id, day: ev.day, t: ev.t, ws: true })
  }
  persistAll()
  poke()
  return ev
}

// raise an approval card into the inbox — "a machine may raise it, only you may decide it"
export function wsRequestApproval({ title, tag, facts, actions, subject, data }) {
  const approval = {
    id: 'wsap-' + wsId().toLowerCase(),
    title,
    tag,
    facts,
    actions: actions || [
      { label: 'approve', approved: true },
      { label: 'reject', approved: false },
    ],
    subject,
    data,
    ws: true,
  }
  return wsAppend('approval.requested', 'hq', `Approval requested: ${title}`, { subject }, { approval })
}

// ── boot: merge the persisted log back into the spine ──
export function wsLoad() {
  let arr = []
  try {
    arr = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    arr = []
  }
  wsEvents = Array.isArray(arr) ? arr : []
  const decidedIds = new Set(
    wsEvents.filter((e) => e.kind === 'decision.recorded').map((e) => e.payload && e.payload.approvalId).filter(Boolean),
  )
  for (const ev of wsEvents) {
    // sim history resets to day 14 on every boot; your events clamp into view
    if (typeof ev.day === 'number' && ev.day > spine.dayIndex) ev.day = spine.dayIndex
    spine.events.push(ev)
    if (ev.kind === 'approval.requested' && ev.approval && !decidedIds.has(ev.approval.id)) {
      spine.pendingApprovals.push({ ...ev.approval, eventId: ev.id, day: ev.day, t: ev.t, ws: true })
    }
    // replay the ladder — your promotions and demotions hold across reloads
    if (ev.kind === 'autonomy.changed' && ev.payload && ev.payload.capability) {
      spine.ladderOverrides[ev.payload.capability] = ev.payload.to
    }
  }
  poke()
}

export function wsCount() {
  return wsEvents.length
}

export function wsReset() {
  wsEvents = []
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

// ── backup: the log leaves and returns as JSONL, arc's native shape ──
export function wsExportText() {
  return wsEvents.map((e) => JSON.stringify(e)).join('\n') + '\n'
}

// merge-import: appends events whose ids are not already on the log
// (append-only survives even a backup restore — nothing is overwritten)
export function wsImportText(text) {
  const seen = new Set(wsEvents.map((e) => e.id))
  let added = 0
  let bad = 0
  for (const line of String(text).split('\n')) {
    const s = line.trim()
    if (!s) continue
    try {
      const ev = JSON.parse(s)
      if (!ev || !ev.id || !ev.kind) {
        bad++
        continue
      }
      if (seen.has(ev.id)) continue
      seen.add(ev.id)
      ev.ws = true
      wsEvents.push(ev)
      added++
    } catch {
      bad++
    }
  }
  if (added) persistAll()
  return { added, bad, total: wsEvents.length }
}

// decisions on ws approvals, read back out of the log
export function wsDecisions(subject) {
  return wsEvents.filter((e) => e.kind === 'decision.recorded' && e.decided && e.decided.subject === subject)
}
// the raw persisted log — registries.js folds the v0.6 rooms over it
export const wsLog = () => wsEvents

// ─────────────────────────────────────────────────────────────
// REGISTRIES — every one a pure fold over the log + honest seeds
// ─────────────────────────────────────────────────────────────

// ── BENCH — "Drivers are compared, never trusted." ──
const BENCH_SEED = [
  { benchId: 'claude-code', model: 'claude-sonnet-4-5', provider: 'Anthropic', tier: 'balanced-workhorse', status: 'champion', scores: { assertion: 92, schema: 100, fixtures: 5 }, seed: true, note: 'in-house employee driver · repo fact' },
  { benchId: 'gemini-cli', model: 'gemini-2.5-flash', provider: 'Google', tier: 'cheap-scan', status: 'challenger', scores: null, seed: true, note: 'registered · scorecard never-fired' },
]

export function benchState() {
  const rows = BENCH_SEED.map((r) => ({ ...r }))
  const byId = new Map(rows.map((r) => [r.benchId, r]))
  for (const e of wsEvents) {
    const p = e.payload || {}
    if (e.kind === 'bench.registered') {
      const row = { benchId: p.benchId, model: p.model, provider: p.provider || '—', tier: p.tier || 'balanced-workhorse', status: 'challenger', scores: null, added: e.iso, note: 'yours' }
      rows.push(row)
      byId.set(p.benchId, row)
    } else if (e.kind === 'bench.scored' && byId.has(p.benchId)) {
      const row = byId.get(p.benchId)
      row.scores = { assertion: p.assertion, schema: p.schema, fixtures: p.fixtures }
      row.verdict = p.verdict
      row.lastRun = e.id
    } else if (e.kind === 'promotion.proposed' && byId.has(p.benchId)) {
      byId.get(p.benchId).proposed = true
    } else if (e.kind === 'bench.retired' && byId.has(p.benchId)) {
      byId.get(p.benchId).status = 'retired'
    }
  }
  for (const d of wsDecisions('bench.promotion')) {
    const id = d.decided.data && d.decided.data.benchId
    if (d.decided.approved && byId.has(id)) {
      for (const r of rows) if (r.status === 'champion') r.status = 'benched'
      byId.get(id).status = 'champion'
      byId.get(id).proposed = false
    } else if (byId.has(id)) {
      byId.get(id).proposed = false
    }
  }
  return rows
}

// ── EXECUTOR / HIRES — employees & contractors, "the credential is the leash" ──
const HIRE_SEED = [
  { hireId: 'claude-code', name: 'claude-code', type: 'employee', role: 'primary driver — every governed process', model: 'claude-sonnet-4-5', tier: 'balanced-workhorse', status: 'active', seed: true },
  { hireId: 'hermes-agent', name: 'nousresearch/hermes-agent', type: 'contractor', role: 'candidate hired runtime (capability-lock row · repo fact)', model: 'v2026.8.3', tier: 'balanced-workhorse', status: 'certification', cert: 0, cap: 'L1-drafts', judge: 'owner', hosted: 'oci', review_by: '2026-09-15', seed: true },
]

export function hires() {
  const rows = HIRE_SEED.map((r) => ({ ...r }))
  const byId = new Map(rows.map((r) => [r.hireId, r]))
  for (const e of wsEvents) {
    const p = e.payload || {}
    if (e.kind === 'hire.added') {
      const row = {
        hireId: p.hireId, name: p.name, type: p.type, role: p.role, model: p.model || '—',
        tier: p.tier || 'balanced-workhorse',
        status: p.type === 'employee' ? 'active' : 'certification',
        cert: 0,
        cap: p.cap, judge: p.judge, hosted: p.hosted, review_by: p.review_by,
        added: e.iso,
      }
      rows.push(row)
      byId.set(p.hireId, row)
    } else if (e.kind === 'hire.certified' && byId.has(p.hireId)) {
      const row = byId.get(p.hireId)
      row.cert = p.fixtures
      row.status = p.green === 12 ? 'certified' : 'cert-failed'
    } else if (e.kind === 'hire.retired' && byId.has(p.hireId)) {
      byId.get(p.hireId).status = 'retired'
    }
  }
  for (const d of wsDecisions('executor.hire')) {
    const id = d.decided.data && d.decided.data.hireId
    if (byId.has(id)) byId.get(id).status = d.decided.approved ? 'active' : 'rejected'
  }
  // tenure check runs at use — an expired row refuses loudly
  const today = new Date().toISOString().slice(0, 10)
  for (const r of rows) {
    if (r.type === 'contractor' && r.status === 'active' && r.review_by && r.review_by < today) r.status = 'expired'
  }
  return rows
}

// ── RUNS — the executor's dispatch queue ──
export function runs() {
  const map = new Map()
  for (const e of wsEvents) {
    const p = e.payload || {}
    if (e.kind === 'run.queued') map.set(p.runId, { runId: p.runId, process: p.process, driver: p.driver, budgetMin: p.budgetMin, status: 'running', queuedAt: e.iso })
    else if ((e.kind === 'run.completed' || e.kind === 'run.failed') && map.has(p.runId)) Object.assign(map.get(p.runId), { status: p.outcome, ms: p.ms, costInr: p.costInr, doneId: e.id })
  }
  return [...map.values()].reverse()
}

// ── ABSORB — candidate | trial | adopted | retired · ≤12 adopted per lane ──
export const ABSORB_STAGES = ['study', 'report', 'classify', 'rebuild', 'judge']
const ABSORB_SEED = [
  { techId: 'madge', name: 'madge@8.0.0', source: 'npm', lane: 'develop', license: 'MIT', status: 'adopted', stage: 'done', verdict: 'INTEGRATE', seed: true, note: 'capability-lock row · repo fact' },
  { techId: 'hermes-agent-oci', name: 'nousresearch/hermes-agent@v2026.8.3', source: 'oci', lane: 'engine', license: 'Apache-2.0', status: 'candidate', stage: 'study', seed: true, note: 'capability-lock row · repo fact' },
]

export function absorbRegistry() {
  const rows = ABSORB_SEED.map((r) => ({ ...r }))
  const byId = new Map(rows.map((r) => [r.techId, r]))
  for (const e of wsEvents) {
    const p = e.payload || {}
    if (e.kind === 'absorb.captured') {
      const row = { techId: p.techId, name: p.name, source: p.source, lane: p.lane || 'develop', license: p.license || 'unknown', status: 'candidate', stage: 'study', added: e.iso }
      rows.push(row)
      byId.set(p.techId, row)
    } else if (e.kind === 'absorb.staged' && byId.has(p.techId)) {
      const row = byId.get(p.techId)
      row.stage = p.stage
      if (p.verdict) row.verdict = p.verdict
      if (p.verdict === 'SKIP') {
        row.status = 'skipped'
        row.stage = 'done'
      }
      if (p.stage === 'judge') row.status = 'trial'
    } else if (e.kind === 'absorb.retired' && byId.has(p.techId)) {
      byId.get(p.techId).status = 'retired'
    }
  }
  for (const d of wsDecisions('absorb.adopt')) {
    const id = d.decided.data && d.decided.data.techId
    if (byId.has(id)) {
      const row = byId.get(id)
      if (d.decided.approved) {
        row.status = 'adopted'
        row.stage = 'done'
      } else row.status = 'candidate'
    }
  }
  return rows
}

// ── AGENTS — the roster; seeds from the real repo census ──
const tierFor = (a) =>
  a.name === 'council-verifier' ? 'independent-family-verifier'
  : /advocate|skeptic|neutral|strategist|design-critic|security-auditor/.test(a.name) ? 'high-judgment'
  : /researcher|surveyor|log-analyzer/.test(a.name) ? 'cheap-scan'
  : 'balanced-workhorse'

export function agentsRoster() {
  const rows = ARC.agents.map((a) => ({ agentId: a.name, name: a.name, role: a.role, group: a.group, tier: tierFor(a), enabled: true, seed: true }))
  const byId = new Map(rows.map((r) => [r.agentId, r]))
  for (const e of wsEvents) {
    const p = e.payload || {}
    if (e.kind === 'agent.added') {
      const row = { agentId: p.agentId, name: p.name, role: p.role, group: p.group || 'lane', tier: p.tier || 'balanced-workhorse', enabled: true, added: e.iso }
      rows.push(row)
      byId.set(p.agentId, row)
    } else if (e.kind === 'agent.toggled' && byId.has(p.agentId)) {
      byId.get(p.agentId).enabled = !!p.enabled
    }
  }
  return rows
}

// ── LEADS — the funnel; caps derive from receipts, no counter file ──
export const LEAD_STAGES = ['researched', 'contacted', 'replied', 'meeting', 'won', 'lost']
export const LEADS_DAILY_CAP = 20
export const LEADS_TOUCH_CAP = 2 // per rolling 7 sim-days

export function leadsState() {
  const map = new Map()
  for (const e of wsEvents) {
    const p = e.payload || {}
    if (e.kind === 'lead.researched') map.set(p.leadId, { leadId: p.leadId, name: p.name, niche: p.niche || '—', geo: p.geo || 'IN', stage: 'researched', touches: [], added: e.iso })
    else if (!map.has(p.leadId)) continue
    else if (e.kind === 'outreach.sent') {
      const l = map.get(p.leadId)
      l.stage = l.stage === 'researched' ? 'contacted' : l.stage
      l.touches.push(e.day)
    } else if (e.kind === 'outreach.replied') map.get(p.leadId).stage = 'replied'
    else if (e.kind === 'meeting.booked') map.get(p.leadId).stage = 'meeting'
    else if (e.kind === 'deal.won') map.get(p.leadId).stage = 'won'
    else if (e.kind === 'deal.lost') map.get(p.leadId).stage = 'lost'
    else if (e.kind === 'lead.suppressed') map.get(p.leadId).suppressed = true
  }
  const leads = [...map.values()]
  const sentToday = wsEvents.filter((e) => e.kind === 'outreach.sent' && e.day === spine.dayIndex).length
  return { leads, sentToday, capLeft: Math.max(0, LEADS_DAILY_CAP - sentToday) }
}

export function leadTouchesInWindow(lead) {
  return lead.touches.filter((d) => spine.dayIndex - d < 7).length
}

// ── GROWTH — draft → review pack (inbox) → approve → publish ──
const SLOP_MARKERS = ['delve', 'game-changer', 'in today’s fast-paced', "in today's fast-paced", 'unlock the power', 'revolutionize', 'seamlessly', 'elevate your']
export function slopLint(text) {
  const t = (text || '').toLowerCase()
  return SLOP_MARKERS.filter((m) => t.includes(m))
}

export function growthState() {
  const map = new Map()
  for (const e of wsEvents) {
    const p = e.payload || {}
    if (e.kind === 'content.drafted') map.set(p.contentId, { contentId: p.contentId, title: p.title, channel: p.channel, status: 'draft', added: e.iso })
    else if (e.kind === 'content.published' && map.has(p.contentId)) map.get(p.contentId).status = 'published'
  }
  for (const d of wsDecisions('growth.review-pack')) {
    const id = d.decided.data && d.decided.data.contentId
    if (map.has(id) && map.get(id).status !== 'published') map.get(id).status = d.decided.approved ? 'approved' : 'rejected'
  }
  return [...map.values()].reverse()
}

// ── DESIGN STUDIO — brief → explore → critique → jury → pick ──
export function designState() {
  const map = new Map()
  for (const e of wsEvents) {
    const p = e.payload || {}
    if (e.kind === 'design.submitted') map.set(p.subId, { subId: p.subId, surface: p.surface, feel: p.feel, variants: p.variants, status: 'explored', added: e.iso })
    else if (e.kind === 'design.critiqued' && map.has(p.subId)) Object.assign(map.get(p.subId), { findings: p.findings, verdict: p.verdict, status: 'critiqued' })
    else if (e.kind === 'design.jury' && map.has(p.subId)) Object.assign(map.get(p.subId), { ranking: p.ranking, status: 'juried' })
  }
  for (const d of wsDecisions('design.pick')) {
    const id = d.decided.data && d.decided.data.subId
    if (map.has(id)) Object.assign(map.get(id), { picked: d.decided.approved ? d.decided.data.variant : null, status: d.decided.approved ? 'picked' : 'juried' })
  }
  return [...map.values()].reverse()
}

// ── GATES — the seven real ones (arc.gates.yaml, repo fact) + your mode changes ──
const GATES_SEED = [
  { name: 'scan', mode: 'profile', tier: 'hook', evidence: '.claude/state/scan/verdict.json' },
  { name: 'coverage', mode: 'profile', tier: 'hook', evidence: 'coverage/coverage-summary.json' },
  { name: 'reviews', mode: 'block', tier: 'hook', evidence: '.claude/state/reviews' },
  { name: 'docs', mode: 'profile', tier: 'hook', evidence: 'docs' },
  { name: 'rls', mode: 'block', tier: 'hook', evidence: '.claude/state/rls/rls.json' },
  { name: 'spine-api', mode: 'warn', tier: 'hook', evidence: '.claude/state/spine-lint/violations.txt' },
  { name: 'design', mode: 'warn', tier: 'hook', evidence: '.claude/state/design/gate.txt' },
]
export function gatesState() {
  const rows = GATES_SEED.map((g) => ({ ...g }))
  const byName = new Map(rows.map((g) => [g.name, g]))
  for (const e of wsEvents) {
    const p = e.payload || {}
    if (e.kind === 'gate.changed' && byName.has(p.name)) {
      byName.get(p.name).mode = p.mode
      byName.get(p.name).changed = true
    }
  }
  return rows
}

// quick totals for the brief / overview
export function wsSummary() {
  const b = benchState()
  const h = hires()
  const a = absorbRegistry()
  const l = leadsState()
  const g = growthState()
  return {
    benchTotal: b.filter((r) => r.status !== 'retired').length,
    hiresActive: h.filter((r) => r.status === 'active').length,
    contractors: h.filter((r) => r.type === 'contractor' && r.status === 'active').length,
    adopted: a.filter((r) => r.status === 'adopted').length,
    trials: a.filter((r) => r.status === 'trial').length,
    leads: l.leads.length,
    sentToday: l.sentToday,
    published: g.filter((c) => c.status === 'published').length,
    events: wsEvents.length,
  }
}
