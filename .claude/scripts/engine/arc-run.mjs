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
import { authorizeRun } from "../hq/lib/policy/run-gate.mjs";

// `mock` is the replay driver (ADR-0902, bench lane): it reaches no provider and costs nothing,
// so bench's own suite runs offline and free. It is a real driver rather than an env fake
// precisely so it can be SELECTED here and NAMED on a receipt.
// `hermes` is the agent-runtime shim (ADR-0208/0219, engine Cycle 7). It is one more driver and
// not a special guest: same argv contract, same three-code exit map, same cost sidecar.
const DRIVERS = ["claude-code", "codex", "generic-api", "hermes", "mock"];

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

// THE TIER MUST REACH THE DRIVER OR IT IS A LABEL. Without this the routed tier changed
// nothing: `high-judgment` and `balanced-workhorse` produced byte-identical invocations, the
// receipt asserted `model: tier:X` that nothing had applied, and the real model knob was a
// run-time env var -- an un-reviewed tier change of exactly the kind ADR-0069 b1 forbids.
// A driver with no router entry runs UNPINNED and the receipt says so, rather than quietly
// inheriting whatever the environment holds.
let pinnedModel = null;
if (tier) {
  const router = loadRouter();
  pinnedModel = router?.models?.[tier]?.[driver] ?? null;
}

