// proc.mjs -- child-process lifecycle for the browser harness, in one place, because the first
// version got it wrong in four files at once (attack 2026-09-17):
//   - a child that died on a SIGNAL has exitCode null, so "exitCode !== null" waited it out;
//   - one SIGTERM with no escalation let a surviving Chrome helper keep bats' fd 3 open, which
//     hangs a CI job until the runner's limit;
//   - a `sleep(5000)` raced against 'exit' and never cleared kept every process alive 5 s longer;
//   - a temp directory that could not be removed was dropped without a word.
// arc-face.mjs already treats `signalCode` as death; this module is that rule, shared.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

export const POSIX = process.platform !== "win32";

/** A child is dead when it has an exit code OR was killed by a signal OR never started. */
export function isDead(child) {
  return child.exitCode !== null || child.signalCode !== null || Boolean(child.spawnError);
}

export function deathReason(child) {
  if (child.spawnError) return `could not start: ${child.spawnError.message}`;
  if (child.signalCode !== null) return `killed by ${child.signalCode}`;
  if (child.exitCode !== null) return `exited ${child.exitCode}`;
  return "alive";
}

/** Resolve after `ms`. */
// An AWAITED timer must hold the process. `unref()` on one lets node exit with code 13 before the
// await resumes, once nothing else is alive -- a dead Chrome, a finished child -- so a cleanup
// retry or a verdict silently never happens (CI run 35183482747: the client suite stopped
// mid-file). A race timer is cleared when the race settles instead; see settleWithin.
export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** `promise`, or `fallback` after `ms`, whichever settles first; the timer is always cleared. */
export function settleWithin(promise, ms, fallback = undefined) {
  let t;
  const timer = new Promise((r) => { t = setTimeout(() => r(fallback), ms); });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

/** Resolve true when the child exits within `ms`, false otherwise; the timer is always cleared. */
export function waitExit(child, ms) {
  if (isDead(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => { clearTimeout(t); resolve(true); };
    const t = setTimeout(() => { child.off("exit", onExit); resolve(false); }, ms);
    child.once("exit", onExit);
  });
}

/** Every child spawnTracked started and has not seen exit: what a stop must end (debt #D23). */
const LIVE = new Set();

/** Stop every live tracked child and its whole tree. */
export async function stopAll() {
  await Promise.all([...LIVE].map((c) => stopTree(c, { graceMs: 1500 })));
}

/**
 * End the harness cleanly when it is told to stop: SIGINT and SIGTERM on POSIX, the IPC `shutdown` message on win32
 * (where a parent cannot deliver a catchable signal), and an uncaught error. Every tracked tree is stopped and
 * `cleanup` runs before exit, so a runner kill no longer skips the `finally` and leaks children (debt #D23).
 * @param {() => Promise<void> | void} cleanup @param {(code: number) => void} [exit]
 */
export function installStopHandlers(cleanup, exit = (code) => process.exit(code)) {
  let stopping = false;
  const stop = async (code) => {
    if (stopping) return;
    stopping = true;
    try { await stopAll(); } catch { /* best effort */ }
    try { await cleanup(); } catch { /* best effort */ }
    exit(code);
  };
  process.once("SIGINT", () => { stop(130); });
  process.once("SIGTERM", () => { stop(143); });
  process.on("message", (m) => { if (m && typeof m === "object" && m.type === "shutdown") stop(143); });
  process.once("uncaughtException", (e) => { process.stderr.write(`harness: uncaught ${e && e.message}
`); stop(2); });
  return stop;
}

/**
 * Spawn with the harness's defaults: stdin ignored, stderr captured (tail only), never a
 * window, and on POSIX its own process group so the whole tree can be killed at once.
 */
export function spawnTracked(command, args, opts = {}) {
  const child = spawn(command, args, {
    ...opts,
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
    detached: POSIX,
  });
  LIVE.add(child);
  child.once("exit", () => LIVE.delete(child));
  let tail = "";
  child.spawnError = null;
  child.on("error", (e) => { child.spawnError = e; });
  child.stderr?.on("data", (d) => { tail = (tail + d.toString("utf8")).slice(-4000); });
  child.stderrTail = () => tail.trim();
  return child;
}

function signalTree(child, signal) {
  try {
    if (POSIX) process.kill(-child.pid, signal);
    // win32 has no process group to signal, and child.kill ends the direct child ONLY: it exited inside the grace, the
    // taskkill below never ran, and its grandchild lived on (debt #D23). The tree is ended by taskkill /T at once.
    else spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore", windowsHide: true, timeout: 10000 });
  } catch { /* already gone */ }
}

/** Stop a child and everything it started: polite, then forced, then its pipes closed. */
export async function stopTree(child, { graceMs = 3000 } = {}) {
  if (!child || !child.pid) return;
  if (!isDead(child)) {
    signalTree(child, "SIGTERM");
    if (!(await waitExit(child, graceMs))) {
      if (POSIX) signalTree(child, "SIGKILL");
      else spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore", windowsHide: true, timeout: 10000 });
      await waitExit(child, 2000);
    }
  }
  // A grandchild that survived still holds the pipe; destroying our end stops it keeping us alive.
  child.stderr?.destroy();
  child.stdout?.destroy();
}

/** Remove a directory, retrying for locks; a directory that survives is reported, not ignored. */
export async function removeDir(dir, label) {
  let last = null;
  for (let i = 0; i < 5; i++) {
    try { rmSync(dir, { recursive: true, force: true }); } catch (e) { last = e; }
    if (!existsSync(dir)) return true;
    await delay(300);
  }
  process.stderr.write(`WARN ${label}: could not remove ${dir}${last ? ` (${last.code ?? last.message})` : ""}\n`);
  return false;
}
