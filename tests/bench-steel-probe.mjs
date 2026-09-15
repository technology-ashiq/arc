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
 * IT ALSO PINS THE SEAM, AND THIS PART GOT ITS OWN LESSON. The sentence that used to sit here
 * promised that the env-plumbing checks below would "fail loudly the day the engine grows a
 * target-repo seam". ADR-0220 landed exactly that seam and NOTHING failed: it arrived as flags
 * (`--work-root`, `--trial-model`) while ambient inheritance stayed closed on purpose, so every
 * assertion here stayed TRUE while the conclusion it defended became FALSE. A tripwire aimed at
 * the mechanism that did not change cannot see the mechanism that did, and a true assertion is
 * not the same thing as a live one. The engine lane found it by reading this file; this file did
 * not find it. The checks now ask about the FLAGS, and the env checks remain only to assert what
 * they actually prove: that ambient inheritance is still shut.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EXIT, allProcessNames, discoverClasses, driverTakesModel, findReceipt, isJobStub, jobStubNames, knownDrivers, materializeRepoState, parseArgs, repoStatus, runBench, runnableProcessNames, OperatorError } from "../.claude/scripts/engine/arc-bench.mjs";

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
// CLEANED ON EVERY EXIT PATH, not only the happy one. The single `rmSync` at the end of the file
// is unreachable from a throw, and the sections below now call code that throws BY DESIGN
// (`driverTakesModel` refuses to answer a question it does not understand). A probe that leaks
// its tree exactly when something is already wrong fills the runner disk at the worst moment --
// and section 1's own leak check watches a different directory, so this leak was structurally
// invisible to the suite that exists to catch leaks.
process.on("exit", () => { try { rmSync(scratch, { recursive: true, force: true }); } catch { /* the disk is not the finding */ } });
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

  // THE MODEL SEAM, ASKED OF THE DRIVER RATHER THAN OF THE ENVIRONMENT (ADR-0220).
  //
  // The check that used to live here asserted "arc-run overwrites ARC_DRIVER_MODEL, so its
  // receipts read unpinned", and its comment promised it would "fail loudly the day the engine
  // grows a seam". THE SEAM ARRIVED AND IT DID NOT FAIL: ambient inheritance stayed closed on
  // purpose (it is the ADR-0069 b1 hole), so the assertion is still TRUE while the conclusion it
  // defended -- that bench cannot vary the model -- became false. A tripwire aimed at the
  // mechanism that did not change cannot see the mechanism that did. Found by the engine lane
  // reading this file, not by this file.
  //
  // So it now asks about the FLAG. `mock` is not model-capable, so this run applied none and the
  // receipt must say so in arc-run's own vocabulary -- and `--model` given here is a REQUEST that
  // was never applied, which the receipt must not blur into a model that ran.
  check("with a non-model-capable driver, nothing is applied and the receipt says so",
    runs.length > 0 && runs.every((e) => e.payload.model_source === "none"),
    runs.map((e) => e.payload.model_source).join(","));
  if (mine.length === 1) {
    check("and bench records the model as REQUESTED, never as applied",
      mine[0].payload.fingerprint.model_requested === "claude-opus-5"
      && mine[0].payload.model_applied === null
      && mine[0].payload.model_source === "none");
    check("so no model_id is written for a model that never ran",
      !("model_id" in mine[0].payload.fingerprint));
  }
}

