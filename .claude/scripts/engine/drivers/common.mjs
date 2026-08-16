#!/usr/bin/env node
/**
 * drivers/common.mjs -- the shared half of every driver (ADR-0203).
 *
 * A driver is `drivers/NAME.sh run <process> <input-json> <budget>`:
 *   stdout        the output JSON document, and nothing else
 *   sidecar       the cost record, at $ARC_DRIVER_COST_FILE
 *   stderr        diagnostics, never parsed
 *   exit 0        produced an answer (even a bad one -- judging it is arc-run's job)
 *   exit 1        driver failure
 *   exit 2        declined for budget
 *
 * Each `.sh` is a thin POSIX wrapper over a `.mjs` core, the shape `arc-event.sh` already
 * uses over `arc-event.mjs` (ADR-0031). That is load-bearing, not cosmetic: the exit
 * discipline every fetch-based driver needs -- set process.exitCode, let the loop drain,
 * force-exit on an unref'd backstop, never an abrupt process.exit() while a socket may be
 * closing -- is Node-only. A shell script cannot reuse it, and re-deriving it in POSIX
 * would re-earn retro-log 2026-07-16's Windows libuv assertion the hard way.
 *
 * FAKES ARE THE SAME CODE PATH. `ARC_DRIVER_FAKE=<dir>` makes a driver read its response
 * from `<dir>/<process>.json` instead of doing real work. The contract suite then runs the
 * IDENTICAL assertions against the fake and the real implementation -- which is what the
 * PLAN's external-dependency table means by "interface + fake + real + contract test", and
 * what stops the fake drifting into a different shape from the thing it stands in for.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const EXIT = Object.freeze({ OK: 0, DRIVER_FAIL: 1, BUDGET_DECLINED: 2 });

/** Parse `inr=250,min=5` into `{ inr: 250, min: 5 }`. Absent bound = no bound. */
export function parseBudget(s) {
  const out = {};
  for (const part of String(s || "").split(",")) {
    if (!part.trim()) continue;
    const m = part.match(/^([a-z]+)=(\d+(?:\.\d+)?)$/);
    if (!m) throw new Error(`unparseable budget segment \`${part}\` (want inr=N or min=M)`);
    out[m[1]] = Number(m[2]);
  }
  return out;
}

/**
 * Write the cost sidecar. Money is INTEGER MINOR UNITS (paise) because floats do not sum
 * exactly and the spine's brief sums money. An unavailable field is OMITTED, never zeroed:
 * ADR-0069 block (b)(5) -- recorded, estimated and fabricated are three different things and
 * only the first may enter a receipt.
 */
export function writeCost({ tokensIn, tokensOut, inr, source }) {
  const path = process.env.ARC_DRIVER_COST_FILE;
  if (!path) return;
  const cost = {};
  if (Number.isFinite(tokensIn)) cost.tokens_in = tokensIn;
  if (Number.isFinite(tokensOut)) cost.tokens_out = tokensOut;
  if (Number.isFinite(inr)) cost.inr = inr;
  // `source` is mandatory whenever ANY figure is present -- a number whose provenance is
  // unstated is the thing MP-F exists to prevent.
  if (Object.keys(cost).length) cost.source = source || "measured";
  writeFileSync(path, `${JSON.stringify(cost)}\n`, "utf8");
}

/**
 * Parse a model's JSON answer, tolerating a fenced code block.
 *
 * FOUND BY THE FIRST REAL RUN, not by any of the 20 fixture tests: a live model answered
 * with ```json ... ``` and JSON.parse died on the backtick. Every fake returned bare JSON,
 * so the entire suite was green against an input shape real models do not reliably produce.
 * Detection is tolerant, the value grammar stays strict -- the same rule the ledger parsers
 * already follow (retro-log 2026-07-16).
 */
export function parseModelJson(text, what = "model output") {
  let s = String(text).trim();
  const fence = s.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch (e) {
    throw new Error(`${what} is not JSON: ${e.message}`);
  }
}

/**
 * The model this run is pinned to, supplied by arc-run from engine/router.yaml. When it is
 * absent the driver runs UNPINNED and must say so: letting an environment variable choose
 * the model is precisely the un-reviewed tier change ADR-0069 block (b)(1) forbids, and a
 * receipt claiming a tier that nothing applied is a false claim in an append-only ledger.
 */
