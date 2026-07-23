// Secret scanning at emit, fail-safe (ADR-0028).
//
// The spine is append-only and a closed day is immutable forever, so a secret that lands
// here can never be deleted -- only superseded, with the original bytes still on disk.
// That asymmetry is why this scanner refuses on a HIT and drops the payload on a FAILURE:
// a scanner bug must cost data, never leak it. It never fails open.
//
// Two layers, because they fail differently:
//   1. STRUCTURAL -- walk the parsed object and look at what the KEYS say they hold. This
//      is what catches {"password":"..."}, the shape a real hook payload or config dump
//      actually has, and which no text rule written for "key = value" prose ever matched.
//   2. TEXTUAL -- run deny rules over several VIEWS of the same text, so a secret that is
//      whitespace-varied, zero-width-split, reordered, or base64-wrapped is still seen.
//
// Everything here was rewritten after the Phase-0 adversarial pass confirmed each of those
// evasions against the first version (docs/evidence/phase-00/adversarial-report.md).

import { SpineError, MAX_DEPTH } from "./canonical.mjs";

// ---------- layer 1: structural ----------
// Key segments that announce the value is a credential. Matched on SEGMENTS (split on
// separators and camelCase), never as a bare substring: "tokenizer" and "tokens_in" are
// not credentials, but DB_PASSWORD and stripeSecretKey are.
const CREDENTIAL_SEGMENTS = new Set([
  "password", "passwd", "passphrase", "secret", "token", "credential", "credentials",
  "apikey", "privatekey", "accesstoken", "authtoken", "refreshtoken", "clientsecret",
  "sessiontoken", "secretkey", "signingkey",
]);
const MIN_CREDENTIAL_VALUE_LEN = 6;

