// validate-absorb.mjs -- ADR-0603 (ABS-D): the owner-judge receipt profile.
//
// A PROFILE, NOT A KIND. `approval.requested` stays generic for every other gate in the repo, and
// only a payload declaring `subject: "absorb.ab-judgement"` is held to the strict shape below. That
// is the POL-E pattern (`subject: "policy.promotion"`, validate-policy.mjs) applied verbatim, and it
// is why ADR-0603 adds **zero new event kinds** to a vocabulary that is closed by ADR-0026.
//
// This file lives beside the other lane validators so `validate.mjs` gains exactly two lines -- one
// import, one dispatch. `.claude/scripts/hq/**` is a shared organ and two other lanes were LIVE when
// this landed, so the smallest possible footprint there is the point.
//
// WHAT THE PROFILE IS FOR. Where a deterministic check exists, absorb uses it. Where one does not,
// the arbiter is the owner's judgement -- and a judgement that lives in memory is not evidence. So
// the request must be blind (labels randomized), sealed (the label-to-variant mapping committed as a
// hash BEFORE the decision, revealed only after), and both fields mandatory on the way out.
//
// STRICT IN BOTH DIRECTIONS, and the second one is the likelier slip: an unknown key is rejected
// (someone inventing a field), AND every required key's absence is rejected BY NAME (a payload
// assembled programmatically that dropped one). The Phase 01 attack panel pointed out that v1 of
// this spec only promised the first.

import { SpineError } from "./canonical.mjs";

export const AB_JUDGEMENT_SUBJECT = "absorb.ab-judgement";

// Closed shape. `subject` plus these, and nothing else.
const REQUIRED = Object.freeze([
  "candidate",     // the registry row id this judges, T-NN
  "fixtures",      // the fixture list the A/B ran on -- at least 3 (REQ-03)
  "labels",        // the BLIND labels shown to the owner
  "commitment",    // sha256 of the sealed label-to-variant mapping
  "evidence_path", // where the PLANOFF bundle lives
  "correlation",   // ties this judgement to its run
]);
const ALLOWED = new Set(["subject", ...REQUIRED]);

const MIN_FIXTURES = 3;   // REQ-03: at least 3 representative fixtures of the target class
const HEX64 = /^[0-9a-f]{64}$/;
const T_ID = /^T-\d{2,}$/;

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

const bad = (msg) => { throw new SpineError("BAD_AB_JUDGEMENT", msg); };

// A payload is held to this profile only when it declares the subject. Anything else is a generic
// approval.requested and is none of absorb's business.
export function isAbJudgement(event) {
  return (
    event &&
    event.kind === "approval.requested" &&
    isPlainObject(event.payload) &&
    event.payload.subject === AB_JUDGEMENT_SUBJECT
  );
}

export function assertAbJudgement(event) {
  const p = event.payload;

  // Unknown keys: someone inventing a field.
  for (const k of Object.keys(p)) {
    if (!ALLOWED.has(k)) {
      bad(`approval.requested subject "${AB_JUDGEMENT_SUBJECT}" has unknown key "${k}" (shape is closed to subject|${REQUIRED.join("|")})`);
    }
  }
  // Missing required keys, BY NAME. The likelier real slip, and v1 of the spec only promised the
  // unknown-key direction.
  for (const k of REQUIRED) {
    if (!(k in p)) bad(`approval.requested subject "${AB_JUDGEMENT_SUBJECT}" is missing required key "${k}"`);
  }

  if (typeof p.candidate !== "string" || !T_ID.test(p.candidate))
    bad(`candidate must be a registry row id in T-NN form, got ${JSON.stringify(p.candidate)}`);

  if (!Array.isArray(p.fixtures) || p.fixtures.length < MIN_FIXTURES)
    bad(`fixtures must be an array of at least ${MIN_FIXTURES} entries (REQ-03: the A/B runs on at least ${MIN_FIXTURES} representative fixtures), got ${Array.isArray(p.fixtures) ? p.fixtures.length : typeof p.fixtures}`);
  for (const f of p.fixtures)
    if (typeof f !== "string" || !f.trim()) bad("every fixture must be a non-empty string naming what was compared");

  // The labels are what the owner actually sees. Two at minimum, and they must be DISTINCT --
  // identical labels are not a blind comparison, they are one option shown twice.
  if (!Array.isArray(p.labels) || p.labels.length < 2)
    bad(`labels must be an array of at least 2 blind labels, got ${Array.isArray(p.labels) ? p.labels.length : typeof p.labels}`);
  for (const l of p.labels)
    if (typeof l !== "string" || !l.trim()) bad("every blind label must be a non-empty string");
  if (new Set(p.labels).size !== p.labels.length)
    bad("blind labels must be distinct -- a repeated label is one variant shown twice, not a comparison");
  // A label that names its variant is not blind. This is the whole property, so it is checked
  // rather than trusted: "old", "new", "absorbed", "before", "after", "arc", "theirs" all leak.
  const LEAKY = /\b(old|new|before|after|absorbed|rebuilt|baseline|control|arc|ours|theirs|original|candidate)\b/i;
  for (const l of p.labels)
    if (LEAKY.test(l)) bad(`blind label ${JSON.stringify(l)} names what it is -- a label that leaks the variant is not blind`);

  // The commitment is what makes "sealed" true rather than polite. A plaintext mapping guarded by a
  // code path that declines to display it is an honour system, and the owner has a filesystem.
  if (typeof p.commitment !== "string" || !HEX64.test(p.commitment))
    bad("commitment must be a lowercase sha256 hex of the sealed label-to-variant mapping -- without it, nothing proves the mapping was fixed BEFORE the decision");

  if (typeof p.evidence_path !== "string" || !p.evidence_path.trim())
    bad("evidence_path must name where the PLANOFF bundle lives -- a proposal without its results table is lint-invalid (REQ-03)");

  if (typeof p.correlation !== "string" || !p.correlation.trim())
    bad("correlation must be a non-empty string tying this judgement to its run");
}
