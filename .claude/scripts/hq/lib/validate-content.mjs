// validate-content.mjs — `content.published`, growth's one receipt (ADR-1101).
//
// A NEW module rather than an addition to validate.mjs, for the reason ADR-1101 gives: that file
// is a company organ three other LIVE lanes are editing this week, and a new module collides on
// exactly one line (the KINDS spread) instead of on a function body.
//
// TWO rules here carry the weight, and both were written by an adversarial pass rather than by
// the author:
//
//   1. The idem is a TOTAL preimage over every IDENTITY-BEARING field — and `pr_ref` is
//      deliberately NOT one of them. The first draft was `site|slug|content_sha` alone, which
//      reads like a total preimage and is not: a metadata-only correction (a wrong template_id
//      fixed, body bytes untouched) hashes identically to the original and is refused as
//      DUP_IDEM. That is the C2 loss class — ~100 receipts quarantined by a partial preimage —
//      reproduced inside the rule written to prevent it. `pr_ref` is excluded for the opposite
//      reason, the one `outreach.replied` records: it stamps OUR process, not the publication,
//      so including it would split one publication into two receipts whenever a PR is remade.
//
//   2. No field value may contain the join delimiter. Every grammar below excludes `|` by
//      construction, AND the preimage builder asserts it again — because a grammar loosened in
//      two years by someone who never read this file would otherwise make idem forgery possible:
//      site="a|b", slug="c" and site="a", slug="b|c" would hash to the same key, and the second
//      publication would vanish as a duplicate of the first.

import { SpineError, sha256Hex } from "./canonical.mjs";

export const CONTENT_KINDS = Object.freeze(["content.published"]);
const CONTENT_KIND_SET = new Set(CONTENT_KINDS);

export const isContentKind = (kind) => CONTENT_KIND_SET.has(kind);

// The delimiter is named ONCE. A second literal is a second thing to keep in sync, which is how
// the two-parsers-one-grammar class (D5) starts every time.
const DELIM = "|";

// A hostname, lowercase, no scheme, no port, no path. Excludes the delimiter by construction.
//
// EXPORTED since 2026-08-16. `cutover.mjs` had copied this pattern with a comment claiming "the
// test asserts the two agree" — no such test existed and none could be written, because neither
// copy was exported. A duplicated grammar with an imagined test guarding it is worse than an
// honest duplicate: it reads as covered. One grammar, imported, is the only version of this that
// stays true (A5).
export const SITE_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
// A URL slug. No leading/trailing hyphen, no underscores — this becomes a public path segment.
const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
// Machine dimensions, the same shape `metric.observed` uses for `surface` (validate-leads.mjs:85),
// so the A/B tag growth writes here and the surface evolve reads later share one grammar.
const TEMPLATE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
// `c-000` is RESERVED for pre-cluster content (the Phase 0 steel thread). The miner never mints
// it, so no real cluster can collide with it.
const CLUSTER_ID_RE = /^c-[0-9]{3,9}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const PR_REF_RE = /^#[1-9][0-9]{0,9}$/;

const MAX_TITLE_BYTES = 300;
// The published URL. `https` only: a receipt claiming an article is live must not be able to
// describe a plaintext one, and the string goes into the preimage verbatim.
const URL_RE = /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9._~\-/]*$/;

// A public article URL is NOT the "no raw URLs on the spine" case. That rule (ADR-0410, ADR-0400)
// exists because a URL DERIVED FROM A PERSON — a profile, a mailbox, a lead's site — is PII by
// another name on a repo headed public. The address of a document arc itself published is the
// opposite: it is public by construction and it is the entire point of the receipt. What is still
// refused here is anything that could carry a person: no query string, no fragment, no userinfo.

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

// Control characters are refused by CODE POINT, never normalized — normalizing is how a validator
// quietly becomes a suggestion. CR is in this range, which is what makes the CRLF fixture pass.
// C0 + DEL, and the invisible/bidi set ADR-1120 adds.
//
// The split is override-versus-mark and invisible-with-no-use versus invisible-with-a-use, NOT
// printing-versus-non-printing — that distinction looks principled and refuses correct titles in
// real languages. Returns the offending code point so the error can name it; an error that says
// only "an invisible character" is unactionable against a character you cannot see.
const INVISIBLE = new Map([
  [0x2028, "U+2028 LINE SEPARATOR"],
  [0x2029, "U+2029 PARAGRAPH SEPARATOR"],
  [0xfeff, "U+FEFF ZERO WIDTH NO-BREAK SPACE (BOM)"],
  [0x200b, "U+200B ZERO WIDTH SPACE"],
]);

