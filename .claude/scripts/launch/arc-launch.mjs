#!/usr/bin/env node
// arc launch -- turn a venture.yaml into a receipted board, one slot at a time (ADR-1723: the CLI is the contract).
//
//   arc-launch new   --venture SLUG [--venture-root D]
//   arc-launch apply SLOT --venture SLUG --venture-root D [--provider ID] [--vet]
//
//   path overrides (fixtures): --catalog P --registry P --providers-dir D --ventures-dir D --state-dir D
//
// Exit: 0 done/no-op · 1 slot failed · 2 refused · 3 lock held by a live apply · 4 unmet dependencies ·
//       5 awaiting the owner's approval. Phase 01 adds plan · verify · status · teardown --plan.
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LaunchError, loadCatalog, loadProfile, resolveBoard } from "./lib/catalog.mjs";
import { emptyState, loadState, saveState, setSlot } from "./lib/state.mjs";
import { apply, resolvePaths, EXIT } from "./lib/runner.mjs";

const VALUE_FLAGS = {
  "--venture": "venture", "--venture-root": "ventureRoot", "--provider": "provider", "--catalog": "catalog",
  "--registry": "registry", "--providers-dir": "providersDir", "--ventures-dir": "venturesDir", "--state-dir": "stateDir",
};

export function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--vet") { o.vet = true; continue; }
    if (VALUE_FLAGS[a]) {
      const v = argv[i + 1];
      if (v === undefined || v === "" || v.startsWith("--")) throw new LaunchError("BAD_ARGS", `${a} needs a value`);
      if (o[VALUE_FLAGS[a]] !== undefined) throw new LaunchError("BAD_ARGS", `${a} given twice`);
      o[VALUE_FLAGS[a]] = v;
      i++;
      continue;
    }
    if (a.startsWith("--")) throw new LaunchError("BAD_ARGS", `unknown flag ${a}`);
    o._.push(a);
  }
  return o;
}

function cmdNew(o) {
  const P = resolvePaths(o);
  const profile = loadProfile(o.venture, P.venturesDir);
  const board = resolveBoard(loadCatalog(P.catalog), profile);
  let state = loadState(P.stateDir, profile.slug, { onFallback: console.log });
  const fresh = !state;
  if (fresh) {
    state = emptyState(profile);
    if (o.ventureRoot) state.venture_root = resolve(o.ventureRoot);
    for (const [id, b] of board) setSlot(state, id, b.applies ? { state: "pending" } : { state: "skipped", reason: b.reason });
    state = saveState(P.stateDir, state);
  }
  const rows = [...board.values()];
  const n = (pred) => rows.filter(pred).length;
  console.log(`${profile.slug} (${profile.honesty_class}) -- board ${fresh ? "created" : "exists, unchanged"}`);
  console.log(`  ${rows.length} slots: ${n((b) => b.slot.tier === "core")} core · ${n((b) => b.slot.tier === "required")} required · ${n((b) => b.slot.tier === "optional")} optional`);
  console.log(`  applies to this venture: ${n((b) => b.applies)} · skipped: ${n((b) => !b.applies)}`);
  return EXIT.OK;
}

export async function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.log(e.message); return EXIT.REFUSED; }
  const [verb, slot] = o._;
  if (!o.venture) { console.log("--venture SLUG is required"); return EXIT.REFUSED; }
  try {
    if (verb === "new") return cmdNew(o);
    if (verb === "apply") {
      if (!slot) { console.log("apply needs a SLOT"); return EXIT.REFUSED; }
      return await apply({ ...o, slot });
    }
  } catch (e) {
    if (e instanceof LaunchError) { console.log(e.message); return EXIT.REFUSED; }
    throw e;
  }
  console.log(`unknown verb ${verb ?? "(none)"} -- new | apply`);
  return EXIT.REFUSED;
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) process.exitCode = await main(process.argv.slice(2));
