// Field splitting for the pipe-separated company organs.
//
// ADR-0702. The one rule this file exists for: a `|` inside a markdown code span is DATA, not a
// separator. `docs/retro-log.md` carries exactly one such row today -- the 2026-08-02
// arc-model-policy lesson, whose prevention text contains a pipe inside a code span -- and a naive
// split reports it as a malformed 6-field row and walls off a genuine lesson. The count-verify
// cannot catch that, because an excluded row sits outside N_parsed. So the masking is not an
// optimisation; it is the difference between 54 lessons and 53 plus a lie.
//
// Masking replaces the span with spaces of the SAME length, so every offset survives, and the
// split then slices the ORIGINAL text at those offsets. Fields come back verbatim, backticks and
// pipes included -- which is what ADR-0702 means by verbatim output.
//
// Hardened by the Phase-00 adversarial passes. Three of the additions matter more than the
// original rule:
//   - `hasBalancedTicks`, because masking is controllable from INSIDE a cell: one stray backtick
//     merges four separators and turns a 9-field scoreboard row into a 5-field "lesson" with its
//     cells scrambled. An odd tick count means the mask cannot be trusted, so the row is refused
//     rather than reshaped.
//   - `splitFields` is now used for EVERY delimiter, not just the pipe. The tag list was still
//     doing a raw `split(",")` one line below the masked pipe split -- the twin-fix shape this
//     lane's own pre-mortem named, sitting in the file next door to the fix.
//   - `fenceScanner`, because these organs are markdown written by this repo ABOUT its own
//     formats. A documented example row inside a fenced block is not evidence.
//
// Zero dependencies, Node >= 18.

// A code span is a backtick run, its content, then a run of the SAME length (CommonMark).
// Supporting only single backticks would mis-mask ``a | b``, and an UNCLOSED backtick would
// otherwise swallow the rest of the line.
const SPAN = /(`+)(?:[^`]|`(?!\1(?!`)))*?\1/g;

export function maskCodeSpans(line) {
  return line.replace(SPAN, (m) => " ".repeat(m.length));
}

/** An odd number of backticks means at least one span is unclosed, so the mask is a guess. */
export const hasBalancedTicks = (line) => ((line.match(/`/g) || []).length % 2) === 0;

/**
 * Split on unmasked occurrences of `delim`, returning slices of the ORIGINAL line.
 * `a | b | c` -> ["a ", " b ", " c"]. Callers trim; trimming here would lose verbatim-ness for
 * a field that legitimately begins or ends with whitespace inside a code span.
 */
export function splitFields(line, delim = "|") {
  const masked = maskCodeSpans(line);
  const out = [];
  let start = 0;
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === delim) {
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

/** True when the line still holds a delimiter once code spans are masked out. */
export const looksLikeRow = (line, delim = "|") => maskCodeSpans(line).includes(delim);

/**
 * Stateful fenced-code-block tracker. Call once per line, in order; it returns true while the
 * line is inside a fence (the fence markers themselves count as inside).
 */
export function fenceScanner() {
  let open = null;
  return (line) => {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (open === null) {
      if (m) { open = m[1][0]; return true; }
      return false;
    }
    if (m && m[1][0] === open) { open = null; return true; }
    return true;
  };
}

/**
 * LF everywhere and no BOM, so a Windows checkout and a Linux CI leg hash the same bytes.
 * A UTF-16 BOM is REFUSED rather than normalised: PowerShell 5.1 writes UTF-16LE by default, and
 * `readFileSync(p, "utf8")` on those bytes yields NUL-interleaved mojibake in which every row
 * quietly stops matching -- an organ that reads as empty, with no error and no exclusion.
 */
export function normalize(text) {
  return text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function assertDecodable(buf, where) {
  if (buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff)))
    throw new Error(`${where}: UTF-16 byte-order mark -- the organs are UTF-8. Read as UTF-8 this file decodes to mojibake in which every row silently stops matching`);
  if (buf.includes(0x00))
    throw new Error(`${where}: NUL byte at offset ${buf.indexOf(0x00)} -- not a UTF-8 text organ`);
}
