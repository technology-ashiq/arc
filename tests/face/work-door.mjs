#!/usr/bin/env node
// work-door.mjs -- the WORK door's contract suite (face v2 Phase 05; REQ-07, ADR-1326, ADR-1334, ADR-1339).
//
// Self-contained: builds two identical fixture spines in a temp dir, boots arc-dash in sim mode over the first, drives
// every op through plan -> apply -> run, and runs the SAME op by hand -- the command its tool prints -- over the second.
// The receipts must match: that is the no-second-path fixture, measured per op rather than asserted of the design.
// Also: a plan writes nothing, the door's refusals are named, a human-run op needs its confirmation, two applies of one
// plan run the tool ONCE (a counting fixture CLI, through createWorkDoor itself), a sim door never spends, and no op
// touches the repository's files.
//
// VACUOUS-PASS GUARD: the fixture is proven seeded and the door proven to see it before any behavioural check, and the
// last line is "RAN: <n> checks", which the bats wrapper requires -- a suite that dies half-way cannot read green.

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PORT = 8431;
const TOKEN = "work-door-token";
const ORIGIN = `http://127.0.0.1:${PORT}`;
const EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");

const OPS_MOD = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "face-ops.mjs")).href);
const DOOR_MOD = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "work-door.mjs")).href);
// The door HTML-escapes every string it serves; a refusal compared with a hand-run is compared as the face DRAWS it.
const { unescapeDoorText: DOOR_TEXT } = await import(pathToFileURL(join(REPO, "face", "src", "lib", "door.mjs")).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const tmp = mkdtempSync(join(tmpdir(), "face-work-door-"));
const SPINE_A = join(tmp, "spine-door");
const SPINE_B = join(tmp, "spine-hand");
const JOURNAL = join(tmp, "journal");
for (const d of [SPINE_A, SPINE_B]) mkdirSync(join(d, "events"), { recursive: true });

// ---- the fixture: one real payment in the month before this one, on both spines ----
// Mid-month, so no zone or boundary question reaches the close; last month, so the close is of a month that ended.
const now = new Date();
const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 6, 0, 0));
const MONTH = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
writeFileSync(join(tmp, "charge.json"), JSON.stringify({ amount: 100000, currency: "INR", venture: "arc", provider: "razorpay", provider_payment_id: "razorpay:pay_workdoor1" }));
const seeded = [SPINE_A, SPINE_B].map((root) => spawnSync(process.execPath,
  [EVENT, "ingest", "revenue.received", "--json", join(tmp, "charge.json"), "--venture", "arc", "--run-id", "r-workdoor"],
  { cwd: REPO, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: root, ARC_SPINE_NOW: String(prev.getTime()) } }));
check("fixture: one payment ingested on each spine (vacuous-pass guard)",
  seeded.every((r) => r.status === 0 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(String(r.stdout).trim())), seeded.map((r) => `${r.status}:${String(r.stderr).trim()}`).join(" | "));

// The article a person merged, for the growth seal.
const ARTICLE = join(tmp, "work-door-probe.mdx");
writeFileSync(ARTICLE, "---\ntitle: The work door, probed\n---\n\nA probe article the suite seals twice: once through the door, once by hand.\n");

/** Every file under a spine, hashed -- what "writes nothing" is measured against. */
function spineFingerprint(root) {
  const out = [];
  const walk = (d) => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(`${p.slice(root.length)}:${createHash("sha256").update(readFileSync(p)).digest("hex")}`);
    }
  };
  walk(root);
  return out.join("\n");
}
const gitStatus = () => execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" });
const gitHead = () => execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
const statusBefore = gitStatus();
const headBefore = gitHead();

// The inputs each op is driven with, on both paths. Every registry op must appear here: an op the suite does not
// drive is an op whose no-second-path property nobody measured.
const INPUTS = {
  "today.capture-idea": { text: "the work door captured this" },
  "develop.checkpoint": { lane: "face" },
  "money.criteria": { what: "the work door suite asks for a criteria change" },
  "money.close-month": { month: MONTH, totals: "razorpay:INR=100000" },
  "growth.publish": { slug: "work-door-probe", article: ARTICLE, cluster: "c-001", title: "The work door, probed", pr: "7" },
  "bench.run-model": { driver: "mock", model: "mock", inr: "1", minutes: "5" },
  // The kernel ring (ADR-1340).
  "scheduler.register-job": { job: "day-close-roll" },
  "engine-room.driver-switch": { class: "review-diff", to: "codex", why: "the work door suite proposes this" },
  "model-policy.tier-proposal": { class: "face-ask", to: "high-judgment" },
  "policy.cap-proposal": { kind: "process:kickoff-plan", capability: "write", to: "L2", evidence: "docs/trial-ledger.md#work-door-suite" },
  "evolve.open-experiment": { experiment: "x-work-door", module: "core", surface: "hero", target: "app/home/hero.tsx", arms: "+champion,+challenger" },
  "evolve.measure": { experiment: "x-work-door", unit: "u-1", metric: "signup_conversion", value: "1", count: "1", window: "2026-09-01..2026-09-07", source: "src-1" },
  "evolve.conclude": { experiment: "x-work-door" },
};
// The ops whose tool refuses its PLAN on this tree, each by its NAMED refusal -- any refusal would pass a sim door that
// ran an effect and failed later (PR 3a logic attack). No product here declares an evolve section, so open answers
// NO_EVOLVE_SECTION and measure and conclude answer NOT_OPEN; an effect op refuses its dry run where it cannot plan at
// all (no main in a CI checkout, no Windows scheduler) and otherwise plans, and a sim door then refuses SIM_EFFECT.
const REFUSES_ON_THIS_TREE = new Map([["evolve.open-experiment", /NO_EVOLVE_SECTION/], ["evolve.measure", /NOT_OPEN/], ["evolve.conclude", /NOT_OPEN/]]);
const PLAN_REFUSAL_IF_ANY = new Map([["scheduler.register-job", /targets Windows/], ["engine-room.driver-switch", /NO_BASE/], ["model-policy.tier-proposal", /NO_BASE/]]);
check("every registry op is driven by this suite",
  OPS_MOD.OPS.length > 0 && OPS_MOD.OPS.every((o) => Object.hasOwn(INPUTS, o.id)) && Object.keys(INPUTS).length === OPS_MOD.OPS.length,
  OPS_MOD.OPS.map((o) => o.id).join(","));
