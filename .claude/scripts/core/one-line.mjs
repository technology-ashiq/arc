// one-line.mjs -- the ONE definition of "one line of text" (face v2 Phase 05, ADR-1340; the class the work door
// refuses in every text field, and every tool the door runs refuses the same way).
//
// Refused: every control character (C0, DEL, C1 -- CR, LF, NUL, ESC, tab), the Unicode line and paragraph separators,
// a lone surrogate, and every invisible FORMAT character (the bidi embeddings, overrides, isolates and marks, soft
// hyphen, zero-width space, word joiner, BOM, the tag block) -- each renders as nothing, or as text nobody wrote. ZWNJ
// and ZWJ stay: they join emoji and the letters of several scripts, and render as nothing but the join they make.
// Written as escapes on purpose: an invisible character in source is the thing this file exists to refuse.

/** The refused class, as regex source (use with the u flag). */
export const ONE_LINE_BAD_SRC = "[\\p{Cc}\\p{Cs}\\u2028\\u2029]|(?![\\u200C\\u200D])\\p{Cf}";
/** One or more characters, none refused, as regex source. */
export const ONE_LINE_SRC = `(?:(?!${ONE_LINE_BAD_SRC})[\\s\\S])+`;
const BAD = new RegExp(ONE_LINE_BAD_SRC, "u");
const WHOLE = new RegExp(`^${ONE_LINE_SRC}$`, "u");

/** Whether s is one non-empty line of text with nothing refused in it. @param {unknown} s */
export const isOneLine = (s) => typeof s === "string" && WHOLE.test(s);
/** The first refused character in s, or null. @param {string} s */
export function firstRefused(s) { const m = BAD.exec(String(s)); return m ? m[0] : null; }
