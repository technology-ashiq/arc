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
//
// ------------------------------------------------------------------------------------------
// THIS FILE IS A READ-SIDE GATE, AND THAT IS THE WHOLE DIFFICULTY.
//
// An adversarial pass took the first version apart. The two findings that mattered:
//
//   1. `undefined === undefined`. Request ids and decision `decides` were compared with `===`
//      after being read through a helper that returns `undefined` for a missing key -- so an
//      approval.requested with NO id was "decided" by any decision.recorded with NO decides.
//      A `{verdict:"approve"}` naming nothing at all approved everything.
//   2. The plan hash used a hand-rolled stable-stringify that ignored non-enumerable keys,
//      symbols, Map/Set/Date, undefined-in-array, NaN and -0. A plan could carry a field the
//      human never saw and hash identically. That is the partial-preimage defect this lane has
//      now hit three times, and the hardened `canonicalize()` was already imported from the very
//      module next door and then not used.
//
// Both came from the same root error: assuming the WRITE-side guarantees in validate.mjs hold on
// the read side. They do not. `spine.mjs scanAll()` is JSON.parse and nothing else -- it even
// returns a `torn` list -- so every field this gate keys on is re-validated here, from scratch.
// ------------------------------------------------------------------------------------------

import { sha256Hex, canonicalize, ULID_RE } from "../../hq/lib/canonical.mjs";

const CLUSTER_ID_RE = /^c-[0-9]{3,9}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
// A real evidence link, not merely a non-empty string. The first version checked only for a
// non-empty string here, so "not a url at all" reached a plan a human was asked to approve.
const HTTPS_URL_RE = /^https:\/\/[a-z0-9.-]+\/[^\s]*$/i;
const INTENTS = Object.freeze(["informational", "commercial", "transactional"]);
const ROW_KEYS = Object.freeze(["keyword", "intent", "evidence_url", "gap_note", "source_id"]);
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
 * The hash a human approves. Binding the approval to these bytes is what stops a swap.
 *
 * `canonicalize` is the spine's own hardened serialiser: it refuses NaN, Infinity, -0, undefined
 * inside arrays, non-plain objects (Date/Map/Set) and nesting past MAX_DEPTH, any of which would
 * otherwise let two different plans hash the same. Its SpineError is re-thrown as a ClusterError
 * so a caller sees one error family -- and so a cyclic or absurdly deep plan is a coded refusal
 * rather than an uncatchable RangeError.
 */
export function planSha(plan) {
  try {
    return sha256Hex(canonicalize(plan));
  } catch (e) {
    throw new ClusterError("BAD_PLAN", `plan cannot be canonicalised: ${e.message}`);
  }
}

/**
 * ONE read per field, into a local, validated as the local, emitted as the local.
 *
 * The reason is a confirmed attack: a candidate whose `evidence_url` was a getter returned a real
 * URL for the two validation reads and "" for the third read that built the row, putting six
 * evidence-less rows into a proposal past a guard whose entire stated purpose was preventing it.
 * Reading a field twice means validating one value and shipping another.
 */
function freezeRow(c, where) {
  if (c === null || typeof c !== "object" || Array.isArray(c))
    throw new ClusterError("BAD_INPUT", `${where} is not an object`);
  const row = {};
  for (const k of ROW_KEYS) row[k] = c[k]; // the only reads of `c` in this function

  if (typeof row.keyword !== "string" || row.keyword.trim() === "")
    throw new ClusterError("BAD_INPUT", `${where} has no keyword`);
  if (!INTENTS.includes(row.intent))
    throw new ClusterError("BAD_INPUT", `${where} has intent ${JSON.stringify(row.intent)}, outside ${INTENTS.join("|")}`);
  // Criterion 5, at this door too: a row without a REAL evidence link cannot enter the proposal.
  if (typeof row.evidence_url !== "string" || !HTTPS_URL_RE.test(row.evidence_url))
    throw new ClusterError("NO_EVIDENCE", `${where} has no usable evidence_url (${JSON.stringify(row.evidence_url)})`);
  if (typeof row.gap_note !== "string") row.gap_note = "";
  if (typeof row.source_id !== "string" || row.source_id === "")
    throw new ClusterError("BAD_INPUT", `${where} has no source_id, so its provenance is unknown`);
  // A row carrying a resolution status is one the caller classified as dead or unverifiable.
  // Nothing else binds a plan to the LIVE partition, so it is refused here by name.
  if (Object.hasOwn(c, "_status"))
    throw new ClusterError("NO_EVIDENCE", `${where} came from the dead or unverifiable bucket (status ${c._status})`);
  return Object.freeze(row);
}

// Unicode-preserving, and NFKC-normalised, exactly like mine.mjs's targetKey. This line used to
// use a NEGATED ASCII letter range -- the same defect that was fixed in targetKey one file away
// and left standing here. Every non-Latin keyword collapsed to the empty string, so dedupe read
// two distinct phrases as one and dropped a real row. The repo's portability lint caught it,
// because a negated letter range is locale-collation dependent as well. Two reasons, one fix.
// (The broken form is described rather than quoted: that lint skips shell comments, not JS ones,
// so writing the pattern here would re-trip it inside the sentence explaining the fix -- which is
// a mistake this repo has made before, in exactly this shape.)
const normKey = (s) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Compose ONE inbox item from evidenced candidates: 1 pillar, 5-8 spokes, 2-3 BOFU.
 */
