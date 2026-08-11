#!/usr/bin/env node
// arc-recall -- ask the company what it already learned.
//
// ADR-0702: output is VERBATIM and prevention-first, and every row carries a repo-relative path.
// A bare number is never printed alone, because a number with no path is a claim nobody can check.
// ADR-0709: a curated alias layer, no stemming, no embeddings; `--grep` is the honest escape valve
// for when ranking fails, and it says so rather than pretending ranking always works.
// ADR-0707: root-mode first. `lane` is provenance metadata, so `--lane` in a tree with no lanes is
// an empty result at exit 0, never an error.
// ADR-0701 (amended 2026-08-11): the sqlite engine is CUT, on the measurement the ADR asked for --
// Phase 01 clocked the search at 0.42ms of a 199ms wall, so it would have accelerated 0.2% of the
// elapsed time. `--engine` remains the SEAM, and it is a real one: names come from the registry in
// lib/engines.mjs and `auto` resolves THROUGH it, so the CLI and the equivalence harness cannot
// drift apart. Today that registry holds one entry and the run prints which engine actually ran --
// a dispatch that hides its choice is a dispatch nobody can audit.
//
// Invocation is always `node .claude/scripts/memory/arc-recall.mjs ...` from the repo root.
//
// Exit codes: 0 ran (ZERO RESULTS IS A RESULT) · 1 internal error · 2 bad usage ·
//             3 index unavailable and the rebuild also failed, naming the cause.

