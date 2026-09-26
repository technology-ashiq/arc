// The Reference room's door route (Phase 07, REQ-12, ADR-1346) -- the three hard lines, without a door:
//   A. ONE EXTRACT: the route's entities equal `wiki-build --json`'s for the same tree, id for id, both ways.
//   B. BUILD-TIME FACTS ONLY (ADR-1509): a marker planted in a fixture tree's spine and .claude/state/ never reaches
//      the body; narrative comes only from _narrative/ files, fingerprint stripped, and an entity without one has none.
//   C. REFUSED WHOLE: a new extract schema, or a wiki-build that stopped exporting what the route imports, refuses.
//   D. NO SECOND WALKER: the docs lane's own no-walker gate passes over the route's directory, and fails a mutant copy
//      that lists a directory.
//   E. READ-ONLY (ADR-1504): every tracked file under docs/wiki/ is byte-identical before and after the route runs.
// The live door (token, Origin, GET-only, query refusal) is held in tests/face/dash-doors.mjs.
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const ROUTE_DIR = join(REPO, ".claude", "scripts", "hq", "lib", "face", "reference");
const R = await import(pathToFileURL(join(ROUTE_DIR, "route.mjs")).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};
const refusal = async (fn) => { try { await fn(); return null; } catch (e) { return { code: /** @type {any} */ (e).code, message: String(/** @type {any} */ (e).message) }; } };
const ids = (entities) => Object.keys(entities).sort().flatMap((k) => (entities[k] || []).map((e) => `${k}/${e.id}`)).sort();

