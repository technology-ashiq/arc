#!/usr/bin/env node
/**
 * Probe for bench core (Phase 01): the canonical encoder, K-group admission control, post-call
 * reconciliation, and the replay proof.
 *
 * Its own file rather than inline `node -e`: the assertions carry apostrophes, backticks and `$`,
 * all three of which CLAUDE.md forbids in a program embedded in a shell string.
 *
 * COST DISCIPLINE. Exactly ONE full K=3 run happens here (15 arc-run invocations) and everything
 * downstream -- replay, stale-format, key-order normalization, the ceiling-leak control -- reuses
 * its bundle. The admission cases refuse BEFORE invoking anything, so they cost nothing at all.
 * A probe that spawned a run per property would not survive a Windows shard.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXIT, EncodeError, NORMALIZER_VERSION, OperatorError,
  admitGroup, canonicalHash, canonicalJson, canonicalString,
  discoverClasses, medianWithSpread, newBudgetState, parseArgs, reconcileGroup, worstCaseFor,
} from "../.claude/scripts/engine/arc-bench.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BENCH = join(ROOT, ".claude/scripts/engine/arc-bench.mjs");

// Printed first, always. When this probe goes red on a CI leg that cannot be reproduced
// locally, the platform, the runtime and the temp root are the three facts the diagnosis starts
// from -- and a probe that omits them costs a whole extra cycle to ask for them.
console.log(`# env ${process.platform} node ${process.version} tmp ${tmpdir()}`);

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) { console.error(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); failed++; }
  else console.log(`ok ${name}`);
};
const refuses = (name, fn, want) => {
  let msg = null;
  try { fn(); } catch (e) { msg = e instanceof EncodeError || e instanceof OperatorError ? e.message : `wrong error type ${e.constructor.name}: ${e.message}`; }
  check(name, msg !== null && msg.includes(want), msg || "it was ACCEPTED");
};

const scratch = mkdtempSync(join(tmpdir(), "bench-core-"));
const dir = (name) => { const p = join(scratch, name); mkdirSync(p, { recursive: true }); return p; };

function bench(args, env = {}) {
  const res = spawnSync(process.execPath, [BENCH, ...args], {
    encoding: "utf8", cwd: ROOT, timeout: 900000, killSignal: "SIGKILL",
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

/** A ceilings file with whatever caps a case needs. The shipped one is never edited by a test. */
function ceilingsFile(name, body) {
  const p = join(dir("ceilings"), `${name}.json`);
  writeFileSync(p, JSON.stringify(body), "utf8");
  return p;
}

/** A recording set that mirrors the repo's, optionally declaring a cost per invocation. */
function recordingsWithCost(name, inr) {
  const src = join(ROOT, "tests/fixtures/bench/mock-replay/commit-msg-draft");
  const dst = join(dir("recordings"), name, "commit-msg-draft");
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(src)) {
    const doc = JSON.parse(readFileSync(join(src, f), "utf8"));
    // `manual` is the honest label for a hand-authored figure, and it is one of the spine's
    // closed set (measured|estimated|manual). Anything outside that set is quarantined -- in HOOK
    // mode, at exit 0 -- which is how a costed run can report success having recorded nothing.
    if (inr !== null) doc.__cost = { inr, source: "manual" };
    writeFileSync(join(dst, f), JSON.stringify(doc), "utf8");
  }
  return join(dir("recordings"), name);
}

