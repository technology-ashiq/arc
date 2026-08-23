// ─────────────────────────────────────────────────────────────
// Derived views — every number HQ shows is computed from the
// event log (or clearly-static real-repo facts). Nothing here
// mutates anything. Delete this file's output and it rebuilds
// from the log — arc's A5, one source of truth.
// ─────────────────────────────────────────────────────────────
import { spine } from './store.js'
import { dayRevenue, dayCost } from './sim.js'
import { hhmm } from './kinds.js'

export const today = () => spine.events.filter((e) => e.day === spine.dayIndex)
export const clockLabel = () => hhmm(spine.clock) + ' IST'

export function kpis() {
  const t = today()
  const simRev = t.filter((e) => e.kind === 'revenue.simulated').reduce((s, e) => s + (e.payload.amount || 0), 0)
  const realRev = t.filter((e) => e.kind === 'revenue.received').reduce((s, e) => s + (e.payload.amount || 0), 0)
  const cost = t.filter((e) => e.kind === 'cost.recorded').reduce((s, e) => s + (e.payload.cost || 0), 0)
  const ideas = t.filter((e) => e.kind === 'idea.captured').reduce((s, e) => s + (e.payload.candidates || 0), 0)
  const content = t.filter((e) => e.kind === 'content.published').length
  const phases = t.filter((e) => e.kind === 'phase.closed').length
  const pending = spine.pendingApprovals.length
  return {
    realRev,
    simRev,
    cost,
    ret: cost > 0 ? (simRev + realRev) / cost : 0,
    ideas,
    content,
    phases,
    pending,
    minutesNeeded: pending * 3,
    mrrSim: 118000 + spine.dayIndex * 2600, // simulated portfolio ramp
  }
}

export function timeline(limit = 40) {
  return today()
    .slice()
    .sort((a, b) => a.t - b.t)
    .slice(-limit)
}

export function revenueSeries() {
  const out = []
  for (let d = Math.max(0, spine.dayIndex - 13); d < spine.dayIndex; d++) {
    out.push({ day: d, label: `sim d${d}`, value: dayRevenue(d), cost: dayCost(d) })
  }
  const t = kpis()
  out.push({ day: spine.dayIndex, label: 'today', value: t.simRev + t.realRev, cost: t.cost, live: true })
  return out
}

export function pipeline() {
  const t = today()
  return [
    { name: 'Captured', n: 12 + (t.filter((e) => e.kind === 'idea.captured').length ? kpis().ideas : 0), note: 'this week, deduped' },
    { name: 'Council', n: 2 + t.filter((e) => e.kind === 'council.verdict').length, note: 'judged today: ' + t.filter((e) => e.kind === 'council.verdict').length },
    { name: 'Kickoff', n: spine.pendingApprovals.filter((a) => a.tag?.startsWith('build')).length, note: 'awaiting your OK' },
    { name: 'Building', n: 2, note: 'lexos · arc C3' },
    { name: 'Shipped', n: 1 + t.filter((e) => e.kind === 'ship.completed').length, note: 'today: ' + t.filter((e) => e.kind === 'ship.completed').length },
    { name: 'Earning', n: 0, note: 'real ₹0 — honest' },
  ]
}

export function portfolio() {
  const k = kpis()
  return [
    { id: 'lexos', name: 'LexOS', stage: 'venture #1 · live', big: '₹' + Math.round(k.simRev * 0.62).toLocaleString('en-IN'), sub: 'today · SIMULATED (billing not open)', meter: 0.72, tone: 'good', note: 'phase-1 receipts: RLS 10/10 · 163 tests · p95 267ms', real: true },
    { id: 'arc-oss', name: 'arc (open-source)', stage: 'launch ~Nov', big: '₹' + Math.round(k.simRev * 0.38).toLocaleString('en-IN'), sub: 'projected sponsors · SIMULATED', meter: 0.44, tone: 'warn', note: 'constitution doubles as manifesto at launch' },
    { id: 'venturemind', name: 'venturemind', stage: 'consumer repo', big: 'arc ✓', sub: 'upgrade-path dogfood', meter: 0.8, tone: 'good', note: 'registry-tracked install', real: true },
    { id: 'scout', name: 'Opportunity-Scout', stage: 'consumer repo', big: 'arc ✓', sub: 'fresh-install dogfood · discover seed', meter: 0.8, tone: 'good', note: 'registry-tracked install', real: true },
    { id: 'gst', name: 'GST-Recon (candidate)', stage: 'venture #2 slot', big: 'P0 / 5', sub: 'council 8.1 · kickoff in inbox · SIMULATED', meter: 0.08, tone: 'blue', note: 'appetite 2w · burn 0%' },
    { id: 'pv', name: 'PromptVault (demo)', stage: 'kill-review', big: '₹0', sub: '61d · 0 sales · SIMULATED demo of the kill flow', meter: 0.09, tone: 'critical', note: 'kill criteria met — decision in inbox' },
  ]
}

