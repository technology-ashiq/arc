// Field splitting for the pipe-separated company organs.
//
// ADR-0702. The one rule this file exists for: a `|` inside a markdown code span is DATA,
// not a separator. `docs/retro-log.md` carries exactly one such row today -- the 2026-08-02
// arc-model-policy lesson, whose prevention text contains `` `(?:^|\n)##` `` -- and a naive
// split reports it as a malformed 6-field row and walls off a genuine lesson. The count-verify
// cannot catch that, because an excluded row sits outside N_parsed. So the masking is not an
// optimisation; it is the difference between 54 lessons and 53 plus a lie.
//
// Masking replaces the span with spaces of the SAME length, so every offset survives, and the
// split then slices the ORIGINAL text at those offsets. Fields therefore come back verbatim,
// backticks and pipes included -- which is what ADR-0702 means by verbatim output.
//
// Zero dependencies, Node >= 18.

// A code span is a backtick run, its content, then a backtick run of the SAME length
// (CommonMark). Supporting only single backticks would mis-mask ``a | b`` and, worse,
// an UNCLOSED backtick would otherwise swallow the rest of the line.
const SPAN = /(`+)(?:[^`]|`(?!\1(?!`)))*?\1/g;

export function maskCodeSpans(line) {
  return line.replace(SPAN, (m) => " ".repeat(m.length));
}

/**
 * Split on unmasked pipes, returning slices of the ORIGINAL line.
 * `a | b | c` -> ["a ", " b ", " c"]   (callers trim; trimming here would lose verbatim-ness
 * for any field that legitimately begins or ends with whitespace inside a code span).
 */
export function splitFields(line) {
  const masked = maskCodeSpans(line);
  const out = [];
  let start = 0;
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === "|") {
      out.push(line.slice(start, i));
      start = i + 1;
    }
  }
  out.push(line.slice(start));
  return out;
}

/** Markdown table row -> its cells, with the leading/trailing pipe artefacts dropped. */
export function tableCells(line) {
  const parts = splitFields(line);
  if (parts.length >= 2 && parts[0].trim() === "" && parts[parts.length - 1].trim() === "") {
    return parts.slice(1, -1).map((c) => c.trim());
  }
  return null; // not a `| ... |` row
}

export const isSeparatorRow = (line) => /^\s*\|[\s:|-]+\|\s*$/.test(line);

/** LF everywhere and no BOM, so a Windows checkout and a Linux CI leg hash the same bytes. */
export function normalize(text) {
  return text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
