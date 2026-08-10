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


// C0, DEL and C1. The C1 range carries NEL and CSI -- a single-character terminal-escape introducer.
// validate.mjs already documents this exact lesson for `decision.reason`, where an adversarial pass
// smuggled one onto the append-only spine. It was never TWINNED to a profile field, so a label with a
// raw newline rendered a FORGED second row in the owner's inbox -- one naming a real other approval's
// ULID with a benign description -- and a CSI reached the tty. Twinned now.
const hasControlChar = (str) => {
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f)) return true;
  }
  return false;
};

export const AB_JUDGEMENT_SUBJECT = "absorb.ab-judgement";

// THE LABEL POOL LIVES HERE, in the validator, and judgement.mjs imports it FROM here -- not the
// other way round. The first attempt had the validator import it from judgement.mjs, which is a CLI
// script with a top-level command dispatch: importing it EXECUTED that dispatch and killed every
// spine emit with "unknown command undefined". A validator must have no side effects, so it is the
// one that owns the shared constant.
//
// Words chosen to carry no information about what they label. Membership in this set is the blindness
// check, because a denylist of leaky words was bypassed nine ways.
export const LABEL_POOL = Object.freeze([
  "crimson", "harbor", "lantern", "meridian", "quartz", "thicket",
  "vellum", "zephyr", "cobalt", "fathom", "juniper", "kestrel",
]);

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
  // AN ALLOWLIST, because a denylist cannot express "carries no information". The v1 13-word regex
  // was bypassed NINE ways by the Phase 03 adversarial pass, every one accepted at the real spine:
  // "oldest"/"newest", "newer"/"older", "old_variant" (underscore is a word char so  never fired),
  // "absorb"/"rebuild", "arcnew"/"arcold", a Cyrillic-o "old", a zero-width-space "old", "v1"/"v2",
  // and "gstack"/"arcs". Only the literal control pair was refused.
  // Membership in the shared pool is the only form of this check that cannot be talked around, and the
  // pool is imported from judgement.mjs so the generator and the validator cannot drift apart.
  const POOL = new Set(LABEL_POOL);
  for (const l of p.labels)
    if (!POOL.has(l))
      bad(`blind label ${JSON.stringify(l)} is not one of the ${LABEL_POOL.length} pool labels -- a label must carry NO information about what it labels, and only membership can guarantee that`);

  // The commitment is what makes "sealed" true rather than polite. A plaintext mapping guarded by a
  // code path that declines to display it is an honour system, and the owner has a filesystem.
  if (typeof p.commitment !== "string" || !HEX64.test(p.commitment))
    bad("commitment must be a lowercase sha256 hex of the sealed label-to-variant mapping -- without it, nothing proves the mapping was fixed BEFORE the decision");

  if (typeof p.evidence_path !== "string" || !p.evidence_path.trim())
    bad("evidence_path must name where the PLANOFF bundle lives -- a proposal without its results table is lint-invalid (REQ-03)");

  if (typeof p.correlation !== "string" || !p.correlation.trim())
    bad("correlation must be a non-empty string tying this judgement to its run");

  if (new Set(p.fixtures).size !== p.fixtures.length)
    bad("fixtures carries a duplicate -- three copies of one fixture is not three representative fixtures (REQ-03)");

  // The event-level `evidence` field goes through path discipline for exactly this reason; the payload
  // TWIN did not, and accepted "../../../../etc/passwd", "/etc/shadow", "C:/Windows/System32" and
  // "~/.ssh/id_rsa". A traversal accepted today is a file read somewhere else tomorrow.
  // Written without a single backslash escape on purpose: three attempts to express this as a regex
  // literal through a shell heredoc produced a DIFFERENT broken character class each time, and a
  // guard that does not parse is a guard that does not run.
  const _sep = String.fromCharCode(92);
  const _first = p.evidence_path.charAt(0);
  const _segs = p.evidence_path.split("/").flatMap((x) => x.split(_sep));
  if (_first === "/" || _first === "~" || _first === _sep || /^[A-Za-z]:/.test(p.evidence_path) || _segs.includes(".."))
    bad(`evidence_path ${JSON.stringify(p.evidence_path)} must be a repo-relative path: no leading slash, no home expansion, no drive letter, no traversal segment`);

  // Every string in the profile, in ONE place, so a field added later cannot skip the check.
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "string" && hasControlChar(v))
      bad(`${k} carries a control character -- a raw newline forges a row in the owner's inbox and a C1 escape reaches the terminal`);
    if (Array.isArray(v))
      for (const item of v)
        if (typeof item === "string" && hasControlChar(item))
          bad(`${k} carries an entry with a control character -- a raw newline forges a row in the owner's inbox and a C1 escape reaches the terminal`);
  }
}

