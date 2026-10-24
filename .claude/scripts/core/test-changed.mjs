#!/usr/bin/env node
/**
 * test-changed.mjs -- the owner's box is the first gate (ci REQ-05, ADR-2203): run the tests of the lanes a
 * push touches, before the push leaves. CI on ubuntu confirms; this only makes red show up sooner.
 *
 *   node .claude/scripts/core/test-changed.mjs [--dry-run] [--quiet] [--stdin] [--files LIST] [--base REF]
 *   node .claude/scripts/core/test-changed.mjs --all          # the whole suite, explicitly, no timeout
 *   node .claude/scripts/core/test-changed.mjs --ci           # `npm run ci`: ci-quality.sh, every node test, the floor
 *
 * With --stdin (the pre-push hook passes it) it reads git's `<local ref> <local sha> <remote ref> <remote sha>`
 * lines; without it, it tests HEAD. It fetches, then diffs merge-base(origin/main, local sha)..local sha.
 * Mapping, per changed path:
 *   paperwork (ci-changes isPaperwork)             -> nothing
 *   .claude/scripts/<lane>/, initiatives/<lane>/, face/, tests/<lane>-*.bats,
 *   tests/<lane>/                                  -> <lane>
 *   .claude/scripts/core/, tests/test_helper.bash,
 *   tests/_lib/, or a path no lane matches          -> core: bats files naming that file, plus every
 *                                                      node:test lane; prints why
 * A lane that maps to no test file runs the core set too, and says so: a lane with no tests is not green.
 * A failed fetch or merge-base runs the core set and prints why -- never a diff against a stale ref.
 * The full bats suite never runs here (~4.3 h on Windows); a 5-minute cap prints the lanes not run, exit 1.
 *
 * Exit: 0 green or nothing to run · 1 a test failed or the cap hit · 2 usage.
 */
import { readFileSync, readdirSync, existsSync, realpathSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isPaperwork, testsText } from "./ci-changes.mjs";

