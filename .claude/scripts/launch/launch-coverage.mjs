#!/usr/bin/env node
// launch-coverage -- the derived counts (ADR-1712). Every number about the launch catalog comes from here; a count
// written in a plan is a seed this output overrides. Walkers are face-coverage's, not a third inventory.
//
//   node .claude/scripts/launch/launch-coverage.mjs [--require-core-vetted] [--catalog P] [--registry P] [--providers-dir D]
//
// --require-core-vetted exits 1 while any core slot has zero vetted providers (REQ-05, the Phase 05 close).
import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirNames } from "../core/face-coverage.mjs";
import { PATHS, loadCatalog, loadRegistry } from "./lib/catalog.mjs";

export function coverage({ catalog = PATHS.catalog, registry = PATHS.registry, providersDir = PATHS.providersDir } = {}) {
  const slots = loadCatalog(catalog);
  const rows = loadRegistry(registry);
  const tier = (t) => slots.filter((s) => s.tier === t);
  const core = tier("core");
  const rowsFor = (id) => rows.filter((r) => r.slot === id);
  const vettedFor = (id) => rowsFor(id).filter((r) => r.status === "vetted");
  const adapterDirs = existsSync(providersDir) ? dirNames(providersDir) : [];
  return {
    slots: slots.length,
    core: core.length,
    required: tier("required").length,
    optional: tier("optional").length,
    rows: rows.length,
    byStatus: Object.fromEntries(["candidate", "vetted", "retired", "blocked"].map((s) => [s, rows.filter((r) => r.status === s).length])),
    coreWithRow: core.filter((s) => rowsFor(s.id).length).length,
    coreZeroVetted: core.filter((s) => !vettedFor(s.id).length).map((s) => s.id),
    slotDirsWithAdapters: adapterDirs.length,
  };
}

function main(argv) {
  const o = {};
  let requireCore = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--require-core-vetted") { requireCore = true; continue; }
    const k = { "--catalog": "catalog", "--registry": "registry", "--providers-dir": "providersDir" }[argv[i]];
    if (!k || argv[i + 1] === undefined) { console.log(`launch-coverage: unknown or valueless flag ${argv[i]}`); return 2; }
    o[k] = resolve(argv[++i]);
  }
  const c = coverage(o);
  console.log(`launch-coverage: ${c.slots} slots (${c.core} core · ${c.required} required · ${c.optional} optional)`);
  console.log(`launch-coverage: ${c.rows} provider rows (${Object.entries(c.byStatus).map(([k, v]) => `${v} ${k}`).join(" · ")})`);
  console.log(`launch-coverage: core slots with a row ${c.coreWithRow}/${c.core} · core slots with zero vetted providers ${c.coreZeroVetted.length}/${c.core}`);
  console.log(`launch-coverage: slot dirs holding adapters ${c.slotDirsWithAdapters}`);
  if (requireCore && c.coreZeroVetted.length) {
    console.log(`launch-coverage: FAIL -- core slots with zero vetted providers: ${c.coreZeroVetted.join(", ")}`);
    return 1;
  }
  return 0;
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) process.exitCode = main(process.argv.slice(2));
