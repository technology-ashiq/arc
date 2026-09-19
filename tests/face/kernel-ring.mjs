#!/usr/bin/env node
// kernel-ring.mjs -- the kernel ring's owning-lane tools, held to their own words (face v2 Phase 05, ADR-1340).
//
// The door's parity suite (work-door.mjs) proves the door calls what a hand-run calls. This suite proves what those
// tools DO, each over a scratch spine and, where it needs one, a scratch repo:
//   arc-jobs   an unknown or =valued flag refuses before any command; --dry-run and --receipt belong to register only
//   propose    the router edit is one line of one class; refusals come before anything is read or written
//   policy     the promotion request is the policy library's, accepted by the spine; refusals name the rule
//   evolve     open -> measure -> conclude reaches a verdict the spine accepts, from receipts alone; compute-once,
//              canonical drift, a non-binary primary value and a guardrail with no threshold each refuse by name
//   the door   an effect past the spine is refused on a sim door (SIM_EFFECT) and runs on a live one
//   the law    nothing the face runs writes engine/router.yaml or hq.policy.yaml in place
//
// VACUOUS-PASS GUARD: each tool is proven to run (a receipt landed, a plan printed) before its refusals are counted,
// and the last line is "RAN: <n> checks", which the bats wrapper requires.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const S = (...p) => join(REPO, ".claude", "scripts", ...p);
const EVENT = S("hq", "arc-event.mjs");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};
const node = (args, env = {}) => spawnSync(process.execPath, args, { cwd: REPO, encoding: "utf8", env: { ...process.env, ...env }, timeout: 60_000 });
const tmp = mkdtempSync(join(tmpdir(), "face-kernel-ring-"));
const spine = (name) => { const d = join(tmp, name); mkdirSync(join(d, "events"), { recursive: true }); return d; };
/** Every file under a spine, hashed: what "wrote nothing" is measured against. */
const fingerprint = (root) => {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else out.push(`${n}:${createHash("sha256").update(readFileSync(p)).digest("hex")}`); } };
  walk(root);
  return out.join("|");
};
/** Run the emit a tool printed as its last line, strictly, on a spine. */
const emitLast = (stdout, root) => {
  const last = String(stdout).trim().split(/\r?\n/).pop() || "";
  let plan = null; try { plan = JSON.parse(last); } catch { return { status: -1, id: "", why: `not an emit plan: ${last.slice(0, 120)}` }; }
  const r = node([EVENT, ...plan.emit], { ARC_SPINE_ROOT: root });
  return { status: r.status, id: String(r.stdout).trim(), why: String(r.stderr).trim().split(/\r?\n/)[0] || "" };
};

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
  check("propose.mjs exports editRouter (vacuous-pass guard)", typeof P.editRouter === "function", String(P.loadError || ""));
  const router = readFileSync(join(REPO, "engine", "router.yaml"), "utf8");
  const edited = P.editRouter(router, "review-diff", "driver", "codex");
  const diff = router.split("\n").map((l, i) => (l === edited.text.split("\n")[i] ? null : [l, edited.text.split("\n")[i]])).filter(Boolean);
  check("editRouter changes exactly ONE line: the class's driver", diff.length === 1 && /^ {4}driver: claude-code$/.test(diff[0][0]) && diff[0][1] === "    driver: codex" && edited.from === "claude-code", JSON.stringify(diff));
  const tier = P.editRouter(router, "face-ask", "tier", "high-judgment");
  check("editRouter moves a tier the same way, and says what it replaced", tier.from === "balanced-workhorse" && tier.text.includes("  face-ask:\n    tier: high-judgment"));
  const prop = (...a) => node([S("engine", "propose.mjs"), ...a]);
  const bad = prop("driver", "--class", "review-diff", "--to", "codex", "--dry-run=1");
  check("propose: --dry-run=1 refuses", bad.status === 2 && /takes no value/.test(bad.stderr), `${bad.status} ${bad.stderr}`);
  const unk = prop("driver", "--class", "review-diff", "--to", "codex", "--force");
  check("propose: an unknown argument refuses", unk.status === 2 && /unknown argument/.test(unk.stderr));
  const twice = prop("driver", "--class", "a", "--class", "b", "--to", "codex");
  check("propose: a repeated flag refuses", twice.status === 2 && /given twice/.test(twice.stderr));
  const verb = prop("merge", "--class", "review-diff", "--to", "codex");
  check("propose: there is no verb but driver and tier (no merge, no apply)", verb.status === 2 && /usage/.test(verb.stderr));
  const src = readFileSync(S("engine", "propose.mjs"), "utf8");
  check("propose.mjs writes no file itself: every change goes through the proposal-branch writer", !/writeFileSync|appendFileSync|renameSync|copyFileSync|rmSync|unlinkSync/.test(src) && /writeProposal\(/.test(src));
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
  check("policy-promote: the printed emit is accepted by the spine, strictly", landed.status === 0 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(landed.id), `${landed.status} ${landed.why}`);
  const ev = JSON.parse(readFileSync(join(sp, "events", readdirSync(join(sp, "events")).find((n) => n.endsWith(".jsonl"))), "utf8").trim().split("\n").pop());
  check("policy-promote: the receipt is the policy.promotion profile, from L1, citing the evidence", ev.kind === "approval.requested" && ev.payload.subject === "policy.promotion" && ev.payload.from_level === "L1" && ev.payload.to_level === "L2" && ev.payload.trial_ledger_ref === "docs/trial-ledger.md#kernel-suite", JSON.stringify(ev.payload).slice(0, 300));
  const above = pp("--kind", "process:review-diff", "--capability", "write", "--to", "L3", "--evidence", "x");
  check("policy-promote: above the ceiling refuses, and says a ceiling is a repo edit", above.status === 2 && /ceiling/.test(above.stderr) && /repo edit/.test(above.stderr), above.stderr);
  const same = pp("--kind", "process:review-diff", "--capability", "write", "--to", "L1", "--evidence", "x");
  check("policy-promote: a promotion that does not raise refuses", same.status === 2 && /must raise/.test(same.stderr), same.stderr);
  const ghost = pp("--kind", "process:no-such-kind", "--capability", "write", "--to", "L2", "--evidence", "x");
  check("policy-promote: a kind hq.policy.yaml does not declare refuses (a subject is born by a reviewed edit)", ghost.status === 2 && /declares no kind/.test(ghost.stderr), ghost.stderr);
  const nocite = pp("--kind", "process:kickoff-plan", "--capability", "write", "--to", "L2");
  check("policy-promote: no evidence, no request (A4)", nocite.status === 2 && /--evidence is required/.test(nocite.stderr), nocite.stderr);
  const src = readFileSync(S("hq", "policy-promote.mjs"), "utf8");
  check("policy-promote.mjs never writes hq.policy.yaml (it reads it)", !/writeFileSync|appendFileSync|renameSync|copyFileSync/.test(src));
}

