// The Reference room's fold (Phase 07 PR B, REQ-12, ADR-1346), over the REAL extract of this tree -- the same body the
// door serves, built by the route's own referenceBody -- so what is held here is what the room would draw today.
//   index → type → entity navigation by the one pick `at`, and a pick naming nothing is LOST, never an empty page;
//   every link the room draws resolves to an entity the extract holds;
//   the cross-links equal the MARKDOWN's: each product's "Required by" row in docs/wiki is the room's, both ways;
//   narrative only from _narrative files, split by "The bigger loop", else pending, and never generated;
//   the door still loading is drawn as loading.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const u = (p) => pathToFileURL(p).href;
const reg = await import(u(join(REPO, "face", "src", "lib", "registry.mjs")));
const route = await import(u(join(REPO, ".claude", "scripts", "hq", "lib", "face", "reference", "route.mjs")));
const dir = join(REPO, "face", "src", "modules", "company", "reference");
const manifest = (await import(u(join(dir, "module.mjs")))).default;
const { fold, splitNarrative, splitBlocks } = await import(u(join(dir, "fold.mjs")));
const registry = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};

const body = { route: "/api/reference", ...(await route.referenceBody(REPO)) };
const room = registry.rooms.find((r) => r.id === "reference");
const foldAt = (at, answer = true) => {
  const ctx = { room, rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: registry.inventories, laneMap: undefined, picks: { at }, manifest };
  const first = fold({}, ctx);
  const payloads = Object.create(null);
  if (answer) for (const r of reg.plannedReads(first, manifest).reads) if (r.route === "/api/reference") payloads[r.key] = { state: "ok", data: body };
  return fold(payloads, ctx);
};
const ids = (key) => body.entities[key].map((e) => e.id);

check("fixture: the room is in the served registry and the extract holds every type (vacuous-pass guard)",
  !!room && body.rendered.length >= 8 && body.rendered.every((k) => Array.isArray(body.entities[k])), `room=${!!room} types=${body.rendered.length}`);

// ---- index ----
const index = foldAt("");
check("index: every type the extract renders is a tile, with its own count and a pick to its list",
  index.isIndex && !index.isType && !index.isEntity && index.types.length === body.rendered.length
  && index.types.every((t) => t.at === t.key && t.count === String(body.entities[t.key].length) && t.title === body.titles[t.key]), JSON.stringify(index.types.slice(0, 2)));

// ---- a type's list ----
const products = foldAt("products");
check("type: the list is exactly the extract's products, each row picking its own page",
  products.isType && products.typeList.rows.length === ids("products").length && products.typeList.rows.every((r, i) => r.at === `products/${ids("products")[i]}`),
  `rows=${products.typeList.rows.length}`);

// ---- every entity page: links resolve, crumbs lead back ----
const pagesChecked = [];
const dangling = [];
for (const key of body.rendered) {
  for (const id of ids(key)) {
    if (!body.pages[`${key}/${id}`]) continue;
    const f = foldAt(`${key}/${id}`);
    pagesChecked.push(`${key}/${id}`);
    if (!f.isEntity || f.crumbs.length !== 3 || f.crumbs[1].at !== key) dangling.push(`${key}/${id}: not a page`);
    for (const row of f.entity.facts) for (const r of row.refs) {
      const [k, ...rest] = r.at.split("/");
      if (r.isLink && !ids(k).includes(rest.join("/"))) dangling.push(`${key}/${id} -> ${r.at}`);
    }
  }
}
check("entity: every paged entity opens as a page with a path back, and every link it draws resolves to an entity",
  pagesChecked.length >= 100 && dangling.length === 0, `${pagesChecked.length} pages; ${dangling.slice(0, 5).join(" | ")}`);

