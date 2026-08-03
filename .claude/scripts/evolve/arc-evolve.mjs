#!/usr/bin/env node
// arc-evolve -- the evolve CLI. `board` is its only subcommand this phase.
//
// Usage:
//   arc-evolve board [--root DIR] [--now MS]
//
// --now exists so a render is a pure function of its inputs: staleness is an age in days, and a
// wall clock would make two renders of the same spine differ. Tests and the replay-determinism
// check pin it; production omits it and gets the spine's own clock.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spineRoot } from "../hq/lib/spine-io.mjs";
import { checkEvolveSection } from "../core/evolve-manifest.mjs";
import { assertNoDuplicateKeys } from "../core/json-strict.mjs";
import { board } from "./board.mjs";

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) { die(`unexpected argument: ${a}`); }
  const eq = a.indexOf("=");
  const name = eq === -1 ? a.slice(2) : a.slice(2, eq);
  if (!["root", "now", "repo"].includes(name)) die(`unknown flag --${name}`);
  const val = eq === -1 ? argv[++i] : a.slice(eq + 1);
  if (val === undefined) die(`flag --${name} needs a value`);
  // Last-wins on a repeated flag is how `--now X --now 0` silently rendered every age as
  // -20660d. An operator who typed a flag twice meant one of them; guessing which is not this
  // tool's job.
  if (name in flags) die(`--${name} given twice`);
  if (val === "") die(`--${name} cannot be empty`);
  flags[name] = val;
}

function die(msg) { process.stderr.write(`arc-evolve: ${msg}\n`); process.exit(2); }

// Walk up to the directory that holds products/, rather than counting `..` segments — the same
// depth-independent resolution product-lint uses, and for the same reason.
function repoRoot() {
  if (flags.repo) return flags.repo;
  let d = fileURLToPath(new URL(".", import.meta.url));
  while (!existsSync(join(d, "products")) && dirname(d) !== d) d = dirname(d);
  return d;
}

/**
 * Every module that declares a VALID `evolve` section, with the metrics and per-arm floor the
 * board needs.
 *
 * The section is LINTED here, not merely parsed. The first version used a bare `JSON.parse`, so
 * a manifest the linter rejects with 47 findings still reached the renderer — and a newline
 * inside a metric name forged extra BASELINE rows, including a fabricated observation count and
 * a fabricated `module payments`. The board's header promises every figure is counted from
 * receipts or read from a manifest; that promise is only worth anything if the manifest had to
 * pass the same gate `product-lint` applies.
 *
 * An invalid section is REPORTED, not silently skipped: a module that vanishes from the board
 * reads as a module with nothing to say.
 */
function declaredModules(root) {
  const dir = join(root, "products");
  if (!existsSync(dir)) return { modules: [], rejected: [] };
  const modules = [];
  const rejected = [];
  for (const name of readdirSync(dir).sort()) {
    const mf = join(dir, name, "manifest.json");
    if (!existsSync(mf)) continue;
    const text = (() => { try { return readFileSync(mf, "utf8"); } catch { return null; } })();
    if (text === null) continue;
    try { assertNoDuplicateKeys(text, `products/${name}/manifest.json`); }
    catch (e) { rejected.push(`${name}: ${e.message}`); continue; }
    let obj;
    try { obj = JSON.parse(text); } catch (e) { rejected.push(`${name}: invalid JSON`); continue; }
    if (!obj || typeof obj !== "object" || !("evolve" in obj)) continue;
    const findings = checkEvolveSection(obj.evolve, `products/${name}`, { root });
    if (findings.length) { rejected.push(`${name}: ${findings.length} finding(s), first: ${findings[0]}`); continue; }
    modules.push({
      name: obj.name ?? name,
      metrics: obj.evolve.metrics,
      per_arm_floor: obj.evolve.evals?.per_arm_floor,
    });
  }
  return { modules, rejected };
}

if (cmd !== "board") die("usage: arc-evolve board [--root DIR] [--now MS]");

const spine = flags.root ?? spineRoot();
// A plain positive integer literal only. `Number.isFinite` alone accepted "0x10", " 12 " and
// "1e3", each of which rendered a confident but nonsensical age.
if (flags.now !== undefined && !/^[0-9]+$/.test(flags.now)) die("--now must be epoch milliseconds (a plain positive integer)");
const now = flags.now !== undefined ? Number(flags.now) : undefined;
if (now !== undefined && !Number.isSafeInteger(now)) die("--now is out of range");

try {
  const { modules, rejected } = declaredModules(repoRoot());
  const text = await board(spine, modules, now === undefined ? {} : { now });
  process.stdout.write(text.endsWith("\n") ? text : text + "\n");
  // Reported on stdout so it lands in the board's own record, not lost on a stderr nobody reads.
  for (const r of rejected) process.stdout.write(`REJECTED MANIFEST  ${r.replace(/[\p{Cc}\p{Cf}]/gu, "?")}\n`);
  process.exit(0);
} catch (e) {
  process.stderr.write(`arc-evolve: ${e?.message ?? e}\n`);
  process.exit(2);
}
