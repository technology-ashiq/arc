// The curated alias layer. ADR-0709.
//
// Pure: takes the file's text, returns a lookup. No I/O, so a fixture needs no filesystem.
//
// Expansion is ADDITIVE and that is a safety property, not a convenience: the searcher's own
// tokens are always kept, so a wrong alias can only ever degrade ranking and can never make a
// term unfindable. That is what makes a hand-maintained list an acceptable thing to depend on.
//
// The table is parsed with the SAME masked field splitting the organs use. It is a markdown table
// in a repo whose markdown tables carry code spans, and a raw split on the pipe is the exact
// defect Phase 00 spent a day closing. Applying it here rather than rediscovering it is the
// twin-fix rule -- a fix is not applied until it has been applied where it was never made.

import { tableCells, isSeparatorRow, normalize, fenceScanner, looksLikeRow } from "./fields.mjs";
import { tokenize } from "./tokenize.mjs";

export function parseAliases(text) {
  const lines = normalize(text).split("\n");
  const rows = [];
  const exclusions = [];
  const inFence = fenceScanner();

  for (const [i, line] of lines.entries()) {
    const lineNo = i + 1;
    const fenced = inFence(line);
    if (!looksLikeRow(line) || fenced) continue;
    if (isSeparatorRow(line)) continue;
    const cells = tableCells(line);
    if (!cells || cells.length !== 3) continue;
    if (cells[0] === "terms") continue; // the header

    const terms = tokenize(cells[0]);
    const expands = tokenize(cells[1]);
    if (terms.length === 0 || expands.length === 0) {
      exclusions.push({ kind: "malformed", line: lineNo, reason: "alias row with no usable terms or no expansion", text: line.trim().slice(0, 120) });
      continue;
    }
    rows.push({ line: lineNo, terms, expands, why: cells[2] });
  }
  return { rows, exclusions };
}

/**
 * Expand a token list. Returns the expanded tokens plus which rows fired, so the CLI can name the
 * alias in its footer -- an expansion nobody can see is an expansion nobody can correct.
 */
export function expand(tokens, rows) {
  const have = new Set(tokens);
  const out = [...tokens];
  const fired = [];
  for (const row of rows) {
    if (!row.terms.some((t) => have.has(t))) continue;
    const added = row.expands.filter((t) => !have.has(t));
    if (added.length === 0) continue;
    for (const t of added) { have.add(t); out.push(t); }
    fired.push({ terms: row.terms, added, why: row.why });
  }
  return { tokens: out, fired };
}
