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
}

// ── the shell names no room ──
const servedIds = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8")).rooms.map((r) => r.id);
/** Every quoted literal whose whole value is a served id, or a route to one (`/id`, `#/id`). */
const namedRooms = (text) => {
  const hits = [];
  const re = /(["'`])(#?\/)?([a-z][a-z0-9-]*)\1/g;
  for (const m of text.matchAll(re)) if (servedIds.includes(m[3])) hits.push(m[0]);
  return hits;
};
{
  check("the served id list is there to scan for (vacuous-pass guard)", servedIds.length >= 30, `ids=${servedIds.length}`);
  const shellDir = join(SRC, "shell");
  const files = [join(SRC, "App.tsx"), join(SRC, "main.tsx"), join(LIB, "shell.mjs"), join(LIB, "registry.mjs"),
    ...readdirSync(shellDir).filter((n) => /\.(tsx|ts|mjs)$/.test(n)).map((n) => join(shellDir, n))];
  let scanned = 0;
  for (const f of files) {
    if (!existsSync(f)) { check(`shell file present: ${relative(REPO, f).split(sep).join("/")}`, false); continue; }
    scanned++;
    const hits = namedRooms(readFileSync(f, "utf8"));
    check(`no served room is named in ${relative(REPO, f).split(sep).join("/")}`, hits.length === 0, hits.join(" "));
  }
  check("the shell scan read App, main, shell.mjs, registry.mjs and the shell folder", scanned >= 6, `scanned=${scanned}`);
  // The scan's own negative control: the same function FAILs planted names and passes prose.
  check("MUTANT: a planted onOpen('money') is found", namedRooms("onClick={() => onOpen('money')}").length === 1);
  check("MUTANT: a planted route literal is found", namedRooms('href="#/inbox"').length === 1 && namedRooms("go(`/spine`)").length === 1);
  check("a room's name in prose, a ring word in a sentence, and a method named map are not names",
    namedRooms("the money ring holds eight rooms; rows.map((r) => r); 'moneyish'; \"inbox zero\"").length === 0);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 60 ? 0 : 1;
