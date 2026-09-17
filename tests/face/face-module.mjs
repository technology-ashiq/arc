#!/usr/bin/env node
// face-module.mjs -- `/arc-face-module RING/ID` proven in scratch copies, with no install
// (face v2 Phase 02, REQ-03, ADR-1320, ADR-1321, ADR-1327).
//
// The scaffold is .claude/scripts/hq/face-module.mjs. In one command it writes the four files of a
// module from a template, and the module it wrote must be green on face-pure and on face-coverage's
// module half -- or it removes what it wrote and exits 1. It refuses, by name, every id the served
// registry (what GET /api/rooms serves, ADR-1306) does not make a module-able room.
//
// Every scaffold runs with --root pointing at a scratch copy: nothing here writes into the repo.
// Before the script exists this suite fails its first check -- the red that comes first.
// VACUOUS-PASS GUARD: the last line is "RAN: <n> checks, <f> failed".
import { mkdtempSync, mkdirSync, cpSync, rmSync, existsSync, readFileSync, writeFileSync, symlinkSync, readdirSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPT = join(REPO, ".claude", "scripts", "hq", "face-module.mjs");
const PURE = join(REPO, ".claude", "scripts", "core", "face-pure.mjs");
const CONTRACTS = join(REPO, "initiatives", "face", "contracts");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

check("the scaffold script exists", existsSync(SCRIPT), SCRIPT);
const exitBefore = process.exitCode;
let mod = null;
try { mod = await import(pathToFileURL(SCRIPT).href); } catch (e) { check("the scaffold imports cleanly", false, e.message); }
check("importing the scaffold runs nothing (its main is guarded)", mod !== null && process.exitCode === exitBefore, `exitCode=${process.exitCode}`);
check("the scaffold exports its template and its argument parser", mod !== null && typeof mod.parseArgs === "function" && typeof mod.templateFiles === "function");

const scratch = mkdtempSync(join(tmpdir(), "face-module-"));
/** A repo-shaped scratch copy: the served registry, the contracts the gates read, face/src/lib and the modules. */
const makeRoot = (name, { rings = null } = {}) => {
  const root = join(scratch, name);
  mkdirSync(join(root, "initiatives", "face", "contracts"), { recursive: true });
  for (const f of ["rooms.generated.json", "modules-v2.json", "module-exemptions.json"]) cpSync(join(CONTRACTS, f), join(root, "initiatives", "face", "contracts", f));
  cpSync(join(REPO, "face", "src", "lib"), join(root, "face", "src", "lib"), { recursive: true });
  mkdirSync(join(root, "face", "src", "modules"), { recursive: true });
  const real = join(REPO, "face", "src", "modules");
  for (const ring of readdirSync(real)) if (rings === null || rings.includes(ring)) cpSync(join(real, ring), join(root, "face", "src", "modules", ring), { recursive: true });
  return root;
};
const run = (root, ...args) => spawnSync(process.execPath, [SCRIPT, ...args, ...(root ? ["--root", root] : [])], { encoding: "utf8", cwd: scratch });
const out = (r) => `status=${r.status}\n${r.stdout}${r.stderr}`;

try {
  const registry = JSON.parse(readFileSync(join(CONTRACTS, "rooms.generated.json"), "utf8"));
  // The room to scaffold is DERIVED: a served, non-template room with no module on this tree. A
  // hard-coded id would go stale the day Phase 03 gives that room its module.
  const hasModule = (id) => readdirSync(join(REPO, "face", "src", "modules")).some((ring) => existsSync(join(REPO, "face", "src", "modules", ring, id)));
  const target = registry.rooms.find((r) => r.status !== "template" && !hasModule(r.id));
  check("the served registry still has a room with no module to scaffold (vacuous-pass guard)", Boolean(target), "every room has a module");

  if (target) {
    const root = makeRoot("green");
    const r = run(root, `${target.ring}/${target.id}`);
    check(`scaffolds ${target.ring}/${target.id} in one command with exit 0`, r.status === 0, out(r));
    check("reports face-pure green on the tree it wrote into", /face-pure: modules=\d+ folds=\d+ views=\d+ files=\d+ findings=0/.test(r.stdout), out(r));
    check("reports face-coverage's module half green", /face-coverage \(module half\): folders=\d+ generic=\d+ orphans=0 exemptions=0/.test(r.stdout), out(r));
    check("ends on the GREEN verdict line", new RegExp(`face-module: GREEN on face-pure and face-coverage -- ${target.ring}/${target.id}`).test(r.stdout), out(r));
    const dir = join(root, "face", "src", "modules", target.ring, target.id);
    const files = existsSync(dir) ? readdirSync(dir).sort() : [];
    check("wrote exactly the four files, and nothing else", files.join(",") === "View.tsx,fold.mjs,module.mjs,ops.mjs", files.join(","));
    if (files.length === 4) {
      const manifest = (await import(pathToFileURL(join(dir, "module.mjs")).href)).default;
      check("module.mjs names its folder and declares no route yet", manifest.id === target.id && manifest.ring === target.ring && Array.isArray(manifest.routes) && manifest.routes.length === 0 && typeof manifest.asOf === "boolean", JSON.stringify(manifest));
      const fold = await import(pathToFileURL(join(dir, "fold.mjs")).href);
      const f = fold.fold({}, { room: target, rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: null, laneMap: {} });
      check("the scaffolded fold says the module reads no route, as a boolean field", f && f.hasNoRoute === true, JSON.stringify(f));
      const ops = await import(pathToFileURL(join(dir, "ops.mjs")).href);
      check("the scaffolded ops list is empty until the work door (ADR-1326)", Array.isArray(ops.ops) && ops.ops.length === 0);
      const view = readFileSync(join(dir, "View.tsx"), "utf8");
      check("the scaffolded View renders NOT SERVED for a module with no route (ADR-1324)", /NOT SERVED/.test(view) && /f\.hasNoRoute/.test(view), view);
      check("the scaffolded View names no served room id as a literal", !registry.rooms.some((x) => new RegExp(`["'\`]${x.id}["'\`]`).test(view)), view);
    }
    const again = spawnSync(process.execPath, [PURE, "--root", join(root, "face", "src", "modules")], { encoding: "utf8" });
    check("face-pure, run on its own over the scaffolded tree, agrees: exit 0", again.status === 0, out(again));
    const twice = run(root, `${target.ring}/${target.id}`);
    check("refuses to scaffold a module that already exists, and changes nothing", twice.status === 1 && /REFUSED/.test(twice.stdout) && /already/.test(twice.stdout), out(twice));
  }

  // ── refusals: what /api/rooms does not make a module-able room ──
  {
    const root = makeRoot("refusals");
    const extras = JSON.parse(readFileSync(join(CONTRACTS, "modules-v2.json"), "utf8")).modules.filter((m) => m.class === "extra");
    const template = registry.rooms.find((r) => r.status === "template");
    const planned = registry.rooms.find((r) => r.status !== "template" && !hasModule(r.id));
    const wrongRing = planned ? registry.rings.find((g) => g !== planned.ring) : null;
    const cases = [
      ["an id the served registry does not serve", "command/ghost-room", /serves no room/],
      ...(template ? [["the lane-room template", `${template.ring}/${template.id}`, /template/]] : []),
      ...(planned && wrongRing ? [["a served id under a ring it is not served in -- the served ring wins", `${wrongRing}/${planned.id}`, new RegExp(`ring "${planned.ring}"`)]] : []),
      ...(extras[0] ? [["an ADR-1327 extra with no exemption row", `${extras[0].ring}/${extras[0].id}`, /ADR-1327/]] : []),
    ];
    check("the refusal cases were derived (vacuous-pass guard)", cases.length === 4, `cases=${cases.length}`);
    for (const [label, arg, why] of cases) {
      const r = run(root, arg);
      check(`REFUSES ${label} with exit 1`, r.status === 1 && /face-module: REFUSED/.test(r.stdout) && why.test(r.stdout), out(r));
      const [ring, id] = arg.split("/");
      check(`and writes nothing for ${arg}`, !existsSync(join(root, "face", "src", "modules", ring, id)));
    }
  }

  // ── arguments: grammar and flags (fixed-defects: unknown flags, --flag=value, repeats, empties) ──
  {
    const root = makeRoot("args");
    for (const [label, args] of [
      ["an upper-case ring", ["Command/x"]],
      ["a traversal in the id", ["command/../x"]],
      ["a Windows device name as the id", ["command/con"]],
      ["a ring with no id", ["command"]],
      ["three segments", ["command/x/y"]],
      ["a leading slash", ["/command/x"]],
      ["a trailing slash", ["command/x/"]],
      ["a backslash separator", ["command\\x"]],
      ["an unknown flag", ["command/x", "--force"]],
      ["a --root=value spelling", ["command/x", `--root=${root}`]],
      ["no ring/id at all", []],
      ["two ring/ids", ["command/x", "command/y"]],
      ["an empty --root", ["command/x", "--root", ""]],
      ["a --root that swallows the next flag", ["command/x", "--root", "--force"]],
    ]) {
      const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", cwd: scratch });
      check(`refuses ${label} with exit 2`, r.status === 2, out(r));
    }
    const twice = spawnSync(process.execPath, [SCRIPT, "command/x", "--root", root, "--root", root], { encoding: "utf8", cwd: scratch });
    check("refuses a repeated --root with exit 2", twice.status === 2, out(twice));
    const lost = run(join(scratch, "no-such-root"), "command/x");
    check("an absent --root is exit 2: the registry could not be read", lost.status === 2, out(lost));
  }

  // ── a red verdict removes what it wrote ──
  if (target) {
    const root = makeRoot("rollback", { rings: [] });
    writeFileSync(join(root, "initiatives", "face", "contracts", "module-exemptions.json"), "{ this is not json");
    const r = run(root, `${target.ring}/${target.id}`);
    check("a scaffold whose module half cannot be read exits 1", r.status === 1 && /face-module: RED/.test(r.stdout), out(r));
    check("and removes the module folder it wrote", !existsSync(join(root, "face", "src", "modules", target.ring, target.id)));
    check("and removes the ring folder it created for it", !existsSync(join(root, "face", "src", "modules", target.ring)));
    check("and leaves the modules root it did not create", existsSync(join(root, "face", "src", "modules")));
  }

  // ── the shell/OS attack on Phase 02, each confirmed hole pinned ──
  if (target) {
    // A ring folder that is a link (a junction on Windows, which needs no privilege; a symlink elsewhere).
    const root = makeRoot("linked-ring", { rings: [] });
    const outside = join(scratch, "outside-ring");
    mkdirSync(outside, { recursive: true });
    let linked = null;
    try { symlinkSync(outside, join(root, "face", "src", "modules", target.ring), "junction"); linked = true; } catch (e) { linked = e.code ?? e.message; }
    if (linked === true) {
      const r = run(root, `${target.ring}/${target.id}`);
      check("LINK: a ring folder that is a link is REFUSED before anything is written", r.status === 1 && /REFUSED/.test(r.stdout) && /is a link/.test(r.stdout), out(r));
      check("LINK: nothing was written through the link, outside --root", readdirSync(outside).length === 0, readdirSync(outside).join(","));
    }
    // face/src itself a link: the attack's GREEN-outside-root case.
    const root2 = join(scratch, "linked-src");
    const realSrc = join(scratch, "linked-src-real");
    mkdirSync(join(root2, "face"), { recursive: true });
    mkdirSync(join(root2, "initiatives", "face", "contracts"), { recursive: true });
    for (const f of ["rooms.generated.json", "modules-v2.json", "module-exemptions.json"]) cpSync(join(CONTRACTS, f), join(root2, "initiatives", "face", "contracts", f));
    cpSync(join(REPO, "face", "src", "lib"), join(realSrc, "lib"), { recursive: true });
    mkdirSync(join(realSrc, "modules"), { recursive: true });
    let linked2 = null;
    try { symlinkSync(realSrc, join(root2, "face", "src"), "junction"); linked2 = true; } catch (e) { linked2 = e.code ?? e.message; }
    if (linked2 === true) {
      const r = run(root2, `${target.ring}/${target.id}`);
      check("LINK: a face/src that is a link is REFUSED, never GREEN with the module outside --root", r.status === 1 && /is a link/.test(r.stdout), out(r));
      check("LINK: nothing landed in the linked source folder", readdirSync(join(realSrc, "modules")).length === 0);
    }
    console.log(`link-arm=${linked === true && linked2 === true ? "ran" : `skipped (${linked}, ${linked2})`}`);

    // A modules root that is a file: exit 2, named, never an unhandled throw read as a refusal.
    const root3 = makeRoot("modules-file", { rings: [] });
    rmSync(join(root3, "face", "src", "modules"), { recursive: true, force: true });
    writeFileSync(join(root3, "face", "src", "modules"), "not a folder");
    const r3 = run(root3, `${target.ring}/${target.id}`);
    check("FILE: a modules root that is a file is exit 2 with its reason, and nothing is written", r3.status === 2 && /is not a directory/.test(r3.stderr), out(r3));

    // An exemption list that cannot be read is exit 2 naming the file, never a refusal for a missing row.
    const extra = JSON.parse(readFileSync(join(CONTRACTS, "modules-v2.json"), "utf8")).modules.find((m) => m.class === "extra");
    if (extra) {
      const root4 = makeRoot("bom-exemptions", { rings: [] });
      writeFileSync(join(root4, "initiatives", "face", "contracts", "module-exemptions.json"), String.fromCharCode(0xfeff) + JSON.stringify({ exemptions: [{ id: extra.id, adr: "ADR-1327" }] }));
      const r4 = run(root4, `${extra.ring}/${extra.id}`);
      check("UNREADABLE: an exemption list with a BOM is exit 2 naming module-exemptions.json, not a false refusal", r4.status === 2 && /module-exemptions\.json could not be read/.test(r4.stderr), out(r4));
    }

    // A module tree that throws in the middle of the proof: RED, rolled back -- never a crash past the rollback.
    if (process.platform !== "win32" && !(typeof process.getuid === "function" && process.getuid() === 0)) {
      const root5 = makeRoot("unreadable-module");
      const locked = join(root5, "face", "src", "modules", "command", "today");
      chmodSync(locked, 0o000);
      let r5;
      try { r5 = run(root5, `${target.ring}/${target.id}`); } finally { chmodSync(locked, 0o755); }
      check("THROW: a module folder that cannot be read mid-proof is RED, and the scaffold is removed",
        r5.status === 1 && /face-module: RED/.test(r5.stdout) && !existsSync(join(root5, "face", "src", "modules", target.ring, target.id)), out(r5));

      // A rollback that cannot remove what it wrote NAMES it and does not throw.
      const parent = join(scratch, "rollback-locked", "ring");
      const dir = join(parent, "mod");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "module.mjs"), "x");
      chmodSync(parent, 0o555);
      let left;
      try { left = mod.rollback([parent, dir], dir); } catch (e) { left = e; } finally { chmodSync(parent, 0o755); }
      check("ROLLBACK: a folder that will not go is returned by name, not thrown past the verdict", Array.isArray(left) && left.some((l) => l.includes("mod")), String(left));
      console.log("posix-arms=ran");
    } else {
      console.log("posix-arms=skipped (win32, or running as root: permission bits do not bite)");
    }
  }

  // ── the main guard realpaths BOTH sides: run through a symlink, it still runs ──
  {
    const link = join(scratch, "linked", "face-module-link.mjs");
    mkdirSync(dirname(link), { recursive: true });
    let made = null;
    try { symlinkSync(SCRIPT, link, "file"); made = true; } catch (e) { made = e.code ?? e.message; }
    if (made === true) {
      const r = spawnSync(process.execPath, [link, "command/x", "--no-such-flag"], { encoding: "utf8", cwd: scratch });
      check("run through a symlink in a temp dir, the scaffold RUNS (it refuses the flag, exit 2)", r.status === 2 && /unknown/.test(r.stderr), out(r));
      console.log("symlink-arm=ran");
    } else {
      // Counted, and said: a Windows runner without the symlink privilege cannot make one.
      console.log(`symlink-arm=skipped (${made})`);
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// ── the command is homed, and the root count of hand-written commands is true ──
{
  const cmd = join(REPO, ".claude", "commands", "arc-face-module.md");
  check("the command file exists", existsSync(cmd));
  check("the command runs the scaffold script", existsSync(cmd) && /\.claude\/scripts\/hq\/face-module\.mjs/.test(readFileSync(cmd, "utf8")));
  const contract = JSON.parse(readFileSync(join(CONTRACTS, "expected-set.json"), "utf8"));
  const keys = Object.keys(contract.commands.map);
  const home = contract.commands.map["arc-face-module"];
  check("face-coverage's commands inventory homes /arc-face-module in a real room", typeof home === "string" && contract.rooms.list.some((r) => r.id === home), String(home));
  const files = readdirSync(join(REPO, ".claude", "commands")).filter((n) => n.endsWith(".md"));
  const generated = keys.filter((k) => /\(G\)$/.test(k)).length;
  const claude = readFileSync(join(REPO, "CLAUDE.md"), "utf8");
  const m = /The other (\d+)\s+commands/.exec(claude);
  check("root CLAUDE.md states how many commands are hand-written", m !== null);
  check("and the number is the command files minus the generated ones", m !== null && Number(m[1]) === files.length - generated, `CLAUDE.md=${m ? m[1] : "?"} derived=${files.length}-${generated}`);
  check("the derivation read real counts (vacuous-pass guard)", files.length >= 27 && generated >= 3, `files=${files.length} generated=${generated}`);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 45 ? 0 : 1;
