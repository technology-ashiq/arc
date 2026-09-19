#!/usr/bin/env node
// kernel-ring.mjs -- the kernel ring's owning-lane tools, held to their own words (face v2 Phase 05, ADR-1340).
//
// The door's parity suite (work-door.mjs) proves the door calls what a hand-run calls. This suite proves what those
// tools DO, each over a scratch spine and, where it needs one, a scratch repo:
//   arc-jobs     an unknown, =valued, single-dash or foreign flag refuses before any command; one job name at most
//   propose      the router edit is one line of one class; the approval is judged before anything is written; the
//                apply is bound to its plan (--expect) and to the main it read; in a scratch repo it writes a branch
//                and nothing else, and a cleanup that fails after the write is not reported as a refusal
//   policy       the promotion request is the policy library's, accepted by the spine; refusals name the rule
//   evolve       the LOGIC, as pure functions over in-memory receipts: supersedes, counts, conflicts, the cohort
//                re-derived, completeness per cohort, direction, the module's alpha, TTL, drift, two arms, compute-once
//                -- then the CLI: plan -> apply bound by --expect, and every check re-run at apply
//   the door     an effect past the spine is refused on a sim door (SIM_EFFECT); an expect row's apply carries its
//                plan's digest, and a plan with none is refused (NO_EXPECT)
//   the law      nothing the face runs changes engine/router.yaml or hq.policy.yaml in place, measured on the bytes
//                of a scratch repo -- with a planted mutant that the same measurement catches
//
// VACUOUS-PASS GUARD: each tool is proven to run (a receipt landed, a plan printed) before its refusals are counted,
// and the last line is "RAN: <n> checks", which the bats wrapper requires.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const S = (...p) => join(REPO, ".claude", "scripts", ...p);
const EVENT = S("hq", "arc-event.mjs");
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};
const node = (args, env = {}) => spawnSync(process.execPath, args, { cwd: REPO, encoding: "utf8", env: { ...process.env, ...env }, timeout: 120_000 });
const tmp = mkdtempSync(join(tmpdir(), "face-kernel-ring-"));
const spine = (name) => { const d = join(tmp, name); mkdirSync(join(d, "events"), { recursive: true }); return d; };
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
/** Every file under a spine, hashed: what "wrote nothing" is measured against. */
const fingerprint = (root) => {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else out.push(`${n}:${sha256(readFileSync(p))}`); } };
  walk(root);
  return out.join("|");
};
/** Every receipt on a spine, in file order. */
const spineEvents = (root) => readdirSync(join(root, "events")).filter((n) => n.endsWith(".jsonl")).sort()
  .flatMap((n) => readFileSync(join(root, "events", n), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
/** Run the emit a tool printed as its last line, strictly, on a spine. */
const emitLast = (stdout, root) => {
  const last = String(stdout).trim().split(/\r?\n/).pop() || "";
  let plan = null; try { plan = JSON.parse(last); } catch { return { status: -1, id: "", why: `not an emit plan: ${last.slice(0, 120)}` }; }
  const r = node([EVENT, ...plan.emit], { ARC_SPINE_ROOT: root });
  return { status: r.status, id: String(r.stdout).trim(), why: String(r.stderr).trim().split(/\r?\n/)[0] || "" };
};
/** The digest a plan printed as its last line, or null. */
const lastExpect = (stdout) => {
  try { const j = JSON.parse(String(stdout).trim().split(/\r?\n/).pop() || ""); return typeof j.expect === "string" && /^[0-9a-f]{64}$/.test(j.expect) ? j.expect : null; } catch { return null; }
};
/** The receipt id a tool printed ("receipt: <kind> <ULID>"), or "". */
const receiptOf = (stdout) => (/receipt: \S+ ([0-9A-HJKMNP-TV-Z]{26})/.exec(String(stdout)) || [])[1] || "";

// ---- arc-jobs: the flags a register plan and apply ride on ----
{
  const jobs = (...a) => node([S("hq", "arc-jobs.mjs"), ...a]);
  const unknown = jobs("list", "--bogus");
  check("arc-jobs: an unknown flag refuses (exit 2), never ignored", unknown.status === 2 && /unknown flag --bogus/.test(unknown.stderr), `${unknown.status} ${unknown.stderr}`);
  const eq = jobs("register", "day-close-roll", "--dry-run=0");
  check("arc-jobs: --dry-run=0 refuses (a safety flag takes no value)", eq.status === 2 && /takes no value/.test(eq.stderr), `${eq.status} ${eq.stderr}`);
  const unreg = jobs("unregister", "day-close-roll", "--dry-run");
  check("arc-jobs: unregister --dry-run refuses BEFORE the off switch runs", unreg.status === 2 && /belong to register/.test(unreg.stderr) && !/unregistered/.test(unreg.stdout), `${unreg.status} ${unreg.stderr} ${unreg.stdout}`);
  const both = jobs("register", "day-close-roll", "--dry-run", "--receipt");
  check("arc-jobs: --dry-run with --receipt refuses (a dry run has no receipt)", both.status === 2 && /pick one/.test(both.stderr));
  const all = jobs("register", "--dry-run");
  check("arc-jobs: a register plan names ONE job", all.status === 2 && /name one job/.test(all.stderr));
  // Every spelling of a dash that is not a whole --flag, and every flag another command owns (PR 3a attacks): each one
  // used to be a stray positional that register ignored, so the safety flag was dropped and the registration was real.
  for (const [what, args] of [
    ["a single-dash -dry-run", ["register", "day-close-roll", "-dry-run"]],
    ["an em-dash dry-run", ["register", "day-close-roll", String.fromCharCode(0x2014) + "dry-run"]],
    ["a Unicode-minus dry-run", ["register", "day-close-roll", String.fromCharCode(0x2212) + "dry-run"]],
    ["a fullwidth-hyphen dry-run", ["register", "day-close-roll", String.fromCharCode(0xff0d) + "dry-run"]],
  ]) {
    const r = jobs(...args);
    check(`arc-jobs: ${what} refuses before register runs`, r.status === 2 && /looks like a flag and is not one/.test(r.stderr) && !/registered/.test(r.stdout), `${r.status} ${r.stderr}`);
  }
  const stray = jobs("register", "day-close-roll", "dry-run");
  check("arc-jobs: a second job name refuses (register takes one)", stray.status === 2 && /takes one job name/.test(stray.stderr), stray.stderr);
  const empty = jobs("register", "", "--dry-run");
  check("arc-jobs: an EMPTY job name refuses -- it read as absent and acted on every enabled job", empty.status === 2 && /empty job name/.test(empty.stderr), empty.stderr);
  const foreign = jobs("register", "--slot", "day-close-roll");
  check("arc-jobs: another command's flag refuses (--slot swallowed the job name, and register fell back to every job)", foreign.status === 2 && /not a flag register takes/.test(foreign.stderr), foreign.stderr);
  // The dry run makes every check a registration makes and hands nothing to the OS. Off Windows the platform check is
  // one of those checks, so the dry run refuses there exactly as a real register does.
  const dry = jobs("register", "day-close-roll", "--dry-run");
  if (process.platform === "win32") check("arc-jobs: register --dry-run on Windows says what it would register and hands nothing over", dry.status === 0 && /would register day-close-roll/.test(dry.stdout) && /nothing was handed to the OS/.test(dry.stdout), `${dry.status} ${dry.stderr}`);
  else check("arc-jobs: register --dry-run off Windows refuses at the platform check, like register itself", dry.status === 2 && /targets Windows/.test(dry.stderr), `${dry.status} ${dry.stderr}`);
}

// ---- engine/propose.mjs: one line of one class, refused early ----
{
  // Importing the CLI does not run it (a realpath main guard), so editRouter is testable as a function.
  const P = await import(pathToFileURL(S("engine", "propose.mjs")).href).catch((e) => ({ loadError: e }));
  check("propose.mjs exports editRouter, branchFor and approvalPayload (vacuous-pass guard)", typeof P.editRouter === "function" && typeof P.branchFor === "function" && typeof P.approvalPayload === "function", String(P.loadError || ""));
  const router = readFileSync(join(REPO, "engine", "router.yaml"), "utf8");
  const edited = P.editRouter(router, "review-diff", "driver", "codex");
  const diff = router.split("\n").map((l, i) => (l === edited.text.split("\n")[i] ? null : [l, edited.text.split("\n")[i]])).filter(Boolean);
  check("editRouter changes exactly ONE line: the class's driver", diff.length === 1 && /^ {4}driver: claude-code$/.test(diff[0][0]) && diff[0][1] === "    driver: codex" && edited.from === "claude-code", JSON.stringify(diff));
  const tier = P.editRouter(router, "face-ask", "tier", "high-judgment");
  check("editRouter moves a tier the same way, and says what it replaced", tier.from === "balanced-workhorse" && tier.text.includes("  face-ask:\n    tier: high-judgment"));

  // Every approval this router can produce passes the spine's secret scanner. A class ending in "sk" before a "-" made
  // "sk-" inside the branch name, the joined-strings view read it as an API key, and every face-ask proposal wrote its
  // branch and then had its approval refused (PR 3a logic attack). The class now goes last in the branch.
  const { scanSecrets } = await import(pathToFileURL(S("hq", "lib", "redact.mjs")).href);
  const OPS = (await import(pathToFileURL(S("hq", "face-ops.mjs")).href)).OPS;
  const sel = (id, name) => OPS.find((o) => o.id === id).fields.find((f) => f.name === name).options;
  const zeros = "0".repeat(40);
  const hits = [];
  let combos = 0;
  for (const [verb, id] of [["driver", "engine-room.driver-switch"], ["tier", "model-policy.tier-proposal"]])
    for (const cls of sel(id, "class")) for (const to of sel(id, "to")) {
      const payload = P.approvalPayload({ verb, cls, from: "claude-code", to, why: "", branch: P.branchFor(verb, cls, to), base: zeros, commit: zeros });
      combos++;
      if (scanSecrets(JSON.stringify(payload), payload).hit) hits.push(`${verb} ${cls} -> ${to}`);
    }
  check("every (class, driver) and (class, tier) approval on this router passes the secret scanner", combos >= 20 && hits.length === 0, `${combos} combos; hit: ${hits.join(", ")}`);
  const old = P.approvalPayload({ verb: "tier", cls: "face-ask", from: "balanced-workhorse", to: "cheap-scan", why: "", branch: "feat/face-engine-tier-face-ask-cheap-scan", base: zeros, commit: zeros });
  check("MUTANT CONTROL: the old class-first branch name DOES trip the scanner (so the check above can fire)", scanSecrets(JSON.stringify(old), old).hit === true);

  const prop = (...a) => node([S("engine", "propose.mjs"), ...a]);
  const bad = prop("driver", "--class", "review-diff", "--to", "codex", "--dry-run=1");
  check("propose: --dry-run=1 refuses", bad.status === 2 && /takes no value/.test(bad.stderr), `${bad.status} ${bad.stderr}`);
  const unk = prop("driver", "--class", "review-diff", "--to", "codex", "--force");
  check("propose: an unknown argument refuses", unk.status === 2 && /unknown argument/.test(unk.stderr));
  const twice = prop("driver", "--class", "a", "--class", "b", "--to", "codex");
  check("propose: a repeated flag refuses", twice.status === 2 && /given twice/.test(twice.stderr));
  const verb = prop("merge", "--class", "review-diff", "--to", "codex");
  check("propose: there is no verb but driver and tier (no merge, no apply)", verb.status === 2 && /usage/.test(verb.stderr));
  const planAndApply = prop("driver", "--class", "review-diff", "--to", "codex", "--dry-run", "--expect", "0".repeat(64));
  check("propose: --dry-run with --expect refuses (one plans, the other applies)", planAndApply.status === 2 && /give one/.test(planAndApply.stderr), planAndApply.stderr);
  const flagValue = prop("driver", "--class", "-x", "--to", "codex");
  check("propose: a value that opens with a dash refuses", flagValue.status === 2 && /needs a value/.test(flagValue.stderr), flagValue.stderr);
}

// ---- policy-promote.mjs: the library's request, accepted by the spine ----
{
  const sp = spine("policy");
  const before = fingerprint(sp);
  const pp = (...a) => node([S("hq", "policy-promote.mjs"), ...a], { ARC_SPINE_ROOT: sp });
  const ok = pp("--kind", "process:kickoff-plan", "--capability", "write", "--to", "L2", "--evidence", "docs/trial-ledger.md#kernel-suite");
  check("policy-promote: plans a promotion within the ceiling (exit 0)", ok.status === 0 && /asking for L2/.test(ok.stdout), `${ok.status} ${ok.stderr}`);
  check("policy-promote: the plan wrote nothing (its dry run through arc-event included)", fingerprint(sp) === before);
  const landed = emitLast(ok.stdout, sp);
  check("policy-promote: the printed emit is accepted by the spine, strictly", landed.status === 0 && ULID.test(landed.id), `${landed.status} ${landed.why}`);
  const ev = spineEvents(sp).pop();
  check("policy-promote: the receipt is the policy.promotion profile, from L1, citing the evidence", ev.kind === "approval.requested" && ev.payload.subject === "policy.promotion" && ev.payload.from_level === "L1" && ev.payload.to_level === "L2" && ev.payload.trial_ledger_ref === "docs/trial-ledger.md#kernel-suite", JSON.stringify(ev.payload).slice(0, 300));
  const above = pp("--kind", "process:review-diff", "--capability", "write", "--to", "L3", "--evidence", "x");
  check("policy-promote: above the ceiling refuses, and says a ceiling is a repo edit", above.status === 2 && /ceiling/.test(above.stderr) && /repo edit/.test(above.stderr), above.stderr);
  const same = pp("--kind", "process:review-diff", "--capability", "write", "--to", "L1", "--evidence", "x");
  check("policy-promote: a promotion that does not raise refuses", same.status === 2 && /must raise/.test(same.stderr), same.stderr);
  const ghost = pp("--kind", "process:no-such-kind", "--capability", "write", "--to", "L2", "--evidence", "x");
  check("policy-promote: a kind hq.policy.yaml does not declare refuses (a subject is born by a reviewed edit)", ghost.status === 2 && /declares no kind/.test(ghost.stderr), ghost.stderr);
  const nocite = pp("--kind", "process:kickoff-plan", "--capability", "write", "--to", "L2");
  check("policy-promote: no evidence, no request (A4)", nocite.status === 2 && /--evidence is required/.test(nocite.stderr), nocite.stderr);
}

// ---- evolve LOGIC: open, measure and conclude as pure functions over in-memory receipts (wire.mjs) ----
{
  const W = await import(pathToFileURL(S("evolve", "wire.mjs")).href);
  const A = await import(pathToFileURL(S("evolve", "assign.mjs")).href);
  const X = "x-pure";
  const SHA = "a".repeat(64);
  const ARMS = ["+champion", "+challenger"];
  const CROCK = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let seq = 0;
  const ulid = () => { let n = ++seq, s = ""; for (let i = 0; i < 10; i++) { s = CROCK[n % 32] + s; n = Math.floor(n / 32); } return `01J${"0".repeat(13)}${s}`; };
  const NOW = Date.parse("2026-09-15T12:00:00+05:30");
  const DAY = 86_400_000;
  const ist = (ms) => new Date(ms + 19_800_000).toISOString().replace("Z", "+05:30");
  let clock = NOW - 2 * DAY;
  const ev = (kind, payload, envelope = {}) => ({ id: ulid(), ts: ist(clock += 1000), kind, payload, ...envelope });
  const opened = (o = {}) => ev("experiment.opened", { experiment_id: X, module: "fixmod", surface: "page", target_path: "app/page.tsx", base_sha: SHA, split: [50, 50], ttl_days: 28, arms: ARMS, ...o });
  /** A measurement as the CLI would write it (arm and cohort from assign()), with any field overridden. */
  const measured = (unit, value, o = {}, envelope = {}) => {
    const g = A.assign(X, unit, ARMS, [50, 50]);
    return ev("experiment.measured", { experiment_id: X, unit_id: unit, arm: g.arm, cohort: g.cohort, metric: "converted", value, unit_count: 1, window_start: "2026-09-01", window_end: "2026-09-07", source_id: "src-1", ...o }, envelope);
  };
  const pick = (cohort, n) => {
    const out = { "+champion": [], "+challenger": [] };
    for (let i = 0; i < 2000 && (out["+champion"].length < n || out["+challenger"].length < n); i++) {
      const g = A.assign(X, `p-${i}`, ARMS, [50, 50]);
      if (g.cohort === cohort && out[g.arm].length < n) out[g.arm].push(`p-${i}`);
    }
    return out;
  };
  const V = pick("verdict", 6);
  const G = pick("generation", 1);
  const module = (o = {}) => ({
    name: "fixmod",
    metrics: [
      { name: "converted", direction: o.direction ?? "higher-is-better", role: "primary" },
      ...(o.guardrail ? [{ name: "complaints", direction: "lower-is-better", role: "guardrail" }] : []),
    ],
    experiments: [{ surface_file: "app/page.tsx", split: [50, 50] }],
    evals: { per_arm_floor: 5, alpha: o.alpha ?? 0.05, effect_floor: 0 },
  });
  const run = (fn, events, args, o = {}) => {
    try { return { ok: fn({ events, modules: [o.module ?? module()], digestOf: () => o.sha ?? SHA, now: o.now ?? NOW }, args) }; }
    catch (e) { return { code: e.code, msg: e.message }; }
  };
  const conclude = (events, o) => run(W.planConclude, events, { experiment: X }, o);
  const five = (arm) => V[arm].slice(0, 5);
  // Champion never converts, challenger always does: the verdict the one test must reach.
  const base = () => [opened(), ...five("+champion").map((u) => measured(u, 0)), ...five("+challenger").map((u) => measured(u, 1))];

  check("fixture: 6 verdict-cohort units per arm and a generation unit per arm exist (vacuous-pass guard)", V["+champion"].length === 6 && V["+challenger"].length === 6 && G["+champion"].length === 1 && G["+challenger"].length === 1);
  const b = conclude(base());
  check("conclude (pure): a verdict from the receipts -- n 5/5, the whole difference, a positive bound", b.ok && b.ok.kind === "experiment.verdict" && b.ok.payload.n_per_arm["+champion"] === 5 && b.ok.payload.n_per_arm["+challenger"] === 5 && b.ok.payload.delta === 1 && b.ok.payload.bound > 0, JSON.stringify(b));

  // Supersedes: the fold KEEPS what the board keeps. All five challenger successes corrected to 0 used to still give a
  // delta of 1 (PR 3a logic attack).
  {
    const evs = base();
    const corrections = evs.filter((e) => e.kind === "experiment.measured" && e.payload.arm === "+challenger").map((e) => measured(e.payload.unit_id, 0, {}, { supersedes: e.id }));
    const r = conclude([...evs, ...corrections]);
    check("conclude (pure): superseded receipts are not counted -- every success corrected to 0 is a recorded no-verdict, never a verdict", !!r.ok && r.ok.payload.outcome === "no-verdict" && r.ok.payload.delta === 0, JSON.stringify(r).slice(0, 300));
  }
  // A receipt that observed nothing is not a trial: challenger "successes" over zero observations reached n and a
  // verdict while the board said the arm had nothing.
  {
    const evs = [opened(), ...five("+champion").map((u) => measured(u, 0)), ...five("+challenger").map((u) => measured(u, 1, { unit_count: 0 }))];
    const r = conclude(evs);
    check("conclude (pure): zero-observation receipts count toward nothing", r.code === "NO_VERDICT", JSON.stringify(r).slice(0, 300));
  }
  {
    const r = conclude([...base(), measured(five("+champion")[0], 1, { source_id: "src-2" })]);
    check("conclude (pure): a unit reported 0 and 1 for one window refuses (CONFLICTING_VALUES), never takes the max", r.code === "CONFLICTING_VALUES", JSON.stringify(r).slice(0, 300));
  }
  {
    const r = conclude([...base(), measured(five("+champion")[0], 1, { arm: "+challenger" })]);
    check("conclude (pure): a unit measured under the other arm refuses (COHORT_VIOLATION), never counted in both", r.code === "COHORT_VIOLATION", JSON.stringify(r).slice(0, 300));
  }
  {
    const r = conclude([...base(), measured(G["+challenger"][0], 1, { cohort: "verdict" })]);
    check("conclude (pure): a generation unit whose receipt claims the verdict cohort refuses (COHORT_VIOLATION)", r.code === "COHORT_VIOLATION", JSON.stringify(r).slice(0, 300));
  }
  {
    const u = five("+champion")[0];
    const assigned = ev("experiment.assigned", { experiment_id: X, unit_id: u, arm: "+champion", cohort: "generation" });
    const r = conclude([...base(), assigned]);
    const m = run(W.planMeasure, [...base(), assigned], { experiment: X, unit: u, metric: "converted", value: "1", count: "1", window: "2026-09-08..2026-09-14", source: "s" });
    check("a recorded assignment that disagrees with assign() refuses conclude (COHORT_VIOLATION) and measure (ASSIGNMENT_CONFLICT)", r.code === "COHORT_VIOLATION" && m.code === "ASSIGNMENT_CONFLICT", `${r.code} ${m.code}`);
  }
  // Completeness per cohort: the champion's verdict units in week 1, the challenger's in week 2, each window
  // "completed" by one generation unit of the other arm -- the board calls both windows complete, and the verdict
  // cohort has compared two different weeks.
  {
    const w2 = { window_start: "2026-09-08", window_end: "2026-09-14" };
    const evs = [opened(), ...five("+champion").map((u) => measured(u, 0)), ...five("+challenger").map((u) => measured(u, 1, w2)),
      measured(G["+challenger"][0], 1), measured(G["+champion"][0], 0, w2)];
    const r = conclude(evs);
    check("conclude (pure): windows are complete on the VERDICT cohort alone -- two half-windows are MISSING, no verdict", r.code === "NO_VERDICT" && /2 window\(s\) are MISSING/.test(r.msg), JSON.stringify(r).slice(0, 300));
  }
  {
    const lower = conclude(base(), { module: module({ direction: "lower-is-better" }) });
    const mirror = [opened(), ...five("+champion").map((u) => measured(u, 1)), ...five("+challenger").map((u) => measured(u, 0))];
    const good = conclude(mirror, { module: module({ direction: "lower-is-better" }) });
    check("conclude (pure): a lower-is-better primary never names the WORSE arm the winner (the computed test is a recorded no-verdict)", !!lower.ok && lower.ok.payload.outcome === "no-verdict" && lower.ok.payload.delta < 0, JSON.stringify(lower).slice(0, 300));
    check("conclude (pure): lower-is-better scores fewer events as better -- the mirror data is a verdict, delta 1", good.ok && good.ok.payload.delta === 1 && good.ok.payload.bound > 0, JSON.stringify(good).slice(0, 300));
    check("the config hash carries the direction: the two verdicts' hashes differ", b.ok && good.ok && b.ok.payload.config_hash !== good.ok.payload.config_hash);
  }
  {
    const r = conclude(base(), { module: module({ alpha: 0.01 }) });
    check("conclude (pure): the module's own alpha is used, and one the test has no quantile for refuses (ALPHA_UNPINNED)", r.code === "ALPHA_UNPINNED", JSON.stringify(r).slice(0, 300));
  }
  {
    clock = NOW - 30 * DAY;
    const old = opened({ ttl_days: 7 });
    clock = NOW - 2 * DAY;
    const evs = [old, ...five("+champion").map((u) => measured(u, 0)), ...five("+challenger").map((u) => measured(u, 1))];
    const r = conclude(evs);
    const m = run(W.planMeasure, evs, { experiment: X, unit: "p-x", metric: "converted", value: "1", count: "1", window: "2026-09-01..2026-09-07", source: "s" });
    check("TTL: an experiment past its TTL refuses conclude and measure (EXPIRED, ADR-0310)", r.code === "EXPIRED" && m.code === "EXPIRED", `${r.code} ${m.code}`);
  }
  {
    const r = conclude([...base(), opened({ surface: "page-two", arms: ["+challenger", "+champion"] })]);
    check("conclude (pure): arms redeclared by a second open refuses (ARMS_REDECLARED), never picks by apply order", r.code === "ARMS_REDECLARED", JSON.stringify(r).slice(0, 300));
  }
  {
    const r = conclude(base(), { sha: "b".repeat(64) });
    check("conclude (pure): a surface whose bytes moved refuses (CANONICAL_DRIFT) -- a verdict never promotes an unmeasured surface", r.code === "CANONICAL_DRIFT", JSON.stringify(r).slice(0, 300));
  }
  {
    const three = conclude([opened({ arms: ["+a", "+b", "+c"], split: [34, 33, 33] })]);
    const open3 = run(W.planOpen, [], { experiment: "x-three", module: "fixmod", surface: "page", target: "app/page.tsx", arms: "+a,+b,+c" });
    check("two arms exactly: open refuses a third arm, and conclude refuses an experiment that has one (NOT_TWO_ARMS)", three.code === "NOT_TWO_ARMS" && open3.code === "NOT_TWO_ARMS", `${three.code} ${open3.code}`);
  }
  {
    const r = conclude([opened(), measured(five("+champion")[0], 0), measured(five("+challenger")[0], 0.5)]);
    check("conclude (pure): a primary value other than 0 or 1 refuses by name (NOT_BINARY, ADR-0306's trigger)", r.code === "NOT_BINARY", JSON.stringify(r).slice(0, 300));
  }
  {
    const r = conclude(base(), { module: module({ guardrail: true }) });
    check("conclude (pure): a declared guardrail with no threshold is unresolved, and refuses a verdict the data would give", r.code === "NO_VERDICT" && /complaints is unresolved/.test(r.msg), JSON.stringify(r).slice(0, 300));
  }
  {
    const r = conclude([...base(), ev("experiment.verdict", { experiment_id: X, outcome: "verdict" })]);
    check("conclude (pure): a second verdict refuses (VERDICTED) -- compute once", r.code === "VERDICTED", JSON.stringify(r).slice(0, 300));
  }
  // An open is opened once: a CORRECTION to it (a superseding open) counts as a second open, and so does an identical
  // re-open. The corrected open kept governing, and a re-open restarted the TTL (PR 3a round-2 logic attack).
  {
    const evs = base();
    const corrected = opened({ arms: ["+challenger", "+champion"] });
    corrected.supersedes = evs[0].id;
    const r1 = conclude([...evs, corrected]);
    const r2 = conclude([...base(), opened({ surface: "page-two" })]);
    check("an open corrected by a superseding open refuses (ARMS_REDECLARED), and a second identical-armed open refuses (OPENED_TWICE)", r1.code === "ARMS_REDECLARED" && r2.code === "OPENED_TWICE", `${r1.code} ${r2.code}`);
  }
  // A supersede CHAIN keeps its head: r3 corrects r2 corrects r1, and only r3 counts. The old rule brought r1 back.
  {
    const B = await import(pathToFileURL(S("evolve", "board.mjs")).href);
    const u = V["+champion"][5];
    const r1 = measured(u, 1);
    const r2 = measured(u, 0, {}, { supersedes: r1.id });
    const r3 = measured(u, 0, {}, { supersedes: r2.id });
    const kept = B.applySupersedes([r1, r2, r3]).kept.map((e) => e.id);
    const r = conclude([...base(), r1, r2, r3]);
    check("a supersede chain keeps only its head (r3), never the receipt its own correction retracted", JSON.stringify(kept) === JSON.stringify([r3.id]) && r.ok && r.ok.payload.n_per_arm["+champion"] === 6, `kept=${kept.length} ${JSON.stringify(r).slice(0, 200)}`);
    const x1 = measured(u, 1), x2 = measured(u, 0);
    x1.supersedes = x2.id; x2.supersedes = x1.id; x2.ts = x1.ts;
    const cyc = B.applySupersedes([x1, x2]);
    check("a supersede CYCLE takes no effect -- both receipts stay, and both supersedes are refused", cyc.kept.length === 2 && cyc.refused === 2, JSON.stringify(cyc).slice(0, 200));
  }
  // The board flags a swap of the arms, in declared order (the sorted comparison read the swap as no change).
  {
    const B = await import(pathToFileURL(S("evolve", "board.mjs")).href);
    const swapped = B.foldExperiments([opened(), opened({ surface: "page-two", arms: ["+challenger", "+champion"] })]).experiments.get(X);
    const same = B.foldExperiments([opened(), opened({ surface: "page-two" })]).experiments.get(X);
    check("the board flags a swapped re-declaration of the arms, and not an identical one", swapped.armsRedeclared === true && same.armsRedeclared === false, `${swapped.armsRedeclared} ${same.armsRedeclared}`);
  }
  // FIXED HORIZON: a test computed at floor that did not clear is RECORDED as no-verdict, and conclude never runs again.
  // A test not yet computable is refused and records nothing (PR 3a round-2 logic attack: re-run until it wins).
  {
    const weak = [opened(), ...five("+champion").map((u, i) => measured(u, i < 3 ? 1 : 0)), ...five("+challenger").map((u, i) => measured(u, i < 4 ? 1 : 0))];
    const r = conclude(weak);
    check("conclude (pure): a test computed at floor that did not clear is recorded -- outcome no-verdict, with its bound", r.ok && r.ok.kind === "experiment.verdict" && r.ok.payload.outcome === "no-verdict" && r.ok.payload.bound < 0 && /NO VERDICT, and it is final/.test(r.ok.lines[0]), JSON.stringify(r).slice(0, 300));
    const again = conclude([...weak, ev("experiment.verdict", r.ok ? r.ok.payload : { experiment_id: X, outcome: "no-verdict" })]);
    check("conclude (pure): after a recorded no-verdict, conclude refuses (VERDICTED) -- never re-run as the data grows", again.code === "VERDICTED", JSON.stringify(again).slice(0, 200));
    const short = conclude([opened(), ...five("+champion").slice(0, 4).map((u) => measured(u, 0)), ...five("+challenger").slice(0, 4).map((u) => measured(u, 1))]);
    check("conclude (pure): below floor nothing is computed, so nothing is recorded (NO_VERDICT, a refusal)", short.code === "NO_VERDICT", JSON.stringify(short).slice(0, 200));
  }
  {
    const m = run(W.planMeasure, base(), { experiment: X, unit: "p-y", metric: "converted", value: "1", count: "0", window: "2026-09-01..2026-09-07", source: "s" });
    check("measure (pure): zero observations refuses -- a value over none is not a measurement", m.code === "BAD_ARGS" && /at least 1/.test(m.msg), JSON.stringify(m));
  }
}

// ---- evolve CLI: plan -> apply bound by --expect, over a scratch repo that declares an evolve section ----
{
  const fix = join(tmp, "evolve-repo");
  mkdirSync(join(fix, "products", "fixmod"), { recursive: true });
  mkdirSync(join(fix, "app"), { recursive: true });
  const PAGE = "export default function Page() { return null }\n";
  writeFileSync(join(fix, "app", "page.tsx"), PAGE);
  writeFileSync(join(fix, "products", "fixmod", "manifest.json"), JSON.stringify({
    name: "fixmod",
    evolve: {
      metrics: [{ name: "converted", source_event: "metric.observed", aggregation: "rate", direction: "higher-is-better", role: "primary" }],
      experiments: [{ surface_file: "app/page.tsx", variant_grammar: "page@1.0.0", split: [50, 50], excluded_categories: ["legal"] }],
      evals: { holdout_rule: "cohort-50-50", per_arm_floor: 5, minimum_effect_rule: "mde-at-80-power", test_id: "newcombe-wilson-difference-v1", alpha: 0.05, effect_floor: 0 },
      promote_via: ["app/page.tsx"],
    },
  }, null, 2));
  const evolveOn = (sp) => (args, env = {}) => node([S("evolve", "arc-evolve.mjs"), ...args, "--root", sp, "--repo", fix], env);
  /** A plan, then its apply bound by the digest the plan printed. */
  const planApply = (evolve, args, env = {}) => {
    const p = evolve(args, env);
    const d = p.status === 0 ? lastExpect(p.stdout) : null;
    return { p, d, a: d ? evolve([...args, "--expect", d], env) : null };
  };
  const OPEN = (x) => ["open", "--experiment", x, "--module", "fixmod", "--surface", "page", "--target", "app/page.tsx", "--arms", "+champion,+challenger"];

  const sp = spine("evolve");
  const ev = evolveOn(sp);
  const empty = fingerprint(sp);
  const openPlan = ev(OPEN("x-suite"));
  const openDigest = lastExpect(openPlan.stdout);
  check("evolve open: the plan wrote nothing, and its LAST line is the digest the apply is bound to", openPlan.status === 0 && /sealed at/.test(openPlan.stdout) && !!openDigest && fingerprint(sp) === empty && openPlan.stdout.includes(`--expect ${openDigest}`), `${openPlan.status} ${openPlan.stderr}`);
  const openApply = ev([...OPEN("x-suite"), "--expect", openDigest || "x"]);
  const openId = receiptOf(openApply.stdout);
  check("evolve open, applied with --expect: the receipt it prints is on the spine", openApply.status === 0 && ULID.test(openId) && spineEvents(sp).some((e) => e.id === openId && e.kind === "experiment.opened"), `${openApply.status} ${openApply.stderr}`);
  const zeros = ev([...OPEN("x-zeros"), "--expect", "0".repeat(64)]);
  check("evolve apply with a digest no plan printed refuses (PLAN_STALE) and writes nothing", zeros.status === 2 && /PLAN_STALE/.test(zeros.stderr) && spineEvents(sp).length === 1, zeros.stderr);
  const junk = ev([...OPEN("x-junk"), "--expect", "abc"]);
  check("evolve apply with a malformed digest refuses", junk.status === 2 && /64-hex/.test(junk.stderr), junk.stderr);
  const again = ev(OPEN("x-suite"));
  check("evolve open: the same experiment twice refuses (ALREADY_OPEN)", again.status === 2 && /ALREADY_OPEN/.test(again.stderr), again.stderr);
  const nosurf = ev(["open", "--experiment", "x-other", "--module", "fixmod", "--surface", "page", "--target", "app/other.tsx", "--arms", "+a,+b"]);
  check("evolve open: a file the module does not declare as a surface refuses (NOT_A_SURFACE)", nosurf.status === 2 && /NOT_A_SURFACE/.test(nosurf.stderr), nosurf.stderr);
  const flagValue = ev(["conclude", "--experiment", "--repo", "x"]);
  check("evolve: a flag handed as another flag's value refuses (--experiment --repo)", flagValue.status === 2 && /needs a value/.test(flagValue.stderr), flagValue.stderr);

  const A = await import(pathToFileURL(S("evolve", "assign.mjs")).href);
  const perArm = { "+champion": [], "+challenger": [] };
  let genUnit = null;
  for (let i = 0; i < 400 && (perArm["+champion"].length < 6 || perArm["+challenger"].length < 5 || !genUnit); i++) {
    const g = A.assign("x-suite", `u-${i}`, ["+champion", "+challenger"], [50, 50]);
    if (g.cohort === "verdict" && perArm[g.arm].length < (g.arm === "+champion" ? 6 : 5)) perArm[g.arm].push(`u-${i}`);
    if (g.cohort === "generation" && !genUnit) genUnit = `u-${i}`;
  }
  check("fixture: verdict-cohort units per arm and a generation unit exist (vacuous-pass guard)", perArm["+champion"].length === 6 && perArm["+challenger"].length === 5 && !!genUnit);
  const MEASURE = (unit, value, window = "2026-09-01..2026-09-07") => ["measure", "--experiment", "x-suite", "--unit", unit, "--metric", "converted", "--value", String(value), "--count", "1", "--window", window, "--source", "src-1"];
  let landed = 0;
  for (const u of perArm["+champion"].slice(0, 5)) if (planApply(ev, MEASURE(u, 0)).a?.status === 0) landed++;
  for (const u of perArm["+challenger"]) if (planApply(ev, MEASURE(u, 1)).a?.status === 0) landed++;
  check("evolve measure: 10 measurements planned and applied, each bound to its plan", landed === 10, `landed=${landed}`);
  const gen = planApply(ev, MEASURE(genUnit, 1));
  check("evolve measure: a generation-cohort unit is measured too (it counts toward nothing in the verdict)", gen.a?.status === 0 && /generation cohort/.test(gen.p.stdout), `${gen.p.status} ${gen.p.stderr}`);
  const notMetric = ev(["measure", "--experiment", "x-suite", "--unit", "u-x", "--metric", "nope", "--value", "1", "--count", "1", "--window", "2026-09-01..2026-09-07", "--source", "s"]);
  check("evolve measure: a metric the module does not declare refuses (NOT_A_METRIC)", notMetric.status === 2 && /NOT_A_METRIC/.test(notMetric.stderr), notMetric.stderr);

  // Planned BEFORE the verdict, applied AFTER it: the apply re-checks, so fixed horizon holds at write time (PR 3a).
  const late = ev(MEASURE(perArm["+champion"][5], 1, "2026-09-08..2026-09-14"));
  const lateDigest = lastExpect(late.stdout);
  // Two conclude plans; the second is applied after the first landed.
  const c1 = ev(["conclude", "--experiment", "x-suite"]);
  const c2 = ev(["conclude", "--experiment", "x-suite"]);
  const d1 = lastExpect(c1.stdout), d2 = lastExpect(c2.stdout);
  check("evolve conclude: a verdict is planned from the receipts (exit 0)", c1.status === 0 && /conclude x-suite/.test(c1.stdout) && !!d1 && d1 === d2 && !!lateDigest, `${c1.status} ${c1.stderr}`);
  const a1 = ev(["conclude", "--experiment", "x-suite", "--expect", d1]);
  const verdictId = receiptOf(a1.stdout);
  const verdict = spineEvents(sp).find((e) => e.id === verdictId);
  check("evolve conclude, applied: the verdict lands on the spine", a1.status === 0 && !!verdict && verdict.kind === "experiment.verdict", `${a1.status} ${a1.stderr}`);
  check("evolve conclude: n per arm is the verdict cohort's 5 each, and the delta is the whole difference",
    !!verdict && verdict.payload.n_per_arm["+champion"] === 5 && verdict.payload.n_per_arm["+challenger"] === 5 && verdict.payload.delta === 1 && verdict.payload.bound > 0 && /^[0-9a-f]{64}$/.test(verdict.payload.config_hash), JSON.stringify(verdict && verdict.payload));
  const a2 = ev(["conclude", "--experiment", "x-suite", "--expect", d2]);
  check("evolve conclude: a second plan applied after the verdict refuses (VERDICTED) -- compute once holds at apply", a2.status === 2 && /VERDICTED/.test(a2.stderr) && spineEvents(sp).filter((e) => e.kind === "experiment.verdict").length === 1, a2.stderr);
  const lateApply = ev([...MEASURE(perArm["+champion"][5], 1, "2026-09-08..2026-09-14"), "--expect", lateDigest || "x"]);
  check("evolve measure: planned before the verdict, applied after it, refuses (VERDICTED) -- fixed horizon holds at apply", lateApply.status === 2 && /VERDICTED/.test(lateApply.stderr), lateApply.stderr);

  // The cap, re-counted at apply: three opens planned while none was open, then all applied (PR 3a logic attack).
  const sp3 = spine("evolve-cap");
  const ev3 = evolveOn(sp3);
  const plans = ["x-c1", "x-c2", "x-c3"].map((x) => ({ x, p: ev3(OPEN(x)) }));
  check("cap fixture: all three opens plan while nothing is open (vacuous-pass guard)", plans.every(({ p }) => p.status === 0 && lastExpect(p.stdout)));
  const applied = plans.map(({ x, p }) => ev3([...OPEN(x), "--expect", lastExpect(p.stdout)]));
  check("evolve open: the third of three planned opens refuses at apply (CONCURRENCY_CAP), the first two land", applied[0].status === 0 && applied[1].status === 0 && applied[2].status === 2 && /CONCURRENCY_CAP/.test(applied[2].stderr), applied.map((r) => `${r.status} ${r.stderr.trim()}`).join(" | "));

  // The SAME three opens, applied at once: the apply's read, check and write are one locked step, so the cap holds even
  // when the applies race (PR 3a round-2 logic attack: all three landed).
  const sp6 = spine("evolve-race");
  const ev6 = evolveOn(sp6);
  const racePlans = ["x-r1", "x-r2", "x-r3"].map((x) => ({ x, d: lastExpect(ev6(OPEN(x)).stdout) }));
  const raced = await Promise.all(racePlans.map(({ x, d }) => new Promise((resolveRun) => {
    const c = spawn(process.execPath, [S("evolve", "arc-evolve.mjs"), ...OPEN(x), "--expect", d || "x", "--root", sp6, "--repo", fix], { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    c.stderr.on("data", (b) => { err += b; });
    c.on("close", (code) => resolveRun({ code, err }));
  })));
  const openedRace = spineEvents(sp6).filter((e) => e.kind === "experiment.opened").length;
  check("evolve open: three planned opens applied AT ONCE -- two land, one refuses (CONCURRENCY_CAP), never three", racePlans.every(({ d }) => !!d) && openedRace === 2 && raced.filter((r) => r.code === 0).length === 2 && raced.some((r) => r.code === 2 && /CONCURRENCY_CAP/.test(r.err)), `opened=${openedRace} ${raced.map((r) => r.code + ":" + r.err.trim()).join(" | ")}`);

  // A moved surface between plan and apply: the payload's seal changes, so the digest does.
  const sp4 = spine("evolve-drift");
  const ev4 = evolveOn(sp4);
  const dp = ev4(OPEN("x-drift"));
  writeFileSync(join(fix, "app", "page.tsx"), "export default function Page() { return 'moved' }\n");
  const da = ev4([...OPEN("x-drift"), "--expect", lastExpect(dp.stdout) || "x"]);
  writeFileSync(join(fix, "app", "page.tsx"), PAGE);
  check("evolve open: a surface that moved between plan and apply refuses (PLAN_STALE), nothing written", dp.status === 0 && da.status === 2 && /PLAN_STALE/.test(da.stderr) && spineEvents(sp4).length === 0, `${dp.status} ${da.status} ${da.stderr}`);

  // TTL through the CLI: an open written thirty days ago with a seven-day TTL (the spine's test clock), then measured now.
  const sp5 = spine("evolve-ttl");
  const ev5 = evolveOn(sp5);
  const past = { ARC_SPINE_NOW: String(Date.now() - 30 * 86_400_000) };
  const oldOpen = planApply(ev5, [...OPEN("x-old"), "--ttl", "7"], past);
  const exp = ev5(MEASURE(perArm["+champion"][0], 1).map((a) => (a === "x-suite" ? "x-old" : a)));
  check("evolve measure: an experiment past its TTL refuses (EXPIRED), through the CLI", oldOpen.a?.status === 0 && exp.status === 2 && /EXPIRED/.test(exp.stderr), `${oldOpen.a?.status} ${oldOpen.a?.stderr} :: ${exp.stderr}`);

  const real = node([S("evolve", "arc-evolve.mjs"), "open", "--experiment", "x-real", "--module", "core", "--surface", "hero", "--target", "app/home/hero.tsx", "--arms", "+a,+b", "--root", spine("evolve-real")]);
  check("evolve open on THIS tree refuses by name: no product here declares an evolve section", real.status === 2 && /NO_EVOLVE_SECTION/.test(real.stderr), real.stderr);
}

// ---- the proposal tool, APPLIED, in a scratch repository (ADR-1340: its apply path is proven here, never on the real
// tree): a branch appears, the owner's tree does not move, the approval names the branch it wrote, the apply is bound
// to its plan, and the law is measured on the bytes ----
{
  const repo = join(tmp, "scratch-repo");
  cpSync(join(REPO, ".claude", "scripts"), join(repo, ".claude", "scripts"), { recursive: true });
  mkdirSync(join(repo, "engine"), { recursive: true });
  writeFileSync(join(repo, "engine", "router.yaml"), readFileSync(join(REPO, "engine", "router.yaml"), "utf8"));
  writeFileSync(join(repo, "hq.policy.yaml"), readFileSync(join(REPO, "hq.policy.yaml"), "utf8"));
  const g = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
  g("init", "-q", "-b", "main");
  g("config", "user.name", "fixture"); g("config", "user.email", "fixture@example.invalid"); g("config", "commit.gpgsign", "false");
  g("add", "-A"); g("commit", "-q", "-m", "scratch");
  const mainBefore = g("rev-parse", "refs/heads/main").stdout.trim();
  check("scratch repository committed on main (vacuous-pass guard)", /^[0-9a-f]{40}$/.test(mainBefore));
  const sp = spine("scratch-spine");
  const inScratch = (script, args, extraNode = []) => spawnSync(process.execPath, [...extraNode, join(repo, ".claude", "scripts", ...script.split("/")), ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: sp }, timeout: 120_000 });
  const approvals = () => spineEvents(sp).filter((e) => e.kind === "approval.requested");
  const clean = () => g("status", "--porcelain").stdout === "" && g("symbolic-ref", "HEAD").stdout.trim() === "refs/heads/main" && g("rev-parse", "refs/heads/main").stdout.trim() === mainBefore;
  // THE LAW, on bytes: the two law files as the working tree and main hold them.
  const law = () => [
    sha256(readFileSync(join(repo, "engine", "router.yaml"))), sha256(readFileSync(join(repo, "hq.policy.yaml"))),
    g("rev-parse", "main:engine/router.yaml").stdout.trim(), g("rev-parse", "main:hq.policy.yaml").stdout.trim(),
  ].join("|");
  const law0 = law();

  const WHY = ["--why", "the kernel suite proposes this"];
  const DRIVER = ["driver", "--class", "review-diff", "--to", "codex"];
  const plan = inScratch("engine/propose.mjs", [...DRIVER, ...WHY, "--dry-run"]);
  const digest = lastExpect(plan.stdout);
  const dBranch = "feat/face-engine-driver-codex-review-diff";
  check("propose driver, planned: the diff and a digest, and no branch, no receipt", plan.status === 0 && !!digest && /\+ {4}driver: codex/.test(plan.stdout) && g("rev-parse", "--verify", "--quiet", `refs/heads/${dBranch}`).status !== 0 && approvals().length === 0, `${plan.status} ${plan.stderr}`);
  const dp = inScratch("engine/propose.mjs", [...DRIVER, ...WHY, "--expect", digest || "x"]);
  const dAppr = approvals().find((e) => e.payload.branch === dBranch);
  check("propose driver, applied with --expect: the branch exists with the one-line change, and the tree did not move",
    dp.status === 0 && g("rev-parse", "--verify", "--quiet", `refs/heads/${dBranch}`).status === 0 && g("diff", "--name-only", "main", dBranch).stdout.trim() === "engine/router.yaml" && clean(), `${dp.status} ${dp.stderr}`);
  check("propose driver, applied: the approval names the branch and the commit it wrote",
    !!dAppr && dAppr.payload.gate === "router-merge" && dAppr.payload.commit === g("rev-parse", dBranch).stdout.trim() && receiptOf(dp.stdout) === dAppr.id);
  /** A plan, then its apply bound by the digest the plan printed -- the only apply propose accepts. */
  const planThenApply = (args, extraNode = []) => {
    const p = inScratch("engine/propose.mjs", [...args, "--dry-run"]);
    const d = lastExpect(p.stdout);
    return { p, d, a: inScratch("engine/propose.mjs", [...args, "--expect", d || "x"], extraNode) };
  };
  const unbound = inScratch("engine/propose.mjs", ["driver", "--class", "kickoff-plan", "--to", "codex"]);
  check("propose applied with no plan digest refuses -- an apply is bound to a plan, by hand as by the door", unbound.status === 2 && /bound to a plan/.test(unbound.stderr) && g("rev-parse", "--verify", "--quiet", "refs/heads/feat/face-engine-driver-codex-kickoff-plan").status !== 0, unbound.stderr);
  const again = inScratch("engine/propose.mjs", [...DRIVER, ...WHY, "--expect", digest || "x"]);
  check("propose driver, applied twice: the second refuses (BRANCH_EXISTS) and raises nothing", again.status === 2 && /BRANCH_EXISTS/.test(again.stderr) && approvals().filter((e) => e.payload.branch === dBranch).length === 1, again.stderr);
  // The digest covers the reason: an apply with a --why the plan never showed refuses (PR 3a round-2 logic attack).
  const whyPlan = inScratch("engine/propose.mjs", ["driver", "--class", "kickoff-plan", "--to", "codex", "--why", "the reason the owner read", "--dry-run"]);
  const whyApply = inScratch("engine/propose.mjs", ["driver", "--class", "kickoff-plan", "--to", "codex", "--why", "a reason nobody planned", "--expect", lastExpect(whyPlan.stdout) || "x"]);
  check("propose applied with a --why the plan never showed refuses (PLAN_STALE) and writes nothing", whyPlan.status === 0 && whyApply.status === 2 && /PLAN_STALE/.test(whyApply.stderr) && g("rev-parse", "--verify", "--quiet", "refs/heads/feat/face-engine-driver-codex-kickoff-plan").status !== 0, `${whyPlan.status} ${whyApply.status} ${whyApply.stderr}`);
  const hermes = inScratch("engine/propose.mjs", ["driver", "--class", "review-diff", "--to", "hermes", "--dry-run"]);
  check("propose driver to the agent runtime without its terms refuses at the plan, in the router loader's words", hermes.status === 2 && /would not load/.test(hermes.stderr), hermes.stderr);
  const tp = planThenApply(["tier", "--class", "face-ask", "--to", "cheap-scan"]);
  check("propose tier for face-ask, planned and applied: the approval lands (the secret scanner no longer reads the branch as a key)", tp.p.status === 0 && tp.a.status === 0 && approvals().some((e) => e.payload.gate === "model-policy" && e.payload.branch === "feat/face-engine-tier-cheap-scan-face-ask") && clean(), `${tp.a.status} ${tp.a.stderr}`);

  // A cleanup that fails AFTER the branch is written is not the outcome: the proposal succeeded. A preload makes EVERY
  // rmSync of the writer's temp dirs throw EBUSY -- the index, the diff, the hooks dir -- the way a scanner holding the
  // file does (PR 3a shell attack; the round-2 attack showed a shim on the index alone left two of them unpinned).
  const shim = join(tmp, "rm-busy.mjs");
  writeFileSync(shim, [
    "import fs from \"node:fs\";",
    "import { syncBuiltinESMExports } from \"node:module\";",
    "const real = fs.rmSync;",
    "fs.rmSync = (p, o) => { if (String(p).includes(\"arc-proposal-\")) { const e = new Error(\"EBUSY: resource busy or locked\"); e.code = \"EBUSY\"; throw e; } return real(p, o); };",
    "syncBuiltinESMExports();",
    "",
  ].join("\n"));
  const busy = planThenApply(["tier", "--class", "commit-msg-draft", "--to", "high-judgment"], ["--import", pathToFileURL(shim).href]);
  check("propose, applied, with every temp-dir cleanup throwing: exit 0, the wrote line, the receipt -- never a failure", busy.a.status === 0 && /propose: wrote feat\/face-engine-tier-high-judgment-commit-msg-draft/.test(busy.a.stdout) && ULID.test(receiptOf(busy.a.stdout)), `${busy.a.status} ${busy.a.stderr}`);

  check("THE LAW: after every proposal, engine/router.yaml and hq.policy.yaml are byte-identical in the tree and on main", law() === law0, law());
  // MUTANT CONTROL: a tool that writes the router in place through fs.promises and a joined path -- the shape a source
  // grep walks past (PR 3a logic attack) -- is caught by the same measurement.
  mkdirSync(join(repo, ".claude", "scripts", "fixture"), { recursive: true });
  writeFileSync(join(repo, ".claude", "scripts", "fixture", "mutant.mjs"), [
    "import { promises } from \"node:fs\";",
    "const parts = [\"engine\", [\"router\", \"yaml\"].join(\".\")];",
    "await promises.appendFile(parts.join(\"/\"), \"# a mutant was here\\n\");",
    "",
  ].join("\n"));
  const mutant = inScratch("fixture/mutant.mjs", []);
  check("MUTANT CONTROL: an in-place write the grep could not see moves the law measurement", mutant.status === 0 && law() !== law0, `${mutant.status} ${mutant.stderr}`);
  g("checkout", "--", "engine/router.yaml");

  // Bound to its plan: main moves after the plan, and the apply with the plan's digest refuses (PR 3a attacks, both).
  const STALE = ["driver", "--class", "commit-msg-draft", "--to", "codex"];
  const sPlan = inScratch("engine/propose.mjs", [...STALE, "--dry-run"]);
  const sDigest = lastExpect(sPlan.stdout);
  // Edited from MAIN's bytes, never the checkout's: a Windows runner checks the router out with CRLF, a replace keyed
  // on LF matched nothing, main never moved, and the check could not fire (CI, PR 3a round 2).
  const mainRouter = g("show", "main:engine/router.yaml").stdout;
  const moved = mainRouter.replace("  kickoff-plan:\n", "  kickoff-plan:\n    # main moved after the plan\n");
  writeFileSync(join(repo, "engine", "router.yaml"), moved);
  g("commit", "-q", "-am", "main moves");
  const mainMoved = moved !== mainRouter && g("rev-parse", "refs/heads/main").stdout.trim() !== mainBefore;
  const sApply = inScratch("engine/propose.mjs", [...STALE, "--expect", sDigest || "x"]);
  check("propose, applied after main moved: refuses (PLAN_STALE) and writes no branch", mainMoved && sPlan.status === 0 && !!sDigest && sApply.status === 2 && /PLAN_STALE/.test(sApply.stderr) && g("rev-parse", "--verify", "--quiet", "refs/heads/feat/face-engine-driver-codex-commit-msg-draft").status !== 0, `${sPlan.status} ${sApply.status} ${sApply.stderr}`);
}

// ---- the door: an effect past the spine is refused on a sim door; an expect row's apply carries its plan's digest ----
{
  const DOOR = await import(pathToFileURL(S("hq", "lib", "face", "work-door.mjs")).href);
  const fx = join(tmp, "effect-repo");
  mkdirSync(join(fx, ".claude", "scripts", "fixture"), { recursive: true });
  const marker = join(tmp, "effect-ran.txt");
  writeFileSync(join(fx, ".claude", "scripts", "fixture", "effect.mjs"),
    `import { writeFileSync } from "node:fs";\nif (process.argv[2] === "--dry-run") { console.log("would write a proposal"); process.exit(0); }\nwriteFileSync(${JSON.stringify(marker)}, "ran");\n`);
  const registry = [{ id: "fixture.effect", room: "fixture", label: "effect", receipt: { kind: "note.logged" }, humanRun: true, spends: false, touchesFiles: true, fields: [],
    plan: () => ({ script: "fixture/effect.mjs", args: ["--dry-run"] }), apply: () => ({ script: "fixture/effect.mjs", args: [] }) }];
  const sp = spine("door");
  const sim = DOOR.createWorkDoor({ mode: "sim", root: sp, repo: fx }, { registry });
  const p = await sim.plan("fixture.effect", { input: {} });
  check("door: an effect op PLANS on a sim door (its dry run writes nothing)", p.ok === true && /new feat.face-. branch, never to main/.test(p.diff), JSON.stringify(p).slice(0, 200));
  let code = null;
  try { sim.apply("fixture.effect", { planId: p.planId, confirm: "fixture.effect" }); } catch (e) { code = e.code; }
  check("door: a sim door refuses the effect's apply -> SIM_EFFECT, and the tool never ran", code === "SIM_EFFECT" && DOOR.WORK_STATUS.SIM_EFFECT === 403 && !existsSync(marker), `code=${code}`);
  let again = null;
  try { sim.apply("fixture.effect", { planId: p.planId, confirm: "fixture.effect" }); } catch (e) { again = e.code; }
  check("door: the refused plan is still held, and refused the same way again", again === "SIM_EFFECT");
  const live = DOOR.createWorkDoor({ mode: "live", root: sp, repo: fx }, { registry });
  const lp = await live.plan("fixture.effect", { input: {} });
  live.apply("fixture.effect", { planId: lp.planId, confirm: "fixture.effect" });
  await live.settled();
  check("door: a LIVE door runs the same apply (the refusal is the sim door's, not the op's)", existsSync(marker) && readFileSync(marker, "utf8") === "ran");

  // An expect row: the apply the door runs is the row's apply plus the digest the plan printed, and nothing else.
  const argsSeen = join(tmp, "bound-args.json");
  const DIGEST = "c".repeat(64);
  writeFileSync(join(fx, ".claude", "scripts", "fixture", "bound.mjs"),
    `import { writeFileSync } from "node:fs";\nif (process.argv[2] === "--plan") { console.log("a plan"); console.log(JSON.stringify({ expect: ${JSON.stringify(DIGEST)} })); process.exit(0); }\nif (process.argv[2] === "--plan-bare") { console.log("a plan with no digest"); process.exit(0); }\nwriteFileSync(${JSON.stringify(argsSeen)}, JSON.stringify(process.argv.slice(2)));\n`);
  const bound = (planArg) => [{ id: "fixture.bound", room: "fixture", label: "bound", receipt: { kind: "note.logged" }, humanRun: false, spends: false, touchesFiles: false, expect: true, fields: [],
    plan: () => ({ script: "fixture/bound.mjs", args: [planArg] }), apply: () => ({ script: "fixture/bound.mjs", args: ["apply"] }) }];
  const bdoor = DOOR.createWorkDoor({ mode: "live", root: sp, repo: fx }, { registry: bound("--plan") });
  const bp = await bdoor.plan("fixture.bound", { input: {} });
  bdoor.apply("fixture.bound", { planId: bp.planId });
  await bdoor.settled();
  const seen = existsSync(argsSeen) ? JSON.parse(readFileSync(argsSeen, "utf8")) : null;
  check("door: an expect row's apply carries --expect and the digest its plan printed, and nothing else", JSON.stringify(seen) === JSON.stringify(["apply", "--expect", DIGEST]) && bp.apply.endsWith(`--expect ${DIGEST}`), JSON.stringify(seen));
  const bare = DOOR.createWorkDoor({ mode: "live", root: sp, repo: fx }, { registry: bound("--plan-bare") });
  let noExpect = null;
  try { await bare.plan("fixture.bound", { input: {} }); } catch (e) { noExpect = e.code; }
  check("door: an expect row whose plan printed no digest is refused (NO_EXPECT, 502), never applied unbound", noExpect === "NO_EXPECT" && DOOR.WORK_STATUS.NO_EXPECT === 502, `code=${noExpect}`);
}

// ---- the writer's own refusal of the law files, whatever a caller allows ----
{
  const PB = await import(pathToFileURL(S("core", "proposal-branch.mjs")).href);
  let ug = null;
  try { PB.checkFiles([{ path: "hq.policy.yaml", content: "x" }], ["hq.policy.yaml"]); } catch (e) { ug = e.code; }
  check("the proposal-branch writer refuses hq.policy.yaml even when a caller allows it (UNGRANTABLE)", ug === "UNGRANTABLE");
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 60 ? 0 : 1);
