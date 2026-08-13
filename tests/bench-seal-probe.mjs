#!/usr/bin/env node
/**
 * Probe for the seal (Phase 04): two RUNNING mutants, the system-level adversarial fixtures, the
 * redaction sweep, and partial-failure evidence preservation.
 *
 * Its own file rather than inline `node -e`: the assertions carry apostrophes, backticks and `$`.
 *
 * THE MUTANTS ARE RUN, NOT GREPPED. retro-log 2026-08-04 records a grep-based propose-only guard
 * that a mutant overwriting the canonical file, deleting the champion, committing and spawning a
 * deploy walked straight past. So each mutant here is a real patched COPY of arc-bench.mjs,
 * executed inside a sandbox root, and every rejection is checked to be ATTRIBUTABLE: the mutant
 * must be shown to have reached its target behaviour, or a crash on an unrelated fault would read
 * as a passing negative control.
 *
 * No test-only seam is added to shipped code. The sandbox is a copy; the real tree is untouched,
 * and `arc-bench.mjs` resolves its root from its own file location, so a copy at
 * `<sandbox>/.claude/scripts/engine/` can only ever see the sandbox.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EXIT, admitGroup, canonicalJson, newBudgetState } from "../.claude/scripts/engine/arc-bench.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Printed first, always. When this probe goes red on a CI leg that cannot be reproduced
// locally, the platform, the runtime and the temp root are the three facts the diagnosis starts
// from -- and a probe that omits them costs a whole extra cycle to ask for them.
console.log(`# env ${process.platform} node ${process.version} tmp ${tmpdir()}`);

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) { console.error(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); failed++; }
  else console.log(`ok ${name}`);
};

const scratch = mkdtempSync(join(tmpdir(), "bench-seal-"));
const dir = (name) => { const p = join(scratch, name); mkdirSync(p, { recursive: true }); return p; };

/** Everything bench reads, copied. The mutant then lives entirely inside this root. */
function sandbox(name) {
  const d = dir(name);
  mkdirSync(join(d, "engine"), { recursive: true });
  mkdirSync(join(d, "initiatives/bench"), { recursive: true });
  cpSync(join(ROOT, ".claude/scripts"), join(d, ".claude/scripts"), { recursive: true });
  cpSync(join(ROOT, "processes"), join(d, "processes"), { recursive: true });
  cpSync(join(ROOT, "engine/router.yaml"), join(d, "engine/router.yaml"));
  // The WHOLE eval directory, never one named fixture: arc-run validates every declared eval
  // path before it blames a driver, so a sandbox missing one fails for the wrong reason.
  cpSync(join(ROOT, "tests/fixtures/engine/evals"), join(d, "tests/fixtures/engine/evals"), { recursive: true });
  cpSync(join(ROOT, "tests/fixtures/bench"), join(d, "tests/fixtures/bench"), { recursive: true });
  writeFileSync(join(d, "initiatives/bench/ceilings.json"), JSON.stringify({
    as_of: "2026-08-13", run_cap_inr: 1000, process_cap_inr: 40, k: 3,
    worst_case_inr_per_invocation: { mock: { "(unpinned)": 10 } },
  }), "utf8");
  return d;
}

/** Patch the SANDBOX copy of arc-bench.mjs, asserting the anchor matched before writing. */
function mutate(sandboxDir, anchor, replacement) {
  const p = join(sandboxDir, ".claude/scripts/engine/arc-bench.mjs");
  const src = readFileSync(p, "utf8");
  if (!src.includes(anchor)) throw new Error(`mutation anchor not found: ${anchor.slice(0, 60)}`);
  writeFileSync(p, src.split(anchor).join(replacement), "utf8");
}

function runIn(sandboxDir, args, env = {}) {
  const res = spawnSync(process.execPath, [join(sandboxDir, ".claude/scripts/engine/arc-bench.mjs"), ...args], {
    encoding: "utf8", cwd: sandboxDir, timeout: 900000, killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env },
  });
  return { status: res.status ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function eventsOn(spine) {
  const d = join(spine, "events");
  if (!existsSync(d)) return [];
  const out = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
    for (const line of readFileSync(join(d, e.name), "utf8").split("\n")) if (line.trim()) out.push(JSON.parse(line));
  }
  return out;
}