// ---- 2. THE WORKSPACE SEAM, AND THE DOOR THAT STAYED SHUT ------------------------------------
{
  // TWO FACTS, and they are different facts. This section used to assert only the second and
  // called it "bench cannot reach a real driver" -- which stopped being true when ADR-0220 landed
  // `--work-root`, while the assertion itself stayed green.
  const spine = spineFor("workroot");

  // (a) THE DOOR IS STILL SHUT. Ambient `ARC_ROOT` is ignored BY DESIGN -- it is the ADR-0069 b1
  // hole and the seam deliberately did not reopen it. Pointed at a directory holding no
  // recordings, the run still replays the right bytes, which it could only do by resolving from
  // arc-run's own root. This assertion is unchanged; what changed is what it is allowed to mean.
  const bogus = join(scratch, "bogus-no-recordings");
  mkdirSync(bogus, { recursive: true });
  const res = spawnSync(process.execPath, [
    ARC_RUN, "--process", "commit-msg-draft", "--driver", "mock", "--input", "{}", "--budget", "inr=10", "--root", ROOT,
  ], {
    encoding: "utf8", cwd: ROOT, timeout: 120000, killSignal: "SIGKILL",
    env: { ...process.env, ARC_SPINE_ROOT: spine, ARC_MOCK_FIXTURE: "docs-only", ARC_ROOT: bogus },
  });
  check("ambient ARC_ROOT is still ignored -- inheritance stays closed (ADR-0069 b1)",
    res.status === 0, `status ${res.status}: ${String(res.stderr).trim().split("\n").pop()}`);
  check("and the right recording was still replayed",
    /document what total does with non-array input/.test(res.stdout || ""));

  // (b) THE FLAG IS THE DOOR THAT OPENS, and it is guarded. A work-root inside arc is REFUSED,
  // because git walks upward from cwd and `commit-msg-draft` holds `add:*` and `commit:*` -- so
  // an unguarded seam would commit into arc. This is the assertion the old one should have been.
  const inside = spawnSync(process.execPath, [
    ARC_RUN, "--process", "commit-msg-draft", "--driver", "mock", "--input", "{}", "--budget", "inr=10",
    "--root", ROOT, "--work-root", ROOT,
  ], { encoding: "utf8", cwd: ROOT, timeout: 120000, killSignal: "SIGKILL", env: { ...process.env, ARC_SPINE_ROOT: spineFor("workroot-inside") } });
  check("a --work-root pointing INTO arc is refused, not silently accepted",
    inside.status === 2 && /commit into arc/.test(inside.stderr || ""), `status ${inside.status}`);

  // (c) AND A REAL FIXTURE REPO IS ACCEPTED. Not a grep of bench's source -- a grep is not a
  // running proof, which is this repo's own rule about guards. The harness materializes a repo
  // exactly as a run does, and arc-run either accepts it as the toplevel of its own repository or
  // refuses it. Paired with (b), that is an accept AND a refuse, so a seam that accepted
  // everything could not pass both.
  const posed = materializeRepoState(join(ROOT, "tests/fixtures/engine/evals/commit-msg-draft/repo-states/docs-only"));
  try {
    const good = spawnSync(process.execPath, [
      ARC_RUN, "--process", "commit-msg-draft", "--driver", "mock", "--input", "{}", "--budget", "inr=10",
      "--root", ROOT, "--work-root", posed.root,
    ], {
      encoding: "utf8", cwd: ROOT, timeout: 120000, killSignal: "SIGKILL",
      env: { ...process.env, ARC_SPINE_ROOT: spineFor("workroot-good"), ARC_MOCK_FIXTURE: "docs-only" },
    });
    check("a materialized fixture repo IS accepted as --work-root",
      good.status === 0, `status ${good.status}: ${String(good.stderr).trim().split("\n").pop()}`);
    // The harness leaves the change UNSTAGED and the driver is a replay that touches no git, so
    // the repo must come back exactly as posed. A run that had worked in the wrong directory
    // would leave this one clean.
    check("and the fixture repo still holds the posed, unstaged change afterwards",
      repoStatus(posed.root).length > 0, JSON.stringify(repoStatus(posed.root)));
  } finally {
    posed.cleanup();
  }

  // (d) --trial-model is REFUSED on a driver that cannot apply one. A receipt naming a model the
  // driver never used would be a fabrication, and for a replay sweep the model identity IS the
  // recording set.
  const trial = spawnSync(process.execPath, [
    ARC_RUN, "--process", "commit-msg-draft", "--driver", "mock", "--trial-model", "claude-opus-5",
    "--dry-run", "--root", ROOT,
  ], { encoding: "utf8", cwd: ROOT, timeout: 120000, killSignal: "SIGKILL" });
  check("--trial-model is refused on mock, naming the recording set instead",
    trial.status === 2 && /ARC_MOCK_DIR/.test(trial.stderr || ""), `status ${trial.status}`);
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
  // `installed: claude-code, codex, generic-api, mock` and went red the moment engine added a
  // fifth driver (`hermes`, Cycle 7) -- for a change that was correct. The test was not wrong to
  // fail: it was the only thing that noticed the installed set had moved. But an exact-list pin
  // makes every future driver a red build in a suite that owns none of them, and the property
  // worth asserting is that the message lists the drivers that ARE on disk -- stronger than any
  // fixed string, because it also catches a message that has gone stale.
  //
  // RE-APPLIED AT A MERGE. This landed in engine's bd16093 and the concurrent bench branch was
  // cut before it, so the merge brought the literal back. It is not a revert and nobody undid
  // anything -- it is what a shared test file does when two lanes touch it in the same window.
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

// ---- 7. THE CAPABILITY PROBE, AND THE POSITIVE CONTROL THAT WAS NEVER HERE --------------------
//
// SECTION 1 ABOVE HAS FOUR CHECKS ON THE MODEL SEAM AND EVERY ONE OF THEM DRIVES `mock`, whose
// correct answer is "nothing applied". So the suite could tell that a non-capable driver applies
// no model, and could not tell that a CAPABLE one applies anything at all. Nothing anywhere
// asserted the true half.
//
// That gap had a two-day cost. `driverTakesModel` picked the alphabetically first process in
// `processes/` to probe with; the scheduler lane added `brief-materialize`, a job stub, which
// sorts first; arc-run refuses stubs before it ever reaches its model check; and the probe read
// any non-zero exit as "this driver cannot carry a model". Bench then dropped the model on EVERY
// run and reported `applied NONE (source: none)` -- while `PROGRESS.md` said "bench is wired to
// both flags" and the whole suite stayed green, because every assertion it owned expected NONE.
//
// This is the same shape as the tripwire recorded in section 1, one cycle later: an assertion
// that is TRUE about a mechanism nobody changed, defending a conclusion that has quietly become
// false. The fix that generalises is not another `mock` check. It is a control that goes RED when
// the capability answer flips, whatever flipped it.
{
  // A THROW BECOMES A READABLE FAIL, NOT A DEAD PROBE. (a) and (b) called the probe bare, so on
  // 2026-09-01, when the real tree's first vehicle expired, (a) threw and took every later check in
  // this file with it: 90 red test instances saying "the probe did not finish" instead of one
  // saying which answer was wrong.
  const probeOrThrown = (root, driver, model = "haiku") => {
    try { return driverTakesModel(root, driver, model); } catch (e) { return e; }
  };
  const said = (r) => (r instanceof Error ? `threw: ${String(r.message).split("\n")[0]}` : `returned ${r}`);

  // (a) THE POSITIVE CONTROL. This is the assertion that was missing, and it is the one that
  // would have failed the day the stub landed. It asks the REAL tree on purpose: it is the control
  // that goes red when production's capability answer flips, whatever flipped it.
  const realCapable = probeOrThrown(ROOT, "claude-code");
  check("a model-capable driver is REPORTED as capable", realCapable === true, said(realCapable));

  // (b) The negative control, which only means something now that (a) exists beside it. Alone it
  // passed for two days while the answer was "not capable" for every driver on earth.
  const realNotCapable = probeOrThrown(ROOT, "mock");
  check("and a driver that cannot carry a model is reported as not capable", realNotCapable === false, said(realNotCapable));

  // (c) THE REAL MODEL ID IS WHAT GETS PROBED. The first fix sent a fixed `capability-probe`
  // string, so arc-run validated the placeholder's grammar and bench then used the OPERATOR's id
  // for every invocation -- "validate one read, compare another", and this one had a price: an
  // id arc-run would reject dies on every attempt AFTER admission control reserved the group.
  let threwBadId = null;
  try { driverTakesModel(ROOT, "claude-code", "claude sonnet 4"); } catch (e) { threwBadId = e; }
  check("a model id arc-run would REJECT is caught by the probe, before any group is reserved",
    threwBadId instanceof OperatorError, threwBadId === null ? "the probe accepted it" : `threw ${threwBadId?.constructor?.name}`);

  // (d) AN UNRECOGNISED ANSWER IS LOUD. The old probe returned `false` for every failure it did
  // not understand -- and `false` is not "I do not know", it is a confident claim about the
  // driver, in the direction that silently weakens the run. An unknown driver is a refusal that
  // has nothing to do with model capability, so it must reach the operator rather than be filed
  // as one.
  let threw = null;
  try { driverTakesModel(ROOT, "no-such-driver-anywhere", "haiku"); } catch (e) { threw = e; }
  check("an unrecognised probe answer THROWS rather than answering the question it was not asked",
    threw instanceof OperatorError, threw === null ? "it returned instead of throwing" : `threw ${threw?.constructor?.name}`);
  check("and the thrown message quotes what arc-run actually said, so the cause is readable",
    threw !== null && /no usable answer/.test(threw.message) && /arc-run said:/.test(threw.message),
    String(threw?.message).slice(0, 200));

  // (e) A TREE WITH NOTHING RUNNABLE IN IT also throws. The old code returned `false` here too.
  const stubOnly = join(scratch, "stub-only-tree");
  mkdirSync(join(stubOnly, "processes"), { recursive: true });
  writeFileSync(join(stubOnly, "processes", "only-a-stub.process.yaml"), "name: only-a-stub\nversion: 1.0.0\njob_stub: true\n", "utf8");
  check("a tree whose processes are ALL job stubs has nothing to probe with, and says so",
    runnableProcessNames(stubOnly).length === 0 && jobStubNames(stubOnly).length === 1);
  let threwStub = null;
  try { driverTakesModel(stubOnly, "claude-code", "haiku"); } catch (e) { threwStub = e; }
  check("and probing it throws rather than reporting the driver not capable",
    threwStub instanceof OperatorError && /is a scheduled-job stub/.test(threwStub.message),
    String(threwStub?.message).slice(0, 200));

  // (f) AN EMPTY DIRECTORY IS A DIFFERENT FACT FROM A DIRECTORY OF STUBS, and the message may not
  // merge them: pointing the reader at a stub theory when there are no files sends them looking
  // for something that is not there.
  const emptyTree = join(scratch, "empty-tree");
  mkdirSync(join(emptyTree, "processes"), { recursive: true });
  let threwEmpty = null;
  try { driverTakesModel(emptyTree, "claude-code", "haiku"); } catch (e) { threwEmpty = e; }
  check("an EMPTY processes directory says so, and is not blamed on stubs",
    threwEmpty instanceof OperatorError && /no process files at all/.test(threwEmpty.message),
    String(threwEmpty?.message).slice(0, 200));

  // (g) Keyed on PRESENCE, so the frozen YAML subset parsing `yes` / `True` / `"true"` as STRINGS
  // and `1` as a number cannot walk past. Only `false` reads as runnable HERE -- see isJobStub's
  // comment for why that spelling means something different to arc-compile and process-lint.
  const spellings = join(scratch, "stub-spellings");
  mkdirSync(join(spellings, "processes"), { recursive: true });
  for (const [file, value] of [["yes-stub", "yes"], ["true-stub", "True"], ["quoted-stub", '"true"'], ["one-stub", "1"], ["zero-stub", "0"], ["not-stub", "false"]]) {
    writeFileSync(join(spellings, "processes", `${file}.process.yaml`), `name: ${file}\nversion: 1.0.0\njob_stub: ${value}\n`, "utf8");
  }
  check("every truthy spelling of job_stub is a stub, and only false is runnable",
    runnableProcessNames(spellings).join(",") === "not-stub",
    `runnable: ${runnableProcessNames(spellings).join(",")}`);
  check("and the spelling fixture actually posed all six cases, so the check is not empty",
    allProcessNames(spellings).length === 6, `posed ${allProcessNames(spellings).length}`);

  // (h) A RUN THAT BENCHED NOTHING IS NOT A CLEAN RUN. `partial` was set only inside the fixture
  // loop, so a tree with no benchable class never reached any of its arms: zero rows, exit 0,
  // `outcome: ok` on the receipt -- a run certifying that nothing is wrong having measured
  // nothing. Latent while discovery returned every stem in the tree; live the moment it started
  // filtering, because one `job_stub:` line added to `commit-msg-draft` by another lane empties
  // this list. Posed against `runBench` directly: the tree is synthetic, so the fixture loop is
  // never entered and no driver is invoked.
  const emptyRun = join(scratch, "no-benchable-class");
  mkdirSync(join(emptyRun, "processes"), { recursive: true });
  writeFileSync(join(emptyRun, "processes", "only-a-stub.process.yaml"), "name: only-a-stub\nversion: 1.0.0\njob_stub: true\n", "utf8");
  mkdirSync(join(emptyRun, "engine"), { recursive: true });
  cpSync(join(ROOT, "engine/router.yaml"), join(emptyRun, "engine/router.yaml"));
  mkdirSync(join(emptyRun, "initiatives/bench"), { recursive: true });
  cpSync(join(ROOT, "initiatives/bench/ceilings.json"), join(emptyRun, "initiatives/bench/ceilings.json"));
  cpSync(join(ROOT, ".claude/scripts/engine"), join(emptyRun, ".claude/scripts/engine"), { recursive: true });
  const nothing = runBench(emptyRun, { driver: "mock", budget: "inr=10" });
  check("a run with no benchable task class does NOT report outcome ok",
    nothing.outcome === "partial", `outcome ${nothing.outcome}`);
  check("and it SAYS what happened rather than printing an empty report",
    /no benchable task class exists/.test(String(nothing.no_class_reason)), String(nothing.no_class_reason));
  check("and the stub it skipped is named in the report, not silently dropped",
    nothing.job_stubs_skipped.join(",") === "only-a-stub" && nothing.scorecard.classes.length === 0,
    JSON.stringify(nothing.job_stubs_skipped));

  // (i) A VEHICLE REFUSED BY TENURE IS SKIPPED, AND ITS REFUSAL IS NEVER THE DRIVER'S ANSWER.
  //
  // THE STUB DEFECT AGAIN, ONE REFUSAL LATER, AND IT KEPT MAIN RED FOR TWO WEEKS. On 2026-09-01 the
  // hermes row behind `build-in-public-draft` passed its review_by. That class is the first runnable
  // process in the real tree, so arc-run refused the probe by tenure, the probe had no arm for that,
  // and check (a) above THREW instead of answering -- on every OS, with no commit behind it. Every
  // bench run naming a model on a model-capable driver died the same way.
  //
  // POSED WITH A FIXED PAST DATE, never with the live row. The CI red was a calendar accident, so
  // it cannot be the regression. 2000-01-01 is past on every clock this suite will ever run on, and
  // the tree is otherwise arc's own machinery, so arc-run -- the one reader of tenure -- decides.
  const lapsedTree = (name, processes) => {
    const t = join(scratch, name);
    cpSync(join(ROOT, ".claude/scripts"), join(t, ".claude/scripts"), { recursive: true });
    mkdirSync(join(t, "processes"), { recursive: true });
    for (const p of processes) cpSync(join(ROOT, "processes", `${p}.process.yaml`), join(t, "processes", `${p}.process.yaml`));
    mkdirSync(join(t, "engine"), { recursive: true });
    writeFileSync(join(t, "engine", "router.yaml"), [
      "version: 1", "tiers:", "  - balanced-workhorse", "classes:",
      "  build-in-public-draft:", "    tier: balanced-workhorse", "    driver: hermes", "    cap: L1-drafts",
      "    hosted: cloud", "    judge: fixture", "    review_by: 2000-01-01", "    fallback: []",
      "default:", "  tier: balanced-workhorse", "  driver: claude-code", "  fallback: []", "",
    ].join("\n"), "utf8");
    return t;
  };
  const askArcRun = (root, proc) => spawnSync(process.execPath, [
    join(root, ".claude/scripts/engine/arc-run.mjs"), "--process", proc, "--driver", "claude-code",
    "--trial-model", "haiku", "--dry-run", "--root", root,
  ], { encoding: "utf8", cwd: root, timeout: 60000, killSignal: "SIGKILL" });

  const skipTree = lapsedTree("tenure-skip", ["build-in-public-draft", "commit-msg-draft"]);
  // THE FIXTURE MUST POSE THE CASE, and that is asked of arc-run, not assumed from the YAML: the
  // first vehicle is refused by tenure and the second is not, or the two checks after these prove
  // nothing at all.
  const first = askArcRun(skipTree, "build-in-public-draft");
  check("the tenure fixture's FIRST runnable vehicle is refused by tenure, as arc-run itself reports",
    runnableProcessNames(skipTree)[0] === "build-in-public-draft" && first.status === 1
      && /its route EXPIRED on 2000-01-01/.test(first.stdout ?? ""),
    `runnable ${runnableProcessNames(skipTree).join(",")}; status ${first.status}: ${String(first.stdout).slice(0, 160)}`);
  const second = askArcRun(skipTree, "commit-msg-draft");
  check("and its SECOND runnable vehicle is not refused",
    second.status === 0 && /\(source: trial\)/.test(second.stdout ?? ""),
    `status ${second.status}: ${String(second.stdout).slice(0, 160)}`);

  const capable = probeOrThrown(skipTree, "claude-code");
  check("a capable driver is still REPORTED capable when the first vehicle's route has expired",
    capable === true, said(capable));
  // No `mock` twin of this check. arc-run answers a driver that cannot carry a model at its
  // capability arm, BEFORE tenure, so on this tree `mock` never reaches the skip at all -- the
  // first attack pass measured it, and a check that runs no new line is a count, not a guard.
  // Case (i.4) of the scripted set below poses "not capable AFTER a skip" for real.

  // When EVERY vehicle has lapsed, the fault is the router's, and the operator fixes it in a
  // reviewed diff -- so it has to be named as that, not as a driver that gave "no usable answer".
  const none = probeOrThrown(lapsedTree("tenure-all", ["build-in-public-draft"]), "claude-code");
  check("a tree whose EVERY runnable vehicle has expired throws, naming the expired row as the cause",
    none instanceof OperatorError && /no vehicle left/.test(none.message)
      && /build-in-public-draft \(review_by 2000-01-01\)/.test(none.message),
    none instanceof Error ? String(none.message).slice(0, 240) : `returned ${none}`);

  // THE SCRIPTED arc-run. The real one only ever produces the orderings its router allows, and the
  // first attack pass wrote four WRONG probes that passed every check above: one that computed
  // expiry from the router itself, one that probed only the last vehicle, one that matched the
  // refusal anywhere, one that skipped on any non-answer. `driverTakesModel` spawns
  // `<root>/.claude/scripts/engine/arc-run.mjs`, so a tree can carry its own. This one answers each
  // process from a table, byte for byte, and reads nothing else -- which is exactly what lets a
  // check tell "bench asked arc-run" apart from "bench worked it out for itself".
  const FAKE_ARC_RUN = [
    'import { readFileSync } from "node:fs";',
    'import { join } from "node:path";',
    "const argv = process.argv.slice(2);",
    "const flag = (f) => argv[argv.indexOf(f) + 1];",
    'const table = JSON.parse(readFileSync(join(flag("--root"), "fake-arc-run.json"), "utf8"));',
    'const row = table[flag("--process")] || { status: 3, stdout: "", stderr: "fake arc-run: no script for this process\\n" };',
    'process.stdout.write(row.stdout || "");',
    'process.stderr.write(row.stderr || "");',
    "process.exitCode = row.status;",
    "",
  ].join("\n");
  const fakeTree = (name, table, router = null) => {
    const t = join(scratch, name);
    mkdirSync(join(t, ".claude/scripts/engine"), { recursive: true });
    mkdirSync(join(t, "processes"), { recursive: true });
    writeFileSync(join(t, ".claude/scripts/engine/arc-run.mjs"), FAKE_ARC_RUN, "utf8");
    for (const p of Object.keys(table)) writeFileSync(join(t, "processes", `${p}.process.yaml`), `name: ${p}\nversion: 1.0.0\n`, "utf8");
    writeFileSync(join(t, "fake-arc-run.json"), JSON.stringify(table), "utf8");
    if (router) {
      mkdirSync(join(t, "engine"), { recursive: true });
      writeFileSync(join(t, "engine", "router.yaml"), router, "utf8");
    }
    return t;
  };
  const EXPIRED = (p) => ({ status: 1, stderr: "",
    stdout: `arc-run: would REFUSE \`${p}\` — its route EXPIRED on 2000-01-01 (today is 2000-01-02).\n         Re-justify \`classes.${p}\` in engine/router.yaml with a new review_by, or retire the row.\n` });
  const APPLIES = (model) => ({ status: 0, stderr: "",
    stdout: `arc-run: would run \`x\` on \`claude-code\`\n         model ${model} (source: trial)\n         driver workspace x\n` });
  const CANNOT = (driver) => ({ status: 2, stdout: "",
    stderr: `arc-run: driver \`${driver}\` cannot apply a model, so --trial-model would be recorded but never used\n` });

  // The script is only worth anything if it speaks arc-run's actual sentence. Pinned against the
  // refusal the REAL arc-run printed above, minus the one field that is today's date.
  const realLine = String(first.stdout ?? "").split("\n")[0].replace(/\(today is [^)]*\)/, "");
  const fakeLine = EXPIRED("build-in-public-draft").stdout.split("\n")[0].replace(/\(today is [^)]*\)/, "");
  check("the scripted tenure refusal is byte-for-byte the sentence arc-run itself prints",
    realLine.length > 0 && realLine === fakeLine, `real ${JSON.stringify(realLine)} vs scripted ${JSON.stringify(fakeLine)}`);

  // (i.1) ONE READER. The router in this tree calls v1's route live until 2999; arc-run refuses it
  // anyway. A probe that believed the file would stop at v1 with no recognised answer.
  const liveOnPaper = ["version: 1", "tiers:", "  - balanced-workhorse", "classes:", "  v1:",
    "    tier: balanced-workhorse", "    driver: hermes", "    cap: L1-drafts", "    hosted: cloud",
    "    judge: fixture", "    review_by: 2999-01-01", "    fallback: []", ""].join("\n");
  const oneReader = probeOrThrown(fakeTree("fake-one-reader", { v1: EXPIRED("v1"), v2: APPLIES("haiku") }, liveOnPaper), "claude-code");
  check("tenure comes from ARC-RUN'S answer, never the router file: a row the file calls live but arc-run refuses is skipped",
    oneReader === true, said(oneReader));

  // (i.2) THE WHOLE LIST, IN ORDER. A probe fixed on one position -- first or last -- fails one of these.
  const liveThenLapsed = probeOrThrown(fakeTree("fake-live-then-lapsed", { v1: APPLIES("haiku"), v2: EXPIRED("v2") }), "claude-code");
  const twoLapsedThenLive = probeOrThrown(fakeTree("fake-two-lapsed", { v1: EXPIRED("v1"), v2: EXPIRED("v2"), v3: APPLIES("haiku") }), "claude-code");
  check("the probe walks every vehicle in order: [live, expired] and [expired, expired, live] both answer capable",
    liveThenLapsed === true && twoLapsedThenLive === true, `[live,expired] ${said(liveThenLapsed)}; [expired,expired,live] ${said(twoLapsedThenLive)}`);

  // (i.3) EVERY NAME, not the last one seen.
  const allGone = probeOrThrown(fakeTree("fake-all-lapsed", { v1: EXPIRED("v1"), v2: EXPIRED("v2") }), "claude-code");
  check("when every vehicle has expired, the refusal names EVERY expired row",
    allGone instanceof OperatorError && /no vehicle left/.test(allGone.message)
      && /v1 \(review_by 2000-01-01\)/.test(allGone.message) && /v2 \(review_by 2000-01-01\)/.test(allGone.message),
    allGone instanceof Error ? String(allGone.message).slice(0, 240) : said(allGone));

  // (i.4) NOT CAPABLE, AFTER A SKIP. The real arc-run cannot pose this; the script can.
  const lateNo = probeOrThrown(fakeTree("fake-skip-then-no", { v1: EXPIRED("v1"), v2: CANNOT("claude-code") }), "claude-code");
  check("a driver answer that comes AFTER a skipped vehicle is still the answer, not capable included",
    lateNo === false, said(lateNo));

  // (i.5) EVERYTHING ELSE IS LOUD. Each case is a near-miss of an answer; each must throw "no usable
  // answer" rather than skip or answer. The last two are the old unanchored arms: a trial line
  // for a model nobody asked for, and an operator error that merely ECHOES "cannot apply a model".
  const nearMisses = {
    "a tenure refusal about ANOTHER class": { v1: EXPIRED("other"), v2: APPLIES("haiku") },
    "the refusal on stderr": { v1: { status: 1, stdout: "", stderr: EXPIRED("v1").stdout }, v2: APPLIES("haiku") },
    "the refusal mid-line": { v1: { ...EXPIRED("v1"), stdout: `note: ${EXPIRED("v1").stdout}` }, v2: APPLIES("haiku") },
    "the refusal under exit 2": { v1: { ...EXPIRED("v1"), status: 2 }, v2: APPLIES("haiku") },
    "a DIFFERENT refusal of the vehicle": { v1: { status: 1, stderr: "", stdout: "arc-run: would REFUSE `v1` — the input for v1 does not declare itself external-ok\n" }, v2: APPLIES("haiku") },
    "a trial line for a model nobody asked for": { v1: APPLIES("some-other-model") },
    "an operator error that echoes the words": { v1: { status: 2, stdout: "", stderr: 'arc-run: --trial-model "cannot apply a model" is not a clean model id\n' } },
  };
  const quiet = [];
  let posed = 0;
  for (const [label, table] of Object.entries(nearMisses)) {
    posed += 1;
    const r = probeOrThrown(fakeTree(`fake-near-miss-${posed}`, table), "claude-code");
    if (!(r instanceof OperatorError && /no usable answer/.test(r.message))) quiet.push(`${label}: ${said(r)}`);
  }
  check("every near-miss of an answer is LOUD: no skip, no true, no false",
    posed === 7 && quiet.length === 0, `posed ${posed}; not loud: ${quiet.join(" | ") || "none"}`);

  // (i.6) THE DISPATCH PATH'S TWIN, found by the same attack pass. The probe learned about tenure and
  // `runBench` did not: an eligible class past its review_by was admitted group by group, every
  // attempt was refused, and the run committed money for invocations that reached no provider.
  // Posed with arc-run's own machinery and a fixed past date, so arc-run decides and the calendar
  // does not.
  const benchTree = join(scratch, "tenure-bench");
  mkdirSync(join(benchTree, "engine"), { recursive: true });
  mkdirSync(join(benchTree, "processes"), { recursive: true });
  mkdirSync(join(benchTree, "initiatives/bench"), { recursive: true });
  cpSync(join(ROOT, ".claude/scripts"), join(benchTree, ".claude/scripts"), { recursive: true });
  cpSync(join(ROOT, "processes/commit-msg-draft.process.yaml"), join(benchTree, "processes/commit-msg-draft.process.yaml"));
  // The WHOLE eval and bench fixture directories, as bench-seal-probe copies them: arc-run
  // validates every declared eval path, so a tree missing one fails for the wrong reason.
  cpSync(join(ROOT, "tests/fixtures/engine/evals"), join(benchTree, "tests/fixtures/engine/evals"), { recursive: true });
  cpSync(join(ROOT, "tests/fixtures/bench"), join(benchTree, "tests/fixtures/bench"), { recursive: true });
  writeFileSync(join(benchTree, "initiatives/bench/ceilings.json"), JSON.stringify({
    as_of: "2026-08-13", run_cap_inr: 1000, process_cap_inr: 1000, k: 3,
    worst_case_inr_per_invocation: { mock: { "(unpinned)": 10 } },
  }), "utf8");
  writeFileSync(join(benchTree, "engine/router.yaml"), ["version: 1", "tiers:", "  - balanced-workhorse", "classes:",
    "  commit-msg-draft:", "    tier: balanced-workhorse", "    driver: mock", "    cap: L1-drafts", "    hosted: local",
    "    judge: fixture", "    review_by: 2000-01-01", "    fallback: []",
    "default:", "  tier: balanced-workhorse", "  driver: claude-code", "  fallback: []", ""].join("\n"), "utf8");
  const benchSpine = spineFor("tenure-bench-run");
  const heldSpine = process.env.ARC_SPINE_ROOT;
  process.env.ARC_SPINE_ROOT = benchSpine;
  let lapsedRun;
  try { lapsedRun = runBench(benchTree, { driver: "mock", budget: "inr=500" }); }
  catch (e) { lapsedRun = e; }
  finally { if (heldSpine === undefined) delete process.env.ARC_SPINE_ROOT; else process.env.ARC_SPINE_ROOT = heldSpine; }
  const lapsedClass = lapsedRun instanceof Error ? null : lapsedRun.scorecard.classes.find((c) => c.task_class === "commit-msg-draft");
  check("an ELIGIBLE class whose route has expired is not benched: no group admitted, nothing committed",
    lapsedClass?.eligible === true && lapsedClass.selected === 0
      && lapsedRun.provenance.budget.committed_inr === 0 && lapsedRun.provenance.budget.reconciliations.length === 0,
    lapsedRun instanceof Error ? said(lapsedRun)
      : `eligible ${lapsedClass?.eligible}, selected ${lapsedClass?.selected}, committed ${lapsedRun.provenance.budget.committed_inr}, groups ${lapsedRun.provenance.budget.reconciliations.length}`);
  check("and every one of its fixtures is NAMED as refused by tenure, with the date, so the run is partial and proposes nothing",
    lapsedClass !== null && lapsedClass !== undefined && lapsedClass.declared >= 5
      && lapsedClass.unselected.length === lapsedClass.declared
      && lapsedClass.unselected.every((u) => u.reason.startsWith("failure: tenure") && u.reason.includes("2000-01-01"))
      && lapsedRun.outcome === "partial" && lapsedClass.proposal === "NO PROPOSAL - partial run",
    lapsedClass ? JSON.stringify({ declared: lapsedClass.declared, unselected: lapsedClass.unselected.map((u) => u.reason.slice(0, 40)), outcome: lapsedRun.outcome, proposal: lapsedClass.proposal }).slice(0, 300) : said(lapsedRun));
  check("and nothing was dispatched for it: the run left no receipt on the spine",
    eventsOn(benchSpine).length === 0, `${eventsOn(benchSpine).length} event(s) on the spine`);
}