const tmp = mkdtempSync(join(tmpdir(), "face-reference-"));
try {
  // ---- A. one extract ----
  {
    const out = join(tmp, "wiki.json");
    const cli = spawnSync(process.execPath, [join(REPO, ".claude/scripts/docs/wiki-build.mjs"), "--json", "--root", REPO, "--out", out], { encoding: "utf8", timeout: 120000 });
    check("fixture: wiki-build --json ran and wrote the extract (vacuous-pass guard)", cli.status === 0, `${cli.status} ${cli.stderr}`);
    const want = JSON.parse(readFileSync(out, "utf8"));
    const body = await R.referenceBody(REPO);
    const a = ids(body.entities), b = ids(want.entities);
    check("fixture: the extract names at least 100 entities (a thin extract would pass equality on nothing)", b.length >= 100, String(b.length));
    check("A: the route's entity ids equal wiki-build --json's, both ways", a.length === b.length && a.every((x, i) => x === b[i]),
      `${a.filter((x) => !b.includes(x)).join(",")} | ${b.filter((x) => !a.includes(x)).join(",")}`);
    check("A: the route's entities are wiki-build's byte for byte (nothing re-derived)", JSON.stringify(body.entities) === JSON.stringify(want.entities));
    check("A: schema 1, and every entity has the page path wiki-build gives it",
      body.schema === 1 && a.every((x) => typeof body.pages[x] === "string" && body.pages[x].endsWith(".md")), `schema=${body.schema}`);
    // What the door SENDS is the scrubbed value: measured too, and the scrub says what it changed (attack 94ffba3 B3).
    const served = await R.servedReference(REPO);
    check("A: the SERVED entities (after the door's scrub) are still wiki-build's byte for byte, and the body says the scrub moved no fact",
      JSON.stringify(served.entities) === JSON.stringify(want.entities) && served.scrubbed && served.scrubbed.factsAltered === false && Array.isArray(served.scrubbed.narrative),
      JSON.stringify(served.scrubbed));
    // Concurrent requests share ONE computation (attack 94ffba3 B4): the same entities object reaches both answers.
    const ctx = { mode: "live", repo: REPO };
    const [r1, r2] = await Promise.all([R.apiReference(ctx, new URL("http://door/api/reference")), R.apiReference(ctx, new URL("http://door/api/reference"))]);
    check("A: two concurrent requests are answered from one extract, not two", r1.route === "/api/reference" && r1.entities === r2.entities && ids(r1.entities).length === b.length);
  }

  // ---- B. build-time facts only, narrative honest ----
  {
    const tree = join(tmp, "tree");
    const mk = spawnSync(process.execPath, [join(REPO, "tests/docs/fixture-tree.mjs"), REPO, tree], { encoding: "utf8", timeout: 120000 });
    check("fixture: the docs lane's fixture tree was built (vacuous-pass guard)", mk.status === 0, `${mk.status} ${mk.stderr}`);
    const MARK = `REFMARK${randomBytes(6).toString("hex")}`;
    mkdirSync(join(tree, ".claude", "state", "hq", "events"), { recursive: true });
    appendFileSync(join(tree, ".claude", "state", "hq", "events", "2026-09-26.jsonl"),
      `${JSON.stringify({ id: "01M3F00000000000000000000A", kind: "note.logged", payload: { note: MARK } })}\n`);
    writeFileSync(join(tree, ".claude", "state", "probe.json"), JSON.stringify({ live: MARK }));
    const first = await R.referenceBody(tree);
    const product = (first.entities.products || [])[0];
    check("fixture: the fixture tree's extract holds a product and at least 5 entities", !!product && ids(first.entities).length >= 5, String(ids(first.entities).length));
    const NARR = `NARRMARK${randomBytes(6).toString("hex")}`;
    const narrDir = join(tree, "docs", "wiki", "_narrative", first.pageDirs.products);
    mkdirSync(narrDir, { recursive: true });
    writeFileSync(join(narrDir, `${product.id}.md`), `<!-- facts:0123456789abcdef -->\n${NARR} is why it exists.\n`);
    const body = await R.referenceBody(tree);
    const text = JSON.stringify(body);
    check("B: a marker planted in the spine and in .claude/state/ is nowhere in the body (ADR-1509)", !text.includes(MARK) && text.length > 1000, `len=${text.length}`);
    const key = `products/${product.id}`;
    check("B: the owner's narrative is served, with its fingerprint line stripped",
      typeof body.narrative[key] === "string" && body.narrative[key].startsWith(NARR) && !body.narrative[key].includes("<!-- facts:"), JSON.stringify(body.narrative[key]));
    const pending = ids(body.entities).filter((x) => !(x in body.narrative));
    check("B: an entity with no narrative file has no narrative (the room reads it as pending, never generates it)",
      pending.length === ids(body.entities).length - 1, `pending=${pending.length} total=${ids(body.entities).length}`);
    // A narrative path that is not a regular file (wiki-build refuses a symlink, a directory, an out-of-tree target with
    // ITS own error class) is this door's named refusal, not a 500 (attack 94ffba3 B1). A directory is the portable
    // stand-in: a symlink cannot be made on every Windows leg.
    const second = (first.entities.lanes || [])[0];
    const narrLanes = join(tree, "docs", "wiki", "_narrative", first.pageDirs.lanes);
    mkdirSync(join(narrLanes, `${second.id}.md`), { recursive: true });
    const notFile = await refusal(() => R.referenceBody(tree));
    check("B: a narrative that is not a regular file refuses the route by name (SOURCE_INVALID), never a 500",
      !!second && !!notFile && notFile.code === "SOURCE_INVALID" && notFile.message.includes(`lanes/${second.id}`), JSON.stringify(notFile));
    rmSync(join(narrLanes, `${second.id}.md`), { recursive: true, force: true });
  }

  // ---- C. refused whole ----
  {
    const stub = (over) => ({ extract: async () => ({ code: 0, wiki: { schema: 1, entities: {} } }), narrativeReader: () => () => null,
      pagePath: () => null, RENDERED: [], PAGE_DIRS: {}, TYPE_KEY: {}, ...over });
    const ok = await refusal(() => R.referenceBody(REPO, { wiki: stub({}) }));
    check("C: control -- a schema-1 stub is served (the refusals below are not a broken stub)", ok === null, JSON.stringify(ok));
    const s2 = await refusal(() => R.referenceBody(REPO, { wiki: stub({ extract: async () => ({ code: 0, wiki: { schema: 2, entities: {} } }) }) }));
    check("C: an extract of schema 2 is refused whole (SOURCE_INVALID), never rendered in part", !!s2 && s2.code === "SOURCE_INVALID" && s2.message.includes("schema 2"), JSON.stringify(s2));
    const bad = await refusal(() => R.referenceBody(REPO, { wiki: stub({ extract: async () => ({ code: 1, message: "an inventory the wiki has not decided about" }) }) }));
    check("C: an extract that did not complete is refused, with its reason", !!bad && bad.code === "SOURCE_INVALID" && bad.message.includes("not decided"), JSON.stringify(bad));
    const gone = stub({}); delete gone.narrativeReader;
    const miss = await refusal(() => R.referenceBody(REPO, { wiki: gone }));
    check("C: a wiki-build that stopped exporting narrativeReader is refused (PARSER_UNAVAILABLE), never re-derived here",
      !!miss && miss.code === "PARSER_UNAVAILABLE" && miss.message.includes("narrativeReader"), JSON.stringify(miss));
    // Inherited members are not exports: `in` accepted them and the missing member then threw as a 500 (attack 94ffba3 L1).
    const inherited = await refusal(() => R.referenceBody(REPO, { wiki: Object.create(stub({})) }));
    check("C: members only INHERITED by the module object are refused as missing exports (PARSER_UNAVAILABLE)", !!inherited && inherited.code === "PARSER_UNAVAILABLE", JSON.stringify(inherited));
    const nullShape = await refusal(() => R.referenceBody(REPO, { wiki: stub({ extract: async () => ({ code: 0, wiki: { schema: 1, entities: null } }) }) }));
    const itemShape = await refusal(() => R.referenceBody(REPO, { wiki: stub({ extract: async () => ({ code: 0, wiki: { schema: 1, entities: { lanes: [null] } } }) }) }));
    check("C: entities of the wrong shape (null, or a list holding a non-entity) are SOURCE_INVALID, never a crash (L2)",
      !!nullShape && nullShape.code === "SOURCE_INVALID" && !!itemShape && itemShape.code === "SOURCE_INVALID", JSON.stringify([nullShape, itemShape]));
    const leaky = await refusal(() => R.referenceBody(REPO, { wiki: stub({ extract: async () => ({ code: 1, message: `failed on ${join(REPO, ".claude", "state", "x.json")}` }) }) }));
    check("C: an extract failure message is scrubbed -- the repo's own path never rides the refusal (L2m)",
      !!leaky && leaky.code === "SOURCE_INVALID" && !leaky.message.includes(REPO) && !leaky.message.includes(REPO.split("\\").join("/")), JSON.stringify(leaky));
    // An id wiki-build gives no safe page never becomes a key the room links by (L4, L5): counted in `unpaged` instead.
    const odd = await R.referenceBody(REPO, { wiki: stub({
      RENDERED: ["lanes"], PAGE_DIRS: { lanes: "lanes" },
      extract: async () => ({ code: 0, wiki: { schema: 1, entities: { lanes: [{ id: "face" }, { id: "../../etc/x" }, { id: "evil" }] } } }),
      pagePath: (e) => (e.id === "face" ? "lanes/face.md" : e.id === "evil" ? "../../../outside.md" : null) }) });
    check("C: only an id with a contained <dir>/<id>.md page becomes a key; the rest are counted in unpaged",
      Object.keys(odd.pages).join(",") === "lanes/face" && odd.unpaged.length === 2, JSON.stringify({ pages: odd.pages, unpaged: odd.unpaged }));
  }

  // ---- D. no second walker ----
  {
    const n = readdirSync(ROUTE_DIR).length;
    const gate = spawnSync(process.execPath, [join(REPO, "tests/docs/no-walker.mjs"), ROUTE_DIR, "--expect", String(n)], { encoding: "utf8", timeout: 120000 });
    check("D: the docs lane's no-walker gate RAN over the route's directory and found no walker",
      gate.status === 0 && gate.stdout.includes(`no-walker: scanned ${n} file(s)`), `${gate.status} ${gate.stdout}${gate.stderr}`);
    const mutant = join(tmp, "mutant-route");
    mkdirSync(mutant);
    copyFileSync(join(ROUTE_DIR, "route.mjs"), join(mutant, "route.mjs"));
    appendFileSync(join(mutant, "route.mjs"), `\nimport { readdirSync as listMe } from "node:fs";\nexport const second = () => listMe("docs");\n`);
    const caught = spawnSync(process.execPath, [join(REPO, "tests/docs/no-walker.mjs"), mutant, "--expect", "1"], { encoding: "utf8", timeout: 120000 });
    // Caught BY NAME: exit 1 is also what a crash prints, so the finding must name the mutant file (attack 94ffba3 B9).
    check("D: MUTANT CONTROL -- a copy of the route that lists a directory is caught by the same gate",
      caught.status === 1 && caught.stdout.includes("route.mjs") && /readdirSync|listMe/.test(caught.stdout), `${caught.status} ${caught.stdout}`);
  }

  // ---- E. read-only ----
  // EVERY file under the fixture tree -- new, renamed or changed, tracked or not -- is the same after two full runs
  // (attack 94ffba3 B5), and a mutant that writes one new file is seen by the same measure.
  {
    const tree = join(tmp, "tree");
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
    const digest = () => walk(tree).sort().map((f) => `${f}\0${createHash("sha256").update(readFileSync(f)).digest("hex")}`).join("\n");
    const before = digest();
    check("fixture: the fixture tree holds at least 20 files (vacuous-pass guard)", walk(tree).length >= 20, String(walk(tree).length));
    await R.servedReference(tree);
    await R.servedReference(tree);
    check("E: every file of the tree the route read is byte-identical, and none was added, after two runs (ADR-1504)", digest() === before);
    const mutantWrite = async (repo) => { const b = await R.referenceBody(repo); writeFileSync(join(repo, "docs", "wiki", ".route-cache.json"), "{}"); return b; };
    await mutantWrite(tree);
    check("E: MUTANT CONTROL -- a route that writes one new file under docs/wiki is seen by the same measure", digest() !== before);
  }
} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch { console.log(`WARN the scratch dir was not removed: ${tmp}`); }
}
console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran >= 26 ? 0 : 1;