// THE EFFECT IS DERIVED FROM THE TOOL, never read off the flag it is meant to verify. The first cut asserted "every op
// flagged touchesFiles applies through a proposal tool" -- with the flag dropped from a row, that held vacuously, and a
// sim door wrote a real branch (PR 3a logic attack). Now: the branch writers are every script that imports
// writeProposal, the OS effect is arc-jobs register, and each row's flag must equal what its apply script is, BOTH ways.
const WRITERS = (() => {
  const out = new Set();
  const root = join(REPO, ".claude", "scripts");
  const walk = (d) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, n.name);
      if (n.isDirectory()) { walk(p); continue; }
      if (!n.name.endsWith(".mjs") || n.name === "proposal-branch.mjs") continue;
      if (/import\s*\{[^}]*\bwriteProposal\b[^}]*\}\s*from\s*"[^"]*core\/proposal-branch\.mjs"/.test(readFileSync(p, "utf8"))) out.add(p.slice(root.length + 1).split(sep).join("/"));
    }
  };
  walk(root);
  return out;
})();
check("the branch writers are found by what they import (vacuous-pass guard)", WRITERS.has("engine/propose.mjs"), [...WRITERS].join(","));
const effectOfScript = (o) => {
  if (typeof o.apply !== "function") return { files: false, os: false };
  const cmd = o.apply(INPUTS[o.id]);
  return { files: WRITERS.has(cmd.script), os: cmd.script === "hq/arc-jobs.mjs" && cmd.args[0] === "register" };
};
const flagMismatch = (ops) => ops.filter((o) => { const e = effectOfScript(o); return (o.touchesFiles === true) !== e.files || (o.touchesOs === true) !== e.os; }).map((o) => o.id);
check("every op's effect flags are what its apply script IS, both ways (touchesFiles <-> a branch writer, touchesOs <-> register)",
  flagMismatch(OPS_MOD.OPS).length === 0, flagMismatch(OPS_MOD.OPS).join(","));
{
  const mutant = OPS_MOD.OPS.map((o) => (o.id === "engine-room.driver-switch" ? { ...o, touchesFiles: false } : o));
  check("MUTANT CONTROL: a row with its touchesFiles dropped is caught by the derivation", flagMismatch(mutant).includes("engine-room.driver-switch"));
}
check("every effect op is human-run", OPS_MOD.OPS.filter((o) => o.touchesFiles || o.touchesOs).every((o) => o.humanRun === true));
// Every op's receipt is a kind the spine has (ADR-1334).
{
  const V = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "validate.mjs")).href);
  const KINDS = new Set(V.KINDS);
  check("every op writes a kind already in KINDS", KINDS.size > 40 && OPS_MOD.OPS.every((o) => KINDS.has(o.receipt.kind)), OPS_MOD.OPS.map((o) => o.receipt.kind).join(","));
}

// ---- the hand-run: exactly what a person would type, from the tool's own output ----
function handRun(op, values) {
  const env = { ...process.env, ARC_SPINE_ROOT: SPINE_B };
  const run = (cmd) => spawnSync(process.execPath, [join(REPO, ".claude", "scripts", ...cmd.script.split("/")), ...cmd.args], { cwd: REPO, encoding: "utf8", env });
  let applyCmd;
  if (op.apply === "emit-plan" || op.expect === true) {
    const planned = run(op.plan(values));
    if (planned.status !== 0) return { error: `plan exited ${planned.status}: ${planned.stderr}` };
    const last = JSON.parse(String(planned.stdout).trim().split(/\r?\n/).pop() || "");
    // A person types what the plan printed: the emit line, or the same command with --expect and the plan's digest.
    applyCmd = op.apply === "emit-plan" ? { script: "hq/arc-event.mjs", args: last.emit } : { ...op.apply(values), args: [...op.apply(values).args, "--expect", last.expect] };
  } else {
    applyCmd = op.apply(values);
  }
  const res = run(applyCmd);
  return { exit: res.status, stdout: res.stdout, stderr: res.stderr };
}
/** The receipts of one kind on a spine, read through the spine's own reader. */
async function receiptsOf(root, kind) {
  const S = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "spine.mjs")).href);
  return (await S.query(root, { kind, engine: "scan" })).events.map((e) => e.event);
}

// ---- boot the door (sim, over spine A) ----
const dash = spawn(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--spine", SPINE_A, "--port", String(PORT)],
  { cwd: REPO, env: { ...process.env, ARC_DASH_TOKEN: TOKEN, ARC_DASH_JOURNAL_DIR: JOURNAL }, stdio: ["ignore", "ignore", "pipe"] });
