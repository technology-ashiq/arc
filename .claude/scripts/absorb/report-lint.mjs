#!/usr/bin/env node
// report-lint.mjs -- validates an absorb extraction report against ADR-0601 (ABS-B).
//
// WARN-FIRST, IN TRIAL. It always exits 0 on a report it could read, however bad that report is,
// and prints one WARN line per defect. Promotion to FAIL goes through /arc-retro against
// docs/trial-ledger.md -- never by editing this file. A WARN-first lint that exits non-zero is a
// BLOCK wearing a WARN's label, so the exit code is load-bearing in the other direction here.
//
// Exit codes: 0 the report was read and judged · 2 usage error (no path, or unreadable).
//
// WHY THE EXIT CODE CANNOT CARRY THE VERDICT, stated because it makes the tests look odd: a clean
// report and a report with nine warnings both exit 0. So no test may assert correctness via
// `status`, and tests/absorb-report-lint.bats asserts on the WARNING PAYLOAD -- which is why that
// file carries a mutant negative control. A lint whose every output is exit 0 is trivially
// satisfied by a stub that prints nothing.
//
// ---------------------------------------------------------------------------------------------
// THE PHASE 01 ADVERSARIAL PASS BROKE THIS FILE IN FOUR PLACES. All four shipped in v1:
//
//   `.trim()` before the heading test   `"    ## Source".trim()` counts as a heading, and there was
//                                       no fence awareness at all. So a report consisting ENTIRELY
//                                       of a studied README quoted inside a ``` fence -- or merely
//                                       indented, which is how an agent quotes source material --
//                                       linted with 0 warnings. The authored report was empty and
//                                       the lint called it ADR-0601 compliant. The v1 test for this
//                                       property was a straw man: it put a heading mid-sentence
//                                       inside backticks, which is not the failing case.
//   first-match section lookup          a duplicate `## Technique inventory` (e.g. a fenced decoy)
//                                       shadowed the real one, so ~10 row defects vanished and the
//                                       single emitted warning was "headings out of order" -- a
//                                       confident diagnosis of a defect that did not exist.
//   split on every `|`                  a cell containing the standard markdown escape `\|` added a
//                                       phantom column, shifting every checked field. The lint then
//                                       reported `verdict "c:1" is not one of ...` where the real
//                                       verdict was ABSORB and `c:1` was the citation -- naming a
//                                       field the defect was not in, while the real defect (a
//                                       misaligned row) went unreported.
//   emptiness by `.trim()`              an all-blank row was silently discarded as a separator, and
//                                       a zero-width space satisfied "non-empty".
// ---------------------------------------------------------------------------------------------

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

// Normalise CRLF and strip a BOM so a Windows checkout and a Linux one see the same headings.
const lines = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").split("\n");

// ---------- fence map ----------
// A line inside a fenced code block is CONTENT, never structure. Studied material is quoted into
// these reports by design, so a fence-blind parser reads the source's headings as the report's own.
const inFence = new Array(lines.length).fill(false);
{
  let fence = null; // the opening fence's marker, so ``` does not close ~~~~
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence === null && m) { fence = m[1][0]; inFence[i] = true; continue; }
    if (fence !== null) {
      inFence[i] = true;
      if (m && m[1][0] === fence) fence = null;
      continue;
    }
  }
}

// ---------- headings ----------
// The RAW line must begin with "## " -- no leading-whitespace tolerance. Only a trailing trim, so a
// heading with trailing spaces still counts. An indented heading is content: markdown itself treats
// 4+ spaces as a code block, and an agent quoting a source indents it.
const headingLines = [];
for (let i = 0; i < lines.length; i++) {
  if (inFence[i]) continue;
  const raw = lines[i];
  if (!raw.startsWith("## ")) continue;
  headingLines.push({ text: raw.replace(/\s+$/, ""), line: i + 1 });
}
const headingTexts = headingLines.map((h) => h.text);

for (const want of REQUIRED_HEADINGS) {
  const hits = headingLines.filter((h) => h.text === want);
  if (hits.length === 0) {
    warn("heading", `missing required heading "${want}" (ADR-0601 requires all five, verbatim, at the start of a line and outside any code fence)`);
  } else if (hits.length > 1) {
    // Reported explicitly rather than as an ordering fault. v1 compared a deduped expected list
    // against a non-deduped actual one, so a duplicate was ALWAYS misreported as misordering, and a
    // duplicate of the last required heading was reported as nothing at all.
    warn("heading", `duplicate required heading "${want}" at lines ${hits.map((h) => h.line).join(", ")} -- which one is the real section is not guessable, so its rows are not checked`);
  }
}

