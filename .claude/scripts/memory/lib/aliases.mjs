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

  // Only the table under `## The rows` is the alias table. The file carries OTHER tables -- the
  // measurement recording why it is empty is itself made of pipe rows -- and parsing every table
  // in the file reported each of those as a malformed alias row. That is the same "asserting on
  // the wrong table" mistake this lane made once already today, in the test that checks this very
  // file. A parser with no section boundary has no way to be right about a document.
  const HEADING = /^##\s+The rows\s*$/;
  let start = lines.findIndex((l) => HEADING.test(l));
  if (start === -1) {
    return { rows, exclusions: [{ kind: "malformed", line: 1, reason: "no `## The rows` heading, so there is no alias table to read", text: "" }] };
  }

  for (const [i, line] of lines.entries()) {
    const lineNo = i + 1;
    const fenced = inFence(line); // scanned over the WHOLE file, so fence state is correct here
    if (i <= start) continue;
    if (/^##\s+/.test(line)) break; // the next section ends the table
    if (!looksLikeRow(line)) continue;
    // NAMED, not skipped. retro-log.mjs and trial-ledger.mjs both push an exclusion for exactly
    // these shapes; this file bare-continued on all of them, so a 4-cell or 2-cell alias row
    // vanished with no record and no diagnostic -- the same defect this lane spent Phase 00
    // closing, in the one file where the fix was never made.
    if (fenced) {
      exclusions.push({ kind: "expected", line: lineNo, reason: "pipe row inside a fenced code block (a documented example is not an alias)", text: line.trim().slice(0, 120) });
      continue;
    }
    if (isSeparatorRow(line)) continue;
    const cells = tableCells(line);
    if (!cells) {
      exclusions.push({ kind: "malformed", line: lineNo, reason: "carries a pipe but is not a closed | ... | row", text: line.trim().slice(0, 120) });
      continue;
    }
    if (cells[0] === "terms") continue; // the header
    if (cells.length !== 3) {
      exclusions.push({ kind: "malformed", line: lineNo, reason: `alias row has ${cells.length} columns; the table is 3 (terms | expands-to | why)`, text: line.trim().slice(0, 120) });
      continue;
    }

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
  // Iterate to a FIXED POINT, not a single forward pass. A single pass let one row fire on
  // another row's output only when it happened to sit below it in the file, so reordering two
  // rows -- a pure documentation edit -- silently changed ranked results. The bound makes the
  // loop terminate even on a pathological chain.
  const MAX_ROUNDS = 8;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let grew = false;
    for (const row of rows) {
      if (!row.terms.some((t) => have.has(t))) continue;
      const added = row.expands.filter((t) => !have.has(t));
      if (added.length === 0) continue;
      for (const t of added) { have.add(t); out.push(t); }
      fired.push({ terms: row.terms, added, why: row.why });
      grew = true;
    }
    if (!grew) break;
  }
  return { tokens: out, fired };
}
