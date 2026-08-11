#!/usr/bin/env node
// memory-index -- build the derived recall index from the five company organs.
//
// ADR-0700: the organs are indexed IN PLACE and never copied, moved or rewritten. This script
// reads them and writes exactly one thing: `<root>/.claude/state/memory/index.json`, which is
// gitignored, derived-only, and safe to delete at any moment.
// ADR-0701: this is the CANONICAL engine -- pure JS, zero npm dependencies, Node >= 18 on all
// three OSes. The node:sqlite accelerator arrives in Phase 2 and can never break this path.
// ADR-0703: the spine is reached only through the reader library.
//
// Invocation is always `node .claude/scripts/memory/memory-index.mjs ...` from the repo root.
// It is deliberately not on PATH, has no shebang contract and is never chmod +x: a bare-command
// style would need per-OS setup across a Windows dev box and three CI legs for no gain.
//
// Usage:
//   node .claude/scripts/memory/memory-index.mjs --rebuild [--root <dir>] [--expect <file>]
//   node .claude/scripts/memory/memory-index.mjs --rebuild --dump-records
//   node .claude/scripts/memory/memory-index.mjs --status

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, renameSync, existsSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

import { canonicalize, sha256Hex } from "../hq/lib/canonical.mjs";
import { query, spineRoot } from "../hq/spine.mjs";
import { normalize } from "./lib/fields.mjs";
import * as retroLog from "./adapters/retro-log.mjs";
import * as trialLedger from "./adapters/trial-ledger.mjs";
import * as learningLedger from "./adapters/learning-ledger.mjs";
import * as adr from "./adapters/adr.mjs";
import * as decisions from "./adapters/decisions.mjs";

export const ORGANS = {
  "retro-log": "docs/retro-log.md",
  "trial-ledger": "docs/trial-ledger.md",
  "learning-ledger": "docs/develop/learning-ledger.md",
  adr: "docs/adr/",
  decisions: "(spine, via reader)",
};

// Fixed organ order. Index order is a property of the code, never of directory listing order or
// of how fast an async read came back -- "same order on rebuild" is a non-negotiable and three
// OSes do not agree on readdir order.
const ORDER = ["retro-log", "trial-ledger", "learning-ledger", "adr", "decisions"];

const rel = (root, p) => relative(root, p).split("\\").join("/");
export const stateDir = (root) => join(root, ".claude", "state", "memory");
export const indexPath = (root) => join(stateDir(root), "index.json");

function gitToplevel() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

function readOrgan(root, key) {
  const p = join(root, ORGANS[key]);
  if (!existsSync(p)) {
    const err = new Error(`organ "${key}" not found at ${rel(root, p)} -- a fixture tree must carry all five organs, or an unrelated missing file will masquerade as a count mismatch`);
    err.code = "ORGAN_MISSING";
    throw err;
  }
  return { path: rel(root, p), text: normalize(readFileSync(p, "utf8")), mtimeMs: statSync(p).mtimeMs };
}

// ---------- record hashing ----------
// sha256 over the record's CANONICAL serialization (ADR-0024): UTF-8, LF, keys sorted, no
// insignificant whitespace. Hashing the serialized RECORD rather than its source text is what
// makes this rule uniform across all five adapters -- `decisions` records come from spine events
// and have no source text at all.
export const recordHash = (record) => sha256Hex(canonicalize(record));

