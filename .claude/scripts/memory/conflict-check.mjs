#!/usr/bin/env node
// conflict-check -- surface near-duplicate retro rows BEFORE a new one is appended (REQ-05).
//
// ADR-0705: the check runs at WRITE time, inside `/arc-retro`, before the append. It SURFACES and
// never resolves. No auto-merge, no rewrite, no block -- so a hit is exit 0 with the candidate
// rows printed verbatim, and the author proceeds or merges ON THE RECORD. A check that blocked
// would make the author delete the row to get past it, which is how a lesson gets lost.
//
// Detection is LEXICAL ONLY, and the output says so. Semantic contradiction detection is out of
// scope in writing, so that a later cycle cannot quietly claim this check does something it
// cannot do.
//
// A pair is a candidate when BOTH hold:
//   - candidate and existing row share >= 2 tags, AND
//   - Jaccard overlap of their normalized prevention tokens >= T (default 0.5)
//
// JACCARD, NAMED: |A n B| / |A u B| -- symmetric, over the token SET. The alternative, the overlap
// coefficient |A n B| / min(|A|,|B|), scores 1.0 whenever a short row's tokens all sit inside a
// longer one, which fires on every terse prevention line ever written. The formula is printed
// beside the number because "overlap >= 0.5" with no formula next to it is a number nobody can
// check, and because a gate that transforms what it measures must declare the transform.
//
// NO STOPLIST, deliberately. `tokenize` is this module's ONE normalizer and the index already
// uses it, so the two surfaces cannot disagree about what a word is (ADR-0709: no stemming).
// Function words therefore count toward both intersection and union. That makes the check MORE
// eager, not less, which is precisely what the assumptions ledger's retune trigger measures:
// fires on more than 1 in 3 real appends with no genuine near-duplicate -> T is retuned, not
// tolerated. Guessing a stoplist now would pre-empt the measurement that decides the value.
//
// This is a fourth sibling beside memory-index.mjs / arc-recall.mjs / golden-check.mjs, which is
// this module's existing shape, rather than a fourth mode bolted onto the recall CLI: the score
// here is not bm25 and the surface is a write-time check, not a query.
//
// Exit codes: 0 ran, hits or not (SURFACING IS NOT BLOCKING) · 1 internal · 2 bad usage.

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { parse as parseRetroLog } from "./adapters/retro-log.mjs";
import { tokenize } from "./lib/tokenize.mjs";

export const RETRO_LOG = "docs/retro-log.md";
export const DEFAULT_THRESHOLD = 0.5;
export const MIN_SHARED_TAGS = 2;

class UsageError extends Error {}

// ---------- scoring ----------

/** Tags compare on their normalized form, so `CI` and `ci` are one tag and not two. */
export function normalizeTags(tags) {
  const out = new Set();
  for (const t of tags ?? []) {
    const n = tokenize(String(t)).join("-");
    if (n) out.add(n);
  }
  return out;
}

/** |A n B| / |A u B| over the token SET. Two empty texts are 0, never 1: an empty prevention
 *  line is a malformed row, and scoring it a perfect match would surface every one of them. */
export function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Which recorded rows are near-duplicates of this candidate?
 *
 * Pure: takes already-parsed records, returns scored pairs. The I/O lives in main() so the rule
 * itself can be attacked directly, without a filesystem.
 */
export function findNearDuplicates(candidate, records, opts = {}) {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const minTags = opts.minSharedTags ?? MIN_SHARED_TAGS;
  const candTags = normalizeTags(candidate.tags);
  const candTokens = tokenize(candidate.prevention ?? "");
  const hits = [];
  for (const r of records ?? []) {
    const rowTags = normalizeTags(r.tags);
    const shared = [...candTags].filter((t) => rowTags.has(t));
    // The AND is evaluated in full and both halves are REPORTED, so a pair that missed on one
    // criterion can be told apart from a pair that missed on the other. A check that prints only
    // its verdict cannot be retuned by the person reading it.
    if (shared.length < minTags) continue;
    const overlap = jaccard(candTokens, tokenize(r.fields?.prevention ?? ""));
    if (overlap < threshold) continue;
    hits.push({ record: r, sharedTags: shared, overlap });
  }
  // Strongest first, then by line, so the order is a property of the data and of nothing else.
  hits.sort((x, y) => (y.overlap - x.overlap) || ((x.record.line ?? 0) - (y.record.line ?? 0)));
  return hits;
}

// ---------- argv ----------
const VALUE_FLAGS = new Set(["--prevention", "--tags", "--root", "--threshold", "--limit"]);
const BOOL_FLAGS = new Set(["--json"]);

