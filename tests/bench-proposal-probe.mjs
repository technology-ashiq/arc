#!/usr/bin/env node
/**
 * Probe for the router proposal (Phase 02): gates-first eligibility, the three artifacts, and the
 * diff bench can never apply itself.
 *
 * Its own file rather than inline `node -e`: the assertions carry apostrophes, backticks and `$`.
 *
 * A SEPARATE probe from bench-core, deliberately. Both spawn full K=3 runs, and two probes in two
 * bats files land in two shards and run CONCURRENTLY, where one file would run them back to back.
 * The shard table is being re-measured this phase anyway (M10), so the cost of a second file is
 * the measurement, not a surprise.
 *
 * THE MAJORITY OF THE GATE COVERAGE IS PURE. Every one of the six gates is exercised against
 * synthetic class rows, because each needs a differently-broken candidate and spawning a run per
 * gate would be six full runs to test six `if` statements. The live half proves the artifacts and
 * the receipt, which is the part no synthetic object can prove.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSERTION_BAND_PP, EXIT, MIN_FIXTURES, OperatorError,
  artifactModel, buildEvidenceTable, buildRouterDiff, classSpend, evaluateGates, foldSpend, moneyPair, parseArgs, receiptSpend, routerSha,
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

const scratch = mkdtempSync(join(tmpdir(), "bench-prop-"));
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

/** A class row good enough to pass every gate, so each test can break exactly one thing. */
const cls = (over = {}) => ({
  task_class: "commit-msg-draft",
  declared: 6,
  eligible: true,
  reason: null,
  selected: 5,
  unselected: [{ file: "basic.json", reason: "declares no repo_state -- the case cannot be posed" }],
  fixtures: [{ id: "a", attempts: [{ k: 0, scored: true }, { k: 1, scored: true }, { k: 2, scored: true }] }],
  assertions: { passed: 90, total: 90, rate: 1 },
  schema: { passed: 15, evaluated: 15, rate: 1 },
  cost_inr: null,
  p95_ms: 100,
  ...over,
});
const REV = { candidateRevision: "1.0.0", championRevision: "1.0.0" };

