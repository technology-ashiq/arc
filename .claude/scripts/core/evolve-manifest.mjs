// evolve-manifest.mjs — the `evolve` section of products/NAME/manifest.json (ADR-0301).
//
// Three enforcement levels, deliberately different:
//   section absent                -> silent, exit 0. The registration gate carries the
//                                    requirement; the lint does not invent one.
//   section present but invalid   -> exit 2 from birth, naming the exact missing keys.
//   a money-touching path         -> permanent refusal at the contract layer.
//
// It lives in `core`, not in `evolve`: product-lint.mjs is a core-owned file, and a core file
// that imports from a downstream product would break `sync-to-project --products core` in every
// consumer repo that never installs evolve. `evolve` requires `core`, so the Phase-02 runner
// imports this module in the legal direction.
//
// Every rule here is CLOSED. Unknown keys, case-varied enums and near-miss values are rejected,
// never normalized — normalizing is how a validator quietly becomes a suggestion.
// Pure: the only impurity is the injectable `exists` probe, so the whole module is testable
// without a filesystem.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROCESS_BASE_RE } from "./variant-grammar.mjs";

export const EVOLVE_REQUIRED_KEYS = Object.freeze(["metrics", "experiments", "evals", "promote_via"]);

const METRIC_KEYS = Object.freeze(["name", "source_event", "aggregation", "direction", "role"]);
const EXPERIMENT_KEYS = Object.freeze(["surface_file", "variant_grammar", "split", "excluded_categories"]);
const EVALS_KEYS = Object.freeze(["holdout_rule", "per_arm_floor", "minimum_effect_rule", "test_id", "alpha", "effect_floor"]);

const METRIC_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
// A source event is validated for SHAPE only, not against the spine's KINDS set. `metric.observed`
// is the client's kind (ADR-0308) and is deliberately absent from this repo's vocabulary — a
// membership check here would refuse the one value the design expects a real client to declare.
// Whether the kind actually exists is a runtime question, answered by the Phase-02 runner, which
// may import hq.
const EVENT_KIND_RE = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const AGGREGATIONS = new Set(["rate", "sum", "mean", "count", "p50", "p90", "p95", "p99"]);
const DIRECTIONS = new Set(["higher-is-better", "lower-is-better"]);
const ROLES = new Set(["primary", "guardrail"]);
// ADR-0306 pins ONE test for v1. A manifest naming a second test would make two verdicts on the
// same board mean different things, which is the whole reason the test id rides the config hash.
const PINNED_TEST_ID = "newcombe-wilson-difference-v1";
// Glob metacharacters. `promote_via` is an exact-path allowlist: a pattern that expands is a
// pattern whose membership changes when an unrelated file lands.
const GLOB_CHARS = /[*?[\]{}]/;

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

function hasControlChar(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f)) return true;
  }
  return false;
}

// ---------- money-surface classifier ----------

// One pattern segment -> an anchored regex over a single path segment. Built character by
// character so no input character is ever treated as a metacharacter by accident.
function segmentRegex(seg) {
  let src = "^";
  for (const ch of seg) {
    if (ch === "*") src += "[^/]*";
    else if (ch === "?") src += "[^/]";
    else src += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(src + "$");
}

// `**` matches zero or more whole segments; `*`/`?` match within one segment. This is a DP over
// (pattern segments x path segments), not a backtracking regex: a denylist is security-shaped
// and must not be its own ReDoS surface (same reasoning as product-lint's envSentinel rule).
export function globMatch(pattern, path) {
  const P = pattern.split("/");
  const S = path.split("/");
  let dp = new Array(S.length + 1).fill(false);
  dp[0] = true;
  for (const pseg of P) {
    const next = new Array(S.length + 1).fill(false);
    if (pseg === "**") {
      let carry = false;
      for (let j = 0; j <= S.length; j++) { carry = carry || dp[j]; next[j] = carry; }
    } else {
      const re = segmentRegex(pseg);
      for (let j = 1; j <= S.length; j++) if (dp[j - 1] && re.test(S[j - 1])) next[j] = true;
    }
    dp = next;
  }
  return dp[S.length];
}

let DENY_CACHE = null;
export function loadMoneySurfaces(file) {
  const path = file ?? join(fileURLToPath(new URL(".", import.meta.url)), "money-surfaces.json");
  const obj = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(obj.deny) || obj.deny.length === 0)
    throw new Error(`money-surfaces.json has no deny[] — refusing to run with an empty denylist`);
  for (const p of obj.deny)
    if (typeof p !== "string" || p.length === 0)
      throw new Error(`money-surfaces.json: deny[] entry is not a non-empty string`);
  return obj.deny;
}

