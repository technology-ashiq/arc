// Tokenization and query sanitization for the canonical JS engine.
//
// ADR-0709: no stemming, no embeddings. A token is a run of letters/digits, lowercased, with
// diacritics folded — which is deliberately what SQLite's `unicode61` tokenizer does by default.
// Matching it is not cosmetic: Phase 2's equivalence gate (ADR-0701) asserts both engines return
// the SAME ordered ids, and two engines that disagree about what a word is cannot agree about
// anything downstream.
//
// Zero dependencies, Node >= 18.

// NFD then strip combining marks folds "é" to "e" the way unicode61 does with its default
// `remove_diacritics` setting.
// Strip every combining mark after NFD. `\p{M}` keeps this line pure ASCII: the earlier form
// embedded literal U+0300 and U+036F, which an editor renders as accents on the neighbouring
// bracket -- unreadable, and silently editable by anyone who touches the line.
const foldDiacritics = (s) => s.normalize("NFD").replace(/\p{M}/gu, "");

export function tokenize(text) {
  if (typeof text !== "string" || text === "") return [];
  // Split on anything that is not a letter or a digit, in ANY script -- `\p{L}` and `\p{N}`
  // rather than a-z0-9, so a lesson recorded with a non-ASCII word is still findable.
  return foldDiacritics(text.toLowerCase()).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Turn arbitrary user text into query tokens.
 *
 * "Sanitize" here means NEUTRALIZE, never DROP. `NEAR(a,b)`, `*`, `-foo` and boolean words are
 * made LITERAL — the searcher who typed `-i` was asking about the `sed -i` lesson, and a
 * sanitizer that deleted the token would silently answer a different question. The rabbit-hole
 * note in the phase spec is explicit about this, so every hostile fixture asserts both "did not
 * crash" and "returned the semantically expected rows".
 *
 * Note what this function does NOT need to do, and why that is stated rather than hidden: the
 * canonical engine has no query grammar at all, so there is no operator to escape and no parser
 * to crash. The phase spec predicted a RED where `he said "never` reaches the tokenizer raw and
 * throws; that red is not reproducible against this design, because a split-on-non-word
 * tokenizer cannot throw on unbalanced punctuation. Recorded in the phase notes rather than
 * faked. The real risks this guards are size and shape, below.
 */
// The NUL is written as an escape, never as a literal byte: a raw NUL in a source file breaks
// hashing, diffing and half the shell tooling that reads it.
const NUL = String.fromCharCode(0);

export const MAX_QUERY_BYTES = 4096;
export const MAX_TOKENS = 64;

export function sanitizeQuery(raw) {
  const notes = [];
  if (typeof raw !== "string") return { tokens: [], notes: ["query was not a string"] };

  // A NUL cannot survive process creation on either platform, so an argv-borne query can never
  // carry one -- but an internal caller can, and a lone NUL used to be a silent empty query.
  let text = raw;
  if (text.includes(NUL)) {
    text = text.split(NUL).join(" ");
    notes.push("NUL byte(s) replaced with spaces");
  }

  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_QUERY_BYTES) {
    // Truncate on a CODE POINT boundary, not a byte one, or the tail becomes invalid UTF-8.
    // Cut by BYTES, on a code-point boundary. The ceiling is checked with Buffer.byteLength and
    // used to be enforced with a code-POINT slice, so 3000 CJK characters were reported as
    // "truncated to 4096 bytes" while 8192 bytes were retained -- a printed number false by 2x in
    // a tool whose whole rule is that a number nobody can check is not evidence.
    let kept = "";
    let used = 0;
    for (const ch of text) {
      const w = Buffer.byteLength(ch, "utf8");
      if (used + w > MAX_QUERY_BYTES) break;
      kept += ch;
      used += w;
    }
    text = kept;
    notes.push(`query truncated from ${bytes} bytes to ${used} bytes (the ${MAX_QUERY_BYTES}-byte ceiling)`);
  }

  let tokens = tokenize(text);
  if (tokens.length > MAX_TOKENS) {
    notes.push(`query carried ${tokens.length} tokens; only the first ${MAX_TOKENS} are used`);
    tokens = tokens.slice(0, MAX_TOKENS);
  }
  return { tokens, notes };
}
