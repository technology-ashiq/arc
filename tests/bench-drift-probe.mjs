#!/usr/bin/env node
/**
 * Probe for the drift guard (Phase 03): two split comparability axes, cost-delta classification,
 * three alert tiers, muted classes, and the anti-goalpost clause.
 *
 * Its own file rather than inline `node -e`: the assertions carry apostrophes, backticks and `$`.
 *
 * MOSTLY PURE, DELIBERATELY. Every tier, every axis and every cost cause is exercised against
 * synthetic rows, because each needs a differently-broken pair and spawning a run per case would
 * be a dozen full runs to test a dozen branches. The live half is deliberately small -- two
 * fixtures, K=3, admitted by a narrow test ceiling -- and it proves the two things no synthetic
 * object can: that a CLEAN guard run leaves no approval on the spine, and that a drifting one
 * creates exactly one with gate `drift`.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DRIFT, EXIT, MIN_FIXTURES,
  classifyCostDelta, comparability, driftAlerts, repinCauses,
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

const scratch = mkdtempSync(join(tmpdir(), "bench-drift-"));
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

/** A side of the comparison that is fully comparable and fully clean, so a test can break one thing. */
const side = (over = {}) => ({
  task_class: "commit-msg-draft",
  declared: 6,
  eval_pack_revision: "1.0.0",
  process_version: "1.0.0",
  driver_version: "mock@aaaaaaaaaaaa",
  model_id: null,
  request_settings: null,
  assertions: { passed: 90, total: 90, rate: 1 },
  schema: { passed: 15, evaluated: 15, rate: 1 },
  fixtures: [],
  cost_inr: 100,
  cost_source: "measured",
  tokens_total: 1000,
  p95_ms: 500,
  ...over,
});

// ---- 1. the two axes fail INDEPENDENTLY -------------------------------------------------------
{
  const clean = comparability(side(), side());
  check("two identical sides are comparable on both axes", clean.quality.comparable && clean.cost.comparable);

  // A driver-version bump breaks QUALITY comparability and leaves COST untouched.
  const q = comparability(side({ driver_version: "mock@bbbbbbbbbbbb" }), side());
  check("a driver-version change breaks quality comparability only",
    q.quality.comparable === false && q.cost.comparable === true, JSON.stringify(q));
  check("and it names what differed", /driver version differs/.test(q.quality.differences[0]));

  // A missing token count breaks COST comparability and leaves QUALITY untouched. Collapsing the
  // two into one boolean is how a bookkeeping gap silently disables a real regression check.
  const c = comparability(side({ tokens_total: null }), side());
  check("an absent token count breaks cost comparability only",
    c.cost.comparable === false && c.quality.comparable === true, JSON.stringify(c));
  check("and a differing cost SOURCE also breaks it",
    comparability(side({ cost_source: "estimated" }), side()).cost.comparable === false);

  for (const [what, over] of [["eval-pack revision", { eval_pack_revision: "2.0.0" }], ["process version", { process_version: "2.0.0" }], ["model id", { model_id: "opus" }], ["request settings", { request_settings: "temp=0" }]]) {
    check(`a change of ${what} breaks quality comparability`, comparability(side(over), side()).quality.comparable === false);
  }
}