import { readFileSync, existsSync , realpathSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { indexPath, build, writeIndex, isStale, verify, readIndex } from "./memory-index.mjs";
import { search } from "./lib/bm25.mjs";
import { sanitizeQuery, tokenize } from "./lib/tokenize.mjs";
import { parseAliases, expand } from "./lib/aliases.mjs";
import { recordSurfaced } from "./lib/observe.mjs";
import { ENGINES as ENGINE_REGISTRY, resolveEngine } from "./lib/engines.mjs";

export const ALIAS_FILE = "docs/memory/aliases.md";
// Derived from the registry, never a second hand-kept list: two lists of engine names drift, and
// the one that drifts is always the one the operator types against. `auto` is not an engine, it
// is the instruction to pick one, so it is added here and nowhere else (REQ-07, ADR-0701).
const ENGINE_NAMES = new Set([...ENGINE_REGISTRY.map((e) => e.name), "auto"]);
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
const VALUE_FLAGS = new Set(["--tag", "--source", "--since", "--lane", "--limit", "--full", "--grep", "--root", "--engine", "--decisions"]);
// `--full-text` used to sit here with no dispatch arm: accepted, silently dead, and absent from
// the phase spec's CLI surface. An accepted-but-inert flag is worse than a rejected one, because
// the operator believes it took effect.
const BOOL_FLAGS = new Set(["--json", "--rebuild"]);

// ---------- the --decisions grammar (REQ-04, ADR-0703) ----------
// Whitespace-separated terms, ANDed. `field:value` is an exact match on the recorded string;
// `field~value` is a case-insensitive substring. The fields are exactly the closed
// `decision.recorded` payload plus its provenance -- naming anything else is a USAGE error and
// never a silently-empty result, because a filter that quietly matched nothing is byte-identical
// to a real miss. This is the `--full-text` lesson from Phase 01 applied before it can recur:
// an accepted-but-inert term is worse than a rejected one, because the operator believes it took
// effect. Reader-only: this filters records the index already holds, and opens no spine of its own.
export const DECISION_FIELDS = new Set(["verdict", "reason", "decides", "ulid", "ts"]);

export function parseDecisionFilter(expr) {
  const raw = String(expr ?? "").trim();
  // Unreachable through argv -- the empty-value guard in parseArgs fires first -- but this
  // function is exported, and an exported parser is called directly by the adversarial pass.
  if (!raw) throw new UsageError("--decisions was given no terms at all");
  const terms = [];
  const seenField = new Set();
  for (const term of raw.split(/\s+/)) {
    // Whichever separator comes FIRST decides the operator. A colon INSIDE a substring value
    // (`reason~mode-B:uncertified`) must not silently retarget the match to an exact one.
    const c = term.indexOf(":");
    const t = term.indexOf("~");
    const i = c === -1 ? t : t === -1 ? c : Math.min(c, t);
    if (i === -1) throw new UsageError(`--decisions term ${JSON.stringify(term)} has no operator -- write field:value for an exact match, or field~value for a substring`);
    const field = term.slice(0, i);
    const op = term[i];
    const value = term.slice(i + 1);
    if (!field) throw new UsageError(`--decisions term ${JSON.stringify(term)} names no field before the ${JSON.stringify(op)}`);
    if (!DECISION_FIELDS.has(field)) throw new UsageError(`--decisions field ${JSON.stringify(field)} is not one of: ${[...DECISION_FIELDS].join(", ")}`);
    if (!value) throw new UsageError(`--decisions term ${JSON.stringify(term)} has an empty value -- refusing to guess what you meant`);
    // A repeated field is an AND that usually cannot match at all (`verdict:reject verdict:approve`
    // is always zero). Same rule as a repeated value flag: an operator error, never last-wins.
    if (seenField.has(field)) throw new UsageError(`--decisions names ${JSON.stringify(field)} twice -- that is an operator error, not a last-wins override`);
    seenField.add(field);
    terms.push({ field, op, value });
  }
  return terms;
}

/** Every term must hold. A field the record does not carry is "", which matches nothing but `~`
 *  of the empty string -- and an empty value is refused at parse time, so it cannot arise. */
export function matchesDecision(r, terms) {
  return terms.every((t) => {
    const v = String(r?.fields?.[t.field] ?? "");
    return t.op === ":" ? v === t.value : v.toLowerCase().includes(t.value.toLowerCase());
  });
}

export function parseArgs(argv) {
  const o = { query: [], tag: null, source: null, since: null, lane: null, limit: 5, full: null, grep: null, root: null, engine: "auto", json: false, rebuild: false, decisions: null, decisionsExpr: null };
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
      // No carve-out for --grep. `--grep "$VAR"` with VAR unset is the QUOTED form the lane rules
      // mandate, and the exemption turned it into "print the whole index" -- the same shape as
      // `--root ""` becoming cwd, re-introduced deliberately.
      if (v.trim() === "") throw new UsageError(`${a} was named but is empty -- refusing to guess what you meant`);
      // A flag-shaped value is the lanes.md defect verbatim: an unquoted empty value eats the
      // next flag. `--tag --json "q"` silently consumed --json as the tag and then printed
      // non-JSON on stdout at exit 0, which the --json contract forbids outright.
      if (v.startsWith("--")) throw new UsageError(`${a} was given ${JSON.stringify(v)}, which is a flag, not a value -- an empty variable ate the next argument`);
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
          // `--limit 0` produced a result set byte-identical to a genuine miss -- a typo turned
          // into a confident false negative with nothing to distinguish it.
          if (o.limit === 0) throw new UsageError("--limit 0 would print a zero indistinguishable from a real miss; use 1 or more");
          if (o.limit > 1000) throw new UsageError("--limit above 1000 is refused; recall is for reading, not for dumping the index");
          break;
        }
        case "--full": o.full = v; break;
        case "--grep": o.grep = v; break;
        case "--root": o.root = v; break;
        case "--engine":
          if (!ENGINE_NAMES.has(v)) throw new UsageError(`--engine ${JSON.stringify(v)} is not one of: ${[...ENGINE_NAMES].join(", ")}`);
          o.engine = v; break;
        // Parsed EAGERLY, so a malformed expression is exit 2 before any index is read or built.
        case "--decisions": o.decisions = parseDecisionFilter(v); o.decisionsExpr = v; break;
      }
      continue;
    }
    // `--` ends flag parsing. Without it the ranked path could never search for "--limit" or
    // "--allow-missing-spine" -- and the organs this tool indexes are documents ABOUT flags, so
    // those are exactly the queries people type.
    if (a === "--") { for (let j = i + 1; j < argv.length; j++) o.query.push(argv[j]); break; }
    if (BOOL_FLAGS.has(a)) { if (a === "--json") o.json = true; else o.rebuild = true; continue; }
    if (a.startsWith("--")) throw new UsageError(`unknown flag ${a}`);
    o.query.push(a);
  }
  return o;
}

