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
      let re;
      try { re = new RegExp(v); } catch (e) { return `is not a valid regex (${e.message})`; }
      // A PATTERN THAT MATCHES THE EMPTY STRING CHECKS NOTHING. ADR-0905 closed "no assertions"
      // as the cheapest way to look perfect; this is the next cheapest, and it is worse because
      // it looks like a rule. `""`, `"a|"` and `"(?:)"` all score 6/6 against garbage.
      if (re.test("")) return "matches the empty string, so it can never fail -- an assertion that cannot fail is not an assertion";
      return null;
    },
    run: (actual, v) => typeof actual === "string" && new RegExp(v).test(actual),
  },
  contains: {
    needsValue: true,
    validate: (v) => (typeof v === "object" && v !== null ? "must be a scalar"
      : String(v) === "" ? "is the empty string, which every string contains -- it can never fail" : null),
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
        ? v[0] > v[1] ? "must be [MIN, MAX] with MIN <= MAX"
          // Same rule as `matches`: a range that admits every plausible value checks nothing.
          : v[0] === 0 && v[1] >= 100000 ? "spans [0, 100000+], which no realistic value falls outside -- it can never fail"
            : null
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
    // A leading zero makes a DIFFERENT segment: `commits.01.sha` and `commits.1.sha` looked like
    // two assertions and silently tested one. Only a canonical decimal is an index.
    const key = /^\d+$/.test(seg) && String(Number(seg)) === seg ? Number(seg) : seg;
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

/**
 * How many of a class's declared fixtures actually MEASURE something -- that is, carry at least
 * one assertion.
 *
 * The floor counted files, so five fixtures with `assertions: []` cleared it while measuring
 * nothing at all, and their attempts still counted `scored: true` against a denominator of zero.
 * A fixture that asserts nothing is a fixture that cannot fail, which is the same hole
 * `matches ""` opens one level down.
 */
export function measuringFixtureCount(root, processName) {
  const path = join(root, "processes", `${processName}.process.yaml`);
  const parsed = parseYamlSubset(readFileSync(path, "utf8"));
  if (!parsed.ok) throw new Error(`${processName}: canonical file does not parse: ${parsed.error?.what ?? "unknown"}`);
  const evals = parsed.value?.evals;
  if (!Array.isArray(evals)) throw new Error(`${processName}: evals is missing or not a list`);
  let n = 0;
  for (const rel of evals) {
    try {
      const doc = JSON.parse(readFileSync(resolve(root, rel), "utf8"));
      if (Array.isArray(doc.assertions) && doc.assertions.length > 0) n += 1;
    } catch { /* an unreadable fixture measures nothing, which is the answer */ }
  }
  return n;
}

/** The coverage line a report prints for one class, counted rather than assumed. */
export function classCoverage(root, processName) {
  const count = declaredFixtureCount(root, processName);
  const measuring = measuringFixtureCount(root, processName);
  const verdict = coverageVerdict(processName, count);
  // BOTH counts must clear the floor. Declaring enough files and asserting nothing in them is a
  // class that reads eligible on a denominator of zero.
  if (verdict.eligible && measuring < MIN_FIXTURES) {
    return { taskClass: processName, count, measuring, eligible: false, reason: `NO PROPOSAL - evidence insufficient (${count} declared but only ${measuring} of ${MIN_FIXTURES} carry any assertion)` };
  }
  return { taskClass: processName, count, measuring, ...verdict };
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

/**
 * AMBIENT GIT IS NEUTRALISED, not just the identity.
 *
 * Setting `user.name`/`user.email` repo-locally closed the identity hole and left every other
 * ambient setting inherited. A global `core.excludesFile` that ignores `*.md` made
 * `git status --porcelain` come back EMPTY for a fixture that declares a modified markdown file:
 * the harness materialized, the run scored, and the case measured nothing. A global
 * `core.hooksPath` with a failing `pre-commit` made every materialization throw instead.
 *
 * So the fixture's state has to be a property of the FIXTURE, not of the box: system config off,
 * global config pointed at a path that does not exist, and the three settings that survive that
 * pinned empty on the command line.
 */
const GIT_NEUTRAL = Object.freeze(["-c", "core.excludesFile=", "-c", "core.hooksPath=", "-c", "core.attributesFile=", "-c", "commit.gpgsign=false"]);

/**
 * The environment those commands run in. Keys are DELETED rather than set to `undefined`: an
 * env object carrying `GIT_DIR: undefined` is a bet on how the runtime serialises it, and losing
 * that bet points every command at a directory literally named "undefined".
 */
function gitEnv(root) {
  const env = { ...process.env };
  // A stale index or work tree pointed at another repository would silently retarget every
  // command at it -- including the commit.
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_COMMON_DIR", "GIT_ALTERNATE_OBJECT_DIRECTORIES"]) delete env[k];
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = join(root, ".arc-bench-no-global-gitconfig");
  return env;
}

function git(root, args) {
  try {
    return execFileSync("git", [...GIT_NEUTRAL, ...args], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      env: gitEnv(root),
    });
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
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (Object.prototype.hasOwnProperty.call(BOOL_FLAGS, a)) { out[BOOL_FLAGS[a]] = true; continue; }
    if (!Object.prototype.hasOwnProperty.call(VALUE_FLAGS, a)) {
      throw new OperatorError(`unknown option ${a} -- the closed set is ${[...Object.keys(VALUE_FLAGS), ...Object.keys(BOOL_FLAGS)].join(" ")}`);
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new OperatorError(`${a} needs a value`);
    // AN EMPTY VALUE IS REFUSED. `--champion ""` was accepted and silently turned the drift guard
    // OFF -- so an operator who typed `--champion "$CHAMPION"` with the variable unset was told
    // nothing had drifted. It is the same unquoted-empty-value failure `.claude/rules/lanes.md`
    // records, and the same one `ARC_SPINE_ROOT` above now refuses.
    if (!v.trim()) throw new OperatorError(`${a} was given an EMPTY value -- an empty flag silently turns off the job it names`);
    // A REPEATED FLAG IS AN OPERATOR ERROR, never last-wins. `.claude/rules/lanes.md`: silently
    // picking one of two named values is precisely the never-guess failure.
    if (seen.has(a)) throw new OperatorError(`${a} was given twice (${out[VALUE_FLAGS[a]]}, then ${v}) -- that is an operator error, not a last-wins override`);
    seen.add(a);
    out[VALUE_FLAGS[a]] = v;
    i++;
  }
  // `--propose` and `--champion` come as a PAIR. There is no such thing as a proposal without an
  // incumbent: every gate past the first is a comparison, and a "proposal" with nothing to beat
  // would have to invent a baseline to clear (ADR-0906).
  if (out.propose && !out.champion) throw new OperatorError("--propose needs --champion DIR (a previous run's --out directory) -- every gate past the first is a comparison against the incumbent");
  // `--champion` ALONE is the drift guard (Phase 03): re-run against the incumbent and compare on
  // two split axes, reporting rather than proposing. Adding `--propose` turns the same comparison
  // into a routing proposal. One flag, two jobs, and the difference is explicit at the call site.
  if (out.propose && !out.out) throw new OperatorError("--propose needs --out DIR to write its three artifacts into (ADR-0907)");
  if (out.propose && out.replay) throw new OperatorError("--propose and --replay are different jobs: one produces evidence, the other re-checks it");
  // THE CHAMPION IS NOT THE CANDIDATE. Pointing both at one directory made the run overwrite the
  // champion's scorecard with its own BEFORE reading it back, so it compared against itself,
  // reported `decided_by: tie` for any input whatsoever, and destroyed the champion evidence on
  // the way through.
  if (out.champion && out.out && resolve(out.champion) === resolve(out.out)) {
    throw new OperatorError("--champion and --out must be different directories -- otherwise the run overwrites the champion it is about to compare itself against");
  }
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
  if (out.propose && out.dryRun) throw new OperatorError("--dry-run invokes nothing, so it has no evidence to propose from");
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
    // THE ID IS CONFINED, and it was not. `repo_state` flows into a `join()` on the READ path
    // (the repo-state directory) and on the WRITE path (the capture bundle), so a `..` in it wrote
    // outside `--out` entirely -- demonstrated by this lane's adversarial pass. `mock.mjs:72-76`
    // refuses the identical value with the identical reasoning; bench applied no check at either
    // site. The grammar is the one the directories already use, so nothing legitimate is excluded.
    const raw = typeof doc.repo_state === "string" && doc.repo_state ? doc.repo_state : null;
    if (raw !== null && !/^[a-z0-9][a-z0-9-]*$/.test(raw)) {
      throw new OperatorError(`${processName}: fixture ${rel} declares repo_state ${JSON.stringify(raw)}, which is not a bare [a-z0-9-] id -- it is used as a path segment on both a read and a WRITE`);
    }
    return { id: raw, file: rel, dir: dirname(p), doc };
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
    // M1s INVOCATION DISCIPLINE, checked at run time rather than trusted. Every attempt goes
    // through arc-run, and arc-run leaves exactly one receipt per invocation -- so an attempt
    // that produced an answer while leaving NO receipt did not go through arc-run. That is the
    // shape a bench that spawned drivers/NAME.sh itself would have, and it is precisely what
    // such a spawn breaks: no receipt, no run-level budget remainder, no contract-retry ladder.
    const receiptsSeen = appended.length;
    const receipt = appended.length ? appended[appended.length - 1] : null;
    const reason = receipt?.payload?.reason ?? null;
    // ALL-OR-NOTHING, and absent stays absent: the spine writes a `cost` block only when a real
    // rupee figure exists. Token counts ride in the payload and are not a cost.
    const measuredInr = Number.isFinite(receipt?.cost?.inr_estimate) ? receipt.cost.inr_estimate : null;
    // TOKENS RIDE IN TWO PLACES, by design. `arc-run` puts them in the `cost` block when a real
    // rupee figure exists and in `payload.tokens` when it does not -- because the spine's cost
    // block is all-or-nothing and cannot express tokens-without-money (arc-run.mjs:215-247). Both
    // are read, and an absence stays ABSENT rather than becoming a zero token count.
    const tIn = receipt?.cost?.tokens_in ?? receipt?.payload?.tokens?.in ?? null;
    const tOut = receipt?.cost?.tokens_out ?? receipt?.payload?.tokens?.out ?? null;
    // BOTH halves or NEITHER. Summing `tokens_in` with an absent `tokens_out` produced a number
    // that looked like a total and was half of one -- which then fabricated a doubled per-token
    // rate and classified an unchanged price as "both the rate and the usage moved".
    const tokensTotal = Number.isFinite(tIn) && Number.isFinite(tOut) ? tIn + tOut : null;
    const costSource = receipt?.cost?.source ?? receipt?.payload?.tokens?.source ?? null;

    if (res.error && res.error.code === "ETIMEDOUT") {
      return { ok: false, verdict: "budget", why: "arc-run exceeded the attempt timeout", elapsedMs, after, schema: null, measuredInr, tokensTotal, costSource, receiptsSeen, reason: "budget" };
    }
    const status = res.status ?? 1;
    if (status !== 0) {
      const line = String(res.stderr || "").trim().split("\n").filter(Boolean).pop() || `arc-run exited ${status}`;
      // SCHEMA IS ONLY EVALUATED WHERE AN OUTPUT EXISTED. A driver that never answered leaves the
      // schema question unasked, and counting that as a schema failure would blame the process
      // for a fault arc-run has already attributed elsewhere (ADR-0204).
      const schema = reason === "schema" ? false : null;
      return { ok: false, verdict: reason || "run", why: line, elapsedMs, after, schema, measuredInr, tokensTotal, costSource, receiptsSeen, reason };
    }
    let output;
    try { output = JSON.parse(res.stdout); }
    catch (e) { return { ok: false, verdict: "run", why: `arc-run stdout is not JSON: ${e.message}`, elapsedMs, after, schema: null, measuredInr, tokensTotal, costSource, receiptsSeen, reason }; }

    const score = scoreAssertions(output, fixture.doc.assertions, fixture.id);
    // arc-run validates the output against the process schema before it ever prints it
    // (arc-run.mjs:184-186), so an exit-0 attempt is a schema PASS by construction.
    return { ok: true, verdict: "ok", output, score, elapsedMs, after, schema: true, measuredInr, tokensTotal, costSource, receiptsSeen, reason: null };
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
  // Through `normalize` for the same reason `canonicalJson` is: the hash and the bytes must be
  // derived from ONE read of the input, or a receipt can carry a hash the stored file cannot
  // reproduce.
  return createHash("sha256").update(canonicalString(normalize(value)), "utf8").digest("hex");
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
  // VALIDATED AND RENDERED FROM ONE READ. The first draft ran `canonicalString` to refuse and then
  // walked the ORIGINAL a second time to render -- the "validate one read, compare another" shape
  // this lane closed in `verdict.mjs` and left open here. A getter that returned a good value on
  // the first read and `undefined` on the second wrote `"rate": undefined` into the scorecard:
  // invalid JSON, past a validator that had just refused `undefined` outright.
  const norm = normalize(value);
  const render = (v, indent) => {
    // -0 survives the hash as `n:-0` and is destroyed by `JSON.stringify` as `0`, so the bytes on
    // disk would not reproduce the hash on the receipt.
    if (typeof v === "number" && Object.is(v, -0)) return "-0";
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
  return `${render(norm, 0)}\n`;
}

/**
 * Read a possibly-hostile value EXACTLY ONCE and return an inert plain copy, refusing whatever
 * `canonicalString` refuses. Every later pass -- hashing, rendering, comparing -- operates on the
 * copy, so a getter, a Proxy or a concurrent mutation cannot make two passes disagree.
 *
 * Non-JSON hosts (Map, Set, Date, RegExp, Error) are refused rather than flattened to `{}`: they
 * cannot arrive through `JSON.parse`, so their presence means a caller built a document by hand
 * that will not survive the round trip it is about to be stored for.
 */
export function normalize(value, path = "$", seen = new Set()) {
  const t = typeof value;
  if (value === null || t === "boolean" || t === "string") return value;
  if (t === "number") {
    if (Number.isNaN(value)) throw new EncodeError(`${path}: NaN is refused, not folded to null`);
    if (!Number.isFinite(value)) throw new EncodeError(`${path}: ${value > 0 ? "Infinity" : "-Infinity"} is refused, not folded to null`);
    return value;
  }
  if (t === "bigint") throw new EncodeError(`${path}: BigInt is refused -- it has no JSON form and coercing it loses precision`);
  if (t === "undefined") throw new EncodeError(`${path}: undefined is refused -- an absent field is an absent KEY, never a present undefined`);
  if (t === "function" || t === "symbol") throw new EncodeError(`${path}: ${t} is refused`);
  if (seen.has(value)) throw new EncodeError(`${path}: cycle -- this value already appears on the path to itself`);
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
    throw new EncodeError(`${path}: ${value.constructor?.name ?? "a non-plain object"} is refused -- it cannot survive a JSON round trip and would encode as an empty object`);
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((v, i) => normalize(v, `${path}[${i}]`, seen));
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = normalize(value[k], `${path}.${k}`, seen);
    return out;
  } finally {
    seen.delete(value);
  }
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
  // Resolved against the REPO ROOT for the same reason `spinePaths` is: a relative value read
  // against the caller cwd points at a different file than the one a spawned child would find.
  const path = named ? resolve(root, named) : join(root, "initiatives/bench/ceilings.json");
  let doc;
  try { doc = JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { throw new OperatorError(`ceilings: ${path} is unreadable (${String(e.message).split("\n")[0]})`); }
  for (const k of ["as_of", "run_cap_inr", "process_cap_inr", "k", "worst_case_inr_per_invocation"]) {
    if (!Object.prototype.hasOwnProperty.call(doc, k)) throw new OperatorError(`ceilings: missing \`${k}\``);
  }
  if (!Number.isInteger(doc.k) || doc.k < 1 || doc.k > 100) throw new OperatorError("ceilings: `k` must be an integer in 1..100");
  for (const k of ["run_cap_inr", "process_cap_inr"]) {
    if (!Number.isFinite(doc[k]) || doc[k] < 0) throw new OperatorError(`ceilings: \`${k}\` must be a non-negative number`);
  }
  if (doc.process_cap_inr > doc.run_cap_inr) throw new OperatorError(`ceilings: process_cap_inr (${doc.process_cap_inr}) exceeds run_cap_inr (${doc.run_cap_inr}) -- the sub-cap would never bind`);
  // THE VALUE SET, not just the grammar. A zero or negative worst case passed validation and
  // destroyed admission control outright: negative reservations REFUNDED budget per group, so a
  // thousand groups were admitted against a cap of 100. It is defect "grammar validated, value
  // set not" recurring in the one file whose entire job is bounding spend.
  const table = doc.worst_case_inr_per_invocation;
  if (table === null || typeof table !== "object" || Array.isArray(table)) throw new OperatorError("ceilings: worst_case_inr_per_invocation must be an object");
  for (const [driver, byModel] of Object.entries(table)) {
    if (byModel === null || typeof byModel !== "object" || Array.isArray(byModel)) throw new OperatorError(`ceilings: worst_case_inr_per_invocation.${driver} must be an object of model -> number`);
    for (const [model, v] of Object.entries(byModel)) {
      if (!Number.isFinite(v) || v < 0) throw new OperatorError(`ceilings: worst_case_inr_per_invocation.${driver}.${model} is ${JSON.stringify(v)} -- a ceiling must be a finite, non-negative number`);
    }
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
export function reconcileGroup(state, processName, reserved, measuredInr, measuredAttempts = null, k = null) {
  if (measuredInr === null) return { applied: false, delta: 0 };
  // A PARTIAL MEASUREMENT MAY NEVER REFUND. `arc-run` reports money only when a rupee figure
  // exists, so a group where one attempt of three reported is normal -- and replacing the whole
  // K-group reservation with that one figure hands back the other two attempts' budget as though
  // they were free. Demonstrated by this lane's adversarial pass: 9 INR per attempt with one
  // reporter in three admitted eight groups against a cap of 100 and really spent 216, 2.16x the
  // bound. It is the retro-log 2026-08-03 defect one level up -- a bound enforced per-ATTEMPT
  // while described per-RUN -- so a partial sum may only ever RAISE the committed figure.
  const complete = measuredAttempts === null || k === null || measuredAttempts >= k;
  const effective = complete ? measuredInr : Math.max(reserved, measuredInr);
  const delta = effective - reserved;
  if (delta === 0) return { applied: complete, delta: 0, partial: !complete };
  state.runCommitted += delta;
  state.perProcessCommitted.set(processName, (state.perProcessCommitted.get(processName) ?? 0) + delta);
  if (state.runCommitted >= state.runCap || (state.perProcessCommitted.get(processName) ?? 0) >= state.processCap) {
    state.exhausted = true;
    state.reasons.push(`measured spend reached a cap after reconciling ${processName}`);
  }
  return { applied: true, delta, partial: !complete };
}

// ---- statistics that do not collapse K -------------------------------------------------------

/**
 * The median WITH its spread. K attempts are never collapsed into one per-fixture verdict: a
 * 2-of-3 fixture and a 1-of-3 fixture must not report as the same number, and a bare median
 * makes them identical whenever the median lands on the same value.
 */
/** Nearest-rank percentile. ABSENT for an empty sample -- never 0, which reads as instant. */
export function percentile(values, p) {
  const xs = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!xs.length) return null;
  // `p * n / 100`, never `(p / 100) * n`: the latter crosses a rank boundary on representation
  // noise (n=25, p=28 gives 7.000000000000001 and rounds up to 8). Latent at the shipped p=95,
  // fixed anyway -- it is the same float-boundary shape as the 2pp band.
  const rank = Math.ceil((p * xs.length) / 100);
  return xs[Math.min(xs.length - 1, Math.max(0, rank - 1))];
}

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
  // PRESENCE, NOT TRUTHINESS -- the comment said so and the code did the opposite, so
  // `ARC_SPINE_ROOT=""` fell through to the REAL repo spine. That is the exact failure
  // `.claude/rules/lanes.md` records for an unquoted empty flag value, and `spine-io.mjs:40-48`
  // already refuses it; bench was the copy that drifted. `readCeilings`, one function away in
  // this same file, had it right.
  //
  // RESOLVED AGAINST THE REPO ROOT, never the caller cwd. bench resolves `root` from its own file
  // location while the emitter it spawns runs with `cwd: root` -- so a RELATIVE value produced
  // two different spines, bench reported "NO receipt was sealed" for a receipt that had sealed
  // fine, and every attempt then tripped the M1 invocation violation.
  let base;
  if ("ARC_SPINE_ROOT" in process.env) {
    const named = String(process.env.ARC_SPINE_ROOT);
    if (!named.trim()) throw new OperatorError("ARC_SPINE_ROOT is set but empty -- refusing to fall back to a spine nobody named, because reading the wrong spine answers every question confidently and wrongly");
    base = resolve(root, named);
  } else {
    base = join(root, ".claude/state/hq");
  }
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
    // BYTES, not characters. A snapshot taken while a day file ended mid-multi-byte character
    // produced a cursor that sliced INTO a surrogate pair, the torn line was discarded as "not an
    // event", and bench then raised a FALSE M1 violation against an attempt whose receipt was
    // sealed and correct. Buffer length is the only offset a byte slice can use.
    out.set(e.name, readFileSync(join(events, e.name)).length);
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
    const buf = readFileSync(join(events, e.name));
    const from = before.get(e.name) ?? 0;
    // A file that SHRANK between snapshot and read has been rewritten, not appended to, and
    // slicing past its end silently returns nothing. Falling back to the whole file is the
    // conservative reading: a duplicate is visible, a silent loss is not.
    const text = (from > buf.length ? buf : buf.subarray(from)).toString("utf8");
    for (const line of text.split("\n")) {
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
  const metrics = new Map();
  const invocationViolations = [];
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
      let measuredAttempts = 0;
      // Latency and cost are measurements OF THE RUN, so they are collected here and land in
      // provenance -- never in the scorecard, which has to be a function of captured bytes alone
      // or the byte-identity claim is untestable.
      const latencies = metrics.get(cov.taskClass) ?? { latencies_ms: [], cost_inr: null, tokens_total: null, cost_source: null };
      metrics.set(cov.taskClass, latencies);
      for (let k = 0; k < state.k; k++) {
        const perAttempt = { ...remaining };
        const timeoutMs = "min" in perAttempt ? Math.max(1000, Math.floor(perAttempt.min * 60000)) : 10 * 60000;
        let r;
        try { r = runAttempt(root, { processName: cov.taskClass, fixture: fx, driver, model, budget: perAttempt, timeoutMs }); }
        catch (e) { r = { ok: false, verdict: "harness", why: String(e.message).split("\n")[0], elapsedMs: 0, schema: null, measuredInr: null }; }
        attempts += 1;
        if ("min" in remaining) remaining.min = Math.max(0, remaining.min - r.elapsedMs / 60000);
        if (r.measuredInr !== null) {
          measured = (measured ?? 0) + r.measuredInr;
          measuredAttempts += 1;
          latencies.cost_inr = (latencies.cost_inr ?? 0) + r.measuredInr;
        }
        if (r.tokensTotal !== null && r.tokensTotal !== undefined) latencies.tokens_total = (latencies.tokens_total ?? 0) + r.tokensTotal;
        // The spine's closed set, checked HERE too. `comparability` does exact string equality on
        // this, so `"measured "` against `"measured"` silently disabled the whole cost axis -- and
        // last-wins across a group meant one odd attempt decided it for all K.
        if (r.costSource) {
          const norm = String(r.costSource).trim();
          latencies.cost_source = ["measured", "estimated", "manual"].includes(norm) ? norm : `unrecognised:${norm}`;
        }
        latencies.latencies_ms.push(r.elapsedMs);
        if (!r.ok) partial = true;
        // A completed attempt with no receipt is an attempt that bypassed arc-run (M1). Recorded
        // as a VIOLATION rather than a scoring outcome, because the numbers may be perfectly
        // fine -- what is missing is the record that makes them auditable.
        if (r.receiptsSeen === 0) {
          invocationViolations.push({ task_class: cov.taskClass, fixture: fx.id, k, why: "the attempt left no arc-run receipt -- it did not go through arc-run (M1)" });
        }

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
      const rec = reconcileGroup(state, cov.taskClass, seat.reserved, measured, measuredAttempts, state.k);
      reconciliations.push({
        task_class: cov.taskClass, fixture: fx.id,
        reserved_inr: seat.reserved,
        measured_inr: rec.applied ? measured : null,
        measured_attempts: measuredAttempts,
        partial_measurement: Boolean(rec.partial),
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
      router_sha_at_read: shaBefore,
      router_unchanged: shaBefore === shaAfter,
      // The non-deterministic half, deliberately kept OUT of the scorecard.
      metrics: Object.fromEntries([...metrics.entries()].map(([k, v]) => [k, {
        cost_inr: v.cost_inr,
        tokens_total: v.tokens_total,
        cost_source: v.cost_source,
        p95_ms: percentile(v.latencies_ms, 95),
        n: v.latencies_ms.length,
      }])),
      budget: {
        run_cap_inr: state.runCap,
        process_cap_inr: state.processCap,
        k: state.k,
        committed_inr: state.runCommitted,
        min_remaining: "min" in remaining ? Number(remaining.min.toFixed(4)) : null,
        reconciliations,
      },
      attempts,
      invocation_violations: invocationViolations,
    },
    outcome: partial || invocationViolations.length > 0 || !state ? "partial" : "ok",
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
      // THE FILE SET IS VALIDATED, NOT JUST FILTERED. `00.json` matched the pattern, sorted to
      // rank 0 as a DISTINCT file, and silently made K=4 -- a byte-copy of the best attempt lifted
      // the score. Requiring the numeric name to round-trip kills leading zeros, and requiring the
      // set to be exactly 0..n-1 kills a gap or a duplicate rank.
      const files = readdirSync(dir)
        .filter((f) => /^\d+\.json$/.test(f) && String(Number(f.slice(0, -5))) === f.slice(0, -5))
        .sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0]));
      const ranks = files.map((f) => Number(f.slice(0, -5)));
      if (ranks.some((r, i) => r !== i)) {
        throw new OperatorError(`capture bundle ${dir} has attempt files ${files.join(", ")} -- they must be exactly 0..n-1 with no gaps, duplicates or leading zeros`);
      }
      const records = files.map((f, i) => {
        const rec = JSON.parse(readFileSync(join(dir, f), "utf8"));
        // A record that claims a SCHEMA PASS while producing no output is malformed: schema is
        // decided by validating an output, so there cannot be one without the other. Accepting it
        // inflated the schema rate to 1, which also muted the drift guard's tier 1.
        if (rec && rec.scored === false && rec.schema === true) {
          throw new OperatorError(`capture bundle ${dir}/${f} claims schema: true on an attempt that produced no output -- a schema verdict requires a document to validate`);
        }
        return rec;
      });
      // The SAME fold and the SAME close as the live run. Two code paths building one artifact
      // differently is an artifact whose byte-identity proves nothing about either of them.
      foldFixture(entry, scoreCaptured(fx, records));
    }
    closeClass(entry);
  }
  return buildScorecard({ classes, packRevisions, processVersions });
}

// =============================================================================================
// Phase 02 -- the router proposal.
// =============================================================================================

/** ADR-0906's gates, IN ORDER. All must pass; the first failure names itself and stops. */
export const GATES = Object.freeze([
  "completeness", "no-schema-regression", "assertion-vs-champion",
  "coverage", "cost-comparability", "same-eval-pack-revision",
]);

/** ADR-0906's band. Inside it, cost decides; above it, quality decides. */
export const ASSERTION_BAND_PP = 2;

const pp = (x) => `${(x * 100).toFixed(1)}pp`;

/**
 * Gates-first eligibility (ADR-0906). No composite score, ever: a composite mixes units and lets
 * a normalization choice quietly decide a routing question.
 *
 * `NO PROPOSAL` is a FIRST-CLASS RESULT, not an error, and it always names the gate that produced
 * it. "evidence insufficient (1 of 5 fixtures)" and "candidate lost on assertions (-7.0pp)" are
 * different sentences and must never render identically -- a reader who cannot tell them apart
 * cannot tell "we have not measured enough" from "we measured, and it lost".
 */
export function evaluateGates(candidate, champion, { candidateRevision, championRevision }) {
  const fail = (gate, reason) => ({ eligible: false, gate, reason: `NO PROPOSAL - ${reason}` });

  // 1. COMPLETENESS. Any skip, budget-abort, transport failure or timeout disqualifies the class.
  // A schema failure does NOT: it is a scoreable outcome, and a candidate that reliably breaks
  // the contract is information, not an absence of information.
  const refused = candidate.unselected.filter((u) => !u.reason.startsWith("declares no repo_state"));
  if (refused.length) return fail("completeness", `incomplete evidence (${refused.length} fixture(s) never ran: ${refused[0].reason})`);
  const unscoreable = candidate.fixtures.flatMap((f) => (f.attempts || []).filter((a) => !a.scored && a.verdict !== "schema"));
  if (unscoreable.length) return fail("completeness", `incomplete evidence (${unscoreable.length} attempt(s) had no scoreable outcome: ${unscoreable[0].verdict})`);
  // THE CHAMPION IS HELD TO THE SAME BAR, and it was not. Gate 1 inspected only the candidate, so
  // a champion whose fixtures were mostly budget-refused became an easy bar that a 1%-scoring
  // candidate cleared -- and "the champion scored badly" and "the champion barely ran" were
  // indistinguishable. A comparison against evidence that does not exist is not a comparison.
  const champRefused = (champion.unselected || []).filter((u) => !u.reason.startsWith("declares no repo_state"));
  const champUnscoreable = (champion.fixtures || []).flatMap((f) => (f.attempts || []).filter((a) => !a.scored && a.verdict !== "schema"));
  if (champRefused.length || champUnscoreable.length) {
    return fail("completeness", `the CHAMPION's evidence is incomplete (${champRefused.length} fixture(s) never ran, ${champUnscoreable.length} attempt(s) unscoreable) -- re-run the champion before comparing against it`);
  }

  // 2. NO SCHEMA REGRESSION. An absent rate on either side is not a pass -- it is an
  // impossible comparison, and saying so is the honest verdict (ADR-0069 b5).
  if (candidate.schema.rate === null || champion.schema.rate === null) {
    return fail("no-schema-regression", "schema pass-rate is ABSENT on one side, so no comparison is possible");
  }
  if (candidate.schema.rate < champion.schema.rate) {
    return fail("no-schema-regression", `schema regression (${pp(candidate.schema.rate - champion.schema.rate)} vs champion)`);
  }

  // 3. ASSERTION PASS-RATE >= CHAMPION - 2pp.
  if (candidate.assertions.rate === null || champion.assertions.rate === null) {
    return fail("assertion-vs-champion", "assertion pass-rate is ABSENT on one side, so no comparison is possible");
  }
  const delta = candidate.assertions.rate - champion.assertions.rate;
  // Gate 4's verdict is computed HERE so gate 3's message can carry it. ADR-0906 fixes the gate
  // ORDER, and reordering would contradict it -- but telling an under-covered class that it "lost
  // on assertions" is the confusion the ADR forbids, so the sentence names both.
  const shortOnCoverage = candidate.declared < MIN_FIXTURES ? `${candidate.declared} of ${MIN_FIXTURES} declared`
    : candidate.selected < MIN_FIXTURES ? `only ${candidate.selected} of ${MIN_FIXTURES} posable` : null;
  // COMPARED WITH AN EPSILON, and the reason is not fussiness. A candidate exactly at the band
  // edge computes `0.98 - 1 = -0.020000000000000018` in binary floating point, which is strictly
  // less than -0.02 -- so the candidate the band was written to admit was rejected by
  // representation noise. Found by this phase's own probe asserting the edge case passes.
  const EPS = 1e-9;
  if (delta < -(ASSERTION_BAND_PP / 100) - EPS) {
    return fail("assertion-vs-champion", `the candidate lost on assertions (${pp(delta)})${shortOnCoverage ? ` -- and its evidence is insufficient anyway (${shortOnCoverage})` : ""}`);
  }

  // 4. COVERAGE. Both the DECLARED count and the count actually POSED: a class can declare six
  // fixtures of which four are posable, clear the floor on the declared number, and then be
  // judged on four. Checking both closes that, and the message names which half failed.
  if (candidate.declared < MIN_FIXTURES) {
    return fail("coverage", `evidence insufficient (${candidate.declared} of ${MIN_FIXTURES} fixtures)`);
  }
  if (candidate.selected < MIN_FIXTURES) {
    return fail("coverage", `evidence insufficient (${candidate.declared} declared but only ${candidate.selected} of ${MIN_FIXTURES} could be posed)`);
  }

  // 5. COST SOURCE ELIGIBLE AND COMPARABLE, *where a cost claim is made*. Two absences are
  // comparable -- neither side claims anything, so the cost tiebreak simply does not run. One
  // absence against one measurement is NOT: that is a comparison between a number and a fact
  // about an instrument (ADR-0904).
  const cCost = candidate.cost_inr ?? null;
  const chCost = champion.cost_inr ?? null;
  if ((cCost === null) !== (chCost === null)) {
    return fail("cost-comparability", `cost is reported on one side only (candidate ${cCost === null ? "ABSENT" : cCost}, champion ${chCost === null ? "ABSENT" : chCost}) -- not comparable`);
  }

  // 6. SAME EVAL-PACK REVISION. Different fixtures are a different exam.
  if (candidateRevision === null || championRevision === null) {
    return fail("same-eval-pack-revision", `the eval-pack revision is ABSENT on ${candidateRevision === null && championRevision === null ? "both sides" : "one side"} -- two unknowns are not the same exam`);
  }
  if (candidateRevision !== championRevision) {
    return fail("same-eval-pack-revision", `eval-pack revision differs (candidate ${candidateRevision ?? "ABSENT"}, champion ${championRevision ?? "ABSENT"}) -- the two ran different exams`);
  }

  // Eligible. WHICH axis decided is recorded, because "it won on quality" and "it tied on
  // quality and won on cost" are different recommendations.
  if (delta > ASSERTION_BAND_PP / 100) return { eligible: true, gate: null, reason: null, delta, decidedBy: "quality" };
  // INSIDE THE BAND, COST DECIDES -- and deciding means it can decide AGAINST. The first draft
  // computed `cost-lost` and then returned eligible anyway, so a candidate 1pp worse and four
  // times more expensive printed **PROPOSE** on the evidence table. ADR-0906's "lower median cost
  // wins" has a loser.
  if (cCost !== null && chCost !== null && cCost > chCost) {
    return fail("cost-comparability", `the candidate tied on quality (${pp(delta)}) and lost on cost (${cCost} vs ${chCost})`);
  }
  const decidedBy = cCost !== null && chCost !== null && cCost < chCost ? "cost" : "tie";
  return { eligible: true, gate: null, reason: null, delta, decidedBy };
}

/**
 * A stable unified diff against the router, pinned to the SHA the run READ.
 *
 * Stable means byte-identical for the same inputs: no timestamp anywhere in the body, and the
 * SHA occupies the field where a diff normally puts one. It is a REVIEW ARTIFACT and nothing
 * applies it -- bench has no write path to `engine/router.yaml`, ever.
 */
export function buildRouterDiff(root, taskClass, candidateDriver, sha) {
  const path = join(root, "engine", "router.yaml");
  const lines = readFileSync(path, "utf8").split("\n");
  const classIdx = lines.findIndex((l) => l === `  ${taskClass}:`);
  if (classIdx < 0) return { diff: null, why: `engine/router.yaml has no \`classes.${taskClass}\` row -- there is nothing to re-route` };
  let driverIdx = -1;
  for (let i = classIdx + 1; i < lines.length && /^\s{4}/.test(lines[i]); i++) {
    if (/^\s{4}driver:/.test(lines[i])) { driverIdx = i; break; }
  }
  if (driverIdx < 0) return { diff: null, why: `\`classes.${taskClass}\` declares no driver line` };
  const before = lines[driverIdx];
  const after = `    driver: ${candidateDriver}`;
  if (before === after) return { diff: null, why: `the router already routes ${taskClass} to ${candidateDriver}` };

  const ctx = 3;
  const from = Math.max(0, driverIdx - ctx);
  const to = Math.min(lines.length - 1, driverIdx + ctx);
  const body = [];
  for (let i = from; i <= to; i++) {
    if (i === driverIdx) { body.push(`-${before}`, `+${after}`); continue; }
    body.push(` ${lines[i]}`);
  }
  const count = to - from + 1;
  const diff = [
    `--- a/engine/router.yaml\t${sha}`,
    `+++ b/engine/router.yaml\t${sha}`,
    `@@ -${from + 1},${count} +${from + 1},${count} @@`,
    ...body,
    "",
  ].join("\n");
  return { diff, why: null };
}

/**
 * The human evidence table (ADR-0907 artifact 1). It is the interface: a reader decides from
 * this, so every row carries the verdict AND the sentence that produced it.
 */
export function buildEvidenceTable(rows, { candidateSubject, championSubject, routerSha }) {
  const out = [
    "# bench proposal — evidence",
    "",
    `Candidate: **${candidateSubject.driver}**${candidateSubject.driver_version ? ` (\`${candidateSubject.driver_version}\`)` : ""}`,
    `Champion:  **${championSubject.driver}**${championSubject.driver_version ? ` (\`${championSubject.driver_version}\`)` : ""}`,
    `Router SHA read by this run: \`${routerSha}\``,
    "",
    "| Task class | Champion | Candidate | Contract (schema) | Quality (assertions) | Cost Δ | Latency p95 Δ | Recommendation |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const q = r.candidate.assertions.rate === null || r.champion.assertions.rate === null
      ? "ABSENT"
      : `${pp(r.candidate.assertions.rate - r.champion.assertions.rate)}`;
    const s = r.candidate.schema.rate === null || r.champion.schema.rate === null
      ? "ABSENT"
      : `${pp(r.candidate.schema.rate - r.champion.schema.rate)}`;
    // ABSENT, never a dash and never 0: a placeholder in a cost column is a claim.
    const cost = r.candidate.cost_inr === null || r.champion.cost_inr === null ? "ABSENT" : String(r.candidate.cost_inr - r.champion.cost_inr);
    const lat = r.candidate.p95_ms === null || r.champion.p95_ms === null ? "ABSENT" : `${r.candidate.p95_ms - r.champion.p95_ms}ms`;
    out.push(`| ${r.task_class} | ${r.champion.assertions.rate === null ? "ABSENT" : pp(r.champion.assertions.rate)} | ${r.candidate.assertions.rate === null ? "ABSENT" : pp(r.candidate.assertions.rate)} | ${s} | ${q} | ${cost} | ${lat} | ${r.verdict.eligible ? `**PROPOSE ${candidateSubject.driver}** (decided on ${r.verdict.decidedBy})` : r.verdict.reason} |`);
  }
  out.push("", "Latency is a TIEBREAK ONLY (ADR-0906) and never overturns a contract or quality verdict.", "");
  return out.join("\n");
}

/**
 * Merge a class's deterministic scorecard row with the run's non-deterministic metrics, so the
 * gates see one object without either half contaminating the other.
 */
function withMetrics(entry, metrics) {
  const m = metrics?.[entry.task_class] ?? {};
  return { ...entry, cost_inr: m.cost_inr ?? null, p95_ms: m.p95_ms ?? null };
}

/**
 * The three artifacts (ADR-0907), plus the `approval.requested` a real proposal earns.
 *
 * ORDER MATTERS AND IS THE POINT. Every independent check runs to completion even when a gate
 * short-circuits the recommendation: a class that reads `NO PROPOSAL` still gets artifacts 1 and
 * 2, the router SHA is still re-read, and the redaction scan still runs. A gate that returned
 * early past its bundled checks is how a short-circuit turns into a silent skip.
 */
export function buildProposal(root, report, championDir, outDir) {
  const cPath = join(championDir, "scorecard.json");
  const cProv = join(championDir, "provenance.json");
  for (const p of [cPath, cProv]) {
    if (!existsSync(p)) throw new OperatorError(`--champion ${championDir} has no ${p.endsWith("scorecard.json") ? "scorecard.json" : "provenance.json"} -- point it at a previous run's --out directory`);
  }
  const champScorecard = JSON.parse(readFileSync(cPath, "utf8"));
  const champProv = JSON.parse(readFileSync(cProv, "utf8"));

  // A champion scored by a different normalizer is not a comparable number, and quietly
  // comparing across formats is exactly the stale-format failure the replay path refuses.
  if (champScorecard.normalizer_version !== report.scorecard.normalizer_version) {
    throw new OperatorError(`the champion was scored by normalizer ${champScorecard.normalizer_version} and this run by ${report.scorecard.normalizer_version} -- re-score the champion before comparing`);
  }

  const rows = [];
  for (const entry of report.scorecard.classes) {
    const champEntry = champScorecard.classes.find((c) => c.task_class === entry.task_class);
    const candidate = withMetrics(entry, report.provenance.metrics);
    if (!entry.eligible) {
      // The Phase-0 coverage gate already refused this class, and its reason is the honest one.
      // `entry.reason` already carries the prefix (coverageVerdict writes it), so it is used as
      // it stands. Re-prefixing produced `NO PROPOSAL - NO PROPOSAL - ...` in the first run.
      rows.push({ task_class: entry.task_class, candidate, champion: withMetrics(champEntry ?? emptyClassEntry({ taskClass: entry.task_class, count: 0, eligible: false, reason: null }), champProv.metrics), verdict: { eligible: false, gate: "coverage", reason: entry.reason } });
      continue;
    }
    if (!champEntry) {
      // `gate: null` deliberately. Labelling this "assertion-vs-champion" put a real gate name on
      // a failure no gate produced, so a reader filtering the manifest for assertion losses got a
      // false positive.
      rows.push({ task_class: entry.task_class, candidate, champion: withMetrics(emptyClassEntry({ taskClass: entry.task_class, count: 0, eligible: false, reason: null }), {}), verdict: { eligible: false, gate: null, reason: "NO PROPOSAL - the champion run has no row for this class, so there is nothing to compare against" } });
      continue;
    }
    const champion = withMetrics(champEntry, champProv.metrics);
    const verdict = evaluateGates(candidate, champion, {
      candidateRevision: report.scorecard.eval_pack_revisions[entry.task_class] ?? null,
      championRevision: champScorecard.eval_pack_revisions[entry.task_class] ?? null,
    });
    rows.push({ task_class: entry.task_class, candidate, champion, verdict });
  }

  const dir = join(outDir, "proposal");
  mkdirSync(dir, { recursive: true });
  // NOT named `routerSha`: that is the imported function, and shadowing it here would make the
  // re-read below throw `routerSha is not a function` at exactly the moment it matters most.
  const shaAtRead = report.provenance.router_sha_at_read;

  // Artifact 1 and 2 are written for EVERY class, eligible or not.
  const table = buildEvidenceTable(rows, {
    candidateSubject: report.provenance.subject,
    championSubject: champProv.subject,
    routerSha: shaAtRead,
  });
  writeFileSync(join(dir, "evidence.md"), `${table}\n`, "utf8");

  const manifest = {
    normalizer_version: report.scorecard.normalizer_version,
    router_sha_at_read: shaAtRead,
    candidate: report.provenance.subject,
    champion: champProv.subject,
    // The manifest is what a later reader consumes; the prose table is never re-parsed. Both are
    // built from `rows`, which is what makes "the table and the manifest agree" structural rather
    // than a thing a test has to police after the fact.
    classes: rows.map((r) => ({
      task_class: r.task_class,
      eligible: r.verdict.eligible,
      gate_failed: r.verdict.gate,
      reason: r.verdict.reason,
      ...(r.verdict.eligible ? { decided_by: r.verdict.decidedBy } : {}),
      candidate: { assertions: r.candidate.assertions, schema: r.candidate.schema, cost_inr: r.candidate.cost_inr, p95_ms: r.candidate.p95_ms },
      champion: { assertions: r.champion.assertions, schema: r.champion.schema, cost_inr: r.champion.cost_inr, p95_ms: r.champion.p95_ms },
    })),
  };
  writeFileSync(join(dir, "manifest.json"), canonicalJson(manifest), "utf8");

  // THE ROUTER SHA IS RE-READ HERE, at proposal-emit, not trusted from run-start. A diff against
  // a target that moved mid-run is a patch for a file that no longer exists in that form.
  const shaNow = routerShaNow(root);
  const abort = shaNow !== shaAtRead
    ? `engine/router.yaml changed during this run (read ${String(shaAtRead).slice(0, 12)}, now ${String(shaNow).slice(0, 12)}) -- no diff was written`
    : null;

  const summary = [];
  const proposed = rows.filter((r) => r.verdict.eligible);
  const proposedWithDiff = [];
  let diffWritten = 0;
  if (!abort) {
    for (const r of proposed) {
      const { diff, why } = buildRouterDiff(root, r.task_class, report.provenance.subject.driver, shaAtRead);
      if (!diff) { summary.push(`${r.task_class}: NO DIFF -- ${why}`); continue; }
      writeFileSync(join(dir, `${r.task_class}.router.diff`), diff, "utf8");
      diffWritten += 1;
      proposedWithDiff.push(r.task_class);
      summary.push(`${r.task_class}: PROPOSE ${report.provenance.subject.driver} (decided on ${r.verdict.decidedBy})`);
    }
  }
  // A class at NO PROPOSAL produces artifacts 1 and 2 and NO DIFF AT ALL -- never an empty or
  // commented-out one, which reads as a proposal that happens to be blank.
  for (const r of rows.filter((x) => !x.verdict.eligible)) summary.push(`${r.task_class}: ${r.verdict.reason}`);

  // The redaction scan is one of the checks that must survive a short-circuit, so it runs here,
  // over what was actually written, regardless of how the gates went.
  const leaked = [];
  for (const f of readdirSync(dir)) {
    const text = readFileSync(join(dir, f), "utf8");
    for (const secret of SECRET_SHAPES) if (secret.re.test(text)) leaked.push(`${f}: ${secret.what}`);
  }
  if (leaked.length) throw new Error(`a proposal artifact carries a secret shape (${leaked[0]}) -- nothing was proposed`);

  let approval = null;
  if (!abort && diffWritten > 0) {
    approval = emitApprovalRequested(root, {
      what: `route ${proposed.map((r) => r.task_class).join(", ")} to ${report.provenance.subject.driver}`,
      gate: "router-merge",
      router_sha: shaAtRead,
      candidate: report.provenance.subject,
      champion: champProv.subject,
      classes: proposed.map((r) => ({ task_class: r.task_class, decided_by: r.verdict.decidedBy })),
    });
    summary.push(approval.landed
      ? `approval.requested ${approval.id} is in events/ and not in _quarantine/`
      : `approval.requested was NOT sealed${approval.why ? ` -- ${approval.why}` : ""}`);
  }

  return {
    abort,
    summary,
    receipt: {
      diffs: diffWritten,
      // The classes a DIFF was written for, not the ones that merely passed the gates: a receipt
      // reading `{diffs: 0, proposed: ["x"]}` claims a proposal nobody can review.
      proposed: proposedWithDiff,
      no_proposal: rows.filter((r) => !r.verdict.eligible).map((r) => ({ task_class: r.task_class, gate: r.verdict.gate, reason: r.verdict.reason })),
      ...(approval && approval.id ? { approval: approval.id } : {}),
    },
  };
}

/** Re-read, deliberately a separate call site from the run-start read. */
function routerShaNow(root) { return routerSha(root); }

/**
 * Shapes that must never reach a stored artifact. Deliberately small and structural: the spine's
 * own scanner runs over every EMITTED payload already (arc-run imports it), and this is the
 * second pass over what bench WRITES TO DISK, which nothing else covers.
 */
const SECRET_SHAPES = Object.freeze([
  { what: "an sk- style API key", re: /\bsk-[A-Za-z0-9_-]{16,}/ },
  { what: "an AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { what: "a GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
  { what: "a PEM private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
]);

/** `approval.requested`, first-party and strict, then LOOKED FOR in both places (ADR-0031/0032). */
export function emitApprovalRequested(root, payload) {
  const tmp = mkdtempSync(join(tmpdir(), "arc-bench-appr-"));
  try {
    const f = join(tmp, "payload.json");
    writeFileSync(f, JSON.stringify(payload), "utf8");
    const res = spawnSync("bash", [
      join(root, ".claude/scripts/hq/arc-event.sh"), "emit", "approval.requested",
      "--payload-file", f, "--process", BENCH_ID, "--strict",
    ], { encoding: "utf8", cwd: root, timeout: 30000, killSignal: "SIGKILL" });
    const id = String(res.stdout || "").trim();
    if (res.status !== 0 || !id) {
      return { id: null, landed: false, why: String(res.stderr || "").trim().split("\n").filter(Boolean)[0] || `the emitter exited ${res.status}` };
    }
    return { id, why: null, ...findReceipt(root, id) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// =============================================================================================
// Phase 03 -- the drift guard.
// =============================================================================================

/** ADR-0908's recorded defaults. Recalibrating them needs a real incident, by amendment. */
export const DRIFT = Object.freeze({
  ASSERTION_DROP_PP: 10,
  MIN_FAILING_FIXTURES: 2,
  COST_INCREASE_PCT: 20,
});

/**
 * TWO SPLIT AXES (ADR-0908), never one "is this comparable" boolean.
 *
 * Quality comparability and cost comparability fail for different reasons and have different
 * consequences: a driver-version bump makes quality incomparable while leaving cost perfectly
 * comparable, and a missing token count does the reverse. Collapsing them means one absence
 * silently disables both comparisons, which is how a real regression hides behind a bookkeeping
 * gap.
 */
export function comparability(candidate, champion) {
  const q = [];
  const c = [];
  const cmp = (list, what, a, b) => { if (a !== b) list.push(`${what} differs (candidate ${a ?? "ABSENT"}, champion ${b ?? "ABSENT"})`); };

  cmp(q, "eval-pack revision", candidate.eval_pack_revision, champion.eval_pack_revision);
  cmp(q, "process version", candidate.process_version, champion.process_version);
  cmp(q, "driver version", candidate.driver_version, champion.driver_version);
  cmp(q, "model id", candidate.model_id ?? null, champion.model_id ?? null);
  cmp(q, "request settings", candidate.request_settings ?? null, champion.request_settings ?? null);

  // Cost comparability needs BOTH a token count and a comparable source. A rupee figure whose
  // source is unstated is the thing MP-F exists to prevent.
  for (const [side, s] of [["candidate", candidate], ["champion", champion]]) {
    if (s.tokens_total === null || s.tokens_total === undefined) c.push(`${side} reports no token usage`);
    if (!s.cost_source) c.push(`${side} reports no cost source`);
  }
  if (candidate.cost_source && champion.cost_source && candidate.cost_source !== champion.cost_source) {
    c.push(`cost source differs (candidate ${candidate.cost_source}, champion ${champion.cost_source})`);
  }
  return {
    quality: { comparable: q.length === 0, differences: q },
    cost: { comparable: c.length === 0, differences: c },
  };
}

/**
 * Every cost delta is classified into EXACTLY ONE of three causes.
 *
 * A price rise must never be reported as a usage change, and neither may hide behind an
 * incomparable baseline. Where the axes do not support a classification the answer is
 * `unknown-mixed` with its reason, which is a finding rather than a gap.
 */
export function classifyCostDelta(candidate, champion, axes) {
  if (!axes.cost.comparable) {
    return { cause: "unknown-mixed", delta_inr: null, delta_pct: null, why: `cost is not comparable: ${axes.cost.differences[0]}` };
  }
  // MONEY, on BOTH sides. Comparability only ever checked tokens and a source, so two absent
  // rupee figures reached the arithmetic as `null - null === 0` and were reported as a definite
  // "nothing moved" -- which is the documented, normal case for arc-run, since the spine's cost
  // block cannot express tokens-without-money. One absent side produced `Infinity%` and a
  // zero-token side produced `NaN%`. An absent measurement is a fact about the instrument and
  // must stay absent (ADR-0069 b5).
  if (!Number.isFinite(candidate.cost_inr) || !Number.isFinite(champion.cost_inr)) {
    return { cause: "unknown-mixed", delta_inr: null, delta_pct: null, why: `no money was reported on ${!Number.isFinite(candidate.cost_inr) && !Number.isFinite(champion.cost_inr) ? "either side" : "one side"} -- tokens alone do not make a cost` };
  }
  const dInr = candidate.cost_inr - champion.cost_inr;
  // A zero champion cost has no percentage, but it DOES have a direction: 0 -> 900 is a rise,
  // and returning null there silently disabled tier 3 for exactly the case that matters most.
  const dPct = champion.cost_inr === 0 ? (dInr > 0 ? Infinity : 0) : (dInr / champion.cost_inr) * 100;
  const dTok = candidate.tokens_total - champion.tokens_total;

  // Same tokens, different money -> the RATE moved. Different tokens at the same rate -> USAGE
  // moved. Both moved -> mixed, and saying so beats picking the more convenient story.
  const ratePerTok = (s) => (s.tokens_total ? s.cost_inr / s.tokens_total : null);
  const rc = ratePerTok(candidate);
  const rh = ratePerTok(champion);
  const rateSame = rc !== null && rh !== null && Math.abs(rc - rh) <= 1e-9 * Math.max(1, Math.abs(rh));

  if (dTok === 0 && dInr !== 0) return { cause: "provider-rate", delta_inr: dInr, delta_pct: dPct, why: "token usage is identical and the money moved" };
  if (dTok !== 0 && rateSame) return { cause: "token-use", delta_inr: dInr, delta_pct: dPct, why: "the per-token rate is unchanged and usage moved" };
  if (dTok === 0 && dInr === 0) return { cause: "token-use", delta_inr: 0, delta_pct: 0, why: "nothing moved" };
  return { cause: "unknown-mixed", delta_inr: dInr, delta_pct: dPct, why: "both the rate and the usage moved, so neither alone explains the delta" };
}

/**
 * The three alert tiers (ADR-0908), each with its own consequence.
 *
 * Tier 3 is REPORT-ONLY BY DESIGN and never becomes an inbox item. A cost rise is a business
 * fact, not a correctness one, and an inbox that fills with price movements is an inbox nobody
 * reads -- which is how a tier-1 schema failure goes unnoticed.
 *
 * Alerts fire only where the class ships at least MIN_FIXTURES. A muted class is NAMED with its
 * reason in every report: silence that looks like "no drift" is worse than no report at all.
 */
export function driftAlerts(candidate, champion, axes, costDelta) {
  const alerts = [];
  if (candidate.declared < MIN_FIXTURES) {
    return { muted: true, why: `muted: ${candidate.declared} of ${MIN_FIXTURES} fixtures -- below the floor, so a movement here is noise`, alerts };
  }

  // TIER 1a -- A TOTAL COLLAPSE, checked FIRST and before anything that needs a rate.
  //
  // Every rate-based tier below requires a non-null candidate rate, and an attempt that produced
  // nothing contributes to no denominator -- so a run where EVERY attempt failed came back with
  // both rates ABSENT, fired no tier, raised no inbox item and reported `clean: true`. The single
  // worst outcome was the one the guard could not see. Found by this lane's adversarial pass; it
  // is the docstring's own standard failing on its own terms, since silence that looks like "no
  // drift" is worse than no report at all.
  if (axes.quality.comparable
    && (champion.assertions.rate !== null || champion.schema.rate !== null)
    && candidate.assertions.rate === null && candidate.schema.rate === null) {
    alerts.push({ tier: 1, inbox: true, what: "the candidate produced NO scoreable outcome at all, against a champion that did -- a total collapse, not an absence of evidence" });
    return { muted: false, why: null, alerts };
  }

  // TIER 1 -- a NEW schema failure in a previously-clean champion. "Previously clean" is
  // load-bearing: a champion that was already failing has not started drifting today.
  if (axes.quality.comparable && champion.schema.rate === 1 && candidate.schema.rate !== null && candidate.schema.rate < 1) {
    alerts.push({ tier: 1, inbox: true, what: `a new schema failure in a previously-clean champion (${candidate.schema.passed}/${candidate.schema.evaluated})` });
  }

  // TIER 2 -- BOTH conditions, never either. A 10pp drop concentrated in one fixture is one
  // fixture; requiring two makes the alert about the champion rather than about a fixture.
  if (axes.quality.comparable && candidate.assertions.rate !== null && champion.assertions.rate !== null) {
    const dropPp = (champion.assertions.rate - candidate.assertions.rate) * 100;
    const failing = (candidate.fixtures || []).filter((f) => f.assertions && f.assertions.rate !== null && f.assertions.rate < 1).length;
    if (dropPp >= DRIFT.ASSERTION_DROP_PP && failing >= DRIFT.MIN_FAILING_FIXTURES) {
      alerts.push({ tier: 2, inbox: true, what: `assertion pass-rate dropped ${dropPp.toFixed(1)}pp across ${failing} failing fixtures` });
    }
  }

  // TIER 3 -- REPORT ONLY. Never an inbox item, whatever the size.
  if (costDelta.delta_pct !== null && costDelta.delta_pct > DRIFT.COST_INCREASE_PCT) {
    const pct = Number.isFinite(costDelta.delta_pct) ? `${costDelta.delta_pct.toFixed(1)}%` : `from nothing to ${costDelta.delta_inr}`;
    alerts.push({ tier: 3, inbox: false, what: `cost rose ${pct} (cause: ${costDelta.cause})` });
  }
  return { muted: false, why: null, alerts };
}

/**
 * When a baseline may be RE-PINNED, and the enumerated list is closed.
 *
 * THE ANTI-GOALPOST CLAUSE: a score movement alone NEVER re-pins. If it did, a champion that
 * quietly got worse would become its own new standard, and the guard would report no drift
 * forever after -- measuring the thing against itself.
 */
export function repinCauses(axes, routingChanged) {
  const causes = [];
  if (!axes.quality.comparable) causes.push(`a quality-compatibility component changed: ${axes.quality.differences.join("; ")}`);
  if (routingChanged) causes.push("a routing change was merged");
  return { mayRepin: causes.length > 0, causes };
}

/**
 * The guard report. A CLEAN RUN EMITS ONLY `run.completed` -- there is no approval event for a
 * no-drift run, because the spine never carries no-op approvals (ADR-0910). An inbox-tier alert
 * is what creates an `approval.requested` with gate `drift`.
 */
export function buildGuardReport(root, report, championDir) {
  const cPath = join(championDir, "scorecard.json");
  const cProv = join(championDir, "provenance.json");
  for (const p of [cPath, cProv]) {
    if (!existsSync(p)) throw new OperatorError(`--champion ${championDir} has no ${p.endsWith("scorecard.json") ? "scorecard.json" : "provenance.json"} -- point it at a previous run's --out directory`);
  }
  const champScorecard = JSON.parse(readFileSync(cPath, "utf8"));
  const champProv = JSON.parse(readFileSync(cProv, "utf8"));

  const side = (scorecard, prov, entry) => {
    const m = prov.metrics?.[entry.task_class] ?? {};
    return {
      ...entry,
      eval_pack_revision: scorecard.eval_pack_revisions[entry.task_class] ?? null,
      process_version: scorecard.process_versions[entry.task_class] ?? null,
      driver_version: prov.subject?.driver_version ?? null,
      model_id: prov.fingerprint?.model_id ?? null,
      request_settings: prov.request_settings ?? null,
      cost_inr: m.cost_inr ?? null,
      cost_source: m.cost_source ?? null,
      tokens_total: m.tokens_total ?? null,
      p95_ms: m.p95_ms ?? null,
    };
  };

  const classes = [];
  const inbox = [];
  for (const entry of report.scorecard.classes) {
    const champEntry = champScorecard.classes.find((c) => c.task_class === entry.task_class);
    if (!champEntry) {
      classes.push({ task_class: entry.task_class, muted: true, why: "the champion run has no row for this class, so there is no baseline to drift from", axes: null, cost: null, alerts: [], repin: { mayRepin: false, causes: [] } });
      continue;
    }
    const cand = side(report.scorecard, report.provenance, entry);
    const champ = side(champScorecard, champProv, champEntry);
    const axes = comparability(cand, champ);
    const cost = classifyCostDelta(cand, champ, axes);
    const { muted, why, alerts } = driftAlerts(cand, champ, axes, cost);
    // Routing is only "changed" if the router moved since the champion recorded its SHA.
    const routingChanged = Boolean(champProv.subject?.router_sha) && champProv.subject.router_sha !== report.provenance.router_sha_at_read;
    const repin = repinCauses(axes, routingChanged);
    classes.push({ task_class: entry.task_class, muted, why, axes, cost, alerts, repin });
    for (const a of alerts) if (a.inbox) inbox.push({ task_class: entry.task_class, ...a });
  }

  const lines = ["drift guard:"];
  for (const c of classes) {
    if (c.muted) { lines.push(`  ${c.task_class}: MUTED -- ${c.why}`); continue; }
    lines.push(`  ${c.task_class}: quality ${c.axes.quality.comparable ? "comparable" : `NOT comparable (${c.axes.quality.differences[0]})`} · cost ${c.axes.cost.comparable ? `${c.cost.cause} ${c.cost.delta_pct === null ? "" : `${c.cost.delta_pct.toFixed(1)}%`}` : `NOT comparable (${c.axes.cost.differences[0]})`}`);
    for (const a of c.alerts) lines.push(`    TIER ${a.tier}${a.inbox ? "" : " (REPORT-ONLY)"}: ${a.what}`);
    if (!c.alerts.length) lines.push("    no drift");
    // A score movement ALONE never re-pins, and the report says so rather than staying silent.
    lines.push(c.repin.mayRepin
      ? `    baseline MAY be re-pinned: ${c.repin.causes.join("; ")}`
      : "    baseline stays pinned -- a score movement alone never re-pins (the anti-goalpost clause)");
  }

  let approval = null;
  if (inbox.length) {
    approval = emitApprovalRequested(root, {
      what: `drift detected on ${inbox.map((i) => i.task_class).join(", ")}`,
      gate: "drift",
      findings: inbox.map((i) => ({ task_class: i.task_class, tier: i.tier, what: i.what })),
    });
    lines.push(approval.landed
      ? `  approval.requested ${approval.id} is in events/ and not in _quarantine/`
      : `  approval.requested was NOT sealed${approval.why ? ` -- ${approval.why}` : ""}`);
  } else {
    // Stated explicitly, because "no approval appeared" and "the guard did not run" look the
    // same in a log otherwise.
    lines.push("  no inbox-tier drift, so NO approval event was created (ADR-0910)");
  }

  return { classes, inbox, approval, lines, clean: inbox.length === 0 };
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
    // THE BUNDLE ROOT OR THE CAPTURE DIRECTORY, either one. A live run writes captures to
    // `<out>/capture/` and its scorecard to `<out>/`, so pointing `--replay` at the capture
    // directory -- the only path that holds the attempts -- could NEVER find the baseline beside
    // them, and the comparison was skipped on every honestly-produced bundle.
    const given = resolve(args.replay);
    const captureDir = existsSync(join(given, "capture")) ? join(given, "capture") : given;
    const prior = existsSync(join(given, "scorecard.json")) ? join(given, "scorecard.json")
      : existsSync(join(dirname(captureDir), "scorecard.json")) ? join(dirname(captureDir), "scorecard.json") : null;

    let fresh;
    try { fresh = replayBench(root, captureDir); }
    catch (e) { console.error(`arc-bench: ${e.message}`); process.exit(e instanceof OperatorError ? EXIT.OPERATOR : EXIT.PARTIAL); }
    const bytes = canonicalJson(fresh);

    // A bundle that scored nothing is not a passing replay, it is an empty directory. Exiting 0
    // there made `--replay <anything>` a success.
    const scored = fresh.classes.reduce((a, c) => a + (c.fixtures || []).length, 0);
    if (scored === 0) {
      console.error(`arc-bench: ${captureDir} holds no captured attempts -- there is nothing to re-score`);
      process.exit(EXIT.OPERATOR);
    }
    if (args.out) { mkdirSync(resolve(args.out), { recursive: true }); writeFileSync(join(resolve(args.out), "scorecard.json"), bytes, "utf8"); }
    // "I COULD NOT COMPARE" MUST NOT SHARE AN EXIT CODE WITH "IT MATCHED". Skipping to exit 0
    // also let a tamperer convert a detected mismatch into a pass by deleting one file.
    if (!prior) {
      console.error(`arc-bench: no scorecard.json beside ${captureDir} -- there is nothing to compare against, and "could not compare" is not a match`);
      process.exit(EXIT.OPERATOR);
    }
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
      // The first few failure REASONS, never the whole fixture list. A receipt that carried only
      // numbers is auditable but not diagnosable, and this is also the one field that proved the
      // Windows-path emit bug: the driver's message names a path, and a payload that cannot carry
      // it is a payload that cannot report the failure it exists to report.
      ...(() => {
        const bad = (c.fixtures || []).flatMap((f) => (f.attempts || []).filter((a) => !a.scored).map((a) => ({ fixture: f.id, k: a.k, verdict: a.verdict, why: a.why })));
        return bad.length ? { failures: bad.slice(0, 3), failures_total: bad.length } : {};
      })(),
    })),
  };
  // ---- the drift guard (Phase 03) ----
  // `--champion` WITHOUT `--propose`. It reports; it never proposes, and a clean run leaves no
  // approval on the spine (ADR-0910). Built before the receipt so the receipt can carry its
  // findings, and its own failure can never leave a receipt claiming a guard that never ran.
  let guard = null;
  if (args.champion && !args.propose) {
    try { guard = buildGuardReport(root, report, resolve(args.champion)); }
    catch (e) {
      console.error(`arc-bench: ${e.message}`);
      process.exit(e instanceof OperatorError ? EXIT.OPERATOR : EXIT.PARTIAL);
    }
    for (const line of guard.lines) console.log(line);
    // The date the guard is next due, printed rather than written: bench is a runner and has no
    // write path to a tracker. The line belongs in PROGRESS.md, put there by whoever ran it --
    // absence is never inferred from nobody having looked (ADR-0910).
    console.log(`  NEXT-CHECK: the first working day of the following month -- record it in initiatives/bench/PROGRESS.md`);
  }

  // ---- the proposal (Phase 02) ----
  // Built BEFORE the run receipt so a failure here cannot leave a receipt claiming a proposal
  // that was never written, and every check below runs to completion even when an early gate
  // short-circuits the recommendation.
  let proposal = null;
  if (args.propose) {
    try { proposal = buildProposal(root, report, resolve(args.champion), outDir); }
    catch (e) {
      console.error(`arc-bench: ${e.message}`);
      process.exit(e instanceof OperatorError ? EXIT.OPERATOR : EXIT.PARTIAL);
    }
    console.log(`arc-bench: proposal artifacts written to ${relative(root, join(outDir, "proposal")) || join(outDir, "proposal")}`);
    for (const line of proposal.summary) console.log(`  ${line}`);
    if (proposal.abort) {
      // THE ROUTER MOVED UNDER THE RUN. Its own reason and its own exit, never a diff against a
      // target that has already changed -- a reviewer would be reading a patch for a file that
      // no longer exists in that form.
      console.error(`arc-bench: ABORTED -- ${proposal.abort}`);
      process.exit(EXIT.PARTIAL);
    }
  }

  const receipt = emitRunCompleted(root, {
    ...payload,
    ...(proposal ? { proposal: proposal.receipt } : {}),
    ...(guard ? {
      guard: {
        clean: guard.clean,
        inbox: guard.inbox.map((i) => ({ task_class: i.task_class, tier: i.tier })),
        // The re-pin CAUSE is on the receipt, never the score movement that prompted the look:
        // a baseline that re-pinned itself on a score would measure the champion against itself.
        repin: guard.classes.filter((c) => c.repin?.mayRepin).map((c) => ({ task_class: c.task_class, causes: c.repin.causes })),
        ...(guard.approval && guard.approval.id ? { approval: guard.approval.id } : {}),
      },
    } : {}),
  }, report.outcome === "ok" ? "ok" : "fail");
  if (receipt.landed) {
    console.log(`arc-bench: receipt ${receipt.id} is in events/ and not in _quarantine/`);
  } else if (receipt.quarantined) {
    console.error(`arc-bench: receipt ${receipt.id} was QUARANTINED at ${receipt.quarantined} -- quarantine is not success (ADR-0032)`);
  } else {
    console.error(`arc-bench: NO receipt was sealed${receipt.why ? ` -- ${receipt.why}` : ""}`);
  }
  // THE TWO GUARDS THIS LANE EXISTS TO KEEP, reported after the receipt so the violation itself
  // is on the record rather than only on a terminal that has since scrolled away.
  if (!report.provenance.router_unchanged) {
    console.error("arc-bench: the router SHA CHANGED across this run -- propose-only was violated and this run is not evidence of anything");
    process.exit(EXIT.PARTIAL);
  }
  const viol = report.provenance.invocation_violations ?? [];
  if (viol.length) {
    console.error(`arc-bench: ${viol.length} attempt(s) left NO arc-run receipt -- bench invokes arc-run once per attempt (M1), and an attempt that bypassed it has no run-level budget remainder, no receipt and no contract-retry ladder`);
    console.error(`           first: ${viol[0].task_class}/${viol[0].fixture} attempt ${viol[0].k}`);
    process.exit(EXIT.PARTIAL);
  }
  // A run whose receipt did not land is not a clean run, however well it scored: an unrecorded
  // result cannot be audited later, and the whole point of the thread is the record.
  process.exit(report.outcome === "ok" && receipt.landed ? EXIT.OK : EXIT.PARTIAL);
}

// Windows argv[1] arrives however the caller typed it, so both sides are resolved before the
// comparison -- an unresolved relative path never matches and the CLI silently does nothing.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
