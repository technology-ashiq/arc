#!/usr/bin/env node
/**
 * router-row.mjs -- the four fields a runtime row must carry, enforced AT LOAD TIME
 * (Phase 07, REQ-04; ADR-0216 tenure, ADR-0217 the hire is a receipt).
 *
 * A runtime is hired, not installed. REQ-04 makes that concrete: the row that routes work to an
 * agent runtime carries `cap:`, `hosted:`, `judge:` and `review_by:`, ALL FOUR MANDATORY, and a
 * row missing any of them fails the router LOAD rather than the dispatch. Load time is the point
 * because a row that only fails when someone happens to route through it is a row that sits
 * wrong for as long as nobody uses it.
 *
 * ============================================================================================
 * "MISSING" AND "PRESENT BUT EMPTY" ARE DIFFERENT INPUTS
 * ============================================================================================
 *
 * REQ-04 is explicit that a row where any of the four is absent, empty, null OR malformed must
 * fail, and that hostile fixtures cover each of those four inputs per field. That is sixteen
 * cases and not four, because a near-miss that LOADS is a guard that cannot fail: `cap: ""`
 * looks decided and decides nothing, `cap: null` in YAML is a value rather than an omission, and
 * `cap: [L1-drafts]` is the right word in the wrong shape. Each is a separate way for a row to
 * pass review while carrying no constraint at all.
 *
 * ============================================================================================
 * WHICH ROWS THIS APPLIES TO, AND WHY IT IS TWO CONDITIONS
 * ============================================================================================
 *
 * A row must carry all four if EITHER:
 *   - it routes to an agent runtime (the drivers named in RUNTIME_DRIVERS), or
 *   - it carries ANY ONE of the four already.
 *
 * The first is the rule. The second exists so a PARTIAL row cannot sneak past by not being a
 * runtime row: someone adding `cap: L1-drafts` to an ordinary class and stopping there has
 * written a row that reads as capped and is not. Existing rows that carry none of the four are
 * untouched, which is what makes this landable as one diff rather than a rewrite of the file.
 */

/** Drivers that are agent runtimes rather than model APIs. A runtime is hired; an API is called. */
export const RUNTIME_DRIVERS = new Set(["hermes"]);

/** The ceiling is absolute this cycle (the PLAN non-negotiable), so the set has one member. */
const CAPS = new Set(["L1-drafts"]);

/** Where the work goes. `local` and `cloud` mean opposite things to the data boundary. */
const HOSTED = new Set(["local", "cloud"]);

const REQUIRED = ["cap", "hosted", "judge", "review_by"];

// ---------- provider profiles (ADR-1800..1802) ----------
// The one driver that takes a gateway rather than only a model. A profile is the gateway's URL, key and model id
// together, kept in the owner store (ADR-1801); the router names it, and only for this driver.
export const PROFILE_DRIVER = "generic-api";
export const PROFILE_PREFIX = "profile:";
// The store's own name grammar without spaces: a YAML scalar with a space is a quoting accident (ADR-1801).
export const PROFILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

/**
 * The profile name a `models[tier][driver]` value refers to, or null when the value is a plain model id. Only the
 * prefix decides: `profile:` with a bad name is still a profile reference, and `pinFaults` refuses it -- otherwise
 * `profile:` alone would fall through as a model id and reach a provider as one.
 * @param {unknown} value
 */
export function profileRef(value) {
  return typeof value === "string" && value.startsWith(PROFILE_PREFIX) ? value.slice(PROFILE_PREFIX.length) : null;
}

/** A class row's `profile:`, as written. @param {Record<string, unknown>} row */
function hasProfileKey(row) {
  return Object.prototype.hasOwnProperty.call(row, "profile");
}

/**
 * ADR-1802: a class `profile:` must be a clean name AND sit on a chain that can reach `generic-api`. An unreachable one
 * reads as decided and decides nothing -- the partial-tenure-row doctrine above, for the same reason.
 * @param {string} at @param {Record<string, unknown>} row
 */
function profileRowFaults(at, row) {
  if (!hasProfileKey(row)) return [];
  const v = row.profile;
  const faults = [];
  if (typeof v !== "string" || !PROFILE_NAME_RE.test(v)) {
    faults.push(`${at} has \`profile: ${JSON.stringify(v)}\`, which is not a profile name (${PROFILE_NAME_RE}) -- a profile is named exactly as the owner store names it, with no spaces (ADR-1801)`);
  }
  const chain = [row.driver, ...(Array.isArray(row.fallback) ? row.fallback : [])].map((d) => String(d ?? "").trim());
  if (!chain.includes(PROFILE_DRIVER)) {
    faults.push(`${at} carries \`profile:\` but its chain (${chain.filter(Boolean).join(" -> ") || "no driver"}) never reaches \`${PROFILE_DRIVER}\`, the only driver a profile applies to -- it would read as decided and decide nothing (ADR-1802)`);
  }
  return faults;
}