// DELIBERATELY ABSENT, and each for a reason that would be a regression to forget:
//   U+200D ZWJ  — composes emoji sequences; refusing it rejects a family or a composed flag.
//   U+200C ZWNJ — required orthography in Persian, Hindi and others.
//   U+200E/200F — bidi MARKS, not overrides: they nudge the algorithm toward correct display of
//                 mixed-direction text rather than reversing it.
const badCodePoint = (s) => {
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x20 || c === 0x7f) return `an ASCII control character (U+${c.toString(16).toUpperCase().padStart(4, "0")})`;
    // C1: NEL, CSI and friends. Terminal escape territory, no textual meaning.
    if (c >= 0x80 && c <= 0x9f) return `a C1 control character (U+${c.toString(16).toUpperCase().padStart(4, "0")})`;
    // Bidi embeddings, overrides and isolates. U+202E is the spoofing vector: it reverses
    // rendering order, so a published headline can display as something other than what it says.
    if ((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069))
      return `a bidi override/isolate (U+${c.toString(16).toUpperCase().padStart(4, "0")}) — it changes how the title RENDERS versus what it says`;
    const named = INVISIBLE.get(c);
    if (named) return named;
  }
  return null;
};

const hasControlChar = (s) => badCodePoint(s) !== null;

// A lone surrogate — half of a pair, with no partner. Found by an adversarial pass 2026-08-16, and
// it is an IDEM COLLISION, which is the one failure this file's header claims to have closed.
//
// The preimage is joined as a STRING and then hashed as BYTES, and that map is not injective:
// `Buffer.from(s, "utf8")` encodes every lone surrogate to EF BF BD, the same three bytes as
// U+FFFD. So `title` ending in a lone surrogate and the same title ending in U+FFFD are different
// strings, produce different event shas, and hash to ONE idem — the second is dropped as DUP_IDEM.
// The `|` delimiter defence operates on the string and cannot see this, because the loss happens
// one layer down at the encode.
//
// It is reachable without an attacker: any `title.slice(0, N)` landing mid-pair in an emoji title
// produces one, and JSON round-trips it intact, so the value survives being read back off a spine
// file. Refused here rather than normalized — normalizing is how a validator becomes a suggestion,
// and silently rewriting a title would change the very bytes the idem is taken over.
//
// Written by hand rather than with String.prototype.isWellFormed, which is Node 20+; the CI matrix
// still runs an 18 leg, where that method is undefined and the guard would silently never fire.
const hasLoneSurrogate = (s) => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true;
    }
  }
  return false;
};

const SHAPE = Object.freeze({
  "content.published": Object.freeze({
    required: Object.freeze(["site", "slug", "url", "title", "template_id", "cluster_id", "content_sha", "pr_ref"]),
    optional: Object.freeze([]),
  }),
});

// The fields the idem is taken over, in a FIXED order. `pr_ref` is absent by decision, not by
// oversight — see the header. Anything added to the payload must be added here too, or the next
// metadata-only correction is silently dropped.
const IDEM_FIELDS = Object.freeze(["site", "slug", "content_sha", "title", "template_id", "cluster_id", "url"]);

export function contentIdem(kind, p) {
  if (!isContentKind(kind))
    throw new SpineError("UNKNOWN_KIND", `contentIdem called with non-content kind ${JSON.stringify(kind)}`);
  const parts = [kind];
  for (const f of IDEM_FIELDS) {
    const v = p?.[f];
    if (typeof v !== "string")
      throw new SpineError("BAD_CONTENT", `${kind}.${f} must be a string before an idem can be derived`);
    // Defence in depth over the grammars above. A future loosening of any one of them must not
    // silently make two different publications share a key.
    if (v.includes(DELIM))
      throw new SpineError("BAD_CONTENT", `${kind}.${f} may not contain ${JSON.stringify(DELIM)} — it is the idem join delimiter, and a value carrying it can forge another receipt's key`);
    // Asserted HERE as well as in assertContent, because this function is exported and the emitter
    // derives idems through it. A guard that lives only in the validator protects only the callers
    // that happen to validate first.
    if (hasLoneSurrogate(v))
      throw new SpineError("BAD_CONTENT", `${kind}.${f} contains a lone surrogate — it encodes to the same UTF-8 bytes as U+FFFD, so two different values would share one idem and the second would be dropped as DUP_IDEM`);
    parts.push(v);
  }
  return sha256Hex(parts.join(DELIM));
}

