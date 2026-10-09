#!/usr/bin/env node
/**
 * bin/arc.mjs -- the `arc` command (distribute P04, ADR-2008, REQ-08).
 *
 * A dispatcher, never a second implementation: every verb hands its arguments to a script that already
 * exists, with the package root as the arc source.
 *
 *   arc init --target claude-code|codex|opencode|skills-only [--dir DIR] [--dry-run] [--force]
 *        install arc into DIR (default: the current directory) through arc-install.mjs; in a git repo whose
 *        core.hooksPath is unset, point it at the installed consumer hooks (.claude/templates/githooks).
 *   arc doctor                 the package checks itself: Node version, its own files, and a plan for every
 *                              target. Exit 0 means this copy of arc can install.
 *   arc doctor --dir DIR       the truth of an install in DIR (placed / degraded / missing / unmanaged-conflict)
 *   arc doctor --repo [...]    main's branch protection read back (arc-doctor.mjs)
 *   arc compile ARGS...        arc-compile.mjs ARGS...
 *   arc --version | help
 *
 * Zero dependencies (ADR-2008); the package is `private` so npm refuses to publish it.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(realpathSync(fileURLToPath(import.meta.url))), "..");
const S = (p) => join(ROOT, ".claude", "scripts", ...p.split("/"));
const INSTALL = S("engine/arc-install.mjs");
const HOOKS = ".claude/templates/githooks";
const TARGETS = ["claude-code", "codex", "opencode", "skills-only"];

const run = (script, args, opts = {}) => spawnSync(process.execPath, [script, ...args], { stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit", encoding: "utf8", cwd: opts.cwd, maxBuffer: 64 * 1024 * 1024 });
// A git that cannot start reads as empty output and a non-zero status, never a TypeError (attack 188f724 B4).
const git = (dir, args) => { const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); return { status: r.error ? -1 : r.status, stdout: (r.stdout || "").trim() }; };

function usage(code) {
  (code ? console.error : console.log)("usage: arc init --target <claude-code|codex|opencode|skills-only> [--dir DIR] [--dry-run] [--force]\n       arc doctor [--dir DIR | --repo ...]\n       arc compile <arc-compile args>\n       arc --version");
  return code;
}

function version() {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
}

function init(args) {
  const out = [];
  let dir = process.cwd(), dirGiven = false, dryRun = false, target = "";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dir" || a === "--target") {
      const v = args[i + 1];
      if (v === undefined || v === "" || v.startsWith("--")) { console.error(`arc init: ${a} needs a value`); return 2; }
      if (a === "--dir" ? dirGiven && v !== dir : target && v !== target) { console.error(`arc init: ${a} given twice with different values`); return 2; }
      if (a === "--dir") { dir = v; dirGiven = true; } else target = v;
      i++;
    } else if (a === "--dry-run" || a === "--force" || a === "--quiet") { if (a === "--dry-run") dryRun = true; out.push(a); }
    else { console.error(`arc init: unknown argument ${a}`); return 2; }
  }
  if (!TARGETS.includes(target)) { console.error(`arc init: --target must be one of ${TARGETS.join(", ")}`); return 2; }
  const r = run(INSTALL, ["--target", target, "--dir", dir, "--source", ROOT, ...out]);
  if (r.status !== 0 || dryRun) return r.status ?? 1;
  return wireHooks(dir, target);
}

/**
 * The commit-time line (ADR-2013), wired only where it cannot take something away:
 * - at the repo root, never for a subdirectory of someone else's repo (attack 188f724 B1);
 * - never over hooks the project already runs from .git/hooks, which core.hooksPath would silently
 *   disable (B2), and never over a hooks path the project chose;
 * - only once both hooks are executable, fixed where a tarball dropped the bit (B3).
 */
