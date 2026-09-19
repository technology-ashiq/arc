#!/usr/bin/env node
// arc-evolve -- the evolve CLI.
//
// Usage:
//   arc-evolve board [--root DIR] [--now MS]
//   arc-evolve open     --experiment x-ID --module M --surface S --target PATH --arms +a,+b [--split 50,50] [--ttl DAYS] [--expect D]
//   arc-evolve measure  --experiment x-ID --unit U --metric M --value N --count N --window FROM..TO --source ID [--expect D]
//   arc-evolve conclude --experiment x-ID [--expect D]
//
// open, measure and conclude (face v2 Phase 05 kernel ring, ADR-1340) compute their receipt's payload from the spine
// and the module's evolve section (wire.mjs), and have the spine's validator judge it (arc-event --dry-run).
//
//   without --expect   the PLAN: writes nothing, and prints as its LAST line {"expect":"<digest>"} -- the digest of the
//                      exact receipt an apply would write (core/plan-expect.mjs)
//   --expect D         the APPLY: re-derives the receipt from the spine as it stands NOW, re-runs every check, and
//                      writes it through arc-event only if its digest is still D. Otherwise PLAN_STALE, nothing
//                      written. The first cut printed an emit line the door ran up to fifteen minutes later, so the
//                      cap, compute-once and fixed-horizon checks held at plan time only (PR 3a logic attack).
//
// Exit: 0 done · 1 the receipt's write is in doubt (said so) · 2 refused. --root and --repo point at a fixture spine
// and repo for tests; production omits both.
//
// --now exists so a render is a pure function of its inputs: staleness is an age in days, and a
// wall clock would make two renders of the same spine differ. Tests and the replay-determinism
// check pin it; production omits it and gets the spine's own clock.

import { readdirSync, readFileSync, existsSync, statSync, realpathSync } from "node:fs";
import { join, dirname, sep } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { spineRoot, withLock } from "../hq/lib/spine-io.mjs";
import { checkEvolveSection } from "../core/evolve-manifest.mjs";
import { assertNoDuplicateKeys } from "../core/json-strict.mjs";
import { planDigest, expectLine, staleReason } from "../core/plan-expect.mjs";
import { board } from "./board.mjs";
import { readAll, scanAll } from "../hq/spine.mjs";
import { planOpen, planMeasure, planConclude, EvolveRefusal } from "./wire.mjs";

const ARC_EVENT = join(dirname(fileURLToPath(import.meta.url)), "..", "hq", "arc-event.mjs");
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

// The flags each command reads. A flag another command takes is still unknown here: a --value handed to open is a
// mistake, not a value to ignore.
const ALLOWED = Object.freeze({
  board: ["root", "now", "repo"],
  open: ["root", "repo", "experiment", "module", "surface", "target", "arms", "split", "ttl", "expect"],
  measure: ["root", "repo", "experiment", "unit", "metric", "value", "count", "window", "source", "expect"],
  conclude: ["root", "repo", "experiment", "expect"],
});

/** A refusal: its words on stderr, its exit code set, and the run unwound -- never process.exit after a write. */
class Stop extends Error {
  /** @param {number} code */
  constructor(code) { super("stop"); this.code = code; }
}
function die(msg, code = 2) { process.stderr.write(`arc-evolve: ${msg}\n`); throw new Stop(code); }

/** @param {string[]} argv */
function parseFlags(cmd, argv) {
  const flags = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) die(`unexpected argument: ${a}`);
    const eq = a.indexOf("=");
    const name = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (!(ALLOWED[cmd] || ALLOWED.board).includes(name)) die(`unknown flag --${name}`);
    const val = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (val === undefined) die(`flag --${name} needs a value`);
    // A flag is never a value: `--experiment --repo x` read "--repo" as the experiment id and x as a stray argument
    // (PR 3a logic attack). No value here can legitimately start with a dash.
    if (val.startsWith("-")) die(`flag --${name} needs a value, and got ${JSON.stringify(val)} -- a value never starts with "-"`);
    // Last-wins on a repeated flag is how `--now X --now 0` silently rendered every age as
    // -20660d. An operator who typed a flag twice meant one of them; guessing which is not this
    // tool's job.
    if (name in flags) die(`--${name} given twice`);
    if (val === "") die(`--${name} cannot be empty`);
    flags[name] = val;
  }
  return flags;
}

