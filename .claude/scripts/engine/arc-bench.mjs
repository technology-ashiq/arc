#!/usr/bin/env node
/**
 * arc-bench.mjs -- the bench runner (lane `bench`, ADR-0901).
 *
 * Phase 00 lands the ASSERTION SUBSTRATE here (slice 04). The CLI, the fixture-repo harness
 * and the steel thread arrive in later slices; this file is deliberately importable so its
 * scoring is unit-testable without spawning anything.
 *
 * WHY THE SUBSTRATE EXISTS AT ALL (ADR-0905): BEN-G pins v1 quality to "assertion pass-rate,
 * nothing more", and at kickoff NOT ONE fixture in the repo carried an assertion. The only
 * scoring that existed was `expected` validated against the process output schema
 * (arc-run.mjs:184-186), so schema pass-rate and assertion pass-rate -- which REQ-01 requires
 * to stay separate -- would have collapsed onto the same single number.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseYamlSubset } from "./yaml-subset.mjs";

/**
 * The CLOSED op set (ADR-0905 / M5). Deterministic by construction: no op may call a model,
 * read the clock, or touch the network -- that is the "deterministic checks only"
 * non-negotiable, enforced here at the registry rather than trusted to fixture authors.
 *
 * Each entry declares how to validate its `value` so a malformed assertion is REFUSED rather
 * than coerced. `absent` takes NO value at all: a value there means the author meant something
 * other than "this path must not exist", and guessing which is how a fixture ends up asserting
 * a rule nobody wrote.
 */
export const OPS = Object.freeze({
  equals: {
    needsValue: true,
    validate: (v) => (typeof v === "object" && v !== null ? "must be a scalar" : null),
    run: (actual, v) => actual === v,
  },
  matches: {
    needsValue: true,
    validate: (v) => {
      if (typeof v !== "string") return "must be a string regex";
      try { new RegExp(v); return null; } catch (e) { return `is not a valid regex (${e.message})`; }
    },
    run: (actual, v) => typeof actual === "string" && new RegExp(v).test(actual),
  },
  contains: {
    needsValue: true,
    validate: (v) => (typeof v === "object" && v !== null ? "must be a scalar" : null),
    run: (actual, v) =>
      typeof actual === "string" ? actual.includes(String(v)) : Array.isArray(actual) ? actual.includes(v) : false,
  },
  absent: {
    needsValue: false,
    validate: () => null,
    run: (actual) => actual === MISSING,
  },
  length_between: {
    needsValue: true,
    validate: (v) =>
      Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n))
        ? v[0] <= v[1] ? null : "must be [MIN, MAX] with MIN <= MAX"
        : "must be [MIN, MAX], two integers",
    run: (actual, v) => {
      const len = typeof actual === "string" || Array.isArray(actual) ? actual.length : null;
      return len !== null && len >= v[0] && len <= v[1];
    },
  },
});

/** Distinguishes "the path resolved to undefined" from "the path did not resolve". */
export const MISSING = Symbol("missing");

/**
 * Dot-path resolution with numeric indices (M4): `commits.0.subject`. No JSONPath, no
 * wildcards, no filters -- a path language grows into an expression language, and an
 * expression language in a fixture is a program nobody reviews.
 */
export function resolvePath(doc, path) {
  if (typeof path !== "string" || path.length === 0) return MISSING;
  let cur = doc;
  for (const seg of path.split(".")) {
    if (cur === null || typeof cur !== "object") return MISSING;
    const key = /^\d+$/.test(seg) ? Number(seg) : seg;
    if (Array.isArray(cur)) {
      if (typeof key !== "number" || key < 0 || key >= cur.length) return MISSING;
    } else if (!Object.prototype.hasOwnProperty.call(cur, key)) {
      return MISSING;
    }
    cur = cur[key];
  }
  return cur === undefined ? MISSING : cur;
}

/**
 * Validate one assertion's SHAPE. Returns an error string, or null when it is well-formed.
 * An unknown op is REFUSED here and never skipped: a scorer that silently skipped what it did
 * not understand would report 100% assertion pass-rate on a fixture that checked nothing, and
 * `regex` is a plausible near-miss for `matches` that a fixture author will eventually write.
 */
export function validateAssertion(a, where = "assertion") {
  if (a === null || typeof a !== "object" || Array.isArray(a)) return `${where}: must be an object`;
  if (typeof a.id !== "string" || !a.id) return `${where}: needs a non-empty string id`;
  const spec = Object.prototype.hasOwnProperty.call(OPS, a.op) ? OPS[a.op] : null;
  if (!spec) return `${where} (${a.id}): unknown op "${a.op}" -- the closed set is ${Object.keys(OPS).join(", ")}`;
  if (typeof a.path !== "string" || !a.path) return `${where} (${a.id}): needs a non-empty string path`;
  const hasValue = Object.prototype.hasOwnProperty.call(a, "value");
  if (spec.needsValue && !hasValue) return `${where} (${a.id}): op "${a.op}" requires a value`;
  if (!spec.needsValue && hasValue) return `${where} (${a.id}): op "${a.op}" takes no value`;
  if (spec.needsValue) {
    const why = spec.validate(a.value);
    if (why) return `${where} (${a.id}): value ${why}`;
  }
  return null;
}

/**
 * Score one fixture's assertions against a produced document.
 *
 * The zero-denominator rule is the load-bearing part (ADR-0905). A fixture with NO assertions
 * contributes 0 to the denominator and is never counted as a pass, and the reported rate is
 * ABSENT rather than 100%. retro-log 2026-07-30: a pass condition defined as an absence let
 * compliant characterless work pass five runs running -- here, treating "no assertions" as
 * "all passed" would make adding no assertions the cheapest way to look perfect.
 */
export function scoreAssertions(doc, assertions, where = "fixture") {
  if (assertions === undefined) return { total: 0, passed: 0, rate: null, results: [] };
  if (!Array.isArray(assertions)) throw new Error(`${where}: assertions must be a list`);

  const seen = new Set();
  const results = [];
  for (const [i, a] of assertions.entries()) {
    const why = validateAssertion(a, `${where}[${i}]`);
    if (why) throw new Error(why);
    if (seen.has(a.id)) throw new Error(`${where}: duplicate assertion id "${a.id}"`);
    seen.add(a.id);
    const actual = resolvePath(doc, a.path);
    // A path that does not resolve FAILS the assertion rather than erroring (M4) -- except for
    // `absent`, whose whole question is whether it resolved.
    const pass = OPS[a.op].run(actual, a.value);
    results.push({ id: a.id, op: a.op, path: a.path, pass });
  }
  const passed = results.filter((r) => r.pass).length;
  return { total: results.length, passed, rate: results.length ? passed / results.length : null, results };
}

/**
 * Read an eval pack manifest. It lives in a sibling `pack.json` rather than in the process
 * YAML because `process-lint.mjs:65-67` freezes that file's top-level keys and changing them
 * is engine territory (ADR-0902's scope fence).
 */
export function readPack(path) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`pack ${path} does not parse: ${String(e.message).split("\n")[0]}`);
  }
  if (typeof doc?.revision !== "string" || !doc.revision) throw new Error(`pack ${path}: needs a non-empty string revision`);
  if (typeof doc?.task_class !== "string" || !doc.task_class) throw new Error(`pack ${path}: needs a non-empty string task_class`);
  return { revision: doc.revision, task_class: doc.task_class };
}

/** BEN-D's per-class floor. A class below it proposes nothing, and the reason names the count. */
export const MIN_FIXTURES = 5;

export function coverageVerdict(taskClass, fixtureCount) {
  return fixtureCount >= MIN_FIXTURES
    ? { eligible: true, reason: null }
    : { eligible: false, reason: `NO PROPOSAL - evidence insufficient (${fixtureCount} of ${MIN_FIXTURES} fixtures)` };
}

/**
 * How many fixtures a task class actually SHIPS, read from the process's own `evals:` list.
 *
 * Counted from the DECLARED list, never from a directory listing: a file sitting beside the
 * pack that nothing declares is not part of it, and counting the directory would let a stray
 * or half-added fixture lift a class over the floor without anything running it.
 *
 * This is deliberately standalone -- it is the whole of the coverage gate, and it does not
 * reach for Phase 2's gates-first eligibility engine, which does not exist yet. REQ-06 needs
 * `review-diff` and `kickoff-plan` to read NO PROPOSAL at Phase 0 close, and a criterion that
 * could only be exercised by a later phase would be marked done here without ever running
 * (retro-log 2026-08-02: an exit criterion its own verifier could not check).
 */