// ---- the cross-links are the MARKDOWN's ----
const mdRequiredBy = (id) => {
  const md = readFileSync(join(REPO, "docs", "wiki", body.pages[`products/${id}`]), "utf8");
  const row = md.split("\n").find((l) => l.startsWith("| Required by |")) || "";
  return [...row.matchAll(/\[([^\]]+)\]\(/g)].map((m) => m[1]).sort();
};
const mismatch = [];
let withReqBy = 0;
for (const id of ids("products")) {
  const f = foldAt(`products/${id}`);
  const room = (f.entity.facts.find((r) => r.label === "Required by") || { refs: [] }).refs.map((r) => r.text).sort();
  if (room.length) withReqBy++;
  if (JSON.stringify(room) !== JSON.stringify(mdRequiredBy(id))) mismatch.push(`${id}: room ${room} md ${mdRequiredBy(id)}`);
}
check("cross-links: each product's 'Required by' in the room equals its docs/wiki page's, for every product",
  withReqBy >= 1 && mismatch.length === 0, mismatch.slice(0, 3).join(" | "));

// ---- narrative ----
const narrated = Object.keys(body.narrative);
const without = pagesChecked.find((at) => !narrated.includes(at));
const nf = foldAt(without);
check("narrative: a page with no _narrative file is pending in both sections, naming where it belongs",
  nf.entity.hasStartHere === false && nf.entity.hasLoop === false && nf.entity.pending.includes(`docs/wiki/_narrative/${body.pageDirs[without.split("/")[0]]}/`), nf.entity.pending);
if (narrated.length) {
  const wf = foldAt(narrated[0]);
  check("narrative: a page with one draws the owner's own words", wf.entity.hasStartHere === true && body.narrative[narrated[0]].includes(wf.entity.startHere[0].slice(0, 40)), narrated[0]);
} else check("narrative: a page with one draws the owner's own words (no narrative on this tree -- the split below still runs)", true);
const split = splitNarrative("First part.\n\nSecond.\n\n## The bigger loop\n\nThe loop part.");
const fenced = splitNarrative("Intro.\n\n```md\n## The bigger loop\n```\n\nStill intro.\n\n## The bigger loop\n\nReal loop.");
check("narrative: a '## The bigger loop' inside a code fence is the owner's quoted text, not the break (L3)",
  fenced.loop.length === 1 && fenced.loop[0] === "Real loop." && fenced.start.some((p) => p.includes("Still intro.")), JSON.stringify(fenced));
check("narrative: '## The bigger loop' divides the owner's text between the two sections, nothing added",
  JSON.stringify(split) === JSON.stringify({ start: ["First part.", "Second."], loop: ["The loop part."] }), JSON.stringify(split));

// ---- lost, and loading ----
// The pick grammar or LOST: a trailing slash, a padded key, a nested path and a dot segment are never a second
// spelling of a real page (attack 53ee223 L1, L6).
const spellings = ["products/", " products", "products//hq", "products/hq/x", "products/../gates", "Products"].map((a) => [a, foldAt(a)]);
check("lost: every pick outside the grammar is LOST -- never a type list, never someone else's page",
  spellings.every(([, f]) => f.isLost === true && f.isType === false && f.isEntity === false), spellings.filter(([, f]) => !f.isLost).map(([a]) => JSON.stringify(a)).join(","));
// The live-room button follows the rail's rule: a product whose room is the lane TEMPLATE opens nothing (L7, B3).
const onTemplate = ids("products").find((id) => body.entities.products.find((e) => e.id === id).facts.faceRoom === "lane");
check("links: a live-room button exists only for an openable room -- the lane template never",
  !!onTemplate && foldAt(`products/${onTemplate}`).entity.faceRoom.canOpen === false
  && ids("products").some((id) => foldAt(`products/${id}`).entity.faceRoom.canOpen === true), String(onTemplate));
const lost = foldAt("products/no-such-product-anywhere");
check("lost: a pick naming nothing is LOST with its name, never an empty page that looks real",
  lost.isLost === true && lost.isEntity === false && lost.isIndex === false && lost.lost.includes("no-such-product-anywhere"));
