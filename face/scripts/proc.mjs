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

/** Resolve after `ms` without holding the event loop open. */
export function delay(ms) {
  return new Promise((r) => { const t = setTimeout(r, ms); t.unref?.(); });
}

/** Resolve true when the child exits within `ms`, false otherwise; the timer is always cleared. */
export function waitExit(child, ms) {
  if (isDead(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => { clearTimeout(t); resolve(true); };
    const t = setTimeout(() => { child.off("exit", onExit); resolve(false); }, ms);
    t.unref?.();
    child.once("exit", onExit);
  });
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
    else child.kill(signal);
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
