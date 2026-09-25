// The wiki extractor, driven in-process (REQ-09, ADR-1501, pre-mortem 5).
//
// Three things the CLI alone cannot show:
//   1. PARITY -- wiki.json's per-type counts equal what face-coverage's treeWorld returns for
//      the same tree. The bats suite separately derives the same counts in shell, so a
//      treeWorld that returned nothing could not make both sides agree at zero.
//   2. UNREADABLE is never empty -- a reader that reports `unreadable` must make the extractor
//      fail (code 2, naming the reader), not print a 0 that matches another 0.
//   3. An unknown treeWorld key is a decision, not a silence -- a new inventory the face gains
//      must make the extractor fail (code 1, naming the key) until the wiki says whether it
//      renders it.
//
//   node tests/docs/extract-probe.mjs <repo-root>
//
// Prints one line per check, then "extract-probe: ran N of N". Exit 0 all held | 1 otherwise.

import { join } from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.argv[2];
if (!repo) { process.stderr.write("extract-probe: usage: extract-probe.mjs <repo-root>\n"); process.exit(2); }

const { treeWorld, treeAdrBands } = await import(pathToFileURL(join(repo, ".claude", "scripts", "core", "face-coverage.mjs")).href);
const wb = await import(pathToFileURL(join(repo, ".claude", "scripts", "docs", "wiki-build.mjs")).href);

const DECLARED = 7;
let ran = 0, failed = 0;
const check = (label, cond, detail = "") => {
  ran++;
  if (cond) process.stdout.write(`ok    ${label}\n`);
  else { failed++; process.stdout.write(`FAIL  ${label}${detail ? ` -- ${detail}` : ""}\n`); }
};

const world = await treeWorld(repo);
const clean = await wb.extract(repo, world);
check("clean tree extracts with code 0", clean.code === 0, clean.message);

// 1. parity, all eight types
const want = {
  products: world.products.length,
  lanes: world.lanes.length,
  processes: world.processes.length,
  adrBands: (await treeAdrBands(repo)).names.length,
  commands: world.commands.length,
  agents: world.agents.length,
  rules: world.rules.length,
  gates: world.gates.names.length,
};
const got = Object.fromEntries(Object.keys(want).map((k) => [k, clean.wiki?.entities?.[k]?.length]));
check("per-type counts equal treeWorld for all eight types", JSON.stringify(got) === JSON.stringify(want), `want ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
check("every type is non-empty on the real tree", Object.values(got).every((n) => n > 0), JSON.stringify(got));

// 2. an unreadable reader fails closed, naming it
const broken = { ...world, gates: { unreadable: "probe: arc.gates.yaml made unreadable", names: [] } };
const r2 = await wb.extract(repo, broken);
check("an unreadable reader is code 2, not an empty list", r2.code === 2 && /gates/.test(r2.message || ""), `code=${r2.code} msg=${r2.message}`);

// 3. an unmapped key fails, naming it
const grown = { ...world, zzzProbeInventory: { names: ["x"] } };
const r3 = await wb.extract(repo, grown);
check("an unmapped treeWorld key is code 1 naming it", r3.code === 1 && /zzzProbeInventory/.test(r3.message || ""), `code=${r3.code} msg=${r3.message}`);

// 4. the two lists partition every key treeWorld returns today -- no key is in both
const both = wb.RENDERED.filter((k) => wb.NOT_RENDERED.includes(k));
check("RENDERED and NOT_RENDERED share no key", both.length === 0, both.join(","));

// 5. serialisation is byte-stable
check("serialize() is deterministic", wb.serialize(clean.wiki) === wb.serialize((await wb.extract(repo, world)).wiki));

process.stdout.write(`extract-probe: ran ${ran} of ${DECLARED}\n`);
process.exitCode = failed === 0 && ran === DECLARED ? 0 : 1;