// Returns the matching deny pattern, or null. Never a boolean: the refusal message names the
// rule that fired, so a surprised author can see WHY without reading the denylist.
export function moneySurfaceMatch(path, deny) {
  const list = deny ?? (DENY_CACHE ??= loadMoneySurfaces());
  for (const pattern of list) if (globMatch(pattern, path)) return pattern;
  return null;
}

// ---------- path rules ----------

// An `evolve` target path is a repo-relative, forward-slash, exact file path. Mirrors
// product-lint's checkPath rules (backslash, dot-space traversal, absolute) and adds the two
// this contract needs: no glob, and no `~`.
// Exported so the spine's `experiment.opened` validator holds `target_path` to the SAME rule the
// manifest was linted against — hq requires core, so this is the legal import direction, and a
// second copy of these rules is a second copy that drifts.
export function checkTargetPath(p, ctx, out) {
  if (typeof p !== "string" || p.length === 0) { out.push(`${ctx}: empty path entry`); return false; }
  let ok = true;
  if (hasControlChar(p)) { out.push(`${ctx}: control character in path: ${JSON.stringify(p)}`); ok = false; }
  if (p.includes("\\")) { out.push(`${ctx}: backslash not allowed in path: ${JSON.stringify(p)}`); ok = false; }
  if (p !== p.trim()) { out.push(`${ctx}: leading/trailing whitespace in path: ${JSON.stringify(p)}`); ok = false; }
  if (p.startsWith("/") || p.startsWith("~") || /^[A-Za-z]:/.test(p)) { out.push(`${ctx}: absolute path not allowed: ${p}`); ok = false; }
  // `.. `, `...` and friends: .NET/Win32 strips trailing dots and spaces, so they normalize back
  // to `..` on the PowerShell twin.
  if (p.split("/").some((s) => /^\.\.[.\s]*$/.test(s))) { out.push(`${ctx}: path traversal not allowed: ${p}`); ok = false; }
  if (GLOB_CHARS.test(p)) { out.push(`${ctx}: glob pattern not allowed, this is an exact-path allowlist: ${p}`); ok = false; }
  return ok;
}

// A path that survives checkTargetPath is then held against the money denylist. Applied to
// experiment surfaces AND promotion targets: the non-negotiable is "no experiments on
// money-touching surfaces", and an experiment renders at its surface, not only at its target.
function refuseMoney(p, ctx, out) {
  const hit = moneySurfaceMatch(p);
  if (hit) out.push(`${ctx}: ${p} is a money-touching surface (matched deny rule ${hit}) — permanently refused (initiatives/evolve/PLAN.md, non-negotiable)`);
  return hit === null;
}

// ---------- section validator ----------

/**
 * Validate a manifest's `evolve` section.
 * @param {unknown} evolve   the value of the `evolve` key (caller checks presence)
 * @param {string}  ctx      message prefix, e.g. "products/core"
 * @param {{root?: string, exists?: (relPath: string) => boolean}} [opts]
 * @returns {string[]} zero or more error messages; empty means valid
 */
