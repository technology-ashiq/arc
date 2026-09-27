// arc-attack's watch: a surface says where it is while it runs, and cannot outlive its deadline (engine out-of-cycle
// bug, 2026-09-26 -- a logic run sat silent for ~1.5 h). Held on `runWatched`, the one place a surface's child is
// spawned, against children that truly hang or exit -- arc-run itself ends on its own budget first, so the watchdog is
// only provable on a child that ignores one.
//   A. a child that prints one line and then hangs: a started line, heartbeats quoting that line, the status file ONE
//      line at every moment, and the watchdog ending it just past its deadline.
//   B. a child that exits at once: its code, no watchdog, the status file's last word is the exit.
//   C. malformed timing is refused, never read as "no deadline"; and the CLI refuses it before anything runs.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const AA = await import(pathToFileURL(join(REPO, ".claude/scripts/engine/arc-attack.mjs")).href);
let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};

/** runWatched with this process's stderr captured, and the status file sampled while it runs. */
async function watched(code, time, statusFile) {
  const said = [];
  const samples = [];
  const real = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => { said.push(String(chunk)); return true; };
  const poll = setInterval(() => { if (existsSync(statusFile)) samples.push(readFileSync(statusFile, "utf8")); }, 40);
  try {
    const r = await AA.runWatched({ argv: ["-e", code], cwd: REPO, env: { ...process.env }, label: "LOGIC", time, statusFile });
    return { r, said: said.join("").split("\n").filter(Boolean), samples, last: readFileSync(statusFile, "utf8") };
  } finally {
    clearInterval(poll);
    process.stderr.write = real;
  }
}