const loading = foldAt("", false);
check("loading: before the door answers, the room says it is reading, and draws no page",
  loading.isReading === true && loading.isIndex === false && loading.isRead === false);

// ---- the per-room Reference link (ADR-1346 §6): counted, and every one lands on a page ----
{
  const shell = await import(u(join(REPO, "face", "src", "lib", "shell.mjs")));
  const laneRoom = await import(u(join(REPO, "face", "src", "lib", "lane-room.mjs")));
  // The link's destination is FOUND by its route, and follows the rail's rule: a planned Reference room gets no link (B1).
  const attached = { [manifest.id]: { manifest }, decoy: { manifest: { routes: ["/api/spine"] } } };
  const plannedRooms = registry.rooms.map((r) => (r.id === manifest.id ? { ...r, status: "planned" } : r));
  const twice = [...registry.rooms, { ...room, id: "decoy" }];
  check("links: the destination is the one openable room whose module reads the extract -- none when planned, none when two",
    laneRoom.referenceRoom(registry.rooms, attached) === manifest.id && laneRoom.referenceRoom(plannedRooms, attached) === null
    && laneRoom.referenceRoom(twice, { ...attached, decoy: { manifest } }) === null && laneRoom.referenceRoom(null, null) === null);
  const targets = registry.rooms.map((r) => ({ id: r.id, at: shell.referenceAt(r) }));
  const linked = targets.filter((x) => x.at !== null);
  const unlinked = targets.filter((x) => x.at === null);
  const broken = linked.filter((x) => { const [k, ...rest] = x.at.split("/"); return !ids(k).includes(rest.join("/")) || !body.pages[x.at]; });
  console.log(`reference links: ${linked.length} rooms link to a page, ${unlinked.length} do not (${unlinked.map((x) => x.id).join(",")})`);
  // The rooms that SHOULD link, derived independently of referenceAt: every served room a product or a lane maps to in
  // expected-set.json (ADR-1306's maps), compared both ways -- a hand-kept floor let a broken referenceAt pass (B3).
  const expected = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "expected-set.json"), "utf8"));
  const mapped = new Set();
  for (const key of ["products", "lanes"]) {
    const map = (expected[key] && expected[key].map) || {};
    for (const [k, v] of Object.entries(map)) if (!k.startsWith("$")) for (const id of [v].flat()) if (typeof id === "string") mapped.add(id);
  }
  const want = registry.rooms.map((r) => r.id).filter((id) => mapped.has(id)).sort();
  const have = linked.map((x) => x.id).sort();
  const self = targets.find((x) => x.id === manifest.id);
  check("links: the rooms that link are exactly the rooms a product or a lane maps to, both ways, and every one lands on a page",
    want.length > 0 && JSON.stringify(have) === JSON.stringify(want) && broken.length === 0
    && linked.length + unlinked.length === registry.rooms.length && self !== undefined && self.at === null,
    `missing=${want.filter((i) => !have.includes(i))} extra=${have.filter((i) => !want.includes(i))} broken=${broken.map((x) => `${x.id}->${x.at}`)}`);
  // End to end, for EVERY linked room: the address the link writes, parsed back, seeds the pick the fold reads (B4).
  const pickName = "at";
  const carried = linked.map((x) => {
    const h = shell.parseHash(shell.buildHash(manifest.id, "tok", "2026-09-01", x.at));
    const f = foldAt(h.at ?? "");
    return { id: x.id, at: x.at, ok: h.room === manifest.id && h.asOf === "2026-09-01" && h[pickName] === x.at && f.isEntity === true && f.crumbs[2].at === x.at };
  });
  check("links: every room's link, written to the address and read back, opens the Reference room ON its page",
    carried.length > 0 && carried.every((c) => c.ok), carried.filter((c) => !c.ok).map((c) => `${c.id}->${c.at}`).join(","));
  // Prototype names pass the fragment grammar; the fold must still find no page there (B9).
  const proto = ["constructor", "toString", "valueOf", "hasOwnProperty", "products/constructor", "products/__proto__", "constructor/x"].map((a) => [a, foldAt(a)]);
  check("lost: a prototype name is LOST, never a type list or a page",
    proto.every(([, f]) => f.isLost === true && f.isEntity === false && f.isType === false), proto.filter(([, f]) => !f.isLost).map(([a]) => a).join(","));
}

