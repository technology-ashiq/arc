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

// Minor-unit exponents, the two currencies ADR-1013 scopes. A provider in any other currency is not metered.
const MINOR_EXPONENT = Object.freeze({ INR: 2, USD: 2 });
// ADR-1012's sanity ceiling, the same one `writeCost` and the ledger validator apply.
const MAX_MINOR = 1e12;

/**
 * A provider's spend figure as money (ADR-0229): `{ amount, currency, provider_amount }`, or `null` when there is no
 * figure. THE ONLY PLACE A PROVIDER'S NUMBER BECOMES MONEY; every driver and arc-run go through it, never around it.
 *
 * DECIMAL-STRING ARITHMETIC, NEVER `x * 100`: `0.07 * 100` is `7.000000000000001`, whose ceiling is 8. The number is
 * rendered by `String()` -- the shortest form that round-trips, which is what the provider's JSON said -- and read as
 * digits. The minor-unit part is the first `exponent` fractional digits, plus one if any later digit is non-zero:
 * rounded UP, so a real spend under one cent is 1, never a recorded 0.
 *
 * ABSENT IS NOT ZERO (ADR-0069 b5). Anything but a finite non-negative number -- `undefined`, `null`, a string even if
 * numeric, `NaN`, a negative -- is no figure. A provider that says `0` (a free model) is a measured 0.
 * @param {unknown} value  the provider's figure, in major units of `currency`
 * @param {unknown} currency  ISO-4217 code
 * @returns {{ amount: number, currency: string, provider_amount: string } | null}
 */
export function spendOf(value, currency) {
  if (!isCurrency(currency)) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const m = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(value));
  if (!m) return null;
  const digits = `${m[1]}${m[2] ?? ""}`;
  // Where the decimal point sits within `digits`, after the exponent moves it.
  const point = m[1].length + Number(m[3] ?? 0);
  const at = (i) => (i >= 0 && i < digits.length ? digits[i] : "0");
  let intPart = "";
  for (let i = 0; i < point; i += 1) intPart += at(i);
  let fracPart = "";
  for (let i = Math.max(0, point); i < digits.length; i += 1) fracPart += digits[i];
  // A negative point (1e-7) puts zeros between the point and the first digit.
  if (point < 0) fracPart = "0".repeat(-point) + fracPart;
  return moneyOf(plainDecimal(intPart, fracPart), currency);
}

/**
 * The run's spend in one currency: the EXACT sum of its attempts' `provider_amount`, rounded up ONCE (ADR-0230).
 * `ceil(a) + ceil(b)` is not `ceil(a + b)`, so summing per-attempt amounts would make the cap, the receipt and the
 * money row read three different numbers. Every one of them comes from here. Returns `null` for no figures, and
 * throws on two currencies: adding them needs a rate the spine does not have (ADR-1003).
 * @param {unknown[]} spends  sidecar `spend` values; anything that is not `isSpend` is skipped
 * @returns {{ amount: number, currency: string, provider_amount: string } | null}
 */
export function sumSpend(spends) {
  const real = (Array.isArray(spends) ? spends : []).filter(isSpend);
  if (!real.length) return null;
  const currency = real[0].currency;
  if (real.some((s) => s.currency !== currency)) throw new Error(`spend in ${[...new Set(real.map((s) => s.currency))].join(" and ")} cannot be added without a rate (ADR-1003)`);
  const scale = Math.max(...real.map((s) => (s.provider_amount.split(".")[1] ?? "").length));
  const total = real.reduce((t, s) => {
    const [i, f = ""] = s.provider_amount.split(".");
    return t + BigInt(i + f.padEnd(scale, "0"));
  }, 0n).toString().padStart(scale + 1, "0");
  return moneyOf(plainDecimal(total.slice(0, total.length - scale), total.slice(total.length - scale)), currency);
}

const isCurrency = (c) => typeof c === "string" && Object.prototype.hasOwnProperty.call(MINOR_EXPONENT, c);

/** `"007", "1200"` -> `"7.12"`: leading integer zeros and trailing fractional zeros dropped. */
function plainDecimal(intPart, fracPart) {
  const i = intPart.replace(/^0+(?=\d)/, "") || "0";
  const f = fracPart.replace(/0+$/, "");
  return f ? `${i}.${f}` : i;
}

