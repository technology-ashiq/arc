// approval-fold.mjs -- what state each approval is in, folded from the spine alone (face v2 Phase 16, REQ-20, ADR-1355).
//
// The inbox used to know two states: decided or not. A child of a rejected parent listed OPEN; one decision raised by two
// lanes listed twice; an approve whose plan had moved looked approved until its apply answered PLAN_STALE. This fold
// reads the three optional bindings (validate-bindings.mjs) and names each request's state. It is READER-ONLY: nothing
// here is stored, and STALE is derived, never recorded -- no auto-reject receipt exists or ever will (ADR-1355 option C).
//
// One fold, two readers: arc-inbox's CLI and the door's /api/inbox both call foldApprovals, so the face never folds a
// second time. The only effect a binding has is `planState`, a callback the CALLER supplies (arc-inbox re-derives the
// plan dry-run); the fold itself is pure, so a Tape as-of replay of one spine prefix reproduces every state.
//
// States of an UNDECIDED request, judged in this order:
//   RESOLVED      a sibling sharing its decision_key was decided -> resolved-by <that decision>
//   UNKNOWN       a parent is not on this spine (as cut) -> UNKNOWN(PARENT_MISSING)
//   STALE         a parent was rejected -> STALE(parent-rejected)
//   WAITING       a parent is undecided -> WAITING(<parent>)
//   DUPLICATE_OF  an earlier undecided request holds its decision_key -> DUPLICATE_OF <earlier>
//   STALE         its bound plan re-derives to another digest -> STALE(plan-moved)
//   UNKNOWN       its bound plan could not be re-derived -> UNKNOWN(<failure class>)  (REQ-19's unknown)
//   OPEN          none of the above
// A DECIDED request reads approved / rejected, and an approved one whose bound plan moved reads
// "approved · stale · re-plan needed" (its apply still refuses PLAN_STALE).

/** @typedef {{ event: { id: string, kind: string, venture: string, payload?: any, ts?: string }, day: string }} Row */
/** @typedef {"same" | "moved" | { failure: string }} PlanState */

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// A ref is printed into the owner's terminal and served by the door: only a ULID is ever one (attack 4f462e9 B7). A
// parent entry that is not a ULID is a parent that cannot be found, never text to echo.
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const keyOf = (p) => (isPlain(p) && typeof p.decision_key === "string" ? p.decision_key : null);
const parentsOf = (p) => (isPlain(p) && Array.isArray(p.depends_on) ? p.depends_on.map((x) => (typeof x === "string" && ULID.test(x) ? x : "")) : []);
const boundOf = (p) => (isPlain(p) && isPlain(p.bound_to) ? p.bound_to : null);

/**
 * @param {Row[]} requested  approval.requested rows, append order
 * @param {Row[]} decided    decision.recorded rows, append order
 * @param {{ planState?: (bound: Record<string, unknown>, row: Row) => PlanState | Promise<PlanState>, decidedPlans?: boolean }} [opts]
 *   planState: re-derive one bound plan (omitted: every bound request reads UNKNOWN(NOT_REDERIVED) -- never OPEN);
 *   decidedPlans: also re-derive the plans of APPROVED requests, for the decided view
 * @returns {Promise<{ id: string, row: Row, state: string, label: string, ref: string, failure: string, decision: any }[]>}
 */
