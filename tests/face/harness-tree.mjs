// harness-tree.mjs -- debt #D23: a harness told to stop ends its children's WHOLE tree. A stand-in holder
// (tests/fixtures/face/tree-holder.mjs) starts a child that starts a grandchild; it is stopped the way a runner stops
// the harness -- SIGTERM on POSIX, the IPC `shutdown` message on win32 -- and a pid probe asserts child AND grandchild
// are gone. The mutant holder that ends only the direct child must leave its grandchild alive, which the probe sees.
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOLDER = join(REPO, "tests", "fixtures", "face", "tree-holder.mjs");
const POSIX = process.platform !== "win32";
let ran = 0, failed = 0;
const check = (name, cond, detail = "") => { ran++; if (cond) console.log(`ok ${name}`); else { failed++; console.log(`not-ok ${name} ${detail}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const reap = (pid) => { try { if (POSIX) process.kill(pid, "SIGKILL"); else spawnSync("taskkill", ["/T", "/F", "/PID", String(pid)], { stdio: "ignore", windowsHide: true, timeout: 10000 }); } catch { /* gone */ } };

/** Start a holder, read its pids, stop it as a runner would, and report who is still alive 4 s later. */
async function run(args) {
  const h = spawn(process.execPath, [HOLDER, ...args], { stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true });
  let out = "";
  h.stdout.on("data", (d) => { out += d.toString("utf8"); });
  const t0 = Date.now();
  while (!/PIDS \d+ \d+/.test(out) && Date.now() - t0 < 20000) await sleep(100);
  const m = /PIDS (\d+) (\d+)/.exec(out);
  if (!m) { h.kill("SIGKILL"); return { started: false }; }
  const [child, grand] = [Number(m[1]), Number(m[2])];
  const before = { child: alive(child), grand: alive(grand) };
  if (POSIX) h.kill("SIGTERM"); else h.send({ type: "shutdown" });
  const t1 = Date.now();
  while (Date.now() - t1 < 4000 && (alive(child) || alive(grand))) await sleep(100);
  return { started: true, child, grand, before, after: { child: alive(child), grand: alive(grand) } };
}

console.log(`RAN harness-tree on ${process.platform}`);
const real = await run([]);
check("the stand-in tree started: a child and a grandchild, both alive (vacuous-pass guard)", real.started && real.before.child && real.before.grand, JSON.stringify(real));
console.log(`RAN pids child=${real.child} grandchild=${real.grand} stop=${POSIX ? "SIGTERM" : "ipc shutdown"}`);
check("a stopped harness ends its child AND its grandchild (pid probe)", real.started && !real.after.child && !real.after.grand, JSON.stringify(real.after));
if (real.started) { reap(real.child); reap(real.grand); }

if (POSIX) {
  const mut = await run(["--mutant"]);
  check("MUTANT CONTROL: a stop that ends only the direct child leaves the grandchild alive, and the probe sees it",
    mut.started && !mut.after.child && mut.after.grand, JSON.stringify(mut));
  if (mut.started) { reap(mut.child); reap(mut.grand); }
} else {
  // libuv puts a non-detached child in a kill-on-close job object, so the direct-child-only stop already ends the tree
  // on win32 (CI windows shard 11, run 39680716611): there is no surviving grandchild for a mutant to leave behind.
  console.log("SKIP MUTANT CONTROL on win32: libuv's kill-on-close job ends a child's descendants with it");
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran === (POSIX ? 3 : 2) ? 0 : 1;
