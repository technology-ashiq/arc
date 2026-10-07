/**
 * failure-class.mjs -- why an attempt failed, and whether another driver may try (ADR-0228, ENG-H).
 *
 * ONE MODULE OWNS THE RULE. arc-run's fallback loop used to hop on `verdict === "driver"`, and
 * `driver` was every exit 1 -- a 503, a provider refusal, a crashed driver and an unparseable answer
 * all walked the chain the same way. The classes that did exist arrived one bug fix at a time
 * (budget, overflow, policy). This file is the only place that names a class or decides a hop, so
 * there is no second copy to disagree with: arc-run asks, bench and the face read the receipt.
 *
 * Everything here is PURE. The clock, the spend and the families are arguments, never read inside,
 * so the same recorded hops always produce the same decision (invariant c: replay-deterministic).
 */

export const FAILURE_CLASSES = Object.freeze([
  "transport",
  "provider-unavailable",
  "model-invalid",
  "policy-refusal",
  "budget",
  "unknown",
]);

const KNOWN = new Set(FAILURE_CLASSES);
// The only classes a hop may follow without condition. `model-invalid` hops at most once and only
// across families; everything else surfaces.
const HOPPABLE = new Set(["transport", "provider-unavailable"]);

// Drivers whose OWN code declares a class (ADR-0228). A declaration from any other driver is ignored:
// `hermes` runs a model-driven agent, and a class that could reach its sidecar from anything the runtime
// controls must not become permission to hop (attack 27dcf39 B2). A driver joins in the diff that makes it declare.
export const DECLARING_DRIVERS = Object.freeze(new Set(["generic-api", "claude-code", "codex", "mock"]));

/**
 * A driver-declared class, read from the cost sidecar. Anything outside the closed set is `unknown`
 * and says so: a typo must never be read as permission to hop.
 * @param {unknown} v
 * @returns {{ cls: string, warn: string | null }}
 */
export function readDeclared(v) {
  if (v === undefined || v === null) return { cls: "unknown", warn: null };
  if (typeof v === "string" && KNOWN.has(v)) return { cls: v, warn: null };
  // Bounded: the value came from a file a driver wrote, and the warning reaches the transcript (B3).
  const shown = String(JSON.stringify(v) ?? typeof v).slice(0, 80);
  return { cls: "unknown", warn: `a driver declared failure_class ${shown}, outside ${FAILURE_CLASSES.join("|")} -- read as unknown, which never falls back` };
}

/**
 * arc-run's observation of one attempt, turned into a class. `null` means the attempt succeeded.
 *
 * ORDER IS THE RULE. The run deadline and arc-run's own ceilings come first, because a driver
 * cannot talk its way out of them: a timeout is the budget being spent (retro-log 2026-08-03#4),
 * and a driver that declared "transport" while the RUN's clock ran out is still out of time.
 * A declaration is read only on exit 1. Exit 0 and exit 2 already decide the class, so a sidecar
 * claiming otherwise is ignored.
 *
 * @param {{ timedOut?: boolean, overflowed?: boolean, policyDenied?: boolean, notInstalled?: boolean,
 *           code: number, declared?: unknown, contractFault?: boolean, answerOk?: boolean, driver?: string }} o
 * @returns {{ cls: string | null, warn: string | null }}
 */
export function classifyAttempt(o) {
  if (o.timedOut) return { cls: "budget", warn: null };
  if (o.overflowed) return { cls: "budget", warn: null };
  if (o.policyDenied) return { cls: "policy-refusal", warn: null };
  if (o.notInstalled) return { cls: "provider-unavailable", warn: null };
  if (o.code === 2) return { cls: "budget", warn: null };
  if (o.code !== 0) {
    if (o.declared !== undefined && o.declared !== null && o.driver !== undefined && !DECLARING_DRIVERS.has(o.driver)) {
      return { cls: "unknown", warn: `driver ${String(o.driver).slice(0, 40)} is not one that declares a failure class -- its declaration is ignored and read as unknown` };
    }
    return readDeclared(o.declared);
  }
  if (o.contractFault) return { cls: "model-invalid", warn: null };
  // Exit 0 without an accepted answer is never the success marker `null` (attack a4e3f33 B4).
  if (o.answerOk === false) return { cls: "unknown", warn: null };
  return { cls: null, warn: null };
}

/**
 * The class a receipt carries for a run that never reached a driver. Pre-dispatch refusals have
 * no attempt to classify, and an absent class on a failed receipt would read as "not recorded".
 * @param {string} reason
 */
export function classForReason(reason) {
  if (reason === "budget") return "budget";
  if (["policy", "tenure", "boundary", "secret"].includes(reason)) return "policy-refusal";
  return "unknown";
}