/** A plain decimal string as money: the first `exponent` fractional digits, plus one if anything after is non-zero. */
function moneyOf(decimal, currency) {
  const [i, f = ""] = decimal.split(".");
  const e = MINOR_EXPONENT[currency];
  let minor = BigInt(i + f.slice(0, e).padEnd(e, "0"));
  if (/[1-9]/.test(f.slice(e))) minor += 1n;
  if (minor > BigInt(MAX_MINOR)) return null;
  return { amount: Number(minor), currency, provider_amount: decimal };
}

// WHOSE figure a driver's spend is (ADR-0230). The `claude` CLI's `total_cost_usd` is the harness's own number -- on a
// subscription login a notional list price, not an invoice -- and a reader must be able to tell it from a provider's
// bill. A driver not named here has no basis to claim, so it reads `unstated` rather than borrowing one.
const SPEND_BASIS = Object.freeze({ "claude-code": "harness-reported", "generic-api": "provider-reported", mock: "recorded" });

/** @param {string} driver */
export function spendBasis(driver) {
  return Object.prototype.hasOwnProperty.call(SPEND_BASIS, driver) ? SPEND_BASIS[driver] : "unstated";
}

/**
 * SessionSpend -- what a `claude` CLI session spent, read at session end (ADR-0229, engine Cycle 9).
 *
 * THE INTERFACE: `read(envelope)` returns the raw provider figure as `{ value, currency }` for `writeCost`'s `spend`,
 * where `spendOf` alone turns it into money. It never parses, rounds or defaults: a missing field is `value:
 * undefined`, which `writeCost` records as `not-reported`, never 0.
 *
 * REAL: the CLI's own usage surface -- the result envelope's `total_cost_usd`, the same object on both paths: the
 * `--output-format json` document and the stream's final `{"type":"result"}` event. Pinned against verbatim captures
 * of CLI 2.1.296 in `tests/fixtures/engine/real-claude-*.json`. On a subscription login the figure is the harness's
 * notional list price, not an invoice (`basis: harness-reported`, ADR-0230).
 *
 * FAKE: the fake CLIs under `tests/fixtures/engine/` print envelopes with the field present, absent and malformed;
 * the driver reads them through this same function, so fake and real share one code path.
 */
export const SessionSpend = Object.freeze({
  /** @param {unknown} envelope  the CLI's result envelope, or anything at all */
  read(envelope) {
    const value = envelope && typeof envelope === "object" && !Array.isArray(envelope) ? envelope.total_cost_usd : undefined;
    return { value, currency: "USD" };
  },
});

/** Whether a value already has the exact shape `spendOf` returns. A shape check, not a second parse. */
export function isSpend(s) {
  return !!s && typeof s === "object" && !Array.isArray(s)
    && Number.isSafeInteger(s.amount) && s.amount >= 0 && s.amount <= MAX_MINOR
    && isCurrency(s.currency)
    && typeof s.provider_amount === "string" && s.provider_amount.length <= 64
    && /^(0|[1-9]\d*)(\.\d*[1-9])?$/.test(s.provider_amount)
    // The amount must BE the provider figure rounded up, or a sidecar could carry a figure and an amount that disagree
    // and each reader would believe a different one (the twin this lane records).
    && moneyOf(s.provider_amount, s.currency)?.amount === s.amount;
}

/**
 * Write the cost sidecar. Money is INTEGER MINOR UNITS (paise) because floats do not sum
 * exactly and the spine's brief sums money. An unavailable field is OMITTED, never zeroed:
 * ADR-0069 block (b)(5) -- recorded, estimated and fabricated are three different things and
 * only the first may enter a receipt.
 *
 * `spend` is the provider's RAW figure, `{ value, currency }`, and becomes money here through `spendOf` and nowhere
 * else (ADR-0229). A legacy `inr` (paise, `mock` recordings) is the same fact already in minor units, so it is carried
 * as an INR spend when no provider figure was given.
 */
