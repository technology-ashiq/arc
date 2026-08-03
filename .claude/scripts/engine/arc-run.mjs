#!/usr/bin/env node
/**
 * arc-run.mjs -- run any canonical process on any driver, headless (REQ-04..07).
 *
 * HEADLESS ONLY. It never wraps an interactive session -- a PLAN non-negotiable, and the
 * reason the driver contract is a subprocess with a JSON document on stdout rather than
 * anything conversational.
 *
 * THE THREE THINGS THAT ARE EASY TO GET SUBTLY WRONG, AND HOW THEY ARE HANDLED:
 *
 * 1. ESCALATION NEVER CHANGES A TIER (ADR-0204, ADR-0069 block b1). The ladder is
 *    `retry once on the same tier` -> `emit an approval.requested PROPOSAL` -> `stop`.
 *    No component changes a model tier at run time, under any condition. The proposal is a
 *    RECEIPT, not an action: acting on it means a human editing engine/router.yaml in a
 *    reviewed diff. An unattended run that hits a contract failure therefore stops and
 *    waits, and that is the intended behaviour rather than a gap to close later with a flag.
 *
 * 2. A SCHEMA FAILURE NAMES THE LAYER IT BLAMES. Before any driver is accused, the process's
 *    own pinned eval fixture is validated against the process's own schema. Fixture fails ->
 *    the fault is the PROCESS and no driver is blamed. Fixture passes and the live run does
 *    not -> the fault is the DRIVER. Without this, Phase 03's dogfood week produces a pile of
 *    schema failures that cannot distinguish "this driver is weak" from "we shipped a broken
 *    schema" -- which is exactly the call the "cut to 2 drivers" kill criterion has to make.
 *
 * 3. AN ABSENT COST STAYS ABSENT. Never zero, never estimated, never interpolated from a
 *    similar run (ADR-0069 block b5). A driver that dies before writing its sidecar leaves
 *    no cost, and that is recorded as no cost.
 *
 * Usage:
 *   arc-run.mjs --process NAME [--driver NAME|auto] [--budget inr=N,min=M]
 *               [--input JSON|@FILE] [--root PATH] [--dry-run]
 * Zero dependencies, Node 18+.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parseYamlSubset } from "./yaml-subset.mjs";
import { validateData } from "./schema-subset.mjs";
import { scanSecrets } from "../hq/lib/redact.mjs";

const DRIVERS = ["claude-code", "codex", "generic-api"];

// ---------- CLI ----------
const argv = process.argv.slice(2);
let processName = "";
let driverArg = "";
let budgetStr = "";
let inputArg = "";
let root = "";
let dryRun = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--process") processName = argv[++i] ?? "";
  else if (a === "--driver") driverArg = argv[++i] ?? "";
  else if (a === "--budget") budgetStr = argv[++i] ?? "";
  else if (a === "--input") inputArg = argv[++i] ?? "";
  else if (a === "--root") root = argv[++i] ?? "";
  else if (a === "--dry-run") dryRun = true;
  else { console.error(`arc-run: unknown option ${a}`); process.exit(2); }
}
if (!processName) { console.error("usage: arc-run.mjs --process NAME [--driver NAME|auto] [--budget inr=N,min=M] [--input JSON|@FILE]"); process.exit(2); }

function gitToplevel() {
  try { return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ""; }
}
root = resolve(root || process.env.ARC_ROOT || gitToplevel() || ".");

const fail = (reason, msg, extra = {}) => {
  console.error(`arc-run: ${msg}`);
  emitRun({ outcome: "fail", reason, ...extra });
  process.exit(1);
};

// ---------- the canonical process ----------
const canonPath = join(root, "processes", `${processName}.process.yaml`);
if (!existsSync(canonPath)) { console.error(`arc-run: no such process \`${processName}\` (looked in processes/)`); process.exit(1); }
const parsed = parseYamlSubset(readFileSync(canonPath, "utf8"));
if (!parsed.ok) { console.error(`arc-run: ${processName} does not parse: ${parsed.error.what}`); process.exit(1); }
const doc = parsed.value;

// ---------- routing ----------
function loadRouter() {
  const p = join(root, "engine", "router.yaml");
  if (!existsSync(p)) return null;
  const r = parseYamlSubset(readFileSync(p, "utf8"));
  if (!r.ok) { console.error(`arc-run: engine/router.yaml does not parse: ${r.error.what}`); process.exit(1); }
  return r.value;
}

let driver = driverArg || "claude-code";
let tier = null;
let fallbacks = [];
if (driverArg === "auto") {
  const router = loadRouter();
  if (!router) { console.error("arc-run: --driver auto needs engine/router.yaml, which does not exist"); process.exit(1); }
  const row = router.classes?.[processName];
  if (!row) {
    // Loud, and it names the file to edit. The fix is always "edit this file", never
    // "guess harder" -- a router that silently defaults is a router that routes by accident.
    console.error(`arc-run: no route for task class \`${processName}\`.`);
    console.error(`         Add a \`classes.${processName}\` row to engine/router.yaml (known: ${Object.keys(router.classes ?? {}).join(", ") || "none"}).`);
    process.exit(1);
  }
  driver = row.driver;
  tier = row.tier;
  fallbacks = Array.isArray(row.fallback) ? row.fallback : [];
}
if (!DRIVERS.includes(driver)) { console.error(`arc-run: unknown driver \`${driver}\` (known: ${DRIVERS.join(", ")})`); process.exit(1); }

// ---------- budget ----------
function parseBudget(s) {
  const out = {};
  for (const part of String(s || "").split(",")) {
    if (!part.trim()) continue;
    const m = part.match(/^([a-z]+)=(\d+(?:\.\d+)?)$/);
    if (!m) { console.error(`arc-run: unparseable budget segment \`${part}\` (want inr=N or min=M)`); process.exit(2); }
    out[m[1]] = Number(m[2]);
  }
  return out;
}
const budget = parseBudget(budgetStr);
// A zero (or negative) bound is a HARD stop before any spend, not a no-op. REQ-05 is that a
// run which would exceed its budget is stopped and says so -- never silently continues.
for (const k of ["inr", "min"]) {
  if (k in budget && budget[k] <= 0) {
    fail("budget", `budget ${k}=${budget[k]} leaves nothing to spend — stopped before invoking any driver`, { driver });
  }
}

// ---------- input ----------
let input = {};
if (inputArg) {
  const raw = inputArg.startsWith("@") ? readFileSync(resolve(root, inputArg.slice(1)), "utf8") : inputArg;
  try { input = JSON.parse(raw); }
  catch (e) { console.error(`arc-run: --input is not JSON: ${e.message}`); process.exit(2); }
}

// ---------- fault attribution (ADR-0204) ----------
/**
 * Validate the process's OWN eval fixture against its OWN schema. This runs before any
 * driver is blamed, so "the schema is broken" and "the driver is weak" are distinguishable
 * rather than both landing as `fail/schema`.
 */
