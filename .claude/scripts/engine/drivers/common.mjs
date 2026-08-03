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
 * The one entry point every driver core calls. Handles the argv contract, the budget
 * decline, the fake path, the cost sidecar and the exit discipline, so a new driver is
 * genuinely one `produce()` function -- which is the north-star REQ-08 times.
 */
export async function runDriver(name, produce) {
  const [verb, processName, inputJson, budgetStr] = process.argv.slice(2);
  const die = (code, msg) => { process.stderr.write(`${name}: ${msg}\n`); process.exitCode = code; };

  if (verb !== "run") {
    die(EXIT.DRIVER_FAIL, `usage: ${name}.sh run <process> <input-json> <budget>`);
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
    die(EXIT.DRIVER_FAIL, e.message);
  }
}

/**
 * Never an abrupt process.exit() while a socket may be closing: undici's keep-alive pool
 * holds an unref'd timer and exiting mid-teardown races a libuv assertion on Windows, on
 * BOTH the happy and the error path (retro-log 2026-07-16). Set the code, let the loop
 * drain naturally, and keep a ref'd backstop for the case where it does not.
 */
export function settle() {
  setTimeout(() => process.exit(process.exitCode ?? 0), 250).unref();
}
