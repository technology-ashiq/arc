#!/usr/bin/env node
/**
 * ab-run.mjs — the deterministic half of a PLANOFF A/B (REQ-03).
 *
 * Applies TWO routing rules to a fixture's candidate findings and reports where each one lands.
 * It decides nothing about adoption: it prints a table, and ADR-0603's sealed-blind owner judgement
 * is what turns a table into a verdict.
 *
 *   OLD  a finding enters the main report because the reviewer stated it; `cite` is never resolved.
 *   NEW  a finding enters the main report IFF `quote` is non-null AND byte-matches the text at
 *        `cite`. Otherwise it goes to the appendix with a provisional severity. Nothing is deleted.
 *
 * The metrics and the pass condition are FIXED IN THE PROTOCOL, which is committed before this file
 * exists (initiatives/absorb/evidence/planoff/PHASE04-T01/PROTOCOL.md). This script computes them and
 * refuses to invent new ones.
 *
 * Usage:
 *   node ab-run.mjs --fixtures DIR [--json]
 * Exit: 0 ran · 2 bad usage or unreadable fixture · 3 a fixture is internally inconsistent.
 *
 * Exit 3 matters more than it looks: a fixture whose own `quote` does not match its own `subject/`
 * would make every number below meaningless while printing a confident table. That is checked first
 * and it is fatal, not a warning.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";

const argv = process.argv.slice(2);
let fixturesDir = null;
let asJson = false;
let render = null;   // "OLD" | "NEW" -- emit the report a reviewer would receive under that rule
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--fixtures") fixturesDir = argv[++i] ?? null;
  else if (argv[i] === "--json") asJson = true;
  else if (argv[i] === "--render") render = argv[++i] ?? null;
  else die(`unknown argument: ${argv[i]}`);
}
if (!fixturesDir) die("usage: ab-run.mjs --fixtures DIR [--json] [--render OLD|NEW]");
if (render !== null && render !== "OLD" && render !== "NEW") die(`--render takes OLD or NEW, got ${render}`);

function die(msg, code = 2) {
  process.stderr.write(`ab-run: ${msg}\n`);
  process.exit(code);
}

/**
 * Resolve `subject/path.ext:12` or `subject/path.ext:12-14` against a fixture dir and return the
 * exact text at those lines, or null if it does not resolve.
 *
 * Confinement is not decoration here: a candidates.json is fixture DATA, and a `cite` of
 * `../../../../etc/passwd:1` would otherwise be read and quoted into a results table. The fixtures in
 * this repo are trusted; the harness that reads them should not have to be.
 */
/**
 * The ONE confinement. Every read of a fixture-supplied path goes through this, because the first
 * version put the check inside readCite and left the integrity fallback below to call resolve()
 * directly -- so a `cite` of `../outside.txt:1` was refused by readCite and then READ by the
 * "does this quote appear elsewhere in the file" probe, which decided the fixture was fine. Validate
 * one read, confine another: the twin class this lane has now hit four times. Returns an absolute path
 * or null, and nothing else in this file may call resolve() on fixture data.
 */
function confinedFile(fixtureRoot, rel) {
  if (typeof rel !== "string" || rel === "") return null;
  if (isAbsolute(rel) || rel.split(/[\\/]/).includes("..")) return null;
  const rootAbs = resolve(fixtureRoot);
  const abs = resolve(rootAbs, rel);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + require$sep())) return null;
  if (!existsSync(abs) || !statSync(abs).isFile()) return null;
  return abs;
}

function readCite(fixtureRoot, cite) {
  if (typeof cite !== "string") return null;
  const m = /^(.+?):(\d+)(?:-(\d+))?$/.exec(cite);
  if (!m) return null;
  const [, rel, fromS, toS] = m;
  const abs = confinedFile(fixtureRoot, rel);
  if (abs === null) return null;
  const from = Number(fromS);
  const to = toS === undefined ? from : Number(toS);
  if (!(from >= 1) || to < from) return null;
  // Split on \n after stripping \r, so a CRLF checkout does not shift every quote by a byte.
  const lines = readFileSync(abs, "utf8").replace(/\r\n/g, "\n").split("\n");
  if (to > lines.length) return null;             // a line past EOF does not resolve
  return lines.slice(from - 1, to).join("\n");
}
// join()/sep without importing sep separately, kept local so the confinement read stays one function.
function require$sep() { return join("a", "b").slice(1, 2); }