// ---- 1. the canonical encoder (ADR-0913) -----------------------------------------------------
{
  // TOTAL means it refuses rather than coerces. Every one of these is a value JSON.stringify
  // silently mangles into a document that hashes like a different one.
  refuses("the encoder refuses NaN rather than folding it to null", () => canonicalString({ a: NaN }), "NaN is refused");
  refuses("the encoder refuses Infinity", () => canonicalString({ a: Infinity }), "Infinity is refused");
  refuses("the encoder refuses -Infinity", () => canonicalString({ a: -Infinity }), "-Infinity is refused");
  refuses("the encoder refuses undefined", () => canonicalString({ a: undefined }), "undefined is refused");
  refuses("the encoder refuses BigInt", () => canonicalString({ a: 1n }), "BigInt is refused");
  refuses("the encoder refuses a cycle", () => { const o = { a: 1 }; o.self = o; return canonicalString(o); }, "cycle");
  refuses("canonicalJson refuses exactly what the hasher refuses", () => canonicalJson({ a: NaN }), "NaN is refused");

  // TYPE-TAGGED means these cannot collide. Under JSON.stringify the first pair already differs,
  // but the string pair below does not once you drop the quoting, which is the collision a naive
  // concatenating encoder ships with.
  check("a number and its string do not encode alike", canonicalString({ a: 1 }) !== canonicalString({ a: "1" }));
  check("length prefixes stop a string from impersonating a structure",
    canonicalString({ a: "b", c: "d" }) !== canonicalString({ a: "b,c:d" }));
  check("0 and -0 are different documents", canonicalString(0) !== canonicalString(-0));
  check("true and the string true differ", canonicalString(true) !== canonicalString("true"));
  check("an empty array and an empty object differ", canonicalString([]) !== canonicalString({}));

  // A value repeated as a SIBLING is not a cycle. A plain never-cleared seen-set would refuse it.
  const shared = { x: 1 };
  check("a value repeated as a sibling is not a cycle", canonicalString([shared, shared]).length > 0);

  // Key ORDER is what makes the scorecard byte-identical rather than merely equal.
  check("key insertion order does not change the encoding",
    canonicalString({ b: 1, a: 2 }) === canonicalString({ a: 2, b: 1 }));
  check("key insertion order does not change the JSON bytes either",
    canonicalJson({ b: 1, a: 2 }) === canonicalJson({ a: 2, b: 1 }));
  check("canonicalJson ends in exactly one newline and uses no CR",
    canonicalJson({ a: 1 }).endsWith("}\n") && !canonicalJson({ a: 1 }).includes("\r"));
  check("the hash is stable across insertion order", canonicalHash({ b: 1, a: 2 }) === canonicalHash({ a: 2, b: 1 }));
  check("the hash separates two genuinely different documents", canonicalHash({ a: 1 }) !== canonicalHash({ a: 2 }));
}

// ---- 1b. A PROCESS THAT SHIPS NO EVAL PACK IS ZERO FIXTURES, NOT A CRASH ----------------------
{
  // `declaredFixtureCount` threw on an absent `evals:` while every process in the tree happened
  // to declare one. Then the scheduler lane merged, bringing processes that ship no eval pack at
  // all, and bench could not run on the merged tree AT ALL -- every class, including the armed
  // one, was lost to a startup error about a different class entirely.
  //
  // A class with no fixtures is exactly what the coverage gate already has a sentence for.
  // Refusing to start is a far worse answer than reporting the zero.
  // AND THIS CHECK WENT VACUOUS ON 2026-08-17, WHICH IS ITS OWN LESSON.
  //
  // It read `discoverClasses(ROOT).filter(c => c.count === 0)` and asserted `.every(...)` over the
  // result. The only zero-fixture classes in the tree were the two scheduler job stubs -- so when
  // `discoverClasses` correctly stopped returning stubs, the filter went empty, `[].every()` is
  // `true`, and the check kept printing `ok` while measuring nothing. The guard that caught the
  // last cross-lane regression was silently disarmed by the next one, and no string in any bats
  // file was watching this line.
  //
  // So the subject is now BUILT rather than borrowed from whatever the shared `processes/`
  // directory happens to contain. A test whose subject is another lane's file is a test that lane
  // can delete.
  const covered = discoverClasses(ROOT);
  check("discovery survives a process that declares no evals at all", covered.length > 0);

  const noEvalTree = mkdtempSync(join(tmpdir(), "bench-core-noevals-"));
  try {
    mkdirSync(join(noEvalTree, "processes"), { recursive: true });
    writeFileSync(join(noEvalTree, "processes", "declares-nothing.process.yaml"),
      "name: declares-nothing\nversion: 1.0.0\nintent: \"a process that ships no eval pack at all\"\npermissions: declared\ninputs: []\n", "utf8");
    const zero = discoverClasses(noEvalTree);
    check("a process declaring no evals is DISCOVERED, not a startup crash", zero.length === 1, JSON.stringify(zero));
    check("and reports zero fixtures rather than throwing",
      zero.length === 1 && zero[0].count === 0 && zero[0].eligible === false && /0 of 5 fixtures/.test(zero[0].reason),
      JSON.stringify(zero));
  } finally {
    rmSync(noEvalTree, { recursive: true, force: true });
  }
  // The armed class is still found on the same tree -- otherwise "survives" would just mean
  // "returned something".
  check("and the armed class is still discovered beside them",
    covered.some((c) => c.taskClass === "commit-msg-draft" && c.eligible === true));
}

