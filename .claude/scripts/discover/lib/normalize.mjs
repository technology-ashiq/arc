// discover/normalize -- hostile web text in, inert data out (PLAN non-negotiable: parser-class).
//
// Nothing here ever reaches a shell or an eval: the output is a JS string that later writers
// serialize. What this layer guarantees is that the string is well-formed, bounded and carries no
// control or format characters, so a title cannot smuggle a newline into a YAML comment, a bidi
// override into a shortlist, or a megabyte into a cluster file.

export const ABSENT = "ABSENT";
export const MAX_TITLE_BYTES = 512;
export const MAX_TEXT_BYTES = 4096;

const encoder = new TextEncoder();

/** Truncate to at most `maxBytes` of UTF-8 without splitting a code point. */
function capBytes(s, maxBytes) {
  if (encoder.encode(s).length <= maxBytes) return s;
  let out = "";
  let used = 0;
  for (const ch of s) {
    const n = encoder.encode(ch).length;
    if (used + n > maxBytes) break;
    out += ch;
    used += n;
  }
  return out;
}

/**
 * Any value -> a single-line, NFC, well-formed, bounded string; `ABSENT` when nothing is left.
 * Control (Cc) and format (Cf: bidi overrides, zero-width, BOM) characters become one space.
 */
export function normalizeText(value, maxBytes = MAX_TEXT_BYTES) {
  if (value === null || value === undefined) return ABSENT;
  let s = typeof value === "string" ? value : String(value);
  // Lone surrogates first: NFC and the encoder both assume a well-formed string.
  s = s.toWellFormed();
  s = s.normalize("NFC");
  s = s.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, " ").replace(/\s+/g, " ").trim();
  s = capBytes(s, maxBytes).trim();
  return s === "" ? ABSENT : s;
}

/** A non-negative safe integer, or `ABSENT` -- never 0 for a missing number, never NaN. */
export function normalizeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : ABSENT;
}