let doorErr = "";
dash.stderr.on("data", (c) => { doorErr += c; });
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
// ONE retry when the socket was closed under a reused connection: the door pins keepAliveTimeout at 5 s (slowloris),
// and this suite pauses longer than that between requests while a hand-run works, so a pooled socket can be closed at
// the moment it is reused ("other side closed", 3 of 19 CI jobs). A retry is safe by the door's own contract: a plan
// is a new one-shot plan, and an apply of the same plan id REPLAYS -- it never runs twice.
const j = async (path, opts = {}) => {
  let r;
  try { r = await fetch(`http://127.0.0.1:${PORT}${path}`, opts); }
  catch (e) {
    const cause = e && e.cause ? String(e.cause.code || e.cause.message || e.cause) : "";
    if (!/other side closed|ECONNRESET|UND_ERR_SOCKET/i.test(cause)) throw e;
    r = await fetch(`http://127.0.0.1:${PORT}${path}`, opts);
  }
  let body; try { body = await r.json(); } catch { body = {}; }
  return { status: r.status, body };
};
const post = (path, body, extra = {}) => j(path, { method: "POST", headers: { ...H, ...extra }, body: JSON.stringify(body) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(planId) {
  let r;
  for (let i = 0; i < 600; i++) {
    r = await j(`/api/op-run/${planId}`, { headers: H });
    if (r.body && r.body.state === "done") return r;
    await sleep(200);
  }
  return r;
}

let up = false;
for (let i = 0; i < 50 && !up; i++) {
  await sleep(200);
  try { up = (await j("/api/health", { headers: H })).status === 200; } catch { /* not yet */ }
}

try {
  check("door up", up, doorErr.slice(-300));
  let r = await j("/api/health", { headers: H });
  check("door sees the seeded fixture", r.body.spine && r.body.spine.events === 1, `saw=${r.body.spine && r.body.spine.events}`);

  // ---- the registry the face reads ----
  r = await j("/api/ops", { headers: H });
  check("GET /api/ops serves exactly the registry", r.status === 200 && JSON.stringify(r.body.ops.map((o) => o.id)) === JSON.stringify(OPS_MOD.OPS.map((o) => o.id)), JSON.stringify(r.body).slice(0, 200));

  // ---- refusals, each by name ----
  r = await post("/api/op/ghost.op/plan", { input: {} });
  check("an op the door does not serve -> UNKNOWN_OP 404", r.status === 404 && r.body.error === "UNKNOWN_OP", `${r.status} ${r.body.error}`);
  r = await post("/api/op/today.capture-idea/plan", { input: { text: "x", extra: "y" } });
  check("a field the op does not take -> BAD_INPUT", r.status === 400 && r.body.error === "BAD_INPUT", `${r.status} ${r.body.error}`);
  r = await post("/api/op/today.capture-idea/plan", { input: {} });
  check("a required field left out -> BAD_INPUT", r.status === 400 && r.body.error === "BAD_INPUT");
  r = await post("/api/op/today.capture-idea/plan", { input: { text: "--strict" } });
  check("a value that opens with a dash -> BAD_INPUT (a tool could read it as a flag)", r.status === 400 && r.body.error === "BAD_INPUT");
  r = await post("/api/op/today.capture-idea/plan", { input: { text: "x".repeat(301) } });
  check("a value past its byte bound -> BAD_INPUT", r.status === 400 && r.body.error === "BAD_INPUT");
  r = await post("/api/op/today.capture-idea/plan", { input: { text: "two\nlines" } });
  check("a line break in a one-line field -> BAD_INPUT", r.status === 400 && r.body.error === "BAD_INPUT");
  r = await post("/api/op/bench.run-model/plan", { input: { driver: "no-such-driver", model: "m", inr: "1", minutes: "5" } });
  check("a select value outside its options -> BAD_INPUT", r.status === 400 && r.body.error === "BAD_INPUT");
  r = await post("/api/op/bench.run-model/plan", { input: { driver: "mock", model: "m", inr: "0", minutes: "5" } });
  check("an int below its range -> BAD_INPUT", r.status === 400 && r.body.error === "BAD_INPUT");
  r = await post("/api/op/today.capture-idea/plan", { input: { text: "x" }, planId: "y" });
  check("plan takes { input } and nothing else -> BAD_INPUT", r.status === 400 && r.body.error === "BAD_INPUT", `${r.status} ${r.body.error}`);
  const paid = OPS_MOD.OPS.find((o) => o.id === "bench.run-model").fields.find((f) => f.name === "driver").options.find((d) => d !== "mock");
  if (paid) {
    r = await post("/api/op/bench.run-model/plan", { input: { driver: paid, model: "m", inr: "1", minutes: "5" } });
    check("a sim door never spends: a paid driver -> SIM_SPEND", r.status === 403 && r.body.error === "SIM_SPEND", `${r.status} ${r.body.error}`);
  }
  r = await post("/api/op/today.capture-idea/apply", { planId: "AAAAAAAAAAAAAAAAAAAAAAAA" }, { Origin: ORIGIN });
  check("an unknown plan id -> UNKNOWN_PLAN", r.status === 404 && r.body.error === "UNKNOWN_PLAN", `${r.status} ${r.body.error}`);
  r = await post("/api/op/today.capture-idea/apply", { planId: ["a", "b"] }, { Origin: ORIGIN });
  check("apply takes ONE plan id, never a list -> BAD_PLAN_ID", r.status === 400 && r.body.error === "BAD_PLAN_ID", `${r.status} ${r.body.error}`);
  r = await post("/api/op/today.capture-idea/apply", [{ planId: "x" }], { Origin: ORIGIN });
  check("an array body -> BAD_PLAN_ID", r.status === 400 && r.body.error === "BAD_PLAN_ID", `${r.status} ${r.body.error}`);

  // ---- every op, both paths ----
  for (const op of OPS_MOD.OPS) {
    const values = INPUTS[op.id];
    const before = spineFingerprint(SPINE_A);
    const plan = await post(`/api/op/${op.id}/plan`, { input: values });
    // An op whose tool refuses here -- the evolve verbs on a tree with no evolve section, an effect op whose tool
    // refuses its dry run (no main to base a proposal on in a CI checkout, no Windows scheduler) -- must refuse through
    // the door EXACTLY as by hand: the same exit and the same first line. That is its no-second-path fixture here.
    const namedRefusal = REFUSES_ON_THIS_TREE.get(op.id) || PLAN_REFUSAL_IF_ANY.get(op.id);
    if (plan.status === 200 && plan.body.ok === false && namedRefusal) {
      // The hand-run on the SAME spine the door read, and the WHOLE first line compared: the first cut compared sixty
      // characters, read the hand-run's spine elsewhere, and never pinned which refusal it was (PR 3a logic attack).
      const planCmd = op.plan(OPS_MOD.validateInput(op, values));
      const hand = spawnSync(process.execPath, [join(REPO, ".claude", "scripts", ...planCmd.script.split("/")), ...planCmd.args], { cwd: REPO, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: SPINE_A } });
      const first = (s) => String(s || "").trim().split(/\r?\n/)[0] || "";
      const unpath = (s) => s.replace(/\[path withheld\]|[A-Z]:[\\/][^ ]*|\/[^ ]*/g, "<path>");
      const doorFirst = DOOR_TEXT(plan.body.refusal.stderr || plan.body.refusal.stdout || "").trim().split(/\r?\n/)[0] || "";
      check(`${op.id}: refused through the door exactly as by hand (exit ${hand.status}), by name`,
        plan.body.refusal.exit === hand.status && hand.status !== 0 && namedRefusal.test(doorFirst) && unpath(first(hand.stderr || hand.stdout)) === unpath(doorFirst),
        `door=${plan.body.refusal.exit} ${JSON.stringify(doorFirst)} hand=${hand.status} ${JSON.stringify(first(hand.stderr || hand.stdout))}`);
      check(`${op.id}: the refused plan wrote nothing`, spineFingerprint(SPINE_A) === before);
      continue;
    }
    if (REFUSES_ON_THIS_TREE.has(op.id)) { check(`${op.id}: refuses on this tree, by name`, false, `${plan.status} ${JSON.stringify(plan.body).slice(0, 300)}`); continue; }
    // An effect op that PLANNED (a clone with a main, a Windows leg): the plan wrote nothing, and a sim door refuses the
    // apply by name before anything runs -- no task registered, no branch written (ADR-1340).
    if (op.touchesFiles || op.touchesOs) {
      check(`${op.id}: the effect op's plan answers ok and wrote nothing`, plan.status === 200 && plan.body.ok === true && spineFingerprint(SPINE_A) === before, `${plan.status} ${plan.body.error || ""}`);
      const refsBefore = execFileSync("git", ["for-each-ref", "--format=%(refname)"], { cwd: REPO, encoding: "utf8" });
      const ap = await post(`/api/op/${op.id}/apply`, { planId: plan.body.planId, confirm: op.id }, { Origin: ORIGIN });
      check(`${op.id}: a sim door refuses the apply -> SIM_EFFECT, and nothing ran`, ap.status === 403 && ap.body.error === "SIM_EFFECT" && spineFingerprint(SPINE_A) === before, `${ap.status} ${ap.body.error}`);
      check(`${op.id}: no branch appeared`, execFileSync("git", ["for-each-ref", "--format=%(refname)"], { cwd: REPO, encoding: "utf8" }) === refsBefore);
      continue;
    }
    check(`${op.id}: the plan answers ok`, plan.status === 200 && plan.body.ok === true && typeof plan.body.planId === "string",
      `${plan.status} ${plan.body.error || ""} ${JSON.stringify(plan.body.refusal || "").slice(0, 400)}`);
    check(`${op.id}: the plan wrote nothing to the spine`, spineFingerprint(SPINE_A) === before);
    check(`${op.id}: the plan names the command, what apply runs, the files and the cost`,
      [plan.body.command, plan.body.apply, plan.body.diff, plan.body.estimate].every((s) => typeof s === "string" && s.length > 0));
    if (plan.body.ok !== true) continue;

    // Without Origin the mutating route refuses before anything runs.
    const noOrigin = await post(`/api/op/${op.id}/apply`, { planId: plan.body.planId });
    check(`${op.id}: apply without Origin -> NO_ORIGIN`, noOrigin.status === 403 && noOrigin.body.error === "NO_ORIGIN", `${noOrigin.status} ${noOrigin.body.error}`);
    if (op.humanRun) {
      const bare = await post(`/api/op/${op.id}/apply`, { planId: plan.body.planId }, { Origin: ORIGIN });
      check(`${op.id}: human-run, so apply without the confirmation -> CONFIRM_REQUIRED`, bare.status === 428 && bare.body.error === "CONFIRM_REQUIRED", `${bare.status} ${bare.body.error}`);
      const wrong = await post(`/api/op/${op.id}/apply`, { planId: plan.body.planId, confirm: "today.capture-idea" }, { Origin: ORIGIN });
      check(`${op.id}: a confirmation naming another op -> CONFIRM_REQUIRED`, wrong.status === 428);
    }
    const other = OPS_MOD.OPS.find((o) => o.id !== op.id);
    const cross = await post(`/api/op/${other.id}/apply`, { planId: plan.body.planId, confirm: other.id }, { Origin: ORIGIN });
    check(`${op.id}: its plan applied as another op -> PLAN_OTHER_OP`, cross.status === 409 && cross.body.error === "PLAN_OTHER_OP", `${cross.status} ${cross.body.error}`);

    const ofOp = (events) => events.filter((e) => !op.receipt.process || e.process === op.receipt.process);
    const kindBefore = ofOp(await receiptsOf(SPINE_A, op.receipt.kind)).length;
    const body = { planId: plan.body.planId, ...(op.humanRun ? { confirm: op.id } : {}) };
    // Two applies of one plan, concurrently: one run.
    const [a1, a2] = await Promise.all([post(`/api/op/${op.id}/apply`, body, { Origin: ORIGIN }), post(`/api/op/${op.id}/apply`, body, { Origin: ORIGIN })]);
    check(`${op.id}: two concurrent applies -> one run, the other a replay`, a1.status === 200 && a2.status === 200 && [a1.body.replayed, a2.body.replayed].filter(Boolean).length === 1,
      `${a1.status}/${a2.status} ${a1.body.replayed}/${a2.body.replayed} ${a1.body.error || ""}${a2.body.error || ""}`);
    const done = await settle(plan.body.planId);
    const result = done && done.body && done.body.result;
    check(`${op.id}: the run ends with a receipt of ${op.receipt.kind}`, !!result && result.ok === true && result.receipt && result.receipt.kind === op.receipt.kind,
      JSON.stringify(result || done && done.body).slice(0, 500));
    const kindAfter = await receiptsOf(SPINE_A, op.receipt.kind);
    const mine = ofOp(kindAfter);
    check(`${op.id}: the spine gained exactly one ${op.receipt.kind}${op.receipt.process ? ` from ${op.receipt.process}` : ""}, and it is the run's`,
      mine.length === kindBefore + 1 && !!result && !!result.receipt && mine.some((e) => e.id === result.receipt.id), `before=${kindBefore} after=${mine.length}`);
    const again = await post(`/api/op/${op.id}/apply`, body, { Origin: ORIGIN });
    check(`${op.id}: a repeat apply replays the run and runs nothing`, again.status === 200 && again.body.replayed === true && again.body.result && result && again.body.result.receipt && again.body.result.receipt.id === result.receipt.id);
    check(`${op.id}: ... and the spine did not grow`, (await receiptsOf(SPINE_A, op.receipt.kind)).length === kindAfter.length);

    // THE NO-SECOND-PATH FIXTURE: the same op, by hand, on the twin spine. The receipt must match.
    const hand = handRun(op, OPS_MOD.validateInput(op, values));
    check(`${op.id}: the hand-run exits as the door's run did`, hand.exit === result.exit, `hand=${hand.exit} ${hand.error || String(hand.stderr).slice(0, 300)}`);
    const handReceipts = (await receiptsOf(SPINE_B, op.receipt.kind)).filter((e) => !op.receipt.process || e.process === op.receipt.process);
    const handLast = handReceipts[handReceipts.length - 1];
    const doorEvent = kindAfter.find((e) => result && e.id === result.receipt.id);
    const comparable = (e) => (op.id === "bench.run-model"
      // Bench's payload carries measurements of the run (attempts, a scorecard sha over timings); the parity that
      // matters is what was run and against what -- the same subject, model, router and classes.
      ? { kind: e.kind, process: e.process, outcome: e.outcome, subject: e.payload.subject, model_applied: e.payload.model_applied, router_unchanged: e.payload.router_unchanged, classes: (e.payload.classes || []).map((c) => c.task_class) }
      : { kind: e.kind, process: e.process, actor: e.actor, venture: e.venture, outcome: e.outcome, payload: e.payload, idemFixed: op.id === "money.close-month" || op.id === "money.criteria" ? e.idem : null });
    check(`${op.id}: NO SECOND PATH -- the door's receipt is the hand-run's receipt`,
      !!doorEvent && !!handLast && JSON.stringify(comparable(doorEvent)) === JSON.stringify(comparable(handLast)),
      `door=${JSON.stringify(doorEvent && comparable(doorEvent)).slice(0, 300)} hand=${JSON.stringify(handLast && comparable(handLast)).slice(0, 300)}`);
  }

  // ---- each run reports ITS OWN receipt (logic attack: six concurrent captures came back with each other's) ----
  {
    const texts = ["attribution one", "attribution two", "attribution three", "attribution four"];
    const plans = await Promise.all(texts.map((text) => post("/api/op/today.capture-idea/plan", { input: { text } })));
    check("attribution: four capture plans held", plans.every((p) => p.body.ok === true), plans.map((p) => p.status).join(","));
    await Promise.all(plans.map((p) => post("/api/op/today.capture-idea/apply", { planId: p.body.planId }, { Origin: ORIGIN })));
    const runs = await Promise.all(plans.map((p) => settle(p.body.planId)));
    const ideas = await receiptsOf(SPINE_A, "idea.captured");
    const own = runs.map((r, i) => {
      const rec = r.body.result && r.body.result.receipt;
      const ev = rec && ideas.find((e) => e.id === rec.id);
      return !!ev && ev.payload.text === texts[i];
    });
    check("attribution: four concurrent runs each report the receipt that carries THEIR text", own.every(Boolean), JSON.stringify(own));
    check("attribution: four runs, four distinct receipts", new Set(runs.map((r) => r.body.result && r.body.result.receipt && r.body.result.receipt.id)).size === 4);
  }

  // ---- the door reads receipts by scan, so a derived sqlite index cannot hide a fresh one (logic attack) ----
  {
    const replay = spawnSync(process.execPath, [join(REPO, ".claude/scripts/hq/arc-replay.mjs"), "--quiet"], { cwd: REPO, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: SPINE_A } });
    if (existsSync(join(SPINE_A, "derived", "state.db"))) {
      const p = await post("/api/op/today.capture-idea/plan", { input: { text: "after a replay built the index" } });
      await post("/api/op/today.capture-idea/apply", { planId: p.body.planId }, { Origin: ORIGIN });
      const done = await settle(p.body.planId);
      check("with derived/state.db present, a fresh receipt is still found (the door reads by scan)", done.body.result && done.body.result.ok === true, JSON.stringify(done.body.result).slice(0, 300));
      // The twins (round-2 logic attack): the approval an op raises must be in the inbox, and decidable, with the
      // index still present -- the inbox and decide read through arc-inbox, not through the work door.
      // A FRESH approval, raised after the index was built (money.criteria's idem is the ventures.yaml digest, so the
      // loop above already spent it on this spine -- a second criteria request is a duplicate by design).
      const raisedBy = spawnSync(process.execPath, [EVENT, "emit", "approval.requested", "--payload", JSON.stringify({ gate: "work-door-suite", what: "raised after a replay built the index" }), "--strict"],
        { cwd: REPO, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: SPINE_A } });
      const rid = String(raisedBy.stdout).trim();
      check("with the index present, an approval was raised after it (vacuous-pass guard)", raisedBy.status === 0 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(rid), `${raisedBy.status} ${raisedBy.stderr}`);
      const inbox = await j("/api/inbox", { headers: H });
      check("with the index present, the approval an op just raised is OPEN in the inbox", inbox.status === 200 && (inbox.body.open || []).some((o) => o.id === rid), `${inbox.status} open=${(inbox.body.open || []).map((o) => o.id).join(",")}`);
      const dupe = await j("/api/decide", { method: "POST", headers: { ...H, Origin: ORIGIN }, body: `{"id":"${rid}","verdict":"reject","reason":"no","verdict":"approve"}` });
      check("/api/decide: a body with a duplicate verdict -> BAD_BODY, never last-one-wins (the door's one direct write)", dupe.status === 400 && dupe.body.error === "BAD_BODY", `${dupe.status} ${dupe.body.error}`);
      // PR 2 logic attack: a reason carrying a text-direction control displayed a reject as "approve ...".
      const bidi = await post("/api/decide", { id: rid, verdict: "reject", reason: "approve \u202Eevila\u202C ok" }, { Origin: ORIGIN });
      check("/api/decide: a reason with a text-direction control is refused (BAD_REASON), and nothing is recorded", bidi.status >= 400 && /BAD_REASON/.test(JSON.stringify(bidi.body)), `${bidi.status} ${JSON.stringify(bidi.body).slice(0, 200)}`);
      const dec = await post("/api/decide", { id: rid, verdict: "reject", reason: "the suite rejects what it raised" }, { Origin: ORIGIN });
      check("with the index present, that approval is decidable (not UNKNOWN_APPROVAL)", dec.status === 200 && dec.body.verdict === "reject", `${dec.status} ${JSON.stringify(dec.body).slice(0, 200)}`);
    } else {
      // Node before 22 has no node:sqlite, so arc-replay builds no index and there is nothing to hide a receipt behind.
      check(`no derived/state.db on this Node (${process.version}): the stale-index arm has nothing to run against`, replay.status === 0 || /sqlite/i.test(String(replay.stderr) + String(replay.stdout)), `${replay.status} ${replay.stderr}`);
    }
  }

  // ---- bodies are parsed strictly, and text refuses control characters (logic attack) ----
  {
    const raw = await j("/api/op/today.capture-idea/plan", { method: "POST", headers: H, body: '{"input":{"text":"a"},"input":{"text":"b"}}' });
    check("a body with a duplicate key -> BAD_BODY, never last-one-wins", raw.status === 400 && raw.body.error === "BAD_BODY", `${raw.status} ${raw.body.error}`);
    const esc = await post("/api/op/today.capture-idea/plan", { input: { text: `clear${String.fromCharCode(27)}[2J` } });
    check("an ESC sequence in a one-line field -> BAD_INPUT", esc.status === 400 && esc.body.error === "BAD_INPUT", `${esc.status} ${esc.body.error}`);
    // Valid JSON the spine's canonical form refuses is still a valid BODY (round-2 logic attack: ConvertTo-Json writes
    // CRLF, and a lone CR is whitespace too); a raw line break inside a string is still refused.
    const crlf = await j("/api/op/today.capture-idea/plan", { method: "POST", headers: H, body: '{\r\n  "input": {\r\n    "text": "a CRLF body"\r\n  }\r\n}' });
    check("a CRLF-formatted body is valid JSON and plans", crlf.status === 200 && crlf.body.ok === true, `${crlf.status} ${crlf.body.error}`);
    const bomBody = await j("/api/op/today.capture-idea/plan", { method: "POST", headers: H, body: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"input":{"text":"a BOM body"}}')]) });
    check("a body with one leading BOM plans (RFC 8259 lets a parser ignore it)", bomBody.status === 200 && bomBody.body.ok === true, `${bomBody.status} ${bomBody.body.error}`);
    const loneCr = await j("/api/op/today.capture-idea/plan", { method: "POST", headers: H, body: '{"input":{"text":"a"}\r}' });
    check("a lone CR between tokens is JSON whitespace, and plans (PR 2 logic attack)", loneCr.status === 200 && loneCr.body.ok === true, `${loneCr.status} ${loneCr.body.error}`);
    const inStr = await j("/api/op/today.capture-idea/plan", { method: "POST", headers: H, body: '{"input":{"text":"two\r\nlines"}}' });
    check("a raw line break inside a string is still refused, CRLF or not", inStr.status === 400, `${inStr.status} ${inStr.body.error}`);
    const bidi = await post("/api/op/today.capture-idea/plan", { input: { text: "safe \u202Etxt.exe" } });
    check("a bidi override in a one-line field -> BAD_INPUT (it reorders what the owner reads on the plan card)", bidi.status === 400 && bidi.body.error === "BAD_INPUT", `${bidi.status} ${bidi.body.error}`);
    const tab = await post("/api/op/today.capture-idea/plan", { input: { text: "a\tb" } });
    check("a refused character is NAMED in the refusal (U+0009)", tab.status === 400 && /U\+0009/.test(String(tab.body.message)), `${tab.status} ${tab.body.message}`);
  }

  // ---- a door over a NAMED spine is sim mode, never live (logic attack: ARC_SPINE_ROOT made a scratch spine "live") ----
  {
    const live = spawnSync(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--port", String(PORT + 1)],
      { cwd: REPO, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: SPINE_B, ARC_DASH_JOURNAL_DIR: JOURNAL }, timeout: 20_000 });
    check("arc-dash with ARC_SPINE_ROOT and no --spine refuses to start -> BAD_SPINE_ENV", live.status === 1 && /BAD_SPINE_ENV/.test(live.stderr), `${live.status} ${String(live.stderr).slice(0, 200)}`);
    // Round-2 logic attack: an empty or missing --spine value fell through to LIVE mode.
    const boot = (args, extraEnv = {}) => {
      const env = { ...process.env, ARC_DASH_JOURNAL_DIR: JOURNAL, ...extraEnv };
      delete env.ARC_SPINE_ROOT;
      return spawnSync(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), ...args], { cwd: REPO, encoding: "utf8", env, timeout: 20_000 });
    };
    const empty = boot(["--spine", "", "--port", String(PORT + 1)]);
    check("arc-dash --spine \"\" refuses to start -> BAD_ARGS, never live", empty.status === 2 && /BAD_ARGS/.test(empty.stderr), `${empty.status} ${String(empty.stderr).slice(0, 200)}`);
    const trailing = boot(["--port", String(PORT + 1), "--spine"]);
    check("arc-dash with a trailing --spine refuses to start -> BAD_ARGS, never live", trailing.status === 2 && /BAD_ARGS/.test(trailing.stderr), `${trailing.status} ${String(trailing.stderr).slice(0, 200)}`);
    const swallowed = boot(["--spine", "--port", String(PORT + 1)]);
    check("arc-dash --spine followed by another flag refuses (the flag is not a path)", swallowed.status === 2 && /BAD_ARGS/.test(swallowed.stderr), `${swallowed.status} ${String(swallowed.stderr).slice(0, 200)}`);
    const twice = boot(["--spine", SPINE_A, "--spine", SPINE_B, "--port", String(PORT + 1)]);
    check("arc-dash with two --spine values refuses (never last-one-wins)", twice.status === 2 && /given twice/.test(twice.stderr), `${twice.status} ${String(twice.stderr).slice(0, 200)}`);
    const forced = boot(["--port", String(PORT + 1)], { ARC_SPINE_NOW: String(Date.now()) });
    check("a live door with ARC_SPINE_NOW set refuses to start -> BAD_SPINE_ENV (a forced clock is a fixture's)", forced.status === 1 && /BAD_SPINE_ENV/.test(forced.stderr) && /ARC_SPINE_NOW/.test(forced.stderr), `${forced.status} ${String(forced.stderr).slice(0, 200)}`);
    // PR 2 logic attack: the rest of the class -- a fake driver, the mocks, the leads fakes -- is a fixture's too.
    for (const k of ["ARC_DRIVER_FAKE", "ARC_MOCK_DIR", "arc_leads_fake"]) {
      const f = boot(["--port", String(PORT + 1)], { [k]: "1" });
      check(`a live door with ${k} set refuses to start -> BAD_SPINE_ENV`, f.status === 1 && /BAD_SPINE_ENV/.test(f.stderr), `${f.status} ${String(f.stderr).slice(0, 200)}`);
    }
    // PR 2 shell attack: a port that is not decimal 1..65535 is refused, never NaN into listen() and an exit 0.
    for (const bad of ["abc", "0x10", "70000", "1.5"]) {
      const f = boot(["--spine", SPINE_A, "--port", bad]);
      check(`arc-dash --port ${bad} refuses to start -> BAD_ARGS, exit 2`, f.status === 2 && /BAD_ARGS/.test(f.stderr), `${f.status} ${String(f.stderr).slice(0, 200)}`);
    }
    // PR 2 logic attack: the launcher's twin of the empty --spine hole.
    const faceEmpty = spawnSync(process.execPath, [join(REPO, ".claude/scripts/hq/arc-face.mjs"), "--spine", "", "--no-open"], { cwd: REPO, encoding: "utf8", timeout: 20_000 });
    check("arc-face --spine \"\" refuses (exit 2), never a live door", faceEmpty.status === 2, `${faceEmpty.status} ${String(faceEmpty.stderr).slice(0, 200)}`);
    const faceTwice = spawnSync(process.execPath, [join(REPO, ".claude/scripts/hq/arc-face.mjs"), "--spine", SPINE_A, "--spine", SPINE_B, "--no-open"], { cwd: REPO, encoding: "utf8", timeout: 20_000 });
    check("arc-face with two --spine values refuses (exit 2)", faceTwice.status === 2 && /given (twice|more than once)/.test(faceTwice.stderr), `${faceTwice.status} ${String(faceTwice.stderr).slice(0, 200)}`);
  }

  // ---- the counting fixture: two concurrent applies of one plan invoke the tool exactly once (REQ-07) ----
  {
    const fx = join(tmp, "fixture-repo");
    mkdirSync(join(fx, ".claude", "scripts", "fixture"), { recursive: true });
    const counter = join(tmp, "count.txt");
    // A tool that counts its own invocations, then writes a receipt through the REAL emitter.
    writeFileSync(join(fx, ".claude", "scripts", "fixture", "count.mjs"),
      `import { appendFileSync } from "node:fs";\nimport { spawnSync } from "node:child_process";\n` +
      `appendFileSync(${JSON.stringify(counter)}, "x");\n` +
      `if (process.argv[2] === "--plan") { console.log("would count"); process.exit(0); }\n` +
      `const r = spawnSync(process.execPath, [${JSON.stringify(EVENT)}, "emit", "note.logged", "--payload", JSON.stringify({ note: "counted" }), "--strict"], { encoding: "utf8" });\n` +
      `process.stdout.write(r.stdout); process.exit(r.status);\n`);
    const SPINE_C = join(tmp, "spine-count");
    mkdirSync(join(SPINE_C, "events"), { recursive: true });
    process.env.ARC_SPINE_ROOT = SPINE_C;
    const registry = [{ id: "fixture.count", room: "fixture", label: "count", receipt: { kind: "note.logged" }, humanRun: false, spends: false, touchesFiles: false, fields: [],
      plan: () => ({ script: "fixture/count.mjs", args: ["--plan"] }), apply: () => ({ script: "fixture/count.mjs", args: [] }) }];
    let clock = Date.now();
    const door = DOOR_MOD.createWorkDoor({ mode: "sim", root: SPINE_C, repo: fx }, { registry, now: () => clock });
    const p = await door.plan("fixture.count", { input: {} });
    check("counting fixture: the plan ran the tool once", p.ok === true && readFileSync(counter, "utf8") === "x", JSON.stringify(p).slice(0, 200));
    const v1 = door.apply("fixture.count", { planId: p.planId });
    const v2 = door.apply("fixture.count", { planId: p.planId });
    await door.settled();
    check("counting fixture: two concurrent applies invoked the tool EXACTLY ONCE", readFileSync(counter, "utf8") === "xx", `count=${readFileSync(counter, "utf8").length}`);
    check("counting fixture: the second apply was a replay, not a run", v1.replayed !== true && v2.replayed === true);
    const settled = door.run(p.planId);
    check("counting fixture: the run found the receipt on the spine", settled.state === "done" && settled.result.ok === true && settled.result.receipt.kind === "note.logged", JSON.stringify(settled.result).slice(0, 300));
    // An expired plan is refused, and runs nothing.
    const p2 = await door.plan("fixture.count", { input: {} });
    clock += 16 * 60_000;
    let expired = null;
    try { door.apply("fixture.count", { planId: p2.planId }); } catch (e) { expired = e.code; }
    check("an expired plan -> PLAN_EXPIRED, and the tool was not run", expired === "PLAN_EXPIRED" && readFileSync(counter, "utf8") === "xxx", `code=${expired} count=${readFileSync(counter, "utf8").length}`);
    delete process.env.ARC_SPINE_ROOT;
  }

  // ---- a character split across two writes, and a descendant the tool leaves behind (round-2 shell attack) ----
  {
    const fx = join(tmp, "fixture-split");
    mkdirSync(join(fx, ".claude", "scripts", "fixture"), { recursive: true });
    const gpidFile = join(tmp, "grandchild.pid");
    // The euro sign is three bytes; the tool writes the first two, waits, then the third -- two chunks for the door.
    // On apply it also starts a grandchild in its own process group that would run forever, and exits without it.
    writeFileSync(join(fx, ".claude", "scripts", "fixture", "split.mjs"),
      `import { spawn, spawnSync } from "node:child_process";\nimport { writeFileSync } from "node:fs";\n` +
      `const w = (b) => new Promise((r) => process.stdout.write(Buffer.from(b), r));\n` +
      `await w([0x70, 0x72, 0x69, 0x63, 0x65, 0x20, 0xe2, 0x82]);\n` +
      `await new Promise((r) => setTimeout(r, 200));\n` +
      `await w([0xac, 0x0a]);\n` +
      `if (process.argv[2] === "--plan") process.exit(0);\n` +
      `const g = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });\n` +
      `g.unref();\nwriteFileSync(${JSON.stringify(gpidFile)}, String(g.pid));\n` +
      `const r = spawnSync(process.execPath, [${JSON.stringify(EVENT)}, "emit", "note.logged", "--payload", JSON.stringify({ note: "split" }), "--strict"], { encoding: "utf8" });\n` +
      `process.stdout.write(r.stdout); process.exit(r.status);\n`);
    const SPINE_S = join(tmp, "spine-split");
    mkdirSync(join(SPINE_S, "events"), { recursive: true });
    process.env.ARC_SPINE_ROOT = SPINE_S;
    const registry = [{ id: "fixture.split", room: "fixture", label: "split", receipt: { kind: "note.logged" }, humanRun: false, spends: false, touchesFiles: false, fields: [],
      plan: () => ({ script: "fixture/split.mjs", args: ["--plan"] }), apply: () => ({ script: "fixture/split.mjs", args: [] }) }];
    const door = DOOR_MOD.createWorkDoor({ mode: "sim", root: SPINE_S, repo: fx }, { registry });
    const p = await door.plan("fixture.split", { input: {} });
    check("a character split across two chunks arrives whole in the plan output", p.ok === true && String(p.output).includes("price €") && !String(p.output).includes("�"), JSON.stringify(p.output));
    door.apply("fixture.split", { planId: p.planId });
    await door.settled();
    const run = door.run(p.planId);
    const text = run.lines.map((l) => l.t).join("\n");
    check("a character split across two chunks arrives whole in the streamed run lines", text.includes("price €") && !text.includes("�"), JSON.stringify(text).slice(0, 200));
    check("the split fixture ran to its receipt (vacuous-pass guard for the descendant check)", run.state === "done" && run.result.ok === true && existsSync(gpidFile), JSON.stringify(run.result).slice(0, 200));
    const gpid = existsSync(gpidFile) ? Number(readFileSync(gpidFile, "utf8")) : 0;
    const alive = () => { try { process.kill(gpid, 0); return true; } catch { return false; } };
    if (process.platform === "win32") {
      // Windows has no group to signal once the tool is gone: a debt-ledger row (a Job Object is out of Node reach).
      console.log("note: the descendant check is POSIX-only (Windows remainder is a debt row); the grandchild is ended by the suite");
      if (gpid && alive()) try { process.kill(gpid); } catch { /* gone */ }
    } else {
      let gone = false;
      for (let i = 0; i < 20 && !gone; i++) { gone = !alive(); if (!gone) await new Promise((r) => setTimeout(r, 100)); }
      check("a descendant the tool left in its group is ended when the run settles (POSIX)", gpid > 0 && gone, `pid=${gpid}`);
      if (!gone) try { process.kill(gpid, "SIGKILL"); } catch { /* gone */ }
    }
    delete process.env.ARC_SPINE_ROOT;

    // PR 2 logic attack: drops are counted per stream -- a caller serving stdout must not refuse it for stderr's overflow.
    {
      writeFileSync(join(fx, ".claude", "scripts", "fixture", "noisy.mjs"),
        `process.stderr.write("e".repeat(300 * 1024));\nprocess.stdout.write("the whole answer\\n");\n`);
      const res = await DOOR_MOD.runTool({ repo: fx }, { script: "fixture/noisy.mjs", args: [] }, { timeoutMs: 30_000 });
      check("runTool counts drops per stream: stderr overflowed, stdout did not", res.exit === 0 && res.droppedOut === 0 && res.droppedErr > 0 && res.stdout === "the whole answer\n",
        `exit=${res.exit} out=${res.droppedOut} err=${res.droppedErr} stdout=${JSON.stringify(res.stdout)}`);
    }

    // A descendant that LEFT the tool's group while holding its pipes must not hold the run open (PR 2 shell attack: the
    // run never settled, past its own timeout). The tool exits at once; the run ends within the pipe grace.
    {
      const holderPid = join(tmp, "holder.pid");
      writeFileSync(join(fx, ".claude", "scripts", "fixture", "holder.mjs"),
        `import { spawn } from "node:child_process";\nimport { writeFileSync } from "node:fs";\n` +
        `if (process.argv[2] === "--plan") process.exit(0);\n` +
        `const g = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "inherit", detached: true });\n` +
        `g.unref();\nwriteFileSync(${JSON.stringify(holderPid)}, String(g.pid));\nprocess.stdout.write("holder started\\n");\n`);
      const reg2 = [{ id: "fixture.holder", room: "fixture", label: "holder", receipt: { kind: "note.logged" }, humanRun: false, spends: false, touchesFiles: false, fields: [],
        plan: () => ({ script: "fixture/holder.mjs", args: ["--plan"] }), apply: () => ({ script: "fixture/holder.mjs", args: [] }) }];
      const door2 = DOOR_MOD.createWorkDoor({ mode: "sim", root: SPINE_S, repo: fx }, { registry: reg2 });
      const hp = await door2.plan("fixture.holder", { input: {} });
      const t0 = Date.now();
      door2.apply("fixture.holder", { planId: hp.planId });
      const ended = await Promise.race([door2.settled().then(() => true), new Promise((r) => setTimeout(() => r(false), 15_000))]);
      const ms = Date.now() - t0;
      const hr = door2.run(hp.planId);
      check("a run whose descendant holds its pipes still ends, within the grace (not at a timeout, not never)", ended && hr.state === "done" && ms < 10_000, `ended=${ended} ms=${ms} state=${hr.state}`);
      const gpid2 = existsSync(holderPid) ? Number(readFileSync(holderPid, "utf8")) : 0;
      if (gpid2) try { process.kill(gpid2, "SIGKILL"); } catch { /* gone */ }
    }

    // A door stopped by a signal ends the tool it is running (round-2 shell attack: "exit" does not fire on a signal,
    // so a Ctrl-C'd door orphaned its tool). POSIX-only: Windows has no catchable SIGTERM to send.
    if (process.platform !== "win32") {
      const toolPid = join(tmp, "sleeper.pid");
      writeFileSync(join(fx, ".claude", "scripts", "fixture", "sleep.mjs"),
        `import { writeFileSync } from "node:fs";\nif (process.argv[2] === "--plan") process.exit(0);\n` +
        `writeFileSync(${JSON.stringify(toolPid)}, String(process.pid));\nsetInterval(() => {}, 1000);\n`);
      const harness = join(tmp, "signal-harness.mjs");
      writeFileSync(harness,
        `const D = await import(${JSON.stringify(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "work-door.mjs")).href)});\n` +
        `const registry = [{ id: "fixture.sleep", room: "fixture", label: "sleep", receipt: { kind: "note.logged" }, humanRun: false, spends: false, touchesFiles: false, fields: [],\n` +
        `  plan: () => ({ script: "fixture/sleep.mjs", args: ["--plan"] }), apply: () => ({ script: "fixture/sleep.mjs", args: [] }) }];\n` +
        `const door = D.createWorkDoor({ mode: "sim", root: ${JSON.stringify(SPINE_S)}, repo: ${JSON.stringify(fx)} }, { registry });\n` +
        `const p = await door.plan("fixture.sleep", { input: {} });\ndoor.apply("fixture.sleep", { planId: p.planId });\nsetInterval(() => {}, 1000);\n`);
      const h = spawn(process.execPath, [harness], { stdio: "ignore" });
      let tpid = 0;
      for (let i = 0; i < 100 && !tpid; i++) { await new Promise((r) => setTimeout(r, 100)); if (existsSync(toolPid)) tpid = Number(readFileSync(toolPid, "utf8")) || 0; }
      check("the signal harness started its tool (vacuous-pass guard)", tpid > 0);
      const exited = new Promise((r) => h.once("exit", (code, signal) => r({ code, signal })));
      h.kill("SIGTERM");
      const ex = await exited;
      const toolAlive = () => { try { process.kill(tpid, 0); return true; } catch { return false; } };
      let gone = false;
      for (let i = 0; i < 20 && !gone; i++) { gone = !toolAlive(); if (!gone) await new Promise((r) => setTimeout(r, 100)); }
      check("SIGTERM to a door with a tool running ends the tool, then the door, with code 143", ex.code === 143 && gone, `${JSON.stringify(ex)} toolAlive=${!gone}`);
      if (!gone) try { process.kill(tpid, "SIGKILL"); } catch { /* gone */ }
    }
  }

  // ---- arc-event --dry-run (the shared unlock) ----
  {
    const SPINE_D = join(tmp, "spine-dry");
    mkdirSync(join(SPINE_D, "events"), { recursive: true });
    const env = { ...process.env, ARC_SPINE_ROOT: SPINE_D };
    const before = spineFingerprint(SPINE_D);
    const ok = spawnSync(process.execPath, [EVENT, "emit", "note.logged", "--payload", "{\"note\":\"dry\"}", "--dry-run"], { cwd: REPO, encoding: "utf8", env });
    let sealed = null; try { sealed = JSON.parse(String(ok.stdout).trim()); } catch { /* checked below */ }
    check("arc-event --dry-run: exit 0 and the sealed record on stdout", ok.status === 0 && sealed && sealed.kind === "note.logged" && /^[0-9a-f]{64}$/.test(sealed.sha || ""), `${ok.status} ${ok.stdout} ${ok.stderr}`);
    const bad = spawnSync(process.execPath, [EVENT, "emit", "ghost.kind", "--dry-run"], { cwd: REPO, encoding: "utf8", env });
    check("arc-event --dry-run: a refusal is exit 2, even without --strict", bad.status === 2 && /REJECT/.test(bad.stderr), `${bad.status} ${bad.stderr}`);
    check("arc-event --dry-run: nothing was written -- no event, no quarantine record", spineFingerprint(SPINE_D) === before);
    const eq = spawnSync(process.execPath, [EVENT, "emit", "note.logged", "--dry-run=0"], { cwd: REPO, encoding: "utf8", env });
    check("arc-event: --dry-run=0 is refused, never read as off", eq.status === 2 && /takes no value/.test(eq.stderr), `${eq.status} ${eq.stderr}`);
    const cd = spawnSync(process.execPath, [EVENT, "close-day", "--dry-run"], { cwd: REPO, encoding: "utf8", env });
    check("arc-event: close-day --dry-run is refused", cd.status === 2 && /emit and ingest only/.test(cd.stderr), `${cd.status} ${cd.stderr}`);
    check("arc-event: the refused dry runs wrote nothing either", spineFingerprint(SPINE_D) === before);
    // The same event WITHOUT the flag still appends: the flag is the only difference (a positive control).
    const real = spawnSync(process.execPath, [EVENT, "emit", "note.logged", "--payload", "{\"note\":\"dry\"}", "--strict"], { cwd: REPO, encoding: "utf8", env });
    check("arc-event: the same emit without --dry-run appends (positive control)", real.status === 0 && spineFingerprint(SPINE_D) !== before, `${real.status} ${real.stderr}`);
  }

  // ---- the owning lanes' additive flags refuse their misuse ----
  {
    const env = { ...process.env, ARC_SPINE_ROOT: SPINE_B };
    const pnl = (args) => spawnSync(process.execPath, [join(REPO, ".claude/scripts/hq/arc-pnl.mjs"), ...args], { cwd: REPO, encoding: "utf8", env });
    const ep = pnl(["--emit-plan"]);
    check("arc-pnl: --emit-plan without --close is refused", ep.status !== 0 && /BAD_ARGS/.test(ep.stderr + ep.stdout), `${ep.status} ${ep.stderr}`);
    const both = pnl(["--criteria-request", "x", "--criteria-digest"]);
    check("arc-pnl: --criteria-request with --criteria-digest is refused", both.status !== 0 && /BAD_ARGS/.test(both.stderr + both.stdout), `${both.status} ${both.stderr}`);
    const plain = pnl(["--close", MONTH, "--reconcile-total", "razorpay:INR=100000"]);
    const lastPlain = String(plain.stdout).trim().split(/\r?\n/).pop() || "";
    let parsed = null; try { parsed = JSON.parse(lastPlain); } catch { /* checked */ }
    check("arc-pnl: without --emit-plan the close's last line is still the bare payload (the RUNBOOK's tail -1)", plain.status === 0 && parsed && parsed.month === MONTH && !("emit" in parsed), `${plain.status} ${lastPlain.slice(0, 200)}`);
    const dev = spawnSync(process.execPath, [join(REPO, ".claude/scripts/develop/develop.mjs"), "status", "--lane", "face", "--receipt"], { cwd: REPO, encoding: "utf8", env });
    check("develop.mjs: --receipt outside checkpoint is refused", dev.status === 2 && /--receipt belongs to checkpoint/.test(dev.stdout), `${dev.status} ${dev.stdout}`);
    const bom = join(tmp, "bom.mdx");
    writeFileSync(bom, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("x")]));
    const seal = spawnSync(process.execPath, [join(REPO, ".claude/scripts/growth/arc-growth.mjs"), "seal", "work-door-probe", "--article", bom, "--cluster-id", "c-001", "--title", "t", "--pr", "7"], { cwd: REPO, encoding: "utf8", env });
    check("arc-growth seal: a BOM-prefixed article is refused, never stripped", seal.status !== 0 && /BOM_IN_ARTICLE/.test(seal.stderr), `${seal.status} ${seal.stderr}`);
    // The seal's path is checked before it is opened (shell attack): a directory, and a network/device-namespace path.
    const sealAt = (article) => spawnSync(process.execPath, [join(REPO, ".claude/scripts/growth/arc-growth.mjs"), "seal", "work-door-probe", "--article", article, "--cluster-id", "c-001", "--title", "t", "--pr", "7"], { cwd: REPO, encoding: "utf8", env, timeout: 20_000 });
    const dir = sealAt(tmp);
    check("arc-growth seal: a directory is not an article -> BAD_ARTICLE", dir.status !== 0 && /BAD_ARTICLE/.test(dir.stderr), `${dir.status} ${dir.stderr}`);
    const unc = sealAt("//./pipe/work-door-probe.mdx");
    check("arc-growth seal: a network or device path is refused before it is opened -> BAD_ARTICLE", unc.status !== 0 && /BAD_ARTICLE/.test(unc.stderr), `${unc.status} ${unc.stderr}`);
    // A FIFO blocks a plain open for read until a writer arrives; the seal must refuse it, not hang (POSIX has them).
    if (process.platform !== "win32") {
      const fifo = join(tmp, "article.fifo");
      const mk = spawnSync("mkfifo", [fifo]);
      check("mkfifo made the probe FIFO (vacuous-pass guard)", mk.status === 0, String(mk.stderr));
      const f = sealAt(fifo);
      check("arc-growth seal: a FIFO is refused, not waited on -> BAD_ARTICLE", f.status !== 0 && f.signal === null && /BAD_ARTICLE/.test(f.stderr), `${f.status} ${f.signal} ${f.stderr}`);
    }
  }

  // ---- the child's environment: the drop list holds whatever the case (shell attack: Windows reads env names
  // case-insensitively, so a lowercase git_dir or node_options reached the child) ----
  {
    const R = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "reads.mjs")).href);
    const planted = { git_dir: "x", Git_Work_Tree: "x", node_options: "--require nothing", arc_settings: "x", Bash_Env: "x", node_path: "x", Node_Repl_External_Module: "x" };
    for (const [k, v] of Object.entries(planted)) process.env[k] = v;
    const env = R.childEnv();
    const leaked = Object.keys(env).filter((k) => Object.hasOwn(planted, k));
    for (const k of Object.keys(planted)) delete process.env[k];
    check("childEnv drops git's variables, preloads and the source overrides in ANY case", leaked.length === 0 && Object.keys(env).length > 0, leaked.join(","));
  }

  // ---- nothing touched the repository ----
  check("no op touched the repository's files (git status unchanged)", gitStatus() === statusBefore, gitStatus().slice(0, 300));
  check("no op moved HEAD off its branch", gitHead() === headBefore);
  // A schedule never reaches the door: no job in hq.jobs.yaml names the door or an op route.
  const jobs = existsSync(join(REPO, "hq.jobs.yaml")) ? readFileSync(join(REPO, "hq.jobs.yaml"), "utf8") : "";
  check("no scheduled job names the door or an op route", jobs.length > 0 && !/arc-dash|\/api\/op/.test(jobs));
} finally {
  dash.kill();
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran > 60 ? 0 : 1);
