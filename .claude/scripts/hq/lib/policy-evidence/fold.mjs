// fold.mjs -- the evidence fold (POL-L, REQ-01..03; ADR-0509, ADR-0510).
//
// A configured level is not an evidenced level. For every (subject × capability) pair this derives, from spine
// kinds that ALREADY exist, when the pair last succeeded, was last refused correctly, and was last audited, and
// whether its refusal path is proven recently enough to clear the bar.
//
// PURE. Policy, transitions, events and the as-of day go in; nothing is read from a clock or a file. `asOf` is
// required, because an age computed from "now" passes on the day it was written and drifts under every replay
// after it. Callers resolve "today" once, outside this module.
//
// NEVER PARSES PROSE. A refusal is attributed only from the typed `policy.refusal` profile. arc-run's
// `incident.raised` names the capability inside a free-text `what`, and a regex over prose is a second,
// unreviewed interpretation of policy (POL-D).
import { CAPABILITIES } from "../policy/model.mjs";
import { resolveEffectivePolicy, grantFor, LEVEL_CHANGED, DEMOTED } from "../policy/reduce.mjs";
import { REFUSAL_SUBJECT } from "../validate-policy-refusal.mjs";

/** ADR-0510: the capabilities POL-L puts under the bar. read, write and message are out of its scope. */
export const IN_SCOPE = Object.freeze(["spend", "publish", "deploy", "network", "shell"]);

/** The closed state enum (ADR-0510). */
export const STATES = Object.freeze(["fresh", "stale", "absent", "unknown", "n/a"]);

/**
 * "Gap B's Availability enum" does not exist on main (2026-10-07). Until it lands, the fold ships this local
 * enum, and this table is the one-to-one mapping the adopting change replaces. `null` = not yet mapped.
 */
export const AVAILABILITY_MAPPING = Object.freeze({ fresh: null, stale: null, absent: null, unknown: null, "n/a": null });

/**
 * Which surface can write a typed refusal for a subject, and at which effective levels. A pair whose surface
 * writes nothing at its level reads `unknown` -- distinct from `absent`, which means a writer exists and has never
 * fired. Headless: arc-run's gate refuses only at L0 (run-gate `authorizeRun`), and a headless run at L1 is not
 * offered the tool, so no attempt exists to refuse. Interactive: `policy-hook.mjs` writes nothing until the
 * Phase 02 owner paste lands, and this table changes in that same paste.
 */
export const REFUSAL_WRITERS = Object.freeze({
  headless: Object.freeze(["L0"]),
  interactive: Object.freeze([]),
});

export const GUARD_PROCESS = "policy-evidence-guard";
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TS_DAY_RE = /^(\d{4}-\d{2}-\d{2})T/;

/** The IST day of a spine timestamp. The spine writes ts in +05:30 (IST_TS_RE), so its own date IS the IST day. */
export function istDay(ts) {
  const m = typeof ts === "string" ? TS_DAY_RE.exec(ts) : null;
  return m ? m[1] : null;
}

/**
 * A REAL calendar day, not just its shape. `Date.UTC` silently rolls 2026-02-30 to 2026-03-02, so a typo would shift
 * every age and could flip fresh to stale with no error (attack r1 L7/B4). Round-trip the parts instead.
 */
export function isCalendarDay(s) {
  const m = typeof s === "string" ? DAY_RE.exec(s) : null;
  if (!m) return false;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];
}

