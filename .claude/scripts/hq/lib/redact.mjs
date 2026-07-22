// Secret scanning at emit, fail-safe (ADR-0028).
//
// The spine is append-only and a closed day is immutable forever, so a secret that lands
// here can never be deleted -- only superseded, with the original bytes still on disk.
// That asymmetry is why this scanner refuses on a HIT and drops the payload on a FAILURE:
// a scanner bug must cost data, never leak it. It never fails open.
//
// Cosmetic-variant coverage (pre-mortem #5, council v3's class): the same text is scanned
// through several VIEWS, so a secret that is whitespace-varied, split across two fields, or
// base64-wrapped is still seen. Exact-match-on-one-view is how a scanner passes clean while
// missing the obvious.

import { SpineError } from "./canonical.mjs";

// Patterns are deliberately linear (no nested quantifiers over overlapping alternatives):
// a catastrophic-backtracking regex inside a fail-safe scanner turns every emit into a hang.
//
// Token-shaped rules carry NO \b. The corpus proved why: in the concatenated view a secret
// split across two fields lands between other values ("...note.loggedAKIA...EXAMPLEok..."),
// where a word boundary can never match -- so a \b-anchored rule reads as thorough while
// being structurally unable to fire on the exact view that exists to catch split secrets.
// These prefixes (AKIA, ghp_, sk-ant-, xox…) are distinctive enough to stand alone, and a
// credential embedded inside a longer blob is still a credential.
//
// Keyword rules KEEP \b: "notsecret=hunter2" is not a finding, and they cannot fire on the
// concatenated view anyway (the "=" lives in the syntax those views strip).
export const DENY_RULES = Object.freeze([
  { name: "aws-access-key-id", re: /AKIA[0-9A-Z]{16}/ },
  { name: "aws-secret-access-key", re: /\baws_secret_access_key\s*[:=]\s*['"]?[A-Za-z0-9/+]{40}/i },
  { name: "github-token", re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "anthropic-key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "openai-key", re: /sk-[A-Za-z0-9]{32,}/ },
  { name: "stripe-key", re: /sk_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { name: "slack-token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "google-api-key", re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "npm-token", re: /npm_[A-Za-z0-9]{36}/ },
  { name: "private-key-block", re: /-----BEGIN [A-Z ]{0,32}PRIVATE KEY-----/ },
  { name: "jwt", re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { name: "bearer-token", re: /\bbearer\s+[A-Za-z0-9._-]{16,}/i },
  { name: "generic-credential-assignment", re: /\b(?:api[_-]?key|secret|password|passwd|passphrase|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*['"]?[^\s'"]{8,}/i },
]);

const MAX_BASE64_CANDIDATES = 50;
const BASE64_RUN = /[A-Za-z0-9+/]{24,}={0,2}/g;

function collectStringValues(value, out) {
  if (typeof value === "string") { out.push(value); return; }
  if (Array.isArray(value)) { for (const v of value) collectStringValues(v, out); return; }
  if (value && typeof value === "object") { for (const k of Object.keys(value)) collectStringValues(value[k], out); }
}

// Each view is a different way the same secret could be hiding.
function buildViews(canonicalText, parsed) {
  const views = [];
  views.push(canonicalText);
  views.push(canonicalText.replace(/\s+/g, " "));
  views.push(canonicalText.replace(/\s+/g, ""));

  const strings = [];
  if (parsed !== undefined) collectStringValues(parsed, strings);
  const concatenated = strings.join("");
  if (concatenated) {
    views.push(concatenated);                          // catches secrets split across fields
    views.push(concatenated.replace(/\s+/g, ""));      // catches secrets split across lines
  }

  // base64-wrapped secrets: decode plausible runs and scan the plaintext.
  const seen = new Set();
  let decoded = 0;
  for (const view of [canonicalText, concatenated]) {
    if (!view) continue;
    for (const m of view.matchAll(BASE64_RUN)) {
      if (decoded >= MAX_BASE64_CANDIDATES) break;
      const run = m[0];
      if (seen.has(run)) continue;
      seen.add(run);
      decoded++;
      const text = Buffer.from(run, "base64").toString("utf8");
      if (text) views.push(text);
    }
  }
  return views;
}

/**
 * Returns { hit: false } when the text is clean, or { hit: true, rule } on a match.
 * Throws SpineError("REDACT_FAIL") if the scan itself could not complete -- the caller
 * must then drop the payload (never emit it unscanned).
 */
export function scanSecrets(canonicalText, parsed) {
  let views;
  try {
    views = buildViews(canonicalText, parsed);
  } catch (e) {
    throw new SpineError("REDACT_FAIL", `secret scan could not build its views: ${e.message}`);
  }
  try {
    for (const view of views)
      for (const rule of DENY_RULES)
        if (rule.re.test(view)) return { hit: true, rule: rule.name };
  } catch (e) {
    throw new SpineError("REDACT_FAIL", `secret scan failed: ${e.message}`);
  }
  return { hit: false };
}
