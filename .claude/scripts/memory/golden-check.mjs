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

import { readFileSync, existsSync , realpathSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { indexPath } from "./memory-index.mjs";
import { search } from "./lib/bm25.mjs";
import { sanitizeQuery } from "./lib/tokenize.mjs";
import { parseAliases, expand } from "./lib/aliases.mjs";
import { checkEquivalence } from "./lib/engines.mjs";
import { ALIAS_FILE } from "./arc-recall.mjs";

export const GOLDEN = "tests/fixtures/memory/golden-queries.tsv";

// ---------- the @-directive header (REQ-06, ADR-0706) ----------
// The gate compares against numbers that live in the FIXTURE, not in this file. A baseline typed
// into a script is a number nobody diffs; a baseline in the data file makes every move a visible
// change to the thing that records it. Missing, duplicated or non-numeric directives are refused
// rather than defaulted -- a gate that silently defaults its own bar is grading nothing.
export const HEADER_KEYS = Object.freeze(["baseline-grep-top3", "baseline-corpus-records"]);

export function parseGoldenHeader(text) {
  const out = {};
  for (const [i, line] of text.replace(/\r\n/g, "\n").split("\n").entries()) {
    if (!line.startsWith("#")) continue;
    // A key STARTS WITH A LETTER. `[a-z0-9-]+` also matched `@-directives`, the first words of
    // the prose comment written directly above the directives it describes -- so the file's own
    // documentation was parsed as a malformed directive and refused the whole gate at exit 2.
    // Found by running the gate once before writing the assertions, which is the only reason it
    // is not a CI red. Prose beginning with `@` is now prose; a well-formed key that nobody
    // recognises is still refused loudly, because that is a typo in a real directive.
    const m = line.match(/^#[ \t]*@([a-z][a-z0-9-]*)[ \t]+(.*)$/);
    if (!m) continue;
    const key = m[1];
    const raw = m[2].trim();
    if (!HEADER_KEYS.includes(key)) throw new Error(`${GOLDEN}:${i + 1} declares @${key}, which is not one of: ${HEADER_KEYS.join(", ")}`);
    if (key in out) throw new Error(`${GOLDEN}:${i + 1} declares @${key} twice -- that is an operator error, not a last-wins override`);
    if (!/^\d+$/.test(raw)) throw new Error(`${GOLDEN}:${i + 1} @${key} is ${JSON.stringify(raw)}, not a non-negative integer`);
    out[key] = Number(raw);
  }
  for (const k of HEADER_KEYS) {
    if (!(k in out)) throw new Error(`${GOLDEN} declares no @${k} -- the gate refuses to compare against a baseline nobody wrote down`);
  }
  return out;
}

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
    // The ranked hit must ALSO carry the anchor. Checking "expect contains this id" and
    // "some expected id carries the anchor" separately meant the two checks never had to name
    // the SAME record: on a multi-id row the anchor could be satisfied by one id while ranking
    // hit another. Measured on the untouched corpus -- G06's anchor lives on trial:2026-07-19#1
    // and trial:2026-07-28#1 while ranking hit trial:2026-07-22#1, which does not contain it --
    // so the drift guard was bypassed for exactly the row it was written for.
    const byId = new Map((index.records ?? []).map((r) => [r.id, r]));
    const carries = (id) => { const r = byId.get(id); return !!r && `${r.title}\n${r.body}`.includes(row.anchor); };
    const at = top3.findIndex((id) => row.expect.includes(id) && carries(id));
    const looseAt = top3.findIndex((id) => row.expect.includes(id));
    out.push({
      id: row.id, query: row.query, top3, hit: at !== -1, rank: at === -1 ? null : at + 1,
      // An expected id ranked but WITHOUT the anchor is the drift case, and it is reported
      // separately rather than folded into either bucket.
      drifted: at === -1 && looseAt !== -1 ? top3[looseAt] : null,
      aliases: fired.map((f) => f.terms.join("/")),
    });
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
  let doGate = false;
  let doEquiv = false;
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
    // --gate IMPLIES --rank: a gate that could be asked to grade without ranking would exit 0
    // having graded nothing, which is the vacuous pass in its purest form.
    else if (argv[i] === "--gate") { doRank = true; doGate = true; }
    else if (argv[i] === "--equivalence") { doEquiv = true; }
    else { console.error(`golden-check: unknown flag ${argv[i]}`); process.exit(2); }
  }
  root = resolve(root ?? process.cwd());
  if (!existsSync(root)) { console.error(`golden-check: --root ${root.split(sep).join("/")} does not exist`); process.exit(2); }

  const goldenPath = join(root, GOLDEN);
  if (!existsSync(goldenPath)) { console.error(`golden-check: ${GOLDEN} not found under ${root.split(sep).join("/")}`); process.exit(2); }
  const idxPath = indexPath(root);
  if (!existsSync(idxPath)) { console.error("golden-check: no index -- run memory-index --rebuild first"); process.exit(2); }

  let rows, index, goldenText;
  // Read ONCE and reuse: reading the fixture a second time later would let the rows and the
  // @-directives come from two different reads of a file that could change between them.
  try { goldenText = readFileSync(goldenPath, "utf8"); rows = loadGolden(goldenText); }
  catch (e) { console.error(`golden-check: ${e.message}`); process.exit(2); }
  try { index = JSON.parse(readFileSync(idxPath, "utf8")); }
  catch (e) { console.error(`golden-check: index is unreadable: ${e.message}`); process.exit(2); }

  // The equivalence harness (REQ-07, ADR-0701). Its own surface, ahead of the anchor check,
  // because it grades ENGINES rather than the golden set's expectations: it asks whether two
  // implementations rank identically, which is a question the expected ids play no part in.
  if (doEquiv) {
    const records = index.records ?? [];
    const queries = rows.map((r) => ({ id: r.id, tokens: sanitizeQuery(r.query).tokens }));
    const v = checkEquivalence({ index, records, queries });
    console.log(`equivalence: tie-break is ${v.tieBreak} -- two engines agree only on the same ORDERED ids, never merely the same set`);
    console.log(`equivalence: engine(s) available: ${v.engines.join(", ") || "(none)"}${v.unavailable.length ? `; unavailable: ${v.unavailable.join(", ")}` : ""}`);
    if (!v.compared) {
      // Said in as many words. A green that cannot tell "they agree" from "there was nothing to
      // compare" is the vacuous pass wearing a gate's clothes, and REQ-07's engine is CUT, so
      // this is the state the harness will sit in until a build trigger fires.
      console.log(`equivalence: only ${v.engines.length} engine is registered, so NOTHING WAS COMPARED. This run proves DETERMINISM (the engine returns identical ordered ids on a second call) across all ${v.queries} golden queries -- it does not and cannot show that two engines agree.`);
    }
    if (v.mismatches.length) {
      for (const m of v.mismatches) {
        console.error(`equivalence: ${m.kind === "nondeterministic" ? "NONDETERMINISTIC" : "DISAGREEMENT"} on ${m.query} -- ${m.a} returned [${m.aIds.join(", ")}], ${m.b} returned [${m.bIds.join(", ")}]`);
      }
      console.error(`equivalence: FAILED -- ${v.mismatches.length} of ${v.queries} golden queries did not hold`);
      process.exit(1);
    }
    console.log(`equivalence: PASSED -- ${v.queries}/${v.queries} golden queries held${v.compared ? ` across ${v.engines.length} engines` : ", as determinism only"}.`);
    if (!doRank) return;
  }

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
    if (r.drifted) console.log(`        DRIFT: ${r.drifted} is an expected id but no longer carries this row's anchor -- the id now names a different record`);
  }
  console.log(`golden-check: ${hits}/${scored.length} queries hit an expected id in the top 3`);
  // Phase 01 measured and REPORTED. Phase 02 turns the same number into a failing gate (REQ-06),
  // and only under --gate: `--rank` on its own stays the reporting surface it has always been.
  if (!doGate) return;

  let header;
  try { header = parseGoldenHeader(goldenText); }
  catch (e) { console.error(`golden-check: ${e.message}`); process.exit(2); }

  const baseline = header["baseline-grep-top3"];
  const corpusBaseline = header["baseline-corpus-records"];
  const corpusNow = (index.records ?? []).length;

  // THE COMPARISON TABLE (ADR-0706). Both numbers are labelled and the delta is derived, never
  // retyped -- the counts-rot shape of retro-log 2026-07-22 is a hardcoded number nobody
  // recomputes, and a comparison table is exactly where one hides.
  console.log("");
  console.log(`  surface           top-3 hits   of   source`);
  console.log(`  grep baseline     ${String(baseline).padStart(10)}   ${String(scored.length).padStart(2)}   ${GOLDEN} @baseline-grep-top3`);
  console.log(`  arc-recall (js)   ${String(hits).padStart(10)}   ${String(scored.length).padStart(2)}   measured this run`);
  console.log(`  delta             ${String(hits - baseline).padStart(10)}        module minus grep`);
  console.log("");

  // ADR-0706's embeddings trigger is THREE conditions together. Printing one of them, or printing
  // "trigger not met" with no values, is how a settled number decays back into folklore -- so all
  // three are printed with their live values whether or not any of them holds.
  const aliasFixes = aliasRows.length;
  const c1 = hits < 10, c2 = aliasFixes >= 3, c3 = corpusNow >= 2 * corpusBaseline;
  console.log(`  embeddings trigger (ADR-0706) needs ALL THREE:`);
  console.log(`    top-3 precision < 10/${scored.length} .......... ${c1 ? "MET" : "not met"}  (live ${hits}/${scored.length})`);
  console.log(`    >= 3 alias-iteration fixes ......... ${c2 ? "MET" : "not met"}  (live ${aliasFixes})`);
  console.log(`    corpus >= 2x the recorded size ..... ${c3 ? "MET" : "not met"}  (live ${corpusNow}, recorded ${corpusBaseline}, bar ${2 * corpusBaseline})`);
  console.log(`    => embeddings are ${c1 && c2 && c3 ? "DISCUSSABLE" : "NOT discussable"}; below the bar a miss is fixed with an alias.`);
  console.log("");

  // The gate. A POSITIVE condition: it fails for insufficiency, not merely for rule-breaking
  // (ADR-0049 via ADR-0706). Two ways to be red, and they are reported separately because they
  // mean different things -- one is a regression, the other says the module was never needed.
  const red = [];
  if (hits < scored.length) red.push(`${scored.length - hits} of ${scored.length} golden queries do not hit an expected id in the top 3`);
  if (hits <= baseline) red.push(`the module scored ${hits}/${scored.length} against a grep baseline of ${baseline}/${scored.length} -- it did not BEAT grep, so its own premise is thin (ADR-0706 keeps that outcome reachable on purpose)`);
  if (red.length) {
    for (const r of red) console.error(`golden-check: GATE FAILED -- ${r}`);
    process.exit(1);
  }
  console.log(`golden-check: GATE PASSED -- ${hits}/${scored.length}, beating the grep baseline of ${baseline} by ${hits - baseline}.`);
}

// realpath BOTH sides. Node ESM realpaths the entry module while argv[1] keeps any symlink, so
// an exact URL compare is false under a symlinked path -- and the CLI then exits 0 having done
// nothing, which is worse than the loose `endsWith` test it replaced. macOS `/tmp` is a symlink.
function invokedDirectly() {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  const self = fileURLToPath(import.meta.url);
  try { return realpathSync(argv1) === realpathSync(self); } catch { return resolve(argv1) === resolve(self); }
}

if (invokedDirectly()) main();
