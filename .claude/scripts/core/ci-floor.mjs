#!/usr/bin/env node
/**
 * ci-floor.mjs -- the test-count floor, derived (ci ADR-2202). Replaces the hand-typed 911 in ci.yml.
 *
 *   node .claude/scripts/core/ci-floor.mjs [--root DIR] [--baseline N]
 *
 * declared = every `@test` line in tests/**\/*.bats (the `_declared` regex the bats shards reconcile
 * against) + every tests/<lane>/.count. floor = BASELINE - drop rows, where a drop row is a table
 * row `| <old name> | DROPPED | <reason> |` in tests/DROPPED.md or any tests/<lane>/MIGRATED.md.
 * There is no shared count file, so parallel lane PRs never conflict on a number.
 *
 * Exit: 0 declared >= floor · 1 below the floor · 2 a malformed .count or drop row, or bad usage.
 */
import { readFileSync, readdirSync, existsSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const BASELINE = 4827; // main ca9a1b93 + the ASCII guard moved into ci-gate.bats; drops: 2 REQ-11 + 13 REQ-07, 2026-10-24
const DECLARED = /^[ \t]*@test[ \t]/;
const DROP_ROW = /^\|([^|]*)\|\s*DROPPED\s*\|([^|]*)\|/;

class Malformed extends Error {}

// Symlinks are not followed, the same as the shards' `find tests -name '*.bats'`: one enumeration, so
// the floor counts exactly the files the shards run, and a link cycle cannot recurse (attack B7, L2).
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

export function floor({ root, baseline = BASELINE }) {
  const tests = join(root, "tests");
  if (!existsSync(tests)) throw new Malformed(`no tests/ under ${root}`);
  const files = walk(tests);
  let declared = 0;
  let drops = 0;
  const dropped = new Set(); // one name buys one slot, however often it is listed (attack r2 B6)
  for (const f of files) {
    const rel = relative(tests, f).split("\\").join("/");
    if (f.endsWith(".bats")) {
      for (const l of readFileSync(f, "utf8").split("\n")) if (DECLARED.test(l)) declared++;
    } else if (/^[^/]+\/\.count$/.test(rel)) {
      const body = readFileSync(f, "utf8");
      if (!/^\d+\r?\n$/.test(body)) throw new Malformed(`bad .count: tests/${rel}`);
      declared += Number(body.trim());
    } else if (rel === "DROPPED.md" || /^[^/]+\/MIGRATED\.md$/.test(rel)) {
      for (const l of readFileSync(f, "utf8").split("\n")) {
        const m = l.trim().match(DROP_ROW); // not RegExp.exec: arc-js-child-process-shell reads any .exec(var) as a shell call
        if (!m) continue;
        if (m[1].trim() === "" || m[2].trim() === "") throw new Malformed(`drop row without a name or reason in tests/${rel}: ${l.trim()}`);
        if (dropped.has(m[1].trim())) throw new Malformed(`test dropped twice: "${m[1].trim()}" (tests/${rel})`);
        dropped.add(m[1].trim());
        drops++;
      }
    }
  }
  return { declared, floor: baseline - drops, drops };
}

function main(argv) {
  let root = process.cwd();
  let baseline = BASELINE;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if ((a === "--root" || a === "--baseline") && (v === undefined || v === "" || v.startsWith("--"))) {
      console.log(`ci-floor: ${a} needs a value`); return 2;
    }
    if (a === "--root") { root = v; i++; }
    else if (a === "--baseline") {
      if (!/^\d+$/.test(v)) { console.log(`ci-floor: --baseline must be a whole number, got ${v}`); return 2; }
      baseline = Number(v); i++;
    } else { console.log(`ci-floor: unknown argument ${a}`); return 2; }
  }
  let r;
  try { r = floor({ root, baseline }); }
  catch (e) { if (e instanceof Malformed) { console.log(`ci-floor: ${e.message}`); return 2; } throw e; }
  const why = r.drops ? ` (${baseline} - ${r.drops} dropped)` : "";
  if (r.declared < r.floor) { console.log(`::error::test count ${r.declared} < floor ${r.floor}${why}`); return 1; }
  if (r.declared > r.floor) console.log(`test count ${r.declared} > floor ${r.floor}${why}: raise BASELINE to ${r.declared + r.drops}`);
  else console.log(`test count ${r.declared} = floor ${r.floor}${why}`);
  return 0;
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return null; } })() : null;
if (invoked === self) process.exitCode = main(process.argv.slice(2));
