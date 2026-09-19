// spawn-bounded.mjs -- one child process that never outlives its timeout, and never holds its caller past its exit
// (face v2 Phase 05, ADR-1339 and ADR-1340).
//
// Two callers share this, so a fix lands once: the work door's runTool (every tool the face runs) and the
// proposal-branch writer's git calls. Both were attacked for the same two faults. A timeout ended the direct child
// and left the tree it started running (a paid driver under the door, the real git.exe under Git for Windows'
// launcher). And a settle waited on pipes that a descendant still held, so a call that had finished read as hung
// (PR 2 shell attack, then PR 3a's).
//
//   spawnBounded(file, args, { cwd, env, input, timeoutMs, onData })  ->  Promise<{ exit, signal, timedOut, error }>
//
// POSIX: the child leads its own process group, so one signal to -pid ends the whole tree. Windows has no groups, so
// taskkill /T walks the tree. Settlement: once the child EXITS, or its timeout fires, the pipes get PIPE_GRACE_MS to
// drain. Then they are destroyed and the call ends with what arrived.

import { spawn, spawnSync } from "node:child_process";

/** How long the pipes may keep draining after the child exited, or after its timeout fired. */
export const PIPE_GRACE_MS = 2000;

/**
 * The environment a tool's bash runs under: this process's, less what makes bash run something else first. BASH_ENV is
 * sourced by every non-interactive bash -- it exported ARC_SETTINGS from a file profile-request never named, and the
 * request said "from strict" while the tree said standard (PR 4 round-2 logic attack) -- an exported function
 * (BASH_FUNC_*) shadows any command a script calls, and ENV is sh's twin of BASH_ENV.
 * @returns {NodeJS.ProcessEnv}
 */
export function bashEnv() {
  /** @type {NodeJS.ProcessEnv} */
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    const K = k.toUpperCase();
    if (K === "BASH_ENV" || K === "ENV" || K === "SHELLOPTS" || K === "BASHOPTS" || K.startsWith("BASH_FUNC_")) continue;
    env[k] = v;
  }
  return env;
}
const IS_WIN = process.platform === "win32";

/**
 * End a child AND everything it started. Windows: taskkill /T walks the whole tree, nested tools included.
 * POSIX, `graceful`: SIGTERM to the group first, and nothing else -- the caller SIGKILLs the group once the pipes'
 * grace is over. A child that runs children of its OWN in their own groups (propose runs git, the door runs propose)
 * ends them in its SIGTERM handler; SIGKILL straight away never reached them, and git kept running, and could write the
 * branch, after the door had called the run over (PR 3a round-2 shell attack). Not graceful: SIGKILL now.
 * @param {import("node:child_process").ChildProcess} child @param {{ graceful?: boolean }} [o]
 */
export function killTree(child, o = {}) {
  if (!child.pid) return;
  if (IS_WIN) {
    try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore", timeout: 10_000 }); } catch { /* fall through */ }
  } else if (o.graceful) {
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* the group is gone, or never formed */ }
    return;
  } else {
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* the group is gone, or never formed */ }
  }
  try { child.kill("SIGKILL"); } catch { /* already gone */ }
}

/** A synchronous pause, for a shutdown path that cannot wait on the event loop. */
function pauseSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* no pause is possible here */ }
}

