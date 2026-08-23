// The POSITIVE CONTROL for the seven world-derived inventories (ADR-1317).
//
// face-coverage's selftest mutates a gathered data object -- it injects a ghost name into
// `clean.gates.names` and asserts a finding appears. That proves the CHECK works. It proves
// nothing at all about the READER: a mutant that made `treeGates` return `{ names: [] }`
// passes every one of those arms, and the gate would then report "all covered" for a file it
// never opened. That is the vacuous-pass shape in .claude/rules/testing.md, one layer down --
// the assertion holds while the code that matters never ran.
//
// So this drives the readers against REAL FILES in a temp tree: write a source, read it back,
// and assert the thing that was written comes out. Then break the file and assert the reader
// reports it as UNREADABLE rather than as empty.
//
// No install, no build, no bats -- same contract as the rest of tests/face/.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");

const {
  treeGates, treeJobs, treeVentures, treeAdrBands, treePlans, treeCapabilities, treePlannedRooms, treeCi,
} = await import(pathToFileURL(join(REPO, ".claude", "scripts", "core", "face-coverage.mjs")).href);

let ran = 0, failed = 0;
const check = (label, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${label}${detail ? " -- " + detail : ""}`); }
  else console.log(`ok ${label}`);
};

// A temp tree carrying only what the readers need. The real repo is never written to: a
// control that damages the thing it is checking is not a control (face-tokens learned that
// one by leaving a corrupted stylesheet on disk while exiting 0).
const tree = mkdtempSync(join(tmpdir(), "coverage-readers-"));
const put = (rel, text) => {
  const p = join(tree, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
};

// The readers parse YAML through the engine's frozen subset, so the real parser has to be
// present in the temp tree -- copied, never re-implemented (ADR-0200: arc never grows a
// second YAML parser class).
const parserRel = join(".claude", "scripts", "engine", "yaml-subset.mjs");
mkdirSync(join(tree, dirname(parserRel)), { recursive: true });
cpSync(join(REPO, parserRel), join(tree, parserRel));
check("the temp tree carries the canonical YAML parser", existsSync(join(tree, parserRel)));

try {
  // ---- gates -------------------------------------------------------------------------
  put("arc.gates.yaml", "gates:\n  - name: alpha\n    mode: block\n  - name: beta\n    mode: warn\n");
  let g = await treeGates(tree);
  check("treeGates reads the names out of the FILE", JSON.stringify(g.names) === '["alpha","beta"]', JSON.stringify(g));
  // The arm that matters: grow the file, and the reader must grow with it. This is the
  // "arc grew and nobody updated a list" case the whole phase exists for.
  put("arc.gates.yaml", "gates:\n  - name: alpha\n    mode: block\n  - name: beta\n    mode: warn\n  - name: gamma\n    mode: off\n");
  g = await treeGates(tree);
  check("a gate ADDED to the file appears in the reader", g.names.includes("gamma"), JSON.stringify(g.names));

  // ---- jobs --------------------------------------------------------------------------
  put("hq.jobs.yaml", "version: 1\njobs:\n  - name: nightly\n    type: script\n  - name: weekly\n    type: script\n");
  const j = await treeJobs(tree);
  check("treeJobs reads job names out of the FILE", JSON.stringify(j.names) === '["nightly","weekly"]', JSON.stringify(j));

  // ---- ventures ----------------------------------------------------------------------
  // A MAP keyed by id, not a list. Reading it as a list would produce an empty inventory
  // that PASSES -- the silent-zero failure, on the file that carries the kill lines.
  put("ventures.yaml", "version: 1\nventures:\n  alpha:\n    kill:\n      days_without_revenue: 90\n  beta:\n    kill:\n      days_without_revenue: 30\n");
  const v = await treeVentures(tree);
  check("treeVentures reads a MAP keyed by venture id", JSON.stringify(v.names) === '["alpha","beta"]', JSON.stringify(v));

  // ---- ADR bands ---------------------------------------------------------------------
  put(join("docs", "adr", "0001-first.md"), "#\n");
  put(join("docs", "adr", "0099-still-band-zero.md"), "#\n");
  put(join("docs", "adr", "1317-a-later-band.md"), "#\n");
  put(join("docs", "adr", "README.md"), "not an ADR\n");
  const a = treeAdrBands(tree);
  check("treeAdrBands groups by century, not by file", JSON.stringify(a.names) === '["0000","1300"]', JSON.stringify(a.names));
  check("and counts the FILES separately from the bands", a.fileCount === 3, `fileCount=${a.fileCount}`);
  check("a non-ADR markdown file is not counted", !a.names.includes("REAG"), JSON.stringify(a.names));

  // ---- plans -------------------------------------------------------------------------
  put(join("docs", "strategy", "plans", "PLAN-alpha.md"), "#\n");
  put(join("docs", "strategy", "plans", "BRIEF-beta.md"), "#\n");
  // The directory's own index is not a plan. Without the prefix test the Strategy room drew a
  // chip called "README" beside twenty-four real plans -- a room showing the owner its
  // filesystem instead of his company. Caught by opening the page, not by reading the code.
  put(join("docs", "strategy", "plans", "README.md"), "# the plan pack\n");
  const p = treePlans(tree);
  check("treePlans reads plan stems out of the DIRECTORY", JSON.stringify(p.names.sort()) === '["BRIEF-beta","PLAN-alpha"]', JSON.stringify(p.names));
  check("and the directory index is not homed as a plan", !p.names.includes("README"), JSON.stringify(p.names));

  // ---- capabilities ------------------------------------------------------------------
  mkdirSync(join(tree, ".claude", "skills", "ghost-skill"), { recursive: true });
  mkdirSync(join(tree, "docker", "ghost-image"), { recursive: true });
  put(".mcp.json", JSON.stringify({ mcpServers: { alpha: {}, beta: {} } }));
  const c = treeCapabilities(tree);
  check("treeCapabilities finds a skill", c.names.includes("skill:ghost-skill"), JSON.stringify(c.names));
  check("and an MCP server", c.names.includes("mcp:alpha") && c.names.includes("mcp:beta"), JSON.stringify(c.names));
  check("and a pinned image", c.names.includes("image:ghost-image"), JSON.stringify(c.names));
  // Namespaced on purpose: a skill and an MCP server can share a name, and an unnamespaced
  // inventory would let one silently cover for the other.
  check("the three namespaces cannot collide", new Set(c.names).size === c.names.length, JSON.stringify(c.names));

  // ---- planned rooms -----------------------------------------------------------------
  put(join("initiatives", "face", "contracts", "planned-rooms.json"),
    JSON.stringify({ rooms: [{ room: "ops", ring: "money" }, { room: "chat-mcp", ring: "ask" }] }));
  const pr = treePlannedRooms(tree);
  check("treePlannedRooms reads the declared rooms", JSON.stringify(pr.names) === '["ops","chat-mcp"]', JSON.stringify(pr.names));

  // ---- CI ----------------------------------------------------------------------------
  // Workflows are the inventory; the 168 bats suites are a COUNT beside it, not 168 rows.
  // A suite is not a feature of arc that needs a room -- it is how a feature is proven.
  put(join(".github", "workflows", "alpha.yml"), "name: alpha\n");
  put(join(".github", "workflows", "beta.yaml"), "name: beta\n");
  put(join(".github", "workflows", "notes.md"), "not a workflow\n");
  put(join("tests", "one.bats"), "");
  put(join("tests", "two.bats"), "");
  const ci = treeCi(tree);
  check("treeCi reads both .yml and .yaml workflows", JSON.stringify(ci.names.sort()) === '["workflow:alpha","workflow:beta"]', JSON.stringify(ci.names));
  check("and does not count a stray markdown file", !ci.names.some((n) => n.includes("notes")), JSON.stringify(ci.names));
  check("the suite count rides alongside, not as inventory rows", ci.suiteCount === 2, `suiteCount=${ci.suiteCount}`);

  // ---- and the half that is easiest to get wrong: UNREADABLE is not EMPTY -------------
  //
  // Every one of these must report `unreadable`. A reader that returns `{ names: [] }` for a
  // broken file makes the gate print "all covered" for a source it could not open, which is
  // the most confident possible way to be wrong.
  put("arc.gates.yaml", "gates:\n  - name: [this is not the frozen subset\n");
  check("a gates file that will not parse is UNREADABLE, not empty", Boolean((await treeGates(tree)).unreadable), JSON.stringify(await treeGates(tree)));

  put("ventures.yaml", "version: 1\nventures:\n  - alpha\n  - beta\n");
  const vBad = await treeVentures(tree);
  check("a ventures LIST where a map belongs is UNREADABLE, not empty", Boolean(vBad.unreadable), JSON.stringify(vBad));

  put(join("initiatives", "face", "contracts", "planned-rooms.json"), "{ not json");
  check("planned-rooms that will not parse is UNREADABLE", Boolean(treePlannedRooms(tree).unreadable));

  const bare = mkdtempSync(join(tmpdir(), "coverage-readers-bare-"));
  check("an ABSENT gates file is UNREADABLE, not empty", Boolean((await treeGates(bare)).unreadable));
  check("an ABSENT adr dir is UNREADABLE, not empty", Boolean(treeAdrBands(bare).unreadable));
  check("an ABSENT plans dir is UNREADABLE, not empty", Boolean(treePlans(bare).unreadable));
  check("an ABSENT planned-rooms file is UNREADABLE, not empty", Boolean(treePlannedRooms(bare).unreadable));
  // capabilities is the one inventory where absent-is-legitimately-empty: a repo may carry
  // no skills, no MCP servers and no images, and that is a fact rather than a read failure.
  check("but absent CAPABILITIES are legitimately empty", treeCapabilities(bare).names.length === 0 && !treeCapabilities(bare).unreadable);
  rmSync(bare, { recursive: true, force: true });

  // ---- the readers run against the REAL repo too, and find the real things ------------
  // Without this, every check above could pass against a temp tree while the real paths were
  // wrong -- the readers would be correct about files nobody has.
  const realGates = await treeGates(REPO);
  check("against the real repo, gates are found", !realGates.unreadable && realGates.names.length >= 5, JSON.stringify(realGates).slice(0, 120));
  const realAdrs = treeAdrBands(REPO);
  check("against the real repo, ADR bands are found", !realAdrs.unreadable && realAdrs.fileCount > 100, JSON.stringify(realAdrs.names));
  const realVentures = await treeVentures(REPO);
  check("against the real repo, ventures are found", !realVentures.unreadable && realVentures.names.length >= 1, JSON.stringify(realVentures));
  const realCi = treeCi(REPO);
  check("against the real repo, CI workflows are found", !realCi.unreadable && realCi.names.length >= 1, JSON.stringify(realCi.names));
  check("and the real bats suite count is plausible", realCi.suiteCount > 50, `suiteCount=${realCi.suiteCount}`);
} finally {
  rmSync(tree, { recursive: true, force: true });
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 20 ? 0 : 1;
