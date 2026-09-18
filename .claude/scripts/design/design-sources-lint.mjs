#!/usr/bin/env node
// design-sources-lint.mjs -- the gate on design.sources.yaml (REQ-04, ADR-1408 / ADR-1412).
//
// The registry is a PERMISSION surface: it says which external sources the curator may touch,
// for what, and at whose approval. That makes this lint gate-shaped rather than cosmetic, and
// it inherits this repo's rule that a gate ships with a negative control which actually fails.
//
// WHAT IT REFUSES, and why each one is a rule rather than a preference:
//
//   singular kind / allowed_use   Day-one facts falsified a singular grammar (21st.dev is
//                                 components AND generator). A string where an array belongs
//                                 reads as a one-element list to a careless consumer and as a
//                                 character sequence to a careful one.
//   unknown access / auth /       A closed enum that silently accepts a new value is not a
//   status / cost                 closed enum. ADR-1408 says a source the grammar cannot
//                                 express earns a schema BUMP, not a free-text column.
//   hand-set availability         status is owner intent, availability is what the last run
//                                 observed. Collapsing them lets a network failure look like a
//                                 policy decision, so a human writing it by hand is refused.
//   approved_by != owner          The lane-birth pattern. A machine that can add its own
//                                 permitted sources has no permission model.
//   an EMPTY registry             An empty result set is the one thing a broken reader and a
//                                 clean file agree on, and this lane has shipped that shape.
//
// Usage:  design-sources-lint.mjs [path]      (default: <repo>/design.sources.yaml)
// Exit:   0 clean | 1 findings or unreadable. Never 2.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

// The owner. Not a config knob: the whole point of approved_by is that the machine running this
// lint cannot widen it, so it is a constant here and a reviewed diff to change.
const OWNER = "ashiq";

const ACCESS = new Set(["mcp", "api", "browser", "fetch", "manual"]);
const AUTH = new Set(["none", "env", "oauth", "manual"]);
const STATUS = new Set(["active", "trial", "off"]);
const KIND = new Set(["inspiration", "generator", "components"]);
const USE = new Set(["reference-pack", "provenance", "link-only", "draft-variant"]);
// availability is written by the RUNNER. `unknown` is the only value a human may commit --
// anything else is a claim about an observation that did not happen here.
const AVAILABILITY_BY_HAND = new Set(["unknown"]);

const findings = [];
const fail = (id, code, msg) => findings.push(`ERR  [${code}] ${id}: ${msg}`);

const target = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, "design.sources.yaml");

if (!existsSync(target)) {
  // A missing registry is a NAMED refusal. Returning 0 here would make "no registry" and "a
  // clean registry" the same observable, which is the exact shape that lets a gate certify its
  // own absence.
  console.log(`ERR  [registry-missing] no registry at ${target} -- a permission surface that is absent is not a permission surface that is empty`);
  process.exit(1);
}

let text;
try { text = readFileSync(target, "utf8"); }
catch (e) { console.log(`ERR  [registry-unreadable] ${target}: ${e.code || e.message}`); process.exit(1); }

// Parse through the repo's OWN frozen subset, never a general YAML library. Two readers of one
// file drift the first time either is touched, and this file is consumed by the curator through
// the same parser -- so the lint must accept exactly what the consumer will.
let parseYamlSubset;
try {
  ({ parseYamlSubset } = await import(pathToFileURL(join(ROOT, ".claude", "scripts", "engine", "yaml-subset.mjs")).href));
} catch (e) {
  console.log(`ERR  [parser-missing] cannot load the repo yaml subset: ${e.message}`);
  process.exit(1);
}

const parsed = parseYamlSubset(text);
if (!parsed || parsed.ok === false) {
  const err = parsed && parsed.error ? JSON.stringify(parsed.error) : "unparseable";
  console.log(`ERR  [registry-unparseable] ${target}: ${err}`);
  process.exit(1);
}
const doc = parsed.doc ?? parsed.value ?? parsed;

const sources = doc && doc.sources;
if (!Array.isArray(sources) || sources.length === 0) {
  console.log("ERR  [registry-empty] the registry declares no sources -- an empty result set is the one thing a broken reader and a clean file agree on");
  process.exit(1);
}

