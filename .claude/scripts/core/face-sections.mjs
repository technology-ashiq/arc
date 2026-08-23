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

// ---------- the room registry (Phase 04/06: what the generic renderer reads) ----------
// Two halves, kept in two files on purpose. expected-set.json is FROZEN and answers "what
// does this room hold"; room-copy.json is authored and answers "what does it SAY and how
// does it render". Merging them here means the renderer reads ONE artifact and neither half
// is ever hand-copied into the other -- the same discipline as the face: sections above.
//
// The inversion is the point: the contract maps thing -> room, and a renderer needs
// room -> things. Deriving that inverse here rather than authoring it is what stops a
// renamed room from silently emptying a screen.
function invert(map, pick) {
  const out = {};
  for (const [k, v] of Object.entries(map || {})) {
    const room = pick(v);
    if (typeof room !== "string" || !room) continue;
    (out[room] = out[room] || []).push(k);
  }
  for (const k of Object.keys(out)) out[k].sort();
  return out;
}

export function roomRegistry(contract, copy) {
  const tpl = contract.rooms?.template;
  const rows = [...(contract.rooms?.list || []), ...(tpl ? [tpl] : [])];
  // face-coverage catches a duplicate id; this generator did not, and an adversarial pass
  // showed it emitting a 34-room registry carrying `today` TWICE with `--check` exiting 0.
  // Two gates over one contract, one of them blind: the twin-fix shape between files.
  const seenIds = new Set();
  for (const r of rows) {
    if (seenIds.has(r.id)) throw new Error(`room "${r.id}" appears twice -- a duplicate id makes one of the two unreachable, and which one is undefined`);
    seenIds.add(r.id);
  }
  const copyRooms = copy?.rooms || {};

  // A `*`-prefixed home is a legitimate non-room home (e.g. `*decide-zones`) and is skipped,
  // exactly as face-coverage skips it. A kind can be homed in several rooms; each gets it.
  const kindsBy = {};
  for (const [k, v] of Object.entries(contract.kinds?.map || {}))
    for (const h of v.homes || []) {
      // BRACES. The original was a single-statement for-body; adding a second statement to it
      // without them put the push OUTSIDE the loop, so every kind stopped being collected and
      // `ops` -- a room with exactly one homed kind -- became "derives no content". The
      // generator's own empty-room guard caught it immediately, which is the guard working.
      //
      // `*name` is a legitimate NON-ROOM home (e.g. `*decide-zones`). A bare `*`, or a `*`
      // with nothing readable after it, is not a home at all -- and `homes: ["*"]` on every
      // one of the 46 kinds produced zero findings while every kind rendered in no room.
      if (typeof h === "string" && h.startsWith("*") && h.trim().length < 2)
        throw new Error(`kind "${k}" is homed in "${h}" -- a bare "*" names nothing; a non-room home must say which non-room`);
      if (typeof h === "string" && !h.startsWith("*")) (kindsBy[h] = kindsBy[h] || []).push(k);
    }
  for (const k of Object.keys(kindsBy)) kindsBy[k].sort();

  const byRoom = {
    lanes: invert(contract.lanes?.map, (v) => v),
    products: invert(contract.products?.map, (v) => v),
    commands: invert(contract.commands?.map, (v) => v),
    agents: invert(contract.agents?.map, (v) => v),
    gates: invert(contract.gates?.map, (v) => v),
    hooks: invert(contract.hooks?.map, (v) => v),
    rules: invert(contract.rules?.map, (v) => v),
    lints: invert(contract.lints?.map, (v) => v),
    processes: invert(contract.processes?.map, (v) => v),
    concepts: invert(contract.concepts?.map, (v) => v && v.room),
  };

  const rooms = rows.map((r) => {
    const c = copyRooms[r.id];
    if (!c) throw new Error(`room "${r.id}" has no entry in room-copy.json -- a room with no sentence is a room nobody designed`);
    if (typeof c.sentence !== "string" || !c.sentence.trim())
      throw new Error(`room "${r.id}" has no sentence -- every room opens with one, that is the whole pattern`);
    if (!["bespoke", "generic", "index"].includes(c.render))
      throw new Error(`room "${r.id}" declares render "${c.render}" -- must be bespoke, generic or index`);
    // A room with no NAME passed every gate, and the registry emitted a row with no `name`
    // key at all -- so the rail, the Map's labels and every accessible name rendered blank.
    // `sentence` and `render` were validated and the one thing a person actually reads was
    // not. Found by an adversarial pass that deleted it and watched three gates stay green.
    if (typeof r.name !== "string" || !r.name.trim())
      throw new Error(`room "${r.id}" has no name -- the rail, the Map and every accessible name render it, and a blank one is a room nobody can point at`);

    const holds = {};
    let count = kindsBy[r.id] ? kindsBy[r.id].length : 0;
    if (kindsBy[r.id]) holds.kinds = kindsBy[r.id];
    for (const [inv, m] of Object.entries(byRoom))
      if (m[r.id]) { holds[inv] = m[r.id]; count += m[r.id].length; }

    // Stations come from the concepts anchored here -- the same derivation the face:
    // sections use, so a room and its product manifest can never disagree about them.
    const stations = [...new Set(Object.entries(contract.concepts?.map || {})
      .filter(([, v]) => v && v.room === r.id).map(([, v]) => v.station))].sort();

    // An INDEX room renders a whole inventory rather than a slice, because nothing in the
    // contract maps TO it. Without this, `org` and `concepts` derive zero items and a
    // generic renderer would draw two convincing empty rooms -- worse than two missing ones,
    // because a missing room is honest. The measurement that found it: every other room
    // derives at least one item; these two derive none, and neither is a mistake.
    if (c.render === "index") {
      if (!c.indexes || !Object.prototype.hasOwnProperty.call(contract, c.indexes))
        throw new Error(`room "${r.id}" is an index room over "${c.indexes}", which is not an inventory in the contract`);
      count = Object.keys(contract[c.indexes]?.map || {}).length;
    } else if (count === 0) {
      throw new Error(`room "${r.id}" derives no content and is not an index room -- it would render empty and look built`);
    }

    return {
      id: r.id,
      name: r.name,
      ring: r.ring,
      status: r.status || (c.template ? "template" : "built"),
      sentence: c.sentence,
      lede: c.lede || "",
      render: c.render,
      ...(c.indexes ? { indexes: c.indexes } : {}),
      ...(c.planned ? { planned: true } : {}),
      ...(c.template ? { template: true } : {}),
      ...(c.source ? { copySource: c.source } : {}),
      stations,
      holds,
      itemCount: count,
    };
  });

  return {
    $comment: "GENERATED by face-sections.mjs from expected-set.json (frozen, structural) + room-copy.json (authored). Do not hand-edit: --check turns an edit into a named CI failure.",
    version: "1.0.0",
    rings: contract.rings || [],
    rooms,
  };
}

