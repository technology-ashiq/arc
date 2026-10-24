#!/usr/bin/env node
/**
 * migrate-guard.mjs -- the six mechanical guards on a bats -> node:test lane migration (ci REQ-09, ADR-2207;
 * PLAN-ci §6 + D.4). FAIL from birth. Workers run it before pushing; CI runs it on every `migrate/<lane>` PR.
 * A worker is trusted through these checks, never by reading its claims.
 *
 *   node .claude/scripts/core/migrate-guard.mjs <lane> [--base REF] [--no-run]
 *
 * base (default origin/main) is where the lane's bats files still exist. Guards, one PASS/FAIL row each:
 *   path      the diff base...HEAD touches only tests/<lane>/** and deletions of tests/<lane>-*.bats; a moved
 *             fixture is a 100%-similar rename
 *   count     node --test tests/<lane>/ reports >= the @test count of the base bats files; .count equals it
 *   names     MIGRATED.md maps every old @test name; every new name it lists exists as a test( in the new files
 *   density   new `assert.` calls >= 90% of the old `[ ]`/`[[ ]]`/assert_* lines inside @test bodies, unless
 *             MIGRATED.md gives a per-test reason (a row whose 4th column starts `density:`)
 *   skips     no skip / todo / .only anywhere in the new files
 *   green     the base bats files pass on HEAD's tree, and so does the new suite (--no-run: not checked, FAIL)
 *
 * Exit: 0 every guard PASS · 1 any FAIL · 2 usage.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const LANE = /^[a-z][a-z0-9-]*$/;
const OLD_ASSERT = /^\s*(\[\[? |assert_|run_assert|refute)/;
const SKIPS = /\.(skip|todo|only)\s*\(|\{\s*[^}]*\b(skip|todo|only)\s*:|\bt\.(skip|todo)\s*\(|--test-only/;

// NODE_TEST_CONTEXT makes a nested `node --test` report to its parent instead of printing TAP, so the guard
// would read no `# tests N` whenever it runs under a test runner (its own self-test does).
// PWD/OLDPWD too: an `E:/...` PWD from the caller is trusted by bash and refused by bats as not absolute.
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !["NODE_TEST_CONTEXT", "PWD", "OLDPWD"].includes(k) && !k.startsWith("GIT_")));
const git = (args, opts = {}) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024, ...opts });
const walk = (d, out = []) => { if (!existsSync(d)) return out; for (const e of readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p, out); else if (e.isFile()) out.push(p); } return out; };

/** @test names and per-test assertion-line counts of one bats source. */
export function batsTests(src) {
  const tests = [];
  let cur = null;
  for (const l of src.replace(/\r/g, "").split("\n")) {
    const m = l.match(/^[ \t]*@test[ \t]+(["'])(.*)\1[ \t]*\{/);
    if (m) { cur = { name: m[2], asserts: 0 }; tests.push(cur); continue; }
    if (cur && /^\}/.test(l)) { cur = null; continue; }
    if (cur && OLD_ASSERT.test(l)) cur.asserts++;
  }
  return tests;
}

/** test("name") literals and the `assert.` call count of node test sources. */
export function nodeTests(srcs) {
  const names = [];
  let asserts = 0;
  for (const s of srcs) {
    for (const m of s.matchAll(/^test\((["'`])((?:\\.|(?!\1).)*)\1/gm)) names.push(m[2].replace(/\\(.)/g, "$1"));
    asserts += (s.match(/\bassert(\.[a-zA-Z]+)?\s*\(/g) || []).length;
  }
  return { names, asserts };
}

/** MIGRATED.md rows: | old name | new name | file | note |. */
export function nameMap(md) {
  const rows = [];
  for (const l of md.replace(/\r/g, "").split("\n")) {
    const c = l.split("|").slice(1, -1).map((x) => x.trim());
    if (c.length < 3 || /^-+$/.test(c[0]) || c[0] === "old @test") continue;
    rows.push({ old: c[0].replace(/^`|`$/g, ""), neu: c[1].replace(/^`|`$/g, ""), file: c[2], note: c[3] ?? "" });
  }
  return rows;
}

export function guard(lane, { root, base, run = true }) {
  const rows = [];
  const row = (g, ok, why) => rows.push({ g, ok, why });
  const dir = `tests/${lane}`;
  const batsRe = new RegExp(`^tests/${lane.replace(/-/g, "\\-")}-[^/]*\\.bats$`);
  const exact = `tests/${lane}.bats`;
  const isOld = (p) => batsRe.test(p) || p === exact;

  // base side: the lane's bats files as they were
  const baseFiles = git(["ls-tree", "-r", "--name-only", base, "tests/"], { cwd: root }).split("\n").filter(isOld);
  const old = baseFiles.flatMap((f) => batsTests(git(["show", `${base}:${f}`], { cwd: root })).map((t) => ({ ...t, file: f })));

  // path: every change inside the lane dir, or a deletion of one of its bats files; renames are exact
  const st = git(["-c", "core.quotePath=false", "diff", "-z", "--name-status", "-M100%", `${base}...HEAD`], { cwd: root }).split("\0").filter(Boolean);
  const bad = [];
  for (let i = 0; i < st.length; i++) {
    const s = st[i];
    if (s.startsWith("R")) { const [from, to] = [st[++i], st[++i]]; if (!to.startsWith(`${dir}/`) || s !== "R100") bad.push(`${s} ${from} -> ${to}`); continue; }
    const p = st[++i];
    if (p.startsWith(`${dir}/`)) continue;
    if (s === "D" && isOld(p)) continue;
    bad.push(`${s} ${p}`);
  }
  row("path", bad.length === 0, bad.length ? `outside tests/${lane}/**: ${bad.slice(0, 5).join(", ")}${bad.length > 5 ? ` (+${bad.length - 5})` : ""}` : `${st.length} change record(s), all in the lane`);
  const leftover = walk(join(root, "tests")).map((p) => p.slice(root.length + 1).split("\\").join("/")).filter(isOld);
  if (leftover.length) row("path", false, `old bats file(s) still on HEAD: ${leftover.join(", ")}`);

  // new side
  const newFiles = walk(join(root, dir)).filter((f) => f.endsWith(".test.mjs"));
  const srcs = newFiles.map((f) => readFileSync(f, "utf8"));
  const neu = nodeTests(srcs);
  const countFile = join(root, dir, ".count");
  const claimed = existsSync(countFile) ? readFileSync(countFile, "utf8").trim() : "";

  // count: what node REPORTS it ran, never what the files declare
  let ran = null;
  if (run) {
    const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", `${dir}/**/*.test.mjs`], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: cleanEnv() });
    ran = { status: r.status, tests: Number((String(r.stdout).match(/^# tests (\d+)$/m) || [])[1] ?? -1), fail: Number((String(r.stdout).match(/^# fail (\d+)$/m) || [])[1] ?? -1) };
  }
  const n = ran ? ran.tests : neu.names.length;
  const countOk = old.length > 0 && n >= old.length && claimed === String(n);
  row("count", countOk, `${old.length} @test on ${base} in ${baseFiles.length} file(s); node ${ran ? "reported" : "declares"} ${n}; .count ${claimed || "missing"}`);

  // names: every old name mapped, every mapped new name real
  const mdPath = join(root, dir, "MIGRATED.md");
  const map = existsSync(mdPath) ? nameMap(readFileSync(mdPath, "utf8")) : [];
  const mapped = new Set(map.map((r) => r.old));
  const missing = old.filter((t) => !mapped.has(t.name)).map((t) => t.name);
  const real = new Set(neu.names);
  const ghosts = map.filter((r) => r.neu !== "DROPPED" && !real.has(r.neu)).map((r) => r.neu);
  const dropped = map.filter((r) => r.neu === "DROPPED" && !r.note);
  row("names", existsSync(mdPath) && !missing.length && !ghosts.length && !dropped.length,
    !existsSync(mdPath) ? "no MIGRATED.md" : missing.length ? `unmapped: ${missing.slice(0, 3).join(" | ")}` : ghosts.length ? `maps to no test: ${ghosts.slice(0, 3).join(" | ")}` : dropped.length ? "a DROPPED row with no reason" : `${map.length} row(s), every old name mapped`);

  // density
  const oldAsserts = old.reduce((s, t) => s + t.asserts, 0);
  const waived = map.filter((r) => /^density:/.test(r.note)).map((r) => r.old);
  const need = Math.ceil(0.9 * old.filter((t) => !waived.includes(t.name)).reduce((s, t) => s + t.asserts, 0));
  row("density", neu.asserts >= need, `new assert calls ${neu.asserts}, old assertion lines ${oldAsserts} (need >= ${need}${waived.length ? `, ${waived.length} waived` : ""})`);

  // skips
  const hits = newFiles.filter((f, i) => SKIPS.test(srcs[i].split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n")));
  row("skips", hits.length === 0, hits.length ? `skip/todo/only in ${hits.map((f) => f.slice(root.length + 1)).join(", ")}` : `${newFiles.length} file(s) clean`);

  // green: the old files run on HEAD's tree (restored into tests/, then removed), and the new suite passed
  if (!run) row("green", false, "--no-run: both suites not run");
  else {
    const restored = [];
    let oldOk = false, why = "";
    try {
      for (const f of baseFiles) {
        if (existsSync(join(root, f))) throw new Error(`${f} exists on HEAD; cannot restore the base copy over it`);
        writeFileSync(join(root, f), git(["show", `${base}:${f}`], { cwd: root }));
        restored.push(f);
      }
      const b = spawnSync(bash(), ["-c", 'exec bats "$@"', "bats", ...baseFiles], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: cleanEnv() });
      const okN = (String(b.stdout).match(/^ok /gm) || []).length;
      oldOk = b.status === 0 && okN === old.length;
      why = `old bats ${b.status === 0 ? "green" : `exit ${b.status}`} (${okN} of ${old.length} ok)`;
    } catch (e) { why = `old bats not run: ${e.message}`; }
    finally { for (const f of restored) rmSync(join(root, f), { force: true }); }
    const newOk = ran.status === 0 && ran.fail === 0 && ran.tests > 0;
    row("green", oldOk && newOk, `${why}; node ${newOk ? "green" : `exit ${ran.status}, ${ran.fail} fail`} (${ran.tests} tests)`);
  }
  return rows;
}

function bash() {
  if (process.platform !== "win32") return "bash";
  try { const b = join(dirname(dirname(dirname(git(["--exec-path"]).trim()))), "usr", "bin", "bash.exe"); if (existsSync(b)) return b; } catch { /* PATH */ }
  return "bash";
}

function main(argv) {
  const lane = argv[0];
  if (!lane || !LANE.test(lane)) { console.log("usage: migrate-guard.mjs <lane> [--base REF] [--no-run]"); return 2; }
  let base = "origin/main";
  let run = true;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--base" && argv[i + 1] && !argv[i + 1].startsWith("--")) base = argv[++i];
    else if (argv[i] === "--no-run") run = false;
    else { console.log(`migrate-guard: unknown argument ${argv[i]}`); return 2; }
  }
  const root = git(["rev-parse", "--show-toplevel"]).trim();
  let rows;
  try { rows = guard(lane, { root, base, run }); }
  catch (e) { console.log(`migrate-guard: FAIL -- ${String(e.message).split("\n")[0]}`); return 1; }
  console.log(`migrate-guard: lane ${lane}, base ${base}`);
  for (const r of rows) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.g.padEnd(8)} ${r.why}`);
  const failed = rows.filter((r) => !r.ok).length;
  console.log(failed ? `migrate-guard: FAIL (${failed} guard(s))` : "migrate-guard: PASS");
  return failed ? 1 : 0;
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return null; } })() : null;
if (invoked === self) process.exitCode = main(process.argv.slice(2));