const seen = new Set();
for (const s of sources) {
  const id = (s && s.id) || "<no id>";

  if (!s || typeof s !== "object") { fail(id, "entry-shape", "entry is not a mapping"); continue; }
  if (typeof s.id !== "string" || !s.id.trim()) fail(id, "id-missing", "every entry needs a string id");
  if (seen.has(s.id)) fail(id, "id-duplicate", "two entries share this id -- the registry is keyed by it");
  seen.add(s.id);

  // Arrays first, because every check after them reads a member.
  for (const [field, allowed] of [["kind", KIND], ["allowed_use", USE]]) {
    const v = s[field];
    if (!Array.isArray(v)) {
      fail(id, `${field}-not-array`, `${field} must be a block sequence, got ${v === undefined ? "nothing" : typeof v} -- a singular grammar was falsified on day one and arrays are load-bearing`);
      continue;
    }
    if (v.length === 0) fail(id, `${field}-empty`, `${field} is an empty list, which says nothing`);
    for (const m of v) if (!allowed.has(m)) fail(id, `${field}-unknown`, `${field} carries "${m}" -- the vocabulary is ${[...allowed].join(" / ")}`);
  }

  for (const [field, allowed] of [["access", ACCESS], ["auth", AUTH], ["status", STATUS]]) {
    const v = s[field];
    if (v === undefined) { fail(id, `${field}-missing`, `${field} is required`); continue; }
    if (!allowed.has(v)) fail(id, `${field}-unknown`, `${field}="${v}" is outside the closed set ${[...allowed].join(" / ")} -- a source the grammar cannot express earns a schema bump, not a new value`);
  }

  if (s.cost === undefined) fail(id, "cost-missing", "cost is required, even when it is free");

  if (s.availability === undefined) {
    fail(id, "availability-missing", "availability is required -- it is what the last run observed, and `unknown` is how a registry says no run has observed it yet");
  } else if (!AVAILABILITY_BY_HAND.has(s.availability)) {
    fail(id, "availability-hand-set", `availability="${s.availability}" was written by hand. It records what a RUN observed and is written by the runner; the only value a human may commit is "unknown". Collapsing status and availability lets a network failure look like a policy decision`);
  }

  if (s.approved_by === undefined) {
    fail(id, "approved-missing", "approved_by is required");
  } else if (s.approved_by !== OWNER) {
    fail(id, "approved-not-owner", `approved_by="${s.approved_by}" -- only the owner adds entries. A machine that can approve its own permitted sources has no permission model`);
  }

  if (s.added === undefined) fail(id, "added-missing", "added is required");

  // auth: env REQUIRES a credential_ref, or the entry says "authenticated" and names nothing.
  if (s.auth === "env" && (typeof s.credential_ref !== "string" || !s.credential_ref.trim())) {
    fail(id, "credential-ref-missing", 'auth="env" without a credential_ref names no secret to read');
  }
  // ...and the converse: a credential_ref on an unauthenticated source is a leftover, and a
  // leftover in a permission file is the kind of thing nobody re-reads.
  if (s.auth === "none" && s.credential_ref !== undefined) {
    fail(id, "credential-ref-orphan", 'auth="none" carries a credential_ref -- one of the two is stale');
  }

  // A source that may not be cached must not also claim the use that caches. link-only exists
  // precisely for Awwwards, whose terms forbid reproduction, and the curator reads this list
  // rather than a comment.
  if (Array.isArray(s.allowed_use) && s.allowed_use.includes("link-only") && s.allowed_use.includes("reference-pack")) {
    fail(id, "use-contradiction", "allowed_use carries both link-only and reference-pack -- one says cite but never cache, the other says cache");
  }
}

if (findings.length) {
  for (const f of findings) console.log(f);
  console.log(`design-sources-lint: ${findings.length} finding(s) in ${sources.length} source(s)`);
  process.exit(1);
}
console.log(`design-sources-lint: ok -- ${sources.length} source(s), ${sources.filter((s) => s.status === "active").length} active`);
process.exit(0);