// Walk up to the directory that holds products/, rather than counting `..` segments — the same
// depth-independent resolution product-lint uses, and for the same reason.
function repoRoot(flags) {
  if (flags.repo) return flags.repo;
  let d = fileURLToPath(new URL(".", import.meta.url));
  while (!existsSync(join(d, "products")) && dirname(d) !== d) d = dirname(d);
  return d;
}

/**
 * Every module that declares a VALID `evolve` section, with the metrics and per-arm floor the
 * board needs.
 *
 * The section is LINTED here, not merely parsed. The first version used a bare `JSON.parse`, so
 * a manifest the linter rejects with 47 findings still reached the renderer — and a newline
 * inside a metric name forged extra BASELINE rows, including a fabricated observation count and
 * a fabricated `module payments`. The board's header promises every figure is counted from
 * receipts or read from a manifest; that promise is only worth anything if the manifest had to
 * pass the same gate `product-lint` applies.
 *
 * An invalid section is REPORTED, not silently skipped: a module that vanishes from the board
 * reads as a module with nothing to say.
 */
function declaredModules(root) {
  const dir = join(root, "products");
  if (!existsSync(dir)) return { modules: [], rejected: [] };
  const modules = [];
  const rejected = [];
  for (const name of readdirSync(dir).sort()) {
    const mf = join(dir, name, "manifest.json");
    if (!existsSync(mf)) continue;
    const text = (() => { try { return readFileSync(mf, "utf8"); } catch { return null; } })();
    if (text === null) continue;
    try { assertNoDuplicateKeys(text, `products/${name}/manifest.json`); }
    catch (e) { rejected.push(`${name}: ${e.message}`); continue; }
    let obj;
    try { obj = JSON.parse(text); } catch (e) { rejected.push(`${name}: invalid JSON`); continue; }
    if (!obj || typeof obj !== "object" || !("evolve" in obj)) continue;
    const findings = checkEvolveSection(obj.evolve, `products/${name}`, { root });
    if (findings.length) { rejected.push(`${name}: ${findings.length} finding(s), first: ${findings[0]}`); continue; }
    modules.push({
      name: obj.name ?? name,
      metrics: obj.evolve.metrics,
      per_arm_floor: obj.evolve.evals?.per_arm_floor,
      experiments: obj.evolve.experiments,
      evals: obj.evolve.evals,
    });
  }
  return { modules, rejected };
}

/** The first line a child wrote to stderr, or its exit. */
const firstErr = (r) => String(r.stderr || "").trim().split(/\r?\n/).filter(Boolean)[0] || `exit ${r.status}`;

