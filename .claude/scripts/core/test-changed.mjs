#!/usr/bin/env node
/**
 * test-changed.mjs -- the owner's box is the first gate (ci REQ-05, ADR-2203): run the tests of the lanes a
 * push touches, before the push leaves. CI on ubuntu confirms; this only makes red show up sooner.
 *
 *   node .claude/scripts/core/test-changed.mjs [--dry-run] [--quiet] [--files LIST] [--base REF]
 *   node .claude/scripts/core/test-changed.mjs --all          # the whole suite, explicitly, no timeout
 *
 * As a pre-push hook it reads git's stdin (`<local ref> <local sha> <remote ref> <remote sha>` per line),
 * fetches, and diffs merge-base(origin/main, local sha)..local sha. Mapping, per changed path:
 *   paperwork (ci-changes isPaperwork)             -> nothing
 *   .claude/scripts/<lane>/, initiatives/<lane>/, face/, tests/<lane>-*.bats,
 *   tests/<lane>/                                  -> <lane>
 *   .claude/scripts/core/, tests/test_helper.bash,
 *   tests/_lib/, or a path no lane matches          -> core: bats files naming that file, plus every
 *                                                      node:test lane; prints why
 * A failed fetch or merge-base runs the core set and prints why -- never a diff against a stale ref.
 * The full bats suite never runs here (~4.3 h on Windows); a 5-minute cap prints the lanes not run, exit 1.
 *
 * Exit: 0 green or nothing to run · 1 a test failed or the cap hit · 2 usage.
 */
import { readFileSync, readdirSync, existsSync, realpathSync } from "node:fs";
import { join, basename } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isPaperwork } from "./ci-changes.mjs";

const CAP_MS = 5 * 60 * 1000;
const ZERO = /^0+$/;
const SHARED = [/^\.claude\/scripts\/core\//, /^tests\/test_helper\.bash$/, /^tests\/_lib\//];
const LANE_OF = [/^\.claude\/scripts\/([a-z0-9-]+)\//, /^initiatives\/([a-z0-9-]+)\//, /^(face)\//, /^tests\/([a-z0-9]+)-[^/]*\.bats$/, /^tests\/([a-z0-9]+)\.bats$/, /^tests\/(?!fixtures\/|_lib\/)([a-z0-9-]+)\//];

const list = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []);
const walk = (dir, out = []) => { for (const e of list(dir)) { const p = `${dir}/${e.name}`; if (e.isDirectory()) walk(p, out); else if (e.isFile()) out.push(p); } return out; };

/** Every lane with node:test files under tests/<lane>/ (a .count marks it migrated; core has none yet). */
const nodeLanes = () => list("tests").filter((e) => e.isDirectory() && walk(`tests/${e.name}`).some((f) => f.endsWith(".test.mjs"))).map((e) => e.name);

export function planFor(paths) {
  const lanes = new Set();
  const why = [];
  const sharedHits = [];
  for (const p of paths) {
    if (isPaperwork(p)) continue;
    if (SHARED.some((r) => r.test(p))) { lanes.add("core"); sharedHits.push(p); why.push(`${p} is shared -> core`); continue; }
    const m = LANE_OF.map((r) => p.match(r)).find(Boolean);
    if (m && m[1] !== "core") lanes.add(m[1]);
    else { lanes.add("core"); why.push(`no lane matches ${p} -> core`); }
  }
  if (lanes.has("core")) for (const l of nodeLanes()) lanes.add(l);
  return { lanes: [...lanes].sort(), why, sharedHits };
}

function filesFor({ lanes, sharedHits }) {
  const bats = walk("tests").filter((f) => f.endsWith(".bats")).sort();
  const node = walk("tests").filter((f) => f.endsWith(".test.mjs")).sort();
  const pick = new Set();
  for (const l of lanes) {
    for (const f of bats) if (new RegExp(`^tests/${l}(-[^/]*)?\\.bats$`).test(f)) pick.add(f);
    for (const f of node) if (f.startsWith(`tests/${l}/`)) pick.add(f);
  }
  // A shared script's own tests are the bats files that name it; the rest of the suite is CI's.
  // shortcut: a name grep, not an import graph; misses a test that reaches the script indirectly, CI catches it.
  const names = sharedHits.filter((p) => p.startsWith(".claude/scripts/core/")).map((p) => basename(p));
  for (const f of bats) if (names.some((n) => readFileSync(f, "utf8").includes(n))) pick.add(f);
  return [...pick];
}

function changedPaths(argv, stdin) {
  const i = argv.indexOf("--files");
  if (i >= 0) return { paths: readFileSync(argv[i + 1], "utf8").split(/\r?\n/).filter(Boolean) };
  const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "origin/main";
  const pushes = stdin.split(/\r?\n/).filter(Boolean).map((l) => l.split(" ")[1]).filter(Boolean);
  const heads = pushes.length ? pushes.filter((s) => !ZERO.test(s)) : ["HEAD"];
  if (!heads.length) return { paths: [], note: "delete push -- nothing to test" };
  const opts = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 };
  try {
    execFileSync("git", ["fetch", "-q", "origin", "main"], opts);
    const out = new Set();
    for (const h of heads) {
      const mb = execFileSync("git", ["merge-base", base, h], opts).trim();
      for (const p of execFileSync("git", ["-c", "core.quotePath=false", "diff", "-z", "--no-renames", "--name-only", `${mb}..${h}`], opts).split("\0")) if (p) out.add(p);
    }
    return { paths: [...out] };
  } catch (e) {
    return { paths: ["(unknown)"], note: `fetch or merge-base against ${base} failed (${String(e.message).split("\n")[0]}) -- running the core set` };
  }
}

