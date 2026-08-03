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
 * Every module that declares an `evolve` section, with the metrics and per-arm floor the board
 * needs. Read from the manifests, never invented: a module with no section is simply not on the
 * board, which is different from a module whose metrics are all MISSING.
 */
function declaredModules(root) {
  const dir = join(root, "products");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const mf = join(dir, name, "manifest.json");
    if (!existsSync(mf)) continue;
    let obj;
    try { obj = JSON.parse(readFileSync(mf, "utf8")); } catch { continue; }
    if (!obj || typeof obj !== "object" || !obj.evolve) continue;
    out.push({
      name: obj.name ?? name,
      metrics: Array.isArray(obj.evolve.metrics) ? obj.evolve.metrics : [],
      per_arm_floor: obj.evolve.evals?.per_arm_floor,
    });
  }
  return out;
}

if (cmd !== "board") die("usage: arc-evolve board [--root DIR] [--now MS]");

const spine = flags.root ?? spineRoot();
const now = flags.now !== undefined ? Number(flags.now) : undefined;
if (flags.now !== undefined && !Number.isFinite(now)) die("--now must be epoch milliseconds");

try {
  const text = await board(spine, declaredModules(repoRoot()), now === undefined ? {} : { now });
  process.stdout.write(text.endsWith("\n") ? text : text + "\n");
  process.exit(0);
} catch (e) {
  process.stderr.write(`arc-evolve: ${e?.message ?? e}\n`);
  process.exit(2);
}
