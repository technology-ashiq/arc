#!/usr/bin/env node
// engine-usage-flag-probe.mjs -- pins a VENDOR NO-OP so the day it stops being one, we hear about it.
//
// `hermes --usage-file PATH` is documented on the pinned image's own `--help`:
//
//   --usage-file PATH   One-shot mode only: after the run, write a JSON usage report
//                       (estimated cost, token counts, model, api_calls) to PATH. The report is
//                       written even when the run fails, so pipelines can always account for spend.
//
// It writes nothing. Measured four ways on 2026-08-16 against
// nousresearch/hermes-agent@sha256:16788311e2fa...3712c9e (Hermes Agent v0.20.0 / 2026.8.3):
// a mounted path, a whole-volume search, a container-internal path checked with `docker diff`,
// and a stdout/stderr scan. Silent every time, exit 0 every time. See ADR-0221.
//
// WHY THIS PROBE PINS THE CONCLUSION AND NOT THE MECHANISM. `tests/bench-steel-probe.mjs` was
// written to "fail loudly" the day the model seam landed. It did not: it asserted the mechanism
// that did not change (environment variables) while the seam arrived as flags, so two literally
// true assertions outlived the conclusion they were written to defend. The lesson is that a
// tripwire must assert THE THING IT CARES ABOUT. This one cares about exactly one sentence --
// *no usage file appears* -- so that is the assertion, and any implementation that starts
// producing one turns it red no matter how the vendor gets there.
//
// GOING RED HERE IS GOOD NEWS. It means ADR-0221 clause 4 can be re-decided and the MP-F seat can
// carry a measured model id instead of `unpinned`. Read the ADR before "fixing" the test.
//
// SKIPS, LOUDLY AND WITH A REASON, when Docker or the image is unavailable. A probe that silently
// passes on a machine that could not run it is a green light nobody earned.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeSync } from "node:fs";
import { join } from "node:path";

const IMAGE = process.env.ARC_HERMES_IMAGE
  || "nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e";
const DOCKER = process.env.ARC_HERMES_DOCKER || "docker";

// A generous ceiling: the measured warm run was 129s and the cold one exceeded 400s. This probe is
// only meaningful on a warm volume, which is why it declines rather than guesses on a cold one.
const RUN_TIMEOUT_MS = Number(process.env.ARC_HERMES_PROBE_TIMEOUT_MS || 300_000);

// WRITE SYNCHRONOUSLY AND SET exitCode -- never console.log then process.exit(). node's
// stdout-to-a-pipe is synchronous on windows and linux and ASYNCHRONOUS on macOS, and
// `process.exit()` discards whatever is still queued: drivers/common.mjs records 8 MiB written and
// 458752 received, writer exit 0. bats `run` captures through a pipe and then greps for this exact
// line, so on the one leg where it can be lost, it would be.
function say(line) { writeSync(1, `${line}\n`); }

function skip(why) {
  say(`SKIP engine-usage-flag-probe -- ${why}`);
  process.exit(0);
}