// Order, across the headings that appear exactly once. A duplicate is already reported above and is
// excluded here so one defect does not produce two contradictory diagnoses.
{
  const unique = REQUIRED_HEADINGS.filter((h) => headingLines.filter((x) => x.text === h).length === 1);
  const actual = headingTexts.filter((h) => unique.includes(h));
  for (let i = 0; i < unique.length; i++) {
    if (unique[i] !== actual[i]) {
      warn("heading", `required headings are out of order: expected "${unique[i]}" at position ${i + 1}, found "${actual[i]}"`);
      break;
    }
  }
}

// ---------- table helpers ----------
const isTableRow = (l) => /^\s{0,3}\|/.test(l);

// Split on unescaped pipes only. `\|` is the standard markdown escape for a literal pipe, and
// splitting on it shifts every subsequent column.
const splitRow = (l) => {
  const body = l.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && body[i + 1] === "|") { cur += "|"; i++; continue; }
    if (ch === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
};

// A separator row is non-empty cells that are ALL dash-runs. v1 accepted every-cell-matches-
// `^[-: ]*$`, which an all-blank row satisfies -- so a genuinely empty inventory row was silently
// discarded and its nine field defects never reported.
const isSeparator = (cells) =>
  cells.length > 0 && cells.every((c) => c.length > 0 && /^:?-{1,}:?$/.test(c));

// Zero-width and other format/control characters are not content. `"​".trim()` is non-empty,
// so a zero-width space satisfied every required field.
const blank = (s) => s.replace(/[\p{Cf}\p{Cc}\p{Zs}]/gu, "") === "";

function sectionLines(heading) {
  const hits = headingLines.filter((h) => h.text === heading);
  if (hits.length !== 1) return null; // absent or duplicated -- both already reported
  const start = hits[0];
  const later = headingLines.filter((h) => h.line > start.line);
  const end = later.length ? later[0].line - 1 : lines.length;
  return lines.slice(start.line, end).filter((_, i) => !inFence[start.line + i]);
}

// ---------- the technique inventory ----------
const invLines = sectionLines("## Technique inventory");
if (invLines === null) {
  // nothing further to say: the heading is missing or ambiguous, and both were reported above
} else {
  const invRows = invLines.filter(isTableRow).map(splitRow).filter((c) => !isSeparator(c));
  if (invRows.length === 0) {
    warn("inventory", "## Technique inventory has no table at all -- a report with no inventory is not a study");
  } else {
    const header = invRows[0].map((c) => c.toLowerCase());
    const dataRows = invRows.slice(1);

    // Column indexes resolved from the header, never assumed by position: a report that reorders
    // its columns is still readable, and a lint hardcoding index 4 would silently check the wrong
    // cell instead of reporting anything.
    const idx = {};
    for (const field of ["id", ...REQUIRED_ROW_FIELDS]) {
      const at = header.indexOf(field);
      if (at === -1) warn("inventory", `inventory table has no "${field}" column (ADR-0601 fixes the column set)`);
      else idx[field] = at;
    }

    if (dataRows.length === 0) warn("inventory", "inventory table has a header but no technique rows");

    const seenIds = new Set();
    dataRows.forEach((row, n) => {
      // A misaligned row is reported AS misalignment. v1 checked fields against shifted columns and
      // confidently named the wrong field.
      if (row.length !== header.length) {
        warn("inventory", `row ${n + 1}: has ${row.length} cells but the header has ${header.length} -- the row is misaligned, so its fields are not checked (escape a literal pipe as \\|)`);
        return;
      }

      const rawId = idx.id === undefined ? "" : (row[idx.id] || "").trim();
      const label = rawId && !blank(rawId) ? rawId : `row ${n + 1} (no id)`;

      if (idx.id !== undefined) {
        if (blank(rawId)) {
          warn("id", `${label}: no id -- every inventory row needs a T-NN id, it is what a warning names`);
        } else if (!/^T-\d{2,}$/.test(rawId)) {
          warn("id", `${label}: id is not T-NN form (zero-padded, e.g. T-01)`);
        } else if (seenIds.has(rawId)) {
          warn("id", `${rawId}: duplicate id -- ids must be unique within one report`);
        }
        if (!blank(rawId)) seenIds.add(rawId);
      }

      for (const field of REQUIRED_ROW_FIELDS) {
        if (idx[field] === undefined) continue;
        const val = (row[idx[field]] || "").trim();
        if (blank(val)) {
          warn("row-field", `${label}: "${field}" is empty -- ADR-0601 requires it on every row`);
          continue;
        }
        if (field === "verdict" && !VERDICTS.has(val)) {
          warn("row-field", `${label}: verdict "${val}" is not one of ABSORB | INTEGRATE | ROUTE | SKIP`);
        }
      }
    });
  }
}

// ---------- report ----------
for (const w of warnings) console.log(w);
console.log(
  warnings.length === 0
    ? "report-lint: 0 warnings"
    : `report-lint: ${warnings.length} warning${warnings.length === 1 ? "" : "s"} [trial] — WARN-first, exit 0 by design (docs/trial-ledger.md)`
);
process.exitCode = 0;
