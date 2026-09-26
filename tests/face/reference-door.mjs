// The Reference room's door route (Phase 07, REQ-12, ADR-1346) -- the three hard lines, without a door:
//   A. ONE EXTRACT: the route's entities equal `wiki-build --json`'s for the same tree, id for id, both ways.
//   B. BUILD-TIME FACTS ONLY (ADR-1509): a marker planted in a fixture tree's spine and .claude/state/ never reaches
//      the body; narrative comes only from _narrative/ files, fingerprint stripped, and an entity without one has none.
//   C. REFUSED WHOLE: a new extract schema, or a wiki-build that stopped exporting what the route imports, refuses.
//   D. NO SECOND WALKER: the docs lane's own no-walker gate passes over the route's directory, and fails a mutant copy
//      that lists a directory.
//   E. READ-ONLY (ADR-1504): every tracked file under docs/wiki/ is byte-identical before and after the route runs.
// The live door (token, Origin, GET-only, query refusal) is held in tests/face/dash-doors.mjs.
import { execFileSync, spawnSync } from "node:child_process";
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
    const cli = spawnSync(process.execPath, [join(REPO, ".claude/scripts/docs/wiki-build.mjs"), "--json", "--root", REPO, "--out", out], { encoding: "utf8" });
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
  }

  // ---- B. build-time facts only, narrative honest ----
  {
    const tree = join(tmp, "tree");
    const mk = spawnSync(process.execPath, [join(REPO, "tests/docs/fixture-tree.mjs"), REPO, tree], { encoding: "utf8" });
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
  }

  // ---- D. no second walker ----
  {
    const n = readdirSync(ROUTE_DIR).length;
    const gate = spawnSync(process.execPath, [join(REPO, "tests/docs/no-walker.mjs"), ROUTE_DIR, "--expect", String(n)], { encoding: "utf8" });
    check("D: the docs lane's no-walker gate RAN over the route's directory and found no walker",
      gate.status === 0 && gate.stdout.includes(`no-walker: scanned ${n} file(s)`), `${gate.status} ${gate.stdout}${gate.stderr}`);
    const mutant = join(tmp, "mutant-route");
    mkdirSync(mutant);
    copyFileSync(join(ROUTE_DIR, "route.mjs"), join(mutant, "route.mjs"));
    appendFileSync(join(mutant, "route.mjs"), `\nimport { readdirSync as listMe } from "node:fs";\nexport const second = () => listMe("docs");\n`);
    const caught = spawnSync(process.execPath, [join(REPO, "tests/docs/no-walker.mjs"), mutant, "--expect", "1"], { encoding: "utf8" });
    check("D: MUTANT CONTROL -- a copy of the route that lists a directory is caught by the same gate", caught.status === 1, `${caught.status} ${caught.stdout}`);
  }

  // ---- E. read-only ----
  {
    const tracked = execFileSync("git", ["-C", REPO, "ls-files", "-z", "docs/wiki"], { encoding: "utf8" }).split("\0").filter(Boolean);
    const digest = () => tracked.map((f) => createHash("sha256").update(readFileSync(join(REPO, f))).digest("hex")).join("");
    check("fixture: docs/wiki holds at least 100 tracked files (vacuous-pass guard)", tracked.length >= 100, String(tracked.length));
    const before = digest();
    await R.referenceBody(REPO);
    await R.referenceBody(REPO);
    check("E: every tracked docs/wiki file is byte-identical after the route ran twice (ADR-1504)", digest() === before);
  }
} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch { console.log(`WARN the scratch dir was not removed: ${tmp}`); }
}
console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran >= 17 ? 0 : 1;
