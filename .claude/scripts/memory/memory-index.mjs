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
// Invocation is always `node .claude/scripts/memory/memory-index.mjs ...` from the repo root. It
// is deliberately not on PATH, has no shebang contract and is never chmod +x: a bare-command
// style would need per-OS setup across a Windows dev box and three CI legs for no gain.
//
// Usage:
//   node .claude/scripts/memory/memory-index.mjs --rebuild [--root <dir>] [--expect <file>]
//   node .claude/scripts/memory/memory-index.mjs --rebuild --dump-records
//   node .claude/scripts/memory/memory-index.mjs --status
//
// Exit codes: 0 ok · 1 the build failed a check · 2 operator error · 3 (--status only) stale.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, renameSync, existsSync, rmSync, lstatSync, unlinkSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

import { canonicalize, sha256Hex } from "../hq/lib/canonical.mjs";
import { query, spineRoot } from "../hq/spine.mjs";
import { normalize, assertDecodable } from "./lib/fields.mjs";
import { buildPostings } from "./lib/bm25.mjs";
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

// `sep`, not a hard-coded backslash. A backslash is a LEGAL character in a POSIX filename, and an
// unconditional swap would rewrite `0700-a\b.md` into a path naming a file that does not exist.
const rel = (root, p) => relative(root, p).split(sep).join("/");
export const stateDir = (root) => join(root, ".claude", "state", "memory");
export const indexPath = (root) => join(stateDir(root), "index.json");

class OperatorError extends Error {}

function gitToplevel() {
  try {
    // stdio pipe: without it the child's "fatal: not a git repository" reaches the caller's
    // stderr even though this catch handles the failure perfectly well.
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return process.cwd();
  }
}

/** Read a text file, naming the file on EVERY failure -- with 150 ADRs, a bare EISDIR is useless. */
function readText(p, label) {
  let buf;
  try {
    buf = readFileSync(p);
  } catch (e) {
    throw new OperatorError(`cannot read ${label}: ${e.code || e.message}${e.code === "EISDIR" ? " (it is a directory)" : ""}`);
  }
  assertDecodable(buf, label);
  return normalize(buf.toString("utf8"));
}

function readOrgan(root, key) {
  const p = join(root, ORGANS[key]);
  if (!existsSync(p)) {
    throw new OperatorError(`organ "${key}" not found at ${rel(root, p)} -- a fixture tree must carry all five organs, or an unrelated missing file will masquerade as a count mismatch`);
  }
  return { path: rel(root, p), text: readText(p, rel(root, p)), mtimeMs: statSync(p).mtimeMs };
}

// ---------- record hashing ----------
// sha256 over the record's CANONICAL serialization (ADR-0024): UTF-8, LF, keys sorted, no
// insignificant whitespace. Hashing the serialized RECORD rather than its source text is what
// makes this rule uniform across all five adapters -- `decisions` records come from spine events
// and have no source text at all.
export const recordHash = (record) => sha256Hex(canonicalize(record));

/**
 * Where the spine lives for THIS build.
 *
 * `--root` moves the organs, so it must move the spine too. It did not: `spineRoot()` walks up
 * from `process.cwd()`, so building a fixture tree from inside a real clone indexed that clone's
 * decisions and wrote them into the fixture's index, with a citation of "(spine)" naming no root
 * at all. Same defect shape as handing the reader the repo root, answering non-empty this time.
 */
export function resolveSpine(root) {
  if ("ARC_SPINE_ROOT" in process.env) return { path: spineRoot(), how: "ARC_SPINE_ROOT" };
  const atRoot = join(root, ".claude", "state", "hq");
  if (existsSync(join(atRoot, "events"))) return { path: atRoot, how: "--root" };
  return { path: atRoot, how: "absent" };
}

