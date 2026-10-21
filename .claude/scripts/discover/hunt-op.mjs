#!/usr/bin/env node
// hunt-op.mjs -- the face's discover.hunt op (face Cycle 17 P03, REQ-09, ADR-1369). The door hands it the niche in the
// ARC_HUNT_NICHE environment variable, never on argv (arc-hunt.md: a niche never on argv): it validates the niche with
// discover's own parseNiche, writes it to .claude/state/discover/niche-<sha256>.txt -- a name derived from the niche,
// never the niche itself -- runs `arc-discover hunt --niche-file F` (the plan) or the same argv with `--emit` (the
// apply), and removes the file after the run, whatever the run did. One hunt per niche at a time: a lock beside the
// file refuses a second (HUNT_RUNNING). It spends on no model; the council judge stays /arc-hunt's.
//
//   ARC_HUNT_NICHE="invoice reminders" hunt-op.mjs [--emit] [--offline-fixture FILE]
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNiche } from "./arc-discover.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const DISCOVER = join(HERE, "arc-discover.mjs");
const RECORDED = join(REPO, "tests", "discover", "fixtures", "recorded", "hn.json");

/** The file names a niche is held under: derived from its hash, never from its text. @param {string} niche */
export function nichePaths(niche, root = REPO) {
  const id = createHash("sha256").update(niche).digest("hex").slice(0, 32);
  const dir = join(root, ".claude", "state", "discover");
  return { dir, file: join(dir, `niche-${id}.txt`), lock: join(dir, `niche-${id}.lock`) };
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const out = { emit: false, fixture: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--emit" && !out.emit) { out.emit = true; continue; }
    if (a === "--offline-fixture" && !out.fixture && typeof argv[i + 1] === "string" && argv[i + 1] !== "" && !argv[i + 1].startsWith("--")) { out.fixture = argv[++i]; continue; }
    return { error: `unknown or repeated argument ${JSON.stringify(a).slice(0, 60)} -- hunt-op takes [--emit] [--offline-fixture FILE], and the niche only in ARC_HUNT_NICHE` };
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if ("error" in args) { process.stderr.write(`hunt-op: ${args.error}\n`); return 2; }
  const niche = parseNiche(process.env.ARC_HUNT_NICHE ?? "");
  if (niche === null) { process.stderr.write("hunt-op: BAD_NICHE -- the niche must be 3-60 chars of lowercase letters, digits, spaces and hyphens\n"); return 2; }
  const p = nichePaths(niche);
  mkdirSync(p.dir, { recursive: true });
  let lockFd;
  try { lockFd = openSync(p.lock, "wx"); } catch (e) {
    if (/** @type {any} */ (e).code === "EEXIST") { process.stderr.write("hunt-op: HUNT_RUNNING -- a hunt for this niche is still running; wait for its receipt\n"); return 3; }
    throw e;
  }
  try {
    writeFileSync(p.file, `${niche}\n`, { flag: "wx" });
    // A scratch spine (a sim door, a test) hunts recorded HN, never the network: only a live door, which refuses
    // ARC_SPINE_ROOT, reaches Hacker News.
    const fixture = args.fixture || (process.env.ARC_SPINE_ROOT ? RECORDED : "");
    const argv = [DISCOVER, "hunt", "--niche-file", p.file, ...(fixture ? ["--offline-fixture", fixture] : []), ...(args.emit ? ["--emit"] : [])];
    // The niche is in the file, not here: the child's argv carries only the hashed path.
    const env = { ...process.env };
    delete env.ARC_HUNT_NICHE;
    const r = spawnSync(process.execPath, argv, { cwd: REPO, stdio: "inherit", env, timeout: 110_000, killSignal: "SIGKILL" });
    if (r.error) { process.stderr.write(`hunt-op: the hunt could not run (${/** @type {any} */ (r.error).code || "error"})\n`); return 1; }
    if (r.status === null) { process.stderr.write("hunt-op: the hunt did not finish in 110 s and was stopped -- no receipt\n"); return 1; }
    return r.status;
  } finally {
    rmSync(p.file, { force: true });
    try { closeSync(lockFd); } catch { /* closed */ }
    rmSync(p.lock, { force: true });
  }
}

function isMainModule() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try { return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) process.exitCode = main();