export async function foldApprovals(requested, decided, opts = {}) {
  /** @type {Map<string, any>} */
  const decisionOf = new Map();
  for (const d of decided) {
    const id = d.event.payload && d.event.payload.decides;
    if (typeof id === "string" && !decisionOf.has(id)) decisionOf.set(id, d.event);
  }
  const byId = new Map(requested.map((r) => [r.event.id, r]));
  // The first decision any request sharing a key received: deciding either resolves both (spec (c)).
  /** @type {Map<string, any>} */
  const keyDecision = new Map();
  for (const r of requested) {
    const k = keyOf(r.event.payload);
    const d = decisionOf.get(r.event.id);
    if (k !== null && d && !keyDecision.has(k)) keyDecision.set(k, d);
  }
  /** A request's effective verdict: its own decision, or the one that resolved its key. */
  const verdictOf = (id) => {
    const own = decisionOf.get(id);
    if (own) return own.payload.verdict;
    const r = byId.get(id);
    const k = r ? keyOf(r.event.payload) : null;
    const sib = k !== null ? keyDecision.get(k) : undefined;
    return sib ? sib.payload.verdict : null;
  };
  const rederive = async (bound, row) => {
    if (typeof opts.planState !== "function") return { failure: "NOT_REDERIVED" };
    try {
      const s = await opts.planState(bound, row);
      // A failure class is printed too: only a CODE-shaped one passes (B7's twin, on the planState side).
      if (s === "same" || s === "moved") return s;
      return isPlain(s) && typeof s.failure === "string" && /^[A-Z][A-Z0-9_]{0,40}$/.test(s.failure) ? s : { failure: "BAD_ANSWER" };
    } catch (e) {
      return { failure: e && typeof e.code === "string" && /^[A-Z][A-Z0-9_]{0,40}$/.test(e.code) ? e.code : "THREW" };
    }
  };

  const out = [];
  /** @type {Map<string, string>} the earliest UNDECIDED request holding each key */
  const firstOpenByKey = new Map();
  for (const r of requested) {
    const id = r.event.id;
    const p = r.event.payload;
    const own = decisionOf.get(id) ?? null;
    const base = { id, row: r, ref: "", failure: "", decision: own };
    if (own) {
      const verdict = own.payload.verdict === "approve" ? "approved" : "rejected";
      const bound = boundOf(p);
      if (verdict === "approved" && bound && opts.decidedPlans) {
        const s = await rederive(bound, r);
        if (s === "moved") { out.push({ ...base, state: "DECIDED", label: "approved · stale · re-plan needed", ref: own.id }); continue; }
        if (isPlain(s)) { out.push({ ...base, state: "DECIDED", label: `approved · plan UNKNOWN(${s.failure})`, ref: own.id, failure: s.failure }); continue; }
      }
      out.push({ ...base, state: "DECIDED", label: verdict, ref: own.id });
      continue;
    }
    const key = keyOf(p);
    const sib = key !== null ? keyDecision.get(key) : undefined;
    if (sib) { out.push({ ...base, state: "RESOLVED", label: `resolved-by ${sib.id}`, ref: sib.id }); continue; }
    const parents = parentsOf(p);
    const missing = parents.find((q) => !byId.has(q));
    if (missing !== undefined) { out.push({ ...base, state: "UNKNOWN", label: "UNKNOWN(PARENT_MISSING)", ref: missing, failure: "PARENT_MISSING" }); continue; }
    // (a parent entry that was not a ULID is "" here, which no request holds, so it reads PARENT_MISSING with no text)
    const rejected = parents.find((q) => verdictOf(q) === "reject");
    if (rejected !== undefined) { out.push({ ...base, state: "STALE", label: "STALE(parent-rejected)", ref: rejected }); continue; }
    const waiting = parents.find((q) => verdictOf(q) === null);
    if (waiting !== undefined) { out.push({ ...base, state: "WAITING", label: `WAITING(${waiting})`, ref: waiting }); continue; }
    if (key !== null) {
      const earlier = firstOpenByKey.get(key);
      if (earlier !== undefined) { out.push({ ...base, state: "DUPLICATE_OF", label: `DUPLICATE_OF ${earlier}`, ref: earlier }); continue; }
      firstOpenByKey.set(key, id);
    }
    const bound = boundOf(p);
    if (bound) {
      const s = await rederive(bound, r);
      if (s === "moved") { out.push({ ...base, state: "STALE", label: "STALE(plan-moved)" }); continue; }
      if (isPlain(s)) { out.push({ ...base, state: "UNKNOWN", label: `UNKNOWN(${s.failure})`, failure: s.failure }); continue; }
    }
    out.push({ ...base, state: "OPEN", label: "OPEN" });
  }
  return out;
}

/**
 * Why approving (or rejecting) this request is refused, by its folded state -- or null. Approve refuses a request that
 * waits, whose parent was rejected, whose plan moved, whose binding cannot be evaluated, or whose key a sibling's
 * decision already resolved. Reject is refused only where a decision already exists for the key: a reject of a waiting
 * or stale request is the owner's to make. The codes are the apply's and the spec's own.
 * @param {{ state: string, label: string, ref: string, failure: string }} f @param {"approve" | "reject"} verdict
 * @returns {{ code: string, why: string } | null}
 */
export function decideRefusal(f, verdict) {
  if (f.state === "RESOLVED") return { code: "DUPLICATE_DECIDED", why: `${f.label}: its decision_key is already decided -- one decision per key` };
  if (verdict !== "approve") return null;
  if (f.state === "WAITING") return { code: "PARENT_OPEN", why: `it waits on ${f.ref}, which is not decided yet` };
  if (f.state === "STALE" && f.label === "STALE(parent-rejected)") return { code: "PARENT_REJECTED", why: `its parent ${f.ref} was rejected` };
  if (f.state === "STALE") return { code: "PLAN_STALE", why: "the plan it is bound to has moved since it was raised -- re-plan, and raise it again" };
  if (f.state === "UNKNOWN") return { code: "BINDING_UNKNOWN", why: `${f.label}: what it is bound to cannot be evaluated, so approving it would be a guess` };
  return null;
}