// ---------- build ----------
export async function build(root, opts = {}) {
  const organs = {};
  const records = [];
  const exclusions = [];
  const manifest = {};

  const push = (key, path, parsed, excl) => {
    const before = records.length;
    const seen = new Set();
    for (const r of parsed) {
      if (seen.has(r.id)) {
        // A dropped duplicate is the one way N_indexed can fall below N_parsed, and it is a REAL
        // defect: two rows collapsing onto one id means the id grammar lost a lesson.
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
      if (!existsSync(dir)) throw new OperatorError(`organ "adr" not found at ${ORGANS.adr}`);
      // Sorted by filename (i.e. by ADR number). Directory order is not stable across three OSes,
      // and "identical order on rebuild" is a non-negotiable.
      const entries = readdirSync(dir).sort();
      const files = [];
      const excl = [];
      for (const name of entries) {
        const p = join(dir, name);
        let st;
        try { st = lstatSync(p); } catch { st = null; }
        // Case-INSENSITIVE. `0903-SHOUTY.MD` and `0903-shouty.md` are the same name to the
        // windows and macOS filesystems, and a case-sensitive filter indexed one and made the
        // other vanish from both lists. Anything rejected here is NAMED, never skipped.
        if (st && st.isDirectory()) {
          excl.push({ kind: "malformed", line: 1, reason: `docs/adr/${name} is a directory; ADRs are one file each and subdirectories are not searched`, file: rel(root, p) });
          continue;
        }
        if (!/\.md$/i.test(name)) {
          excl.push({ kind: "malformed", line: 1, reason: `docs/adr/${name} is not a .md file and is therefore in neither the index nor any other list`, file: rel(root, p) });
          continue;
        }
        files.push(name);
      }

      const parsed = [];
      for (const f of files) {
        const p = join(dir, f);
        const text = readText(p, rel(root, p));
        const out = adr.parse(text, rel(root, p));
        for (const r of out.records) parsed.push({ ...r, __path: rel(root, p) });
        for (const e of out.exclusions) excl.push({ ...e, file: rel(root, p) });
        manifest[rel(root, p)] = { mtimeMs: statSync(p).mtimeMs, sha256: sha256Hex(text) };
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
      // The DIRECTORY listing itself is a manifest input. Without it `isStale` can only see files
      // it already knew about, so an ADDED ADR -- the single commonest change this repo makes to
      // this organ, 140 to 150 during this lane's own kickoff -- never marked the index stale.
      manifest["docs/adr/ (listing)"] = { mtimeMs: null, sha256: sha256Hex(entries.join("\n")) };
      continue;
    }

    if (key === "decisions") {
      // ADR-0703: through the reader, never the raw store. The reader's root is the SPINE root
      // (`.claude/state/hq`), not the repo root -- hand it the wrong one and it returns zero
      // events with no error at all, which is L-002 exactly.
      const spine = resolveSpine(root);
      if (spine.how === "absent") {
        organs.decisions = { path: "(spine)", parsed: 0, indexed: 0, exclusions: 0, unavailable: `no spine at ${rel(root, spine.path)} (set ARC_SPINE_ROOT, or pass --allow-missing-spine to build an index with this organ knowingly absent)` };
        continue;
      }
      let read;
      try {
        read = await query(spine.path, {});
      } catch (e) {
        organs.decisions = { path: "(spine)", parsed: 0, indexed: 0, exclusions: 0, unavailable: e.message.split("\n")[0] };
        continue;
      }
      const out = decisions.fromEvents(read.events);
      push("decisions", "(spine)", out.records, out.exclusions);
      organs.decisions.scanned = read.events.length;
      organs.decisions.torn = read.torn.length;
      organs.decisions.spineRoot = spine.path.split(sep).join("/");
      organs.decisions.spineVia = spine.how;
      // The spine is an indexed organ, so it needs a staleness input like any other. Without one,
      // `--status` could never observe a new decision and a consumer that rebuilds only when told
      // to go stale would never see one again.
      manifest["(spine)"] = { mtimeMs: null, sha256: sha256Hex(read.events.map((e) => e.event.id).join("\n")), spineRoot: organs.decisions.spineRoot };
      continue;
    }

    const organ = readOrgan(root, key);
    manifest[organ.path] = { mtimeMs: organ.mtimeMs, sha256: sha256Hex(organ.text) };
    const adapter = key === "retro-log" ? retroLog : key === "trial-ledger" ? trialLedger : learningLedger;
    const out = adapter.parse(organ.text);
    push(key, organ.path, out.records, out.exclusions);
  }

  // Postings are built HERE, at index time, so a query is one pass over matched postings
  // rather than a re-tokenisation of the whole corpus. They sit beside the records and outside
  // every record hash, so Phase 00's determinism proof is untouched by their existence.
  const postings = buildPostings(records);

  return { version: 2, root: root.split(sep).join("/"), organs, records, exclusions, manifest, postings, opts: { allowMissingSpine: !!opts.allowMissingSpine, allowEmptyOrgan: !!opts.allowEmptyOrgan } };
}

// ---------- verification ----------
export function verify(index, expect, prior, opts = {}) {
  const failures = [];
  for (const key of ORDER) {
    const o = index.organs[key];
    if (!o) { failures.push(`organ ${key} produced no count block at all`); continue; }

    if (o.unavailable) {
      // Honoured at the gate, not only on stdout. A build whose fifth organ was never read used
      // to exit 0 and write a knowingly incomplete index -- L-002's shape one level up.
      if (!opts.allowMissingSpine) failures.push(`${key}: NOT READ (${o.unavailable}); the index would be incomplete, so this is a failure unless --allow-missing-spine says otherwise`);
      continue;
    }
    // `undefined !== undefined` is false, so the invariant was vacuous precisely when an adapter
    // failed to report its counts at all.
    if (!Number.isInteger(o.parsed) || !Number.isInteger(o.indexed)) {
      failures.push(`${key}: reported no usable parsed/indexed pair (${JSON.stringify(o.parsed)}/${JSON.stringify(o.indexed)})`);
      continue;
    }
    if (o.parsed !== o.indexed) {
      failures.push(`${key}: N_parsed ${o.parsed} != N_indexed ${o.indexed} -- ${o.parsed - o.indexed} record(s) were dropped after parsing`);
    }
    if (expect && Object.prototype.hasOwnProperty.call(expect, key) && expect[key] !== o.indexed) {
      failures.push(`${key}: expected ${expect[key]} indexed record(s), got ${o.indexed}`);
    }
    // An organ that HAD records and now has none. `N_parsed == N_indexed` is satisfied by 0 == 0,
    // and the live tree pins no absolute counts, so without this there is no channel at all that
    // notices an emptied, truncated or re-encoded organ on the real run.
    const was = prior?.organs?.[key]?.indexed;
    if (!opts.allowEmptyOrgan && Number.isInteger(was) && was > 0 && o.indexed === 0) {
      failures.push(`${key}: had ${was} record(s) in the previous index and has 0 now -- an organ does not empty by accident (pass --allow-empty-organ if it really did)`);
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
// Atomic: one file, written to a sibling temp path and renamed over the target. A single file is
// what makes the swap genuinely atomic -- two files renamed in sequence have a window where a
// reader sees a new index beside a stale manifest.
export function writeIndex(root, index) {
  const dir = stateDir(root);
  mkdirSync(dir, { recursive: true });
  // Sweep temp files a killed run left behind. Harmless (the state dir is gitignored) but
  // unbounded, and litter in a derived directory is how a derived directory stops being trusted.
  try {
    for (const f of readdirSync(dir)) if (/^index\.json\.tmp-/.test(f)) unlinkSync(join(dir, f));
  } catch { /* best-effort: the sweep must never be the reason a build fails */ }
  const target = indexPath(root);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(index) + "\n", "utf8");
    renameSync(tmp, target);
  } catch (e) {
    try { rmSync(tmp, { force: true }); } catch { /* derived; removal is best-effort */ }
    throw new OperatorError(`cannot write ${rel(root, target)}: ${e.code || e.message}`);
  }
  return target;
}

export function readIndex(root) {
  const p = indexPath(root);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

export function isStale(root) {
  const p = indexPath(root);
  if (!existsSync(p)) return { stale: true, why: "no index" };
  const index = readIndex(root);
  if (!index) return { stale: true, why: "index is unreadable" };

  for (const [path, m] of Object.entries(index.manifest ?? {})) {
    if (path === "(spine)") {
      const spine = resolveSpine(root);
      if (spine.how === "absent") return { stale: true, why: "the spine that was indexed is no longer reachable" };
      if (spine.path.split(sep).join("/") !== m.spineRoot) return { stale: true, why: `the spine moved (${m.spineRoot} -> ${spine.path.split(sep).join("/")})` };
      continue; // event-list comparison happens below, out of the sync loop
    }
    if (path === "docs/adr/ (listing)") {
      const dir = join(root, ORGANS.adr);
      if (!existsSync(dir)) return { stale: true, why: "docs/adr/ no longer exists" };
      if (sha256Hex(readdirSync(dir).sort().join("\n")) !== m.sha256) return { stale: true, why: "docs/adr/ gained or lost a file" };
      continue;
    }
    const abs = join(root, path);
    if (!existsSync(abs)) return { stale: true, why: `${path} no longer exists` };
    // The hash decides, ALWAYS -- it is not gated on the mtime differing first. A same-mtime
    // rewrite is ordinary (`touch -r`, `rsync -t`, a checkout, any 1s-resolution filesystem), and
    // gating the hash on the timestamp made the code assert a property it did not have.
    let text;
    try { text = readText(abs, path); } catch (e) { return { stale: true, why: `${path} is unreadable (${e.message})` }; }
    if (sha256Hex(text) !== m.sha256) return { stale: true, why: `${path} changed` };
  }

  const spineEntry = index.manifest?.["(spine)"];
  if (spineEntry) {
    const spine = resolveSpine(root);
    if (spine.how !== "absent") {
      try {
        return { stale: false, why: "manifest matches", spineCheck: { spine, expected: spineEntry.sha256 } };
      } catch { /* fall through */ }
    }
  }
  return { stale: false, why: "manifest matches" };
}

/** The spine half of staleness needs the async reader, so it is its own step. */
export async function isStaleAsync(root) {
  const sync = isStale(root);
  if (sync.stale) return sync;
  const index = readIndex(root);
  const entry = index?.manifest?.["(spine)"];
  if (!entry) return sync;
  const spine = resolveSpine(root);
  if (spine.how === "absent") return { stale: true, why: "the spine that was indexed is no longer reachable" };
  try {
    const read = await query(spine.path, {});
    if (sha256Hex(read.events.map((e) => e.event.id).join("\n")) !== entry.sha256)
      return { stale: true, why: "the spine gained or lost events" };
  } catch (e) {
    return { stale: true, why: `the spine could not be read (${e.message.split("\n")[0]})` };
  }
  return { stale: false, why: "manifest matches" };
}

// ---------- CLI ----------
const FLAGS = new Set(["--rebuild", "--dump-records", "--status", "--allow-missing-spine", "--allow-empty-organ"]);
const VALUE_FLAGS = new Set(["--root", "--expect"]);

export function parseArgs(argv) {
  const opts = { root: null, rebuild: false, dumpRecords: false, status: false, expect: null, allowMissingSpine: false, allowEmptyOrgan: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUE_FLAGS.has(a)) {
      // A repeated flag is an operator error, never a last-wins override. `.claude/rules/lanes.md`
      // settled this for --lane and the reasoning is identical: silently picking one of two named
      // values IS the "never guess" failure.
      if (seen.has(a)) throw new OperatorError(`${a} given twice -- that is an operator error, not a last-wins override`);
      seen.add(a);
      const v = argv[++i];
      if (v === undefined) throw new OperatorError(`${a} needs a value`);
      // PRESENCE, not truthiness. `--root "$DIR"` with DIR unset expands to `--root ""`, which is
      // the QUOTED form the lane rules mandate -- and an empty value used to fall through to the
      // git toplevel and then to cwd, building an index for a directory nobody named.
      if (v.trim() === "") throw new OperatorError(`${a} was named but is empty -- refusing to fall back to a directory nobody named`);
      if (a === "--root") opts.root = v; else opts.expect = v;
      continue;
    }
    if (!FLAGS.has(a)) throw new OperatorError(`unknown flag ${a}`);
    if (a === "--rebuild") opts.rebuild = true;
    else if (a === "--dump-records") opts.dumpRecords = true;
    else if (a === "--status") opts.status = true;
    else if (a === "--allow-missing-spine") opts.allowMissingSpine = true;
    else if (a === "--allow-empty-organ") opts.allowEmptyOrgan = true;
  }
  if (opts.status && opts.rebuild) throw new OperatorError("--status and --rebuild together do nothing useful: --status wins and nothing is built, which reports success having built nothing. Pick one.");
  if (!opts.status && !opts.rebuild) throw new OperatorError("nothing to do -- pass --rebuild or --status");
  return opts;
}

/** Load an expectation file. It is a GATE INPUT, so every way of being unusable is an error. */
function loadExpect(cwd, root, opts) {
  let p, label;
  if (opts.expect) {
    // Resolved against the CALLER's cwd, never against the tree being graded: a tree that
    // supplies its own pass condition is not being graded by anything.
    p = resolve(cwd, opts.expect);
    label = opts.expect;
    if (!existsSync(p)) throw new OperatorError(`--expect file ${opts.expect} does not exist (resolved to ${p.split(sep).join("/")})`);
  } else {
    p = join(root, "memory-expect.json");
    label = "memory-expect.json";
    if (!existsSync(p)) return null;
  }
  const text = readText(p, label); // strips a UTF-8 BOM; refuses UTF-16, which PowerShell writes
  let value;
  try { value = JSON.parse(text); } catch (e) { throw new OperatorError(`${label} is not valid JSON: ${e.message}`); }
  // `null`, `[]`, `{}` and `5` all used to disable every expectation in silence -- the one pinning
  // channel in the design, switched off by a one-token file from any jq pipeline.
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new OperatorError(`${label} must be a JSON object of organ -> count, not ${Array.isArray(value) ? "an array" : JSON.stringify(value)}`);
  const keys = Object.keys(value);
  if (keys.length === 0) throw new OperatorError(`${label} is an empty object, which would pin nothing while looking like a pinned build`);
  for (const k of keys) {
    if (!ORDER.includes(k)) throw new OperatorError(`${label} names unknown organ ${JSON.stringify(k)}`);
    if (!Number.isInteger(value[k]) || value[k] < 0) throw new OperatorError(`${label}.${k} must be a non-negative integer, got ${JSON.stringify(value[k])}`);
  }
  return value;
}

async function main() {
  const cwd = process.cwd();
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(`memory-index: ${e.message}`); process.exit(2); }

  const root = resolve(opts.root ?? gitToplevel());
  if (!existsSync(root)) { console.error(`memory-index: --root ${opts.root} does not exist`); process.exit(2); }

  if (opts.status) {
    const s = await isStaleAsync(root);
    console.log(`index: ${existsSync(indexPath(root)) ? rel(root, indexPath(root)) : "(absent)"}`);
    console.log(`stale: ${s.stale ? "YES" : "no"} (${s.why})`);
    // Exit 3 on stale, so `memory-index --status && use-the-index` cannot proceed on a stale one.
    process.exit(s.stale ? 3 : 0);
  }

  let expect, index;
  try {
    expect = loadExpect(cwd, root, opts);
  } catch (e) {
    console.error(`memory-index: ${e.message}`);
    process.exit(2);
  }
  const prior = readIndex(root);
  try { index = await build(root, opts); }
  catch (e) {
    console.error(`memory-index: ${e instanceof OperatorError ? e.message : e.stack || e.message}`);
    process.exit(e instanceof OperatorError ? 2 : 1);
  }

  console.log(`root: ${root.split(sep).join("/")}`);
  console.log("counts (parsed/indexed):");
  for (const key of ORDER) {
    const o = index.organs[key];
    if (o.unavailable) {
      console.log(`  ${key.padEnd(16)} UNAVAILABLE -- this organ was NOT read: ${o.unavailable}`);
      continue;
    }
    const expectNote = expect && Object.prototype.hasOwnProperty.call(expect, key) ? `  expect ${expect[key]}` : "";
    // For decisions, print what the READER returned and from where. A bare 0/0 cannot distinguish
    // an empty spine from a spine that was never opened.
    const scanned = key === "decisions" ? `  (reader returned ${o.scanned} event(s) from ${o.spineRoot} via ${o.spineVia})` : "";
    console.log(`  ${key.padEnd(16)} ${o.parsed}/${o.indexed}${expectNote}${scanned}`);
  }

  // `kind` is set by the adapter that made the call, never re-derived here by sniffing the reason
  // text: a classifier that greps its own prose silently reclassifies every row the day someone
  // rewords a message, and the count-verify cannot see a misclassification at all.
  const malformed = index.exclusions.filter((e) => e.kind === "malformed");
  console.log(`exclusions: ${index.exclusions.length} named, ${malformed.length} malformed`);
  for (const e of index.exclusions) console.log(`  ${e.path}:${e.line}  ${e.reason}`);

  const failures = verify(index, expect, prior, opts);
  if (failures.length) {
    for (const f of failures) console.error(`memory-index: FAIL ${f}`);
    process.exit(1);
  }

  let written;
  try { written = writeIndex(root, index); }
  catch (e) { console.error(`memory-index: ${e.message}`); process.exit(2); }
  console.log(`wrote ${rel(root, written)}  (${index.records.length} records)`);

  if (opts.dumpRecords) {
    console.log("--- records ---");
    for (const r of index.records) console.log(`${r.id}\t${r.hash}`);
  }
}

// Exact identity, not a suffix test. `endsWith("memory-index.mjs")` matched any importer whose own
// filename ended in that string -- `check-memory-index.mjs` ran the CLI against the wrapper's argv
// and exited 2 before the wrapper's own code ran. Phase 1's arc-recall imports this module.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`memory-index: ${e.stack || e.message}`); process.exit(1); });
}
