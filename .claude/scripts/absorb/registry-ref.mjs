#!/usr/bin/env node
// registry-ref.mjs -- the ONE thing absorb asserts about develop's lock (ADR-0600, ABS-A / A5).
//
// A registry row references a lock entry by name + version and asserts only that the pair resolves
// to exactly one row in `capabilities[]`. It carries no hash, no publisher-auth, no class, no
// provenance -- those live in the lock alone.
//
// WHY THE CLAIM IS THIS WEAK, and it is deliberate: Phase 00's DEV-B/C audit found that
// `capability-lock.json` has NO declared schema -- no JSON Schema, no $comment contract, no
// validator. "Required field" is inferred behaviour, not a published contract
// (initiatives/absorb/evidence/phase-00/dev-bc-audit.md FINDING 1.1). So a stronger assertion
// would be asserting against a contract that does not exist. Resolution is what is actually
// available, and pretending otherwise would be the plan's own "evidence over assertion" inverted.
//
// WARN-first in TRIAL, same contract as report-lint: exit 0 on any registry it could read, one
// WARN line per defect, promotion via /arc-retro against docs/trial-ledger.md.
//
// Exit codes:
//   0  both files were read and judged (with or without warnings)
//   2  usage error, or a file missing/unparseable. NOT a verdict about the registry.

import { readFileSync } from "node:fs";

// Fields that live in the lock and must NEVER be copied onto a registry row (A5, REQ-04).
//
// Matched on a NORMALISED key: lowercased with `-` and `_` removed. The Phase 01 adversarial pass
// walked past the v1 list with `Hash` (capital), `sha256` and `integrity` (synonyms), and `registry`
// and `checked` (lock-owned fields the list never named at all). A denylist of exact lowercase
// spellings is a denylist of the spellings its author happened to think of.
const FORBIDDEN_NORMALISED = new Set([
  "hash", "sha256", "sha512", "integrity", "checksum", "digest",
  "publisherauth", "buildattestation", "attestation", "provenance",
  "class", "registry", "checked",
]);
const normKey = (k) => String(k).normalize("NFKC").toLowerCase().replace(/[-_\s.]/g, "");
// The exact set above is the spellings we thought of, and the adversarial pass walked past it TWICE
// -- first with `Hash`/`sha256`/`integrity`, then with `hash `/`sha1`/`fingerprint`/`tarball`. A
// pattern backs the list so a new synonym is caught by shape rather than by enumeration.
const FORBIDDEN_PATTERN = /sha\d|hash|checksum|digest|integrity|signat|fingerprint|attest|provenance|tarball|publisher/;
const isForbiddenKey = (k) => { const n = normKey(k); return FORBIDDEN_NORMALISED.has(n) || FORBIDDEN_PATTERN.test(n); };

// F2 (CRITICAL): lock-owned data nested under ANY key was invisible -- the nesting bypass was closed
// for `lock_ref` and left open for every other object, which is the twin-fix shape this lane has now
// hit three times. A `pin: { hash, publisher-auth, class }` object passed completely clean. So the
// walk is RECURSIVE, over objects and array elements, and it reports the JSON path.
function forbiddenPaths(value, trail = [], out = []) {
  if (value === null || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => forbiddenPaths(v, trail.concat(`[${i}]`), out));
    return out;
  }
  for (const [k, v] of Object.entries(value)) {
    const here = trail.concat(k);
    if (isForbiddenKey(k)) out.push({ key: k, path: here.join(".") });
    forbiddenPaths(v, here, out);
  }
  return out;
}

// `lock_ref` is the ONE object the v1 checker never looked inside, which made it the obvious place
// to hide a copy: every lock-owned fact nested one level deeper passed clean. ADR-0600 fixes its
// shape at exactly {name, version}, so anything else in it is a copy or a mistake.
const LOCK_REF_KEYS = new Set(["name", "version"]);

const STATUSES = new Set(["candidate", "trial", "adopted", "retired"]);
const ADOPTED_CAP = 12; // ADR-0600 / REQ-04, counted PER LANE

const warnings = [];
const warn = (group, msg) => warnings.push(`WARN  [${group}] ${msg}`);
const seenIds = new Set();
const adopted = [];
const displacers = [];

const die = (msg) => {
  console.error(`registry-ref: ${msg}`);
  process.exit(2);
};

const [registryPath, lockPath] = process.argv.slice(2);
if (!registryPath || !lockPath) {
  die("usage: node registry-ref.mjs REGISTRY_PATH LOCK_PATH");
}

