#!/usr/bin/env node
/**
 * arc-bench.mjs -- the bench runner (lane `bench`, ADR-0901).
 *
 * Phase 00 lands the ASSERTION SUBSTRATE here (slice 04). The CLI, the fixture-repo harness
 * and the steel thread arrive in later slices; this file is deliberately importable so its
 * scoring is unit-testable without spawning anything.
 *
 * WHY THE SUBSTRATE EXISTS AT ALL (ADR-0905): BEN-G pins v1 quality to "assertion pass-rate,
 * nothing more", and at kickoff NOT ONE fixture in the repo carried an assertion. The only
 * scoring that existed was `expected` validated against the process output schema
 * (arc-run.mjs:184-186), so schema pass-rate and assertion pass-rate -- which REQ-01 requires
 * to stay separate -- would have collapsed onto the same single number.
 */

import { readFileSync } from "node:fs";

/**
 * The CLOSED op set (ADR-0905 / M5). Deterministic by construction: no op may call a model,
 * read the clock, or touch the network -- that is the "deterministic checks only"
 * non-negotiable, enforced here at the registry rather than trusted to fixture authors.
 *
 * Each entry declares how to validate its `value` so a malformed assertion is REFUSED rather
 * than coerced. `absent` takes NO value at all: a value there means the author meant something
 * other than "this path must not exist", and guessing which is how a fixture ends up asserting
 * a rule nobody wrote.
 */
export const OPS = Object.freeze({
  equals: {
    needsValue: true,
    validate: (v) => (typeof v === "object" && v !== null ? "must be a scalar" : null),
    run: (actual, v) => actual === v,
  },
  matches: {
    needsValue: true,
    validate: (v) => {
      if (typeof v !== "string") return "must be a string regex";
      try { new RegExp(v); return null; } catch (e) { return `is not a valid regex (${e.message})`; }
    },
    run: (actual, v) => typeof actual === "string" && new RegExp(v).test(actual),
  },
  contains: {
    needsValue: true,
    validate: (v) => (typeof v === "object" && v !== null ? "must be a scalar" : null),
    run: (actual, v) =>
      typeof actual === "string" ? actual.includes(String(v)) : Array.isArray(actual) ? actual.includes(v) : false,
  },
  absent: {
    needsValue: false,
    validate: () => null,
    run: (actual) => actual === MISSING,
  },
  length_between: {
    needsValue: true,
    validate: (v) =>
      Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n))
        ? v[0] <= v[1] ? null : "must be [MIN, MAX] with MIN <= MAX"
        : "must be [MIN, MAX], two integers",
    run: (actual, v) => {
      const len = typeof actual === "string" || Array.isArray(actual) ? actual.length : null;
      return len !== null && len >= v[0] && len <= v[1];
    },
  },
});

/** Distinguishes "the path resolved to undefined" from "the path did not resolve". */
export const MISSING = Symbol("missing");

/**
 * Dot-path resolution with numeric indices (M4): `commits.0.subject`. No JSONPath, no
 * wildcards, no filters -- a path language grows into an expression language, and an
 * expression language in a fixture is a program nobody reviews.
 */
export function resolvePath(doc, path) {
  if (typeof path !== "string" || path.length === 0) return MISSING;
  let cur = doc;
  for (const seg of path.split(".")) {
    if (cur === null || typeof cur !== "object") return MISSING;
    const key = /^\d+$/.test(seg) ? Number(seg) : seg;
    if (Array.isArray(cur)) {
      if (typeof key !== "number" || key < 0 || key >= cur.length) return MISSING;
    } else if (!Object.prototype.hasOwnProperty.call(cur, key)) {
      return MISSING;
    }
    cur = cur[key];
  }
  return cur === undefined ? MISSING : cur;
}