export function buildClusterPlan({ candidates, clusterId }) {
  if (typeof clusterId !== "string" || !CLUSTER_ID_RE.test(clusterId))
    throw new ClusterError("BAD_CLUSTER_ID", `cluster_id ${JSON.stringify(clusterId)} must match c-NNN`);
  if (!Array.isArray(candidates))
    throw new ClusterError("BAD_INPUT", "candidates must be an array");

  // Frozen FIRST, so nothing below can read a mutating source.
  const frozen = candidates.map((c, i) => freezeRow(c, `candidate ${i}`));

  // Distinct keywords, not distinct array slots. Six references to one candidate satisfied every
  // count in the first version and produced a "cluster" whose pillar and five spokes were the
  // same phrase -- non-independent rows counted as independent, which is this lane's own
  // recurring defect wearing a different hat.
  const seen = new Set();
  const uniq = [];
  for (const r of frozen) {
    const k = normKey(r.keyword);
    if (k === "" || seen.has(k)) continue;
    seen.add(k);
    uniq.push(r);
  }

  const transactional = uniq.filter((c) => c.intent === "transactional");
  const rest = uniq.filter((c) => c.intent !== "transactional");

  if (rest.length < 1 + MIN_SPOKES)
    throw new ClusterError("THIN_CLUSTER",
      `need 1 pillar + ${MIN_SPOKES} spokes from distinct non-transactional candidates, have ${rest.length}`);
  if (transactional.length < MIN_BOFU)
    throw new ClusterError("THIN_CLUSTER",
      `need at least ${MIN_BOFU} distinct transactional candidates for BOFU, have ${transactional.length}`);

  // The pillar is the broadest informational term -- fewest words wins, the usual proxy for head
  // -term breadth. The machine does not SCORE candidates (a spec rabbit hole); it only orders
  // them so the human reads a sensible shape. The human still chooses.
  const informational = rest.filter((c) => c.intent === "informational");
  const pool = informational.length > 0 ? informational : rest;
  const pillar = pool.slice().sort((a, b) => a.keyword.split(" ").length - b.keyword.split(" ").length)[0];

  // Spokes are the rows most TOPICALLY related to the pillar, capped. A first version took every
  // remaining candidate and proposed 73 spokes, which is not a cluster and not something a human
  // approves -- it is a dump with a gate in front of it. Ordering by shared tokens is what makes
  // a cluster a cluster; nothing here judges a candidate better or worse, only nearer the pillar.
  const tokens = (s) => new Set(normKey(s).split(" ").filter((t) => t.length > 2));
  const pillarTokens = tokens(pillar.keyword);
  const overlap = (c) => [...tokens(c.keyword)].filter((t) => pillarTokens.has(t)).length;
  const spokes = rest
    .filter((c) => c !== pillar)
    .map((c) => ({ c, n: overlap(c) }))
    // Code-unit tiebreak, never localeCompare: the host locale must not decide which spokes are
    // in the plan whose hash the human approval is bound to.
    .sort((a, b) => b.n - a.n || (a.c.keyword < b.c.keyword ? -1 : a.c.keyword > b.c.keyword ? 1 : 0))
    .slice(0, MAX_SPOKES)
    .map((x) => x.c);
  const bofu = transactional.slice(0, MAX_BOFU);

  // Composition invariants. An earlier comment here called these unreachable on the strength of a
  // mutant run; that was WRONG, and the attack pass showed why -- six references to one object
  // passed the pool check and produced zero spokes, which fires this exactly. Dedupe now makes
  // that particular route impossible, and the invariants stay because a future edit to the
  // selection above is precisely what they are here to catch.
  if (spokes.length < MIN_SPOKES)
    throw new ClusterError("THIN_CLUSTER", `cluster has ${spokes.length} spokes, floor is ${MIN_SPOKES}`);
  if (bofu.length < MIN_BOFU || bofu.length > MAX_BOFU)
    throw new ClusterError("THIN_CLUSTER", `cluster has ${bofu.length} BOFU rows, band is ${MIN_BOFU}-${MAX_BOFU}`);

  return { cluster_id: clusterId, pillar, spokes, bofu };
}

// ---------------------------------------------------------------------------------------------
// THE GATE
// ---------------------------------------------------------------------------------------------

// Own-property read. These objects came from JSON.parse on a line the reader did not validate, so
// an inherited `cluster_id` smuggled through __proto__ must not answer for a real one. Note the
// single read: `Object.hasOwn` then `o[k]` would be two reads, and a Proxy can answer them
// differently -- so the value is taken once and returned.
function own(o, k) {
  if (o === null || typeof o !== "object") return undefined;
  const d = Object.getOwnPropertyDescriptor(o, k);
  return d === undefined ? undefined : d.value;
}

