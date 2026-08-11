// docs/retro-log.md -> records. Pure: no I/O, no spine, no globals.
//
// Format (from the file's own header): `YYYY-MM-DD | project | pattern | prevention | tags`,
// bare pipe-separated lines -- NOT a markdown table. A second shape shares the file: the
// 9-field per-cycle scoreboard rows, which are excluded by name, never coerced into lessons.
//
// Both shapes are recognised by FIELD COUNT AFTER MASKING, per ADR-0702. Any leading-date row
// that is neither 5 nor 9 fields is a NAMED exclusion carrying its line number -- an unknown
// shape is reported, never silently dropped and never bent into the nearest known shape.

import { splitFields, normalize } from "../lib/fields.mjs";

const ROW = /^\d{4}-\d{2}-\d{2}\s*\|/;

export function parse(text) {
  const lines = normalize(text).split("\n");
  const records = [];
  const exclusions = [];
  const ordinal = new Map(); // date -> count of PATTERN rows so far, which is the id ordinal

  for (const [i, line] of lines.entries()) {
    const lineNo = i + 1;
    if (!ROW.test(line)) continue;
    const f = splitFields(line).map((s) => s.trim());

    if (f.length === 9) {
      exclusions.push({ kind: "expected", line: lineNo, reason: "scoreboard row (9 fields)", text: line });
      continue;
    }
    if (f.length !== 5) {
      exclusions.push({ kind: "malformed", line: lineNo, reason: `unknown shape (${f.length} fields after masking)`, text: line });
      continue;
    }

    const [date, project, pattern, prevention, tagField] = f;
    const n = (ordinal.get(date) ?? 0) + 1;
    ordinal.set(date, n);

    records.push({
      id: `retro:${date}#${n}`,
      organ: "retro-log",
      line: lineNo,
      title: pattern,
      // prevention first: ADR-0702 orders output prevention-first, and putting it first in the
      // body is what makes a truncated render still carry the actionable half.
      body: `${prevention}\n${pattern}`,
      tags: tagField ? tagField.split(",").map((t) => t.trim()).filter(Boolean) : [],
      fields: { date, project, pattern, prevention },
    });
  }

  return { records, exclusions };
}