// ---------- index access ----------
export const INDEX_VERSION = 2;

/**
 * Is this object actually an index this build can answer from?
 *
 * `{}` used to pass every check: `isStale` iterates `index.manifest ?? {}`, so an ABSENT manifest
 * is zero iterations and then "manifest matches" -- making the index MORE broken defeated the
 * freshness check. And nothing read `index.version`, so a v1 index (no postings) answered every
 * ranked query with a confident zero while `--grep` on the same file found the records.
 * `loadExpect` already refuses null/[]/{}/5 for exactly this reason; this is that fix applied to
 * the function next door, which is where it was never made.
 */
export function indexShapeError(index) {
  if (index === null || typeof index !== "object" || Array.isArray(index)) return "it is not a JSON object";
  if (index.version !== INDEX_VERSION) return `it is schema version ${JSON.stringify(index.version)}, and this build reads version ${INDEX_VERSION} -- delete it and rebuild`;
  if (!Array.isArray(index.records)) return "it carries no records array";
  if (!index.manifest || typeof index.manifest !== "object") return "it carries no staleness manifest, so freshness cannot be checked at all";
  if (!index.postings || typeof index.postings.terms !== "object") return "it carries no postings, so every ranked query would return a confident zero";
  return null;
}

async function loadIndex(root, opts) {
  const p = indexPath(root);
  let stale = isStale(root);
  if (!stale.stale) {
    // A shapeless index is stale by definition, whatever the manifest loop concluded.
    let onDisk = null;
    try { onDisk = JSON.parse(readFileSync(p, "utf8")); } catch { onDisk = null; }
    const bad = onDisk === null ? "the index is unreadable" : indexShapeError(onDisk);
    if (bad) stale = { stale: true, why: bad };
  }
  if (opts.rebuild || stale.stale) {
    // A stale index answering confidently is pre-mortem row 4 -- recall returning a rule that has
    // since changed. Rebuild rather than serve it.
    let index;
    try {
      index = await build(root, { allowMissingSpine: true });
    } catch (e) {
      throw Object.assign(new Error(`the index is unavailable (${stale.why}) and the rebuild failed: ${e.message}`), { exitCode: 3 });
    }
    // `prior` was hardcoded null AND allowEmptyOrgan was true, so the emptied-organ channel was
    // double-disabled on the surface people actually query: memory-index exits 1 on a truncated
    // organ while recall answered "no recorded lesson matched. That is a result, not an error".
    // The prior index is read back so the guard has something to compare against.
    const prior = readIndex(root);
    const failures = verify(index, null, prior, { allowMissingSpine: true });
    if (failures.length) {
      throw Object.assign(new Error(`the index is unavailable (${stale.why}) and the rebuild failed its own checks: ${failures[0]}`), { exitCode: 3 });
    }
    const warnings = [];
    for (const [organ, o] of Object.entries(index.organs ?? {})) {
      if (o.unavailable) warnings.push(`organ "${organ}" was NOT read (${o.unavailable}); this answer is drawn from the other organs only`);
    }
    // A write failure is NAMED. It used to be swallowed whole, which silently turned every
    // invocation into a full rebuild -- measured at 175ms against 112ms on a small tree, and it
    // voids the sub-second criterion on a real one without any sign that it is happening.
    try { writeIndex(root, index); }
    catch (e) { warnings.push(`the rebuilt index could not be saved (${e.message}); every future query will rebuild from scratch`); }
    return { index, rebuilt: true, why: stale.why, warnings };
  }
  if (!existsSync(p)) throw Object.assign(new Error("no index and no rebuild was possible"), { exitCode: 3 });
  let index;
  try { index = JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { throw Object.assign(new Error(`the index at ${p} is unreadable: ${e.message}`), { exitCode: 3 }); }
  const bad = indexShapeError(index);
  if (bad) throw Object.assign(new Error(`the index at ${p} is unusable: ${bad}`), { exitCode: 3 });
  return { index, rebuilt: false, why: stale.why };
}

// ---------- filters ----------
export function applyFilters(records, o, notes = []) {
  let out = records;
  if (o.source) out = out.filter((r) => r.organ === o.source);
  if (o.tag) {
    const want = tokenize(o.tag).join(" ");
    out = out.filter((r) => (r.tags ?? []).some((t) => tokenize(t).join(" ") === want));
  }
  if (o.since) {
    // A record with no date at all yields "", and "" >= anything is false -- so `--since` used
    // to delete every ADR and every learning silently: 154 of 257 records, with no note, on a
    // query whose right answer was an ADR. Dateless records are now REPORTED, not vanished.
    const dated = out.filter((r) => /^\d{4}-\d{2}-\d{2}/.test(String(r.fields?.date ?? r.fields?.ts ?? "")));
    const undated = out.length - dated.length;
    if (undated > 0) notes.push(`--since ${o.since} cannot apply to ${undated} record(s) that carry no date at all (every ADR and every learning); they are EXCLUDED from this result`);
    out = dated.filter((r) => String(r.fields?.date ?? r.fields?.ts ?? "").slice(0, 10) >= o.since);
  }
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

  // Flags that would have been silently discarded. `--full` returned before the filters ran and
  // `--grep` returned before ranking, so a mistyped flag produced a plausible answer to a
  // question nobody asked. Refusing is the only honest option: applying them would change what
  // those two modes mean.
  if (o.full && (o.grep !== null || o.decisions !== null || o.query.length || o.tag || o.source || o.since || o.lane)) {
    console.error("arc-recall: --full takes one id and nothing else; the other arguments would have been ignored in silence");
    process.exit(2);
  }
  if (o.grep !== null && o.query.length) {
    console.error("arc-recall: --grep and a positional query are two different searches; the positional one would have been ignored in silence");
    process.exit(2);
  }
  // Same refusal, same reason, for the third listing mode. --decisions selects its own organ and
  // does not rank, so a positional query or a --grep alongside it would be dropped without a word.
  if (o.decisions !== null && o.query.length) {
    console.error("arc-recall: --decisions and a positional query are two different searches; the positional one would have been ignored in silence");
    process.exit(2);
  }
  if (o.decisions !== null && o.grep !== null) {
    console.error("arc-recall: --decisions and --grep are two different searches; give one of them");
    process.exit(2);
  }
  // --source cannot narrow --decisions, only contradict it: any value but `decisions` yields an
  // empty pool that reads exactly like "no decision matched your filter".
  if (o.decisions !== null && o.source) {
    console.error(`arc-recall: --decisions already selects the decisions organ; --source ${JSON.stringify(o.source)} could only contradict it`);
    process.exit(2);
  }

  const queryText = o.query.join(" ");
  if (!queryText && !o.full && o.grep === null && o.decisions === null && !o.rebuild) {
    console.error("arc-recall: nothing to look up -- give a query, --full <id>, --grep <text>, --decisions <filter>, or --rebuild");
    process.exit(2);
  }

  let loaded;
  try { loaded = await loadIndex(root, o); }
  catch (e) {
    // `isStale` calls `resolveSpine`, which throws on ARC_SPINE_ROOT="" -- outside the exit-3
    // wrapper, so an operator env typo was reported as exit 1, "internal error". A spine that
    // cannot be resolved is an unavailable index, not a bug in this program.
    const code = e.exitCode ?? (/ARC_SPINE_ROOT|spine/i.test(e.message) ? 3 : 1);
    console.error(`arc-recall: ${e.message}`);
    process.exit(code);
  }
  const { index, rebuilt, why, warnings = [] } = loaded;
  const records = index.records ?? [];

  // --full <id>: the whole record, exactly as recorded.
  if (o.full) {
    const r = records.find((x) => x.id === o.full);
    if (!r) {
      // Zero results IS a result. Exit 0, and say what was looked for.
      if (o.json) console.log(JSON.stringify({ query: o.full, engine: "js", results: [] }));
      else console.log(`no record with id ${o.full} (the index holds ${records.length})`);
      // `return`, not process.exit(0) -- see the closing note of main(). This file's own comment
      // named the hazard and then three branches did it anyway, which is the twin-fix shape: the
      // rule was written down in one place and never applied to the others.
      return;
    }
    if (o.json) console.log(JSON.stringify({ query: o.full, engine: "js", results: [r] }, null, 2));
    else { console.log(renderRow(r, 0, { ...o, full: o.full })); }
    return;
  }

  const filterNotes = [];
  const pool = applyFilters(records, o, filterNotes);

  // --decisions: REQ-04. A LISTING mode, deliberately not a ranked one. Ranking a filter query
  // would let the ranker starve a filter that genuinely matched -- the exact starvation shape the
  // rank-inside-the-pool fix closed in Phase 01 -- and "which decisions match this" has no
  // relevance question in it to rank by. Reader-only (ADR-0703): these records came off the index,
  // which read the spine through the reader library; nothing here opens a spine of its own.
  if (o.decisions !== null) {
    const matched = pool.filter((r) => r.organ === "decisions" && matchesDecision(r, o.decisions));
    // Index order is ULID-ascending and therefore a property of the data, not of the read.
    const hits = matched.slice(0, o.limit);
    const total = records.filter((r) => r.organ === "decisions").length;
    if (o.json) {
      console.log(JSON.stringify({
        query: o.decisionsExpr, mode: "decisions", engine: "filter", terms: o.decisions, notes: filterNotes,
        shown: hits.length, matched: matched.length, indexed: total,
        results: hits.map((r) => ({ ...r, citation: citationOf(r) })),
      }, null, 2));
      return;
    }
    // Every number is labelled. `shown` is printed separately from `matched` so that a --limit
    // truncation is VISIBLE -- a partial answer that looks complete is the confident-false-negative
    // shape `--limit 0` was refused for.
    console.log(`decisions "${o.decisionsExpr}" -- filtered, unranked (showing ${hits.length} of ${matched.length} matching decision(s); ${total} in the index)`);
    if (rebuilt) console.log(`  index rebuilt first: ${why}`);
    for (const n of [...warnings, ...filterNotes]) console.log(`  note: ${n}`);
    console.log("");
    hits.forEach((r, i) => { console.log(renderRow(r, i, o)); console.log(""); });
    if (matched.length === 0) console.log("  no recorded decision matched that filter. That is a result, not an error.\n");
    return;
  }

  // --grep: the honest escape valve (ADR-0709). Literal substring, no ranking, no aliases -- and
  // it says which it is, so nobody mistakes it for the ranked path.
  if (o.grep !== null) {
    const needle = o.grep.toLowerCase();
    // TAGS TOO. Ranking scores tags at weight 4, so a word that lives only in tags was findable
    // by ranking and invisible to grep -- 163 such words in this corpus -- while the zero-result
    // banner sends the searcher to grep precisely when ranking has failed them.
    const hits = pool.filter((r) => `${r.title}\n${r.body}\n${(r.tags ?? []).join(" ")}`.toLowerCase().includes(needle)).slice(0, o.limit);
    if (o.json) { console.log(JSON.stringify({ query: o.grep, mode: "grep", engine: "literal", results: hits }, null, 2)); return; }
    console.log(`grep "${o.grep}" -- literal substring, unranked (${hits.length} of ${pool.length} record(s))`);
    hits.forEach((r, i) => console.log(renderRow(r, i, o)));
    return;
  }

  const { tokens: rawTokens, notes: queryNotes } = sanitizeQuery(queryText);
  const notes = [...filterNotes, ...queryNotes];
  let aliasRows = [];
  const aliasPath = join(root, ALIAS_FILE);
  if (existsSync(aliasPath)) {
    try {
      const parsed = parseAliases(readFileSync(aliasPath, "utf8"));
      aliasRows = parsed.rows;
      // Named, not swallowed. Both callers used to take .rows and discard .exclusions entirely,
      // so even a recorded defect never reached a human.
      for (const e of parsed.exclusions.filter((x) => x.kind === "malformed")) {
        notes.push(`${ALIAS_FILE}:${e.line} ${e.reason}`);
      }
    } catch (e) { aliasRows = []; notes.push(`${ALIAS_FILE} could not be read: ${e.message}`); }
  }
  const { tokens, fired } = expand(rawTokens, aliasRows);

  // The engine seam. REQ-07's sqlite engine is CUT (ADR-0701 amendment, measured), so the
  // registry holds one entry and `auto` resolves to it -- but it resolves THROUGH the registry the
  // equivalence harness enumerates, so the seam is real rather than a comment promising one.
  const chosen = resolveEngine(o.engine);
  if (!chosen) { console.error(`arc-recall: no engine named ${JSON.stringify(o.engine)} is available`); process.exit(2); }
  const engine = chosen.name;
  // Rank INSIDE the filtered pool. Ranking globally and filtering afterwards was the starvation
  // bug: the filter could remove every one of the global top-N and the CLI would then state
  // positively that nothing matched.
  const allowed = new Set(pool.map((p) => p.id));
  const allow = new Set();
  for (const [i, rec] of records.entries()) if (allowed.has(rec.id)) allow.add(i);
  const results = search(index.postings ?? { terms: {}, lengths: [], avgdl: 0 }, records, tokens, { limit: o.limit, allow });

  // The observational log (ADR-0706). Best effort, never throws, and NO GATE READS IT -- it is a
  // trend answering "does anyone use what the hook surfaces", disqualified from gating forever.
  // A zero-result recall is recorded too: "surfaced nothing" is the most interesting row there is
  // for a module whose premise is that it surfaces the right thing.
  recordSurfaced(root, {
    query: queryText,
    ids: results.map((h) => records[h.index]?.id).filter(Boolean),
    surface: "arc-recall",
  });

  if (o.json) {
    console.log(JSON.stringify({
      query: queryText, engine, requested: o.engine, tokens, aliases: fired, notes,
      results: results.map((h) => ({ ...records[h.index], score: h.score, citation: citationOf(records[h.index]) })),
    }, null, 2));
    return;
  }

  console.log(`recall "${queryText}"  (engine ${engine}, requested ${o.engine}; ${results.length} of ${pool.length} record(s))`);
  if (rebuilt) console.log(`  index rebuilt first: ${why}`);
  for (const n of notes) console.log(`  note: ${n}`);
  console.log("");
  results.forEach((h, i) => { console.log(renderRow(records[h.index], i, o)); console.log(""); });
  if (results.length === 0) console.log("  no recorded lesson matched. That is a result, not an error -- try --grep for a literal search.\n");
  // An expansion nobody can see is an expansion nobody can correct.
  for (const f of fired) console.log(`  alias: ${f.terms.join("/")} -> ${f.added.join(", ")}  (${f.why})`);
  // Return, never process.exit, after writing to stdout. Node's stdout is ASYNCHRONOUS for pipes
  // on macOS, and process.exit() truncates whatever is still buffered -- a large --json piped on
  // the macOS leg is exactly where that shows.
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
  main().then(() => { process.exitCode = process.exitCode ?? 0; })
    .catch((e) => { console.error(`arc-recall: ${e.stack || e.message}`); process.exitCode = 1; });
}
