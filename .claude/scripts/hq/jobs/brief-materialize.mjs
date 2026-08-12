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
import { mkdirSync, writeFileSync } from "node:fs";
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
  });

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
  writeFileSync(out, text, "utf8");

  process.stdout.write(`brief-materialize: wrote ${text.length} bytes to ${out}\n`);
  process.stdout.write(`${JSON.stringify({ day, bytes: text.length, path: out })}\n`);
  process.exit(0);
}

try {
  main();
} catch (e) {
  process.stderr.write(`brief-materialize: ${e?.message || e}\n`);
  process.exit(1);
}
