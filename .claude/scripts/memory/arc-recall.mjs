#!/usr/bin/env node
// arc-recall -- ask the company what it already learned.
//
// ADR-0702: output is VERBATIM and prevention-first, and every row carries a repo-relative path.
// A bare number is never printed alone, because a number with no path is a claim nobody can check.
// ADR-0709: a curated alias layer, no stemming, no embeddings; `--grep` is the honest escape valve
// for when ranking fails, and it says so rather than pretending ranking always works.
// ADR-0707: root-mode first. `lane` is provenance metadata, so `--lane` in a tree with no lanes is
// an empty result at exit 0, never an error.
// ADR-0701: `--engine` is the seam the sqlite accelerator plugs into in Phase 2. Today `auto`
// resolves to `js` and prints which engine actually ran -- a dispatch that hides its choice is a
// dispatch nobody can audit.
//
// Invocation is always `node .claude/scripts/memory/arc-recall.mjs ...` from the repo root.
//
// Exit codes: 0 ran (ZERO RESULTS IS A RESULT) · 1 internal error · 2 bad usage ·
//             3 index unavailable and the rebuild also failed, naming the cause.

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

import { indexPath, build, writeIndex, isStale, verify } from "./memory-index.mjs";
import { search } from "./lib/bm25.mjs";
import { sanitizeQuery, tokenize } from "./lib/tokenize.mjs";
import { parseAliases, expand } from "./lib/aliases.mjs";

export const ALIAS_FILE = "docs/memory/aliases.md";
const ENGINES = new Set(["js", "auto"]);
const SOURCES = new Set(["retro-log", "trial-ledger", "learning-ledger", "adr", "decisions"]);

class UsageError extends Error {}

function gitToplevel() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return process.cwd();
  }
}

// ---------- argv ----------
const VALUE_FLAGS = new Set(["--tag", "--source", "--since", "--lane", "--limit", "--full", "--grep", "--root", "--engine"]);
const BOOL_FLAGS = new Set(["--json", "--rebuild", "--full-text"]);

export function parseArgs(argv) {
  const o = { query: [], tag: null, source: null, since: null, lane: null, limit: 5, full: null, grep: null, root: null, engine: "auto", json: false, rebuild: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUE_FLAGS.has(a)) {
      // A repeated value flag is an operator error, never last-wins. Same rule as memory-index and
      // as `.claude/rules/lanes.md`: silently picking one of two named values IS the never-guess
      // failure this repo has already paid for once.
      if (seen.has(a)) throw new UsageError(`${a} given twice -- that is an operator error, not a last-wins override`);
      seen.add(a);
      const v = argv[++i];
      if (v === undefined) throw new UsageError(`${a} needs a value`);
      if (v.trim() === "" && a !== "--grep") throw new UsageError(`${a} was named but is empty -- refusing to guess what you meant`);
      switch (a) {
        case "--tag": o.tag = v; break;
        case "--source":
          if (!SOURCES.has(v)) throw new UsageError(`--source ${JSON.stringify(v)} is not one of: ${[...SOURCES].join(", ")}`);
          o.source = v; break;
        case "--since":
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new UsageError(`--since ${JSON.stringify(v)} is not a YYYY-MM-DD date`);
          o.since = v; break;
        case "--lane": o.lane = v; break;
        case "--limit": {
          // Not Number(v): Number("") is 0, Number("  3 ") is 3, and Number("3abc") is NaN which
          // a lazy check turns into a silent default. An unusable limit is usage, not a guess.
          if (!/^\d+$/.test(v)) throw new UsageError(`--limit ${JSON.stringify(v)} is not a non-negative integer`);
          o.limit = Number(v);
          if (o.limit > 1000) throw new UsageError("--limit above 1000 is refused; recall is for reading, not for dumping the index");
          break;
        }
        case "--full": o.full = v; break;
        case "--grep": o.grep = v; break;
        case "--root": o.root = v; break;
        case "--engine":
          if (!ENGINES.has(v)) throw new UsageError(`--engine ${JSON.stringify(v)} is not one of: js, auto (sqlite arrives in Phase 2)`);
          o.engine = v; break;
      }
      continue;
    }
    if (BOOL_FLAGS.has(a)) { if (a === "--json") o.json = true; else if (a === "--rebuild") o.rebuild = true; continue; }
    if (a.startsWith("--")) throw new UsageError(`unknown flag ${a}`);
    o.query.push(a);
  }
  return o;
}

