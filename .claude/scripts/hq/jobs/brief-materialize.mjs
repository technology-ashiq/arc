#!/usr/bin/env node
/**
 * brief-materialize.mjs -- render the day's brief into instance state so the morning read costs
 * nothing.
 *
 * INSTANCE STATE, NEVER THE REPO. The brief is a VIEW of the spine at a moment. Committing one
 * would make it a second truth that drifts from the events it was derived from, and ADR-0025
 * already puts the spine in instance state for the same reason. `.claude/state/` is gitignored,
 * which is exactly where a derived artifact belongs.
 *
 * IT SHELLS OUT TO arc-brief RATHER THAN RE-RENDERING. `arc-brief.mjs` is deterministic by
 * construction and golden-fixtured; a second renderer here would be a second truth about what a
 * brief IS, and the first time the two disagreed the fixture would still be green. The job's
 * whole job is choosing a date, capturing bytes, and writing them somewhere.
 *
 * Zero dependencies, Node 18+.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spineRoot } from "../lib/spine-io.mjs";
import { formatIst, dayOf, nowMs } from "../lib/canonical.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_BRIEF = resolve(HERE, "..", "arc-brief.mjs");

function main() {
  const root = spineRoot();
  // IST, from the canonical helper. A brief materialised against the host's local day would be
  // yesterday's brief on a UTC box every morning before 05:30.
  const day = dayOf(formatIst(nowMs()));

  const r = spawnSync(process.execPath, [ARC_BRIEF, "--date", day], {
    encoding: "utf8",
    windowsHide: true,
    // A brief grows with the spine, and spawnSync truncates at 1MB by default -- reporting the
    // overflow as `status: null` with `error.code === "ENOBUFS"`, which reads as "exited null".
    maxBuffer: 32 * 1024 * 1024,
  });

  // `r.error` is the ONLY signal for ENOENT, EACCES, EMFILE and a maxBuffer overflow: all four
  // arrive with `status === null`, so a bare status check reports "exited null" for four very
  // different problems and names none of them.
  if (r.error) {
    process.stderr.write(`brief-materialize: could not run arc-brief: ${r.error.code || r.error.message}\n`);
    process.exit(1);
  }
  if (r.status !== 0) {
    process.stderr.write(`brief-materialize: arc-brief exited ${r.status}: ${String(r.stderr || "").trim().slice(0, 400)}\n`);
    process.exit(1);
  }

  const text = String(r.stdout || "");
  // An empty render is a failure, not a quiet success. A zero-byte brief file would read as
  // "the morning was quiet" when what actually happened is that the renderer produced nothing.
  if (text.trim() === "") {
    process.stderr.write("brief-materialize: arc-brief produced no output -- refusing to write an empty brief, which would read as a quiet day rather than a broken render\n");
    process.exit(1);
  }

  const dir = join(root, "briefs");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${day}.txt`);

  // WRITTEN ATOMICALLY: temp file, then rename onto the target. A bare writeFileSync truncates
  // first and writes second, so a kill or a suspend between the two leaves a half-rendered
  // brief that the morning read cannot tell from a complete one. This job fires at 06:00 on a
  // Modern-Standby-only machine (ADR-0804), which makes a mid-write suspend the expected case
  // rather than the exotic one. Rename within a directory is atomic on all three platforms.
  const tmp = `${out}.tmp`;
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, out);

  // Read the size back off the ARTIFACT. The emptiness guard above checked the CHILD'S stdout,
  // which says nothing about the bytes that actually landed.
  const landed = statSync(out).size;
  if (landed === 0) {
    process.stderr.write(`brief-materialize: ${out} is zero bytes after the write -- refusing to report a brief that is not there\n`);
    process.exit(1);
  }

  process.stdout.write(`brief-materialize: wrote ${landed} bytes to ${out}\n`);
  process.stdout.write(`${JSON.stringify({ day, bytes: landed, path: out })}\n`);
  process.exit(0);
}

try {
  main();
} catch (e) {
  process.stderr.write(`brief-materialize: ${e?.message || e}\n`);
  process.exit(1);
}