/** A handle is usable only if it is a real ULID. Missing is not a value that can match. */
const isHandle = (v) => typeof v === "string" && ULID_RE.test(v);

/**
 * THE GATE. Returns the approving request's ULID, or throws.
 *
 * Refuses when: no approval was requested for this cluster; the request was never decided; the
 * verdict was reject; the approval names a different cluster; or the plan has CHANGED since the
 * approval was given. The last is why `plan_sha` exists -- without it a human approves a clean
 * plan and generation runs against whatever the file says later, which makes the gate ceremonial.
 */
export function assertClusterApproved({ events, clusterId, planSha: sha }) {
  if (!Array.isArray(events))
    throw new ClusterError("BAD_INPUT", "events must be an array from the spine reader");
  if (typeof clusterId !== "string" || !CLUSTER_ID_RE.test(clusterId))
    throw new ClusterError("BAD_CLUSTER_ID", `cluster_id ${JSON.stringify(clusterId)} must match c-NNN`);
  if (typeof sha !== "string" || !SHA256_RE.test(sha))
    throw new ClusterError("BAD_PLAN_SHA", "plan_sha must be a 64-char lowercase sha256");

  const requests = [];
  const decisions = [];
  let malformed = 0;
  for (const raw of events) {
    // Unwrap the reader's {event, day, seq, line} wrapper with ONE read, and only when the inner
    // value is itself an object -- so a record carrying an unrelated `event` key is not silently
    // reinterpreted, and a Proxy cannot return a benign object to the check and a hostile one to
    // the use.
    const wrapped = own(raw, "event");
    const e = wrapped !== undefined && wrapped !== null && typeof wrapped === "object" ? wrapped : raw;
    const kind = own(e, "kind");
    if (kind !== "approval.requested" && kind !== "decision.recorded") continue;
    const payload = own(e, "payload");
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) { malformed++; continue; }
    if (kind === "approval.requested") {
      const id = own(e, "id");
      // A request with no usable id can never be decided, because nothing can name it. Counting
      // it as a candidate is how `undefined === undefined` granted approval.
      if (!isHandle(id)) { malformed++; continue; }
      // The `gate` discriminator is CHECKED, not decorative. Without it an approval.requested
      // raised for some other gate -- a publish, a spend -- that happened to carry a matching
      // cluster_id and plan_sha would authorise generation. A human answering one question must
      // not be recorded as having answered a different one.
      if (own(payload, "gate") !== "cluster") { malformed++; continue; }
      requests.push({ id, cluster_id: own(payload, "cluster_id"), plan_sha: own(payload, "plan_sha") });
    } else {
      const decides = own(payload, "decides");
      if (!isHandle(decides)) { malformed++; continue; }
      const id = own(e, "id");
      // A decision that decides itself is a cycle the writer already refuses; refuse it here too
      // rather than trusting that it did.
      if (isHandle(id) && id === decides) { malformed++; continue; }
      decisions.push({ decides, verdict: own(payload, "verdict") });
    }
  }

  // Exact match on both. A cluster id differing only in case is a DIFFERENT cluster, and a plan
  // whose bytes differ is a different plan -- neither is a near-miss worth being lenient about.
  const mine = requests.filter((r) => r.cluster_id === clusterId && r.plan_sha === sha);
  if (mine.length === 0) {
    const forCluster = requests.filter((r) => r.cluster_id === clusterId).length;
    throw new ClusterError("NOT_APPROVED",
      forCluster > 0
        ? `cluster ${clusterId} has ${forCluster} approval request(s), but none for THIS plan (${sha.slice(0, 12)}) -- the plan changed after it was sent for approval, so approve the current one`
        : `cluster ${clusterId} was never sent for approval${malformed ? ` (${malformed} unusable record(s) ignored)` : ""}`);
  }

  for (const r of mine) {
    const decided = decisions.filter((d) => d.decides === r.id);
    // A request carries exactly one decision: arc-event keys a decision's idem on its `decides`,
    // so a second collides on DUP_IDEM and is quarantined. More than one here means the log is
    // not what the writer guarantees, and the safe reading of an ambiguous approval is NO.
    if (decided.length > 1) {
      // Identical duplicates are a torn-and-healed append, not a disagreement -- collapsing them
      // first stops a replay artefact from permanently bricking a genuinely approved cluster.
      const verdicts = new Set(decided.map((d) => d.verdict));
      if (verdicts.size > 1)
        throw new ClusterError("AMBIGUOUS_APPROVAL",
          `approval ${r.id} carries ${decided.length} decisions that disagree (${[...verdicts].map((v) => JSON.stringify(v)).join(", ")}) -- refusing rather than picking one`);
    }
    if (decided.length >= 1 && decided.every((d) => d.verdict === "approve")) return r.id;
  }

  const anyDecided = mine.some((r) => decisions.some((d) => d.decides === r.id));
  throw new ClusterError("NOT_APPROVED",
    anyDecided
      ? `cluster ${clusterId} was reviewed and NOT approved`
      : `cluster ${clusterId} is waiting for a human decision in the inbox`);
}
