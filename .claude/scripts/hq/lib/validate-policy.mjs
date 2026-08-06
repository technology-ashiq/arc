// validate-policy.mjs — the four authority receipts (ADR-0508, extending ADR-0026's closed
// vocabulary; POL-E).
//
// One kind per fact, each with its own CLOSED payload validator — the shape
// validate-experiment.mjs established (ADR-0304) and validate-leads.mjs followed. Not one
// generic `policy.event` with a `type` discriminator, because that is where a missing branch
// passes silently, and here a missing branch is an authority change nobody checked.
//
// TWO KINDS FOR PROMOTION AND DEMOTION, not one with a direction field, because they have two
// different TRUTH SOURCES: `policy.level.changed` is human-decided and must cite the decision
// that authorised it, `policy.demoted` is machine-derived and must cite the incident that
// caused it. The revenue.received / revenue.simulated pair is the precedent. A single kind
// would let a forged "direction: up" become a promotion with no decision to point at.
//
// AUTHORITY IS KEYED PER (action kind, CAPABILITY) PAIR — ADR-0505. Both transition kinds
// carry `capability`, because the ceiling in hq.policy.yaml is per capability and
// `effective = min(ceiling, cap)` is only meaningful when both sides are keyed the same way.
// The first draft of these payloads had no capability field, which would have compared a
// per-capability ceiling against a kind-wide cap and silently flattened seven of eight vectors.
//
// EVERY IDEM IS TOTAL-PREIMAGE over the identity-bearing fields, absent optionals written as a
// literal `-` (the C2 lesson: a partial preimage silently quarantined ~100 receipts as
// DUP_IDEM, and a cap derived from receipts that were never written counts zero and never
// trips). For money that is not an inconvenience — a `spend.reserved` that quarantines is
// budget nobody is holding, and the next check passes.

import { SpineError, sha256Hex } from "./canonical.mjs";

export const POLICY_KINDS = Object.freeze([
  "policy.level.changed",
  "policy.demoted",
  "spend.reserved",
  "spend.released",
]);

export const isPolicyKind = (kind) => POLICY_KINDS.includes(kind);

const LEVEL_RE = /^L[0-3]$/; // L4 is a parse error in the file and a bad payload here
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
// `process:NAME` or the single reserved interactive subject (ADR-0504).
const ACTION_KIND_RE = /^(process:[a-z][a-z0-9-]*|session:interactive)$/;
const CAPABILITIES = Object.freeze([
  "read", "write", "shell", "network", "message", "publish", "deploy", "spend",
]);

/** Closed shapes. An unknown key is a hard error, never an ignored extra (POL-B). */
const SHAPES = Object.freeze({
  "policy.level.changed": [
    "action_kind", "capability", "correlation", "decision_ref",
    "from_level", "policy_hash", "to_level", "trial_ledger_ref",
  ],
  "policy.demoted": [
    "action_kind", "capability", "correlation", "from_level",
    "incident_ref", "policy_hash", "to_level",
  ],
  "spend.reserved": [
    "action_kind", "amount", "correlation", "currency",
    "idempotency_key", "policy_hash", "window",
  ],
  "spend.released": [
    "correlation", "policy_hash", "reason", "released_on", "reservation_ref",
  ],
});

const bad = (msg) => { throw new SpineError("BAD_POLICY", msg); };

function assertClosedShape(kind, payload) {
  const keys = SHAPES[kind];
  for (const k of Object.keys(payload))
    if (!keys.includes(k))
      bad(`${kind} payload has unknown key "${k}" (shape is closed to ${keys.join("|")})`);
  for (const k of keys)
    if (!(k in payload)) bad(`${kind} payload is missing "${k}"`);
}