// ---------- build ----------
export async function build(root) {
  const organs = {};
  const records = [];
  const exclusions = [];
  const manifest = {};

  const push = (key, path, parsed, excl) => {
    const before = records.length;
    const seen = new Set();
    for (const r of parsed) {
      if (seen.has(r.id)) {
        // A dropped duplicate is the one way N_indexed can fall below N_parsed, and it is a
        // REAL defect: two rows collapsing onto one id means the id grammar lost a lesson.
        exclusions.push({ kind: "malformed", organ: key, path, line: r.line, reason: `duplicate doc id ${r.id} -- the id grammar collided and a record would have been silently overwritten` });
        continue;
      }
      seen.add(r.id);
      const rec = { ...r, path };
      records.push({ ...rec, hash: recordHash(rec) });
    }
    organs[key] = { path, parsed: parsed.length, indexed: records.length - before, exclusions: excl.length };
    for (const e of excl) exclusions.push({ organ: key, path, ...e });
  };

  for (const key of ORDER) {
    if (key === "adr") {
      const dir = join(root, ORGANS.adr);
      if (!existsSync(dir)) {
        const err = new Error(`organ "adr" not found at ${ORGANS.adr}`);
        err.code = "ORGAN_MISSING";
        throw err;
      }
      // Sorted by filename (i.e. by ADR number). Directory order is not stable across the three
      // OSes, and "identical order on rebuild" is a non-negotiable.
      const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
      const parsed = [];
      const excl = [];
      for (const f of files) {
        const p = join(dir, f);
        const out = adr.parse(normalize(readFileSync(p, "utf8")), rel(root, p));
        for (const r of out.records) parsed.push({ ...r, __path: rel(root, p) });
        for (const e of out.exclusions) excl.push({ ...e, file: rel(root, p) });
        manifest[rel(root, p)] = { mtimeMs: statSync(p).mtimeMs, sha256: sha256Hex(normalize(readFileSync(p, "utf8"))) };
      }
      // Each ADR carries its own path, so it is attached per record rather than per organ.
      const before = records.length;
      const seen = new Set();
      for (const r of parsed) {
        const { __path, ...rest } = r;
        if (seen.has(rest.id)) {
          exclusions.push({ kind: "malformed", organ: "adr", path: __path, line: rest.line, reason: `duplicate doc id ${rest.id}` });
          continue;
        }
        seen.add(rest.id);
        const rec = { ...rest, path: __path };
        records.push({ ...rec, hash: recordHash(rec) });
      }
      organs.adr = { path: ORGANS.adr, parsed: parsed.length, indexed: records.length - before, exclusions: excl.length, files: files.length };
      for (const e of excl) exclusions.push({ kind: e.kind, organ: "adr", path: e.file, line: e.line, reason: e.reason });
      continue;
    }

    if (key === "decisions") {
      // ADR-0703: through the reader, never the raw store. Note the reader's root is the SPINE
      // root (`.claude/state/hq`), not the repo root -- handing it the repo root returns zero
      // events and no error, which is the L-002 shape exactly: a confident empty answer.
      let spine;
      try {
        spine = spineRoot();
      } catch (e) {
        // The commonest cause is a linked git worktree, where the spine deliberately refuses to
        // resolve. memory is a reader and must still build -- but "could not read the spine" is
        // recorded as its own state and NEVER printed as 0/0, because a zero that means "nothing
        // there" and a zero that means "never looked" are the same character on screen.
        organs.decisions = { path: "(spine)", parsed: 0, indexed: 0, exclusions: 0, unavailable: e.message.split("\n")[0] };
        continue;
      }
      const { events, torn } = await query(spine, {});
      const out = decisions.fromEvents(events);
      push("decisions", "(spine)", out.records, out.exclusions);
      organs.decisions.scanned = events.length;
      organs.decisions.torn = torn.length;
      organs.decisions.spineRoot = spine.split("\\").join("/");
      continue;
    }

    const organ = readOrgan(root, key);
    manifest[organ.path] = { mtimeMs: organ.mtimeMs, sha256: sha256Hex(organ.text) };
    const adapter = key === "retro-log" ? retroLog : key === "trial-ledger" ? trialLedger : learningLedger;
    const out = adapter.parse(organ.text);
    push(key, organ.path, out.records, out.exclusions);
  }

  return { version: 1, organs, records, exclusions, manifest };
}

// ---------- verification ----------
export function verify(index, expect) {
  const failures = [];
  for (const key of ORDER) {
    const o = index.organs[key];
    if (!o) { failures.push(`organ ${key} produced no count block at all`); continue; }
    if (o.parsed !== o.indexed) {
      failures.push(`${key}: N_parsed ${o.parsed} != N_indexed ${o.indexed} -- ${o.parsed - o.indexed} record(s) were dropped after parsing`);
    }
    if (expect && Object.prototype.hasOwnProperty.call(expect, key) && expect[key] !== o.indexed) {
      failures.push(`${key}: expected ${expect[key]} indexed record(s), got ${o.indexed}`);
    }
  }
  if (expect) {
    for (const key of Object.keys(expect)) {
      if (!ORDER.includes(key)) failures.push(`expectation names unknown organ "${key}"`);
    }
  }
  return failures;
}

// ---------- write ----------
// Atomic: one file, written to a sibling temp path and renamed over the target. A single file
// is what makes the swap genuinely atomic -- two files renamed in sequence have a window where
// a reader sees a new index beside a stale manifest.
export function writeIndex(root, index) {
  const dir = stateDir(root);
  mkdirSync(dir, { recursive: true });
  const target = indexPath(root);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(index) + "\n", "utf8");
    renameSync(tmp, target);
  } catch (e) {
    try { rmSync(tmp, { force: true }); } catch { /* the temp file is derived; its removal is best-effort */ }
    throw e;
  }
  return target;
}