// F2. A family is who trained the model. A gateway driver is whatever its model id says; a driver
// arc cannot place is `unknown`, and `unknown` is never "different" -- no cross-family hop on a guess.
const DRIVER_FAMILY = Object.freeze({
  "claude-code": "anthropic",
  codex: "openai",
  hermes: "runtime:hermes",
  mock: "mock",
});

/**
 * @param {string} driver
 * @param {string | null | undefined} model  the pin or profile model this driver would run
 */
export function familyOf(driver, model) {
  if (Object.prototype.hasOwnProperty.call(DRIVER_FAMILY, driver)) return DRIVER_FAMILY[driver];
  if (driver === "generic-api" && typeof model === "string") {
    const m = /^([a-z0-9][a-z0-9-]*)\//i.exec(model.trim());
    if (m) return m[1].toLowerCase();
  }
  return "unknown";
}

// Drivers that report spend (`inr`, integer paise) in their cost sidecar. Only these can be held to a
// numeric `max_cost`; a chain with none of them must say `unmetered` (ADR-0228 item 6). A driver joins
// this table in the reviewed diff that makes it report `inr` -- never by assumption.
export const METERING_DRIVERS = Object.freeze(new Set(["mock"]));

// A hop is not started with less than this left on the RUN's clock: a driver that timed out at the
// run's edge and declared `transport` would otherwise start a hop that is killed at once.
export const MIN_HOP_MS = 5000;

// Classes whose attempt served no answer. Their absent spend is 0, not unproven (ADR-0228 F3): the
// class is the driver's own observation that no model produced anything.
const ANSWERLESS = new Set(["transport", "provider-unavailable"]);

const isTerm = (v) => Number.isInteger(v) && v >= 0;

/**
 * The three chain terms of one router row, checked at LOAD (ADR-0228 item 6). Returns every fault,
 * not the first, the way `rowFaults` does. `router-row.mjs` calls this; the meaning of a term lives
 * here, beside the one function that enforces it.
 * @param {string} at   the display path, e.g. `classes.commit-msg-draft`
 * @param {Record<string, unknown>} row
 */
export function chainTermFaults(at, row) {
  const out = [];
  const intFault = (k, min) => {
    const v = row[k];
    if (v === undefined) return `is absent`;
    if (v === null) return "is null — in YAML that is a VALUE, not an omission, and it bounds nothing";
    if (typeof v === "string" && !v.trim()) return "is present but empty";
    if (!Number.isInteger(v)) return `is ${JSON.stringify(v)}, not an integer`;
    if (v < min) return `is ${v}, below ${min}`;
    return null;
  };
  for (const [k, min] of [["max_attempts", 1], ["max_wall_ms", 1]]) {
    const f = intFault(k, min);
    if (f) out.push(`${at} \`${k}\` ${f} — every route declares its terms (ADR-0228)`);
  }
  const chain = [row.driver, ...(Array.isArray(row.fallback) ? row.fallback : [])].map((d) => String(d ?? "").trim());
  const meters = chain.some((d) => METERING_DRIVERS.has(d));
  const c = row.max_cost;
  if (c === "unmetered") {
    if (meters) out.push(`${at} \`max_cost\` is unmetered, but its chain holds a driver that reports spend (${chain.filter((d) => METERING_DRIVERS.has(d)).join(", ")}) — give a cap in paise (ADR-0228)`);
  } else {
    const f = intFault("max_cost", 0);
    if (f) out.push(`${at} \`max_cost\` ${f} — integer paise, or \`unmetered\` (ADR-0228)`);
    else if (!meters) out.push(`${at} \`max_cost\` is ${c} paise, but no driver in its chain (${chain.join(", ")}) reports spend, so nothing could ever be measured against it — write \`unmetered\` (ADR-0228)`);
  }
  return out;
}

/**
 * Whether another driver may try, and which one.
 *
 * @param {{ remaining: string[], terms?: { max_attempts?: number, max_wall_ms?: number, max_cost?: number } }} chain
 * @param {{ driver: string, class: string, ms?: number, cost?: { inr?: number } | null }[]} hops  every attempt so far, in order
 * @param {{ elapsedMs: number, runRemainingMs?: number, familyOf: (driver: string) => string }} ctx
 * @returns {{ hop: true, to: string, index: number, timeoutMs?: number }
 *         | { hop: false, why: string, byTerms: boolean, noFamily?: boolean }}
 */
