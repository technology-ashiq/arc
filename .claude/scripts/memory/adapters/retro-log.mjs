// docs/retro-log.md -> records. Pure: no I/O, no spine, no globals.
//
// Format (from the file's own header): `YYYY-MM-DD | project | pattern | prevention | tags`, bare
// pipe-separated lines -- NOT a markdown table. A second shape shares the file: the 9-field
// per-cycle scoreboard rows, excluded by name, never coerced into lessons.
//
// CANDIDATE ACCOUNTING is the load-bearing rule, and it is what the first version got wrong. The
// leading-date regex used to be a FILTER: anything it did not match was skipped with no record
// and no exclusion. So `2026-08-02 \| arc | ...` (markdown's own pipe escape), a row with one
// leading space, a row written as a table, and `2026-8-11` (one-digit day) each vanished
// completely -- 53 records, zero exclusions, exit 0, `N_parsed == N_indexed` perfectly true. That
// is precisely the "54 lessons, or 53 plus a lie" this file exists to prevent, reached by a route
// the masking rule does not cover.
//
// So now: any line that still carries a pipe after masking is a CANDIDATE, and every candidate is
// either indexed or NAMED. Measured against the live organ, that costs nothing -- zero orphan
// lines, zero fenced pipe rows, zero odd-backtick rows.

import { splitFields, normalize, fenceScanner, looksLikeRow, hasBalancedTicks } from "../lib/fields.mjs";

const ROW = /^\d{4}-\d{2}-\d{2}\s*\|/;

export function parse(text) {
  const lines = normalize(text).split("\n");
  const records = [];
  const exclusions = [];
  const ordinal = new Map(); // date -> count of PATTERN rows so far, which is the id ordinal
  const inFence = fenceScanner();

  for (const [i, line] of lines.entries()) {
    const lineNo = i + 1;
    const fenced = inFence(line);
    if (!looksLikeRow(line)) continue; // no unmasked pipe: prose, blank, or a heading

    if (fenced) {
      exclusions.push({ kind: "expected", line: lineNo, reason: "pipe row inside a fenced code block (a documented example is not evidence)", text: line.trim().slice(0, 120) });
      continue;
    }
    if (!hasBalancedTicks(line)) {
      exclusions.push({ kind: "malformed", line: lineNo, reason: "odd number of backticks -- an unclosed code span makes the field split unreliable, so this row is refused rather than reshaped", text: line.trim().slice(0, 120) });
      continue;
    }
    if (!ROW.test(line)) {
      exclusions.push({ kind: "malformed", line: lineNo, reason: "carries a pipe but does not begin with a YYYY-MM-DD date -- neither a lesson nor a scoreboard row", text: line.trim().slice(0, 120) });
      continue;
    }

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
      // splitFields, NOT a raw split(","). A comma inside a code span is data for exactly the
      // same reason a pipe is, and `shell, `sed -i, awk`, parsing` used to shred into four tags.
      tags: tagField ? splitFields(tagField, ",").map((t) => t.trim()).filter(Boolean) : [],
      fields: { date, project, pattern, prevention },
    });
  }

  return { records, exclusions };
}