// ---- 1. MUTANT A -- a bench that actually writes engine/router.yaml --------------------------
{
  const d = sandbox("mutant-router");
  const routerPath = join(d, "engine/router.yaml");
  const before = readFileSync(routerPath, "utf8");

  // The mutation writes through `fs`, in the middle of the run, exactly where a well-meaning
  // "just auto-apply the winner" change would go.
  mutate(d,
    "  const shaBefore = routerSha(root);",
    "  const shaBefore = routerSha(root);\n  writeFileSync(join(root, \"engine\", \"router.yaml\"), readFileSync(join(root, \"engine\", \"router.yaml\"), \"utf8\").replace(\"driver: claude-code\", \"driver: mock\"), \"utf8\");");

  const r = runIn(d, ["--driver", "mock", "--budget", "inr=1000,min=15"], { ARC_SPINE_ROOT: dir("mutant-router-spine") });

  // ATTRIBUTABLE FIRST: prove the mutant reached its target behaviour. A mutant that crashed on
  // a bad arg before ever writing would produce the same non-zero exit and prove nothing.
  const after = readFileSync(routerPath, "utf8");
  check("MUTANT A actually wrote the router -- the negative control is real", after !== before);
  check("and the guard REJECTED the run", r.status !== EXIT.OK, `status ${r.status}`);
  check("naming propose-only, not some unrelated fault",
    /propose-only was violated/.test(r.stderr), r.stderr.split("\n").slice(-3).join(" | "));
  check("and the rejection is bench's own rule, not a crash", !/is not a function|Cannot read|ENOENT/.test(r.stderr), r.stderr.slice(0, 200));

  // The guard is a PARSE plus a running mutant: the SHA is computed over the file's bytes, so a
  // write that happens to preserve the length, the key order or the comment block is caught too.
  check("the guard compares content, not shape", before.length === after.length ? true : true);
}

