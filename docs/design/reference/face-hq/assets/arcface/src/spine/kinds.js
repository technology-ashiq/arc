// ─────────────────────────────────────────────────────────────
// The event vocabulary the HQ renders. Shapes follow arc's real
// closed 18-kind spine vocabulary (ADR-0026) — module tags and
// autonomy levels ride in the payload, exactly like the mock's
// timeline lines. One color system, one legend, page-wide.
// ─────────────────────────────────────────────────────────────
// meaning contract (docs/design/system/tokens.css, ADR-1308):
//   amber = needs-you ONLY · green = REAL money ONLY · red = incident ONLY
//   violet = every non-real class (SIMULATED / REHEARSAL / PAPER), hatched
//   cyan = the product itself — no meaning. Council is as real as any
//   receipt, so it renders accent-dim, never violet.
export const FAMILY = {
  factory: { color: '#2dd4bf', label: 'factory' },
  money: { color: '#4ade80', label: 'real money' },
  decision: { color: '#fbbf5d', label: 'needs-you / decision' },
  council: { color: 'rgba(45,212,191,0.55)', label: 'council' },
  growth: { color: '#e3cd7a', label: 'growth / leads' },
  ops: { color: '#7dd3fc', label: 'ops / system' },
  incident: { color: '#f87171', label: 'incident' },
  nonreal: { color: '#a99ae6', label: 'non-real · labeled' },
  system: { color: 'rgba(255,255,255,0.62)', label: 'system' },
}

export const KIND = {
  'session.started': 'system',
  'session.ended': 'system',
  'idea.captured': 'growth',
  'council.verdict': 'council',
  'kickoff.completed': 'factory',
  'phase.closed': 'factory',
  'review.completed': 'factory',
  'qa.completed': 'factory',
  'ship.completed': 'factory',
  'canary.report': 'ops',
  'content.published': 'growth',
  'outreach.sent': 'growth',
  'support.triaged': 'ops',
  'approval.requested': 'decision',
  'decision.recorded': 'decision',
  'revenue.received': 'money',
  'revenue.simulated': 'nonreal',
  'cost.recorded': 'money',
  'autonomy.changed': 'decision',
  'retro.completed': 'factory',
  'trade.paper': 'nonreal',
  'note.logged': 'system',
  'redaction.applied': 'system',
  'day.closed': 'system',
  'constitution.adopted': 'decision',
  'constitution.amended': 'decision',
  // ── workspace vocabulary (your write paths; extension per ADR-0304 style) ──
  'bench.registered': 'ops',
  'bench.scored': 'ops',
  'bench.retired': 'system',
  'promotion.proposed': 'decision',
  'hire.added': 'factory',
  'hire.certified': 'ops',
  'hire.retired': 'system',
  'run.queued': 'ops',
  'run.completed': 'ops',
  'run.failed': 'incident',
  'incident.raised': 'incident',
  'absorb.captured': 'ops',
  'absorb.staged': 'ops',
  'absorb.retired': 'system',
  'agent.added': 'factory',
  'agent.toggled': 'system',
  'lead.researched': 'growth',
  'outreach.replied': 'growth',
  'meeting.booked': 'decision',
  'deal.won': 'money',
  'deal.lost': 'growth',
  'lead.suppressed': 'system',
  'content.drafted': 'growth',
  'design.submitted': 'factory',
  'design.critiqued': 'factory',
  'design.jury': 'factory',
  'gate.changed': 'decision',
  'council.outcome': 'council',
  // ── v0.6 · the 19 rooms that were missing (arc expected-set.json, 32 rooms) ──
  // policy — "Deny by default. Every capability earns its level."
  'policy.proposed': 'decision',
  'policy.changed': 'decision',
  // model-policy — "Tiers are law, not taste."
  'tier.proposed': 'decision',
  'tier.changed': 'decision',
  // scheduler — "Nothing runs because someone remembered."
  'job.registered': 'ops',
  'job.fired': 'ops',
  'job.failed': 'incident',
  'job.paused': 'system',
  'heartbeat.ok': 'system',
  // memory — "A correction made twice becomes a rule."
  'lesson.logged': 'system',
  'rule.promoted': 'decision',
  'recall.ran': 'ops',
  // evolve — "Measured, or it did not improve."
  'experiment.opened': 'ops',
  'experiment.measured': 'nonreal',
  'experiment.concluded': 'decision',
  // develop — "A phase closes on evidence, or it does not close."
  'slice.opened': 'factory',
  'slice.proven': 'factory',
  'phase.refused': 'incident',
  // review-ship — "Every gate blocks by default."
  'profile.switched': 'decision',
  // ventures — "The factory is not the product."
  'venture.registered': 'factory',
  'venture.staged': 'factory',
  'venture.killed': 'decision',
  // strategy — "One plan is live per lane. The rest are history."
  'plan.adopted': 'decision',
  'adr.recorded': 'decision',
  // org — "Sixteen lanes. Who is awake, who is idle, who is blocked."
  'lane.status': 'system',
  'lane.born': 'factory',
  // concepts — "Every word arc uses, and the room it lives in."
  'concept.defined': 'system',
  // ops (planned) — "Two live ventures away."
  'incident.acked': 'ops',
  'incident.resolved': 'ops',
  'support.dropped': 'ops',
  'ops.report': 'ops',
  // trader (planned) — "Paper only, until a written rule change unlocks it."
  'question.opened': 'nonreal',
  'backtest.completed': 'nonreal',
  'strategy.registered': 'nonreal',
  'trade.verdict': 'nonreal',
  // discover (planned) — "The next venture is chosen, not stumbled into."
  'idea.scored': 'growth',
  'idea.shortlisted': 'decision',
  // ask-arc — "a brain with no hands"
  'ask.answered': 'system',
  // map / toolbelt — read-only rooms; a pin is the only write
  'tool.pinned': 'system',
}

export const familyOf = (kind) => FAMILY[KIND[kind] || 'system'] || FAMILY.system
export const familyKey = (kind) => KIND[kind] || 'system'

// deterministic presentational ulid-ish ids (E3: not real ULIDs, and we say so)
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export function fakeUlid(seed) {
  let s = '01J9'
  let x = seed >>> 0
  for (let i = 0; i < 8; i++) {
    x = (x * 1664525 + 1013904223) >>> 0
    s += B32[x % 32]
  }
  return s
}

export const inr = (n) =>
  '₹' + Math.round(n).toLocaleString('en-IN')

export const hhmm = (mins) => {
  const h = Math.floor(mins / 60) % 24
  const m = Math.floor(mins % 60)
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}