function processIsSelfConsistent() {
  const evals = Array.isArray(doc.evals) ? doc.evals : [];
  for (const rel of evals) {
    const p = resolve(root, rel);
    if (!existsSync(p)) return { ok: false, why: `eval fixture ${rel} is absent` };
    let fx;
    try { fx = JSON.parse(readFileSync(p, "utf8")); }
    catch (e) { return { ok: false, why: `eval fixture ${rel} is not JSON: ${e.message}` }; }
    if (!("expected" in fx)) return { ok: false, why: `eval fixture ${rel} has no \`expected\`` };
    const errs = validateData(doc.output, fx.expected);
    if (errs.length) return { ok: false, why: `eval fixture ${rel} does not satisfy this process's own schema: ${errs[0].path} ${errs[0].what}` };
  }
  return { ok: true };
}

// ---------- secret scrub (REQ-07) ----------
/**
 * Four artifact classes, not one: driver stdout, the driver transcript (stderr), the cost
 * sidecar, and the spine payload. Uses the SPINE'S OWN scanner, imported -- a second copy of
 * the deny-rules would be a copy that drifts from the rules the spine actually enforces.
 */
function scrub(label, text) {
  if (!text) return;
  let verdict;
  try { verdict = scanSecrets(String(text), { text: String(text) }); }
  catch (e) { fail("secret-scan", `secret scan could not run over ${label}: ${e.message}`, { driver }); return; }
  if (verdict.hit) {
    fail("secret", `a secret matching rule \`${verdict.rule}\` appeared in ${label} — the artifact was NOT written and the run is stopped`, { driver, rule: verdict.rule });
  }
}

// ---------- spine ----------
/**
 * The spine's `cost` block is ALL-OR-NOTHING: null, or all four of tokens_in, tokens_out,
 * inr_estimate and source, with inr_estimate a real number (validate.mjs assertCost).
 *
 * That collides head-on with ADR-0069 block (b)(5): no driver returns a rupee figure, and
 * deriving one from a price table nobody maintains would be an estimate wearing a
 * measurement's clothes. Of the three ways out -- fabricate a number, write 0 (which claims
 * the run was free), or decline the block -- only the third is honest.
 *
 * So: a real money figure gets the full cost block. Otherwise `cost` is null and the token
 * counts ride in the PAYLOAD, where they are plainly token counts and are not pretending to
 * be a cost record. Nothing is invented, and nothing measured is thrown away.
 *
 * This is a genuine gap in the spine's schema rather than a shortcoming here, and it is
 * recorded as one: metric 1 of ADR-0069 block (c) ("cost per accepted output") stays
 * uncomputable until the spine can express tokens-without-money.
 */
