// docs/trial-ledger.md -> records. Pure: no I/O, no spine, no globals.
//
// A genuine markdown table file, unlike retro-log.md -- and it holds SEVEN separate 5-column
// ledger tables (`date | gate | run-ref | fired? | false-positive?`) interleaved with three
// unrelated 3-column tables. 85 pipe rows in all, of which 49 are evidence. Counting all 85 would
// index seven headers, ten separators and three unrelated tables as recorded runs.
//
// The record rule is narrow on purpose: five columns AND a leading ISO date. A header fails on
// the date, a separator on both, a 3-column table on the count.
//
// Two things the adversarial pass changed. First, candidate accounting: a piped line that is not
// a closed `| ... |` row used to be skipped entirely, so a row that had lost its leading pipe
// disappeared with no record and no exclusion. Second, this adapter used to file everything it
// did not understand under `expected` while retro-log filed the same situation under `malformed`
// -- two adapters, opposite defaults, and only one of them raising an eyebrow. Unknown is
// `malformed` in both now; only the three shapes this file genuinely contains are `expected`.

import { tableCells, isSeparatorRow, normalize, fenceScanner, looksLikeRow, hasBalancedTicks, splitFields } from "../lib/fields.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parse(text) {
  const lines = normalize(text).split("\n");
  const records = [];
  const exclusions = [];
  const ordinal = new Map();
  const inFence = fenceScanner();

  for (const [i, line] of lines.entries()) {
    const lineNo = i + 1;
    const fenced = inFence(line);
    if (!looksLikeRow(line)) continue;

    if (fenced) {
      exclusions.push({ kind: "expected", line: lineNo, reason: "pipe row inside a fenced code block (a documented example is not a recorded run)", text: line.trim().slice(0, 120) });
      continue;
    }
    if (!hasBalancedTicks(line)) {
      exclusions.push({ kind: "malformed", line: lineNo, reason: "odd number of backticks -- an unclosed code span makes the column split unreliable", text: line.trim().slice(0, 120) });
      continue;
    }
    if (isSeparatorRow(line)) {
      exclusions.push({ kind: "expected", line: lineNo, reason: "table separator row", text: line.trim() });
      continue;
    }

    const cells = tableCells(line);
    if (!cells) {
      exclusions.push({ kind: "malformed", line: lineNo, reason: `carries ${splitFields(line).length - 1} unmasked pipe(s) but is not a closed | ... | row`, text: line.trim().slice(0, 120) });
      continue;
    }
    if (cells.length === 3) {
      exclusions.push({ kind: "expected", line: lineNo, reason: "row of one of the three unrelated 3-column tables", text: line.trim().slice(0, 120) });
      continue;
    }
    if (cells.length !== 5) {
      exclusions.push({ kind: "malformed", line: lineNo, reason: `unknown shape (${cells.length} columns; the ledger is 5 and the side tables are 3)`, text: line.trim().slice(0, 120) });
      continue;
    }
    if (cells[0] === "date") {
      exclusions.push({ kind: "expected", line: lineNo, reason: "ledger table header", text: line.trim() });
      continue;
    }
    if (!DATE.test(cells[0])) {
      // NOT `expected`. A 5-column ledger-shaped row whose first cell is neither the literal
      // header word nor a date is a real anomaly -- a one-digit day, a date wrapped in a code
      // span -- and it used to be filed under "table header", a reason that was simply untrue.
      exclusions.push({ kind: "malformed", line: lineNo, reason: `ledger-shaped row whose first column ${JSON.stringify(cells[0].slice(0, 40))} is neither the header word nor a YYYY-MM-DD date`, text: line.trim().slice(0, 120) });
      continue;
    }

    const [date, gate, runRef, fired, falsePositive] = cells;
    const n = (ordinal.get(date) ?? 0) + 1;
    ordinal.set(date, n);

    records.push({
      id: `trial:${date}#${n}`,
      organ: "trial-ledger",
      line: lineNo,
      title: `${gate} — ${fired}`,
      body: `${gate}\n${runRef}\nfired: ${fired}\nfalse-positive: ${falsePositive}`,
      tags: ["trial-gate", "gate"],
      fields: { date, gate, runRef, fired, falsePositive },
    });
  }

  return { records, exclusions };
}