const assertLevel = (kind, field, v) => {
  if (typeof v !== "string" || !LEVEL_RE.test(v))
    bad(`${kind}.${field} ${JSON.stringify(v)} must be one of L0|L1|L2|L3 — L4 is not a level`);
};
const assertUlid = (kind, field, v) => {
  if (typeof v !== "string" || !ULID_RE.test(v))
    bad(`${kind}.${field} must be a ULID, so the thing it cites can actually be found`);
};
const assertActionKind = (kind, v) => {
  if (typeof v !== "string" || !ACTION_KIND_RE.test(v))
    bad(`${kind}.action_kind ${JSON.stringify(v)} must be process:NAME or session:interactive (ADR-0504)`);
};
const assertCapability = (kind, v) => {
  if (!CAPABILITIES.includes(v))
    bad(`${kind}.capability ${JSON.stringify(v)} is not one of the closed eight — authority is keyed per (kind, capability) pair (ADR-0505)`);
};
const assertHash = (kind, field, v) => {
  if (typeof v !== "string" || !HEX64.test(v))
    bad(`${kind}.${field} must be lowercase sha256 hex — a receipt that cannot say which law authorised it is not a receipt`);
};
const assertNonEmpty = (kind, field, v) => {
  if (typeof v !== "string" || v.trim() === "") bad(`${kind}.${field} must be a non-empty string`);
};

/** The total preimage for each kind. Absent optionals are impossible here: every shape is closed. */
function idemPreimage(kind, p) {
  switch (kind) {
    case "policy.level.changed":
      return [kind, p.action_kind, p.capability, p.from_level, p.to_level, p.decision_ref, p.policy_hash].join("|");
    case "policy.demoted":
      return [kind, p.action_kind, p.capability, p.from_level, p.to_level, p.incident_ref, p.policy_hash].join("|");
    case "spend.reserved":
      // The idempotency key is the identity of a reservation attempt, so it IS the preimage.
      // Two reservations for one key must collide as DUP_IDEM rather than both being held.
      return [kind, p.action_kind, p.idempotency_key, String(p.amount), p.currency, p.window, p.policy_hash].join("|");
    case "spend.released":
      return [kind, p.reservation_ref, p.released_on, p.policy_hash].join("|");
    default:
      return bad(`no idem preimage defined for ${kind}`);
  }
}

export function assertPolicy(event) {
  const kind = event.kind;
  const p = event.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) bad(`${kind} payload must be a mapping`);
  assertClosedShape(kind, p);

  assertHash(kind, "policy_hash", p.policy_hash);
  assertNonEmpty(kind, "correlation", p.correlation);

  if (kind === "policy.level.changed" || kind === "policy.demoted") {
    assertActionKind(kind, p.action_kind);
    assertCapability(kind, p.capability);
    assertLevel(kind, "from_level", p.from_level);
    assertLevel(kind, "to_level", p.to_level);
  }

  if (kind === "policy.level.changed") {
    // A promotion MUST cite the human decision that authorised it and the evidence it rested
    // on. A4: trust is re-earned, never argued back — so a raise with no decision to point at
    // is not a raise, it is a forgery.
    assertUlid(kind, "decision_ref", p.decision_ref);
    assertNonEmpty(kind, "trial_ledger_ref", p.trial_ledger_ref);
  }

  if (kind === "policy.demoted") {
    // A demotion is machine-derived and must cite the incident. It also may only ever go DOWN:
    // if this kind could raise a level, an attacker who can emit would prefer it to the human
    // path, because it needs no decision.
    assertUlid(kind, "incident_ref", p.incident_ref);
    const rank = (l) => Number(l.slice(1));
    if (rank(p.to_level) >= rank(p.from_level))
      bad(`policy.demoted claims ${p.from_level} -> ${p.to_level}; a demotion that does not lower the level is not a demotion`);
  }

  if (kind === "spend.reserved") {
    assertActionKind(kind, p.action_kind);
    if (!Number.isInteger(p.amount) || p.amount <= 0)
      bad(`spend.reserved.amount ${JSON.stringify(p.amount)} must be a positive integer in minor units — never a float, because a rounding is a different amount`);
    if (!Number.isSafeInteger(p.amount)) bad("spend.reserved.amount overflows a safe integer");
    if (typeof p.currency !== "string" || !CURRENCY_RE.test(p.currency))
      bad(`spend.reserved.currency ${JSON.stringify(p.currency)} must be ISO-4217 uppercase`);
    assertNonEmpty(kind, "idempotency_key", p.idempotency_key);
    if (p.window !== "daily") bad(`spend.reserved.window must be "daily" in v1, got ${JSON.stringify(p.window)}`);
  }

  if (kind === "spend.released") {
    assertUlid(kind, "reservation_ref", p.reservation_ref);
    assertNonEmpty(kind, "reason", p.reason);
    // WHO decided nothing was charged. A release on the provider's word and a release on
    // policy's own are different claims, and an auditor must be able to tell them apart --
    // the provider-attested one is the model's single unverifiable delegation.
    if (p.released_on !== "provider_attested_no_charge" && p.released_on !== "policy")
      bad(`spend.released.released_on must be "provider_attested_no_charge" or "policy", got ${JSON.stringify(p.released_on)}`);
  }

  const expected = sha256Hex(idemPreimage(kind, p));
  if (event.idem !== expected)
    bad(`${kind}.idem must be sha256 of its total preimage — an authority change is bound to the exact facts it asserts, so the same facts can never be recorded twice`);
}

