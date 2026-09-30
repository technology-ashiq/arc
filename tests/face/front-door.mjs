#!/usr/bin/env node
// front-door.mjs -- the front door (face v2 Phase 09, REQ-13, ADR-1349), held without a browser:
//   A. THE MODE DECISION: every transition face/src/lib/mode.mjs owns -- which surface a fragment asks for, the
//      fragment ENTER HQ and the exit write (token carried, round-tripped), the warp's direction, whether the stage is
//      mounted, and the warp's targets over t. Each table is judged against the real module AND a planted mutant; the
//      mutant must FAIL the same table, or the table proves nothing.
//   B. THE GUARD: the boundary around the stage is a real error boundary, and App.tsx mounts the stage inside it.
//   C. NAMED, NOT A ROOM (ADR-1349 section 1): the front door has exactly one surface row; face-coverage reads it both
//      ways and FAILs a planted second, unnamed surface -- with a mutant control proving the same plant PASSES once
//      named, so the FAIL is the missing row and not a gate that fails everything. The served registry stays the only
//      room list: the surface is never a room.
//   D. THE LINT LEARNS THE DOOR (ADR-1349 section 4): the colour-literal lint reads face/src/face and face/src/frontdoor,
//      allows the neon palette by name in neon.mjs alone, and FAILs a planted literal anywhere else.
// The browser half (the canvas on `/`, no stage under `#hq`, ENTER HQ by pointer and keyboard, the WebGL and throwing
// stage guards) is face/scripts/smoke.mjs's front-door pass, judged in tests/face-browser.bats.
//
// VACUOUS-PASS GUARD: the first check of each arm proves its module loaded with the exports the arm uses; each arm
// counts the rows it judged and asserts the count; the last line is "RAN: <n> checks, <f> failed" and the exit code
// needs a floor of checks, so a suite that died half-way cannot print a clean tail.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const MODE = join(REPO, "face", "src", "lib", "mode.mjs");
const COVERAGE = join(REPO, ".claude", "scripts", "core", "face-coverage.mjs");
const LINT = join(REPO, ".claude", "scripts", "core", "face-colour-literal.mjs");
const CONTRACTS = join(REPO, "initiatives", "face", "contracts");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};

// ─────────────────────────────── A. the mode decision ───────────────────────────────
// Imported first: before mode.mjs existed this line died with ERR_MODULE_NOT_FOUND and printed no RAN line, which is
// the spec's expected failure first.
const mode = await import(pathToFileURL(MODE).href);
check("A: mode.mjs loaded with its decisions and constants (vacuous-pass guard)",
  ["modeOf", "enterHash", "exitHash", "warpDir", "stageOn", "warpTargets"].every((k) => typeof mode[k] === "function")
  && mode.STAGE_UNMOUNT_MS === 1750 && mode.HQ_PART === "hq",
  Object.keys(mode).join(","));

/** [fragment, expected surface, why] -- every row a fragment the address bar can hold. */
const MODE_ROWS = [
  ["", "door", "/ with no hash"],
  ["#", "door", "an empty fragment"],
  ["#token=T", "door", "the door, token only"],
  ["token=T", "door", "a fragment with no leading #"],
  ["#hq", "hq", "the workroom"],
  ["#hq&token=T", "hq", "the workroom, token carried"],
  ["#token=T&hq", "hq", "the workroom, parts in either order"],
  ["#/today&token=T", "hq", "a room is the workroom"],
  ["#/money", "hq", "a room with no token is still the workroom"],
  ["#/%74oday&token=T", "hq", "an escaped room id is a room"],
  ["#%E0", "door", "an unreadable escape"],
  ["#/%E0&token=T", "door", "an unreadable room id"],
  ["#token=%E0", "door", "an unreadable token"],
  ["#hqx", "door", "a near-miss of hq"],
  ["#HQ", "door", "hq in the wrong case"],
  ["#hq=1", "door", "hq as a key, not the part"],
  ["#/", "door", "a room with no id"],
  ["#/%20%20", "door", "a room id of only spaces"],
  ["#&&&", "door", "separators only"],
  ["#foo=bar", "door", "an unknown key"],
];
const NON_STRINGS = [undefined, null, 42, {}, ["#hq"], true];