// ---- 2. admission control and reconciliation, as pure functions -------------------------------
{
  const ceilings = { as_of: "x", run_cap_inr: 100, process_cap_inr: 60, k: 3, worst_case_inr_per_invocation: { mock: { "(unpinned)": 10 } } };
  check("a declared pair resolves its worst case", worstCaseFor(ceilings, "mock", null) === 10);
  check("an undeclared pair resolves to null, never a default", worstCaseFor(ceilings, "claude-code", null) === null);

  const s = newBudgetState(ceilings, undefined);
  check("a missing ceiling REFUSES the group", admitGroup(s, "p", null).admitted === false);
  check("and the refusal says a missing ceiling is not a default",
    admitGroup(s, "p", null).reason.includes("never a default"));

  // K x worst case, against BOTH caps. 3 x 10 = 30; the process cap of 60 allows exactly two.
  const a1 = admitGroup(s, "p", 10);
  const a2 = admitGroup(s, "p", 10);
  const a3 = admitGroup(s, "p", 10);
  check("two K-groups fit the process sub-cap", a1.admitted && a2.admitted);
  check("the third is refused by the SUB-cap, not the run cap", a3.admitted === false && a3.reason.includes("sub-cap"));
  check("a refused group commits nothing", s.runCommitted === 60);
  check("the reservation is K x worst case, not one invocation", a1.reserved === 30);

  // Post-call reconciliation, including the overrun.
  const s2 = newBudgetState(ceilings, undefined);
  const seat = admitGroup(s2, "p", 10);
  check("an ABSENT measurement leaves the reservation standing", reconcileGroup(s2, "p", seat.reserved, null).applied === false);
  check("and the committed total is unchanged by it", s2.runCommitted === 30);
  const rec = reconcileGroup(s2, "p", seat.reserved, 65);
  check("a measured overrun corrects the remainder upward", rec.applied === true && s2.runCommitted === 65, `committed ${s2.runCommitted}`);
  check("and an overrun past the sub-cap marks the run exhausted", s2.exhausted === true);

  // A CLI ceiling may only tighten.
  check("a CLI budget below the file cap tightens it", newBudgetState(ceilings, 40).runCap === 40);
  check("a CLI budget above the file cap does NOT raise it", newBudgetState(ceilings, 9000).runCap === 100);
}

// ---- 3. K is never collapsed ------------------------------------------------------------------
{
  const two = medianWithSpread([1, 1, 0]);
  const one = medianWithSpread([1, 0, 0]);
  check("a 2-of-3 and a 1-of-3 do not report the same median", two.median !== one.median, `${two.median} vs ${one.median}`);
  check("the spread travels with the median", two.min === 0 && two.max === 1 && two.n === 3);
  check("an empty sample reports ABSENT, never 0", medianWithSpread([]).median === null);
  check("nulls are excluded from the sample rather than counted as zero", medianWithSpread([null, 1]).n === 1);
}

// ---- 4. a group that cannot be covered NEVER STARTS -------------------------------------------
{
  const spine = dir("nostart-spine");
  const cf = ceilingsFile("too-expensive", {
    as_of: "2026-08-13", run_cap_inr: 20, process_cap_inr: 20, k: 3,
    worst_case_inr_per_invocation: { mock: { "(unpinned)": 10 } },
  });
  const r = bench(["--driver", "mock", "--budget", "inr=500,min=10"], { ARC_SPINE_ROOT: spine, ARC_BENCH_CEILINGS: cf });
  check("a run whose groups cannot be covered exits 1", r.status === EXIT.PARTIAL, `status ${r.status}`);
  check("every fixture is refused with failure: budget", (r.stdout.match(/failure: budget/g) || []).length === 5);
  check("and the class reads NO PROPOSAL", /NO PROPOSAL - partial run/.test(r.stdout));

  // THE PROOF THAT IT NEVER STARTED: arc-run writes a receipt per invocation, so zero of them is
  // the only evidence that nothing was spent. An assertion on the printed word "refused" would
  // pass just as well against a run that spent the money and then said so.
  const runs = eventsOn(spine).filter((e) => e.kind === "run.completed" && e.process !== "bench@0.1.0");
  check("NOT ONE arc-run invocation happened", runs.length === 0, `saw ${runs.length}`);
  // And exhaustion never reaches the fallback chain: bench names its driver explicitly, so
  // arc-run never consults the router, and no second driver can be tried.
  check("no fallback driver was invoked either",
    !eventsOn(spine).some((e) => JSON.stringify(e).includes("generic-api") || JSON.stringify(e).includes("codex")));
}

