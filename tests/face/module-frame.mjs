#!/usr/bin/env node
// module-frame.mjs -- the module frame's decisions, with no install and no build (face v2 Phase 02,
// REQ-03, ADR-1306, ADR-1320, ADR-1321).
//
//   1. face/src/lib/registry.mjs attaches module folders to SERVED rooms, both ways: an orphan
//      folder, a misplaced ring, a manifest that disagrees with its folder, a template folder, an
//      id in two rings and a malformed key are each named; a served room with no module is listed
//      as generic, by id.
//   2. On the real tree, that attachment and face-coverage's module half AGREE: the same generic
//      rooms and no problem on either side. Two readers of one question, crossed end to end, so a
//      drift between the browser's answer and the gate's answer is a named failure.
//   3. The shell reads the served registry and names no room: no served id is a quoted literal in
//      any shell file, and the scan that proves it FAILs a planted one.
//
// Before registry.mjs exists this suite dies with ERR_MODULE_NOT_FOUND and prints no RAN line --
// the red that comes first. VACUOUS-PASS GUARD: the first check proves the module loaded; the
// last line is "RAN: <n> checks, <f> failed".
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SRC = join(REPO, "face", "src");
const LIB = join(SRC, "lib");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const reg = await import(pathToFileURL(join(LIB, "registry.mjs")).href);
check("registry.mjs loaded with its frame exports (vacuous-pass guard)",
  ["parseModuleKey", "collectModules", "attachModules", "homeRoom", "railGroups", "renderFor", "fallbackFor", "asOfReaches", "roomHoldingKind", "foldContext", "modeChip"]
    .every((k) => typeof reg[k] === "function") && Array.isArray(reg.MODULE_FILES) && reg.MODULE_FILES.join(",") === "module.mjs,fold.mjs,ops.mjs,View.tsx",
  Object.keys(reg).join(","));

// ── a synthetic served registry: every branch below is exercised, not only today's tree ──
const room = (id, ring, over = {}) => ({ id, name: id, ring, status: "built", sentence: `${id} sentence`, lede: "", render: "generic", stations: [], holds: { kinds: [] }, itemCount: 1, live: { state: "live", kindsHomed: 1, kindsFired: 1, receipts: 1 }, ...over });
const served = {
  rings: ["kernel", "command"],
  rooms: [
    room("lane", "command", { status: "template", template: true }),
    room("soon", "command", { status: "planned", planned: true }),
    room("inbox", "command", { holds: { kinds: ["approval.requested", "decision.recorded"] } }),
    room("today", "command", { render: "bespoke" }),
    room("bench", "kernel"),
    room("vocab", "kernel", { render: "index", live: { state: "index", kindsHomed: 0, kindsFired: 0, receipts: 0 } }),
    room("files", "kernel", { live: { state: "file-borne", kindsHomed: 0, kindsFired: 0, receipts: 0 } }),
    room("stray", "money"),
  ],
};
const View = function View() { return null; };
const Icon = function Icon() { return null; };
const ns = (ring, id, over = {}) => ({
  [`./modules/${ring}/${id}/module.mjs`]: { default: { id, ring, routes: [], asOf: true } },
  [`./modules/${ring}/${id}/fold.mjs`]: { fold: () => ({}) },
  [`./modules/${ring}/${id}/ops.mjs`]: { ops: [] },
  [`./modules/${ring}/${id}/View.tsx`]: { default: View, Icon },
  ...over,
});
const attach = (found) => reg.attachModules(served, reg.collectModules(found));
const problem = (a, kind, key) => a.problems.some((p) => p.kind === kind && (key === undefined || p.key === key));
const show = (a) => JSON.stringify({ attached: Object.keys(a.attached), generic: a.generic, problems: a.problems.map((p) => `${p.kind}:${p.key}`) });

// keys
{
  const k = reg.parseModuleKey("./modules/command/today/View.tsx");
  check("a glob key parses into ring, id and file", k.ok && k.ring === "command" && k.id === "today" && k.file === "View.tsx", JSON.stringify(k));
  for (const bad of ["./modules/command/Today/View.tsx", "./modules/a/b/c/View.tsx", "modules/command/today/View.tsx",
    "./modules/command/today/view.tsx", "./modules/command/today/helper.mjs", "./modules/command/today/View.tsx?raw",
    "./modules/command/../today/View.tsx", ".\\modules\\command\\today\\View.tsx", "./modules/command/today/"]) {
    check(`a malformed key is refused: ${bad}`, reg.parseModuleKey(bad).ok === false, JSON.stringify(reg.parseModuleKey(bad)));
  }
}

// the happy path
{
  const a = attach({ ...ns("command", "today"), ...ns("kernel", "bench") });
  check("a served id in its served ring attaches", Boolean(a.attached.today && a.attached.bench) && a.problems.length === 0, show(a));
  check("an attached module carries its manifest, fold, ops, View and Icon",
    a.attached.today.manifest.id === "today" && typeof a.attached.today.fold === "function" && Array.isArray(a.attached.today.ops) && a.attached.today.View === View && a.attached.today.Icon === Icon, show(a));
  check("every served, openable room with no module is generic, in served order, the template never among them",
    a.generic.join(",") === "soon,inbox,vocab,files,stray", show(a));
  check("renderFor names the module for an attached room", JSON.stringify(reg.renderFor("today", a)) === JSON.stringify({ kind: "module", key: "command/today" }));
  check("renderFor names the generic module for an unattached room", reg.renderFor("inbox", a).kind === "generic");
}

