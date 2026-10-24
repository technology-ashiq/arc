// tests/_lib -- the node:test helpers arc's tests actually use (ci Phase 02, ADR-2202). The subset of
// test_helper.bash that bats files called, nothing speculative: ARC_ROOT, a per-test temp dir, a spawn that
// returns {status, stdout, stderr, output}, a scratch copy of the tree, and a mutant that proves it changed.
// Workers migrating a lane may not edit this file (tests/MIGRATING.md); a missing helper is a stop-and-report.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test as nodeTest } from "node:test";

export const ARC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A fresh temp dir removed when the test ends. `t` is the node:test context. */
export function tmpDir(t, prefix = "arc-") {
  const d = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  return d;
}

// bats `run`: status + merged output, trailing newlines stripped the way bats strips them.
function result(r) {
  if (r.error && r.error.code !== "ETIMEDOUT") throw r.error;
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  return { status: r.status, stdout, stderr, output: (stdout + stderr).replace(/\n+$/, "") };
}

/** Run a node script. `opts.env` is merged over process.env; `opts.input` is stdin. */
export function runNode(script, args = [], opts = {}) {
  return result(spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8", cwd: opts.cwd ?? ARC_ROOT, input: opts.input ?? "", timeout: opts.timeout ?? 300000,
    env: { ...process.env, ...(opts.env ?? {}) },
  }));
}

/** Run a bash script (the 23 bash-script cases). Arguments are argv, never interpolated into a program. */
export function runBash(script, args = [], opts = {}) {
  return result(spawnSync("bash", [script, ...args], {
    encoding: "utf8", cwd: opts.cwd ?? ARC_ROOT, input: opts.input ?? "", timeout: opts.timeout ?? 300000,
    env: { ...process.env, ...(opts.env ?? {}) },
  }));
}

/** Copy repo-relative paths (files or dirs) from ARC_ROOT into `dest`, keeping their layout. */
export function copyTree(dest, paths, { optional = [] } = {}) {
  for (const p of [...paths, ...optional]) {
    const src = join(ARC_ROOT, p);
    if (!existsSync(src)) { if (optional.includes(p)) continue; throw new Error(`copyTree: ${p} is not in the tree`); }
    mkdirSync(dirname(join(dest, p)), { recursive: true });
    if (statSync(src).isDirectory()) cpSync(src, join(dest, p), { recursive: true });
    else copyFileSync(src, join(dest, p));
  }
  return dest;
}

/**
 * Copy `src` to `dest` (default: a temp file of the same name), apply `edit(text) -> text`, and ASSERT the
 * bytes changed before returning the path: a mutation that matched nothing is a test of the original
 * (retro 2026-10-14#3).
 */
export function mutant(t, src, edit, dest) {
  const out = dest ?? join(tmpDir(t), src.split(/[\\/]/).pop());
  const before = readFileSync(src, "utf8");
  const after = edit(before);
  assert.notEqual(after, before, `the mutation changed nothing in ${src}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, after);
  return out;
}

/** Edit a file in place and assert it changed (the in-place half of `mutant`). */
export function mutate(path, edit) {
  const before = readFileSync(path, "utf8");
  const after = edit(before);
  assert.notEqual(after, before, `the mutation changed nothing in ${path}`);
  writeFileSync(path, after);
}

/** sed `s/RE/TO/` on every line, as sed applies it: a /m regex, every matching line. */
export const sed = (re, to) => (text) => text.replace(new RegExp(re.source, "gm"), to);

/** test_helper.bash `_arc_tree_manifest`: `path<TAB>sha256` per file, CR stripped, sorted bytewise. */
export function treeManifest(root) {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) { if (relative(root, p) !== ".git") walk(p); } else if (e.isFile()) files.push(p); } };
  walk(root);
  return files.map((f) => relative(root, f).split("\\").join("/")).filter((r) => r !== ".claude/arc-registry.json")
    .sort((a, b) => (Buffer.from(a) < Buffer.from(b) ? -1 : Buffer.from(a) > Buffer.from(b) ? 1 : 0))
    .map((r) => `${r}\t${createHash("sha256").update(readFileSync(join(root, r), "utf8").replace(/\r/g, "")).digest("hex")}`).join("\n") + "\n";
}

/**
 * A file's registered-test check, the node twin of the bats "every test in this file is registered" case.
 * `const { test, registered } = suite(import.meta.url)`, then call `test(...)` as usual: every top-level
 * `test(` line in the source must have registered, so a test lost to a bad edit is a failure, not a smaller suite.
 */
export function suite(url) {
  let n = 0;
  return {
    test: (name, ...rest) => { n++; return nodeTest(name, ...rest); },
    registered: () => n,
    declared: () => readFileSync(fileURLToPath(url), "utf8").split("\n").filter((l) => /^test\(/.test(l)).length,
  };
}
