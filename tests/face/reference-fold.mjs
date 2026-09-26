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
const { fold, splitNarrative } = await import(u(join(dir, "fold.mjs")));
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
  const targets = registry.rooms.map((r) => ({ id: r.id, at: shell.referenceAt(r) }));
  const linked = targets.filter((x) => x.at !== null);
  const unlinked = targets.filter((x) => x.at === null);
  const broken = linked.filter((x) => { const [k, ...rest] = x.at.split("/"); return !ids(k).includes(rest.join("/")) || !body.pages[x.at]; });
  console.log(`reference links: ${linked.length} rooms link to a page, ${unlinked.length} do not (${unlinked.map((x) => x.id).join(",")})`);
  check("links: every room that links lands on a page the extract holds; with + without = every served room",
    linked.length >= 15 && broken.length === 0 && linked.length + unlinked.length === registry.rooms.length
    && targets.find((x) => x.id === "reference").at === null, `linked=${linked.length} broken=${broken.map((x) => `${x.id}->${x.at}`).join(",")}`);
  const opened = foldAt(linked[0].at);
  check("links: a room's link opens the Reference room ON that page (the pick the hash seeds)", opened.isEntity === true && opened.crumbs[2].at === linked[0].at, linked[0].at);
}

console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran === 15 ? 0 : 1;