// ---------- index access ----------
async function loadIndex(root, opts) {
  const p = indexPath(root);
  const stale = isStale(root);
  if (opts.rebuild || stale.stale) {
    // A stale index answering confidently is pre-mortem row 4 -- recall returning a rule that has
    // since changed. Rebuild rather than serve it.
    let index;
    try {
      index = await build(root, { allowMissingSpine: true });
    } catch (e) {
      throw Object.assign(new Error(`the index is unavailable (${stale.why}) and the rebuild failed: ${e.message}`), { exitCode: 3 });
    }
    const failures = verify(index, null, null, { allowMissingSpine: true, allowEmptyOrgan: true });
    if (failures.length) {
      throw Object.assign(new Error(`the index is unavailable (${stale.why}) and the rebuild failed its own checks: ${failures[0]}`), { exitCode: 3 });
    }
    try { writeIndex(root, index); } catch { /* a read-only tree still gets an answer from memory */ }
    return { index, rebuilt: true, why: stale.why };
  }
  if (!existsSync(p)) throw Object.assign(new Error("no index and no rebuild was possible"), { exitCode: 3 });
  try {
    return { index: JSON.parse(readFileSync(p, "utf8")), rebuilt: false, why: stale.why };
  } catch (e) {
    throw Object.assign(new Error(`the index at ${p} is unreadable: ${e.message}`), { exitCode: 3 });
  }
}

// ---------- filters ----------
export function applyFilters(records, o) {
  let out = records;
  if (o.source) out = out.filter((r) => r.organ === o.source);
  if (o.tag) {
    const want = tokenize(o.tag).join(" ");
    out = out.filter((r) => (r.tags ?? []).some((t) => tokenize(t).join(" ") === want));
  }
  if (o.since) out = out.filter((r) => String(r.fields?.date ?? r.fields?.ts ?? "").slice(0, 10) >= o.since);
  if (o.lane) {
    // ADR-0707: `lane` is provenance, carried only by records that happen to record one. In a tree
    // with no lanes this is an EMPTY RESULT at exit 0, not an error -- root-mode is the permanent
    // consumer contract, and a venture repo must never see a lane concept it does not have.
    out = out.filter((r) => (r.fields?.links?.lane ?? r.fields?.lane) === o.lane);
  }
  return out;
}

// ---------- rendering ----------
const citationOf = (r) => (r.organ === "decisions" ? `${r.path} ${r.fields.ulid}` : `${r.path}:${r.line}`);

function renderRow(r, i, o) {
  const lines = [];
  lines.push(`${String(i + 1).padStart(2)}. [${r.id}]  ${citationOf(r)}`);
  const body = o.full === null ? r.body : `${r.body}\n${JSON.stringify(r.fields, null, 2)}`;
  // VERBATIM. The body is reproduced as recorded, never summarised and never re-wrapped -- the
  // retro-log's own header law is "read as-is, never summarized", and a recall surface that
  // paraphrases the organ has quietly become a second, worse copy of it.
  for (const l of String(body).split("\n")) lines.push(`    ${l}`);
  if (r.tags?.length) lines.push(`    tags: ${r.tags.join(", ")}`);
  return lines.join("\n");
}

