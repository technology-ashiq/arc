#!/usr/bin/env node
// Test-only driver for kill-distance.mjs (Phase 01, ADR-1008 / ADR-1018).
//
// It exists for the reason ledger-parse-runner.mjs exists: a Node program embedded inside a shell
// string has broken this repo four separate times (docs/retro-log.md, 2026-08-03 and 2026-08-12) --
// one apostrophe closes the quoting and the shell runs the remainder, one backtick opens a command
// substitution. The moment the embedded program wants any of those characters it belongs in a file.
//
// usage:
//   ledger-kill-runner.mjs eval    <criterion> <threshold-json> <value-json>
//   ledger-kill-runner.mjs venture <venture> <kill-json> <observations-json>
//   ledger-kill-runner.mjs import  <path to a kill-distance.mjs>
//
// EXIT CODES ARE THREE, NOT TWO, and the separation is load-bearing. The first cut of the parser
// runner wrapped loading and evaluating in one try and reported both as exit 1, which made "the
// module refused this input" indistinguishable from "the module is gone" -- so a suite asserting
// `status -eq 1` stayed green with the implementation deleted. Here:
//
//   0  the module answered
//   1  the module REFUSED (a SpineError, or any throw out of the evaluator)
//   2  the driver could not run at all -- bad args, module missing, no callable export
//
// `import` mode is the drift guard's negative control and is the one place where exit 1 is the
// PASSING outcome, so it prints the thrown code and message on stdout rather than stderr: the
// assertion needs to read them, and a test that asserts on a message must not have to merge streams
// to see it.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const REAL = join(here, "..", ".claude", "scripts", "hq", "lib", "ledger", "kill-distance.mjs");

const argv = process.argv.slice(2);
const mode = argv[0];

function usage(why) {
  process.stderr.write(`ARG_ERROR ${why}\n`);
  process.stderr.write("usage: ledger-kill-runner.mjs eval <criterion> <threshold-json> <value-json>\n");
  process.stderr.write("       ledger-kill-runner.mjs venture <venture> <kill-json> <observations-json>\n");
  process.stderr.write("       ledger-kill-runner.mjs import <path-to-kill-distance.mjs>\n");
  process.exit(2);
}

// A thrown value carries a `code` on both shapes this driver can see: SpineError sets it, and Node
// sets ERR_MODULE_NOT_FOUND on a failed import. Printing it rather than only the message is what
// lets an assertion say WHICH refusal happened instead of merely that one did.
const codeOf = (err) => (err && err.code) || (err && err.name) || "UNKNOWN";
const msgOf = (err) => (err && err.message ? err.message : String(err));

// `-` is the empty-reason marker: a bats glob on `reason=` alone would match a line whose reason is
// the empty string, which is precisely the failure ADR-1018 forbids (an ABSENT with no reason).
const orDash = (v) => (v === null || v === undefined || v === "" ? "-" : String(v));

function parseJsonArg(label, text) {
  try {
    return JSON.parse(text);
  } catch {
    usage(`${label} must be JSON (got ${JSON.stringify(text)}) -- use null for an absent value`);
  }
}

// ---------------------------------------------------------------------------------------------
// import mode -- the drift guard's negative control.
//
// kill-distance.mjs asserts at module LOAD that POLARITY's keys equal ventures.mjs's KILL_CRITERIA.
// A guard with no negative control is a guard nobody has ever seen fire, so the suite copies lib/,
// adds a third criterion to the COPY's ventures.mjs, and points this mode at the copy.
if (mode === "import") {
  const target = argv[1];
  if (!target) usage("import needs a path to a kill-distance.mjs");
  try {
    const mod = await import(pathToFileURL(resolve(target)));
    // A module that imported but exports nothing recognisable is not a passing import: name the
    // entry point, so "it loaded" can never be satisfied by an empty file.
    if (typeof mod.evaluateCriterion !== "function")
      throw new Error("imported module exports no evaluateCriterion -- this is not kill-distance.mjs");
    process.stdout.write(`IMPORT_OK criteria=${Object.keys(mod.POLARITY || {}).sort().join(",")}\n`);
    process.exit(0);
  } catch (err) {
    process.stdout.write(`IMPORT_FAILED ${codeOf(err)} ${msgOf(err)}\n`);
    process.exit(1);
  }
}

// Every other mode drives the REAL module. Load failure is exit 2 and never exit 1.
let kd;
try {
  kd = await import(pathToFileURL(REAL));
  if (typeof kd.evaluateCriterion !== "function" || typeof kd.evaluateVenture !== "function")
    throw new Error("kill-distance.mjs exports no callable evaluateCriterion/evaluateVenture");
} catch (err) {
  process.stderr.write(`LOAD_ERROR ${codeOf(err)} ${msgOf(err)}\n`);
  process.exit(2);
}

if (mode === "eval") {
  const [, criterion, thresholdText, valueText] = argv;
  if (criterion === undefined || thresholdText === undefined || valueText === undefined)
    usage("eval needs <criterion> <threshold-json> <value-json>");
  const threshold = parseJsonArg("threshold", thresholdText);
  const value = parseJsonArg("value", valueText);
  try {
    const r = kd.evaluateCriterion({ criterion, threshold, value });
    process.stdout.write(
      `criterion=${orDash(r.criterion)}\nstatus=${orDash(r.status)}\nthreshold=${orDash(r.threshold)}\n` +
      `value=${orDash(r.value)}\ndistance=${orDash(r.distance)}\nreason=${orDash(r.reason)}\n`);
    // Printed LAST and only here: a probe that asserts on a field name alone cannot tell a complete
    // answer from a half-written one, and a crash mid-write leaves a plausible-looking prefix.
    process.stdout.write("EVAL_OK\n");
    process.exit(0);
  } catch (err) {
    process.stdout.write(`EVAL_REFUSED ${codeOf(err)} ${msgOf(err)}\n`);
    process.exit(1);
  }
}

if (mode === "venture") {
  const [, venture, killText, obsText] = argv;
  if (venture === undefined || killText === undefined || obsText === undefined)
    usage("venture needs <venture> <kill-json> <observations-json>");
  const kill = parseJsonArg("kill", killText);
  const observations = parseJsonArg("observations", obsText);
  try {
    const v = kd.evaluateVenture({ venture, kill, observations });
    process.stdout.write(`venture=${orDash(v.venture)}\nworst=${orDash(v.worst)}\nabsentCount=${v.absentCount}\n`);
    // One line per criterion, in the module's own order, so a row that VANISHED from the result is
    // visible as a missing line rather than as a number that happens to still look plausible.
    for (const c of v.criteria)
      process.stdout.write(`row criterion=${orDash(c.criterion)} status=${orDash(c.status)} distance=${orDash(c.distance)} reason=${orDash(c.reason)}\n`);
    process.stdout.write("VENTURE_OK\n");
    process.exit(0);
  } catch (err) {
    process.stdout.write(`VENTURE_REFUSED ${codeOf(err)} ${msgOf(err)}\n`);
    process.exit(1);
  }
}

usage(`unknown mode ${JSON.stringify(mode)}`);