function costArgs(cost) {
  if (!cost) return { flag: null, tokens: null };
  const tokens = {};
  if (Number.isFinite(cost.tokens_in)) tokens.in = cost.tokens_in;
  if (Number.isFinite(cost.tokens_out)) tokens.out = cost.tokens_out;
  if (cost.source) tokens.source = cost.source;
  const inr = Number.isFinite(cost.inr) ? cost.inr : undefined;
  if (inr === undefined) return { flag: null, tokens: Object.keys(tokens).length ? tokens : null };
  return {
    flag: JSON.stringify({
      tokens_in: Number.isFinite(cost.tokens_in) ? cost.tokens_in : 0,
      tokens_out: Number.isFinite(cost.tokens_out) ? cost.tokens_out : 0,
      inr_estimate: inr,
      source: cost.source || "measured",
    }),
    tokens: null,
  };
}

function emitRun(payload) {
  const { cost, ...rest } = payload;
  const { flag, tokens } = costArgs(cost);
  const args = ["emit", "run.completed",
    "--payload", JSON.stringify({ process: processName, ...rest, ...(tokens ? { tokens } : {}) }),
    "--process", `${doc.name}@${doc.version}`,
    "--outcome", payload.outcome === "ok" ? "ok" : "fail"];
  if (flag) args.push("--cost", flag);
  if (tier) args.push("--model", `tier:${tier}`);
  let id = "";
  try {
    id = execFileSync("bash", [join(root, ".claude/scripts/hq/arc-event.sh"), ...args], { encoding: "utf8", cwd: root }).trim();
  } catch (e) {
    console.error(`arc-run: WARN could not emit run.completed: ${String(e.message).split("\n")[0]}`);
    return;
  }
  // Exit 0 from a fire-and-forget writer is not evidence that anything was written
  // (retro-log 2026-08-02: an emitter reported success while every receipt was quarantined).
  // LOOK in both places and say where it actually landed.
  verifyLanded(id);
}

function verifyLanded(id) {
  if (!id) {
    // An empty id means the emitter did NOT seal an event -- in hook mode it exits 0 and
    // quarantines, printing only to stderr. Returning quietly here is how "the receipt was
    // written" becomes an assumption; retro-log 2026-08-02 is exactly this failure.
    console.error("arc-run: WARN the emitter returned no event id — the receipt was NOT sealed (check events/_quarantine/)");
    return;
  }
  const day = new Date().toISOString().slice(0, 10);
  const events = join(root, ".claude/state/hq/events", `${day}.jsonl`);
  const quarantine = join(root, ".claude/state/hq/events/_quarantine");
  const inEvents = existsSync(events) && readFileSync(events, "utf8").includes(id);
  if (inEvents) return;
  let q = "";
  try { q = existsSync(quarantine) ? execFileSync("bash", ["-c", `grep -rl ${id} ${JSON.stringify(quarantine)} 2>/dev/null | head -1`], { encoding: "utf8" }).trim() : ""; }
  catch { /* grep found nothing */ }
  console.error(`arc-run: WARN receipt ${id} is NOT in events/${day}.jsonl${q ? ` — it is QUARANTINED at ${q}` : " and not in _quarantine/ either"}`);
}

// ---------- the run ----------
function invoke(name) {
  const sh = join(root, ".claude/scripts/engine/drivers", `${name}.sh`);
  if (!existsSync(sh)) return { code: 1, stdout: "", stderr: `driver ${name} not installed at ${sh}`, cost: null };
  const tmp = mkdtempSync(join(tmpdir(), "arc-run-"));
  const costFile = join(tmp, "cost.json");
  const timeoutMs = "min" in budget ? budget.min * 60_000 : undefined;
  const res = spawnSync("bash", [sh, "run", processName, JSON.stringify(input), budgetStr], {
    encoding: "utf8", cwd: root, timeout: timeoutMs,
    env: { ...process.env, ARC_DRIVER_COST_FILE: costFile, ARC_ROOT: root },
  });
  let cost = null;
  if (existsSync(costFile)) {
    try { cost = JSON.parse(readFileSync(costFile, "utf8")); } catch { cost = null; }
  }
  rmSync(tmp, { recursive: true, force: true });
  const timedOut = res.error && res.error.code === "ETIMEDOUT";
  return { code: timedOut ? 124 : (res.status ?? 1), stdout: res.stdout ?? "", stderr: res.stderr ?? "", cost, timedOut };
}