const tmp = mkdtempSync(join(tmpdir(), "engine-attack-watch-"));
try {
  // ---- A. prints once, then hangs ----
  {
    const status = join(tmp, "a.status");
    const time = { minutes: 0.01, heartbeatMs: 100, graceMs: 0 };
    const w = await watched("process.stderr.write('generic-api: attempt 1/3: timeout after 1s\\n'); setInterval(() => {}, 1e9);", time, status);
    check("fixture: the hanging child was spawned and ran until ended (vacuous-pass guard)", w.r && w.r.ms >= 500 && w.said.length >= 2, `ms=${w.r && w.r.ms} said=${w.said.length}`);
    check("A: a started line first, naming the deadline and the minutes", /^LOGIC: started \d\d:\d\d · deadline \d\d:\d\d \(0\.01m\)$/.test(w.said[0] || ""), JSON.stringify(w.said[0]));
    const beats = w.said.filter((l) => l.startsWith("LOGIC: running "));
    check("A: heartbeats while it ran, each quoting the child's latest line",
      beats.length >= 2 && beats.every((l) => /· deadline \d\d:\d\d · last: generic-api: attempt 1\/3: timeout after 1s$/.test(l)), JSON.stringify(beats.slice(0, 2)));
    check("A: the watchdog ended the child just past its deadline -- not before, not minutes after",
      w.r.killed === true && w.r.status === null && w.r.ms >= 550 && w.r.ms < 10_000, `killed=${w.r.killed} ms=${w.r.ms}`);
    check("A: the status file was ONE line at every sample, and its last word names the watchdog",
      w.samples.length >= 2 && w.samples.every((s) => s.split("\n").filter(Boolean).length === 1) && /ended by the watchdog at the deadline/.test(w.last), JSON.stringify({ n: w.samples.length, last: w.last }));
  }
  // ---- B. exits at once ----
  {
    const status = join(tmp, "b.status");
    const w = await watched("process.exit(3)", { minutes: 1, heartbeatMs: 60_000, graceMs: 0 }, status);
    check("B: a child that exits is reported with its own code, and no watchdog fired", w.r.killed === false && w.r.status === 3, JSON.stringify({ killed: w.r.killed, status: w.r.status }));
    check("B: the status file's last word is the exit", /^LOGIC: ended after 0m0\ds \(exit 3\)$/.test(w.last.trim()), JSON.stringify(w.last));
  }
  // ---- D. a grandchild holding the pipes dies with the tree, and the watch settles (attack 415d3a3 B1) ----
  {
    const status = join(tmp, "d.status");
    const code = "const { spawn } = require('node:child_process'); spawn(process.execPath, ['-e', 'setInterval(() => {}, 1e9)'], { stdio: 'inherit' }); setInterval(() => {}, 1e9);";
    const t0 = Date.now();
    const w = await watched(code, { minutes: 0.01, heartbeatMs: 100, graceMs: 0 }, status);
    check("D: a child whose own child holds the pipes open is ended as a tree, and the watch settles within the backstop",
      w.r.killed === true && Date.now() - t0 < 15_000 && /ended by the watchdog/.test(w.last), `killed=${w.r.killed} ms=${Date.now() - t0}`);
  }
  // ---- E. stdin is closed: a reader sees EOF at once, not the watchdog (B2) ----
  {
    const status = join(tmp, "e.status");
    const w = await watched("process.stdin.resume(); process.stdin.on('end', () => process.exit(4));", { minutes: 1, heartbeatMs: 60_000, graceMs: 0 }, status);
    check("E: a child that reads stdin to EOF gets EOF at once and exits on its own", w.r.killed === false && w.r.status === 4 && w.r.ms < 10_000, JSON.stringify({ status: w.r.status, ms: w.r.ms }));
  }
  // ---- F. a line split across two writes is never quoted as a fragment (L3) ----
  {
    const status = join(tmp, "f.status");
    const code = "process.stderr.write('generic-api: attempt 1/3: tim'); setTimeout(() => process.stderr.write('eout after 1s\\n'), 400); setInterval(() => {}, 1e9);";
    const w = await watched(code, { minutes: 0.02, heartbeatMs: 100, graceMs: 0 }, status);
    const beats = w.said.filter((l) => l.startsWith("LOGIC: running "));
    check("F: no heartbeat ever quotes half a line; once the line completes, the whole line is quoted",
      beats.length >= 3 && beats.every((l) => !/· last: generic-api: attempt 1\/3: tim$/.test(l)) && beats.some((l) => l.endsWith("· last: generic-api: attempt 1/3: timeout after 1s")), JSON.stringify(beats.slice(0, 6)));
  }
  // ---- G. a secret-shaped line never reaches the heartbeat or the status file (B3) ----
  {
    const status = join(tmp, "g.status");
    // Assembled at run time: this file's source must pass the same rule it proves (see tests/redact-env-read.mjs).
    const fake = ["pass", "word=hunter2hunter2hunter2"].join("");
    const w = await watched(`process.stderr.write(${JSON.stringify(fake)} + '\\n'); setInterval(() => {}, 1e9);`, { minutes: 0.01, heartbeatMs: 100, graceMs: 0 }, status);
    const everything = [...w.said, ...w.samples, w.last].join("\n");
    check("G: a child's line matching a secret rule is withheld from every heartbeat and every status-file sample",
      w.said.filter((l) => l.startsWith("LOGIC: running ")).length >= 1 && !everything.includes("hunter2hunter2"), everything.slice(0, 300));
  }
  // ---- C. malformed timing is refused ----
  {
    const bad = ["abc", "0", "-5", "1e400", "241"].map((v) => AA.timing({ ARC_ATTACK_MINUTES: v }));
    check("C: ARC_ATTACK_MINUTES that is not a number from 0.01 to 240 is an error, never 'no deadline'", bad.every((b) => "error" in b), JSON.stringify(bad));
    const d = AA.timing({});
    check("C: the defaults are a 30-minute deadline, a 60 s heartbeat and a 60 s grace", d.minutes === 30 && d.heartbeatMs === 60_000 && d.graceMs === 60_000, JSON.stringify(d));
    const cli = spawnSync(process.execPath, [join(REPO, ".claude/scripts/engine/arc-attack.mjs"), "--base", "HEAD", "--classification", "external-ok"],
      { cwd: REPO, env: { ...process.env, ARC_ATTACK_MINUTES: "abc" }, encoding: "utf8", timeout: 60_000 });
    check("C: the CLI refuses a malformed ARC_ATTACK_MINUTES before anything runs (exit 2, named)",
      cli.status === 2 && /ARC_ATTACK_MINUTES="abc" is not a number/.test(cli.stderr) && !/started/.test(cli.stderr), `${cli.status} ${cli.stderr.slice(0, 200)}`);
  }
} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch (e) { console.log(`WARN the scratch dir was not removed: ${tmp} (${e.code || "error"})`); }
}
console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran === 14 ? 0 : 1;
