/**
 * attribution.mjs -- place a spine receipt on a role (org Phase 01, ADR-1604 / ORG-D).
 *
 * Two layers, in this order, and the `actor` field is never rewritten:
 *   1. `payload.role`, when a newly staffed role's emitter set it AND it names a real card;
 *   2. the attribution MAP, `org/attribution.yaml`: ordered rules over what a receipt already
 *      carries today -- actor, process, kind. First match wins, so a specific rule goes above a
 *      general one.
 * A receipt neither layer places is UNATTRIBUTED and counted, never guessed.
 *
 * `decision.recorded` is CLOSED to decides|verdict|reason (validate.mjs), so it can carry no role:
 * it is placed through `decides` on the role that raised the approval it decides.
 *
 * A rule "names its source" when it matches on a process, or on an actor that is not a wildcard.
 * Only those count toward the day-3 checkpoint: a kind-only or `scheduler:*` rule would put
 * thousands of receipts on one seat whatever the premise, and a gate that scores what its author
 * wrote cannot detect the premise failing (kickoff attack, focus A #3).
 */

const RULE_KEYS = new Set(["id", "match", "role", "why"]);
const MATCH_KEYS = new Set(["actor", "process", "kind"]);
const RULE_ID = /^[a-z][a-z0-9-]{1,63}$/;

const stemOf = (p) => (typeof p === "string" ? p.split("@")[0] : "");

function matchActor(pattern, actor) {
  if (typeof actor !== "string") return false;
  return pattern.endsWith("*") ? actor.startsWith(pattern.slice(0, -1)) : actor === pattern;
}

/** A rule's process may appear as the emitter (`event.process`) or, for run receipts, the payload. */
function processOf(e) {
  const s = stemOf(e.process);
  return e.kind === "run.completed" && typeof e.payload?.process === "string" ? e.payload.process : s;
}

// A scheduler actor is a heartbeat whatever its exact name: `scheduler:day-close-roll` fires
// on the clock, so a receipt it emits says the clock ran, not that a role did work.
export function namesSource(rule) {
  const m = rule.match || {};
  if (typeof m.actor === "string" && m.actor.startsWith("scheduler:")) return false;
  return typeof m.process === "string" || (typeof m.actor === "string" && !m.actor.endsWith("*"));
}

/**
 * Validate a parsed map against the role ids that exist. Returns findings (strings).
 * @param doc parsed org/attribution.yaml  @param roleIds Set of card ids  @param kinds Set of spine KINDS
 */
export function validateMap(doc, roleIds, kinds) {
  const f = [];
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.rules)) return ["attribution map: expected a top-level rules: list"];
  if (doc.version !== 1) f.push("attribution map: version must be 1");
  const seen = new Set();
  for (const [i, r] of doc.rules.entries()) {
    const at = `attribution rule ${i + 1}${r?.id ? ` (${r.id})` : ""}`;
    if (!r || typeof r !== "object") { f.push(`${at}: not a mapping`); continue; }
    for (const k of Object.keys(r)) if (!RULE_KEYS.has(k)) f.push(`${at}: unknown key "${k}"`);
    if (!RULE_ID.test(r.id || "")) f.push(`${at}: id must be a kebab id`);
    else if (seen.has(r.id)) f.push(`${at}: duplicate rule id`);
    else seen.add(r.id);
    if (!roleIds.has(r.role)) f.push(`${at}: role "${r.role}" is not a card id`);
    const m = r.match;
    if (!m || typeof m !== "object" || !Object.keys(m).length) { f.push(`${at}: match must name at least one of actor, process, kind`); continue; }
    for (const k of Object.keys(m)) if (!MATCH_KEYS.has(k)) f.push(`${at}: unknown match key "${k}"`);
    for (const k of Object.keys(m)) if (typeof m[k] !== "string" || !m[k]) f.push(`${at}: match.${k} must be a non-empty string`);
    if (typeof m.kind === "string" && !kinds.has(m.kind)) f.push(`${at}: match.kind "${m.kind}" is not a spine kind`);
    if (typeof m.actor === "string" && m.actor.includes("*") && !(m.actor.endsWith("*") && m.actor.indexOf("*") === m.actor.length - 1))
      f.push(`${at}: match.actor may hold one trailing * only`);
  }
  return f;
}

