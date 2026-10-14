#!/usr/bin/env node
// Drives ci-digest's waitFor (ADR-2021) with a scripted digest, a fake clock and a fake sleep, so every case
// runs in milliseconds and nothing touches GitHub. Prints one `case` line per scenario, then `RAN ci-wait-probe`.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { waitFor } = await import(pathToFileURL(join(here, "..", "..", ".claude", "scripts", "review", "ci-digest.mjs")).href);

const PENDING = { code: 3, lines: ["PENDING: jobs are still running"] };
const NO_RUN = { code: 3, lines: ["PENDING: no CI run exists yet"], noRun: true };
const GREEN = { code: 0, lines: ["GREEN: every job concluded green."] };
const RED = { code: 1, lines: ["RED: 1 job(s) failed."] };
const THROW = Symbol("throw");
const MISMATCH = { code: 4, lines: ["SHA MISMATCH: newest run is for another commit"] };

function play(name, script, timeoutMin) {
  let t = 0, sleeps = 0, reads = 0, prViews = 0;
  const once = () => { const r = script[Math.min(reads, script.length - 1)]; reads++; if (r === THROW) throw new Error("gh: HTTP 502"); return r; };
  const gh = (args) => { if (args[0] === "pr" && args[1] === "view") { prViews++; return '{"isDraft":false,"mergeable":"CONFLICTING","state":"OPEN"}'; } throw new Error("unexpected gh call"); };
  let out;
  try { out = waitFor(once, timeoutMin, gh, () => t, (ms) => { sleeps++; t += ms; }); }
  catch (e) { out = { code: "threw", lines: [String(e.message)] }; }
  const last = out.lines.filter((l) => !l.startsWith("ci-digest: settled")).pop();
  process.stdout.write(`case ${name} code=${out.code} reads=${reads} sleeps=${sleeps} prviews=${prViews} last=${last}\n`);
}

play("settles-green", [PENDING, PENDING, GREEN], 20);
play("settles-red", [PENDING, RED], 20);
play("mismatch-at-once", [MISMATCH], 20);
play("never-settles", [PENDING], 3);
play("no-run", [NO_RUN], 20);
play("run-appears-in-time", [NO_RUN, NO_RUN, GREEN], 20);
play("no-run-short-timeout", [NO_RUN], 2);
play("gh-blips-then-green", [THROW, THROW, GREEN], 20);
play("gh-down", [THROW], 20);
process.stdout.write("RAN ci-wait-probe\n");
