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
import { search } from "./lib/bm25.mjs";
import { sanitizeQuery } from "./lib/tokenize.mjs";
import { parseAliases, expand } from "./lib/aliases.mjs";
import { ALIAS_FILE } from "./arc-recall.mjs";

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

/**
 * Rank mode: run each golden query through the CANONICAL engine and report the top-3 hit rate.
 *
 * Phase 01 MEASURES this; Phase 02 (REQ-06) wires it into CI as a failing gate. The anchor check
 * always runs first, because a row whose id has drifted onto a different lesson would otherwise
 * score as a hit for the wrong reason -- which is exactly how a golden set stays green while it
 * has quietly stopped grading anything.
 */
export function rank(rows, index, aliasRows) {
  const out = [];
  for (const row of rows) {
    const { tokens: raw } = sanitizeQuery(row.query);
    const { tokens, fired } = expand(raw, aliasRows);
    const hits = search(index.postings ?? { terms: {}, lengths: [], avgdl: 0 }, index.records ?? [], tokens, { limit: 3 });
    const top3 = hits.map((h) => index.records[h.index].id);
    const at = top3.findIndex((id) => row.expect.includes(id));
    out.push({ id: row.id, query: row.query, top3, hit: at !== -1, rank: at === -1 ? null : at + 1, aliases: fired.map((f) => f.terms.join("/")) });
  }
  return out;
}

function main() {
  // Same argv contract as memory-index, deliberately. Every rule below was a real defect there,
  // and this lane's standing instruction is that a fix is not applied until it has been applied
  // in the file where it was never made -- the twin-fix shape, which has already recurred once
  // inside this phase four lines apart in one function.
  const argv = process.argv.slice(2);
  let root = null;
  let seenRoot = false;
  let doRank = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") {
      if (seenRoot) { console.error("golden-check: --root given twice -- that is an operator error, not a last-wins override"); process.exit(2); }
      seenRoot = true;
      const v = argv[++i];
      if (v === undefined) { console.error("golden-check: --root needs a value"); process.exit(2); }
      // Presence, not truthiness: `--root "$DIR"` with DIR unset is the quoted form the lane
      // rules mandate, and it must not silently become the current directory.
      if (v.trim() === "") { console.error("golden-check: --root was named but is empty -- refusing to fall back to a directory nobody named"); process.exit(2); }
      root = v;
    } else if (argv[i] === "--rank") { doRank = true; }
    else { console.error(`golden-check: unknown flag ${argv[i]}`); process.exit(2); }
  }
  root = resolve(root ?? process.cwd());
  if (!existsSync(root)) { console.error(`golden-check: --root ${root.split(sep).join("/")} does not exist`); process.exit(2); }

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
  if (!doRank) return;

  let aliasRows = [];
  const aliasPath = join(root, ALIAS_FILE);
  if (existsSync(aliasPath)) aliasRows = parseAliases(readFileSync(aliasPath, "utf8")).rows;

  const scored = rank(rows, index, aliasRows);
  const hits = scored.filter((r) => r.hit).length;
  for (const r of scored) {
    const mark = r.hit ? `HIT  @${r.rank}` : "miss   ";
    console.log(`  ${r.id} ${mark}  ${r.query}`);
    if (!r.hit) console.log(`        top3: ${r.top3.join(", ") || "(nothing matched)"}`);
  }
  console.log(`golden-check: ${hits}/${scored.length} queries hit an expected id in the top 3`);
  // Phase 01 measures and REPORTS. Phase 02 turns this into a failing CI gate (REQ-06); making it
  // fail here would gate on a number before the phase that owns the number has run.
  if (hits < scored.length) process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
