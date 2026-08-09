#!/usr/bin/env node
// report-lint.mjs -- validates an absorb extraction report against ADR-0601 (ABS-B).
//
// WARN-FIRST, IN TRIAL. It always exits 0 on a report it could read, however bad that report is,
// and prints one WARN line per defect. Promotion to FAIL goes through /arc-retro against
// docs/trial-ledger.md -- never by editing this file. A WARN-first lint that exits non-zero is a
// BLOCK wearing a WARN's label, so the exit code is load-bearing in the other direction here.
//
// Exit codes:
//   0  the report was read and judged (with or without warnings) -- the lint's verdict is stdout
//   2  usage error: no path given, or the path cannot be read. NOT a verdict about a report.
//
// WHY THE EXIT CODE CANNOT CARRY THE VERDICT, stated because it makes the tests look odd:
// a clean report and a report with nine warnings both exit 0. So no test may assert correctness
// via `status`, and tests/absorb-report-lint.bats asserts on the WARNING PAYLOAD instead --
// which is why that file carries a mutant negative control. A lint whose every output is exit 0
// is trivially satisfied by a stub that prints nothing, and the only defence against that is a
// test proving the assertions can still fail.
//
// Phase 00 checks the three inventory fields with live consumers: citation, verdict, license
// note. The remaining row fields are Phase 02 (phase-00-spec.md, pre-planned cut 2).

import { readFileSync } from "node:fs";

// ADR-0601: required, verbatim, in this order. The order is checked as well as the presence,
// because a report whose Verdict summary precedes its inventory reads as a conclusion looking for
// evidence, and that is the shape this lane exists to refuse.
const REQUIRED_HEADINGS = [
  "## Source",
  "## Study scope",
  "## Technique inventory",
  "## Verdict summary",
  "## SKIP and refusal log",
];

// The three fields Phase 00 checks, mapped to their column header text.
const REQUIRED_ROW_FIELDS = ["citation", "verdict", "license note"];

const VERDICTS = new Set(["ABSORB", "INTEGRATE", "ROUTE", "SKIP"]);

const warnings = [];
const warn = (group, msg) => warnings.push(`WARN  [${group}] ${msg}`);

// ---------- read ----------
const path = process.argv[2];
if (!path) {
  console.error("report-lint: usage: node report-lint.mjs PATH_TO_REPORT");
  process.exit(2);
}
let text;
try {
  text = readFileSync(path, "utf8");
} catch (e) {
  console.error(`report-lint: cannot read ${path}: ${e.code || e.message}`);
  process.exit(2);
}

// Normalise CRLF so a Windows checkout and a Linux one see the same headings. The three CI legs
// disagreeing about a heading match would be the least useful red available.
const lines = text.replace(/\r\n/g, "\n").split("\n");

// ---------- 1. required headings, present and in order ----------
// Compare on the trimmed line so trailing whitespace does not hide a heading. A heading is only
// a heading at the start of a line, so a required string quoted inside studied content -- which
// this lint reads by design -- cannot satisfy the check. That matters: study input is hostile
// input, and a report embedding "## Source" in a quoted README must not thereby pass.
const headingLines = [];
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (t.startsWith("## ")) headingLines.push({ text: t, line: i + 1 });
}
const headingTexts = headingLines.map((h) => h.text);

for (const want of REQUIRED_HEADINGS) {
  if (!headingTexts.includes(want)) {
    warn("heading", `missing required heading "${want}" (ADR-0601 requires all five, verbatim)`);
  }
}

// Order: only checked across the headings that ARE present, so a missing heading reports once as
// missing rather than twice as missing-and-misordered.
const presentInOrder = REQUIRED_HEADINGS.filter((h) => headingTexts.includes(h));
const actualOrder = headingTexts.filter((h) => REQUIRED_HEADINGS.includes(h));
for (let i = 0; i < presentInOrder.length; i++) {
  if (presentInOrder[i] !== actualOrder[i]) {
    warn(
      "heading",
      `required headings are out of order: expected "${presentInOrder[i]}" at position ${i + 1}, found "${actualOrder[i]}"`
    );
    break;
  }
}

// ---------- 2. the technique inventory table ----------
// Slice the lines belonging to the inventory section, then read its table.
function sectionLines(heading) {
  const start = headingLines.find((h) => h.text === heading);
  if (!start) return [];
  const later = headingLines.filter((h) => h.line > start.line);
  const end = later.length ? later[0].line - 1 : lines.length;
  return lines.slice(start.line, end);
}

const isTableRow = (l) => /^\s*\|/.test(l);
const isSeparator = (cells) => cells.every((c) => /^[-: ]*$/.test(c));
const splitRow = (l) =>
  l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

const invLines = sectionLines("## Technique inventory");
const invRows = invLines.filter(isTableRow).map(splitRow).filter((c) => !isSeparator(c));

if (!headingTexts.includes("## Technique inventory")) {
  // already reported as a missing heading; nothing further to say about its table
} else if (invRows.length === 0) {
  warn("inventory", "## Technique inventory has no table at all — a report with no inventory is not a study");
} else {
  const header = invRows[0].map((c) => c.toLowerCase());
  const dataRows = invRows.slice(1);

  // The column index for each required field, resolved from the header rather than assumed by
  // position -- a report that reorders its columns is still readable, and a lint that hardcodes
  // index 4 would silently check the wrong cell instead of reporting anything.
  const idx = {};
  for (const field of ["id", ...REQUIRED_ROW_FIELDS]) {
    const at = header.indexOf(field);
    if (at === -1) {
      warn("inventory", `inventory table has no "${field}" column (ADR-0601 fixes the column set)`);
    } else {
      idx[field] = at;
    }
  }

  if (dataRows.length === 0) {
    warn("inventory", "inventory table has a header but no technique rows");
  }

  const seenIds = new Set();
  dataRows.forEach((row, n) => {
    // The row label used in every warning about this row. Falls back to the row's ordinal when
    // the id itself is missing, so a warning always names something the reader can find.
    const rawId = idx.id === undefined ? "" : (row[idx.id] || "").trim();
    const label = rawId || `row ${n + 1} (no id)`;

    if (idx.id !== undefined) {
      if (!rawId) {
        warn("id", `${label}: no id — every inventory row needs a T-NN id, it is what a warning names`);
      } else if (!/^T-\d{2,}$/.test(rawId)) {
        warn("id", `${label}: id is not T-NN form (zero-padded, e.g. T-01)`);
      } else if (seenIds.has(rawId)) {
        warn("id", `${rawId}: duplicate id — ids must be unique within one report`);
      }
      if (rawId) seenIds.add(rawId);
    }

    for (const field of REQUIRED_ROW_FIELDS) {
      if (idx[field] === undefined) continue; // column absent, already reported once above
      const val = (row[idx[field]] || "").trim();
      if (!val) {
        warn("row-field", `${label}: "${field}" is empty — ADR-0601 requires it on every row`);
        continue;
      }
      if (field === "verdict" && !VERDICTS.has(val)) {
        warn(
          "row-field",
          `${label}: verdict "${val}" is not one of ABSORB | INTEGRATE | ROUTE | SKIP`
        );
      }
    }
  });
}

// ---------- report ----------
for (const w of warnings) console.log(w);
console.log(
  warnings.length === 0
    ? "report-lint: 0 warnings"
    : `report-lint: ${warnings.length} warning${warnings.length === 1 ? "" : "s"} [trial] — WARN-first, exit 0 by design (docs/trial-ledger.md)`
);
process.exit(0);
