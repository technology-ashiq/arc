// tree-holder.mjs -- the stand-in for harness-run in the debt #D23 fixture: starts a node child through spawnTracked
// that itself starts a grandchild, prints `PIDS child grandchild`, installs the harness's stop handlers and waits.
// `--mutant` stops only the direct child on shutdown, the defect the fixture must catch.
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const proc = await import(pathToFileURL(join(REPO, "face", "scripts", "proc.mjs")).href);
const mutant = process.argv.includes("--mutant");

// The child prints its grandchild's pid on stdout, then holds; the grandchild only holds.
const childCode = `const { spawn } = require("node:child_process");
const g = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true });
process.stderr.write("GRANDCHILD " + g.pid + "\\n");
setInterval(() => {}, 1000);`;
const child = proc.spawnTracked(process.execPath, ["-e", childCode]);
let grand = 0;
child.stderr.on("data", (d) => {
  const m = /GRANDCHILD (\d+)/.exec(d.toString("utf8"));
  if (m && !grand) { grand = Number(m[1]); process.stdout.write(`PIDS ${child.pid} ${grand}\n`); }
});

if (mutant) {
  // The defect: on stop, end the direct child only, as the old win32 path did.
  const stop = () => { try { child.kill("SIGKILL"); } catch { /* gone */ } setTimeout(() => process.exit(143), 300); };
  process.once("SIGTERM", stop);
  process.on("message", (m) => { if (m && m.type === "shutdown") stop(); });
} else {
  proc.installStopHandlers(async () => {});
}
setInterval(() => {}, 1000);
void spawn;
