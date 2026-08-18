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
export function writeCost({ tokensIn, tokensOut, inr, source, model, runtime }) {
  const path = process.env.ARC_DRIVER_COST_FILE;
  if (!path) return;
  const cost = {};
  if (Number.isFinite(tokensIn)) cost.tokens_in = tokensIn;
  if (Number.isFinite(tokensOut)) cost.tokens_out = tokensOut;
  // A NON-NEGATIVE INTEGER, NOT MERELY "FINITE". `Number.isFinite` admitted three wrong things,
  // all proved: a NEGATIVE spend (arc-run does `inrSpent += r.cost.inr`, so one negative report
  // drives the total down and `overBudget()` cannot fire again for the rest of the fallback chain
  // -- a driver reporting -1000000 buys unlimited budget); a FRACTIONAL value, stamped `measured`
  // and carried into `inr_estimate` even though these are integer minor units; and a numeric
  // STRING, which was dropped in total silence, losing a real provider-reported spend.
  //
  // The upper bound is a sanity ceiling, not a policy: a figure past it is a units bug, and a
  // units bug on an append-only money receipt is the expensive kind.
  if (Number.isInteger(inr) && inr >= 0 && inr <= 1e12) cost.inr = inr;
  else if (inr !== undefined && inr !== null) {
    process.stderr.write(`arc-driver: WARN refusing a cost of ${JSON.stringify(inr)} — spend must be a non-negative integer in paise; reported as absent\n`);
  }
  // `source` is mandatory whenever ANY figure is present -- a number whose provenance is
  // unstated is the thing MP-F exists to prevent.
  if (Object.keys(cost).length) cost.source = source || "measured";
  // THE SIDECAR IS THE ONLY CHANNEL A DRIVER HAS BACK TO arc-run, so what-actually-ran rides
  // here too (ADR-0221). `produce()` returning a `model` key looked like that channel and was
  // not: the caller below destructures `{ output, cost }` and drops everything else, so
  // `drivers/hermes` has been returning a model nothing read. Two facts, two keys, never one
  // string -- `model` is the clean model id the driver observed, `runtime` is which contractor
  // observed it, and ADR-0220 is the reason those are not the same field.
  //
  // These are written even when no cost figure exists: a run can know its model and not its
  // spend, and `Object.keys(cost).length` above must therefore be evaluated BEFORE they land or
  // a model id would silently manufacture `source: "measured"` for an empty cost record.
  // WRONG TYPE IS LOUD HERE TOO. `drivers/hermes` learned this lesson ("'Wrong type' and 'missing'
  // are DIFFERENT INPUTS ... `{"model": 42}` was dropped in total silence") and the fix went into
  // hermes ALONE -- while THIS is the funnel every driver uses (mock, claude-code, codex,
  // generic-api). So the loud-on-wrong-type property held for exactly one driver and failed for the
  // shared path. A fix is not applied until it has been attacked where it was never made.
  if (typeof model === "string" && model) cost.model = model;
  else if (model !== undefined && model !== null) {
    process.stderr.write(`arc-driver: WARN a non-string model (${typeof model}) was dropped — the seat is left unpinned\n`);
  }
  if (typeof runtime === "string" && runtime) cost.runtime = runtime;
  else if (runtime !== undefined && runtime !== null) {
    process.stderr.write(`arc-driver: WARN a non-string runtime identity (${typeof runtime}) was dropped\n`);
  }
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
/**
 * WHERE THE PROCESS FILE IS READ FROM IS NOT WHERE THE WORK HAPPENS (ADR-0220, ADR-0223).
 *
 * ADR-0220 split one name into two: `root` is WHERE ARC MACHINERY LIVES -- `processes/`,
 * `router.yaml`, the drivers -- and `workRoot` is where the driver does its work, handed down to
 * the child as `ARC_ROOT` and as its cwd. The canonical process file belongs to the first.
 *
 * Every CLI driver read it from the second. So `driverPolicyDenial` below validated the file at
 * `policyRoot()` while the driver body built its prompt and its tool grant from a DIFFERENT file
 * at `$ARC_ROOT` -- validate one read, compare another, the defect this lane has now fixed in
 * `verdict.mjs`, in `lineage.mjs` and inside `arc-run.mjs` itself (which records closing exactly
 * this hole: "a target tree could widen its own grant"). The driver copies were left open, and an
 * adversarial pass walked through them with an attacker-authored `processes/` tree: the gate read
 * arc's benign file and the prompt plus `--allowedTools` came from the hostile one.
 *
 * The governing root is where THIS CODE lives, never the caller's. A tree with no policy library
 * keeps the consumer-repo contract and falls back, because there is nothing there to disagree
 * with.
 */
export async function canonicalRoot() {
  try {
    const gate = await import("../../hq/lib/policy/run-gate.mjs");
    return gate.policyRoot();
  } catch {
    return process.env.ARC_ROOT || process.cwd();
  }
}

/**
 * THE CANONICAL PROCESS DOCUMENT, read ONCE from the machinery root (ADR-0220, ADR-0223).
 *
 * EVERY DRIVER-SIDE CONSUMER GOES THROUGH HERE: `driverPolicyDenial` validates the document,
 * `drivers/hermes` derives the runtime's toolset allowlist from it (ADR-0224), and
 * `drivers/claude-code` and `drivers/codex` build their prompt and their tool grant from it. Those
 * must all be looking at the same bytes: a gate that validates one read while the dispatch is shaped
 * by another is the defect this lane has closed in `verdict.mjs`, in `lineage.mjs` and inside
 * `arc-run.mjs`.
 *
 * THE FIRST VERSION OF THIS COMMENT OVERCLAIMED, and an adversarial pass said so. It read "one
 * reader, so there is no second copy to drift" while `claude-code.mjs` and `codex.mjs` still each
 * opened the file themselves — sharing the ROOT was only half the fix, and the pass demonstrated the
 * two reads seeing different bytes when something writes between them. Both now call this.
 *
 * WHAT IS STILL OUTSIDE, NAMED RATHER THAN IMPLIED: `arc-run.mjs` reads its own copy from its own
 * `root` (`--root` / `$ARC_ROOT` / git toplevel) to validate the driver's OUTPUT against the schema.
 * In the normal case that resolves to the same tree; where it does not, arc-run would judge a result
 * against a contract the driver never executed. Fixing that means touching ADR-0220's work-root seam
 * and is deliberately not bundled here. `arc-bench.mjs` also reads process files and belongs to
 * another lane.
 *
 * It returns a RESULT rather than throwing, because the three callers want different things from a
 * miss: the gate treats an absent file as "arc-run reports this better than we can", and a driver
 * wants to name it.
 */
export async function canonicalDoc(processName) {
  const root = await canonicalRoot();
  const path = join(root, "processes", `${processName}.process.yaml`);
  if (!existsSync(path)) return { ok: false, missing: true, root, path, doc: null };
  const { parseYamlSubset } = await import("../yaml-subset.mjs");
  const parsed = parseYamlSubset(readFileSync(path, "utf8"));
  if (!parsed || !parsed.ok) {
    return { ok: false, missing: false, root, path, doc: null, what: (parsed && parsed.error && parsed.error.what) || "unknown" };
  }
  return { ok: true, missing: false, root, path, doc: parsed.value };
}

async function driverPolicyDenial(processName) {
  if (!processName) return null;
  let gate;
  try {
    gate = await import("../../hq/lib/policy/run-gate.mjs");
  } catch {
    return null; // no policy library in this tree -- nothing has been declared, nothing to enforce
  }
  try {
    // ONE READER (see canonicalDoc). This function used to open the file itself, which is how
    // the gate came to validate one copy while two drivers shaped their dispatch from another.
    const read = await canonicalDoc(processName);
    if (read.missing) return null; // arc-run reports the missing process better than we can
    const verdict = gate.authorizeRun({ processName, doc: read.doc, root: read.root });
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