export function declaredFixtureCount(root, processName) {
  const path = join(root, "processes", `${processName}.process.yaml`);
  const parsed = parseYamlSubset(readFileSync(path, "utf8"));
  if (!parsed.ok) throw new Error(`${processName}: canonical file does not parse: ${parsed.error?.what ?? "unknown"}`);
  const evals = parsed.value?.evals;
  if (!Array.isArray(evals)) throw new Error(`${processName}: evals is missing or not a list`);
  return evals.length;
}

/** The coverage line a report prints for one class, counted rather than assumed. */
export function classCoverage(root, processName) {
  const count = declaredFixtureCount(root, processName);
  return { taskClass: processName, count, ...coverageVerdict(processName, count) };
}

// ---------------------------------------------------------------------------------------------
// The fixture-repo harness (M3 / M11).
//
// `commit-msg-draft` declares `inputs: []`. Its real input is AMBIENT GIT STATE -- it runs
// `git status` / `git diff` and then stages and commits. So five fixtures sharing the input `{}`
// would be five samples of ONE case, which is the K dimension, not five cases. What has to vary
// is the repository the driver sees.
//
// A state is a directory holding two trees:
//   base/  the committed starting point
//   work/  the uncommitted changes the process must find
//
// THE HARNESS DELIBERATELY DOES NOT STAGE. Staging is the process's own declared job
// (`git.op: add:*`, `commit:*`), and a pre-staged index would do that work for it and leave the
// model nothing to decide -- the fixture-that-measures-nothing failure this phase exists to
// avoid. The harness builds the situation; the process acts on it.
// ---------------------------------------------------------------------------------------------

import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

/**
 * A work tree cannot express a DELETION by copying, so it marks one with a tombstone:
 * `path/to/file.arc-deleted`. After the overlay, each tombstone removes its target and then
 * itself, leaving the deletion visible to `git status` exactly as a real one would be.
 *
 * This exists because `delete-and-add` is the one fixture where a draft built only from ADDED
 * lines describes half the change. Without a way to delete, that case could not be posed at all.
 *
 * The walk is hand-rolled rather than `readdirSync(dir, { recursive: true })`: that option
 * landed in Node 18.17 and CI runs an 18 leg, so the convenient call would fail on exactly one
 * of the three legs -- the class of failure this repo keeps paying for.
 */
function applyTombstones(root) {
  const SUFFIX = ".arc-deleted";
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== ".git") walk(p); continue; }
      if (!e.name.endsWith(SUFFIX)) continue;
      const target = p.slice(0, -SUFFIX.length);
      if (!existsSync(target)) throw new Error(`tombstone ${p} names no existing file -- the base tree never had ${target}`);
      rmSync(target, { force: true });
      rmSync(p, { force: true });
    }
  };
  walk(root);
}

function git(root, args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    throw new Error(`git ${args.join(" ")} failed in ${root}: ${String(e.stderr || e.message).split("\n")[0]}`);
  }
}

/**
 * Materialize one repo state into a throwaway directory and return its root plus a cleanup.
 *
 * Identity is set as REPO-LOCAL config, never through GIT_AUTHOR_* in the environment: an
 * env-scoped identity passes on a developer box that already has a global git identity and
 * fails 128 on a clean CI runner that does not. Committing is not optional here -- the base
 * tree must be a real commit for `git diff` to have anything to compare against.
 */
export function materializeRepoState(stateDir) {
  if (!existsSync(join(stateDir, "base"))) throw new Error(`repo state ${stateDir}: missing base/`);
  if (!existsSync(join(stateDir, "work"))) throw new Error(`repo state ${stateDir}: missing work/`);

  const root = mkdtempSync(join(tmpdir(), "arc-bench-repo-"));
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  try {
    cpSync(join(stateDir, "base"), root, { recursive: true });
    git(root, ["init", "-q"]);
    git(root, ["config", "user.name", "arc-bench fixture"]);
    git(root, ["config", "user.email", "bench@arc.invalid"]);
    git(root, ["config", "commit.gpgsign", "false"]);
    git(root, ["add", "-A"]);
    git(root, ["commit", "-q", "--no-gpg-sign", "-m", "base"]);
    // Overlay the working changes and leave them UNSTAGED. This is the whole point.
    cpSync(join(stateDir, "work"), root, { recursive: true });
    applyTombstones(root);
    return { root, cleanup };
  } catch (e) {
    // Never leak a temp repo on the failure path -- a harness that only cleans up when it
    // succeeds fills the runner's disk exactly when something is already wrong.
    cleanup();
    throw e;
  }
}

/**
 * Porcelain status of the materialized repo, for asserting the index is genuinely dirty.
 *
 * ONLY the trailing newline is stripped -- never `.trim()`. Porcelain column 1 is the INDEX and
 * column 2 the WORKTREE, so an unstaged modification is ` M path` with a LEADING SPACE, and
 * trimming it turns that into `M path`, which reads as staged. The first draft of this function
 * trimmed, and the staged-versus-unstaged assertion -- the one property this harness exists to
 * guarantee -- silently could not be made. Caught by the test that asserts it.
 */
export function repoStatus(root) {
  return git(root, ["status", "--porcelain"]).replace(/\r?\n$/, "");
}

// ---------------------------------------------------------------------------------------------
// The runner -- the steel thread (slice 09).
//
// Discover the declared classes -> gate each on the fixture floor -> materialize a fixture's repo
// state (M3) -> shell out to `arc-run` ONCE per attempt (M1) -> score the produced document
// against that fixture's assertions -> emit ONE `run.completed` (M6) -> and then LOOK for that
// receipt in `events/` and in `events/_quarantine/`, because exit 0 from a fire-and-forget writer
// is not evidence anything was written (retro-log 2026-08-02).
//
// TWO OF M1's THREE ENV VARS DO NOT SURVIVE `arc-run`, and this was MEASURED rather than read.
// M1 says bench sets `ARC_ROOT` (the materialized repo), `ARC_DRIVER_MODEL` and
// `ARC_MOCK_FIXTURE` per attempt. `arc-run.mjs:378-381` builds the driver's environment as
// `{ ...process.env, ARC_DRIVER_COST_FILE, ARC_ROOT: root, ARC_DRIVER_MODEL: pinnedModel ?? "" }`,
// so it OVERWRITES the first two and only `ARC_MOCK_FIXTURE` passes through untouched.
//
//   ARC_ROOT          pointed at a directory holding no recordings at all; the run still
//                     succeeded and replayed the right bytes, which it could only do by
//                     resolving the recording dir from arc-run's root instead.
//   ARC_DRIVER_MODEL  set to `claude-opus-5`; arc-run's own receipt came back
//                     `payload.model: "unpinned"`. With an explicit `--driver`, `tier` is null,
//                     so `pinnedModel` is null and the driver is handed the empty string. A model
//                     can ONLY be pinned through `--driver auto` plus a router row -- and
//                     `engine/router.yaml` is do-not-touch for this lane, permanently.
//
// Bench sets all three anyway, exactly as M1 instructs, because the instruction is the thing
// under test: the tests below assert the MEASURED behaviour, so the day the engine grows a
// target-repo seam the assertions fail loudly instead of a stale comment going quietly wrong.
//
// The consequence is a REPORTED ENGINE GAP, not a bench fix: `arc-run` spawns every driver with
// `cwd` and `ARC_ROOT` set to the arc repo, so there is no seam through which the materialized
// fixture repo can reach a real driver. `arc-run.mjs` is a one-line-only path for this lane
// (PLAN touch-with-care 3), so widening it here would be the scope breach the fence exists to
// stop. It is the same class as the `ARC_DRIVER_FAKE` short-circuit this phase already reports
// and does not fix, and Phase 1 cannot compare two real models until one of them is closed.
// ---------------------------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseBudget } from "./drivers/common.mjs";

/** The `--process` identity on bench's own receipts (M6). Bench is a runner, never a process. */
export const BENCH_ID = "bench@0.1.0";

/**
 * M13. 0 = every selected fixture was scored · 1 = partial, budget-aborted, or a replay MISMATCH
 * · 2 = operator error · **3 = stale-format**, which Phase 1 adds.
 *
 * Stale-format is not a mismatch and must not share its code. A normalizer bump invalidates every
 * stored scorecard by construction (ADR-0913), and reporting that as a mismatch sends someone
 * hunting a corruption that never happened.
 */
