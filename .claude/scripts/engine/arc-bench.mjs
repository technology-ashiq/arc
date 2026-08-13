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
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseBudget } from "./drivers/common.mjs";

/** The `--process` identity on bench's own receipts (M6). Bench is a runner, never a process. */
export const BENCH_ID = "bench@0.1.0";

/** M13. 0 = every selected fixture was scored · 1 = partial or budget-aborted · 2 = operator. */
export const EXIT = Object.freeze({ OK: 0, PARTIAL: 1, OPERATOR: 2 });

/** Anything the operator can fix by retyping the command. Never a scoring outcome. */
export class OperatorError extends Error {}

const VALUE_FLAGS = Object.freeze({ "--driver": "driver", "--model": "model", "--budget": "budget", "--champion": "champion" });
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
  const out = { driver: "", model: "", budget: "", champion: "", propose: false, dryRun: false };
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
  // Parsed-and-ignored is worse than refused: a flag that quietly does nothing reads, on a
  // scorecard, exactly like a flag that worked. Both arrive with their own phase.
  if (out.champion) throw new OperatorError("--champion selects the incumbent to beat and arrives with Phase 1 admission control -- it is refused rather than ignored");
  if (out.propose) throw new OperatorError("--propose writes a swap proposal and arrives with Phase 2 -- it is refused rather than ignored");
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
  return { processName, fixtures, pack };
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

    if (res.error && res.error.code === "ETIMEDOUT") {
      return { ok: false, verdict: "budget", why: "arc-run exceeded the attempt timeout", elapsedMs, after };
    }
    const status = res.status ?? 1;
    if (status !== 0) {
      const line = String(res.stderr || "").trim().split("\n").filter(Boolean).pop() || `arc-run exited ${status}`;
      return { ok: false, verdict: "run", why: line, elapsedMs, after };
    }
    let output;
    try { output = JSON.parse(res.stdout); }
    catch (e) { return { ok: false, verdict: "run", why: `arc-run stdout is not JSON: ${e.message}`, elapsedMs, after }; }

    const score = scoreAssertions(output, fixture.doc.assertions, fixture.id);
    return { ok: true, verdict: "ok", output, score, elapsedMs, after };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    state.cleanup();
  }
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

/**
 * The whole thread. Returns a report; printing and exiting are `main`'s job, so this is callable
 * from a test without a subprocess.
 *
 * THE BUDGET REMAINDER IS THREADED FOR THE DIMENSION BENCH CAN OBSERVE, AND ONLY THAT ONE.
 * `min` is wall-clock, which bench measures itself, so it genuinely decrements and a run that
 * exhausts it stops. `inr` cannot: no driver reports spend on arc-run's stdout, the cost sidecar
 * is consumed inside arc-run, and inventing a figure to subtract would be an estimate wearing a
 * measurement's clothes (ADR-0904 -- a ceiling bounds spend, it never reports it). So `inr` is
 * passed down unchanged as a CEILING and reported as unmeasured, never as zero.
 */
export function runBench(root, { driver, model, budget, dryRun = false }) {
  const ceiling = parseBudget(budget);
  const remaining = { ...ceiling };
  const identity = driverIdentity(root, driver);
  const classes = [];
  let attempts = 0;
  let partial = false;

  for (const cov of discoverClasses(root)) {
    const entry = {
      task_class: cov.taskClass,
      declared: cov.count,
      eligible: cov.eligible,
      reason: cov.reason,
      revision: null,
      selected: 0,
      unselected: [],
      scored: 0,
      assertions: { passed: 0, total: 0, rate: null },
      fixtures: [],
    };
    classes.push(entry);
    if (!cov.eligible) continue;

    const loaded = loadClass(root, cov.taskClass);
    entry.revision = loaded.pack ? loaded.pack.revision : null;

    for (const fx of loaded.fixtures) {
      // A fixture with no `repo_state` cannot be POSED: `commit-msg-draft` declares `inputs: []`,
      // so the repository is the only thing that varies. It is named here rather than dropped --
      // a silent skip is how a class loses coverage without the count ever moving.
      if (!fx.id) { entry.unselected.push({ file: fx.file, reason: "declares no repo_state -- the case cannot be posed" }); continue; }
      entry.selected += 1;
      if (dryRun) { entry.fixtures.push({ id: fx.id, dry_run: true }); continue; }

      if ("min" in remaining && remaining.min <= 0) {
        partial = true;
        entry.unselected.push({ file: fx.file, reason: "the run-level minute budget was exhausted before this attempt" });
        continue;
      }

      const perAttempt = { ...remaining };
      const timeoutMs = "min" in perAttempt ? Math.max(1000, Math.floor(perAttempt.min * 60000)) : 10 * 60000;
      let r;
      try { r = runAttempt(root, { processName: cov.taskClass, fixture: fx, driver, model, budget: perAttempt, timeoutMs }); }
      catch (e) { r = { ok: false, verdict: "harness", why: String(e.message).split("\n")[0], elapsedMs: 0, after: null }; }
      attempts += 1;
      if ("min" in remaining) remaining.min = Math.max(0, remaining.min - r.elapsedMs / 60000);

      if (!r.ok) {
        partial = true;
        entry.fixtures.push({ id: fx.id, ok: false, verdict: r.verdict, why: r.why });
        continue;
      }
      entry.scored += 1;
      entry.assertions.passed += r.score.passed;
      entry.assertions.total += r.score.total;
      entry.fixtures.push({
        id: fx.id,
        ok: true,
        passed: r.score.passed,
        total: r.score.total,
        // ABSENT, never 100%: a fixture that asserts nothing must not be the cheapest way to
        // look perfect (ADR-0905).
        rate: r.score.rate,
        failed: r.score.results.filter((x) => !x.pass).map((x) => x.id),
        repo_untouched: r.after !== null,
      });
    }
    entry.assertions.rate = entry.assertions.total ? entry.assertions.passed / entry.assertions.total : null;
  }

  return {
    bench: BENCH_ID,
    driver,
    driver_version: identity,
    model_requested: model || null,
    // Measured, not assumed: with an explicit `--driver`, arc-run hands the driver an empty
    // ARC_DRIVER_MODEL and its own receipt reads `model: unpinned`. Saying so on bench's receipt
    // keeps a run from claiming a model it never applied.
    model_applied: null,
    budget: {
      ceiling,
      min_remaining: "min" in remaining ? Number(remaining.min.toFixed(4)) : null,
      inr_spent: null,
      inr_spent_note: "unmeasured -- no driver reports spend on arc-run stdout; the ceiling bounds it, it never reports it (ADR-0904)",
    },
    attempts,
    classes,
    outcome: partial ? "partial" : "ok",
  };
}