// ---- 2. every cost delta is classified into EXACTLY ONE cause ---------------------------------
{
  const axes = comparability(side(), side());

  // Same tokens, more money -> the RATE moved. A price rise must never read as a usage change.
  const rate = classifyCostDelta(side({ cost_inr: 150 }), side(), axes);
  check("identical tokens with more money is a PROVIDER-RATE change", rate.cause === "provider-rate", JSON.stringify(rate));
  check("and the delta is reported in both rupees and percent", rate.delta_inr === 50 && Math.round(rate.delta_pct) === 50);

  // More tokens at the same rate -> USAGE moved.
  const use = classifyCostDelta(side({ cost_inr: 200, tokens_total: 2000 }), side(), axes);
  check("more tokens at an unchanged per-token rate is a TOKEN-USE change", use.cause === "token-use", JSON.stringify(use));

  // Both moved -> mixed, and saying so beats picking the more convenient story.
  const mixed = classifyCostDelta(side({ cost_inr: 400, tokens_total: 2000 }), side(), axes);
  check("both moving is UNKNOWN-MIXED, not the more convenient of the two", mixed.cause === "unknown-mixed", JSON.stringify(mixed));
  check("and it says why neither alone explains it", /neither alone explains/.test(mixed.why));

  // An incomparable baseline never hides a delta: it is reported as unclassifiable.
  const bad = comparability(side({ tokens_total: null }), side());
  const hidden = classifyCostDelta(side({ tokens_total: null }), side(), bad);
  check("an incomparable baseline yields UNKNOWN-MIXED with its reason, never a silent number",
    hidden.cause === "unknown-mixed" && hidden.delta_pct === null && /not comparable/.test(hidden.why), JSON.stringify(hidden));
}

// ---- 3. the three tiers, each from its own fixture --------------------------------------------
{
  const axes = comparability(side(), side());
  const noCost = { cause: "token-use", delta_inr: 0, delta_pct: 0, why: "nothing moved" };

  // TIER 1 -- a NEW schema failure in a previously-CLEAN champion.
  const t1 = driftAlerts(side({ schema: { passed: 14, evaluated: 15, rate: 14 / 15 } }), side(), axes, noCost);
  check("tier 1 fires on a new schema failure", t1.alerts.some((a) => a.tier === 1 && a.inbox === true), JSON.stringify(t1));
  // "Previously clean" is load-bearing: a champion already failing has not started drifting today.
  const t1b = driftAlerts(side({ schema: { passed: 14, evaluated: 15, rate: 14 / 15 } }), side({ schema: { passed: 13, evaluated: 15, rate: 13 / 15 } }), axes, noCost);
  check("but not when the champion was ALREADY failing", !t1b.alerts.some((a) => a.tier === 1));

  // TIER 2 -- BOTH conditions, never either alone.
  const failing2 = [{ assertions: { rate: 0.5 } }, { assertions: { rate: 0.5 } }];
  const t2 = driftAlerts(side({ assertions: { passed: 72, total: 90, rate: 0.8 }, fixtures: failing2 }), side(), axes, noCost);
  check("tier 2 fires on a big drop across two failing fixtures", t2.alerts.some((a) => a.tier === 2 && a.inbox === true), JSON.stringify(t2));
  const oneFixture = driftAlerts(side({ assertions: { passed: 72, total: 90, rate: 0.8 }, fixtures: [{ assertions: { rate: 0.5 } }] }), side(), axes, noCost);
  check("a big drop concentrated in ONE fixture is one fixture, not drift", !oneFixture.alerts.some((a) => a.tier === 2));
  const smallDrop = driftAlerts(side({ assertions: { passed: 85, total: 90, rate: 0.95 }, fixtures: failing2 }), side(), axes, noCost);
  check(`a drop below ${DRIFT.ASSERTION_DROP_PP}pp does not fire tier 2`, !smallDrop.alerts.some((a) => a.tier === 2));

  // TIER 3 -- REPORT-ONLY. Never an inbox item, whatever the size.
  const t3 = driftAlerts(side(), side(), axes, { cause: "provider-rate", delta_inr: 500, delta_pct: 500, why: "x" });
  const three = t3.alerts.find((a) => a.tier === 3);
  check("tier 3 fires on a cost increase above the threshold", Boolean(three));
  check("and it is REPORT-ONLY even at 500 percent -- never an inbox item", three && three.inbox === false);
  const under = driftAlerts(side(), side(), axes, { cause: "provider-rate", delta_inr: 1, delta_pct: DRIFT.COST_INCREASE_PCT, why: "x" });
  check(`a rise exactly at ${DRIFT.COST_INCREASE_PCT}% does not fire`, !under.alerts.some((a) => a.tier === 3));

  // MUTED below the fixture floor, and the reason is stated. Silence that looks like "no drift"
  // is worse than no report at all.
  const muted = driftAlerts(side({ declared: 1 }), side(), axes, noCost);
  check(`a class below ${MIN_FIXTURES} fixtures is MUTED`, muted.muted === true && muted.alerts.length === 0);
  check("and the report says why it is muted", /below the floor/.test(muted.why), muted.why);

  // An incomparable quality axis suppresses the quality-based tiers rather than reporting noise.
  const incomparable = comparability(side({ driver_version: "other" }), side());
  const sup = driftAlerts(side({ assertions: { passed: 0, total: 90, rate: 0 }, fixtures: failing2 }), side(), incomparable, noCost);
  check("quality tiers do not fire across an incomparable quality axis", !sup.alerts.some((a) => a.tier === 1 || a.tier === 2));
}

