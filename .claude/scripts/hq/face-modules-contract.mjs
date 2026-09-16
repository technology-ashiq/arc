#!/usr/bin/env node
// face-modules-contract -- derives initiatives/face/contracts/modules-v2.json, the 36-module
// contract face v2 builds against, from the three files that already hold the facts. It is
// never typed by hand: `--check` fails when the committed contract drifts from its sources.
//
//   v0.7 rooms     docs/design/reference/face-hq/assets/arcface/src/hq/roomRegistry.js
//                  (ROOM_META rows + ROOM_ALIASES; read as text, because the file imports
//                  React icons and node cannot import it with no install)
//   served rooms   initiatives/face/contracts/rooms.generated.json   (ADR-1306: the truth)
//   planned reads  docs/strategy/plans/PLAN-face-v2.md section 5.2  (what each room expects
//                  to read; Phase 03's NOT SERVED lists, not this, decide Phase 04)
//
// A module always takes the SERVED id (ADR-1321). A v0.7 id that is not served becomes a
// module only through an alias that points at a served id, or when the row says extra
// (ADR-1327). Anything else is an orphan and the derivation refuses to write a contract.
//
// Usage: face-modules-contract.mjs [--root DIR] [--check]
// Exit:  0 written / in sync · 1 drift or orphan · 2 an input could not be read or parsed.
import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const PATHS = Object.freeze({
  registry: "docs/design/reference/face-hq/assets/arcface/src/hq/roomRegistry.js",
  served: "initiatives/face/contracts/rooms.generated.json",
  plan: "docs/strategy/plans/PLAN-face-v2.md",
  contract: "initiatives/face/contracts/modules-v2.json",
});

class InputError extends Error {}

/** ROOM_META rows and ROOM_ALIASES from the v0.7 registry source text. */
export function parseRegistry(text) {
  const start = text.indexOf("export const ROOM_META");
  const end = text.indexOf("export const ROOM_IDS");
  if (start < 0 || end < 0 || end < start) throw new InputError("roomRegistry.js: ROOM_META block not found");
  const rows = [];
  for (const line of text.slice(start, end).split(/\r?\n/)) {
    const id = line.match(/^\s*\{\s*id:\s*'([a-z0-9-]+)'/);
    if (!id) continue;
    const ring = line.match(/\bring:\s*'([a-z]+)'/);
    if (!ring) throw new InputError(`roomRegistry.js: room ${id[1]} has no ring`);
    rows.push({ id: id[1], ring: ring[1], extra: /\bextra:\s*true\b/.test(line), planned: /\bplanned:\s*true\b/.test(line) });
  }
  const al = text.match(/export const ROOM_ALIASES\s*=\s*\{([^}]*)\}/);
  if (!al) throw new InputError("roomRegistry.js: ROOM_ALIASES not found");
  const aliases = {};
  for (const m of al[1].matchAll(/'?([a-z0-9-]+)'?\s*:\s*'([a-z0-9-]+)'/g)) aliases[m[1]] = m[2];
  const ringOrder = (text.match(/export const RING_ORDER\s*=\s*\[([^\]]*)\]/) || [, ""])[1]
    .match(/'([a-z]+)'/g)?.map((s) => s.slice(1, -1)) || [];
  if (rows.length === 0) throw new InputError("roomRegistry.js: ROOM_META holds no rows");
  if (ringOrder.length === 0) throw new InputError("roomRegistry.js: RING_ORDER not found");
  return { rows, aliases, ringOrder };
}

