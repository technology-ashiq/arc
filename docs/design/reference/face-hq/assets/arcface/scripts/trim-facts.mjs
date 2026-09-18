// trims arc-facts.json → src/data/arcFacts.js (the seed the registries fold over)
import fs from 'node:fs'
const f = JSON.parse(fs.readFileSync(process.argv[2] || 'arc-facts.json', 'utf8'))
const T = (x) => (x == null ? null : typeof x === 'string' ? x : x.text != null ? String(x.text) : x.absent ? null : typeof x === 'object' ? null : String(x))
const S = (x, n = 170) => { const s = T(x); return s == null ? null : s.replace(/\s+/g, ' ').trim().slice(0, n) }
const arr = (x) => (Array.isArray(x) ? x : x && (x.entries || x.items || x.rows || x.list) || [])
const texts = (x, n = 170) => arr(x).map((e) => S(e, n)).filter(Boolean)
const src = (x) => (x && x.src) || null

const out = {}
out.meta = { generated: f.meta.generated, repo: 'E:\\Work_Hub\\01_Automemory\\arc (read-only)', lanes: 16, note: 'every row is a repo fact; src = file:line in the arc repo' }

out.lanes = f.lanes.map((l) => {
  const pt = (f.portfolioTable || []).find((p) => p.lane === l.id) || {}
  return {
    id: l.id, room: l.room, ring: l.ring, status: l.status,
    cycle: S(l.cycle, 120), currentPhase: S(l.currentPhase, 160), phasesTotal: l.phasesTotal, phasesClosed: l.phasesClosed,
    waitingOn: S(l.waitingOn, 160), dependsOn: S(l.dependsOn, 120),
    appetite: l.appetite && !l.appetite.absent ? { value: l.appetite.value || null, burn: l.appetite.burn || null, unit: l.appetite.unit || null } : null,
    plan: S(l.planOneLine, 120), goal: S(l.goal, 200), next: S(pt.next, 200), position: S(pt.position, 160),
    phases: arr(l.phaseRows).slice(0, 10).map((p) => ({ phase: p.phase, capability: S(p.capability, 150), appetite: p.appetite || null, status: S(p.status, 90), closed: !!p.closed })),
    src: src(l.rawStatus),
  }
})
out.portfolioBands = (f.portfolioBands || []).map((b) => ({ band: b.band, owner: S(b.owner, 140) }))

const P = f.policy
out.policy = {
  file: P.file, version: S(P.version, 60), preamble: texts(P.preamble, 200),
  ladder: Object.fromEntries(Object.entries(P.ladder || {}).filter(([k]) => /^L[0-3]$/.test(k)).map(([k, v]) => [k, S(v, 200)])),
  twoKeys: Object.entries(P.twoKeys || {}).map(([k, v]) => ({ key: k, text: S(v, 220), src: src(v) })),
  defaults: Object.entries(P.defaults || {}).map(([k, v]) => ({ key: k, text: S(v, 200), src: src(v) })),
  ungrantableActions: texts(P.ungrantableActions, 80), ungrantableResources: texts(P.ungrantableResources, 80),
  targets: { note: S(P.targets, 160), items: texts(P.targets && P.targets.items, 60) },
  subjects: (P.subjects || []).map((s) => ({ subject: s.subject, ceiling: s.ceiling || null, notes: S(s.notes, 150), e2: s.e2 || [], capabilities: Object.fromEntries(Object.entries(s.capabilities || {}).map(([c, v]) => [c, { level: v.level, roots: v.roots || null, note: S(v.note || v.notes, 100) }])), src: s.src })),
  docsRules: texts(P.docsRules, 200),
  adrs: (P.adrs || []).slice(0, 12).map((a) => ({ adr: a.adr, title: S(a.title, 150), status: a.status || null })),
}