export function pinnedModel() {
  return process.env.ARC_DRIVER_MODEL || null;
}

/** Load a recorded response for the fake path, or null when running for real. */
export function fakeResponse(processName) {
  const dir = process.env.ARC_DRIVER_FAKE;
  if (!dir) return null;
  const f = join(dir, `${processName}.json`);
  if (!existsSync(f)) {
    throw new Error(`ARC_DRIVER_FAKE is set but ${f} does not exist — a fake with no recording is not a fake, it is a silent pass`);
  }
  return JSON.parse(readFileSync(f, "utf8"));
}

/**
 * Ask the shared policy library whether this process may run at all. Returns a reason string
 * when it may not, or null.
 *
 * Loaded lazily and defensively: a driver invoked from a tree with no policy library present
 * (an older consumer repo, a partial install) must keep working, so a missing module is
 * "not in force" -- the same contract arc-run keeps, announced the same way. A module that IS
 * present and throws denies.
 */
async function driverPolicyDenial(processName) {
  if (!processName) return null;
  let gate;
  try {
    gate = await import("../../hq/lib/policy/run-gate.mjs");
  } catch {
    return null; // no policy library in this tree -- nothing has been declared, nothing to enforce
  }
  try {
    const root = gate.policyRoot();
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const canon = join(root, "processes", `${processName}.process.yaml`);
    if (!existsSync(canon)) return null; // arc-run reports the missing process better than we can
    const { parseYamlSubset } = await import("../yaml-subset.mjs");
    const parsed = parseYamlSubset(readFileSync(canon, "utf8"));
    const doc = parsed && parsed.ok ? parsed.value : null;
    const verdict = gate.authorizeRun({ processName, doc, root });
    if (!verdict.inForce) {
      process.stderr.write(`arc-driver: NOTICE ${verdict.reason} — this run is unpoliced\n`);
      return null;
    }
    return verdict.mayInvoke ? null : verdict.denials.map((d) => d.reason).join("; ");
  } catch (e) {
    // Fail-closed. A policy check that breaks blocks; "the check threw so we ran it anyway" is
    // the failure class this build exists to remove.
    return `the policy check threw (${String(e && e.message).split("\n")[0]}) -- fail-closed`;
  }
}

/**
 * The one entry point every driver core calls. Handles the argv contract, the budget
 * decline, the fake path, the cost sidecar and the exit discipline, so a new driver is
 * genuinely one `produce()` function -- which is the north-star REQ-08 times.
 */