/** Planned reads per v0.7 room id from PLAN-face-v2.md section 5.2's tables. */
export function parsePlannedReads(text) {
  const start = text.search(/^### 5\.2\b/m);
  const end = text.search(/^## 6\b/m);
  if (start < 0 || end < start) throw new InputError("PLAN-face-v2.md: section 5.2 not found");
  const reads = {};
  for (const line of text.slice(start, end).split(/\r?\n/)) {
    const cells = line.match(/^\|\s*`([a-z0-9-]+)`[^|]*\|([^|]*)\|/);
    if (!cells) continue;
    const out = [];
    let mark = null;
    for (const tok of cells[2].matchAll(/(✔|★|—)|`([^`]+)`/g)) {
      if (tok[1]) { mark = tok[1]; continue; }
      out.push({ route: tok[2], planned: mark === "★" ? "new" : "served" });
    }
    reads[cells[1]] = out;
  }
  return reads;
}

export function derive({ registryText, servedJson, planText }) {
  const { rows, aliases, ringOrder } = parseRegistry(registryText);
  const servedList = Array.isArray(servedJson) ? servedJson : servedJson.rooms;
  if (!Array.isArray(servedList) || servedList.length === 0) throw new InputError("rooms.generated.json: no rooms");
  const served = new Map(servedList.map((r) => [r.id, r]));
  const plannedReads = parsePlannedReads(planText);

  const modules = [];
  const orphans = [];
  const ringConflicts = [];
  const used = new Set();
  for (const row of rows) {
    let id = null;
    let alias = null;
    if (served.has(row.id)) id = row.id;
    else {
      const servedAlias = Object.keys(aliases).find((k) => aliases[k] === row.id && served.has(k));
      if (servedAlias) { id = servedAlias; alias = row.id; }
    }
    if (id === null && !row.extra) { orphans.push(row.id); continue; }
    const s = id === null ? null : served.get(id);
    let ring = row.ring;
    if (s && s.ring !== row.ring) { ringConflicts.push({ id, v07: row.ring, served: s.ring }); ring = s.ring; }
    const cls = s === null ? "extra" : s.status === "planned" ? "served-planned" : "served";
    modules.push({ id: id ?? row.id, alias, ring, class: cls, reads: plannedReads[row.id] ?? null });
    used.add(id ?? row.id);
  }
  const order = (r) => { const i = ringOrder.indexOf(r); return i < 0 ? ringOrder.length : i; };
  const indexed = modules.map((m, i) => [m, i]);
  indexed.sort((a, b) => order(a[0].ring) - order(b[0].ring) || a[1] - b[1]);
  const sorted = indexed.map(([m]) => m);

  const servedWithoutModule = servedList
    .filter((r) => !used.has(r.id))
    .map((r) => ({ id: r.id, status: r.status, ring: r.ring, renders: r.status === "template" ? "not a room module" : "generic module, reported" }));
  const count = (c) => sorted.filter((m) => m.class === c).length;
  return {
    orphans,
    contract: {
      $comment: "GENERATED by .claude/scripts/hq/face-modules-contract.mjs -- never hand-edit; run it to rewrite, --check fails drift (face v2 Phase 00, ADR-1321, ADR-1327).",
      sources: { registry: PATHS.registry, served: PATHS.served, plannedReads: PATHS.plan + " section 5.2" },
      counts: {
        modules: sorted.length,
        sameId: sorted.filter((m) => m.class !== "extra" && m.alias === null).length,
        renamed: sorted.filter((m) => m.alias !== null).length,
        extra: count("extra"),
        servedPlanned: count("served-planned"),
        served: servedList.length,
        servedWithoutModule: servedWithoutModule.length,
      },
      ringConflicts,
      modules: sorted,
      servedWithoutModule,
    },
  };
}

function readInput(root, rel) {
  const p = join(root, rel);
  if (!existsSync(p)) throw new InputError(`missing input: ${rel}`);
  return readFileSync(p, "utf8");
}

export function run(argv) {
  // Unknown flags and the `--flag=value` form are refused by name: a near-miss like `--chek`
  // or `--root=DIR` would otherwise fall through to a write, or to the current directory
  // (fixed-defects.md, process lifecycle and CLI).
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") { i++; continue; }
    if (a === "--check") continue;
    console.error(`face-modules-contract: unknown argument ${JSON.stringify(a)} (flags: --root DIR, --check)`);
    return 2;
  }
  const rootIdx = argv.indexOf("--root");
  const root = rootIdx >= 0 ? argv[rootIdx + 1] : process.cwd();
  if (rootIdx >= 0 && (!root || root.startsWith("--"))) { console.error("face-modules-contract: --root needs a directory"); return 2; }
  const check = argv.includes("--check");
  let result;
  try {
    let servedJson;
    try { servedJson = JSON.parse(readInput(root, PATHS.served)); }
    catch (e) { throw e instanceof InputError ? e : new InputError(`rooms.generated.json: ${e.message}`); }
    result = derive({ registryText: readInput(root, PATHS.registry), servedJson, planText: readInput(root, PATHS.plan) });
  } catch (e) {
    if (e instanceof InputError) { console.error(`face-modules-contract: ${e.message}`); return 2; }
    throw e;
  }
  if (result.orphans.length) {
    console.error(`face-modules-contract: ORPHAN v0.7 room(s) with no served id, no alias to one, and no extra flag: ${result.orphans.join(", ")}`);
    return 1;
  }
  const body = JSON.stringify(result.contract, null, 2) + "\n";
  const c = result.contract.counts;
  const summary = `${c.modules} modules = ${c.sameId} same-id + ${c.renamed} renamed + ${c.extra} extra (${c.servedPlanned} served-planned) · ${c.served} served, ${c.servedWithoutModule} without a module · ${result.contract.ringConflicts.length} ring conflict(s)`;
  const target = join(root, PATHS.contract);
  if (check) {
    const current = existsSync(target) ? readFileSync(target, "utf8").replace(/\r\n/g, "\n") : null;
    if (current !== body) {
      console.error(`face-modules-contract: DRIFT -- ${PATHS.contract} ${current === null ? "is missing" : "does not match its sources"}; rerun without --check`);
      console.error(`  derived: ${summary}`);
      return 1;
    }
    console.log(`face-modules-contract: in sync -- ${summary}`);
    return 0;
  }
  writeFileSync(target, body);
  console.log(`face-modules-contract: wrote ${PATHS.contract} -- ${summary}`);
  return 0;
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) process.exitCode = run(process.argv.slice(2));