export const EXIT = Object.freeze({ OK: 0, PARTIAL: 1, OPERATOR: 2, STALE: 3 });

/** Anything the operator can fix by retyping the command. Never a scoring outcome. */
export class OperatorError extends Error {}

/**
 * M13 fixed a closed SIX-flag set. Phase 1 adds exactly two, and the amendment is recorded rather
 * than slipped in: its DoD requires *"re-scoring captured outputs yields a byte-identical
 * scorecard"*, and there is no way to say "score these captured bytes" in six flags that were all
 * written for a live run. `--out` is what makes the capture bundle exist to replay at all, and
 * giving it a default instead would make every test write to one shared path.
 */
const VALUE_FLAGS = Object.freeze({ "--driver": "driver", "--model": "model", "--budget": "budget", "--champion": "champion", "--out": "out", "--replay": "replay" });
const BOOL_FLAGS = Object.freeze({ "--propose": "propose", "--dry-run": "dryRun" });

/**
 * The budget dimensions bench ACTUALLY enforces. `min` is wall-clock, which bench measures
 * itself and genuinely decrements; `inr` is a ceiling it passes down and cannot observe (ADR-0904).
 * Anything else is refused rather than accepted-and-ignored.
 */
export const BUDGET_DIMENSIONS = Object.freeze(["inr", "min"]);

/** Render a parsed budget back into the wire grammar `inr=N,min=M`. */
export function budgetString(b) {
  return Object.entries(b).map(([k, v]) => `${k}=${v}`).join(",");
}

/**
 * The closed flag set (M13), and `exit 2` naming anything outside it.
 *
 * A flag whose value is missing must never swallow the NEXT flag. `.claude/rules/lanes.md`
 * records that exact failure: an unquoted empty value ate the following flag, and a surface with
 * no creation rights was thereby made to report `create`.
 */
