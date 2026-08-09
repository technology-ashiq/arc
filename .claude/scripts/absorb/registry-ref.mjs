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
const normKey = (k) => String(k).toLowerCase().replace(/[-_]/g, "");

// `lock_ref` is the ONE object the v1 checker never looked inside, which made it the obvious place
// to hide a copy: every lock-owned fact nested one level deeper passed clean. ADR-0600 fixes its
// shape at exactly {name, version}, so anything else in it is a copy or a mistake.
const LOCK_REF_KEYS = new Set(["name", "version"]);

const warnings = [];
const warn = (group, msg) => warnings.push(`WARN  [${group}] ${msg}`);

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

  for (const k of Object.keys(row)) {
    if (FORBIDDEN_NORMALISED.has(normKey(k))) {
      warn(
        "duplication",
        `${label}: carries "${k}", which belongs to capability-lock.json alone — reference the lock entry, never copy it (A5, REQ-04)`
      );
    }
  }

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

for (const w of warnings) console.log(w);
console.log(
  warnings.length === 0
    ? `registry-ref: 0 warnings (${rows.length} row${rows.length === 1 ? "" : "s"} checked against ${caps.length} lock entr${caps.length === 1 ? "y" : "ies"})`
    : `registry-ref: ${warnings.length} warning${warnings.length === 1 ? "" : "s"} [trial] — WARN-first, exit 0 by design (docs/trial-ledger.md)`
);
process.exit(0);