export function checkEvolveSection(evolve, ctx, opts = {}) {
  const out = [];
  const exists = opts.exists ?? ((rel) => existsSync(join(opts.root ?? ".", rel)));

  if (!isPlainObject(evolve)) {
    out.push(`${ctx}: evolve must be an object`);
    return out; // every key-by-key message below would be noise about a shape that isn't there
  }

  for (const k of EVOLVE_REQUIRED_KEYS)
    if (!(k in evolve)) out.push(`${ctx}: evolve is missing required key "${k}"`);
  for (const k of Object.keys(evolve))
    if (!EVOLVE_REQUIRED_KEYS.includes(k)) out.push(`${ctx}: evolve has unknown key "${k}" (the section is closed to ${EVOLVE_REQUIRED_KEYS.join("|")})`);

  if ("metrics" in evolve) checkMetrics(evolve.metrics, `${ctx}: evolve.metrics`, out);
  if ("experiments" in evolve) checkExperiments(evolve.experiments, `${ctx}: evolve.experiments`, out, exists);
  if ("evals" in evolve) checkEvals(evolve.evals, `${ctx}: evolve.evals`, out);
  if ("promote_via" in evolve) checkPromoteVia(evolve.promote_via, `${ctx}: evolve.promote_via`, out, exists);

  return out;
}

function checkMetrics(metrics, ctx, out) {
  if (!Array.isArray(metrics)) { out.push(`${ctx} must be an array`); return; }
  if (metrics.length === 0) { out.push(`${ctx} must declare at least one metric`); return; }
  let primaries = 0;
  const names = new Set();
  metrics.forEach((m, i) => {
    const at = `${ctx}[${i}]`;
    if (!isPlainObject(m)) { out.push(`${at} must be an object`); return; }
    for (const k of METRIC_KEYS) if (!(k in m)) out.push(`${at} is missing "${k}"`);
    for (const k of Object.keys(m)) if (!METRIC_KEYS.includes(k)) out.push(`${at} has unknown key "${k}"`);
    if (typeof m.name !== "string" || !METRIC_NAME_RE.test(m.name)) out.push(`${at}.name ${JSON.stringify(m.name)} must match ${METRIC_NAME_RE}`);
    else if (names.has(m.name)) out.push(`${at}.name "${m.name}" is declared twice`);
    else names.add(m.name);
    if (typeof m.source_event !== "string" || !EVENT_KIND_RE.test(m.source_event)) out.push(`${at}.source_event ${JSON.stringify(m.source_event)} is not an event kind (noun.verb, lower case)`);
    if (!AGGREGATIONS.has(m.aggregation)) out.push(`${at}.aggregation ${JSON.stringify(m.aggregation)} is outside ${[...AGGREGATIONS].join("|")} (exact case)`);
    if (!DIRECTIONS.has(m.direction)) out.push(`${at}.direction ${JSON.stringify(m.direction)} is outside ${[...DIRECTIONS].join("|")} (exact case)`);
    if (!ROLES.has(m.role)) out.push(`${at}.role ${JSON.stringify(m.role)} is outside ${[...ROLES].join("|")} (exact case)`);
    if (m.role === "primary") primaries++;
  });
  // A verdict is computed on ONE metric. Zero primaries makes the runner guess; two makes a
  // "win" ambiguous, and an ambiguous win is how a promotion gets argued after the fact.
  if (primaries !== 1) out.push(`${ctx} must declare exactly one metric with role "primary" (found ${primaries})`);
}

function checkExperiments(experiments, ctx, out, exists) {
  if (!Array.isArray(experiments)) { out.push(`${ctx} must be an array`); return; }
  if (experiments.length === 0) { out.push(`${ctx} must declare at least one experiment surface`); return; }
  experiments.forEach((e, i) => {
    const at = `${ctx}[${i}]`;
    if (!isPlainObject(e)) { out.push(`${at} must be an object`); return; }
    for (const k of EXPERIMENT_KEYS) if (!(k in e)) out.push(`${at} is missing "${k}"`);
    for (const k of Object.keys(e)) if (!EXPERIMENT_KEYS.includes(k)) out.push(`${at} has unknown key "${k}"`);
    if (checkTargetPath(e.surface_file, `${at}.surface_file`, out) && refuseMoney(e.surface_file, `${at}.surface_file`, out)) {
      if (!exists(e.surface_file)) out.push(`${at}.surface_file does not exist: ${e.surface_file}`);
    }
    if (typeof e.variant_grammar !== "string" || !PROCESS_BASE_RE.test(e.variant_grammar))
      out.push(`${at}.variant_grammar ${JSON.stringify(e.variant_grammar)} must be name@x.y.z (the arm's +slug is appended per receipt, never declared here)`);
    checkSplit(e.split, `${at}.split`, out);
    if (!Array.isArray(e.excluded_categories)) out.push(`${at}.excluded_categories must be an array (use [] for none)`);
    else for (const c of e.excluded_categories)
      if (typeof c !== "string" || !SLUG_RE.test(c)) out.push(`${at}.excluded_categories entry ${JSON.stringify(c)} is not a slug`);
  });
}

