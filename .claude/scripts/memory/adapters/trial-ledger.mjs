// docs/trial-ledger.md -> records. Pure: no I/O, no spine, no globals.
//
// This is a genuine markdown table file, unlike retro-log.md -- and it holds SEVEN separate
// 5-column ledger tables (`date | gate | run-ref | fired? | false-positive?`) interleaved with
// three unrelated 3-column tables. 85 pipe rows in all, of which only the ledger DATA rows are
// evidence. Counting all 85 would index seven headers, ten separators and three unrelated
// tables as if they were recorded runs.
//
// The record rule is therefore narrow on purpose: five columns AND a leading ISO date. A header
// fails it on the date, a separator fails it on both, a 3-column table fails it on the count.
// Everything rejected is named with its line, so "nothing was excluded" and "exclusions were
// never checked" cannot look alike.

import { tableCells, isSeparatorRow, normalize } from "../lib/fields.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parse(text) {
  const lines = normalize(text).split("\n");
  const records = [];
  const exclusions = [];
  const ordinal = new Map();

  for (const [i, line] of lines.entries()) {
    const lineNo = i + 1;
    if (!line.trim().startsWith("|")) continue;

    if (isSeparatorRow(line)) {
      exclusions.push({ kind: "expected", line: lineNo, reason: "table separator row", text: line.trim() });
      continue;
    }

    const cells = tableCells(line);
    if (!cells) {
      exclusions.push({ kind: "malformed", line: lineNo, reason: "not a closed `| ... |` row", text: line.trim() });
      continue;
    }
    if (cells.length !== 5) {
      exclusions.push({
        kind: "expected",
        line: lineNo,
        reason: `non-ledger table row (${cells.length} columns, ledger is 5)`,
        text: line.trim().slice(0, 120),
      });
      continue;
    }
    if (!DATE.test(cells[0])) {
      exclusions.push({ kind: "expected", line: lineNo, reason: "ledger table header (column 1 is not a date)", text: line.trim() });
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
