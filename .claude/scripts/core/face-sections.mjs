#!/usr/bin/env node
// face-sections -- write each product manifest's `face:` section FROM the frozen contract
// (ADR-1306 birth-rule; Phase 05). Generation rather than hand-authoring is the point: the
// room list, the kind->home map and the concept glossary already live in
// initiatives/face/contracts/expected-set.json, and a hand-copied second spelling of them
// in sixteen manifests is a guaranteed drift -- the same shape as a doc-copied count.
//
//   face-sections.mjs [repo-root] [--check]
//
// --check writes nothing and exits 1 if any manifest's `face:` differs from what the
// contract says it should be. That is the CI-safe form: it turns "someone hand-edited a
// section" into a named failure instead of a silent divergence.
//
// Exit: 0 in sync / written | 1 drift (with --check) | 2 could not read the inputs.

import { readFileSync, writeFileSync, existsSync, readdirSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * "Was this file RUN, or imported?" -- realpath on BOTH sides.
 *
 * The cheap `endsWith` form silently answers NO behind a symlink or a renamed copy: an
 * adversarial pass copied this gate to another filename, pointed it at a tree with three
 * real gaps, and got a silent exit 0. A gate that no-ops under a different spelling is
 * worse than no gate. Same fix as arc-event.mjs -- grep the pattern, not the file.
 */
function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}


const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");

// The product -> room map lives in the CONTRACT, not here. It used to be sixteen
// hand-authored rows in this file -- a second spelling of the room map, which is precisely
// what ADR-1306 exists to prevent, and an adversarial pass named it: change a row here and
// the sanctioned regenerate makes the drift permanent and green. Now there is one spelling.
function productRoom(contract, product) {
  const map = contract.products?.map || {};
  return Object.prototype.hasOwnProperty.call(map, product) ? map[product] : undefined;
}
function loadContract(repo) {
  const p = join(repo, "initiatives", "face", "contracts", "expected-set.json");
  if (!existsSync(p)) throw new Error(`expected-set.json not found at ${p}`);
  return JSON.parse(readFileSync(p, "utf8"));
}

/** The section a given product SHOULD carry, derived entirely from the contract. */
export function sectionFor(product, contract) {
  const room = productRoom(contract, product);
  if (!room) return null;
  // The TEMPLATE room ("lane") is a first-class home, not a missing one: it is the 6-zone
  // shell every born lane instantiates (ADR-1306), so it lives under rooms.template rather
  // than in the list of named rooms. Looking only at the list refused a legitimate mapping.
  const tpl = contract.rooms?.template;
  const roomRow = (contract.rooms?.list || []).find((r) => r.id === room)
    || (tpl && tpl.id === room ? tpl : null);
  if (!roomRow) throw new Error(`product "${product}" maps to room "${room}", which the contract does not list`);

  // Kinds whose typed home includes this room -- read off the kind map rather than
  // restated, so a kind that changes rooms moves here automatically.
  const kinds = Object.entries(contract.kinds?.map || {})
    .filter(([, v]) => (v.homes || []).includes(room))
    .map(([k]) => k)
    .sort();

  // Concepts anchored in this room, likewise derived.
  const concepts = Object.entries(contract.concepts?.map || {})
    .filter(([, v]) => v.room === room)
    .map(([term]) => term)
    .sort();

  // Stations: the concept anchors give the vocabulary; the room's own sources give the
  // reads. v1 declares the SHAPE (ADR-1304) -- the full station chain per line is the Map
  // phase's work, and declaring an invented chain here would be worse than declaring none.
  const stations = [...new Set(Object.entries(contract.concepts?.map || {})
    .filter(([, v]) => v.room === room)
    .map(([, v]) => v.station))].sort();

  return {
    room,
    ring: roomRow.ring,
    kinds,
    sanctioned: roomRow.sources || [],
    stations,
    concepts,
    ...(roomRow.badge ? { badge: roomRow.badge } : {}),
  };
}

function run(repo, check) {
  const contract = loadContract(repo);
  const productsDir = join(repo, "products");
  const drift = [];
  let written = 0, skipped = 0, mapped = 0;

  for (const product of readdirSync(productsDir).sort()) {
    const mpath = join(productsDir, product, "manifest.json");
    if (!existsSync(mpath)) continue;
    const want = sectionFor(product, contract);
    if (want === null) { skipped++; continue; }
    mapped++;

    const text = readFileSync(mpath, "utf8");
    const manifest = JSON.parse(text);
    const have = manifest.face;
    if (JSON.stringify(have) === JSON.stringify(want)) continue;

    if (check) { drift.push(product); continue; }
    manifest.face = want;
    writeFileSync(mpath, JSON.stringify(manifest, null, 2) + "\n");
    written++;
  }

  if (check) {
    if (drift.length) {
      for (const p of drift) process.stderr.write(`FAIL  [face-section-drift] products/${p}/manifest.json's face: section is not what the contract derives -- run face-sections.mjs (never hand-edit the section)\n`);
      process.stderr.write(`face-sections: ${drift.length} manifest(s) drifted from the contract\n`);
      return 1;
    }
    process.stdout.write(`face-sections: every face: section matches the contract (${mapped} mapped, ${skipped} unmapped by design)\n`);
    return 0;
  }
  process.stdout.write(`face-sections: wrote ${written} section(s); ${skipped} product(s) carry none by design\n`);
  return 0;
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  const repo = argv.find((a) => !a.startsWith("--")) || REPO_DEFAULT;
  try { process.exit(run(repo, argv.includes("--check"))); }
  catch (err) { process.stderr.write(`face-sections: ERROR -- ${err.message}\n`); process.exit(2); }
}
