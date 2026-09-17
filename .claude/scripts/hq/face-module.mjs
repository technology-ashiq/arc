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
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, realpathSync, lstatSync } from "node:fs";
import { join, dirname, resolve, relative, sep, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { lintModules, MODULE_FILES, oneLine } from "../core/face-pure.mjs";
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
/** @type {readonly unknown[]} */
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


/** Read a contract file, or say exactly which one could not be read -- never a silent default. */
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Every line this script prints is one line: a folder name or a finding cannot forge a verdict line. */
function say(stream, text) {
  (stream === "err" ? console.error : console.log)(oneLine(text));
}

async function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { say("err", `face-module: ${e.message}`); return 2; }
  const { ring, id } = opts;
  const key = `${ring}/${id}`;
  const root = opts.root === null ? REPO : resolve(process.cwd(), opts.root);
  const contracts = join(root, "initiatives", "face", "contracts");
  const fail2 = (why) => { say("err", `face-module: ${why} -- nothing was written`); return 2; };
  const refuse = (why) => { say("out", `face-module: REFUSED ${key} -- ${why}`); return 1; };

  let registry;
  try { registry = readJson(join(contracts, "rooms.generated.json")); }
  catch (e) { return fail2(`the served registry could not be read under ${root} (${e.code ?? e.message})`); }
  if (!registry || !Array.isArray(registry.rooms)) return fail2("rooms.generated.json carries no rooms list");

  const room = registry.rooms.find((r) => r && r.id === id);
  if (!room) {
    // An unreadable extras list or exemption list is exit 2, never "not an extra" or "not exempt":
    // a refusal for the wrong reason sends the owner to fix a row that is already there.
    let modules;
    let rows;
    try { modules = readJson(join(contracts, "modules-v2.json")).modules; }
    catch (e) { return fail2(`modules-v2.json could not be read (${e.code ?? e.message})`); }
    try { rows = readJson(join(contracts, "module-exemptions.json")).exemptions; }
    catch (e) { return fail2(`module-exemptions.json could not be read (${e.code ?? e.message})`); }
    if (!Array.isArray(modules)) return fail2("modules-v2.json carries no modules list");
    if (!Array.isArray(rows)) return fail2("module-exemptions.json carries no exemptions list");
    const extra = modules.find((m) => m && m.class === "extra" && m.id === id) ?? null;
    const exempt = rows.some((r) => r && r.id === id && r.adr === EXEMPTION_ADR);
    if (!extra) return refuse(`/api/rooms serves no room "${id}" (${registry.rooms.length} served) -- a module attaches to a served room (ADR-1321)`);
    if (!exempt) return refuse(`"${id}" is a v0.7 extra room /api/rooms does not serve; it takes a module only once its ${EXEMPTION_ADR} exemption row is in initiatives/face/contracts/module-exemptions.json`);
    if (extra.ring !== ring) return refuse(`${EXEMPTION_ADR} places the extra room "${id}" in ring "${extra.ring}"`);
  } else {
    if (room.template === true || room.status === "template") return refuse(`"${id}" is the lane-room template, not a room -- it has no module`);
    if (room.ring !== ring) return refuse(`/api/rooms serves "${id}" in ring "${room.ring}" -- the served ring wins (ADR-1306)`);
  }

  const face = join(root, "face");
  const src = join(face, "src");
  const modulesRoot = join(src, "modules");
  const ringDir = join(modulesRoot, ring);
  const dir = join(ringDir, id);

  // A link anywhere on the way down is refused before anything is written: a junction or symlink
  // there would put the module outside --root while every check below reads it as inside.
  let realRoot;
  try { realRoot = realpathSync(root); } catch (e) { return fail2(`--root ${root} could not be resolved (${e.code ?? e.message})`); }
  for (const p of [face, src, modulesRoot, ringDir]) {
    let st;
    try { st = lstatSync(p); } catch (e) {
      if (e && e.code === "ENOENT") continue;
      return fail2(`${p} could not be read (${e.code ?? e.message})`);
    }
    if (st.isSymbolicLink()) return refuse(`${relative(root, p).split(sep).join("/")} is a link (a symlink or a junction) -- a module is written into real folders under --root only`);
    if (!st.isDirectory()) return fail2(`${relative(root, p).split(sep).join("/")} is not a directory`);
    let real;
    try { real = realpathSync(p); } catch (e) { return fail2(`${p} could not be resolved (${e.code ?? e.message})`); }
    const inside = relative(realRoot, real);
    if (inside.startsWith("..") || isAbsolute(inside)) return refuse(`${p} resolves outside --root`);
  }
  if (!existsSync(src)) return fail2(`${src} does not exist -- this is not a repo with an L3 face`);

  // An existing module for this id, in ANY ring. A ring that cannot be read is exit 2, not "absent".
  if (existsSync(modulesRoot)) {
    let rings;
    try { rings = readdirSync(modulesRoot); } catch (e) { return fail2(`face/src/modules could not be read (${e.code ?? e.message})`); }
    for (const r of rings) {
      try { lstatSync(join(modulesRoot, r, id)); } catch (e) {
        if (e && (e.code === "ENOENT" || e.code === "ENOTDIR")) continue;
        return fail2(`face/src/modules/${r} could not be read (${e.code ?? e.message})`);
      }
      return refuse(`face/src/modules/${r}/${id} already exists -- a module is scaffolded once`);
    }
  }

  // Write, remembering every directory this run created, so a red verdict removes exactly those.
  const created = [];
  const ensureDir = (p) => { if (!existsSync(p)) { mkdirSync(p); created.push(p); } };
  try {
    ensureDir(modulesRoot);
    ensureDir(ringDir);
    ensureDir(dir);
    const files = templateFiles(ring, id);
    for (const name of MODULE_FILES) writeFileSync(join(dir, name), files[name], { flag: "wx" });
    say("out", `face-module: wrote ${key} (${MODULE_FILES.join(", ")}) under face/src/modules/${key}`);
  } catch (e) {
    const left = rollback(created, dir);
    say("err", `face-module: could not write ${key} (${e.code ?? e.message}) -- ${left.length ? `and could NOT remove: ${left.join("; ")}` : "what was written was removed"}`);
    return 2;
  }

  // Prove it: face-pure over the modules tree, and face-coverage's module half over the repo. Any
  // throw in either is a RED verdict, never a crash that skips the rollback.
  let green = true;
  try {
    const pure = lintModules(modulesRoot, { srcRoot: src, base: root });
    for (const f of pure.findings) say("out", `FAIL ${f.file}:${f.line}:${f.col} ${f.kind} ${f.detail}`);
    say("out", `face-pure: modules=${pure.modules} folds=${pure.folds} views=${pure.views} files=${pure.files} findings=${pure.findings.length}`);
    if (pure.modules === 0 || pure.findings.length > 0) green = false;
  } catch (e) {
    say("out", `FAIL face-pure could not run: ${e.message}`);
    green = false;
  }
  try {
    const tree = treeModules(root);
    const half = moduleFindings(tree);
    for (const f of half.findings) say("out", `FAIL ${f}`);
    if (tree.unreadable) green = false;
    else say("out", `face-coverage (module half): folders=${half.folders} generic=${half.generic.length} orphans=${half.orphans} exemptions=${half.exemptions}`);
    if (half.findings.length > 0) green = false;
  } catch (e) {
    say("out", `FAIL face-coverage's module half could not run: ${e.message}`);
    green = false;
  }

  if (!green) {
    const left = rollback(created, dir);
    if (left.length) {
      say("out", `face-module: RED -- ${key} is not green on face-pure and face-coverage, and this run could NOT remove what it wrote: ${left.join("; ")} -- remove it by hand before anything reads the tree`);
    } else {
      say("out", `face-module: RED -- ${key} is not green on face-pure and face-coverage, so everything this run wrote was removed`);
    }
    return 1;
  }
  say("out", `face-module: GREEN on face-pure and face-coverage -- ${key} is a module; its View renders NOT SERVED until module.mjs names a door route`);
  return 0;
}

/**
 * Remove what this run created: the module folder, then each directory it made, innermost first.
 * Retries a locked file (an editor, an indexer or antivirus holding it on Windows), and returns what
 * would not go, so the caller NAMES it instead of crashing past the verdict.
 * @returns {string[]} paths left behind, each with its error code
 */
export function rollback(created, dir = null) {
  const left = [];
  const rm = (p) => {
    try { rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
    catch (e) { left.push(`${p} (${e.code ?? e.message})`); }
  };
  if (dir !== null && created.includes(dir)) rm(dir);
  for (const p of [...created].reverse()) {
    if (p === dir) continue;
    try { if (existsSync(p) && readdirSync(p).length === 0) rm(p); }
    catch (e) { left.push(`${p} (${e.code ?? e.message})`); }
  }
  return left;
}

/** "Was this file RUN, or imported?" -- realpath on BOTH sides, so a symlink or a renamed path still runs it. */
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (e) => { say("err", `face-module: unexpected -- ${e && e.message ? e.message : e}`); process.exitCode = 2; },
  );
}
