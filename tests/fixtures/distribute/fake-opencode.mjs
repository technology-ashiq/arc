#!/usr/bin/env node
// A scripted stand-in for `opencode` (ADR-2019's offline fake). It answers `--version`, and for `run` it records its
// argv as JSON in FAKE_OC_ARGV, touches FAKE_OC_MARKER, then plays the mode named by FAKE_OC_MODE on stdout in
// OpenCode's `--format json` event shape (type + sessionID + part, cost on step_finish's part). FAKE_OC_ENV names a
// file that receives the ARC_* variables the wrapper handed it.
//
//   ok         three steps at FAKE_OC_COST each (default 0.01), a text event, exit 0
//   overspend  steps at FAKE_OC_COST forever, one per 100 ms, until killed
//   nocost     three steps whose step_finish carries no cost, exit 0
//   stall      one step_start, then silence until killed
//   fail       one priced step, then exit 7
//
// FAKE_OC_GRANDCHILD set to a path: spawn a grandchild that writes that path after FAKE_OC_GRANDCHILD_MS (default
// 1500). The wrapper must kill the whole tree, so a killed run leaves that path absent.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
if (argv[0] === "--version") { process.stdout.write("1.17.18\n"); process.exit(0); }
if (process.env.FAKE_OC_ARGV) writeFileSync(process.env.FAKE_OC_ARGV, JSON.stringify(argv));
if (process.env.FAKE_OC_MARKER) writeFileSync(process.env.FAKE_OC_MARKER, "invoked\n");
if (process.env.FAKE_OC_ENV) {
  const pick = {};
  for (const k of ["ARC_HARNESS", "ARC_EVIDENCE", "ARC_SPINE_ROOT", "ARC_MODEL"]) pick[k] = process.env[k] ?? null;
  writeFileSync(process.env.FAKE_OC_ENV, JSON.stringify(pick));
}
if (process.env.FAKE_OC_GRANDCHILD) {
  const ms = Number(process.env.FAKE_OC_GRANDCHILD_MS || 1500);
  const code = "setTimeout(function(){require(\"fs\").writeFileSync(process.argv[1],\"alive\")}," + ms + ")";
  // unref: the fake must exit when its script ends, as OpenCode would, not wait on the grandchild. On Windows the
  // grandchild breaks away from libuv's kill-on-close job (detached), or the wrapper's own exit would kill it and the
  // positive control could never write; taskkill /T still reaches it through the parent pid while the fake lives.
  // Elsewhere it stays in the fake's process group, which is what the wrapper's group kill must reach.
  spawn(process.execPath, ["-e", code, process.env.FAKE_OC_GRANDCHILD], { stdio: "ignore", detached: process.platform === "win32" }).unref();
}

const session = "ses_fake0001TestSession";
const cost = Number(process.env.FAKE_OC_COST || 0.01);
let n = 0;
const emit = (o) => process.stdout.write(`${JSON.stringify({ timestamp: Date.now(), sessionID: session, ...o })}\n`);
const step = (priced) => {
  n++;
  emit({ type: "step_start", part: { id: `prt_s${n}`, sessionID: session, type: "step-start" } });
  const fin = { id: `prt_f${n}`, sessionID: session, type: "step-finish", reason: "tool-calls", tokens: { total: 100, input: 90, output: 10 } };
  if (priced) fin.cost = cost;
  emit({ type: "step_finish", part: fin });
};
const hold = () => setInterval(() => {}, 1 << 30);

switch (process.env.FAKE_OC_MODE || "ok") {
  case "ok":
    for (let i = 0; i < 3; i++) step(true);
    emit({ type: "text", part: { type: "text", text: "done" } });
    break;
  case "nocost":
    for (let i = 0; i < 3; i++) step(false);
    break;
  case "overspend":
    setInterval(() => step(true), 100);
    break;
  case "stall":
    emit({ type: "step_start", part: { id: "prt_s1", sessionID: session, type: "step-start" } });
    hold();
    break;
  case "fail":
    step(true);
    process.exitCode = 7;
    break;
  default:
    process.stderr.write(`fake-opencode: unknown FAKE_OC_MODE\n`);
    process.exitCode = 9;
}
