#!/usr/bin/env node
// hunt-op.mjs -- the face's discover.hunt op (face Cycle 17 P03, REQ-09, ADR-1369). The door hands it the niche in the
// ARC_HUNT_NICHE environment variable, never on argv (arc-hunt.md: a niche never on argv): it validates the niche with
// discover's own parseNiche, writes it to .claude/state/discover/niche-<sha256>.txt -- a name derived from the niche,
// never the niche itself -- runs `arc-discover hunt --niche-file F` (the plan) or the same argv with `--emit` (the
// apply), and removes the file after the run, whatever the run did. One hunt per niche at a time: a lock beside the
// file refuses a second (HUNT_RUNNING). It spends on no model; the council judge stays /arc-hunt's.
//
//   ARC_HUNT_NICHE="invoice reminders" hunt-op.mjs [--emit] [--offline-fixture FILE]
import { createHash } from "node:crypto";
import { linkSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawnBounded } from "../core/spawn-bounded.mjs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNiche } from "./arc-discover.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const DISCOVER = join(HERE, "arc-discover.mjs");
const LOCK_MAX_MS = 150_000;
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

/** The env the hunt child gets: what node and the emitter need, nothing else -- no token reaches it (attack c551846 B4). */
export function huntEnv(env = process.env) {
  const KEEP = /^(PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|TMPDIR|LANG|LC_ALL|TZ|ARC_SPINE_ROOT)$/i;
  return Object.fromEntries(Object.entries(env).filter(([k, v]) => KEEP.test(k) && typeof v === "string"));
}

/** A scratch spine: ARC_SPINE_ROOT set, and outside this repo -- never the canonical spine dressed as one (B4). */
export function isScratchSpine(env = process.env, root = REPO) {
  const s = env.ARC_SPINE_ROOT;
  if (!s) return false;
  const a = resolve(s).toLowerCase(), r = resolve(root).toLowerCase();
  return a !== r && !a.startsWith(r + "\\") && !a.startsWith(r + "/");
}

/** The pid a lock names, if that process is alive: a lock left by a killed run is stale, never a wedge (B2). */
function liveHolder(lock) {
  let pid = 0, at = 0;
  try { [pid, at] = readFileSync(lock, "utf8").trim().split(" ").map(Number); } catch { return null; }
  if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(at)) return null;
  // A lock older than any hunt can run is stale whatever its pid says: a reused pid never wedges the niche again
  // (attack 54ad42f B2). A hunt is killed at 110 s; 150 s is that plus the time to settle.
  if (Date.now() - at > LOCK_MAX_MS) return null;
  try { process.kill(pid, 0); return pid; } catch (e) { return /** @type {any} */ (e).code === "EPERM" ? pid : null; }
}

/**
 * Take the lock atomically WITH its content: written to a private file, then hard-linked into place (link fails if the
 * lock exists), so no contender ever reads an empty lock (attack 54ad42f B1). A stale lock is broken by renaming it
 * away -- one rename wins -- never by a check-then-delete another contender could interleave.
 * @param {string} lock @returns {"taken" | "running"}
 */
function takeLock(lock) {
  const mine = `${lock}.${process.pid}.${Date.now()}`;
  writeFileSync(mine, `${process.pid} ${Date.now()}`, { flag: "wx" });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { linkSync(mine, lock); return "taken"; } catch (e) {
        if (/** @type {any} */ (e).code !== "EEXIST") throw e;
        if (liveHolder(lock) !== null) return "running";
        try { renameSync(lock, `${lock}.stale.${process.pid}.${Date.now()}`); } catch (r) { if (/** @type {any} */ (r).code !== "ENOENT") throw r; }
      }
    }
    return "running";
  } finally { rmSync(mine, { force: true }); }
}

/** The state directory, as a real directory inside this repo: a link or junction there is refused (attack c551846 B3). */
function realStateDir(dir) {
  mkdirSync(dir, { recursive: true });
  const st = lstatSync(dir);
  const real = realpathSync(dir), root = realpathSync(REPO);
  const rel = relative(root, real);
  if (!st.isDirectory() || st.isSymbolicLink() || rel === "" || rel.startsWith("..") || isAbsolute(rel))
    throw Object.assign(new Error("STATE_DIR_OUTSIDE -- .claude/state/discover is not a real directory inside this repo"), { code: "STATE_DIR_OUTSIDE" });
  return real;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if ("error" in args) { process.stderr.write(`hunt-op: ${args.error}\n`); return 2; }
  const niche = parseNiche(process.env.ARC_HUNT_NICHE ?? "");
  if (niche === null) { process.stderr.write("hunt-op: BAD_NICHE -- the niche must be 3-60 chars of lowercase letters, digits, spaces and hyphens\n"); return 2; }
  const p = nichePaths(niche);
  try { realStateDir(p.dir); } catch (e) { process.stderr.write(`hunt-op: ${/** @type {Error} */ (e).message}\n`); return 2; }
  if (takeLock(p.lock) === "running") { process.stderr.write("hunt-op: HUNT_RUNNING -- a hunt for this niche is still running; wait for its receipt\n"); return 3; }
  // A signal still clears the lock and the niche file (B2); the hunt tree is killed by spawnBounded on its own timeout.
  const clear = () => { rmSync(p.file, { force: true }); rmSync(p.lock, { force: true }); };
  const onSignal = () => { clear(); process.exit(130); };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    writeFileSync(p.file, `${niche}\n`);
    // A scratch spine (a sim door, a test) hunts recorded HN, never the network: only a live door, which refuses
    // ARC_SPINE_ROOT, reaches Hacker News.
    const fixture = args.fixture || (isScratchSpine() ? RECORDED : "");
    const argv = [DISCOVER, "hunt", "--niche-file", p.file, ...(fixture ? ["--offline-fixture", fixture] : []), ...(args.emit ? ["--emit"] : [])];
    // The niche is in the file, not here: the child's argv carries only the hashed path, and its env no niche and no
    // token. spawnBounded kills the WHOLE tree on its timeout and settles only when it is dead, so the lock is released
    // after the last process that could read the niche file is gone (attack c551846 B1).
    const r = await spawnBounded(process.execPath, argv, {
      cwd: REPO, env: huntEnv(), timeoutMs: 110_000,
      onData: (stream, chunk) => (stream === "out" ? process.stdout : process.stderr).write(chunk),
    });
    if (r.error) { process.stderr.write(`hunt-op: the hunt could not run (${r.error})\n`); return 1; }
    if (r.timedOut) { process.stderr.write("hunt-op: the hunt did not finish in 110 s and was stopped -- no receipt\n"); return 1; }
    return r.exit ?? 1;
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    clear();
  }
}

function isMainModule() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try { return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) process.exitCode = await main();
