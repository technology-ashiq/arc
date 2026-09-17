#!/usr/bin/env node
// face-module -- `/arc-face-module RING/ID`: scaffold one module in one command (face v2 Phase 02,
// REQ-03, ADR-1320, ADR-1321, ADR-1327).
//
// It writes the four files of a module -- module.mjs, fold.mjs, ops.mjs, View.tsx -- from the
// template below into face/src/modules/RING/ID, and then proves them: face-pure over the modules tree
// and face-coverage's module half over the repo. Green on both, it exits 0. Red on either, it removes
// everything it wrote and exits 1, so a failed scaffold never leaves a half-module behind.
//
// It refuses, by name and before writing anything:
//   - an id the served registry does not serve (rooms.generated.json is what GET /api/rooms serves,
//     verbatim; a module attaches to a served room, ADR-1321);
//   - a served id under a ring it is not served in (the served ring wins, ADR-1306);
//   - the lane-room template, which is a shape every lane instantiates and not a room;
//   - a v0.7 extra room (ADR-1327) whose exemption row is not in module-exemptions.json yet;
//   - an id that already has a module, in any ring.
//
// Usage: face-module.mjs RING/ID [--root PATH]   (--root: the repo to scaffold into; default this one)
// Exit:  0 scaffolded and green · 1 refused, or red and rolled back · 2 bad arguments or an unreadable registry
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintModules, MODULE_FILES } from "../core/face-pure.mjs";
import { treeModules, moduleFindings } from "../core/face-coverage.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const NAME = /^[a-z][a-z0-9-]*$/;
// Passes the kebab grammar and still breaks mkdir on exactly one of the three CI legs.
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const EXEMPTION_ADR = "ADR-1327";

class UsageError extends Error {}

/** RING/ID and --root, or a refusal. Every near miss is exit 2, never a guessed default. */
export function parseArgs(argv) {
  let target = null;
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") {
      if (root !== null) throw new UsageError("--root given twice -- which one is meant is not a guess");
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--") || v.trim() === "") throw new UsageError("--root needs a path");
      root = v;
      i++;
      continue;
    }
    if (a.startsWith("-")) throw new UsageError(`unknown flag ${JSON.stringify(a)} (the only flag is --root PATH)`);
    if (target !== null) throw new UsageError(`one RING/ID at a time -- got ${JSON.stringify(target)} and ${JSON.stringify(a)}`);
    target = a;
  }
  if (target === null) throw new UsageError("name the module as RING/ID, for example command/chat-mcp");
  const parts = target.split("/");
  if (parts.length !== 2) throw new UsageError(`${JSON.stringify(target)} is not RING/ID`);
  const [ring, id] = parts;
  if (!NAME.test(ring) || !NAME.test(id)) throw new UsageError(`${JSON.stringify(target)}: a ring and an id are kebab-case (a-z, 0-9, -), starting with a letter`);
  if (WINDOWS_DEVICE.test(ring) || WINDOWS_DEVICE.test(id)) throw new UsageError(`${JSON.stringify(target)}: a Windows device name cannot be a folder on every CI leg`);
  return { ring, id, root };
}

/**
 * The four files of a new module. The id and ring are grammar-checked before they reach here, and
 * enter the manifest through JSON.stringify; the room's name and sentence are read at runtime from the
 * served registry, never pasted into the source.
 * @param {string} ring @param {string} id
 * @returns {Record<string, string>}
 */