// ---- 5. a measured cost above its reservation corrects the remainder --------------------------
{
  const spine = dir("overrun-spine");
  // Reserve 3 x 10 = 30 per group against a 100 sub-cap, so THREE groups fit at reservation
  // prices. Each attempt then really costs 40, so group one measures 120 and blows the cap.
  const cf = ceilingsFile("overrun", {
    as_of: "2026-08-13", run_cap_inr: 1000, process_cap_inr: 100, k: 3,
    worst_case_inr_per_invocation: { mock: { "(unpinned)": 10 } },
  });
  const rec = recordingsWithCost("costly", 40);
  const r = bench(["--driver", "mock", "--budget", "inr=1000,min=10"], { ARC_SPINE_ROOT: spine, ARC_BENCH_CEILINGS: cf, ARC_MOCK_DIR: rec });

  const runs = eventsOn(spine).filter((e) => e.kind === "run.completed" && e.process !== "bench@0.1.0");
  // THE ASSERTION IS ON THE LATER FIXTURE'S REFUSAL. An implementation that reconciled nothing
  // would have admitted three groups off the stale reservation and invoked nine times.
  check("only the FIRST group ran before the corrected remainder refused the rest",
    runs.length === 3, `saw ${runs.length} invocations`);
  // AND IT NAMES THE CAP THAT ACTUALLY BOUND. This assertion used to require the words "the run
  // cap was exhausted", which was FALSE for its own fixture: the run cap here is 1000 and the
  // spend is 120, so what stopped the run is the PROCESS sub-cap of 100. One hardcoded sentence
  // served both branches, and this test pinned it. The consequence is not cosmetic once a real
  // pair is benched -- ceilings.json now makes the sub-cap the binding constraint on every real
  // run, so an operator told the run cap was reached would go and raise the wrong number.
  check("a later fixture is refused, and the refusal names the PROCESS sub-cap that actually bound",
    /the process sub-cap was exhausted by commit-msg-draft before this group/.test(r.stdout), r.stdout);
  check("and it does not blame the run cap, which had 880 of 1000 left",
    !/the run cap was exhausted before this group/.test(r.stdout), r.stdout);
  check("the measured cost reached bench at all", runs.some((e) => e.cost && e.cost.inr_estimate === 40),
    JSON.stringify(runs.map((e) => e.cost)));
  // AND THE BREACH IS REPORTED. A ceiling is hand-authored (ADR-0904 has no pricing snapshot), so
  // a group whose measured spend came in above its reservation is the single observation that
  // proves the guess wrong -- and it used to be absorbed in silence: admission correctly
  // re-derived off the real number and nothing anywhere said the bound had been passed.
  check("a measured spend above the reservation is REPORTED, not silently absorbed",
    /CEILING BREACHED on commit-msg-draft: reserved 30, measured 120/.test(r.stdout), r.stdout);
  check("the overrun run exits 1", r.status === EXIT.PARTIAL);

  // A costed receipt that the spine would REJECT must fail at the driver, loudly, not vanish into
  // quarantine at exit 0. This is the negative control for the defect the check above found:
  // `writeCost` never validates `source` against the spine's closed set, and `arc-run` emits
  // `run.completed` without `--strict`, so a bad source quarantined every receipt while the run
  // reported success.
  const badSpine = dir("badsource-spine");
  const badRec = recordingsWithCost("bad-source", 40);
  for (const f of readdirSync(join(badRec, "commit-msg-draft"))) {
    const p = join(badRec, "commit-msg-draft", f);
    const d = JSON.parse(readFileSync(p, "utf8"));
    d.__cost.source = "a free-text label the spine has never heard of";
    writeFileSync(p, JSON.stringify(d), "utf8");
  }
  const bad = bench(["--driver", "mock", "--budget", "inr=1000,min=10"], { ARC_SPINE_ROOT: badSpine, ARC_BENCH_CEILINGS: cf, ARC_MOCK_DIR: badRec });
  check("a recording whose cost source is outside the spine's closed set is REFUSED at the driver",
    bad.status === EXIT.PARTIAL && /NOT SCORED/.test(bad.stdout), `status ${bad.status}`);
  check("and the refusal names what would otherwise have happened",
    /the spine would quarantine this receipt/.test(bad.stdout), bad.stdout.slice(0, 300));
}