/** Every row the implementation answers differently, as "fragment=>got". */
function modeMisses(modeOf) {
  const miss = [];
  for (const [hash, want] of MODE_ROWS) {
    let got;
    try { got = modeOf(hash); } catch (e) { got = `threw ${e && e.message}`; }
    if (got !== want) miss.push(`${JSON.stringify(hash)}=>${got}`);
  }
  for (const v of NON_STRINGS) {
    let got;
    try { got = modeOf(v); } catch (e) { got = `threw ${e && e.message}`; }
    if (got !== "door") miss.push(`${JSON.stringify(v) ?? String(v)}=>${got}`);
  }
  return miss;
}
{
  const miss = modeMisses(mode.modeOf);
  check(`A: modeOf answers all ${MODE_ROWS.length + NON_STRINGS.length} rows (the door, the workroom, every bad hash to the door)`,
    MODE_ROWS.length >= 20 && miss.length === 0, miss.join("; "));
  // Planted mutants: a routing branch that reads `hq` anywhere in the fragment, and one that lets the decoder throw.
  const loose = (h) => (typeof h === "string" && h.includes("hq") ? "hq" : (typeof h === "string" && h.includes("/") && h.length > 2 ? "hq" : "door"));
  const throwing = (h) => { const raw = String(h).replace(/^#/, ""); decodeURIComponent(raw); return mode.modeOf(h); };
  check("A: MUTANT a loose `includes(hq)` router FAILS the same table", modeMisses(loose).length > 0);
  check("A: MUTANT a decoder that throws on %E0 FAILS the same table", modeMisses(throwing).some((m) => m.includes("threw")));
}

/** [current fragment, ENTER HQ writes, the exit writes] */
const HASH_ROWS = [
  ["#token=T", "#hq&token=T", "#token=T"],
  ["", "#hq", "#"],
  ["#", "#hq", "#"],
  ["#hq&token=T", "#hq&token=T", "#token=T"],
  ["#/today&token=abc", "#hq&token=abc", "#token=abc"],
  ["#token=a%20b%26c", "#hq&token=a%20b%26c", "#token=a%20b%26c"],
  ["#%E0", "#hq", "#"],
  [undefined, "#hq", "#"],
];
function hashMisses(enterHash, exitHash) {
  const miss = [];
  for (const [from, enter, exit] of HASH_ROWS) {
    if (enterHash(from) !== enter) miss.push(`enter ${JSON.stringify(from)}=>${enterHash(from)}`);
    if (exitHash(from) !== exit) miss.push(`exit ${JSON.stringify(from)}=>${exitHash(from)}`);
  }
  return miss;
}
{
  const miss = hashMisses(mode.enterHash, mode.exitHash);
  check(`A: enterHash and exitHash answer all ${HASH_ROWS.length} rows, the token carried`, HASH_ROWS.length === 8 && miss.length === 0, miss.join("; "));
  // Round trips: door -> ENTER HQ -> hq, and hq -> exit -> door, with the same token, for every token row.
  let trips = 0;
  const bad = [];
  for (const t of ["T", "abc", "a b&c", "x=y", "%"]) {
    const door = `#token=${encodeURIComponent(t)}`;
    const inHq = mode.enterHash(door);
    const back = mode.exitHash(inHq);
    trips++;
    if (mode.modeOf(door) !== "door" || mode.modeOf(inHq) !== "hq" || mode.modeOf(back) !== "door" || back !== door) bad.push(`${t}: ${door} -> ${inHq} -> ${back}`);
  }
  check("A: door -> ENTER HQ -> exit round-trips to the same door and token, 5 of 5", trips === 5 && bad.length === 0, bad.join("; "));
  check("A: the exit never writes an empty string (a no-op assignment on some engines)", HASH_ROWS.every(([f]) => mode.exitHash(f) !== ""));
  // Mutant: an ENTER HQ that drops the token -- the workroom would open unable to read anything.
  const dropToken = () => "#hq";
  check("A: MUTANT an ENTER HQ that drops the token FAILS the same table", hashMisses(dropToken, mode.exitHash).length > 0);
}

{
  const rows = [["door", "hq", 1], ["hq", "door", -1], ["door", "door", 0], ["hq", "hq", 0]];
  const miss = rows.filter(([a, b, w]) => mode.warpDir(a, b) !== w);
  check("A: warpDir -- in is 1, out is -1, no crossing is 0 (4 rows)", rows.length === 4 && miss.length === 0, JSON.stringify(miss));
  const sRows = [["door", false, true], ["door", true, true], ["hq", true, true], ["hq", false, false], ["hq", "yes", false], ["hq", 1, false]];
  const sMiss = sRows.filter(([m, w, want]) => mode.stageOn(m, w) !== want);
  check("A: stageOn -- always on the door, in the workroom only while the warp flies, and only for a real true (6 rows)",
    sRows.length === 6 && sMiss.length === 0, JSON.stringify(sMiss));
  const loose = (m, w) => m === "door" || Boolean(w);
  check("A: MUTANT a truthy `warping` FAILS the same rows", sRows.some(([m, w, want]) => loose(m, w) !== want));
}

/** Every property the warp's targets must hold, as named misses. */
function warpMisses(warpTargets) {
  const miss = [];
  const keys = ["scale", "opacity", "flash", "spread", "done"];
  const rest = (r) => r.scale === 1 && r.opacity === 1 && r.flash === 0 && r.spread === 0 && r.done === true;
  for (const dir of [1, -1]) {
    const r0 = warpTargets(dir, 0);
    if (!keys.every((k) => k in r0)) miss.push(`dir=${dir} t=0 lacks a key`);
    if (r0.done !== false) miss.push(`dir=${dir} t=0 is already done`);
    for (const t of [1, 1.5, Infinity]) if (!rest(warpTargets(dir, t))) miss.push(`dir=${dir} t=${t} is not at rest`);
    for (const t of [NaN, -Infinity]) if (!rest(warpTargets(dir, t))) miss.push(`dir=${dir} t=${t} (non-finite) is not at rest`);
    if (JSON.stringify(warpTargets(dir, -0.3)) !== JSON.stringify(warpTargets(dir, 0))) miss.push(`dir=${dir} a negative t is not clamped to 0`);
    // Monotone windows, sampled every 0.01: in fades out after 0.55 and never back; out fades in after 0.2 and never back.
    let prev = null;
    for (let i = 0; i < 100; i++) {
      const t = i / 100;
      const r = warpTargets(dir, t);
      if (!Object.values(r).slice(0, 4).every(Number.isFinite)) { miss.push(`dir=${dir} t=${t} carries a non-finite target`); break; }
      if (r.opacity < 0 || r.opacity > 1) miss.push(`dir=${dir} t=${t} opacity ${r.opacity} outside 0..1`);
      if (prev !== null) {
        if (dir === 1 && r.opacity > prev.opacity + 1e-12) miss.push(`in: opacity rises at t=${t}`);
        if (dir === -1 && r.opacity < prev.opacity - 1e-12) miss.push(`out: opacity falls at t=${t}`);
        if (dir === 1 && r.scale < prev.scale - 1e-12) miss.push(`in: scale shrinks at t=${t}`);
        if (dir === -1 && r.scale > prev.scale + 1e-12) miss.push(`out: scale grows at t=${t}`);
      }
      prev = r;
    }
  }
  const in0 = warpTargets(1, 0), in5 = warpTargets(1, 0.5), in8 = warpTargets(1, 0.8), inEnd = warpTargets(1, 0.99);
  if (!(in0.opacity === 1 && in5.opacity === 1)) miss.push("in: fully visible until 0.55");
  if (!(in8.opacity === 0)) miss.push(`in: gone by 0.8 (got ${in8.opacity})`);
  if (!(inEnd.scale > 3.5)) miss.push(`in: flies past the camera near the end (scale ${inEnd.scale})`);
  const out0 = warpTargets(-1, 0), out1 = warpTargets(-1, 0.1), out6 = warpTargets(-1, 0.65);
  if (!(out0.opacity === 0 && out1.opacity === 0)) miss.push("out: hidden until 0.2");
  if (!(out6.opacity === 1)) miss.push(`out: fully back by 0.65 (got ${out6.opacity})`);
  if (!(out0.scale > 3.5)) miss.push(`out: starts beyond the lens (scale ${out0.scale})`);
  for (const dir of [0, 2, "1", null, undefined, NaN]) if (!rest(warpTargets(dir, 0.5))) miss.push(`dir=${String(dir)} is not "no warp"`);
  return miss;
}
{
  const miss = warpMisses(mode.warpTargets);
  check("A: warpTargets -- endpoints, monotone opacity and scale windows, done at t>=1, non-finite t and a bad dir at rest",
    miss.length === 0, miss.slice(0, 6).join("; "));
  // Mutants: one that never finishes, one that runs the in-pass for any truthy dir.
  const neverDone = (d, t) => ({ ...mode.warpTargets(d, Math.min(t, 0.99)), done: false });
  const anyDir = (d, t) => mode.warpTargets(d ? (d === -1 ? -1 : 1) : d, t);
  check("A: MUTANT a warp that never reaches done FAILS the same properties", warpMisses(neverDone).length > 0);
  check("A: MUTANT a warp that takes any truthy dir as in FAILS the same properties", warpMisses(anyDir).some((m) => m.includes("is not \"no warp\"")));
}

// ─────────────────────────────── B. the guard ───────────────────────────────
{
  const guardPath = join(REPO, "face", "src", "frontdoor", "StageGuard.tsx");
  let guard = null, app = null;
  try { guard = readFileSync(guardPath, "utf8"); } catch { /* reported below */ }
  try { app = readFileSync(join(REPO, "face", "src", "App.tsx"), "utf8"); } catch { /* reported below */ }
  check("B: StageGuard.tsx and App.tsx were read (vacuous-pass guard)", guard !== null && app !== null);
  /** An error boundary: a class component with both halves -- the state flip and the report upward. */
  const isBoundary = (src) => /class\s+\w+\s+extends\s+Component\b/.test(src)
    && /static\s+getDerivedStateFromError\s*\(/.test(src) && /componentDidCatch\s*\(/.test(src);
  check("B: StageGuard is a real error boundary (getDerivedStateFromError + componentDidCatch)", guard !== null && isBoundary(guard));
  check("B: MUTANT a guard with no getDerivedStateFromError is not a boundary",
    guard !== null && !isBoundary(guard.replace(/static\s+getDerivedStateFromError/, "static notABoundary")));
  // Comments stripped line by line so a commented-out mount cannot stand in for one.
  const code = (app ?? "").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  check("B: App.tsx imports StageGuard from the front door and renders the stage inside it",
    /import\s+StageGuard\s+from\s+['"]\.\/frontdoor\/StageGuard['"]/.test(code) && /<StageGuard[\s>][\s\S]*?<FaceStage[\s\S]*?<\/StageGuard>/.test(code));
}

// ─────────────────────────────── C. named, not a room ───────────────────────────────
const fc = await import(pathToFileURL(COVERAGE).href);
check("C: face-coverage exports the surface half (vacuous-pass guard)",
  typeof fc.treeSurfaces === "function" && typeof fc.surfaceFindings === "function" && typeof fc.appImportDirs === "function" && Array.isArray(fc.SHELL_DIRS));
{
  const contract = JSON.parse(readFileSync(join(CONTRACTS, "expected-set.json"), "utf8"));
  const registry = JSON.parse(readFileSync(join(CONTRACTS, "rooms.generated.json"), "utf8"));
  const rows = contract.surfaces?.list;
  check("C: expected-set.json names exactly one surface: the front door, face/src/frontdoor, ADR-1349",
    Array.isArray(rows) && rows.length === 1 && rows[0].id === "front-door" && rows[0].dir === "face/src/frontdoor" && rows[0].adr === "ADR-1349",
    JSON.stringify(rows));
  check("C: rooms.generated.json carries the surface row beside the rooms, as face-sections derives it",
    Array.isArray(registry.surfaces) && registry.surfaces.length === 1 && registry.surfaces[0].id === "front-door" && registry.surfaces[0].dir === "face/src/frontdoor",
    JSON.stringify(registry.surfaces));
  const roomIds = new Set([...(contract.rooms?.list ?? []).map((r) => r.id), contract.rooms?.template?.id]);
  check("C: the surface is not a room -- not in the contract's rooms, not in the served registry's",
    roomIds.size > 30 && !roomIds.has("front-door") && registry.rooms.length > 30 && !registry.rooms.some((r) => r.id === "front-door" || r.id === "frontdoor"));

  // The real tree, through the pure half: App.tsx imports the front door and the row names it; zero findings.
  const tree = fc.treeSurfaces(REPO);
  const real = fc.surfaceFindings(tree, contract.surfaces, roomIds);
  check("C: the real tree read App.tsx (it imports the shell) and found the front door among its imports",
    !tree.unreadable && tree.imports.includes("shell") && tree.imports.includes("frontdoor"), JSON.stringify(tree));
  check("C: the real tree has zero surface findings, both ways", real.findings.length === 0 && real.named.join(",") === "front-door=face/src/frontdoor", real.findings.join("; "));

  // The planted second surface, and its mutant control.
  const planted = { imports: [...tree.imports, "ghostdoor"].sort(), dirs: [...tree.dirs, "ghostdoor"].sort() };
  const plantedFindings = fc.surfaceFindings(planted, contract.surfaces, roomIds).findings;
  check("C: a planted second, unnamed surface FAILs, named", plantedFindings.some((f) => f.includes("face/src/ghostdoor") && f.includes("unnamed surface")), plantedFindings.join("; "));
  const named = { ...contract.surfaces, list: [...rows, { id: "ghost-door", dir: "face/src/ghostdoor", adr: "ADR-1349" }] };
  check("C: MUTANT CONTROL -- the same plant with a row of its own passes (the FAIL was the missing row)",
    fc.surfaceFindings(planted, named, roomIds).findings.length === 0);
  check("C: a row App.tsx does not import FAILs (the other direction)",
    fc.surfaceFindings({ ...tree, dirs: [...tree.dirs, "ghostdoor"] }, named, roomIds).findings.some((f) => f.includes("a surface nothing mounts")));
  check("C: a surface row carrying a room id FAILs",
    fc.surfaceFindings(tree, { list: [{ ...rows[0], id: "today" }] }, roomIds).findings.some((f) => f.includes("a surface is not a room")));

  // The import reader: comments are not imports, strings holding `/*` are not comments, dynamic imports count.
  const text = [
    "import A from './frontdoor/FrontDoor'",
    "// import G from './ghost/Commented'",
    "/* import H from './hidden/Block' */",
    "const mods = import.meta.glob('./modules/*/*/View.tsx')",
    "import { x } from \"./lib/mode.mjs\"",
    "const Lazy = lazy(() => import('./later/Lazy'))",
    "import './index.css'",
    "import R from 'react'",
    "import Ghost from './ghostdoor'",
    "const G2 = require('./viaRequire/x')",
    "const G3 = import.meta.glob('./*/Door.tsx')",
    "import App2 from './App2'",
  ].join("\n");
  const dirs = fc.appImportDirs(text, ["frontdoor", "ghostdoor", "lib", "modules"]);
  check("C: appImportDirs reads static, dynamic, glob and require imports, a bare directory import and a wildcard dir, skips comments, bare files and packages",
    JSON.stringify(dirs) === JSON.stringify(["*", "frontdoor", "ghostdoor", "later", "lib", "modules", "viaRequire"]), JSON.stringify(dirs));
  // MUTANT CONTROL: with no disk listing, `./ghostdoor` cannot be told from a bare file and is not claimed.
  check("C: MUTANT CONTROL -- without the disk, a one-segment import is not claimed as a directory (the disk is what tells them apart)",
    !fc.appImportDirs("import Ghost from './ghostdoor'").includes("ghostdoor"));
  // attack e40b65f B1: a second surface reached only through `./dir` FAILs the gate like any other.
  const ghostTree = { imports: fc.appImportDirs("import FD from './frontdoor/FrontDoor'\nimport Ghost from './ghostdoor'", ["frontdoor", "ghostdoor"]), dirs: ["frontdoor", "ghostdoor"] };
  check("C: a second surface imported as a bare directory FAILs, named",
    fc.surfaceFindings(ghostTree, contract.surfaces, roomIds).findings.some((f) => f.includes("face/src/ghostdoor")));

  // The CLI, the way CI calls it: the surface half line is printed and names the row.
  const r = spawnSync(process.execPath, [COVERAGE, REPO], { encoding: "utf8", cwd: REPO });
  const line = (r.stdout.split("\n").find((l) => l.startsWith("face-coverage: surface half ")) ?? "");
  check("C: face-coverage printed its surface half line, naming the front door (the CLI RAN)",
    /^face-coverage: surface half rows=1 app-imports=\S*frontdoor\S* named=front-door=face\/src\/frontdoor /.test(line), line || r.stdout.slice(0, 300) + r.stderr.slice(0, 300));
  check("C: face-coverage raised no [surface] finding on the real tree", !/\[surface\]/.test(r.stderr), r.stderr.split("\n").filter((l) => l.includes("[surface]")).join("; "));
}

// ─────────────────────────────── D. the lint learns the door ───────────────────────────────
const lint = await import(pathToFileURL(LINT).href);
check("D: the lint exports its roots, its allowance and its walk (vacuous-pass guard)",
  typeof lint.lintRoots === "function" && Array.isArray(lint.DEFAULT_ROOTS) && lint.NEON_FILE === "face/src/frontdoor/neon.mjs");
check("D: face/src/face and face/src/frontdoor are default roots, and both must exist",
  ["face/src/face", "face/src/frontdoor"].every((r) => lint.DEFAULT_ROOTS.includes(r) && lint.REQUIRED_DEFAULT_ROOTS.includes(r)));
// attack e40b65f B2: the stage's palette file is read, not outside every root, so a literal moved out of the stage is still seen.
check("D: face/src/lib/stage.mjs is a required default root and a named allowance",
  lint.STAGE_FILE === "face/src/lib/stage.mjs" && lint.DEFAULT_ROOTS.includes(lint.STAGE_FILE) && lint.REQUIRED_DEFAULT_ROOTS.includes(lint.STAGE_FILE));
{
  const bare = lint.lintRoots([lint.STAGE_FILE], REPO, { required: [lint.STAGE_FILE], allow: [] });
  check("D: MUTANT CONTROL -- with no allowance the real stage.mjs FAILs (the lint reads it; the clean pass is the allowance)",
    bare.scanned === 1 && bare.findings.length > 0, `scanned=${bare.scanned} findings=${bare.findings.length}`);
}
{
  const tmp = mkdtempSync(join(tmpdir(), "front-door-lint-"));
  try {
    const fd = join(tmp, "face", "src", "frontdoor");
    const st = join(tmp, "face", "src", "face");
    mkdirSync(fd, { recursive: true });
    mkdirSync(st, { recursive: true });
    writeFileSync(join(fd, "neon.mjs"), `export const NEON = { accent: "#00ffd1", ink: "#031311", muted: "rgba(255, 255, 255, 0.62)" };\n`);
    writeFileSync(join(fd, "FrontDoor.tsx"), `export const x = "var(--accent)";\n`);
    writeFileSync(join(st, "FaceStage.tsx"), `export const y = 1;\n`);
    const roots = ["face/src/face", "face/src/frontdoor"];
    const opts = { required: roots, allow: [lint.NEON_FILE] };

    const clean = lint.lintRoots(roots, tmp, opts);
    check("D: a door whose neon lives in neon.mjs alone is clean, and all three files were scanned",
      clean.scanned === 3 && clean.findings.length === 0, JSON.stringify(clean.findings));
    check("D: the allowance RAN -- neon.mjs is reported allowed with its 3 literals",
      clean.allowed.length === 1 && clean.allowed[0].file === "face/src/frontdoor/neon.mjs" && clean.allowed[0].literals === 3, JSON.stringify(clean.allowed));
    const noAllow = lint.lintRoots(roots, tmp, { required: roots, allow: [] });
    check("D: MUTANT CONTROL -- with no allowance the same neon.mjs FAILs (the clean pass was the allowance, not a blind scan)",
      noAllow.findings.filter((f) => f.file === "face/src/frontdoor/neon.mjs").length === 3);

    writeFileSync(join(fd, "FrontDoor.tsx"), `export const x = "#00ffd1";\n`);
    const door = lint.lintRoots(roots, tmp, opts);
    check("D: a planted literal in the door outside neon.mjs FAILs, named", door.findings.some((f) => f.file === "face/src/frontdoor/FrontDoor.tsx" && f.kind === "hex"));
    writeFileSync(join(fd, "FrontDoor.tsx"), `export const x = "var(--accent)";\n`);

    writeFileSync(join(st, "FaceStage.tsx"), `ctx.fillStyle = "rgba(0, 255, 230, 0.6)";\n`);
    const stage = lint.lintRoots(roots, tmp, opts);
    check("D: a planted literal in the stage FAILs, named", stage.findings.some((f) => f.file === "face/src/face/FaceStage.tsx" && f.kind === "function"));
    writeFileSync(join(st, "FaceStage.tsx"), `export const y = 1;\n`);

    writeFileSync(join(fd, "neon2.mjs"), `export const N = "#00ffd1";\n`);
    const near = lint.lintRoots(roots, tmp, opts);
    check("D: a near-name (neon2.mjs) gets no allowance", near.findings.some((f) => f.file === "face/src/frontdoor/neon2.mjs"));
    rmSync(join(fd, "neon2.mjs"));

    writeFileSync(join(fd, "neon.mjs"), Buffer.from([0x23, 0x00, 0x66]));
    const bin = lint.lintRoots(roots, tmp, opts);
    check("D: the allowance covers colours only -- a binary neon.mjs is still a finding", bin.findings.some((f) => f.kind === "binary"));

    rmSync(join(fd, "neon.mjs"));
    const gone = lint.lintRoots(roots, tmp, opts);
    check("D: an allowance for a neon.mjs that is not there is a named finding", gone.findings.some((f) => f.kind === "allow-absent"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  // The CLI's default run reads both new roots and names the allowance (the real tree's zero findings are held by
  // tests/face/colour-literal.mjs, once).
  const r = spawnSync(process.execPath, [LINT], { encoding: "utf8", cwd: REPO });
  check("D: the default run RAN over face/src/face and face/src/frontdoor and reported the neon allowance",
    /root face\/src\/face: files=[1-9]/.test(r.stdout) && /root face\/src\/frontdoor: files=[1-9]/.test(r.stdout) && /^allowed face\/src\/frontdoor\/neon\.mjs: literals=\d+/m.test(r.stdout),
    r.stdout.split("\n").filter((l) => l.startsWith("root") || l.startsWith("allowed")).join(" | "));
  check("D: an explicit --root gets no allowance", spawnSync(process.execPath, [LINT, "--root", "face/src/frontdoor"], { encoding: "utf8", cwd: REPO }).stdout.includes("FAIL face/src/frontdoor/neon.mjs"));
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 47 ? 0 : 1;