const LADDER_BASE = [
  { cap: 'content.publish', level: 'L1', note: '23/20 unedited approvals — L2 promotion proposed', cap2: 'trial' },
  { cap: 'outreach.send', level: 'L2', note: 'capped 20/day · reply rate 16%', cap2: 'cap: hard' },
  { cap: 'deploy.production', level: 'L2', note: 'arc-gated: tests green required — clean streak', cap2: 'arc-gated' },
  { cap: 'pricing.change', level: 'L1', note: 'every change needs your tap — permanent (E2)', cap2: 'human' },
  { cap: 'support.reply', level: 'L1', note: 'drafts only · 92% sent unedited', cap2: 'trial' },
  { cap: 'trading.real-money', level: 'L0', note: 'paper only · unlock = written rule change + 72h cooldown', cap2: 'locked' },
]
export function ladder() {
  return LADDER_BASE.map((row) => ({ ...row, level: spine.ladderOverrides[row.cap] || row.level }))
}

export function calibration() {
  const promoted = spine.events.filter((e) => e.kind === 'autonomy.changed').length
  return {
    jurors: [
      { name: 'Market juror', hit: 71, wt: '+0.03' },
      { name: 'Risk juror', hit: 64, wt: '—' },
      { name: 'Distribution juror', hit: 58, wt: '−0.02' },
    ],
    honest: 'SIMULATED scoreboard — the real Brier ledger has 0 scored verdicts; flywheel starts at session-001 retrofit',
    rules: [
      { id: 'R-114', text: 'ideas scoring <6 on distribution never recovered post-launch (5/5) → council hard-flags them' },
      { id: 'R-115', text: 'videos with a number in the title: +38% CTR across 21 uploads → title template updated' },
      { id: 'R-116', text: 'CA-niche outreach replies 2.1× on Tue–Wed mornings → sends rescheduled (proposed)' },
    ],
    promoted,
  }
}

export function briefLines() {
  const k = kpis()
  const t = today()
  const calls = t.filter((e) => e.kind === 'outreach.sent' && /call booked/.test(e.text)).length
  return {
    greeting: spine.clock < 12 * 60 ? 'Good morning, Ashiq.' : spine.clock < 17 * 60 ? 'Good afternoon, Ashiq.' : 'Good evening, Ashiq.',
    lines: [
      { tag: 'needs-you', tone: 'amber', text: `${k.pending} decision${k.pending === 1 ? '' : 's'} in the inbox — ~${k.minutesNeeded} min` },
      { tag: 'money', tone: 'green', text: `real ₹0 (honest) · simulated ₹${(k.simRev + k.realRev).toLocaleString('en-IN')} vs ₹${k.cost.toLocaleString('en-IN')} AI spend` },
      { tag: 'progress', tone: 'cyan', text: `${k.phases} phase${k.phases === 1 ? '' : 's'} closed · ${k.content} pieces published · ${k.ideas} ideas captured · ${calls ? '1 call booked' : 'no calls yet'}` },
      { tag: 'background', tone: 'dim', text: `${today().length} receipts on the spine today · 0 quarantined · trader locked L0` },
    ],
  }
}

// factory: the REAL current arc state (repo facts, static by nature)
export const factoryState = {
  cycle: { id: 'C3', name: 'the designer', phases: [
    { n: '00', name: 'steel thread — read-only critic e2e', status: 'closed 2026-07-28' },
    { n: '01', name: 'brief mode + design-lint v0 + module', status: 'built · awaiting phase-done' },
    { n: '02', name: 'explore: 3 variants → blind ranking', status: 'pending · gate ADR-0044' },
    { n: '03', name: 'intelligence library + LexOS pilot', status: 'pending' },
  ]},
  gates: [
    { name: 'tests', mode: 'FAIL' }, { name: 'coverage', mode: 'FAIL' }, { name: 'docs-drift', mode: 'FAIL' },
    { name: 'scans', mode: 'FAIL' }, { name: 'review-stamp', mode: 'FAIL' }, { name: 'design', mode: 'WARN · trial' },
  ],
  profile: 'standard',
  tests: '389 · 3-OS CI',
  adrs: 48,
}

// engine room: driver table (the model-agnostic story, live in settings)
export const DRIVERS = [
  { id: 'anthropic', name: 'Claude (Anthropic)', model: 'claude-sonnet-4-5' },
  { id: 'openai', name: 'ChatGPT (OpenAI)', model: 'gpt-5-mini' },
  { id: 'gemini', name: 'Gemini (Google)', model: 'gemini-2.5-flash' },
  { id: 'openrouter', name: 'OpenRouter (any model)', model: 'anthropic/claude-sonnet-4.5' },
  { id: 'custom', name: 'Custom (OpenAI-compatible)', model: '' },
]