export function assertContent(event) {
  const kind = event.kind;
  const p = event.payload;
  const shape = SHAPE[kind];
  if (!shape) throw new SpineError("UNKNOWN_KIND", `assertContent called with non-content kind ${JSON.stringify(kind)}`);

  if (!isPlainObject(p)) throw new SpineError("BAD_CONTENT", `${kind} payload must be an object`);

  const allowed = new Set([...shape.required, ...shape.optional]);
  for (const k of Object.keys(p))
    if (!allowed.has(k))
      throw new SpineError("BAD_CONTENT", `${kind} payload has unknown key ${JSON.stringify(k)} (closed to ${[...allowed].join("|")})`);
  for (const k of shape.required)
    if (!Object.prototype.hasOwnProperty.call(p, k))
      throw new SpineError("BAD_CONTENT", `${kind} payload is missing ${JSON.stringify(k)} (own property; the prototype chain does not count)`);

  for (const [k, v] of Object.entries(p)) {
    if (typeof v !== "string")
      throw new SpineError("BAD_CONTENT", `${kind}.${k} must be a string`);
    const bad = badCodePoint(v);
    if (bad)
      throw new SpineError("BAD_CONTENT",
        `${kind}.${k} carries ${bad} — refused by code point, never stripped. ${kind}.title is the one free-form field in the idem preimage, so an invisible character makes two identical-looking titles into two different facts (ADR-1120)`);
    if (hasLoneSurrogate(v))
      throw new SpineError("BAD_CONTENT", `${kind}.${k} contains a lone surrogate — it encodes to the same UTF-8 bytes as U+FFFD, so two different values would share one idem and the second would be dropped as DUP_IDEM`);
  }

  if (!SITE_RE.test(p.site))
    throw new SpineError("BAD_CONTENT", `${kind}.site must be a bare lowercase hostname — no scheme, no port, no path`);
  if (!SLUG_RE.test(p.slug))
    throw new SpineError("BAD_CONTENT", `${kind}.slug must be lowercase [a-z0-9-] with no leading or trailing hyphen`);
  if (!URL_RE.test(p.url))
    throw new SpineError("BAD_CONTENT", `${kind}.url must be an https URL with no query, fragment or userinfo`);
  // The url must actually belong to the site it claims. Without this the two fields can disagree
  // and the receipt describes a page nobody can find.
  if (!p.url.startsWith(`https://${p.site}/`))
    throw new SpineError("BAD_CONTENT", `${kind}.url must be under https://${p.site}/ — url and site disagree, so the receipt points at a page this site never served`);
  if (p.title.length === 0 || Buffer.byteLength(p.title, "utf8") > MAX_TITLE_BYTES)
    throw new SpineError("BAD_CONTENT", `${kind}.title must be 1..${MAX_TITLE_BYTES} bytes`);
  if (!TEMPLATE_ID_RE.test(p.template_id))
    throw new SpineError("BAD_CONTENT", `${kind}.template_id must be a lowercase machine dimension`);
  if (!CLUSTER_ID_RE.test(p.cluster_id))
    throw new SpineError("BAD_CONTENT", `${kind}.cluster_id must look like c-000`);
  if (!SHA256_RE.test(p.content_sha))
    throw new SpineError("BAD_CONTENT", `${kind}.content_sha must be lowercase hex sha256 of the published MDX bytes`);
  if (!PR_REF_RE.test(p.pr_ref))
    throw new SpineError("BAD_CONTENT", `${kind}.pr_ref must look like #12`);

  // Bind the idem to the payload LAST, so a malformed field reports its own error first.
  // Why bind at all (the decision.recorded / leads precedent): the emit path honours a
  // caller-supplied --idem, so without this a decoy payload could pre-claim the stable key of a
  // real receipt, and the real one would then be lost to DUP_IDEM.
  const expected = contentIdem(kind, p);
  if (event.idem !== expected)
    throw new SpineError("BAD_CONTENT", `${kind}.idem must be the total preimage over its identity-bearing fields (ADR-1101) — ${IDEM_FIELDS.join(", ")}, and never pr_ref`);
}