// the two directions ADR-1321 names, and every way a folder can be wrong
{
  const a = attach({ ...ns("command", "today"), ...ns("command", "ghost") });
  check("ORPHAN: a folder whose id is not served is named, and never attached", problem(a, "orphan", "command/ghost") && !a.attached.ghost, show(a));
}
{
  const a = attach(ns("kernel", "today"));
  check("MISPLACED: a folder in a ring the served room is not in is named -- the served ring wins", problem(a, "misplaced", "kernel/today") && !a.attached.today && a.generic.includes("today"), show(a));
}
{
  const a = attach(ns("command", "lane"));
  check("TEMPLATE: a folder for the lane template is named -- a template is not a room", problem(a, "template", "command/lane") && !a.attached.lane, show(a));
}
{
  const a = attach({ ...ns("command", "today"), ...ns("kernel", "today") });
  check("DUPLICATE: one id in two ring folders attaches neither", problem(a, "duplicate") && !a.attached.today && a.generic.includes("today"), show(a));
}
{
  const a = attach(ns("command", "today", { "./modules/command/today/module.mjs": { default: { id: "inbox", ring: "command", routes: [], asOf: true } } }));
  check("MANIFEST: a module.mjs naming another id is named and not attached", problem(a, "manifest", "command/today") && !a.attached.today && !a.attached.inbox, show(a));
}
{
  const a = attach(ns("command", "today", { "./modules/command/today/module.mjs": { default: { id: "today", ring: "kernel", routes: [], asOf: true } } }));
  check("MANIFEST: a module.mjs naming another ring is named", problem(a, "manifest", "command/today") && !a.attached.today, show(a));
}
for (const [label, manifest] of [
  ["routes that are not a list", { id: "today", ring: "command", routes: "/api/brief", asOf: true }],
  ["a route that is not a door path", { id: "today", ring: "command", routes: ["https://evil.example/x"], asOf: true }],
  ["asOf that is not a boolean", { id: "today", ring: "command", routes: [], asOf: "yes" }],
  ["no default export", undefined],
]) {
  const a = attach(ns("command", "today", { "./modules/command/today/module.mjs": { default: manifest } }));
  check(`MANIFEST: ${label} is named`, problem(a, "manifest", "command/today") && !a.attached.today, show(a));
}
for (const [label, over] of [
  ["a missing View.tsx", { "./modules/command/today/View.tsx": undefined }],
  ["a fold.mjs with no fold()", { "./modules/command/today/fold.mjs": { folded: () => ({}) } }],
  ["an ops.mjs whose ops is not a list", { "./modules/command/today/ops.mjs": { ops: {} } }],
  ["a View.tsx with no default component", { "./modules/command/today/View.tsx": { Icon } }],
]) {
  const found = ns("command", "today", over);
  for (const k of Object.keys(found)) if (found[k] === undefined) delete found[k];
  const a = attach(found);
  check(`INCOMPLETE: ${label} is named and the room falls back to generic`, problem(a, "incomplete", "command/today") && !a.attached.today && a.generic.includes("today"), show(a));
}
{
  const a = attach({ ...ns("command", "today"), "./modules/Command/today/View.tsx": { default: View } });
  check("BAD-KEY: a key outside the grammar is named, and does not poison the good module beside it", problem(a, "bad-key") && Boolean(a.attached.today), show(a));
}
{
  const a = attach({});
  check("no modules at all: every openable served room is generic, nothing is a problem", a.generic.length === 7 && a.problems.length === 0, show(a));
}
{
  // A served id that is also an Object.prototype key (face v2 Phase 02 attack): `attached[id]` on a
  // plain object answered Object's own function, so the room drew as a module it does not have.
  const protoServed = { rings: ["command"], rooms: ["constructor", "toString", "__proto__", "hasOwnProperty"].map((id) => room(id, "command")) };
  const a = reg.attachModules(protoServed, reg.collectModules({}));
  check("PROTOTYPE KEYS: served ids named constructor, toString, __proto__ and hasOwnProperty are generic, never modules",
    a.generic.join(",") === "constructor,toString,__proto__,hasOwnProperty" && ["constructor", "toString", "__proto__", "hasOwnProperty"].every((id) => reg.renderFor(id, a).kind === "generic" && a.attached[id] === undefined),
    show(a));
  const groups = reg.railGroups({ rings: ["constructor"], rooms: [room("x", "constructor")] });
  check("PROTOTYPE KEYS: a ring named constructor gets an empty lede, not a function", groups[0] && groups[0].lede === "", JSON.stringify(groups.map((g) => typeof g.lede)));
}