// ---- 1. every gate can independently produce a DISTINGUISHABLE NO PROPOSAL ---------------------
{
  const base = evaluateGates(cls(), cls(), REV);
  check("an all-passing candidate is eligible", base.eligible === true, JSON.stringify(base));
  check("and it records WHICH axis decided", base.decidedBy === "tie");

  // 1. completeness -- a refused fixture and an unscoreable attempt are both disqualifying, and a
  // fixture that simply cannot be posed is NOT (it was never selected).
  const g1 = evaluateGates(cls({ unselected: [{ file: "x.json", reason: "failure: budget -- the run cap was exhausted" }] }), cls(), REV);
  check("gate 1 fails on a fixture that never ran", g1.gate === "completeness" && /incomplete evidence/.test(g1.reason), g1.reason);
  const g1b = evaluateGates(cls({ fixtures: [{ id: "a", attempts: [{ k: 0, scored: false, verdict: "driver" }] }] }), cls(), REV);
  check("gate 1 fails on an attempt with no scoreable outcome", g1b.gate === "completeness" && /no scoreable outcome/.test(g1b.reason), g1b.reason);
  const g1c = evaluateGates(cls({ fixtures: [{ id: "a", attempts: [{ k: 0, scored: false, verdict: "schema" }] }] }), cls(), REV);
  // A schema failure IS an outcome: a candidate that reliably breaks the contract is information.
  check("but a SCHEMA failure is a scoreable outcome and does not fail gate 1", g1c.gate !== "completeness", g1c.reason || "eligible");

  // 2. no schema regression
  const g2 = evaluateGates(cls({ schema: { passed: 12, evaluated: 15, rate: 0.8 } }), cls(), REV);
  check("gate 2 fails on a schema regression", g2.gate === "no-schema-regression" && /schema regression/.test(g2.reason), g2.reason);
  const g2b = evaluateGates(cls({ schema: { passed: 0, evaluated: 0, rate: null } }), cls(), REV);
  check("an ABSENT schema rate is an impossible comparison, not a pass",
    g2b.gate === "no-schema-regression" && /ABSENT/.test(g2b.reason), g2b.reason);

  // 3. assertion vs champion, with the 2pp band
  const g3 = evaluateGates(cls({ assertions: { passed: 84, total: 90, rate: 0.93 } }), cls(), REV);
  check("gate 3 fails when the candidate loses by more than the band",
    g3.gate === "assertion-vs-champion" && /lost on assertions/.test(g3.reason), g3.reason);
  // EXACTLY at the edge. `1 - 0.02` is `0.98`, and `0.98 - 1` is `-0.020000000000000018` in
  // binary floating point -- strictly less than -0.02, so without an epsilon the candidate the
  // band exists to admit is rejected by representation noise. This check found that.
  const inBand = evaluateGates(cls({ assertions: { passed: 89, total: 90, rate: 1 - (ASSERTION_BAND_PP / 100) } }), cls(), REV);
  check("a candidate exactly at the band edge still passes", inBand.eligible === true, inBand.reason);
  const justOutside = evaluateGates(cls({ assertions: { passed: 88, total: 90, rate: 0.9799 } }), cls(), REV);
  check("and one just outside it does not -- the epsilon widens nothing that matters",
    justOutside.eligible === false && justOutside.gate === "assertion-vs-champion", justOutside.reason || "eligible");
  const won = evaluateGates(cls(), cls({ assertions: { passed: 80, total: 90, rate: 0.8 } }), REV);
  check("a candidate above the band is decided on QUALITY", won.eligible && won.decidedBy === "quality");
  const cheaper = evaluateGates(cls({ cost_inr: 5 }), cls({ cost_inr: 9 }), REV);
  check("a tie on quality with a lower cost is decided on COST", cheaper.eligible && cheaper.decidedBy === "cost");

  // 4. coverage -- BOTH halves, and they say different things
  const g4 = evaluateGates(cls({ declared: 1 }), cls(), REV);
  check("gate 4 fails on too few DECLARED fixtures",
    g4.gate === "coverage" && g4.reason.includes(`1 of ${MIN_FIXTURES} fixtures`), g4.reason);
  const g4b = evaluateGates(cls({ declared: 6, selected: 3 }), cls(), REV);
  check("and separately on too few POSABLE ones, with a different sentence",
    g4b.gate === "coverage" && /only 3 of 5 could be posed/.test(g4b.reason), g4b.reason);
  check("the two coverage sentences do not render identically", g4.reason !== g4b.reason);

  // 5. cost comparability
  const g5 = evaluateGates(cls({ cost_inr: 12 }), cls({ cost_inr: null }), REV);
  check("gate 5 fails when only one side reports a cost",
    g5.gate === "cost-comparability" && /one side only/.test(g5.reason), g5.reason);
  const bothAbsent = evaluateGates(cls({ cost_inr: null }), cls({ cost_inr: null }), REV);
  check("two ABSENT costs are comparable, and the tiebreak simply does not run", bothAbsent.eligible === true);

  // 6. eval-pack revision
  const g6 = evaluateGates(cls(), cls(), { candidateRevision: "1.0.0", championRevision: "2.0.0" });
  check("gate 6 fails when the two ran different eval-pack revisions",
    g6.gate === "same-eval-pack-revision" && /different exams/.test(g6.reason), g6.reason);

  // THE HEADLINE RULE (ADR-0906): these two sentences must never render identically.
  check("evidence-insufficient and candidate-lost are DIFFERENT sentences", g4.reason !== g3.reason);
  check("every NO PROPOSAL reason begins with NO PROPOSAL",
    [g1, g1b, g2, g2b, g3, g4, g4b, g5, g6].every((v) => v.reason.startsWith("NO PROPOSAL - ")));
  check("every NO PROPOSAL names the gate that produced it",
    [g1, g1b, g2, g2b, g3, g4, g4b, g5, g6].every((v) => typeof v.gate === "string" && v.gate.length));

  // GATE ORDER IS PART OF THE CONTRACT: a candidate broken at gate 1 and gate 4 reports gate 1,
  // because a reader fixing the later one would be fixing the wrong thing first.
  const both = evaluateGates(cls({ declared: 1, unselected: [{ file: "x", reason: "failure: budget -- nope" }] }), cls(), REV);
  check("the FIRST failing gate is the one reported", both.gate === "completeness", both.gate);
}