function loadFixtures(dir) {
  const root = resolve(dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) die(`not a directory: ${dir}`);
  const out = [];
  for (const name of readdirSync(root).sort()) {
    const fx = join(root, name);
    if (!statSync(fx).isDirectory()) continue;
    const cf = join(fx, "candidates.json");
    if (!existsSync(cf)) continue;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(cf, "utf8"));
    } catch (e) {
      die(`${name}/candidates.json is not valid JSON: ${e.message}`);
    }
    const rows = Array.isArray(parsed) ? parsed : parsed.candidates;
    if (!Array.isArray(rows)) die(`${name}/candidates.json must be an array (or {candidates:[…]})`);
    out.push({ name, root: fx, rows });
  }
  if (!out.length) die(`no fixture with a candidates.json under ${dir}`);
  return out;
}

const fixtures = loadFixtures(fixturesDir);

// ---- integrity first: a fixture whose own quote does not match its own subject invalidates the run.
// A quote that fails to match is NOT automatically a broken fixture -- the near-miss candidates are
// SUPPOSED to fail at their stated cite. The fixture is broken only if a quote matches NOWHERE in its
// own subject file, which means the fixture author transcribed it wrong.
const broken = [];
for (const fx of fixtures) {
  for (const c of fx.rows) {
    if (c.quote === null || c.quote === undefined) continue;
    const at = readCite(fx.root, c.cite);
    if (at === c.quote) continue;
    const m = /^(.+?):\d+(?:-\d+)?$/.exec(String(c.cite ?? ""));
    let foundElsewhere = false;
    const abs = m ? confinedFile(fx.root, m[1]) : null;   // SAME confinement as readCite -- see confinedFile
    if (abs !== null) {
      const body = readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
      foundElsewhere = body.split("\n").includes(c.quote) || body.includes(c.quote);
    }
    if (!foundElsewhere) broken.push(`${fx.name}/${c.id}: quote matches nowhere in ${m ? m[1] : c.cite}`);
  }
}
if (broken.length) {
  for (const b of broken) process.stderr.write(`ab-run: BROKEN FIXTURE ${b}\n`);
  die(`${broken.length} candidate quote(s) match nothing in their own subject -- every number below ` +
      `would be meaningless, so this is fatal rather than a warning`, 3);
}

// ---- route every candidate under both rules
const rows = [];
for (const fx of fixtures) {
  for (const c of fx.rows) {
    const at = readCite(fx.root, c.cite);
    const resolves = at !== null;
    const hasQuote = c.quote !== null && c.quote !== undefined;
    const matches = hasQuote && resolves && at === c.quote;
    // NEW: main report iff a quote is offered AND byte-matches at the stated cite.
    const newDest = matches ? "main" : "appendix";
    // The near-miss bucket the protocol fixes: exact quote, wrong line number. Detected by finding the
    // quote elsewhere in the same file -- reviewer error, not rule error.
    let nearMiss = false;
    if (!matches && hasQuote) {
      const m = /^(.+?):\d+(?:-\d+)?$/.exec(String(c.cite ?? ""));
      const abs = m ? confinedFile(fx.root, m[1]) : null;   // SAME confinement -- see confinedFile
      if (abs !== null)
        nearMiss = readFileSync(abs, "utf8").replace(/\r\n/g, "\n").split("\n").includes(c.quote);
    }
    rows.push({
      fixture: fx.name, id: c.id, truth: String(c.truth), quotable: c.quotable === true,
      hasQuote, resolves, matches, nearMiss, oldDest: "main", newDest,
    });
  }
}