// ---- 6. the happy run, the replay proof, and the ceiling-leak control -------------------------
{
  const spine = dir("happy-spine");
  const out = join(scratch, "happy-out");
  // Deliberately odd cap numbers: they appear nowhere else, so searching an emitted payload for
  // them cannot false-positive on an unrelated 500 or 100.
  const cf = ceilingsFile("happy", {
    as_of: "2026-08-13", run_cap_inr: 7919, process_cap_inr: 3313, k: 3,
    worst_case_inr_per_invocation: { mock: { "(unpinned)": 11 } },
  });
  const r = bench(["--driver", "mock", "--model", "claude-opus-5", "--budget", "inr=7919,min=15", "--out", out],
    { ARC_SPINE_ROOT: spine, ARC_BENCH_CEILINGS: cf });

  check("a fully covered run exits 0", r.status === EXIT.OK, `status ${r.status}: ${r.stderr.trim().split("\n")[0] || ""}`);
  check("K=3 is visible per fixture on the scorecard", (r.stdout.match(/K=\[\d+\/\d+ \d+\/\d+ \d+\/\d+\]/g) || []).length === 5, r.stdout);
  check("schema pass-rate is reported SEPARATELY from assertion pass-rate",
    /assertions 90\/90 = 100\.0% · schema 15\/15 = 100\.0%/.test(r.stdout), r.stdout);
  check("the median carries its spread", /median 100\.0% spread 100\.0-100\.0%/.test(r.stdout));
  check("the router is asserted unchanged across the run", /router UNCHANGED/.test(r.stdout));

  check("a scorecard was written", existsSync(join(out, "scorecard.json")));
  check("provenance is a SEPARATE artifact from the scorecard", existsSync(join(out, "provenance.json")));
  const scorecard = JSON.parse(readFileSync(join(out, "scorecard.json"), "utf8"));
  const prov = JSON.parse(readFileSync(join(out, "provenance.json"), "utf8"));
  check("the scorecard carries its normalizer version", scorecard.normalizer_version === NORMALIZER_VERSION);
  check("the scorecard carries the eval pack revision", scorecard.eval_pack_revisions["commit-msg-draft"] === "1.0.0");
  check("the scorecard carries the process version", typeof scorecard.process_versions["commit-msg-draft"] === "string");
  // ADR-0903: siblings, never nested.
  check("subject and fingerprint are SIBLING blocks", Boolean(prov.subject) && Boolean(prov.fingerprint) && prov.fingerprint.subject === undefined && prov.subject.fingerprint === undefined);
  check("the subject names the driver and its version", prov.subject.driver === "mock" && /^mock@/.test(prov.subject.driver_version));
  check("the subject names WHICH ceiling row bounded the run", prov.subject.ceiling_key === "mock/(unpinned)");
  // Absent fields are ABSENT KEYS, never null and never "unknown".
  check("an unapplied model leaves no model_id key at all", !("model_id" in prov.fingerprint) && !("provider" in prov.fingerprint));
  check("request_settings is absent rather than a claimed temperature", !("request_settings" in prov));

  // THE CEILING NEVER ENTERS AN EMITTED PAYLOAD (ADR-0904).
  const mine = eventsOn(spine).filter((e) => e.kind === "run.completed" && e.process === "bench@0.1.0");
  check("exactly one bench receipt for the whole run", mine.length === 1, `saw ${mine.length}`);
  if (mine.length === 1) {
    const text = JSON.stringify(mine[0]);
    check("no ceiling value appears anywhere in the emitted receipt",
      !text.includes("7919") && !text.includes("3313") && !/"worst_case/.test(text), text.slice(0, 200));
    check("the receipt carries the scorecard hash rather than the scorecard",
      typeof mine[0].payload.scorecard_sha === "string" && mine[0].payload.classes.every((c) => !("fixtures" in c)));
    check("the receipt still says no model was applied", mine[0].payload.model_applied === null);
  }
  // But the ceiling IS in the local provenance artifact, which is not a claim on the ledger.
  check("the caps stay in the local provenance file", prov.budget.run_cap_inr === 7919 && prov.budget.process_cap_inr === 3313);

  // ---- replay: re-scoring the captured bytes is byte-identical ----
  const replayOut = join(scratch, "replay-out");
  const rp = bench(["--replay", join(out, "capture"), "--out", replayOut], { ARC_SPINE_ROOT: dir("replay-spine") });
  check("replay against a bundle with no stored scorecard exits 0", rp.status === EXIT.OK, `status ${rp.status}: ${rp.stderr}`);
  check("and it wrote a scorecard of its own", existsSync(join(replayOut, "scorecard.json")));
  check("REPLAY IS BYTE-IDENTICAL",
    readFileSync(join(replayOut, "scorecard.json"), "utf8") === readFileSync(join(out, "scorecard.json"), "utf8"));

  // ---- replay reports MATCH when the bundle carries its own scorecard ----
  writeFileSync(join(out, "capture", "scorecard.json"), readFileSync(join(out, "scorecard.json"), "utf8"), "utf8");
  const rp2 = bench(["--replay", join(out, "capture")], { ARC_SPINE_ROOT: dir("replay2-spine") });
  check("a bundle carrying its own scorecard reports MATCH", rp2.status === EXIT.OK && /replay MATCHES byte for byte/.test(rp2.stdout), rp2.stdout + rp2.stderr);

  // ---- key order in a captured output does not change the scorecard ----
  const one = join(out, "capture", "commit-msg-draft", "docs-only", "0.json");
  const doc = JSON.parse(readFileSync(one, "utf8"));
  const reversed = {};
  for (const k of Object.keys(doc).reverse()) reversed[k] = doc[k];
  writeFileSync(one, `${JSON.stringify(reversed)}\n`, "utf8");
  const rp3 = bench(["--replay", join(out, "capture")], { ARC_SPINE_ROOT: dir("replay3-spine") });
  check("re-ordering keys inside a captured output leaves the scorecard byte-identical",
    rp3.status === EXIT.OK && /replay MATCHES/.test(rp3.stdout), rp3.stdout + rp3.stderr);

  // ---- a normalizer bump is STALE-FORMAT, not tamper, and gets its own exit code ----
  const stored = JSON.parse(readFileSync(join(out, "capture", "scorecard.json"), "utf8"));
  stored.normalizer_version = "0.9.0";
  writeFileSync(join(out, "capture", "scorecard.json"), canonicalJson(stored), "utf8");
  const rp4 = bench(["--replay", join(out, "capture")], { ARC_SPINE_ROOT: dir("replay4-spine") });
  check("a normalizer bump reports STALE-FORMAT on its own exit code 3",
    rp4.status === EXIT.STALE && /STALE-FORMAT/.test(rp4.stderr), `status ${rp4.status}: ${rp4.stderr}`);

  // ---- a genuine tamper is a MISMATCH, and a different exit code ----
  const tampered = JSON.parse(readFileSync(join(out, "scorecard.json"), "utf8"));
  tampered.classes[0].assertions = { passed: 1, total: 90, rate: 1 / 90 };
  writeFileSync(join(out, "capture", "scorecard.json"), canonicalJson(tampered), "utf8");
  const rp5 = bench(["--replay", join(out, "capture")], { ARC_SPINE_ROOT: dir("replay5-spine") });
  check("a tampered scorecard is a MISMATCH, not stale-format",
    rp5.status === EXIT.PARTIAL && /replay MISMATCH/.test(rp5.stderr), `status ${rp5.status}: ${rp5.stderr}`);

  // ---- replay invokes nothing: no receipt, no arc-run ----
  const quietSpine = dir("replay6-spine");
  bench(["--replay", join(out, "capture")], { ARC_SPINE_ROOT: quietSpine });
  check("a replay emits NO event of any kind", eventsOn(quietSpine).length === 0);
}

// ---- 7. the flag set, after Phase 1's two additions -------------------------------------------
{
  const bad = (args, want) => {
    let msg = null;
    try { parseArgs(args); } catch (e) { msg = e instanceof OperatorError ? e.message : `wrong error type ${e.constructor.name}`; }
    check(`parseArgs refuses ${JSON.stringify(args.join(" "))}`, msg !== null && msg.includes(want), msg || "it was ACCEPTED");
  };
  bad(["--replay", "x", "--driver", "mock"], "meaningless with --replay");
  bad(["--replay", "x", "--budget", "inr=1"], "meaningless with --replay");
  // `--propose` is now checked for its own pairing before the replay branch is reached, so the
  // sentence names the missing half rather than the mode clash. Either way it is refused.
  bad(["--replay", "x", "--propose"], "needs --champion");
  bad(["--replay", "x", "--propose", "--champion", "c", "--out", "o"], "different jobs");
  bad(["--replay", ""], "EMPTY value");
  const ok = parseArgs(["--replay", "x", "--out", "y"]);
  check("replay needs neither a driver nor a budget", ok.replay === "x" && ok.out === "y");
}

rmSync(scratch, { recursive: true, force: true });

if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nall checks held");