function registryPath(repo) { return join(repo, "initiatives", "face", "contracts", "rooms.generated.json"); }
function loadCopy(repo) {
  const p = join(repo, "initiatives", "face", "contracts", "room-copy.json");
  if (!existsSync(p)) throw new Error(`room-copy.json not found at ${p} -- the authored half of the registry`);
  return JSON.parse(readFileSync(p, "utf8"));
}

function run(repo, check, quiet = false) {
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

  // The room registry travels with the sections: same inputs, same drift rule. Building it
  // in the same pass is deliberate -- two generators over one contract is how the second one
  // ends up a cycle behind, which is the exact defect ADR-1306 was written for.
  const wantRegistry = roomRegistry(contract, loadCopy(repo));
  const rpath = registryPath(repo);
  const registryText = JSON.stringify(wantRegistry, null, 2) + "\n";
  const registryDrifted = !existsSync(rpath) || readFileSync(rpath, "utf8") !== registryText;

  if (check) {
    if (registryDrifted)
      drift.push("rooms.generated.json");
    if (drift.length) {
      if (quiet) return 1;
      for (const p of drift) {
        if (p === "rooms.generated.json")
          process.stderr.write(`FAIL  [face-registry-drift] initiatives/face/contracts/rooms.generated.json is not what the contract + room-copy.json derive -- run face-sections.mjs (never hand-edit it)\n`);
        else
          process.stderr.write(`FAIL  [face-section-drift] products/${p}/manifest.json's face: section is not what the contract derives -- run face-sections.mjs (never hand-edit the section)\n`);
      }
      process.stderr.write(`face-sections: ${drift.length} artifact(s) drifted from the contract\n`);
      return 1;
    }
    if (quiet) return 0;
    process.stdout.write(`face-sections: every face: section matches the contract (${mapped} mapped, ${skipped} unmapped by design); registry in sync (${wantRegistry.rooms.length} rooms)\n`);
    return 0;
  }
  if (registryDrifted) writeFileSync(rpath, registryText);
  process.stdout.write(`face-sections: wrote ${written} section(s); ${skipped} product(s) carry none by design; registry ${registryDrifted ? "written" : "unchanged"} (${wantRegistry.rooms.length} rooms)\n`);
  return 0;
}