export function parseArgs(argv) {
  const out = { driver: "", model: "", budget: "", champion: "", out: "", replay: "", propose: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (Object.prototype.hasOwnProperty.call(BOOL_FLAGS, a)) { out[BOOL_FLAGS[a]] = true; continue; }
    if (!Object.prototype.hasOwnProperty.call(VALUE_FLAGS, a)) {
      throw new OperatorError(`unknown option ${a} -- the closed set is ${[...Object.keys(VALUE_FLAGS), ...Object.keys(BOOL_FLAGS)].join(" ")}`);
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new OperatorError(`${a} needs a value`);
    out[VALUE_FLAGS[a]] = v;
    i++;
  }
  // Parsed-and-ignored is worse than refused: a flag that quietly does nothing reads, on a
  // scorecard, exactly like a flag that worked. Checked BEFORE the replay branch below, or
  // `--replay DIR --propose` would slip past on the early return.
  if (out.champion) throw new OperatorError("--champion names the incumbent to beat and arrives with Phase 2's proposal -- it is refused rather than ignored");
  if (out.propose) throw new OperatorError("--propose writes a swap proposal and arrives with Phase 2 -- it is refused rather than ignored");
  // Replay invokes nothing and spends nothing, so demanding a driver and a budget for it would be
  // asking the operator to name things the run will never use -- and a required field nobody
  // reads teaches people to type anything into it.
  if (out.replay) {
    for (const [flag, key] of [["--driver", "driver"], ["--budget", "budget"], ["--model", "model"]]) {
      if (out[key]) throw new OperatorError(`${flag} is meaningless with --replay, which re-scores captured bytes and invokes nothing`);
    }
    if (out.dryRun) throw new OperatorError("--dry-run is meaningless with --replay");
    return out;
  }
  if (!out.driver) throw new OperatorError("--driver is required");
  if (!out.budget) throw new OperatorError("--budget is required -- a run with no ceiling is unbounded spend");
  // The GRAMMAR is common.mjs's; the DIMENSIONS are bench's, and they are checked separately.
  // `--budget rupees=1` parses perfectly -- `[a-z]+=N` -- and then bounds nothing at all, so a
  // typo like `inrr=10` reads on the scorecard as a budget and enforces none. Found by this
  // slice's own probe, which expected a refusal and got an acceptance.
  let parsedBudget;
  try { parsedBudget = parseBudget(out.budget); } catch (e) { throw new OperatorError(e.message); }
  const unknown = Object.keys(parsedBudget).filter((k) => !BUDGET_DIMENSIONS.includes(k));
  if (unknown.length) throw new OperatorError(`--budget has no dimension \`${unknown[0]}\` (bench enforces ${BUDGET_DIMENSIONS.join(", ")}) -- a bound nothing reads is not a bound`);
  if (!Object.keys(parsedBudget).length) throw new OperatorError("--budget names no dimension at all");
  return out;
}

/** The drivers this tree actually ships, read from disk rather than from a second hardcoded list. */
export function knownDrivers(root) {
  return readdirSync(join(root, ".claude/scripts/engine/drivers"))
    .filter((f) => f.endsWith(".sh"))
    .map((f) => f.slice(0, -3))
    .sort();
}

/**
 * The driver's own identity, from the opt-in `version` verb (ADR-0902/0903).
 *
 * It rides BESIDE the model fingerprint and never replaces it. A driver that does not answer the
 * verb leaves this ABSENT -- never "unknown", never the driver's bare name, because a provenance
 * field that is always populated stops distinguishing a driver that reported from one that did
 * not (ADR-0069 b5: recorded, estimated and fabricated are three different things).
 *
 * `produce()`'s returned `model` is NOT a channel for this: `runDriver` destructures only
 * `{ output, cost }` (common.mjs:210), so the mock's returned `model` is discarded and the verb
 * is the only path that reaches a caller.
 */
export function driverIdentity(root, driver) {
  const sh = join(root, ".claude/scripts/engine/drivers", `${driver}.sh`);
  if (!existsSync(sh)) return null;
  const res = spawnSync("bash", [sh, "version"], { encoding: "utf8", cwd: root, timeout: 30000, killSignal: "SIGKILL" });
  if (res.status !== 0) return null;
  return (res.stdout || "").trim() || null;
}

/**
 * One class: its declared fixtures and its eval pack, both read from the DECLARED `evals:` list
 * rather than from a directory listing, for the reason `declaredFixtureCount` states.
 */
export function loadClass(root, processName) {
  const canon = join(root, "processes", `${processName}.process.yaml`);
  const parsed = parseYamlSubset(readFileSync(canon, "utf8"));
  if (!parsed.ok) throw new OperatorError(`${processName}: canonical file does not parse: ${parsed.error?.what ?? "unknown"}`);
  const evals = parsed.value?.evals;
  if (!Array.isArray(evals) || evals.length === 0) throw new OperatorError(`${processName}: evals is missing or empty`);

  const fixtures = evals.map((rel) => {
    const p = resolve(root, rel);
    let doc;
    try { doc = JSON.parse(readFileSync(p, "utf8")); }
    catch (e) { throw new OperatorError(`${processName}: eval fixture ${rel} is unreadable: ${String(e.message).split("\n")[0]}`); }
    return { id: typeof doc.repo_state === "string" && doc.repo_state ? doc.repo_state : null, file: rel, dir: dirname(p), doc };
  });

  // The pack is a SIBLING of the fixtures (ADR-0905): `process-lint.mjs:65-67` freezes the
  // process YAML's top-level keys, so the eval-pack revision cannot live there.
  const packPath = join(fixtures[0].dir, "pack.json");
  const pack = existsSync(packPath) ? readPack(packPath) : null;
  // The process VERSION is part of the provenance tuple (ADR-0913): the same fixtures scored
  // against a different revision of the process are not comparable numbers.
  const version = typeof parsed.value?.version === "string" ? parsed.value.version : null;
  return { processName, fixtures, pack, version };
}

/** Every class this tree declares, each carrying its coverage verdict. */
export function discoverClasses(root) {
  return readdirSync(join(root, "processes"))
    .filter((f) => f.endsWith(".process.yaml"))
    .map((f) => f.slice(0, -".process.yaml".length))
    .sort()
    .map((name) => classCoverage(root, name));
}

/**
 * ONE attempt: materialize, invoke `arc-run` once (M1), score, and clean up on every path.
 *
 * The materialized repo is torn down in a `finally`, including when the attempt throws -- a
 * harness that only cleans up on success fills the runner disk exactly when something is already
 * wrong, which is the moment the next diagnosis needs the disk.
 */
export function runAttempt(root, { processName, fixture, driver, model, budget, timeoutMs }) {
  const stateDir = join(fixture.dir, "repo-states", fixture.id);
  const state = materializeRepoState(stateDir);
  const tmp = mkdtempSync(join(tmpdir(), "arc-bench-in-"));
  const started = Date.now();
  // Snapshot BEFORE the spawn: the receipt arc-run is about to write is how bench learns whether
  // a failure was the schema, the driver, the budget or policy -- four outcomes that share exit 1.
  const spineBefore = spineOffsets(root);
  try {
    const inputFile = join(tmp, "input.json");
    writeFileSync(inputFile, JSON.stringify(fixture.doc.input ?? {}), "utf8");

    // `--root` is passed EXPLICITLY and is not in M1's command line. Without it, arc-run resolves
    // its root from `ARC_ROOT` -- which bench has just pointed at the materialized fixture repo,
    // where `processes/` does not exist -- and the run dies with "no such process". The env var
    // and the flag answer two different questions and only the flag answers arc-run's.
    const args = [
      join(root, ".claude/scripts/engine/arc-run.mjs"),
      "--process", processName,
      "--driver", driver,
      "--input", `@${inputFile}`,
      "--budget", budgetString(budget),
      "--root", root,
    ];
    const res = spawnSync(process.execPath, args, {
      encoding: "utf8",
      cwd: root,
      timeout: timeoutMs,
      // arc-run already raised its own driver ceiling to 64 MiB after Node's 1 MiB default
      // truncated a large but valid answer and the driver was blamed for it. Same reasoning here.
      maxBuffer: 64 * 1024 * 1024,
      killSignal: "SIGKILL",
      env: { ...process.env, ARC_ROOT: state.root, ARC_DRIVER_MODEL: model, ARC_MOCK_FIXTURE: fixture.id },
    });

    const elapsedMs = Date.now() - started;
    // Read the repo BEFORE cleanup. With a replay driver this comes back exactly as materialized,
    // which is itself the evidence that no driver ever reached it.
    const after = repoStatus(state.root);

    // arc-run's own receipt for THIS attempt: the structured verdict, and the only place a
    // measured cost is visible to bench at all.
    const appended = spineSince(root, spineBefore).filter((e) => e.kind === "run.completed" && e.process !== BENCH_ID);
    const receipt = appended.length ? appended[appended.length - 1] : null;
    const reason = receipt?.payload?.reason ?? null;
    // ALL-OR-NOTHING, and absent stays absent: the spine writes a `cost` block only when a real
    // rupee figure exists. Token counts ride in the payload and are not a cost.
    const measuredInr = Number.isFinite(receipt?.cost?.inr_estimate) ? receipt.cost.inr_estimate : null;

    if (res.error && res.error.code === "ETIMEDOUT") {
      return { ok: false, verdict: "budget", why: "arc-run exceeded the attempt timeout", elapsedMs, after, schema: null, measuredInr, reason: "budget" };
    }
    const status = res.status ?? 1;
    if (status !== 0) {
      const line = String(res.stderr || "").trim().split("\n").filter(Boolean).pop() || `arc-run exited ${status}`;
      // SCHEMA IS ONLY EVALUATED WHERE AN OUTPUT EXISTED. A driver that never answered leaves the
      // schema question unasked, and counting that as a schema failure would blame the process
      // for a fault arc-run has already attributed elsewhere (ADR-0204).
      const schema = reason === "schema" ? false : null;
      return { ok: false, verdict: reason || "run", why: line, elapsedMs, after, schema, measuredInr, reason };
    }
    let output;
    try { output = JSON.parse(res.stdout); }
    catch (e) { return { ok: false, verdict: "run", why: `arc-run stdout is not JSON: ${e.message}`, elapsedMs, after, schema: null, measuredInr, reason }; }

    const score = scoreAssertions(output, fixture.doc.assertions, fixture.id);
    // arc-run validates the output against the process schema before it ever prints it
    // (arc-run.mjs:184-186), so an exit-0 attempt is a schema PASS by construction.
    return { ok: true, verdict: "ok", output, score, elapsedMs, after, schema: true, measuredInr, reason: null };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    state.cleanup();
  }
}

// =============================================================================================
// Phase 01 -- bench core.
// =============================================================================================

// ---- the canonical encoder (ADR-0913) --------------------------------------------------------

/**
 * Bumping this invalidates every stored scorecard, which is precisely why it lives INSIDE each
 * one: a replay against a scorecard written by a different normalizer must report
 * **stale-format**, not tamper. They are different facts and they get different exit codes.
 */
export const NORMALIZER_VERSION = "1.0.0";

/** A value the encoder refuses. Distinct from OperatorError: the operator did not type this. */
export class EncodeError extends Error {}

/**
 * A TOTAL, TYPE-TAGGED encoding. Total means every input either encodes or REFUSES -- it never
 * coerces. `JSON.stringify` is neither: it folds `undefined` out of objects, turns `NaN` and
 * `±Infinity` into `null`, and throws only on `BigInt` and cycles. Each of those silently
 * produces a hash that collides with a genuinely different document.
 *
 * Type-tagged means `1` and `"1"` cannot encode alike, and strings are LENGTH-PREFIXED so
 * `{a: "b:c"}` cannot collide with a different shape that happens to serialize the same runs of
 * characters. Object keys are sorted by UTF-16 code unit, which is `Array#sort`'s own default
 * and therefore identical on all three CI legs -- `localeCompare` is not.
 */
export function canonicalString(value, path = "$", seen = new Set()) {
  const t = typeof value;
  if (value === null) return "z";
  if (t === "boolean") return value ? "b:1" : "b:0";
  if (t === "number") {
    if (Number.isNaN(value)) throw new EncodeError(`${path}: NaN is refused, not folded to null`);
    if (!Number.isFinite(value)) throw new EncodeError(`${path}: ${value > 0 ? "Infinity" : "-Infinity"} is refused, not folded to null`);
    // -0 and 0 are different bit patterns that String() renders identically. Encoding them alike
    // would make two distinct documents hash the same, which is the one thing this must not do.
    return `n:${Object.is(value, -0) ? "-0" : String(value)}`;
  }
  if (t === "string") return `s:${value.length}:${value}`;
  if (t === "bigint") throw new EncodeError(`${path}: BigInt is refused -- it has no JSON form and coercing it loses precision`);
  if (t === "undefined") throw new EncodeError(`${path}: undefined is refused -- an absent field is an absent KEY, never a present undefined`);
  if (t === "function" || t === "symbol") throw new EncodeError(`${path}: ${t} is refused`);
  if (seen.has(value)) throw new EncodeError(`${path}: cycle -- this value already appears on the path to itself`);
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `a:${value.length}:[${value.map((v, i) => canonicalString(v, `${path}[${i}]`, seen)).join(",")}]`;
    }
    const keys = Object.keys(value).sort();
    const parts = keys.map((k) => `${k.length}:${k}=${canonicalString(value[k], `${path}.${k}`, seen)}`);
    return `o:${keys.length}:{${parts.join(",")}}`;
  } finally {
    // Removed on the way OUT, so a value repeated as a SIBLING is fine and only a value on the
    // path to itself is a cycle. A plain WeakSet that never cleared would refuse `[x, x]`.
    seen.delete(value);
  }
}

/** The identity of a document, for comparing two runs without diffing them by eye. */
export function canonicalHash(value) {
  return createHash("sha256").update(canonicalString(value), "utf8").digest("hex");
}

/**
 * Deterministic pretty JSON: sorted keys, 2-space indent, a single trailing newline, and `\n`
 * line endings on every platform. This is what makes the scorecard BYTE-identical rather than
 * merely equal -- `JSON.stringify` preserves insertion order, so two runs that built the same
 * object in a different order would produce different bytes and a `diff` nobody could explain.
 *
 * It refuses exactly what `canonicalString` refuses, by running it first. A writer that was more
 * permissive than the hasher would let a document be stored that could never be verified.
 */
export function canonicalJson(value) {
  canonicalString(value);
  const render = (v, indent) => {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    const pad = "  ".repeat(indent + 1);
    const close = "  ".repeat(indent);
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      return `[\n${v.map((x) => `${pad}${render(x, indent + 1)}`).join(",\n")}\n${close}]`;
    }
    const keys = Object.keys(v).sort();
    if (!keys.length) return "{}";
    return `{\n${keys.map((k) => `${pad}${JSON.stringify(k)}: ${render(v[k], indent + 1)}`).join(",\n")}\n${close}}`;
  };
  return `${render(value, 0)}\n`;
}

