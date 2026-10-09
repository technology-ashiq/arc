#!/usr/bin/env node
/**
 * install-targets/claude-code.mjs -- what a claude-code install places (distribute P03, ADR-2005/2018).
 *
 * The file set is exactly what `sync-to-project.sh` full mode copied before P03, and the sync golden
 * (tests/fixtures/sync-golden/tree-manifest.txt) pins it: `.claude/` minus the per-machine and working
 * state that never belongs in a consumer, `docs/templates/`, `docs/playbooks/`, the meta docs, the
 * Constitution and the council skeleton. `sync-to-project.sh` is now a thin caller of this file.
 *
 * The settings merge belongs here (ADR-2005): a project's own `.claude/settings.json` keys survive,
 * merged by arc-settings-merge.mjs at plan time, so a merge that fails refuses before anything is written.
 *
 * The install record lives inside `.claude/arc-registry.json` under `install`, not in a second manifest:
 * the registry is already the consumer's ownership file and the golden already excludes it.
 */

import { execFileSync } from "node:child_process";
import { closeSync, existsSync, lstatSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Refused, REGISTRY, opBytes, sha } from "./common.mjs";

export const ID = "claude-code";
export const MANIFEST_PATH = REGISTRY;

// rsync's excludes in the old full sync, which matched these names at any depth under .claude/.
const EXCLUDED_DIR = new Set(["state", "worktrees"]);
// arc-registry.json is the install record, written by the run itself, so a copy in the source never rides along (attack d32e714 B5).
const EXCLUDED_FILE = new Set(["settings.local.json", "scheduled_tasks.lock", "arc-registry.json"]);
const META_DOCS = ["blueprint.md", "how-it-works.md", "build-playbook.md", "product-runbook.md", "plugins.md", "usermanual.md"];

// What only Claude Code reads. Every other target installs the rest as its support payload, because
// the rendered commands still call `.claude/scripts/...` and read `.claude/rules/...`.
export const CLAUDE_SURFACE = Object.freeze([".claude/commands/", ".claude/agents/", ".claude/hooks/", ".claude/output-styles/", ".claude/skills/", ".claude/settings.json"]);

function walk(tree, rel, out, { claudeExcludes }) {
  const abs = join(tree, rel);
  for (const n of readdirSync(abs).sort()) {
    const r = `${rel}/${n}`;
    const st = lstatSync(join(tree, r));
    if (claudeExcludes && (n.startsWith(".headroom_wrap_") || (st.isDirectory() && EXCLUDED_DIR.has(n)) || (!st.isDirectory() && EXCLUDED_FILE.has(n)))) continue;
    if (st.isSymbolicLink()) throw new Refused("source-symlink", `${r} is a symlink in the arc tree; an install copies regular files only`);
    if (st.isDirectory()) walk(tree, r, out, { claudeExcludes });
    else if (st.isFile()) out.push(r);
  }
}

/** Every file the full payload copies, as tree-relative paths, sorted. */
export function payload(tree) {
  const files = [];
  walk(tree, ".claude", files, { claudeExcludes: true });
  for (const d of ["docs/templates", "docs/playbooks"]) if (existsSync(join(tree, d))) walk(tree, d, files, { claudeExcludes: false });
  for (const f of META_DOCS) if (existsSync(join(tree, "docs", f))) files.push(`docs/${f}`);
  for (const f of ["CONSTITUTION.md", "docs/council/README.md", "docs/council/references/fairness.md"]) if (existsSync(join(tree, f))) files.push(f);
  return files;
}

export const fileOp = (tree, path) => {
  const op = { kind: "write", path, from: join(tree, path) };
  op.sha = sha(opBytes(op));
  return op;
};

// The directories the old sync made even when they stayed empty.
const DIRS = [".claude", "docs", "docs/templates", "docs/playbooks", "docs/council/references", "docs/council/sessions/.juror"];

export function plan(tree) {
  const ops = DIRS.map((path) => ({ kind: "mkdir", path }));
  for (const path of payload(tree)) ops.push(fileOp(tree, path));
  return { ops, degraded: [], notes: [] };
}

/**
 * The plan against one project: its own `.claude/settings.json` keys survive the copy, merged now by
 * arc-settings-merge.mjs, so a merge that fails refuses before anything is written.
 */
export function finishPlan(p, tree, dir) {
  const path = ".claude/settings.json";
  const at = p.ops.findIndex((o) => o.path === path);
  if (at < 0 || !existsSync(join(dir, path))) return p;
  let merged;
  try {
    merged = runNode(join(tree, ".claude/scripts/core/arc-settings-merge.mjs"), [join(tree, path), join(dir, path)]);
  } catch (e) {
    throw new Refused("settings-merge", `the project's .claude/settings.json could not be merged, and nothing was written: ${String(e.stderr || e.message).trim()}`);
  }
  const text = `${merged.replace(/\n+$/, "")}\n`;
  const ops = p.ops.slice();
  ops[at] = { kind: "merge", path, text, sha: sha(Buffer.from(text)) };
  return { ...p, ops };
}

/**
 * Run one of arc's node scripts and return its stdout. Both scripts this target calls write and then exit, and
 * on macOS stdout to a pipe is asynchronous, so the exit cut the output at 8192 bytes (CI macos shard 3 on
 * 88c2fb6). A file descriptor is written synchronously, so stdout goes to a temp file instead of a pipe.
 */
function runNode(script, args) {
  const tmp = mkdtempSync(join(tmpdir(), "arc-install-"));
  const out = join(tmp, "stdout");
  try {
    const fd = openSync(out, "w");
    try { execFileSync(process.execPath, [script, ...args], { stdio: ["ignore", fd, "pipe"] }); } finally { closeSync(fd); }
    return readFileSync(out, "utf8");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

/** The registry the resolver writes, carrying the install record under `install`. */
export function manifestText(tree, record) {
  let reg;
  try {
    reg = JSON.parse(runNode(join(tree, ".claude/scripts/core/arc-products.mjs"), ["--registry", "--root", tree]));
  } catch (e) {
    throw new Refused("registry", `registry generation failed: ${String(e.stderr || e.message).trim()}`);
  }
  return `${JSON.stringify({ ...reg, install: record }, null, 2)}\n`;
}

export { apply, doctor } from "./common.mjs";