function checkSplit(split, ctx, out) {
  if (!Array.isArray(split)) { out.push(`${ctx} must be an array of integer percentages`); return; }
  if (split.length < 2) { out.push(`${ctx} must have at least two arms`); return; }
  let sum = 0;
  for (const s of split) {
    if (!Number.isSafeInteger(s) || s < 1 || s > 99) { out.push(`${ctx} entry ${JSON.stringify(s)} must be an integer percentage in 1..99`); return; }
    sum += s;
  }
  // Integers summing to exactly 100: a float split does not sum exactly, and a split that does
  // not sum to 100 silently drops or double-counts units at assignment time.
  if (sum !== 100) out.push(`${ctx} sums to ${sum}, must be exactly 100`);
}

function checkEvals(evals, ctx, out) {
  if (!isPlainObject(evals)) { out.push(`${ctx} must be an object`); return; }
  for (const k of EVALS_KEYS) if (!(k in evals)) out.push(`${ctx} is missing "${k}"`);
  for (const k of Object.keys(evals)) if (!EVALS_KEYS.includes(k)) out.push(`${ctx} has unknown key "${k}"`);
  for (const k of ["holdout_rule", "minimum_effect_rule"])
    if (typeof evals[k] !== "string" || !SLUG_RE.test(evals[k])) out.push(`${ctx}.${k} ${JSON.stringify(evals[k])} is not a slug`);
  if (!Number.isSafeInteger(evals.per_arm_floor) || evals.per_arm_floor < 1)
    out.push(`${ctx}.per_arm_floor ${JSON.stringify(evals.per_arm_floor)} must be a positive integer`);
  if (evals.test_id !== PINNED_TEST_ID)
    out.push(`${ctx}.test_id ${JSON.stringify(evals.test_id)} must be "${PINNED_TEST_ID}" — ADR-0306 pins exactly one test for v1`);
  // alpha and effect_floor ride the config hash (ADR-0310): a verdict's meaning is fixed by
  // these two numbers, so a non-finite or out-of-range value must never reach the hash.
  if (typeof evals.alpha !== "number" || !Number.isFinite(evals.alpha) || evals.alpha <= 0 || evals.alpha >= 1)
    out.push(`${ctx}.alpha ${JSON.stringify(evals.alpha)} must be a finite number strictly between 0 and 1`);
  if (typeof evals.effect_floor !== "number" || !Number.isFinite(evals.effect_floor) || evals.effect_floor < 0 || evals.effect_floor >= 1)
    out.push(`${ctx}.effect_floor ${JSON.stringify(evals.effect_floor)} must be a finite number in [0, 1)`);
}

function checkPromoteVia(promoteVia, ctx, out, exists) {
  if (!Array.isArray(promoteVia)) { out.push(`${ctx} must be an array of exact repo-relative file paths`); return; }
  if (promoteVia.length === 0) { out.push(`${ctx} must list at least one canonical target`); return; }
  const seen = new Set();
  for (const p of promoteVia) {
    if (!checkTargetPath(p, ctx, out)) continue;
    if (!refuseMoney(p, ctx, out)) continue;
    if (seen.has(p)) { out.push(`${ctx} lists ${p} twice`); continue; }
    seen.add(p);
    if (!exists(p)) out.push(`${ctx} target does not exist: ${p}`);
  }
}