// ---- 8. BENCH AND ARC-RUN AGREE ON WHAT A JOB STUB IS -----------------------------------------
//
// `isJobStub` is a SECOND COPY of arc-run's rule, and this repo has been burned by second copies
// that drift. The copy is not trusted -- it is pinned: for every process in the tree, bench's
// verdict is compared against arc-run's actual behaviour when pointed at that process. A
// divergence is a red suite here, not a wrong number in a scorecard six months from now.
{
  const askArcRun = (root, name) => {
    const res = spawnSync(process.execPath, [
      ARC_RUN, "--process", name, "--driver", "mock", "--trial-model", "agreement-probe", "--dry-run", "--root", root,
    ], { encoding: "utf8", cwd: ROOT, timeout: 60000, killSignal: "SIGKILL" });
    // arc-run refuses a stub at its own guard, by name, before driver selection.
    return /is a scheduled-job stub/.test(`${res.stdout ?? ""}${res.stderr ?? ""}`);
  };

  // (a) THE REAL TREE. Whatever it happens to hold on the day -- bench does not own `processes/`
  // and must not assert what is in it.
  const disagreed = [];
  let compared = 0;
  for (const name of allProcessNames(ROOT)) {
    compared += 1;
    const mine = isJobStub(ROOT, name);
    const theirs = askArcRun(ROOT, name);
    if (mine !== theirs) disagreed.push(`${name}: bench=${mine} arc-run=${theirs}`);
  }
  // A RAN-ASSERTION, because `disagreed.length === 0` is also satisfied by zero iterations. If
  // the directory is ever renamed or the extension changes, this section would otherwise pass
  // green having compared nothing at all -- the shape .claude/rules/testing.md calls the
  // vacuous pass.
  check("the agreement loop actually compared the tree, rather than iterating nothing",
    compared >= 3, `it compared ${compared} process(es)`);
  check("bench's job-stub verdict matches arc-run's for EVERY process in the tree",
    disagreed.length === 0, disagreed.join(" | "));

  // (b) THE SPELLINGS ARC-RUN IS NEVER ASKED ABOUT ON THE REAL TREE. It carries exactly two
  // shapes -- `job_stub: true` and no key at all -- so agreeing on it proves agreement for two
  // of the nine spellings the presence-keying exists for. These are POSED, in a tree this probe
  // builds, so the pin does not depend on another lane's files carrying interesting values.
  const agree = join(scratch, "agreement-spellings");
  mkdirSync(join(agree, "processes"), { recursive: true });
  const posed = [["yes-stub", "yes"], ["true-stub", "True"], ["quoted-stub", '"true"'], ["one-stub", "1"], ["zero-stub", "0"], ["plain-stub", "true"], ["not-stub", "false"]];
  for (const [file, value] of posed) {
    writeFileSync(join(agree, "processes", `${file}.process.yaml`),
      `name: ${file}\nversion: 1.0.0\nintent: "posed spelling"\npermissions: declared\ninputs: []\njob_stub: ${value}\n`, "utf8");
  }
  const spellingDisagreed = [];
  for (const [file] of posed) {
    const mine = isJobStub(agree, file);
    const theirs = askArcRun(agree, file);
    if (mine !== theirs) spellingDisagreed.push(`${file}: bench=${mine} arc-run=${theirs}`);
  }
  check("and it matches on every truthy spelling too, not only the two the tree happens to carry",
    spellingDisagreed.length === 0 && posed.length === 7, spellingDisagreed.join(" | "));

  // (c) NO STUB IS BENCHED -- stated WITHOUT requiring that any stub exist. The stubs belong to
  // the scheduler lane; asserting their presence would turn a rename or a widened policy-subject
  // set in THAT lane into a red suite in this one. `processes/` is a company organ, and the rule
  // is to name the line that must hold, never the group that must be there.
  const benched = discoverClasses(ROOT).map((c) => c.taskClass);
  const stubs = jobStubNames(ROOT);
  check("no job stub is offered as a benchable task class",
    stubs.every((s) => !benched.includes(s)) && benched.length > 0,
    `stubs ${stubs.join(",") || "(none)"} vs benched ${benched.join(",")}`);
  check("and the same holds on a POSED tree, so the rule is proven even if the real tree has no stub",
    discoverClasses(agree).map((c) => c.taskClass).join(",") === "not-stub",
    discoverClasses(agree).map((c) => c.taskClass).join(","));

  // (d) The report NAMES what it skipped. Only meaningful while the tree HAS a stub, so it is
  // guarded rather than silently vacuous -- and the guard is reported either way.
  const r = bench(["--driver", "mock", "--budget", "inr=10", "--dry-run"], { ARC_SPINE_ROOT: spineFor("stub-report") });
  // Escaped: a stem is not grammar-checked anywhere, so a future stub named with a `.` or a `+`
  // would over-match or throw at RegExp construction.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  check(stubs.length ? "the report NAMES the stubs it did not bench" : "there is no stub in the tree today, so there is nothing for the report to name",
    stubs.length === 0 || stubs.every((s) => new RegExp(`not benched[^\\n]*${esc(s)}`).test(r.stdout)),
    r.stdout.split("\n").slice(-3).join(" / "));
}

rmSync(scratch, { recursive: true, force: true });

if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nall checks held");
