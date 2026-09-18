// ─────────────────────────────────────────────────────────────
// The simulator — a virtual arc day, seeded and deterministic
// per day index. World model (labeled SIMULATED everywhere):
// today's REAL arc state (cycle 3, LexOS venture #1, spine live)
// projected a few weeks forward, so every module — including the
// sleeping ones — can be seen WORKING: discover hunts, growth
// publishes, leads sends capped outreach, ops sweeps, the trader
// stays locked at L0, the council judges, phases close, money
// arrives as revenue.simulated (real ₹ stays 0 and says so).
// ─────────────────────────────────────────────────────────────
import { fakeUlid } from './kinds.js'

export const HISTORY_DAYS = 14
export const DAY_START = 5 * 60 + 55 // 05:55
export const DAY_END = 21 * 60 + 45 // 21:45
export const baseDate = '2026-07-28' // sim day 14 == "today", labeling only

// mulberry32 — tiny seeded rng
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)]
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1))

let idSeed = 1000
const ev = (day, t, kind, module, level, text, payload = {}, extra = {}) => ({
  id: fakeUlid(idSeed++),
  day,
  t,
  kind,
  module,
  level,
  text,
  payload,
  ...extra,
})

// revenue curve for charts — grows across history (simulated LexOS ramp)
export function dayRevenue(d) {
  const r = rng(900 + d)
  const base = 2600 + d * 420
  return Math.round((base + r() * 1400) / 1)
}
export function dayCost(d) {
  const r = rng(300 + d)
  return Math.round(700 + r() * 600)
}

// approval card generators — the 3 facts the brief demands ride on every card
function approvalCard(day, r, slot) {
  const variants = [
    {
      id: `ap-${day}-kick`,
      title: 'Kickoff: venture #2 candidate — GST-Recon',
      tag: 'build · L1',
      facts: [
        { k: 'council', v: 'PROCEED 8.1/10 · market 9 · risk 6' },
        { k: 'money', v: '₹0 at stake · appetite 2w Tier M' },
        { k: 'kill', v: 'kill criteria drafted: 60d / 0 paying → attic' },
      ],
      actions: [
        { label: 'approve kickoff', approved: true },
        { label: 'send back with notes', approved: true, soft: true },
        { label: 'reject', approved: false },
      ],
    },
    {
      id: `ap-${day}-batch`,
      title: 'Content batch — 7 pieces (Mon–Tue)',
      tag: 'growth · L1→L2 trial',
      facts: [
        { k: 'council', v: '23/23 previous drafts approved unedited' },
        { k: 'money', v: '₹0 at stake · counts toward L2 promotion evidence' },
        { k: 'kill', v: 'slop-lint clean · no venture risk' },
      ],
      actions: [
        { label: 'approve all', approved: true },
        { label: 'review each', approved: true, soft: true },
      ],
    },
    {
      id: `ap-${day}-bill`,
      title: 'LexOS — open billing week (Razorpay live)',
      tag: 'venture · money · human-only',
      facts: [
        { k: 'council', v: 'session 001 CONDITIONAL · override ADR-0006 on file' },
        { k: 'money', v: '₹2,999–5,999 / firm / month at stake' },
        { k: 'kill', v: 'kill checkpoint: day 26 after billing ships' },
      ],
      actions: [
        { label: 'approve — open billing', approved: true },
        { label: 'hold one week', approved: true, soft: true },
        { label: 'reject', approved: false },
      ],
    },
    {
      id: `ap-${day}-kill`,
      title: 'Kill review: PromptVault → attic',
      tag: 'portfolio · human-only',
      facts: [
        { k: 'council', v: 'kill criteria met: 61d · 0 sales · 214 visits' },
        { k: 'money', v: '₹0 MRR · harvest 3 reusable components' },
        { k: 'kill', v: 'attic, never delete — retro scheduled (A10)' },
      ],
      actions: [
        { label: 'confirm kill → attic', approved: true, danger: true },
        { label: 'give it 30 days', approved: true, soft: true },
      ],
    },
    {
      id: `ap-${day}-const`,
      title: 'Adopt the Constitution v0.1',
      tag: 'governance · human-only',
      facts: [
        { k: 'council', v: 'constitution-compliance lens: PASS' },
        { k: 'money', v: '₹0 at stake · irreversibility HIGH (tier E)' },
        { k: 'kill', v: 'tier E becomes unamendable on adoption' },
      ],
      actions: [
        { label: 'adopt — first constitution.adopted', approved: true },
        { label: 'keep as draft', approved: true, soft: true },
      ],
    },
    {
      id: `ap-${day}-promo`,
      title: 'Promote content.publish L1 → L2',
      tag: 'autonomy · trial-ledger',
      facts: [
        { k: 'council', v: 'evidence: 23/20 consecutive unedited approvals' },
        { k: 'money', v: 'caps stay: 7 pieces/week · venture channels only' },
        { k: 'kill', v: 'auto-demote on any incident — A4' },
      ],
      actions: [
        { label: 'promote', approved: true },
        { label: 'not yet — more evidence', approved: false, soft: true },
      ],
    },
  ]
  return variants[(day + slot) % variants.length]
}