// ---------- main ----------
async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(`arc-recall: ${e.message}`); process.exit(2); }

  const root = resolve(o.root ?? gitToplevel());
  if (!existsSync(root)) { console.error(`arc-recall: --root ${o.root} does not exist`); process.exit(2); }

  const queryText = o.query.join(" ");
  if (!queryText && !o.full && o.grep === null && !o.rebuild) {
    console.error("arc-recall: nothing to look up -- give a query, --full <id>, --grep <text>, or --rebuild");
    process.exit(2);
  }

  let loaded;
  try { loaded = await loadIndex(root, o); }
  catch (e) { console.error(`arc-recall: ${e.message}`); process.exit(e.exitCode ?? 1); }
  const { index, rebuilt, why } = loaded;
  const records = index.records ?? [];

  // --full <id>: the whole record, exactly as recorded.
  if (o.full) {
    const r = records.find((x) => x.id === o.full);
    if (!r) {
      // Zero results IS a result. Exit 0, and say what was looked for.
      if (o.json) console.log(JSON.stringify({ query: o.full, engine: "js", results: [] }));
      else console.log(`no record with id ${o.full} (the index holds ${records.length})`);
      process.exit(0);
    }
    if (o.json) console.log(JSON.stringify({ query: o.full, engine: "js", results: [r] }, null, 2));
    else { console.log(renderRow(r, 0, { ...o, full: o.full })); }
    process.exit(0);
  }

  const pool = applyFilters(records, o);

  // --grep: the honest escape valve (ADR-0709). Literal substring, no ranking, no aliases -- and
  // it says which it is, so nobody mistakes it for the ranked path.
  if (o.grep !== null) {
    const needle = o.grep.toLowerCase();
    const hits = pool.filter((r) => `${r.title}\n${r.body}`.toLowerCase().includes(needle)).slice(0, o.limit);
    if (o.json) { console.log(JSON.stringify({ query: o.grep, mode: "grep", engine: "literal", results: hits }, null, 2)); process.exit(0); }
    console.log(`grep "${o.grep}" -- literal substring, unranked (${hits.length} of ${pool.length} record(s))`);
    hits.forEach((r, i) => console.log(renderRow(r, i, o)));
    process.exit(0);
  }

  const { tokens: rawTokens, notes } = sanitizeQuery(queryText);
  let aliasRows = [];
  const aliasPath = join(root, ALIAS_FILE);
  if (existsSync(aliasPath)) {
    try { aliasRows = parseAliases(readFileSync(aliasPath, "utf8")).rows; }
    catch { aliasRows = []; }
  }
  const { tokens, fired } = expand(rawTokens, aliasRows);

  // The engine seam REQ-07 plugs sqlite into. `auto` resolves to `js` today and SAYS so.
  const engine = "js";
  const hits = search(index.postings ?? { terms: {}, lengths: [], avgdl: 0 }, records, tokens, { limit: o.limit * 4 });
  const filtered = new Set(pool.map((r) => r.id));
  const results = hits.filter((h) => filtered.has(records[h.index].id)).slice(0, o.limit);

  if (o.json) {
    console.log(JSON.stringify({
      query: queryText, engine, requested: o.engine, tokens, aliases: fired, notes,
      results: results.map((h) => ({ ...records[h.index], score: h.score, citation: citationOf(records[h.index]) })),
    }, null, 2));
    process.exit(0);
  }

  console.log(`recall "${queryText}"  (engine ${engine}, requested ${o.engine}; ${results.length} of ${pool.length} record(s))`);
  if (rebuilt) console.log(`  index rebuilt first: ${why}`);
  for (const n of notes) console.log(`  note: ${n}`);
  console.log("");
  results.forEach((h, i) => { console.log(renderRow(records[h.index], i, o)); console.log(""); });
  if (results.length === 0) console.log("  no recorded lesson matched. That is a result, not an error -- try --grep for a literal search.\n");
  // An expansion nobody can see is an expansion nobody can correct.
  for (const f of fired) console.log(`  alias: ${f.terms.join("/")} -> ${f.added.join(", ")}  (${f.why})`);
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`arc-recall: ${e.stack || e.message}`); process.exit(1); });
}