/**
 * Place every event. Returns { placements: Map(eventId -> {role, via, rule, sourced}), unattributed, conflicts }.
 * `via` is "payload" | "map" | "decides"; `sourced` says whether the placing rule names its source.
 */
export function placeAll(events, rules, roleIds) {
  const placements = new Map();
  const conflicts = [];
  let unattributed = 0;
  const byId = new Map(events.map((e) => [e.id, e]));
  const mapPlace = (e) => {
    for (const r of rules) {
      const m = r.match;
      if (m.kind !== undefined && m.kind !== e.kind) continue;
      if (m.actor !== undefined && !matchActor(m.actor, e.actor)) continue;
      if (m.process !== undefined && m.process !== processOf(e)) continue;
      return r;
    }
    return null;
  };
  // Pass 1: everything except decisions.
  for (const e of events) {
    if (e.kind === "decision.recorded") continue;
    const r = mapPlace(e);
    const pr = e.payload && typeof e.payload.role === "string" ? e.payload.role : null;
    if (pr !== null && roleIds.has(pr)) {
      if (r && r.role !== pr) conflicts.push(`${e.id}: payload.role "${pr}" but map rule ${r.id} says "${r.role}"`);
      placements.set(e.id, { role: pr, via: "payload", rule: null, sourced: true });
    } else if (r) placements.set(e.id, { role: r.role, via: "map", rule: r.id, sourced: namesSource(r) });
    else unattributed++;
  }
  // Pass 2: a decision belongs to whoever raised the approval it decides.
  for (const e of events) {
    if (e.kind !== "decision.recorded") continue;
    const req = byId.get(e.payload?.decides);
    const p = req ? placements.get(req.id) : null;
    if (p) placements.set(e.id, { ...p, via: "decides" });
    else unattributed++;
  }
  return { placements, unattributed, conflicts };
}

/**
 * The scorecard for one role, derived only from placed receipts. A role with no placed receipt
 * is `no evidence` -- never 0% or 100% (REQ-05).
 */
export function scorecard(role, events, placements, { since } = {}) {
  const mine = events.filter((e) => placements.get(e.id)?.role === role && (!since || String(e.ts) >= since));
  if (!mine.length) return { role, evidence: false };
  const runs = mine.filter((e) => e.kind === "run.completed");
  const decisions = mine.filter((e) => e.kind === "decision.recorded");
  const costs = mine.filter((e) => e.kind === "cost.incurred");
  const sourced = mine.filter((e) => placements.get(e.id).sourced);
  return {
    role, evidence: true, receipts: mine.length, sourced: sourced.length,
    runs: runs.length,
    runs_ok: runs.filter((e) => e.outcome === "ok").length,
    runs_fail: runs.filter((e) => e.outcome === "fail").length,
    accepts: decisions.filter((e) => e.payload?.verdict === "approve").length,
    rejects: decisions.filter((e) => e.payload?.verdict === "reject").length,
    incidents: mine.filter((e) => e.kind === "incident.raised").length,
    // Cost is summed only from cost.incurred receipts; with none, it is absent, not zero.
    cost_minor: costs.length ? costs.reduce((s, e) => s + (Number.isInteger(e.payload?.amount) ? e.payload.amount : 0), 0) : null,
    cost_receipts: costs.length,
    handoffs: mine.filter((e) => e.kind === "handoff.ready").length,
    first: mine[0].ts, last: mine[mine.length - 1].ts,
  };
}

/** Day-3 checkpoint (ADR-1604): seated roles with >= 1 run.completed or >= 1 decision verdict, placed by a sourced rule. */
export function measuredRoles(events, placements, seatedIds) {
  const hits = new Map();
  for (const e of events) {
    const p = placements.get(e.id);
    if (!p || !p.sourced || !seatedIds.has(p.role)) continue;
    const counts = e.kind === "run.completed" || (e.kind === "decision.recorded" && (e.payload?.verdict === "approve" || e.payload?.verdict === "reject"));
    if (!counts) continue;
    if (!hits.has(p.role)) hits.set(p.role, []);
    hits.get(p.role).push(e.id);
  }
  return hits;
}