// ---------- the mutant self-test (the negative control) ----------
// A generator that cannot be shown to REFUSE bad input is a generator that will one day
// emit a plausible artifact from a broken contract, and the drift gate will then pin the
// breakage as canonical. Every guard in roomRegistry gets an arm; an arm that stops firing
// because someone deleted the guard is the whole point of having it here.
function selftest(repo) {
  const contract = loadContract(repo);
  const copy = loadCopy(repo);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const firstRoom = contract.rooms.list[0].id;

  const refuses = (label, mutate, needle) => {
    const c = clone(contract), k = clone(copy);
    mutate(c, k);
    let msg = null;
    try { roomRegistry(c, k); } catch (e) { msg = e.message; }
    const ok = msg !== null && msg.includes(needle);
    return [label, ok, msg];
  };

  const arms = [
    refuses("room absent from room-copy", (c, k) => { delete k.rooms[firstRoom]; }, "no entry in room-copy"),
    refuses("room with a blank sentence", (c, k) => { k.rooms[firstRoom].sentence = "   "; }, "no sentence"),
    refuses("room with an unknown render mode", (c, k) => { k.rooms[firstRoom].render = "fancy"; }, "must be bespoke, generic or index"),
    refuses("index room over a non-inventory", (c, k) => { k.rooms.concepts.indexes = "ghost-inventory"; }, "not an inventory"),
    // The arm that matters most: the empty-room class. Strip everything that points at a
    // generic room and it must REFUSE, not emit a room that renders blank and looks built.
    refuses("generic room deriving nothing", (c) => {
      for (const inv of ["lanes", "products", "commands", "agents", "gates", "hooks", "rules", "lints", "processes", "concepts"])
        for (const key of Object.keys(c[inv]?.map || {}))
          if ((inv === "concepts" ? c[inv].map[key]?.room : c[inv].map[key]) === "leads") delete c[inv].map[key];
      for (const key of Object.keys(c.kinds?.map || {}))
        c.kinds.map[key].homes = (c.kinds.map[key].homes || []).filter((h) => h !== "leads");
    }, "would render empty and look built"),
  ];

  // The drift arm: a hand-edited registry must make --check exit 1, not warn.
  const rpath = registryPath(repo);
  const before = existsSync(rpath) ? readFileSync(rpath, "utf8") : null;
  let driftExit = null;
  try {
    writeFileSync(rpath, (before || "{}").replace(/"version": "1\.0\.0"/, '"version": "9.9.9"'));
    // Quiet: this arm EXPECTS the failure, and a passing negative control must not print the
    // word "FAIL" into a transcript other checks read for exactly that word.
    driftExit = run(repo, true, true);
  } finally {
    if (before !== null) writeFileSync(rpath, before);
  }

  let ok = true;
  for (const [label, passed, msg] of arms) {
    if (!passed) ok = false;
    process.stdout.write(`mutant ${label.padEnd(32)} refused: ${passed ? "PASS" : "FAIL" + (msg ? " (message: " + msg + ")" : " (no throw)")}\n`);
  }
  const driftOk = driftExit === 1;
  if (!driftOk) ok = false;
  process.stdout.write(`hand-edited registry exits 1:            ${driftOk ? "PASS" : "FAIL (got " + driftExit + ")"}\n`);
  process.stdout.write(`face-sections selftest: ${ok ? "PASS -- refuses every broken input, and drift fails closed" : "FAIL"}\n`);
  return ok ? 0 : 1;
}

const KNOWN_FLAGS = ["--check", "--selftest"];

/**
 * Refuse an argument this gate does not know.
 *
 * `argv.includes("--check")` means every near-miss silently selects the WRITE path and exits
 * 0. An adversarial pass ran `--check=true`, `--Check`, `--checks` and `--dry-run` against a
 * drifted tree: each one repaired the drift and reported success. On `face-tokens` that
 * silently discarded a hand-edit to the app's entire stylesheet.
 *
 * It matters more than it looks. The only correct spellings in existence are the literals in
 * tests/*.bats -- any future hook, workflow line or pre-commit that types it slightly
 * differently gets a green light AND a mutated working tree. An unrecognised `--` argument is
 * exit 2: could not read the inputs, which is exactly what it is.
 *
 * @param {string[]} argv @param {string[]} known
 */
function refuseUnknownFlags(argv, known) {
  const bad = argv.filter((a) => a.startsWith("--") && !known.includes(a));
  if (bad.length) {
    process.stderr.write(`face-sections: unknown flag(s) ${bad.join(", ")} -- known flags are ${known.join(", ")}. Refusing rather than silently taking the write path.
`);
    process.exit(2);
  }
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  refuseUnknownFlags(argv, KNOWN_FLAGS);
  const repo = argv.find((a) => !a.startsWith("--")) || REPO_DEFAULT;
  try {
    process.exit(argv.includes("--selftest") ? selftest(repo) : run(repo, argv.includes("--check")));
  } catch (err) { process.stderr.write(`face-sections: ERROR -- ${err.message}\n`); process.exit(2); }
}