async function planOrApply(cmd, flags) {
  const repo = repoRoot(flags);
  const root = flags.root ?? spineRoot();
  // The target's digest as it stands, read from THIS repo and fenced to it: base_sha seals real bytes, and a path that
  // resolves outside the tree is not a surface of it.
  const digestOf = (rel) => {
    try {
      const full = realpathSync(join(repo, rel));
      const top = realpathSync(repo);
      if (!full.startsWith(top + sep) || !statSync(full).isFile()) return null;
      return createHash("sha256").update(readFileSync(full)).digest("hex");
    } catch { return null; }
  };
  const { modules } = declaredModules(repo);
  const compute = (events) => {
    try { return (cmd === "open" ? planOpen : cmd === "measure" ? planMeasure : planConclude)({ events, modules, digestOf, now: Date.now() }, flags); }
    catch (e) { if (e instanceof EvolveRefusal) die(`${e.code} -- ${e.message}`); throw e; }
  };
  const env = flags.root ? { ...process.env, ARC_SPINE_ROOT: flags.root } : process.env;
  // The spine's own validator judges the payload before it is offered (and derives the experiment idem itself --
  // the emitter refuses a caller-supplied one).
  const judged = (plan) => {
    const emit = ["emit", plan.kind, "--payload", JSON.stringify(plan.payload), "--strict"];
    const dry = spawnSync(process.execPath, [ARC_EVENT, ...emit, "--dry-run"], { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
    if (dry.status !== 0) die(`the spine would refuse this ${plan.kind}: ${firstErr(dry)}`);
    return { emit, digest: planDigest({ kind: plan.kind, payload: plan.payload }) };
  };

  if (flags.expect === undefined) {
    const plan = compute((await readAll(root, "scan")).events.map((e) => e.event));
    const { digest } = judged(plan);
    for (const l of plan.lines) process.stdout.write(`arc-evolve: ${l}\n`);
    process.stdout.write(`arc-evolve: a plan -- nothing was written. To write exactly this, run the same command with --expect ${digest}\n`);
    process.stdout.write(expectLine(digest) + "\n");
    return;
  }
  // THE APPLY: read, check, compare and write inside ONE lock that every evolve apply takes. Without it three opens
  // applied at once each read a spine with none of the others on it and all three landed past a cap of two (PR 3a
  // round-2 logic attack). arc-event takes the spine's own lock for the append; this one serialises the decision.
  withLock(root, () => {
    const plan = compute(scanAll(root).events.map((e) => e.event));
    const { emit, digest } = judged(plan);
    const stale = staleReason(flags.expect, digest);
    if (stale) die(stale);
    for (const l of plan.lines) process.stdout.write(`arc-evolve: ${l}\n`);
    const w = spawnSync(process.execPath, [ARC_EVENT, ...emit], { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
    if (w.status !== 0) die(`the spine refused the ${plan.kind}, and nothing was written: ${firstErr(w)}`);
    const id = String(w.stdout || "").trim().split(/\r?\n/).pop() || "";
    if (!ULID_RE.test(id)) die(`the emitter exited 0 and printed no receipt id -- look for a ${plan.kind} on the spine before running this again`, 1);
    process.stdout.write(`receipt: ${plan.kind} ${id}\n`);
  }, { lockName: ".evolve-apply.lock", timeoutMs: 60_000 });
}

async function renderBoard(flags) {
  const spine = flags.root ?? spineRoot();
  // A plain positive integer literal only. `Number.isFinite` alone accepted "0x10", " 12 " and
  // "1e3", each of which rendered a confident but nonsensical age.
  if (flags.now !== undefined && !/^[0-9]+$/.test(flags.now)) die("--now must be epoch milliseconds (a plain positive integer)");
  const now = flags.now !== undefined ? Number(flags.now) : undefined;
  if (now !== undefined && !Number.isSafeInteger(now)) die("--now is out of range");
  const { modules, rejected } = declaredModules(repoRoot(flags));
  const text = await board(spine, modules, now === undefined ? {} : { now });
  process.stdout.write(text.endsWith("\n") ? text : text + "\n");
  // Reported on stdout so it lands in the board's own record, not lost on a stderr nobody reads.
  for (const r of rejected) process.stdout.write(`REJECTED MANIFEST  ${r.replace(/[\p{Cc}\p{Cf}]/gu, "?")}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flags = parseFlags(cmd, argv);
  if (cmd === "open" || cmd === "measure" || cmd === "conclude") return planOrApply(cmd, flags);
  if (cmd !== "board") die("usage: arc-evolve board|open|measure|conclude ... (see the header)");
  return renderBoard(flags);
}

// The exit code is SET, never forced: process.exit right after the last stdout line can cut a pipe the door is still
// reading (the fixed-defects row the PR 3a attackers carried).
try { await main(); }
catch (e) {
  if (e instanceof Stop) process.exitCode = e.code;
  else { process.stderr.write(`arc-evolve: ${e?.message ?? e}\n`); process.exitCode = 2; }
}