const CAP_MS = 5 * 60 * 1000;
const ZERO = /^0+$/;
const SHARED = [/^\.claude\/scripts\/core\//, /^tests\/test_helper\.bash$/, /^tests\/_lib\//];
const LANE_OF = [/^\.claude\/scripts\/([a-z0-9-]+)\//, /^initiatives\/([a-z0-9-]+)\//, /^(face)\//, /^tests\/([a-z0-9]+)-[^/]*\.bats$/, /^tests\/([a-z0-9]+)\.bats$/, /^tests\/(?!fixtures\/|_lib\/)([a-z0-9-]+)\//];
const NOT_TESTS = new Set(["fixtures", "_lib"]); // test input and helpers, never a suite (attack p01 B9)

const list = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []);
const walk = (dir, out = []) => { for (const e of list(dir)) { const p = `${dir}/${e.name}`; if (e.isDirectory()) { if (!(dir === "tests" && NOT_TESTS.has(e.name))) walk(p, out); } else if (e.isFile()) out.push(p); } return out; };

/** Every lane with node:test files under tests/<lane>/ (a .count marks it migrated). */
const nodeLanes = () => list("tests").filter((e) => e.isDirectory() && !NOT_TESTS.has(e.name) && walk(`tests/${e.name}`).some((f) => f.endsWith(".test.mjs"))).map((e) => e.name);

// A bats name's lane is the LONGEST known lane it starts with: `model-policy-x.bats` is model-policy, not
// model (attack p01 L4). Known = initiatives/ dirs + .claude/scripts/ dirs + tests/ dirs.
const known = () => [...new Set(["initiatives", ".claude/scripts", "tests"].flatMap((d) => list(d).filter((e) => e.isDirectory()).map((e) => e.name)))];
const batsLane = (name, lanes) => lanes.filter((l) => name === l || name.startsWith(`${l}-`)).sort((a, b) => b.length - a.length)[0] ?? name.split("-")[0];

export function planFor(paths, text = "") {
  const lanes = new Set();
  const why = [];
  const sharedHits = [];
  const direct = []; // a changed test file runs itself, whatever lane it maps to (attack p01 L7)
  const kn = known();
  for (const p of paths) {
    if (isPaperwork(p, text)) continue;
    if (/^tests\/(?!fixtures\/|_lib\/).*\.(bats|test\.mjs)$/.test(p) && existsSync(p)) direct.push(p);
    if (SHARED.some((r) => r.test(p))) { lanes.add("core"); sharedHits.push(p); why.push(`${p} is shared -> core`); continue; }
    const b = p.match(/^tests\/([^/]+)\.bats$/);
    const m = b ? [null, batsLane(b[1], kn)] : LANE_OF.map((r) => p.match(r)).find(Boolean);
    if (m && m[1] !== "core") lanes.add(m[1]);
    else { lanes.add("core"); why.push(`no lane matches ${p} -> core`); }
  }
  return { lanes, why, sharedHits, direct };
}

function filesFor(plan) {
  const bats = walk("tests").filter((f) => f.endsWith(".bats")).sort();
  const node = walk("tests").filter((f) => f.endsWith(".test.mjs")).sort();
  const ofLane = (l) => [...bats.filter((f) => new RegExp(`^tests/${l}(-[^/]*)?\\.bats$`).test(f)), ...node.filter((f) => f.startsWith(`tests/${l}/`))];
  // A lane whose tests are named some other way (docs scripts, tested by docs-*.bats is fine; a lane with
  // none at all is not) gets the core set, so "no files" never reads as green (attack p01 B2).
  for (const l of [...plan.lanes]) if (l !== "core" && ofLane(l).length === 0) { plan.lanes.add("core"); plan.why.push(`lane ${l} maps to no test file -> core`); }
  if (plan.lanes.has("core")) for (const l of nodeLanes()) plan.lanes.add(l);
  const pick = new Set(plan.direct);
  for (const l of plan.lanes) for (const f of ofLane(l)) pick.add(f);
  // A shared script's own tests are the bats files that name it; the rest of the suite is CI's.
  // shortcut: a name grep, not an import graph; misses a test that reaches the script indirectly, CI catches it.
  const names = plan.sharedHits.filter((p) => p.startsWith(".claude/scripts/core/")).map((p) => basename(p));
  for (const f of bats) if (names.some((n) => readFileSync(f, "utf8").includes(n))) pick.add(f);
  return [...pick];
}

function changedPaths(argv, stdin) {
  const i = argv.indexOf("--files");
  if (i >= 0) return { paths: readFileSync(argv[i + 1], "utf8").split(/\r?\n/).filter(Boolean) };
  const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "origin/main";
  // Tags carry no tests of their own; a branch ref is what runs.
  const pushes = stdin.split(/\r?\n/).filter(Boolean).map((l) => l.split(" ")).filter((f) => f[1] && !String(f[0]).startsWith("refs/tags/")).map((f) => f[1]);
  const heads = pushes.length ? pushes.filter((s) => !ZERO.test(s)) : ["HEAD"];
  if (!heads.length) return { paths: [], note: "delete push -- nothing to test" };
  const opts = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 };
  // The tests run from the working tree, which holds HEAD; a pushed commit that is not HEAD has its tests
  // somewhere else, so this tree cannot vouch for it (attack p01 B1, the non-HEAD control).
  const head = execFileSync("git", ["rev-parse", "HEAD"], opts).trim();
  const other = heads.filter((h) => h !== "HEAD" && h !== head);
  if (other.length) return { refuse: `pushing ${other.map((h) => h.slice(0, 8)).join(", ")}, which is not the checked-out HEAD -- check it out and push again (or push it by name from its own worktree)` };
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

// On Windows a bare `bash` can resolve to WSL's System32\bash.exe, where bats and this tree are absent and
// every step reads as a test failure (attack p01 B5). Take the bash that ships with git.
function bashPath() {
  if (process.platform !== "win32") return "bash";
  try {
    const exec = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(); // <git>/mingw64/libexec/git-core
    const b = join(dirname(dirname(dirname(exec))), "usr", "bin", "bash.exe");
    if (existsSync(b)) return b;
  } catch { /* fall through */ }
  return "bash";
}

// A hook child inherits GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE; a test sandbox running `git init` or
// `git commit` under them would write the real repo (attack p01 B3).
// PWD/OLDPWD go too: a hook shell that cd'd to git's `E:/...` toplevel exports that form, bash trusts it,
// and bats refuses it as "not an absolute path" (found by the p01 non-HEAD control).
const testEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_") && k !== "PWD" && k !== "OLDPWD"));

function run(files, deadline) {
  const bats = files.filter((f) => f.endsWith(".bats"));
  const node = files.filter((f) => f.endsWith(".test.mjs"));
  const steps = [];
  if (node.length) steps.push({ what: node, cmd: process.execPath, args: ["--test", "--test-reporter=tap", ...node] });
  // argv, never an interpolated program: a POSIX path inside `bash -c` breaks on the Windows leg.
  const bash = bashPath();
  for (const f of bats) steps.push({ what: [f], cmd: bash, args: ["-c", 'exec bats --print-output-on-failure "$@"', "bats", f] });
  const env = testEnv();
  for (let k = 0; k < steps.length; k++) {
    const left = deadline === Infinity ? undefined : deadline - Date.now();
    const capHit = () => { console.log(`test-changed: 5-minute cap hit; not run: ${steps.slice(k).flatMap((s) => s.what).join(" ")}`); return 1; };
    if (left !== undefined && left <= 0) return capHit();
    const isNode = steps[k].cmd === process.execPath;
    // node's TAP goes through a pipe so its `# tests N` can be read: a file that registers no test exits 0 (attack p01 L1).
    const r = spawnSync(steps[k].cmd, steps[k].args, { stdio: isNode ? ["ignore", "pipe", "inherit"] : "inherit", encoding: "utf8", timeout: left, env, maxBuffer: 64 * 1024 * 1024 });
    if (isNode && r.stdout) process.stdout.write(r.stdout);
    if (r.error && r.error.code === "ETIMEDOUT") return capHit();
    if (r.error) { console.log(`test-changed: could not start ${steps[k].cmd}: ${r.error.message}`); return 1; }
    if (r.status !== 0) { console.log(`test-changed: FAILED ${steps[k].what.join(" ")}`); return 1; }
    if (isNode) {
      const ran = Number(((r.stdout || "").match(/^# tests (\d+)$/m) || [])[1] || 0);
      if (ran === 0) { console.log(`test-changed: node --test ran 0 tests in ${steps[k].what.join(" ")}`); return 1; }
    }
  }
  return 0;
}

function main(argv) {
  const known = new Set(["--dry-run", "--quiet", "--all", "--ci", "--stdin", "--files", "--base"]);
  for (let i = 0; i < argv.length; i++) {
    if (!known.has(argv[i])) { console.log(`test-changed: unknown argument ${argv[i]}`); return 2; }
    if (argv[i] === "--files" || argv[i] === "--base") { if (!argv[i + 1] || argv[i + 1].startsWith("--")) { console.log(`test-changed: ${argv[i]} needs a value`); return 2; } i++; }
  }
  process.chdir(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  // `npm run ci`: CI's quality list, every node test, the floor. Through git's bash, never a PATH `bash`,
  // because npm on Windows may be started from PowerShell, where that is WSL's (attack p01 r2 B3).
  if (argv.includes("--ci")) {
    const q = spawnSync(bashPath(), [".claude/scripts/core/ci-quality.sh"], { stdio: "inherit", env: testEnv() });
    if (q.status !== 0) { console.log(`test-changed: ci-quality ${q.error ? `could not start: ${q.error.message}` : `exit ${q.status}`}`); return 1; }
    const node = walk("tests").filter((f) => f.endsWith(".test.mjs")).sort();
    if (node.length && run(node, Infinity) !== 0) return 1;
    return spawnSync(process.execPath, [".claude/scripts/core/ci-floor.mjs"], { stdio: "inherit" }).status === 0 ? 0 : 1;
  }
  if (argv.includes("--all")) {
    const all = walk("tests").filter((f) => f.endsWith(".bats") || f.endsWith(".test.mjs")).sort();
    console.log(`lanes: (all) -- ${all.length} file(s)`);
    return argv.includes("--dry-run") ? 0 : run(all, Infinity);
  }
  // Only the hook's stdin is read: an IDE or agent terminal can hold stdin open forever (attack p01 B7).
  const stdin = argv.includes("--stdin") ? readFileSync(0, "utf8") : "";
  const { paths, note, refuse } = changedPaths(argv, stdin);
  if (refuse) { console.log(`lanes: (refused)\ntest-changed: ${refuse}`); return 1; }
  const plan = planFor(paths, testsText("."));
  const files = filesFor(plan);
  const lanes = [...plan.lanes].sort();
  console.log(`lanes: ${lanes.length ? lanes.join(" ") : "(none)"}`);
  if (note) console.log(`why: ${note}`);
  if (!argv.includes("--quiet")) for (const w of plan.why) console.log(`why: ${w}`);
  // The tests read the working tree; edits not in the pushed commit can make this verdict differ from
  // CI's, which runs the commit itself. Said, not refused: CI is the gate (attack p01 r2 B1).
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).split("\n").filter(Boolean);
  if (dirty.length && !argv.includes("--files")) console.log(`test-changed: WARN ${dirty.length} tracked file(s) modified and not in the commit -- this run tests them too; CI tests the commit`);
  if (argv.includes("--dry-run")) { for (const f of files) console.log(`  ${f}`); return 0; }
  if (!files.length) { console.log(lanes.length ? "test-changed: no test file mapped" : "test-changed: paperwork only -- no tests to run"); return lanes.length ? 1 : 0; }
  return run(files, Date.now() + CAP_MS);
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return null; } })() : null;
if (invoked === self) process.exitCode = main(process.argv.slice(2));