// ── the rail, home, and the other shell decisions read the SERVED registry ──
{
  const groups = reg.railGroups(served);
  check("the rail follows the served ring order, not a constant", groups.map((g) => g.ring).join(",") === "kernel,command,unplaced", JSON.stringify(groups.map((g) => g.ring)));
  check("the rail never offers the template", !groups.some((g) => g.rooms.some((r) => r.id === "lane")));
  check("a planned room sinks to the end of its ring", groups[1].rooms.map((r) => r.id).join(",") === "inbox,today,soon", JSON.stringify(groups[1].rooms.map((r) => r.id)));
  check("a room in a ring the registry does not declare is shown, unplaced -- never dropped", groups[2].rooms.map((r) => r.id).join(",") === "stray");
  check("home is the first openable, unplanned room of the first served ring", reg.homeRoom(served) === "bench", reg.homeRoom(served));
  check("home skips a ring whose only rooms are the template and a planned room",
    reg.homeRoom({ rings: ["command", "kernel"], rooms: [served.rooms[0], served.rooms[1], served.rooms[4]] }) === "bench");
  check("home falls back to a planned room before it falls back to nothing",
    reg.homeRoom({ rings: ["command"], rooms: [served.rooms[0], served.rooms[1]] }) === "soon");
  check("home over a registry of templates alone is null, never the template",
    reg.homeRoom({ rings: ["command"], rooms: [served.rooms[0]] }) === null);
  check("the inbox chip opens the room that homes the kind it counts", reg.roomHoldingKind(served, "approval.requested") === "inbox");
  check("and opens nothing when no room homes it", reg.roomHoldingKind(served, "ghost.kind") === null);
  check("the index renderer is chosen by the registry's own render field", reg.fallbackFor(served.rooms[5]) === "index" && reg.fallbackFor(served.rooms[4]) === "generic");
  check("as-of reaches a live room with no module", reg.asOfReaches(served.rooms[4], null) === true);
  check("as-of does not reach a room whose module declares asOf false", reg.asOfReaches(served.rooms[4], { asOf: false }) === false);
  check("as-of does not reach a file-borne or an index room", reg.asOfReaches(served.rooms[6], null) === false && reg.asOfReaches(served.rooms[5], null) === false);
  const ctx = { room: served.rooms[3], rooms: served.rooms, door: { call() {} }, onOpen() {}, mode: "sim", token: "t", needs: {}, needsUnplaced: 0, inventories: null, laneMap: {} };
  const fc = reg.foldContext(ctx);
  check("fold() is handed data only: no door, no handler", !("door" in fc) && !("onOpen" in fc) && fc.room === ctx.room && fc.mode === "sim", JSON.stringify(Object.keys(fc)));
  check("the data-mode chip says simulated for sim", reg.modeChip("sim").tone === "sim");
  check("the data-mode chip says live for live", reg.modeChip("live").tone === "live");
  check("an unstated mode is drawn as unstated, never as live", reg.modeChip(undefined).tone === "unknown" && reg.modeChip("weird").tone === "unknown");
  check("the mode dot is the non-real family's token for sim and the product's for live, never a reserved money hue",
    reg.modeChip("sim").dot === "var(--sim-fg)" && reg.modeChip("live").dot === "var(--mode-live)" && reg.modeChip(undefined).dot === "var(--text-3)");
  // The header's inbox chip and the dock's citation line are decisions, so they live here (spec-fidelity).
  check("the inbox chip says unread for a failed read, never inbox zero", reg.inboxChip(null).label === "inbox unread" && reg.inboxChip(null).isWaiting === false && reg.inboxChip(Number.NaN).label === "inbox unread");
  check("the inbox chip says inbox zero only for a measured zero", reg.inboxChip(0).label === "Inbox zero" && reg.inboxChip(0).isWaiting === false);
  check("the inbox chip counts what is waiting, and weighs it", reg.inboxChip(3).label === "3 waiting" && reg.inboxChip(3).isWaiting === true);
  check("the dock's citation line counts receipts, singular and plural, and says they were not checked here",
    reg.citationLine("ANSWERED BY THE READER", 1) === "answered by the reader · 1 receipt cited -- not checked here; the room that answers questions checks each one"
    && /· 4 receipts cited/.test(reg.citationLine("X", 4)) && /· 0 receipts cited/.test(reg.citationLine("X", -2)));
}
{
  const shell = await import(pathToFileURL(join(LIB, "shell.mjs")).href);
  const ctx = { inTextField: false, paletteOpen: false };
  const g = shell.keyAction({ key: "g" }, ctx);
  check("g asks for home and names no room: home is the registry's to say", g && g.type === "room-home" && !("room" in g), JSON.stringify(g));
  check("shell.mjs no longer exports a hard-coded HOME room", !("HOME" in shell), Object.keys(shell).join(","));
}