// ---- the protocol's metrics, and nothing else
const isTrue = (r) => r.truth === "true";
const M = {
  total: rows.length,
  true_total: rows.filter(isTrue).length,
  false_total: rows.filter((r) => !isTrue(r)).length,

  // PRIMARY: false findings in the main report whose cite does not resolve or quote does not match.
  old_unresolvable_false_in_main: rows.filter((r) => !isTrue(r) && !r.matches).length,
  new_unresolvable_false_in_main: rows.filter((r) => !isTrue(r) && !r.matches && r.newDest === "main").length,

  // SECONDARY: true findings demoted. A cost, not a loss.
  old_true_in_appendix: 0,
  new_true_in_appendix: rows.filter((r) => isTrue(r) && r.newDest === "appendix").length,

  // INTEGRITY GATE: nothing may vanish. Every candidate lands in exactly one of two sections under
  // NEW, so this is 0 by construction -- and it is asserted rather than assumed, because "by
  // construction" is what every lost finding was before it was lost.
  true_lost: rows.filter((r) => isTrue(r) && r.newDest !== "main" && r.newDest !== "appendix").length,

  // REPORTED, EXCLUDED FROM THE VERDICT: a byte-match cannot catch these and NEW does not claim to.
  supported_false_in_main: rows.filter((r) => !isTrue(r) && r.matches).length,

  // OWN BUCKET: exact quote, wrong line. Reviewer error, one re-cite from verified.
  near_miss_demoted: rows.filter((r) => r.nearMiss).length,
};
M.reduction = M.old_unresolvable_false_in_main - M.new_unresolvable_false_in_main;

// ---- COMPUTED AFTER THE FIRST RUN, AND DELIBERATELY NOT PART OF THE PASS CONDITION.
//
// The protocol fixed its metrics before this file existed, and that ordering is not negotiable: a
// metric chosen after the numbers is not a metric. But the forbidden move is swapping in a metric that
// FLATTERS the result, and this one does the opposite -- so leaving it out would be the dishonest
// choice, not the disciplined one.
//
// The primary metric asks "did NEW remove the class it claims to?" (yes, all of it). This asks a
// different question the protocol never posed: "is the main report MORE TRUE than before?" NEW demotes
// true findings as well as false ones, so the answer can be no even when the primary metric is a clean
// sweep. Both numbers are real and they point different ways, which is precisely the situation
// ADR-0603's owner-judge exists for -- a computation cannot decide whether a verifiable-but-smaller
// report beats a larger mixed one.
const inNewMain = rows.filter((r) => r.newDest === "main");
const pct = (a) => (a.length ? Number(((a.filter(isTrue).length / a.length) * 100).toFixed(1)) : null);
M.composition = {
  old_main_findings: rows.length,
  old_main_true: rows.filter(isTrue).length,
  old_main_false: rows.filter((r) => !isTrue(r)).length,
  old_main_precision_pct: pct(rows),
  new_main_findings: inNewMain.length,
  new_main_true: inNewMain.filter(isTrue).length,
  new_main_false: inNewMain.filter((r) => !isTrue(r)).length,
  new_main_precision_pct: pct(inNewMain),
  removed_true: rows.filter((r) => isTrue(r) && r.newDest === "appendix").length,
  removed_false: rows.filter((r) => !isTrue(r) && r.newDest === "appendix").length,
};
M.composition.precision_delta_pts = M.composition.new_main_precision_pct === null
  ? null
  : Number((M.composition.new_main_precision_pct - M.composition.old_main_precision_pct).toFixed(1));

// ---- the verdict, exactly as the protocol fixed it
let verdict;
if (M.true_lost > 0) verdict = "FAIL";
else if (M.reduction <= 0) verdict = "BELOW-BAR";
else verdict = "NEW-WINS";