function attempt(name) {
  const r = invoke(name);
  scrub(`the ${name} driver's stdout`, r.stdout);
  scrub(`the ${name} driver's transcript`, r.stderr);
  if (r.cost) scrub(`the ${name} driver's cost sidecar`, JSON.stringify(r.cost));

  if (r.timedOut) return { ...r, verdict: "driver", why: `exceeded the ${budget.min}-minute budget` };
  if (r.code === 2) return { ...r, verdict: "budget", why: r.stderr.trim() || "driver declined for budget" };
  if (r.code !== 0) return { ...r, verdict: "driver", why: r.stderr.trim() || `driver exited ${r.code}` };

  let output;
  try { output = JSON.parse(r.stdout); }
  catch (e) { return { ...r, verdict: "schema", why: `driver stdout is not JSON: ${e.message}` }; }

  const errs = validateData(doc.output, output);
  if (errs.length) return { ...r, verdict: "schema", why: `${errs[0].path}: ${errs[0].what}`, output };
  return { ...r, verdict: "ok", output };
}

if (dryRun) {
  console.log(`arc-run: would run \`${processName}\` on \`${driver}\`${tier ? ` (tier ${tier})` : ""}${fallbacks.length ? ` fallback ${fallbacks.join(" -> ")}` : ""}`);
  process.exit(0);
}

const selfCheck = processIsSelfConsistent();
let a = attempt(driver);

// Driver-fault fallback: try the next driver in the chain. NOT for a schema fault -- falling
// back on a broken schema just fails three times instead of once, slower.
while (a.verdict === "driver" && fallbacks.length) {
  const next = fallbacks.shift();
  console.error(`arc-run: ${driver} reported a driver fault (${a.why}); falling back to ${next}`);
  driver = next;
  a = attempt(driver);
}

if (a.verdict === "budget") {
  console.error(`arc-run: ${a.why}`);
  emitRun({ outcome: "fail", reason: "budget", driver, cost: a.cost ?? undefined });
  process.exit(1);
}

if (a.verdict === "schema") {
  // ADR-0204's ladder, rung 1: retry ONCE on the same tier.
  console.error(`arc-run: output failed the contract (${a.why}); retrying once on the same tier`);
  const retry = attempt(driver);
  if (retry.verdict === "ok") {
    console.log(JSON.stringify(retry.output));
    emitRun({ outcome: "ok", driver, attempts: 2, cost: retry.cost ?? undefined, fault_hint: "unknown" });
    process.exit(0);
  }
  // Rung 2: a PROPOSAL receipt, and then stop. No tier is changed here or anywhere.
  const faultHint = selfCheck.ok ? "driver" : "process";
  const proposal = {
    what: `escalate \`${processName}\` to a stronger tier`,
    gate: "engine-escalation",
    process: processName,
    driver,
    tier: tier ?? "(unrouted)",
    fault_hint: faultHint,
    why: faultHint === "process"
      ? `the process is not self-consistent: ${selfCheck.why} — no driver is being blamed`
      : `retried once on the same tier and the output still failed the contract: ${retry.why}`,
  };
  let id = "";
  try {
    id = execFileSync("bash", [join(root, ".claude/scripts/hq/arc-event.sh"), "emit", "approval.requested", "--payload", JSON.stringify(proposal)], { encoding: "utf8", cwd: root }).trim();
    verifyLanded(id);
  } catch (e) { console.error(`arc-run: WARN could not emit the escalation proposal: ${String(e.message).split("\n")[0]}`); }

  console.error(`arc-run: STOPPED. A tier-change PROPOSAL was recorded${id ? ` as ${id}` : ""}; nothing was escalated.`);
  console.error("         Acting on it means editing engine/router.yaml in a reviewed diff citing ADR-0069.");
  emitRun({ outcome: "fail", reason: "schema", driver, attempts: 2, fault_hint: faultHint, proposal: id || undefined, cost: retry.cost ?? undefined });
  process.exit(1);
}

if (a.verdict !== "ok") {
  fail("driver", a.why, { driver, fault_hint: "driver", cost: a.cost ?? undefined });
}

const payload = JSON.stringify(a.output);
scrub("the spine payload", payload);
console.log(payload);
emitRun({ outcome: "ok", driver, attempts: 1, cost: a.cost ?? undefined, fault_hint: "unknown" });
process.exit(0);
