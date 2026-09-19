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
//   bench        --propose --from proposes from a run that already happened, bound to its plan's digest
//   absorb       pin and trial write their branch and raise their approval in a scratch repo, each bound to its plan;
//                a trial whose approval the spine would refuse is refused before the seal burns its correlation
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
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
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

// ---- the spine's secret scanner joins the CALLER's strings, not the ones the emitter makes from the clock (PR 3b
// attacks: the idem, a fresh hash per call, sat beside a caller's string in the joined views, so one payload was
// accepted by a dry run and refused by the emit, or the other way round). An actor ending in "sk-" sat beside the idem
// in the reversed view EVERY time: refused always before, accepted now -- and a key split across two caller fields is
// still caught (the view exists for that). ----
{
  const sp = spine("redact-join");
  const dry = (payload, actor) => node([S("hq", "arc-event.mjs"), "emit", "note.logged", "--payload", JSON.stringify(payload), ...(actor ? ["--actor", actor] : []), "--dry-run"], { ARC_SPINE_ROOT: sp });
  const runs = Array.from({ length: 3 }, () => dry({ note: "probe" }, "bench-task-"));
  check("spine scan: an actor ending in sk- is not joined with the clock-made idem into a key (accepted, three times running)", runs.every((r) => r.status === 0), runs.map((r) => `${r.status} ${r.stderr.trim()}`).join(" | "));
  const split = dry({ note: "probe", a: "sk-", b: "Q".repeat(40) });
  check("spine scan: a key split across two CALLER fields is still refused (SECRET) -- the adjacency view stays", split.status === 2 && /SECRET/.test(split.stderr), `${split.status} ${split.stderr}`);
  // Only what THIS call made is left out: a caller-supplied --idem is the caller's string (PR 3b round-2 logic attack).
  const idemSplit = node([S("hq", "arc-event.mjs"), "emit", "note.logged", "--payload", JSON.stringify({ note: "probe" }), "--actor", "sk-", "--idem", "0123456789abcdef".repeat(4), "--dry-run"], { ARC_SPINE_ROOT: sp });
  check("spine scan: a key split across the actor and a CALLER-supplied idem is refused (SECRET)", idemSplit.status === 2 && /SECRET/.test(idemSplit.stderr), `${idemSplit.status} ${idemSplit.stderr}`);
  // ingest derives its own idem and ignores --idem: the flag's presence does not put the derived value in the joins.
  const ingestFile = join(tmp, "ingest-note.json");
  writeFileSync(ingestFile, JSON.stringify({ note: "probe" }));
  const ingestIdem = node([S("hq", "arc-event.mjs"), "ingest", "note.logged", "--json", ingestFile, "--actor", "xsk-", "--idem", "zz", "--dry-run"], { ARC_SPINE_ROOT: sp });
  check("spine scan: ingest's DERIVED idem stays out of the joins even when --idem is given (accepted)", ingestIdem.status === 0, `${ingestIdem.status} ${ingestIdem.stderr}`);
  // A refused experiment.verdict is quarantined as a stub: its payload is a result nobody reads before it is recorded.
  const qsp = spine("verdict-quarantine");
  const refusedVerdict = node([S("hq", "arc-event.mjs"), "emit", "experiment.verdict", "--payload", JSON.stringify({ experiment_id: "x-q", outcome: "verdict", bound: 0.4321, delta: 0.8765 }), "--strict"], { ARC_SPINE_ROOT: qsp });
  const qdir = join(qsp, "events", "_quarantine");
  const quarantined = existsSync(qdir) ? readdirSync(qdir).map((n) => readFileSync(join(qdir, n), "utf8")).join("\n") : "";
  check("a refused experiment.verdict is quarantined as a stub -- its bound and delta are not on disk", refusedVerdict.status === 2 && quarantined.length > 0 && !quarantined.includes("0.4321") && !quarantined.includes("0.8765"), `${refusedVerdict.status} ${quarantined.slice(0, 300)}`);
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
    // COMPUTE-ONCE AT THE DOOR (PR 3b logic attack): the plan says the test is computable, never its result, and a
    // refusal names what gates it, never the bound decide() computed anyway.
    const bound = r.ok ? String(r.ok.payload.bound) : "no-bound";
    const plan = r.ok ? r.ok.planLines.join("\n") : "";
    check("conclude (pure): the plan's lines carry neither the bound nor the outcome -- it is shown once recorded", !!r.ok && /the test is computable/.test(plan) && !plan.includes(bound) && !/NO VERDICT|lower bound|improvement/.test(plan), plan);
    const halfWindow = conclude([...weak, measured(five("+champion")[0], 1, { window_start: "2026-09-08", window_end: "2026-09-14" })]);
    check("conclude (pure): a refusal with a MISSING window names the window, and not the bound decide() computed", halfWindow.code === "NO_VERDICT" && /1 window\(s\) are MISSING/.test(halfWindow.msg) && !halfWindow.msg.includes(bound) && !/bound|delta/.test(halfWindow.msg), JSON.stringify(halfWindow).slice(0, 300));
    const grown = conclude([...weak.slice(0, 4), measured(five("+champion")[3], 1), ...weak.slice(5)]);
    check("conclude (pure): the plan binds the test's inputs -- one changed measurement is another bind", !!r.ok && !!grown.ok && JSON.stringify(grown.ok.bind) !== JSON.stringify(r.ok.bind) && r.ok.bind.metric_hash === r.ok.payload.metric_hash, JSON.stringify(grown).slice(0, 200));
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
  check("evolve conclude: the plan card shows no result, and the apply shows it once recorded -- compute once at the door",
    !!verdict && !c1.stdout.includes(String(verdict.payload.bound)) && !/lower bound|improvement/.test(c1.stdout) && /the test is computable/.test(c1.stdout)
      && a1.stdout.includes(`lower bound ${verdict.payload.bound}`) && a1.stdout.indexOf("lower bound") < a1.stdout.indexOf("receipt:"), `${c1.stdout}\n${a1.stdout}`);
  check("evolve conclude: n per arm is the verdict cohort's 5 each, and the delta is the whole difference",
    !!verdict && verdict.payload.n_per_arm["+champion"] === 5 && verdict.payload.n_per_arm["+challenger"] === 5 && verdict.payload.delta === 1 && verdict.payload.bound > 0 && /^[0-9a-f]{64}$/.test(verdict.payload.config_hash), JSON.stringify(verdict && verdict.payload));
  const a2 = ev(["conclude", "--experiment", "x-suite", "--expect", d2]);
  check("evolve conclude: a second plan applied after the verdict refuses (VERDICTED) -- compute once holds at apply", a2.status === 2 && /VERDICTED/.test(a2.stderr) && spineEvents(sp).filter((e) => e.kind === "experiment.verdict").length === 1, a2.stderr);
  const lateApply = ev([...MEASURE(perArm["+champion"][5], 1, "2026-09-08..2026-09-14"), "--expect", lateDigest || "x"]);
  check("evolve measure: planned before the verdict, applied after it, refuses (VERDICTED) -- fixed horizon holds at apply", lateApply.status === 2 && /VERDICTED/.test(lateApply.stderr), lateApply.stderr);

  // THE SPINE'S ANSWER CANNOT DEPEND ON THE RESULT (PR 3b round-2 logic attack). An experiment id ending in "ghp_" joins
  // "verdict" plus the config hash into a GitHub-token shape, and "no-verdict" does not: judged in the outcome it would
  // record, the plan passed for a no-verdict and refused a verdict -- the refusal was the result. Both spellings are
  // judged, so this computable no-verdict is refused as a verdict would be, and nothing is recorded.
  {
    const spG = spine("evolve-ghp");
    const evG = evolveOn(spG);
    const XG = "x-k-ghp_";
    const armsG = { "+champion": [], "+challenger": [] };
    for (let i = 0; i < 400 && (armsG["+champion"].length < 5 || armsG["+challenger"].length < 5); i++) {
      const g = A.assign(XG, `g-${i}`, ["+champion", "+challenger"], [50, 50]);
      if (g.cohort === "verdict" && armsG[g.arm].length < 5) armsG[g.arm].push(`g-${i}`);
    }
    const opened = planApply(evG, OPEN(XG));
    let measured = 0;
    for (const arm of ["+champion", "+challenger"]) armsG[arm].forEach((u, i) => {
      if (planApply(evG, ["measure", "--experiment", XG, "--unit", u, "--metric", "converted", "--value", String(i < 3 ? 1 : 0), "--count", "1", "--window", "2026-09-01..2026-09-07", "--source", "src-1"]).a?.status === 0) measured++;
    });
    check("ghp fixture: the experiment is open and measured to floor on both arms (vacuous-pass guard)", opened.a?.status === 0 && measured === 10, `open=${opened.a?.status} measured=${measured}`);
    const plan = evG(["conclude", "--experiment", XG]);
    check("evolve conclude: a no-verdict whose VERDICT spelling the spine would refuse is refused too -- the answer is the same whichever way the test goes",
      plan.status === 2 && /whichever way the test goes/.test(plan.stderr) && !spineEvents(spG).some((e) => e.kind === "experiment.verdict"), `${plan.status} ${plan.stderr}`);
  }

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

  // THE LOCK, WITHOUT THE TIMING (PR 3b shell attack: the race above depends on the three starts overlapping, so a
  // mutant could survive a staggered start). The suite HOLDS evolve's apply lock; one open lands first; two more applies
  // start and must wait -- nothing lands while the lock is held. Released, they go one at a time and re-read inside the
  // lock: exactly one lands and one refuses the cap. An apply that decided before taking the lock decided on one open,
  // and both would land.
  {
    const sp7 = spine("evolve-held");
    const ev7 = evolveOn(sp7);
    const held = ["x-h1", "x-h2", "x-h3"].map((x) => ({ x, d: lastExpect(ev7(OPEN(x)).stdout) }));
    const first = ev7([...OPEN("x-h1"), "--expect", held[0].d || "x"]);
    const lock = join(sp7, "events", ".evolve-apply.lock");
    writeFileSync(lock, "1:held-by-the-suite\n");
    const waiting = held.slice(1).map(({ x, d }) => new Promise((resolveRun) => {
      const c = spawn(process.execPath, [S("evolve", "arc-evolve.mjs"), ...OPEN(x), "--expect", d || "x", "--root", sp7, "--repo", fix], { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
      let err = "";
      c.stderr.on("data", (b) => { err += b; });
      c.on("close", (code) => resolveRun({ code, err }));
    }));
    await new Promise((r) => setTimeout(r, 4000));
    const whileHeld = spineEvents(sp7).filter((e) => e.kind === "experiment.opened").length;
    rmSync(lock, { force: true });
    const after = await Promise.all(waiting);
    const opened7 = spineEvents(sp7).filter((e) => e.kind === "experiment.opened").length;
    check("evolve open: while the apply lock is held nothing lands; released, the waiting applies re-read inside it -- one lands, one refuses the cap",
      first.status === 0 && whileHeld === 1 && opened7 === 2 && after.filter((r) => r.code === 0).length === 1 && after.some((r) => r.code === 2 && /CONCURRENCY_CAP/.test(r.err)),
      `first=${first.status} whileHeld=${whileHeld} opened=${opened7} ${after.map((r) => r.code + ":" + r.err.trim()).join(" | ")}`);
  }

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

// ---- bench: propose from a run that already happened -- nothing runs, nothing is spent, the apply bound to its plan ----
{
  const sp = spine("bench");
  const cand = join(tmp, "bench-cand");
  const champ = join(tmp, "bench-champ");
  // A mock run replays recorded bytes for every class; it takes tens of seconds, so it gets its own timeout.
  const run = spawnSync(process.execPath, [S("engine", "arc-bench.mjs"), "--driver", "mock", "--model", "mock", "--budget", "inr=1,min=5", "--out", cand],
    { cwd: REPO, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: sp }, timeout: 300_000 });
  check("fixture: a mock bench run (it spends nothing) is the candidate (vacuous-pass guard)", run.status === 0 && existsSync(join(cand, "scorecard.json")), `${run.status} ${String(run.stderr).slice(-300)}`);
  cpSync(cand, champ, { recursive: true });
  // A DIFFERENT run: a byte-identical copy of the candidate is the candidate, and is refused (PR 3b attacks). The
  // incumbent's own driver makes it another run with the same scores -- "decided on tie" stays the path under test.
  const champProvFile = join(champ, "provenance.json");
  const cp0 = JSON.parse(readFileSync(champProvFile, "utf8"));
  cp0.subject.driver = "claude-code";
  writeFileSync(champProvFile, JSON.stringify(cp0));
  const store = join(sp, "bench", "proposals");
  const kinds = () => spineEvents(sp).map((e) => e.kind);
  const count = (k) => kinds().filter((x) => x === k).length;
  const runsBefore = count("run.completed");
  const before = fingerprint(sp);
  const b = (...a) => node([S("engine", "arc-bench.mjs"), ...a], { ARC_SPINE_ROOT: sp });
  const dry = b("--propose", "--from", cand, "--champion", champ, "--dry-run");
  const digest = lastExpect(dry.stdout);
  check("bench --from --dry-run: computes the proposal, writes nothing, raises nothing, and prints its digest last", dry.status === 0 && /would propose/.test(dry.stdout) && !!digest && fingerprint(sp) === before && !existsSync(store), `${dry.status} ${dry.stderr}`);
  const stale = b("--propose", "--from", cand, "--champion", champ, "--expect", "0".repeat(64));
  check("bench --from with a digest no plan printed refuses (PLAN_STALE), writes nothing, raises nothing", stale.status === 2 && /PLAN_STALE/.test(stale.stderr) && count("approval.requested") === 0 && !existsSync(store), `${stale.status} ${stale.stderr}`);
  // Unbound, on a candidate with no proposal yet: the answer is "bound to a plan", never "already exists" (PR 3b logic
  // attack: run after the apply, the old check could not pass).
  const unboundFresh = b("--propose", "--from", cand, "--champion", champ);
  check("bench --from with no plan digest refuses -- an apply is bound to a plan (before any proposal exists)", unboundFresh.status === 2 && /bound to a plan/.test(unboundFresh.stderr) && count("approval.requested") === 0, unboundFresh.stderr);
  // THE BINDING, tested (PR 3b logic attack: a constant digest passed every other check): the champion's evidence
  // changes between the plan and the apply, and the apply is refused.
  {
    const champ2 = join(tmp, "bench-champ-swap");
    cpSync(champ, champ2, { recursive: true });
    const d2 = lastExpect(b("--propose", "--from", cand, "--champion", champ2, "--dry-run").stdout);
    const p2 = JSON.parse(readFileSync(join(champ2, "provenance.json"), "utf8"));
    p2.subject.ceilings_as_of = "1999-01-01";
    writeFileSync(join(champ2, "provenance.json"), JSON.stringify(p2));
    const swapped = b("--propose", "--from", cand, "--champion", champ2, "--expect", d2 || "x");
    check("bench --from: the champion's evidence changed between plan and apply refuses (PLAN_STALE), raises nothing", !!d2 && swapped.status === 2 && /PLAN_STALE/.test(swapped.stderr) && count("approval.requested") === 0, `${swapped.status} ${swapped.stderr}`);
  }
  // A COPY of the candidate is the candidate (PR 3b attacks: the spelling guard let a copy, or an upper-cased path, in).
  {
    const twin = join(tmp, "bench-cand-copy");
    cpSync(cand, twin, { recursive: true });
    const self = b("--propose", "--from", cand, "--champion", twin, "--dry-run");
    check("bench --from refuses a champion that is a byte-identical copy of the candidate (different runs, by content)", self.status === 2 && /different runs/.test(self.stderr), `${self.status} ${self.stderr}`);
  }
  // An apply that raised NOTHING does not block the next question (PR 3b logic attack: a champion with no class rows
  // proposed nothing, and the right champion was then refused "already exists" forever).
  {
    const empty = join(tmp, "bench-champ-empty");
    cpSync(champ, empty, { recursive: true });
    const sc = JSON.parse(readFileSync(join(empty, "scorecard.json"), "utf8"));
    sc.classes = [];
    writeFileSync(join(empty, "scorecard.json"), JSON.stringify(sc));
    const de = lastExpect(b("--propose", "--from", cand, "--champion", empty, "--dry-run").stdout);
    const ae = b("--propose", "--from", cand, "--champion", empty, "--expect", de || "x");
    check("bench --from against a champion with no rows proposes nothing and raises nothing (exit 0, no approval)", !!de && ae.status === 0 && count("approval.requested") === 0 && !/receipt:/.test(ae.stdout), `${ae.status} ${ae.stderr}`);
    // ONE APPLY AT A TIME per store (PR 3b round-2 attacks: two applies of one plan raised two approvals). A lock held
    // in the store refuses the next apply, and a pending mark with no id refuses it too.
    const emptyStore = existsSync(store) ? readdirSync(store).map((k) => join(store, k)).find((d) => !existsSync(join(d, "approval.id"))) : null;
    // A live holder: this test process, named in the numbered lock's token (host|pid|nonce).
    if (emptyStore) writeFileSync(join(emptyStore, ".apply.lock.00000000000000aa"), `${hostname()}|${process.pid}|test`);
    const locked = b("--propose", "--from", cand, "--champion", empty, "--expect", de || "x");
    check("bench --from: an apply while another holds the store's lock refuses and writes nothing", !!emptyStore && locked.status === 2 && /another apply of this proposal is running/.test(locked.stderr), `${locked.status} ${locked.stderr}`);
    if (emptyStore) { rmSync(join(emptyStore, ".apply.lock.00000000000000aa"), { force: true }); writeFileSync(join(emptyStore, "approval.pending"), "x\n"); }
    const pending = b("--propose", "--from", cand, "--champion", empty, "--expect", de || "x");
    check("bench --from: a pending mark with no approval id refuses -- an earlier apply may have raised it", pending.status === 2 && /may have raised its approval/.test(pending.stderr), `${pending.status} ${pending.stderr}`);
    if (emptyStore) rmSync(join(emptyStore, "approval.pending"), { force: true });
  }
  // WHO RAN is the subject: a champion that differs only in bookkeeping (the ceilings' date) is the same subject (PR 3b
  // round-3 logic attack), a champion whose provenance is null is refused by name, and a class listed twice is refused.
  {
    const booked = join(tmp, "bench-champ-bookkeeping");
    cpSync(cand, booked, { recursive: true });
    const p = JSON.parse(readFileSync(join(booked, "provenance.json"), "utf8"));
    p.subject.ceilings_as_of = "1999-01-01";
    writeFileSync(join(booked, "provenance.json"), JSON.stringify(p));
    const r1 = b("--propose", "--from", cand, "--champion", booked, "--dry-run");
    check("bench --from refuses a champion that differs from the candidate only in bookkeeping (same driver, version, model)", r1.status === 2 && /different subjects/.test(r1.stderr), `${r1.status} ${r1.stderr}`);
    const nulled = join(tmp, "bench-champ-null");
    cpSync(champ, nulled, { recursive: true });
    writeFileSync(join(nulled, "provenance.json"), "null");
    const r2 = b("--propose", "--from", cand, "--champion", nulled, "--dry-run");
    check("bench --from refuses a champion whose provenance is null, by name (no stack)", r2.status === 2 && /not a bench run's output/.test(r2.stderr) && !/at .*\.mjs:\d+/.test(r2.stderr), `${r2.status} ${r2.stderr}`);
    const twice = join(tmp, "bench-champ-twice");
    cpSync(champ, twice, { recursive: true });
    const sc = JSON.parse(readFileSync(join(twice, "scorecard.json"), "utf8"));
    sc.classes = [...sc.classes, sc.classes[0]];
    writeFileSync(join(twice, "scorecard.json"), JSON.stringify(sc));
    const r3 = b("--propose", "--from", cand, "--champion", twice, "--dry-run");
    check("bench --from refuses a scorecard that lists a task class twice", r3.status === 2 && /task class twice/.test(r3.stderr), `${r3.status} ${r3.stderr}`);
  }
  // AN UNKNOWN OUTCOME KEEPS THE PENDING MARK (PR 3b round-3 logic attack: an emit whose answer was not an id was read as
  // "not landed", the mark was removed, and the same plan raised the question twice). A preload makes the emitter answer
  // with a line that is not a receipt id.
  {
    const champU = join(tmp, "bench-champ-unknown");
    cpSync(champ, champU, { recursive: true });
    const pu = JSON.parse(readFileSync(join(champU, "provenance.json"), "utf8"));
    pu.subject.driver = "codex";
    writeFileSync(join(champU, "provenance.json"), JSON.stringify(pu));
    const du = lastExpect(b("--propose", "--from", cand, "--champion", champU, "--dry-run").stdout);
    const garble = join(tmp, "emit-garble.mjs");
    writeFileSync(garble, [
      "import cp from \"node:child_process\";",
      "import { syncBuiltinESMExports } from \"node:module\";",
      "const real = cp.spawnSync;",
      "cp.spawnSync = (file, args, opts) => (file === process.execPath && Array.isArray(args) && String(args[0]).endsWith(\"arc-event.mjs\") && args.includes(\"approval.requested\") && !args.includes(\"--dry-run\") ? { status: 0, stdout: \"not-a-receipt-id\\n\", stderr: \"\" } : real(file, args, opts));",
      "syncBuiltinESMExports();",
      "",
    ].join("\n"));
    const au = node(["--import", pathToFileURL(garble).href, S("engine", "arc-bench.mjs"), "--propose", "--from", cand, "--champion", champU, "--expect", du || "x"], { ARC_SPINE_ROOT: sp });
    const pendingKept = existsSync(store) && readdirSync(store).some((k) => existsSync(join(store, k, "approval.pending")) && !existsSync(join(store, k, "approval.id")));
    check("bench --from: an approval whose outcome is unknown keeps the pending mark and exits PARTIAL", !!du && au.status === 1 && /whether the approval landed is unknown/.test(au.stderr) && pendingKept, `${au.status} ${au.stderr} pending=${pendingKept}`);
    // EXIT 2 IS NOT ALWAYS "NOTHING LANDED" (PR 3b round-4 logic attack): REJECT INTERNAL comes after the line can already
    // be on the spine (a failed flush). It is unknown too, and keeps the mark.
    const champI = join(tmp, "bench-champ-internal");
    cpSync(champ, champI, { recursive: true });
    const pi = JSON.parse(readFileSync(join(champI, "provenance.json"), "utf8"));
    pi.subject.driver = "gemini";
    writeFileSync(join(champI, "provenance.json"), JSON.stringify(pi));
    const di = lastExpect(b("--propose", "--from", cand, "--champion", champI, "--dry-run").stdout);
    const internal = join(tmp, "emit-internal.mjs");
    writeFileSync(internal, [
      "import cp from \"node:child_process\";",
      "import { syncBuiltinESMExports } from \"node:module\";",
      "const real = cp.spawnSync;",
      "cp.spawnSync = (file, args, opts) => (file === process.execPath && Array.isArray(args) && String(args[0]).endsWith(\"arc-event.mjs\") && args.includes(\"approval.requested\") && !args.includes(\"--dry-run\") ? { status: 2, stdout: \"\", stderr: \"arc-event: REJECT INTERNAL -- EIO: i/o error, fsync\\n\" } : real(file, args, opts));",
      "syncBuiltinESMExports();",
      "",
    ].join("\n"));
    const ai = node(["--import", pathToFileURL(internal).href, S("engine", "arc-bench.mjs"), "--propose", "--from", cand, "--champion", champI, "--expect", di || "x"], { ARC_SPINE_ROOT: sp });
    const internalKept = existsSync(store) && readdirSync(store).filter((k) => existsSync(join(store, k, "approval.pending")) && !existsSync(join(store, k, "approval.id"))).length >= 2;
    check("bench --from: REJECT INTERNAL is an unknown outcome -- the pending mark stays, exit PARTIAL", !!di && ai.status === 1 && /whether the approval landed is unknown/.test(ai.stderr) && /REJECT INTERNAL/.test(ai.stderr) && internalKept, `${ai.status} ${ai.stderr} kept=${internalKept}`);
    // AN ID THE SPINE BENCH READS DOES NOT HOLD is unknown too (PR 3b round-5 logic attack: exit 0 and an id the lookup
    // missed was "not raised", the mark went, and one plan raised twice).
    const champG = join(tmp, "bench-champ-ghost");
    cpSync(champ, champG, { recursive: true });
    const pg = JSON.parse(readFileSync(join(champG, "provenance.json"), "utf8"));
    pg.subject.driver = "ghost";
    writeFileSync(join(champG, "provenance.json"), JSON.stringify(pg));
    const dg = lastExpect(b("--propose", "--from", cand, "--champion", champG, "--dry-run").stdout);
    const ghost = join(tmp, "emit-ghost.mjs");
    writeFileSync(ghost, [
      "import cp from \"node:child_process\";",
      "import { syncBuiltinESMExports } from \"node:module\";",
      "const real = cp.spawnSync;",
      "cp.spawnSync = (file, args, opts) => (file === process.execPath && Array.isArray(args) && String(args[0]).endsWith(\"arc-event.mjs\") && args.includes(\"approval.requested\") && !args.includes(\"--dry-run\") ? { status: 0, pid: 1, stdout: \"01M2X81G8W5VM9HRCP0R8A571Q\\n\", stderr: \"\" } : real(file, args, opts));",
      "syncBuiltinESMExports();",
      "",
    ].join("\n"));
    const ag = node(["--import", pathToFileURL(ghost).href, S("engine", "arc-bench.mjs"), "--propose", "--from", cand, "--champion", champG, "--expect", dg || "x"], { ARC_SPINE_ROOT: sp });
    const ghostKept = existsSync(store) && readdirSync(store).filter((k) => existsSync(join(store, k, "approval.pending")) && !existsSync(join(store, k, "approval.id"))).length >= 3;
    check("bench --from: an id the spine does not hold is UNKNOWN -- the pending mark stays, exit PARTIAL", !!dg && ag.status === 1 && /not in the spine bench reads/.test(ag.stderr) && ghostKept, `${ag.status} ${ag.stderr} kept=${ghostKept}`);
  }
  // WHO RAN is what RAN (PR 3b round-4 logic attack): two mock runs that asked for different models and applied none are
  // one subject, and the shape check reaches every field the comparison reads.
  {
    const asked = join(tmp, "bench-champ-asked-model");
    cpSync(cand, asked, { recursive: true });
    const p = JSON.parse(readFileSync(join(asked, "provenance.json"), "utf8"));
    p.fingerprint = { ...(p.fingerprint || {}), model_requested: "not-a-model" };
    p.model_applied = null;
    writeFileSync(join(asked, "provenance.json"), JSON.stringify(p));
    const sc = JSON.parse(readFileSync(join(asked, "scorecard.json"), "utf8"));
    sc.generated_note = "asked for another model, applied none";
    writeFileSync(join(asked, "scorecard.json"), JSON.stringify(sc));
    const r1 = b("--propose", "--from", cand, "--champion", asked, "--dry-run");
    check("bench --from: a champion that only REQUESTED another model (none applied) is the same subject -- refused", r1.status === 2 && /different subjects/.test(r1.stderr), `${r1.status} ${r1.stderr}`);
    for (const [why, mutate, re] of [
      ["a class row of null", (s) => { s.classes = [null, ...s.classes]; }, /class row that is not an object/],
      ["no eval_pack_revisions map", (s) => { delete s.eval_pack_revisions; }, /eval_pack_revisions/],
      // Deeper than the shape check reaches: the comparison's own TypeError, refused by name (PR 3b round-5 logic attack).
      ["a class row holding only its name", (s) => { s.classes = s.classes.map((c) => ({ task_class: c.task_class, eligible: true })); }, /not a bench run's output: a field the comparison reads/],
    ]) {
      const bad = join(tmp, `bench-champ-shape-${why.replace(/[^a-z]/g, "-")}`);
      cpSync(champ, bad, { recursive: true });
      const s = JSON.parse(readFileSync(join(bad, "scorecard.json"), "utf8"));
      mutate(s);
      writeFileSync(join(bad, "scorecard.json"), JSON.stringify(s));
      const r = b("--propose", "--from", cand, "--champion", bad, "--dry-run");
      check(`bench --from refuses a champion with ${why}, by name and with no stack`, r.status === 2 && re.test(r.stderr) && !/at .*\.mjs:\d+/.test(r.stderr), `${r.status} ${r.stderr}`);
    }
  }
  // A second run of the SAME subject is not a champion: there is no switch to propose (PR 3b round-2 logic attack).
  {
    const same = join(tmp, "bench-champ-same-subject");
    cpSync(cand, same, { recursive: true });
    const sc = JSON.parse(readFileSync(join(same, "scorecard.json"), "utf8"));
    sc.generated_note = "a second run of the same driver";
    writeFileSync(join(same, "scorecard.json"), JSON.stringify(sc));
    const r = b("--propose", "--from", cand, "--champion", same, "--dry-run");
    check("bench --from refuses a champion that ran the candidate's own subject", r.status === 2 && /different subjects/.test(r.stderr), `${r.status} ${r.stderr}`);
  }
  // Applied under a shim that makes the approval's temp cleanup throw EBUSY (a scanner holding the file): a cleanup is
  // litter, never the outcome. Unguarded, it made bench exit 1 with no receipt line after the approval had landed, and
  // the retry refuse (PR 3b shell attack). The shim leaves a mark when it fires, so "it ran" is asserted, not assumed.
  const busyMark = join(tmp, "bench-rm-busy.mark");
  const busyShim = join(tmp, "bench-rm-busy.mjs");
  writeFileSync(busyShim, [
    "import fs from \"node:fs\";",
    "import { syncBuiltinESMExports } from \"node:module\";",
    "const real = fs.rmSync;",
    `fs.rmSync = (p, o) => { if (String(p).includes("arc-spine-judge-")) { fs.appendFileSync(${JSON.stringify(busyMark)}, "x"); throw Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" }); } return real(p, o); };`,
    "syncBuiltinESMExports();",
    "",
  ].join("\n"));
  const ap = node(["--import", pathToFileURL(busyShim).href, S("engine", "arc-bench.mjs"), "--propose", "--from", cand, "--champion", champ, "--expect", digest || "x"], { ARC_SPINE_ROOT: sp });
  const id = /receipt: approval\.requested ([0-9A-HJKMNP-TV-Z]{26})/.exec(ap.stdout);
  check("bench --from: a temp cleanup that throws after the approval landed is litter -- exit 0 and the receipt line (the shim fired)", existsSync(busyMark) && ap.status === 0 && !!id, `mark=${existsSync(busyMark)} ${ap.status} ${ap.stderr}`);
  check("bench --from, applied with its plan's digest: raises the router proposal and names its receipt; nothing was run", ap.status === 0 && !!id && /nothing was run, nothing was spent/.test(ap.stdout), `${ap.status} ${ap.stderr} ${ap.stdout.slice(-300)}`);
  check("bench --from: one approval on the spine, and NO new run.completed (no run happened)", count("approval.requested") === 1 && count("run.completed") === runsBefore, `approvals=${count("approval.requested")} runs=${count("run.completed")} before=${runsBefore}`);
  // Counted by what each store HOLDS, not by how many there are: the unknown-outcome test above keeps a pending store of
  // its own in this spine, and a bare count of 2 read that as a defect (CI, PR 3b round 3).
  const stores = existsSync(store) ? readdirSync(store) : [];
  const landed = stores.filter((d) => existsSync(join(store, d, "approval.id")));
  check("bench --from: the artifacts land INSIDE the spine's own root, one store per candidate-and-champion, one of them landed", stores.length >= 2 && stores.every((d) => /^[a-z0-9.-]+-vs-[0-9a-f]{12}$/.test(d)) && landed.length === 1, stores.join(",") || "no store");
  const again = b("--propose", "--from", cand, "--champion", champ, "--expect", digest || "x");
  check("bench --from: the same candidate twice refuses (one question, one approval)", again.status === 2 && /already exists/.test(again.stderr) && count("approval.requested") === 1, again.stderr);
  const unbound = b("--propose", "--from", cand, "--champion", champ);
  check("bench --from with no plan digest refuses -- an apply is bound to a plan (after one landed, too)", unbound.status === 2 && /bound to a plan/.test(unbound.stderr) && count("approval.requested") === 1, unbound.stderr);
  for (const [why, args, re] of [
    ["--driver with --from", ["--propose", "--from", cand, "--champion", champ, "--driver", "mock"], /meaningless with --from/],
    ["--from without --propose", ["--from", cand, "--champion", champ], /comes with --propose/],
    ["--from equal to --champion", ["--propose", "--from", cand, "--champion", cand], /different runs/],
    ["a --from with no scorecard", ["--propose", "--from", tmp, "--champion", champ, "--dry-run"], /no scorecard\.json/],
    ["--expect with --dry-run", ["--propose", "--from", cand, "--champion", champ, "--dry-run", "--expect", "0".repeat(64)], /give one/],
    ["--expect without --from", ["--driver", "mock", "--expect", "0".repeat(64)], /nothing else takes it/],
  ]) {
    const r = b(...args);
    check(`bench --from refuses ${why}`, r.status === 2 && re.test(r.stderr), `${r.status} ${r.stderr}`);
  }
}

// ---- absorb pin and trial, APPLIED, in a scratch repository: a branch, an approval, the tree unmoved, each apply
// bound to its plan ----
{
  const repo = join(tmp, "absorb-scratch-repo");
  cpSync(join(REPO, ".claude", "scripts"), join(repo, ".claude", "scripts"), { recursive: true });
  mkdirSync(join(repo, "engine"), { recursive: true });
  writeFileSync(join(repo, "engine", "router.yaml"), readFileSync(join(REPO, "engine", "router.yaml"), "utf8"));
  const g = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
  g("init", "-q", "-b", "main");
  g("config", "user.name", "fixture"); g("config", "user.email", "fixture@example.invalid"); g("config", "commit.gpgsign", "false");
  g("add", "-A"); g("commit", "-q", "-m", "scratch");
  const mainBefore = g("rev-parse", "refs/heads/main").stdout.trim();
  check("absorb scratch repository committed on main (vacuous-pass guard)", /^[0-9a-f]{40}$/.test(mainBefore));
  const sp = spine("absorb-scratch-spine");
  const seals = join(tmp, "scratch-seals");
  const inScratch = (script, args) => spawnSync(process.execPath, [join(repo, ".claude", "scripts", ...script.split("/")), ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: sp, ARC_ABSORB_SEAL_DIR: seals }, timeout: 120_000 });
  const approvals = () => spineEvents(sp).filter((e) => e.kind === "approval.requested");
  const clean = () => g("status", "--porcelain").stdout === "" && g("symbolic-ref", "HEAD").stdout.trim() === "refs/heads/main" && g("rev-parse", "refs/heads/main").stdout.trim() === mainBefore;

  const src = join(tmp, "absorb-source");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "README.md"), "a source the kernel suite pins\n");
  const PIN = ["--root", src, "--pin", "0123456789abcdef", "--license", "MIT, in LICENSE", "--report", "initiatives/absorb/evidence/kernel-suite.md"];
  const pPlan = inScratch("absorb/pin.mjs", [...PIN, "--dry-run"]);
  const pDigest = lastExpect(pPlan.stdout);
  check("absorb pin, planned: the report's diff and a digest, and nothing written", pPlan.status === 0 && !!pDigest && /Extraction report/.test(pPlan.stdout) && approvals().length === 0 && clean(), `${pPlan.status} ${pPlan.stderr}`);
  const pStale = inScratch("absorb/pin.mjs", [...PIN, "--expect", "0".repeat(64)]);
  check("absorb pin with a digest no plan printed refuses (PLAN_STALE) and writes nothing", pStale.status === 2 && /PLAN_STALE/.test(pStale.stderr) && approvals().length === 0, pStale.stderr);
  const pp = inScratch("absorb/pin.mjs", [...PIN, "--expect", pDigest || "x"]);
  const pBranch = "feat/face-absorb-pin-kernel-suite";
  const report = g("show", `${pBranch}:initiatives/absorb/evidence/kernel-suite.md`).stdout;
  check("absorb pin, applied: the scaffolded report is on its branch, the tree unmoved", pp.status === 0 && /^# Extraction report/.test(report) && /0123456789abcdef/.test(report) && clean(), `${pp.status} ${pp.stderr}`);
  check("absorb pin, applied: the approval names the report, the branch and the commit", approvals().some((e) => e.payload.gate === "absorb-pin" && e.payload.branch === pBranch && e.payload.report === "initiatives/absorb/evidence/kernel-suite.md" && e.payload.commit === g("rev-parse", pBranch).stdout.trim() && receiptOf(pp.stdout) === e.id));

  const TRIAL = ["--candidate", "T-01", "--variants", "harbor,quartz", "--fixtures", "f1,f2,f3", "--evidence", "initiatives/absorb/evidence/kernel-trial", "--correlation", "kernel-trial-1"];
  const tPlan = inScratch("absorb/trial.mjs", [...TRIAL, "--dry-run"]);
  const tDigest = lastExpect(tPlan.stdout);
  check("absorb trial, planned: nothing sealed, nothing written, and a digest", tPlan.status === 0 && !!tDigest && !existsSync(join(seals, "kernel-trial-1.json")) && approvals().filter((e) => e.payload.correlation === "kernel-trial-1").length === 0, `${tPlan.status} ${tPlan.stderr}`);
  const tStale = inScratch("absorb/trial.mjs", [...TRIAL, "--expect", "0".repeat(64)]);
  check("absorb trial with a digest no plan printed refuses (PLAN_STALE) BEFORE the seal burns the correlation", tStale.status === 2 && /PLAN_STALE/.test(tStale.stderr) && !existsSync(join(seals, "kernel-trial-1.json")), tStale.stderr);
  const tr = inScratch("absorb/trial.mjs", [...TRIAL, "--expect", tDigest || "x"]);
  const tBranch = "feat/face-absorb-trial-kernel-trial-1";
  const commitment = g("show", `${tBranch}:initiatives/absorb/evidence/kernel-trial/commitment.txt`).stdout;
  const tAppr = approvals().find((e) => e.payload.subject === "absorb.ab-judgement" && e.payload.correlation === "kernel-trial-1");
  check("absorb trial, applied: the commitment is on its branch, the tree unmoved, the nonce in the seal store", tr.status === 0 && /^[0-9a-f]{64}/.test(commitment) && existsSync(join(seals, "kernel-trial-1.json")) && clean(), `${tr.status} ${tr.stderr}`);
  check("absorb trial, applied: the approval is the ab-judgement profile, and its commitment is the one on the branch", !!tAppr && commitment.startsWith(tAppr.payload.commitment) && tAppr.payload.evidence_path === "initiatives/absorb/evidence/kernel-trial");
  const twice = inScratch("absorb/trial.mjs", [...TRIAL, "--expect", tDigest || "x"]);
  // The seal's own guard answers first (the correlation is used), before the branch's: either way nothing is sealed twice.
  check("absorb trial applied again with its digest refuses BEFORE it seals again (the seal exists, and so does the branch)", twice.status === 2 && /a seal already exists|BRANCH_EXISTS/.test(twice.stderr) && approvals().filter((e) => e.payload.correlation === "kernel-trial-1").length === 1, twice.stderr);
  const pUnbound = inScratch("absorb/pin.mjs", [...PIN.slice(0, -1), "initiatives/absorb/evidence/kernel-unbound.md"]);
  const tUnbound = inScratch("absorb/trial.mjs", [...TRIAL.slice(0, -3), "initiatives/absorb/evidence/kernel-unbound", "--correlation", "kernel-trial-unbound"]);
  check("absorb pin and trial with no plan digest refuse -- an apply is bound to a plan, and the trial seals nothing", pUnbound.status === 2 && /bound to a plan/.test(pUnbound.stderr) && tUnbound.status === 2 && /bound to a plan/.test(tUnbound.stderr) && !existsSync(join(seals, "kernel-trial-unbound.json")), `${pUnbound.stderr} :: ${tUnbound.stderr}`);
  const unknown = inScratch("absorb/judgement.mjs", ["seal", "--candidate", "T-01", "--variants", "a,b", "--fixtures", "f1,f2,f3", "--evidence", "x", "--correlation", "c-unknown", "--dry-runn"]);
  check("judgement seal refuses a flag it does not know -- it used to be ignored, and a mistyped --dry-run sealed for real", unknown.status === 2 && /does not take/.test(unknown.stderr) && !existsSync(join(seals, "c-unknown.json")), unknown.stderr);
  // The seal's approval is judged BEFORE it seals: a correlation the secret scanner reads as a key burns nothing.
  const keyish = inScratch("absorb/trial.mjs", [...TRIAL.slice(0, -3), "initiatives/absorb/evidence/kernel-keyish", "--correlation", "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789", "--dry-run"]);
  check("absorb trial whose approval the spine would refuse is refused at its plan, before anything is sealed", keyish.status === 2 && /would be refused by the spine/.test(keyish.stderr) && !existsSync(join(seals, "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789.json")), `${keyish.status} ${keyish.stderr}`);

  // A report NAMED like risk-assessment put "sk-" in its branch, and beside main's commit that is a key to the scanner:
  // every such pin was refused (PR 3b logic attack). The branch defuses the prefix.
  const risky = inScratch("absorb/pin.mjs", ["--root", src, "--pin", "0123456789abcdef", "--license", "MIT, in LICENSE", "--report", "initiatives/absorb/evidence/risk-assessment.md", "--dry-run"]);
  check("absorb pin of a report named risk-assessment plans (its branch is feat/face-absorb-pin-riskassessment)", risky.status === 0 && /feat\/face-absorb-pin-riskassessment/.test(risky.stdout) && !!lastExpect(risky.stdout), `${risky.status} ${risky.stderr}`);

  // --judge: the seal asks the spine about the payload it is about to print -- these labels, this commitment -- before
  // the nonce is written. An evidence path the spine refuses (absolute) seals nothing with --judge; without it the hand
  // seal behaves as it always has (the control).
  const absBundle = join(tmp, "absolute-bundle");
  const SEAL = (corr, ...extra) => inScratch("absorb/judgement.mjs", ["seal", "--candidate", "T-01", "--variants", "harbor,quartz", "--fixtures", "f1,f2,f3", "--evidence", absBundle, "--correlation", corr, ...extra]);
  const judged = SEAL("judge-refused", "--judge");
  const unjudged = SEAL("judge-control");
  check("judgement seal --judge: a payload the spine refuses seals NOTHING -- the correlation stays free (and without --judge it seals, the control)",
    judged.status === 2 && /the spine would refuse/.test(judged.stderr) && !existsSync(join(seals, "judge-refused.json")) && unjudged.status === 0 && existsSync(join(seals, "judge-control.json")), `${judged.status} ${judged.stderr} :: ${unjudged.status} ${unjudged.stderr}`);

  // A seal that fails AFTER its nonce is written has burned its correlation: trial says so, exit 1, never "nothing
  // sealed" (PR 3b shell attack). The commitment write is made to fail by a preload the seal inherits.
  const failShim = join(tmp, "commitment-enospc.mjs");
  writeFileSync(failShim, [
    "import fs from \"node:fs\";",
    "import { syncBuiltinESMExports } from \"node:module\";",
    "const real = fs.writeFileSync;",
    "fs.writeFileSync = (p, ...rest) => { if (String(p).endsWith(\"commitment.txt\")) throw Object.assign(new Error(\"ENOSPC: no space left on device\"), { code: \"ENOSPC\" }); return real(p, ...rest); };",
    "syncBuiltinESMExports();",
    "",
  ].join("\n"));
  const HALF = ["--candidate", "T-01", "--variants", "harbor,quartz", "--fixtures", "f1,f2,f3", "--evidence", "initiatives/absorb/evidence/kernel-half", "--correlation", "kernel-half-1"];
  const hDigest = lastExpect(inScratch("absorb/trial.mjs", [...HALF, "--dry-run"]).stdout);
  const half = spawnSync(process.execPath, [join(repo, ".claude", "scripts", "absorb", "trial.mjs"), ...HALF, "--expect", hDigest || "x"],
    { cwd: repo, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: sp, ARC_ABSORB_SEAL_DIR: seals, NODE_OPTIONS: `--import=${pathToFileURL(failShim).href}` }, timeout: 120_000 });
  check("absorb trial whose seal fails after writing its nonce reports it SEALED (exit 1, the correlation used), raises nothing",
    !!hDigest && half.status === 1 && /AFTER its nonce was written/.test(half.stderr) && existsSync(join(seals, "kernel-half-1.json")) && !approvals().some((e) => e.payload.correlation === "kernel-half-1"), `${half.status} ${half.stderr}`);

  // A bundle MAIN already holds is an earlier judgement's, whatever the owner's checkout shows: the branch is cut from
  // main (PR 3b logic attack: a checkout on another branch passed, and the branch replaced main's commitment.txt).
  mkdirSync(join(repo, "initiatives", "absorb", "evidence", "kernel-old"), { recursive: true });
  writeFileSync(join(repo, "initiatives", "absorb", "evidence", "kernel-old", "commitment.txt"), `${"a".repeat(64)}\n`);
  g("add", "-A"); g("commit", "-q", "-m", "an earlier judgement's bundle");
  g("checkout", "-q", "-b", "owner-elsewhere", mainBefore);
  const reused = inScratch("absorb/trial.mjs", ["--candidate", "T-01", "--variants", "harbor,quartz", "--fixtures", "f1,f2,f3", "--evidence", "initiatives/absorb/evidence/kernel-old", "--correlation", "kernel-old-2", "--dry-run"]);
  g("checkout", "-q", "main");
  check("absorb trial into a bundle main already holds refuses, even from a checkout that lacks it -- nothing sealed", reused.status === 2 && /main already holds/.test(reused.stderr) && !existsSync(join(seals, "kernel-old-2.json")), `${reused.status} ${reused.stderr}`);

  // A second trial into a bundle an OPEN trial branch already holds: the two would conflict at merge over a commitment
  // somebody is judging against (PR 3b round-2 logic attack).
  const openTwin = inScratch("absorb/trial.mjs", [...TRIAL.slice(0, -1), "kernel-trial-2", "--dry-run"]);
  check("absorb trial into a bundle an open trial branch holds refuses -- nothing sealed", openTwin.status === 2 && /open trial branch feat\/face-absorb-trial-kernel-trial-1/.test(openTwin.stderr) && !existsSync(join(seals, "kernel-trial-2.json")), `${openTwin.status} ${openTwin.stderr}`);

  // A pin scaffolds a NEW report: one main already holds would be replaced by a scaffold (PR 3b round-2 logic attack).
  mkdirSync(join(repo, "initiatives", "absorb", "evidence"), { recursive: true });
  writeFileSync(join(repo, "initiatives", "absorb", "evidence", "held-report.md"), "# a report somebody wrote\n");
  g("add", "-A"); g("commit", "-q", "-m", "a report on main");
  const heldPin = inScratch("absorb/pin.mjs", ["--root", src, "--pin", "0123456789abcdef", "--license", "MIT, in LICENSE", "--report", "initiatives/absorb/evidence/held-report.md", "--dry-run"]);
  check("absorb pin of a report main already holds refuses -- a pin scaffolds a new report", heldPin.status === 2 && /main already holds/.test(heldPin.stderr), `${heldPin.status} ${heldPin.stderr}`);

  // study's Identity line is relative to the REPOSITORY, whatever the cwd: run from elsewhere, the relative path still
  // carried the account's home into a committed report (PR 3b round-2 shell attack).
  const studyOut = join(tmp, "study-elsewhere.md");
  const studied = spawnSync(process.execPath, [S("absorb", "study.mjs"), "--scaffold", "--root", src, "--pin", "0123456789abcdef", "--license", "MIT, in LICENSE", "--out", studyOut], { cwd: tmp, encoding: "utf8" });
  const identity = existsSync(studyOut) ? (/\*\*Identity:\*\* (.*)$/m.exec(readFileSync(studyOut, "utf8")) || [])[1] : null;
  check("study run from outside the repo names a source outside it by its folder alone", studied.status === 0 && identity === "(outside this repo) absorb-source", `${studied.status} ${identity} ${studied.stderr}`);

  // TWO TRIALS INTO ONE BUNDLE AT ONCE: the open-branch check, the seal and the branch run under one lock per bundle --
  // both passed the check and both raised approvals (PR 3b round-3 logic attack).
  {
    const BUNDLE = ["--candidate", "T-01", "--variants", "harbor,quartz", "--fixtures", "f1,f2,f3", "--evidence", "initiatives/absorb/evidence/kernel-bundle-race"];
    const plans = ["kernel-br-1", "kernel-br-2"].map((corr) => ({ corr, d: lastExpect(inScratch("absorb/trial.mjs", [...BUNDLE, "--correlation", corr, "--dry-run"]).stdout) }));
    const runs = await Promise.all(plans.map(({ corr, d }) => new Promise((resolveRun) => {
      const c = spawn(process.execPath, [join(repo, ".claude", "scripts", "absorb", "trial.mjs"), ...BUNDLE, "--correlation", corr, "--expect", d || "x"],
        { cwd: repo, env: { ...process.env, ARC_SPINE_ROOT: sp, ARC_ABSORB_SEAL_DIR: seals }, stdio: ["ignore", "pipe", "pipe"] });
      let err = "";
      c.stderr.on("data", (x) => { err += x; });
      c.on("close", (code) => resolveRun({ code, err }));
    })));
    const raisedHere = approvals().filter((e) => ["kernel-br-1", "kernel-br-2"].includes(e.payload.correlation)).length;
    check("two trials into one bundle at once: one seals and raises, the other refuses -- never two", plans.every((p) => !!p.d) && runs.filter((r) => r.code === 0).length === 1 && raisedHere === 1, runs.map((r) => `${r.code}:${r.err.trim().slice(0, 120)}`).join(" | "));
  }

  // TWO SEALS OF ONE CORRELATION AT ONCE: the nonce is created exclusively, so one wins and the other writes nothing --
  // the stored nonce is the winner's (PR 3b round-2 attacks: with --judge between the check and the write, both won
  // and the approval that landed could never be revealed).
  const raceSeal = () => new Promise((resolveRun) => {
    const c = spawn(process.execPath, [join(repo, ".claude", "scripts", "absorb", "judgement.mjs"), "seal", "--candidate", "T-01", "--variants", "harbor,quartz", "--fixtures", "f1,f2,f3", "--evidence", "initiatives/absorb/evidence/kernel-race", "--correlation", "kernel-race-1", "--bundle-dir", join(tmp, `race-bundle-${Math.random().toString(16).slice(2)}`), "--judge"],
      { cwd: repo, env: { ...process.env, ARC_SPINE_ROOT: sp, ARC_ABSORB_SEAL_DIR: seals }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    c.stdout.on("data", (x) => { out += x; }); c.stderr.on("data", (x) => { err += x; });
    c.on("close", (code) => resolveRun({ code, out, err }));
  });
  const raced = await Promise.all([raceSeal(), raceSeal()]);
  const winner = raced.find((x) => x.code === 0);
  let stored = null; try { stored = JSON.parse(readFileSync(join(seals, "kernel-race-1.json"), "utf8")); } catch { /* reported */ }
  let printed = null; try { printed = JSON.parse(String(winner && winner.out).trim().split(/\r?\n/).pop()); } catch { /* reported */ }
  check("two seals of one correlation at once: exactly one seals, and the stored nonce is the one whose payload was printed",
    raced.filter((x) => x.code === 0).length === 1 && !!stored && !!printed && stored.commitment === printed.commitment, raced.map((x) => `${x.code}:${x.err.trim().slice(0, 120)}`).join(" | "));
}

// ---- the writer's own refusal of the law files, whatever a caller allows ----
{
  const PB = await import(pathToFileURL(S("core", "proposal-branch.mjs")).href);
  let ug = null;
  try { PB.checkFiles([{ path: "hq.policy.yaml", content: "x" }], ["hq.policy.yaml"]); } catch (e) { ug = e.code; }
  check("the proposal-branch writer refuses hq.policy.yaml even when a caller allows it (UNGRANTABLE)", ug === "UNGRANTABLE");
}

// ---- PR 3b round 4: the shared emit's three outcomes, the spine write past a failed flush, the shared lock ----
{
  const PE = await import(pathToFileURL(S("core", "plan-expect.mjs")).href);
  // A fake emitter answering by FAKE_MODE: the outcome is read from HOW it ended, never from whether an id came back.
  const fake = join(tmp, "fake-arc-event.mjs");
  writeFileSync(fake, [
    "const m = process.env.FAKE_MODE;",
    "if (m === \"ok\") { process.stdout.write(\"01M2X81G8W5VM9HRCP0R8A571Q\\n\"); process.exit(0); }",
    "if (m === \"noid\") process.exit(0);",
    "if (m === \"refuse\") { process.stderr.write(\"arc-event: REJECT BAD_PAYLOAD -- no\\n\"); process.exit(2); }",
    "if (m === \"internal\") { process.stderr.write(\"arc-event: REJECT INTERNAL -- EIO: i/o error, fsync\\n\"); process.exit(2); }",
    "if (m === \"crash\") process.exit(1);",
    "if (m === \"hang\") setTimeout(() => {}, 60000);",
    "",
  ].join("\n"));
  const outcome = (mode, o = {}) => PE.emitReceipt(fake, "approval.requested", { what: "x" }, { env: { ...process.env, FAKE_MODE: mode }, ...o });
  const ok = outcome("ok"), noid = outcome("noid"), refuse = outcome("refuse"), internal = outcome("internal"), crash = outcome("crash"), hang = outcome("hang", { timeoutMs: 1500 });
  check("emitReceipt: exit 0 with an id is landed, with its id", ok.state === "landed" && ok.id === "01M2X81G8W5VM9HRCP0R8A571Q", JSON.stringify(ok));
  check("emitReceipt: exit 0 whose id line was lost is LANDED (arc-event's own contract), never read as not raised", noid.state === "landed" && noid.id === null && /id line was lost/.test(noid.why || ""), JSON.stringify(noid));
  check("emitReceipt: exit 2 naming a refusal is refused", refuse.state === "refused" && /BAD_PAYLOAD/.test(refuse.why || ""), JSON.stringify(refuse));
  check("emitReceipt: REJECT INTERNAL, a crash and a timeout are all UNKNOWN", internal.state === "unknown" && crash.state === "unknown" && hang.state === "unknown", JSON.stringify([internal, crash, hang]));

  // A flush that fails AFTER the line is written is a warning, never a refusal (PR 3b round-4 logic attack: the event was
  // quarantined while it sat on the spine, and its caller raised the same approval again). The lock token's flush is the
  // first; the day line's is the second.
  const spF = join(tmp, "flush-fault-spine");
  mkdirSync(join(spF, "events"), { recursive: true });
  const fsyncShim = join(tmp, "fsync-fault.mjs");
  writeFileSync(fsyncShim, [
    "import fs from \"node:fs\";",
    "import { syncBuiltinESMExports } from \"node:module\";",
    "const real = fs.fsyncSync;",
    "let n = 0;",
    "fs.fsyncSync = (fd) => { n += 1; if (n === 2) throw Object.assign(new Error(\"EIO: i/o error, fsync\"), { code: \"EIO\" }); return real(fd); };",
    "syncBuiltinESMExports();",
    "",
  ].join("\n"));
  const flushed = node(["--import", pathToFileURL(fsyncShim).href, S("hq", "arc-event.mjs"), "emit", "note.logged", "--payload", JSON.stringify({ note: "flush-probe" }), "--strict"], { ARC_SPINE_ROOT: spF });
  const dayLines = readdirSync(join(spF, "events")).filter((n) => n.endsWith(".jsonl")).flatMap((n) => readFileSync(join(spF, "events", n), "utf8").split("\n").filter(Boolean));
  const filesUnder = (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(join(d, e.name)) : [e.name])) : []);
  const quarantined = filesUnder(join(spF, "_quarantine")).length + filesUnder(join(spF, "quarantine")).length;
  check("spine: a flush that fails after the line is written exits 0 with a WARN, the event on the spine, nothing quarantined (the shim fired)",
    flushed.status === 0 && /did not confirm the flush \(EIO\)/.test(flushed.stderr) && dayLines.some((l) => l.includes("flush-probe")) && quarantined === 0 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(flushed.stdout.trim()),
    `${flushed.status} ${flushed.stderr} lines=${dayLines.length} q=${quarantined}`);

  // THE SHARED LOCK (PR 3b rounds 4 to 6): every taker creates its own file and holds only if no other file has a live
  // holder; a holder on this machine is live while its process runs (up to an hour), another machine's by age; an
  // unreadable file is live; a folder where a lock file belongs is refused by name.
  const lockDir = join(tmp, "locks-r6");
  mkdirSync(lockDir, { recursive: true });
  const hex = (n) => n.toString(16).padStart(16, "0");
  const liveToken = `${hostname()}|${process.pid}|test`;
  const deadPid = (() => { const c = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }); return Number(c.stdout); })();
  const age = (p, ms) => { const t = new Date(Date.now() - ms); utimesSync(p, t, t); };
  mkdirSync(join(lockDir, `folder.lock.${hex(1)}`), { recursive: true });
  let folderWhy = "";
  try { await PE.withExclusiveLock(lockDir, "folder.lock", () => "x"); } catch (e) { folderWhy = e instanceof Error ? e.message : String(e); }
  check("lock: a folder where a lock file belongs is refused by name -- never busy forever", new RegExp(`a folder sits where the lock folder\\.lock\\.${hex(1)} belongs`).test(folderWhy), folderWhy);
  writeFileSync(join(lockDir, `future.lock.${hex(2)}`), "another-machine|1|x");
  age(join(lockDir, `future.lock.${hex(2)}`), -24 * 3600_000);
  const fut = await PE.withExclusiveLock(lockDir, "future.lock", () => "ran", { staleMs: 60_000 });
  check("lock: another machine's lock dated a day into the future is no live holder's -- the run holds it", fut.busy === false && fut.value === "ran", JSON.stringify(fut));
  writeFileSync(join(lockDir, `fresh.lock.${hex(3)}`), liveToken);
  const fr = await PE.withExclusiveLock(lockDir, "fresh.lock", () => "ran", { staleMs: 60_000 });
  check("lock: a fresh lock whose holder's process is running is busy (the control)", fr.busy === true, JSON.stringify(fr));
  writeFileSync(join(lockDir, `slow.lock.${hex(4)}`), liveToken);
  age(join(lockDir, `slow.lock.${hex(4)}`), 30 * 60_000);
  const slow = await PE.withExclusiveLock(lockDir, "slow.lock", () => "ran", { staleMs: 60_000 });
  check("lock: this machine's holder whose process still runs is live half an hour on -- busy (a spawnSync cannot beat)", slow.busy === true, JSON.stringify(slow));
  writeFileSync(join(lockDir, `reused.lock.${hex(5)}`), liveToken);
  age(join(lockDir, `reused.lock.${hex(5)}`), 2 * 3600_000);
  const reused = await PE.withExclusiveLock(lockDir, "reused.lock", () => "ran", { staleMs: 60_000 });
  check("lock: a running pid on a file two hours old is another program's -- the run holds it, never wedged", reused.busy === false && reused.value === "ran", JSON.stringify(reused));
  writeFileSync(join(lockDir, `dead.lock.${hex(6)}`), `${hostname()}|${deadPid}|gone`);
  const dead = await PE.withExclusiveLock(lockDir, "dead.lock", () => readdirSync(lockDir).filter((n) => n.startsWith("dead.lock.")), { staleMs: 60_000 });
  const deadAfter = readdirSync(lockDir).filter((n) => n.startsWith("dead.lock."));
  check("lock: a FRESH lock whose holder's process has exited is taken at once -- its file cleared, only the taker's while held, none after",
    deadPid > 0 && dead.busy === false && Array.isArray(dead.value) && dead.value.length === 1 && dead.value[0] !== `dead.lock.${hex(6)}` && deadAfter.length === 0, `${JSON.stringify(dead)} after=${deadAfter.join(",")}`);
  writeFileSync(join(lockDir, `away.lock.${hex(7)}`), `another-machine|${deadPid}|x`);
  const away = await PE.withExclusiveLock(lockDir, "away.lock", () => "ran", { staleMs: 60_000 });
  check("lock: another machine's fresh lock is judged by age alone -- busy", away.busy === true, JSON.stringify(away));
  // An unreadable file is LIVE, never "released" (PR 3b round-6 logic attack): a shim holds one lock file unreadable.
  {
    const unDir = join(tmp, "locks-unreadable");
    mkdirSync(unDir, { recursive: true });
    writeFileSync(join(unDir, `scan.lock.${hex(8)}`), `${hostname()}|${deadPid}|x`);
    const busyShim = join(tmp, "lock-ebusy.mjs");
    writeFileSync(busyShim, [
      "import fs from \"node:fs\";",
      "import { syncBuiltinESMExports } from \"node:module\";",
      "const real = fs.readFileSync;",
      `fs.readFileSync = (p, o) => { if (String(p).endsWith(${JSON.stringify(`scan.lock.${hex(8)}`)})) throw Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" }); return real(p, o); };`,
      "syncBuiltinESMExports();",
      "",
    ].join("\n"));
    const taker = join(tmp, "lock-taker.mjs");
    writeFileSync(taker, [
      "const [peUrl, dir] = process.argv.slice(2);",
      "const { withExclusiveLock } = await import(peUrl);",
      "const r = await withExclusiveLock(dir, \"scan.lock\", () => \"ran\", { staleMs: 60000 });",
      "process.stdout.write(r.busy ? \"busy\" : \"held\");",
      "",
    ].join("\n"));
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(busyShim).href, taker, pathToFileURL(S("core", "plan-expect.mjs")).href, unDir], { encoding: "utf8" });
    const control = spawnSync(process.execPath, [taker, pathToFileURL(S("core", "plan-expect.mjs")).href, unDir], { encoding: "utf8" });
    check("lock: a lock file that cannot be read is LIVE -- busy; readable, its dead holder's lock is taken (the control)", r.stdout === "busy" && control.stdout === "held", `${r.stdout}|${r.stderr} / ${control.stdout}|${control.stderr}`);
  }

  // THE RACE, DETERMINISTIC. B creates its file and lists the folder, and is paused right there (a shim on its first
  // listing); A comes in, creates its own and lists -- B's live file is there, so A backs off; B resumes and holds. One
  // holder. The old three-step lock -- the negative control, the mutant this harness exists to catch -- is paused
  // between its stale look and its unlink instead, and lets B in beside A.
  const child = join(tmp, "lock-child.mjs");
  writeFileSync(child, [
    "import { closeSync, existsSync, openSync, readdirSync, statSync, unlinkSync, writeFileSync } from \"node:fs\";",
    "import { join } from \"node:path\";",
    "const [mode, role, dir, marks, peUrl] = process.argv.slice(2);",
    "const { withExclusiveLock } = await import(peUrl);",
    "const NAME = \"race.lock\";",
    "const sleep = (ms) => new Promise((r) => setTimeout(r, ms));",
    "const waitFor = async (p, ms) => { const end = Date.now() + ms; while (!existsSync(p) && Date.now() < end) await sleep(20); };",
    "async function inside() {",
    "  writeFileSync(join(marks, `in-${role}`), \"\");",
    "  if (readdirSync(marks).some((n) => n.startsWith(\"in-\") && n !== `in-${role}`)) writeFileSync(join(marks, \"overlap\"), role);",
    "  if (role === \"A\") { writeFileSync(join(marks, \"a-holds\"), \"\"); await waitFor(join(marks, \"b-done\"), 20000); }",
    "  unlinkSync(join(marks, `in-${role}`));",
    "  return \"held\";",
    "}",
    "async function naive(fn) {",
    "  const lock = join(dir, NAME);",
    "  const take = () => { try { closeSync(openSync(lock, \"wx\")); return true; } catch (e) { if (e.code === \"EEXIST\" || e.code === \"EPERM\" || e.code === \"EACCES\") return false; throw e; } };",
    "  let ok = take();",
    "  if (!ok) { let age = 0; try { age = Date.now() - statSync(lock).mtimeMs; } catch {} if (age > 60000) { try { unlinkSync(lock); } catch {} ok = take(); } }",
    "  if (!ok) return { busy: true };",
    "  try { return { busy: false, value: await fn() }; } finally { try { unlinkSync(lock); } catch {} }",
    "}",
    "const r = mode === \"naive\" ? await naive(inside) : await withExclusiveLock(dir, NAME, inside, { staleMs: 60000 });",
    "writeFileSync(join(marks, `${role.toLowerCase()}-done`), \"\");",
    "process.stdout.write(r.busy ? \"busy\" : \"held\");",
    "",
  ].join("\n"));
  // B pauses on its FIRST look: the shared lock's listing of the folder, the old lock's stat of its file. It resumes when
  // A holds, or when A is done.
  const pauseShim = join(tmp, "lock-pause.mjs");
  writeFileSync(pauseShim, [
    "import fs from \"node:fs\";",
    "import { syncBuiltinESMExports } from \"node:module\";",
    "import { join, resolve } from \"node:path\";",
    "const marks = process.env.LOCK_MARKS;",
    "const lockDir = resolve(process.env.LOCK_DIR);",
    "let paused = false;",
    "const hold = () => {",
    "  paused = true;",
    "  fs.writeFileSync(join(marks, \"b-paused\"), \"\");",
    "  const cell = new Int32Array(new SharedArrayBuffer(4));",
    "  const end = Date.now() + 20000;",
    "  while (!fs.existsSync(join(marks, \"a-holds\")) && !fs.existsSync(join(marks, \"a-done\")) && Date.now() < end) Atomics.wait(cell, 0, 0, 20);",
    "};",
    "const realStat = fs.statSync;",
    "fs.statSync = (p, o) => { const st = realStat(p, o); if (!paused && String(p).endsWith(\"race.lock\")) hold(); return st; };",
    "const realList = fs.readdirSync;",
    "fs.readdirSync = (p, o) => { const out = realList(p, o); if (!paused && resolve(String(p)) === lockDir) hold(); return out; };",
    "syncBuiltinESMExports();",
    "",
  ].join("\n"));
  const race = async (mode) => {
    const dir = join(tmp, `race-${mode}`);
    const marks = join(tmp, `race-${mode}-marks`);
    mkdirSync(dir, { recursive: true });
    mkdirSync(marks, { recursive: true });
    // A killed holder's lock: the old lock's plain file, or a shared-lock file whose process is gone and whose file is old.
    const lock = join(dir, mode === "naive" ? "race.lock" : `race.lock.${hex(9)}`);
    writeFileSync(lock, `${hostname()}|${deadPid}|killed`);
    age(lock, 10 * 60_000);
    const run = (role, extra) => new Promise((res) => {
      const c = spawn(process.execPath, [...extra, child, mode, role, dir, marks, pathToFileURL(S("core", "plan-expect.mjs")).href],
        { cwd: REPO, env: { ...process.env, LOCK_MARKS: marks, LOCK_DIR: dir }, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      c.stdout.on("data", (d) => { out += d; });
      c.on("close", () => res(out.trim()));
    });
    const bRun = run("B", ["--import", pathToFileURL(pauseShim).href]);
    const end = Date.now() + 20000;
    while (!existsSync(join(marks, "b-paused")) && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
    const paused = existsSync(join(marks, "b-paused"));
    const [a, b] = await Promise.all([run("A", []), bRun]);
    return { paused, a, b, overlap: existsSync(join(marks, "overlap")) };
  };
  const shared = await race("shared");
  check("lock: a taker that finds another's LIVE file backs off -- one holder (B held, A busy; the pause fired)", shared.paused && shared.a === "busy" && shared.b === "held" && !shared.overlap, JSON.stringify(shared));
  const naive = await race("naive");
  check("lock: the negative control -- the old three-step lock lets B in beside A (the harness sees the defect)", naive.paused && naive.overlap, JSON.stringify(naive));

  // THE SPINE LOCK'S TOKEN NAMES ITS HOST (PR 3b round-6 logic attack): another machine's fresh lock is never broken by a
  // pid look, and a dead writer's lock on THIS machine is broken at once.
  {
    const IO = await import(pathToFileURL(S("hq", "lib", "spine-io.mjs")).href);
    const root = join(tmp, "spine-host");
    mkdirSync(join(root, "events"), { recursive: true });
    writeFileSync(join(root, "events", ".lock"), `another-machine|${deadPid}|abcdef\n`);
    let awayCode = "ran";
    try { IO.withLock(root, () => "x", { timeoutMs: 300 }); } catch (e) { awayCode = e.code; }
    writeFileSync(join(root, "events", ".lock"), `${hostname()}|${deadPid}|abcdef\n`);
    let deadRan = "no";
    try { deadRan = IO.withLock(root, () => "ran", { timeoutMs: 300 }); } catch (e) { deadRan = e.code; }
    check("spine lock: another machine's fresh lock waits (LOCK_TIMEOUT); this machine's dead writer's fresh lock is broken at once", awayCode === "LOCK_TIMEOUT" && deadRan === "ran", `${awayCode} ${deadRan}`);
  }

  // BENCH'S SPINE IS THE EMITTER'S (PR 3b round-5 logic attack): with ARC_SPINE_ROOT unset, a bench root holding .claude/
  // and no .git/, inside a folder holding both, reads the outer spine -- where the emitter, run in the root, writes.
  {
    const BENCH = await import(pathToFileURL(S("engine", "arc-bench.mjs")).href);
    const outer = join(tmp, "bench-outer");
    const inner = join(outer, "inner");
    mkdirSync(join(outer, ".claude"), { recursive: true });
    mkdirSync(join(outer, ".git"), { recursive: true });
    mkdirSync(join(inner, ".claude"), { recursive: true });
    const saved = process.env.ARC_SPINE_ROOT;
    delete process.env.ARC_SPINE_ROOT;
    let events = "";
    try { events = BENCH.spinePaths(inner).events; } finally { if (saved !== undefined) process.env.ARC_SPINE_ROOT = saved; }
    check("bench: with no ARC_SPINE_ROOT, its spine is found as the emitter finds it (the folder holding .claude/ AND .git/)", resolve(events) === resolve(join(outer, ".claude", "state", "hq", "events")), events);
  }

  // THE JUDGMENT ASKS WHERE THE EMIT WOULD WRITE (PR 3b round-5 logic attack): from a linked worktree the dry run passed
  // and the apply wrote its branch before the emit refused WORKTREE_SPINE.
  {
    const mainClone = join(tmp, "judge-main");
    mkdirSync(join(mainClone, ".claude"), { recursive: true });
    const g = (cwd, ...a) => spawnSync("git", a, { cwd, encoding: "utf8" });
    g(mainClone, "init", "-q", "-b", "main");
    g(mainClone, "config", "user.name", "fixture"); g(mainClone, "config", "user.email", "fixture@example.invalid"); g(mainClone, "config", "commit.gpgsign", "false");
    writeFileSync(join(mainClone, ".claude", "keep.txt"), "x\n");
    g(mainClone, "add", "-A"); g(mainClone, "commit", "-q", "-m", "fixture");
    const linked = join(tmp, "judge-linked");
    const added = g(mainClone, "worktree", "add", "-q", linked);
    const okEmitter = join(tmp, "fake-ok-emitter.mjs");
    writeFileSync(okEmitter, "process.exit(0);\n");
    const saved = process.env.ARC_SPINE_ROOT;
    delete process.env.ARC_SPINE_ROOT;
    let fromLinked = null, fromMain = "unset";
    try {
      fromLinked = PE.spineRefusal(okEmitter, "approval.requested", { what: "x" }, { cwd: linked });
      fromMain = PE.spineRefusal(okEmitter, "approval.requested", { what: "x" }, { cwd: mainClone });
    } finally { if (saved !== undefined) process.env.ARC_SPINE_ROOT = saved; }
    check("spineRefusal: from a linked worktree the judgment refuses WORKTREE_SPINE; from the main clone it passes (the control)",
      added.status === 0 && /WORKTREE_SPINE/.test(fromLinked || "") && fromMain === null, `added=${added.status} linked=${fromLinked} main=${fromMain}`);
  }

  // THE SPINE LOCK'S BREAK, DETERMINISTIC (PR 3b round-5 shell attack: two writers in 4 of 6 forced runs). B reads a
  // killed writer's lock and is paused right there; A breaks it and holds the spine; B resumes. The spine lock re-reads the
  // token before it unlinks and finds A's, so B waits -- and times out -- rather than deleting A's lock. The old break
  // (unlink after an age look) is the negative control.
  {
    const spineChild = join(tmp, "spine-lock-child.mjs");
    writeFileSync(spineChild, [
      "import { closeSync, existsSync, openSync, readdirSync, statSync, unlinkSync, writeFileSync } from \"node:fs\";",
      "import { join } from \"node:path\";",
      "const [mode, role, root, marks, ioUrl] = process.argv.slice(2);",
      "const { withLock } = await import(ioUrl);",
      "const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);",
      "function inside() {",
      "  writeFileSync(join(marks, `in-${role}`), \"\");",
      "  if (readdirSync(marks).some((n) => n.startsWith(\"in-\") && n !== `in-${role}`)) writeFileSync(join(marks, \"overlap\"), role);",
      "  if (role === \"A\") { writeFileSync(join(marks, \"a-holds\"), \"\"); const end = Date.now() + 20000; while (!existsSync(join(marks, \"b-done\")) && Date.now() < end) sleepSync(20); }",
      "  unlinkSync(join(marks, `in-${role}`));",
      "  return \"held\";",
      "}",
      "function naive(fn) {",
      "  const lock = join(root, \"events\", \".lock\");",
      "  const end = Date.now() + 1500;",
      "  for (;;) {",
      "    try { closeSync(openSync(lock, \"wx\")); break; } catch (e) { if (e.code !== \"EEXIST\" && e.code !== \"EPERM\" && e.code !== \"EACCES\") throw e; }",
      "    try { if (Date.now() - statSync(lock).mtimeMs > 5000) { unlinkSync(lock); continue; } } catch {}",
      "    if (Date.now() > end) return \"timeout\";",
      "    sleepSync(15);",
      "  }",
      "  try { return fn(); } finally { try { unlinkSync(lock); } catch {} }",
      "}",
      "let r;",
      "try { r = mode === \"naive\" ? naive(inside) : withLock(root, inside, { timeoutMs: role === \"B\" ? 1500 : 20000 }); }",
      "catch (e) { r = e && e.code ? e.code : \"error\"; }",
      "if (role === \"B\") writeFileSync(join(marks, \"b-done\"), \"\");",
      "process.stdout.write(String(r));",
      "",
    ].join("\n"));
    const spinePause = join(tmp, "spine-lock-pause.mjs");
    writeFileSync(spinePause, [
      "import fs from \"node:fs\";",
      "import { syncBuiltinESMExports } from \"node:module\";",
      "import { join } from \"node:path\";",
      "const marks = process.env.LOCK_MARKS;",
      "let paused = false;",
      "const isLock = (p) => /[\\\\/]\\.lock$/.test(String(p));",
      "const hold = () => {",
      "  paused = true;",
      "  fs.writeFileSync(join(marks, \"b-paused\"), \"\");",
      "  const cell = new Int32Array(new SharedArrayBuffer(4));",
      "  const end = Date.now() + 20000;",
      "  while (!fs.existsSync(join(marks, \"a-holds\")) && Date.now() < end) Atomics.wait(cell, 0, 0, 20);",
      "};",
      // the spine lock's break reads the token first; the old break stats the file first -- B pauses on its first look
      "const realRead = fs.readFileSync;",
      "fs.readFileSync = (p, o) => { const out = realRead(p, o); if (!paused && isLock(p)) hold(); return out; };",
      "const realStat = fs.statSync;",
      "fs.statSync = (p, o) => { const st = realStat(p, o); if (!paused && isLock(p)) hold(); return st; };",
      "syncBuiltinESMExports();",
      "",
    ].join("\n"));
    const spineRace = async (mode) => {
      const root = join(tmp, `spine-race-${mode}`);
      const marks = join(tmp, `spine-race-${mode}-marks`);
      mkdirSync(join(root, "events"), { recursive: true });
      mkdirSync(marks, { recursive: true });
      const lock = join(root, "events", ".lock");
      writeFileSync(lock, `${hostname()}|${deadPid}|deadbeef\n`);
      const old = new Date(Date.now() - 10 * 60_000);
      utimesSync(lock, old, old);
      const run = (role, extra) => new Promise((res) => {
        const c = spawn(process.execPath, [...extra, spineChild, mode, role, root, marks, pathToFileURL(S("hq", "lib", "spine-io.mjs")).href],
          { cwd: REPO, env: { ...process.env, LOCK_MARKS: marks }, stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        c.stdout.on("data", (d) => { out += d; });
        c.on("close", () => res(out.trim()));
      });
      const bRun = run("B", ["--import", pathToFileURL(spinePause).href]);
      const end = Date.now() + 20000;
      while (!existsSync(join(marks, "b-paused")) && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
      const paused = existsSync(join(marks, "b-paused"));
      const [a, b] = await Promise.all([run("A", []), bRun]);
      return { paused, a, b, overlap: existsSync(join(marks, "overlap")) };
    };
    const spineShared = await spineRace("shared");
    check("spine lock: a waiter whose look predates another's break never deletes that fresh lock -- one writer (A held, B timed out; the pause fired)",
      spineShared.paused && spineShared.a === "held" && spineShared.b === "LOCK_TIMEOUT" && !spineShared.overlap, JSON.stringify(spineShared));
    const spineNaive = await spineRace("naive");
    check("spine lock: the negative control -- the old break deletes A's fresh lock and lets B in beside it", spineNaive.paused && spineNaive.overlap, JSON.stringify(spineNaive));
  }

}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 80 ? 0 : 1);