// ---- 2. the diff is stable, pinned, and carries no clock --------------------------------------
{
  const sha = routerSha(ROOT);
  const a = buildRouterDiff(ROOT, "commit-msg-draft", "mock", sha);
  const b = buildRouterDiff(ROOT, "commit-msg-draft", "mock", sha);
  check("the same inputs produce a BYTE-IDENTICAL diff", a.diff === b.diff && typeof a.diff === "string");
  check("the diff is pinned to the router SHA the run read", a.diff.includes(sha));
  check("the diff changes exactly one line", (a.diff.match(/^-[^-]/gm) || []).length === 1 && (a.diff.match(/^\+[^+]/gm) || []).length === 1);
  check("it removes the champion driver and adds the candidate",
    /^-\s+driver: claude-code$/m.test(a.diff) && /^\+\s+driver: mock$/m.test(a.diff));
  // No clock ANYWHERE in the body: a timestamp makes two identical proposals differ.
  check("no timestamp appears in the diff body", !/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(a.diff));
  const none = buildRouterDiff(ROOT, "no-such-class", "mock", sha);
  check("a class with no router row yields NO diff and says why",
    none.diff === null && /no `classes\.no-such-class` row/.test(none.why), none.why);
  const same = buildRouterDiff(ROOT, "commit-msg-draft", "claude-code", sha);
  check("proposing the incumbent yields NO diff at all, never an empty one",
    same.diff === null && /already routes/.test(same.why), same.why);
}

// ---- 3. the flag pairing ----------------------------------------------------------------------
{
  const bad = (args, want) => {
    let msg = null;
    try { parseArgs(args); } catch (e) { msg = e instanceof OperatorError ? e.message : `wrong type ${e.constructor.name}`; }
    check(`parseArgs refuses ${JSON.stringify(args.join(" "))}`, msg !== null && msg.includes(want), msg || "ACCEPTED");
  };
  bad(["--driver", "mock", "--budget", "inr=1", "--propose"], "needs --champion");
  // `--champion` ALONE became the drift guard in Phase 03, so it is no longer a refusal. What is
  // refused is pointing it at the directory the run is about to overwrite.
  check("--champion alone is the drift guard, not an error",
    parseArgs(["--driver", "mock", "--budget", "inr=1", "--champion", "x"]).champion === "x");
  bad(["--driver", "mock", "--budget", "inr=1", "--propose", "--champion", "same", "--out", "same"], "must be different directories");
  bad(["--driver", "mock", "--budget", "inr=1", "--propose", "--champion", "x"], "needs --out");
  bad(["--driver", "mock", "--budget", "inr=1", "--propose", "--champion", "x", "--out", "y", "--dry-run"], "no evidence to propose from");
  const ok = parseArgs(["--driver", "mock", "--budget", "inr=1", "--propose", "--champion", "c", "--out", "o"]);
  check("a well-formed proposal command parses", ok.propose === true && ok.champion === "c");
}