// A NEAR-MISS subject was validated by NOTHING: "absorb.ab-judgement " with a trailing space and
// "Absorb.AB-Judgement" both sailed through carrying a garbage candidate, leaky labels, one fixture
// and no commitment -- and then RENDERED in the inbox through the subject fallback, so they looked
// real. The repo's rule is that case-varied enum values are REFUSED, never normalized; a case variant
// being silently EXEMPT from the profile it imitates is worse than either.
// ---------------------------------------------------------------------------------------------
// ADR-0605's adoption-proposal profile. A SECOND subject on the same kind, same pattern as above.
//
// ADR-0605 line 41 requires: "The results table travels WITH the adoption proposal -- a proposal
// without its table is lint-invalid." That sentence had no implementation. A requirement written in an
// ADR and checked by nothing is a guard with no caller, which is the class this cycle has now hit four
// times -- and it was found while raising the very proposal the sentence governs.
//
// The table is carried IN the payload rather than as a path to it, which is stronger than what the ADR
// asked for and cheaper: a path can be validated for shape but not for content without filesystem I/O,
// and a spine validator must have no side effects. Numbers in the payload cannot rot away from the
// receipt, and the owner reads them at the moment of deciding rather than being asked to go and look.
export const ADOPTION_SUBJECT = "absorb.adoption";

const ADOPTION_REQUIRED = Object.freeze([
  "candidate",     // the registry row this proposes to move, T-NN
  "direction",     // adopt | retire -- REQ-07: nothing adopts itself, in EITHER direction
  "ab_decision",   // the ULID of the A/B pick this rests on
  "results",       // THE TABLE. An object of metric -> value. Absent or empty is lint-invalid.
  "recommendation",// the runner's honest recommendation, which the owner is free to overrule
  "evidence_path", // where the bundle lives
]);
const ADOPTION_ALLOWED = new Set(["subject", ...ADOPTION_REQUIRED]);
const DIRECTIONS = new Set(["adopt", "retire"]);
const ULID_LIKE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isAdoptionProposal(event) {
  return (
    event &&
    event.kind === "approval.requested" &&
    isPlainObject(event.payload) &&
    event.payload.subject === ADOPTION_SUBJECT
  );
}

export function assertAdoptionProposal(event) {
  const p = event.payload;
  const badA = (msg) => { throw new SpineError("BAD_ADOPTION_PROPOSAL", msg); };

  for (const k of Object.keys(p))
    if (!ADOPTION_ALLOWED.has(k))
      badA(`approval.requested subject "${ADOPTION_SUBJECT}" has unknown key "${k}" (shape is closed to subject|${ADOPTION_REQUIRED.join("|")})`);
  for (const k of ADOPTION_REQUIRED)
    if (!(k in p))
      badA(`approval.requested subject "${ADOPTION_SUBJECT}" is missing required key "${k}"`);

  if (typeof p.candidate !== "string" || !T_ID.test(p.candidate))
    badA(`candidate ${JSON.stringify(p.candidate)} is not a T-NN registry id`);
  if (typeof p.direction !== "string" || !DIRECTIONS.has(p.direction))
    badA(`direction ${JSON.stringify(p.direction)} is not adopt or retire -- REQ-07 routes both through the inbox, so the direction is part of the receipt`);
  if (typeof p.ab_decision !== "string" || !ULID_LIKE.test(p.ab_decision))
    badA(`ab_decision ${JSON.stringify(p.ab_decision)} is not a ULID -- a proposal that cannot name the A/B it rests on is a recommendation without evidence`);

  // THE TABLE. This is the whole point of the profile.
  if (!isPlainObject(p.results))
    badA(`results must be an object of metric -> value -- ADR-0605: the results table travels WITH the proposal`);
  const keys = Object.keys(p.results);
  if (keys.length === 0)
    badA(`results is empty -- an empty table satisfies "has a results field" while carrying no result, which is the shape the ADR forbids`);
  for (const k of keys) {
    const v = p.results[k];
    if (typeof v !== "string" && typeof v !== "number")
      badA(`results.${k} must be a string or number, got ${typeof v} -- a nested object hides a number behind a shape nobody reads`);
    if (typeof v === "string" && (v.trim() === "" || hasControlChar(v)))
      badA(`results.${k} is empty or carries a control character`);
  }

  if (typeof p.recommendation !== "string" || p.recommendation.trim() === "" || hasControlChar(p.recommendation))
    badA(`recommendation must be non-empty text with no control characters -- the owner overrules a stated position, not a blank`);
  if (typeof p.evidence_path !== "string" || p.evidence_path.trim() === "")
    badA(`evidence_path must be a non-empty path`);
  if (p.evidence_path.includes(String.fromCharCode(92)) || p.evidence_path.startsWith("/") ||
      /^[A-Za-z]:/.test(p.evidence_path) || p.evidence_path.split("/").includes(".."))
    badA(`evidence_path ${JSON.stringify(p.evidence_path)} must be a repo-relative forward-slash path with no traversal`);
}

export function isNearMissAbJudgement(event) {
  if (!event || event.kind !== "approval.requested") return false;
  const pl = event.payload;
  if (!isPlainObject(pl)) return false;
  const sub = pl.subject;
  if (typeof sub !== "string" || sub === AB_JUDGEMENT_SUBJECT) return false;
  return sub.trim().toLowerCase() === AB_JUDGEMENT_SUBJECT;
}

export function assertNotNearMiss(event) {
  bad(`subject ${JSON.stringify(event.payload.subject)} differs from "${AB_JUDGEMENT_SUBJECT}" only by case or whitespace -- refused rather than normalized, because a near-miss would otherwise be exempt from the profile it is imitating`);
}
