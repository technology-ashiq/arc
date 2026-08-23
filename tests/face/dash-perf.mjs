#!/usr/bin/env node
// dash-perf.mjs -- assumption row 1: the read door serves <1 s p95 on a 10k-event fixture
// spine with cursor paging. Measured, never asserted (the trigger arms the sqlite
// accelerator path / Tape cut if this ever fails on a CI leg -- including the Windows
// leg, which is the one this lane develops on).
//
// VACUOUS-PASS GUARD: the walk asserts it visited ALL 10k events before any timing is
// believed -- a p95 over an empty spine is a fast lie.

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PORT = 8412;

const tmp = mkdtempSync(join(tmpdir(), "face-perf-"));
const SPINE = join(tmp, "spine");

const gen = JSON.parse(execFileSync(process.execPath,
  [join(REPO, "tests/fixtures/face/gen-spine.mjs"), "--out", SPINE, "--count", "10000", "--days", "40", "--seed", "perf-ci"],
  { stdio: ["ignore", "pipe", "inherit"] }).toString());

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name} ${detail}`);
};

check("10k fixture loaded (vacuous-pass guard)", gen.events === 10000);

const dash = spawn(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--spine", SPINE, "--port", String(PORT)],
  { env: { ...process.env, ARC_DASH_TOKEN: "perf-token", ARC_DASH_JOURNAL_DIR: join(tmp, "journal") }, stdio: "ignore" });
dash.unref();
const H = { Authorization: "Bearer perf-token" };
let up = false;
for (let i = 0; i < 50 && !up; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { up = (await fetch(`http://127.0.0.1:${PORT}/api/health`, { headers: H })).status === 200; } catch { /* not yet */ }
}

try {
  check("door up", up);
  const times = [];
  let cursor = null, walked = 0, more = true;
  while (more) {
    const url = `http://127.0.0.1:${PORT}/api/spine?limit=500${cursor ? `&since=${cursor}` : ""}`;
    const t0 = performance.now();
    const r = await (await fetch(url, { headers: H })).json();
    times.push(performance.now() - t0);
    walked += r.count;
    cursor = r.next;
    more = r.more;
    if (times.length > 40) break; // a runaway loop is its own failure
  }
  check("walked the WHOLE spine through the cursor", walked === 10000, `walked=${walked} pages=${times.length}`);
  times.sort((a, b) => a - b);
  const p95 = times[Math.max(0, Math.ceil(times.length * 0.95) - 1)];
  check("p95 < 1000 ms (assumption row 1)", p95 < 1000, `p50=${times[Math.floor(times.length / 2)].toFixed(0)}ms p95=${p95.toFixed(0)}ms max=${times[times.length - 1].toFixed(0)}ms`);
} finally {
  await new Promise((r) => { dash.on("exit", r); dash.kill(); setTimeout(r, 1500); });
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 4 ? 0 : 1;