export function parseArgs(argv) {
  const o = { prevention: null, tags: null, root: null, threshold: DEFAULT_THRESHOLD, limit: 10, json: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUE_FLAGS.has(a)) {
      // Same three rules the recall CLI already enforces, for the same three recorded reasons:
      // a repeated flag is an operator error and never last-wins; an empty value is a quoted
      // unset variable and never "match everything"; a flag-shaped value means an empty variable
      // ate the next argument.
      if (seen.has(a)) throw new UsageError(`${a} given twice -- that is an operator error, not a last-wins override`);
      seen.add(a);
      const v = argv[++i];
      if (v === undefined) throw new UsageError(`${a} needs a value`);
      if (v.trim() === "") throw new UsageError(`${a} was named but is empty -- refusing to guess what you meant`);
      if (v.startsWith("--")) throw new UsageError(`${a} was given ${JSON.stringify(v)}, which is a flag, not a value -- an empty variable ate the next argument`);
      switch (a) {
        case "--prevention": o.prevention = v; break;
        case "--tags": o.tags = v.split(",").map((t) => t.trim()).filter(Boolean); break;
        case "--root": o.root = v; break;
        case "--threshold": {
          // Not Number(v): Number("") is 0 and Number("0.5abc") is NaN, which a lazy check turns
          // into a silent default -- and a silently-defaulted threshold makes the retune trigger
          // unmeasurable, because nobody can tell which T actually ran.
          if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(v)) throw new UsageError(`--threshold ${JSON.stringify(v)} is not a number between 0 and 1`);
          o.threshold = Number(v);
          break;
        }
        case "--limit": {
          if (!/^\d+$/.test(v)) throw new UsageError(`--limit ${JSON.stringify(v)} is not a non-negative integer`);
          o.limit = Number(v);
          if (o.limit === 0) throw new UsageError("--limit 0 would print a zero indistinguishable from a real miss; use 1 or more");
          break;
        }
      }
      continue;
    }
    if (BOOL_FLAGS.has(a)) { o.json = true; continue; }
    throw new UsageError(`unknown argument ${JSON.stringify(a)} -- this check takes flags only`);
  }
  if (o.prevention === null) throw new UsageError("--prevention <text> is required: the check compares the row you are about to write");
  if (o.tags === null) throw new UsageError("--tags <a,b,c> is required: the shared-tag half of the rule cannot run without them");
  return o;
}

function gitToplevel() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return process.cwd();
  }
}

// ---------- main ----------
function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(`conflict-check: ${e.message}`); process.exit(2); }

  const root = resolve(o.root ?? gitToplevel());
  const logPath = join(root, RETRO_LOG);
  if (!existsSync(logPath)) {
    console.error(`conflict-check: no ${RETRO_LOG} under ${root} -- there is nothing to compare against`);
    process.exit(2);
  }

  let parsed;
  try { parsed = parseRetroLog(readFileSync(logPath, "utf8")); }
  catch (e) { console.error(`conflict-check: ${RETRO_LOG} could not be read: ${e.message}`); process.exit(1); }

  const hits = findNearDuplicates({ prevention: o.prevention, tags: o.tags }, parsed.records, { threshold: o.threshold });
  const shown = hits.slice(0, o.limit);

  if (o.json) {
    console.log(JSON.stringify({
      rule: `>= ${MIN_SHARED_TAGS} shared tags AND jaccard >= ${o.threshold}`,
      metric: "jaccard", threshold: o.threshold, minSharedTags: MIN_SHARED_TAGS,
      scanned: parsed.records.length, matched: hits.length, shown: shown.length, resolves: false,
      candidates: shown.map((h) => ({
        citation: `${RETRO_LOG}:${h.record.line}`,
        overlap: Number(h.overlap.toFixed(4)),
        sharedTags: h.sharedTags,
        prevention: h.record.fields?.prevention ?? "",
        pattern: h.record.fields?.pattern ?? "",
        date: h.record.fields?.date ?? "",
      })),
    }, null, 2));
    return;
  }

  // The rule is printed EVERY run, hit or miss, with its formula and its live threshold. A
  // detector that states only its verdict cannot be retuned by the person reading it, and the
  // assumptions ledger's trigger needs to know which T actually ran.
  console.log(`conflict-check -- lexical only, no semantic detection (ADR-0705)`);
  console.log(`  rule: >= ${MIN_SHARED_TAGS} shared tags AND jaccard(prevention tokens) >= ${o.threshold}`);
  console.log(`  jaccard = shared tokens / union of tokens; scanned ${parsed.records.length} recorded row(s)`);
  if (hits.length === 0) {
    console.log(`  no near-duplicate found. Append the row.`);
    return;
  }
  console.log(`  showing ${shown.length} of ${hits.length} near-duplicate(s) -- SHOWN, never resolved: proceed or merge on the record.\n`);
  shown.forEach((h, i) => {
    const r = h.record;
    console.log(`${String(i + 1).padStart(2)}. ${RETRO_LOG}:${r.line}  jaccard ${h.overlap.toFixed(2)}, shared tags: ${h.sharedTags.join(", ")}`);
    // VERBATIM, exactly as recorded -- this is the row a human is about to decide about.
    console.log(`    ${r.fields?.date ?? ""} | ${r.fields?.project ?? ""} | ${r.fields?.pattern ?? ""}`);
    console.log(`    prevention: ${r.fields?.prevention ?? ""}`);
    console.log(`    tags: ${(r.tags ?? []).join(", ")}\n`);
  });
  console.log(`  Nothing was written. This check reads ${RETRO_LOG} and never edits it.`);
}

// realpath BOTH sides: node ESM realpaths the entry module while argv[1] keeps any symlink, so an
// exact URL compare is false under a symlinked path and the CLI exits 0 having done nothing.
function invokedDirectly() {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  const self = fileURLToPath(import.meta.url);
  try { return realpathSync(argv1) === realpathSync(self); } catch { return resolve(argv1) === resolve(self); }
}

if (invokedDirectly()) {
  try { main(); }
  catch (e) { console.error(`conflict-check: ${e.stack || e.message}`); process.exitCode = 1; }
}
