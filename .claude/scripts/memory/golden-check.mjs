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
// Usage: node .claude/scripts/memory/golden-check.mjs [--root <dir>] [--rank] [--gate] [--equivalence]
// Exit: 0 every anchor resolves · 1 a check FAILED (the message names which) · 2 operator error.
//
// Exit 1 is reached only by a stated verdict -- an anchor that does not resolve, a gate condition
// that is not met, an engine disagreement. An unexpected throw also lands on 1 and says
// `INTERNAL` in as many words, because a raw Node stack at exit 1 is indistinguishable from a real
// gate failure to whatever reads this in CI (2026-08-12, shell/OS row 9: a DIRECTORY where
// `aliases.md` goes produced `EISDIR` and a v24 banner at exit 1).

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
// `expected-rows` exists because of adversarial finding 4/5 (2026-08-12): deleting the golden row
// that FAILS turns the gate from red to green, since it compares hits to the rows that happen to
// be present. The set is the contract; shrinking it is not a way to pass. And with the set cut,
// the comparison table printed `grep baseline 5 of 4` -- a baseline measured over 12 queries
// re-denominated against 4, which is a fabricated number in a table whose whole job is comparison.
export const HEADER_KEYS = Object.freeze(["baseline-grep-top3", "baseline-corpus-records", "expected-rows"]);

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
  // `refuse` rather than `process.exit`: every branch below writes to stdout or stderr first, and
  // Node's stdout AND stderr are ASYNCHRONOUS for pipes on macOS -- `bats run` and the CI log
  // capture are both pipes -- so `process.exit()` can truncate the very evidence the exit code is
  // reporting. Setting `exitCode` and returning lets Node flush on its own. This file was the last
  // one under scripts/memory/ still exiting hard after a write (2026-08-12, both ledgers).
  const refuse = (msg, code = 2) => { console.error(`golden-check: ${msg}`); process.exitCode = code; return null; };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") {
      if (seenRoot) return refuse("--root given twice -- that is an operator error, not a last-wins override");
      seenRoot = true;
      const v = argv[++i];
      if (v === undefined) return refuse("--root needs a value");
      // Presence, not truthiness: `--root "$DIR"` with DIR unset is the quoted form the lane
      // rules mandate, and it must not silently become the current directory.
      if (v.trim() === "") return refuse("--root was named but is empty -- refusing to fall back to a directory nobody named");
      // The flag-shaped value guard the three sibling CLIs already carried and this one did not:
      // `golden-check --root --gate` ate `--gate` as the root value, so the GATE SILENTLY DID NOT
      // RUN and the failure was a does-not-exist message that named the wrong problem. It was loud
      // by luck, never by rule -- `--root --rank` would have been the same shape. `.claude/rules/
      // lanes.md` names this verbatim: an unquoted empty value eats the next flag.
      if (v.startsWith("--")) return refuse(`--root was given ${JSON.stringify(v)}, which is a flag, not a value -- an empty variable ate the next argument`);
      root = v;
    } else if (argv[i] === "--rank") { doRank = true; }
    // --gate IMPLIES --rank: a gate that could be asked to grade without ranking would exit 0
    // having graded nothing, which is the vacuous pass in its purest form.
    else if (argv[i] === "--gate") { doRank = true; doGate = true; }
    else if (argv[i] === "--equivalence") { doEquiv = true; }
    else return refuse(`unknown flag ${argv[i]}`);
  }
  root = resolve(root ?? process.cwd());
  if (!existsSync(root)) return refuse(`--root ${root.split(sep).join("/")} does not exist`);

  const goldenPath = join(root, GOLDEN);
  if (!existsSync(goldenPath)) return refuse(`${GOLDEN} not found under ${root.split(sep).join("/")}`);
  const idxPath = indexPath(root);
  if (!existsSync(idxPath)) return refuse("no index -- run memory-index --rebuild first");

  let rows, index, goldenText;
  // Read ONCE and reuse: reading the fixture a second time later would let the rows and the
  // @-directives come from two different reads of a file that could change between them.
  try { goldenText = readFileSync(goldenPath, "utf8"); rows = loadGolden(goldenText); }
  catch (e) { return refuse(e.message); }
  try { index = JSON.parse(readFileSync(idxPath, "utf8")); }
  catch (e) { return refuse(`index is unreadable: ${e.message}`); }

  // Aliases are read HERE, ahead of both surfaces, because the equivalence harness needs the same
  // query tokens the product actually ranks -- see the expansion note in the doEquiv block below.
  let aliasRows = [];
  let aliasExclusions = [];
  const aliasPath = join(root, ALIAS_FILE);
  if (existsSync(aliasPath)) {
    // Guarded, because "the path exists" is not "the path is a readable file": a DIRECTORY named
    // aliases.md produced a raw EISDIR stack at exit 1, the same code a real anchor failure uses.
    let aliasText;
    try { aliasText = readFileSync(aliasPath, "utf8"); }
    catch (e) { return refuse(`${ALIAS_FILE} exists under ${root.split(sep).join("/")} but could not be read: ${e.message}`); }
    const parsed = parseAliases(aliasText);
    aliasRows = parsed.rows;
    aliasExclusions = parsed.exclusions ?? [];
  }

  // The equivalence harness (REQ-07, ADR-0701). Its own surface, ahead of the anchor check,
  // because it grades ENGINES rather than the golden set's expectations: it asks whether two
  // implementations rank identically, which is a question the expected ids play no part in.
  if (doEquiv) {
    const records = index.records ?? [];
    // ALIAS-EXPANDED, exactly as `rank()` and the CLI expand them. This graded the raw sanitized
    // tokens while both real ranking paths grade the expanded ones, so two engines would have been
    // certified as agreeing on a query path the product never runs -- `["worktree","mode","b"]`
    // against `["worktree","mode","b","parallel"]`. Latent only because aliases.md ships empty,
    // which is precisely the condition that would have changed the day it stopped being empty
    // (2026-08-12, decision-logic ledger, "one gap worth naming").
    const queries = rows.map((r) => ({ id: r.id, tokens: expand(sanitizeQuery(r.query).tokens, aliasRows).tokens }));
    const v = checkEquivalence({ index, records, queries });
    console.log(`equivalence: tie-break is ${v.tieBreak} -- two engines agree only on the same ORDERED ids, never merely the same set`);
    // ASSERTED, and the assertion's own result printed beside the claim. Printing the contract
    // without checking it is what let an inverted comparator pass this gate on 2026-08-12.
    for (const t of v.tieBreakChecked) {
      console.log(`equivalence: tie-break probe on ${t.engine}: ${t.ok ? "HELD" : "BROKEN"} -- returned [${t.ids.join(", ")}], contract says [${t.expected.join(", ")}]${t.error ? ` (${t.error})` : ""}`);
    }
    console.log(`equivalence: engine(s) available: ${v.engines.join(", ") || "(none)"}${v.unavailable.length ? `; unavailable: ${v.unavailable.join(", ")}` : ""}`);
    if (!v.compared) {
      // Said in as many words. A green that cannot tell "they agree" from "there was nothing to
      // compare" is the vacuous pass wearing a gate's clothes, and REQ-07's engine is CUT, so
      // this is the state the harness will sit in until a build trigger fires.
      console.log(`equivalence: only ${v.engines.length} engine is registered, so NOTHING WAS COMPARED. This run proves DETERMINISM (the engine returns identical ordered ids on a second call) across all ${v.queries} golden queries -- it does not and cannot show that two engines agree.`);
    }
    if (v.mismatches.length) {
      const label = { nondeterministic: "NONDETERMINISTIC", "tie-break": "TIE-BREAK BROKEN" };
      for (const m of v.mismatches) {
        console.error(`equivalence: ${label[m.kind] ?? "DISAGREEMENT"} on ${m.query} -- ${m.a} returned [${m.aIds.join(", ")}], ${m.b} returned [${m.bIds.join(", ")}]`);
      }
      console.error(`equivalence: FAILED -- ${v.mismatches.length} check(s) did not hold across ${v.queries} golden queries plus the tie-break probe`);
      process.exitCode = 1;
      return;
    }
    console.log(`equivalence: PASSED -- ${v.queries}/${v.queries} golden queries held${v.compared ? ` across ${v.engines.length} engines` : ", as determinism only"}, and the tie-break probe HELD on ${v.tieBreakChecked.length} engine(s).`);
    if (!doRank) return;
  }

  const failures = checkAnchors(rows, index.records ?? []);
  if (failures.length) {
    for (const f of failures) console.error(`golden-check: FAIL ${f}`);
    console.error(`golden-check: ${rows.length - failures.length}/${rows.length} anchors resolve`);
    process.exitCode = 1;
    return;
  }
  console.log(`golden-check: ${rows.length}/${rows.length} anchors resolve`);
  if (!doRank) return;

  // NAMED, never dropped. `parseAliases` returns exclusions and this caller took `.rows` and let
  // them fall on the floor -- the identical Phase-01 defect, fixed in `arc-recall` and never made
  // in the second caller, which is the one that FEEDS A GATE. ADR-0706's second trigger condition
  // is counted off this list, so a refused row silently lowers a number the gate then reports as
  // measured. Twin-fix, third recurrence in this lane (2026-08-12, decision-logic row 8).
  if (aliasExclusions.length) {
    console.log(`  ${ALIAS_FILE}: ${aliasExclusions.length} row(s) could NOT be read and are excluded from the alias count below:`);
    for (const x of aliasExclusions) console.log(`    line ${x.line}: ${x.reason}`);
  }

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
  catch (e) { return refuse(e.message); }

  const baseline = header["baseline-grep-top3"];
  const corpusBaseline = header["baseline-corpus-records"];
  const corpusNow = (index.records ?? []).length;

  // THE SET IS THE CONTRACT, checked before anything is compared against it. A gate that grades
  // whatever rows it finds can be passed by deleting the row that fails, and its baseline -- a
  // number measured over the declared set -- becomes a fabricated fraction the moment the
  // denominator moves. Both were reproduced on 2026-08-12.
  if (scored.length !== header["expected-rows"]) {
    console.error(`golden-check: GATE FAILED -- the golden set holds ${scored.length} row(s) but declares @expected-rows ${header["expected-rows"]}. The set IS the contract: a query is added or removed by changing that number in the same commit, never by letting the gate grade whichever rows survive.`);
    process.exitCode = 1;
    return;
  }

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
    process.exitCode = 1;
    return;
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

if (invokedDirectly()) {
  // The wrapper the three sibling CLIs all carried and this one did not. `parseAliases`,
  // `checkAnchors` and `rank` sat outside every try, so an unusable input reached the operator as
  // a v24 banner and an `errno: -4068` at exit 1 -- the same code a genuine gate failure uses. The
  // word INTERNAL is what makes the two distinguishable to whatever reads this in CI.
  try { main(); }
  catch (e) { console.error(`golden-check: INTERNAL -- ${e.stack || e.message}`); process.exitCode = 1; }
}