export function isStale(root) {
  const p = indexPath(root);
  if (!existsSync(p)) return { stale: true, why: "no index" };
  let index;
  try { index = JSON.parse(readFileSync(p, "utf8")); }
  catch { return { stale: true, why: "index is unreadable" }; }
  for (const [path, m] of Object.entries(index.manifest ?? {})) {
    const abs = join(root, path);
    if (!existsSync(abs)) return { stale: true, why: `${path} no longer exists` };
    const st = statSync(abs);
    if (st.mtimeMs !== m.mtimeMs) {
      // mtime is a cheap first filter only. A touched-but-unchanged file must NOT force a
      // rebuild, and a changed file with a preserved mtime must still be caught -- so the
      // hash, not the timestamp, is what decides.
      if (sha256Hex(normalize(readFileSync(abs, "utf8"))) !== m.sha256) return { stale: true, why: `${path} changed` };
    }
  }
  return { stale: false, why: "manifest matches" };
}

// ---------- CLI ----------
function parseArgs(argv) {
  const opts = { root: null, rebuild: false, dumpRecords: false, status: false, expect: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--rebuild") opts.rebuild = true;
    else if (a === "--dump-records") opts.dumpRecords = true;
    else if (a === "--status") opts.status = true;
    else if (a === "--root") { opts.root = argv[++i]; if (opts.root === undefined) throw new Error("--root needs a directory"); }
    else if (a === "--expect") { opts.expect = argv[++i]; if (opts.expect === undefined) throw new Error("--expect needs a file"); }
    else throw new Error(`unknown flag ${a}`);
  }
  return opts;
}

async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(`memory-index: ${e.message}`); process.exit(2); }

  const root = resolve(opts.root ?? gitToplevel());
  if (!existsSync(root)) { console.error(`memory-index: --root ${opts.root} does not exist`); process.exit(2); }

  if (opts.status) {
    const s = isStale(root);
    console.log(`index: ${existsSync(indexPath(root)) ? rel(root, indexPath(root)) : "(absent)"}`);
    console.log(`stale: ${s.stale ? "YES" : "no"} (${s.why})`);
    process.exit(0);
  }

  if (!opts.rebuild) { console.error("memory-index: nothing to do -- pass --rebuild or --status"); process.exit(2); }

  let expect = null;
  if (opts.expect) {
    const p = resolve(root, opts.expect);
    if (!existsSync(p)) { console.error(`memory-index: --expect file ${opts.expect} does not exist`); process.exit(2); }
    expect = JSON.parse(readFileSync(p, "utf8"));
  } else {
    // A fixture tree may pin its own counts without the caller remembering the flag.
    const conventional = join(root, "memory-expect.json");
    if (existsSync(conventional)) expect = JSON.parse(readFileSync(conventional, "utf8"));
  }

  let index;
  try { index = await build(root); }
  catch (e) { console.error(`memory-index: ${e.message}`); process.exit(1); }

  console.log(`root: ${root.split("\\").join("/")}`);
  console.log("counts (parsed/indexed):");
  for (const key of ORDER) {
    const o = index.organs[key];
    const expectNote = expect && Object.prototype.hasOwnProperty.call(expect, key) ? `  expect ${expect[key]}` : "";
    // For decisions, print what the READER returned as well. "0/0" alone cannot distinguish an
    // empty spine from a reader that came back with nothing -- which is L-002 exactly: exit 0
    // from a read is not evidence that anything was read.
    if (key === "decisions" && o.unavailable) {
      console.log(`  ${key.padEnd(16)} UNAVAILABLE -- the spine could not be resolved, so this organ was NOT read: ${o.unavailable}`);
      continue;
    }
    const scanned = key === "decisions" ? `  (reader returned ${o.scanned} event(s) from ${o.spineRoot})` : "";
    console.log(`  ${key.padEnd(16)} ${o.parsed}/${o.indexed}${expectNote}${scanned}`);
  }

  // `kind` is set by the adapter that made the call, never re-derived here by sniffing the
  // reason text: a classifier that greps its own prose silently reclassifies every row the day
  // someone rewords a message, and the count-verify cannot see a misclassification at all.
  const malformed = index.exclusions.filter((e) => e.kind === "malformed");
  console.log(`exclusions: ${index.exclusions.length} named, ${malformed.length} malformed`);
  for (const e of index.exclusions) {
    console.log(`  ${e.path}:${e.line}  ${e.reason}`);
  }

  const failures = verify(index, expect);
  if (failures.length) {
    for (const f of failures) console.error(`memory-index: FAIL ${f}`);
    process.exit(1);
  }

  const written = writeIndex(root, index);
  console.log(`wrote ${rel(root, written)}  (${index.records.length} records)`);

  if (opts.dumpRecords) {
    console.log("--- records ---");
    for (const r of index.records) console.log(`${r.id}\t${r.hash}`);
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]).endsWith("memory-index.mjs");
if (invokedDirectly) {
  main().catch((e) => { console.error(`memory-index: ${e.stack || e.message}`); process.exit(1); });
}