// ---- --render: the report a human would actually receive under one rule.
//
// This is what ADR-0603's blind judgement is FOR. The metrics above cannot decide whether a smaller
// verifiable report beats a larger mixed one -- that is a question about how a reader uses a review,
// and it is the one question this whole run leaves open. So render both and let the owner read them
// with no labels, no counts of what is true, and no idea which rule produced which.
//
// Deliberately NOT rendered: the `truth` column. A reader who can see which findings are real is not
// judging the report, they are grading the fixture. `why` is omitted for the same reason.
if (render) {
  const claims = new Map();
  for (const fx of fixtures) for (const c of fx.rows) claims.set(`${fx.name}/${c.id}`, c);
  const main = render === "OLD" ? rows : rows.filter((r) => r.newDest === "main");
  const appendix = render === "OLD" ? [] : rows.filter((r) => r.newDest === "appendix");

  const out = [];
  out.push(`# Security audit -- findings`);
  out.push("");
  if (render === "NEW")
    out.push(`Appendix -- unverified: ${appendix.length} entries.`, "");
  out.push(`${main.length} findings.`, "");
  for (const r of main) {
    const c = claims.get(`${r.fixture}/${r.id}`);
    out.push(`### ${r.fixture} / ${r.id}`);
    out.push(`- **claim:** ${c.claim}`);
    out.push(`- **cite:** \`${c.cite}\``);
    if (render === "NEW") out.push(`- **quote:** \`${String(c.quote).replace(/\n/g, "\\n")}\``);
    out.push("");
  }
  if (render === "NEW" && appendix.length) {
    out.push(`## Appendix -- unverified`, "");
    out.push(`${appendix.length} entries. Provisional severity only; none of these is a tracked issue.`, "");
    for (const r of appendix) {
      const c = claims.get(`${r.fixture}/${r.id}`);
      const missing = !r.hasQuote ? "no quote offered"
        : !r.resolves ? "citation does not resolve"
        : "quote does not match the cited line";
      out.push(`### ${r.fixture} / ${r.id}`);
      out.push(`- **claim:** ${c.claim}`);
      out.push(`- **cite:** \`${c.cite}\``);
      out.push(`- **unverified because:** ${missing}`);
      out.push("");
    }
  }
  process.stdout.write(out.join("\n"));
  process.exit(0);
}

if (asJson) {
  process.stdout.write(JSON.stringify({ metrics: M, verdict, rows }, null, 2) + "\n");
} else {
  process.stdout.write(`ab-run: ${fixtures.length} fixture(s), ${M.total} candidate(s)\n`);
  process.stdout.write(`  truth split                          true ${M.true_total} / false ${M.false_total}\n`);
  process.stdout.write(`  PRIMARY unresolvable-false-in-main   OLD ${M.old_unresolvable_false_in_main} -> NEW ${M.new_unresolvable_false_in_main}   (reduction ${M.reduction})\n`);
  process.stdout.write(`  SECONDARY true-in-appendix           OLD ${M.old_true_in_appendix} -> NEW ${M.new_true_in_appendix}   (cost, not loss)\n`);
  process.stdout.write(`  GATE     true-lost                   ${M.true_lost}   (must be 0)\n`);
  process.stdout.write(`  excluded supported-false-in-main     ${M.supported_false_in_main}   (byte-match cannot catch; not claimed)\n`);
  process.stdout.write(`  bucket   near-miss-demoted           ${M.near_miss_demoted}   (reviewer error, one re-cite away)\n`);
  const c = M.composition;
  process.stdout.write(`  --- composition: NOT part of the pass condition, reported because it complicates it ---\n`);
  process.stdout.write(`  main report OLD  ${String(c.old_main_findings).padStart(2)} findings  ${c.old_main_true} true / ${c.old_main_false} false  precision ${c.old_main_precision_pct}%\n`);
  process.stdout.write(`  main report NEW  ${String(c.new_main_findings).padStart(2)} findings  ${c.new_main_true} true / ${c.new_main_false} false  precision ${c.new_main_precision_pct}%  (delta ${c.precision_delta_pts >= 0 ? "+" : ""}${c.precision_delta_pts} pts)\n`);
  process.stdout.write(`  removed from main ${c.removed_true} TRUE + ${c.removed_false} false -- NEW removes more truth than falsehood in absolute terms\n`);
  process.stdout.write(`ab-run: VERDICT ${verdict}  (on the PRE-COMMITTED pass condition; read the composition line before believing it means "better")\n`);
  for (const r of rows)
    process.stdout.write(
      `  ${r.fixture}/${r.id}  truth=${r.truth.padEnd(5)} quote=${r.hasQuote ? "yes" : "no "} ` +
      `resolves=${r.resolves ? "yes" : "no "} match=${r.matches ? "yes" : "no "} ` +
      `${r.nearMiss ? "near-miss " : ""}OLD=main NEW=${r.newDest}\n`);
}