// ── the real tree: the browser's attachment and face-coverage's module half agree ──
const coverage = await import(pathToFileURL(join(REPO, ".claude", "scripts", "core", "face-coverage.mjs")).href);
{
  const registry = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
  const MODULES = join(SRC, "modules");
  const found = {};
  let folders = 0;
  for (const ring of readdirSync(MODULES)) {
    if (!statSync(join(MODULES, ring)).isDirectory()) continue;
    for (const id of readdirSync(join(MODULES, ring))) {
      const dir = join(MODULES, ring, id);
      if (!statSync(dir).isDirectory()) continue;
      folders++;
      const key = (f) => `./modules/${ring}/${id}/${f}`;
      found[key("module.mjs")] = await import(pathToFileURL(join(dir, "module.mjs")).href);
      found[key("fold.mjs")] = await import(pathToFileURL(join(dir, "fold.mjs")).href);
      found[key("ops.mjs")] = await import(pathToFileURL(join(dir, "ops.mjs")).href);
      // A .tsx cannot be imported by node. Its PRESENCE is what the frame needs here; face-pure
      // reads what is inside it.
      if (existsSync(join(dir, "View.tsx"))) found[key("View.tsx")] = { default: View, Icon };
    }
  }
  check("the real tree holds module folders (vacuous-pass guard)", folders > 0, `folders=${folders}`);
  const a = reg.attachModules(registry, reg.collectModules(found));
  check("every real module folder attaches, with no problem", Object.keys(a.attached).length === folders && a.problems.length === 0, show(a));
  const openable = registry.rooms.filter((r) => r.status !== "template").length;
  check("attached + generic = every openable served room", Object.keys(a.attached).length + a.generic.length === openable, `${Object.keys(a.attached).length}+${a.generic.length} vs ${openable}`);

  check("face-coverage exports its module half", typeof coverage.treeModules === "function" && typeof coverage.moduleFindings === "function");
  const tree = coverage.treeModules(REPO);
  const half = coverage.moduleFindings(tree);
  check("face-coverage's module half reads the same folder count", half.folders === folders, `coverage=${half.folders} frame=${folders}`);
  check("face-coverage's module half finds nothing on the real tree", half.findings.length === 0, JSON.stringify(half.findings));
  check("the generic rooms the gate REPORTS are exactly the ones the browser renders generic",
    JSON.stringify(half.generic) === JSON.stringify(a.generic), `coverage=${half.generic.join(",")} frame=${a.generic.join(",")}`);
  check("the exemption list is EMPTY until the factory and company rings add their rows (ADR-1327)", half.exemptions === 0, `exemptions=${half.exemptions}`);

  // The two readers AGREE on an exemption too (face v2 Phase 02 attack): a folder for an ADR-1327
  // extra with its row is fine for the gate and an extra -- not an orphan -- for the browser, while
  // the same folder with no row is an orphan for both. Built on the real contracts, one folder added.
  const extra = (tree.extras || [])[0];
  check("the real contracts name an ADR-1327 extra to test the agreement with (vacuous-pass guard)", Boolean(extra), JSON.stringify(tree.extras));
  if (extra) {
    const withFolder = { ...tree, folders: [...tree.folders, { ring: extra.ring, id: extra.id }] };
    const withRow = { ...withFolder, exemptions: [{ id: extra.id, adr: "ADR-1327" }] };
    const foundExtra = { ...found,
      [`./modules/${extra.ring}/${extra.id}/module.mjs`]: { default: { id: extra.id, ring: extra.ring, routes: [], asOf: true } },
      [`./modules/${extra.ring}/${extra.id}/fold.mjs`]: { fold: () => ({}) },
      [`./modules/${extra.ring}/${extra.id}/ops.mjs`]: { ops: [] },
      [`./modules/${extra.ring}/${extra.id}/View.tsx`]: { default: View, Icon } };
    const gateRow = coverage.moduleFindings(withRow);
    const pageRow = reg.attachModules(registry, reg.collectModules(foundExtra), gateRow.exempted);
    check("EXEMPTION AGREEMENT: with its row, the gate finds nothing and the browser keeps the extra, not an orphan",
      gateRow.findings.length === 0 && pageRow.problems.length === 0 && (pageRow.extras || []).includes(`${extra.ring}/${extra.id}`) && JSON.stringify(gateRow.generic) === JSON.stringify(pageRow.generic),
      JSON.stringify({ gate: gateRow.findings, page: pageRow.problems, extras: pageRow.extras }));
    const gateBare = coverage.moduleFindings(withFolder);
    const pageBare = reg.attachModules(registry, reg.collectModules(foundExtra), gateBare.exempted);
    check("EXEMPTION AGREEMENT: without its row, the gate and the browser both name the orphan",
      gateBare.findings.some((f) => f.includes(`"${extra.id}"`) && f.includes("orphan")) && pageBare.problems.some((p) => p.kind === "orphan" && p.key === `${extra.ring}/${extra.id}`),
      JSON.stringify({ gate: gateBare.findings, page: pageBare.problems }));
  }
}

// ── the shell names no room ──
const servedIds = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8")).rooms.map((r) => r.id);
/** Every quoted literal whose whole value is a served id, or a route to one (`/id`, `#/id`, `#id`). */
const namedRooms = (text) => {
  const hits = [];
  const re = /(["'`])(#?\/?)([a-z][a-z0-9-]*)\1/g;
  for (const m of text.matchAll(re)) if (servedIds.includes(m[3])) hits.push(m[0]);
  return hits;
};
{
  check("the served id list is there to scan for (vacuous-pass guard)", servedIds.length >= 30, `ids=${servedIds.length}`);
  // DERIVED, not listed (face v2 Phase 02 attack): every source file under face/src is shell unless it
  // belongs to a room, so a new router or nav file anywhere is scanned the day it lands. The room-owned
  // parts are excluded BY NAME, each for the reason that makes it true:
  const ROOM_OWNED = new Map([
    ["modules", "a module names its own room: that is what a module is"],
    ["rooms", "the Cycle 15 renderers the carried modules mount, each naming its own room (Phase 03 deletes them)"],
    ["face", "the unmounted face stage"],
    ["ui", "the kit's tone vocabulary shares words with room ids ('money' is a tone)"],
    ["lib/rooms.mjs", "the Cycle 15 room decisions, which name the rooms they decide for"],
    ["lib/map.mjs", "the Map room's own decisions"],
    ["lib/ask.mjs", "the Ask arc and Council rooms' own decisions"],
    ["lib/inbox.mjs", "the Inbox and Today rooms' own decisions"],
    ["lib/money.mjs", "the Money and Ventures rooms' own decisions"],
    ["lib/spine.mjs", "the Spine room's own decisions"],
    ["lib/stage.mjs", "the face stage's decisions"],
  ]);
  const walk = (dir, rel, out) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (ROOM_OWNED.has(r)) continue;
      if (e.isDirectory()) walk(join(dir, e.name), r, out);
      else if (/\.(tsx|ts|mjs|js|jsx)$/.test(e.name)) out.push(join(dir, e.name));
    }
    return out;
  };
  const files = walk(SRC, "", []);
  for (const must of [join(SRC, "App.tsx"), join(SRC, "main.tsx"), join(LIB, "shell.mjs"), join(LIB, "registry.mjs"), join(SRC, "shell", "Rail.tsx")]) {
    check(`the derived shell scan includes ${relative(REPO, must).split(sep).join("/")}`, files.includes(must));
  }
  for (const [path] of ROOM_OWNED) check(`an excluded room-owned path still exists: face/src/${path}`, existsSync(join(SRC, ...path.split("/"))));
  let scanned = 0;
  for (const f of files) {
    scanned++;
    const hits = namedRooms(readFileSync(f, "utf8"));
    check(`no served room is named in ${relative(REPO, f).split(sep).join("/")}`, hits.length === 0, hits.join(" "));
  }
  check("the shell scan read every shell file (App, main, shell.mjs, registry.mjs, the shell folder, door and mood)", scanned >= 10, `scanned=${scanned}`);
  // The scan's own negative control: the same function FAILs planted names and passes prose.
  check("MUTANT: a planted onOpen('money') is found", namedRooms("onClick={() => onOpen('money')}").length === 1);
  check("MUTANT: a planted route literal is found", namedRooms('href="#/inbox"').length === 1 && namedRooms("go(`/spine`)").length === 1 && namedRooms("'#inbox'").length === 1);
  check("a room's name in prose, a ring word in a sentence, and a method named map are not names",
    namedRooms("the money ring holds eight rooms; rows.map((r) => r); 'moneyish'; \"inbox zero\"").length === 0);
}