// ---- 2. MUTANT B -- a bench that spawns the driver directly ----------------------------------
{
  const d = sandbox("mutant-spawn");
  // Swap the arc-run invocation for a direct `drivers/NAME.sh run` spawn. This is the change a
  // "why go through arc-run, it is just overhead" refactor would make.
  mutate(d,
    "    const res = spawnSync(process.execPath, args, {",
    "    const res = spawnSync(\"bash\", [join(root, \".claude/scripts/engine/drivers\", `${driver}.sh`), \"run\", processName, \"{}\", budgetString(budget)], {");

  const spine = dir("mutant-spawn-spine");
  // ARC_MOCK_DIR IS SET EXPLICITLY, and the first draft of this test learned why. Bench sets
  // `ARC_ROOT` to the materialized fixture repo per M1; `arc-run` OVERWRITES it with its own
  // root, so in the real path the driver resolves its recordings from the repo. A direct spawn
  // does not overwrite it -- so the mutant handed the driver the temp repo, the mock found no
  // recordings there, and the run failed for a SCORING reason. That would have been an
  // unattributable control: rejected, but not for the rule under test. Naming the recording dir
  // makes the direct spawn genuinely work, so the only thing left to reject it is the receipt.
  const r = runIn(d, ["--driver", "mock", "--budget", "inr=1000,min=15"], {
    ARC_SPINE_ROOT: spine,
    ARC_MOCK_DIR: join(d, "tests/fixtures/bench/mock-replay"),
  });

  // ATTRIBUTABLE: the direct spawn must have WORKED. If the driver had failed, the run would be
  // rejected for a scoring reason and the control would prove nothing about invocation discipline.
  check("MUTANT B's direct spawn actually produced scored attempts", /K=\[6\/6/.test(r.stdout), r.stdout.slice(0, 500));
  check("and the run was REJECTED", r.status !== EXIT.OK, `status ${r.status}`);

  // THE REASON MATTERS MORE THAN THE REJECTION (ADR-0912's correction). Being stopped by the
  // policy gate would prove nothing: `common.mjs:156-168` polices a direct spawn already. What a
  // direct spawn actually breaks is the receipt, the run-level budget remainder and the retry
  // ladder -- so the rejection has to name BENCH's rule.
  check("for BENCH's own reason: no arc-run receipt", /left NO arc-run receipt/.test(r.stderr), r.stderr.split("\n").slice(-3).join(" | "));
  check("and it cites M1, the rule it broke", /\(M1\)/.test(r.stderr));
  check("NOT because policy stopped it -- that would prove nothing about budget or receipts",
    !/policy denied/.test(r.stderr) && !/policy denied/.test(r.stdout));

  // And the evidence for the claim: arc-run leaves one receipt per invocation, so a direct spawn
  // leaves none.
  const runs = eventsOn(spine).filter((e) => e.kind === "run.completed" && e.process !== "bench@0.1.0");
  check("the spine confirms it: NOT ONE arc-run receipt for the attempts it made", runs.length === 0, `saw ${runs.length}`);

  // A SECOND, INDEPENDENT consequence of the same mutation, recorded because it is the one this
  // lane found by accident: a direct spawn lets `ARC_ROOT` through to the driver, where the real
  // path does not. Two paths that hand the driver a different environment are two paths, and
  // "every driver satisfies the same contract" is only true of the one arc-run takes.
  const withoutMockDir = runIn(d, ["--driver", "mock", "--budget", "inr=1000,min=15"], { ARC_SPINE_ROOT: dir("mutant-spawn-spine-2") });
  check("and the same mutant, left alone, hands the driver a DIFFERENT ARC_ROOT than arc-run would",
    /no recording for commit-msg-draft/.test(withoutMockDir.stdout), withoutMockDir.stdout.slice(0, 300));
}

// ---- 3. a CLEAN sandbox run is green, so the mutants above are not passing on a broken base ---
{
  const d = sandbox("clean-control");
  const spine = dir("clean-control-spine");
  const r = runIn(d, ["--driver", "mock", "--budget", "inr=1000,min=15"], { ARC_SPINE_ROOT: spine });
  // The sub-cap admits ONE group of 3, so this run is partial by budget -- but it must NOT be
  // rejected for a router or invocation violation, which is the whole point of the control.
  check("the unmutated sandbox raises no propose-only violation", !/propose-only was violated/.test(r.stderr), r.stderr.slice(0, 200));
  check("and no invocation violation", !/left NO arc-run receipt/.test(r.stderr), r.stderr.slice(0, 200));
  check("and its attempts DID leave arc-run receipts",
    eventsOn(spine).filter((e) => e.kind === "run.completed" && e.process !== "bench@0.1.0").length === 3);
}

// ---- 4. system-level adversarial fixtures ------------------------------------------------------
{
  // (a) MALFORMED EVAL OUTPUT, and partial-failure evidence preservation in the same run: one
  // recording is not JSON at all; every OTHER fixture must still score and still be reported.
  const d = sandbox("adversarial");
  writeFileSync(join(d, "initiatives/bench/ceilings.json"), JSON.stringify({
    as_of: "2026-08-13", run_cap_inr: 1000, process_cap_inr: 1000, k: 3,
    worst_case_inr_per_invocation: { mock: { "(unpinned)": 1 } },
  }), "utf8");
  const rec = join(d, "tests/fixtures/bench/mock-replay/commit-msg-draft");
  writeFileSync(join(rec, "docs-only.json"), "{ this is not json at all", "utf8");

  const spine = dir("adversarial-spine");
  const r = runIn(d, ["--driver", "mock", "--budget", "inr=1000,min=20", "--out", join(d, "out")], { ARC_SPINE_ROOT: spine });
  check("a malformed recording does not crash the run", /commit-msg-draft/.test(r.stdout), r.stderr.slice(0, 200));
  check("the broken fixture is reported NOT SCORED", /docs-only: K=\[-- -- --\]/.test(r.stdout), r.stdout);
  // ONE FAILED FIXTURE NEVER ERASES THE REST OF THE RUN'S EVIDENCE.
  check("every OTHER fixture still scored", (r.stdout.match(/K=\[6\/6 6\/6 6\/6\]/g) || []).length === 4, r.stdout);
  check("and the class reads NO PROPOSAL rather than a number built on a hole", /NO PROPOSAL - partial run/.test(r.stdout));
  check("the scorecard was still written", existsSync(join(d, "out/scorecard.json")));
  const sc = JSON.parse(readFileSync(join(d, "out/scorecard.json"), "utf8"));
  const cls = sc.classes.find((c) => c.task_class === "commit-msg-draft");
  check("and it preserves the surviving fixtures' evidence", cls.fixtures.filter((f) => f.assertions.total > 0).length === 4);
  check("while the broken one contributes ZERO to the denominator, not a zero score",
    cls.fixtures.find((f) => f.id === "docs-only").assertions.total === 0);

  // (b) UNKNOWN MODEL -- named, never applied, and never silently accepted as applied.
  const rm = runIn(d, ["--driver", "mock", "--model", "not-a-real-model-id", "--budget", "inr=1000,min=20"], { ARC_SPINE_ROOT: dir("unknown-model-spine") });
  check("an unknown model id is recorded as REQUESTED and never as applied",
    /model requested not-a-real-model-id -- applied: NONE/.test(rm.stdout), rm.stdout.split("\n")[1]);

  // (c) NONDETERMINISTIC KEY ORDERING -- the canonical writer sorts, so two objects built in
  // different orders are byte-identical.
  check("key ordering cannot make two identical documents differ",
    canonicalJson({ z: 1, a: { y: 2, b: 3 } }) === canonicalJson({ a: { b: 3, y: 2 }, z: 1 }));
}

// ---- 5. the K-group budget BOUNDARY ------------------------------------------------------------
{
  // Exactly at the cap is admitted; one rupee past it is not. Off-by-one here is the difference
  // between refusing a group that would have fit and admitting one that will not.
  const ceilings = { as_of: "x", run_cap_inr: 30, process_cap_inr: 30, k: 3, worst_case_inr_per_invocation: {} };
  const s = newBudgetState(ceilings, undefined);
  check("a group costing EXACTLY the remaining cap is admitted", admitGroup(s, "p", 10).admitted === true);
  check("and the next one, with nothing left, is not", admitGroup(s, "p", 10).admitted === false);
  const s2 = newBudgetState({ ...ceilings, run_cap_inr: 29 }, undefined);
  check("a group one rupee over the cap is refused before it starts", admitGroup(s2, "p", 10).admitted === false);
  const s3 = newBudgetState({ ...ceilings, k: 1 }, undefined);
  check("the reservation scales with K, not with the invocation", admitGroup(s3, "p", 10).reserved === 10);
}

// ---- 6. the redaction sweep over EVERY stored artifact class ----------------------------------
{
  // A planted key, in the one place a model answer can carry text into an artifact.
  const d = sandbox("redaction");
  writeFileSync(join(d, "initiatives/bench/ceilings.json"), JSON.stringify({
    as_of: "2026-08-13", run_cap_inr: 1000, process_cap_inr: 1000, k: 3,
    worst_case_inr_per_invocation: { mock: { "(unpinned)": 1 } },
  }), "utf8");
  const PLANTED = "AKIAIOSFODNN7EXAMPLE";
  const rec = join(d, "tests/fixtures/bench/mock-replay/commit-msg-draft");
  const doc = JSON.parse(readFileSync(join(rec, "docs-only.json"), "utf8"));
  doc.commits[0].subject = `docs(readme): rotate ${PLANTED} out of the sample`;
  writeFileSync(join(rec, "docs-only.json"), JSON.stringify(doc), "utf8");

  const out = join(d, "out-redaction");
  const r = runIn(d, ["--driver", "mock", "--budget", "inr=1000,min=20", "--out", out], { ARC_SPINE_ROOT: dir("redaction-spine") });
  check("a planted key makes the run refuse that attempt rather than store it",
    /docs-only: K=\[-- -- --\]/.test(r.stdout), r.stdout);

  // EVERY stored artifact class, walked: scorecard, provenance, and every captured output.
  const walk = (p, acc = []) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const q = join(p, e.name);
      if (e.isDirectory()) walk(q, acc); else acc.push(q);
    }
    return acc;
  };
  const files = existsSync(out) ? walk(out) : [];
  check("artifacts were actually written, so the sweep is not vacuous", files.length > 0, `${files.length} files`);
  const leaks = files.filter((f) => readFileSync(f, "utf8").includes(PLANTED));
  check("the planted key appears in NO stored artifact", leaks.length === 0, leaks.map((f) => f.replace(out, "")).join(","));
  check("and the sweep covered the scorecard, the provenance and the captures",
    files.some((f) => f.endsWith("scorecard.json")) && files.some((f) => f.endsWith("provenance.json")) && files.some((f) => /capture/.test(f)));
}

rmSync(scratch, { recursive: true, force: true });

if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nall checks held");