/**
 * Validate one assertion's SHAPE. Returns an error string, or null when it is well-formed.
 * An unknown op is REFUSED here and never skipped: a scorer that silently skipped what it did
 * not understand would report 100% assertion pass-rate on a fixture that checked nothing, and
 * `regex` is a plausible near-miss for `matches` that a fixture author will eventually write.
 */
export function validateAssertion(a, where = "assertion") {
  if (a === null || typeof a !== "object" || Array.isArray(a)) return `${where}: must be an object`;
  if (typeof a.id !== "string" || !a.id) return `${where}: needs a non-empty string id`;
  const spec = Object.prototype.hasOwnProperty.call(OPS, a.op) ? OPS[a.op] : null;
  if (!spec) return `${where} (${a.id}): unknown op "${a.op}" -- the closed set is ${Object.keys(OPS).join(", ")}`;
  if (typeof a.path !== "string" || !a.path) return `${where} (${a.id}): needs a non-empty string path`;
  const hasValue = Object.prototype.hasOwnProperty.call(a, "value");
  if (spec.needsValue && !hasValue) return `${where} (${a.id}): op "${a.op}" requires a value`;
  if (!spec.needsValue && hasValue) return `${where} (${a.id}): op "${a.op}" takes no value`;
  if (spec.needsValue) {
    const why = spec.validate(a.value);
    if (why) return `${where} (${a.id}): value ${why}`;
  }
  return null;
}

/**
 * Score one fixture's assertions against a produced document.
 *
 * The zero-denominator rule is the load-bearing part (ADR-0905). A fixture with NO assertions
 * contributes 0 to the denominator and is never counted as a pass, and the reported rate is
 * ABSENT rather than 100%. retro-log 2026-07-30: a pass condition defined as an absence let
 * compliant characterless work pass five runs running -- here, treating "no assertions" as
 * "all passed" would make adding no assertions the cheapest way to look perfect.
 */
export function scoreAssertions(doc, assertions, where = "fixture") {
  if (assertions === undefined) return { total: 0, passed: 0, rate: null, results: [] };
  if (!Array.isArray(assertions)) throw new Error(`${where}: assertions must be a list`);

  const seen = new Set();
  const results = [];
  for (const [i, a] of assertions.entries()) {
    const why = validateAssertion(a, `${where}[${i}]`);
    if (why) throw new Error(why);
    if (seen.has(a.id)) throw new Error(`${where}: duplicate assertion id "${a.id}"`);
    seen.add(a.id);
    const actual = resolvePath(doc, a.path);
    // A path that does not resolve FAILS the assertion rather than erroring (M4) -- except for
    // `absent`, whose whole question is whether it resolved.
    const pass = OPS[a.op].run(actual, a.value);
    results.push({ id: a.id, op: a.op, path: a.path, pass });
  }
  const passed = results.filter((r) => r.pass).length;
  return { total: results.length, passed, rate: results.length ? passed / results.length : null, results };
}

/**
 * Read an eval pack manifest. It lives in a sibling `pack.json` rather than in the process
 * YAML because `process-lint.mjs:65-67` freezes that file's top-level keys and changing them
 * is engine territory (ADR-0902's scope fence).
 */
export function readPack(path) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`pack ${path} does not parse: ${String(e.message).split("\n")[0]}`);
  }
  if (typeof doc?.revision !== "string" || !doc.revision) throw new Error(`pack ${path}: needs a non-empty string revision`);
  if (typeof doc?.task_class !== "string" || !doc.task_class) throw new Error(`pack ${path}: needs a non-empty string task_class`);
  return { revision: doc.revision, task_class: doc.task_class };
}

/** BEN-D's per-class floor. A class below it proposes nothing, and the reason names the count. */
export const MIN_FIXTURES = 5;

export function coverageVerdict(taskClass, fixtureCount) {
  return fixtureCount >= MIN_FIXTURES
    ? { eligible: true, reason: null }
    : { eligible: false, reason: `NO PROPOSAL - evidence insufficient (${fixtureCount} of ${MIN_FIXTURES} fixtures)` };
}