// one simulated day — same beat skeleton, seeded variation
export function makeDay(day) {
  const r = rng(42 + day * 7)
  const beats = []
  const rev = dayRevenue(day)
  const cost = dayCost(day)
  const posts = ri(r, 180, 260)
  const cands = ri(r, 3, 6)
  const tests = 389 + Math.floor(day / 3)

  beats.push(ev(day, 6 * 60 + ri(r, 0, 9), 'idea.captured', 'discover', 'L2', `Nightly hunt: ${posts} posts scanned (r/smallbusiness, r/LegalAdviceIndia) → clustered → ${cands} candidates scored`, { posts, candidates: cands }, { receipt: 'run' }))
  beats.push(ev(day, 6 * 60 + 30, 'session.started', 'core', 'auto', 'Factory session started · hooks green · toolchain healthy', {}, { receipt: 'log' }))
  beats.push(ev(day, 7 * 60 + ri(r, 0, 6), 'council.verdict', 'council', 'L1', `Judged “${pick(r, ['GST reconciliation for CAs', 'hearing-cause-list scraper', 'e-invoice compliance helper'])}” → PROCEED ${(7.6 + r()).toFixed(1)}/10 → kickoff drafted, sent to inbox`, { verdict: 'PROCEED' }, { receipt: 'verdict' }))
  beats.push(ev(day, 7 * 60 + 40, 'content.published', 'growth', 'L2', `${ri(r, 2, 3)} SEO articles published (advocate-fee-recovery, e-invoice-rules) · next batch drafted → inbox`, {}, { receipt: 'diff' }))
  beats.push(ev(day, 8 * 60 + 10, 'review.completed', 'design', 'L1', `Design critique: lexos /dashboard → ${r() < 0.7 ? '0 VIOLATION · PASS' : '1 VIOLATION → fix queued → re-verify'} (brief: calm · dense · factual)`, { lens: 'design' }, { receipt: 'critique' }))
  beats.push(ev(day, 8 * 60 + 31, 'content.published', 'growth', 'L2', `Video published: “${pick(r, ['5 invoicing mistakes killing your cash flow', 'Why your firm loses hearing dates', 'The 3-line legal notice that works'])}” · ${(1 + r() * 1.4).toFixed(1)}k views`, {}, { receipt: 'link' }))
  beats.push(ev(day, 9 * 60 + 12, 'phase.closed', 'lexos', 'arc', `Phase ${2 + (day % 3)} closed — ${pick(r, ['hearing reminders', 'invoice engine', 'client portal'])} · ${tests} tests · live demo ✓ · evidence bundle committed`, { tests }, { receipt: 'bundle' }))
  beats.push(ev(day, 10 * 60 + 5, 'qa.completed', 'qa', 'L1', `Browser QA: ${ri(r, 5, 8)} flows green · 0 regressions escaped · axe clean`, {}, { receipt: 'report' }))
  beats.push(ev(day, 11 * 60 + 30, 'outreach.sent', 'leads', 'L2', `Outreach: ${ri(r, 14, 19)} sent (cap 20/day) · ${ri(r, 1, 4)} replies · ${r() < 0.5 ? '1 call booked — added to calendar' : 'no calls today — honest zero'}`, {}, { receipt: 'thread' }))

  const ap1 = approvalCard(day, r, 0)
  beats.push(ev(day, 12 * 60 + 20, 'approval.requested', 'hq', 'L1', `Approval requested: ${ap1.title}`, {}, { approval: ap1, receipt: 'card' }))

  beats.push(ev(day, 13 * 60 + 5, 'revenue.simulated', 'lexos', 'auto', `+ ₹${Math.round(rev * 0.62).toLocaleString('en-IN')} — simulated: ${ri(r, 1, 3)} firms on Growth plan (billing not open; real ₹ = 0)`, { amount: Math.round(rev * 0.62), venture: 'lexos', simulated: true }, { receipt: 'txn' }))
  beats.push(ev(day, 14 * 60 + 47, 'revenue.simulated', 'arc-oss', 'auto', `+ ₹${Math.round(rev * 0.38).toLocaleString('en-IN')} — projected sponsors (public launch is Nov; labeled simulated)`, { amount: Math.round(rev * 0.38), venture: 'arc-oss', simulated: true }, { receipt: 'repo' }))
  beats.push(ev(day, 15 * 60 + 20, 'cost.recorded', 'ledger', 'auto', `AI spend so far today: ₹${cost.toLocaleString('en-IN')} · return ${(rev / cost).toFixed(1)}× (simulated revenue ÷ real-shaped cost)`, { cost }, { receipt: 'ledger' }))
  beats.push(ev(day, 16 * 60 + 40, 'canary.report', 'ops', 'L1', `Canary sweep: ${pick(r, ['3/3', '3/3', '2/3 — 1 slow p95, watch'])} surfaces healthy · ${ri(r, 0, 3)} support tickets triaged → replies drafted for OK`, {}, { receipt: 'report' }))
  beats.push(ev(day, 18 * 60, 'trade.paper', 'trader', 'L0', `Paper portfolio ${(r() < 0.6 ? '+' : '−')}${(r() * 0.8).toFixed(1)}% today · ${61 + day}-day sim · real money: locked (L0, 72h-cooldown rule)`, {}, { receipt: 'log' }))
  beats.push(ev(day, 19 * 60, 'ship.completed', 'git', 'arc', `Ship: lint → build → test → deploy · deploy-guard re-ran ${tests} tests · canary watching`, { tests }, { receipt: 'run' }))

  const ap2 = approvalCard(day, r, 3)
  beats.push(ev(day, 20 * 60 + 15, 'approval.requested', 'hq', 'human', `Approval requested: ${ap2.title}`, {}, { approval: ap2, receipt: 'card' }))

  beats.push(ev(day, 21 * 60, 'retro.completed', 'plan', 'auto', `Daily retro: ${ri(r, 1, 3)} playbook rules added · market-juror weight ${r() < 0.6 ? '+0.03 (hit-rate ↑)' : 'unchanged'} · 1 autonomy promotion ${r() < 0.5 ? 'proposed' : 'pending evidence'}`, {}, { receipt: 'delta' }))

  beats.sort((a, b) => a.t - b.t)
  return { beats, rev, cost }
}