/**
 * ADR-1800: in `models`, a `profile:` value is allowed under `generic-api` only, and must name a profile. Any other
 * driver applies a model id it was handed, so a profile there would reach its CLI as a model name.
 * @param {unknown} models
 */
export function pinFaults(models) {
  if (!models || typeof models !== "object" || Array.isArray(models)) return [];
  const out = [];
  for (const [tier, byDriver] of Object.entries(models)) {
    if (!byDriver || typeof byDriver !== "object" || Array.isArray(byDriver)) continue;
    for (const [d, value] of Object.entries(byDriver)) {
      const name = profileRef(value);
      if (name === null) continue;
      if (d !== PROFILE_DRIVER) out.push(`models.${tier}.${d} is ${JSON.stringify(value)}, but a profile applies to \`${PROFILE_DRIVER}\` only -- \`${d}\` would be handed it as a model id (ADR-1800)`);
      else if (!PROFILE_NAME_RE.test(name)) out.push(`models.${tier}.${d} is ${JSON.stringify(value)}, which names no profile (${PROFILE_NAME_RE}) (ADR-1800)`);
    }
  }
  return out;
}

/**
 * A field is present and usable, or it is one of the four named failures. Returning the REASON
 * rather than a boolean is what lets the loader say which of the sixteen cases it hit -- and an
 * operator who is told "cap is empty" fixes it, where one told "invalid row" goes looking.
 */
function fieldFault(name, v) {
  if (v === undefined) return "is absent";
  if (v === null) return "is null — in YAML that is a VALUE, not an omission, and it constrains nothing";
  if (typeof v !== "string") return `is a ${Array.isArray(v) ? "list" : typeof v}, not a string`;
  if (!v.trim()) return "is present but empty, which reads as decided and decides nothing";

  const s = v.trim();
  if (name === "cap" && !CAPS.has(s)) return `is ${JSON.stringify(s)}, which is not a known ceiling (${[...CAPS].join(", ")})`;
  if (name === "hosted" && !HOSTED.has(s)) return `is ${JSON.stringify(s)}, which is not a known hosting (${[...HOSTED].join(", ")})`;
  if (name === "review_by" && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return `is ${JSON.stringify(s)}, which is not a YYYY-MM-DD date`;
  if (name === "review_by") {
    // A date that PARSES but does not exist -- 2026-02-31 -- would otherwise sail through the
    // shape check and then compare as a real instant, which is a tenure nobody set.
    const [y, m, d] = s.split("-").map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() + 1 !== m || probe.getUTCDate() !== d) {
      return `is ${JSON.stringify(s)}, which is not a real calendar date`;
    }
  }
  return null;
}

/**
 * Validate one class row. Returns an array of faults, empty when the row is sound.
 *
 * REPORTS EVERY FAULT, not the first. A loader that stops at the first missing field makes
 * fixing a four-field row a four-round trip, and the operator learns the shape one refusal at a
 * time -- the same reason capability-vet reports every failing condition in one run.
 */