// ---- ceilings and K-group admission control (ADR-0904 / ADR-0909) ----------------------------

/**
 * The ceiling file. Hand-authored, dated, and the ONLY input to the reservation.
 *
 * A MISSING entry is a REFUSAL, never a default. A default ceiling would be a number nobody
 * measured doing the work of a bound, and the direction of that error is unrecoverable: it
 * admits a group it should have refused. Refusing to spend is the recoverable direction.
 */
export function readCeilings(root) {
  // A TEST-ONLY door, the same shape and the same contract as `ARC_SPINE_ROOT`: honoured on
  // PRESENCE so an empty value cannot fall through to the real file, and deliberate enough that
  // a reviewer sees it in a diff. Admission control cannot be exercised at all without it --
  // every interesting case needs caps the shipped file does not have, and editing the shipped
  // ceilings from a test would leave the repo's real safety bound as test scaffolding.
  const named = "ARC_BENCH_CEILINGS" in process.env ? String(process.env.ARC_BENCH_CEILINGS) : "";
  if ("ARC_BENCH_CEILINGS" in process.env && !named.trim()) {
    throw new OperatorError("ARC_BENCH_CEILINGS is set but empty -- refusing to fall back to a ceiling file nobody named");
  }
  const path = named ? resolve(named) : join(root, "initiatives/bench/ceilings.json");
  let doc;
  try { doc = JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { throw new OperatorError(`ceilings: ${path} is unreadable (${String(e.message).split("\n")[0]})`); }
  for (const k of ["as_of", "run_cap_inr", "process_cap_inr", "k", "worst_case_inr_per_invocation"]) {
    if (!Object.prototype.hasOwnProperty.call(doc, k)) throw new OperatorError(`ceilings: missing \`${k}\``);
  }
  if (!Number.isInteger(doc.k) || doc.k < 1) throw new OperatorError("ceilings: `k` must be a positive integer");
  for (const k of ["run_cap_inr", "process_cap_inr"]) {
    if (!Number.isFinite(doc[k]) || doc[k] < 0) throw new OperatorError(`ceilings: \`${k}\` must be a non-negative number`);
  }
  return doc;
}

/** The declared worst case for one driver+model pair, or null when the file does not declare one. */
export function worstCaseFor(ceilings, driver, model) {
  const byDriver = ceilings.worst_case_inr_per_invocation?.[driver];
  if (!byDriver) return null;
  const key = model || "(unpinned)";
  const v = Object.prototype.hasOwnProperty.call(byDriver, key) ? byDriver[key] : undefined;
  return Number.isFinite(v) ? v : null;
}

/**
 * The run's budget state: ONE remainder, threaded through every attempt, retry and fallback hop.
 *
 * retro-log 2026-08-03 (arc-engine): *a bound was enforced per-ATTEMPT while being described
 * per-RUN -- fallback hops and the retry each received a fresh full budget (4x the stated cap),
 * and a timeout was classified a driver fault so budget exhaustion TRIGGERED the fallback that
 * spent it again.* Hence: exhaustion is a TERMINAL outcome here and has no path to a retry.
 */
export function newBudgetState(ceilings, cliCeilingInr) {
  // The CLI ceiling, when given, may only TIGHTEN the file's run cap. A flag that could raise it
  // would make the declared cap advisory.
  const runCap = Number.isFinite(cliCeilingInr) ? Math.min(cliCeilingInr, ceilings.run_cap_inr) : ceilings.run_cap_inr;
  return {
    runCap,
    processCap: ceilings.process_cap_inr,
    k: ceilings.k,
    runCommitted: 0,
    perProcessCommitted: new Map(),
    exhausted: false,
    reasons: [],
  };
}

/**
 * Reserve a whole K-group before the fixture starts, against BOTH caps.
 *
 * The unit is the GROUP, not the invocation: stopping mid-group leaves a fixture with 2 of 3
 * attempts, which the completeness gate disqualifies anyway, so the spend bought nothing. A
 * per-invocation reservation under-reserves a K=3 group by 3x and strands fixtures mid-group.
 */
export function admitGroup(state, processName, worstCase) {
  if (worstCase === null) {
    return { admitted: false, reason: "no ceiling is declared for this driver and model -- a missing ceiling is a refusal, never a default" };
  }
  const need = state.k * worstCase;
  const usedByProcess = state.perProcessCommitted.get(processName) ?? 0;
  if (state.runCommitted + need > state.runCap) {
    return { admitted: false, reason: `the run remainder cannot cover a K=${state.k} group (needs ${need}, ${state.runCap - state.runCommitted} left of ${state.runCap})` };
  }
  if (usedByProcess + need > state.processCap) {
    return { admitted: false, reason: `the ${processName} sub-cap cannot cover a K=${state.k} group (needs ${need}, ${state.processCap - usedByProcess} left of ${state.processCap})` };
  }
  state.runCommitted += need;
  state.perProcessCommitted.set(processName, usedByProcess + need);
  return { admitted: true, reserved: need, reason: null };
}

/**
 * Replace a group's reservation with what the drivers actually reported.
 *
 * ONLY where a driver reported. An absent measurement cannot replace a reservation: the
 * reservation stays, because it is the only bound left. Where the measurement EXCEEDS the
 * reservation the remainder takes the real figure, so every later group is admitted off the
 * corrected remainder rather than off a stale reservation that has already been overspent.
 */
export function reconcileGroup(state, processName, reserved, measuredInr) {
  if (measuredInr === null) return { applied: false, delta: 0 };
  const delta = measuredInr - reserved;
  state.runCommitted += delta;
  state.perProcessCommitted.set(processName, (state.perProcessCommitted.get(processName) ?? 0) + delta);
  if (state.runCommitted >= state.runCap || (state.perProcessCommitted.get(processName) ?? 0) >= state.processCap) {
    state.exhausted = true;
    state.reasons.push(`measured spend reached a cap after reconciling ${processName}`);
  }
  return { applied: true, delta };
}

// ---- statistics that do not collapse K -------------------------------------------------------

/**
 * The median WITH its spread. K attempts are never collapsed into one per-fixture verdict: a
 * 2-of-3 fixture and a 1-of-3 fixture must not report as the same number, and a bare median
 * makes them identical whenever the median lands on the same value.
 */
export function medianWithSpread(values) {
  const xs = values.filter((v) => typeof v === "number" && Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!xs.length) return { median: null, min: null, max: null, n: 0 };
  const mid = Math.floor(xs.length / 2);
  const median = xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  return { median, min: xs[0], max: xs[xs.length - 1], n: xs.length };
}

// ---- the receipt, and proving it landed ------------------------------------------------------

/** Where the spine actually is. `ARC_SPINE_ROOT` wins on PRESENCE, matching `spine-io.mjs:41`. */
export function spinePaths(root) {
  const base = "ARC_SPINE_ROOT" in process.env && String(process.env.ARC_SPINE_ROOT).trim()
    ? resolve(String(process.env.ARC_SPINE_ROOT))
    : join(root, ".claude/state/hq");
  return { events: join(base, "events"), quarantine: join(base, "events", "_quarantine") };
}

/**
 * Look for the receipt in BOTH places, and scan EVERY day file rather than today's.
 *
 * arc-run's own verifier derives the day from `new Date().toISOString()` (UTC) while the spine
 * keys its files on IST, so on either side of midnight it looks in a file the receipt was never
 * written to and reports a false alarm. Scanning the directory removes the clock from the answer
 * entirely -- and a verifier that cries wolf on a green run is a verifier people mute.
 */
export function findReceipt(root, id) {
  const { events, quarantine } = spinePaths(root);
  let inEvents = false;
  if (existsSync(events)) {
    for (const e of readdirSync(events, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
      if (readFileSync(join(events, e.name), "utf8").includes(id)) { inEvents = true; break; }
    }
  }
  let quarantined = null;
  const walk = (d) => {
    if (quarantined || !existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.isFile()) continue;
      try { if (readFileSync(p, "utf8").includes(id)) { quarantined = p; return; } } catch { /* unreadable is not found */ }
    }
  };
  walk(quarantine);
  return { inEvents, quarantined, landed: inEvents && !quarantined };
}

/**
 * A byte-offset snapshot of every sealed day file, so the events appended by ONE attempt can be
 * read back without re-parsing the whole log or guessing at ordering.
 *
 * This is how bench attributes a fault. `arc-run` already writes a structured verdict --
 * `payload.reason` is one of schema | driver | budget | policy -- and reading that receipt is
 * strictly better than scraping its stderr for a phrase. It also keeps schema pass-rate and
 * assertion pass-rate genuinely separate, which is a REQ-01 requirement and not something that
 * can be inferred from an exit code alone: exit 1 covers all four reasons.
 */
export function spineOffsets(root) {
  const { events } = spinePaths(root);
  const out = new Map();
  if (!existsSync(events)) return out;
  for (const e of readdirSync(events, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
    out.set(e.name, readFileSync(join(events, e.name), "utf8").length);
  }
  return out;
}

/** Every event appended since the snapshot, in file order. Unparseable lines are skipped. */
export function spineSince(root, before) {
  const { events } = spinePaths(root);
  const out = [];
  if (!existsSync(events)) return out;
  for (const e of readdirSync(events, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
    const text = readFileSync(join(events, e.name), "utf8");
    const from = before.get(e.name) ?? 0;
    for (const line of text.slice(from).split("\n")) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch { /* a torn line is not an event */ }
    }
  }
  return out;
}

/**
 * Emit bench's one receipt, the way arc-run does (M6). Bench NEVER writes to `events/` itself.
 *
 * `--strict` is first-party (ADR-0031/0032): without it the emitter runs in hook mode, exits 0
 * and quarantines, so a failure to record would read as a success.
 */
export function emitRunCompleted(root, payload, outcome) {
  // THE PAYLOAD GOES THROUGH A FILE, NEVER THROUGH ARGV, and this was found by running it rather
  // than by reading it. A not-scored attempt records the driver's own message, which on Windows
  // names a path -- and `C:\Users\...` survives `JSON.stringify` as `\\U`, then does NOT survive
  // the trip through `spawnSync -> Windows command line -> bash -> node`. The emitter came back
  // `REJECT BAD_JSON -- --payload: invalid escape \U`, so the ONE receipt that mattered (the one
  // reporting the failure) was the one that could not be written. It is the same rule CLAUDE.md
  // states for shell-embedded programs: the moment the text wants a backslash, it belongs in a
  // file. `arc-run.mjs:257` still passes `--payload` inline and carries the identical latent bug;
  // that is engine's to fix, and bench reports it rather than widening its one-line diff there.
  const tmp = mkdtempSync(join(tmpdir(), "arc-bench-emit-"));
  try {
    const payloadFile = join(tmp, "payload.json");
    writeFileSync(payloadFile, JSON.stringify(payload), "utf8");
    const args = [
      join(root, ".claude/scripts/hq/arc-event.sh"), "emit", "run.completed",
      "--payload-file", payloadFile,
      "--process", BENCH_ID,
      "--outcome", outcome,
      "--strict",
    ];
    const res = spawnSync("bash", args, { encoding: "utf8", cwd: root, timeout: 30000, killSignal: "SIGKILL" });
    const id = String(res.stdout || "").trim();
    if (res.status !== 0 || !id) {
      const why = String(res.stderr || "").trim().split("\n").filter(Boolean)[0] || `the emitter exited ${res.status}`;
      return { id: null, landed: false, inEvents: false, quarantined: null, why };
    }
    return { id, why: null, ...findReceipt(root, id) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
// ---- the run ---------------------------------------------------------------------------------

/** The SHA of the router, so a propose-only run can prove it changed nothing. */
export function routerSha(root) {
  const p = join(root, "engine", "router.yaml");
  return existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex") : null;
}

/** The SHA of a fixture's input, for the provenance tuple (ADR-0913). */
function inputSha(input) {
  return createHash("sha256").update(canonicalString(input ?? {}), "utf8").digest("hex");
}

/**
 * Score one fixture's K captured outputs. This is the PURE half of the run (ADR-0913): it takes
 * bytes and fixtures and returns numbers, touching no clock, no network and no subprocess. It is
 * what makes a disputed figure re-checkable for free, and what the replay proof re-runs.
 */
export function scoreCaptured(fixture, records) {
  const attempts = records.map((rec, k) => {
    // The SCHEMA VERDICT IS CAPTURED, NEVER RECOMPUTED. arc-run decides it at run time
    // (arc-run.mjs:184-186) and it is not derivable from the output bytes alone, so a replay that
    // re-derived it would report a different measurement under the same name. Capturing it is
    // what lets the scorecard carry both rates AND still replay byte-identically.
    const schema = rec && Object.prototype.hasOwnProperty.call(rec, "schema") ? rec.schema : null;
    if (!rec || !rec.scored) {
      return { k, scored: false, schema, passed: 0, total: 0, rate: null, failed: [], why: rec?.why ?? "not scored in the captured run", verdict: rec?.verdict ?? "unknown" };
    }
    const s = scoreAssertions(rec.output, fixture.doc.assertions, `${fixture.id}#${k}`);
    return { k, scored: true, schema, passed: s.passed, total: s.total, rate: s.rate, failed: s.results.filter((r) => !r.pass).map((r) => r.id) };
  });
  // K IS NEVER COLLAPSED. Every attempt contributes to the denominator individually, so a
  // 2-of-3 fixture and a 1-of-3 fixture cannot report as the same number.
  const passed = attempts.reduce((a, x) => a + x.passed, 0);
  const total = attempts.reduce((a, x) => a + x.total, 0);
  return {
    id: fixture.id,
    input_sha: inputSha(fixture.doc.input),
    attempts,
    assertions: { passed, total, rate: total ? passed / total : null },
    spread: medianWithSpread(attempts.map((a) => a.rate)),
  };
}

/**
 * Fold a fixture's scored attempts into its class totals. Shared by the live run and the replay
 * so the two cannot drift: a scorecard that two code paths build differently is a scorecard whose
 * byte-identity proves nothing about either of them.
 */
function foldFixture(entry, scored) {
  entry.fixtures.push(scored);
  entry.assertions.passed += scored.assertions.passed;
  entry.assertions.total += scored.assertions.total;
  for (const a of scored.attempts) {
    if (a.schema === true) { entry.schema.passed += 1; entry.schema.evaluated += 1; }
    else if (a.schema === false) { entry.schema.evaluated += 1; }
  }
}

/** Close a class: the rates, the spread, and the NO PROPOSAL verdict a partial run earns. */
function closeClass(entry) {
  entry.assertions.rate = entry.assertions.total ? entry.assertions.passed / entry.assertions.total : null;
  entry.schema.rate = entry.schema.evaluated ? entry.schema.passed / entry.schema.evaluated : null;
  entry.spread = medianWithSpread(entry.fixtures.filter((f) => !f.dry_run).map((f) => f.assertions.rate));
  // A partial class proposes NOTHING, and the reason travels with the verdict (ADR-0906).
  const anyUnscored = entry.fixtures.some((f) => (f.attempts || []).some((a) => !a.scored));
  const anyRefused = entry.unselected.some((u) => u.reason.startsWith("failure: budget") || u.reason.includes("exhausted"));
  if (anyUnscored || anyRefused) entry.proposal = "NO PROPOSAL - partial run";
}

/** A class row, before anything has been scored into it. One shape, one place. */
function emptyClassEntry(cov) {
  return {
    task_class: cov.taskClass,
    declared: cov.count,
    eligible: cov.eligible,
    reason: cov.reason,
    selected: 0,
    unselected: [],
    fixtures: [],
    assertions: { passed: 0, total: 0, rate: null },
    schema: { passed: 0, evaluated: 0, rate: null },
  };
}

/**
 * The deterministic artifact. Everything in here is a function of the captured bytes and the
 * repository, and NOTHING in here is a function of the clock, a temp path or a wall-clock
 * duration -- those live in `provenance.json`, which replay is not expected to reproduce.
 * Mixing the two is how a "byte-identical" claim becomes untestable.
 */
export function buildScorecard({ classes, packRevisions, processVersions }) {
  return {
    normalizer_version: NORMALIZER_VERSION,
    eval_pack_revisions: packRevisions,
    process_versions: processVersions,
    classes,
  };
}

/**
 * The whole run. Returns a report; printing, writing and exiting are `main`'s job, so this is
 * callable from a test without a subprocess.
 *
 * THE BUDGET IS A PROPERTY OF THE RUN. One remainder, reserved per K-group before the group
 * starts, reconciled after it against measured spend, and **exhaustion is terminal** -- it
 * returns, and there is deliberately no path from here into a retry or a fallback.
 */
export function runBench(root, { driver, model, budget, dryRun = false, capture = null }) {
  const cliBudget = parseBudget(budget);
  const remaining = { ...cliBudget };
  const ceilings = readCeilings(root);
  const state = newBudgetState(ceilings, cliBudget.inr);
  // THE CEILING KEYS ON THE MODEL THAT WILL ACTUALLY BE APPLIED, never the one requested. A
  // bound exists to cover what the invocation will really spend, and `--model` does not reach
  // the driver at all today (phase-00-spec M1 amendment) -- so keying on the request would look
  // up a ceiling for a pair that is never invoked. `appliedModel` is null until the engine grows
  // a model seam, at which point this lookup starts refusing real pairs that have no entry,
  // which is exactly what it should do.
  const appliedModel = null;
  const ceilingKey = appliedModel || "(unpinned)";
  const worstCase = worstCaseFor(ceilings, driver, appliedModel);
  const identity = driverIdentity(root, driver);
  const shaBefore = routerSha(root);

  const classes = [];
  const packRevisions = {};
  const processVersions = {};
  const reconciliations = [];
  let attempts = 0;
  let partial = false;

  for (const cov of discoverClasses(root)) {
    const entry = emptyClassEntry(cov);
    classes.push(entry);
    if (!cov.eligible) continue;

    const loaded = loadClass(root, cov.taskClass);
    packRevisions[cov.taskClass] = loaded.pack ? loaded.pack.revision : null;
    processVersions[cov.taskClass] = loaded.version;

    for (const fx of loaded.fixtures) {
      if (!fx.id) { entry.unselected.push({ file: fx.file, reason: "declares no repo_state -- the case cannot be posed" }); continue; }
      entry.selected += 1;
      if (dryRun) { entry.fixtures.push({ id: fx.id, dry_run: true }); continue; }

      if (state.exhausted) {
        partial = true;
        entry.unselected.push({ file: fx.file, reason: "the run cap was exhausted before this group" });
        continue;
      }
      if ("min" in remaining && remaining.min <= 0) {
        partial = true;
        entry.unselected.push({ file: fx.file, reason: "the run-level minute budget was exhausted before this group" });
        continue;
      }

      // ADMISSION FIRST, and for the whole K-group. A group that cannot be covered NEVER STARTS:
      // a fixture with 2 of 3 attempts is disqualified by the completeness gate anyway, so the
      // spend would have bought nothing (ADR-0909).
      const seat = admitGroup(state, cov.taskClass, worstCase);
      if (!seat.admitted) {
        partial = true;
        entry.unselected.push({ file: fx.file, reason: `failure: budget -- ${seat.reason}` });
        continue;
      }

      const records = [];
      let measured = null;
      for (let k = 0; k < state.k; k++) {
        const perAttempt = { ...remaining };
        const timeoutMs = "min" in perAttempt ? Math.max(1000, Math.floor(perAttempt.min * 60000)) : 10 * 60000;
        let r;
        try { r = runAttempt(root, { processName: cov.taskClass, fixture: fx, driver, model, budget: perAttempt, timeoutMs }); }
        catch (e) { r = { ok: false, verdict: "harness", why: String(e.message).split("\n")[0], elapsedMs: 0, schema: null, measuredInr: null }; }
        attempts += 1;
        if ("min" in remaining) remaining.min = Math.max(0, remaining.min - r.elapsedMs / 60000);
        if (r.measuredInr !== null) measured = (measured ?? 0) + r.measuredInr;
        if (!r.ok) partial = true;

        // THE CAPTURE RECORD, not the bare output. It carries the schema verdict and the failure
        // reason as well, because neither is derivable from output bytes -- and a replay that
        // re-derived them would report a different measurement under the same name. It carries
        // NO timing, NO path and NO cost: those belong to the run, not to the evidence.
        const record = r.ok
          ? { scored: true, schema: r.schema, output: r.output }
          : { scored: false, schema: r.schema ?? null, verdict: r.verdict, why: r.why };
        records.push(record);
        if (capture) {
          const dir = join(capture, cov.taskClass, fx.id);
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, `${k}.json`), canonicalJson(record), "utf8");
        }
      }

      // POST-CALL RECONCILIATION. Where nothing was measured the reservation stands, because an
      // absent measurement cannot replace a bound -- it is the only bound left (ADR-0904). The
      // result goes to PROVENANCE, never to the scorecard: budget accounting is a fact about the
      // run, and putting it in the scorecard would make the replay proof unprovable by design.
      const rec = reconcileGroup(state, cov.taskClass, seat.reserved, measured);
      reconciliations.push({
        task_class: cov.taskClass, fixture: fx.id,
        reserved_inr: seat.reserved,
        measured_inr: rec.applied ? measured : null,
        delta: rec.delta,
      });
      foldFixture(entry, scoreCaptured(fx, records));
    }
    closeClass(entry);
  }

  const shaAfter = routerSha(root);

  return {
    scorecard: buildScorecard({ classes, packRevisions, processVersions }),
    provenance: {
      bench: BENCH_ID,
      // subject and fingerprint are SIBLINGS, never nested (ADR-0903). MP-F's nine fields stay
      // MP-F's; the driver is bench's, and absent fields are ABSENT KEYS rather than null.
      subject: {
        driver,
        ...(identity ? { driver_version: identity } : {}),
        ...(shaBefore ? { router_sha: shaBefore } : {}),
        ceiling_file: "initiatives/bench/ceilings.json",
        ceilings_as_of: ceilings.as_of,
        // WHICH ceiling row bounded this run, not what it contained. The key is provenance; the
        // number is a ceiling and never enters a record (ADR-0904).
        ceiling_key: `${driver}/${ceilingKey}`,
      },
      fingerprint: {
        // `model_id`, `provider`, `effort` and `statusline_cost` are ABSENT on purpose: with an
        // explicit --driver, arc-run hands the driver an empty ARC_DRIVER_MODEL and its own
        // receipt reads `unpinned`, so there is no model identity to record. Writing the
        // REQUESTED id here would claim a model that was never applied.
        ...(model ? { model_requested: model } : {}),
      },
      model_applied: null,
      // request_settings is absent for the same reason: bench has no channel through arc-run to
      // set temperature or any other provider knob, so declaring `temperature: 0` would record a
      // setting nothing applied.
      router_unchanged: shaBefore === shaAfter,
      budget: {
        run_cap_inr: state.runCap,
        process_cap_inr: state.processCap,
        k: state.k,
        committed_inr: state.runCommitted,
        min_remaining: "min" in remaining ? Number(remaining.min.toFixed(4)) : null,
        reconciliations,
      },
      attempts,
    },
    outcome: partial || !state ? "partial" : "ok",
  };
}

/**
 * Re-score a capture bundle. Pure: it reads bytes and fixtures and touches nothing else, so the
 * scorecard it produces must be byte-identical to the one the live run wrote.
 */
export function replayBench(root, captureDir) {
  if (!existsSync(captureDir)) throw new OperatorError(`--replay ${captureDir} does not exist`);
  const classes = [];
  const packRevisions = {};
  const processVersions = {};

  for (const cov of discoverClasses(root)) {
    const entry = emptyClassEntry(cov);
    classes.push(entry);
    if (!cov.eligible) continue;

    const loaded = loadClass(root, cov.taskClass);
    packRevisions[cov.taskClass] = loaded.pack ? loaded.pack.revision : null;
    processVersions[cov.taskClass] = loaded.version;

    for (const fx of loaded.fixtures) {
      if (!fx.id) { entry.unselected.push({ file: fx.file, reason: "declares no repo_state -- the case cannot be posed" }); continue; }
      const dir = join(captureDir, cov.taskClass, fx.id);
      if (!existsSync(dir)) { entry.unselected.push({ file: fx.file, reason: "no captured attempts in this bundle" }); continue; }
      entry.selected += 1;
      // Sorted NUMERICALLY, not lexically: `10.json` sorts before `2.json` as a string, and K
      // would silently reorder the moment it went past nine.
      const files = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0]));
      const records = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
      // The SAME fold and the SAME close as the live run. Two code paths building one artifact
      // differently is an artifact whose byte-identity proves nothing about either of them.
      foldFixture(entry, scoreCaptured(fx, records));
    }
    closeClass(entry);
  }
  return buildScorecard({ classes, packRevisions, processVersions });
}