function wireHooks(dir, target) {
  if (git(dir, ["rev-parse", "--is-inside-work-tree"]).stdout !== "true") return 0;
  const top = git(dir, ["rev-parse", "--show-toplevel"]).stdout;
  let same = false;
  try { same = top !== "" && realpathSync(top) === realpathSync(dir); } catch { same = false; }
  if (!same) { console.log(`hooks: not set -- ${dir} is inside the repo at ${top || "an unknown root"}, not its root; run arc init there to wire them`); return 0; }
  const have = git(dir, ["config", "--get", "core.hooksPath"]).stdout;
  if (have && have !== HOOKS) { console.log(`hooks: left as core.hooksPath=${have}; the project chose its own (arc's are in ${HOOKS})`); return 0; }
  if (!existsSync(join(dir, HOOKS, "pre-commit"))) { console.log(`hooks: not set -- ${HOOKS} was not installed by the \`${target}\` target`); return 0; }
  const hooksDir = git(dir, ["rev-parse", "--git-path", "hooks"]).stdout;
  let theirs = [];
  try { theirs = readdirSync(join(dir, hooksDir)).filter((n) => !n.endsWith(".sample")); } catch { theirs = []; }
  if (!have && theirs.length) { console.log(`hooks: not set -- the project runs ${theirs.join(", ")} from ${hooksDir}, which core.hooksPath would disable; arc's are in ${HOOKS}`); return 0; }
  for (const h of ["pre-commit", "pre-push"]) {
    const p = join(dir, HOOKS, h);
    if (process.platform !== "win32" && (statSync(p).mode & 0o111) === 0) chmodSync(p, 0o755);
  }
  if (git(dir, ["config", "core.hooksPath", HOOKS]).status !== 0) { console.log("hooks: could not set core.hooksPath"); return 1; }
  console.log(`hooks: core.hooksPath=${HOOKS} (branch guard + secret scan at commit time)`);
  return 0;
}

// The package checks itself: what a fresh `npm i -g` must be able to do before it touches any project.
function selfDoctor() {
  let bad = 0;
  const line = (ok, what) => { console.log(`${ok ? "ok" : "FAIL"} ${what}`); if (!ok) bad++; };
  const major = Number(process.versions.node.split(".")[0]);
  line(major >= 18, `node ${process.versions.node} (arc needs 18 or newer)`);
  for (const f of ["engine/harnesses.yaml", "engine/frontmatter-keys.yaml", ".claude/scripts/engine/arc-install.mjs", ".claude/scripts/core/arc-products.mjs", ".claude/commands/arc-commit.md"]) line(existsSync(join(ROOT, f)), `package file ${f}`);
  for (const t of TARGETS) {
    const r = run(INSTALL, ["--target", t, "--dry-run", "--quiet", "--source", ROOT], { capture: true });
    const plan = (r.stdout || "").split("\n").find((l) => l.startsWith(`plan: ${t} `));
    line(r.status === 0 && Boolean(plan), `target ${t}: ${plan ? plan.replace(/ into <dir>$/, "") : `no plan (exit ${r.status}): ${(r.stdout || r.stderr || "").trim().split("\n").pop()}`}`);
  }
  console.log(`arc ${version()} at ${ROOT}: ${bad ? `${bad} check(s) failed` : "ready to install"}`);
  console.log("RAN arc-doctor");
  return bad ? 1 : 0;
}

function main(argv) {
  const [verb, ...rest] = argv;
  if (verb === "--version" || verb === "-v") { console.log(version()); return 0; }
  if (verb === undefined || verb === "help" || verb === "--help" || verb === "-h") return usage(verb === undefined ? 2 : 0);
  if (verb === "init") return init(rest);
  if (verb === "doctor") {
    // A missing, empty or flag-shaped directory is a usage error, never handed on as a path (attack 188f724 L6, B7).
    if (rest[0] === "--dir") return rest.length === 2 && rest[1] !== "" && !rest[1].startsWith("--") ? run(INSTALL, ["--doctor", rest[1]]).status ?? 1 : usage(2);
    if (rest[0] === "--repo") return run(S("engine/arc-doctor.mjs"), rest).status ?? 1;
    return rest.length ? usage(2) : selfDoctor();
  }
  if (verb === "compile") return run(S("engine/arc-compile.mjs"), rest).status ?? 1;
  console.error(`arc: unknown command ${verb}`);
  return usage(2);
}

process.exitCode = main(process.argv.slice(2));