const readJson = (p, what) => {
  let raw;
  try {
    raw = readFileSync(p, "utf8");
  } catch (e) {
    die(`cannot read ${what} at ${p}: ${e.code || e.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    die(`${what} at ${p} is not valid JSON: ${e.message}`);
  }
};

const registry = readJson(registryPath, "registry");
const lock = readJson(lockPath, "lock");

// Shape guards. A missing array is a usage-level problem rather than a row-level warning: there is
// nothing to judge, and reporting "0 warnings" over an unreadable structure would be the silent
// pass this repo has shipped before.
const rows = registry && registry.techniques;
if (!Array.isArray(rows)) die(`registry at ${registryPath} has no "techniques" array`);

const caps = lock && lock.capabilities;
if (!Array.isArray(caps)) die(`lock at ${lockPath} has no "capabilities" array`);

// ---------- resolve every lock_ref ----------
for (let i = 0; i < rows.length; i++) {
  const raw = rows[i];

  // A non-object row is not a row. v1 did `rows[i] || {}`, so a techniques array of strings, numbers
  // or nulls was counted as "checked" and never judged -- reported as a clean verdict, which is the
  // silent pass this file's own header says it exists to prevent.
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    warn("shape", `row ${i + 1}: not an object (${raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw}) -- a registry row must be an object, so this row was not judged`);
    continue;
  }
  const row = raw;
  const label = typeof row.id === "string" && row.id ? row.id : `row ${i + 1} (no id)`;

  for (const hit of forbiddenPaths(row)) {
    warn(
      "duplication",
      `${label}: carries "${hit.key}" at ${hit.path}, which belongs to capability-lock.json alone — reference the lock entry, never copy it, at ANY depth (A5, REQ-04)`
    );
  }

  // ---------- row shape and status lifecycle (Phase 02, REQ-04 / REQ-07) ----------
  if (typeof row.id !== "string" || !/^T-\d{2,}$/.test(row.id || "")) {
    warn("shape", `${label}: id must be T-NN form (zero-padded), it is what every other warning names`);
  } else if (seenIds.has(row.id)) {
    warn("shape", `${row.id}: duplicate id -- ids are unique within the registry`);
  } else {
    seenIds.add(row.id);
  }

  const status = row.status;
  if (!STATUSES.has(status)) {
    warn("status", `${label}: status ${JSON.stringify(status)} is not one of ${[...STATUSES].join(" | ")}`);
  }
  // The cap is counted per lane, so the lane STRING is load-bearing. 14 adopted rows cycling
  // "absorb" / "absorb " / "Absorb" / Cyrillic-a reported ZERO warnings, because byLane keyed on the
  // raw string. Rather than normalise three ways, validate against the grammar that already exists
  // in .claude/rules/lanes.md -- that closes trim, case and Unicode in one assertion.
  if (typeof row.lane !== "string" || !row.lane) {
    warn("shape", `${label}: no lane -- the cap of ${ADOPTED_CAP} is counted PER LANE, so a row with no lane is uncountable`);
  } else if (!/^[a-z][a-z0-9-]*$/.test(row.lane) || row.lane.length > 64) {
    warn("shape", `${label}: lane ${JSON.stringify(row.lane)} breaks the lane grammar in .claude/rules/lanes.md ([a-z][a-z0-9-]*, 64 max) -- a lane that differs only by case, whitespace or a lookalike character makes the cap of ${ADOPTED_CAP} uncountable`);
  }
  if (row.review_by !== undefined && row.review_by !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(row.review_by))) {
    warn("shape", `${label}: review_by "${row.review_by}" is not an ISO date`);
  }

  // REQ-07, both directions: nothing adopts or retires itself. A transition into either terminal
  // status needs a decision.recorded reference, and the harness offers no path that writes them.
  const refs = (row.decision_refs && typeof row.decision_refs === "object" && !Array.isArray(row.decision_refs)) ? row.decision_refs : {};
  const plausibleRef = (v) => typeof v === "string" && /^[0-9A-HJKMNP-TV-Z]{26}$|[/.]/.test(v);
  for (const which of ["adopt", "retire"]) {
    if (refs[which] !== undefined && !plausibleRef(refs[which])) {
      warn("decision-ref", `${label}: decision_refs.${which} is ${JSON.stringify(refs[which])} -- a decision reference is a ULID or a path, and "nothing adopts itself" is not satisfied by a truthy value`);
    }
  }
  if (status === "adopted" && !refs.adopt) {
    warn("decision-ref", `${label}: status adopted with no decision_refs.adopt -- adoption ends in the inbox with the owner's reason, and nothing adopts itself (REQ-07)`);
  }
  if (status === "retired" && !refs.retire) {
    warn("decision-ref", `${label}: status retired with no decision_refs.retire -- retirement is proposed too, in the same direction (REQ-07)`);
  }
  if (status === "adopted" || status === "retired") {
    if (!row.classification_ref) {
      warn("shape", `${label}: status ${status} with no classification_ref -- a technique cannot be adopted or retired without the report that classified it`);
    }
    if (!row.evidence || (Array.isArray(row.evidence) && row.evidence.length === 0)) {
      warn("evidence", `${label}: status ${status} with no evidence -- REQ-03 requires the A/B results to travel WITH the proposal`);
    }
  }
  if (status === "adopted") adopted.push(row);
  if (row.displaces !== undefined && row.displaces !== null) displacers.push(row);

  const ref = row.lock_ref;
  if (ref === undefined || ref === null) continue; // nullable: a technique need not be executable

  if (typeof ref !== "object" || Array.isArray(ref)) {
    warn("lock-ref", `${label}: lock_ref must be an object with name and version`);
    continue;
  }

  // The nesting bypass, closed: lock_ref is {name, version} and nothing else.
  for (const k of Object.keys(ref)) {
    if (!LOCK_REF_KEYS.has(k)) {
      warn(
        "duplication",
        `${label}: lock_ref carries "${k}" — its shape is exactly {name, version} (ADR-0600), and anything else is a copy of lock-owned data nested one level deeper (A5, REQ-04)`
      );
    }
  }

  const { name, version } = ref;
  if (!name || !version) {
    warn(
      "lock-ref",
      `${label}: lock_ref needs both name and version (found name=${JSON.stringify(name)}, version=${JSON.stringify(version)})`
    );
    continue;
  }

  const hits = caps.filter((c) => c && c.name === name && c.version === version);
  if (hits.length === 0) {
    warn(
      "lock-ref",
      `${label}: lock_ref ${name}@${version} resolves to no row in ${lockPath} — an unresolvable reference is not a pin`
    );
  } else if (hits.length > 1) {
    warn("lock-ref", `${label}: lock_ref ${name}@${version} resolves to ${hits.length} rows — the lock has duplicates`);
  }
}

// ---------- the cap and its displacement rule (REQ-04) ----------
// The anti-hoarding control. It is countable only because the registry is ONE file with a lane on
// every row (A5, ADR-0600) -- per-lane forks would have made the cap unenforceable, which is why
// forking it was refused rather than merely discouraged.
{
  const byLane = new Map();
  for (const r of adopted) {
    const lane = typeof r.lane === "string" && r.lane ? r.lane : "(no lane)";
    byLane.set(lane, (byLane.get(lane) || 0) + 1);
  }
  for (const [lane, n] of byLane) {
    if (n > ADOPTED_CAP) {
      warn("cap", `lane "${lane}" holds ${n} adopted techniques, over the cap of ${ADOPTED_CAP} -- a new adoption at the cap names its displacement and the retire proposal rides with it`);
    } else if (n === ADOPTED_CAP) {
      warn("cap", `lane "${lane}" is AT the cap of ${ADOPTED_CAP} -- the next adoption must name what it displaces`);
    }
  }

  // A displacement must point at something real, and at something actually retired. A `displaces`
  // naming a row that is still adopted is the cap being satisfied on paper only.
  const byId = new Map();
  for (const r of rows) if (r && typeof r === "object" && !Array.isArray(r) && typeof r.id === "string") byId.set(r.id, r);
  const claimed = new Set();
  for (const r of displacers) {
    const key = String(r.displaces);
    if (claimed.has(key)) {
      warn("cap", `${r.id || "a row"}: displaces "${key}", which another row already claims -- one retirement frees ONE slot, and three adoptions naming it is the cap satisfied on paper only`);
    }
    claimed.add(key);
    const target = byId.get(key);
    if (!target) {
      warn("cap", `${r.id || "a row"}: displaces "${r.displaces}", which is not a row in this registry`);
    } else if (target.status !== "retired") {
      warn("cap", `${r.id || "a row"}: displaces "${r.displaces}", whose status is "${target.status}" rather than retired -- a displacement that retires nothing does not free a slot`);
    }
  }
}

for (const w of warnings) console.log(w);
console.log(
  warnings.length === 0
    ? `registry-ref: 0 warnings (${rows.length} row${rows.length === 1 ? "" : "s"} checked against ${caps.length} lock entr${caps.length === 1 ? "y" : "ies"})`
    : `registry-ref: ${warnings.length} warning${warnings.length === 1 ? "" : "s"} [trial] — WARN-first, exit 0 by design (docs/trial-ledger.md)`
);
process.exit(0);
