// ─────────────────────────────────────────────────────────────
// The event vocabulary the HQ renders. Shapes follow arc's real
// closed 18-kind spine vocabulary (ADR-0026) — module tags and
// autonomy levels ride in the payload, exactly like the mock's
// timeline lines. One color system, one legend, page-wide.
// ─────────────────────────────────────────────────────────────
export const FAMILY = {
  factory: { color: '#00ffd1', label: 'factory' },
  money: { color: '#4ade80', label: 'money' },
  decision: { color: '#fbbf5d', label: 'needs-you / decision' },
  council: { color: '#b9a2ff', label: 'council' },
  growth: { color: '#f6d860', label: 'growth / leads' },
  ops: { color: '#7dd3fc', label: 'ops / system' },
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
  'revenue.simulated': 'money',
  'cost.recorded': 'money',
  'autonomy.changed': 'decision',
  'retro.completed': 'factory',
  'trade.paper': 'ops',
  'note.logged': 'system',
  'redaction.applied': 'system',
  'day.closed': 'system',
  'constitution.adopted': 'decision',
  'constitution.amended': 'decision',
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