// ---- 4. the anti-goalpost clause ---------------------------------------------------------------
{
  const same = comparability(side(), side());
  // A SCORE MOVEMENT ALONE NEVER RE-PINS. If it did, a champion that quietly got worse would
  // become its own new standard and the guard would report no drift forever after.
  const dropped = comparability(side({ assertions: { passed: 0, total: 90, rate: 0 } }), side());
  check("a score collapse alone does NOT license a re-pin", repinCauses(dropped, false).mayRepin === false);
  check("a quality-compatibility change DOES", repinCauses(comparability(side({ process_version: "2.0.0" }), side()), false).mayRepin === true);
  check("and names it", repinCauses(comparability(side({ process_version: "2.0.0" }), side()), false).causes[0].includes("process version"));
  check("a merged routing change DOES", repinCauses(same, true).mayRepin === true);
  check("and names that too", repinCauses(same, true).causes[0].includes("routing change"));
  check("the cause list is closed at those two", repinCauses(same, false).causes.length === 0);
}

// ---- 5. live: a clean guard leaves NO approval, a drifting one creates exactly one ------------
{
  // Two fixture groups only. The tiers are pure-tested above; what a live run has to prove is
  // what lands on the spine, and that needs two fixtures (tier 2 wants two failing) rather than
  // five. 3 x 2 x 2 runs = 12 invocations instead of 30.
  const cf = join(dir("ceilings"), "two-groups.json");
  writeFileSync(cf, JSON.stringify({
    as_of: "2026-08-13", run_cap_inr: 1000, process_cap_inr: 60, k: 3,
    worst_case_inr_per_invocation: { mock: { "(unpinned)": 10 } },
  }), "utf8");

  const spine = dir("guard-spine");
  const champ = join(scratch, "guard-champ");
  const r1 = bench(["--driver", "mock", "--budget", "inr=1000,min=15", "--out", champ], { ARC_SPINE_ROOT: spine, ARC_BENCH_CEILINGS: cf });
  check("the guard's champion run produced a bundle", existsSync(join(champ, "scorecard.json")), `status ${r1.status}`);

  // A CLEAN guard run: same recordings, so nothing drifted.
  const cleanSpine = dir("clean-spine");
  const g1 = bench(["--driver", "mock", "--budget", "inr=1000,min=15", "--out", join(scratch, "guard-clean"), "--champion", champ], { ARC_SPINE_ROOT: cleanSpine, ARC_BENCH_CEILINGS: cf });
  check("a clean guard run reports no drift", /no drift/.test(g1.stdout), g1.stdout);
  check("and states that NO approval event was created", /NO approval event was created/.test(g1.stdout));
  // ADR-0910: the spine never carries no-op approvals.
  check("a clean guard run leaves NO approval on the spine",
    eventsOn(cleanSpine).filter((e) => e.kind === "approval.requested").length === 0);
  check("but it DOES leave its run.completed",
    eventsOn(cleanSpine).some((e) => e.kind === "run.completed" && e.process === "bench@0.1.0"));
  check("the guard prints the NEXT-CHECK line rather than writing a tracker", /NEXT-CHECK:/.test(g1.stdout));
  check("and the baseline stays pinned on a clean run", /baseline stays pinned/.test(g1.stdout));

  // A DRIFTING guard run: recordings whose subjects break the conventional-commit assertions.
  const src = join(ROOT, "tests/fixtures/bench/mock-replay/commit-msg-draft");
  const driftedRoot = join(dir("recordings"), "drifted");
  const badDir = join(driftedRoot, "commit-msg-draft");
  mkdirSync(badDir, { recursive: true });
  for (const f of readdirSync(src)) {
    const doc = JSON.parse(readFileSync(join(src, f), "utf8"));
    // Still schema-valid (a non-empty subject and a 7-40 hex sha), so this is an ASSERTION
    // failure and not a schema one -- which is what separates tier 2 from tier 1.
    doc.commits[0].subject = "changed some stuff.";
    writeFileSync(join(badDir, f), JSON.stringify(doc), "utf8");
  }

  // THE GUARD REFUSES TO CALL THIS DRIFT UNLESS THE CHAMPION IS COMPARABLE, and the first draft
  // of this test learned that the hard way. The mock's version IS its recording set, so swapping
  // recordings changes `driver_version` -- and a quality axis that moved makes the comparison
  // incomparable rather than a regression. That is the guard working: the same output change is
  // "the champion drifted" or "you benched a different thing" depending on nothing but this
  // field, and calling the second one drift is how a baseline gets re-pinned on noise.
  const shifted = bench(["--driver", "mock", "--budget", "inr=1000,min=15", "--out", join(scratch, "guard-shifted"), "--champion", champ],
    { ARC_SPINE_ROOT: dir("shifted-spine"), ARC_BENCH_CEILINGS: cf, ARC_MOCK_DIR: driftedRoot });
  check("a scored drop under a CHANGED driver version is NOT reported as drift",
    /quality NOT comparable/.test(shifted.stdout) && !/TIER 2/.test(shifted.stdout), shifted.stdout);
  check("it is reported as a re-pin candidate instead, naming the component that moved",
    /baseline MAY be re-pinned: a quality-compatibility component changed: driver version differs/.test(shifted.stdout));

  // So to test the tier itself, the champion is made COMPARABLE to the drifted candidate: same
  // driver version, higher score. The doctoring is of test DATA -- a champion bundle is a file --
  // and it poses the one question the tier exists to answer: the same subject scored worse today.
  const driftedVersion = spawnSync("bash", [join(ROOT, ".claude/scripts/engine/drivers/mock.sh"), "version"], {
    encoding: "utf8", cwd: ROOT, timeout: 60000, env: { ...process.env, ARC_MOCK_DIR: driftedRoot },
  }).stdout.trim();
  check("the drifted recording set has its own driver version", /^mock@[0-9a-f]{12}$/.test(driftedVersion), driftedVersion);

  const doctored = join(scratch, "guard-champ-comparable");
  mkdirSync(doctored, { recursive: true });
  for (const f of ["scorecard.json", "provenance.json"]) writeFileSync(join(doctored, f), readFileSync(join(champ, f), "utf8"), "utf8");
  const dProv = JSON.parse(readFileSync(join(doctored, "provenance.json"), "utf8"));
  dProv.subject.driver_version = driftedVersion;
  writeFileSync(join(doctored, "provenance.json"), JSON.stringify(dProv), "utf8");

  const driftSpine = dir("drift-spine");
  const g2 = bench(["--driver", "mock", "--budget", "inr=1000,min=15", "--out", join(scratch, "guard-drift"), "--champion", doctored],
    { ARC_SPINE_ROOT: driftSpine, ARC_BENCH_CEILINGS: cf, ARC_MOCK_DIR: driftedRoot });

  check("a drifting guard run fires a tier-2 alert", /TIER 2/.test(g2.stdout), g2.stdout);
  const appr = eventsOn(driftSpine).filter((e) => e.kind === "approval.requested");
  check("and creates exactly ONE approval.requested", appr.length === 1, `saw ${appr.length}`);
  if (appr.length === 1) {
    check("whose gate is drift, not router-merge", appr[0].payload.gate === "drift");
    check("and which names the tier that fired", appr[0].payload.findings.some((f) => f.tier === 2));
  }
  check("the run receipt records the guard verdict",
    eventsOn(driftSpine).some((e) => e.kind === "run.completed" && e.process === "bench@0.1.0" && e.payload.guard && e.payload.guard.clean === false));
  const q = join(driftSpine, "events", "_quarantine");
  check("nothing was quarantined", !existsSync(q) || readdirSync(q).length === 0);
  check("a drifting run still exits non-zero only for its own reasons, not for drift",
    g2.status === EXIT.OK || g2.status === EXIT.PARTIAL, `status ${g2.status}`);
}

