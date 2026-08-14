#!/usr/bin/env node
/**
 * Probe for the steel thread (Phase 00 slice 09).
 *
 * Its own file rather than inline `node -e`: the assertions carry apostrophes, backticks and `$`,
 * all three of which CLAUDE.md forbids in a program embedded in a shell string.
 *
 * WHAT THIS PROBE IS FOR. Two things, and the second matters more than the first:
 *
 *   1. The thread runs: discover -> materialize -> arc-run -> score -> emit -> and the receipt is
 *      VERIFIED in `events/` and absent from `events/_quarantine/`. Exit 0 from a fire-and-forget
 *      writer is not evidence anything was written (retro-log 2026-08-02).
 *
 *   2. The failure paths are REACHABLE. A runner whose only exercised path is the happy one has
 *      an unmeasured half: this probe forces a not-scored attempt and an unsealed receipt and
 *      asserts bench reports each as such rather than rounding them up to a pass. A test that
 *      only ever sees green cannot tell green from unconditional.
 *
 * It also pins the two MEASURED findings about M1's env plumbing, so the day the engine grows a
 * target-repo seam these assertions fail loudly instead of a stale comment going quietly wrong.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EXIT, findReceipt, knownDrivers, parseArgs, OperatorError } from "../.claude/scripts/engine/arc-bench.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BENCH = join(ROOT, ".claude/scripts/engine/arc-bench.mjs");
const ARC_RUN = join(ROOT, ".claude/scripts/engine/arc-run.mjs");

// Printed first, always. When this probe goes red on a CI leg that cannot be reproduced
// locally, the platform, the runtime and the temp root are the three facts the diagnosis starts
// from -- and a probe that omits them costs a whole extra cycle to ask for them.
console.log(`# env ${process.platform} node ${process.version} tmp ${tmpdir()}`);

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) { console.error(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); failed++; }
  else console.log(`ok ${name}`);
};

const scratch = mkdtempSync(join(tmpdir(), "bench-steel-"));
const spineFor = (name) => {
  const p = join(scratch, name, "spine");
  mkdirSync(p, { recursive: true });
  return p;
};

/** Run bench as a subprocess and return its exit status plus both streams, never piped. */
function bench(args, env = {}) {
  const res = spawnSync(process.execPath, [BENCH, ...args], {
    encoding: "utf8", cwd: ROOT, timeout: 300000, killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  return { status: res.status ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

/** Every sealed event on a spine, newest file last. Reads the DIRECTORY, never a guessed day. */
function eventsOn(spine) {
  const dir = join(spine, "events");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
    for (const line of readFileSync(join(dir, e.name), "utf8").split("\n")) {
      if (line.trim()) out.push(JSON.parse(line));
    }
  }
  return out;
}

// ---- 1. the happy path, end to end -----------------------------------------------------------
{
  const spine = spineFor("happy");
  // A harness that leaks a temp repo per attempt fills the runner disk exactly when something is
  // already wrong. Counted around the SAME run rather than in a fourth one -- a probe that spawns
  // a full bench run per property is a probe nobody can afford to keep in a Windows shard.
  // A PRIVATE TMPDIR, so the answer is ATTRIBUTABLE. This started as a count, which another probe
  // running beside it moved (4 -> 2, read as a leak); a set difference fixed that and still saw a
  // concurrent probe's LIVE directory as new. Neither is wrong about the number -- both are asking
  // a shared directory a question only a private one can answer. Every `arc-bench-*` inside this
  // one belongs to this run and nothing else, so a survivor is a leak by construction.
  const privateTmp = join(scratch, "tmp");
  mkdirSync(privateTmp, { recursive: true });
  const r = bench(["--driver", "mock", "--model", "claude-opus-5", "--budget", "inr=10,min=5"],
    { ARC_SPINE_ROOT: spine, TMPDIR: privateTmp, TEMP: privateTmp, TMP: privateTmp });
  const leaked = readdirSync(privateTmp).filter((n) => n.startsWith("arc-bench-"));
  check("a full run leaks no temp repositories", leaked.length === 0, leaked.join(","));

  check("the steel thread exits 0", r.status === EXIT.OK, `status ${r.status}: ${r.stderr.trim().split("\n")[0] || ""}`);
  check("it names the driver version from the version verb", /driver mock \(mock@[0-9a-f]{12}\)/.test(r.stdout), r.stdout.split("\n")[0]);
  // K=3 SINCE PHASE 01: five fixtures x three attempts x six assertions = 90. The steel thread
  // was written against a K=1 runner and these numbers moved when the runner did -- updating them
  // rather than loosening them keeps the assertion exact.
  check("all five armed fixtures were scored, three times each", (r.stdout.match(/K=\[6\/6 6\/6 6\/6\]/g) || []).length === 5, r.stdout);
  check("every assertion passed against the pinned recordings", /assertions 90\/90 = 100\.0%/.test(r.stdout), r.stdout);
  check("the eval pack revision is on the scorecard", /commit-msg-draft @ 1\.0\.0/.test(r.stdout));
  check("the fixture that declares no repo_state is NAMED, not silently dropped",
    /basic\.json: not selected -- declares no repo_state/.test(r.stdout));
  check("the other two classes still read NO PROPOSAL",
    /review-diff: NO PROPOSAL/.test(r.stdout) && /kickoff-plan: NO PROPOSAL/.test(r.stdout));
  check("the caps and what was committed against them are reported", /caps run \d+ \/ process \d+ . K=3/.test(r.stdout), r.stdout.split("\n")[2]);

  // The receipt, looked for rather than assumed.
  const all = eventsOn(spine);
  const mine = all.filter((e) => e.kind === "run.completed" && e.process === "bench@0.1.0");
  check("exactly ONE run.completed was emitted by bench", mine.length === 1, `saw ${mine.length}`);
  check("bench also confirmed the landing in its own output",
    /receipt [0-9A-HJKMNP-TV-Z]{26} is in events\/ and not in _quarantine\//.test(r.stdout));

  const q = join(spine, "events", "_quarantine");
  check("nothing was quarantined on the happy path",
    !existsSync(q) || readdirSync(q).length === 0);

  if (mine.length === 1) {
    const p = mine[0].payload;
    // The provenance moved into SIBLING blocks in Phase 01 (ADR-0903): the driver is bench's
    // and lives in `subject`, the model identity is MP-F's and lives in `fingerprint`.
    check("the receipt names the driver and its version", p.subject.driver === "mock" && /^mock@[0-9a-f]{12}$/.test(p.subject.driver_version || ""));
    check("the receipt records the model REQUESTED", p.fingerprint.model_requested === "claude-opus-5");
    // The load-bearing one: a run must never claim a model it did not apply.
    check("and records that NO model was applied", p.model_applied === null);
    check("the receipt carries the per-class scores",
      Array.isArray(p.classes) && p.classes.some((c) => c.task_class === "commit-msg-draft" && c.assertions.total === 90));
    // The CAPS moved to provenance in Phase 01 -- a ceiling never enters an emitted payload
    // (ADR-0904) -- so what the receipt carries is the scorecard identity, not the budget.
    check("the receipt carries the scorecard hash and NO caps",
      typeof p.scorecard_sha === "string" && p.scorecard_sha.length === 64 && !("budget" in p));
    check("the outcome is ok", p.outcome === "ok" && mine[0].outcome === "ok");
  }

  // arc-run emits its own receipt per attempt; bench emits exactly one for the run. Both live on
  // the same spine, so the count is a fact worth pinning rather than an assumption.
  const runs = all.filter((e) => e.kind === "run.completed" && e.process !== "bench@0.1.0");
  check("arc-run emitted one receipt per attempt, beside bench's one", runs.length === 15, `saw ${runs.length}`);

  // MEASURED FINDING 2: ARC_DRIVER_MODEL does not survive arc-run. Bench set it to
  // `claude-opus-5` above, and arc-run's OWN receipt still reads `unpinned` -- because with an
  // explicit --driver there is no tier, so pinnedModel is null and the driver is handed "".
  check("MEASURED: arc-run overwrites ARC_DRIVER_MODEL, so its receipts read unpinned",
    runs.length > 0 && runs.every((e) => e.payload.model === "unpinned"),
    runs.map((e) => e.payload.model).join(","));
}

// ---- 2. MEASURED FINDING 1: ARC_ROOT does not survive arc-run either -------------------------
{
  // Point ARC_ROOT at a directory that holds NO recordings. If it reached the driver, the mock
  // would resolve its recording dir underneath it and die naming the path it looked for. The run
  // succeeding is the proof that arc-run replaced the value with its own root.
  const spine = spineFor("arcroot");
  const bogus = join(scratch, "bogus-no-recordings");
  mkdirSync(bogus, { recursive: true });
  const res = spawnSync(process.execPath, [
    ARC_RUN, "--process", "commit-msg-draft", "--driver", "mock", "--input", "{}", "--budget", "inr=10", "--root", ROOT,
  ], {
    encoding: "utf8", cwd: ROOT, timeout: 120000, killSignal: "SIGKILL",
    env: { ...process.env, ARC_SPINE_ROOT: spine, ARC_MOCK_FIXTURE: "docs-only", ARC_ROOT: bogus },
  });
  check("MEASURED: arc-run overwrites ARC_ROOT, so a bogus one does not reach the driver",
    res.status === 0, `status ${res.status}: ${String(res.stderr).trim().split("\n").pop()}`);
  check("and the right recording was still replayed",
    /document what total does with non-array input/.test(res.stdout || ""));
}

// ---- 3. a not-scored attempt is reported, never rounded up to a pass -------------------------
{
  // ARC_MOCK_DIR is NOT one of the three vars arc-run overwrites, so it passes through and every
  // recording lookup misses. Each attempt must come back NOT SCORED and the run must exit 1.
  const spine = spineFor("empty-recordings");
  const empty = join(scratch, "no-recordings");
  mkdirSync(empty, { recursive: true });
  const r = bench(["--driver", "mock", "--budget", "inr=10,min=5"], { ARC_SPINE_ROOT: spine, ARC_MOCK_DIR: empty });

  check("a run with no usable recordings exits 1, not 0", r.status === EXIT.PARTIAL, `status ${r.status}`);
  check("and every fixture is reported NOT SCORED", (r.stdout.match(/NOT SCORED/g) || []).length === 5,
    `${(r.stdout.match(/NOT SCORED/g) || []).length} of 5`);
  check("the scorecard shows every fixture unscored", (r.stdout.match(/K=\[-- -- --\]/g) || []).length === 5, r.stdout);
  // The rule the whole substrate exists to protect: an empty denominator is ABSENT, not 100%.
  check("with nothing scored the assertion rate is ABSENT, never 100 percent",
    /assertions 0\/0 = ABSENT/.test(r.stdout), r.stdout);

  const mine = eventsOn(spine).filter((e) => e.kind === "run.completed" && e.process === "bench@0.1.0");
  check("a failed run still emits its receipt, with outcome fail",
    mine.length === 1 && mine[0].outcome === "fail" && mine[0].payload.outcome === "partial",
    `${mine.length} receipt(s): ${mine.map((e) => `${e.outcome}/${e.payload.outcome}`).join(",")}`);

  if (mine.length === 1) {
    // THE REGRESSION PIN for the bug this section found. The driver's message names the path it
    // looked for, so on Windows the payload carries `C:\...`, and passing that JSON through
    // `spawnSync -> Windows command line -> bash` came back `REJECT BAD_JSON -- invalid escape
    // \U`. The one receipt that mattered -- the one reporting a failure -- was the only one that
    // could not be written. Reaching the emitter through --payload-file is what fixes it, and
    // this asserts the message ARRIVED rather than merely that something was sealed.
    const first = (mine[0].payload.classes || []).flatMap((c) => c.failures || [])[0];
    check("the driver reason reached the receipt intact, path separators and all",
      Boolean(first) && /no recording for commit-msg-draft\//.test(first.why || ""),
      first ? first.why : "no failed fixture on the receipt");
  }
}

// ---- 4. the receipt verifier itself -----------------------------------------------------------
{
  // findReceipt is the assertion the whole slice hangs on, so it is tested directly rather than
  // only through a green run -- a verifier that always answered "landed" would pass every check
  // above without ever reading a file.
  const spine = spineFor("verifier");
  const prev = process.env.ARC_SPINE_ROOT;
  process.env.ARC_SPINE_ROOT = spine;
  try {
    mkdirSync(join(spine, "events"), { recursive: true });
    check("an id that was never written is NOT reported as landed", findReceipt(ROOT, "01AAAAAAAAAAAAAAAAAAAAAAAA").landed === false);

    writeFileSync(join(spine, "events", "2026-01-01.jsonl"), `{"id":"01BBBBBBBBBBBBBBBBBBBBBBBB"}\n`, "utf8");
    const sealed = findReceipt(ROOT, "01BBBBBBBBBBBBBBBBBBBBBBBB");
    check("a sealed id is found in a day file the clock was never asked about", sealed.landed === true && sealed.inEvents === true);

    // Quarantined AND present would still not be a landing; here it is quarantined only.
    mkdirSync(join(spine, "events", "_quarantine", "2026-01-01"), { recursive: true });
    writeFileSync(join(spine, "events", "_quarantine", "2026-01-01", "bad.jsonl"), `{"id":"01CCCCCCCCCCCCCCCCCCCCCCCC"}\n`, "utf8");
    const quar = findReceipt(ROOT, "01CCCCCCCCCCCCCCCCCCCCCCCC");
    check("a quarantined id is found in a NESTED quarantine dir and is not a landing",
      quar.quarantined !== null && quar.landed === false);
  } finally {
    if (prev === undefined) delete process.env.ARC_SPINE_ROOT; else process.env.ARC_SPINE_ROOT = prev;
  }
}

// ---- 5. the closed flag set (M13) -------------------------------------------------------------
{
  const bad = (args, want) => {
    let msg = null;
    try { parseArgs(args); } catch (e) { msg = e instanceof OperatorError ? e.message : `wrong error type: ${e.constructor.name}`; }
    check(`parseArgs refuses ${JSON.stringify(args.join(" "))}`, msg !== null && msg.includes(want), msg || "it was ACCEPTED");
  };
  bad(["--nope"], "unknown option");
  // A flag whose value is missing must never swallow the next flag (.claude/rules/lanes.md).
  bad(["--driver", "--budget", "inr=1"], "--driver needs a value");
  bad(["--budget", "inr=1"], "--driver is required");
  bad(["--driver", "mock"], "--budget is required");
  bad(["--driver", "mock", "--budget", "inr"], "unparseable budget segment");
  // `rupees=1` and `inrr=10` both PARSE -- the grammar is `[a-z]+=N` -- and then bound nothing at
  // all. This probe expected a refusal, got an acceptance, and that is why parseArgs now checks
  // the dimensions as well as the grammar.
  bad(["--driver", "mock", "--budget", "rupees=1"], "no dimension");
  bad(["--driver", "mock", "--budget", "inrr=10"], "no dimension");
  // These two were "refused rather than ignored" at Phase 00, when neither flag did anything yet.
  // Phase 02 gave `--propose` its job and Phase 03 gave `--champion` its own (the drift guard), so
  // the contract they are held to moved with them: `--champion` alone is now VALID, and
  // `--propose` alone is refused for a SHARPER reason -- there is no proposal without an
  // incumbent, because every gate past the first is a comparison.
  bad(["--driver", "mock", "--budget", "inr=1", "--propose"], "needs --champion");
  check("--champion alone is now the drift guard, not a refusal",
    parseArgs(["--driver", "mock", "--budget", "inr=1", "--champion", "x"]).champion === "x");

  const ok = parseArgs(["--driver", "mock", "--model", "m", "--budget", "inr=10,min=5", "--dry-run"]);
  check("a well-formed command parses", ok.driver === "mock" && ok.model === "m" && ok.dryRun === true);

  const r = bench(["--driver", "nosuch", "--budget", "inr=1"], { ARC_SPINE_ROOT: spineFor("flags") });
  // DERIVED, NOT HARDCODED. This pinned the literal string
  // `installed: claude-code, codex, generic-api, mock`, so it went red the moment engine added a
  // fifth driver (`hermes`, Cycle 7) -- for a change that was correct. The test was not wrong to
  // fail: it was the only thing that noticed the installed set had moved. But an exact-list pin
  // makes every future driver a red build in a suite that owns none of them, and the property
  // actually worth asserting is that the message lists the drivers that ARE on disk -- which is
  // stronger than any fixed string, because it also catches a message that goes stale.
  //
  // knownDrivers() is arc-bench's own resolver, so the expectation cannot drift from the source.
  const installed = knownDrivers(ROOT).join(", ");
  check("an unknown driver is exit 2 and names the installed set",
    r.status === EXIT.OPERATOR && r.stderr.includes(`installed: ${installed}`),
    `expected the message to list "${installed}"; stderr was: ${String(r.stderr).trim().slice(0, 200)}`);
}

// ---- 6. --dry-run invokes nothing and emits nothing -------------------------------------------
{
  const spine = spineFor("dry");
  const r = bench(["--driver", "mock", "--budget", "inr=10", "--dry-run"], { ARC_SPINE_ROOT: spine });
  check("--dry-run exits 0", r.status === EXIT.OK, `status ${r.status}`);
  check("--dry-run says it invoked nothing", /nothing was invoked and no receipt was emitted/.test(r.stdout));
  check("--dry-run wrote NO event at all", eventsOn(spine).length === 0);
}

rmSync(scratch, { recursive: true, force: true });

if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nall checks held");