// ── the read host (face v2 Phase 03, REQ-05): a module declares routes, fold asks for reads, the host loads them ──
const door = await import(pathToFileURL(join(LIB, "door.mjs")).href);
{
  check("READ HOST: door.mjs names the door's routes and registry.mjs exports the read host (vacuous-pass guard)",
    door.DOOR_ROUTES && typeof door.DOOR_ROUTES === "object"
    && ["readKey", "readPath", "readProblem", "plannedReads", "readsToLoad", "payloadsFor", "payloadOf", "foldModule", "actProblem", "actStarted", "actSettled", "afterAct", "notServed", "notServedOf"]
      .every((k) => typeof reg[k] === "function"),
    Object.keys(reg).join(","));
}
if (door.DOOR_ROUTES && typeof reg.readKey === "function") {
  const R = door.DOOR_ROUTES;
  // DOOR_ROUTES is read off arc-dash's own ROUTES table, method for method -- a route the face thinks
  // exists and the door does not serve is how a panel would wait forever.
  const dash = readFileSync(join(REPO, ".claude", "scripts", "hq", "arc-dash.mjs"), "utf8");
  const served = [...dash.matchAll(/\{ method: "(GET|POST)", (path|prefix): "(\/api\/[a-z/-]*)"/g)]
    .map((m) => `${m[1]} ${m[2] === "prefix" ? `${m[3]}:id` : m[3]}`).sort();
  const named = Object.entries(R).map(([route, spec]) => `${spec.method} ${route}`).sort();
  check("DOOR_ROUTES names exactly the routes arc-dash serves, method for method", served.length >= 10 && JSON.stringify(served) === JSON.stringify(named), `dash=${served.join(",")} face=${named.join(",")}`);

  const manifest = { id: "board", ring: "command", routes: ["/api/board", "/api/lane/:id", "/api/spine"], asOf: true };
  const mod = { key: "command/board", ring: "command", id: "board", manifest, ops: [], View, Icon, fold: (payloads, ctx) => ({ keys: Object.keys(payloads), picks: ctx.picks }) };
  const fctx = { room: { id: "board" }, rooms: [], door: null, onOpen: () => {}, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: null, laneMap: undefined };
  const board = reg.readKey({ route: "/api/board" });
  const undeclared = reg.readKey({ route: "/api/inbox" });

  let threw = null;
  try { reg.foldModule(mod, { [board]: { state: "ok", data: {} }, [undeclared]: { state: "ok", data: { secret: 1 } } }, fctx, {}); } catch (e) { threw = e; }
  check("UNDECLARED: a payload for a route the manifest does not declare FAILs the fold (REQ-05)", threw !== null && String(threw.message).includes("/api/inbox"), String(threw && threw.message));
  const ok = reg.foldModule(mod, { [board]: { state: "ok", data: {} } }, fctx, { lane: "face" });
  check("a declared route's payload reaches fold() under its read key", Array.isArray(ok.keys) && ok.keys.length === 1 && ok.keys[0] === board, JSON.stringify(ok));
  check("fold() receives the View's picks through its context, as a copy", ok.picks && ok.picks.lane === "face", JSON.stringify(ok.picks));
  let threwKey = null;
  try { reg.payloadsFor(manifest, { "not a key": { state: "ok", data: 1 } }); } catch (e) { threwKey = e; }
  check("UNDECLARED: a payload under a key that is not a read key FAILs too", threwKey !== null);

  const bad = reg.collectModules({ ...ns("command", "policy"), "./modules/command/policy/module.mjs": { default: { id: "policy", ring: "command", routes: ["/api/policy"], asOf: true } } });
  check("a manifest declaring a route the door does not serve does not attach (a NOT SERVED panel, never a route)", bad.modules.length === 0 && bad.problems.some((p) => p.kind === "manifest" && p.why.includes("/api/policy")), JSON.stringify(bad.problems));

  const refuse = (name, read, needle) => {
    const why = reg.readProblem(read, manifest);
    check(`READ REFUSED: ${name}`, typeof why === "string" && why.includes(needle), String(why));
  };
  refuse("a route this module does not declare", { route: "/api/inbox" }, "/api/inbox");
  refuse("a route the door does not serve", { route: "/api/policy" }, "/api/policy");
  refuse("a param route with no id", { route: "/api/lane/:id" }, "id");
  refuse("a plain route given an id", { route: "/api/board", param: "x" }, "id");
  refuse("a query key the route does not take", { route: "/api/spine", query: { secret: "1" } }, "secret");
  refuse("asof -- the door client's, never a module's", { route: "/api/spine", query: { asof: "2026-09-01" } }, "asof");
  refuse("a query value that is an object", { route: "/api/spine", query: { kind: { x: 1 } } }, "kind");
  check("READ REFUSED: an act route is never a read -- acts go through ctx.onAct",
    typeof reg.readProblem({ route: "/api/decide" }, { ...manifest, routes: [...manifest.routes, "/api/decide"] }) === "string");
  check("a declared read with its id and query passes", reg.readProblem({ route: "/api/lane/:id", param: "face" }, manifest) === null && reg.readProblem({ route: "/api/spine", query: { kind: "phase.closed", limit: 40 } }, manifest) === null);

  const k1 = reg.readKey({ route: "/api/spine", query: { kind: "a", limit: 5 } });
  const k2 = reg.readKey({ route: "/api/spine", query: { limit: 5, kind: "a" } });
  const k3 = reg.readKey({ route: "/api/lane/:id", param: "a|b" });
  const k4 = reg.readKey({ route: "/api/lane/:id", param: "a", query: {} });
  check("readKey: one key per read -- query order does not matter", k1 === k2, `${k1} ${k2}`);
  check("readKey: a separator in an id cannot collide with another read", k3 !== k4 && k3 !== reg.readKey({ route: "/api/lane/:id", param: "a" }), `${k3} ${k4}`);
  check("readPath: the id is encoded and the query sorted", reg.readPath({ route: "/api/lane/:id", param: "a b/c" }) === "/api/lane/a%20b%2Fc"
    && reg.readPath({ route: "/api/spine", query: { limit: 5, kind: "phase.closed" } }) === "/api/spine?kind=phase.closed&limit=5", reg.readPath({ route: "/api/spine", query: { limit: 5, kind: "phase.closed" } }));

  const plan = reg.plannedReads({ reads: [{ route: "/api/board" }, { route: "/api/board" }, { route: "/api/inbox" }, { route: "/api/lane/:id", param: "face", poll: true }] }, manifest);
  check("plannedReads: a repeated read is planned once, and a refused one is named, not planned",
    plan.reads.length === 2 && plan.problems.length === 1 && plan.problems[0].includes("/api/inbox") && plan.reads.every((r) => typeof r.key === "string" && typeof r.path === "string"), JSON.stringify(plan));
  check("plannedReads: a fold that returns no reads plans none", reg.plannedReads({}, manifest).reads.length === 0 && reg.plannedReads(null, manifest).reads.length === 0);
  const laneKey = reg.readKey({ route: "/api/lane/:id", param: "face" });
  check("readsToLoad: a planned read neither loaded nor in flight loads",
    reg.readsToLoad(plan.reads, {}, new Set(), false).length === 2);
  check("readsToLoad: a loaded read and an in-flight read do not load again",
    reg.readsToLoad(plan.reads, { [board]: { state: "ok", data: {} } }, new Set([laneKey]), false).length === 0);
  check("readsToLoad: a polled read loads again when a poll is due; an unpolled one does not",
    JSON.stringify(reg.readsToLoad(plan.reads, { [board]: { state: "ok", data: {} }, [laneKey]: { state: "ok", data: {} } }, new Set(), true).map((r) => r.key)) === JSON.stringify([laneKey]));
  check("payloadOf: a read not loaded yet is loading, never absent", reg.payloadOf({}, { route: "/api/board" }).state === "loading" && reg.payloadOf({ [board]: { state: "ok", data: 7 } }, { route: "/api/board" }).data === 7);

  const actManifest = { ...manifest, routes: [...manifest.routes, "/api/decide"] };
  check("ACT REFUSED: an act on a route the manifest does not declare", typeof reg.actProblem("/api/decide", { id: "x" }, manifest) === "string");
  check("ACT REFUSED: an act on a read route", typeof reg.actProblem("/api/board", {}, actManifest) === "string");
  check("ACT REFUSED: an act whose body is not an object", typeof reg.actProblem("/api/decide", "approve", actManifest) === "string");
  check("a declared act with an object body passes", reg.actProblem("/api/decide", { id: "x" }, actManifest) === null);
  const s1 = reg.actStarted({ [board]: { state: "ok", data: {} } }, "/api/decide", { id: "a" });
  const s2 = reg.actStarted(s1.loaded, "/api/decide", { id: "b" });
  const settled = reg.actSettled(s2.loaded, "/api/decide", s1.n, { state: "refused", code: "BAD_REASON", human: "no reason" });
  const log = reg.payloadOf(settled, { route: "/api/decide", act: true });
  check("actStarted/actSettled: an act's records keep their order and settle by number",
    s1.n === 0 && s2.n === 1 && log.state === "ok" && Array.isArray(log.data) && log.data.length === 2 && log.data[0].result.state === "refused" && log.data[1].result.state === "pending", JSON.stringify(log));
  const after = reg.afterAct(settled, "/api/decide");
  check("afterAct: a stamp drops every read so the host reads again, and keeps the act log", !Object.hasOwn(after, board) && reg.payloadOf(after, { route: "/api/decide", act: true }).data.length === 2, JSON.stringify(Object.keys(after)));
  const askLoaded = reg.actStarted({ [board]: { state: "ok", data: {} } }, "/api/ask", { q: "x" }).loaded;
  check("afterAct: an ask changes nothing a read shows, so the reads stay", Object.hasOwn(reg.afterAct(askLoaded, "/api/ask"), board));
  let actUndeclared = null;
  try { reg.foldModule(mod, s1.loaded, fctx, {}); } catch (e) { actUndeclared = e; }
  check("UNDECLARED: an act log for an undeclared route FAILs the fold like a read does", actUndeclared !== null && String(actUndeclared.message).includes("/api/decide"));

  // ── the Phase 03 attack on the read host: each confirmed hole, pinned ──
  {
    let calls = 0;
    const tricky = { get route() { calls++; return calls <= 1 ? "/api/board" : "/api/pnl"; } };
    const p = reg.plannedReads({ reads: [tricky] }, manifest);
    check("R1: a getter route is read ONCE -- the read checked is the read keyed and pathed",
      p.reads.length === 1 && p.reads[0].route === "/api/board" && p.reads[0].path === "/api/board" && JSON.parse(p.reads[0].key)[0] === "/api/board" && calls === 1, JSON.stringify({ p, calls }));
  }
  {
    const loose = { id: "board", ring: "command", routes: ["/api/board"], asOf: true };
    const got = reg.collectModules({ ...ns("command", "board"), "./modules/command/board/module.mjs": { default: loose } });
    loose.routes.push("/api/pnl");
    const attachedManifest = got.modules[0] ? got.modules[0].manifest : null;
    check("R2: a module attaches a FROZEN copy of its manifest -- widening the original afterwards changes nothing",
      attachedManifest !== null && Object.isFrozen(attachedManifest) && Object.isFrozen(attachedManifest.routes) && attachedManifest.routes.length === 1, JSON.stringify(attachedManifest));
  }
  {
    const lone = `face${String.fromCharCode(0xd800)}`;
    let threwPlan = null;
    let planned = null;
    try { planned = reg.plannedReads({ reads: [{ route: "/api/lane/:id", param: lone }] }, manifest); } catch (e) { threwPlan = e; }
    check("R3: an id with an unpaired surrogate is refused by readProblem, and planning never throws",
      threwPlan === null && typeof reg.readProblem({ route: "/api/lane/:id", param: lone }, manifest) === "string" && planned !== null && planned.reads.length === 0, String(threwPlan));
    check("R5: an id that is a dot segment is refused", typeof reg.readProblem({ route: "/api/lane/:id", param: ".." }, manifest) === "string" && typeof reg.readProblem({ route: "/api/lane/:id", param: "." }, manifest) === "string");
  }
  {
    const laneAct = reg.readKey({ route: "/api/lane/:id", param: "act" });
    const started = reg.actStarted({ [laneAct]: { state: "ok", data: { stale: true } } }, "/api/decide", { id: "x" }).loaded;
    const dropped = reg.dropReads(started);
    check("R4: dropReads drops a read of a lane named act, and keeps the act log", !Object.hasOwn(dropped, laneAct) && Object.hasOwn(dropped, reg.readKey({ route: "/api/decide", act: true })), JSON.stringify(Object.keys(dropped)));
  }
  check("R6: the host can ask whether a route is declared before it stores an act", reg.routeDeclared(manifest, "/api/board") === true && reg.routeDeclared(manifest, "/api/pnl") === false && reg.routeDeclared(manifest, "__proto__") === false);
  {
    let getterCalls = 0;
    const withGetter = { get panels() { getterCalls++; return { deep: reg.notServed("x", "/api/x", "y") }; } };
    const inMap = reg.notServedOf({ m: new Map([["k", reg.notServed("Mapped", "/api/m", "s")]]), s: new Set([reg.notServed("Set", "/api/s", "s")]), withGetter });
    check("R7: notServedOf finds entries in a Map and a Set, and never calls a getter", inMap.length === 2 && getterCalls === 0, JSON.stringify({ inMap, getterCalls }));
  }
  {
    const p = reg.plannedReads({ reads: [{ route: "/api/board" }, { route: "/api/board", poll: true }] }, manifest);
    check("R8: a repeated read keeps the poll flag of either copy", p.reads.length === 1 && p.reads[0].poll === true, JSON.stringify(p.reads));
  }
  check("the host knows which acts re-read everything", reg.actRereads("/api/decide") === true && reg.actRereads("/api/ask") === false && reg.actRereads("/api/board") === false);

  const ns1 = reg.notServed("Policy ladder", "/api/policy", "the ladder at a glance");
  check("notServed names its panel and the route it needs, and is marked for a View by a boolean field", ns1.isNotServed === true && ns1.panel === "Policy ladder" && ns1.route === "/api/policy" && typeof ns1.sentence === "string");
  const found2 = reg.notServedOf({ kpis: [ns1], panels: [{ title: "x", body: { deep: [reg.notServed("Learned", "/api/learn", "rules")] } }], plain: "text" });
  check("notServedOf finds every NOT SERVED entry in a fold's output, nested, in order",
    found2.length === 2 && found2[0].route === "/api/policy" && found2[1].route === "/api/learn", JSON.stringify(found2));
}

// ── shipped rings (face v2 Phase 03): a ring listed here is PORTED, and its NOT SERVED list is derived ──
const SHIPPED_RINGS = ["command", "kernel"];
{
  const contract = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "modules-v2.json"), "utf8"));
  const registry = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
  const exemptions = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "module-exemptions.json"), "utf8")).exemptions.map((e) => e.id);
  const MODULES = join(SRC, "modules");
  for (const ring of SHIPPED_RINGS) {
    const want = contract.modules.filter((m) => m.ring === ring && (m.class !== "extra" || exemptions.includes(m.id))).map((m) => m.id).sort();
    const ringDir = join(MODULES, ring);
    const have = existsSync(ringDir) ? readdirSync(ringDir).filter((id) => statSync(join(ringDir, id)).isDirectory()).sort() : [];
    check(`SHIPPED RING ${ring}: its module folders are modules-v2.json's ids for the ring`, want.length > 0 && JSON.stringify(have) === JSON.stringify(want), `have=${have.join(",")} want=${want.join(",")}`);
    const rows = [];
    for (const id of have) {
      const dir = join(ringDir, id);
      const viewText = existsSync(join(dir, "View.tsx")) ? readFileSync(join(dir, "View.tsx"), "utf8") : "";
      check(`SHIPPED RING ${ring}: ${id}'s View mounts no Cycle 15 renderer from face/src/rooms/`, viewText !== "" && !/from\s+["'][^"']*\/rooms\//.test(viewText));
      const manifest = (await import(pathToFileURL(join(dir, "module.mjs")).href)).default;
      const notDoor = (manifest.routes || []).filter((r) => !Object.hasOwn(door.DOOR_ROUTES || {}, r));
      check(`SHIPPED RING ${ring}: ${id} declares only door routes`, Array.isArray(manifest.routes) && notDoor.length === 0, notDoor.join(","));
      const room = registry.rooms.find((r) => r.id === id) || { id, ring, name: id, sentence: "", lede: "", holds: { kinds: [] } };
      const fctx = { room, rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: registry.inventories, laneMap: undefined, picks: {} };
      let folded = null;
      try { folded = (await import(pathToFileURL(join(dir, "fold.mjs")).href)).fold({}, fctx); } catch (e) { check(`SHIPPED RING ${ring}: ${id}'s fold runs with nothing loaded yet`, false, e.message); continue; }
      check(`SHIPPED RING ${ring}: ${id}'s fold runs with nothing loaded yet`, folded !== null && typeof folded === "object");
      for (const ns of (typeof reg.notServedOf === "function" ? reg.notServedOf(folded) : [])) rows.push(`${id} | ${ns.panel} | ${ns.route}`);
    }
    // The evidence list is what Phase 04 builds; it must be what the folds actually render, both ways.
    const listFile = join(REPO, "initiatives", "face", "evidence", "phase-03", `not-served-${ring}.md`);
    const listed = existsSync(listFile)
      ? [...readFileSync(listFile, "utf8").matchAll(/^\| `([a-z][a-z0-9-]*)` \| ([^|]+?) \| `(\/api\/[^`]+)` \|/gm)].map((m) => `${m[1]} | ${m[2]} | ${m[3]}`)
      : null;
    check(`NOT SERVED LIST ${ring}: evidence/phase-03/not-served-${ring}.md exists`, listed !== null);
    const derived = [...new Set(rows)].sort();
    check(`NOT SERVED LIST ${ring}: the list names exactly what the folds render NOT SERVED, both ways`,
      listed !== null && JSON.stringify([...new Set(listed)].sort()) === JSON.stringify(derived),
      `listed-only=${(listed || []).filter((r) => !derived.includes(r)).join(" ; ")} derived-only=${derived.filter((r) => !(listed || []).includes(r)).join(" ; ")}`);
  }
}

// ── F2 (Cycle 15 room sweep): the scheduler's lede promises only what the module shows ──
// Four promises: jobs, their next fire, their last outcome, the heartbeat. Each is pinned to the place
// that carries it -- a panel the fold fills, or a NOT SERVED entry naming the route that would fill it --
// so a lede that grows a fifth promise, or a panel that quietly stops being drawn, fails here.
{
  const registry = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
  const room = registry.rooms.find((r) => r.id === "scheduler");
  const dir = join(SRC, "modules", "kernel", "scheduler");
  const lede = String((room && room.lede) || "").toLowerCase();
  const promises = ["jobs", "next fire", "last outcome", "heartbeat"];
  check("F2: the served scheduler lede promises exactly the four things this arm pins",
    promises.every((p) => lede.includes(p)), `lede=${lede}`);
  if (existsSync(join(dir, "fold.mjs"))) {
    const ctx = { room, rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: registry.inventories, laneMap: undefined, picks: {} };
    const folded = (await import(pathToFileURL(join(dir, "fold.mjs")).href)).fold({}, ctx);
    const ns = typeof reg.notServedOf === "function" ? reg.notServedOf(folded) : [];
    const homed = (room && room.holds && Array.isArray(room.holds.jobs) ? room.holds.jobs : []).slice().sort();
    const drawn = Array.isArray(folded.jobs) ? folded.jobs.map((j) => j.key).sort() : [];
    check("F2: JOBS -- the fold draws a row per job the served registry homes here",
      homed.length > 0 && JSON.stringify(drawn) === JSON.stringify(homed), `drawn=${drawn.join(",")} homed=${homed.join(",")}`);
    check("F2: LAST OUTCOME -- every job row carries one, and says it is unread rather than inventing it",
      Array.isArray(folded.jobs) && folded.jobs.every((j) => typeof j.last === "string" && j.last !== ""), JSON.stringify(drawn));
    const nsFor = (re) => ns.filter((n) => re.test(n.panel) && n.route === "/api/jobs");
    check("F2: NEXT FIRE -- not served by the door, and named as NOT SERVED against the route that would serve it",
      nsFor(/next fire/i).length === 1, ns.map((n) => `${n.panel}=${n.route}`).join(" ; "));
    check("F2: HEARTBEAT -- named as NOT SERVED, and what the door DOES hold is drawn as the last fire, not as a beat",
      nsFor(/heartbeat/i).length === 1 && folded.lastFire !== undefined && typeof folded.lastFire.hasFire === "boolean"
      && folded.lastFire.hasFire === false && !/heartbeat/i.test(String(folded.lastFire.line)),
      `lastFire=${JSON.stringify(folded.lastFire)}`);
  } else check("F2: the scheduler module exists to be folded", false, dir);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 60 ? 0 : 1;