const M = f.modelPolicy
out.modelPolicy = {
  routerFile: M.routerFile, notes: texts(M.notes, 170),
  tiers: M.tiers, models: (M.models || []).map((m) => ({ tier: m.tier, model: m['claude-code'] || m.model || null, src: m.src })),
  tierDefs: arr(M.adr0069 && M.adr0069.tierDefs).map((t) => ({ tier: t.tier, meaning: S(t.meaning, 220) })),
  unmapped: M.unmappedTier ? { tier: M.unmappedTier.tier, text: S(M.unmappedTier, 160) } : null,
  classes: (M.classes || []).map((c) => ({ cls: c.class, tier: c.tier, driver: c.driver, fallback: c.fallback || [], cap: c.cap || null, hosted: c.hosted || null, judge: c.judge || null, review_by: c.review_by || null, src: c.src })),
  default: M.default ? { tier: String(M.default.tier || '').replace(/^tier:\s*/, ''), driver: String(M.default.driver || '').replace(/^driver:\s*/, '') } : null,
  egressHosts: arr(M.egressAllowlist && M.egressAllowlist.hosts).map((h) => h.host || S(h)), egressRules: texts(M.egressAllowlist && M.egressAllowlist.rules, 140),
  adr0069: { title: S(M.adr0069 && M.adr0069.title, 80), oneLiner: S(M.adr0069 && M.adr0069.oneLiner, 200) },
  lane: S(M.lane, 160),
}

const Sc = f.scheduler
out.scheduler = {
  file: Sc.file, ceiling: S(Sc.monthlyCeilingInr, 60), defaults: S(Sc.defaults, 80), grammar: texts(Sc.grammar, 160), heartbeat: texts(Sc.heartbeat, 200),
  jobs: (Sc.jobs || []).map((j) => ({ name: j.name, type: j.type, entry: j.entry, budgetMin: j.budget && j.budget.min, level: j.level, schedule: j.schedule, enabled: String(j.enabled) === 'true', catchup: j.catchup || null, notes: S(j.notes, 220), src: j.src })),
  stateFiles: Sc.stateFiles ? { jobLogs: arr(Sc.stateFiles.jobLogs), briefs: arr(Sc.stateFiles.briefs), closedDays: Sc.stateFiles.closedDays } : null,
  phases: arr(Sc.lanePhases).map((p) => ({ phase: p.phase, capability: S(p.capability, 150), appetite: p.appetite || null, status: S(p.status, 90), closed: !!p.closed })),
}

const Me = f.memory
out.memory = {
  retro: arr(Me.retroLog).slice(0, 40).map((r) => ({ date: r.date, lane: r.lane, kind: r.kind, correction: S(r.correction, 200), lesson: S(r.lesson, 200), tags: r.tags || null, promoted: !!r.promoted, src: r.src })),
  trial: arr(Me.trialLedger).slice(0, 40).map((t) => ({ date: t.date, capability: t.capability, runRef: S(t.runRef, 90), outcome: S(t.outcome, 160), falsePositive: S(t.falsePositive, 120), streak: t.streak == null ? null : t.streak, src: t.src })),
  plan: Me.plan ? { h1: S(Me.plan.h1, 100), goal: S(Me.plan.goal, 220), phases: arr(Me.plan.phases).map((p) => ({ phase: p.phase, capability: S(p.capability, 150), appetite: p.appetite || null, status: S(p.status, 90), closed: !!p.closed })) } : null,
  playbook: texts(Me.playbook, 200), recallCost: Me.recallCost && Me.recallCost.absent ? { absent: true, reason: Me.recallCost.reason } : S(Me.recallCost, 200),
}