// ---------- budget ----------
const BUDGET_KEYS = ["inr", "min"];
function parseBudget(s) {
  const out = {};
  for (const part of String(s || "").split(",")) {
    if (!part.trim()) continue;
    const m = part.match(/^([a-z]+)=(\d+(?:\.\d+)?)$/);
    if (!m) { console.error(`arc-run: unparseable budget segment \`${part}\` (want inr=N or min=M)`); process.exit(2); }
    // An unknown key was silently accepted, so `--budget foo=99` ran unbounded with no
    // warning; and a repeated key was silent last-wins, which `.claude/rules/lanes.md`
    // calls an operator error rather than an override -- applied here to money.
    if (!BUDGET_KEYS.includes(m[1])) { console.error(`arc-run: unknown budget key \`${m[1]}\` (known: ${BUDGET_KEYS.join(", ")})`); process.exit(2); }
    if (m[1] in out) { console.error(`arc-run: budget key \`${m[1]}\` given twice — that is an operator error, not a last-wins override`); process.exit(2); }
    const v = Number(m[2]);
    if (!Number.isFinite(v) || v > 1e9) { console.error(`arc-run: budget ${m[1]}=${m[2]} is out of range`); process.exit(2); }
    out[m[1]] = v;
  }
  return out;
}
const budget = parseBudget(budgetStr);
// THE BUDGET IS A PROPERTY OF THE RUN, NOT OF AN ATTEMPT. Previously every fallback hop and
// the retry each received a fresh FULL budget, so a `min=6s` run could legitimately take 4x
// that (3 chain hops + 1 retry) while every individual attempt stayed "inside" its bound.
const runStartedAt = Date.now();
let inrSpent = 0;
let attemptsMade = 0;
const msRemaining = () => ("min" in budget ? Math.max(0, budget.min * 60_000 - (Date.now() - runStartedAt)) : undefined);
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
function scrub(label, text, parsed) {
  if (!text) return;
  let verdict;
  try {
    // Pass the REAL parsed object. Handing scanSecrets a synthetic `{ text }` wrapper meant
    // its structural layer only ever saw one key called "text" -- and that layer exists
    // precisely because no textual rule ever matched `{"password":"..."}`. A short or
    // space-bearing credential value evaded the only layer that was running.
    verdict = scanSecrets(String(text), parsed !== undefined ? parsed : { text: String(text) });
  }
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
  // The receipt records the model that was ACTUALLY used, never the tier label. A label
  // here asserted a routing decision nothing had applied -- a false claim in an append-only
  // ledger, which is worse than an absent one (ADR-0069 b5 / Constitution E3).
  if (pinnedModel) args.push("--model", pinnedModel);
  else if (tier) args.push("--model", "unpinned");
  let id = "";
  try {
    id = execFileSync("bash", [join(root, ".claude/scripts/hq/arc-event.sh"), ...args], { encoding: "utf8", cwd: root, timeout: 10000, killSignal: "SIGKILL" }).trim();
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
  // The emitter resolves ARC_SPINE_ROOT first (spine-io.mjs); hardcoding the repo path made
  // every isolated run print a false "NOT in events/" alarm while the receipt sat sealed and
  // correct elsewhere. A verifier that cries wolf on every green run is a verifier people mute.
  const spineRoot = process.env.ARC_SPINE_ROOT || join(root, ".claude/state/hq");
  const events = join(spineRoot, "events", `${day}.jsonl`);
  const quarantine = join(spineRoot, "events/_quarantine");
  const inEvents = existsSync(events) && readFileSync(events, "utf8").includes(id);
  if (inEvents) return;
  let q = "";
  try { q = existsSync(quarantine) ? execFileSync("bash", ["-c", `grep -rl ${id} ${JSON.stringify(quarantine)} 2>/dev/null | head -1`], { encoding: "utf8" }).trim() : ""; }
  catch { /* grep found nothing */ }
  console.error(`arc-run: WARN receipt ${id} is NOT in events/${day}.jsonl${q ? ` — it is QUARANTINED at ${q}` : " and not in _quarantine/ either"}`);
}

// ---------- the run ----------
/**
 * THE POLICY GATE (REQ-02, ADR-0500..0507). It sits at the top of `invoke` because that is the
 * single place a driver is ever started -- one call site, so there is no second path to find.
 *
 * FAIL-CLOSED: a policy check that THROWS blocks the run (ADR-0028's fail-safe precedent). The
 * catch below denies rather than proceeding, because "the check broke, so we ran it anyway" is
 * the whole failure class this build exists to remove.
 *
 * No policy logic lives here -- every decision is the shared library's (POL-D).
 */
let policyNotInForceAnnounced = false;
function policyGate(name) {
  try {
    const gate = authorizeRun({ processName, doc, root });
    if (!gate.inForce) {
      // LOUD, once per run. A disarmed guard must never be silent -- the same contract
      // PreToolUse.sh keeps when its dispatcher is missing.
      if (!policyNotInForceAnnounced) {
        policyNotInForceAnnounced = true;
        console.error(`arc-run: NOTICE ${gate.reason} — this run is unpoliced`);
      }
      return null;
    }
    if (gate.mayInvoke) return null;
    return { gate, reason: gate.denials.map((d) => d.reason).join("; ") };
  } catch (e) {
    return { gate: null, reason: `the policy check threw (${String(e.message).split("\n")[0]}) -- fail-closed` };
  }
}

function invoke(name) {
  const sh = join(root, ".claude/scripts/engine/drivers", `${name}.sh`);
  if (!existsSync(sh)) return { code: 1, stdout: "", stderr: `driver ${name} not installed at ${sh}`, cost: null };

  const blocked = policyGate(name);
  if (blocked) {
    // NO SIDE EFFECT: the driver process never starts, and the denial is a receipt.
    //
    // IT IS NOT YET A DEMOTION, and the comment that used to sit here said otherwise -- that the
    // cap "is recomputed on the NEXT authorization inside this same run, so a demotion lands
    // mid-run". The reducer would indeed fold one; nothing emits one. `buildDemotion` exists in
    // the policy library and has no caller.
    //
    // Wiring it HERE would also be theatre: this gate only ever denies at L0 (authorizeRun pushes
    // a denial exactly when effective === "L0"), and `buildDemotion` correctly returns null when
    // there is nothing left to take. A call that can never fire looks like the criterion is met.
    // The level a denial can actually cost is one taken at the ACTION boundary, where a pair
    // still holding L2/L3 is refused for a resource or invariant reason -- and putting spine
    // writes in the blocking PreToolUse path is a decision with real latency and failure-mode
    // consequences, not an implementation detail. Tracked as the open half of phase 02.
    const detail = `policy denied ${processName}: ${blocked.reason}`;
    console.error(`arc-run: ${detail}`);
    try {
      execFileSync("bash", [join(root, ".claude/scripts/hq/arc-event.sh"), "emit", "incident.raised",
        "--payload", JSON.stringify({ what: detail, severity: "high", source: "arc-run policy gate" }),
        "--process", `${doc.name}@${doc.version}`, "--outcome", "fail"],
        { encoding: "utf8", cwd: root, timeout: 10000, killSignal: "SIGKILL" });
    } catch (e) {
      // A receipt we could not write is reported, never swallowed -- but it does not un-deny
      // the action. Quarantine is not enforcement success (ADR-0106/0032).
      console.error(`arc-run: WARN could not emit incident.raised: ${String(e.message).split("\n")[0]}`);
    }
    return { code: 77, stdout: "", stderr: detail, cost: null, policyDenied: true };
  }
  const tmp = mkdtempSync(join(tmpdir(), "arc-run-"));
  const costFile = join(tmp, "cost.json");
  const rem = msRemaining();
  // Math.floor: a float `min` produced a non-integer timeout and spawnSync threw a raw
  // RangeError before any scrub or receipt could run.
  const timeoutMs = rem === undefined ? undefined : Math.max(1, Math.floor(rem));
  const res = spawnSync("bash", [sh, "run", processName, JSON.stringify(input), budgetStr], {
    encoding: "utf8", cwd: root, timeout: timeoutMs,
    // arc-run defaulted to Node's 1 MiB while claude-code.mjs deliberately sets 64 MiB for
    // the CLI it wraps -- so a large but perfectly valid answer was truncated and then
    // blamed on the driver.
    maxBuffer: 64 * 1024 * 1024,
    killSignal: "SIGKILL",
    env: {
      ...process.env,
      ARC_DRIVER_COST_FILE: costFile,
      ARC_ROOT: root,
      ARC_DRIVER_MODEL: pinnedModel ?? "",
      // The RUN's deadline, as an ABSOLUTE epoch millisecond, so a driver that must impose its
      // own timeout on a subprocess cannot accidentally start a fresh budget. `budgetStr` is
      // the ORIGINAL allowance and is passed unchanged for reporting; a driver reading `min`
      // from it and using it as a timeout would hand every driver in the fallback chain a full
      // budget again -- the defect this file already records at the timeout arm below. An
      // absolute instant has the time already burned subtracted, and cannot be un-subtracted.
      //
      // Absent (no `min` bound) means NO deadline, not a zero one: an unbounded run must not be
      // declined by a driver reading an empty string as 0.
      ...(timeoutMs === undefined ? {} : { ARC_DRIVER_DEADLINE_EPOCH_MS: String(Date.now() + timeoutMs) }),
    },
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
  attemptsMade += 1;
  const r = invoke(name);
  if (r.cost && Number.isFinite(r.cost.inr)) inrSpent += r.cost.inr;
  scrub(`the ${name} driver's stdout`, r.stdout);
  scrub(`the ${name} driver's transcript`, r.stderr);
  if (r.cost) scrub(`the ${name} driver's cost sidecar`, JSON.stringify(r.cost), r.cost);

  // A timeout is the BUDGET being spent, not the driver misbehaving. Classifying it as a
  // driver fault made budget exhaustion trigger the fallback chain -- which then spent the
  // budget again, per driver -- and made the receipt read `reason: driver`, so the promise
  // that an over-budget run "reports a budget outcome" was false.
  if (r.timedOut) return { ...r, verdict: "budget", why: `exceeded the ${budget.min}-minute budget for the RUN` };
  if (r.code === 2) return { ...r, verdict: "budget", why: r.stderr.trim() || "driver declined for budget" };
  // POLICY BEFORE DRIVER, and for exactly the reason the budget arm above exists. A denial fell
  // through to `verdict: "driver"`, so ONE denial produced three high-severity incidents as the
  // fallback chain retried, and the append-only receipt claimed the driver had failed when no
  // driver had run at all. A false claim in a ledger is worse than an absent one (ADR-0069 b5 /
  // Constitution E3), and no other driver is going to be more permitted than the first.
  if (r.policyDenied) return { ...r, verdict: "policy", why: r.stderr.trim() || "denied by policy" };
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

// H2: the SEND path. All four scanned classes were on the RETURN path, so the one direction
// that actually exfiltrates -- arc to a third-party endpoint -- had no scan at all. A secret
// in --input (or in an @file that resolves outside the repo) was transmitted to the vendor
// and the run then reported success.
if (inputArg) scrub("--input (before anything is sent to a driver)", JSON.stringify(input), input);

const selfCheck = processIsSelfConsistent();
let a = attempt(driver);

// Driver-fault fallback: try the next driver in the chain. NOT for a schema fault -- falling
// back on a broken schema just fails three times instead of once, slower.
// C3: the money bound is enforced AFTER each attempt, because no driver reports spend in
// advance. Previously `inr` was read only by the <=0 pre-check and then handed to drivers
// that discard it -- so `inr=1` and `inr=100000` were the same run.
const overBudget = () => "inr" in budget && inrSpent > budget.inr;
if (overBudget()) {
  console.error(`arc-run: spent ${inrSpent} against an inr budget of ${budget.inr} — stopping, and NOT falling back`);
  emitRun({ outcome: "fail", reason: "budget", driver, attempts: attemptsMade, cost: a.cost ?? undefined });
  process.exit(1);
}

while (a.verdict === "driver" && !overBudget() && msRemaining() !== 0 && fallbacks.length) {
  const next = fallbacks.shift();
  console.error(`arc-run: ${driver} reported a driver fault (${a.why}); falling back to ${next}`);
  driver = next;
  a = attempt(driver);
}

// A policy denial is its own outcome and its own exit. It never reaches the fallback loop above
// (that loop only runs on `verdict === "driver"`), because no other driver is going to be more
// permitted than the first -- retrying would just raise the same incident again, which is what
// it did before this arm existed.
if (a.verdict === "policy") {
  console.error(`arc-run: ${a.why}`);
  emitRun({ outcome: "fail", reason: "policy", driver, attempts: attemptsMade, cost: a.cost ?? undefined });
  process.exit(1);
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
    // Goes through the SAME path as a first-attempt success. Printing and emitting inline
    // here is how the payload scrub got skipped on one of the two success paths -- a secret
    // that only appears after JSON.parse (a \u-escaped key, invisible to a raw-text scan)
    // reached stdout with exit 0.
    succeed(retry);
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
    id = execFileSync("bash", [join(root, ".claude/scripts/hq/arc-event.sh"), "emit", "approval.requested", "--payload", JSON.stringify(proposal)], { encoding: "utf8", cwd: root, timeout: 10000, killSignal: "SIGKILL" }).trim();
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

succeed(a);

/** The ONE way a run succeeds. Scrub, then print, then emit -- in that order, once. */
function succeed(r) {
  const payload = JSON.stringify(r.output);
  scrub("the spine payload", payload, r.output);
  console.log(payload);
  emitRun({ outcome: "ok", driver, attempts: attemptsMade, cost: r.cost ?? undefined, fault_hint: "unknown", model: pinnedModel ?? "unpinned" });
  process.exit(0);
}
