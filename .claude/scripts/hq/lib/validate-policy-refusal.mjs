// validate-policy-refusal.mjs -- the `policy.refusal` profile on `note.logged` (ADR-0509, POL-L).
//
// A PROFILE, not a kind: the closed vocabulary gains ZERO kinds. `note.logged` stays generic for every other
// writer in the repo, and only a payload declaring subject "policy.refusal" is held to this shape -- the fourth
// instance of the pattern after policy.promotion, absorb.ab-judgement and ledger.criteria (ADR-1017).
//
// The evidence fold attributes a refusal ONLY from these typed fields. It never parses prose, which is why the
// `incident.raised` arc-run already writes on a deny does not count: its capability lives inside a free-text `what`.
import { SpineError } from "./canonical.mjs";

export const REFUSAL_SUBJECT = "policy.refusal";

const REQUIRED = Object.freeze(["action_kind", "capability", "level", "decision", "surface", "reason"]);
const ALLOWED = new Set(["subject", ...REQUIRED, "incident_ref"]);
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

// Copied grammar would drift, but validate-policy.mjs keeps these private and is a company organ several lanes
// edit; the test pins both modules to the same strings so a widening in one is caught in the other.
const ACTION_KIND_RE = /^(process:[a-z][a-z0-9-]*|session:interactive)$/;
const LEVEL_RE = /^L[0-3]$/;
export const REFUSAL_CAPABILITIES = Object.freeze(["read", "write", "shell", "network", "message", "publish", "deploy", "spend"]);
export const REFUSAL_DECISIONS = Object.freeze(["deny", "propose"]);
export const REFUSAL_SURFACES = Object.freeze(["headless", "interactive", "scheduler"]);
const MAX_REASON = 300;

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

const bad = (msg) => { throw new SpineError("BAD_POLICY_REFUSAL", msg); };

export function isPolicyRefusal(event) {
  return !!event && event.kind === "note.logged" && isPlainObject(event.payload) &&
    event.payload.subject === REFUSAL_SUBJECT;
}

export function assertPolicyRefusal(event) {
  const p = event.payload;
  for (const k of Object.keys(p))
    if (!ALLOWED.has(k)) bad(`note.logged subject "${REFUSAL_SUBJECT}" has unknown key "${k}" (shape is closed to subject|${REQUIRED.join("|")})`);
  for (const k of REQUIRED)
    if (!(k in p)) bad(`note.logged subject "${REFUSAL_SUBJECT}" is missing required key "${k}"`);
  if (typeof p.action_kind !== "string" || !ACTION_KIND_RE.test(p.action_kind))
    bad(`action_kind ${JSON.stringify(p.action_kind)} must be process:NAME or session:interactive (ADR-0504)`);
  if (!REFUSAL_CAPABILITIES.includes(p.capability))
    bad(`capability ${JSON.stringify(p.capability)} is not one of the closed eight (ADR-0505)`);
  if (typeof p.level !== "string" || !LEVEL_RE.test(p.level))
    bad(`level ${JSON.stringify(p.level)} must be one of L0|L1|L2|L3`);
  if (!REFUSAL_DECISIONS.includes(p.decision))
    bad(`decision ${JSON.stringify(p.decision)} must be deny|propose -- an execute is not a refusal`);
  if (!REFUSAL_SURFACES.includes(p.surface))
    bad(`surface ${JSON.stringify(p.surface)} must be ${REFUSAL_SURFACES.join("|")}`);
  // A propose exists only at L1 by definition (POL-A: L1 is "propose"); a receipt claiming a propose at any other
  // level describes a decision the authorizer cannot have made.
  if (p.decision === "propose" && p.level !== "L1")
    bad(`a propose happens only at L1, got level ${p.level}`);
  // A headless refusal cites the incident arc-run wrote for it, so the fold can corroborate it (ADR-0509). The
  // other surfaces have no such event, and a ref there would point at nothing that vouches for it.
  if (p.surface === "headless") {
    if (typeof p.incident_ref !== "string" || !ULID_RE.test(p.incident_ref))
      bad("a headless refusal must carry incident_ref, the ULID of the incident.raised written for it");
  } else if ("incident_ref" in p) {
    bad(`incident_ref belongs to a headless refusal only, not surface ${p.surface}`);
  }
  if (typeof p.reason !== "string" || p.reason.trim() === "" || p.reason.length > MAX_REASON || /[\u0000-\u001f\u007f\u0085\u2028\u2029]/.test(p.reason) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(p.reason))
    bad(`reason must be 1..${MAX_REASON} characters of single-line, well-formed text (no C0, NEL, U+2028/2029 or lone surrogate)`);
}

export function isNearMissPolicyRefusal(event) {
  if (!event || event.kind !== "note.logged" || !isPlainObject(event.payload)) return false;
  const sub = event.payload.subject;
  return typeof sub === "string" && sub !== REFUSAL_SUBJECT && sub.trim().toLowerCase() === REFUSAL_SUBJECT;
}

export function assertNotNearMissPolicyRefusal(event) {
  bad(`subject ${JSON.stringify(event.payload.subject)} differs from "${REFUSAL_SUBJECT}" only by case or whitespace -- refused rather than normalized, because a near-miss would otherwise be exempt from the profile it imitates`);
}
