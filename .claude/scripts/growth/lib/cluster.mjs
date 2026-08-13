// growth/cluster -- build the ONE cluster proposal, and refuse generation until a human approved
// THAT EXACT PLAN.
//
// Phase-02 criteria 4 and 6. Criterion 6 is gate 1 of the two recurring human gates (ADR-1012) and
// the spec requires it in CODE, not in a runbook, so `assertClusterApproved` is the only door.
//
// Growth adds NO event kind for this. The approval rides on `approval.requested` and the human
// answers with `arc-inbox approve`, which writes `decision.recorded` -- the mechanism that already
// exists and that the owner already used to approve this lane's PLAN. Inventing a growth-specific
// approval receipt would have meant a second source of truth for "did a human say yes", and A5
// says there is one.

import { sha256Hex } from "../../hq/lib/canonical.mjs";

const CLUSTER_ID_RE = /^c-[0-9]{3,9}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const MIN_SPOKES = 5;
// Upper bound as well as a floor: "one inbox item a human approves" has a readable size, and an
// unbounded cluster is how a gate becomes a rubber stamp nobody actually reads.
const MAX_SPOKES = 8;
const MIN_BOFU = 2;
const MAX_BOFU = 3;

export class ClusterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ClusterError";
    this.code = code;
  }
}

/**
 * Stable stringify: object keys sorted, arrays in order. The plan hash has to be reproducible on
 * another machine from the same plan, and JSON.stringify key order follows insertion order, which
 * is a property of how the object was BUILT rather than of what it contains.
 */
function stable(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
}

/** The hash a human approves. Binding the approval to these bytes is what stops a swap. */
export const planSha = (plan) => sha256Hex(stable(plan));

/**
 * Compose ONE inbox item from evidenced candidates: 1 pillar, >=5 spokes, 2-3 BOFU.
 *
 * Every candidate reaching here has already passed `assertCandidate` (shape + evidence URL) and
 * `partitionByEvidence` (the link actually resolves). This function re-checks the evidence field
 * anyway. That is not belt-and-braces for its own sake: this is the last point before a human is
 * asked to approve, and criterion 5 says an evidence-less row cannot ENTER the proposal --
 * enforced structurally, at every door, rather than trusted from the caller.
 */
export function buildClusterPlan({ candidates, clusterId }) {
  if (typeof clusterId !== "string" || !CLUSTER_ID_RE.test(clusterId))
    throw new ClusterError("BAD_CLUSTER_ID", `cluster_id ${JSON.stringify(clusterId)} must match c-NNN`);
  if (!Array.isArray(candidates))
    throw new ClusterError("BAD_INPUT", "candidates must be an array");
  for (const c of candidates) {
    if (c === null || typeof c !== "object" || typeof c.evidence_url !== "string" || c.evidence_url === "")
      throw new ClusterError("NO_EVIDENCE", "a candidate without an evidence_url reached the plan builder");
  }

  const transactional = candidates.filter((c) => c.intent === "transactional");
  const rest = candidates.filter((c) => c.intent !== "transactional");

  if (rest.length < 1 + MIN_SPOKES)
    throw new ClusterError("THIN_CLUSTER",
      `need 1 pillar + ${MIN_SPOKES} spokes from non-transactional candidates, have ${rest.length}`);
  if (transactional.length < MIN_BOFU)
    throw new ClusterError("THIN_CLUSTER",
      `need at least ${MIN_BOFU} transactional candidates for BOFU, have ${transactional.length}`);

  // The pillar is the broadest informational term -- fewest words wins, which is the usual proxy
  // for head-term breadth. The machine does not SCORE candidates (a spec rabbit hole); it only
  // orders them so the human reads a sensible shape. The human still chooses.
  const informational = rest.filter((c) => c.intent === "informational");
  const pool = informational.length > 0 ? informational : rest;
  const pillar = pool.slice().sort((a, b) => a.keyword.split(" ").length - b.keyword.split(" ").length)[0];

  // Spokes are the rows most TOPICALLY related to the pillar, capped. The first version took
  // every remaining candidate and proposed a "cluster" of 73 spokes, which is not a cluster and
  // not something a human can approve as one inbox item -- it is a dump with a gate in front of
  // it. Ordering by shared tokens with the pillar is what makes a cluster a cluster; it is not
  // the quality SCORING the spec calls a rabbit hole, because nothing here judges a candidate as
  // better or worse, only as nearer or further from the pillar. The human still moves any row.
  const tokens = (s) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  const pillarTokens = tokens(pillar.keyword);
  const overlap = (c) => [...tokens(c.keyword)].filter((t) => pillarTokens.has(t)).length;
  const spokes = rest
    .filter((c) => c !== pillar)
    .map((c) => ({ c, n: overlap(c) }))
    .sort((a, b) => b.n - a.n || a.c.keyword.localeCompare(b.c.keyword))
    .slice(0, MAX_SPOKES)
    .map((x) => x.c);
  const bofu = transactional.slice(0, MAX_BOFU);

  // INVARIANT BACKSTOPS, and they are UNREACHABLE as the code stands -- the two pool checks above
  // already guarantee both. A mutant run proved it: deleting these two lines turned no test red,
  // which means no test covers them and none can. They are kept as a tripwire for a future edit
  // to the selection logic (a changed cap, a filter added between here and there), and they are
  // labelled rather than left looking tested, because a guard nobody can turn red is exactly the
  // vacuous shape this lane keeps finding in its own work.
  if (spokes.length < MIN_SPOKES)
    throw new ClusterError("THIN_CLUSTER", `cluster has ${spokes.length} spokes, floor is ${MIN_SPOKES}`);
  if (bofu.length < MIN_BOFU || bofu.length > MAX_BOFU)
    throw new ClusterError("THIN_CLUSTER", `cluster has ${bofu.length} BOFU rows, band is ${MIN_BOFU}-${MAX_BOFU}`);

  const row = (c) => ({
    keyword: c.keyword,
    intent: c.intent,
    evidence_url: c.evidence_url,
    gap_note: c.gap_note,
    source_id: c.source_id,
  });
  return { cluster_id: clusterId, pillar: row(pillar), spokes: spokes.map(row), bofu: bofu.map(row) };
}