export function nextHop(chain, hops, ctx) {
  const last = hops[hops.length - 1];
  if (!last) return { hop: false, why: "no attempt has run", byTerms: false };
  const cls = KNOWN.has(last.class) ? last.class : "unknown";

  if (!HOPPABLE.has(cls) && cls !== "model-invalid") {
    return { hop: false, why: `a ${cls} failure never falls back`, byTerms: false };
  }

  // Pick the target first: the terms below only matter if there is somewhere to go.
  let index = -1;
  if (cls === "model-invalid") {
    // At most ONE cross-family hop per run for a contract fault. Counted from the record, not from
    // a flag the caller could forget to set.
    const contractHops = hops.slice(0, -1).filter((h) => h.class === "model-invalid").length;
    if (contractHops >= 1) return { hop: false, why: "a model-invalid failure falls back at most once", byTerms: false };
    const from = ctx.familyOf(last.driver);
    index = chain.remaining.findIndex((d) => {
      const f = ctx.familyOf(String(d ?? "").trim());
      return f !== "unknown" && from !== "unknown" && f !== from;
    });
    if (index < 0) return { hop: false, why: "no chain entry of a different model family", byTerms: false, noFamily: true };
  } else {
    if (!chain.remaining.length) return { hop: false, why: "the fallback chain is exhausted", byTerms: false };
    index = 0;
  }

  const tc = termsCheck(chain.terms, hops, ctx);
  if (!tc.ok) return { hop: false, why: tc.why, byTerms: true };
  return { hop: true, to: String(chain.remaining[index] ?? "").trim(), index, ...(tc.timeoutMs !== undefined ? { timeoutMs: tc.timeoutMs } : {}) };
}

/**
 * May ONE more attempt start under the chain's terms and the run's clock? Shared by a fallback hop and
 * by ADR-0204's same-tier retry, because `max_attempts` counts every attempt and a retry that skipped
 * this check would be the one place the terms did not bind (the twin this lane keeps recording).
 * @param {{ max_attempts?: number, max_wall_ms?: number, max_cost?: number | string } | undefined} terms
 * @param {{ driver: string, class: string | null, cost?: { inr?: number } | null }[]} hops
 * @param {{ elapsedMs: number, runRemainingMs?: number }} ctx
 * @returns {{ ok: true, timeoutMs?: number } | { ok: false, why: string }}
 */
export function termsCheck(terms, hops, ctx) {
  // The RUN's own clock. Too little left is a budget stop, not a hop that starts and is killed at once.
  if (ctx.runRemainingMs !== undefined && ctx.runRemainingMs < MIN_HOP_MS) {
    return { ok: false, why: `the run has ${Math.max(0, Math.floor(ctx.runRemainingMs))} ms left, under the ${MIN_HOP_MS} ms a hop needs` };
  }

  // The chain's terms. Each is checked BEFORE the hop starts: a breach is refused before spend.
  const t = terms || {};
  if (isTerm(t.max_attempts) && hops.length + 1 > t.max_attempts) {
    return { ok: false, why: `the chain allows ${t.max_attempts} attempt(s) and ${hops.length} have run` };
  }
  // The wall term follows the run clock's rule: a hop needs MIN_HOP_MS of the term left, or it would start with a
  // timeout of a few milliseconds and be killed at once (attack 27dcf39 L1-L3: at the term was both a stop and a start).
  if (isTerm(t.max_wall_ms) && t.max_wall_ms - ctx.elapsedMs < MIN_HOP_MS) {
    return { ok: false, why: `the chain allows ${t.max_wall_ms} ms and ${ctx.elapsedMs} have passed, leaving under the ${MIN_HOP_MS} ms a hop needs` };
  }
  if (isTerm(t.max_cost)) {
    // F3. An attempt that served an answer and reported no spend leaves the total UNPROVEN, and an
    // unproven total is never assumed to be under the cap (ADR-0069 b5: absent is never estimated).
    // An answer-less attempt's absent figure is 0: the class says no model produced anything.
    // A figure that was PRESENT but not a non-negative integer is unproven even on an answer-less attempt:
    // it is a report of spend nobody can read, never a 0 (attack 27dcf39 B5).
    const measured = (h) => h.cost && Number.isInteger(h.cost.inr) && h.cost.inr >= 0;
    const unmeasured = hops.find((h) => !measured(h) && (!ANSWERLESS.has(h.class) || (h.cost && h.cost.inr_invalid)));
    if (unmeasured) return { ok: false, why: `the spend so far is unproven (${unmeasured.driver} answered and reported no spend) against max_cost ${t.max_cost}` };
    const spent = hops.reduce((s, h) => s + (measured(h) ? h.cost.inr : 0), 0);
    if (spent >= t.max_cost) return { ok: false, why: `${spent} paise spent against max_cost ${t.max_cost}` };
  }

  const caps = [ctx.runRemainingMs, isTerm(t.max_wall_ms) ? t.max_wall_ms - ctx.elapsedMs : undefined].filter((v) => v !== undefined);
  return { ok: true, ...(caps.length ? { timeoutMs: Math.max(1, Math.floor(Math.min(...caps))) } : {}) };
}