// ---- 4. live: two runs, three artifacts, one approval -----------------------------------------
{
  const spine = dir("prop-spine");
  const champ = join(scratch, "champ");
  const cand = join(scratch, "cand");
  const shaBefore = routerSha(ROOT);

  const r1 = bench(["--driver", "mock", "--budget", "inr=500,min=15", "--out", champ], { ARC_SPINE_ROOT: spine });
  check("the champion run exits 0", r1.status === EXIT.OK, `status ${r1.status}: ${r1.stderr.split("\n")[0]}`);

  const r2 = bench(["--driver", "mock", "--budget", "inr=500,min=15", "--out", cand, "--propose", "--champion", champ], { ARC_SPINE_ROOT: spine });
  check("the proposing run exits 0", r2.status === EXIT.OK, `status ${r2.status}: ${r2.stderr.split("\n")[0]}`);

  const pdir = join(cand, "proposal");
  check("artifact 1: the human evidence table exists", existsSync(join(pdir, "evidence.md")));
  check("artifact 2: the machine-readable manifest exists", existsSync(join(pdir, "manifest.json")));
  check("artifact 3: a diff exists for the proposed class", existsSync(join(pdir, "commit-msg-draft.router.diff")));

  // A CLASS AT NO PROPOSAL PRODUCES NO DIFF AT ALL -- never an empty or commented-out one, which
  // would read as a proposal that happens to be blank.
  check("the two ineligible classes produced NO diff file",
    !existsSync(join(pdir, "review-diff.router.diff")) && !existsSync(join(pdir, "kickoff-plan.router.diff")));

  const table = readFileSync(join(pdir, "evidence.md"), "utf8");
  const manifest = JSON.parse(readFileSync(join(pdir, "manifest.json"), "utf8"));
  // But they DO appear in artifacts 1 and 2, carrying their reason.
  check("the ineligible classes appear in the table with their reason",
    /review-diff/.test(table) && /evidence insufficient \(1 of 5 fixtures\)/.test(table));
  check("and in the manifest, with the gate that produced them",
    manifest.classes.some((c) => c.task_class === "review-diff" && c.eligible === false && c.gate_failed === "coverage"));

  // THE TABLE AND THE MANIFEST AGREE. Both are built from one list, which makes the agreement
  // structural rather than something a test has to police after the fact -- but it is pinned
  // anyway, because "structural" is a claim about today's code.
  for (const c of manifest.classes) {
    const inTable = table.includes(`| ${c.task_class} |`);
    check(`the table carries the manifest row for ${c.task_class}`, inTable);
    if (!c.eligible) check(`and the same reason for ${c.task_class}`, table.includes(c.reason));
  }
  check("the manifest names the router SHA the run read", manifest.router_sha_at_read === shaBefore);
  check("the table names it too", table.includes(shaBefore));

  const appr = eventsOn(spine).filter((e) => e.kind === "approval.requested");
  check("exactly one approval.requested was emitted", appr.length === 1, `saw ${appr.length}`);
  if (appr.length === 1) {
    check("its gate is router-merge", appr[0].payload.gate === "router-merge");
    check("it names the router SHA it was built against", appr[0].payload.router_sha === shaBefore);
    check("it names the class it proposes to move", appr[0].payload.classes.some((c) => c.task_class === "commit-msg-draft"));
  }
  const q = join(spine, "events", "_quarantine");
  check("nothing was quarantined", !existsSync(q) || readdirSync(q).length === 0);

  // PROPOSE-ONLY: bench has no write path to the router, and the file is byte-unchanged after a
  // run that just proposed to change it.
  check("engine/router.yaml is byte-unchanged after a proposing run", routerSha(ROOT) === shaBefore);

  // The run receipt carries the proposal summary, not the proposal.
  const runs = eventsOn(spine).filter((e) => e.kind === "run.completed" && e.process === "bench@0.1.0");
  check("the proposing run's receipt records the proposal", runs.some((e) => e.payload.proposal && e.payload.proposal.diffs === 1));
  check("and the NO PROPOSAL classes with their gates",
    runs.some((e) => (e.payload.proposal?.no_proposal || []).some((n) => n.gate === "coverage")));
}