export async function runDriver(name, produce, opts = {}) {
  const [verb, processName, inputJson, budgetStr] = process.argv.slice(2);
  const die = (code, msg) => { process.stderr.write(`${name}: ${msg}\n`); process.exitCode = code; };

  // `version` is OPT-IN, and deliberately so (ADR-0902, bench lane). BEN-B makes driver name +
  // version a mandatory provenance field, but only the drivers bench actually exercises answer
  // it: `codex` is not installed and `generic-api` is uncredentialed, so neither produces a
  // receipt, and giving them the verb would widen bench's diff on a tree it does not own for
  // nothing exercised. A driver that passes no `version` keeps the original refusal exactly.
  //
  // A driver's version is WHAT WOULD CHANGE ITS OUTPUT -- its own code for a real driver, its
  // recording set for the replay driver. It is not the provider CLI's version: that belongs to
  // the model identity (MP-F), not to the driver, and asking a CLI that may not be installed
  // would make an offline provenance field depend on a network-era dependency.
  if (verb === "version" && typeof opts.version === "function") {
    process.stdout.write(`${opts.version()}\n`);
    process.exitCode = EXIT.OK;
    return;
  }

  if (verb !== "run") {
    die(EXIT.DRIVER_FAIL, `usage: ${name}.sh run <process> <input-json> <budget>`);
    return;
  }

  // THE SECOND GATE, and the reason it exists: arc-run is not the only way to start a driver.
  // `bash drivers/claude-code.sh run <process> '{}' ''` reaches this function directly, and the
  // repo's own engine suite does exactly that. An adversarial pass pointed out that a gate with
  // one call site is only sole-entry if nothing else can call the thing it guards -- so the
  // check lives HERE too, at the one function every driver core funnels through, and arc-run's
  // gate becomes the early, better-reported copy rather than the only one.
  //
  // POL-D still holds: no policy logic is written here. This asks the same shared library the
  // same question, and a check that throws DENIES (ADR-0028 fail-safe).
  const denial = await driverPolicyDenial(processName);
  if (denial) {
    die(EXIT.DRIVER_FAIL, `policy denied ${processName}: ${denial}`);
    return;
  }
  let budget;
  try {
    budget = parseBudget(budgetStr);
  } catch (e) {
    die(EXIT.DRIVER_FAIL, e.message);
    return;
  }

  try {
    const fake = fakeResponse(processName);
    if (fake) {
      // A recording may declare a decline or a failure, so the ladder and the budget path
      // are exercisable offline rather than only against a live endpoint.
      if (fake.__decline_budget) { die(EXIT.BUDGET_DECLINED, `declined: ${fake.__decline_budget}`); return; }
      if (fake.__driver_fail) { die(EXIT.DRIVER_FAIL, `driver failure: ${fake.__driver_fail}`); return; }
      if (fake.__cost) writeCost(fake.__cost);
      const { __cost, __decline_budget, __driver_fail, ...payload } = fake;
      process.stdout.write(`${JSON.stringify(payload)}\n`);
      process.exitCode = EXIT.OK;
      return;
    }

    const input = JSON.parse(inputJson || "{}");
    const { output, cost } = await produce({ processName, input, budget });
    if (cost) writeCost(cost);
    process.stdout.write(`${JSON.stringify(output)}\n`);
    process.exitCode = EXIT.OK;
  } catch (e) {
    // A REAL driver could not decline for budget, and that was a hole in the shared contract
    // rather than a missing feature of any one driver. The fake path has always been able to
    // (`__decline_budget` above), so an offline recording could exercise exit 2 while nothing
    // that actually talks to a runtime ever could -- which makes "the budget arm is covered" a
    // statement about the fixture and not about the code.
    //
    // CLOSED, AND CLOSED NARROWLY: only BUDGET_DECLINED may be requested this way. The exit map
    // is 0/1/2 and this cycle adds nothing to it (ADR-0219), so an `arcExit` naming anything
    // else is a driver trying to widen the contract and is ignored rather than obeyed.
    const asked = e && e.arcExit;
    die(asked === EXIT.BUDGET_DECLINED ? EXIT.BUDGET_DECLINED : EXIT.DRIVER_FAIL, e.message);
  }
}

/**
 * Never an abrupt process.exit() while a socket may be closing: undici's keep-alive pool
 * holds an unref'd timer and exiting mid-teardown races a libuv assertion on Windows, on
 * BOTH the happy and the error path (retro-log 2026-07-16). Set the code, let the loop
 * drain naturally, and keep a ref'd backstop for the case where it does not.
 */
export function settle() {
  // AND NEVER WHILE BYTES ARE STILL QUEUED. The unref'd timer does not HOLD the loop open, but it
  // still FIRES while the loop is alive for another reason -- and a large answer draining into a
  // slow reader is exactly such a reason. `process.exit()` then discards everything queued.
  //
  // Measured across a real process boundary: 8 MiB written, 458752 bytes received, truncated,
  // and the writer exited **0**. 94.5% of the answer lost while the run reported success. arc-run
  // then reads the truncated document as a schema failure, spends a retry, and emits an
  // escalation proposal blaming the driver for output the driver produced correctly.
  //
  // WHY NO LEG COULD CATCH IT: node's stdout-to-a-pipe is SYNCHRONOUS on Windows and Linux and
  // ASYNCHRONOUS on macOS. ubuntu and windows are structurally immune; only the macOS leg can
  // see it, and only with an answer big enough to outrun the reader.
  //
  // A GIVE-UP IS NOT A SUCCESS. If the queue never drains we still have to exit, but exiting 0
  // with bytes pending is the lie this whole comment is about -- so the give-up path reports a
  // driver failure instead, and arc-run treats a truncated answer as one.
  const deadline = Date.now() + 30_000;
  const tick = () => {
    if (process.stdout.writableLength > 0) {
      if (Date.now() < deadline) { setTimeout(tick, 25).unref(); return; }
      process.exitCode = EXIT.DRIVER_FAIL;
      process.stderr.write("arc-driver: stdout did not drain within 30s — the answer is incomplete, reporting a driver failure rather than a truncated success\n");
    }
    process.exit(process.exitCode ?? 0);
  };
  setTimeout(tick, 250).unref();
}