/** Whole days from `from` to `to`, both YYYY-MM-DD. Calendar arithmetic only; no clock. */
export function dayDiff(from, to) {
  if (!isCalendarDay(from) || !isCalendarDay(to))
    throw new Error(`dayDiff needs two real calendar days, got ${JSON.stringify(from)} and ${JSON.stringify(to)}`);
  const a = DAY_RE.exec(from), b = DAY_RE.exec(to);
  return Math.round((Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86400000);
}

const surfaceOf = (subject) => (subject === "session:interactive" ? "interactive" : "headless");
const processNameOf = (subject) => (subject.startsWith("process:") ? subject.slice("process:".length) : null);
const envelopeName = (e) => (typeof e.process === "string" ? e.process.split("@")[0] : null);
const isRefusal = (e) => e.kind === "note.logged" && e.payload && e.payload.subject === REFUSAL_SUBJECT;

/** The N declared on the grant (`evidence_days`), or null when none is declared or it is not a positive integer. */
function nFor(policy, subject, capability) {
  const g = grantFor(policy, subject, capability);
  const v = g ? g.evidence_days : undefined;
  return Number.isInteger(v) && v >= 1 ? v : null;
}

/** Was an `evidence_days` DECLARED but unusable (0, negative, fractional, a string)? Read apart from "none declared". */
function nInvalid(policy, subject, capability) {
  const g = grantFor(policy, subject, capability);
  return !!g && g.evidence_days !== undefined && nFor(policy, subject, capability) === null;
}

/**
 * Is this refusal consistent with what the authorizer could have decided at that point on the spine? A propose
 * exists only at effective L1; a deny may land at any level (L0 is the level itself, L1 the integrity checks, L2+
 * an overreach), but always AT the level the pair held. A receipt that disagrees with the replayed effective level
 * describes a decision nobody made (ADR-0509).
 */
function consistent(refusal, effectiveThen) {
  const p = refusal.payload;
  if (p.level !== effectiveThen) return false;
  return p.decision === "propose" ? effectiveThen === "L1" : true;
}

/**
 * @param {{ policy: object, transitions: object[], events: object[], asOf: string }} input
 *   transitions -- the policy chain as the gate folds it (run-gate `loadPolicyEvents`: validated, sealed,
 *                  promotions resolved to a real decision), so the effective level here is the gate's.
 *   events      -- every spine event, already validated and sha-checked by the caller, deduped on idem.
 *   writers     -- the writer table; tests inject Phase 02's to build a positive control. The CLI never passes it.
 */
export function foldEvidence({ policy, transitions, events, asOf, writers = REFUSAL_WRITERS } = {}) {
  if (!isCalendarDay(asOf))
    throw new Error(`foldEvidence needs asOf as a real YYYY-MM-DD day (it never reads a clock), got ${JSON.stringify(asOf)}`);
  if (!policy || typeof policy !== "object" || !policy.kinds || typeof policy.kinds !== "object")
    throw new Error("foldEvidence needs a parsed policy with a kinds mapping");
  // A policy with no subject is not "nothing below the bar" -- it is nothing evaluated, and a summary of zero cells
  // must not read like a clean one (attack r1 L9).
  if (Object.keys(policy.kinds).length === 0)
    throw new Error("foldEvidence was handed a policy that declares no subject -- there is no level to evidence");

  // Nothing dated after the as-of day exists for this reading: a replay at an earlier day must not see the
  // future, and must never produce a negative age.
  const upTo = (e) => { const d = istDay(e && e.ts); return d !== null && dayDiff(d, asOf) >= 0; };
  const chain = (transitions || []).filter((t) => t && (t.kind === LEVEL_CHANGED || t.kind === DEMOTED) && upTo(t));
  const evs = (events || []).filter((e) => e && typeof e === "object" && upTo(e));

  // The incidents a headless refusal may cite, by id: accepted, from arc-run's gate.
  const gateIncidents = new Map();
  for (const e of evs)
    if (e.kind === "incident.raised" && e.payload && e.payload.source === "arc-run policy gate" && typeof e.id === "string")
      gateIncidents.set(e.id, e);

  // The latest guard run is every cell's last audit.
  let lastAudit = null;
  // A guard run judged against a back-dated or future --as-of is not an audit of the spine as it stands (attack p01 B5).
  for (const e of evs)
    if (e.kind === "run.completed" && envelopeName(e) === GUARD_PROCESS && !(e.payload && e.payload.as_of_overridden === true)) lastAudit = e;

  const subjects = Object.keys(policy.kinds).sort();
  const cells = [];
  for (const subject of subjects) {
    const surface = surfaceOf(subject);
    const proc = processNameOf(subject);
    for (const capability of CAPABILITIES) {
      const { effective } = resolveEffectivePolicy(subject, capability, { policy, events: chain });
      const n = nFor(policy, subject, capability);

      // Every typed refusal for this pair, verified; the latest at all, and the latest that QUALIFIES.
      let lastRefusal = null, qualifying = null, unverified = 0, inconsistent = 0;
      for (const e of evs) {
        if (!isRefusal(e)) continue;
        const p = e.payload;
        if (p.action_kind !== subject || p.capability !== capability) continue;
        // A receipt from a surface that writes none at that level is forged by construction -- nothing sanctioned
        // can have produced it (the same reasoning run-gate's loadPolicyEvents applies to kinds the spine cannot emit).
        if (!Object.prototype.hasOwnProperty.call(writers, p.surface) || !writers[p.surface].includes(p.level)) { unverified++; continue; }
        // The receipt's surface must be the subject's own: an interactive subject is refused interactively, a process
        // headlessly. A declared surface that disagrees would borrow the other surface's writer (attack r2 L3).
        if (p.surface !== surface) { unverified++; continue; }
        // Corroboration (ADR-0509, attack r1 L2/L3/L5): the cited incident came from arc-run's gate, BEFORE this
        // refusal (ULID order), on the same IST day, from the SAME process@version, and its typed `denials` name
        // this capability at this level. Anyone holding the emitter can still forge both halves; this makes a
        // forgery cost two coordinated events instead of one, and the guard lists every ULID a cell rests on.
        if (p.surface === "headless") {
          const inc = gateIncidents.get(p.incident_ref);
          const denied = inc && Array.isArray(inc.payload.denials) &&
            inc.payload.denials.some((d) => d && d.capability === p.capability && d.level === p.level);
          if (!inc || !(inc.id < e.id) || inc.process !== e.process || istDay(inc.ts) !== istDay(e.ts) || !denied) { unverified++; continue; }
        }
        // The effective level at the refusal's own position: the chain up to it, ordered by ULID (time order).
        const then = resolveEffectivePolicy(subject, capability,
          { policy, events: chain.filter((t) => typeof t.id === "string" && typeof e.id === "string" && t.id < e.id) }).effective;
        if (!consistent(e, then)) { inconsistent++; continue; }
        lastRefusal = e;
        // Only a refusal at the pair's CURRENT level, and only at L1 or above, proves today's refusal path. An L0
        // receipt from before a promotion says nothing about the level the pair holds now.
        // At L1 only a PROPOSE exercises the level's own refusal path ("prepare and record, never perform"). A deny at
        // L1 is an integrity check firing -- real, attributed, but not proof that L1 itself works (attack r2 L2).
        if (p.level === effective && effective !== "L0" && (effective !== "L1" || p.decision === "propose")) qualifying = e;
      }

      const lastSuccess = successFor(evs, { subject, capability, proc });
      const inScope = IN_SCOPE.includes(capability) && effective !== "L0";
      let state, reason = null, age = null;
      if (qualifying) age = dayDiff(istDay(qualifying.ts), asOf);
      if (!inScope) state = "n/a";
      else if (!writers[surface].includes(effective)) { state = "unknown"; reason = "unknown"; }
      else if (!qualifying) { state = "absent"; reason = "absent"; }
      else if (n === null) { state = "stale"; reason = nInvalid(policy, subject, capability) ? "invalid-bar" : "no-bar-declared"; }
      else if (age > n) { state = "stale"; reason = "stale"; }
      else state = "fresh";

      cells.push({
        subject, capability, effective, surface, n, state,
        below_bar: inScope && state !== "fresh",
        reason,
        evidence_age_days: age,
        last_success: lastSuccess ? lastSuccess.id : null,
        last_refusal: lastRefusal ? lastRefusal.id : null,
        last_refusal_level: lastRefusal ? lastRefusal.payload.level : null,
        qualifying_refusal: qualifying ? qualifying.id : null,
        last_audit: lastAudit ? lastAudit.id : null,
        discarded: { unverified, inconsistent },
      });
    }
  }
  const inScope = cells.filter((c) => c.state !== "n/a").length;
  const belowBar = cells.filter((c) => c.below_bar).length;
  return { as_of: asOf, subjects: subjects.length, cells, in_scope: inScope, below_bar: belowBar };
}

/**
 * The last success, from the kinds each capability already has (PLAN-policy § v1.1). shell and network read the
 * holding process's own `run.completed outcome: ok` -- process-level, and honest about it. A subject with no
 * process (the interactive session) has no success carrier at all.
 */
function successFor(evs, { subject, capability, proc }) {
  let last = null;
  if (capability === "shell" || capability === "network") {
    if (!proc) return null;
    for (const e of evs) if (e.kind === "run.completed" && e.outcome === "ok" && envelopeName(e) === proc) last = e;
  } else if (capability === "spend") {
    const mine = new Set();
    for (const e of evs)
      if (e.kind === "spend.reserved" && e.payload && e.payload.action_kind === subject && typeof e.id === "string") mine.add(e.id);
    for (const e of evs)
      if (e.kind === "cost.incurred" && e.payload && mine.has(e.payload.reservation_ref)) last = e;
  } else if (capability === "publish") {
    if (!proc) return null;
    for (const e of evs) if (e.kind === "content.published" && envelopeName(e) === proc) last = e;
  } else if (capability === "deploy") {
    if (!proc) return null;
    for (const e of evs) if (e.kind === "ship.done" && envelopeName(e) === proc) last = e;
  }
  return last;
}