const Ev = f.evolve
out.evolve = { plan: Ev.plan ? { h1: S(Ev.plan.h1, 100), goal: S(Ev.plan.goal, 200), goalLines: texts(Ev.plan.goalLines, 180), phases: arr(Ev.plan.phases).map((p) => ({ phase: p.phase, capability: S(p.capability, 150), appetite: p.appetite || null, status: S(p.status, 90), closed: !!p.closed })) } : null, rules: (Ev.rules || []).map((r) => ({ text: S(r, 200), src: src(r) })), registry: Ev.experimentsRegistry ? { text: S(Ev.experimentsRegistry.manifestContract, 200), fields: arr(Ev.experimentsRegistry.manifestContract && Ev.experimentsRegistry.manifestContract.fields), src: src(Ev.experimentsRegistry.manifestContract) } : null }

const D = f.develop
out.develop = {
  plan: D.plan ? { h1: S(D.plan.h1, 100), goal: S(D.plan.goal, 220), phases: arr(D.plan.phases).map((p) => ({ phase: p.phase, capability: S(p.capability, 150), appetite: p.appetite || null, status: S(p.status, 100), closed: !!p.closed })) } : null,
  progress: D.progress ? { header: S(D.progress.header, 60), currentSlice: S(D.progress.currentSlice, 220) } : null,
  debt: D.debtLedger ? { rule: S(D.debtLedger.rule, 200), entries: arr(D.debtLedger).slice(0, 15).map((e) => ({ item: S(e.item || e, 170), status: e.status || null })) } : null,
  dod: D.definitionOfDone ? { source: D.definitionOfDone.source, enforcer: S(D.definitionOfDone.enforcer, 160), rules: texts(D.definitionOfDone.rules, 170) } : null,
}

const Tb = f.toolbelt
const named = (x) => arr(x).map((i) => (typeof i === 'string' ? { name: i } : { name: i.name, room: i.room || null, oneLine: S(i.oneLine, 150) }))
out.toolbelt = {
  commands: { note: S(Tb.commands && Tb.commands.note, 120), items: named(Tb.commands) },
  agents: { note: S(Tb.agents && Tb.agents.note, 120), items: named(Tb.agents) },
  hooks: { items: named(Tb.hooks), onDisk: arr(Tb.hooks && Tb.hooks.onDisk) },
  rules: { note: S(Tb.rules && Tb.rules.note, 160), items: named(Tb.rules), onDisk: arr(Tb.rules && Tb.rules.onDisk) },
  lints: { items: named(Tb.lints) },
  processes: { note: S(Tb.processes && Tb.processes.note, 120), items: named(Tb.processes), onDisk: arr(Tb.processes && Tb.processes.onDisk) },
  gates: { items: named(Tb.gates) },
  products: { note: S(Tb.products && Tb.products.note, 160), items: named(Tb.products) },
}
out.concepts = { count: f.concepts.count, note: S(f.concepts.note, 200), items: (f.concepts.items || []).map((c) => ({ term: c.term, room: c.room, station: c.station || null })) }

const R = f.reviewShip
out.reviewShip = { file: R.file, modes: S(R.modes, 120), profileMode: texts(R.profileMode, 160), tierBudget: S(R.tierBudget, 120), gates: (R.gates || []).map((g) => ({ name: g.name, check: g.check, mode: g.mode, tier: g.tier, runtime: g.runtime, evidence: g.evidence, src: g.src })), profiles: R.profiles && R.profiles.valid ? { resolver: R.profiles.resolver, order: S(R.profiles.order, 160), valid: R.profiles.valid, table: arr(R.profiles.table).map((p) => ({ profile: p.profile, gateMode: p.gateMode, requiredReviews: p.requiredReviews || [], src: p.src })) } : { absent: true, reason: 'no profile table found' }, commitKeyed: { literal: R.commitKeyed && R.commitKeyed.literal ? { absent: true, reason: R.commitKeyed.literal.reason } : null, statement: texts(R.commitKeyed && R.commitKeyed.statement, 170) } }

