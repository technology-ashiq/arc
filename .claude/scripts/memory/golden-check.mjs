#!/usr/bin/env node
// golden-check -- does every golden row still name the lesson it was written for?
//
// Phase 00 scope, deliberately narrow: this checks that each golden row's expected doc-id EXISTS
// in the index and that the record it names still CONTAINS the row's verbatim anchor. It does not
// run a query and does not score ranking -- there is no ranking in Phase 00. Phase 02 wires the
// ranking gate (REQ-06) on top of this same file.
//
// Why the anchor exists at all: a retro id is content-positional (`retro:<DATE>#<n>`), so
// inserting one row earlier on the same date renumbers every later id on that date. The id still
// exists, so an id-only gate keeps passing while grading a completely different lesson. The
// Phase-00 adversarial pass demonstrated it: one back-filled 2026-08-02 row silently repointed
// two golden rows at unrelated lessons and nothing complained.
//
// Usage: node .claude/scripts/memory/golden-check.mjs [--root <dir>]
// Exit: 0 every anchor resolves · 1 at least one does not · 2 operator error.

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { indexPath } from "./memory-index.mjs";

export const GOLDEN = "tests/fixtures/memory/golden-queries.tsv";

export function loadGolden(text) {
  const rows = [];
  for (const [i, line] of text.replace(/\r\n/g, "\n").split("\n").entries()) {
    if (!line || line.startsWith("#")) continue;
    const c = line.split("\t");
    if (c.length !== 5) throw new Error(`${GOLDEN}:${i + 1} has ${c.length} tab-separated columns, expected 5 (id, query, expect, anchor, note)`);
    const [id, query, expect, anchor, note] = c;
    // A leftover placeholder must FAIL, never be skipped: a skipped row is a golden query that
    // silently stops grading anything.
    if (expect.includes("unresolved:")) throw new Error(`${GOLDEN}:${i + 1} (${id}) still carries an unresolved placeholder: ${expect}`);
    if (!anchor.trim()) throw new Error(`${GOLDEN}:${i + 1} (${id}) has an empty anchor, so id drift would be invisible`);
    rows.push({ id, query, expect: expect.split(",").map((s) => s.trim()).filter(Boolean), anchor, note });
  }
  if (rows.length === 0) throw new Error(`${GOLDEN} holds no rows`);
  return rows;
}

export function checkAnchors(rows, records) {
  const by = new Map(records.map((r) => [r.id, r]));
  const failures = [];
  for (const row of rows) {
    const present = row.expect.filter((id) => by.has(id));
    if (present.length === 0) {
      failures.push(`${row.id}: none of its expected ids exist in the index (${row.expect.join(", ")})`);
      continue;
    }
    // ANY of the accepted ids may carry the anchor -- row G06 legitimately names three.
    const hit = present.some((id) => {
      const r = by.get(id);
      return `${r.title}\n${r.body}`.includes(row.anchor);
    });
    if (!hit) {
      failures.push(`${row.id}: ${present.join(", ")} exist(s) but none contains the anchor ${JSON.stringify(row.anchor)} -- the id now names a different record than the one this query was written for`);
    }
  }
  return failures;
}

function main() {
  const argv = process.argv.slice(2);
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") {
      const v = argv[++i];
      if (v === undefined || v.trim() === "") { console.error("golden-check: --root needs a non-empty value"); process.exit(2); }
      root = v;
    } else { console.error(`golden-check: unknown flag ${argv[i]}`); process.exit(2); }
  }
  root = resolve(root ?? process.cwd());

  const goldenPath = join(root, GOLDEN);
  if (!existsSync(goldenPath)) { console.error(`golden-check: ${GOLDEN} not found under ${root.split(sep).join("/")}`); process.exit(2); }
  const idxPath = indexPath(root);
  if (!existsSync(idxPath)) { console.error("golden-check: no index -- run memory-index --rebuild first"); process.exit(2); }

  let rows, index;
  try { rows = loadGolden(readFileSync(goldenPath, "utf8")); }
  catch (e) { console.error(`golden-check: ${e.message}`); process.exit(2); }
  try { index = JSON.parse(readFileSync(idxPath, "utf8")); }
  catch (e) { console.error(`golden-check: index is unreadable: ${e.message}`); process.exit(2); }

  const failures = checkAnchors(rows, index.records ?? []);
  if (failures.length) {
    for (const f of failures) console.error(`golden-check: FAIL ${f}`);
    console.error(`golden-check: ${rows.length - failures.length}/${rows.length} anchors resolve`);
    process.exit(1);
  }
  console.log(`golden-check: ${rows.length}/${rows.length} anchors resolve`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