function run(files, deadline) {
  const bats = files.filter((f) => f.endsWith(".bats"));
  const node = files.filter((f) => f.endsWith(".test.mjs"));
  const steps = [];
  if (node.length) steps.push({ what: node, cmd: process.execPath, args: ["--test", "--test-reporter=tap", ...node] });
  // argv, never an interpolated program: a POSIX path inside `bash -c` breaks on the Windows leg.
  for (const f of bats) steps.push({ what: [f], cmd: "bash", args: ["-c", 'exec bats --print-output-on-failure "$@"', "bats", f] });
  for (let k = 0; k < steps.length; k++) {
    const left = deadline === Infinity ? undefined : deadline - Date.now();
    if (left !== undefined && left <= 0) { console.log(`test-changed: 5-minute cap hit; not run: ${steps.slice(k).flatMap((s) => s.what).join(" ")}`); return 1; }
    const r = spawnSync(steps[k].cmd, steps[k].args, { stdio: "inherit", timeout: left });
    if (r.error && r.error.code === "ETIMEDOUT") { console.log(`test-changed: 5-minute cap hit; not run: ${steps.slice(k).flatMap((s) => s.what).join(" ")}`); return 1; }
    if (r.status !== 0) { console.log(`test-changed: FAILED ${steps[k].what.join(" ")}`); return 1; }
  }
  return 0;
}

function main(argv) {
  const known = new Set(["--dry-run", "--quiet", "--all", "--files", "--base"]);
  for (let i = 0; i < argv.length; i++) {
    if (!known.has(argv[i])) { console.log(`test-changed: unknown argument ${argv[i]}`); return 2; }
    if (argv[i] === "--files" || argv[i] === "--base") { if (!argv[i + 1] || argv[i + 1].startsWith("--")) { console.log(`test-changed: ${argv[i]} needs a value`); return 2; } i++; }
  }
  process.chdir(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  if (argv.includes("--all")) {
    const all = walk("tests").filter((f) => f.endsWith(".bats") || f.endsWith(".test.mjs")).sort();
    console.log(`lanes: (all) -- ${all.length} file(s)`);
    return argv.includes("--dry-run") ? 0 : run(all, Infinity);
  }
  let stdin = "";
  if (!process.stdin.isTTY) { try { stdin = readFileSync(0, "utf8"); } catch { stdin = ""; } }
  const { paths, note } = changedPaths(argv, stdin);
  const p = planFor(paths);
  const files = filesFor(p);
  console.log(`lanes: ${p.lanes.length ? p.lanes.join(" ") : "(none)"}`);
  if (note) console.log(`why: ${note}`);
  if (!argv.includes("--quiet")) for (const w of p.why) console.log(`why: ${w}`);
  if (argv.includes("--dry-run")) { for (const f of files) console.log(`  ${f}`); return 0; }
  if (!files.length) return 0;
  return run(files, Date.now() + CAP_MS);
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return null; } })() : null;
if (invoked === self) process.exitCode = main(process.argv.slice(2));