// ---- evolve: open -> measure -> conclude, over a scratch repo that declares an evolve section ----
{
  const fix = join(tmp, "evolve-repo");
  mkdirSync(join(fix, "products", "fixmod"), { recursive: true });
  mkdirSync(join(fix, "app"), { recursive: true });
  writeFileSync(join(fix, "app", "page.tsx"), "export default function Page() { return null }\n");
  const manifest = (guardrail) => JSON.stringify({
    name: "fixmod",
    evolve: {
      metrics: [
        { name: "converted", source_event: "metric.observed", aggregation: "rate", direction: "higher-is-better", role: "primary" },
        ...(guardrail ? [{ name: "complaints", source_event: "metric.observed", aggregation: "rate", direction: "lower-is-better", role: "guardrail" }] : []),
      ],
      experiments: [{ surface_file: "app/page.tsx", variant_grammar: "page@1.0.0", split: [50, 50], excluded_categories: ["legal"] }],
      evals: { holdout_rule: "cohort-50-50", per_arm_floor: 20, minimum_effect_rule: "mde-at-80-power", test_id: "newcombe-wilson-difference-v1", alpha: 0.05, effect_floor: 0 },
      promote_via: ["app/page.tsx"],
    },
  }, null, 2);
  writeFileSync(join(fix, "products", "fixmod", "manifest.json"), manifest(false));
  const sp = spine("evolve");
  const empty = fingerprint(sp);
  const ev = (...a) => node([S("evolve", "arc-evolve.mjs"), ...a, "--root", sp, "--repo", fix]);
  const open = ev("open", "--experiment", "x-suite", "--module", "fixmod", "--surface", "page", "--target", "app/page.tsx", "--arms", "+champion,+challenger");
  check("evolve open: plans (exit 0) and wrote nothing", open.status === 0 && /sealed at/.test(open.stdout) && fingerprint(sp) === empty, `${open.status} ${open.stderr}`);
  const o = emitLast(open.stdout, sp);
  check("evolve open: the printed emit lands (the emitter derives the idem)", o.status === 0, o.why);
  const again = ev("open", "--experiment", "x-suite", "--module", "fixmod", "--surface", "page", "--target", "app/page.tsx", "--arms", "+champion,+challenger");
  check("evolve open: the same experiment twice refuses (ALREADY_OPEN)", again.status === 2 && /ALREADY_OPEN/.test(again.stderr), again.stderr);
  const nosurf = ev("open", "--experiment", "x-other", "--module", "fixmod", "--surface", "page", "--target", "app/other.tsx", "--arms", "+a,+b");
  check("evolve open: a file the module does not declare as a surface refuses (NOT_A_SURFACE)", nosurf.status === 2 && /NOT_A_SURFACE/.test(nosurf.stderr), nosurf.stderr);

  // Units in the VERDICT cohort, per arm, by the experiment's own assignment -- the suite computes nothing assign() does not.
  const A = await import(pathToFileURL(S("evolve", "assign.mjs")).href);
  const perArm = { "+champion": [], "+challenger": [] };
  let genUnit = null;
  for (let i = 0; i < 400 && (perArm["+champion"].length < 20 || perArm["+challenger"].length < 20 || !genUnit); i++) {
    const a = A.assign("x-suite", `u-${i}`, ["+champion", "+challenger"], [50, 50]);
    if (a.cohort === "verdict" && perArm[a.arm].length < 20) perArm[a.arm].push(`u-${i}`);
    if (a.cohort === "generation" && !genUnit) genUnit = `u-${i}`;
  }
  check("fixture: 20 verdict-cohort units per arm exist (vacuous-pass guard)", perArm["+champion"].length === 20 && perArm["+challenger"].length === 20 && !!genUnit);
  let landedN = 0;
  const measure = (unit, value) => {
    const m = ev("measure", "--experiment", "x-suite", "--unit", unit, "--metric", "converted", "--value", String(value), "--count", "1", "--window", "2026-09-01..2026-09-07", "--source", "src-1");
    if (m.status !== 0) return m;
    const r = emitLast(m.stdout, sp);
    if (r.status === 0) landedN++;
    return m;
  };
  // The challenger converts every unit, the champion none: a verdict the one test must reach.
  for (const u of perArm["+champion"]) measure(u, 0);
  for (const u of perArm["+challenger"]) measure(u, 1);
  check("evolve measure: 40 measurements planned and landed through the printed emits", landedN === 40, `landed=${landedN}`);
  const gen = measure(genUnit, 1);
  check("evolve measure: a generation-cohort unit is measured too (it counts toward nothing in the verdict)", gen.status === 0 && /generation cohort/.test(gen.stdout), `${gen.status} ${gen.stderr}`);
  const notMetric = ev("measure", "--experiment", "x-suite", "--unit", "u-x", "--metric", "nope", "--value", "1", "--count", "1", "--window", "2026-09-01..2026-09-07", "--source", "s");
  check("evolve measure: a metric the module does not declare refuses (NOT_A_METRIC)", notMetric.status === 2 && /NOT_A_METRIC/.test(notMetric.stderr), notMetric.stderr);

  const conclude = ev("conclude", "--experiment", "x-suite");
  check("evolve conclude: a verdict is reached from the receipts (exit 0)", conclude.status === 0 && /conclude x-suite/.test(conclude.stdout), `${conclude.status} ${conclude.stderr}`);
  const c = emitLast(conclude.stdout, sp);
  check("evolve conclude: the verdict's emit lands on the spine", c.status === 0, c.why);
  const plan = JSON.parse(String(conclude.stdout).trim().split(/\r?\n/).pop());
  const payload = JSON.parse(plan.emit[3]);
  check("evolve conclude: n per arm is the verdict cohort's 20 each, and the delta is the whole difference",
    payload.n_per_arm["+champion"] === 20 && payload.n_per_arm["+challenger"] === 20 && payload.delta === 1 && payload.bound > 0 && /^[0-9a-f]{64}$/.test(payload.config_hash) && /^[0-9a-f]{64}$/.test(payload.metric_hash), JSON.stringify(payload));
  const twice = ev("conclude", "--experiment", "x-suite");
  check("evolve conclude: a second conclude refuses -- compute once (fixed horizon)", twice.status === 2 && /already computed/.test(twice.stderr), twice.stderr);
  const after = ev("measure", "--experiment", "x-suite", "--unit", perArm["+champion"][0], "--metric", "converted", "--value", "1", "--count", "1", "--window", "2026-09-08..2026-09-14", "--source", "s");
  check("evolve measure: after the verdict refuses (VERDICTED)", after.status === 2 && /VERDICTED/.test(after.stderr), after.stderr);

  // A second experiment: canonical drift, a non-binary primary value, and a guardrail with no threshold.
  const sp2 = spine("evolve-2");
  const ev2 = (...a) => node([S("evolve", "arc-evolve.mjs"), ...a, "--root", sp2, "--repo", fix]);
  emitLast(ev2("open", "--experiment", "x-two", "--module", "fixmod", "--surface", "page", "--target", "app/page.tsx", "--arms", "+champion,+challenger").stdout, sp2);
  const u2 = [];
  for (let i = 0; u2.length < 1 && i < 100; i++) if (A.assign("x-two", `v-${i}`, ["+champion", "+challenger"], [50, 50]).cohort === "verdict") u2.push(`v-${i}`);
  emitLast(ev2("measure", "--experiment", "x-two", "--unit", u2[0], "--metric", "converted", "--value", "0.5", "--count", "1", "--window", "2026-09-01..2026-09-07", "--source", "s").stdout, sp2);
  const nb = ev2("conclude", "--experiment", "x-two");
  check("evolve conclude: a primary value other than 0 or 1 refuses by name (NOT_BINARY, ADR-0306's trigger)", nb.status === 2 && /NOT_BINARY/.test(nb.stderr), nb.stderr);
  writeFileSync(join(fix, "products", "fixmod", "manifest.json"), manifest(true));
  const gr = ev2("conclude", "--experiment", "x-two");
  check("evolve conclude: refuses before scoring when a value is not binary, whatever the guardrails", gr.status === 2, gr.stderr);
  writeFileSync(join(fix, "app", "page.tsx"), "export default function Page() { return 'moved' }\n");
  const drift = ev2("measure", "--experiment", "x-two", "--unit", "v-99", "--metric", "converted", "--value", "1", "--count", "1", "--window", "2026-09-01..2026-09-07", "--source", "s");
  check("evolve measure: a surface whose bytes moved refuses (CANONICAL_DRIFT)", drift.status === 2 && /CANONICAL_DRIFT/.test(drift.stderr), drift.stderr);
  const real = node([S("evolve", "arc-evolve.mjs"), "open", "--experiment", "x-real", "--module", "core", "--surface", "hero", "--target", "app/home/hero.tsx", "--arms", "+a,+b", "--root", spine("evolve-real")]);
  check("evolve open on THIS tree refuses by name: no product here declares an evolve section", real.status === 2 && /NO_EVOLVE_SECTION/.test(real.stderr), real.stderr);
}