function daemonUp() {
  const r = spawnSync(DOCKER, ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", timeout: 30_000 });
  return r.status === 0 && String(r.stdout || "").trim().length > 0;
}

function imagePresent() {
  const r = spawnSync(DOCKER, ["image", "inspect", IMAGE], { encoding: "utf8", timeout: 60_000 });
  return r.status === 0;
}

if (!daemonUp()) skip("the Docker daemon is not reachable -- this probe needs the real runtime, never a stand-in");
if (!imagePresent()) skip(`the pinned image is not present locally (${IMAGE}) -- pull it before trusting this result`);

// THE VOLUME MUST BE THE CONFIGURED ONE, AND THE FIRST VERSION OF THIS PROBE GOT THAT WRONG.
// It created an empty mkdtemp volume, so the runtime had no model endpoint, exited 1, and the
// probe skipped -- every single time. A probe that always skips is not a tripwire, it is a green
// tick nobody earned, which is the exact defect this file was written to avoid repeating. So it
// runs against ARC_HERMES_DATA -- the same warm, configured volume the real hire uses -- or it
// declines and says which.
const vol = process.env.ARC_HERMES_DATA || "";
if (!vol) skip("ARC_HERMES_DATA is unset -- this probe needs the CONFIGURED runtime volume, because an empty one has no model endpoint and can only ever fail");
if (!existsSync(join(vol, "config.yaml"))) skip(`${vol} has no config.yaml -- an unconfigured volume cannot reach a model, so a failed run here would say nothing about the flag`);

let failures = 0;
// Only files newer than this instant count. The configured volume is the runtime's own home and
// is full of its caches; "a usage file exists" would otherwise be answerable by something an
// earlier run left behind.
const startedAt = Date.now();

{
  // ASK FOR THE REPORT AT A PATH THE HOST CAN SEE. If the flag ever works, the file lands here.
  const usageInContainer = "/opt/data/probe.usage.json";

  // THE ARGV MUST MATCH WHAT THE DRIVER ACTUALLY SENDS, OR THIS PROBE MEASURES A SHAPE PRODUCTION
  // NEVER USES. The first version put `--usage-file` BEFORE `-z <prompt>` while
  // drivers/hermes.mjs pushed it AFTER -- and a one-shot CLI that treats everything following
  // `-z` as prompt text swallows one and honours the other. A tripwire whose command line differs
  // from production's is the "assert the thing it cares about" rule broken from the other end.
  // Kept in sync by construction: the driver builds this same order.
  //
  // `--name` for the same reason drivers/hermes.mjs uses one: `--rm` alone does not clean up when
  // the CLI is SIGKILLed at the timeout -- the container outlives it. Without a name there is
  // nothing to reap by, and the orphan keeps running READ-WRITE inside the operator's configured
  // runtime home with nobody holding a handle.
  const name = `arc-usage-probe-${process.pid}-${Date.now()}`;
  const run = spawnSync(DOCKER, [
    "run", "--rm", "--name", name,
    "-v", `${vol}:/opt/data`,
    IMAGE,
    "-z", "Reply with ONE JSON document and nothing after it: {\"ok\": true}",
    "--usage-file", usageInContainer,
  ], { encoding: "utf8", timeout: RUN_TIMEOUT_MS, killSignal: "SIGKILL", maxBuffer: 64 * 1024 * 1024 });

  // Reap unconditionally. A container that already exited makes this a no-op; one that outlived
  // the CLI is stopped here rather than left on the operator's volume.
  spawnSync(DOCKER, ["rm", "-f", name], { encoding: "utf8", timeout: 60_000 });

  // A COLD VOLUME CANNOT ANSWER THIS QUESTION. First boot populates the whole data dir and the
  // measured cold run blew past 400s; a timeout here says nothing about the flag, so the probe
  // declines rather than reporting a no-op it did not observe. This is the difference between
  // "no file appeared" and "the run never got far enough to write one".
  if (run.error && run.error.code === "ETIMEDOUT") {
    skip(`the run did not finish inside ${RUN_TIMEOUT_MS}ms (cold volume?) -- no conclusion drawn about the flag`);
  }
  if (run.status !== 0) {
    skip(`the runtime exited ${run.status}, so the "written even when the run fails" clause is the only one in play and this probe does not test it`);
  }

  // ASSERTION 1 -- the run actually produced its answer. Without this the probe could pass on a
  // container that booted and did nothing, which is a vacuous pass wearing a green tick.
  const lastLine = String(run.stdout || "").trim().split("\n").pop() || "";
  let answered = false;
  try { answered = JSON.parse(lastLine).ok === true; } catch { answered = false; }
  if (!answered) {
    say(`not ok 1 - the run did not produce its answer on the last stdout line, so nothing below is meaningful (got: ${JSON.stringify(lastLine.slice(0, 120))})`);
    failures += 1;
  } else {
    say("ok 1 - the run reached its answer, so the flag had a real run to report on");
  }

  // ASSERTION 2 -- THE PINNED CONCLUSION. No usage report appears anywhere in the volume.
  // The whole tree is walked rather than the one requested path, because "it wrote it somewhere
  // else" and "it did not write it" are different findings and only the second is what ADR-0221
  // recorded.
  const found = [];
  (function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/usage/i.test(e.name)) continue;
      // The runtime writes caches of its own; only a NON-EMPTY file matching `usage` AND written
      // during this run counts as a report. Size and mtime are printed so a red result carries
      // its own evidence rather than asking the reader to go and look.
      let st;
      try { st = statSync(p); } catch { continue; /* raced away, treat as absent */ }
      if (st.size > 0 && st.mtimeMs >= startedAt) found.push(`${p} (${st.size} bytes, written during this run)`);
    }
  })(vol);

  if (found.length === 0) {
    say("ok 2 - --usage-file wrote nothing, which is ADR-0221's recorded finding and still true");
  } else {
    say("not ok 2 - A USAGE REPORT APPEARED. This is GOOD NEWS, not a regression -- but it is");
    say("          NOT yet proof the vendor flag works. ADR-0221 recorded one such file in five");
    say("          runs, and could not tell whether the FLAG wrote it or the AGENT did, having");
    say("          seen the filename in its own argv. THE FILE IS LEFT ON DISK ON PURPOSE:");
    say("          read it before deciding. A usage report should carry token counts, a model");
    say("          and api_calls; anything else means the agent wrote it.");
    for (const f of found) say(`          found: ${f}`);
    failures += 1;
  }
}
// NOTHING IS DELETED HERE, AND THAT IS THE WHOLE POINT.
//
// Two earlier versions of this file got the teardown wrong, and the second mistake cost real
// evidence. Version 1 made its own temp volume and did `rmSync(vol, {recursive:true})`; the
// moment `vol` became ARC_HERMES_DATA that line would have destroyed the operator's configured
// runtime home. Version 2 narrowed it to deleting only `probe.usage.json` -- and then, on the
// single run out of five where a report actually appeared, DELETED THE 410 BYTES before anyone
// read them. The verdict was carried; the artifact was not looked at. That is the exact failure
// this repo has written down twice.
//
// So a report that appears is LEFT ON DISK, and its path is printed above. It is the only
// evidence that can settle what wrote it -- the vendor flag, or the agent itself acting on a
// filename it saw in its own argv.

say(`1..2`);
process.exit(failures === 0 ? 0 : 1);