export function rowFaults(className, row, where) {
  // THE DISPLAY PATH IS A PARAMETER, because `default:` is a TOP-LEVEL key and every fault on it
  // was reported as `classes.default` -- pointing an operator at a path that does not exist, and
  // producing a message byte-identical to one for a class literally NAMED `default` under
  // `classes:`. Two different rows, one undistinguishable diagnostic.
  const at = where || `classes.${className}`;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return [`${at} is not a mapping`];
  }
  // A WRONG-TYPED `fallback` IS A FAULT, NOT A SILENT EMPTY LIST. `fallback: hermes` (a string
  // where a list was meant) used to make arc-run's `Array.isArray` false and the whole resilience
  // chain vanish -- the typo deletes the row's fallbacks and nothing reports it.
  const faults = [];
  const hasFallback = Object.prototype.hasOwnProperty.call(row, "fallback");
  if (hasFallback && !Array.isArray(row.fallback)) {
    faults.push(`${at} has a \`fallback\` that is not a list (${JSON.stringify(row.fallback)}) — a wrong-typed fallback silently becomes no fallback at all`);
  }
  // Before the early return below: an ordinary row is exactly where a profile goes.
  faults.push(...profileRowFaults(at, row));

  // THE FALLBACK CHAIN IS PART OF "DOES THIS ROW REACH THE RUNTIME", and it was not.
  //
  // `isRuntime` looked at `row.driver` alone, so this loaded with ZERO faults:
  //
  //     classes: { commit-msg-draft: { driver: claude-code, fallback: [hermes] } }
  //
  // No cap, no hosted, no judge, no review_by, no tenure -- and on the first driver fault arc-run
  // sets `driver = "hermes"` and dispatches to the agent runtime through a row carrying none of
  // the four terms. router.yaml's own comment says exactly this must not happen ("falling back
  // from a capped, tenured, judged runtime to a model API would silently route L1-drafts work
  // through a row with none of those four terms") -- it just guarded the wrong direction.
  //
  // `process-lint.mjs` already walks `[row.driver, ...row.fallback]` for driver existence. Two
  // validators of one file, each holding a check the other lacks: the twin shape at the module
  // level rather than the line level.
  const chain = [row.driver, ...(Array.isArray(row.fallback) ? row.fallback : [])];
  const runtimeInChain = chain.find((d) => RUNTIME_DRIVERS.has(String(d || "").trim()));
  const isRuntime = Boolean(runtimeInChain);
  const carriesAny = REQUIRED.some((k) => Object.prototype.hasOwnProperty.call(row, k));
  if (!isRuntime && !carriesAny) return faults;

  const viaFallback = isRuntime && String(row.driver || "").trim() !== String(runtimeInChain).trim();
  const why = isRuntime
    ? (viaFallback
      ? `can REACH the agent runtime \`${runtimeInChain}\` through its fallback chain`
      : `routes to the agent runtime \`${row.driver}\``)
    : "already carries one of the tenure fields, so it must carry all four or it constrains nothing";

  for (const k of REQUIRED) {
    const fault = fieldFault(k, row[k]);
    if (fault) faults.push(`${at} ${why}, and \`${k}\` ${fault}`);
  }
  return faults;
}

/** Every fault across every class. The router LOAD fails when this is non-empty. */
export function routerFaults(router) {
  const classes = (router && router.classes) || {};
  const out = [];
  for (const [name, row] of Object.entries(classes)) out.push(...rowFaults(name, row));

  // `default:` IS A ROW AND IS CHECKED LIKE ONE. It was skipped entirely -- this loop walks
  // `classes` alone -- so a `default:` naming the agent runtime loaded with zero faults and no
  // terms. Nothing reads `router.default` for a driver today, which is exactly why it is worth
  // closing now: it is inert, so the hole is free to fix and invisible to find later, and the day
  // someone wires it the grant arrives already bypassed. Two fixture roots in this repo write a
  // `default:` block that reads as meaningful configuration.
  // `"default" in router`, NOT truthiness. `default: null` is a YAML VALUE and not an omission --
  // the doctrine this very file states about `cap: null` twenty lines up -- and a truthy guard
  // skipped it silently. `rowFaults` already refuses a non-mapping, so a null row is REPORTED
  // rather than waved through.
  if (router && typeof router === "object" && "default" in router) {
    out.push(...rowFaults("default", router.default, "default (the top-level fallback row)"));
  }
  if (router && typeof router === "object") out.push(...pinFaults(router.models));
  return out;
}

/**
 * Tenure, evaluated at load (ADR-0216). A row past its `review_by` is EXPIRED: dispatching
 * through it refuses, naming the row, and the caller emits ONE idempotent rejustify-or-retire
 * proposal.
 *
 * `today` is a parameter and never `new Date()` inside: a tenure check whose clock the test
 * cannot set is a tenure check nobody can test at a boundary, and the boundary is the only
 * interesting day.
 */
export function isExpired(row, today) {
  // `today` IS VALIDATED, AND THE REASON IS THE FAILURE DIRECTION. `review_by` is guarded four
  // ways; its counterpart was guarded zero ways, and the likeliest caller mistake failed OPEN.
  // Measured: `isExpired(row, new Date())` returns **false for every row, forever** -- relational
  // `<` takes the number hint, `Number("2026-11-13")` is NaN, and every NaN comparison is false.
  // So a caller passing a Date silently disables tenure repo-wide with no error anywhere, which is
  // precisely the shape of the defect this function was just wired in to fix. `"banana"` fails the
  // other way and expires everything. Neither is acceptable from a guess about a parameter type.
  if (typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new TypeError(`isExpired: today must be a YYYY-MM-DD string, got ${JSON.stringify(today)}`);
  }
  const by = row && typeof row.review_by === "string" ? row.review_by.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(by)) return false;   // shape is rowFaults' job, not tenure's
  // String comparison is correct for ISO dates and needs no timezone, which is the point: a
  // Date-based comparison would expire a row a day early or late depending on where it ran.
  return by < today;
}