// ---- A CLASS THE CHAMPION BENCHED AND THIS RUN DID NOT ----------------------------------------
//
// The guard walked the CANDIDATE's classes and looked the champion up from them, so a class
// present only on the CHAMPION side was visited by nothing: no row, no line, no alert, and the
// run reported `clean` and `outcome: ok`. Survivable while class discovery returned every process
// stem in the tree; NOT survivable once it started filtering, because `processes/` is a company
// organ every live lane edits and one `job_stub:` line added upstream would delete a class from
// the guard's field of view entirely -- reporting "no drift" on a run that benched nothing.
//
// That is this lane's own recorded failure shape (a guard that reported no drift on a run where
// every attempt failed), so it is proven here rather than reasoned about. The champion bundle is
// a FILE, so the case is posed by giving the champion a class the candidate cannot have.
{
  const cf = join(dir("vanished-ceilings"), "two-groups.json");
  writeFileSync(cf, JSON.stringify({
    as_of: "2026-08-13", run_cap_inr: 1000, process_cap_inr: 60, k: 3,
    worst_case_inr_per_invocation: { mock: { "(unpinned)": 10 } },
  }), "utf8");

  const champ = join(scratch, "vanished-champ");
  const r1 = bench(["--driver", "mock", "--budget", "inr=1000,min=15", "--out", champ], { ARC_SPINE_ROOT: dir("vanished-champ-spine"), ARC_BENCH_CEILINGS: cf });
  check("the vanished-class champion run produced a bundle", existsSync(join(champ, "scorecard.json")), `status ${r1.status}`);

  // Doctoring test DATA, not code: the champion is given a row for a class this tree cannot
  // bench, which is exactly what an upstream `job_stub:` line would produce tomorrow.
  const sc = JSON.parse(readFileSync(join(champ, "scorecard.json"), "utf8"));
  const model = sc.classes.find((c) => c.eligible !== false) ?? sc.classes[0];
  check("the doctored champion starts from a real benched class", Boolean(model), JSON.stringify(sc.classes.map((c) => c.task_class)));
  sc.classes.push({ ...model, task_class: "class-that-vanished" });
  writeFileSync(join(champ, "scorecard.json"), JSON.stringify(sc), "utf8");

  const spine = dir("vanished-spine");
  const g = bench(["--driver", "mock", "--budget", "inr=1000,min=15", "--out", join(scratch, "vanished-out"), "--champion", champ], { ARC_SPINE_ROOT: spine, ARC_BENCH_CEILINGS: cf });

  check("a class the champion benched and this run did not is REPORTED, not skipped",
    /class-that-vanished: NOT BENCHED BY THIS RUN/.test(g.stdout), g.stdout);
  check("and it is stated as a finding, naming why no drift can be ruled out",
    /class-that-vanished[\s\S]*no drift can be ruled out/.test(g.stdout), g.stdout);
  // The load-bearing one: it must not read as a clean run. Before this, it did.
  check("the run does NOT report itself clean",
    !/no inbox-tier drift/.test(g.stdout) && !/NO approval event was created/.test(g.stdout), g.stdout);
  check("an approval.requested IS raised for it, because absence is never inferred from nobody looking",
    eventsOn(spine).filter((e) => e.kind === "approval.requested").length === 1,
    JSON.stringify(eventsOn(spine).map((e) => e.kind)));
  check("and the receipt records the guard as NOT clean",
    eventsOn(spine).some((e) => e.kind === "run.completed" && e.process === "bench@0.1.0" && e.payload.guard && e.payload.guard.clean === false));
}

rmSync(scratch, { recursive: true, force: true });

if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nall checks held");