// Every child still running. A detached POSIX group does not die with its parent, so the parent ends them on its way
// out rather than leave a run nobody can observe.
const LIVE = new Set();
process.once("exit", () => { for (const c of LIVE) killTree(c); });
// "exit" does not fire on a signal, and Ctrl-C is how the door is stopped (round-2 shell attack: an interrupted door
// orphaned its running tool). A signal ends every live tree, then the process, with the signal's conventional code:
// SIGTERM first, a short pause for nested tools to end their own groups, then SIGKILL. SIGHUP too -- closing the
// terminal left a door's detached tools, a paid driver among them, running (PR 3a round-2 shell attack). Registered only
// while a child runs, so a process with nothing running keeps the default handling.
/** @param {number} code */
const onSignal = (code) => () => {
  for (const c of LIVE) killTree(c, { graceful: true });
  if (!IS_WIN && LIVE.size) pauseSync(PAUSE_MS);
  for (const c of LIVE) killTree(c);
  process.exit(code);
};
// THE PAUSE SHRINKS WITH DEPTH. A parent and its child both paused 300 ms, so the parent's SIGKILL could land before
// the child had SIGKILLed its own git groups, and those ran on (PR 3b shell attack). A child is handed its DEPTH, not a
// pause, and the depth counts only when the process that handed it down is this process's parent: an absolute value
// read from the owner's environment made door and tool pause alike, or stalled Ctrl-C for five seconds (PR 3b round-2).
// door 600, tool 450, its child 300, then 150; no two of the levels that exist are equal.
const DEPTH = (() => {
  const m = /^([0-9]{1,2}):([0-9]{1,10})$/.exec(process.env.ARC_SPAWN_DEPTH || "");
  return m && Number(m[2]) === process.ppid ? Math.min(Number(m[1]), 3) : 0;
})();
const PAUSE_MS = 600 - 150 * DEPTH;
const CHILD_DEPTH = `${DEPTH + 1}:${process.pid}`;
const SIGNALS = /** @type {const} */ ([["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]]);
const armed = new Map();
function armSignals() {
  if (armed.size) return;
  for (const [sig, code] of SIGNALS) { const h = onSignal(code); armed.set(sig, h); process.on(sig, h); }
}
function disarmSignals() {
  if (LIVE.size) return;
  for (const [sig, h] of armed) process.off(sig, h);
  armed.clear();
}

/**
 * Run one child with no shell between the caller and it.
 * @param {string} file @param {string[]} args
 * @param {{ cwd: string, env: Record<string, string>, input?: string | Buffer, timeoutMs: number,
 *   onData?: (stream: "out" | "err", chunk: Buffer) => void }} o
 * @returns {Promise<{ exit: number | null, signal: string | null, timedOut: boolean, error: string }>}
 */
export function spawnBounded(file, args, { cwd, env, input, timeoutMs, onData }) {
  return new Promise((resolveP) => {
    let child;
    try {
      child = spawn(file, args, {
        cwd, env: { ...(env ?? process.env), ARC_SPAWN_DEPTH: CHILD_DEPTH }, windowsHide: true, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
        // POSIX: the child leads its own group, so a timeout ends the WHOLE tree with one signal to -pid.
        detached: !IS_WIN,
      });
    } catch (e) {
      resolveP({ exit: null, signal: "spawn-failed", timedOut: false, error: e instanceof Error ? e.message : String(e) });
      return;
    }
    LIVE.add(child);
    armSignals();
    let timedOut = false;
    let settled = false;
    let error = "";
    child.stdout.on("data", (c) => { if (onData) onData("out", c); });
    child.stderr.on("data", (c) => { if (onData) onData("err", c); });
    if (input !== undefined) {
      // A child that exits before reading all of its input closes the pipe under the write: its exit says why.
      child.stdin.on("error", () => {});
      child.stdin.end(input);
    }
    // SETTLEMENT DOES NOT WAIT ON THE PIPES. "close" fires only when every holder of the child's stdout and stderr has
    // let go, and a descendant that left the child's group while inheriting them held a finished call open past its
    // own timeout. So once the child EXITS, or its timeout FIRES, the pipes get a short grace to drain.
    let grace = null;
    const finish = (exit, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (grace) clearTimeout(grace);
      LIVE.delete(child);
      disarmSignals();
      // A child that exits and leaves a descendant running has not finished: on POSIX its group is ended now, whatever
      // the exit. Windows has no group to signal once the child is gone -- that remainder is a debt row, not a claim.
      if (!IS_WIN && child.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch { /* the group is already empty */ } }
      resolveP({ exit, signal, timedOut, error });
    };
    const letGo = (exit, signal) => {
      if (settled || grace) return;
      grace = setTimeout(() => {
        for (const st of [child.stdout, child.stderr]) { try { st.destroy(); } catch { /* already closed */ } }
        finish(exit, signal);
      }, PIPE_GRACE_MS);
      grace.unref?.();
    };
    // Graceful: SIGTERM now; the SIGKILL to the group comes in finish(), after the pipes' grace.
    const timer = setTimeout(() => { timedOut = true; killTree(child, { graceful: true }); letGo(null, "timeout"); }, timeoutMs);
    child.on("exit", (code, signal) => letGo(code, signal));
    child.on("error", (e) => { error = e.message; finish(null, "spawn-failed"); });
    child.on("close", (code, signal) => finish(code, signal));
  });
}