// ---- 5. ADR-0917: a same-driver model is a tier line, money is like for like, prose is the model's -----------
{
  // A SYNTHETIC ROUTER, so these checks do not move when engine/router.yaml is re-tiered for real.
  const rroot = dir("tier-router");
  mkdirSync(join(rroot, "engine"), { recursive: true });
  writeFileSync(join(rroot, "engine", "router.yaml"), [
    "models:",
    "  cheap-scan:",
    "    claude-code: haiku",
    "  balanced-workhorse:",
    "    claude-code: sonnet",
    "  high-judgment:",
    "    claude-code: opus",
    "  twin-a:",
    "    claude-code: twin",
    "  twin-b:",
    "    claude-code: twin",
    "classes:",
    "  commit-msg-draft:",
    "    tier: balanced-workhorse",
    "    driver: claude-code",
    "    max_attempts: 4",
    "  no-tier-class:",
    "    driver: claude-code",
    "",
  ].join("\n"), "utf8");
  const sha = routerSha(rroot);
  const t = buildRouterDiff(rroot, "commit-msg-draft", "claude-code", sha, { model: "haiku" });
  check("ADR-0917: a second model under the same driver yields a diff, not NO DIFF", typeof t.diff === "string", t.why);
  check("and the diff rewrites the TIER line to the tier that pins that model",
    /^-\s+tier: balanced-workhorse$/m.test(t.diff || "") && /^\+\s+tier: cheap-scan$/m.test(t.diff || ""), t.diff);
  check("and changes exactly one line, leaving the driver line as it was",
    ((t.diff || "").match(/^-[^-]/gm) || []).length === 1 && ((t.diff || "").match(/^\+[^+]/gm) || []).length === 1 && /^ \s+driver: claude-code$/m.test(t.diff || ""), t.diff);
  const t2 = buildRouterDiff(rroot, "commit-msg-draft", "claude-code", sha, { model: "haiku" });
  check("the tier diff is byte-identical for the same inputs", t.diff === t2.diff);
  const inc = buildRouterDiff(rroot, "commit-msg-draft", "claude-code", sha, { model: "sonnet" });
  check("the incumbent's own model yields NO diff, naming the tier",
    inc.diff === null && /already routes commit-msg-draft to claude-code\/sonnet \(tier balanced-workhorse\)/.test(inc.why), inc.why);
  const none = buildRouterDiff(rroot, "commit-msg-draft", "claude-code", sha, { model: "gpt-9" });
  check("a model no tier pins is REFUSED, never given a new tier",
    none.diff === null && /no tier in engine\/router\.yaml pins claude-code to gpt-9/.test(none.why) && /ADR-0069/.test(none.why), none.why);
  const twin = buildRouterDiff(rroot, "commit-msg-draft", "claude-code", sha, { model: "twin" });
  check("a model two tiers pin is REFUSED, because choosing one is a tier decision",
    twin.diff === null && /2 tiers pin claude-code to twin \(twin-a, twin-b\)/.test(twin.why), twin.why);
  const noTier = buildRouterDiff(rroot, "no-tier-class", "claude-code", sha, { model: "haiku" });
  check("a class with no tier line is refused by name", noTier.diff === null && /declares no tier line/.test(noTier.why), noTier.why);
  const drv = buildRouterDiff(rroot, "commit-msg-draft", "mock", sha, { model: "haiku" });
  check("a DIFFERENT driver still rewrites the driver line, model or not",
    /^-\s+driver: claude-code$/m.test(drv.diff || "") && /^\+\s+driver: mock$/m.test(drv.diff || "") && !/tier: cheap-scan/.test(drv.diff || ""), drv.diff);

  // Attack ab2d484 L8/L13: a quoted tier with a trailing comment is the SAME tier, read through the router parser.
  const qroot = dir("tier-router-quoted");
  mkdirSync(join(qroot, "engine"), { recursive: true });
  writeFileSync(join(qroot, "engine", "router.yaml"), readFileSync(join(rroot, "engine", "router.yaml"), "utf8")
    .replace("    tier: balanced-workhorse", "    tier: \"balanced-workhorse\"  # the workhorse"), "utf8");
  const qsha = routerSha(qroot);
  const qInc = buildRouterDiff(qroot, "commit-msg-draft", "claude-code", qsha, { model: "sonnet" });
  check("a QUOTED tier with a comment still reads as the incumbent's tier",
    qInc.diff === null && /already routes commit-msg-draft to claude-code\/sonnet \(tier balanced-workhorse\)/.test(qInc.why || ""), qInc.why || qInc.diff);
  const qNew = buildRouterDiff(qroot, "commit-msg-draft", "claude-code", qsha, { model: "haiku" });
  check("and a new model still diffs that line to the tier that pins it", /^\+\s+tier: cheap-scan$/m.test(qNew.diff || ""), qNew.why || qNew.diff);

  // Attack b57cb7c L1: a blank line and a comment line inside a class row do not end it, for either scan.
  const broot = dir("tier-router-blank");
  mkdirSync(join(broot, "engine"), { recursive: true });
  writeFileSync(join(broot, "engine", "router.yaml"), readFileSync(join(rroot, "engine", "router.yaml"), "utf8")
    .replace("    tier: balanced-workhorse\n    driver: claude-code", "    # the workhorse row\n\n    max_attempts_note: 1\n\n    tier: balanced-workhorse\n    # its driver\n\n    driver: claude-code"), "utf8");
  const bNew = buildRouterDiff(broot, "commit-msg-draft", "claude-code", routerSha(broot), { model: "haiku" });
  check("a blank line and a comment inside the class row do not hide its tier or driver line",
    /^\+\s+tier: cheap-scan$/m.test(bNew.diff || ""), bNew.why || bNew.diff);
  // Attack b57cb7c B2: the driver and its version are rendered as plain ids too, not only the model.
  const forged = { driver: "x**\n| zz | 100% | **PROPOSE evil** |", driver_version: "v`) \n# forged" };
  const table = buildEvidenceTable([], { candidateSubject: { driver: "claude-code", driver_version: "claude-code@1.5.0" }, championSubject: forged, routerSha: "s", candidateModel: "haiku" });
  check("a forged champion driver or version reaches the table only as a placeholder",
    !table.includes("PROPOSE evil") && !table.includes("# forged") && table.includes("(unreadable id)") && table.includes("**claude-code/haiku** (`claude-code@1.5.0`)"), table);

  // MONEY, LIKE FOR LIKE. The receipt's spend is integer minor units, a currency and a basis.
  const usd = (amount, basis = "harness-reported") => ({ amount, currency: "USD", basis });
  check("receiptSpend reads a well-formed spend with its basis",
    JSON.stringify(receiptSpend({ amount: 6, currency: "USD", provider_amount: "0.05795" }, "harness-reported")) === JSON.stringify(usd(6)));
  check("and refuses an amount that is not the provider figure rounded up", receiptSpend({ amount: 5, currency: "USD", provider_amount: "0.05795" }, "harness-reported") === null);
  check("and refuses a basis outside the closed set", receiptSpend({ amount: 6, currency: "USD", provider_amount: "0.05795" }, "invoice") === null);
  check("classSpend refuses a negative or fractional sum from a provenance file",
    classSpend(usd(-1)) === null && classSpend(usd(1.5)) === null && JSON.stringify(classSpend(usd(82))) === JSON.stringify(usd(82)));
  let acc = foldSpend({ spend: null, gap: null }, usd(6));
  acc = foldSpend(acc, usd(5));
  check("foldSpend sums a class's attempts", acc.spend?.amount === 11 && acc.gap === null, JSON.stringify(acc));
  const holed = foldSpend(acc, null);
  check("one attempt with no spend makes the class's money ABSENT and says why, never a partial sum",
    holed.spend === null && /reported no spend/.test(holed.gap) && foldSpend(holed, usd(9)).spend === null);
  // PR 433 CI: every attempt with NO spend is no money claim at all -- absent, never a gap. A gap refused every mock proposal.
  let noSpend = foldSpend({ spend: null, gap: null }, null);
  noSpend = foldSpend(noSpend, null);
  check("a class where NO attempt reported spend is plain ABSENT, not a gap",
    noSpend.spend === null && noSpend.gap === null, JSON.stringify(noSpend));
  check("but money arriving after an attempt that had none is a gap, in either order",
    foldSpend(noSpend, usd(4)).spend === null && /reported no spend/.test(foldSpend(noSpend, usd(4)).gap || ""));
  const mixed = foldSpend(acc, usd(3, "provider-reported"));
  check("a mixed basis makes it ABSENT too", mixed.spend === null && /mixed spend/.test(mixed.gap), JSON.stringify(mixed));

  const side = (spend, cost_inr = null) => cls({ spend, cost_inr });
  const cheaper = evaluateGates(side(usd(40)), side(usd(82)), REV);
  check("ADR-0917: a quality tie with less spend, same currency and basis, is decided on COST", cheaper.eligible && cheaper.decidedBy === "cost", JSON.stringify(cheaper));
  const dearer = evaluateGates(side(usd(90)), side(usd(82)), REV);
  check("and with MORE spend it loses on cost", dearer.eligible === false && dearer.gate === "cost-comparability" && /lost on cost \(90 vs 82\)/.test(dearer.reason), dearer.reason);
  const basis = evaluateGates(side(usd(40, "provider-reported")), side(usd(82)), REV);
  check("a harness's notional figure and a provider's invoice are NOT compared",
    basis.gate === "cost-comparability" && /not like for like/.test(basis.reason), basis.reason);
  const cur = evaluateGates(side({ amount: 40, currency: "INR", basis: "harness-reported" }), side(usd(82)), REV);
  check("nor are two currencies, with no rate anyone maintains", cur.gate === "cost-comparability" && /not like for like/.test(cur.reason), cur.reason);
  const oneSide = evaluateGates(side(usd(40)), side(null), REV);
  check("spend on one side only is not comparable", oneSide.gate === "cost-comparability" && /spend is reported on one side only/.test(oneSide.reason), oneSide.reason);
  // Attack ab2d484 B2: a champion directory is a file anyone can hand us, so its model id reaches a table only as a plain id.
  check("an applied trial model reaches an artifact as a plain id",
    artifactModel({ model_source: "trial", model_applied: "haiku" }) === "haiku" && artifactModel({ model_source: "trial", model_applied: "anthropic/claude-haiku-5.5" }) === "anthropic/claude-haiku-5.5");
  check("but a model id that could break a table cell or a link is dropped, and so is a non-trial one",
    artifactModel({ model_source: "trial", model_applied: "haiku | **PROPOSE** [x](y)" }) === null
      && artifactModel({ model_source: "router", model_applied: "haiku" }) === null && artifactModel({ model_source: "trial", model_applied: "" }) === null);
  // Attack ab2d484 L5: a malformed spend is NOT an absence -- two of them must not read as "comparable".
  const bad = evaluateGates(cls({ spend: null, spend_malformed: true }), cls({ spend: null, spend_malformed: true }), REV);
  check("a MALFORMED spend on both sides is not comparable, never two absences that pass",
    bad.gate === "cost-comparability" && /spend on both sides is not money bench can read/.test(bad.reason || ""), bad.reason || "eligible");
  // Attack b57cb7c B1: a GAPPED spend is not an absence either.
  const gapped = evaluateGates(cls({ spend: null, spend_gap: "an attempt reported no spend" }), cls({ spend: null, spend_gap: "an attempt reported no spend" }), REV);
  check("a spend lost to a gap on both sides is not comparable, and the reason is named",
    gapped.gate === "cost-comparability" && /spend on both sides is incomplete \(an attempt reported no spend\)/.test(gapped.reason || ""), gapped.reason || "eligible");
  const inrWins = moneyPair(side(usd(1), 5), side(usd(999), 9));
  check("a rupee cost block on both sides is still the figure compared", inrWins.candidate === 5 && inrWins.champion === 9 && inrWins.unit === "INR", JSON.stringify(inrWins));

  // LIVE: a recording that declares model-invalid scores as a SCHEMA failure; an undeclared one stays unscoreable.
  const src = join(ROOT, "tests/fixtures/bench/mock-replay/commit-msg-draft");
  const recRoot = dir("model-invalid-rec");
  const dst = join(recRoot, "commit-msg-draft");
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(src)) {
    let doc = JSON.parse(readFileSync(join(src, f), "utf8"));
    if (f === "new-feature-file.json") doc = { __failure: { class: "model-invalid", message: "the model answer is not JSON: prose" } };
    if (f === "docs-only.json") doc = { __failure: { class: null, message: "an undeclared failure -- the control" } };
    writeFileSync(join(dst, f), JSON.stringify(doc), "utf8");
  }
  check("fixture: the altered recordings were written (non-empty set)", readdirSync(dst).length >= 5, String(readdirSync(dst).length));
  const mout = join(scratch, "model-invalid-out");
  const mr = bench(["--driver", "mock", "--budget", "inr=500,min=15", "--out", mout], { ARC_SPINE_ROOT: dir("model-invalid-spine"), ARC_MOCK_DIR: recRoot });
  const scPath = join(mout, "scorecard.json");
  check("the model-invalid run RAN and wrote a scorecard", existsSync(scPath), `status ${mr.status}: ${mr.stderr.split("\n")[0]}`);
  if (existsSync(scPath)) {
    const row = JSON.parse(readFileSync(scPath, "utf8")).classes.find((c) => c.task_class === "commit-msg-draft");
    const fx = (id) => (row?.fixtures || []).find((f) => f.id === id);
    const nf = fx("new-feature-file");
    check("ADR-0917: a model-invalid attempt is a SCHEMA failure the model earned, not a driver fault",
      nf && nf.attempts.length === 3 && nf.attempts.every((a) => a.scored === false && a.verdict === "schema" && a.schema === false), JSON.stringify(nf?.attempts));
    const ctl = fx("docs-only");
    check("and the undeclared failure beside it stays unscoreable -- the control",
      ctl && ctl.attempts.every((a) => a.scored === false && a.verdict !== "schema" && a.schema === null), JSON.stringify(ctl?.attempts));
    check("the schema denominator counts the model-invalid attempts and not the undeclared ones",
      row.schema.evaluated === 12 && row.schema.passed === 9, JSON.stringify(row.schema));
  }
}

rmSync(scratch, { recursive: true, force: true });

if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nall checks held");