export function templateFiles(ring, id) {
  const key = `${ring}/${id}`;
  return {
    "module.mjs": `// module.mjs -- ${key}: the manifest (ADR-1320, ADR-1321). Scaffolded by /arc-face-module.
//
// \`routes\` names the door routes fold() reads (REQ-05). It starts empty, so the View renders NOT SERVED
// until a route this module needs is served and named here (ADR-1324).
export default Object.freeze({
  id: ${JSON.stringify(id)},
  ring: ${JSON.stringify(ring)},
  routes: Object.freeze([]),
  asOf: true,
});
`,
    "fold.mjs": `// fold.mjs -- ${key}: every decision this module makes (ADR-1320). node imports it with no install:
// it imports nothing but relative .mjs and node builtins, and face-pure fails anything else. A field the
// View branches on is a boolean named is/has/can/should/show.
import manifest from "./module.mjs";

/**
 * @typedef {object} Folded
 * @property {string} title        the room's opening sentence, from the served registry
 * @property {string} lede
 * @property {boolean} hasNoRoute  true while the manifest names no door route: the View renders NOT SERVED
 * @property {string} notServed    what the NOT SERVED panel says
 */

/**
 * @param {Record<string, unknown>} payloads  the declared routes' payloads, keyed by route
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  return {
    title: ctx.room.sentence,
    lede: ctx.room.lede,
    hasNoRoute: manifest.routes.length === 0,
    notServed: \`No door route is declared for \${ctx.room.name} yet -- this module renders what the door serves, and nothing it does not (ADR-1324).\`,
  };
}
`,
    "ops.mjs": `// ops.mjs -- ${key}: the verbs this module offers. None until Phase 05's work door (ADR-1326).
export const ops = Object.freeze([]);
`,
    "View.tsx": `// View.tsx -- ${key}: renders what fold() returned, and decides nothing (ADR-1320). face-pure fails a
// branch here: a condition reads a boolean field fold() returns, and every other decision is fold's.
import type { ModuleContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Empty, HPanel, RoomHead } from '../../../ui/bits'
export { CircleDashed as Icon } from '@phosphor-icons/react'

export default function View({ f }: { f: Folded; ctx: ModuleContext }) {
  return (
    <div>
      <RoomHead title={f.title} hint={f.lede} />
      {f.hasNoRoute && (
        <HPanel title="NOT SERVED">
          <Empty title="NOT SERVED" hint={f.notServed} />
        </HPanel>
      )}
    </div>
  )
}
`,
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { console.error(`face-module: ${e.message}`); return 2; }
  const { ring, id } = opts;
  const key = `${ring}/${id}`;
  const root = opts.root === null ? REPO : resolve(process.cwd(), opts.root);
  const contracts = join(root, "initiatives", "face", "contracts");

  let registry;
  try { registry = readJson(join(contracts, "rooms.generated.json")); }
  catch (e) { console.error(`face-module: the served registry could not be read under ${root} (${e.code ?? e.message}) -- nothing was written`); return 2; }
  if (!registry || !Array.isArray(registry.rooms)) { console.error("face-module: rooms.generated.json carries no rooms list -- nothing was written"); return 2; }

  const refuse = (why) => { console.log(`face-module: REFUSED ${key} -- ${why}`); return 1; };
  const room = registry.rooms.find((r) => r && r.id === id);
  if (!room) {
    let extra = null;
    let exempt = false;
    try { extra = (readJson(join(contracts, "modules-v2.json")).modules || []).find((m) => m && m.class === "extra" && m.id === id) ?? null; } catch { /* no extras readable: not an extra */ }
    try { exempt = (readJson(join(contracts, "module-exemptions.json")).exemptions || []).some((r) => r && r.id === id && r.adr === EXEMPTION_ADR); } catch { /* no rows readable: not exempt */ }
    if (!extra) return refuse(`/api/rooms serves no room "${id}" (${registry.rooms.length} served) -- a module attaches to a served room (ADR-1321)`);
    if (!exempt) return refuse(`"${id}" is a v0.7 extra room /api/rooms does not serve; it takes a module only once its ${EXEMPTION_ADR} exemption row is in initiatives/face/contracts/module-exemptions.json`);
    if (extra.ring !== ring) return refuse(`${EXEMPTION_ADR} places the extra room "${id}" in ring "${extra.ring}"`);
  } else {
    if (room.template === true || room.status === "template") return refuse(`"${id}" is the lane-room template, not a room -- it has no module`);
    if (room.ring !== ring) return refuse(`/api/rooms serves "${id}" in ring "${room.ring}" -- the served ring wins (ADR-1306)`);
  }

  const src = join(root, "face", "src");
  const modulesRoot = join(src, "modules");
  if (existsSync(modulesRoot)) {
    for (const r of readdirSync(modulesRoot)) {
      if (existsSync(join(modulesRoot, r, id))) return refuse(`face/src/modules/${r}/${id} already exists -- a module is scaffolded once`);
    }
  }

  // Write, remembering every directory this run created, so a red verdict removes exactly those.
  const created = [];
  const ensureDir = (p) => { if (!existsSync(p)) { mkdirSync(p); created.push(p); } };
  const ringDir = join(modulesRoot, ring);
  const dir = join(ringDir, id);
  try {
    if (!existsSync(src)) { console.error(`face-module: ${src} does not exist -- this is not a repo with an L3 face`); return 2; }
    ensureDir(modulesRoot);
    ensureDir(ringDir);
    ensureDir(dir);
    const files = templateFiles(ring, id);
    for (const name of MODULE_FILES) writeFileSync(join(dir, name), files[name], { flag: "wx" });
    console.log(`face-module: wrote ${key} (${MODULE_FILES.join(", ")}) under face/src/modules/${key}`);
  } catch (e) {
    rollback(created, dir);
    console.error(`face-module: could not write ${key} (${e.code ?? e.message}) -- what was written was removed`);
    return 2;
  }

  // Prove it: face-pure over the modules tree, and face-coverage's module half over the repo.
  let green = true;
  try {
    const pure = lintModules(modulesRoot, { srcRoot: src, base: root });
    for (const f of pure.findings) console.log(`FAIL ${f.file}:${f.line}:${f.col} ${f.kind} ${f.detail}`);
    console.log(`face-pure: modules=${pure.modules} folds=${pure.folds} views=${pure.views} files=${pure.files} findings=${pure.findings.length}`);
    if (pure.modules === 0 || pure.findings.length > 0) green = false;
  } catch (e) {
    console.log(`FAIL face-pure could not run: ${e.message}`);
    green = false;
  }
  const tree = treeModules(root);
  const half = moduleFindings(tree);
  for (const f of half.findings) console.log(`FAIL ${f}`);
  if (tree.unreadable) green = false;
  else console.log(`face-coverage (module half): folders=${half.folders} generic=${half.generic.length} orphans=${half.orphans} exemptions=${half.exemptions}`);
  if (half.findings.length > 0) green = false;

  if (!green) {
    rollback(created, dir);
    console.log(`face-module: RED -- ${key} is not green on face-pure and face-coverage, so everything this run wrote was removed`);
    return 1;
  }
  console.log(`face-module: GREEN on face-pure and face-coverage -- ${key} is a module; its View renders NOT SERVED until module.mjs names a door route`);
  return 0;
}

/** Remove what this run created: the module folder, then each directory it made, innermost first. */
function rollback(created, dir = null) {
  if (dir !== null && created.includes(dir)) rmSync(dir, { recursive: true, force: true });
  for (const p of [...created].reverse()) {
    try { if (existsSync(p) && readdirSync(p).length === 0) rmSync(p, { recursive: true, force: true }); }
    catch { /* a directory that will not go is left, and the RED line already says the run failed */ }
  }
}

/** "Was this file RUN, or imported?" -- realpath on BOTH sides, so a symlink or a renamed path still runs it. */
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