// ---- the door: an effect past the spine is refused on a sim door, and runs on a live one ----
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
  check("door: a sim door refuses the effect's apply -> SIM_EFFECT, and the tool never ran", code === "SIM_EFFECT" && DOOR.WORK_STATUS.SIM_EFFECT === 403 && !(() => { try { readFileSync(marker); return true; } catch { return false; } })(), `code=${code}`);
  let again = null;
  try { sim.apply("fixture.effect", { planId: p.planId, confirm: "fixture.effect" }); } catch (e) { again = e.code; }
  check("door: the refused plan is still held, and refused the same way again", again === "SIM_EFFECT");
  const live = DOOR.createWorkDoor({ mode: "live", root: sp, repo: fx }, { registry });
  const lp = await live.plan("fixture.effect", { input: {} });
  live.apply("fixture.effect", { planId: lp.planId, confirm: "fixture.effect" });
  await live.settled();
  check("door: a LIVE door runs the same apply (the refusal is the sim door's, not the op's)", (() => { try { return readFileSync(marker, "utf8") === "ran"; } catch { return false; } })());
}

// ---- the law: nothing the face runs writes engine/router.yaml or hq.policy.yaml in place ----
{
  const OPS = (await import(pathToFileURL(S("hq", "face-ops.mjs")).href)).OPS;
  const scripts = [...new Set(OPS.flatMap((o) => {
    const v = Object.fromEntries((o.fields || []).map((f) => [f.name, f.options ? f.options[0] || "x" : "x"]));
    const cmds = [o.plan(v)]; if (typeof o.apply === "function") cmds.push(o.apply(v));
    return cmds.map((c) => c.script);
  }))];
  check("the registry's tools are known (vacuous-pass guard)", scripts.length >= 8, scripts.join(","));
  const offenders = scripts.filter((s) => {
    const src = readFileSync(S(...s.split("/")), "utf8");
    return /(writeFileSync|appendFileSync|renameSync|copyFileSync)\([^)]*(router\.yaml|hq\.policy\.yaml|ROUTER\b|POLICY_FILE)/.test(src);
  });
  check("no tool the face runs writes engine/router.yaml or hq.policy.yaml in place", offenders.length === 0, offenders.join(","));
  const PB = await import(pathToFileURL(S("core", "proposal-branch.mjs")).href);
  let ug = null;
  try { PB.checkFiles([{ path: "hq.policy.yaml", content: "x" }], ["hq.policy.yaml"]); } catch (e) { ug = e.code; }
  check("the proposal-branch writer refuses hq.policy.yaml even when a caller allows it (UNGRANTABLE)", ug === "UNGRANTABLE");
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 40 ? 0 : 1);