// ---- the narrative as markdown (ADR-1347 section 2): every block kind, and nothing of the author's metadata ----
{
  const md = [
    "<!-- facts: agents=0000 -->",
    "Intro with **strong**, *em*, `code` and [a link](../lanes/face.md). <!-- src: ADR-1347 -->",
    "",
    "## Why it exists",
    "",
    "- first <!-- plain -->",
    "- second",
    "  continued",
    "",
    "1. one",
    "2. two",
    "",
    "| Term | Means |",
    "|---|---|",
    "| lane | <script>alert(1)</script> |",
    "",
    "```md",
    "<!-- quoted -->",
    "## not a heading",
    "```",
    "",
    "> a quote",
    "",
    "<!-- a comment",
    "over two lines -->",
    "## The bigger loop",
    "",
    "The loop.",
  ].join("\n");
  const s = splitBlocks(md);
  const kinds = s.start.map((b) => Object.keys(b).filter((k) => k.startsWith("is") && b[k] === true).sort().join("+"));
  const want = ["isPara", "isH2+isHeading", "isList", "isList+isOrdered", "isTable", "isCode", "isQuote"];
  const intro = s.start[0] ? s.start[0].spans : [];
  const flags = (sp) => Object.keys(sp).filter((k) => k.startsWith("is") && sp[k] === true).join("");
  check("narrative blocks: a heading, a paragraph with every span kind, both lists, a table, code and a quote each parse; the loop break is splitNarrative's",
    JSON.stringify(kinds) === JSON.stringify(want)
    && ["isStrong", "isEm", "isCode", "isLink"].every((k) => intro.some((sp) => flags(sp) === k))
    && s.start[2].items.length === 2 && s.start[2].items[1].spans.map((x) => x.text).join("") === "second continued"
    && s.start[4].head.length === 2 && s.start[4].rows.length === 1
    && s.loop.length === 1 && s.loop[0].isPara === true && splitNarrative(md).loop.length === 1,
    JSON.stringify(kinds));
  const all = JSON.stringify(s);
  const cell = s.start[4].rows[0].cells[1].spans;
  check("narrative blocks: the fingerprint and every src/plain marker are dropped, a fenced comment is kept verbatim, and a script tag is one TEXT span",
    !all.includes("facts:") && !all.includes("src:") && !all.includes("plain -->") && !all.includes("over two lines")
    && s.start[5].text === "<!-- quoted -->\n## not a heading"
    && cell.length === 1 && cell[0].isText === true && cell[0].text === "<script>alert(1)</script>",
    all.slice(0, 300));
}

// ---- the explanation debt (ADR-1513): the gate's count, on the index and on each product's page ----
{
  const ex = body.explanation || {};
  const idx = foldAt("");
  const unex = new Set((ex.unexplained && ex.unexplained.commands) || []);
  const prod = body.entities.products.find((e) => (e.facts.commands || []).some((c) => unex.has(String(c).replace(/^.*\//, "").replace(/\.md$/, ""))));
  const pf = prod ? foldAt(`products/${prod.id}`) : null;
  check("debt: the index states the gate's explanation debt, and a product page names its commands no narrative explains",
    Number.isInteger(ex.total) && ex.total >= 100 && idx.debt.startsWith(`Explanation debt: ${ex.debt} of ${ex.total} `)
    && pf !== null && pf.entity.hasMissing === true && pf.entity.missing.includes("/"),
    JSON.stringify({ debt: idx.debt, prod: prod && prod.id, missing: pf && pf.entity.missing }));
}

console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran === 20 ? 0 : 1;