/** Exported so an emitter can compute the idem it must supply. */
export const policyIdem = (kind, payload) => sha256Hex(idemPreimage(kind, payload));

// ---------------------------------------------------------------------------------------------
// The `policy.promotion` PROFILE on approval.requested (POL-E).
//
// `approval.requested` has no payload validator at all — it is the generic human-gate receipt,
// and it must stay generic. So this is a PROFILE: it applies only when the payload declares
// `subject: "policy.promotion"`, and every other approval in the repo is untouched. Forward-only
// (ADR-0068 spirit): nothing is retrofitted onto approvals already on the spine.
//
// Why a strict shape here when the kind itself is loose: this is the receipt that authorises a
// capability to climb. `decision.recorded`'s payload is closed to `decides|verdict|reason`
// (validate.mjs:192), so the decision CANNOT carry the evidence — it can only point at the
// request. That makes this payload the only place the trial-ledger citation and the target level
// can live, and an unvalidated field here is an unvalidated promotion.
// ---------------------------------------------------------------------------------------------

export const PROMOTION_SUBJECT = "policy.promotion";

const PROMOTION_KEYS = [
  "action_kind", "capability", "correlation", "from_level", "gate",
  "policy_hash", "subject", "to_level", "trial_ledger_ref", "what",
];

export const isPromotionRequest = (event) =>
  event && event.kind === "approval.requested" && event.payload &&
  event.payload.subject === PROMOTION_SUBJECT;

export function assertPromotionRequest(event) {
  const p = event.payload;
  for (const k of Object.keys(p))
    if (!PROMOTION_KEYS.includes(k))
      bad(`approval.requested[${PROMOTION_SUBJECT}] has unknown key "${k}" (the profile is closed to ${PROMOTION_KEYS.join("|")})`);
  for (const k of PROMOTION_KEYS)
    if (!(k in p)) bad(`approval.requested[${PROMOTION_SUBJECT}] is missing "${k}"`);

  assertActionKind("approval.requested", p.action_kind);
  assertCapability("approval.requested", p.capability);
  assertLevel("approval.requested", "from_level", p.from_level);
  assertLevel("approval.requested", "to_level", p.to_level);
  assertHash("approval.requested", "policy_hash", p.policy_hash);
  assertNonEmpty("approval.requested", "correlation", p.correlation);
  assertNonEmpty("approval.requested", "what", p.what);
  if (p.gate !== "policy") bad(`approval.requested[${PROMOTION_SUBJECT}].gate must be "policy"`);

  // A promotion must RAISE. A request to "promote" downward would be a demotion with no
  // incident to cite, arriving through the human door where nothing checks for one.
  const rank = (l) => Number(l.slice(1));
  if (rank(p.to_level) <= rank(p.from_level))
    bad(`approval.requested[${PROMOTION_SUBJECT}] asks for ${p.from_level} -> ${p.to_level}; a promotion must raise the level. Lowering one is a repo edit to the ceiling (POL-A) or an incident-backed policy.demoted`);

  // The evidence a human is being asked to weigh. A4: trust is re-earned, never argued back —
  // so a request with no citation is not a request, it is a nudge.
  assertNonEmpty("approval.requested", "trial_ledger_ref", p.trial_ledger_ref);
}