export function writeCost({ tokensIn, tokensOut, inr, spend, source, model, runtime }) {
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
  // THE SPEND (ADR-0229). Three states, and the sidecar keeps all three apart: a figure; `spend: null`, which is the
  // driver saying it LOOKED and the provider gave none (`not-reported` on the receipt); and no key at all, a driver
  // that never reads one (`driver-unmetered`). A figure present but unreadable is the second state, said loudly.
  let figure;
  if (spend !== undefined) {
    const raw = spend && typeof spend === "object" ? spend.value : undefined;
    figure = spend && typeof spend === "object" ? spendOf(raw, spend.currency) : null;
    if (!figure && raw !== undefined && raw !== null) {
      process.stderr.write(`arc-driver: WARN refusing a provider spend of ${JSON.stringify(raw)?.slice(0, 80)} — not a non-negative number in a metered currency; reported as not-reported\n`);
    }
  } else if (cost.inr !== undefined && (source || "measured") === "measured") {
    // A legacy paise figure is already money: carried as an INR spend so every reader has one shape to read. Only a
    // MEASURED one: a `manual` or `estimated` figure (bench's recordings) is not a spend, and becoming a money row
    // stamped `measured` is exactly the relabelling ADR-0069 b5 forbids.
    figure = moneyOf(plainDecimal(String(Math.floor(cost.inr / 100)), String(cost.inr % 100).padStart(2, "0")), "INR");
  }
  if (figure) cost.spend = figure;
  // `source` is mandatory whenever ANY figure is present -- a number whose provenance is
  // unstated is the thing MP-F exists to prevent.
  if (Object.keys(cost).length) cost.source = source || "measured";
  if (spend !== undefined && !figure) cost.spend = null;
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
 * Declare WHY this attempt failed, in the cost sidecar (ADR-0228). The sidecar is the one channel back
 * to arc-run, and the exit map stays 0/1/2 (ADR-0219), so the class rides here as one more fact beside
 * `model` and `runtime`. Merged into whatever cost was already written, never replacing it. arc-run reads
 * it only on exit 1 and validates it against its own closed set; this side writes what it is given, so a
 * driver typo surfaces there as `unknown` rather than being silently corrected here.
 * @param {unknown} cls
 */
export function writeFailureClass(cls) {
  const path = process.env.ARC_DRIVER_COST_FILE;
  if (!path || cls === undefined || cls === null) return;
  // BOUNDED TO A CLASS-SHAPED NAME (attack 27dcf39 B3): anything else is written as nothing at all, which arc-run
  // reads as `unknown`. A ten-megabyte or object-valued "class" must not ride the sidecar into a warning.
  if (typeof cls !== "string" || !/^[a-z][a-z-]{0,63}$/.test(cls)) {
    process.stderr.write("arc-driver: WARN a failure class that is not a short lowercase name was not written -- arc-run reads unknown\n");
    return;
  }
  let cost = {};
  if (existsSync(path)) {
    try { cost = JSON.parse(readFileSync(path, "utf8")) || {}; } catch { cost = {}; }
  }
  cost.failure_class = cls;
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
/**
 * The remaining run time, as an absolute deadline arc-run set. Never derived from the budget. ONE reader for every
 * driver (moved from hermes): generic-api ignored this deadline and let each transport attempt start a fresh clock
 * -- A-03's class at a new enforcement point (engine out-of-cycle bug, 2026-09-26).
 * @returns {number | undefined} ms left, or undefined when the run has no deadline
 */
export function msUntilDeadline() {
  const raw = process.env.ARC_DRIVER_DEADLINE_EPOCH_MS;
  if (raw === undefined || raw === "") return undefined;   // absent means no deadline
  // PRESENT-BUT-UNPARSEABLE IS AN ERROR, NOT SILENCE. This returned undefined for any non-finite
  // value, so `1e400` and `Infinity` meant NO CLOCK AT ALL and the shim ran unbounded under a
  // caller that believed it had set a deadline -- and `"   "` became Number 0, declining every
  // run with "0ms left". MAX_BUFFER above validates and falls back to a SAFE value; this one
  // validated and fell back to NO GUARD. Twin readers of the same rule, one failing closed and
  // one failing open, which is the defect this cycle has now hit four times.
  // A digit string is not yet an epoch millisecond: forty digits pass /^\d+$/ and become Infinity, which every
  // caller reads as "no deadline" -- failing OPEN again (attack 415d3a3 L2). A safe integer or it is refused.
  if (!/^\d+$/.test(String(raw).trim()) || !Number.isSafeInteger(Number(String(raw).trim()))) {
    const e = new Error(`ARC_DRIVER_DEADLINE_EPOCH_MS is ${JSON.stringify(raw)}, which is not an epoch millisecond — refusing to run without the clock the caller believes it set`);
    e.arcDeadlineMalformed = true;
    throw e;
  }
  return Number(String(raw).trim()) - Date.now();
}

export function pinnedModel() {
  return process.env.ARC_DRIVER_MODEL || null;
}

/**
 * The trial seat's persona (org ADR-1626), or null. arc-run ALWAYS sets ARC_SEAT_PERSONA_FILE -- empty when no
 * trial seat was named -- so an ambient value never reaches here from outside a run. Every prompt-building driver
 * puts this block in front of the process body, so a trial seat changes what runs on every driver, not one.
 */
export function seatPersona() {
  const f = process.env.ARC_SEAT_PERSONA_FILE;
  if (!f) return null;
  const text = readFileSync(f, "utf8").trim();
  return text ? `${text}\n\n---\nTHE PROCESS YOU ARE SEATED IN:\n` : null;
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
      // `__failure_class` declares WHY the fake failed (ADR-0228). A `__driver_fail` without one is an
      // undeclared failure -- `unknown` to arc-run, which never falls back.
      if (fake.__driver_fail) { writeFailureClass(fake.__failure_class); die(EXIT.DRIVER_FAIL, `driver failure: ${fake.__driver_fail}`); return; }
      if (fake.__cost) writeCost(fake.__cost);
      const { __cost, __decline_budget, __driver_fail, __failure_class, ...payload } = fake;
      process.stdout.write(`${JSON.stringify(payload)}\n`);
      process.exitCode = EXIT.OK;
      return;
    }

    // An input of `-` means "read it from the file named in ARC_DRIVER_INPUT_FILE" (ADR-0226). One
    // argv element is capped at 128 KB on Linux and the whole command line at ~32 KB on Windows,
    // so a PR diff never reached a driver ("Argument list too long"). NOT `@<path>`: the MSYS/Cygwin
    // runtime under Windows `bash` expands any `@file` argument as a RESPONSE FILE -- it read the
    // JSON and word-split it into separate arguments, so the driver saw `surface:logic` as its
    // budget. The path travels in the environment, where no runtime rewrites it. `-` is never valid
    // JSON, so a literal argument still works exactly as before.
    let input;
    if (inputJson === "-") {
      const file = process.env.ARC_DRIVER_INPUT_FILE;
      if (!file) throw new Error("input `-` given but ARC_DRIVER_INPUT_FILE is not set");
      input = JSON.parse(readFileSync(file, "utf8"));
    } else {
      input = JSON.parse(inputJson || "{}");
    }
    const { output, cost, failureClass } = await produce({ processName, input, budget });
    if (cost) writeCost(cost);
    // Only the replay driver returns one on success, to fixture ADR-0228's rule that exit 0 decides the
    // class whatever the sidecar says.
    if (failureClass !== undefined) writeFailureClass(failureClass);
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
    // WHY it failed, when the driver knows (ADR-0228). Written before the exit code is set, so a driver
    // that dies right after still left its declaration; arc-run reads `unknown` if it never arrives.
    // A failed attempt can still have spent money, and only a measured figure may say so (ADR-0069 b5).
    // GUARDED: a sidecar write that throws (EBUSY, a read-only dir) must never skip die() below, or an exit-2
    // budget decline would leave as a crash code and be read as a different failure (attack 27dcf39 B4).
    // TWO GUARDS, CLASS FIRST (attack a4e3f33 B6): a cost write that throws must not take the declaration with it.
    // writeCost replaces the file, so it runs first only when there is a cost, and the class is merged in after.
    const warnW = (what, w) => process.stderr.write(`arc-driver: WARN could not write the ${what} (${w && w.code ? w.code : "error"})\n`);
    if (e && e.arcCost && typeof e.arcCost === "object") { try { writeCost(e.arcCost); } catch (w) { warnW("failure's cost", w); } }
    if (e && e.arcFailureClass !== undefined) { try { writeFailureClass(e.arcFailureClass); } catch (w) { warnW("failure class -- arc-run reads unknown", w); } }
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
