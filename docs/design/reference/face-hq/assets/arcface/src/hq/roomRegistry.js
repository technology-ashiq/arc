// ─────────────────────────────────────────────────────────────
// The room registry — arc's 32 rooms + this app's own 4, in the
// five rings and the read order arc's expected-set.json freezes.
// Components are wired in HQ.jsx; everything else (the palette,
// the map, the brain, the org roster) reads THIS file, so a room
// exists in exactly one place. `sentence` is arc's own opening
// line for the room (room-copy.json) — every room opens with a
// sentence, never a title.
// ─────────────────────────────────────────────────────────────
import {
  SunHorizon, Tray, MapTrifold, Pulse, Kanban, ChatCircleDots,
  Gear, Stack, ShieldCheck, Clock, Brain, Flask, ChartBarHorizontal, Funnel,
  Gavel, Hammer, GitPullRequest, PenNib, Toolbox, Factory, UsersThree, Robot,
  CurrencyInr, TrendUp, Handshake, Scales, Rocket, Siren, ChartLineUp, Binoculars,
  Bank, GraduationCap, Compass, TreeStructure, BookBookmark, BookOpen,
} from '@phosphor-icons/react'

export const RING_ORDER = ['command', 'kernel', 'factory', 'money', 'company']

// planned = the lane is not born; the room is drawn dotted (planned-rooms.json)
// extra   = this app's own room, not in arc's registry (kept, labeled)
export const ROOM_META = [
  // ── command — the daily surface ──
  { id: 'overview', name: 'today', ring: 'command', I: SunHorizon, sentence: 'The whole company on one screen.', lede: 'the brief, the KPIs, the tape — every number derives from the event log' },
  { id: 'inbox', name: 'inbox', ring: 'command', I: Tray, sentence: 'A machine may raise it. Only you may decide it.', lede: 'the one write path in this product — a typed reason, no bulk action, no default, no undo' },
  { id: 'map', name: 'map', ring: 'command', I: MapTrifold, sentence: 'If it is not on this map, it is not in the company.', lede: 'every room a station, every lane a line — unexercised drawn dashed, planned drawn dotted, in-flight dots moving on receipt' },
  { id: 'spine', name: 'the spine', ring: 'command', I: Pulse, sentence: 'If it is not an event, it did not happen.', lede: 'the append-only log, filterable, every line a receipt' },
  { id: 'board', name: 'board', ring: 'command', I: Kanban, sentence: 'Every lane, its phase, and what it is burning.', lede: 'the portfolio view — appetite spent against appetite bought, and how far each lane is from its own kill line' },
  { id: 'ask-arc', name: 'ask arc', ring: 'command', I: ChatCircleDots, sentence: 'Ask in words. Every answer carries its receipt.', lede: 'a brain with no hands — it reads the live state, cites the ULID, and cannot stamp anything' },
  // ── kernel — what the company runs on ──
  { id: 'engine', name: 'engine room', ring: 'kernel', I: Gear, sentence: 'The driver is a setting, not a religion.', lede: 'the brain behind the face — provider, model, key on this machine' },
  { id: 'model-policy', name: 'model policy', ring: 'kernel', I: Stack, sentence: 'Tiers are law, not taste.', lede: 'which tier each process runs at, and why a change is a reviewed diff rather than a quiet edit (ADR-0069)' },
  { id: 'policy', name: 'policy', ring: 'kernel', I: ShieldCheck, sentence: 'Deny by default. Every capability earns its level.', lede: 'the subject table — what each process may touch, and the two keys that must turn for it to change' },
  { id: 'scheduler', name: 'scheduler', ring: 'kernel', I: Clock, sentence: 'Nothing runs because someone remembered.', lede: 'jobs, their next fire, their last outcome, and the heartbeat that proves the clock is alive' },
  { id: 'memory', name: 'memory', ring: 'kernel', I: Brain, sentence: 'A correction made twice becomes a rule.', lede: 'the playbook — what recall costs today, and which lessons were promoted out of the retro log' },
  { id: 'evolve', name: 'evolve', ring: 'kernel', I: Flask, sentence: 'Measured, or it did not improve.', lede: 'champion against challenger, with a sample floor and a holdout — the winner lands as a reviewed diff, never self-merged' },
  { id: 'bench', name: 'bench', ring: 'kernel', I: ChartBarHorizontal, sentence: 'Drivers are compared, never trusted.', lede: 'champion and challenger scorecards over fixtures — NO PROPOSAL is a first-class result' },
  { id: 'absorb', name: 'absorb', ring: 'kernel', I: Funnel, sentence: 'Quarantined before it is believed.', lede: 'candidate · trial · adopted · retired — at most twelve adopted per lane' },
  // ── factory — how things get built ──
  { id: 'council', name: 'council', ring: 'factory', I: Gavel, sentence: 'Twelve seats. One verdict. A review-by date.', lede: 'stances debate blind, a verifier grades every point, calibration scores it later' },
  { id: 'develop', name: 'develop', ring: 'factory', I: Hammer, sentence: 'A phase closes on evidence, or it does not close.', lede: 'the execution harness — slices, their proofs, and the Definition of Done each one is measured against' },
  { id: 'review-ship', name: 'review · ship', ring: 'factory', I: GitPullRequest, sentence: 'Every gate blocks by default.', lede: 'seven gates, commit-keyed — a new commit is a new review, and a profile switches the whole set as one' },
  { id: 'design-studio', name: 'design studio', ring: 'factory', I: PenNib, sentence: 'The critic has no edit tools.', lede: 'brief → explore → critique → jury → your pick' },
  { id: 'toolbelt', name: 'toolbelt', ring: 'factory', I: Toolbox, sentence: 'Every command, every agent, every rule — one place to look.', lede: 'commands, agents, hooks, rules and the lints that hold them; click one and the face explains it' },
  { id: 'factory', name: 'factory', ring: 'factory', I: Factory, extra: true, sentence: 'Cycles, phases, gates — the floor.', lede: 'the current cycle and what each phase is waiting on' },
  { id: 'executor', name: 'executor', ring: 'factory', I: UsersThree, extra: true, sentence: 'The credential is the leash.', lede: 'employees and contractors — tenure fields, capped keys, a twelve-fixture certification' },
  { id: 'agents', name: 'agents', ring: 'factory', I: Robot, extra: true, sentence: 'A roster, not a crowd.', lede: 'every agent, its tier, and whether it is switched on' },
  // ── money — where it is earned, or honestly not yet ──
  { id: 'money', name: 'money', ring: 'money', I: CurrencyInr, sentence: 'Green is spent only on real rupees.', lede: 'the ledger — revenue.received is real-only; everything else says simulated' },
  { id: 'growth', name: 'growth', ring: 'money', I: TrendUp, sentence: 'Published under your name only with your stamp.', lede: 'draft → review pack → approve → publish' },
  { id: 'leads', name: 'leads', ring: 'money', I: Handshake, sentence: 'Twenty sends a day. Two touches a week. No exceptions.', lede: 'the funnel, its caps, and the suppression ledger' },
  { id: 'legal', name: 'legal', ring: 'money', I: Scales, sentence: 'A template is not advice.', lede: 'documents, review status, and what a lawyer still has to sign' },
  { id: 'ventures', name: 'ventures', ring: 'money', I: Rocket, sentence: 'The factory is not the product.', lede: 'each venture in its own repo with its own money and its own kill criteria — the venture track wins every tie' },
  { id: 'ops', name: 'ops', ring: 'money', I: Siren, planned: true, sentence: 'Two live ventures away.', lede: 'planned, drawn dotted — this room opens when a second venture is running and support stops being one person' },
  { id: 'trader', name: 'trader', ring: 'money', I: ChartLineUp, planned: true, sentence: 'Paper only, until a written rule change unlocks it.', lede: 'planned, drawn dotted — real-money trading sits at L0 behind a 72-hour cooldown and an amendment, not a toggle' },
  { id: 'discover', name: 'discover', ring: 'money', I: Binoculars, planned: true, sentence: 'The next venture is chosen, not stumbled into.', lede: 'planned, drawn dotted — opens when the venture #2 slot needs filling from a scored field, not a hunch' },
  // ── company — what it is, and what it learned ──
  { id: 'law', name: 'the law', ring: 'company', I: Bank, sentence: 'Two eternal articles. Ten working ones.', lede: 'the constitution, and what an amendment costs' },
  { id: 'learn', name: 'learn', ring: 'company', I: GraduationCap, sentence: 'Calibration, not vibes.', lede: 'juror hit rates, the rules the retro promoted, the ledger behind them' },
  { id: 'strategy', name: 'strategy', ring: 'company', I: Compass, sentence: 'One plan is live per lane. The rest are history.', lede: 'the plans, the ADRs behind them, and the decisions that are now too expensive to revisit' },
  { id: 'org', name: 'org', ring: 'company', I: TreeStructure, sentence: 'Sixteen lanes. Who is awake, who is idle, who is blocked.', lede: 'the company as a roster rather than a board — every lane, its status, and the one thing it is waiting on' },
  { id: 'concepts', name: 'concepts', ring: 'company', I: BookBookmark, sentence: 'Every word arc uses, and the room it lives in.', lede: 'each term anchored to a room and a station — this is what the command palette searches' },
  { id: 'story', name: 'story', ring: 'company', I: BookOpen, extra: true, sentence: 'How it got here.', lede: 'the cycles, in order' },
]

export const ROOM_IDS = ROOM_META.map((r) => r.id)
export const roomMeta = (id) => ROOM_META.find((r) => r.id === id)

// old ids still typed, spoken and linked — they resolve, never 404
export const ROOM_ALIASES = { autonomy: 'policy', portfolio: 'board', today: 'overview', design: 'design-studio', 'engine-room': 'engine', 'council-chamber': 'council', 'ask': 'ask-arc', 'review': 'review-ship', 'ship': 'review-ship' }
export const resolveRoom = (id) => (ROOM_IDS.includes(id) ? id : ROOM_ALIASES[id] || null)

// arc's 16 born lanes → the room that renders each (expected-set.json lanes.map)
export const LANE_ROOM = {
  absorb: 'absorb', bench: 'bench', design: 'design-studio', develop: 'develop', engine: 'engine', evolve: 'evolve',
  face: 'toolbelt', growth: 'growth', leads: 'leads', ledger: 'money', legal: 'legal', memory: 'memory',
  'model-policy': 'model-policy', policy: 'policy', portfolio: 'board', scheduler: 'scheduler',
}
export const LANES = Object.keys(LANE_ROOM)
