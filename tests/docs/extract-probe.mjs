// The wiki extractor, driven in-process (REQ-09, ADR-1501, pre-mortem 5).
//
// What the CLI alone cannot show:
//   1. PARITY -- wiki.json's per-type counts equal what face-coverage's treeWorld returns for
//      the same tree. The bats suite separately derives the same counts in shell, so a
//      treeWorld that returned nothing could not make both sides agree at zero.
//   2. UNREADABLE is never empty -- every fail-closed branch has a case only it decides: a
//      reader reporting `unreadable` (gates, ADR bands), an inventory that is not a list, and
//      a gate treeGates named that the second read cannot find.
//   3. An unknown treeWorld key is a decision, not a silence -- a new inventory the face gains
//      must make the extractor fail (code 1, naming the key) until the wiki decides about it.
//
//   node tests/docs/extract-probe.mjs <repo-root>
//
// Prints one line per check, then "extract-probe: ran N of N". Exit 0 all held | 1 otherwise.

import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DECLARED = 10;

const repo = process.argv[2];
if (!repo) { process.stderr.write("extract-probe: usage: extract-probe.mjs <repo-root>\n"); process.exitCode = 2; }
else await probe(repo);

async function probe(repo) {
  const { treeWorld, treeAdrBands } = await import(pathToFileURL(join(repo, ".claude", "scripts", "core", "face-coverage.mjs")).href);
  const wb = await import(pathToFileURL(join(repo, ".claude", "scripts", "docs", "wiki-build.mjs")).href);

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

  // 2. every fail-closed branch, one case each
  const r2 = await wb.extract(repo, { ...world, gates: { unreadable: "probe: arc.gates.yaml made unreadable", names: [] } });
  check("an unreadable gates reader is code 2 naming it", r2.code === 2 && /gates/.test(r2.message || ""), `code=${r2.code} msg=${r2.message}`);
  const r2b = await wb.extract(repo, world, { bands: { unreadable: "probe: docs/adr made unreadable", names: [] } });
  check("an unreadable ADR-band reader is code 2 naming it", r2b.code === 2 && /adrBands/.test(r2b.message || ""), `code=${r2b.code} msg=${r2b.message}`);
  const r2c = await wb.extract(repo, { ...world, lanes: { names: world.lanes } });
  check("a non-list inventory is code 2 naming it", r2c.code === 2 && /lanes/.test(r2c.message || ""), `code=${r2c.code} msg=${r2c.message}`);
  const r2d = await wb.extract(repo, { ...world, gates: { names: [...world.gates.names, "zzz-probe-ghost-gate"] } });
  check("a gate on zero rows is code 2 naming it", r2d.code === 2 && /zzz-probe-ghost-gate/.test(r2d.message || ""), `code=${r2d.code} msg=${r2d.message}`);

  // 3. an unmapped key fails, naming it
  const r3 = await wb.extract(repo, { ...world, zzzProbeInventory: { names: ["x"] } });
  check("an unmapped treeWorld key is code 1 naming it", r3.code === 1 && /zzzProbeInventory/.test(r3.message || ""), `code=${r3.code} msg=${r3.message}`);

  // 4. the two lists partition: no key is in both
  const both = wb.RENDERED.filter((k) => wb.NOT_RENDERED.includes(k));
  check("RENDERED and NOT_RENDERED share no key", both.length === 0, both.join(","));

  // 5. serialisation is byte-stable
  check("serialize() is deterministic", wb.serialize(clean.wiki) === wb.serialize((await wb.extract(repo, world)).wiki));

  process.stdout.write(`extract-probe: ran ${ran} of ${DECLARED}\n`);
  process.exitCode = failed === 0 && ran === DECLARED ? 0 : 1;
}
