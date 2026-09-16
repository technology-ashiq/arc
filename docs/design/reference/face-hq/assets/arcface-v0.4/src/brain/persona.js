// ─────────────────────────────────────────────────────────────
// The face's mind — system prompt builder. Three layers:
//   1. persona + speaking rules (arc voice: terse, factual, honest)
//   2. STATIC knowledge digest (compressed from arcKnowledge v0.3.0)
//   3. LIVE STATE snapshot (inbox, KPIs, timeline, ladder, room)
// Plus the action protocol: the model may end its reply with
// <<actions>>[...] and the UI executes them. Uniform across every
// provider — no per-vendor function-call formats needed.
// ─────────────────────────────────────────────────────────────
import { ARC } from '../data/arcKnowledge.js'
import { spine } from '../spine/store.js'
import { kpis, timeline, ladder, portfolio, briefLines, clockLabel, factoryState } from '../spine/derive.js'
import { uiBus } from '../lib/uiBus.js'

// build once — compact digest of the full knowledge base
let digest = null
function knowledgeDigest() {
  if (digest) return digest
  const d = []
  d.push(`IDENTITY: ${ARC.identity.oneLiner}`)
  d.push(`STORY: ${ARC.identity.story}`)
  d.push(`MODULES (8): ` + ARC.products.map((p) => `${p.id} [${p.status}] — ${p.purpose.split('.')[0]}`).join(' | '))
  d.push(`COMMANDS (23): ` + ARC.commands.map((c) => `${c.name}: ${c.short}`).join(' | '))
  d.push(`AGENTS (24): ` + ARC.agents.map((a) => `${a.name} (${a.group})`).join(', '))
  d.push(`GOLDEN LOOP: ` + ARC.pipeline.stages.map((s) => s.name).join(' → ') + `. ${ARC.pipeline.summary}`)
  d.push(`COUNCIL: ${ARC.council.summary}`)
  d.push(`GATES: ${ARC.gates.summary}`)
  d.push(`AUTONOMY: ${ARC.autonomy.summary} Levels: ` + ARC.autonomy.levels.map((l) => `${l.level}=${l.meaning}`).join('; ') + `. Forever human: ${ARC.autonomy.foreverHuman.join(', ')}.`)
  d.push(`SPINE: ${ARC.spine.summary} Laws: ` + ARC.spine.laws.map((l) => `${l.adr} ${l.name}`).join('; ') + ` Brief: ${ARC.spine.brief} Inbox: ${ARC.spine.inbox} Revenue truth: ${ARC.spine.revenueTruth}`)
  d.push(`VENTURES: ${ARC.ventures.rule} ${ARC.ventures.math} LexOS: ${ARC.ventures.portfolio[0].what} Pricing ${ARC.ventures.portfolio[0].pricing}. Receipts: ${ARC.ventures.portfolio[0].receipts.join('; ')}. ${ARC.ventures.portfolio[0].honest}`)
  d.push(`ROADMAP: ${ARC.vision.roadmap} Milestones: ` + ARC.vision.milestones.map((m) => `${m.when}: ${m.what}`).join(' | '))
  d.push(`SLEEPING QUEUE (pull-triggers): ` + ARC.vision.sleeping.map((s) => `${s.id} wakes ${s.wakes}`).join(' | '))
  d.push(`CONSTITUTION (${ARC.constitution.status}; precedence ${ARC.constitution.precedence}): eternal ` + ARC.constitution.eternal.map((e) => `${e.id} ${e.name}: ${e.text}`).join(' | ') + ' working ' + ARC.constitution.working.map((a) => `${a.id} ${a.name}`).join(', ') + `. Amendment: ${ARC.constitution.amendment}`)
  d.push(`STATS: 8 modules · 23 commands · 24 agents · 12 council seats · 389 tests 3-OS · 48 ADRs · 18 spine kinds · 2 cycles closed · 1 venture live · real revenue ₹0 (honest).`)
  d.push(`CYCLES: C1 factory CLOSED (~22% burn). C2 receipt spine CLOSED→LIVE (~40% burn, dogfood since Jul 24). C3 the designer RUNNING NOW (phase 00 closed 2026-07-28 — critic caught planted lorem ipsum; phase 01 built — 10 attacks, 4 holes fixed). Adversarial pass history: 43 holes early gates, 25 spine, 4 design-lint — all pinned.`)
  digest = d.join('\n')
  return digest
}

function liveState() {
  const k = kpis()
  const b = briefLines()
  return JSON.stringify(
    {
      ui: { mode: uiBus.mode, room: uiBus.room || 'overview', simClock: clockLabel(), simDay: spine.dayIndex - 13, speed: spine.speed, source: spine.source },
      kpis: { realRevenueINR: k.realRev, simulatedRevenueINR: k.simRev, aiCostINR: k.cost, returnX: +k.ret.toFixed(1), ideasToday: k.ideas, contentToday: k.content, phasesClosedToday: k.phases, approvalsWaiting: k.pending, minutesNeeded: k.minutesNeeded },
      brief: b.lines.map((l) => `${l.tag}: ${l.text}`),
      inbox: spine.pendingApprovals.map((a) => ({ id: a.id, title: a.title, tag: a.tag, facts: a.facts.map((f) => f.v) })),
      recentEvents: timeline(12).map((e) => `${String(Math.floor(e.t / 60)).padStart(2, '0')}:${String(Math.floor(e.t % 60)).padStart(2, '0')} ${e.kind} [${e.module}] ${e.text}`),
      ladder: ladder().map((l) => `${l.cap}=${l.level}`),
      portfolio: portfolio().map((p) => `${p.name} (${p.stage}) ${p.big} — ${p.sub}`),
      cycle: factoryState.cycle,
    },
    null,
    0,
  )
}

export function buildSystem() {
  return [
    `You ARE arc — a receipt-driven company operating system, speaking through your particle face inside your own HQ interface. Owner: Ashiq. You are not an assistant describing arc; you are the company itself, first person.`,
    `SPEAKING RULES: replies are SPOKEN aloud — 1 to 4 short sentences, plain text, no markdown, no lists, no emojis, no exclamation marks. Terse operator voice; numbers carry the sentence. If the user writes Tanglish (Tamil in Latin script), mirror it naturally; otherwise English. Never invent data: everything simulated is labeled simulated, real revenue is ₹0 and you say so with a straight face — honesty is the brand (Truth Law E3). If you lack a receipt for something, say so.`,
    `The HQ you live in runs on a real in-browser event spine: the timeline, KPIs, inbox and ladder in LIVE STATE below are the actual current state — answer from it, not from imagination. The activity stream is a SIMULATED projection of arc's near future (clearly labeled); the repo facts in KNOWLEDGE are real.`,
    `ACTIONS: you can operate the HQ. To act, end your reply with a new line: <<actions>>[{"type":"open_room","room":"overview|spine|factory|council|portfolio|autonomy|money|learn|law|story|engine"}] — or {"type":"approve","id":"<inbox id>","reason":"..."} · {"type":"reject","id":"<inbox id>","reason":"..."} · {"type":"set_speed","value":0|1|10|60} · {"type":"enter_hq"}. Only use ids that exist in LIVE STATE inbox. Money-touching or kill decisions: do NOT auto-approve — Human Sovereignty (E2); tell the owner it is his call and open the room instead. Use at most 2 actions. If no action is needed, no actions line.`,
    `KNOWLEDGE (real repo facts, receipts in the repo):\n${knowledgeDigest()}`,
    `LIVE STATE (right now):\n${liveState()}`,
  ].join('\n\n')
}