/** The scorecard. Human-readable and deliberately unpinned -- no test asserts its shape (M13). */
function printReport(report) {
  const out = [];
  out.push(`arc-bench ${report.bench} -- driver ${report.driver}${report.driver_version ? ` (${report.driver_version})` : " (version: ABSENT)"}`);
  out.push(`model requested ${report.model_requested ?? "(none)"} -- applied: NONE (arc-run pins a model only via --driver auto + a router row)`);
  for (const c of report.classes) {
    if (!c.eligible) { out.push(`  ${c.task_class}: ${c.reason}`); continue; }
    const a = c.assertions;
    const rate = a.rate === null ? "ABSENT" : `${(a.rate * 100).toFixed(1)}%`;
    out.push(`  ${c.task_class} @ ${c.revision ?? "(no pack)"}: ${c.scored}/${c.selected} fixtures scored, assertions ${a.passed}/${a.total} = ${rate}`);
    for (const f of c.fixtures) {
      if (f.dry_run) { out.push(`    - ${f.id}: would run`); continue; }
      out.push(f.ok
        ? `    - ${f.id}: ${f.passed}/${f.total}${f.failed.length ? ` FAILED ${f.failed.join(",")}` : ""}`
        : `    - ${f.id}: NOT SCORED (${f.verdict}) ${f.why}`);
    }
    for (const u of c.unselected) out.push(`    - ${u.file}: not selected -- ${u.reason}`);
  }
  out.push(`  budget: ceiling ${budgetString(report.budget.ceiling)} · inr spent ${report.budget.inr_spent ?? "UNMEASURED"}${report.budget.min_remaining === null ? "" : ` · minutes left ${report.budget.min_remaining}`}`);
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
  const drivers = knownDrivers(root);
  if (!drivers.includes(args.driver)) {
    console.error(`arc-bench: unknown driver \`${args.driver}\` (installed: ${drivers.join(", ")})`);
    process.exit(EXIT.OPERATOR);
  }

  let report;
  try { report = runBench(root, { driver: args.driver, model: args.model, budget: args.budget, dryRun: args.dryRun }); }
  catch (e) {
    console.error(`arc-bench: ${e.message}`);
    process.exit(e instanceof OperatorError ? EXIT.OPERATOR : EXIT.PARTIAL);
  }

  printReport(report);
  if (args.dryRun) { console.log("arc-bench: --dry-run, nothing was invoked and no receipt was emitted"); process.exit(EXIT.OK); }

  const receipt = emitRunCompleted(root, report, report.outcome === "ok" ? "ok" : "fail");
  if (receipt.landed) {
    console.log(`arc-bench: receipt ${receipt.id} is in events/ and not in _quarantine/`);
  } else if (receipt.quarantined) {
    console.error(`arc-bench: receipt ${receipt.id} was QUARANTINED at ${receipt.quarantined} -- quarantine is not success (ADR-0032)`);
  } else {
    console.error(`arc-bench: NO receipt was sealed${receipt.why ? ` -- ${receipt.why}` : ""}`);
  }
  // A run whose receipt did not land is not a clean run, however well it scored: an unrecorded
  // result cannot be audited later, and the whole point of the thread is the record.
  process.exit(report.outcome === "ok" && receipt.landed ? EXIT.OK : EXIT.PARTIAL);
}

// Windows argv[1] arrives however the caller typed it, so both sides are resolved before the
// comparison -- an unresolved relative path never matches and the CLI silently does nothing.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