const V = f.ventures
out.ventures = { file: V.file, version: S(V.version, 40), rules: texts(V.rules, 170), items: (V.items || []).map((v) => ({ id: v.id, name: v.name, repo: v.repo, stage: v.stage, money: v.money && v.money.absent ? { absent: true, reason: S(v.money.reason, 160) } : v.money, mrr: v.mrr && v.mrr.absent ? { absent: true, reason: S(v.mrr.reason, 160) } : v.mrr || null, kill: arr(v.killCriteria || v.kill).map((k) => ({ criterion: k.criterion, value: k.value, direction: k.direction, measurable: k.measurable !== false, note: S(k.note, 170), src: k.src })), notes: texts(v.notes, 160), src: v.src })) }

const St = f.strategy
out.strategy = { dir: St.dir, listing: St.listing, records: St.records, plans: (St.plans || []).map((p) => ({ file: p.file, h1: S(p.h1, 120) })), adrs: St.adrs ? { dir: St.adrs.dir, count: St.adrs.count, highest: St.adrs.highestNumber, recent: arr(St.adrs.mostRecent).map((a) => ({ n: a.number, title: S(a.title, 150) })) } : null }
out.planned = arr(f.planned.rooms)
out.roomCopy = arr(f.roomCopy.rooms).map((r) => ({ id: r.id, sentence: r.sentence, lede: S(r.lede, 220) }))
out.map = { rings: f.map.rings, rooms: arr(f.map.rooms).map((r) => ({ id: r.id, name: r.name, ring: r.ring, status: r.status })), kinds: arr(f.map.kinds).map((k) => ({ kind: k.kind, group: k.group, homes: k.homes || [] })), lanesMap: f.map.lanesMap }
const I = f.inbox
out.inbox = { cli: I.cli && I.cli.file, usage: texts(I.cli && I.cli.usage, 120), maxReasonBytes: typeof I.maxReasonBytes === 'object' ? (I.maxReasonBytes.value || S(I.maxReasonBytes, 80)) : I.maxReasonBytes, keys: I.keys, rules: Object.entries(I.rules || {}).map(([k, v]) => ({ key: k, text: S(v, 180) })).concat(Array.isArray(I.rules) ? [] : []), readerOnly: S(I.cli && I.cli.readerOnly, 160), oneWriter: S(I.cli && I.cli.oneWriter, 160), envelope: I.envelope, decisionPayload: I.decisionPayload, profiles: I.profiles }
const A = f.askArc
out.askArc = { file: A.file, can: texts(A.can, 170), cannot: texts(A.cannot, 170), verifiedClasses: A.verifiedClasses, adr1307: S(A.adr1307, 200), policyRow: S(A.policyRow, 160), processFile: S(A.processFile, 120) }

// plan.phases in the raw facts are pointers ("see lanes[id=x].phaseRows") — resolve them from the lane rows
const lanePhases = (id) => (out.lanes.find((l) => l.id === id) || { phases: [] }).phases
if (out.develop.plan) out.develop.plan.phases = lanePhases('develop')
if (out.memory.plan) out.memory.plan.phases = lanePhases('memory')
if (out.evolve.plan) out.evolve.plan.phases = lanePhases('evolve')
out.scheduler.phases = lanePhases('scheduler')

const js = '// GENERATED from the arc repo (READ-ONLY) on ' + new Date().toISOString().slice(0, 10) + ' by scratchpad/trim-facts.mjs.\n// Every value is a repo fact with a src pointer; nothing here is typed by hand. Regenerate, never edit.\n// eslint-disable\nexport const FACTS = ' + JSON.stringify(out, null, 1) + '\n'
// usage: node scripts/trim-facts.mjs <path-to-arc-facts.json>  (the raw facts come from a read-only walk of the arc repo)
const dest = new URL('../src/data/arcFacts.js', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
fs.writeFileSync(dest, js)
console.log('wrote', dest, (js.length / 1024).toFixed(1) + 'KB')
for (const k of Object.keys(out)) console.log(k.padEnd(14), (JSON.stringify(out[k]).length / 1024).toFixed(1) + 'KB')