/** The scorecard. Human-readable and deliberately unpinned -- no test asserts its shape (M13). */
function printReport(scorecard, provenance) {
  const out = [];
  const s = provenance.subject;
  out.push(`arc-bench ${provenance.bench} -- driver ${s.driver}${s.driver_version ? ` (${s.driver_version})` : " (version: ABSENT)"} -- normalizer ${scorecard.normalizer_version}`);
  out.push(`model requested ${provenance.fingerprint.model_requested ?? "(none)"} -- applied: NONE (arc-run pins a model only via --driver auto + a router row)`);
  out.push(`router ${provenance.router_unchanged ? "UNCHANGED" : "CHANGED -- propose-only was violated"} · caps run ${provenance.budget.run_cap_inr} / process ${provenance.budget.process_cap_inr} · K=${provenance.budget.k}`);
  for (const c of scorecard.classes) {
    if (!c.eligible) { out.push(`  ${c.task_class}: ${c.reason}`); continue; }
    const a = c.assertions;
    const rate = a.rate === null ? "ABSENT" : `${(a.rate * 100).toFixed(1)}%`;
    const sch = c.schema.rate === null ? "ABSENT" : `${(c.schema.rate * 100).toFixed(1)}%`;
    const sp = c.spread && c.spread.median !== null ? ` median ${(c.spread.median * 100).toFixed(1)}% spread ${(c.spread.min * 100).toFixed(1)}-${(c.spread.max * 100).toFixed(1)}%` : "";
    out.push(`  ${c.task_class} @ ${scorecard.eval_pack_revisions[c.task_class] ?? "(no pack)"}: assertions ${a.passed}/${a.total} = ${rate} · schema ${c.schema.passed}/${c.schema.evaluated} = ${sch}${sp}`);
    if (c.proposal) out.push(`    ${c.proposal}`);
    for (const f of c.fixtures) {
      if (f.dry_run) { out.push(`    - ${f.id}: would run`); continue; }
      const per = f.attempts.map((x) => (x.scored ? `${x.passed}/${x.total}` : "--")).join(" ");
      const bad = f.attempts.filter((x) => !x.scored);
      out.push(`    - ${f.id}: K=[${per}]${bad.length ? ` ${bad.length} NOT SCORED (${bad[0].verdict}: ${bad[0].why})` : ""}`);
    }
    for (const u of c.unselected) out.push(`    - ${u.file}: not selected -- ${u.reason}`);
  }
  out.push(`  committed against the cap: ${provenance.budget.committed_inr}${provenance.budget.min_remaining === null ? "" : ` · minutes left ${provenance.budget.min_remaining}`}`);
  console.log(out.join("\n"));
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(`arc-bench: ${e.message}`); process.exit(EXIT.OPERATOR); }

  // This file lives at `<root>/.claude/scripts/engine/`, so the root is three levels up. Derived
  // from the file rather than from cwd: bench is invoked from wherever, and a runner that
  // resolved its own repo from the caller cwd would score whichever tree it happened to land in.
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

  // ---- replay: pure re-scoring, no driver, no receipt ----
  if (args.replay) {
    let fresh;
    try { fresh = replayBench(root, resolve(args.replay)); }
    catch (e) { console.error(`arc-bench: ${e.message}`); process.exit(e instanceof OperatorError ? EXIT.OPERATOR : EXIT.PARTIAL); }
    const bytes = canonicalJson(fresh);
    if (args.out) { mkdirSync(resolve(args.out), { recursive: true }); writeFileSync(join(resolve(args.out), "scorecard.json"), bytes, "utf8"); }
    const prior = join(resolve(args.replay), "scorecard.json");
    if (!existsSync(prior)) { console.log(bytes); process.exit(EXIT.OK); }
    const priorBytes = readFileSync(prior, "utf8");
    let priorDoc = null;
    try { priorDoc = JSON.parse(priorBytes); } catch { /* an unparseable scorecard is a mismatch */ }
    // STALE-FORMAT AND TAMPER ARE DIFFERENT FACTS. A normalizer bump invalidates every stored
    // scorecard by construction, and reporting that as a mismatch would send someone hunting a
    // corruption that never happened.
    if (priorDoc && priorDoc.normalizer_version !== fresh.normalizer_version) {
      console.error(`arc-bench: STALE-FORMAT -- the stored scorecard was written by normalizer ${priorDoc.normalizer_version}, this is ${fresh.normalizer_version}`);
      process.exit(EXIT.STALE);
    }
    if (priorBytes === bytes) { console.log(`arc-bench: replay MATCHES byte for byte (${bytes.length} bytes, sha ${canonicalHash(fresh).slice(0, 12)})`); process.exit(EXIT.OK); }
    console.error(`arc-bench: replay MISMATCH -- stored ${canonicalHash(priorDoc ?? {}).slice(0, 12)}, re-scored ${canonicalHash(fresh).slice(0, 12)}`);
    process.exit(EXIT.PARTIAL);
  }

  const drivers = knownDrivers(root);
  if (!drivers.includes(args.driver)) {
    console.error(`arc-bench: unknown driver \`${args.driver}\` (installed: ${drivers.join(", ")})`);
    process.exit(EXIT.OPERATOR);
  }

  const outDir = args.out ? resolve(args.out) : null;
  const capture = outDir && !args.dryRun ? join(outDir, "capture") : null;
  let report;
  try { report = runBench(root, { driver: args.driver, model: args.model, budget: args.budget, dryRun: args.dryRun, capture }); }
  catch (e) {
    console.error(`arc-bench: ${e.message}`);
    process.exit(e instanceof OperatorError ? EXIT.OPERATOR : EXIT.PARTIAL);
  }

  printReport(report.scorecard, report.provenance);

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "scorecard.json"), canonicalJson(report.scorecard), "utf8");
    writeFileSync(join(outDir, "provenance.json"), canonicalJson(report.provenance), "utf8");
    console.log(`arc-bench: scorecard and provenance written to ${relative(root, outDir) || outDir}`);
  }

  if (args.dryRun) { console.log("arc-bench: --dry-run, nothing was invoked and no receipt was emitted"); process.exit(EXIT.OK); }

  // A CEILING NEVER ENTERS AN EMITTED PAYLOAD (ADR-0904). The receipt carries what was measured
  // and what was committed; the caps stay in provenance, which is a local artifact and not a
  // claim on the append-only ledger.
  const payload = {
    scorecard_sha: canonicalHash(report.scorecard),
    normalizer_version: report.scorecard.normalizer_version,
    subject: report.provenance.subject,
    fingerprint: report.provenance.fingerprint,
    model_applied: null,
    router_unchanged: report.provenance.router_unchanged,
    attempts: report.provenance.attempts,
    outcome: report.outcome,
    classes: report.scorecard.classes.map((c) => ({
      task_class: c.task_class,
      eligible: c.eligible,
      ...(c.reason ? { reason: c.reason } : {}),
      ...(c.proposal ? { proposal: c.proposal } : {}),
      assertions: c.assertions,
      schema: c.schema,
    })),
  };
  const receipt = emitRunCompleted(root, payload, report.outcome === "ok" ? "ok" : "fail");
  if (receipt.landed) {
    console.log(`arc-bench: receipt ${receipt.id} is in events/ and not in _quarantine/`);
  } else if (receipt.quarantined) {
    console.error(`arc-bench: receipt ${receipt.id} was QUARANTINED at ${receipt.quarantined} -- quarantine is not success (ADR-0032)`);
  } else {
    console.error(`arc-bench: NO receipt was sealed${receipt.why ? ` -- ${receipt.why}` : ""}`);
  }
  if (!report.provenance.router_unchanged) {
    console.error("arc-bench: the router SHA CHANGED across this run -- propose-only was violated and this run is not evidence of anything");
    process.exit(EXIT.PARTIAL);
  }
  // A run whose receipt did not land is not a clean run, however well it scored: an unrecorded
  // result cannot be audited later, and the whole point of the thread is the record.
  process.exit(report.outcome === "ok" && receipt.landed ? EXIT.OK : EXIT.PARTIAL);
}

// Windows argv[1] arrives however the caller typed it, so both sides are resolved before the
// comparison -- an unresolved relative path never matches and the CLI silently does nothing.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