function keySegments(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase -> two segments
    .split(/[\s._\-/]+/)
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

function keyLooksLikeCredential(key) {
  const segs = keySegments(key);
  for (const s of segs) if (CREDENTIAL_SEGMENTS.has(s)) return true;
  for (let i = 0; i + 1 < segs.length; i++)
    if (CREDENTIAL_SEGMENTS.has(segs[i] + segs[i + 1])) return true; // api+key, secret+key
  return false;
}

function scanStructural(value, depth = 0) {
  if (depth > MAX_DEPTH) throw new SpineError("REDACT_FAIL", "structural scan hit the depth ceiling");
  if (Array.isArray(value)) {
    for (const v of value) { const hit = scanStructural(v, depth + 1); if (hit) return hit; }
    return null;
  }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) {
      const v = value[k];
      if (typeof v === "string" && v.trim().length >= MIN_CREDENTIAL_VALUE_LEN && keyLooksLikeCredential(k))
        return `credential-shaped field "${k}"`;
      const hit = scanStructural(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

// ---------- layer 2: textual ----------
// Token-shaped rules carry NO \b. The corpus proved why: in the concatenated view a secret
// split across two fields lands between other values ("...note.loggedAKIA...EXAMPLEok..."),
// where a word boundary can never match -- so a \b-anchored rule reads as thorough while
// being structurally unable to fire on the exact view that exists to catch split secrets.
//
// Every quantifier is BOUNDED. An unbounded one here is not a style question: the jwt rule
// with `{8,}` took 32 seconds on a 60 KB payload, which in hook mode is a stalled session.
export const DENY_RULES = Object.freeze([
  { name: "aws-access-key-id", re: /AKIA[0-9A-Z]{16}/ },
  { name: "aws-secret-access-key", re: /\baws_secret_access_key\s{0,8}[:=]\s{0,8}['"]?[A-Za-z0-9/+]{40}/i },
  { name: "github-token", re: /gh[pousr]_[A-Za-z0-9]{36,255}/ },
  { name: "github-fine-grained-pat", re: /github_pat_[A-Za-z0-9_]{22,255}/ },
  { name: "anthropic-key", re: /sk-ant-[A-Za-z0-9_-]{20,255}/ },
  { name: "openai-key", re: /sk-(?:proj-)?[A-Za-z0-9_-]{32,255}/ },
  { name: "stripe-key", re: /sk_(?:live|test)_[A-Za-z0-9]{16,255}/ },
  { name: "slack-token", re: /xox[baprs]-[A-Za-z0-9-]{10,255}/ },
  { name: "google-api-key", re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "npm-token", re: /npm_[A-Za-z0-9]{36}/ },
  { name: "private-key-block", re: /-----BEGIN [A-Z ]{0,32}PRIVATE KEY-----/ },
  { name: "connection-string-password", re: /[a-z][a-z0-9+.-]{1,32}:\/\/[^\s:/@]{1,64}:[^\s:/@]{6,64}@/i },
  { name: "bearer-token", re: /\bbearer\s{1,8}[A-Za-z0-9._-]{16,512}/i },
  { name: "generic-credential-assignment", re: /\b(?:api[_-]?key|secret|password|passwd|passphrase|access[_-]?token|auth[_-]?token)\b['"]?\s{0,8}[:=]\s{0,8}['"]?[^\s'"]{8,512}/i },
]);

// Linear, backtracking-free JWT detection. A regex for this shape is a ReDoS waiting to
// happen; walking it costs one pass and cannot blow up.
const B64URL = /[A-Za-z0-9_-]/;
const MAX_JWT_STARTS = 256;
function hasJwt(view) {
  let from = 0;
  for (let starts = 0; starts < MAX_JWT_STARTS; starts++) {
    const idx = view.indexOf("eyJ", from);
    if (idx === -1) return false;
    let p = idx;
    const segment = () => { const s = p; while (p < view.length && B64URL.test(view[p])) p++; return p - s; };
    if (segment() >= 8 && view[p] === ".") {
      p++;
      if (segment() >= 8 && view[p] === ".") {
        p++;
        if (segment() >= 8) return true;
      }
    }
    from = idx + 1;
  }
  return false;
}

const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;
const MAX_BASE64_CANDIDATES = 200;
const BASE64_RUN = /[A-Za-z0-9+/]{24,4096}={0,2}/g;

function collectStringValues(value, out, depth = 0) {
  if (depth > MAX_DEPTH) throw new SpineError("REDACT_FAIL", "string collection hit the depth ceiling");
  if (typeof value === "string") { out.push(value); return; }
  if (Array.isArray(value)) { for (const v of value) collectStringValues(v, out, depth + 1); return; }
  if (value && typeof value === "object")
    for (const k of Object.keys(value)) collectStringValues(value[k], out, depth + 1);
}

// Each view is a different way the same secret could be hiding.
function buildViews(canonicalText, parsed) {
  const views = [canonicalText];
  const stripZw = (s) => s.replace(ZERO_WIDTH, "");

  views.push(canonicalText.replace(/\s+/g, " "));
  views.push(canonicalText.replace(/\s+/g, ""));
  views.push(stripZw(canonicalText));
  views.push(stripZw(canonicalText).replace(/\s+/g, ""));

  const strings = [];
  if (parsed !== undefined) collectStringValues(parsed, strings);
  if (strings.length) {
    // Adjacency in ONE order is not adjacency: swapping two fields defeated the original
    // single concatenation, so join in several orders.
    const orders = [strings, [...strings].reverse(), [...strings].sort()];
    for (const order of orders) {
      const joined = order.join("");
      views.push(joined);
      views.push(stripZw(joined).replace(/\s+/g, ""));
    }
  }

  // base64-wrapped secrets: decode plausible runs and scan the plaintext.
  const seen = new Set();
  let decoded = 0;
  for (const view of views.slice(0, 4)) {
    for (const m of view.matchAll(BASE64_RUN)) {
      const run = m[0];
      if (seen.has(run)) continue;
      seen.add(run);
      if (++decoded > MAX_BASE64_CANDIDATES)
        // Silently skipping the rest would turn a padded payload into a clean bill of
        // health -- exactly the fail-open this scanner exists to prevent.
        throw new SpineError("REDACT_FAIL", "too many base64 candidates to scan exhaustively");
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
    const structural = scanStructural(parsed);
    if (structural) return { hit: true, rule: structural };
    views = buildViews(canonicalText, parsed);
  } catch (e) {
    if (e instanceof SpineError && e.code === "REDACT_FAIL") throw e;
    throw new SpineError("REDACT_FAIL", `secret scan could not build its views: ${e.message}`);
  }
  try {
    for (const view of views) {
      if (hasJwt(view)) return { hit: true, rule: "jwt" };
      for (const rule of DENY_RULES) if (rule.re.test(view)) return { hit: true, rule: rule.name };
    }
  } catch (e) {
    throw new SpineError("REDACT_FAIL", `secret scan failed: ${e.message}`);
  }
  return { hit: false };
}
