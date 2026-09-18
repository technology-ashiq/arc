// ─────────────────────────────────────────────────────────────
// The offline brain — keyword matching over the knowledge base,
// now state-aware. This is the FALLBACK when no API key is set
// (Settings → Engine room). It is honest about being offline.
// ─────────────────────────────────────────────────────────────
import { ARC } from '../data/arcKnowledge.js'
import { kpis, briefLines, ladder, clockLabel } from '../spine/derive.js'
import { spine } from '../spine/store.js'

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s/-]/g, ' ').replace(/\s+/g, ' ').trim()

const FALLBACKS = [
  `Hmm, that one is not in my receipts yet. Ask me about my eight modules, the twenty-three commands, the twenty-four agents, the council, the spine, or what is in the inbox right now.`,
  `I keep receipts, not guesses — and I don't have one for that. Try asking what is waiting for you, how the council votes, or what happens when a phase closes.`,
  `That's outside my offline ledger. Add an API key in the Engine room and I get a full brain — or ask me about the spine, the ladder, LexOS, or any command.`,
]
let fallbackIdx = 0

function findCommand(q) {
  const sorted = [...ARC.commands].sort((a, b) => b.name.length - a.name.length)
  for (const c of sorted) {
    const bare = c.name.replace('/', '')
    const spaced = bare.replace(/-/g, ' ')
    const hitBare = new RegExp(`(^|[^a-z-])${bare}($|[^a-z-])`).test(q)
    const hitSpaced = spaced !== bare && new RegExp(`(^|[^a-z-])${spaced}($|[^a-z-])`).test(q)
    if (hitBare || hitSpaced) {
      if (bare === 'arc' && !/\/arc|command|dashboard|status/.test(q)) continue
      return c
    }
  }
  return null
}
function findAgent(q) {
  for (const a of ARC.agents) {
    const spaced = a.name.replace(/-/g, ' ')
    if (q.includes(a.name) || q.includes(spaced)) return a
  }
  return null
}
function findProduct(q) {
  for (const p of ARC.products) {
    if (q.includes(` ${p.id}`) || q.startsWith(p.id) || q.includes(`${p.id} product`) || q.includes(`product ${p.id}`)) return p
  }
  return null
}

export function localThink(raw) {
  const q = ' ' + norm(raw) + ' '

  // live-state answers first — the HQ is running, answer from it
  if (/inbox|approval|waiting|pending|decision/.test(q) && /what|enna|how many|evlo|list|iruku|show/.test(q)) {
    const pend = spine.pendingApprovals
    if (!pend.length) return `The inbox is clear — zero decisions waiting. Every earlier decision is on the spine as decision.recorded.`
    return `${pend.length} decision${pend.length === 1 ? '' : 's'} waiting: ${pend.map((p) => p.title).join('; ')}. Say approve or reject with the one you mean, or clear them in the Overview room.`
  }
  if (/(today|now|status|nadanthuchu|situation|summary|brief)/.test(q) && /(what|enna|company|happen|give|read)/.test(q)) {
    const b = briefLines()
    return `${b.greeting} ${b.lines.map((l) => l.tag + ': ' + l.text).join('. ')}.`
  }
  if (/revenue|money|kaasu|panam|earned|mrr/.test(q) && /today|now|much|evlo|current/.test(q)) {
    const k = kpis()
    return `Honest split: real revenue is zero rupees — billing has not opened. The simulated feed shows ₹${(k.simRev + k.realRev).toLocaleString('en-IN')} today against ₹${k.cost.toLocaleString('en-IN')} of cost, clearly labeled simulated. First real rupee: target September.`
  }
  if (/time|clock|mani/.test(q) && /what|enna|sim/.test(q)) {
    return `Sim clock reads ${clockLabel()}, day ${spine.dayIndex - 13} of the simulated run. Speed control is in the top bar.`
  }
  if (/ladder|autonomy/.test(q) && /state|current|now|levels|iruku/.test(q)) {
    return `Current ladder: ${ladder().map((l) => l.cap + ' at ' + l.level).join(', ')}. Promotions need trial-ledger evidence; incidents demote automatically.`
  }

  const cmd = findCommand(q)
  if (cmd && /command|panra|pannum|enna|what|does|do|explain|how|use|sollu|about|\//.test(q)) {
    return `${cmd.name} — ${cmd.short}. ${cmd.detail}`
  }
  const agent = findAgent(q)
  if (agent) return `${agent.name} is one of my ${ARC.agents.length} agents, from the ${agent.group} side. ${agent.role}`

  if (/how many|count|evlo|ethana/.test(q)) {
    if (/product|module/.test(q)) return `Eight modules: ${ARC.products.map((p) => p.id).join(', ')}. Core is the only must-have; HQ went live in cycle two, design is being built now.`
    if (/command/.test(q)) return `Twenty-three slash commands. Daily drivers: /arc-kickoff, /arc-review, /arc-qa, /arc-ship, /arc-retro — newest is /arc-design-critique.`
    if (/agent/.test(q)) return `Twenty-four agents — twelve council seats, and the newest hire is the design-critic, a vision critic with no edit tools.`
  }

  const prod = findProduct(q)
  if (prod && /product|pathi|about|what|enna|explain|tell/.test(q)) return `The ${prod.id} module — ${prod.purpose}`

  let best = null
  let bestScore = 0
  for (const item of ARC.qa) {
    let score = 0
    for (const k of item.keywords) {
      if (q.includes(' ' + k + ' ') || q.includes(k)) score += k.length + 2
    }
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }
  if (best && bestScore >= 5) return best.answer

  const f = FALLBACKS[fallbackIdx % FALLBACKS.length]
  fallbackIdx++
  return f
}
