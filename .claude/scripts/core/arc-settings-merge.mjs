#!/usr/bin/env node
/**
 * arc-settings-merge.mjs — preserve a consumer's settings.json across an arc sync.
 *
 * Found by dogfooding into a real consumer (Phase 04, 2026-07-19): the sync copied
 * `.claude/settings.json` wholesale, so a target's `coverageMode: warn` / `docsGate: warn`
 * were silently deleted and their gates flipped to block. arc's own `//profile` doc string
 * in that very file tells users to add those keys — and the next sync removed them.
 *
 * Ownership rule this encodes:
 *   arc owns the machinery — hooks, statusLine, permissions it ships, its own `//` guidance.
 *   the consumer owns their `arc` block values, their extra permission entries, and any
 *   top-level key arc does not ship.
 *
 * Usage:
 *   node arc-settings-merge.mjs <arc-settings.json> <consumer-settings.json>
 *     stdout: merged JSON   ·   stderr: a "preserved ..." report (report before mutate)
 * Exit: 0 ok · 2 unparseable input (emits NOTHING — never a half-merged settings file) · 1 usage.
 *
 * Runs under the twins the same way the registry does (ADR-0015): node does the thinking,
 * the .ps1 stays a dumb caller.
 */
import { readFileSync, existsSync } from "node:fs";

const [arcPath, consumerPath] = process.argv.slice(2);
if (!arcPath) {
  process.stderr.write("usage: arc-settings-merge.mjs <arc-settings.json> <consumer-settings.json>\n");
  process.exit(1);
}

const parse = (p, label) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    // Fail closed. A settings file is machinery for every hook in the target; emitting a
    // partial one is worse than emitting none, so stdout stays empty and the caller aborts.
    process.stderr.write(`arc-settings-merge: ${label} settings invalid or unreadable (${p}): ${e.message}\n`);
    process.exit(2);
  }
};

const arc = parse(arcPath, "arc");

// Fresh install: nothing of the consumer's to protect.
if (!consumerPath || !existsSync(consumerPath)) {
  process.stderr.write("arc-settings-merge: no existing consumer settings — writing arc's version\n");
  process.stdout.write(JSON.stringify(arc, null, 2) + "\n");
  process.exit(0);
}

const consumer = parse(consumerPath, "consumer");
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const preserved = [];
const out = { ...arc };

// 1. Top-level keys only the consumer has — theirs, arc has no opinion.
for (const k of Object.keys(consumer)) {
  if (!(k in arc)) {
    out[k] = consumer[k];
    preserved.push(k);
  }
}

// 2. The `arc` block — consumer values win. `//` keys are arc's own guidance and are always
//    refreshed, or a consumer would stay pinned to whatever the docs said the day they installed.
if (isObj(consumer.arc)) {
  const merged = { ...(isObj(arc.arc) ? arc.arc : {}) };
  for (const [k, v] of Object.entries(consumer.arc)) {
    if (k.startsWith("//")) continue;
    if (JSON.stringify(merged[k]) !== JSON.stringify(v)) preserved.push(`arc.${k}`);
    merged[k] = v;
  }
  out.arc = merged;
}

// 3. permissions lists — UNION, never a replacement. A consumer's allowlist entry is a
//    decision they made about their own machine; sync has no business dropping it.
if (isObj(consumer.permissions)) {
  const p = { ...(isObj(arc.permissions) ? arc.permissions : {}) };
  for (const list of ["allow", "deny", "ask"]) {
    const mine = Array.isArray(p[list]) ? p[list] : [];
    const theirs = Array.isArray(consumer.permissions[list]) ? consumer.permissions[list] : [];
    const extra = theirs.filter((x) => !mine.includes(x));
    if (extra.length) preserved.push(`permissions.${list}[+${extra.length}]`);
    if (mine.length || theirs.length) p[list] = [...mine, ...extra];
  }
  for (const k of Object.keys(consumer.permissions)) {
    if (!(k in p)) {
      p[k] = consumer.permissions[k];
      preserved.push(`permissions.${k}`);
    }
  }
  out.permissions = p;
}

process.stderr.write(
  preserved.length
    ? `arc-settings-merge: preserved ${preserved.length} consumer setting(s): ${preserved.join(", ")}\n`
    : "arc-settings-merge: no consumer customisations to preserve\n"
);
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