/**
 * THE GATE. Returns the approving decision's request ULID, or throws.
 *
 * `events` is what the spine reader returned, in append order. It is read, never written: growth
 * is a reader-only consumer of the spine.
 *
 * Refuses when: no approval was requested for this cluster; the request was never decided; the
 * verdict was reject; the approval names a different cluster; or the plan has CHANGED since the
 * approval was given. The last one is the reason `plan_sha` exists at all -- without it, a human
 * approves a clean plan and generation runs against whatever the file says at generation time,
 * which makes the gate ceremonial.
 */
export function assertClusterApproved({ events, clusterId, planSha: sha }) {
  if (!Array.isArray(events))
    throw new ClusterError("BAD_INPUT", "events must be an array from the spine reader");
  if (typeof clusterId !== "string" || !CLUSTER_ID_RE.test(clusterId))
    throw new ClusterError("BAD_CLUSTER_ID", `cluster_id ${JSON.stringify(clusterId)} must match c-NNN`);
  if (typeof sha !== "string" || !SHA256_RE.test(sha))
    throw new ClusterError("BAD_PLAN_SHA", "plan_sha must be a 64-char lowercase sha256");

  // Own-property reads only. These objects came from JSON.parse, so an inherited `cluster_id`
  // smuggled through __proto__ must not be able to answer for a real one.
  const own = (o, k) => (o !== null && typeof o === "object" && Object.hasOwn(o, k) ? o[k] : undefined);
  const norm = (e) => (own(e, "event") !== undefined ? e.event : e); // reader wraps events

  const requests = [];
  const decisions = [];
  for (const raw of events) {
    const e = norm(raw);
    const kind = own(e, "kind");
    const payload = own(e, "payload");
    if (kind === "approval.requested") requests.push({ id: own(e, "id"), payload });
    else if (kind === "decision.recorded") decisions.push({ id: own(e, "id"), payload });
  }

  // Exact match on both. A cluster id differing only in case is a DIFFERENT cluster, and a plan
  // whose bytes differ is a different plan -- neither is a near-miss worth being lenient about.
  const mine = requests.filter(
    (r) => own(r.payload, "cluster_id") === clusterId && own(r.payload, "plan_sha") === sha,
  );
  if (mine.length === 0) {
    const forCluster = requests.filter((r) => own(r.payload, "cluster_id") === clusterId).length;
    throw new ClusterError("NOT_APPROVED",
      forCluster > 0
        ? `cluster ${clusterId} has ${forCluster} approval request(s), but none for THIS plan (${sha.slice(0, 12)}) -- the plan changed after it was sent for approval, so approve the current one`
        : `cluster ${clusterId} was never sent for approval`);
  }

  for (const r of mine) {
    const decided = decisions.filter((d) => own(d.payload, "decides") === r.id);
    // A request can carry exactly one decision: arc-event keys a decision's idem on its `decides`,
    // so a second one collides on DUP_IDEM and is quarantined. More than one here means the log is
    // not what the writer guarantees, and the safe reading of an ambiguous approval is NO.
    if (decided.length > 1)
      throw new ClusterError("AMBIGUOUS_APPROVAL",
        `approval ${r.id} carries ${decided.length} decisions, which the writer forbids -- refusing rather than picking one`);
    if (decided.length === 1 && own(decided[0].payload, "verdict") === "approve") return r.id;
  }

  const anyDecided = mine.some((r) => decisions.some((d) => own(d.payload, "decides") === r.id));
  throw new ClusterError("NOT_APPROVED",
    anyDecided
      ? `cluster ${clusterId} was reviewed and NOT approved`
      : `cluster ${clusterId} is waiting for a human decision in the inbox`);
}
